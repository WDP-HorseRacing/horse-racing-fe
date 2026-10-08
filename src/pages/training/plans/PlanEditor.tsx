// F2.2 — Trình lập giáo án (HLV trưởng). Bố cục 5/7: trái là thư viện môn, phải là lộ trình.
// Lộ trình là các khối môn theo thứ tự, mỗi khối học trong N tuần. Dải tuần phía trên đổi ngay khi sửa.
// Lưu là thay toàn bộ danh sách môn (PUT). Lớp đã tạo từ giáo án giữ nguyên buổi tập.
import { useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Info, Plus, Save, Trash2, X } from 'lucide-react';
import { createPlan, deletePlan, getPlan, listClasses, listSubjects, replacePlan } from '../../../api/training';
import type { TrainingClass, TrainingIntensity, TrainingPlan, TrainingSubject } from '../../../api/types';
import {
  Button,
  CharCount,
  ChipFilter,
  ConfirmDialog,
  ErrorBox,
  Field,
  Input,
  NotFound,
  Notice,
  PageHeader,
  SearchInput,
  Skeleton,
  Textarea,
  Tip,
  cn,
  invalidClass,
  useToast,
} from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { useLeaveConfirm } from '../../../hooks/useLeaveConfirm';
import { can } from '../../../auth/permissions';
import { useStore } from '../../../store/store';
import { links } from '../../../lib/links';
import { formatMeters, formatRaceTime } from '../../../lib/training-format';
import { INTENSITIES, intensityText } from '../../../lib/training-labels';
import { useCrumbs } from '../../../components/Breadcrumb';
import { gsap } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { IntensityBars, TrialBadge, WeekRibbon, type RibbonSegment } from '../components/bits';
import { Stepper } from '../components/Stepper';
import { useFlip } from '../components/motion';

interface Block {
  uid: string;
  subjectId: string;
  weeks: number;
}

let uidSeed = 0;
const nextUid = () => `b${(uidSeed += 1)}`;

export default function PlanEditor() {
  const { id } = useParams();
  const user = useStore((state) => state.currentUser);
  const data = useService(async () => {
    const [subjects, plan, classes] = await Promise.all([
      listSubjects(),
      id ? getPlan(id) : Promise.resolve(undefined),
      id ? listClasses().catch(() => [] as TrainingClass[]) : Promise.resolve([] as TrainingClass[]),
    ]);
    return { subjects, plan, classes: classes.filter((item) => item.planId === id) };
  }, [id]);
  useCrumbs(data.data ? (id ? [{ label: data.data.plan?.name ?? 'Giáo án', to: id ? links.plan(id) : undefined }, { label: 'Sửa' }] : [{ label: 'Lập giáo án' }]) : null, [{ label: 'Giáo án', to: links.plans }]);

  if (!can(user, 'plan.manage')) return <NotFound message="Chỉ huấn luyện viên trưởng lập và sửa được giáo án của mình." />;
  if (data.loading && !data.data) return <Skeleton rows={8} />;
  if (data.error || !data.data) return <NotFound message={data.error} />;
  if (id && data.data.plan && data.data.plan.headTrainerId !== user?.id) return <NotFound message="Giáo án này của huấn luyện viên trưởng khác." />;
  return <Editor key={id ?? 'new'} subjects={data.data.subjects} plan={data.data.plan} classes={data.data.classes} />;
}

function Editor({ subjects, plan, classes }: { subjects: TrainingSubject[]; plan?: TrainingPlan; classes: TrainingClass[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const save = useAction();
  const remove = useAction();
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [blocks, setBlocks] = useState<Block[]>(() => plan?.subjects.map((item) => ({ uid: nextUid(), subjectId: item.subject.id, weeks: item.weeks })) ?? []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | TrainingIntensity | 'TRIAL'>('ALL');
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragUid, setDragUid] = useState<string>();
  const [saved, setSaved] = useState(false);
  const routeRef = useRef<HTMLDivElement>(null);
  const flyFrom = useRef<{ uid: string; rect: DOMRect } | null>(null);

  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const initialKey = useMemo(() => JSON.stringify({ name: plan?.name ?? '', description: plan?.description ?? '', blocks: plan?.subjects.map((item) => [item.subject.id, item.weeks]) ?? [] }), [plan]);
  const currentKey = JSON.stringify({ name, description, blocks: blocks.map((block) => [block.subjectId, block.weeks]) });
  const dirty = !saved && currentKey !== initialKey;
  const leaveModal = useLeaveConfirm(dirty, 'Giáo án có thay đổi chưa lưu. Rời trang thì các thay đổi sẽ mất.');

  // Đổi thứ tự hoặc bỏ khối: các khối trượt sang chỗ mới. Khối mới thêm bay từ thư viện sang (xử lý riêng bên dưới).
  useFlip(routeRef, blocks.map((block) => block.uid).join(','), { enter: false });
  useLayoutEffect(() => {
    const from = flyFrom.current;
    if (!from || !routeRef.current) return;
    flyFrom.current = null;
    const node = routeRef.current.querySelector<HTMLElement>(`[data-flip-id="${from.uid}"]`);
    if (!node || prefersReducedMotion()) return;
    const to = node.getBoundingClientRect();
    gsap.from(node, {
      x: from.rect.left - to.left,
      y: from.rect.top - to.top,
      scale: Math.min(1, from.rect.width / to.width),
      opacity: 0.4,
      duration: 0.55,
      ease: 'power3.inOut',
      transformOrigin: 'left top',
      clearProps: 'all',
    });
  });

  const segments: RibbonSegment[] = blocks
    .map((block) => {
      const subject = subjectById.get(block.subjectId);
      return subject ? { key: block.uid, name: subject.name, weeks: block.weeks, intensity: subject.intensity, sessionType: subject.sessionType } : null;
    })
    .filter((item): item is RibbonSegment => !!item);
  const totalWeeks = blocks.reduce((sum, block) => sum + block.weeks, 0);
  const weeksByIntensity = INTENSITIES.map((intensity) => ({
    intensity,
    weeks: blocks.filter((block) => subjectById.get(block.subjectId)?.intensity === intensity).reduce((sum, block) => sum + block.weeks, 0),
  }));
  const trialWeeks = blocks.filter((block) => subjectById.get(block.subjectId)?.sessionType === 'TIME_TRIAL').reduce((sum, block) => sum + block.weeks, 0);

  const library = subjects.filter((subject) => {
    const text = search.trim().toLowerCase();
    if (text && !subject.name.toLowerCase().includes(text)) return false;
    if (filter === 'TRIAL') return subject.sessionType === 'TIME_TRIAL';
    if (filter !== 'ALL') return subject.intensity === filter;
    return true;
  });

  const errors: { name?: string; subjects?: string } = {};
  if (!name.trim()) errors.name = 'Nhập tên giáo án';
  else if (name.trim().length > 160) errors.name = 'Tên tối đa 160 ký tự';
  if (blocks.length === 0) errors.subjects = 'Thêm ít nhất một môn vào lộ trình';
  else if (blocks.length > 52) errors.subjects = 'Giáo án tối đa 52 môn';

  const add = (subject: TrainingSubject, source?: HTMLElement | null, at?: number) => {
    const uid = nextUid();
    if (source) flyFrom.current = { uid, rect: source.getBoundingClientRect() };
    setBlocks((current) => {
      const next = [...current];
      next.splice(at ?? next.length, 0, { uid, subjectId: subject.id, weeks: 1 });
      return next;
    });
  };
  const move = (uid: string, delta: number) =>
    setBlocks((current) => {
      const index = current.findIndex((block) => block.uid === uid);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  const moveTo = (uid: string, target: number) =>
    setBlocks((current) => {
      const index = current.findIndex((block) => block.uid === uid);
      if (index < 0 || index === target) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target > index ? target - 1 : target, 0, item);
      return next;
    });

  const onDropAt = (event: DragEvent, index: number) => {
    event.preventDefault();
    const subjectId = event.dataTransfer.getData('text/subject');
    const uid = event.dataTransfer.getData('text/block');
    if (subjectId) {
      const subject = subjectById.get(subjectId);
      if (subject) add(subject, undefined, index);
    } else if (uid) moveTo(uid, index);
    setDragUid(undefined);
  };

  const submit = () => {
    setTouched(true);
    if (errors.name || errors.subjects) return;
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      subjects: blocks.map((block) => ({ subjectId: block.subjectId, weeks: block.weeks })),
    };
    void save.run(
      () => (plan ? replacePlan(plan.id, input) : createPlan(input)),
      (result) => {
        flushSync(() => setSaved(true));
        toast.push(plan ? 'Đã lưu giáo án' : `Đã lập giáo án ${result.name}`, 'success', plan ? undefined : { label: 'Mở lớp từ giáo án', onClick: () => navigate(links.classNew(result.id)) });
        navigate(links.plan(result.id));
      },
    );
  };

  return (
    <div className="space-y-5">
      {leaveModal}
      <PageHeader
        back={
          <Link to={plan ? links.plan(plan.id) : links.plans} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
            <ArrowLeft size={15} /> {plan ? plan.name : 'Giáo án'}
          </Link>
        }
        title={plan ? 'Sửa giáo án' : 'Lập giáo án'}
        description="Chọn môn từ thư viện, xếp theo thứ tự và đặt số tuần cho từng môn."
        actions={
          <>
            {plan && (
              <Tip content={classes.length ? 'Giáo án đã có lớp dùng nên không xóa được' : 'Xóa giáo án'}>
                <span>
                  <Button variant="inlineDanger" disabled={classes.length > 0} onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={15} /> Xóa
                  </Button>
                </span>
              </Tip>
            )}
            <Button onClick={submit} disabled={save.pending}>
              <Save size={15} /> {save.pending ? 'Đang lưu…' : plan ? 'Lưu giáo án' : 'Tạo giáo án'}
            </Button>
          </>
        }
      />

      {save.error && <ErrorBox message={save.error} />}
      {plan && classes.length > 0 && (
        <Notice tone="info" icon={<Info size={16} />}>
          Đang có {classes.length} lớp dùng giáo án này. Lớp đã tạo giữ nguyên buổi tập, thay đổi chỉ áp cho lớp mở sau.
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Thư viện môn */}
        <aside className="lg:col-span-5">
          <div className="sticky top-4 space-y-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900">Thư viện môn</h3>
              <span className="text-xs text-gray-400">Bấm Thêm hoặc kéo sang lộ trình</span>
            </div>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm môn" />
            <ChipFilter
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                ...INTENSITIES.map((value) => ({ value, label: intensityText[value] })),
                { value: 'TRIAL', label: 'Chạy thử' },
              ]}
            />
            {subjects.length === 0 ? (
              <Notice tone="warning">Câu lạc bộ chưa có môn học. Nhờ quản lý câu lạc bộ thêm môn trước.</Notice>
            ) : (
              <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1" data-lenis-prevent>
                {library.map((subject) => (
                  <li
                    key={subject.id}
                    data-lib-id={subject.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/subject', subject.id)}
                    className="group flex cursor-grab items-center gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 ring-1 ring-gray-100 transition hover:bg-emerald-50/50 hover:ring-emerald-200 active:cursor-grabbing"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{subject.name}</p>
                        <TrialBadge type={subject.sessionType} />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                        <IntensityBars intensity={subject.intensity} />
                        <span className="font-mono">{formatMeters(subject.plannedDistanceM)}</span>
                        {subject.surface && <span>{subject.surface}</span>}
                        {subject.targetTimeMs && <span className="font-mono">{formatRaceTime(subject.targetTimeMs)}</span>}
                      </div>
                    </div>
                    <Button variant="inline" size="sm" onClick={() => add(subject, document.querySelector<HTMLElement>(`[data-lib-id="${subject.id}"]`))}>
                      <Plus size={13} /> Thêm
                    </Button>
                  </li>
                ))}
                {library.length === 0 && <li className="py-6 text-center text-sm text-gray-400">Không có môn khớp</li>}
              </ul>
            )}
          </div>
        </aside>

        {/* Lộ trình */}
        <section className="space-y-4 lg:col-span-7">
          <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200/80 sm:grid-cols-2">
            <Field label="Tên giáo án" required error={touched ? errors.name : undefined} counter={<CharCount value={name} max={160} />} className="sm:col-span-2">
              <Input value={name} maxLength={160} placeholder="Ví dụ: Nước rút 3 tuần" onChange={(event) => setName(event.target.value)} className={touched && errors.name ? invalidClass : ''} />
            </Field>
            <Field label="Mục tiêu, mô tả" className="sm:col-span-2">
              <Textarea rows={2} value={description} placeholder="Giai đoạn này nhắm tới điều gì" onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </div>

          <div className="turf-soft rounded-2xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">Lộ trình</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900">
                  <span className="font-mono tabular-nums">{totalWeeks}</span> tuần <span className="text-base font-medium text-gray-500">{blocks.length} môn</span>
                </p>
              </div>
              {totalWeeks > 0 && (
                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                  {weeksByIntensity.map((item) => (
                    <span key={item.intensity} className="inline-flex items-center gap-1.5">
                      <IntensityBars intensity={item.intensity} showLabel={false} />
                      {intensityText[item.intensity]} <b className="font-mono">{item.weeks}</b> tuần
                    </span>
                  ))}
                  {trialWeeks > 0 && <span>Chạy thử <b className="font-mono">{trialWeeks}</b> tuần</span>}
                </div>
              )}
            </div>
            <WeekRibbon segments={segments} size="lg" />
          </div>

          <div
            ref={routeRef}
            className={cn('space-y-2 rounded-2xl', touched && errors.subjects && 'ring-2 ring-red-300 ring-offset-4 ring-offset-[#f5f6f4]')}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDropAt(event, blocks.length)}
          >
            {blocks.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center">
                <p className="font-semibold text-gray-700">Kéo môn vào đây</p>
                <p className="mt-1 text-sm text-gray-500">hoặc bấm Thêm ở thư viện bên trái</p>
              </div>
            )}
            {(() => {
              let week = 0;
              return blocks.map((block, index) => {
                const subject = subjectById.get(block.subjectId);
                const startWeek = week + 1;
                week += block.weeks;
                if (!subject) return null;
                return (
                  <div
                    key={block.uid}
                    data-flip-id={block.uid}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/block', block.uid);
                      setDragUid(block.uid);
                    }}
                    onDragEnd={() => setDragUid(undefined)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.stopPropagation();
                      onDropAt(event, index);
                    }}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 pr-4 ring-1 ring-gray-200/80 transition sm:flex-nowrap',
                      dragUid === block.uid && 'opacity-40',
                    )}
                  >
                    <span className="flex cursor-grab items-center text-gray-300 hover:text-gray-500" aria-hidden>
                      <GripVertical size={18} />
                    </span>
                    <div className="w-20 shrink-0">
                      <p className="font-mono text-xs tabular-nums text-gray-500">Tuần</p>
                      <p className="font-mono text-sm font-semibold tabular-nums text-gray-900">
                        {startWeek}
                        {block.weeks > 1 && ` đến ${week}`}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-gray-900">{subject.name}</p>
                        <TrialBadge type={subject.sessionType} />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                        <IntensityBars intensity={subject.intensity} />
                        <span className="font-mono">{formatMeters(subject.plannedDistanceM)}</span>
                        {subject.surface && <span>{subject.surface}</span>}
                      </div>
                    </div>
                    <Stepper
                      size="sm"
                      value={block.weeks}
                      min={1}
                      max={52}
                      suffix="tuần"
                      label={`số tuần của ${subject.name}`}
                      onChange={(weeks) => setBlocks((current) => current.map((item) => (item.uid === block.uid ? { ...item, weeks } : item)))}
                    />
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" title="Lên trên" disabled={index === 0} onClick={() => move(block.uid, -1)}>
                        <ArrowUp size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Xuống dưới" disabled={index === blocks.length - 1} onClick={() => move(block.uid, 1)}>
                        <ArrowDown size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Bỏ môn khỏi lộ trình" onClick={() => setBlocks((current) => current.filter((item) => item.uid !== block.uid))}>
                        <X size={15} />
                      </Button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          {touched && errors.subjects && <p className="text-sm font-medium text-red-600">{errors.subjects}</p>}
        </section>
      </div>

      {plan && (
        <ConfirmDialog
          open={confirmDelete}
          title="Xóa giáo án"
          message={
            <>
              Xóa giáo án <b>{plan.name}</b>? Giáo án chưa có lớp nào dùng.
              {remove.error && <div className="mt-3"><ErrorBox message={remove.error} /></div>}
            </>
          }
          confirmLabel="Xóa giáo án"
          pending={remove.pending}
          onClose={() => {
            setConfirmDelete(false);
            remove.clearError();
          }}
          onConfirm={() =>
            void remove.run(
              () => deletePlan(plan.id),
              () => {
                flushSync(() => setSaved(true));
                toast.push('Đã xóa giáo án', 'success');
                navigate(links.plans);
              },
            )
          }
        />
      )}
    </div>
  );
}
