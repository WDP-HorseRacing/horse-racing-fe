// Các hộp thoại ngắn của Flow 3: đổi sức khỏe, đặt/gỡ khóa, gửi/bỏ qua yêu cầu khám,
// đóng bệnh án, ghi chú đính chính.
import { useState } from 'react';
import { AlertOctagon, Lock, Unlock } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  addExamCorrection,
  changeHealthStatus,
  closeCase,
  createExamRequest,
  dismissExamRequest,
  liftTrainingLock,
  listMedicalHorseOptions,
  placeTrainingLock,
} from '../../../services/medical.service';
import {
  Button,
  ErrorBox,
  Field,
  Input,
  Modal,
  Notice,
  Select,
  Skeleton,
  Textarea,
  cn,
  useToast,
} from '../../../components/ui';
import { HealthPill, LockPill } from '../../../components/ui/status';
import { healthLabel } from '../../../lib/labels';
import { formatDate, formatMoney, toDateKey } from '../../../lib/format';
import { now } from '../../../lib/clock';
import type { ExamUrgency, HealthStatus } from '../../../types/domain';
import { HealthPicker, RequestLines } from './parts';

function useFieldError() {
  const action = useAction();
  const fieldError = (field: string) => (action.field === field ? action.error : undefined);
  return { action, fieldError };
}

/* ===== Đổi trạng thái sức khỏe trực tiếp (F3.7) ===== */

export function HealthChangeModal({
  horseId: fixedHorseId,
  onClose,
  onDone,
}: {
  horseId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const options = useService(() => listMedicalHorseOptions(), []);
  const { action, fieldError } = useFieldError();
  const [horseId, setHorseId] = useState(fixedHorseId ?? '');
  const [to, setTo] = useState<HealthStatus | ''>('');
  const [reason, setReason] = useState('');
  const horse = options.data?.find((item) => item.id === horseId);

  const submit = () =>
    action.run(
      () => changeHealthStatus({ horseId, to: to as HealthStatus, reason }),
      (result) => {
        toast.push(`${horse?.name ?? 'Ngựa'}: đã chuyển sang ${healthLabel[to as HealthStatus]}`, 'success');
        if (result.lockStillActive) {
          toast.push('Ngựa vẫn còn khóa huấn luyện — đổi sức khỏe không tự gỡ khóa.', 'info');
        }
        onDone();
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-xl"
      title="Đổi trạng thái sức khỏe"
      description="Bác sĩ đổi trực tiếp, không cần buổi khám. Lý do được ghi vào nhật ký đổi trạng thái."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || !horseId || !to || to === horse?.healthStatus}>
            {action.pending ? 'Đang lưu…' : 'Đổi trạng thái'}
          </Button>
        </>
      }
    >
      {options.loading ? (
        <Skeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {!fixedHorseId ? (
            <Field label="Ngựa" required error={fieldError('horseId')}>
              <Select value={horseId} onChange={(event) => setHorseId(event.target.value)}>
                <option value="">Chọn ngựa…</option>
                {options.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {healthLabel[item.healthStatus]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            horse && (
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{horse.name}</span> hiện đang
                <HealthPill status={horse.healthStatus} />
              </p>
            )
          )}
          {horse && (
            <>
              <HealthPicker value={to} onChange={setTo} current={horse.healthStatus} error={fieldError('to')} />
              <Field label="Lý do" required error={fieldError('reason')}>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ví dụ: Nghi cúm ngựa, cách ly theo dõi 14 ngày"
                />
              </Field>
              {to === 'ELIGIBLE' && horse.activeLock && (
                <Notice tone="warning" icon={<Lock size={15} />}>
                  Ngựa còn khóa huấn luyện "{horse.activeLock.reason}". Chuyển Đủ điều kiện không tự gỡ khóa — ngựa vẫn chưa được tập cho tới khi gỡ khóa.
                </Notice>
              )}
              {(to === 'INJURED' || to === 'QUARANTINED') && to !== horse.healthStatus && (
                <Notice tone="info">
                  Ngựa mất quyền tập và đua; HT khu và quản lý nhận thông báo mức Trung bình. Ngựa không bị rút khỏi lớp — sẽ được đánh dấu vắng khi buổi học bắt đầu.
                  {to === 'QUARANTINED' && ' Không có "ô cách ly": HT được gợi ý chuyển ngựa sang ô trống nếu cần tách đàn.'}
                </Notice>
              )}
            </>
          )}
          {action.error && !['horseId', 'to', 'reason'].includes(action.field ?? '') && <ErrorBox message={action.error} />}
        </div>
      )}
    </Modal>
  );
}

/* ===== Đặt khóa huấn luyện (F3.8) ===== */

export function PlaceLockModal({
  horseId: fixedHorseId,
  caseId: suggestedCaseId,
  onClose,
  onDone,
}: {
  horseId?: string;
  caseId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const options = useService(() => listMedicalHorseOptions(), []);
  const { action, fieldError } = useFieldError();
  const [horseId, setHorseId] = useState(fixedHorseId ?? '');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [linkCase, setLinkCase] = useState(true);
  const horse = options.data?.find((item) => item.id === horseId);
  const candidates = options.data?.filter((item) => !item.activeLock) ?? [];
  const openCase = horse?.openCase;
  const caseId = openCase && linkCase ? openCase.id : undefined;

  const submit = () =>
    action.run(
      () => placeTrainingLock({ horseId, reason, expectedLiftDate: date || undefined, caseId }),
      () => {
        toast.push(`Đã đặt khóa huấn luyện cho ${horse?.name ?? 'ngựa'}`, 'success');
        onDone();
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title="Đặt khóa huấn luyện"
      description="Khóa là lệnh riêng của bác sĩ, độc lập với trạng thái sức khỏe. Mỗi ngựa tối đa một khóa hiệu lực."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="danger" onClick={submit} disabled={action.pending || !horseId || !!horse?.activeLock}>
            <Lock size={15} />
            {action.pending ? 'Đang lưu…' : 'Đặt khóa'}
          </Button>
        </>
      }
    >
      {options.loading ? (
        <Skeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {fixedHorseId ? (
            horse && (
              <p className="text-sm text-gray-600">
                Ngựa: <span className="font-semibold text-gray-900">{horse.name}</span>
              </p>
            )
          ) : (
            <Field label="Ngựa" required error={fieldError('horseId')} hint="Chỉ hiện ngựa chưa có khóa hiệu lực">
              <Select value={horseId} onChange={(event) => setHorseId(event.target.value)}>
                <option value="">Chọn ngựa…</option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {healthLabel[item.healthStatus]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {horse?.activeLock && <LockPill reason={horse.activeLock.reason} />}
          <Field label="Lý do" required error={fieldError('reason')}>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Viêm gân — cấm vận động mạnh" />
          </Field>
          <Field
            label="Ngày dự kiến gỡ"
            error={fieldError('expectedLiftDate')}
            hint="Không bắt buộc. Tới ngày này hệ thống KHÔNG tự gỡ — chỉ nhắc chờ bác sĩ xác nhận."
          >
            <Input type="date" value={date} min={toDateKey(now())} onChange={(event) => setDate(event.target.value)} />
          </Field>
          {openCase && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-amber-50/60 p-3 text-sm ring-1 ring-amber-100">
              <input
                type="checkbox"
                checked={linkCase}
                onChange={(event) => setLinkCase(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span>
                Gắn với bệnh án đang mở <span className="font-semibold">"{openCase.title}"</span>
                {suggestedCaseId && suggestedCaseId !== openCase.id && ' (bệnh án khác bệnh án đang xem)'}
                <span className="block text-xs text-gray-500">Khi đóng bệnh án, bác sĩ phải chọn gỡ hoặc giữ khóa này.</span>
              </span>
            </label>
          )}
          <p className="text-xs font-light text-gray-400">
            HT khu và quản lý nhận thông báo mức Trung bình. Ngựa đang tập trong buổi đang diễn ra sẽ được dừng; các buổi sau ngựa được đánh dấu vắng.
          </p>
          {action.error && !['horseId', 'reason', 'expectedLiftDate'].includes(action.field ?? '') && <ErrorBox message={action.error} />}
        </div>
      )}
    </Modal>
  );
}

/* ===== Gỡ khóa huấn luyện (F3.8) ===== */

export function LiftLockModal({
  lock,
  onClose,
  onDone,
}: {
  lock: { id: string; horseName: string; reason: string; placedAt: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { action, fieldError } = useFieldError();
  const [reason, setReason] = useState('');
  const submit = () =>
    action.run(
      () => liftTrainingLock(lock.id, reason),
      () => {
        toast.push(`Đã gỡ khóa huấn luyện cho ${lock.horseName}`, 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Gỡ khóa huấn luyện — ${lock.horseName}`}
      description={`Khóa từ ${formatDate(lock.placedAt)}: ${lock.reason}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            <Unlock size={15} />
            {action.pending ? 'Đang lưu…' : 'Gỡ khóa'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Lý do gỡ" required error={fieldError('reason')}>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Tái khám ổn, cho tập lại nhẹ" />
        </Field>
        <p className="text-xs font-light text-gray-400">
          Gỡ khóa không đổi trạng thái sức khỏe. Ngựa chỉ được tập khi sức khỏe là Đủ điều kiện hoặc Cần theo dõi.
        </p>
        {action.error && action.field !== 'reason' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Gửi yêu cầu khám (F3.4) ===== */

export function RequestForm({
  horseId: fixedHorseId,
  onDone,
  onCancel,
  submitLabel = 'Gửi yêu cầu',
}: {
  horseId?: string;
  onDone: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const toast = useToast();
  const options = useService(() => listMedicalHorseOptions(), []);
  const { action, fieldError } = useFieldError();
  const [horseId, setHorseId] = useState(fixedHorseId ?? '');
  const [urgency, setUrgency] = useState<ExamUrgency>('NORMAL');
  const [description, setDescription] = useState('');
  const horse = options.data?.find((item) => item.id === horseId);

  const submit = () =>
    action.run(
      () => createExamRequest({ horseId, urgency, description }),
      (result) => {
        toast.push(
          result.merged
            ? `Đã bổ sung vào yêu cầu đang chờ của ${horse?.name ?? 'ngựa'}`
            : `Đã gửi yêu cầu khám cho ${horse?.name ?? 'ngựa'}`,
          'success',
        );
        setDescription('');
        setUrgency('NORMAL');
        if (!fixedHorseId) setHorseId('');
        onDone();
      },
    );

  if (options.loading) return <Skeleton rows={3} />;
  if (!options.data?.length) {
    return <Notice tone="info">Không có ngựa nào trong phạm vi của bạn để gửi yêu cầu khám.</Notice>;
  }

  return (
    <div className="space-y-4">
      {!fixedHorseId && (
        <Field label="Ngựa" required error={fieldError('horseId')}>
          <Select value={horseId} onChange={(event) => setHorseId(event.target.value)}>
            <option value="">Chọn ngựa…</option>
            {options.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.stallCode ? ` · ô ${item.stallCode}` : item.zoneName ? ` · ${item.zoneName}` : ''}
                {item.pendingRequestCount ? ` · đang có ${item.pendingRequestCount} yêu cầu chờ` : ''}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-gray-600">Mức độ</span>
        <div className="grid grid-cols-2 gap-2">
          {(['NORMAL', 'URGENT'] as ExamUrgency[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setUrgency(value)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition',
                urgency === value
                  ? value === 'URGENT'
                    ? 'bg-red-600 text-white ring-red-600 shadow-[0_10px_24px_-12px_rgba(220,38,38,0.9)]'
                    : 'bg-emerald-600 text-white ring-emerald-600'
                  : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300',
              )}
            >
              {value === 'URGENT' && <AlertOctagon size={15} />}
              {value === 'URGENT' ? 'Khẩn' : 'Bình thường'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs font-light text-gray-400">
          {urgency === 'URGENT' ? 'Bác sĩ nhận thông báo mức Khẩn ngay lập tức.' : 'Bác sĩ nhận thông báo và xử lý theo thứ tự.'}
        </p>
      </div>
      <Field label="Mô tả tình trạng" required error={fieldError('description')}>
        <Textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ví dụ: Ngựa đi hơi khập khiễng chân trước trái sau buổi tập, cổ chân hơi nóng"
        />
      </Field>
      {horse && horse.pendingRequestCount > 0 && (
        <p className="text-xs text-gray-500">
          {horse.name} đã có yêu cầu đang chờ. Yêu cầu cùng nguồn sẽ được gộp thêm một dòng vào yêu cầu cũ.
        </p>
      )}
      {action.error && !['horseId', 'description'].includes(action.field ?? '') && <ErrorBox message={action.error} />}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button variant={urgency === 'URGENT' ? 'danger' : 'primary'} onClick={submit} disabled={action.pending || !horseId}>
          {action.pending ? 'Đang gửi…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

/* ===== Bỏ qua yêu cầu khám (F3.4) ===== */

export function DismissRequestModal({
  request,
  onClose,
  onDone,
}: {
  request: { id: string; horseName: string; lines: string[] };
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { action, fieldError } = useFieldError();
  const [reason, setReason] = useState('');
  const submit = () =>
    action.run(
      () => dismissExamRequest(request.id, reason),
      () => {
        toast.push(`Đã bỏ qua yêu cầu khám của ${request.horseName}`, 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Bỏ qua yêu cầu khám — ${request.horseName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant="danger" onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Bỏ qua yêu cầu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3">
          <RequestLines lines={request.lines} />
        </div>
        <Field label="Lý do bỏ qua" required error={fieldError('reason')} hint="Người gửi nhận thông báo kèm lý do này.">
          <Textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Đã kiểm tra tại chuồng, chỉ là vết xước bề mặt"
          />
        </Field>
        {action.error && action.field !== 'reason' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Đóng bệnh án và chốt chi phí (F3.9) ===== */

export function CloseCaseModal({
  caseId,
  title,
  horseName,
  lock,
  onClose,
  onDone,
}: {
  caseId: string;
  title: string;
  horseName: string;
  lock?: { reason: string; expectedLiftDate?: string; linkedToCase: boolean };
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { action, fieldError } = useFieldError();
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'LIFT' | 'KEEP' | ''>('');
  const [liftReason, setLiftReason] = useState('');
  const [keepDate, setKeepDate] = useState(lock?.expectedLiftDate ?? '');
  const costValue = cost.trim() === '' ? NaN : Number(cost.replace(/[.\s]/g, ''));

  const submit = () =>
    action.run(
      () =>
        closeCase(caseId, {
          cost: costValue,
          closeNote: note,
          lockDecision: !lock
            ? undefined
            : decision === 'LIFT'
              ? { action: 'LIFT', reason: liftReason }
              : decision === 'KEEP'
                ? { action: 'KEEP', expectedLiftDate: keepDate }
                : undefined,
        }),
      () => {
        toast.push(`Đã đóng bệnh án "${title}"`, 'success');
        onDone();
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-xl"
      title="Đóng bệnh án"
      description={`${horseName} · ${title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || Number.isNaN(costValue) || (!!lock && !decision)}>
            {action.pending ? 'Đang lưu…' : 'Đóng bệnh án'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Chi phí điều trị (đồng)"
          required
          error={fieldError('cost')}
          hint={Number.isFinite(costValue) && costValue >= 0 ? `= ${formatMoney(costValue)}` : 'Nhập một lần khi đóng, không sửa được sau đó'}
        >
          <Input inputMode="numeric" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="Ví dụ: 12500000" />
        </Field>
        <Field label="Kết luận khi đóng" required error={fieldError('closeNote')}>
          <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Hồi phục hoàn toàn sau 2 tuần giảm tải" />
        </Field>

        {lock && (
          <div className={cn('space-y-3 rounded-xl p-4 ring-1', fieldError('lockDecision') ? 'bg-red-50/60 ring-red-200' : 'bg-amber-50/60 ring-amber-100')}>
            <p className="flex items-start gap-2 text-sm text-amber-900">
              <Lock size={15} className="mt-0.5 shrink-0" />
              <span>
                Ngựa còn khóa huấn luyện{lock.linkedToCase ? ' gắn với bệnh án này' : ''}: <span className="font-semibold">{lock.reason}</span>. Chọn gỡ khóa hoặc giữ khóa kèm ngày dự kiến gỡ.
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['LIFT', 'KEEP'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDecision(value)}
                  className={cn(
                    'rounded-xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition',
                    decision === value ? 'bg-white ring-2 ring-emerald-500' : 'bg-white/70 ring-gray-200 hover:ring-gray-300',
                  )}
                >
                  {value === 'LIFT' ? 'Gỡ khóa' : 'Giữ khóa'}
                  <span className="block text-xs font-normal text-gray-500">
                    {value === 'LIFT' ? 'Ghi "Gỡ khi đóng bệnh án"' : 'Khóa vẫn hiệu lực sau khi đóng'}
                  </span>
                </button>
              ))}
            </div>
            {decision === 'LIFT' && (
              <Field label="Lý do gỡ" required error={fieldError('lockReason')}>
                <Input value={liftReason} onChange={(event) => setLiftReason(event.target.value)} placeholder="Ví dụ: Đã hồi phục khi đóng bệnh án" />
              </Field>
            )}
            {decision === 'KEEP' && (
              <Field label="Ngày dự kiến gỡ" required error={fieldError('lockExpectedLiftDate')}>
                <Input type="date" value={keepDate} min={toDateKey(now())} onChange={(event) => setKeepDate(event.target.value)} />
              </Field>
            )}
          </div>
        )}

        <Notice tone="warning">
          Bệnh án đã đóng không mở lại được. Tái phát thì mở bệnh án mới. Chủ ngựa và quản lý nhận thông báo kèm chi phí.
        </Notice>
        {action.error && !['cost', 'closeNote', 'lockReason', 'lockExpectedLiftDate'].includes(action.field ?? '') && (
          <ErrorBox message={action.error} />
        )}
      </div>
    </Modal>
  );
}

/* ===== Ghi chú đính chính buổi khám ===== */

export function CorrectionModal({
  examinationId,
  examLabel,
  onClose,
  onDone,
}: {
  examinationId: string;
  examLabel: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { action, fieldError } = useFieldError();
  const [note, setNote] = useState('');
  const submit = () =>
    action.run(
      () => addExamCorrection(examinationId, note),
      () => {
        toast.push('Đã thêm ghi chú đính chính', 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title="Thêm ghi chú đính chính"
      description={examLabel}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : 'Thêm ghi chú'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Notice tone="info">Buổi khám đã lưu không sửa, không xóa. Ghi chú đính chính được lưu kèm tên bạn và thời điểm ghi.</Notice>
        <Field label="Nội dung đính chính" required error={fieldError('note')}>
          <Textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Bổ sung: siêu âm xác nhận tổn thương độ 1, không rách" />
        </Field>
        {action.error && action.field !== 'note' && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}
