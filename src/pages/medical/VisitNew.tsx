// F3.3 / F3.5 / F3.6 — Trang ghi buổi khám (VET). Hai chế độ theo backend:
//  a) Buổi khám ngoài bệnh án — POST /horses/:id/medical-records (Định kỳ / Theo yêu cầu;
//     kết luận Có vấn đề thì mở bệnh án ngay trong cùng thao tác).
//  b) Tái khám trong bệnh án đang mở — POST /medical-cases/:caseId/visits.
// Ngựa đã có bệnh án mở thì backend chặn buổi ngoài bệnh án (409), nên trang tự chuyển sang (b).
// Tham số URL: horseId, caseId, kind, requestIds (phân cách dấu phẩy), conclusion, replaces, back.
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, AlertTriangle, Bandage, ClipboardList, FolderOpen, HeartPulse, NotebookPen, Pill as PillIcon, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { getHorse } from '../../api/horses';
import { createFollowUpVisit, createStandaloneVisit, getRecord, listHorseCases, listHorseExamRequests, listHorseRecords } from '../../api/medical';
import type { BodyRegion, HealthStatus, InjuryType, MeasurementType, MedicalRecord, RecoveryStatus, VisitConclusion, VisitInputBase } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import {
  Button,
  CharCount,
  ErrorBox,
  Field,
  Input,
  NotFound,
  Notice,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  Textarea,
  cn,
  invalidClass,
  scrollToFirstError,
  useToast,
} from '../../components/ui';
import { UrgentPill } from '../../components/ui/status';
import { healthLabel } from '../../lib/labels';
import { bodyRegionLabel, conclusionLabel, injuryTypeLabel, measurementSpec, recoveryLabel, visitKindLabel } from '../../lib/api-labels';
import { addDays, formatDate, formatDateTime } from '../../lib/format';
import { links, safeInternalPath } from '../../lib/links';
import { now } from '../../lib/clock';
import { horsePlace, useMedicalHorses } from './components/horses';
import { PlaceLockModal } from './components/modals';
import { usePeople } from './components/people';
import { HealthPicker, RequestMeta, RequestText } from './components/parts';
import { isSevere, localToIso, toLocalInput, todayKey } from './components/utils';
import { BackLink, FormSection, HorseCard, Outcome, SaveCard } from './components/form-page';

const METRICS: MeasurementType[] = ['WEIGHT', 'TEMPERATURE', 'HEIGHT', 'BODY_CONDITION'];
const REGIONS = Object.keys(bodyRegionLabel) as BodyRegion[];
const INJURY_TYPES = Object.keys(injuryTypeLabel) as InjuryType[];
const RECOVERY = Object.keys(recoveryLabel) as RecoveryStatus[];

interface PrescriptionRow {
  key: number;
  medicine: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
}
interface InjuryRow {
  key: number;
  bodyRegion: BodyRegion | '';
  injuryType: InjuryType | '';
  recoveryStatus: RecoveryStatus;
  notes: string;
}

let rowKey = 0;
const nextKey = () => (rowKey += 1);

interface VisitOptions {
  horseId?: string;
  caseId?: string;
  kind?: 'ROUTINE' | 'REQUEST';
  requestIds?: string[];
  conclusion?: VisitConclusion;
  replaces?: MedicalRecord;
  back?: string;
}

/** Đọc tham số URL, tải buổi khám cần ghi lại (nếu có) rồi mới dựng biểu mẫu với giá trị ban đầu. */
export default function VisitNew() {
  const user = useStore((state) => state.currentUser);
  const [params] = useSearchParams();
  const replacesId = params.get('replaces') ?? undefined;
  const replaced = useService(() => (replacesId ? getRecord(replacesId) : Promise.resolve(undefined)), [replacesId]);

  if (!can(user, 'exam.record')) return <NotFound message="Chỉ bác sĩ thú y ghi được buổi khám." />;
  if (replaced.loading) return <Skeleton rows={6} />;
  if (replaced.error) return <ErrorBox message={replaced.error} />;

  const kind = params.get('kind');
  const conclusion = params.get('conclusion');
  const options: VisitOptions = {
    horseId: params.get('horseId') ?? replaced.data?.horseId ?? undefined,
    caseId: params.get('caseId') ?? undefined,
    kind: kind === 'ROUTINE' || kind === 'REQUEST' ? kind : undefined,
    requestIds: params.get('requestIds')?.split(',').filter(Boolean),
    conclusion: conclusion === 'ISSUE' || conclusion === 'NORMAL' ? conclusion : undefined,
    replaces: replaced.data,
    back: safeInternalPath(params.get('back')),
  };
  return <VisitForm key={params.toString()} {...options} />;
}

function VisitForm(props: VisitOptions) {
  const { horseId: fixedHorseId, caseId: fixedCaseId, replaces, back } = props;
  const navigate = useNavigate();
  const toast = useToast();
  const action = useAction();
  const formRef = useRef<HTMLDivElement>(null);
  const options = useMedicalHorses('all', !fixedHorseId);
  const [horseId, setHorseId] = useState(fixedHorseId ?? '');

  const context = useService(async () => {
    if (!horseId) return null;
    const [horse, open, requests, records] = await Promise.all([
      getHorse(horseId),
      listHorseCases(horseId, 'OPEN'),
      listHorseExamRequests(horseId),
      listHorseRecords(horseId).catch(() => [] as MedicalRecord[]),
    ]);
    return {
      horse,
      openCase: open.items[0] ?? null,
      pending: requests.filter((row) => row.status === 'PENDING'),
      recent: records.filter((record) => !record.voidedAt).slice(0, 3),
    };
  }, [horseId]);

  const recentDay = (value?: string | null) => !!value && new Date(value).getTime() >= addDays(now(), -7).getTime();

  const [kindChoice, setKindChoice] = useState<'ROUTINE' | 'REQUEST' | null>(props.kind ?? (replaces && replaces.kind !== 'FOLLOW_UP' ? replaces.kind : null));
  const [selected, setSelected] = useState<string[]>(props.requestIds ?? []);
  const [conclusion, setConclusion] = useState<VisitConclusion>(props.conclusion ?? replaces?.conclusion ?? 'NORMAL');
  const [initialDiagnosis, setInitialDiagnosis] = useState('');
  const [examDate, setExamDate] = useState(() => toLocalInput(replaces && recentDay(replaces.examDate) ? replaces.examDate : now()));
  const [metrics, setMetrics] = useState<Record<MeasurementType, string>>({ WEIGHT: '', HEIGHT: '', BODY_CONDITION: '', TEMPERATURE: '' });
  const [diagnosis, setDiagnosis] = useState(replaces?.diagnosis ?? '');
  const [careInstructions, setCareInstructions] = useState(replaces?.careInstructions ?? '');
  const [healthAfter, setHealthAfter] = useState<HealthStatus | ''>('');
  const [healthReason, setHealthReason] = useState('');
  const [nextVisitAt, setNextVisitAt] = useState(() => (replaces?.nextVisitAt && replaces.nextVisitAt.slice(0, 10) >= todayKey() ? toLocalInput(replaces.nextVisitAt) : ''));
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>(
    () =>
      replaces?.prescriptions.map((item) => ({
        key: nextKey(),
        medicine: item.medicine,
        dosage: item.dosage ?? '',
        frequency: item.frequency ?? '',
        startDate: item.startDate,
        endDate: item.endDate ?? '',
      })) ?? [],
  );
  const [injuries, setInjuries] = useState<InjuryRow[]>(
    () =>
      replaces?.injuries.map((item) => ({
        key: nextKey(),
        bodyRegion: item.bodyRegion,
        injuryType: item.injuryType,
        recoveryStatus: item.recoveryStatus,
        notes: item.notes ?? '',
      })) ?? [],
  );
  const [attempted, setAttempted] = useState(false);
  const [saved, setSaved] = useState<MedicalRecord | null>(null);

  const ctx = context.data;
  const horse = ctx?.horse;
  const people = usePeople(horse?.groom ? [horse.groom] : []);
  const transferred = horse?.lifecycleStatus === 'TRANSFERRED';
  const caseId = fixedCaseId ?? ctx?.openCase?.id;
  const followUp = !!caseId;
  const openCase = ctx?.openCase;
  const kind = kindChoice ?? (selected.length > 0 ? 'REQUEST' : 'ROUTINE');
  const issue = !followUp && conclusion === 'ISSUE';
  const allowCaseFields = followUp || issue;
  const pendingRows = ctx?.pending ?? [];
  const selectedIds = selected.filter((id) => pendingRows.some((row) => row.id === id));
  const healthChanged = !!horse && !!healthAfter && healthAfter !== horse.healthStatus;

  const title = replaces ? 'Ghi lại buổi khám thay thế' : followUp ? 'Ghi buổi tái khám' : issue ? 'Ghi buổi khám và mở bệnh án' : 'Ghi buổi khám';
  useCrumbs(
    horse ? [{ label: horse.name, to: links.horseMedical(horse.id) }, { label: followUp ? 'Tái khám' : 'Ghi buổi khám' }] : [{ label: 'Ghi buổi khám' }],
    [{ label: 'Y tế', to: links.medicalBoard }],
  );

  /* ----- Kiểm tra trước khi gửi, lỗi gắn vào từng ô (backend vẫn kiểm lại) ----- */
  const parsed: { type: MeasurementType; value: number }[] = [];
  const metricErrors: Partial<Record<MeasurementType, string>> = {};
  const abnormal: string[] = [];
  METRICS.forEach((type) => {
    const raw = metrics[type].trim().replace(',', '.');
    if (!raw) return;
    const spec = measurementSpec[type];
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      metricErrors[type] = 'Nhập một số';
      return;
    }
    if (value < spec.hardMin || value > spec.hardMax) {
      metricErrors[type] = `Giá trị phải trong khoảng ${spec.hardMin}–${spec.hardMax} ${spec.unit}`;
      return;
    }
    if (value < spec.min || value > spec.max) abnormal.push(`${spec.name} ${raw} ${spec.unit} (bình thường ${spec.min}–${spec.max})`);
    parsed.push({ type, value });
  });

  const errors: Record<string, string> = {};
  if (!horse && !fixedHorseId) errors.horse = 'Chọn ngựa được khám';
  const examIso = localToIso(examDate);
  if (!examIso) errors.examDate = 'Nhập thời điểm khám';
  else if (new Date(examIso).getTime() > now().getTime() + 60_000) errors.examDate = 'Thời điểm khám đang ở tương lai';
  else if (new Date(examIso).getTime() < addDays(now(), -7).getTime()) errors.examDate = 'Chỉ nhập lùi được tối đa 7 ngày';
  else if (followUp && openCase && new Date(examIso).getTime() < new Date(openCase.openedAt).getTime()) {
    errors.examDate = `Sớm hơn lúc mở bệnh án (${formatDateTime(openCase.openedAt)})`;
  }
  if (!followUp && kind === 'REQUEST' && selectedIds.length === 0) errors.requests = 'Chọn ít nhất một yêu cầu khám được xử lý';
  if (issue && !initialDiagnosis.trim()) errors.initialDiagnosis = 'Nhập chẩn đoán ban đầu';
  if (healthChanged && !healthReason.trim()) errors.healthReason = 'Nhập lý do đổi trạng thái';
  prescriptions.forEach((row) => {
    if (!row.medicine.trim() || !row.dosage.trim() || !row.frequency.trim() || !row.startDate) errors[`rx.${row.key}`] = 'Nhập đủ tên thuốc, liều, tần suất và ngày bắt đầu';
    else if (row.endDate && row.endDate < row.startDate) errors[`rx.${row.key}`] = 'Ngày kết thúc sớm hơn ngày bắt đầu';
  });
  if (allowCaseFields) {
    const pairs = new Set<string>();
    injuries.forEach((row) => {
      if (!row.bodyRegion || !row.injuryType) {
        errors[`injury.${row.key}`] = 'Chọn vùng cơ thể và loại chấn thương';
        return;
      }
      const pair = `${row.bodyRegion}:${row.injuryType}`;
      if (pairs.has(pair)) errors[`injury.${row.key}`] = 'Trùng vùng và loại với một dòng phía trên';
      pairs.add(pair);
    });
    if (nextVisitAt && nextVisitAt.slice(0, 10) < todayKey()) errors.nextVisitAt = 'Ngày hẹn đã qua';
  }
  const hasErrors = Object.keys(errors).length > 0 || Object.keys(metricErrors).length > 0;
  const show = (key: string) => (attempted ? errors[key] : undefined);

  const buildBase = (confirm: boolean): VisitInputBase => {
    const trim = (value: string) => value.trim() || undefined;
    const base: VisitInputBase = { examDate: examIso, diagnosis: trim(diagnosis), careInstructions: trim(careInstructions) };
    if (selectedIds.length) base.requestIds = selectedIds;
    if (healthAfter) {
      base.healthStatus = healthAfter;
      if (healthChanged) base.healthReason = healthReason.trim();
    }
    if (parsed.length) {
      base.measurements = parsed;
      if (confirm) base.confirmAbnormal = true;
    }
    if (prescriptions.length) {
      base.prescriptions = prescriptions.map((row) => ({
        medicine: row.medicine.trim(),
        dosage: row.dosage.trim(),
        frequency: row.frequency.trim(),
        startDate: row.startDate,
        ...(row.endDate ? { endDate: row.endDate } : {}),
      }));
    }
    if (allowCaseFields) {
      if (injuries.length) {
        base.injuries = injuries.map((row) => ({
          bodyRegion: row.bodyRegion as BodyRegion,
          injuryType: row.injuryType as InjuryType,
          recoveryStatus: row.recoveryStatus,
          ...(row.notes.trim() ? { notes: row.notes.trim() } : {}),
        }));
      }
      if (nextVisitAt) base.nextVisitAt = localToIso(nextVisitAt);
    }
    if (replaces) base.replacesRecordId = replaces.id;
    return base;
  };

  /** Lưu xong: mở bệnh án mới thì sang bệnh án; không thì về trang trước (hoặc hồ sơ y tế của ngựa). */
  const finish = (record: MedicalRecord) => {
    const openedCase = !followUp && !!record.caseId;
    navigate(openedCase ? links.case(record.caseId!) : (back ?? (record.caseId ? links.case(record.caseId) : links.horseMedical(record.horseId))), { replace: true });
  };

  const submit = (confirm = false) => {
    setAttempted(true);
    if (!horse || hasErrors) {
      scrollToFirstError(formRef.current ?? document);
      return;
    }
    const base = buildBase(confirm);
    action.run(
      () =>
        caseId
          ? createFollowUpVisit(caseId, base)
          : createStandaloneVisit(horse.id, { ...base, kind, conclusion, ...(issue ? { initialDiagnosis: initialDiagnosis.trim() } : {}) }),
      (record) => {
        toast.push(
          followUp ? `Đã ghi buổi tái khám cho ${horse.name}` : record.caseId ? `Đã ghi buổi khám và mở bệnh án cho ${horse.name}` : `Đã ghi buổi khám cho ${horse.name}`,
          'success',
        );
        const offerLock = !horse.activeTrainingLock && ((!followUp && !!record.caseId) || (healthChanged && isSevere(healthAfter as HealthStatus)));
        if (offerLock) setSaved(record);
        else finish(record);
      },
    );
  };

  const needsConfirm = action.field === 'confirmAbnormal';
  const cancelTo = back ?? (horse ? links.horseMedical(horse.id) : links.medicalBoard);
  const errorCount = Object.keys(errors).length + Object.keys(metricErrors).length;

  return (
    <div className="space-y-5" ref={formRef}>
      <PageHeader
        back={<BackLink to={cancelTo}>Quay lại</BackLink>}
        title={title}
        description="Buổi khám đã lưu không sửa, không xóa. Ghi sai thì hủy buổi đó rồi ghi lại buổi thay thế."
      />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {/* Ngựa + loại buổi khám */}
          <FormSection icon={<Stethoscope size={16} />} title={followUp ? 'Ngựa và bệnh án' : 'Ngựa và loại buổi khám'}>
            {!fixedHorseId && (
              <Field label="Ngựa được khám" required name="horse" error={show('horse')}>
                {options.loading && !options.data ? (
                  <Skeleton rows={1} />
                ) : (
                  <Select
                    value={horseId}
                    className={cn(show('horse') && invalidClass)}
                    onChange={(event) => {
                      setHorseId(event.target.value);
                      setSelected([]);
                      setKindChoice(props.kind ?? null);
                    }}
                  >
                    <option value="">Chọn ngựa…</option>
                    {options.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {horsePlace(item) ? ` · ${horsePlace(item)}` : ''} · {healthLabel[item.healthStatus]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {context.loading && horseId && !ctx ? <Skeleton rows={2} /> : context.error ? <ErrorBox message={context.error} /> : null}
            {transferred && <ErrorBox message="Ngựa đã chuyển nhượng, hồ sơ chỉ được xem." />}

            {horse && !transferred &&
              (followUp ? (
                <div className="rounded-xl bg-gray-50 p-4 text-sm">
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <FolderOpen size={13} /> Tái khám trong bệnh án đang mở
                  </p>
                  <p className="mt-0.5 font-semibold text-gray-900">{openCase?.initialDiagnosis ?? 'Bệnh án đang điều trị'}</p>
                  {openCase && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Mở {formatDate(openCase.openedAt)} ·{' '}
                      <Link to={links.case(openCase.id)} className="font-medium text-emerald-700 hover:underline">
                        Xem bệnh án
                      </Link>
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <Segmented
                    value={kind}
                    onChange={(value) => setKindChoice(value)}
                    options={[
                      { value: 'ROUTINE', label: 'Khám định kỳ' },
                      { value: 'REQUEST', label: 'Theo yêu cầu', badge: pendingRows.length },
                    ]}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['NORMAL', 'ISSUE'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setConclusion(value)}
                        aria-pressed={conclusion === value}
                        className={cn(
                          'rounded-xl bg-white p-3.5 text-left transition',
                          conclusion === value ? 'ring-2 ring-emerald-700' : 'ring-1 ring-gray-200 hover:ring-gray-300',
                        )}
                      >
                        <span className="block text-sm font-semibold text-gray-900">{value === 'NORMAL' ? 'Kết luận bình thường' : 'Có vấn đề — mở bệnh án'}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {value === 'NORMAL' ? 'Bản ghi độc lập.' : 'Buổi này là buổi đầu tiên của bệnh án mới.'}
                        </span>
                      </button>
                    ))}
                  </div>
                  {issue && (
                    <Field
                      label="Chẩn đoán ban đầu (tên bệnh án)"
                      required
                      name="initialDiagnosis"
                      error={show('initialDiagnosis')}
                      counter={<CharCount value={initialDiagnosis} max={2000} />}
                    >
                      <Input
                        value={initialDiagnosis}
                        maxLength={2000}
                        onChange={(event) => setInitialDiagnosis(event.target.value)}
                        placeholder="Ví dụ: Viêm gân gấp chân trước trái"
                        className={cn(show('initialDiagnosis') && invalidClass)}
                      />
                    </Field>
                  )}
                </>
              ))}
          </FormSection>

          {horse && !transferred && (
            <>
              {/* Yêu cầu khám */}
              {(pendingRows.length > 0 || kind === 'REQUEST') && (
                <FormSection
                  icon={<ClipboardList size={16} />}
                  title="Yêu cầu khám được xử lý"
                  aside={pendingRows.length > 0 ? <span className="text-xs text-gray-500">Đã chọn {selectedIds.length}/{pendingRows.length}</span> : undefined}
                >
                  <div data-field="requests" data-invalid={show('requests') ? 'true' : undefined} className="space-y-2">
                    {pendingRows.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">Ngựa không có yêu cầu khám đang chờ.</p>
                    ) : (
                      pendingRows.map((row) => {
                        const checked = selectedIds.includes(row.id);
                        return (
                          <label
                            key={row.id}
                            className={cn(
                              'flex cursor-pointer gap-3 rounded-xl bg-white p-3 ring-1 transition',
                              checked ? 'ring-emerald-600/50' : 'ring-gray-200 hover:ring-gray-300',
                              row.urgent && 'shadow-[inset_3px_0_0_0_#ef4444]',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => setSelected(event.target.checked ? [...selectedIds, row.id] : selectedIds.filter((id) => id !== row.id))}
                              className="mt-1 h-4 w-4 accent-emerald-600"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                {row.urgent && <UrgentPill urgent />}
                                <RequestMeta request={row} people={people} showUrgent={false} />
                              </span>
                              <span className="mt-1 block">
                                <RequestText text={row.description} />
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                    {show('requests') && <p className="text-xs font-medium text-red-600">{show('requests')}</p>}
                  </div>
                </FormSection>
              )}

              {/* Khám */}
              <FormSection icon={<Activity size={16} />} title="Kết quả khám">
                <Field label="Thời điểm khám" required name="examDate" error={show('examDate')} className="sm:max-w-xs">
                  <Input
                    type="datetime-local"
                    value={examDate}
                    min={toLocalInput(addDays(now(), -7))}
                    max={toLocalInput(now())}
                    onChange={(event) => setExamDate(event.target.value)}
                    className={cn(show('examDate') && invalidClass)}
                  />
                </Field>
                <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                  {METRICS.map((type) => {
                    const spec = measurementSpec[type];
                    return (
                      <Field key={type} label={`${spec.name} (${spec.unit})`} name={`metric.${type}`} error={metricErrors[type]}>
                        <Input
                          inputMode="decimal"
                          value={metrics[type]}
                          onChange={(event) => {
                            setMetrics({ ...metrics, [type]: event.target.value });
                            if (needsConfirm) action.clearError();
                          }}
                          placeholder={`${spec.min}–${spec.max}`}
                          className={cn('tabular-nums', metricErrors[type] && invalidClass)}
                        />
                      </Field>
                    );
                  })}
                </div>
                <Field label="Chẩn đoán và hướng điều trị" counter={<CharCount value={diagnosis} max={4000} />}>
                  <Textarea
                    value={diagnosis}
                    maxLength={4000}
                    onChange={(event) => setDiagnosis(event.target.value)}
                    rows={5}
                    className="min-h-32"
                    placeholder="Triệu chứng, kết quả khám, chẩn đoán, hướng điều trị…"
                  />
                </Field>
              </FormSection>

              {/* Điều trị */}
              <FormSection icon={<HeartPulse size={16} />} title="Sức khỏe sau khám">
                <HealthPicker value={healthAfter} onChange={(value) => setHealthAfter(value === healthAfter ? '' : value)} current={horse.healthStatus} />
                {healthChanged && (
                  <Field
                    label={`Lý do đổi ${healthLabel[horse.healthStatus]} → ${healthLabel[healthAfter as HealthStatus]}`}
                    required
                    name="healthReason"
                    error={show('healthReason')}
                  >
                    <Input value={healthReason} maxLength={500} onChange={(event) => setHealthReason(event.target.value)} className={cn(show('healthReason') && invalidClass)} />
                  </Field>
                )}
              </FormSection>

              <FormSection
                icon={<PillIcon size={16} />}
                title="Đơn thuốc"
                aside={
                  prescriptions.length < 20 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPrescriptions([...prescriptions, { key: nextKey(), medicine: '', dosage: '', frequency: '', startDate: todayKey(), endDate: '' }])}
                    >
                      <Plus size={14} /> Thêm thuốc
                    </Button>
                  )
                }
              >
                {prescriptions.length === 0 ? (
                  <p className="text-sm text-gray-500">Chưa kê thuốc.</p>
                ) : (
                  <div className="space-y-2.5">
                    {prescriptions.map((row) => {
                      const update = (patch: Partial<PrescriptionRow>) => setPrescriptions(prescriptions.map((item) => (item.key === row.key ? { ...item, ...patch } : item)));
                      const rowError = show(`rx.${row.key}`);
                      return (
                        <div key={row.key} data-field={`rx.${row.key}`} data-invalid={rowError ? 'true' : undefined} className={cn('rounded-xl bg-gray-50/80 p-3', rowError && 'ring-1 ring-red-200')}>
                          <div className="grid gap-2 sm:grid-cols-6">
                            <Input className="sm:col-span-3" placeholder="Tên thuốc" maxLength={160} value={row.medicine} onChange={(event) => update({ medicine: event.target.value })} />
                            <Input className="sm:col-span-3" placeholder="Liều (ví dụ 2 g)" maxLength={160} value={row.dosage} onChange={(event) => update({ dosage: event.target.value })} />
                            <Input className="sm:col-span-2" placeholder="Tần suất (1 lần/ngày)" maxLength={160} value={row.frequency} onChange={(event) => update({ frequency: event.target.value })} />
                            <Input className="sm:col-span-2" type="date" title="Ngày bắt đầu" value={row.startDate} onChange={(event) => update({ startDate: event.target.value })} />
                            <div className="flex gap-2 sm:col-span-2">
                              <Input type="date" title="Ngày kết thúc" min={row.startDate || undefined} value={row.endDate} onChange={(event) => update({ endDate: event.target.value })} />
                              <Button size="icon" variant="ghost" title="Bỏ thuốc này" onClick={() => setPrescriptions(prescriptions.filter((item) => item.key !== row.key))}>
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </div>
                          {rowError && <p className="mt-2 text-xs font-medium text-red-600">{rowError}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </FormSection>

              {/* Chấn thương + hẹn tái khám: chỉ khi mở bệnh án hoặc tái khám */}
              {allowCaseFields && (
                <FormSection
                  icon={<Bandage size={16} />}
                  title="Chấn thương và hẹn tái khám"
                  aside={
                    injuries.length < 20 && (
                      <Button size="sm" variant="ghost" onClick={() => setInjuries([...injuries, { key: nextKey(), bodyRegion: '', injuryType: '', recoveryStatus: 'ACUTE', notes: '' }])}>
                        <Plus size={14} /> Thêm chấn thương
                      </Button>
                    )
                  }
                >
                  {injuries.length === 0 ? (
                    <p className="text-sm text-gray-500">Chưa ghi chấn thương.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {injuries.map((row) => {
                        const update = (patch: Partial<InjuryRow>) => setInjuries(injuries.map((item) => (item.key === row.key ? { ...item, ...patch } : item)));
                        const rowError = show(`injury.${row.key}`);
                        return (
                          <div key={row.key} data-field={`injury.${row.key}`} data-invalid={rowError ? 'true' : undefined} className={cn('rounded-xl bg-gray-50/80 p-3', rowError && 'ring-1 ring-red-200')}>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <Select value={row.bodyRegion} onChange={(event) => update({ bodyRegion: event.target.value as BodyRegion })}>
                                <option value="">Vùng cơ thể…</option>
                                {REGIONS.map((value) => (
                                  <option key={value} value={value}>
                                    {bodyRegionLabel[value]}
                                  </option>
                                ))}
                              </Select>
                              <Select value={row.injuryType} onChange={(event) => update({ injuryType: event.target.value as InjuryType })}>
                                <option value="">Loại chấn thương…</option>
                                {INJURY_TYPES.map((value) => (
                                  <option key={value} value={value}>
                                    {injuryTypeLabel[value]}
                                  </option>
                                ))}
                              </Select>
                              <Select value={row.recoveryStatus} onChange={(event) => update({ recoveryStatus: event.target.value as RecoveryStatus })}>
                                {RECOVERY.map((value) => (
                                  <option key={value} value={value}>
                                    {recoveryLabel[value]}
                                  </option>
                                ))}
                              </Select>
                              <div className="flex gap-2 sm:col-span-3">
                                <Input placeholder="Ghi chú" value={row.notes} onChange={(event) => update({ notes: event.target.value })} />
                                <Button size="icon" variant="ghost" title="Bỏ dòng này" onClick={() => setInjuries(injuries.filter((item) => item.key !== row.key))}>
                                  <Trash2 size={15} />
                                </Button>
                              </div>
                            </div>
                            {rowError && <p className="mt-2 text-xs font-medium text-red-600">{rowError}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Field label="Hẹn tái khám" name="nextVisitAt" error={show('nextVisitAt')} className="sm:max-w-xs">
                    <Input
                      type="datetime-local"
                      value={nextVisitAt}
                      min={`${todayKey()}T00:00`}
                      onChange={(event) => setNextVisitAt(event.target.value)}
                      className={cn(show('nextVisitAt') && invalidClass)}
                    />
                  </Field>
                </FormSection>
              )}

              <FormSection icon={<NotebookPen size={16} />} title="Ghi chú chăm sóc cho Groom">
                <Field counter={<CharCount value={careInstructions} max={2000} />}>
                  <Textarea
                    rows={3}
                    maxLength={2000}
                    value={careInstructions}
                    onChange={(event) => setCareInstructions(event.target.value)}
                    placeholder="Ví dụ: Chườm lạnh chân trước trái 2 lần/ngày, chỉ dắt bộ nhẹ 10 phút"
                  />
                </Field>
              </FormSection>
            </>
          )}
        </div>

        {/* Cột phải: bối cảnh + lưu */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          {horse ? (
            <HorseCard
              name={horse.name}
              to={links.horseMedical(horse.id)}
              place={[horse.location.barn?.name, horse.location.stall?.code].filter(Boolean).join(' · ')}
              health={horse.healthStatus}
              locked={horse.activeTrainingLock}
            >
              <p className="mb-2 text-xs font-medium text-gray-500">Lần khám gần đây</p>
              {ctx && ctx.recent.length > 0 ? (
                <ul className="space-y-2.5">
                  {ctx.recent.map((record) => (
                    <li key={record.id} className="text-sm">
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        <span className="tabular-nums">{formatDate(record.examDate)}</span>
                        <span>· {visitKindLabel[record.kind]}</span>
                        {record.conclusion && <span>· {conclusionLabel[record.conclusion]}</span>}
                      </p>
                      {record.diagnosis && <p className="line-clamp-2 text-gray-700">{record.diagnosis}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Chưa có buổi khám nào.</p>
              )}
            </HorseCard>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-5 text-sm text-gray-500">Chọn ngựa để xem tình trạng và các lần khám gần đây.</div>
          )}

          <SaveCard>
            {horse && !transferred && (
              <ul className="space-y-1.5">
                {followUp ? (
                  <Outcome>Ghi vào bệnh án {openCase ? <span className="font-medium">{openCase.initialDiagnosis}</span> : 'đang mở'}</Outcome>
                ) : issue ? (
                  <Outcome tone="warning">Mở bệnh án mới{initialDiagnosis.trim() ? `: ${initialDiagnosis.trim()}` : ''}</Outcome>
                ) : (
                  <Outcome>Buổi khám {kind === 'ROUTINE' ? 'định kỳ' : 'theo yêu cầu'}, kết luận bình thường</Outcome>
                )}
                {selectedIds.length > 0 && <Outcome>{selectedIds.length} yêu cầu khám chuyển sang Đã khám</Outcome>}
                {healthChanged && (
                  <Outcome tone={isSevere(healthAfter as HealthStatus) ? 'warning' : 'default'}>
                    Sức khỏe {healthLabel[horse.healthStatus]} → {healthLabel[healthAfter as HealthStatus]}
                  </Outcome>
                )}
                {parsed.length > 0 && <Outcome>{parsed.length} chỉ số ghi vào bảng chỉ số cơ thể</Outcome>}
                {prescriptions.length > 0 && <Outcome>{prescriptions.length} thuốc trong đơn</Outcome>}
              </ul>
            )}

            {needsConfirm && (
              <Notice tone="warning" icon={<AlertTriangle size={16} />}>
                <p className="font-semibold">Có chỉ số ngoài khoảng bình thường</p>
                {abnormal.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                    {abnormal.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-xs">Giá trị đúng thì bấm "Xác nhận và lưu"; bản ghi được đánh dấu bất thường.</p>
              </Notice>
            )}
            {attempted && errorCount > 0 && <p className="text-sm text-red-600">Còn {errorCount} ô cần sửa ở bên trái.</p>}
            {action.error && !needsConfirm && <ErrorBox message={action.error} />}

            <div className="space-y-2 border-t border-gray-100 pt-4">
              {needsConfirm ? (
                <>
                  <Button className="h-11 w-full" onClick={() => submit(true)} disabled={action.pending}>
                    {action.pending ? 'Đang lưu…' : 'Xác nhận và lưu'}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={action.clearError}>
                    Sửa lại số đo
                  </Button>
                </>
              ) : (
                <>
                  <Button className="h-11 w-full" onClick={() => submit(false)} disabled={action.pending || !horse || transferred}>
                    {action.pending ? 'Đang lưu…' : issue ? 'Lưu và mở bệnh án' : 'Lưu buổi khám'}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => navigate(cancelTo)} disabled={action.pending}>
                    Hủy
                  </Button>
                </>
              )}
            </div>
          </SaveCard>
        </aside>
      </div>

      {saved && horse && (
        <PlaceLockModal
          horse={{ id: horse.id, name: horse.name }}
          onClose={() => finish(saved)}
          onDone={() => finish(saved)}
          intro={
            <Notice tone="success">
              {saved.caseId && !followUp ? 'Đã lưu buổi khám và mở bệnh án.' : 'Đã lưu buổi khám.'} Có cần khóa huấn luyện ngựa trong thời gian điều trị không?
            </Notice>
          }
        />
      )}
    </div>
  );
}
