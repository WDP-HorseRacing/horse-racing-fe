// Biểu mẫu ghi buổi khám dùng chung (F3.3 định kỳ, F3.5 mở bệnh án, F3.6 khám trong bệnh án).
// Panel trượt phải. Không có trường chi phí — chi phí nhập một lần khi đóng bệnh án.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ClipboardList, FolderOpen, FolderPlus, HeartPulse, Lock, Stethoscope } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  createExamination,
  listMedicalHorseOptions,
  listPendingRequestsForHorse,
  type CaseTarget,
} from '../../../services/medical.service';
import {
  Button,
  ErrorBox,
  Field,
  Input,
  Notice,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  Textarea,
  cn,
  useToast,
} from '../../../components/ui';
import { HealthPill, LockPill, UrgencyPill } from '../../../components/ui/status';
import { checkMeasurement } from '../../../lib/rules';
import { healthLabel, measurementLabel } from '../../../lib/labels';
import { addDays, formatDateTime, toDateKey } from '../../../lib/format';
import { links } from '../../../lib/links';
import { now } from '../../../lib/clock';
import type { ExaminationKind, HealthStatus, MeasurementType } from '../../../types/domain';
import { HealthPicker, HorseChip, RequestLines } from './parts';
import { toLocalInput } from './utils';

const METRICS: MeasurementType[] = ['WEIGHT', 'TEMPERATURE', 'HEIGHT', 'BODY_CONDITION'];

const RENDERED_FIELDS = new Set([
  'horseId',
  'caseTitle',
  'linkedRequestIds',
  'examinedAt',
  'diagnosisAndTreatment',
  'healthStatusAfter',
  'nextAppointment',
  'lockReason',
  'lockExpectedLiftDate',
  'confirmAbnormal',
  ...METRICS.map((type) => `metric.${type}`),
]);

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 transition',
        checked ? 'bg-white ring-gray-400' : 'bg-white ring-gray-200 hover:ring-gray-300',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition',
          checked ? 'bg-emerald-700' : 'bg-gray-200',
        )}
      >
        <span className={cn('h-4 w-4 rounded-full bg-white shadow transition', checked && 'translate-x-4')} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-800">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
      </span>
    </button>
  );
}

function Step({ icon, title, children, aside }: { icon: ReactNode; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span className="text-gray-400">{icon}</span>
          {title}
        </h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

export interface ExaminationSheetProps {
  onClose: () => void;
  onDone: (result: { examinationId: string; caseId?: string }) => void;
  /** Cố định ngựa (mở từ hồ sơ, từ yêu cầu khám, từ bệnh án). */
  horseId?: string;
  kind?: ExaminationKind;
  /** Cố định bệnh án đang mở để thêm buổi khám. */
  caseId?: string;
  /** Mở sẵn lựa chọn "Mở bệnh án mới". */
  newCase?: boolean;
}

export default function ExaminationSheet({ onClose, onDone, horseId: fixedHorseId, kind: initialKind, caseId: fixedCaseId, newCase }: ExaminationSheetProps) {
  const toast = useToast();
  const action = useAction();
  const options = useService(() => listMedicalHorseOptions(), []);

  const [horseId, setHorseId] = useState(fixedHorseId ?? '');
  // Không chỉ định loại: ngựa có bệnh án mở thì mặc định thêm vào bệnh án đó, chưa có thì Định kỳ.
  const [kindChoice, setKind] = useState<ExaminationKind | null>(fixedCaseId ? 'CASE' : (initialKind ?? null));
  const [foundIssue, setFoundIssue] = useState(false);
  const [caseMode, setCaseMode] = useState<'EXISTING' | 'NEW' | null>(newCase ? 'NEW' : null);
  const [caseTitle, setCaseTitle] = useState('');
  const [examinedAt, setExaminedAt] = useState(() => toLocalInput(now()));
  const [metrics, setMetrics] = useState<Record<MeasurementType, string>>({ WEIGHT: '', HEIGHT: '', BODY_CONDITION: '', TEMPERATURE: '' });
  const [confirmAbnormal, setConfirmAbnormal] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [healthAfter, setHealthAfter] = useState<HealthStatus | ''>('');
  const [healthReason, setHealthReason] = useState('');
  const [nextAppointment, setNextAppointment] = useState('');
  const [selected, setSelected] = useState<string[] | null>(null);
  const [lockOn, setLockOn] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [lockDate, setLockDate] = useState('');

  const pending = useService(
    () => (horseId ? listPendingRequestsForHorse(horseId) : Promise.resolve([])),
    [horseId],
  );

  const horse = options.data?.find((item) => item.id === horseId);
  const openCase = horse?.openCase;
  const kind: ExaminationKind = kindChoice ?? (openCase ? 'CASE' : 'PERIODIC');
  const pendingRows = pending.data ?? [];
  const selectedIds = selected ?? pendingRows.map((row) => row.id);
  const caseModeEffective: 'EXISTING' | 'NEW' = fixedCaseId ? 'EXISTING' : (caseMode ?? (openCase ? 'EXISTING' : 'NEW'));

  const target: CaseTarget =
    kind === 'PERIODIC'
      ? foundIssue
        ? 'NEW'
        : 'NONE'
      : fixedCaseId
        ? { caseId: fixedCaseId }
        : caseModeEffective === 'EXISTING' && openCase
          ? { caseId: openCase.id }
          : 'NEW';
  const blockedByOpenCase = target === 'NEW' && !!openCase;
  const targetCaseTitle = typeof target === 'object' ? (openCase?.id === target.caseId ? openCase.title : undefined) : undefined;

  const parsedMetrics: Partial<Record<MeasurementType, number>> = {};
  const metricChecks = METRICS.map((type) => {
    const raw = metrics[type].trim().replace(',', '.');
    if (!raw) return { type, check: undefined };
    const value = Number(raw);
    parsedMetrics[type] = value;
    return { type, check: checkMeasurement(type, value) };
  });
  const anyAbnormal = metricChecks.some((item) => item.check?.valid && item.check.abnormal);

  const healthChanged = !!horse && !!healthAfter && healthAfter !== horse.healthStatus;
  const fieldError = (field: string) => (action.field === field ? action.error : undefined);

  const current = now();
  const minInput = toLocalInput(addDays(current, -7));
  const maxInput = toLocalInput(current);

  const submit = () => {
    if (!horse) return;
    action.run(
      () =>
        createExamination({
          horseId,
          kind,
          caseTarget: target,
          caseTitle: target === 'NEW' ? caseTitle : undefined,
          examinedAt: examinedAt ? new Date(examinedAt).toISOString() : '',
          diagnosisAndTreatment: diagnosis,
          healthStatusAfter: healthAfter as HealthStatus,
          healthReason: healthChanged ? healthReason : undefined,
          nextAppointment: nextAppointment || undefined,
          linkedRequestIds: selectedIds,
          metrics: parsedMetrics,
          confirmAbnormal,
          placeLock: lockOn ? { reason: lockReason, expectedLiftDate: lockDate || undefined } : undefined,
        }),
      (result) => {
        toast.push(
          result.caseId && target === 'NEW'
            ? `Đã ghi buổi khám và mở bệnh án cho ${horse.name}`
            : `Đã ghi buổi khám cho ${horse.name}`,
          'success',
        );
        onDone(result);
      },
    );
  };

  const title = fixedCaseId
    ? 'Thêm buổi khám vào bệnh án'
    : kind === 'CASE' && caseModeEffective === 'NEW'
      ? 'Mở bệnh án'
      : 'Ghi buổi khám';

  return (
    <Sheet
      open
      onClose={onClose}
      width="max-w-2xl"
      title={title}
      description="Buổi khám đã lưu không sửa, không xóa — ghi sai thì thêm ghi chú đính chính hoặc buổi khám mới."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || !horse || blockedByOpenCase}>
            {action.pending ? 'Đang lưu…' : target === 'NEW' ? 'Lưu và mở bệnh án' : 'Lưu buổi khám'}
          </Button>
        </>
      }
    >
      {options.loading ? (
        <Skeleton rows={5} />
      ) : (
        <div className="space-y-7">
          {/* Ngựa */}
          <Step icon={<Stethoscope size={14} />} title="Ngựa được khám">
            {fixedHorseId ? (
              horse ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-gray-200">
                  <HorseChip horse={horse} plain />
                  <div className="flex flex-wrap items-center gap-2">
                    <HealthPill status={horse.healthStatus} />
                    {horse.activeLock && <LockPill />}
                  </div>
                </div>
              ) : (
                <ErrorBox message="Ngựa này không còn ở câu lạc bộ hoặc ngoài phạm vi — không ghi được buổi khám." />
              )
            ) : (
              <Field error={fieldError('horseId')}>
                <Select
                  value={horseId}
                  onChange={(event) => {
                    setHorseId(event.target.value);
                    setSelected(null);
                    setKind(initialKind ?? null);
                    setCaseMode(newCase ? 'NEW' : null);
                  }}
                >
                  <option value="">Chọn ngựa…</option>
                  {options.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {healthLabel[item.healthStatus]}
                      {item.openCase ? ' · có bệnh án mở' : ''}
                      {item.pendingRequestCount ? ` · ${item.pendingRequestCount} yêu cầu chờ` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {horse && !fixedHorseId && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                Hiện tại: <HealthPill status={horse.healthStatus} />
                {horse.activeLock && <LockPill reason={horse.activeLock.reason} />}
              </div>
            )}
          </Step>

          {/* Loại buổi khám */}
          {horse && (
            <Step icon={<FolderOpen size={14} />} title="Loại buổi khám">
              {fixedCaseId ? (
                <div className="rounded-xl bg-white p-3 text-sm ring-1 ring-gray-200">
                  <p className="text-xs text-gray-500">Thêm vào bệnh án đang mở</p>
                  <p className="font-semibold text-gray-900">{openCase?.title ?? 'Bệnh án'}</p>
                </div>
              ) : (
                <>
                  <Segmented
                    value={kind}
                    onChange={(value) => setKind(value)}
                    options={[
                      { value: 'PERIODIC', label: 'Định kỳ' },
                      { value: 'CASE', label: 'Trong bệnh án' },
                    ]}
                  />
                  {kind === 'PERIODIC' ? (
                    <div className="space-y-3">
                      <Switch
                        checked={foundIssue}
                        onChange={setFoundIssue}
                        label="Phát hiện vấn đề — mở bệnh án tại buổi này"
                        hint="Buổi định kỳ kết luận bình thường là bản ghi độc lập. Phát hiện vấn đề thì buổi này là buổi đầu tiên của bệnh án mới."
                      />
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={!openCase}
                        onClick={() => setCaseMode('EXISTING')}
                        className={cn(
                          'rounded-xl p-3 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-50',
                          caseModeEffective === 'EXISTING' && openCase
                            ? 'bg-white ring-2 ring-gray-900'
                            : 'bg-white ring-gray-200 hover:ring-gray-300',
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                          <FolderOpen size={14} className="text-gray-400" /> Bệnh án đang mở
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-500">
                          {openCase ? openCase.title : 'Ngựa chưa có bệnh án mở'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCaseMode('NEW')}
                        className={cn(
                          'rounded-xl p-3 text-left ring-1 transition',
                          caseModeEffective === 'NEW'
                            ? 'bg-white ring-2 ring-gray-900'
                            : 'bg-white ring-gray-200 hover:ring-gray-300',
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                          <FolderPlus size={14} className="text-gray-400" /> Mở bệnh án mới
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">Buổi này là buổi khám đầu tiên</span>
                      </button>
                    </div>
                  )}
                  {blockedByOpenCase && openCase && (
                    <Notice tone="danger" icon={<AlertTriangle size={16} />}>
                      Ngựa đang có bệnh án mở "{openCase.title}" — mỗi ngựa tối đa một bệnh án mở. Hãy thêm buổi khám vào bệnh án đó.{' '}
                      <Link to={links.case(openCase.id)} className="font-semibold underline" onClick={onClose}>
                        Mở bệnh án
                      </Link>
                    </Notice>
                  )}
                  {target === 'NEW' && !blockedByOpenCase && (
                    <Field label="Tiêu đề bệnh án" required error={fieldError('caseTitle')}>
                      <Input
                        value={caseTitle}
                        onChange={(event) => setCaseTitle(event.target.value)}
                        placeholder="Ví dụ: Viêm gân gấp chân trước trái"
                      />
                    </Field>
                  )}
                  {targetCaseTitle && kind === 'CASE' && (
                    <p className="text-xs text-gray-500">
                      Buổi khám sẽ thêm vào bệnh án <span className="font-medium text-gray-700">"{targetCaseTitle}"</span>.
                    </p>
                  )}
                </>
              )}
            </Step>
          )}

          {/* Yêu cầu khám */}
          {horse && (
            <Step
              icon={<ClipboardList size={14} />}
              title="Yêu cầu khám được xử lý"
              aside={
                pendingRows.length > 0 && (
                  <span className="text-xs text-gray-500">
                    Đã chọn {selectedIds.length}/{pendingRows.length}
                  </span>
                )
              }
            >
              {pending.loading ? (
                <Skeleton rows={1} />
              ) : pendingRows.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                  Ngựa không có yêu cầu khám đang chờ.
                  {target === 'NEW' && ' Mở bệnh án mới sẽ tự tạo một yêu cầu "Bác sĩ tự tạo" với mô tả là tiêu đề bệnh án.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingRows.map((row) => {
                    const checked = selectedIds.includes(row.id);
                    return (
                      <label
                        key={row.id}
                        className={cn(
                          'flex cursor-pointer gap-3 rounded-xl p-3 ring-1 transition',
                          checked ? 'bg-white ring-gray-400' : 'bg-white ring-gray-200',
                          row.urgency === 'URGENT' && 'shadow-[inset_3px_0_0_0_#ef4444]',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? [...selectedIds, row.id]
                                : selectedIds.filter((id) => id !== row.id),
                            )
                          }
                          className="mt-1 h-4 w-4 accent-emerald-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            {row.urgency === 'URGENT' && <UrgencyPill urgency={row.urgency} />}
                            {row.sourceLabel} · {row.createdByName} · {formatDateTime(row.createdAt)}
                          </span>
                          <span className="mt-1 block">
                            <RequestLines lines={row.descriptionLines} />
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  <p className="text-xs text-gray-500">
                    Các yêu cầu được tích sẽ chuyển sang "Đã khám" và gắn với buổi khám này.
                  </p>
                </div>
              )}
              {fieldError('linkedRequestIds') && <ErrorBox message={fieldError('linkedRequestIds')!} />}
            </Step>
          )}

          {horse && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ngày giờ khám" required error={fieldError('examinedAt')} hint="Không ở tương lai, lùi tối đa 7 ngày">
                  <Input
                    type="datetime-local"
                    value={examinedAt}
                    min={minInput}
                    max={maxInput}
                    onChange={(event) => setExaminedAt(event.target.value)}
                  />
                </Field>
                <Field label="Hẹn khám tiếp" error={fieldError('nextAppointment')} hint="Không bắt buộc">
                  <Input
                    type="date"
                    value={nextAppointment}
                    min={examinedAt ? examinedAt.slice(0, 10) : toDateKey(current)}
                    onChange={(event) => setNextAppointment(event.target.value)}
                  />
                </Field>
              </div>

              {/* Chỉ số */}
              <Step icon={<Activity size={14} />} title="Chỉ số đo được" aside={<span className="text-xs text-gray-500">Không bắt buộc</span>}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {metricChecks.map(({ type, check }) => {
                    const meta = measurementLabel[type];
                    const error = fieldError(`metric.${type}`) ?? (check && !check.valid ? check.reason : undefined);
                    return (
                      <Field
                        key={type}
                        label={`${meta.name} (${meta.unit})`}
                        error={error}
                        hint={
                          check?.valid && check.abnormal ? undefined : `Bình thường ${meta.min}–${meta.max} ${meta.unit}`
                        }
                      >
                        <Input
                          inputMode="decimal"
                          value={metrics[type]}
                          onChange={(event) => setMetrics({ ...metrics, [type]: event.target.value })}
                          placeholder={`${meta.min}–${meta.max}`}
                          className={cn(check?.valid && check.abnormal && 'border-amber-400')}
                        />
                        {check?.valid && check.abnormal && (
                          <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                            <AlertTriangle size={12} /> {check.reason}
                          </span>
                        )}
                      </Field>
                    );
                  })}
                </div>
                {anyAbnormal && (
                  <Notice tone={fieldError('confirmAbnormal') ? 'danger' : 'warning'}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={confirmAbnormal}
                      onChange={(event) => setConfirmAbnormal(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-amber-600"
                    />
                    <span>
                      Tôi xác nhận giá trị ngoài khoảng bình thường là đúng. Bản ghi được lưu vào bảng chỉ số cơ thể và đánh dấu bất thường.
                      {fieldError('confirmAbnormal') && (
                        <span className="mt-1 block text-xs font-medium text-red-600">{fieldError('confirmAbnormal')}</span>
                      )}
                    </span>
                  </label>
                  </Notice>
                )}
                <p className="text-xs text-gray-500">
                  Chỉ số ghi vào bảng chỉ số cơ thể của ngựa kèm nguồn "từ buổi khám này" và không xóa được ở hồ sơ.
                </p>
              </Step>

              <Field
                label="Chẩn đoán và hướng điều trị"
                required
                error={fieldError('diagnosisAndTreatment')}
                hint="Thuốc (nếu cần) ghi thẳng tại đây — hệ thống không có đơn thuốc chi tiết."
              >
                <Textarea
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  rows={6}
                  className="min-h-36"
                  placeholder="Triệu chứng, kết quả khám, chẩn đoán, hướng điều trị, dặn dò chăm sóc…"
                />
              </Field>

              {/* Sức khỏe sau khám */}
              <Step icon={<HeartPulse size={14} />} title="Trạng thái sức khỏe sau khám">
                <HealthPicker
                  value={healthAfter}
                  onChange={setHealthAfter}
                  current={horse.healthStatus}
                  error={fieldError('healthStatusAfter')}
                />
                {healthChanged && (
                  <Field
                    label={`Lý do đổi ${healthLabel[horse.healthStatus]} → ${healthLabel[healthAfter as HealthStatus]}`}
                    hint="Để trống thì dùng câu đầu của phần chẩn đoán"
                  >
                    <Input value={healthReason} onChange={(event) => setHealthReason(event.target.value)} />
                  </Field>
                )}
                {healthAfter === 'ELIGIBLE' && horse.activeLock && (
                  <Notice tone="warning" icon={<Lock size={15} />}>
                    Ngựa còn khóa huấn luyện "{horse.activeLock.reason}". Đổi sang Đủ điều kiện không tự gỡ khóa — gỡ khóa riêng nếu cần.
                  </Notice>
                )}
                {healthChanged && (healthAfter === 'INJURED' || healthAfter === 'QUARANTINED') && (
                  <Notice tone="info">
                    Ngựa mất quyền tập và đua; HT khu và quản lý nhận thông báo. Ngựa không bị rút khỏi lớp — sẽ được đánh dấu vắng khi buổi học bắt đầu.
                    {healthAfter === 'QUARANTINED' && ' HT được gợi ý chuyển ngựa sang ô trống để tách đàn.'}
                  </Notice>
                )}
              </Step>

              {/* Khóa huấn luyện */}
              {horse.activeLock ? (
                <p className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
                  <Lock size={13} /> Ngựa đã có khóa huấn luyện hiệu lực — mỗi ngựa tối đa một khóa.
                </p>
              ) : (
                <div className="space-y-3">
                  <Switch
                    checked={lockOn}
                    onChange={setLockOn}
                    label="Đặt khóa huấn luyện"
                    hint={
                      target === 'NONE'
                        ? 'Khóa độc lập với trạng thái sức khỏe; không tự gỡ khi tới ngày dự kiến.'
                        : 'Khóa gắn với bệnh án này; không tự gỡ khi tới ngày dự kiến.'
                    }
                  />
                  {lockOn && (
                    <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                      <Field label="Lý do khóa" required error={fieldError('lockReason')}>
                        <Input value={lockReason} onChange={(event) => setLockReason(event.target.value)} placeholder="Ví dụ: Cấm vận động mạnh" />
                      </Field>
                      <Field label="Dự kiến gỡ" error={fieldError('lockExpectedLiftDate')}>
                        <Input type="date" value={lockDate} min={toDateKey(current)} onChange={(event) => setLockDate(event.target.value)} />
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {action.error && (!action.field || !RENDERED_FIELDS.has(action.field)) && (
            <ErrorBox message={action.error} />
          )}
        </div>
      )}
    </Sheet>
  );
}
