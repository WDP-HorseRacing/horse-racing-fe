// F2.2, F2.3 — Mở lớp (HLV trưởng), hai bước: "Thông tin lớp" (giáo án, mã, tên, ngày bắt đầu, kèm mô tả, sở trường, sĩ số)
// rồi "Thời khóa biểu" (mỗi giai đoạn xếp một tuần mẫu bằng kéo thả môn, lúc tạo lớp nhân ra mọi tuần của giai đoạn).
// BE không nhận buổi kèm lúc tạo lớp nên FE gọi tạo lớp rồi lưu buổi theo lô; FE kiểm trước luật của BE nên gần như
// không lỗi, còn lỗi giữa chừng thì vẫn mở trang lớp kèm câu báo số buổi đã lưu. Có thể tạo lớp, xếp lịch sau.
// Bên phải bước 1 là tóm tắt: các giai đoạn kèm khoảng ngày, số buổi tối thiểu mỗi tuần, tổng thời lượng tối thiểu.
// FE kiểm trước mã lớp trùng với lớp của mình (BE vẫn kiểm lại, lỗi trùng với lớp HLV khác gắn vào ô mã lớp).
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Check, ChevronRight, Info } from 'lucide-react';
import { createClass, listClasses, listPlans } from '../../../api/training';
import type { RaceAptitude, TrainingClass, TrainingPlan } from '../../../api/types';
import { Button, CharCount, ConfirmDialog, ErrorBox, Field, Input, NotFound, Notice, PageHeader, Select, Skeleton, Textarea, cn, invalidClass, scrollToFirstError, useToast } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useAction, useService } from '../../../hooks/useService';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { useLeaveConfirm } from '../../../hooks/useLeaveConfirm';
import { useMyScope } from '../../../hooks/useMyScope';
import { can } from '../../../auth/permissions';
import { useStore } from '../../../store/store';
import { useCrumbs } from '../../../components/Breadcrumb';
import { BackLink } from '../../../components/BackLink';
import { links } from '../../../lib/links';
import { distanceLabel } from '../../../lib/labels';
import { formatDate } from '../../../lib/format';
import { classEndDate, clubToday } from '../../../lib/club-time';
import { now } from '../../../lib/clock';
import { PhaseLoad, WeekRibbon } from '../components/bits';
import { formatTotalMinutes, planPhases, planSessionCount, weekLoad } from '../plan-helpers';
import { Stepper } from '../components/Stepper';
import { buildSubmission, expandedInput, phaseRanges, type Templates } from '../class-template';
import { loadTrainerBusy, saveSessionsInChunks } from '../save-sessions';
import { ClassScheduleStep } from './ClassScheduleStep';
import type { ScheduleIssue } from './ClassSessionsTab';

/** Giới hạn của BE (mô tả BE không giới hạn, FE đặt 500). */
const CODE_MAX = 32;
const NAME_MAX = 160;
const DESCRIPTION_MAX = 500;

interface Setup {
  planId: string;
  code: string;
  name: string;
  description: string;
  raceAptitude: '' | RaceAptitude;
  maxHorses: number;
  startDate: string;
}

export default function ClassCreate() {
  const user = useStore((state) => state.currentUser);
  const data = useService(async () => {
    // Lớp của HLV (mọi trạng thái) để gợi ý mã lớp không trùng và báo trùng ngay ở ô mã lớp.
    const [plans, classes] = await Promise.all([listPlans(), listClasses().catch(() => [] as TrainingClass[])]);
    return { plans, classes };
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
  return <CreateForm plans={plans} classes={data.data.classes} />;
}

/** Mã gợi ý KA-1110 (khu A, ngày 11/10). Trùng lớp đã có thì thêm hậu tố -2, -3… */
function suggestCode(barnName: string | undefined, startDate: string, taken: ReadonlySet<string>) {
  const letter = barnName?.replace(/^Khu\s+/i, '').trim().split(/\s+/)[0]?.slice(0, 3).toUpperCase();
  const base = `${letter ? `K${letter}` : 'LOP'}-${startDate.slice(8, 10)}${startDate.slice(5, 7)}`;
  if (!taken.has(base)) return base;
  for (let index = 2; ; index += 1) if (!taken.has(`${base}-${index}`)) return `${base}-${index}`;
}

function CreateForm({ plans, classes }: { plans: TrainingPlan[]; classes: TrainingClass[] }) {
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
  }));
  const [codeEdited, setCodeEdited] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);
  const [codeServerError, setCodeServerError] = useState<string>();
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<'info' | 'schedule'>('info');
  const [templates, setTemplates] = useState<Templates>({});
  const [pendingPlan, setPendingPlan] = useState<string>();
  const [saving, setSaving] = useState<{ saved: number; total: number } | null>(null);
  const create = useAction();
  const userId = useStore((state) => state.currentUser?.id);
  // Lịch các lớp khác của HLV: tải khi vào bước thời khóa biểu lần đầu.
  const [wantBusy, setWantBusy] = useState(false);
  const busy = useService(() => (wantBusy ? loadTrainerBusy(userId) : Promise.resolve([])), [wantBusy, userId]);
  const formRef = useRef<HTMLDivElement>(null);

  const plan = plans.find((item) => item.id === setup.planId) ?? presetPlan;
  const startDate = setup.startDate || today;
  const endDate = classEndDate(startDate, plan.totalWeeks);
  // Khoảng ngày của từng giai đoạn tính từ ngày bắt đầu lớp (giống BE: tuần 1 bắt đầu đúng ngày bắt đầu).
  const ranges = phaseRanges(plan, startDate);
  const subjectMap = useMemo(() => new Map(plan.phases.flatMap((phase) => phase.subjects.map((entry) => [entry.subject.id, entry.subject] as const))), [plan]);
  const slotCount = Object.values(templates).reduce((sum, list) => sum + list.length, 0);
  const submission = useMemo(() => buildSubmission(plan, startDate, templates, subjectMap, busy.data ?? [], now()), [plan, startDate, templates, subjectMap, busy.data]);

  const dirty = !done && (setup.description !== '' || nameEdited || codeEdited || slotCount > 0);
  const leaveModal = useLeaveConfirm(dirty, 'Lớp chưa được tạo. Rời trang thì thông tin và thời khóa biểu đang soạn sẽ mất.');

  const set = <K extends keyof Setup>(key: K, value: Setup[K]) => {
    setSetup((current) => ({ ...current, [key]: value }));
    cleared(key);
  };
  const codeKey = setup.code.trim().toUpperCase();
  const owner = codeOwner.get(codeKey);
  const errors: Partial<Record<keyof Setup, string>> = {};
  if (!codeKey) errors.code = 'Nhập mã lớp';
  else if (codeKey.length > CODE_MAX) errors.code = `Mã lớp tối đa ${CODE_MAX} ký tự`;
  else if (owner) errors.code = `Mã lớp đã có ở lớp ${owner.name}`;
  else if (codeServerError) errors.code = codeServerError;
  const nameText = setup.name.trim();
  if (!nameText) errors.name = 'Nhập tên lớp';
  else if (nameText.length > NAME_MAX) errors.name = `Tên lớp tối đa ${NAME_MAX} ký tự`;
  if (!setup.startDate) errors.startDate = 'Chọn ngày bắt đầu';
  else if (setup.startDate < today) errors.startDate = 'Ngày bắt đầu không được ở quá khứ';
  if (setup.description.trim().length > DESCRIPTION_MAX) errors.description = `Mô tả tối đa ${DESCRIPTION_MAX} ký tự`;
  // Lỗi BE theo ô (tên, ngày bắt đầu…). Lỗi trùng mã giữ riêng ở codeServerError tới khi sửa mã.
  const serverErrors = Object.fromEntries(
    (['name', 'startDate', 'description', 'raceAptitude', 'maxHorses'] as const).flatMap((key) => (create.fieldErrors[key] ? [[key, create.fieldErrors[key]]] : [])),
  ) as Record<string, string>;
  const serverKeys = Object.keys(serverErrors).join(',');
  const f = useFormErrors(errors, { fieldErrors: serverErrors });
  // Mã trùng thì báo ngay, không chờ rời ô hay bấm Tạo lớp.
  const showError = (key: keyof Setup) => f.show(key) ?? (key === 'code' && (owner || codeServerError) ? errors.code : undefined);
  /** Sửa ô đang có lỗi BE thì bỏ lỗi đó. */
  const cleared = (key: keyof Setup) => {
    if (serverErrors[key]) create.clearError();
  };

  const applyPlan = (id: string) => {
    const next = plans.find((item) => item.id === id);
    setSetup((current) => ({ ...current, planId: id, name: nameEdited ? current.name : (next?.name ?? current.name) }));
  };
  // Đổi giáo án khi đã xếp tuần mẫu: hỏi trước vì môn và giai đoạn đổi theo, tuần mẫu bị xóa.
  const pickPlan = (id: string) => (slotCount > 0 && id !== setup.planId ? setPendingPlan(id) : applyPlan(id));
  const pickStart = (value: string) => {
    cleared('startDate');
    setSetup((current) => ({ ...current, startDate: value, code: codeEdited || !value ? current.code : suggestCode(barnName, value, taken) }));
  };

  const toSchedule = () => {
    if (!f.attempt(formRef.current ?? undefined)) return;
    setWantBusy(true);
    setStep('schedule');
    window.scrollTo({ top: 0 });
  };

  /** Tạo lớp, rồi (nếu có tuần mẫu) lưu các buổi theo lô. */
  const submit = (withSchedule: boolean) => {
    if (!f.attempt(formRef.current ?? undefined)) {
      setStep('info');
      return;
    }
    const fresh = withSchedule ? buildSubmission(plan, startDate, templates, subjectMap, busy.data ?? [], now()) : undefined;
    if (fresh && fresh.errors.size > 0) {
      toast.push(`Còn ${fresh.errors.size} buổi trong tuần mẫu cần sửa trước khi tạo lớp`, 'error');
      return;
    }
    void create
      .run(
        async () => {
          const created = await createClass({
            code: codeKey,
            name: setup.name.trim(),
            description: setup.description.trim() || undefined,
            raceAptitude: setup.raceAptitude || undefined,
            maxHorses: setup.maxHorses,
            planId: setup.planId,
            startDate: setup.startDate,
          });
          const accepted = fresh?.accepted ?? [];
          if (!accepted.length) return { created, saved: 0, issue: undefined };
          setSaving({ saved: 0, total: accepted.length });
          const result = await saveSessionsInChunks(
            created.id,
            accepted.map((item) => expandedInput(item, subjectMap.get(item.slot.subjectId)!)),
            (saved, total) => setSaving({ saved, total }),
          );
          const failed = result.failure?.item ? accepted.find((item) => item.startAt === result.failure!.item!.scheduledStartAt) : undefined;
          const issue: ScheduleIssue | undefined = result.failure ? { saved: result.saved, total: accepted.length, message: result.failure.message, week: failed?.week } : undefined;
          return { created, saved: result.saved, issue };
        },
        ({ created, saved, issue }) => {
          setSaving(null);
          flushSync(() => setDone(true));
          if (!issue) toast.push(saved ? `Đã mở lớp ${created.code} với ${saved} buổi` : `Đã mở lớp ${created.code}. Xếp buổi trên lịch tuần.`, 'success');
          // Thay trang tạo lớp trong lịch sử: Quay lại ở trang lớp về danh sách, không về form vừa gửi.
          navigate(links.class(created.id), { replace: true, state: issue ? { scheduleIssue: issue } : null });
        },
      )
      .then((result) => result === undefined && setSaving(null));
  };

  // Mã lớp trùng với lớp của HLV khác (FE không thấy): BE trả 409 kèm lỗi ô `code`, gắn vào ô mã lớp.
  const codeError = create.fieldErrors.code;
  const [seenError, setSeenError] = useState<string>();
  if (codeError !== seenError) {
    setSeenError(codeError);
    if (codeError) setCodeServerError(codeError);
  }
  // Lỗi ở ô của bước thông tin (mã trùng, ngày bắt đầu…) khi đang ở bước thời khóa biểu: quay về bước đó.
  const infoError = !!(codeServerError || serverKeys);
  const [seenInfoError, setSeenInfoError] = useState(false);
  if (infoError !== seenInfoError) {
    setSeenInfoError(infoError);
    if (infoError) setStep('info');
  }
  useEffect(() => {
    if (step === 'info' && (codeServerError || serverKeys) && formRef.current) scrollToFirstError(formRef.current);
  }, [codeServerError, serverKeys, step]);

  const createLabel = saving
    ? `Đang lưu buổi ${saving.saved}/${saving.total}…`
    : create.pending
      ? 'Đang tạo…'
      : submission.accepted.length
        ? `Tạo lớp và ${submission.accepted.length} buổi`
        : 'Tạo lớp, xếp lịch sau';
  const steps = (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {(
        [
          ['info', 'Thông tin lớp'],
          ['schedule', 'Thời khóa biểu'],
        ] as const
      ).map(([key, label], index) => (
        <li key={key} className="flex items-center gap-2">
          {index > 0 && <ChevronRight size={14} className="text-gray-300" />}
          <button
            type="button"
            onClick={() => (key === 'info' ? setStep('info') : toSchedule())}
            aria-current={step === key ? 'step' : undefined}
            className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition', step === key ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/30' : 'text-gray-500 hover:text-gray-800')}
          >
            {key === 'info' && step === 'schedule' && <Check size={14} className="text-emerald-700" />}
            {label}
          </button>
        </li>
      ))}
    </ol>
  );

  if (step === 'schedule') {
    return (
      <div className="space-y-4">
        {leaveModal}
        <PageHeader
          back={<BackLink fallback={links.classes} />}
          title={`Thời khóa biểu lớp ${codeKey}`}
          description={`${plan.name}, ${formatDate(startDate)} đến ${formatDate(endDate)}. Xếp một tuần mẫu cho mỗi giai đoạn, lúc tạo lớp sẽ lặp lại cho mọi tuần của giai đoạn.`}
          actions={
            <Button variant="secondary" onClick={() => setStep('info')} disabled={create.pending}>
              <ArrowLeft size={15} /> Quay lại thông tin lớp
            </Button>
          }
        />
        {steps}
        {create.error && !create.fieldErrors.code && !serverKeys && <ErrorBox message={create.error} />}
        {busy.loading && <p className="text-xs text-gray-500">Đang kiểm lịch các lớp khác của bạn…</p>}
        <ClassScheduleStep
          plan={plan}
          startDate={startDate}
          templates={templates}
          onChange={setTemplates}
          submission={submission}
          actions={
            <Button onClick={() => submit(true)} disabled={create.pending || submission.errors.size > 0 || busy.loading}>
              {createLabel}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {leaveModal}
      <PageHeader
        back={<BackLink fallback={links.classes} />}
        title="Mở lớp huấn luyện"
        description="Chọn giáo án và ngày bắt đầu, rồi lập thời khóa biểu cho từng giai đoạn."
        actions={
          <>
            <Button variant="secondary" onClick={() => submit(false)} disabled={create.pending}>
              {create.pending ? 'Đang tạo…' : 'Tạo lớp, xếp lịch sau'}
            </Button>
            <Button onClick={toSchedule} disabled={create.pending}>
              Tiếp theo: Lập thời khóa biểu <ChevronRight size={15} />
            </Button>
          </>
        }
      />
      {steps}
      {create.error && !create.fieldErrors.code && !serverKeys && <ErrorBox message={create.error} />}

      <div ref={formRef} className="grid items-start gap-5 lg:grid-cols-12 [&>*]:min-w-0">
        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80 lg:col-span-7">
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
            <Field label="Mã lớp" required name="code" error={showError('code')} onBlur={f.blur('code')} hint="Tự viết hoa, không trùng lớp khác" className="sm:col-span-2">
              <Input
                value={setup.code}
                maxLength={CODE_MAX}
                className={cn('font-mono uppercase', showError('code') && invalidClass)}
                onChange={(event) => {
                  setCodeEdited(true);
                  setCodeServerError(undefined);
                  set('code', event.target.value.toUpperCase());
                }}
              />
            </Field>
            <Field label="Tên lớp" required name="name" error={showError('name')} onBlur={f.blur('name')} counter={<CharCount value={setup.name} max={NAME_MAX} />} className="sm:col-span-3">
              <Input
                value={setup.name}
                maxLength={NAME_MAX}
                className={showError('name') ? invalidClass : ''}
                onChange={(event) => {
                  setNameEdited(true);
                  set('name', event.target.value);
                }}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
            <Field label="Ngày bắt đầu" required name="startDate" error={showError('startDate')} onBlur={f.blur('startDate')}>
              <DatePicker value={setup.startDate} onChange={pickStart} min={today} clearable={false} invalid={!!showError('startDate')} />
            </Field>
            <Field label="Sĩ số tối đa">
              <Stepper value={setup.maxHorses} onChange={(value) => set('maxHorses', value)} min={1} max={50} suffix="ngựa" label="sĩ số" />
            </Field>
          </div>
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
          <Field label="Mô tả" name="description" error={showError('description')} onBlur={f.blur('description')} counter={<CharCount value={setup.description} max={DESCRIPTION_MAX} />}>
            <Textarea rows={2} maxLength={DESCRIPTION_MAX} value={setup.description} onChange={(event) => set('description', event.target.value)} />
          </Field>
        </section>

        <aside className="lg:sticky lg:top-4 lg:col-span-5">
          <div className="space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80">
            <div>
              <p className="text-sm text-gray-600">{plan.name}</p>
              <p className="mt-1 tabular-nums text-sm font-semibold text-gray-900">
                {formatDate(startDate)} đến {formatDate(endDate)}
              </p>
            </div>
            <div className="grid grid-cols-[1fr_1.3fr] gap-2.5">
              <div className="rounded-xl bg-gray-50/80 p-3 ring-1 ring-gray-200/70">
                <p className="text-xs text-gray-500">Số tuần</p>
                <p className="tabular-nums text-2xl font-bold">{plan.totalWeeks}</p>
              </div>
              <div className="rounded-xl bg-gray-50/80 p-3 ring-1 ring-gray-200/70">
                <p className="text-xs text-gray-500">Tối thiểu cả lớp</p>
                <p className="tabular-nums text-xl font-bold">{formatTotalMinutes(plan.minTotalMinutes)}</p>
                <p className="text-[11px] text-gray-500">{planSessionCount(plan)} buổi</p>
              </div>
            </div>
            <WeekRibbon phases={planPhases(plan)} size="md" />
            <ol className="space-y-2">
              {ranges.map(({ phase, from, to }) => (
                <li key={phase.position} className="rounded-xl bg-gray-50/80 p-3 ring-1 ring-gray-200/70">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">Giai đoạn {phase.position}</span>
                    <span className="tabular-nums text-xs  text-gray-500">
                      {formatDate(from)} đến {formatDate(to)}
                    </span>
                  </div>
                  <PhaseLoad load={weekLoad(phase.subjects)} />
                  <p className="mt-1.5 truncate text-xs text-gray-500">{phase.subjects.map((item) => `${item.subject.name} ${item.minSessionsPerWeek} buổi`).join(', ')}</p>
                </li>
              ))}
            </ol>
          </div>
          <Notice tone="info" icon={<Info size={16} />} className="mt-3">
            Lớp bắt đầu ngay khi tạo. Bước sau xếp tuần mẫu cho từng giai đoạn.
          </Notice>
        </aside>
      </div>
      <ConfirmDialog
        open={!!pendingPlan}
        title="Đổi giáo án"
        message="Thời khóa biểu đã xếp theo giáo án cũ sẽ bị xóa vì môn và giai đoạn khác nhau."
        confirmLabel="Đổi giáo án"
        onClose={() => setPendingPlan(undefined)}
        onConfirm={() => {
          if (pendingPlan) applyPlan(pendingPlan);
          setTemplates({});
          setPendingPlan(undefined);
        }}
      />
    </div>
  );
}
