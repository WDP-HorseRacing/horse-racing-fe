// F2.2, F2.3 — Mở lớp (HLV trưởng), hai chặng có tên: "Thiết lập lớp" rồi "Xem trước và chỉnh lịch".
// Thiết lập: giáo án, ngày bắt đầu, các thứ, giờ, thời lượng. Xem trước gọi BE sinh lịch (chưa lưu gì),
// HLV đổi giờ, đổi môn, bỏ hoặc thêm buổi ngay trên lưới, bấm Tạo lớp thì lớp và mọi buổi lưu trong một lần.
import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Clock3, Flag, Info, Pencil, Plus, Wand2 } from 'lucide-react';
import { createClass, listPlans, listSubjects, previewSchedule } from '../../../api/training';
import type { RaceAptitude, TrainingPlan, TrainingSubject } from '../../../api/types';
import {
  Button,
  CharCount,
  ErrorBox,
  Field,
  Input,
  Modal,
  NotFound,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  cn,
  invalidClass,
  useToast,
} from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useAction, useService } from '../../../hooks/useService';
import { useLeaveConfirm } from '../../../hooks/useLeaveConfirm';
import { useMyScope } from '../../../hooks/useMyScope';
import { can } from '../../../auth/permissions';
import { useStore } from '../../../store/store';
import { useCrumbs } from '../../../components/Breadcrumb';
import { links } from '../../../lib/links';
import { distanceLabel } from '../../../lib/labels';
import { formatDate } from '../../../lib/format';
import { addMinutes, classEndDate, clubDateKey, clubInstant, clubTime, clubToday, diffDateKeys, isoWeekdayOf, minutesBetween, parseClockTime, addDateKey } from '../../../lib/club-time';
import { formatMeters } from '../../../lib/training-format';
import { weekdayLong, weekdayShort } from '../../../lib/training-labels';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { IntensityBars, WeekRibbon, planSegments } from '../components/bits';
import { Stepper } from '../components/Stepper';
import { SessionEditSheet, draftFromSubject, sessionErrors, type SessionDraft } from '../components/SessionEditSheet';

interface Setup {
  planId: string;
  code: string;
  name: string;
  description: string;
  raceAptitude: '' | RaceAptitude;
  maxHorses: number;
  startDate: string;
  weekdays: number[];
  startTime: string;
  durationMinutes: number;
}

interface PreviewSession extends SessionDraft {
  uid: string;
}

let uidSeed = 0;
const nextUid = () => `s${(uidSeed += 1)}`;

export default function ClassCreate() {
  const user = useStore((state) => state.currentUser);
  const data = useService(async () => {
    const [plans, subjects] = await Promise.all([listPlans(), listSubjects()]);
    return { plans, subjects };
  }, []);
  useCrumbs([{ label: 'Mở lớp' }], [{ label: 'Lớp huấn luyện', to: links.classes }]);
  if (!can(user, 'class.manage')) return <NotFound message="Chỉ huấn luyện viên trưởng mở được lớp." />;
  if (data.loading && !data.data) return <Skeleton rows={8} />;
  if (data.error || !data.data) return <NotFound message={data.error} />;
  const plans = data.data.plans.filter((plan) => plan.headTrainerId === user?.id);
  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <CalendarCheck className="mx-auto text-gray-300" size={36} />
        <p className="mt-3 text-lg font-semibold text-gray-800">Bạn chưa có giáo án</p>
        <p className="mt-1 text-sm text-gray-500">Lớp luôn theo một giáo án của bạn. Lập giáo án trước rồi mở lớp từ giáo án đó.</p>
        <Link to={links.planNew} className="mt-5 inline-block">
          <Button>Lập giáo án</Button>
        </Link>
      </div>
    );
  }
  return <Wizard plans={plans} subjects={data.data.subjects} />;
}

function suggestCode(barnName: string | undefined, startDate: string) {
  const letter = barnName?.replace(/^Khu\s+/i, '').trim().split(/\s+/)[0]?.slice(0, 3).toUpperCase();
  const stamp = startDate.slice(8, 10) + startDate.slice(5, 7);
  return `${letter ? `K${letter}` : 'LOP'}-${stamp}`;
}

function Wizard({ plans, subjects }: { plans: TrainingPlan[]; subjects: TrainingSubject[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { scope } = useMyScope();
  const today = clubToday();
  const presetPlan = plans.find((plan) => plan.id === params.get('planId')) ?? plans[0];
  const barnName = scope?.myBarns[0]?.name;
  const [setup, setSetup] = useState<Setup>(() => ({
    planId: presetPlan.id,
    code: suggestCode(barnName, today),
    name: presetPlan.name,
    description: '',
    raceAptitude: '',
    maxHorses: 10,
    startDate: today,
    weekdays: [isoWeekdayOf(today)],
    startTime: '06:00',
    durationMinutes: 60,
  }));
  const [codeEdited, setCodeEdited] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);
  const [stage, setStage] = useState<'setup' | 'preview'>('setup');
  const [sessions, setSessions] = useState<PreviewSession[]>([]);
  const [previewKey, setPreviewKey] = useState('');
  const [editing, setEditing] = useState<PreviewSession | 'new' | null>(null);
  const [newAt, setNewAt] = useState<{ date: string; week: number } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const preview = useAction();
  const create = useAction();
  const gridRef = useRef<HTMLDivElement>(null);

  const plan = plans.find((item) => item.id === setup.planId) ?? presetPlan;
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const endDate = classEndDate(setup.startDate || today, plan.totalWeeks);
  const parsedTime = parseClockTime(setup.startTime);
  const estimate = plan.totalWeeks * setup.weekdays.length;
  const setupKey = JSON.stringify([setup.planId, setup.startDate, [...setup.weekdays].sort(), parsedTime, setup.durationMinutes]);
  const range = { from: setup.startDate, to: endDate };

  const dirty = !done && (stage === 'preview' || setup.description !== '' || nameEdited || codeEdited);
  const leaveModal = useLeaveConfirm(dirty, 'Lớp chưa được tạo. Rời trang thì lịch đang soạn sẽ mất.');

  const set = <K extends keyof Setup>(key: K, value: Setup[K]) => setSetup((current) => ({ ...current, [key]: value }));
  const setupErrors: Partial<Record<keyof Setup, string>> = {};
  if (!setup.code.trim()) setupErrors.code = 'Nhập mã lớp';
  if (!setup.name.trim()) setupErrors.name = 'Nhập tên lớp';
  if (!setup.startDate) setupErrors.startDate = 'Chọn ngày bắt đầu';
  if (setup.weekdays.length === 0) setupErrors.weekdays = 'Chọn ít nhất một thứ trong tuần';
  if (!parsedTime) setupErrors.startTime = 'Giờ dạng HH:mm, ví dụ 06:00';

  const pickPlan = (id: string) => {
    const next = plans.find((item) => item.id === id);
    setSetup((current) => ({ ...current, planId: id, name: nameEdited ? current.name : (next?.name ?? current.name) }));
  };
  const pickStart = (value: string) => {
    setSetup((current) => ({
      ...current,
      startDate: value,
      code: codeEdited || !value ? current.code : suggestCode(barnName, value),
      // Ngày bắt đầu đổi: tô sẵn thứ của ngày đó nếu chưa chọn thứ nào.
      weekdays: current.weekdays.length === 0 && value ? [isoWeekdayOf(value)] : current.weekdays,
    }));
  };

  const runPreview = () => {
    setTouched(true);
    if (Object.keys(setupErrors).length > 0) return;
    if (stage === 'setup' && previewKey === setupKey && sessions.length > 0) {
      setStage('preview');
      return;
    }
    void preview.run(
      () =>
        previewSchedule({
          planId: setup.planId,
          startDate: setup.startDate,
          weekdays: [...setup.weekdays].sort(),
          startTime: parsedTime!,
          durationMinutes: setup.durationMinutes,
        }),
      (result) => {
        setSessions(
          result.sessions.map((session) => ({
            uid: nextUid(),
            subjectId: session.subjectId,
            name: session.name,
            intensity: session.intensity,
            plannedDistanceM: session.plannedDistanceM,
            surface: session.surface ?? '',
            location: '',
            notes: '',
            targetTimeMs: session.targetTimeMs ?? undefined,
            scheduledStartAt: session.scheduledStartAt,
            scheduledEndAt: session.scheduledEndAt,
          })),
        );
        setPreviewKey(setupKey);
        setStage('preview');
      },
    );
  };

  // Lưới: hàng là tuần của lớp, cột là thứ (thứ đã chọn và thứ có buổi sau khi sửa).
  const weekOf = (iso: string) => Math.floor(diffDateKeys(setup.startDate, clubDateKey(iso)) / 7) + 1;
  // Tuần của lớp tính từ ngày bắt đầu (không canh thứ Hai), nên cột bắt đầu từ thứ của ngày khai giảng.
  const columns = useMemo(() => {
    const first = setup.startDate ? isoWeekdayOf(setup.startDate) : 1;
    const offset = (day: number) => (day - first + 7) % 7;
    return [...new Set([...setup.weekdays, ...sessions.map((session) => isoWeekdayOf(clubDateKey(session.scheduledStartAt)))])].sort((a, b) => offset(a) - offset(b));
  }, [setup.weekdays, setup.startDate, sessions]);
  const weeks = Array.from({ length: plan.totalWeeks }, (_, index) => index + 1);
  const subjectOfWeek = (week: number) => plan.subjects.find((item) => week >= item.startWeek && week < item.startWeek + item.weeks)?.subject;
  const invalid = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((session) => {
      const message = Object.values(sessionErrors(session, subjectById.get(session.subjectId), range))[0];
      if (message) map.set(session.uid, message);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, subjectById, setup.startDate, endDate]);

  // Sang chặng xem trước: băng tên môn kéo dài từ trái, thẻ buổi rơi vào lưới theo tuần và thứ.
  useGSAP(
    () => {
      if (stage !== 'preview' || prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('[data-week-band]', { scaleX: 0, transformOrigin: 'left center', duration: 0.5, stagger: 0.05 })
        .from('[data-session-chip]', { opacity: 0, y: -14, scale: 0.92, duration: 0.4, stagger: { amount: 0.6, from: 'start' }, clearProps: 'all' }, '-=0.3');
    },
    { scope: gridRef, dependencies: [stage, previewKey] },
  );

  const applyBulk = (time: string, duration: number) => {
    setSessions((current) =>
      current.map((session) => {
        const start = clubInstant(clubDateKey(session.scheduledStartAt), time);
        return { ...session, scheduledStartAt: start, scheduledEndAt: addMinutes(start, duration) };
      }),
    );
    setBulkOpen(false);
    toast.push(`Đã đặt giờ ${time} cho mọi buổi`, 'success');
  };

  const submit = () => {
    if (sessions.length === 0) {
      toast.push('Lớp cần ít nhất một buổi tập', 'error');
      return;
    }
    if (invalid.size > 0) {
      toast.push('Còn buổi tập chưa hợp lệ, xem các thẻ viền đỏ', 'error');
      return;
    }
    if (sessions.length > 500) {
      toast.push('Một lớp tối đa 500 buổi tập', 'error');
      return;
    }
    void create.run(
      () =>
        createClass({
          code: setup.code.trim(),
          name: setup.name.trim(),
          description: setup.description.trim() || undefined,
          raceAptitude: setup.raceAptitude || undefined,
          maxHorses: setup.maxHorses,
          planId: setup.planId,
          startDate: setup.startDate,
          sessions: [...sessions]
            .sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt))
            .map((session) => ({
              subjectId: session.subjectId,
              name: session.name.trim(),
              intensity: session.intensity,
              plannedDistanceM: session.plannedDistanceM,
              surface: session.surface.trim() || undefined,
              location: session.location.trim() || undefined,
              notes: session.notes.trim() || undefined,
              targetTimeMs: subjectById.get(session.subjectId)?.sessionType === 'TIME_TRIAL' ? session.targetTimeMs : undefined,
              scheduledStartAt: session.scheduledStartAt,
              scheduledEndAt: session.scheduledEndAt,
            })),
        }),
      (created) => {
        flushSync(() => setDone(true));
        toast.push(`Đã tạo lớp ${created.code} ở trạng thái nháp`, 'success');
        navigate(links.class(created.id));
      },
    );
  };

  const sorted = [...sessions].sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
  const editingDraft: SessionDraft | null =
    editing === 'new' && newAt
      ? (() => {
          const subject = subjectOfWeek(newAt.week) ?? subjects[0];
          const start = clubInstant(newAt.date, parsedTime ?? '06:00');
          return draftFromSubject(subject, start, addMinutes(start, setup.durationMinutes));
        })()
      : editing && editing !== 'new'
        ? editing
        : null;

  return (
    <div className="space-y-5">
      {leaveModal}
      <PageHeader
        back={
          <Link to={links.classes} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
            <ArrowLeft size={15} /> Lớp huấn luyện
          </Link>
        }
        title="Mở lớp huấn luyện"
        description="Lớp theo một giáo án của bạn. Lịch buổi tập sinh từ giáo án, chỉnh xong mới lưu."
      />

      {/* Vạch tiến độ hai chặng, có tên, không đánh số */}
      <div className="flex items-center gap-3 text-sm">
        {(
          [
            { key: 'setup', label: 'Thiết lập lớp' },
            { key: 'preview', label: 'Xem trước và chỉnh lịch' },
          ] as const
        ).map((item, index) => {
          const active = stage === item.key;
          const passed = stage === 'preview' && item.key === 'setup';
          return (
            <div key={item.key} className="flex min-w-0 flex-1 items-center gap-3">
              {index > 0 && <span className={cn('h-0.5 w-10 shrink-0 rounded-full', stage === 'preview' ? 'bg-emerald-600' : 'bg-gray-200')} />}
              <button
                type="button"
                disabled={item.key === 'preview' && sessions.length === 0}
                onClick={() => (item.key === 'setup' ? setStage('setup') : runPreview())}
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 font-medium transition',
                  active ? 'bg-emerald-700 text-white' : passed ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'text-gray-500',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', active ? 'bg-white' : passed ? 'bg-emerald-600' : 'bg-gray-300')} />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {stage === 'setup' ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <section className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-gray-200/80 lg:col-span-7">
            {preview.error && <ErrorBox message={preview.error} />}
            <Field label="Giáo án" required>
              <Select value={setup.planId} onChange={(event) => pickPlan(event.target.value)}>
                {plans.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.totalWeeks} tuần)
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-5">
              <Field label="Mã lớp" required error={touched ? setupErrors.code : undefined} hint="Tự viết hoa, không trùng lớp khác" className="sm:col-span-2">
                <Input
                  value={setup.code}
                  className={cn('font-mono uppercase', touched && setupErrors.code && invalidClass)}
                  onChange={(event) => {
                    setCodeEdited(true);
                    set('code', event.target.value.toUpperCase());
                  }}
                />
              </Field>
              <Field label="Tên lớp" required error={touched ? setupErrors.name : undefined} className="sm:col-span-3">
                <Input
                  value={setup.name}
                  className={touched && setupErrors.name ? invalidClass : ''}
                  onChange={(event) => {
                    setNameEdited(true);
                    set('name', event.target.value);
                  }}
                />
              </Field>
            </div>

            <Field label="Ngày bắt đầu" required error={touched ? setupErrors.startDate : undefined}>
              <DatePicker value={setup.startDate} onChange={pickStart} clearable={false} />
            </Field>

            <Field label="Các thứ có buổi tập" required error={touched ? setupErrors.weekdays : undefined} hint="Mỗi thứ đã chọn sinh một buổi mỗi tuần.">
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const on = setup.weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      title={weekdayLong[day]}
                      aria-pressed={on}
                      onClick={() => set('weekdays', on ? setup.weekdays.filter((item) => item !== day) : [...setup.weekdays, day])}
                      className={cn(
                        'h-10 w-12 rounded-xl text-sm font-semibold ring-1 transition',
                        on ? 'bg-emerald-700 text-white ring-emerald-700' : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300',
                      )}
                    >
                      {weekdayShort[day]}
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Giờ bắt đầu" required error={touched ? setupErrors.startTime : undefined} hint="Giờ câu lạc bộ (giờ Việt Nam)">
                <Input
                  value={setup.startTime}
                  inputMode="numeric"
                  placeholder="06:00"
                  className={cn('font-mono', touched && setupErrors.startTime && invalidClass)}
                  onChange={(event) => set('startTime', event.target.value)}
                  onBlur={() => parsedTime && set('startTime', parsedTime)}
                />
              </Field>
              <Field label="Thời lượng mỗi buổi">
                <Stepper value={setup.durationMinutes} onChange={(value) => set('durationMinutes', value)} min={15} max={480} step={15} suffix="phút" label="thời lượng" />
              </Field>
              <Field label="Sĩ số tối đa">
                <Stepper value={setup.maxHorses} onChange={(value) => set('maxHorses', value)} min={1} max={50} suffix="ngựa" label="sĩ số" />
              </Field>
              <Field label="Sở trường cự ly mục tiêu">
                <Select value={setup.raceAptitude} onChange={(event) => set('raceAptitude', event.target.value as Setup['raceAptitude'])}>
                  <option value="">Không đặt</option>
                  {(['SPRINTER', 'MILER', 'STAYER'] as const).map((value) => (
                    <option key={value} value={value}>
                      {distanceLabel[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Mô tả" counter={<CharCount value={setup.description} max={500} />}>
              <Textarea rows={2} maxLength={500} value={setup.description} onChange={(event) => set('description', event.target.value)} />
            </Field>
          </section>

          <aside className="lg:col-span-5">
            <div className="sticky top-4 space-y-3">
              <div className="turf-soft rounded-2xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10">
                <p className="text-sm text-gray-600">{plan.name}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-emerald-900/10">
                    <p className="text-xs text-gray-500">Từ ngày</p>
                    <p className="font-mono text-sm font-semibold">{setup.startDate ? formatDate(setup.startDate) : '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-emerald-900/10">
                    <p className="text-xs text-gray-500">Đến ngày (tự tính)</p>
                    <p className="font-mono text-sm font-semibold">{setup.startDate ? formatDate(endDate) : '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-emerald-900/10">
                    <p className="text-xs text-gray-500">Số tuần</p>
                    <p className="font-mono text-2xl font-bold">{plan.totalWeeks}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-emerald-900/10">
                    <p className="text-xs text-gray-500">Số buổi dự kiến</p>
                    <p className="font-mono text-2xl font-bold">{estimate}</p>
                  </div>
                </div>
                <WeekRibbon segments={planSegments(plan)} size="md" className="mt-4" />
              </div>
              <Notice tone="info" icon={<Info size={16} />}>
                Lớp tạo ra ở trạng thái nháp. Kích hoạt lớp xong mới ghi danh ngựa và công bố buổi được.
              </Notice>
              <Button className="w-full" onClick={runPreview} disabled={preview.pending}>
                <CalendarCheck size={16} /> {preview.pending ? 'Đang sinh lịch…' : 'Xem trước lịch'}
              </Button>
            </div>
          </aside>
        </div>
      ) : (
        <div ref={gridRef} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-gray-200/80">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="font-semibold text-gray-900">
                <span className="font-mono">{setup.code}</span> {setup.name}
              </span>
              <span className="text-gray-600">{plan.name}</span>
              <span className="font-mono text-gray-600">
                {formatDate(setup.startDate)} đến {formatDate(endDate)}
              </span>
              <span className="text-gray-600">
                <b className="font-mono">{sessions.length}</b> buổi
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="inline" size="sm" onClick={() => setStage('setup')}>
                <Pencil size={13} /> Sửa thiết lập
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
                <Wand2 size={13} /> Áp giờ cho mọi buổi
              </Button>
            </div>
          </div>

          {create.error && <ErrorBox message={create.error} />}

          <div className="overflow-x-auto rounded-2xl bg-white p-4 ring-1 ring-gray-200/80" data-lenis-prevent-wheel>
            <div className="grid min-w-[44rem] gap-2" style={{ gridTemplateColumns: `9.5rem repeat(${columns.length}, minmax(9rem, 1fr))` }}>
              <div />
              {columns.map((day) => (
                <div key={day} className="px-1 pb-1 text-center text-xs font-semibold text-gray-500">
                  {weekdayLong[day]}
                </div>
              ))}
              {weeks.map((week) => {
                const subject = subjectOfWeek(week);
                const weekStart = addDateKey(setup.startDate, (week - 1) * 7);
                return (
                  <WeekRow key={week}>
                    <div className="flex flex-col justify-center gap-1.5 pr-2">
                      <p className="font-mono text-xs font-semibold text-gray-500">Tuần {week}</p>
                      <div data-week-band className={cn('truncate rounded-md px-2 py-1 text-[11px] font-semibold', subject?.sessionType === 'TIME_TRIAL' ? 'ribbon-trial bg-emerald-700 text-white' : subject?.intensity === 'HEAVY' ? 'bg-emerald-700 text-white' : subject?.intensity === 'MODERATE' ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-200 text-emerald-950')}>
                        {subject?.name ?? 'Ngoài giáo án'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const firstDay = Array.from({ length: 7 }, (_, offset) => addDateKey(weekStart, offset)).find((day) => setup.weekdays.includes(isoWeekdayOf(day)) && day <= endDate) ?? weekStart;
                          setNewAt({ date: firstDay, week });
                          setEditing('new');
                        }}
                        className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        <Plus size={12} /> Thêm buổi
                      </button>
                    </div>
                    {columns.map((day) => {
                      const cell = sorted.filter((session) => weekOf(session.scheduledStartAt) === week && isoWeekdayOf(clubDateKey(session.scheduledStartAt)) === day);
                      return (
                        <div key={day} className="flex min-h-[5.5rem] flex-col gap-1.5 rounded-xl bg-gray-50/70 p-1.5 ring-1 ring-gray-100">
                          {cell.map((session) => {
                            const sessionSubject = subjectById.get(session.subjectId);
                            const error = invalid.get(session.uid);
                            return (
                              <button
                                key={session.uid}
                                type="button"
                                data-session-chip
                                title={error}
                                onClick={() => setEditing(session)}
                                className={cn(
                                  'group w-full rounded-lg bg-white p-2 text-left shadow-[0_6px_14px_-12px_rgba(6,78,59,0.5)] ring-1 transition hover:-translate-y-0.5',
                                  error ? 'ring-2 ring-red-400' : 'ring-gray-200 hover:ring-emerald-300',
                                )}
                              >
                                <p className="flex items-center gap-1 font-mono text-[11px] text-gray-500">
                                  <Clock3 size={11} />
                                  {clubTime(session.scheduledStartAt)}
                                  <span className="text-gray-400">{minutesBetween(session.scheduledStartAt, session.scheduledEndAt)}p</span>
                                  <span className="ml-auto text-gray-400">{formatDate(session.scheduledStartAt).slice(0, 5)}</span>
                                </p>
                                <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-gray-900">
                                  {sessionSubject?.sessionType === 'TIME_TRIAL' && <Flag size={11} className="shrink-0 text-amber-700" />}
                                  <span className="truncate">{session.name}</span>
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-gray-500">
                                  <IntensityBars intensity={session.intensity} showLabel={false} />
                                  <span className="font-mono">{formatMeters(session.plannedDistanceM)}</span>
                                </div>
                                {error && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </WeekRow>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="mr-auto text-sm text-gray-500">Bấm vào thẻ buổi để đổi giờ, đổi môn hoặc bỏ buổi. Lỗi ở buổi nào thì không lưu buổi nào.</p>
            <Button variant="secondary" onClick={() => setStage('setup')}>
              Quay lại thiết lập
            </Button>
            <Button onClick={submit} disabled={create.pending}>
              <CalendarCheck size={16} /> {create.pending ? 'Đang tạo lớp…' : `Tạo lớp với ${sessions.length} buổi`}
            </Button>
          </div>
        </div>
      )}

      {editingDraft && (
        <SessionEditSheet
          key={editing === 'new' ? `new-${newAt?.date}` : (editing as PreviewSession).uid}
          title={editing === 'new' ? 'Thêm buổi' : 'Sửa buổi'}
          description={editing === 'new' ? `Tuần ${newAt?.week} của lớp` : 'Chỉ đổi trong bản xem trước, bấm Tạo lớp mới lưu.'}
          initial={editingDraft}
          subjects={subjects}
          range={range}
          submitLabel={editing === 'new' ? 'Thêm buổi' : 'Cập nhật buổi'}
          onClose={() => {
            setEditing(null);
            setNewAt(null);
          }}
          onRemove={
            editing !== 'new'
              ? () => {
                  const uid = (editing as PreviewSession).uid;
                  setSessions((current) => current.filter((item) => item.uid !== uid));
                  setEditing(null);
                }
              : undefined
          }
          onSubmit={(draft) => {
            if (editing === 'new') setSessions((current) => [...current, { ...draft, uid: nextUid() }]);
            else {
              const uid = (editing as PreviewSession).uid;
              setSessions((current) => current.map((item) => (item.uid === uid ? { ...draft, uid } : item)));
            }
            setEditing(null);
            setNewAt(null);
          }}
        />
      )}

      {bulkOpen && <BulkTimeDialog initialTime={parsedTime ?? '06:00'} initialDuration={setup.durationMinutes} onClose={() => setBulkOpen(false)} onApply={applyBulk} />}
    </div>
  );
}

/** Một hàng tuần của lưới: dùng display contents để các ô xếp thẳng cột với tiêu đề thứ. */
function WeekRow({ children }: { children: React.ReactNode }) {
  return <div className="contents">{children}</div>;
}

function BulkTimeDialog({ initialTime, initialDuration, onClose, onApply }: { initialTime: string; initialDuration: number; onClose: () => void; onApply: (time: string, duration: number) => void }) {
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(initialDuration);
  const parsed = parseClockTime(time);
  return (
    <Modal
      open
      onClose={onClose}
      title="Áp giờ cho mọi buổi"
      description="Giữ nguyên ngày của từng buổi, chỉ đổi giờ bắt đầu và thời lượng."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={!parsed} onClick={() => parsed && onApply(parsed, duration)}>
            Áp dụng
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Giờ bắt đầu" error={time && !parsed ? 'Giờ dạng HH:mm' : undefined}>
          <Input value={time} className="font-mono" onChange={(event) => setTime(event.target.value)} />
        </Field>
        <Field label="Thời lượng">
          <Stepper value={duration} onChange={setDuration} min={15} max={480} step={15} suffix="phút" label="thời lượng" />
        </Field>
      </div>
    </Modal>
  );
}
