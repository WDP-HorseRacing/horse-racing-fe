// F2.2, F2.3 — Mở lớp (HLV trưởng) trên một trang: thông tin lớp ở trên, lịch buổi tập ngay bên dưới.
// Đủ giáo án, ngày, giờ, thời lượng thì lịch tự sinh từ giáo án (BE sinh, chưa lưu gì). HLV thêm buổi vào bất kỳ ngày nào
// trong thời gian lớp (kể cả thứ giáo án không có, BE cho phép), đổi giờ, đổi môn, bỏ buổi ngay trên lưới.
// Bấm Tạo lớp thì lớp và mọi buổi lưu trong một lần. FE kiểm trước trùng giờ và mã lớp trùng với lớp của mình (BE vẫn kiểm lại).
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Clock3, Flag, Info, Loader2, Plus, RotateCcw, Wand2 } from 'lucide-react';
import { createClass, listClasses, listPlans, listSubjects, previewSchedule } from '../../../api/training';
import type { RaceAptitude, TrainingClass, TrainingPlan, TrainingSubject } from '../../../api/types';
import {
  Button,
  CharCount,
  ConfirmDialog,
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
  scrollToFirstError,
  useToast,
} from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useAction, useService } from '../../../hooks/useService';
import { useLeaveConfirm } from '../../../hooks/useLeaveConfirm';
import { useMyScope } from '../../../hooks/useMyScope';
import { can } from '../../../auth/permissions';
import { useStore } from '../../../store/store';
import { useCrumbs } from '../../../components/Breadcrumb';
import { BackLink } from '../../../components/BackLink';
import { links } from '../../../lib/links';
import { distanceLabel } from '../../../lib/labels';
import { errorMessage } from '../../../lib/errors';
import { formatDate } from '../../../lib/format';
import { addDateKey, addMinutes, classEndDate, clubDateKey, clubInstant, clubTime, clubToday, isoWeekdayOf, minutesBetween, parseClockTime } from '../../../lib/club-time';
import { formatMeters } from '../../../lib/training-format';
import { weekdayLong } from '../../../lib/training-labels';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { IntensityBars, WeekRibbon } from '../components/bits';
import { planPhaseAt, planPhases, planSessionCount, planSubjectAt } from '../plan-helpers';
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
    // Lớp của HLV (mọi trạng thái) để gợi ý mã lớp không trùng và báo trùng ngay ở ô mã lớp.
    const [plans, subjects, classes] = await Promise.all([listPlans(), listSubjects(), listClasses().catch(() => [] as TrainingClass[])]);
    return { plans, subjects, classes };
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
  return <CreateForm plans={plans} subjects={data.data.subjects} classes={data.data.classes} />;
}

/** Mã gợi ý KA-1110 (khu A, ngày 11/10). Trùng lớp đã có thì thêm hậu tố -2, -3… */
function suggestCode(barnName: string | undefined, startDate: string, taken: ReadonlySet<string>) {
  const letter = barnName?.replace(/^Khu\s+/i, '').trim().split(/\s+/)[0]?.slice(0, 3).toUpperCase();
  const base = `${letter ? `K${letter}` : 'LOP'}-${startDate.slice(8, 10)}${startDate.slice(5, 7)}`;
  if (!taken.has(base)) return base;
  for (let index = 2; ; index += 1) if (!taken.has(`${base}-${index}`)) return `${base}-${index}`;
}

function CreateForm({ plans, subjects, classes }: { plans: TrainingPlan[]; subjects: TrainingSubject[]; classes: TrainingClass[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { scope } = useMyScope();
  const today = clubToday();
  const presetPlan = plans.find((plan) => plan.id === params.get('planId')) ?? plans[0];
  const barnName = scope?.myBarns[0]?.name;
  const codeOwner = useMemo(() => new Map(classes.map((item) => [item.code.toUpperCase(), item])), [classes]);
  const taken = useMemo(() => new Set(codeOwner.keys()), [codeOwner]);

  const [setup, setSetup] = useState<Setup>(() => ({
    planId: presetPlan.id,
    code: suggestCode(barnName, today, taken),
    name: presetPlan.name,
    description: '',
    raceAptitude: '',
    maxHorses: 10,
    startDate: today,
    startTime: '06:00',
    durationMinutes: 60,
  }));
  const [codeEdited, setCodeEdited] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);
  const [sessions, setSessions] = useState<PreviewSession[]>([]);
  // Lịch đang là bản sinh từ thiết lập nào. HLV đã chỉnh tay thì không tự sinh lại khi đổi thiết lập.
  const [generatedKey, setGeneratedKey] = useState('');
  const [scheduleEdited, setScheduleEdited] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string>();
  const [regenOpen, setRegenOpen] = useState(false);
  const [editing, setEditing] = useState<PreviewSession | 'new' | null>(null);
  const [newAt, setNewAt] = useState<{ date: string; week: number } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [codeServerError, setCodeServerError] = useState<string>();
  const [done, setDone] = useState(false);
  const create = useAction();
  const formRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const plan = plans.find((item) => item.id === setup.planId) ?? presetPlan;
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const endDate = classEndDate(setup.startDate || today, plan.totalWeeks);
  const parsedTime = parseClockTime(setup.startTime);
  const setupKey = JSON.stringify([setup.planId, plan.updatedAt, setup.startDate, parsedTime, setup.durationMinutes]);
  const range = { from: setup.startDate, to: endDate };
  const validSetup = !!setup.startDate && !!parsedTime;

  const dirty = !done && (scheduleEdited || setup.description !== '' || nameEdited || codeEdited);
  const leaveModal = useLeaveConfirm(dirty, 'Lớp chưa được tạo. Rời trang thì lịch đang soạn sẽ mất.');

  const set = <K extends keyof Setup>(key: K, value: Setup[K]) => setSetup((current) => ({ ...current, [key]: value }));
  const codeKey = setup.code.trim().toUpperCase();
  const owner = codeOwner.get(codeKey);
  const setupErrors: Partial<Record<keyof Setup, string>> = {};
  if (!codeKey) setupErrors.code = 'Nhập mã lớp';
  else if (codeKey.length > 32) setupErrors.code = 'Mã lớp tối đa 32 ký tự';
  else if (owner) setupErrors.code = `Mã lớp đã có ở lớp ${owner.name}`;
  else if (codeServerError) setupErrors.code = codeServerError;
  if (!setup.name.trim()) setupErrors.name = 'Nhập tên lớp';
  if (!setup.startDate) setupErrors.startDate = 'Chọn ngày bắt đầu';
  if (!parsedTime) setupErrors.startTime = 'Giờ dạng HH:mm, ví dụ 06:00';
  // Mã trùng thì báo ngay, không chờ bấm Tạo lớp.
  const showError = (key: keyof Setup) => (touched || (key === 'code' && (owner || codeServerError)) ? setupErrors[key] : undefined);

  const pickPlan = (id: string) => {
    const next = plans.find((item) => item.id === id);
    setSetup((current) => ({ ...current, planId: id, name: nameEdited ? current.name : (next?.name ?? current.name) }));
  };
  const pickStart = (value: string) => {
    setSetup((current) => ({ ...current, startDate: value, code: codeEdited || !value ? current.code : suggestCode(barnName, value, taken) }));
  };

  // Tự sinh lịch theo giáo án khi thiết lập đổi (chờ 400ms sau lần gõ cuối), trừ khi HLV đã chỉnh tay lịch.
  useEffect(() => {
    if (!validSetup || scheduleEdited || setupKey === generatedKey) return;
    const id = (requestRef.current += 1);
    const timer = window.setTimeout(() => {
      setGenerating(true);
      setGenerateError(undefined);
      previewSchedule({ planId: setup.planId, startDate: setup.startDate, startTime: parsedTime!, durationMinutes: setup.durationMinutes })
        .then((result) => {
          if (id !== requestRef.current) return;
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
          setGeneratedKey(setupKey);
        })
        .catch((caught: unknown) => {
          if (id === requestRef.current) setGenerateError(errorMessage(caught));
        })
        .finally(() => {
          if (id === requestRef.current) setGenerating(false);
        });
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupKey, validSetup, scheduleEdited, generatedKey]);

  /** Mọi thay đổi tay trên lịch: từ đó đổi thiết lập không tự sinh lại nữa. */
  const editSchedule = (update: (current: PreviewSession[]) => PreviewSession[]) => {
    setSessions(update);
    setScheduleEdited(true);
  };
  const regenerate = () => {
    setRegenOpen(false);
    setScheduleEdited(false);
    setGeneratedKey('');
  };

  // Lưới 7 cột theo tuần của lớp: tuần tính từ ngày bắt đầu nên cột đầu là thứ của ngày khai giảng.
  const firstDay = setup.startDate ? isoWeekdayOf(setup.startDate) : 1;
  const columns = Array.from({ length: 7 }, (_, offset) => ((firstDay - 1 + offset) % 7) + 1);
  const weeks = Array.from({ length: plan.totalWeeks }, (_, index) => index + 1);
  const sorted = useMemo(() => [...sessions].sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt)), [sessions]);
  const byDate = useMemo(() => {
    const map = new Map<string, PreviewSession[]>();
    sorted.forEach((session) => {
      const key = clubDateKey(session.scheduledStartAt);
      map.set(key, [...(map.get(key) ?? []), session]);
    });
    return map;
  }, [sorted]);

  const invalid = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((session) => {
      const message = Object.values(sessionErrors(session, subjectById.get(session.subjectId), range))[0];
      if (message) map.set(session.uid, message);
    });
    // Hai buổi giao giờ nhau (chạm mép không tính): báo ở cả hai thẻ.
    sorted.forEach((session, index) => {
      const other = sorted.slice(0, index).find((item) => new Date(item.scheduledEndAt).getTime() > new Date(session.scheduledStartAt).getTime());
      if (!other) return;
      if (!map.has(session.uid)) map.set(session.uid, `Trùng giờ với buổi ${clubTime(other.scheduledStartAt)}`);
      if (!map.has(other.uid)) map.set(other.uid, `Trùng giờ với buổi ${clubTime(session.scheduledStartAt)}`);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, sorted, subjectById, setup.startDate, endDate]);
  const trials = sessions.filter((session) => subjectById.get(session.subjectId)?.sessionType === 'TIME_TRIAL').length;

  // Lịch vừa sinh: băng giai đoạn kéo dài từ trái, thẻ buổi rơi vào lưới.
  useGSAP(
    () => {
      if (!generatedKey || prefersReducedMotion()) return;
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('[data-week-band]', { scaleX: 0, transformOrigin: 'left center', duration: 0.45, stagger: 0.04 })
        .from('[data-session-chip]', { opacity: 0, y: -12, scale: 0.94, duration: 0.35, stagger: { amount: 0.5 }, clearProps: 'all' }, '-=0.3');
    },
    { scope: gridRef, dependencies: [generatedKey] },
  );

  const applyBulk = (time: string, duration: number) => {
    editSchedule((current) =>
      current.map((session) => {
        const start = clubInstant(clubDateKey(session.scheduledStartAt), time);
        return { ...session, scheduledStartAt: start, scheduledEndAt: addMinutes(start, duration) };
      }),
    );
    setBulkOpen(false);
    toast.push(`Đã đặt giờ ${time} cho mọi buổi`, 'success');
  };

  const blockers = [
    Object.keys(setupErrors).length > 0 && touched ? 'Còn ô thông tin chưa hợp lệ' : null,
    owner ? 'Mã lớp đã có' : null,
    invalid.size > 0 ? `${invalid.size} buổi chưa hợp lệ` : null,
    sessions.length === 0 && (scheduleEdited || !!generatedKey) && !generating ? 'Lớp chưa có buổi nào' : null,
    sessions.length > 500 ? 'Một lớp tối đa 500 buổi' : null,
  ].filter(Boolean) as string[];

  const submit = () => {
    setTouched(true);
    if (Object.keys(setupErrors).length > 0) {
      if (formRef.current) scrollToFirstError(formRef.current);
      return;
    }
    if (sessions.length === 0) return void toast.push('Lớp cần ít nhất một buổi tập', 'error');
    if (invalid.size > 0) return void toast.push('Còn buổi tập chưa hợp lệ, xem các thẻ viền đỏ', 'error');
    if (sessions.length > 500) return void toast.push('Một lớp tối đa 500 buổi tập', 'error');
    void create.run(
      () =>
        createClass({
          code: codeKey,
          name: setup.name.trim(),
          description: setup.description.trim() || undefined,
          raceAptitude: setup.raceAptitude || undefined,
          maxHorses: setup.maxHorses,
          planId: setup.planId,
          startDate: setup.startDate,
          sessions: sorted.map((session) => ({
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
        // Thay trang tạo lớp trong lịch sử: Quay lại ở trang lớp về danh sách, không về form vừa gửi.
        navigate(links.class(created.id), { replace: true });
      },
    );
  };

  // Mã lớp trùng với lớp của HLV khác (FE không thấy): BE trả 409 kèm lỗi ô `code`, gắn vào ô mã lớp.
  const codeError = create.fieldErrors.code;
  const [seenError, setSeenError] = useState<string>();
  if (codeError !== seenError) {
    setSeenError(codeError);
    if (codeError) setCodeServerError(codeError);
  }
  useEffect(() => {
    if (codeServerError && formRef.current) scrollToFirstError(formRef.current);
  }, [codeServerError]);

  const editingDraft: SessionDraft | null =
    editing === 'new' && newAt
      ? (() => {
          // Môn gợi ý: môn của giáo án đúng thứ đó, không có thì môn đầu của giai đoạn, cuối cùng là môn đầu danh mục.
          const subject = planSubjectAt(plan, newAt.week, isoWeekdayOf(newAt.date)) ?? planPhaseAt(plan, newAt.week)?.subjects[0]?.subject ?? subjects[0];
          // Ngày đã có buổi: buổi mới bắt đầu khi buổi cuối của ngày kết thúc.
          const sameDay = byDate.get(newAt.date) ?? [];
          const start = sameDay.length ? sameDay[sameDay.length - 1].scheduledEndAt : clubInstant(newAt.date, parsedTime ?? '06:00');
          return draftFromSubject(subject, start, addMinutes(start, setup.durationMinutes));
        })()
      : editing && editing !== 'new'
        ? editing
        : null;

  const openNew = (date: string, week: number) => {
    setNewAt({ date, week });
    setEditing('new');
  };

  return (
    <div className="space-y-5 pb-4">
      {leaveModal}
      <PageHeader back={<BackLink fallback={links.classes} />} title="Mở lớp huấn luyện" description="Lịch tạo sẵn theo giáo án, chỉnh xong thì bấm Tạo lớp." />

      <div ref={formRef} className="grid gap-5 lg:grid-cols-12">
        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80 lg:col-span-8">
          <h2 className="text-base font-semibold text-gray-900">Thông tin lớp</h2>
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
            <Field label="Mã lớp" required name="code" error={showError('code')} hint="Tự viết hoa, không trùng lớp khác" className="sm:col-span-2">
              <Input
                value={setup.code}
                maxLength={40}
                className={cn('font-mono uppercase', showError('code') && invalidClass)}
                onChange={(event) => {
                  setCodeEdited(true);
                  setCodeServerError(undefined);
                  set('code', event.target.value.toUpperCase());
                }}
              />
            </Field>
            <Field label="Tên lớp" required name="name" error={showError('name')} className="sm:col-span-3">
              <Input
                value={setup.name}
                className={showError('name') ? invalidClass : ''}
                onChange={(event) => {
                  setNameEdited(true);
                  set('name', event.target.value);
                }}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1.25fr_0.85fr_1.1fr]">
            <Field label="Ngày bắt đầu" required name="startDate" error={showError('startDate')}>
              <DatePicker value={setup.startDate} onChange={pickStart} clearable={false} />
            </Field>
            <Field label="Giờ bắt đầu" required name="startTime" error={showError('startTime')} hint="Giờ câu lạc bộ">
              <Input
                value={setup.startTime}
                inputMode="numeric"
                placeholder="06:00"
                className={cn('font-mono', showError('startTime') && invalidClass)}
                onChange={(event) => set('startTime', event.target.value)}
                onBlur={() => parsedTime && set('startTime', parsedTime)}
              />
            </Field>
            <Field label="Thời lượng mỗi buổi">
              <Stepper value={setup.durationMinutes} onChange={(value) => set('durationMinutes', value)} min={15} max={480} step={15} suffix="phút" label="thời lượng" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Sĩ số tối đa">
              <Stepper value={setup.maxHorses} onChange={(value) => set('maxHorses', value)} min={1} max={50} suffix="ngựa" label="sĩ số" />
            </Field>
            <Field label="Sở trường cự ly mục tiêu" className="sm:col-span-2">
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

        <aside className="lg:col-span-4">
          <div className="sticky top-4 space-y-3">
            <div className="turf-soft rounded-2xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10">
              <p className="text-sm text-gray-600">{plan.name}</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
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
                  <p className="text-xs text-gray-500">Số buổi</p>
                  <p className="font-mono text-2xl font-bold">{sessions.length}</p>
                  <p className="text-[11px] text-gray-500">
                    giáo án {planSessionCount(plan)}
                    {trials > 0 && ` · ${trials} chạy thử`}
                  </p>
                </div>
              </div>
              <WeekRibbon phases={planPhases(plan)} size="md" className="mt-4" />
            </div>
            <Notice tone="info" icon={<Info size={16} />}>
              Lớp tạo ra ở trạng thái nháp. Kích hoạt lớp xong mới ghi danh ngựa và công bố buổi được.
            </Notice>
          </div>
        </aside>
      </div>

      <section ref={gridRef} className="rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              Lịch buổi tập {generating && <Loader2 size={15} className="animate-spin text-emerald-700" aria-label="Đang sinh lịch" />}
            </h2>
            <p className="text-sm text-gray-500">Bấm ô trống để thêm buổi vào ngày đó, bấm thẻ buổi để đổi giờ, đổi môn hoặc bỏ buổi.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {scheduleEdited && (
              <Button variant="inline" size="sm" onClick={() => setRegenOpen(true)} disabled={!validSetup}>
                <RotateCcw size={13} /> Tạo lại theo giáo án
              </Button>
            )}
            <Button variant="inline" size="sm" onClick={() => setBulkOpen(true)} disabled={sessions.length === 0}>
              <Wand2 size={13} /> Áp giờ cho mọi buổi
            </Button>
          </div>
        </div>

        {generateError && (
          <div className="px-5 pt-4">
            <ErrorBox message={generateError} />
          </div>
        )}
        {scheduleEdited && validSetup && setupKey !== generatedKey && (
          <p className="mx-5 mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            Bạn vừa đổi thông tin lớp. Bấm "Tạo lại theo giáo án" để cập nhật lịch.
          </p>
        )}

        {!validSetup ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">Chọn ngày và giờ bắt đầu để sinh lịch.</p>
        ) : (
          <div className="overflow-x-auto py-4" data-lenis-prevent-wheel>
            <div className={cn('grid min-w-[63.5rem] grid-cols-[5.5rem_repeat(7,minmax(7.5rem,1fr))] gap-2 px-4 transition-opacity sm:min-w-[66.5rem] sm:grid-cols-[8.5rem_repeat(7,minmax(7.5rem,1fr))]', generating && 'opacity-60')}>
              <div className="sticky left-0 z-10 -ml-4 bg-white pl-4" />
              {columns.map((day) => (
                <div key={day} className="px-1 pb-1 text-center text-xs font-semibold text-gray-500">
                  {weekdayLong[day]}
                </div>
              ))}
              {weeks.map((week) => {
                const phase = planPhaseAt(plan, week);
                const weekStart = addDateKey(setup.startDate, (week - 1) * 7);
                return (
                  <WeekRow key={week}>
                    {/* Cột tuần dính bên trái khi cuộn ngang lưới trên màn nhỏ. */}
                    <div className="sticky left-0 z-10 -ml-4 flex flex-col justify-center gap-1.5 bg-white pl-4 pr-2">
                      <p className="font-mono text-xs font-semibold text-gray-500">Tuần {week}</p>
                      <div data-week-band className="truncate rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-900">
                        {phase ? `Giai đoạn ${phase.position}` : 'Ngoài giáo án'}
                      </div>
                    </div>
                    {columns.map((day, offset) => {
                      const date = addDateKey(weekStart, offset);
                      const inRange = date <= endDate;
                      const cell = byDate.get(date) ?? [];
                      if (!inRange) return <div key={day} className="rounded-xl bg-[repeating-linear-gradient(135deg,#f3f4f6_0,#f3f4f6_6px,#fff_6px,#fff_12px)] ring-1 ring-gray-100" aria-hidden />;
                      return (
                        <div key={day} className="group/cell relative flex min-h-[5.5rem] flex-col gap-1.5 rounded-xl bg-gray-50/70 p-1.5 ring-1 ring-gray-100">
                          <span className="pointer-events-none absolute right-2 top-1 font-mono text-[10px] text-gray-400">{formatDate(date).slice(0, 5)}</span>
                          {cell.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => openNew(date, week)}
                              aria-label={`Thêm buổi ngày ${formatDate(date)}`}
                              className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-300 transition hover:border-emerald-400 hover:bg-emerald-50/60 hover:text-emerald-700"
                            >
                              <Plus size={26} strokeWidth={2.2} />
                            </button>
                          ) : (
                            <>
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
                                      'w-full rounded-lg bg-white p-2 text-left shadow-[0_6px_14px_-12px_rgba(6,78,59,0.5)] ring-1 transition hover:-translate-y-0.5',
                                      error ? 'ring-2 ring-red-400' : 'ring-gray-200 hover:ring-emerald-300',
                                    )}
                                  >
                                    <p className="flex items-center gap-1 font-mono text-[11px] text-gray-500">
                                      <Clock3 size={11} />
                                      {clubTime(session.scheduledStartAt)}
                                      <span className="text-gray-400">{minutesBetween(session.scheduledStartAt, session.scheduledEndAt)}p</span>
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
                              <button
                                type="button"
                                onClick={() => openNew(date, week)}
                                aria-label={`Thêm buổi nữa ngày ${formatDate(date)}`}
                                className="flex h-6 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-emerald-50 hover:text-emerald-700 focus:opacity-100 group-hover/cell:opacity-100 [@media(hover:none)]:opacity-100"
                              >
                                <Plus size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </WeekRow>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_18px_40px_-20px_rgba(6,78,59,0.45)] ring-1 ring-gray-200/80 backdrop-blur">
        <p className={cn('mr-auto text-sm', blockers.length ? 'font-medium text-red-700' : 'text-gray-500')}>
          {blockers.length ? blockers.join(' · ') : `${setup.code || 'Lớp mới'}: ${sessions.length} buổi từ ${formatDate(setup.startDate)} đến ${formatDate(endDate)}`}
        </p>
        {create.error && !create.fieldErrors.code && <p className="w-full text-sm text-red-700 sm:w-auto">{create.error}</p>}
        <Button onClick={submit} disabled={create.pending || generating}>
          <CalendarCheck size={16} /> {create.pending ? 'Đang tạo lớp…' : 'Tạo lớp'}
        </Button>
      </div>

      {editingDraft && (
        <SessionEditSheet
          key={editing === 'new' ? `new-${newAt?.date}` : (editing as PreviewSession).uid}
          title={editing === 'new' ? 'Thêm buổi' : 'Sửa buổi'}
          description={editing === 'new' ? `Tuần ${newAt?.week} của lớp, ${newAt ? formatDate(newAt.date) : ''}` : undefined}
          initial={editingDraft}
          subjects={subjects}
          range={range}
          submitLabel={editing === 'new' ? 'Thêm buổi' : 'Lưu'}
          onClose={() => {
            setEditing(null);
            setNewAt(null);
          }}
          onRemove={
            editing !== 'new'
              ? () => {
                  const uid = (editing as PreviewSession).uid;
                  editSchedule((current) => current.filter((item) => item.uid !== uid));
                  setEditing(null);
                }
              : undefined
          }
          onSubmit={(draft) => {
            if (editing === 'new') editSchedule((current) => [...current, { ...draft, uid: nextUid() }]);
            else {
              const uid = (editing as PreviewSession).uid;
              editSchedule((current) => current.map((item) => (item.uid === uid ? { ...draft, uid } : item)));
            }
            setEditing(null);
            setNewAt(null);
          }}
        />
      )}

      {bulkOpen && <BulkTimeDialog initialTime={parsedTime ?? '06:00'} initialDuration={setup.durationMinutes} onClose={() => setBulkOpen(false)} onApply={applyBulk} />}
      <ConfirmDialog
        open={regenOpen}
        danger={false}
        title="Tạo lại lịch theo giáo án"
        message="Các buổi bạn đã thêm, sửa hoặc bỏ sẽ mất, lịch sinh lại đúng theo giáo án và thiết lập hiện tại."
        confirmLabel="Tạo lại"
        onClose={() => setRegenOpen(false)}
        onConfirm={regenerate}
      />
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
