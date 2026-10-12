// F2.2 — Trình lập giáo án (HLV trưởng). Bố cục 5/7: trái là thư viện môn, phải là lộ trình.
// Lộ trình là các giai đoạn theo thứ tự. Mỗi giai đoạn kéo dài N tuần, có nhiều môn, mỗi môn học vào các thứ cố định,
// nên một tuần xen được buổi nhẹ, vừa, nặng. Tuần mẫu của từng giai đoạn và dải tuần phía trên đổi ngay khi sửa.
// Lưu là thay toàn bộ các giai đoạn (PUT). Lớp đã tạo từ giáo án giữ nguyên buổi tập.
import { useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, Info, Layers, Plus, Save, Trash2, X } from 'lucide-react';
import { createPlan, deletePlan, getPlan, listClasses, listSubjects, replacePlan } from '../../../api/training';
import type { TrainingClass, TrainingIntensity, TrainingPlan, TrainingPlanInput, TrainingSubject } from '../../../api/types';
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
import { INTENSITIES, intensityText, weekdayLong, weekdayShort } from '../../../lib/training-labels';
import { useCrumbs } from '../../../components/Breadcrumb';
import { gsap } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { IntensityBars, TrialBadge, WeekPattern, WeekRibbon } from '../components/bits';
import { DAY_FILL, weekPattern, type RibbonPhase } from '../plan-helpers';
import { Stepper } from '../components/Stepper';
import { useFlip } from '../components/motion';
import { BackLink } from '../../../components/BackLink';

/** Khớp giới hạn của BE. */
const MAX_PHASES = 52;
const MAX_PHASE_WEEKS = 52;
const MAX_TOTAL_WEEKS = 104;
const MAX_SUBJECTS_PER_PHASE = 7;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

interface Row {
  uid: string;
  subjectId: string;
  weekdays: number[];
}

interface Phase {
  uid: string;
  weeks: number;
  rows: Row[];
}

let uidSeed = 0;
const nextUid = () => `p${(uidSeed += 1)}`;
const emptyPhase = (): Phase => ({ uid: nextUid(), weeks: 1, rows: [] });

/** Thứ đã dành cho môn khác trong cùng giai đoạn: thứ → id dòng giữ thứ đó. */
const takenDays = (phase: Phase) => {
  const taken = new Map<number, string>();
  phase.rows.forEach((row) => row.weekdays.forEach((day) => taken.set(day, row.uid)));
  return taken;
};

/** Thứ trống đầu tiên của giai đoạn, ưu tiên cách ngày (T2, T4, T6 rồi tới các thứ còn lại). */
const firstFreeDay = (phase: Phase) => {
  const taken = takenDays(phase);
  return [1, 3, 5, 2, 4, 6, 7].find((day) => !taken.has(day));
};

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

const toPhases = (plan?: TrainingPlan): Phase[] =>
  plan?.phases.length
    ? plan.phases.map((phase) => ({ uid: nextUid(), weeks: phase.weeks, rows: phase.subjects.map((item) => ({ uid: nextUid(), subjectId: item.subject.id, weekdays: [...item.weekdays] })) }))
    : [emptyPhase()];

const phasesKey = (phases: Phase[]) => phases.map((phase) => [phase.weeks, phase.rows.map((row) => [row.subjectId, [...row.weekdays].sort((a, b) => a - b)])]);

/** Lỗi BE dạng `phases.{i}.subjects.{j}.weekdays`: gắn vào đúng giai đoạn và dòng. */
function serverErrorAt(fieldErrors: Record<string, string>, phaseIndex: number, rowIndex?: number) {
  for (const [field, message] of Object.entries(fieldErrors)) {
    const match = /^phases\.(\d+)(?:\.subjects\.(\d+))?/.exec(field);
    if (!match || Number(match[1]) !== phaseIndex) continue;
    if (rowIndex === undefined ? match[2] === undefined : Number(match[2]) === rowIndex) return message;
  }
  return undefined;
}

function Editor({ subjects, plan, classes }: { subjects: TrainingSubject[]; plan?: TrainingPlan; classes: TrainingClass[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const save = useAction();
  const remove = useAction();
  const [name, setName] = useState(plan?.name ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [phases, setPhases] = useState<Phase[]>(() => toPhases(plan));
  const [activeUid, setActiveUid] = useState(() => phases[0]?.uid);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | TrainingIntensity | 'TRIAL'>('ALL');
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dropUid, setDropUid] = useState<string>();
  const [saved, setSaved] = useState(false);
  const routeRef = useRef<HTMLDivElement>(null);
  const flyFrom = useRef<{ uid: string; rect: DOMRect } | null>(null);

  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const initialKey = useMemo(() => JSON.stringify({ name: plan?.name ?? '', description: plan?.description ?? '', phases: phasesKey(toPhases(plan)) }), [plan]);
  const currentKey = JSON.stringify({ name, description, phases: phasesKey(phases) });
  const dirty = !saved && currentKey !== initialKey;
  const leaveModal = useLeaveConfirm(dirty, 'Giáo án có thay đổi chưa lưu. Rời trang thì các thay đổi sẽ mất.');
  const active = phases.find((phase) => phase.uid === activeUid) ?? phases[phases.length - 1];
  const activeIndex = active ? phases.indexOf(active) : -1;

  // Thêm, bỏ, đổi chỗ giai đoạn và môn: các thẻ trượt sang chỗ mới. Môn mới thêm bay từ thư viện sang (xử lý riêng bên dưới).
  useFlip(routeRef, phases.map((phase) => `${phase.uid}:${phase.rows.map((row) => row.uid).join('.')}`).join(','), { enter: false });
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

  // Dải tuần, tuần mẫu và các con số tổng kết.
  const ribbon: RibbonPhase[] = phases.map((phase, index) => ({ key: phase.uid, position: index + 1, weeks: phase.weeks, days: patternOf(phase) }));
  function patternOf(phase: Phase) {
    return weekPattern(phase.rows.flatMap((row) => (subjectById.get(row.subjectId) ? [{ subject: subjectById.get(row.subjectId)!, weekdays: row.weekdays }] : [])));
  }
  const totalWeeks = phases.reduce((sum, phase) => sum + phase.weeks, 0);
  const sessionsOf = (phase: Phase) => phase.rows.reduce((sum, row) => sum + row.weekdays.length, 0);
  const totalSessions = phases.reduce((sum, phase) => sum + phase.weeks * sessionsOf(phase), 0);
  const sessionsByIntensity = INTENSITIES.map((intensity) => ({
    intensity,
    count: phases.reduce((sum, phase) => sum + phase.weeks * phase.rows.filter((row) => subjectById.get(row.subjectId)?.intensity === intensity).reduce((count, row) => count + row.weekdays.length, 0), 0),
  }));
  const trialSessions = phases.reduce(
    (sum, phase) => sum + phase.weeks * phase.rows.filter((row) => subjectById.get(row.subjectId)?.sessionType === 'TIME_TRIAL').reduce((count, row) => count + row.weekdays.length, 0),
    0,
  );

  const library = subjects.filter((subject) => {
    const text = search.trim().toLowerCase();
    if (text && !subject.name.toLowerCase().includes(text)) return false;
    if (filter === 'TRIAL') return subject.sessionType === 'TIME_TRIAL';
    if (filter !== 'ALL') return subject.intensity === filter;
    return true;
  });

  // Kiểm trước khi lưu (câu báo giống BE). Thứ trùng giữa hai môn không xảy ra vì nút thứ đã khóa.
  const errors: { name?: string; route?: string; phases: Record<string, string>; rows: Record<string, string> } = { phases: {}, rows: {} };
  if (!name.trim()) errors.name = 'Nhập tên giáo án';
  else if (name.trim().length > 160) errors.name = 'Tên tối đa 160 ký tự';
  if (phases.length === 0) errors.route = 'Thêm ít nhất một giai đoạn';
  else if (phases.length > MAX_PHASES) errors.route = `Giáo án tối đa ${MAX_PHASES} giai đoạn`;
  else if (totalWeeks > MAX_TOTAL_WEEKS) errors.route = `Tổng số tuần của giáo án không quá ${MAX_TOTAL_WEEKS}`;
  phases.forEach((phase, index) => {
    if (phase.rows.length === 0) errors.phases[phase.uid] = `Giai đoạn ${index + 1} chưa có môn nào`;
    phase.rows.forEach((row) => {
      if (row.weekdays.length === 0) errors.rows[row.uid] = 'Chọn ít nhất một thứ cho môn này';
    });
  });
  const invalid = !!errors.name || !!errors.route || Object.keys(errors.phases).length > 0 || Object.keys(errors.rows).length > 0;

  const updatePhase = (uid: string, change: (phase: Phase) => Phase) => setPhases((current) => current.map((phase) => (phase.uid === uid ? change(phase) : phase)));

  const add = (subject: TrainingSubject, phaseUid: string | undefined, source?: HTMLElement | null) => {
    const target = phases.find((phase) => phase.uid === phaseUid) ?? active;
    if (!target) return;
    const index = phases.indexOf(target) + 1;
    if (target.rows.some((row) => row.subjectId === subject.id)) {
      toast.push(`${subject.name} đã có trong giai đoạn ${index}. Chọn thêm thứ ở dòng đó.`, 'info');
      return;
    }
    if (target.rows.length >= MAX_SUBJECTS_PER_PHASE) {
      toast.push(`Giai đoạn ${index} đã đủ ${MAX_SUBJECTS_PER_PHASE} môn`, 'info');
      return;
    }
    const uid = nextUid();
    const day = firstFreeDay(target);
    if (source) flyFrom.current = { uid, rect: source.getBoundingClientRect() };
    setActiveUid(target.uid);
    updatePhase(target.uid, (phase) => ({ ...phase, rows: [...phase.rows, { uid, subjectId: subject.id, weekdays: day ? [day] : [] }] }));
  };

  const toggleDay = (phaseUid: string, rowUid: string, day: number) =>
    updatePhase(phaseUid, (phase) => {
      const owner = takenDays(phase).get(day);
      if (owner && owner !== rowUid) return phase;
      return {
        ...phase,
        rows: phase.rows.map((row) => (row.uid === rowUid ? { ...row, weekdays: row.weekdays.includes(day) ? row.weekdays.filter((item) => item !== day) : [...row.weekdays, day].sort((a, b) => a - b) } : row)),
      };
    });

  const movePhase = (uid: string, delta: number) =>
    setPhases((current) => {
      const index = current.findIndex((phase) => phase.uid === uid);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });

  const addPhase = (copyOf?: Phase) => {
    const phase: Phase = copyOf ? { uid: nextUid(), weeks: copyOf.weeks, rows: copyOf.rows.map((row) => ({ ...row, uid: nextUid(), weekdays: [...row.weekdays] })) } : emptyPhase();
    setPhases((current) => {
      const next = [...current];
      next.splice(copyOf ? current.indexOf(copyOf) + 1 : current.length, 0, phase);
      return next;
    });
    setActiveUid(phase.uid);
  };

  const onDropPhase = (event: DragEvent, phaseUid: string) => {
    event.preventDefault();
    setDropUid(undefined);
    const subject = subjectById.get(event.dataTransfer.getData('text/subject'));
    if (subject) add(subject, phaseUid);
  };

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    const input: TrainingPlanInput = {
      name: name.trim(),
      description: description.trim() || null,
      phases: phases.map((phase) => ({ weeks: phase.weeks, subjects: phase.rows.map((row) => ({ subjectId: row.subjectId, weekdays: [...row.weekdays].sort((a, b) => a - b) })) })),
    };
    void save.run(
      () => (plan ? replacePlan(plan.id, input) : createPlan(input)),
      (result) => {
        flushSync(() => setSaved(true));
        toast.push(plan ? 'Đã lưu giáo án' : `Đã lập giáo án ${result.name}`, 'success', plan ? undefined : { label: 'Mở lớp từ giáo án', onClick: () => navigate(links.classNew(result.id)) });
        // Thay mục lịch sử của trình soạn: bấm Quay lại ở trang giáo án không rơi về form vừa lưu.
        navigate(links.plan(result.id), { replace: true });
      },
    );
  };

  return (
    <div className="space-y-5">
      {leaveModal}
      <PageHeader
        back={
          <BackLink fallback={plan ? links.plan(plan.id) : links.plans} />
        }
        title={plan ? 'Sửa giáo án' : 'Lập giáo án'}
        description="Chia giáo án thành các giai đoạn. Mỗi giai đoạn chọn số tuần, các môn và thứ học của từng môn."
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
              {active && <span className="text-xs text-gray-500">Thêm vào <b className="text-emerald-800">giai đoạn {activeIndex + 1}</b> hoặc kéo vào giai đoạn khác</span>}
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
                {library.map((subject) => {
                  const inActive = !!active?.rows.some((row) => row.subjectId === subject.id);
                  return (
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
                      <Button
                        variant="inline"
                        size="sm"
                        disabled={!active || inActive}
                        title={inActive ? `Đã có trong giai đoạn ${activeIndex + 1}` : undefined}
                        onClick={() => add(subject, active?.uid, document.querySelector<HTMLElement>(`[data-lib-id="${subject.id}"]`))}
                      >
                        <Plus size={13} /> Thêm
                      </Button>
                    </li>
                  );
                })}
                {library.length === 0 && <li className="py-6 text-center text-sm text-gray-400">Không có môn khớp</li>}
              </ul>
            )}
          </div>
        </aside>

        {/* Lộ trình */}
        <section className="space-y-4 lg:col-span-7">
          <div className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200/80 sm:grid-cols-2">
            <Field label="Tên giáo án" required error={touched ? errors.name : undefined} counter={<CharCount value={name} max={160} />} className="sm:col-span-2">
              <Input value={name} maxLength={160} placeholder="Ví dụ: Tăng tốc 4 tuần" onChange={(event) => setName(event.target.value)} className={touched && errors.name ? invalidClass : ''} />
            </Field>
            <Field label="Mục tiêu, mô tả" className="sm:col-span-2">
              <Textarea rows={2} value={description} placeholder="Giáo án nhắm tới điều gì" onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </div>

          <div className="turf-soft rounded-2xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-gray-600">Lộ trình</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900">
                  <span className={cn('font-mono tabular-nums', totalWeeks > MAX_TOTAL_WEEKS && 'text-red-700')}>{totalWeeks}</span> tuần{' '}
                  <span className="text-base font-medium text-gray-500">
                    {phases.length} giai đoạn, {totalSessions} buổi
                  </span>
                </p>
              </div>
              {totalSessions > 0 && (
                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                  {sessionsByIntensity.map((item) => (
                    <span key={item.intensity} className="inline-flex items-center gap-1.5">
                      <IntensityBars intensity={item.intensity} showLabel={false} />
                      {intensityText[item.intensity]} <b className="font-mono">{item.count}</b> buổi
                    </span>
                  ))}
                  {trialSessions > 0 && (
                    <span>
                      Chạy thử <b className="font-mono">{trialSessions}</b> buổi
                    </span>
                  )}
                </div>
              )}
            </div>
            <WeekRibbon phases={ribbon} size="lg" />
          </div>

          <div ref={routeRef} className={cn('space-y-3 rounded-2xl', touched && errors.route && 'ring-2 ring-red-300 ring-offset-4 ring-offset-[#f5f6f4]')}>
            {phases.map((phase, index) => {
              const startWeek = phases.slice(0, index).reduce((sum, item) => sum + item.weeks, 0) + 1;
              const taken = takenDays(phase);
              const isActive = phase.uid === active?.uid;
              const days = patternOf(phase);
              const heavyDays = days.filter((day) => day?.intensity === 'HEAVY').length;
              const phaseError = (touched ? errors.phases[phase.uid] : undefined) ?? serverErrorAt(save.fieldErrors, index);
              return (
                <article
                  key={phase.uid}
                  data-flip-id={phase.uid}
                  data-phase-card
                  onClick={() => setActiveUid(phase.uid)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (dropUid !== phase.uid) setDropUid(phase.uid);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropUid(undefined);
                  }}
                  onDrop={(event) => onDropPhase(event, phase.uid)}
                  className={cn(
                    'rounded-2xl bg-white p-4 ring-1 transition-shadow',
                    isActive ? 'shadow-grass-tint ring-2 ring-emerald-500/60' : 'ring-gray-200/80 hover:ring-gray-300',
                    dropUid === phase.uid && 'ring-2 ring-emerald-500 ring-offset-2',
                    phaseError && 'ring-2 ring-red-300',
                  )}
                >
                  <header className="flex flex-wrap items-center gap-3">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold', isActive ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800')}>{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">Giai đoạn {index + 1}</p>
                      <p className="font-mono text-xs tabular-nums text-gray-500">
                        Tuần {startWeek}
                        {phase.weeks > 1 && ` đến ${startWeek + phase.weeks - 1}`}
                      </p>
                    </div>
                    <Stepper size="sm" value={phase.weeks} min={1} max={MAX_PHASE_WEEKS} suffix="tuần" label={`số tuần của giai đoạn ${index + 1}`} onChange={(weeks) => updatePhase(phase.uid, (item) => ({ ...item, weeks }))} />
                    <div className="flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
                      <Button variant="ghost" size="icon" title="Lên trên" disabled={index === 0} onClick={() => movePhase(phase.uid, -1)}>
                        <ArrowUp size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Xuống dưới" disabled={index === phases.length - 1} onClick={() => movePhase(phase.uid, 1)}>
                        <ArrowDown size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Nhân bản giai đoạn" disabled={phases.length >= MAX_PHASES} onClick={() => addPhase(phase)}>
                        <Copy size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Bỏ giai đoạn" disabled={phases.length === 1} onClick={() => setPhases((current) => current.filter((item) => item.uid !== phase.uid))}>
                        <X size={15} />
                      </Button>
                    </div>
                  </header>

                  {phase.rows.length === 0 ? (
                    <div className="mt-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center text-sm text-gray-500">
                      Kéo môn vào giai đoạn này, hoặc chọn giai đoạn rồi bấm Thêm ở thư viện
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {phase.rows.map((row, rowIndex) => {
                        const subject = subjectById.get(row.subjectId);
                        if (!subject) return null;
                        const rowError = (touched ? errors.rows[row.uid] : undefined) ?? serverErrorAt(save.fieldErrors, index, rowIndex);
                        return (
                          <li key={row.uid} data-flip-id={row.uid} className={cn('rounded-xl bg-gray-50/70 p-3 ring-1', rowError ? 'ring-red-200' : 'ring-gray-100')}>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                              <div className="min-w-0 flex-1 basis-40">
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
                              <div className="flex gap-1" role="group" aria-label={`Thứ học ${subject.name}`} onClick={(event) => event.stopPropagation()}>
                                {WEEKDAYS.map((day) => {
                                  const on = row.weekdays.includes(day);
                                  const owner = taken.get(day);
                                  const blocked = !!owner && owner !== row.uid;
                                  const ownerName = blocked ? subjectById.get(phase.rows.find((item) => item.uid === owner)?.subjectId ?? '')?.name : undefined;
                                  const chip = (
                                    <button
                                      type="button"
                                      aria-pressed={on}
                                      aria-label={`${weekdayLong[day]}${blocked ? `, đã dành cho ${ownerName}` : ''}`}
                                      disabled={blocked}
                                      onClick={() => toggleDay(phase.uid, row.uid, day)}
                                      className={cn(
                                        'h-8 w-9 rounded-lg font-mono text-xs font-semibold transition',
                                        on ? cn(DAY_FILL[subject.intensity], 'shadow-sm') : blocked ? 'cursor-not-allowed bg-gray-100 text-gray-300' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-emerald-300',
                                      )}
                                    >
                                      {weekdayShort[day]}
                                    </button>
                                  );
                                  return blocked ? (
                                    <Tip key={day} content={`Đã dành cho ${ownerName}`}>
                                      <span>{chip}</span>
                                    </Tip>
                                  ) : (
                                    <span key={day}>{chip}</span>
                                  );
                                })}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Bỏ môn khỏi giai đoạn"
                                onClick={() => updatePhase(phase.uid, (item) => ({ ...item, rows: item.rows.filter((other) => other.uid !== row.uid) }))}
                              >
                                <X size={15} />
                              </Button>
                            </div>
                            {rowError && <p className="mt-1.5 text-xs font-medium text-red-600">{rowError}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {phase.rows.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span>Tuần mẫu</span>
                        <span>
                          {sessionsOf(phase)} buổi mỗi tuần{heavyDays > 0 && `, ${heavyDays} ngày nặng`}
                        </span>
                      </div>
                      <WeekPattern days={days} compact />
                    </div>
                  )}
                  {phaseError && <p className="mt-2 text-sm font-medium text-red-600">{phaseError}</p>}
                </article>
              );
            })}
            <button
              type="button"
              disabled={phases.length >= MAX_PHASES}
              onClick={() => addPhase()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-white/50 px-4 py-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-50/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Layers size={16} /> Thêm giai đoạn
            </button>
          </div>
          {touched && errors.route && <p className="text-sm font-medium text-red-600">{errors.route}</p>}
        </section>
      </div>

      {plan && (
        <ConfirmDialog
          open={confirmDelete}
          title="Xóa giáo án"
          message={
            <>
              Xóa giáo án <b>{plan.name}</b>? Giáo án chưa có lớp nào dùng.
              {remove.error && (
                <div className="mt-3">
                  <ErrorBox message={remove.error} />
                </div>
              )}
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
