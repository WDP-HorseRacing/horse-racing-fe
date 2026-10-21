// F3.3 / F3.5 / F3.6 — Trang ghi buổi khám (VET). Hai chế độ theo backend:
//  a) Buổi khám ngoài bệnh án — POST /horses/:id/medical-records (Định kỳ / Theo yêu cầu;
//     kết luận Có vấn đề thì mở bệnh án ngay trong cùng thao tác).
//  b) Tái khám trong bệnh án đang mở — POST /medical-cases/:caseId/visits.
// Ngựa đã có bệnh án mở thì backend chặn buổi ngoài bệnh án (409), nên trang tự chuyển sang (b).
// Chấn thương theo từng vết: vết đang theo dõi chỉ ghi mức hồi phục mới (injuryUpdates), vết mới gửi kèm vị trí (newInjuries).
// Chi phí ghi theo từng buổi khám, bỏ trống là 0. Thời điểm khám là lúc lưu (BE không nhận `examDate`).
// Tham số URL: horseId, caseId, kind, requestIds (phân cách dấu phẩy), conclusion, replaces, edit, back.
// Có `edit=<id buổi khám>` thì mở trang sửa buổi khám (VisitEdit), dùng chung các khối trong components/visit-form.
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, AlertTriangle, Bandage, FolderOpen, HeartPulse, Plus, Stethoscope, Trash2, Wallet } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { getHorse } from '../../api/horses';
import { createFollowUpVisit, createStandaloneVisit, getInjuries, getRecord, listHorseCases, listHorseExamRequests, listHorseRecords } from '../../api/medical';
import type { BodyRegion, HealthStatus, InjuryType, MedicalRecord, RecoveryStatus, VisitConclusion, VisitInputBase } from '../../api/types';
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
import { healthLabel } from '../../lib/labels';
import { bodyRegionLabel, conclusionLabel, injuryTypeLabel, recoveryLabel, visitKindLabel } from '../../lib/api-labels';
import { positionOfRegion, type InjuryPosition } from '../../lib/injury-position';
import { formatDate, formatMoney } from '../../lib/format';
import { links, safeInternalPath } from '../../lib/links';
import { horsePlace, useMedicalHorses } from './components/horses';
import { PlaceLockModal } from './components/modals';
import { usePeople } from './components/people';
import { HealthPicker } from './components/parts';
import { MAX_COST, formatMoneyInput, isSevere, localToIso, parseMoney, toLocalInput, todayKey } from './components/utils';
import { RecoveryTag } from './components/ExamTimeline';
import { BackLink, FormSection, HorseCard, Outcome, SaveCard } from './components/form-page';
import { DateTimePicker } from '../../components/ui/DatePicker';
import { CareNotesSection, MetricFields, PrescriptionSection, RequestChooser } from './components/visit-form';
import {
  emptyMetrics,
  nextRowKey,
  parseMetrics,
  prescriptionErrors,
  prescriptionInputs,
  prescriptionRowsOf,
  type MetricValues,
  type PrescriptionRow,
} from './components/visit-form-utils';
import VisitEdit from './VisitEdit';
import { leftClub, leftClubText } from '../../lib/horse-rules';

const REGIONS = Object.keys(bodyRegionLabel) as BodyRegion[];
const INJURY_TYPES = Object.keys(injuryTypeLabel) as InjuryType[];
const RECOVERY = Object.keys(recoveryLabel) as RecoveryStatus[];

/** Vết chấn thương mới phát hiện ở buổi này. */
interface InjuryRow {
  key: number;
  bodyRegion: BodyRegion | '';
  injuryType: InjuryType | '';
  recoveryStatus: RecoveryStatus;
  notes: string;
  /** Buổi khám ghi lại: giữ tọa độ cũ nếu vẫn cùng vùng (có thể do mobile chấm trên mô hình 3D). */
  kept?: { region: BodyRegion; position: InjuryPosition };
}
/** Mức mới của một vết đang theo dõi. Rỗng là buổi này không khám chỗ đó, giữ nguyên mức cũ. */
interface InjuryUpdate {
  status: RecoveryStatus | '';
  notes: string;
}

interface VisitOptions {
  horseId?: string;
  caseId?: string;
  kind?: 'ROUTINE' | 'REQUEST';
  requestIds?: string[];
  conclusion?: VisitConclusion;
  replaces?: MedicalRecord;
  /** Vết chưa lành của ngựa lúc ghi lại buổi đã hủy: vết còn trong đây thì ghi thành cập nhật, không còn thì ghi như vết mới. */
  replacesTracked?: Set<string>;
  back?: string;
}

/** Đọc tham số URL, tải buổi khám cần ghi lại (nếu có) rồi mới dựng biểu mẫu với giá trị ban đầu. */
export default function VisitNew() {
  const user = useStore((state) => state.currentUser);
  const [params] = useSearchParams();
  const editId = params.get('edit') ?? undefined;
  const replacesId = params.get('replaces') ?? undefined;
  const replaced = useService(async () => {
    if (!replacesId) return undefined;
    const record = await getRecord(replacesId);
    const tracked = await getInjuries(record.horseId, { unhealedOnly: true }).catch(() => []);
    return { record, tracked: new Set(tracked.map((injury) => injury.id)) };
  }, [replacesId]);

  if (!can(user, 'exam.record')) return <NotFound message="Chỉ bác sĩ thú y ghi được buổi khám." />;
  if (editId) return <VisitEdit key={editId} id={editId} back={safeInternalPath(params.get('back'))} />;
  if (replaced.loading) return <Skeleton rows={6} />;
  if (replaced.error) return <ErrorBox message={replaced.error} />;

  const kind = params.get('kind');
  const conclusion = params.get('conclusion');
  const options: VisitOptions = {
    horseId: params.get('horseId') ?? replaced.data?.record.horseId ?? undefined,
    caseId: params.get('caseId') ?? undefined,
    kind: kind === 'ROUTINE' || kind === 'REQUEST' ? kind : undefined,
    requestIds: params.get('requestIds')?.split(',').filter(Boolean),
    conclusion: conclusion === 'ISSUE' || conclusion === 'NORMAL' ? conclusion : undefined,
    replaces: replaced.data?.record,
    replacesTracked: replaced.data?.tracked,
    back: safeInternalPath(params.get('back')),
  };
  return <VisitForm key={params.toString()} {...options} />;
}

function VisitForm(props: VisitOptions) {
  const { horseId: fixedHorseId, caseId: fixedCaseId, replaces, replacesTracked, back } = props;
  const navigate = useNavigate();
  const toast = useToast();
  const action = useAction();
  const formRef = useRef<HTMLDivElement>(null);
  const options = useMedicalHorses('all', !fixedHorseId);
  const [horseId, setHorseId] = useState(fixedHorseId ?? '');

  const context = useService(async () => {
    if (!horseId) return null;
    const [horse, open, requests, records, tracked] = await Promise.all([
      getHorse(horseId),
      listHorseCases(horseId, 'OPEN'),
      listHorseExamRequests(horseId),
      listHorseRecords(horseId).catch(() => [] as MedicalRecord[]),
      getInjuries(horseId, { unhealedOnly: true }).catch(() => []),
    ]);
    return {
      horse,
      openCase: open.items[0] ?? null,
      pending: requests.filter((row) => row.status === 'PENDING'),
      recent: records.filter((record) => !record.voidedAt).slice(0, 3),
      tracked,
    };
  }, [horseId]);

  const [kindChoice, setKindChoice] = useState<'ROUTINE' | 'REQUEST' | null>(props.kind ?? (replaces && replaces.kind !== 'FOLLOW_UP' ? replaces.kind : null));
  const [selected, setSelected] = useState<string[]>(props.requestIds ?? []);
  const [conclusion, setConclusion] = useState<VisitConclusion>(props.conclusion ?? replaces?.conclusion ?? 'NORMAL');
  const [initialDiagnosis, setInitialDiagnosis] = useState('');
  const [metrics, setMetrics] = useState<MetricValues>(emptyMetrics);
  const [diagnosis, setDiagnosis] = useState(replaces?.diagnosis ?? '');
  const [careInstructions, setCareInstructions] = useState(replaces?.careInstructions ?? '');
  const [healthAfter, setHealthAfter] = useState<HealthStatus | ''>('');
  const [healthReason, setHealthReason] = useState('');
  const [nextVisitAt, setNextVisitAt] = useState(() => (replaces?.nextVisitAt && replaces.nextVisitAt.slice(0, 10) >= todayKey() ? toLocalInput(replaces.nextVisitAt) : ''));
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>(() => prescriptionRowsOf(replaces?.prescriptions ?? []));
  const [injuries, setInjuries] = useState<InjuryRow[]>(
    () =>
      replaces?.injuries
        .filter((item) => !replacesTracked?.has(item.injuryId))
        .map((item) => ({
          key: nextRowKey(),
          bodyRegion: item.bodyRegion,
          injuryType: item.injuryType,
          recoveryStatus: item.recoveryStatus,
          notes: item.notes ?? '',
          kept: item.position ? { region: item.bodyRegion, position: item.position } : undefined,
        })) ?? [],
  );
  const [updates, setUpdates] = useState<Record<string, InjuryUpdate>>(() =>
    Object.fromEntries(
      (replaces?.injuries ?? [])
        .filter((item) => replacesTracked?.has(item.injuryId))
        .map((item) => [item.injuryId, { status: item.recoveryStatus, notes: item.notes ?? '' }]),
    ),
  );
  const [cost, setCost] = useState(() => (replaces?.cost ? formatMoneyInput(String(replaces.cost)) : ''));
  const [attempted, setAttempted] = useState(false);
  const [saved, setSaved] = useState<MedicalRecord | null>(null);

  const ctx = context.data;
  const horse = ctx?.horse;
  const people = usePeople(horse?.groom ? [horse.groom] : []);
  const transferred = !!horse && leftClub(horse.lifecycleStatus);
  const caseId = fixedCaseId ?? ctx?.openCase?.id;
  const followUp = !!caseId;
  const openCase = ctx?.openCase;
  const kind = kindChoice ?? (selected.length > 0 ? 'REQUEST' : 'ROUTINE');
  const issue = !followUp && conclusion === 'ISSUE';
  const allowCaseFields = followUp || issue;
  const pendingRows = ctx?.pending ?? [];
  const selectedIds = selected.filter((id) => pendingRows.some((row) => row.id === id));
  const healthChanged = !!horse && !!healthAfter && healthAfter !== horse.healthStatus;
  // Vết đang theo dõi chỉ cập nhật được trong bệnh án (tái khám) hoặc buổi mở bệnh án.
  const tracked = allowCaseFields ? (ctx?.tracked ?? []) : [];
  const chosenUpdates = tracked.filter((injury) => updates[injury.id]?.status);
  const healing = chosenUpdates.filter((injury) => updates[injury.id].status === 'HEALED').length;
  // Buổi khám không mở bệnh án: thuốc phải có ngày kết thúc (không có bệnh án để đóng).
  const standaloneNormal = !followUp && !issue;
  const costValue = parseMoney(cost);
  const costOk = !cost.trim() || (Number.isInteger(costValue) && costValue >= 0 && costValue <= MAX_COST);

  const title = replaces ? 'Ghi lại buổi khám thay thế' : followUp ? 'Ghi buổi tái khám' : issue ? 'Ghi buổi khám và mở bệnh án' : 'Ghi buổi khám';
  useCrumbs(
    horse ? [{ label: horse.name, to: links.horseMedical(horse.id) }, { label: followUp ? 'Tái khám' : 'Ghi buổi khám' }] : [{ label: 'Ghi buổi khám' }],
    [{ label: 'Y tế', to: links.medicalBoard }],
  );

  /* ----- Kiểm tra trước khi gửi, lỗi gắn vào từng ô (backend vẫn kiểm lại) ----- */
  const { parsed, errors: metricErrors, abnormal } = parseMetrics(metrics);

  const errors: Record<string, string> = {};
  if (!horse && !fixedHorseId) errors.horse = 'Chọn ngựa được khám';
  if (!followUp && kind === 'REQUEST' && selectedIds.length === 0) errors.requests = 'Chọn ít nhất một yêu cầu khám được xử lý';
  if (issue && !initialDiagnosis.trim()) errors.initialDiagnosis = 'Nhập chẩn đoán ban đầu';
  if (healthChanged && !healthReason.trim()) errors.healthReason = 'Nhập lý do đổi trạng thái';
  Object.assign(errors, prescriptionErrors(prescriptions, standaloneNormal));
  if (!costOk) errors.cost = 'Chi phí là số nguyên từ 0 đến 10 tỷ đồng';
  if (allowCaseFields) {
    // Hai vết mới cùng vùng, cùng loại vẫn ghi được (vd hai vết rách ở cùng chân).
    injuries.forEach((row) => {
      if (!row.bodyRegion || !row.injuryType) errors[`injury.${row.key}`] = 'Chọn vùng cơ thể và loại chấn thương';
    });
    if (nextVisitAt && nextVisitAt.slice(0, 10) < todayKey()) errors.nextVisitAt = 'Ngày hẹn đã qua';
  }
  const hasErrors = Object.keys(errors).length > 0 || Object.keys(metricErrors).length > 0;
  const show = (key: string) => (attempted ? errors[key] : undefined);

  const buildBase = (confirm: boolean): VisitInputBase => {
    const trim = (value: string) => value.trim() || undefined;
    const base: VisitInputBase = { diagnosis: trim(diagnosis), careInstructions: trim(careInstructions) };
    if (selectedIds.length) base.requestIds = selectedIds;
    if (healthAfter) {
      base.healthStatus = healthAfter;
      if (healthChanged) base.healthReason = healthReason.trim();
    }
    if (parsed.length) {
      base.measurements = parsed;
      if (confirm) base.confirmAbnormal = true;
    }
    if (prescriptions.length) base.prescriptions = prescriptionInputs(prescriptions);
    if (cost.trim()) base.cost = costValue;
    if (allowCaseFields) {
      if (chosenUpdates.length) {
        base.injuryUpdates = chosenUpdates.map((injury) => {
          const update = updates[injury.id];
          return { injuryId: injury.id, recoveryStatus: update.status as RecoveryStatus, ...(update.notes.trim() ? { notes: update.notes.trim() } : {}) };
        });
      }
      if (injuries.length) {
        base.newInjuries = injuries.map((row) => ({
          bodyRegion: row.bodyRegion as BodyRegion,
          position: row.kept && row.kept.region === row.bodyRegion ? row.kept.position : positionOfRegion(row.bodyRegion as BodyRegion),
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


  return (
    <div className="space-y-5" ref={formRef}>
      <PageHeader
        back={<BackLink to={cancelTo}>Quay lại</BackLink>}
        title={title}
        description="Thời điểm khám là lúc lưu. Ghi sai thì bác sĩ ghi phiếu sửa lại buổi khám kèm lý do."
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
            {transferred && horse && <ErrorBox message={leftClubText(horse.lifecycleStatus)} />}

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
                        <span className="block text-sm font-semibold text-gray-900">{value === 'NORMAL' ? 'Kết luận bình thường' : 'Có vấn đề, mở bệnh án'}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {value === 'NORMAL' ? 'Không mở bệnh án.' : 'Mở bệnh án mới từ buổi này.'}
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
                <RequestChooser rows={pendingRows} selected={selectedIds} onChange={setSelected} people={people} error={show('requests')} />
              )}

              {/* Khám */}
              <FormSection icon={<Activity size={16} />} title="Kết quả khám">
                <MetricFields
                  values={metrics}
                  errors={metricErrors}
                  onChange={(type, value) => {
                    setMetrics((current) => ({ ...current, [type]: value }));
                    if (needsConfirm) action.clearError();
                  }}
                />
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

              <PrescriptionSection rows={prescriptions} onChange={setPrescriptions} show={show} />

              {/* Chấn thương + hẹn tái khám: chỉ khi mở bệnh án hoặc tái khám */}
              {allowCaseFields && (
                <FormSection
                  icon={<Bandage size={16} />}
                  title="Chấn thương và hẹn tái khám"
                  aside={
                    injuries.length < 20 && (
                      <Button size="sm" variant="inline" onClick={() => setInjuries([...injuries, { key: nextRowKey(), bodyRegion: '', injuryType: '', recoveryStatus: 'ACUTE', notes: '' }])}>
                        <Plus size={14} /> Thêm chấn thương mới
                      </Button>
                    )
                  }
                >
                  {tracked.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-xs font-medium text-gray-500">Chấn thương đang theo dõi · chọn mức mới cho chỗ đã khám, chỗ không khám thì để Giữ nguyên</p>
                      {tracked.map((injury) => {
                        const update = updates[injury.id] ?? { status: '', notes: '' };
                        const set = (patch: Partial<InjuryUpdate>) => setUpdates({ ...updates, [injury.id]: { ...update, ...patch } });
                        return (
                          <div key={injury.id} className={cn('rounded-xl p-3 ring-1', update.status ? 'bg-emerald-50/40 ring-emerald-200' : 'bg-gray-50/80 ring-transparent')}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <span className="font-semibold text-gray-900">{bodyRegionLabel[injury.bodyRegion]}</span>
                                <span className="text-gray-600">· {injuryTypeLabel[injury.injuryType]}</span>
                                <RecoveryTag status={injury.currentRecoveryStatus} />
                                <span className="text-xs text-gray-500">từ {formatDate(injury.firstExamDate)}</span>
                              </p>
                              <Segmented
                                value={update.status || 'KEEP'}
                                onChange={(value) => set({ status: value === 'KEEP' ? '' : (value as RecoveryStatus) })}
                                className="flex-wrap"
                                options={[{ value: 'KEEP', label: 'Giữ nguyên' }, ...RECOVERY.map((value) => ({ value, label: recoveryLabel[value] }))]}
                              />
                            </div>
                            {update.status && (
                              <Input className="mt-2" placeholder="Ghi chú (vd Bớt sưng)" maxLength={500} value={update.notes} onChange={(event) => set({ notes: event.target.value })} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {injuries.length === 0 ? (
                    tracked.length === 0 && <p className="text-sm text-gray-500">Chưa ghi chấn thương.</p>
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
                    <DateTimePicker value={nextVisitAt} min={`${todayKey()}T00:00`} onChange={setNextVisitAt} invalid={!!show('nextVisitAt')} />
                  </Field>
                </FormSection>
              )}

              <FormSection icon={<Wallet size={16} />} title="Chi phí buổi khám">
                <Field
                  label="Chi phí (đồng)"
                  name="cost"
                  error={show('cost')}
                  hint={cost.trim() && costOk ? `= ${formatMoney(costValue)}` : 'Bỏ trống là 0 đồng. Ghi sai thì điều chỉnh sau ở buổi khám này.'}
                  className="sm:max-w-sm"
                >
                  <Input
                    inputMode="numeric"
                    value={cost}
                    onChange={(event) => setCost(formatMoneyInput(event.target.value))}
                    placeholder="Ví dụ: 1.500.000"
                    className={cn('tabular-nums', show('cost') && invalidClass)}
                  />
                </Field>
              </FormSection>

              <CareNotesSection value={careInstructions} onChange={setCareInstructions} />
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
                {chosenUpdates.length > 0 && <Outcome>Cập nhật {chosenUpdates.length} chấn thương{healing > 0 ? `, ${healing} đã lành` : ''}</Outcome>}
                {allowCaseFields && injuries.length > 0 && <Outcome tone="warning">Ghi {injuries.length} chấn thương mới</Outcome>}
                <Outcome>Chi phí buổi khám {formatMoney(cost.trim() && costOk ? costValue : 0)}</Outcome>
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
                <p className="mt-1.5 text-xs">Số đúng thì bấm Vẫn lưu.</p>
              </Notice>
            )}
            {action.error && !needsConfirm && <ErrorBox message={action.error} />}

            <div className="space-y-2 border-t border-gray-100 pt-4">
              {needsConfirm ? (
                <>
                  <Button className="h-11 w-full" onClick={() => submit(true)} disabled={action.pending}>
                    {action.pending ? 'Đang lưu…' : 'Vẫn lưu'}
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
              {saved.caseId && !followUp ? 'Đã lưu, đã mở bệnh án.' : 'Đã lưu.'} Có cần khóa tập ngựa trong lúc điều trị không?
            </Notice>
          }
        />
      )}
    </div>
  );
}
