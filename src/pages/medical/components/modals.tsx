// Các hộp thoại ngắn của Flow 3: gửi / đổi mức / bỏ qua yêu cầu khám, đổi sức khỏe,
// đặt / gỡ khóa huấn luyện, hủy buổi khám, điều chỉnh chi phí, hẹn khám định kỳ. Đóng bệnh án là trang riêng (CaseClose).
// Lỗi từng ô hiện khi rời ô hoặc bấm gửi; lỗi backend gắn ô thì hiện dưới ô, còn lại hiện nguyên văn ở cuối hộp.
import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Lock, RotateCcw, Unlock } from 'lucide-react';
import { useAction } from '../../../hooks/useService';
import { useFormErrors } from '../../../hooks/useFormErrors';
import {
  adjustVisitCost,
  changeHealthStatus,
  changeRequestUrgency,
  createExamRequest,
  dismissExamRequest,
  placeLock,
  releaseLock,
  setCheckupAppointment,
  voidRecord,
} from '../../../api/medical';
import type { CheckupItem, ExamRequest, HealthStatus, MedicalCase, MedicalRecord, TrainingLock, VoidVisitResult } from '../../../api/types';
import { Button, CancelButton, CharCount, Dot, ErrorBox, Field, Input, Modal, Notice, Select, Skeleton, Textarea, cn, invalidClass, useToast } from '../../../components/ui';
import { HealthPill, UrgentPill } from '../../../components/ui/status';
import { healthLabel } from '../../../lib/labels';
import { visitKindLabel } from '../../../lib/api-labels';
import { formatDate, formatDateTime, formatMoney } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { horsePlace, useMedicalHorses, useRequestScope } from './horses';
import type { People } from './people';
import { HealthPicker, RequestMeta, RequestText } from './parts';
import { MAX_COST, dateToIso, formatMoneyInput, localToIso, parseMoney, toLocalInput, todayKey } from './utils';
import { DatePicker, DateTimePicker } from '../../../components/ui/DatePicker';

/** Ô lý do bắt buộc dạng nhiều dòng, có bộ đếm ký tự. */
function ReasonField({
  label = 'Lý do',
  value,
  onChange,
  error,
  onBlur,
  max = 500,
  rows = 3,
  placeholder,
  hint,
  autoFocus,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onBlur?: () => void;
  max?: number;
  rows?: number;
  placeholder?: string;
  hint?: ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <Field label={label} required name="reason" error={error} onBlur={onBlur} hint={hint} counter={<CharCount value={value} max={max} />}>
      <Textarea
        rows={rows}
        maxLength={max}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(error && invalidClass)}
      />
    </Field>
  );
}

/** Lỗi backend không thuộc ô nào đang hiện thì báo ở cuối hộp. */
function GeneralError({ action, fields }: { action: ReturnType<typeof useAction>; fields: string[] }) {
  if (!action.error) return null;
  if (fields.some((field) => action.fieldErrors[field] || action.field === field)) return null;
  return <ErrorBox message={action.error} />;
}

/** Lỗi backend của ô `from` đổi tên thành ô `to` của form. */
function renameServerField(fieldErrors: Record<string, string>, from: string, to: string) {
  return fieldErrors[from] ? { ...fieldErrors, [to]: fieldErrors[from] } : fieldErrors;
}

/* ===== Gửi yêu cầu khám (F3.4) ===== */

export function RequestForm({
  horse,
  onDone,
  onCancel,
  onDirtyChange,
}: {
  horse?: { id: string; name: string };
  onDone?: (request: ExamRequest) => void;
  onCancel?: () => void;
  /** Báo cho hộp chứa biết đã nhập dở, để hỏi trước khi đóng. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const toast = useToast();
  const action = useAction();
  const scope = useRequestScope();
  const options = useMedicalHorses(scope, !horse);
  const [horseId, setHorseId] = useState(horse?.id ?? '');
  const [urgent, setUrgent] = useState(false);
  const [description, setDescription] = useState('');
  const picked = horse ?? (horseId ? options.byId.get(horseId) : undefined);
  const text = description.trim();
  const dirty = text !== '' || urgent || (!horse && horseId !== '');
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const f = useFormErrors(
    {
      horse: horseId ? undefined : 'Chọn ngựa',
      description: text ? undefined : 'Mô tả tình trạng của ngựa',
    },
    { fieldErrors: action.fieldErrors },
  );

  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => createExamRequest(horseId, text, urgent),
      (result) => {
        toast.push(`Đã gửi yêu cầu khám cho ${picked?.name ?? result.horseName}`, 'success');
        setDescription('');
        setUrgent(false);
        if (!horse) setHorseId('');
        f.reset();
        onDone?.(result);
      },
    );
  };

  if (!horse && options.loading && !options.data) return <Skeleton rows={3} />;
  if (!horse && options.error) return <ErrorBox message={options.error} />;
  if (!horse && options.data?.length === 0) {
    return (
      <Notice tone="info">
        {scope === 'myHorses'
          ? 'Bạn chưa được phân công chăm sóc ngựa nào, nên chưa gửi được yêu cầu khám.'
          : scope === 'myBarns'
            ? 'Khu bạn phụ trách chưa có ngựa nào.'
            : 'Không có ngựa nào đang ở câu lạc bộ.'}
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      {!horse && (
        <Field
          label="Ngựa"
          required
          name="horse"
          error={f.show('horse')}
          onBlur={f.blur('horse')}
          hint={scope === 'myBarns' ? 'Ngựa thuộc khu bạn phụ trách' : scope === 'myHorses' ? 'Ngựa bạn đang được phân công chăm sóc' : undefined}
        >
          <Select value={horseId} onChange={(event) => setHorseId(event.target.value)} className={cn(f.show('horse') && invalidClass)}>
            <option value="">Chọn ngựa…</option>
            {options.data?.map((item) => {
              const place = horsePlace(item);
              return (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {place ? ` · ${place}` : ''}
                  {item.healthStatus !== 'ELIGIBLE' ? ` · ${healthLabel[item.healthStatus]}` : ''}
                </option>
              );
            })}
          </Select>
        </Field>
      )}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-gray-600">Mức độ</span>
        <div className="grid grid-cols-2 gap-2">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setUrgent(value)}
              aria-pressed={urgent === value}
              className={cn(
                'flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 transition',
                urgent === value ? 'ring-2 ring-gray-900' : 'ring-1 ring-gray-200 hover:ring-gray-300',
              )}
            >
              <Dot tone={urgent === value && value ? 'danger' : 'neutral'} />
              {value ? 'Khẩn' : 'Bình thường'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {urgent ? 'Mọi bác sĩ nhận thông báo Khẩn ngay khi gửi.' : 'Yêu cầu vào hàng đợi, bác sĩ xử lý theo thứ tự.'}
        </p>
      </div>
      <Field
        label="Mô tả tình trạng"
        required
        name="description"
        error={f.show('description')}
        onBlur={f.blur('description')}
        counter={<CharCount value={description} max={2000} />}
      >
        <Textarea
          rows={4}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ví dụ: Ngựa đi hơi khập khiễng chân trước trái sau buổi tập, cổ chân hơi nóng"
          className={cn(f.show('description') && invalidClass)}
        />
      </Field>
      <GeneralError action={action} fields={['description']} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={action.pending}>
            Hủy
          </Button>
        )}
        <Button variant={urgent ? 'danger' : 'primary'} onClick={submit} disabled={action.pending}>
          {action.pending ? 'Đang gửi…' : 'Gửi yêu cầu'}
        </Button>
      </div>
    </div>
  );
}

export function CreateRequestModal({
  open,
  onClose,
  horse,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  horse?: { id: string; name: string };
  onDone?: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  if (!open) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={horse ? `Gửi yêu cầu khám: ${horse.name}` : 'Gửi yêu cầu khám'}
      description="Cần bác sĩ tới ngay thì chọn Khẩn."
      dirty={dirty}
    >
      <RequestForm
        horse={horse}
        onCancel={onClose}
        onDirtyChange={setDirty}
        onDone={() => {
          onDone?.();
          onClose();
        }}
      />
    </Modal>
  );
}

/* ===== Đổi mức khẩn (F3.4, VET) ===== */

export function UrgencyModal({ request, onClose, onDone }: { request: ExamRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const next = !request.urgent;
  const f = useFormErrors({ reason: reason.trim() ? undefined : 'Nhập lý do' }, { fieldErrors: action.fieldErrors });
  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => changeRequestUrgency(request.id, next, reason.trim()),
      () => {
        toast.push(`${request.horseName}: đã chuyển yêu cầu sang ${next ? 'Khẩn' : 'Bình thường'}`, 'success');
        onDone();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={next ? 'Nâng lên Khẩn' : 'Hạ xuống Bình thường'}
      dirty={reason.trim() !== ''}
      busy={action.pending}
      description={`Yêu cầu khám của ${request.horseName}`}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button variant={next ? 'danger' : 'primary'} onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : next ? 'Nâng lên Khẩn' : 'Hạ mức'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3">
          <RequestText text={request.description} />
        </div>
        <ReasonField
          value={reason}
          onChange={setReason}
          rows={2}
          error={f.show('reason')}
          onBlur={f.blur('reason')}
          hint={next ? 'Mọi bác sĩ nhận thông báo Khẩn.' : 'Hạ mức không gửi thông báo.'}
        />
        <GeneralError action={action} fields={['reason']} />
      </div>
    </Modal>
  );
}

/* ===== Bỏ qua yêu cầu khám (F3.4, VET) ===== */

export function DismissRequestModal({ request, onClose, onDone }: { request: ExamRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const f = useFormErrors({ reason: reason.trim() ? undefined : 'Nhập lý do bỏ qua' }, { fieldErrors: action.fieldErrors });
  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => dismissExamRequest(request.id, reason.trim()),
      () => {
        toast.push(`Đã bỏ qua yêu cầu khám của ${request.horseName}`, 'success');
        onDone();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Bỏ qua yêu cầu khám: ${request.horseName}`}
      dirty={reason.trim() !== ''}
      busy={action.pending}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button variant="danger" onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Bỏ qua yêu cầu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3">
          <RequestText text={request.description} />
        </div>
        <ReasonField
          label="Lý do bỏ qua"
          value={reason}
          onChange={setReason}
          error={f.show('reason')}
          onBlur={f.blur('reason')}
          hint="Yêu cầu chuyển sang Đã bỏ qua, không mở lại được."
          placeholder="Ví dụ: Đã kiểm tra tại chuồng, chỉ là vết xước bề mặt"
        />
        <GeneralError action={action} fields={['reason']} />
      </div>
    </Modal>
  );
}

/* ===== Đổi trạng thái sức khỏe trực tiếp (F3.7, VET) ===== */

export function HealthChangeModal({
  open,
  onClose,
  horse,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  horse: { id: string; name: string; healthStatus: HealthStatus };
  onDone?: () => void;
}) {
  if (!open) return null;
  return <HealthChangeBody horse={horse} onClose={onClose} onDone={onDone} />;
}

function HealthChangeBody({
  horse,
  onClose,
  onDone,
}: {
  horse: { id: string; name: string; healthStatus: HealthStatus };
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [to, setTo] = useState<HealthStatus | ''>('');
  const [reason, setReason] = useState('');
  const changed = !!to && to !== horse.healthStatus;
  const f = useFormErrors(
    {
      to: !to ? 'Chọn trạng thái mới' : !changed ? `Ngựa đang ${healthLabel[horse.healthStatus]}, chọn trạng thái khác` : undefined,
      reason: reason.trim() ? undefined : 'Nhập lý do',
    },
    { fieldErrors: renameServerField(action.fieldErrors, 'healthStatus', 'to') },
  );

  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => changeHealthStatus(horse.id, to as HealthStatus, reason.trim()),
      (result) => {
        toast.push(
          result.changed ? `${horse.name}: đã chuyển sang ${healthLabel[result.to]}` : `${horse.name} đã ở trạng thái ${healthLabel[result.to]}`,
          'success',
        );
        onDone?.();
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-xl"
      title="Đổi trạng thái sức khỏe"
      dirty={!!to || reason.trim() !== ''}
      busy={action.pending}
      description="Đổi ngay, không cần ghi buổi khám."
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Đổi trạng thái'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{horse.name}</span> hiện đang
          <HealthPill status={horse.healthStatus} />
        </p>
        <div data-field="to" data-invalid={f.show('to') ? 'true' : undefined}>
          <HealthPicker
            value={to}
            onChange={(value) => {
              setTo(value);
              f.touch('to');
            }}
            current={horse.healthStatus}
          />
          {f.show('to') && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
              {f.show('to')}
            </p>
          )}
        </div>
        <ReasonField
          value={reason}
          onChange={setReason}
          error={f.show('reason')}
          onBlur={f.blur('reason')}
          placeholder="Ví dụ: Nghi cúm ngựa, cách ly theo dõi 14 ngày"
        />
        {changed && (to === 'INJURED' || to === 'QUARANTINED') && <Notice tone="info">Ngựa tạm ngưng tập và đua. HLV khu, Quản lý CLB và chủ ngựa được báo.</Notice>}
        {changed && to === 'UNDER_OBSERVATION' && <p className="text-xs text-gray-500">Ngựa vẫn được tập nhưng không được đua. HLV khu được báo.</p>}
        {changed && to === 'ELIGIBLE' && <p className="text-xs text-gray-500">Khóa huấn luyện (nếu có) vẫn giữ, cần gỡ riêng.</p>}
        <GeneralError action={action} fields={['reason', 'healthStatus']} />
      </div>
    </Modal>
  );
}

/* ===== Đặt khóa huấn luyện (F3.8, VET) ===== */

export function PlaceLockModal({
  horse,
  onClose,
  onDone,
  intro,
}: {
  horse: { id: string; name: string };
  onClose: () => void;
  onDone: (lock: TrainingLock) => void;
  /** Dòng mở đầu, ví dụ sau khi vừa mở bệnh án. */
  intro?: ReactNode;
}) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const f = useFormErrors(
    {
      reason: reason.trim() ? undefined : 'Nhập lý do khóa',
      date: date && date < todayKey() ? 'Ngày dự kiến gỡ phải từ hôm nay trở đi' : undefined,
    },
    { fieldErrors: renameServerField(action.fieldErrors, 'lockEnd', 'date') },
  );
  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => placeLock(horse.id, reason.trim(), dateToIso(date)),
      (lock) => {
        toast.push(`Đã đặt khóa huấn luyện cho ${horse.name}`, 'success');
        onDone(lock);
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Đặt khóa huấn luyện: ${horse.name}`}
      description="Ngựa bị khóa thì không được tập. Mỗi ngựa tối đa một khóa."
      dirty={reason.trim() !== '' || date !== ''}
      busy={action.pending}
      footer={
        <>
          <CancelButton variant="secondary">{intro ? 'Để sau' : 'Hủy'}</CancelButton>
          <Button variant="danger" onClick={submit} disabled={action.pending}>
            <Lock size={15} />
            {action.pending ? 'Đang lưu…' : 'Đặt khóa'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {intro}
        <ReasonField
          value={reason}
          onChange={setReason}
          max={1000}
          rows={2}
          error={f.show('reason')}
          onBlur={f.blur('reason')}
          placeholder="Ví dụ: Viêm gân, cấm vận động mạnh"
        />
        <Field label="Ngày dự kiến gỡ" name="date" error={f.show('date')} onBlur={f.blur('date')} hint="Không bắt buộc. Chỉ để nhắc, khóa không tự gỡ.">
          <DatePicker value={date} min={todayKey()} onChange={setDate} invalid={!!f.show('date')} />
        </Field>
        <p className="text-xs text-gray-500">Các buổi tập sắp tới của ngựa sẽ bị hủy, gỡ khóa thì mở lại.</p>
        <GeneralError action={action} fields={['reason', 'lockEnd']} />
      </div>
    </Modal>
  );
}

/* ===== Gỡ khóa huấn luyện (F3.8, VET) ===== */

export function ReleaseLockModal({
  lock,
  horseName,
  onClose,
  onDone,
}: {
  lock: TrainingLock;
  horseName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [conclusion, setConclusion] = useState('');
  const f = useFormErrors({ reason: conclusion.trim() ? undefined : 'Nhập lý do gỡ khóa' }, { fieldErrors: renameServerField(action.fieldErrors, 'conclusion', 'reason') });
  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => releaseLock(lock.id, conclusion.trim()),
      () => {
        toast.push(`Đã gỡ khóa huấn luyện cho ${horseName}`, 'success');
        onDone();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Gỡ khóa huấn luyện: ${horseName}`}
      dirty={conclusion.trim() !== ''}
      busy={action.pending}
      description={`Khóa từ ${formatDate(lock.lockStart)}: ${lock.reason}`}
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button onClick={submit} disabled={action.pending}>
            <Unlock size={15} />
            {action.pending ? 'Đang lưu…' : 'Gỡ khóa'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ReasonField
          label="Lý do gỡ"
          value={conclusion}
          onChange={setConclusion}
          max={1000}
          error={f.show('reason')}
          onBlur={f.blur('reason')}
          placeholder="Ví dụ: Tái khám ổn, cho tập lại nhẹ"
        />
        <p className="text-xs text-gray-500">Gỡ khóa không đổi sức khỏe. HLV khu và Quản lý CLB được báo.</p>
        <GeneralError action={action} fields={['conclusion']} />
      </div>
    </Modal>
  );
}

/* ===== Hủy buổi khám (F3.6, chỉ bác sĩ ghi phiếu) ===== */

export function VoidVisitModal({
  record,
  horseName,
  people,
  requestIds = [],
  caseInfo,
  onClose,
  onVoided,
  onReRecord,
}: {
  record: MedicalRecord;
  horseName: string;
  /** Tra tên người đổi sức khỏe sau buổi khám (khi sức khỏe không tự quay lại). */
  people: People;
  /** Yêu cầu khám đang gắn vào buổi này, lấy trước khi hủy (BE bỏ liên kết sau khi hủy) để ghi lại buổi thay thế. */
  requestIds?: string[];
  /** Bệnh án của buổi khám (nếu có) và số buổi khác chưa hủy trong bệnh án đó. */
  caseInfo?: { status: MedicalCase['status']; otherActiveVisits: number };
  onClose: () => void;
  onVoided: () => void;
  onReRecord?: (record: MedicalRecord, requestIds: string[]) => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const [voided, setVoided] = useState<VoidVisitResult | null>(null);
  const opening = !!record.caseId && record.conclusion === 'ISSUE';
  const f = useFormErrors({ reason: reason.trim() ? undefined : 'Nhập lý do hủy' }, { fieldErrors: action.fieldErrors });

  const consequences = [
    'Số đo của buổi này bị gỡ khỏi chỉ số cơ thể.',
    'Sức khỏe ngựa về như trước buổi khám, trừ khi đã có người đổi sau đó.',
    ...(requestIds.length ? [`${requestIds.length} yêu cầu khám quay về hàng đợi.`] : []),
    ...(record.nextVisitAt ? ['Lịch tái khám của buổi này bị hủy.'] : []),
    'Buổi này không còn tính vào hạn khám định kỳ.',
  ];
  let blocked: string | undefined;
  if (opening && caseInfo) {
    if (caseInfo.status === 'CLOSED') blocked = 'Bệnh án đã đóng nên không hủy được buổi mở bệnh án.';
    else if (caseInfo.otherActiveVisits > 0) blocked = 'Bệnh án còn buổi khám khác chưa hủy. Hủy các buổi tái khám trước rồi mới hủy buổi mở bệnh án.';
    else if (caseInfo.status === 'OPEN') consequences.unshift('Bệnh án mở từ buổi này chuyển sang Đã hủy. Khóa tập vẫn giữ.');
  }

  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => voidRecord(record.id, reason.trim()),
      (result) => {
        toast.push('Đã hủy buổi khám', 'success');
        setVoided(result);
        onVoided();
      },
    );
  };

  if (voided) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Đã hủy buổi khám"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            {onReRecord && (
              <Button onClick={() => onReRecord(voided, requestIds)}>
                <RotateCcw size={15} /> Ghi lại
              </Button>
            )}
          </>
        }
      >
        <p className="flex items-start gap-2 text-sm text-gray-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          Buổi khám {formatDateTime(record.examDate)} vẫn hiện trong hồ sơ, được đánh dấu đã hủy kèm lý do.
        </p>
        {voided.healthOutcome === 'REVERTED' && <p className="mt-3 text-sm text-gray-700">Sức khỏe ngựa đã về như trước buổi khám.</p>}
        {voided.healthOutcome === 'KEPT_LATER_CHANGE' && (
          <Notice tone="warning" className="mt-3">
            {voided.laterHealthChange
              ? `Sức khỏe giữ nguyên ${healthLabel[voided.laterHealthChange.to]} vì ${people.name(voided.laterHealthChange.changedBy)} đã đổi lúc ${formatDateTime(voided.laterHealthChange.changedAt)}.`
              : 'Sức khỏe giữ nguyên vì đã được đổi sau buổi khám.'}
          </Notice>
        )}
        {requestIds.length > 0 && <p className="mt-3 text-sm text-gray-700">{requestIds.length} yêu cầu khám đã quay về hàng đợi.</p>}
        {onReRecord && (
          <p className="mt-3 text-sm text-gray-500">
            Nếu ghi sai, bạn có thể ghi lại buổi thay thế với nội dung{requestIds.length ? ' và yêu cầu khám' : ''} được điền sẵn.
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Hủy buổi khám"
      dirty={reason.trim() !== ''}
      busy={action.pending}
      description={`${horseName} · ${visitKindLabel[record.kind]} ${formatDateTime(record.examDate)}`}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          {/* Bị chặn thì đã có thông báo lý do ngay trong hộp. */}
          <Button variant="danger" onClick={submit} disabled={action.pending || !!blocked}>
            {action.pending ? 'Đang hủy…' : 'Hủy buổi khám'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Ghi sai một vài ô thì dùng Sửa buổi khám. Hủy khi cả buổi ghi nhầm (sai ngựa, sai buổi).</p>
        {blocked ? (
          <Notice tone="warning">{blocked}</Notice>
        ) : (
          <ul className="space-y-1.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            {consequences.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {item}
              </li>
            ))}
          </ul>
        )}
        {!blocked && (
          <ReasonField
            label="Lý do hủy"
            value={reason}
            onChange={setReason}
            error={f.show('reason')}
            onBlur={f.blur('reason')}
            placeholder="Ví dụ: Ghi nhầm sang ngựa khác"
          />
        )}
        <GeneralError action={action} fields={['reason']} />
      </div>
    </Modal>
  );
}

/* ===== Điều chỉnh chi phí một buổi khám (F3.9, VET) ===== */

export function AdjustCostModal({
  record,
  horseName,
  onClose,
  onDone,
}: {
  record: MedicalRecord;
  horseName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const initial = formatMoneyInput(String(record.cost ?? 0));
  const [cost, setCost] = useState(initial);
  const [reason, setReason] = useState('');
  const costValue = parseMoney(cost);
  const costOk = !!cost.trim() && Number.isInteger(costValue) && costValue >= 0 && costValue <= MAX_COST;
  const f = useFormErrors(
    {
      cost: !cost.trim()
        ? 'Nhập chi phí mới'
        : !costOk
          ? 'Nhập số nguyên từ 0 đến 10 tỷ đồng'
          : costValue === (record.cost ?? 0)
            ? 'Số tiền chưa thay đổi'
            : undefined,
      reason: reason.trim() ? undefined : 'Nhập lý do điều chỉnh',
    },
    { fieldErrors: action.fieldErrors },
  );
  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => adjustVisitCost(record.id, costValue, reason.trim()),
      () => {
        toast.push(`Đã điều chỉnh chi phí buổi khám của ${horseName}`, 'success');
        onDone();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Điều chỉnh chi phí buổi khám"
      dirty={reason.trim() !== '' || cost !== initial}
      busy={action.pending}
      description={`${horseName} · buổi khám ${formatDateTime(record.examDate)} · chi phí hiện tại ${formatMoney(record.cost ?? 0)}`}
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Chi phí mới (đồng)"
          required
          name="cost"
          error={f.show('cost')}
          onBlur={f.blur('cost')}
          hint={costOk ? `= ${formatMoney(costValue)}` : undefined}
        >
          <Input inputMode="numeric" value={cost} onChange={(event) => setCost(formatMoneyInput(event.target.value))} className={cn('tabular-nums', f.show('cost') && invalidClass)} />
        </Field>
        <ReasonField
          label="Lý do điều chỉnh"
          value={reason}
          onChange={setReason}
          error={f.show('reason')}
          onBlur={f.blur('reason')}
          placeholder="Ví dụ: Bổ sung hóa đơn siêu âm"
        />
        <p className="text-xs text-gray-500">Quản lý và chủ ngựa được báo chi phí mới.</p>
        <GeneralError action={action} fields={['cost', 'reason']} />
      </div>
    </Modal>
  );
}

/* ===== Đặt / dời ngày hẹn khám định kỳ (F3.2, VET) ===== */

export function AppointmentModal({ item, onClose, onDone }: { item: CheckupItem; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const rescheduling = !!item.appointment;
  const [initial] = useState(() => {
    if (item.appointment) return toLocalInput(item.appointment.scheduledAt);
    const date = now();
    date.setDate(date.getDate() + 1);
    date.setHours(8, 0, 0, 0);
    return toLocalInput(date);
  });
  const [value, setValue] = useState(initial);
  const [reason, setReason] = useState('');
  const today = todayKey();
  const overdue = item.dueStatus === 'OVERDUE';
  const day = value.slice(0, 10);
  const f = useFormErrors(
    {
      scheduledAt: !localToIso(value)
        ? 'Chọn ngày giờ hẹn'
        : day < today
          ? 'Ngày hẹn khám không được ở quá khứ'
          : !overdue && day > item.dueDate
            ? `Ngày hẹn không được muộn hơn hạn khám ${formatDate(item.dueDate)}`
            : rescheduling && value === initial
              ? 'Ngày giờ hẹn chưa thay đổi'
              : undefined,
      reason: rescheduling && !reason.trim() ? 'Nhập lý do dời lịch' : undefined,
    },
    { fieldErrors: action.fieldErrors },
  );

  const submit = () => {
    if (!f.attempt()) return;
    action.run(
      () => setCheckupAppointment(item.horseId, localToIso(value)!, reason.trim() || undefined),
      () => {
        toast.push(`${item.horseName}: đã ${rescheduling ? 'dời' : 'đặt'} ngày hẹn khám`, 'success');
        onDone();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={rescheduling ? 'Dời ngày hẹn khám' : 'Đặt ngày hẹn khám'}
      dirty={reason.trim() !== '' || value !== initial}
      busy={action.pending}
      description={`${item.horseName} · hạn khám ${formatDate(item.dueDate)}`}
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : rescheduling ? 'Dời lịch' : 'Đặt lịch'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {item.appointment && (
          <p className="text-sm text-gray-600">
            Đang hẹn <span className="font-semibold text-gray-900">{formatDateTime(item.appointment.scheduledAt)}</span>
          </p>
        )}
        <Field
          label="Ngày giờ hẹn"
          required
          name="scheduledAt"
          error={f.show('scheduledAt')}
          onBlur={f.blur('scheduledAt')}
          hint={overdue ? 'Ngựa đã quá hạn: chọn ngày bất kỳ từ hôm nay.' : `Từ hôm nay đến hạn khám ${formatDate(item.dueDate)}.`}
        >
          <DateTimePicker
            value={value}
            min={`${today}T00:00`}
            max={overdue ? undefined : `${item.dueDate}T23:59`}
            onChange={setValue}
            invalid={!!f.show('scheduledAt')}
          />
        </Field>
        {rescheduling ? (
          <ReasonField
            label="Lý do dời"
            value={reason}
            onChange={setReason}
            rows={2}
            error={f.show('reason')}
            onBlur={f.blur('reason')}
            placeholder="Ví dụ: Trùng lịch thi đấu"
          />
        ) : (
          <Field label="Lý do" hint="Không bắt buộc khi đặt lần đầu" counter={<CharCount value={reason} max={500} />}>
            <Input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Khám cùng đợt với khu B" />
          </Field>
        )}
        <p className="text-xs text-gray-500">Ghi buổi khám cho ngựa thì hẹn này tự chuyển sang Đã thực hiện.</p>
        <GeneralError action={action} fields={['scheduledAt', 'reason']} />
      </div>
    </Modal>
  );
}

/** Một yêu cầu khám dạng dòng gọn (dùng trong danh sách phụ). */
export function RequestRow({ request, people }: { request: ExamRequest; people: People }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {request.urgent && request.status === 'PENDING' && <UrgentPill urgent />}
        <RequestMeta request={request} people={people} showUrgent={false} />
      </div>
      <div className="mt-1">
        <RequestText text={request.description} compact />
      </div>
    </div>
  );
}
