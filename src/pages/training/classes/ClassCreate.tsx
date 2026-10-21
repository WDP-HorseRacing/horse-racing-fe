// F2.2, F2.3 — Mở lớp (HLV trưởng): chỉ cần giáo án, mã, tên, ngày bắt đầu (kèm mô tả, sở trường, sĩ số nếu muốn).
// Lớp chép giáo án lúc tạo, đang chạy ngay và chưa có buổi nào. Tạo xong mở tab Lịch buổi để xếp buổi trên lịch tuần.
// Bên phải là tóm tắt: các giai đoạn kèm khoảng ngày tính từ ngày bắt đầu, số buổi tối thiểu mỗi tuần, tổng thời lượng tối thiểu.
// FE kiểm trước mã lớp trùng với lớp của mình (BE vẫn kiểm lại, lỗi trùng với lớp HLV khác gắn vào ô mã lớp).
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Info } from 'lucide-react';
import { createClass, listClasses, listPlans } from '../../../api/training';
import type { RaceAptitude, TrainingClass, TrainingPlan } from '../../../api/types';
import { Button, CharCount, ErrorBox, Field, Input, NotFound, Notice, PageHeader, Select, Skeleton, Textarea, cn, invalidClass, scrollToFirstError, useToast } from '../../../components/ui';
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
import { formatDate } from '../../../lib/format';
import { addDateKey, classEndDate, clubToday } from '../../../lib/club-time';
import { PhaseLoad, WeekRibbon } from '../components/bits';
import { formatTotalMinutes, planPhases, planSessionCount, weekLoad } from '../plan-helpers';
import { Stepper } from '../components/Stepper';

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
  const [touched, setTouched] = useState(false);
  const [codeServerError, setCodeServerError] = useState<string>();
  const [done, setDone] = useState(false);
  const create = useAction();
  const formRef = useRef<HTMLDivElement>(null);

  const plan = plans.find((item) => item.id === setup.planId) ?? presetPlan;
  const startDate = setup.startDate || today;
  const endDate = classEndDate(startDate, plan.totalWeeks);
  // Khoảng ngày của từng giai đoạn tính từ ngày bắt đầu lớp (giống BE: tuần 1 bắt đầu đúng ngày bắt đầu).
  const phaseRanges = plan.phases.map((phase) => {
    const from = addDateKey(startDate, (phase.startWeek - 1) * 7);
    return { phase, from, to: addDateKey(from, phase.weeks * 7 - 1) };
  });

  const dirty = !done && (setup.description !== '' || nameEdited || codeEdited);
  const leaveModal = useLeaveConfirm(dirty, 'Lớp chưa được tạo. Rời trang thì thông tin đang nhập sẽ mất.');

  const set = <K extends keyof Setup>(key: K, value: Setup[K]) => setSetup((current) => ({ ...current, [key]: value }));
  const codeKey = setup.code.trim().toUpperCase();
  const owner = codeOwner.get(codeKey);
  const errors: Partial<Record<keyof Setup, string>> = {};
  if (!codeKey) errors.code = 'Nhập mã lớp';
  else if (codeKey.length > 32) errors.code = 'Mã lớp tối đa 32 ký tự';
  else if (owner) errors.code = `Mã lớp đã có ở lớp ${owner.name}`;
  else if (codeServerError) errors.code = codeServerError;
  if (!setup.name.trim()) errors.name = 'Nhập tên lớp';
  if (!setup.startDate) errors.startDate = 'Chọn ngày bắt đầu';
  else if (setup.startDate < today) errors.startDate = 'Ngày bắt đầu không được ở quá khứ';
  else if (create.fieldErrors.startDate) errors.startDate = create.fieldErrors.startDate;
  // Mã trùng thì báo ngay, không chờ bấm Tạo lớp.
  const showError = (key: keyof Setup) => (touched || (key === 'code' && (owner || codeServerError)) || (key === 'startDate' && create.fieldErrors.startDate) ? errors[key] : undefined);

  const pickPlan = (id: string) => {
    const next = plans.find((item) => item.id === id);
    setSetup((current) => ({ ...current, planId: id, name: nameEdited ? current.name : (next?.name ?? current.name) }));
  };
  const pickStart = (value: string) => {
    setSetup((current) => ({ ...current, startDate: value, code: codeEdited || !value ? current.code : suggestCode(barnName, value, taken) }));
  };

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) {
      if (formRef.current) scrollToFirstError(formRef.current);
      return;
    }
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
        }),
      (created) => {
        flushSync(() => setDone(true));
        toast.push(`Đã mở lớp ${created.code}. Xếp buổi trên lịch tuần.`, 'success');
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

  return (
    <div className="space-y-5 pb-4">
      {leaveModal}
      <PageHeader
        back={<BackLink fallback={links.classes} />}
        title="Mở lớp huấn luyện"
        description="Chọn giáo án và ngày bắt đầu. Tạo xong thì xếp buổi trên lịch tuần của lớp."
        actions={
          <Button onClick={submit} disabled={create.pending}>
            {create.pending ? 'Đang tạo…' : 'Tạo lớp'}
          </Button>
        }
      />
      {create.error && !create.fieldErrors.code && !create.fieldErrors.startDate && <ErrorBox message={create.error} />}

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
          <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
            <Field label="Ngày bắt đầu" required name="startDate" error={showError('startDate')}>
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
          <Field label="Mô tả" counter={<CharCount value={setup.description} max={500} />}>
            <Textarea rows={2} maxLength={500} value={setup.description} onChange={(event) => set('description', event.target.value)} />
          </Field>
        </section>

        <aside className="lg:sticky lg:top-4 lg:col-span-5">
          <div className="turf-soft space-y-4 rounded-2xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10">
            <div>
              <p className="text-sm text-gray-600">{plan.name}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-gray-900">
                {formatDate(startDate)} đến {formatDate(endDate)}
              </p>
            </div>
            <div className="grid grid-cols-[1fr_1.3fr] gap-2.5">
              <div className="rounded-xl bg-white/80 p-3 ring-1 ring-emerald-900/10">
                <p className="text-xs text-gray-500">Số tuần</p>
                <p className="font-mono text-2xl font-bold">{plan.totalWeeks}</p>
              </div>
              <div className="rounded-xl bg-white/80 p-3 ring-1 ring-emerald-900/10">
                <p className="text-xs text-gray-500">Tối thiểu cả lớp</p>
                <p className="font-mono text-xl font-bold">{formatTotalMinutes(plan.minTotalMinutes)}</p>
                <p className="text-[11px] text-gray-500">{planSessionCount(plan)} buổi</p>
              </div>
            </div>
            <WeekRibbon phases={planPhases(plan)} size="md" />
            <ol className="space-y-2">
              {phaseRanges.map(({ phase, from, to }) => (
                <li key={phase.position} className="rounded-xl bg-white/80 p-3 ring-1 ring-emerald-900/10">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">Giai đoạn {phase.position}</span>
                    <span className="font-mono text-xs tabular-nums text-gray-500">
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
            Lớp chạy ngay khi tạo. Buổi tập xếp trên lịch tuần, chỉ dùng môn của giai đoạn chứa ngày đó.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
