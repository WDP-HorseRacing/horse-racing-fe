// Các hộp thoại ngắn của Flow 3: gửi / đổi mức / bỏ qua yêu cầu khám, đổi sức khỏe,
// đặt / gỡ khóa huấn luyện, hủy buổi khám, điều chỉnh chi phí, hẹn khám định kỳ. Đóng bệnh án là trang riêng (CaseClose).
// Lỗi hiển thị nguyên văn câu của backend.
import { useState, type ReactNode } from 'react';
import { CheckCircle2, Lock, RotateCcw, Unlock } from 'lucide-react';
import { useAction } from '../../../hooks/useService';
import {
  adjustCaseCost,
  changeHealthStatus,
  changeRequestUrgency,
  createExamRequest,
  dismissExamRequest,
  placeLock,
  releaseLock,
  setCheckupAppointment,
  voidRecord,
} from '../../../api/medical';
import type { CheckupItem, ExamRequest, HealthStatus, MedicalCase, MedicalRecord, TrainingLock } from '../../../api/types';
import { Button, Dot, ErrorBox, Field, Input, Modal, Notice, Select, Skeleton, Textarea, cn, useToast } from '../../../components/ui';
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

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('tabular-nums', value.length > max && 'font-medium text-red-600')}>
      {value.length}/{max}
    </span>
  );
}

/* ===== Gửi yêu cầu khám (F3.4) ===== */

export function RequestForm({
  horse,
  onDone,
  onCancel,
}: {
  horse?: { id: string; name: string };
  onDone?: (request: ExamRequest) => void;
  onCancel?: () => void;
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

  const submit = () =>
    action.run(
      () => createExamRequest(horseId, text, urgent),
      (result) => {
        toast.push(`Đã gửi yêu cầu khám cho ${picked?.name ?? result.horseName}`, 'success');
        setDescription('');
        setUrgent(false);
        if (!horse) setHorseId('');
        onDone?.(result);
      },
    );

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
          hint={scope === 'myBarns' ? 'Ngựa thuộc khu bạn phụ trách' : scope === 'myHorses' ? 'Ngựa bạn đang được phân công chăm sóc' : undefined}
        >
          <Select value={horseId} onChange={(event) => setHorseId(event.target.value)}>
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
      <Field label="Mô tả tình trạng" required hint={<Counter value={text} max={2000} />}>
        <Textarea
          rows={4}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ví dụ: Ngựa đi hơi khập khiễng chân trước trái sau buổi tập, cổ chân hơi nóng"
        />
      </Field>
      {action.error && <ErrorBox message={action.error} />}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button variant={urgent ? 'danger' : 'primary'} onClick={submit} disabled={action.pending || !horseId || !text || text.length > 2000}>
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
  if (!open) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={horse ? `Gửi yêu cầu khám: ${horse.name}` : 'Gửi yêu cầu khám'}
      description="Báo bác sĩ khi ngựa có dấu hiệu bất thường. Chọn Khẩn nếu cần bác sĩ tới ngay."
    >
      <RequestForm
        horse={horse}
        onCancel={onClose}
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
  const submit = () =>
    action.run(
      () => changeRequestUrgency(request.id, next, reason.trim()),
      () => {
        toast.push(`${request.horseName}: đã chuyển yêu cầu sang ${next ? 'Khẩn' : 'Bình thường'}`, 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={next ? 'Nâng lên Khẩn' : 'Hạ xuống Bình thường'}
      description={`Yêu cầu khám của ${request.horseName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant={next ? 'danger' : 'primary'} onClick={submit} disabled={action.pending || !reason.trim()}>
            {action.pending ? 'Đang lưu…' : next ? 'Nâng lên Khẩn' : 'Hạ mức'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3">
          <RequestText text={request.description} />
        </div>
        <Field label="Lý do" required hint={next ? 'Mọi bác sĩ nhận thông báo Khẩn.' : 'Hạ mức không gửi thông báo.'}>
          <Textarea rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Bỏ qua yêu cầu khám (F3.4, VET) ===== */

export function DismissRequestModal({ request, onClose, onDone }: { request: ExamRequest; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const submit = () =>
    action.run(
      () => dismissExamRequest(request.id, reason.trim()),
      () => {
        toast.push(`Đã bỏ qua yêu cầu khám của ${request.horseName}`, 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Bỏ qua yêu cầu khám: ${request.horseName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant="danger" onClick={submit} disabled={action.pending || !reason.trim()}>
            {action.pending ? 'Đang lưu…' : 'Bỏ qua yêu cầu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3">
          <RequestText text={request.description} />
        </div>
        <Field label="Lý do bỏ qua" required hint="Yêu cầu chuyển sang Đã bỏ qua, không mở lại được.">
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Đã kiểm tra tại chuồng, chỉ là vết xước bề mặt"
          />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
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

  const submit = () =>
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

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-xl"
      title="Đổi trạng thái sức khỏe"
      description="Đổi trực tiếp, không cần buổi khám. Lý do được ghi vào lịch sử sức khỏe."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || !changed || !reason.trim()}>
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
        <HealthPicker value={to} onChange={setTo} current={horse.healthStatus} />
        <Field label="Lý do" required>
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Nghi cúm ngựa, cách ly theo dõi 14 ngày"
          />
        </Field>
        {changed && (to === 'INJURED' || to === 'QUARANTINED') && (
          <Notice tone="info">
            Ngựa mất quyền tập và đua. HT khu, quản lý và chủ ngựa nhận thông báo. Ngựa không bị rút khỏi lớp, không tự chuyển ô.
          </Notice>
        )}
        {changed && to === 'UNDER_OBSERVATION' && <p className="text-xs text-gray-500">Ngựa vẫn được tập nhưng không được đua. HT khu nhận thông báo.</p>}
        {changed && to === 'ELIGIBLE' && <p className="text-xs text-gray-500">Đổi sang Đủ điều kiện không tự gỡ khóa huấn luyện (nếu có).</p>}
        {action.error && <ErrorBox message={action.error} />}
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
  const submit = () =>
    action.run(
      () => placeLock(horse.id, reason.trim(), dateToIso(date)),
      (lock) => {
        toast.push(`Đã đặt khóa huấn luyện cho ${horse.name}`, 'success');
        onDone(lock);
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Đặt khóa huấn luyện: ${horse.name}`}
      description="Lệnh riêng của bác sĩ, độc lập với sức khỏe. Mỗi ngựa tối đa một khóa hiệu lực."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {intro ? 'Để sau' : 'Hủy'}
          </Button>
          <Button variant="danger" onClick={submit} disabled={action.pending || !reason.trim()}>
            <Lock size={15} />
            {action.pending ? 'Đang lưu…' : 'Đặt khóa'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {intro}
        <Field label="Lý do" required>
          <Input
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Viêm gân, cấm vận động mạnh"
          />
        </Field>
        <Field label="Ngày dự kiến gỡ" hint="Không bắt buộc. Tới ngày này hệ thống không tự gỡ khóa.">
          <DatePicker value={date} min={todayKey()} onChange={setDate} />
        </Field>
        <p className="text-xs text-gray-500">
          Ngựa đang có bệnh án mở thì khóa tự gắn vào bệnh án đó. HT khu và quản lý nhận thông báo. Lượt tập đã xếp không bị hủy.
        </p>
        {action.error && <ErrorBox message={action.error} />}
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
  const submit = () =>
    action.run(
      () => releaseLock(lock.id, conclusion.trim()),
      () => {
        toast.push(`Đã gỡ khóa huấn luyện cho ${horseName}`, 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Gỡ khóa huấn luyện: ${horseName}`}
      description={`Khóa từ ${formatDate(lock.lockStart)}: ${lock.reason}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || !conclusion.trim()}>
            <Unlock size={15} />
            {action.pending ? 'Đang lưu…' : 'Gỡ khóa'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Lý do gỡ" required>
          <Textarea
            rows={3}
            maxLength={1000}
            value={conclusion}
            onChange={(event) => setConclusion(event.target.value)}
            placeholder="Ví dụ: Tái khám ổn, cho tập lại nhẹ"
          />
        </Field>
        <p className="text-xs text-gray-500">Gỡ khóa không đổi sức khỏe. HT khu và quản lý nhận thông báo.</p>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Hủy buổi khám (F3.6, VET) ===== */

export function VoidVisitModal({
  record,
  horseName,
  caseInfo,
  onClose,
  onVoided,
  onReRecord,
}: {
  record: MedicalRecord;
  horseName: string;
  /** Bệnh án của buổi khám (nếu có) và số buổi khác chưa hủy trong bệnh án đó. */
  caseInfo?: { status: MedicalCase['status']; otherActiveVisits: number };
  onClose: () => void;
  onVoided: () => void;
  onReRecord?: (record: MedicalRecord) => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const [voided, setVoided] = useState<MedicalRecord | null>(null);
  const opening = !!record.caseId && record.conclusion === 'ISSUE';

  const consequences = [
    'Số đo ghi trong buổi này bị gỡ khỏi bảng chỉ số cơ thể.',
    'Trạng thái sức khỏe không tự quay lại như trước buổi khám.',
    'Yêu cầu khám đã gắn vẫn giữ trạng thái Đã khám.',
    'Buổi khám không còn được tính vào hạn khám định kỳ.',
  ];
  let blocked: string | undefined;
  if (opening && caseInfo) {
    if (caseInfo.status === 'CLOSED') blocked = 'Bệnh án đã đóng nên không hủy được buổi mở bệnh án.';
    else if (caseInfo.otherActiveVisits > 0) blocked = 'Bệnh án còn buổi khám khác chưa hủy. Hủy các buổi tái khám trước rồi mới hủy buổi mở bệnh án.';
    else if (caseInfo.status === 'OPEN') consequences.unshift('Đây là buổi mở bệnh án: bệnh án chuyển sang Đã hủy. Khóa huấn luyện đang gắn được tách ra, vẫn hiệu lực.');
  }

  const submit = () =>
    action.run(
      () => voidRecord(record.id, reason.trim()),
      (result) => {
        toast.push('Đã hủy buổi khám', 'success');
        setVoided(result);
        onVoided();
      },
    );

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
              <Button onClick={() => onReRecord(voided)}>
                <RotateCcw size={15} /> Ghi lại buổi thay thế
              </Button>
            )}
          </>
        }
      >
        <p className="flex items-start gap-2 text-sm text-gray-700">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          Buổi khám {formatDateTime(record.examDate)} vẫn hiện trong hồ sơ, được đánh dấu đã hủy kèm lý do.
        </p>
        {onReRecord && <p className="mt-3 text-sm text-gray-500">Nếu ghi sai, bạn có thể ghi lại buổi thay thế với nội dung được điền sẵn.</p>}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Hủy buổi khám"
      description={`${horseName} · ${visitKindLabel[record.kind]} ${formatDateTime(record.examDate)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant="danger" onClick={submit} disabled={action.pending || !reason.trim() || !!blocked}>
            {action.pending ? 'Đang hủy…' : 'Hủy buổi khám'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Buổi khám đã lưu không sửa, không xóa. Ghi sai thì hủy buổi đó rồi ghi lại buổi thay thế.</p>
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
        <Field label="Lý do hủy" required>
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Ghi nhầm sang ngựa khác"
          />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Điều chỉnh chi phí bệnh án đã đóng (F3.9, VET) ===== */

export function AdjustCostModal({
  medicalCase,
  horseName,
  onClose,
  onDone,
}: {
  medicalCase: MedicalCase;
  horseName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [cost, setCost] = useState(formatMoneyInput(String(medicalCase.totalCost ?? '')));
  const [reason, setReason] = useState('');
  const costValue = parseMoney(cost);
  const costOk = Number.isInteger(costValue) && costValue >= 0 && costValue <= MAX_COST;
  const submit = () =>
    action.run(
      () => adjustCaseCost(medicalCase.id, costValue, reason.trim()),
      () => {
        toast.push(`Đã điều chỉnh chi phí bệnh án của ${horseName}`, 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title="Điều chỉnh chi phí"
      description={`${horseName} · chi phí hiện tại ${formatMoney(medicalCase.totalCost)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || !costOk || !reason.trim()}>
            {action.pending ? 'Đang lưu…' : 'Lưu chi phí'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Chi phí mới (đồng)"
          required
          error={cost && !costOk ? 'Nhập số nguyên từ 0 đến 10 tỷ đồng' : undefined}
          hint={costOk ? `= ${formatMoney(costValue)}` : undefined}
        >
          <Input inputMode="numeric" value={cost} onChange={(event) => setCost(formatMoneyInput(event.target.value))} />
        </Field>
        <Field label="Lý do điều chỉnh" required>
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Bổ sung hóa đơn siêu âm"
          />
        </Field>
        <p className="text-xs text-gray-500">Chủ ngựa và quản lý nhận thông báo chi phí cũ và mới.</p>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Đặt / dời ngày hẹn khám định kỳ (F3.2, VET) ===== */

export function AppointmentModal({ item, onClose, onDone }: { item: CheckupItem; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const action = useAction();
  const rescheduling = !!item.appointment;
  const [value, setValue] = useState(() => {
    if (item.appointment) return toLocalInput(item.appointment.scheduledAt);
    const date = now();
    date.setDate(date.getDate() + 1);
    date.setHours(8, 0, 0, 0);
    return toLocalInput(date);
  });
  const [reason, setReason] = useState('');
  const today = todayKey();
  const overdue = item.dueStatus === 'OVERDUE';
  const day = value.slice(0, 10);
  const dayError = !day
    ? undefined
    : day < today
      ? 'Ngày hẹn khám không được ở quá khứ'
      : !overdue && day > item.dueDate
        ? `Ngày hẹn không được muộn hơn hạn khám ${formatDate(item.dueDate)}`
        : undefined;

  const submit = () =>
    action.run(
      () => setCheckupAppointment(item.horseId, localToIso(value)!, reason.trim() || undefined),
      () => {
        toast.push(`${item.horseName}: đã ${rescheduling ? 'dời' : 'đặt'} ngày hẹn khám`, 'success');
        onDone();
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={rescheduling ? 'Dời ngày hẹn khám' : 'Đặt ngày hẹn khám'}
      description={`${item.horseName} · hạn khám ${formatDate(item.dueDate)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || !value || !!dayError || (rescheduling && !reason.trim())}>
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
          error={dayError}
          hint={overdue ? 'Ngựa đã quá hạn: chọn ngày bất kỳ từ hôm nay.' : `Từ hôm nay đến hạn khám ${formatDate(item.dueDate)}.`}
        >
          <DateTimePicker value={value} min={`${today}T00:00`} max={overdue ? undefined : `${item.dueDate}T23:59`} onChange={setValue} />
        </Field>
        <Field label="Lý do" required={rescheduling} hint={rescheduling ? undefined : 'Không bắt buộc khi đặt lần đầu'}>
          <Input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Trùng lịch thi đấu" />
        </Field>
        <p className="text-xs text-gray-500">Ngày hẹn chỉ là kế hoạch. Ghi bất kỳ buổi khám nào cho ngựa thì ngày hẹn tự chuyển sang Đã thực hiện.</p>
        {action.error && <ErrorBox message={action.error} />}
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
