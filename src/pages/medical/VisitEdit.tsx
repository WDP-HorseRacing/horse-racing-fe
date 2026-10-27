// F3.6 (sửa) — Trang sửa buổi khám: PATCH /medical-records/:id. Mở từ nút "Sửa buổi khám" trên thẻ buổi khám
// (VisitNew.tsx chuyển sang trang này khi URL có `edit=<id>`).
// Luật BE: chỉ bác sĩ ghi phiếu, buổi chưa hủy, ngựa còn ở câu lạc bộ, bắt buộc lý do, chỉ gửi ô đã đổi.
// Không đổi loại buổi, kết luận, thời điểm khám, chi phí (chi phí dùng Điều chỉnh chi phí).
// Số đo chỉ sửa loại đã đo trong buổi. Chấn thương chỉ sửa vết có trong buổi, vùng và loại chỉ ở vết phát hiện tại buổi này.
// Bệnh án đã đóng: không hẹn tái khám, không thêm yêu cầu khám, không đổi mức hồi phục.
import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Bandage, FolderOpen, HeartPulse, RotateCcw, Stethoscope, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { useFormErrors } from '../../hooks/useFormErrors';
import { useLeaveConfirm } from '../../hooks/useLeaveConfirm';
import { getHorse, listMeasurements } from '../../api/horses';
import { getCase, getInjuries, getRecord, listHorseExamRequests, updateVisit } from '../../api/medical';
import type { BodyRegion, ExamRequest, HealthStatus, HorseDetail, InjuryType, MeasurementType, MedicalCaseDetail, MedicalRecord, RecoveryStatus, TrackedInjury, VisitInjuryEdit, VisitUpdateInput } from '../../api/types';
import { useStore } from '../../store/store';
import { useCrumbs } from '../../components/Breadcrumb';
import { Button, CharCount, ErrorBox, Field, Input, NotFound, Notice, PageHeader, Select, Skeleton, Textarea, cn, invalidClass, useToast } from '../../components/ui';
import { CaseStatusPill } from '../../components/ui/status';
import { healthLabel } from '../../lib/labels';
import { bodyRegionLabel, conclusionLabel, injuryTypeLabel, recoveryLabel, visitKindLabel } from '../../lib/api-labels';
import { positionOfRegion } from '../../lib/injury-position';
import { formatDateTime } from '../../lib/format';
import { links } from '../../lib/links';
import { leftClub, leftClubText } from '../../lib/horse-rules';
import { DateTimePicker } from '../../components/ui/DatePicker';
import { usePeople } from './components/people';
import { HealthPicker } from './components/parts';
import { healthChoices, localToIso, toLocalInput, todayKey } from './components/utils';
import { BackLink, FormSection, HorseCard, Outcome, SaveCard } from './components/form-page';
import { CareNotesSection, MetricFields, PrescriptionSection, RequestChooser } from './components/visit-form';
import {
  METRICS,
  emptyMetrics,
  mapServerFieldErrors,
  parseMetrics,
  prescriptionErrors,
  prescriptionInputs,
  prescriptionRowsOf,
  type MetricValues,
  type PrescriptionRow,
} from './components/visit-form-utils';

const REGIONS = Object.keys(bodyRegionLabel) as BodyRegion[];
const INJURY_TYPES = Object.keys(injuryTypeLabel) as InjuryType[];
const RECOVERY = Object.keys(recoveryLabel) as RecoveryStatus[];

interface EditData {
  record: MedicalRecord;
  horse: HorseDetail;
  medicalCase: MedicalCaseDetail | null;
  tracked: TrackedInjury[];
  /** Yêu cầu khám đang gắn vào buổi này. */
  attached: ExamRequest[];
  pending: ExamRequest[];
  /** Số đo ghi trong buổi khám, theo loại. */
  measured: Partial<Record<MeasurementType, number>>;
}

interface InjuryRow {
  injuryId: string;
  bodyRegion: BodyRegion;
  injuryType: InjuryType;
  recoveryStatus: RecoveryStatus;
  notes: string;
  /** Vết phát hiện tại buổi này: đổi được vùng, loại, gỡ được. */
  firstHere: boolean;
  removed: boolean;
}

export default function VisitEdit({ id, back }: { id: string; back?: string }) {
  const user = useStore((state) => state.currentUser);
  const data = useService(async (): Promise<EditData> => {
    const record = await getRecord(id);
    const examMs = new Date(record.examDate).getTime();
    const [horse, medicalCase, tracked, requests, measurements] = await Promise.all([
      getHorse(record.horseId),
      record.caseId ? getCase(record.caseId) : Promise.resolve(null),
      getInjuries(record.horseId).catch(() => [] as TrackedInjury[]),
      listHorseExamRequests(record.horseId).catch(() => [] as ExamRequest[]),
      // Số đo của buổi khám mang đúng thời điểm khám, nguồn "Buổi khám".
      listMeasurements(record.horseId, { from: new Date(examMs - 1000).toISOString(), to: new Date(examMs + 1000).toISOString(), limit: 50 })
        .then((page) => page.items)
        .catch(() => []),
    ]);
    const measured: Partial<Record<MeasurementType, number>> = {};
    measurements
      .filter((row) => row.source === 'MEDICAL_EXAM' && new Date(row.measuredAt).getTime() === examMs)
      .forEach((row) => {
        measured[row.type] = row.value;
      });
    return {
      record,
      horse,
      medicalCase,
      tracked,
      attached: requests.filter((row) => row.medicalRecordId === record.id),
      pending: requests.filter((row) => row.status === 'PENDING'),
      measured,
    };
  }, [id]);

  if (data.loading && !data.data) return <Skeleton rows={6} />;
  if (data.error || !data.data) return <NotFound message={data.error} />;
  const { record, horse } = data.data;
  const backTo = back ?? (record.caseId ? links.case(record.caseId) : links.horseMedical(record.horseId));
  const blocked =
    record.vetId !== user?.id
      ? 'Chỉ bác sĩ ghi phiếu khám mới sửa được buổi khám này.'
      : record.voidedAt
        ? 'Buổi khám đã hủy, không sửa được.'
        : leftClub(horse.lifecycleStatus)
          ? leftClubText(horse.lifecycleStatus)
          : null;
  if (blocked) {
    return (
      <div className="space-y-5">
        <PageHeader back={<BackLink to={backTo}>Quay lại</BackLink>} title="Sửa buổi khám" />
        <Notice tone="info">{blocked}</Notice>
      </div>
    );
  }
  return <EditForm data={data.data} back={backTo} />;
}

function EditForm({ data, back }: { data: EditData; back: string }) {
  const { record, horse, medicalCase, tracked, attached, pending, measured } = data;
  const navigate = useNavigate();
  const toast = useToast();
  const action = useAction();
  const formRef = useRef<HTMLDivElement>(null);
  const people = usePeople(horse.groom ? [horse.groom] : []);

  const followUp = record.kind === 'FOLLOW_UP';
  // Buổi mở bệnh án: buổi ngoài bệnh án kết luận Có vấn đề (bệnh án mở từ buổi này).
  const opening = !followUp && !!record.caseId;
  const inCase = !!record.caseId;
  const caseClosed = medicalCase?.status === 'CLOSED';
  const measuredTypes = METRICS.filter((type) => measured[type] !== undefined);
  const firstHere = useMemo(() => new Set(tracked.filter((injury) => injury.firstMedicalRecordId === record.id).map((injury) => injury.id)), [tracked, record.id]);

  /* ----- Giá trị ban đầu, dùng để biết ô nào đã đổi ----- */
  const [initial] = useState(() => {
    const metrics = emptyMetrics();
    measuredTypes.forEach((type) => {
      metrics[type] = String(measured[type]);
    });
    return {
      metrics,
      prescriptions: JSON.stringify(prescriptionInputs(prescriptionRowsOf(record.prescriptions))),
      nextVisitAt: record.nextVisitAt ? toLocalInput(record.nextVisitAt) : '',
      requestIds: attached.map((row) => row.id).sort().join(','),
      injuries: record.injuries.map(
        (injury): InjuryRow => ({
          injuryId: injury.injuryId,
          bodyRegion: injury.bodyRegion,
          injuryType: injury.injuryType,
          recoveryStatus: injury.recoveryStatus,
          notes: injury.notes ?? '',
          firstHere: firstHere.has(injury.injuryId),
          removed: false,
        }),
      ),
    };
  });

  const [diagnosis, setDiagnosis] = useState(record.diagnosis ?? '');
  const [careInstructions, setCareInstructions] = useState(record.careInstructions ?? '');
  const [initialDiagnosis, setInitialDiagnosis] = useState(medicalCase?.initialDiagnosis ?? '');
  const [healthAfter, setHealthAfter] = useState<HealthStatus>(record.resultingStatus);
  const [metrics, setMetrics] = useState<MetricValues>(initial.metrics);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>(() => prescriptionRowsOf(record.prescriptions));
  const [nextVisitAt, setNextVisitAt] = useState(initial.nextVisitAt);
  const [selected, setSelected] = useState<string[]>(() => attached.map((row) => row.id));
  const [injuries, setInjuries] = useState<InjuryRow[]>(initial.injuries);
  const [reason, setReason] = useState('');
  // Bấm lưu khi chưa sửa gì: báo "Chưa có thay đổi" thay vì gửi PATCH rỗng.
  const [noChangeTried, setNoChangeTried] = useState(false);
  const [finished, setFinished] = useState(false);

  useCrumbs([{ label: horse.name, to: links.horseMedical(horse.id) }, { label: 'Sửa buổi khám' }], [{ label: 'Y tế', to: links.medicalBoard }]);

  // Bệnh án đã đóng không nhận thêm yêu cầu khám: chỉ còn các yêu cầu đang gắn.
  const requestRows = caseClosed ? attached : [...attached, ...pending.filter((row) => !attached.some((item) => item.id === row.id))];

  /* ----- Những gì đã đổi ----- */
  const diagnosisChanged = diagnosis.trim() !== (record.diagnosis ?? '').trim();
  const careChanged = careInstructions.trim() !== (record.careInstructions ?? '').trim();
  const initialDiagnosisChanged = opening && initialDiagnosis.trim() !== (medicalCase?.initialDiagnosis ?? '').trim();
  const healthChanged = healthAfter !== record.resultingStatus;
  const health = healthChoices(followUp ? 'FOLLOW_UP' : opening ? 'ISSUE' : 'NORMAL', record.resultingStatus);
  const { parsed, errors: metricErrors, abnormal } = parseMetrics(metrics, measuredTypes);
  const changedMetrics = parsed.filter((item) => item.value !== measured[item.type]);
  const rxChanged = JSON.stringify(prescriptionInputs(prescriptions)) !== initial.prescriptions;
  const nextChanged = inCase && nextVisitAt !== initial.nextVisitAt;
  const requestsChanged = [...selected].sort().join(',') !== initial.requestIds;
  const removedIds = injuries.filter((row) => row.removed).map((row) => row.injuryId);
  const injuryEdits: VisitInjuryEdit[] = injuries
    .filter((row) => !row.removed)
    .flatMap((row) => {
      const before = initial.injuries.find((item) => item.injuryId === row.injuryId)!;
      const edit: VisitInjuryEdit = { injuryId: row.injuryId };
      if (row.recoveryStatus !== before.recoveryStatus) edit.recoveryStatus = row.recoveryStatus;
      if (row.notes.trim() !== before.notes.trim()) edit.notes = row.notes.trim() || null;
      if (row.firstHere && row.bodyRegion !== before.bodyRegion) {
        edit.bodyRegion = row.bodyRegion;
        edit.position = positionOfRegion(row.bodyRegion);
      }
      if (row.firstHere && row.injuryType !== before.injuryType) edit.injuryType = row.injuryType;
      return Object.keys(edit).length > 1 ? [edit] : [];
    });
  const changed =
    diagnosisChanged ||
    careChanged ||
    initialDiagnosisChanged ||
    healthChanged ||
    changedMetrics.length > 0 ||
    rxChanged ||
    nextChanged ||
    requestsChanged ||
    injuryEdits.length > 0 ||
    removedIds.length > 0;

  /* ----- Kiểm tra trước khi gửi (BE vẫn kiểm lại) ----- */
  const errors: Record<string, string> = {};
  if (!reason.trim()) errors.reason = 'Nhập lý do sửa';
  if (initialDiagnosisChanged && !initialDiagnosis.trim()) errors.initialDiagnosis = 'Nhập chẩn đoán ban đầu';
  measuredTypes.forEach((type) => {
    const message = metrics[type].trim() ? metricErrors[type] : 'Số đo đã ghi không bỏ trống được, chỉ sửa số';
    if (message) errors[`metric.${type}`] = message;
  });
  Object.assign(errors, prescriptionErrors(prescriptions, !inCase));
  if (!health.allowed.includes(healthAfter)) errors.healthAfter = 'Chọn sức khỏe hợp lệ với kết luận của buổi khám';
  if (record.kind === 'REQUEST' && selected.length === 0) errors.requests = 'Buổi theo yêu cầu phải giữ ít nhất một yêu cầu khám';
  if (nextChanged && nextVisitAt && nextVisitAt.slice(0, 10) < todayKey()) errors.nextVisitAt = 'Ngày hẹn đã qua';
  const f = useFormErrors<string>(errors, { fieldErrors: mapServerFieldErrors(action.fieldErrors, prescriptions), field: action.field, error: action.error });
  const show = f.show;
  const edited = () => {
    if (action.field && action.field !== 'confirmAbnormal') action.clearError();
  };
  const leaveConfirmModal = useLeaveConfirm(!finished && (changed || !!reason.trim()), 'Phần sửa buổi khám chưa được lưu. Rời trang thì mất phần đã sửa.');

  const needsConfirm = action.field === 'confirmAbnormal';

  const submit = (confirm = false) => {
    if (!changed) {
      setNoChangeTried(true);
      return;
    }
    if (!f.attempt(formRef.current ?? document)) return;
    const input: VisitUpdateInput = { reason: reason.trim() };
    if (diagnosisChanged) input.diagnosis = diagnosis.trim() || null;
    if (careChanged) input.careInstructions = careInstructions.trim() || null;
    if (initialDiagnosisChanged) input.initialDiagnosis = initialDiagnosis.trim();
    if (healthChanged) input.healthStatus = healthAfter;
    if (changedMetrics.length) {
      input.measurements = changedMetrics;
      if (confirm) input.confirmAbnormal = true;
    }
    if (rxChanged) input.prescriptions = prescriptionInputs(prescriptions);
    if (nextChanged) input.nextVisitAt = nextVisitAt ? (localToIso(nextVisitAt) ?? null) : null;
    if (requestsChanged) input.requestIds = selected;
    if (injuryEdits.length) input.injuries = injuryEdits;
    if (removedIds.length) input.removedInjuryIds = removedIds;
    action.run(
      () => updateVisit(record.id, input),
      (result) => {
        flushSync(() => setFinished(true));
        if (result.healthOutcome === 'KEPT_LATER_CHANGE' && result.laterHealthChange) {
          const later = result.laterHealthChange;
          toast.push(
            `Đã sửa buổi khám. Sức khỏe hiện tại do ${people.name(later.changedBy)} đổi lúc ${formatDateTime(later.changedAt)}, không đổi theo. Đổi bằng Đổi trạng thái sức khỏe nếu cần`,
            'info',
          );
        } else if (result.healthOutcome === 'UPDATED') {
          toast.push(`Đã sửa buổi khám, sức khỏe ${horse.name} chuyển sang ${healthLabel[healthAfter]}`, 'success');
        } else {
          toast.push(`Đã sửa buổi khám của ${horse.name}`, 'success');
        }
        navigate(back, { replace: true });
      },
    );
  };

  const updateInjury = (injuryId: string, patch: Partial<InjuryRow>) => setInjuries((rows) => rows.map((row) => (row.injuryId === injuryId ? { ...row, ...patch } : row)));
  // Sức khỏe hiện tại khác sức khỏe sau buổi khám: đã có lần đổi sau, BE sẽ không đổi sức khỏe ngựa theo buổi này.
  const laterChangeLikely = horse.healthStatus !== record.resultingStatus;

  return (
    <div className="space-y-5" ref={formRef}>
      <PageHeader
        back={<BackLink to={back}>Quay lại</BackLink>}
        title="Sửa buổi khám"
        description={`${visitKindLabel[record.kind]} lúc ${formatDateTime(record.examDate)}, không sửa được thời điểm, kết luận và chi phí.`}
      />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <FormSection icon={<Stethoscope size={16} />} title="Buổi khám">
            <div className="rounded-xl bg-gray-50 p-4 text-sm">
              <p className="text-gray-700">
                {visitKindLabel[record.kind]}
                {record.conclusion && <> · {opening ? 'Có vấn đề, mở bệnh án' : conclusionLabel[record.conclusion]}</>}
              </p>
              {medicalCase && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <FolderOpen size={13} />
                  <Link to={links.case(medicalCase.id)} className="font-medium text-emerald-700 hover:underline">
                    {medicalCase.initialDiagnosis}
                  </Link>
                  <CaseStatusPill status={medicalCase.status} />
                </p>
              )}
            </div>
            {opening && (
              <Field
                label="Chẩn đoán ban đầu (tên bệnh án)"
                required
                name="initialDiagnosis"
                error={show('initialDiagnosis')}
                onBlur={f.blur('initialDiagnosis')}
                counter={<CharCount value={initialDiagnosis} max={2000} />}
              >
                <Input
                  value={initialDiagnosis}
                  maxLength={2000}
                  onChange={(event) => {
                    setInitialDiagnosis(event.target.value);
                    edited();
                  }}
                  className={cn(show('initialDiagnosis') && invalidClass)}
                />
              </Field>
            )}
          </FormSection>

          {(record.kind === 'REQUEST' || requestRows.length > 0) && (
            <RequestChooser
              rows={requestRows}
              selected={selected}
              onChange={setSelected}
              people={people}
              error={show('requests')}
              emptyText={caseClosed ? 'Bệnh án đã đóng, không thêm yêu cầu khám được.' : 'Ngựa không có yêu cầu khám đang chờ.'}
            />
          )}

          <FormSection icon={<Activity size={16} />} title="Kết quả khám">
            {measuredTypes.length > 0 ? (
              <MetricFields
                types={measuredTypes}
                values={metrics}
                errors={Object.fromEntries(measuredTypes.map((type) => [type, show(`metric.${type}`)]))}
                onBlur={(type) => f.touch(`metric.${type}`)}
                onChange={(type, value) => {
                  setMetrics((current) => ({ ...current, [type]: value }));
                  if (needsConfirm) action.clearError();
                }}
              />
            ) : (
              <p className="text-sm text-gray-500">Buổi khám này không ghi số đo.</p>
            )}
            <Field label="Chẩn đoán và hướng điều trị" counter={<CharCount value={diagnosis} max={4000} />}>
              <Textarea value={diagnosis} maxLength={4000} onChange={(event) => setDiagnosis(event.target.value)} rows={5} className="min-h-32" />
            </Field>
          </FormSection>

          <FormSection icon={<HeartPulse size={16} />} title="Sức khỏe sau khám">
            <div data-field="healthAfter" data-invalid={show('healthAfter') ? 'true' : undefined}>
              <HealthPicker
                value={healthAfter}
                onChange={(value) => {
                  setHealthAfter(value);
                  f.touch('healthAfter');
                }}
                current={record.resultingStatus}
                allowed={health.allowed}
                note={health.note}
                error={show('healthAfter')}
              />
            </div>
            {healthChanged && laterChangeLikely && (
              <Notice tone="info">
                Sức khỏe hiện tại của ngựa là {healthLabel[horse.healthStatus]}, đã đổi sau buổi khám này. Sửa ở đây chỉ đổi kết quả của buổi khám, sức khỏe ngựa giữ nguyên.
              </Notice>
            )}
          </FormSection>

          <PrescriptionSection
            rows={prescriptions}
            onChange={(rows) => {
              setPrescriptions(rows);
              edited();
            }}
            show={show}
            blur={f.blur}
          />

          {(inCase || injuries.length > 0) && (
            <FormSection icon={<Bandage size={16} />} title={inCase ? 'Chấn thương và hẹn tái khám' : 'Chấn thương'}>
              {injuries.length === 0 ? (
                <p className="text-sm text-gray-500">Buổi khám này không ghi chấn thương.</p>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-gray-500">Vùng và loại chỉ đổi được ở vết phát hiện tại buổi này.</p>
                  {injuries.map((row) =>
                    row.removed ? (
                      <div key={row.injuryId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50/60 px-3 py-2.5 text-sm ring-1 ring-red-100">
                        <span className="text-red-800 line-through decoration-red-300">
                          {bodyRegionLabel[row.bodyRegion]} · {injuryTypeLabel[row.injuryType]}
                        </span>
                        <Button size="sm" variant="inline" onClick={() => updateInjury(row.injuryId, { removed: false })}>
                          <RotateCcw size={13} /> Giữ lại vết này
                        </Button>
                      </div>
                    ) : (
                      <div key={row.injuryId} className="rounded-xl bg-gray-50/80 p-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          {row.firstHere ? (
                            <>
                              <Select value={row.bodyRegion} onChange={(event) => updateInjury(row.injuryId, { bodyRegion: event.target.value as BodyRegion })}>
                                {REGIONS.map((value) => (
                                  <option key={value} value={value}>
                                    {bodyRegionLabel[value]}
                                  </option>
                                ))}
                              </Select>
                              <Select value={row.injuryType} onChange={(event) => updateInjury(row.injuryId, { injuryType: event.target.value as InjuryType })}>
                                {INJURY_TYPES.map((value) => (
                                  <option key={value} value={value}>
                                    {injuryTypeLabel[value]}
                                  </option>
                                ))}
                              </Select>
                            </>
                          ) : (
                            <p className="flex items-center text-sm sm:col-span-2">
                              <span className="font-semibold text-gray-900">{bodyRegionLabel[row.bodyRegion]}</span>
                              <span className="ml-1.5 text-gray-600">· {injuryTypeLabel[row.injuryType]}</span>
                            </p>
                          )}
                          <Select value={row.recoveryStatus} disabled={caseClosed} onChange={(event) => updateInjury(row.injuryId, { recoveryStatus: event.target.value as RecoveryStatus })}>
                            {RECOVERY.map((value) => (
                              <option key={value} value={value}>
                                {recoveryLabel[value]}
                              </option>
                            ))}
                          </Select>
                          <div className="flex gap-2 sm:col-span-3">
                            <Input placeholder="Ghi chú" maxLength={500} value={row.notes} onChange={(event) => updateInjury(row.injuryId, { notes: event.target.value })} />
                            {row.firstHere && (
                              <Button size="icon" variant="ghost" title="Gỡ vết này khỏi buổi khám" onClick={() => updateInjury(row.injuryId, { removed: true })}>
                                <Trash2 size={15} />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
              {inCase && (
                <Field
                  label="Hẹn tái khám"
                  name="nextVisitAt"
                  error={show('nextVisitAt')}
                  onBlur={f.blur('nextVisitAt')}
                  hint={caseClosed ? 'Bệnh án đã đóng, không hẹn tái khám.' : 'Bỏ trống là bỏ lịch tái khám của buổi này.'}
                  className="sm:max-w-xs"
                >
                  <DateTimePicker
                    value={nextVisitAt}
                    min={`${todayKey()}T00:00`}
                    onChange={(value) => {
                      setNextVisitAt(value);
                      edited();
                    }}
                    invalid={!!show('nextVisitAt')}
                    disabled={caseClosed}
                  />
                </Field>
              )}
            </FormSection>
          )}

          <CareNotesSection value={careInstructions} onChange={setCareInstructions} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          <HorseCard
            name={horse.name}
            to={links.horseMedical(horse.id)}
            place={[horse.location.barn?.name, horse.location.stall?.code].filter(Boolean).join(' · ')}
            health={horse.healthStatus}
            locked={horse.activeTrainingLock}
          />

          <SaveCard>
            {changed ? (
              <ul className="space-y-1.5">
                {diagnosisChanged && <Outcome>Sửa chẩn đoán và hướng điều trị</Outcome>}
                {initialDiagnosisChanged && <Outcome>Đổi tên bệnh án thành {initialDiagnosis.trim()}</Outcome>}
                {healthChanged && (
                  <Outcome tone="warning">
                    Sức khỏe sau khám {healthLabel[record.resultingStatus]} → {healthLabel[healthAfter]}
                  </Outcome>
                )}
                {changedMetrics.length > 0 && <Outcome>Sửa {changedMetrics.length} số đo</Outcome>}
                {rxChanged && <Outcome>Thay đơn thuốc ({prescriptions.length} thuốc)</Outcome>}
                {injuryEdits.length > 0 && <Outcome>Sửa {injuryEdits.length} chấn thương</Outcome>}
                {removedIds.length > 0 && <Outcome tone="warning">Gỡ {removedIds.length} chấn thương</Outcome>}
                {nextChanged && <Outcome>{nextVisitAt ? `Hẹn tái khám ${formatDateTime(localToIso(nextVisitAt) ?? nextVisitAt)}` : 'Bỏ lịch tái khám'}</Outcome>}
                {requestsChanged && <Outcome>Đổi yêu cầu khám được xử lý ({selected.length} yêu cầu)</Outcome>}
                {careChanged && <Outcome>Sửa ghi chú chăm sóc cho Groom</Outcome>}
              </ul>
            ) : (
              <p role={noChangeTried ? 'alert' : undefined} className={cn('text-sm', noChangeTried ? 'font-medium text-red-600' : 'text-gray-500')}>
                {noChangeTried ? 'Chưa có thay đổi. Sửa ít nhất một ô rồi lưu.' : 'Chưa đổi gì. Sửa các ô bên trái rồi ghi lý do.'}
              </p>
            )}

            <Field label="Lý do sửa" required name="reason" error={show('reason')} onBlur={f.blur('reason')} counter={<CharCount value={reason} max={500} />}>
              <Textarea
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  edited();
                }}
                placeholder="Ví dụ: Ghi nhầm liều thuốc"
                className={cn(show('reason') && invalidClass)}
              />
            </Field>

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
                  <Button className="h-11 w-full" onClick={() => submit(false)} disabled={action.pending}>
                    {action.pending ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => navigate(back)} disabled={action.pending}>
                    Hủy
                  </Button>
                </>
              )}
            </div>
          </SaveCard>
        </aside>
      </div>
      {leaveConfirmModal}
    </div>
  );
}
