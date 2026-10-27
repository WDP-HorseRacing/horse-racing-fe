// F3.11 — Lịch chăm sóc định kỳ (tiêm phòng, tẩy giun, kiểm tra móng).
// Lịch chỉ thuộc bác sĩ (BE 27/10): VET tạo, dời, giao lại, hủy, hoàn tất (kèm hẹn lần tới); vai trò khác chỉ xem.
// Giao một bác sĩ hoặc để chưa giao ai (mọi bác sĩ cùng thấy). Kiểm tra móng: thợ là người ngoài, bác sĩ hẹn rồi hoàn tất;
// cần Groom giữ ngựa thì bác sĩ hoặc HLV gắn việc riêng vào checklist của ngựa (nút "Nhờ Groom giữ ngựa").
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarPlus, Check, HandHelping, RotateCcw, Syringe } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { cancelCareSchedule, completeCareSchedule, createCareSchedule, listCareSchedules, reopenCareSchedule, updateCareSchedule } from '../../../api/medical';
import type { CareSchedule, CareTaskType, CareType, Person } from '../../../api/types';
import {
  ActionMenu,
  Button,
  CancelButton,
  Card,
  CharCount,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  Pill,
  SectionTitle,
  Segmented,
  Skeleton,
  Textarea,
  cn,
  invalidClass,
  useToast,
  type MenuAction,
} from '../../../components/ui';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { CareStatusPill } from '../../../components/ui/status';
import { careTypeLabel } from '../../../lib/api-labels';
import { formatDateTime } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { useStore } from '../../../store/store';
import { links } from '../../../lib/links';
import { CARE_TYPES, assigneeText, careDaysLeft, careSavedText, groomAssistLink, useCareRights, vetLabel } from './care-rules';
import { usePeople, type People } from './people';
import { localToIso, toLocalInput, todayKey } from './utils';
import { DateTimePicker } from '../../../components/ui/DatePicker';

/** Hạn lịch chăm sóc: còn hạn xám · trong 3 ngày / quá hạn tới 7 ngày hổ phách · quá hạn hơn 7 ngày đỏ. */
export function CareDue({ dueAt, status = 'SCHEDULED' }: { dueAt: string; status?: CareSchedule['status'] }) {
  if (status !== 'SCHEDULED') return <CareStatusPill status={status} />;
  const days = careDaysLeft(dueAt);
  if (days < -7) return <Pill tone="red">Quá hạn {-days} ngày</Pill>;
  if (days < 0) return <Pill tone="amber">Quá hạn {-days} ngày</Pill>;
  if (days === 0) return <Pill tone="amber">Đến hạn hôm nay</Pill>;
  if (days <= 3) return <Pill tone="amber">Còn {days} ngày</Pill>;
  return <span className="text-xs text-gray-500">Còn {days} ngày</span>;
}

/* ===== Bác sĩ được giao ===== */

/**
 * Lịch chỉ thuộc bác sĩ. Bác sĩ không tải được danh sách bác sĩ khác (chỉ Quản lý CLB), nên chọn:
 * chưa giao ai, chính mình, hoặc giữ bác sĩ đang được giao (khi sửa). Giá trị rỗng là chưa giao ai.
 */
export function VetAssigneeField({
  horseId,
  type,
  value,
  onChange,
  current,
  error,
  className,
  hideLabel = false,
  name,
  onBlur,
}: {
  horseId?: string;
  type?: CareType;
  value: string;
  onChange: (value: string) => void;
  /** Bác sĩ đang được giao (khi sửa), để giữ làm một lựa chọn. */
  current?: { id: string; label: string };
  error?: string;
  className?: string;
  /** Ô nằm trong khối đã có tiêu đề. */
  hideLabel?: boolean;
  /** Tên ô cho scrollToFirstError. */
  name?: string;
  onBlur?: () => void;
}) {
  const user = useStore((state) => state.currentUser);
  const options: { value: string; label: string }[] = [{ value: '', label: 'Chưa giao ai' }];
  if (user?.role === 'VETERINARIAN') options.push({ value: user.id, label: `Tôi (${user.name})` });
  if (current && current.id !== user?.id) options.push({ value: current.id, label: `${vetLabel(current.label)} (đang được giao)` });
  return (
    <Field
      label={hideLabel ? undefined : 'Bác sĩ được giao'}
      error={error}
      name={name}
      onBlur={onBlur}
      className={className}
      hint={value ? 'Bác sĩ được giao thấy lịch ở Lịch của tôi và nhận nhắc cùng các bác sĩ khác.' : 'Chưa giao thì mọi bác sĩ cùng thấy và cùng được nhắc.'}
    >
      <div className="space-y-2">
        <Segmented<string> value={value} onChange={onChange} options={options} />
        {type === 'FARRIER' && (
          <p className="text-xs text-gray-500">
            Thợ móng là người ngoài: bác sĩ hẹn thợ, xong thì bấm hoàn tất. Cần Groom giữ ngựa thì gắn việc ở{' '}
            {horseId ? (
              <Link to={groomAssistLink(horseId)} className="font-medium text-emerald-700 hover:underline">
                tab Chăm sóc của ngựa
              </Link>
            ) : (
              'tab Chăm sóc của ngựa'
            )}
            .
          </p>
        )}
      </div>
    </Field>
  );
}

/* ===== Sửa lịch (tạo mới là trang riêng: CareNew) ===== */

export function CareFormModal({
  horse,
  schedule,
  onClose,
  onDone,
}: {
  horse: { id: string; name: string; groom?: Person | null };
  schedule?: CareSchedule;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const people = usePeople();

  const [type, setType] = useState<CareTaskType>((schedule?.type as CareTaskType | undefined) ?? 'VACCINATION');
  const [dueAt, setDueAt] = useState(() => {
    if (schedule) return toLocalInput(schedule.dueAt);
    const date = now();
    date.setDate(date.getDate() + 7);
    date.setHours(8, 0, 0, 0);
    return toLocalInput(date);
  });
  const user = useStore((state) => state.currentUser);
  const vetId = user?.role === 'VETERINARIAN' ? user.id : '';
  // Tạo mới: giao chính bác sĩ đang tạo. Sửa: giữ bác sĩ đang được giao (rỗng là chưa giao ai).
  const [assignee, setAssignee] = useState<string>(() => (schedule ? (schedule.assignedTo ?? '') : vetId));
  const [notes, setNotes] = useState(schedule?.notes ?? '');
  const [reason, setReason] = useState('');
  const [opened] = useState(() => JSON.stringify([type, dueAt, assignee, notes]));
  const dirty = JSON.stringify([type, dueAt, assignee, notes]) !== opened || reason.trim() !== '';
  const dueIso = localToIso(dueAt);
  const dueChanged = !!schedule && !!dueIso && new Date(dueIso).getTime() !== new Date(schedule.dueAt).getTime();
  const assigneeChanged = !!schedule && (schedule.assignedTo ?? '') !== assignee;
  const notesChanged = !!schedule && (schedule.notes ?? '') !== notes.trim();
  // Sửa lịch mà không đổi gì: báo ngay thay vì gửi PATCH rỗng.
  const [noChangeTried, setNoChangeTried] = useState(false);
  const nothingChanged = !!schedule && !dueChanged && !assigneeChanged && !notesChanged;

  const errors: Partial<Record<'dueAt' | 'reason' | 'assignee', string>> = {};
  if (!dueIso) errors.dueAt = 'Chọn ngày đến hạn';
  else if (dueAt.slice(0, 10) < todayKey() && (!schedule || dueChanged)) errors.dueAt = 'Ngày đến hạn không được ở quá khứ';
  if (dueChanged && !reason.trim()) errors.reason = 'Nhập lý do dời ngày';
  const serverErrors = { ...action.fieldErrors };
  if (serverErrors.assignedTo) serverErrors.assignee = serverErrors.assignedTo;
  const f = useFormErrors(errors, { fieldErrors: serverErrors, field: action.field, error: action.error });

  const current = schedule?.assignedTo ? { id: schedule.assignedTo, label: people.name(schedule.assignedTo, 'vet') } : undefined;
  const assigneeName = !assignee ? null : assignee === user?.id ? (user?.name ?? null) : (current?.label ?? null);

  const submit = () => {
    if (nothingChanged) {
      setNoChangeTried(true);
      return;
    }
    if (!f.attempt()) return;
    return action.run(
      async () => {
        if (!schedule) {
          return createCareSchedule(horse.id, {
            type,
            dueAt: dueIso!,
            ...(assignee ? { assignedTo: assignee } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          });
        }
        const patch: Parameters<typeof updateCareSchedule>[1] = {};
        if (dueChanged) {
          patch.dueAt = dueIso;
          patch.reason = reason.trim();
        }
        if (assigneeChanged) patch.assignedTo = assignee || null;
        if (notesChanged) patch.notes = notes.trim() || null;
        return updateCareSchedule(schedule.id, patch);
      },
      () => {
        toast.push(careSavedText(schedule ? 'Đã cập nhật' : 'Đã tạo', careTypeLabel[schedule?.type ?? type], horse.name, assigneeName, dueIso ?? schedule!.dueAt), 'success');
        onDone();
      },
    );
  };
  const saveLabel = schedule ? 'Lưu' : 'Tạo lịch';

  return (
    <Modal
      open
      onClose={onClose}
      title={schedule ? `Sửa lịch ${careTypeLabel[schedule.type].toLowerCase()}` : 'Tạo lịch chăm sóc'}
      description={horse.name}
      dirty={dirty}
      busy={action.pending}
      onSave={submit}
      saveLabel={saveLabel}
      footer={
        <>
          <CancelButton variant="secondary" />
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang lưu…' : saveLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!schedule && (
          <Field label="Loại" required>
            <div className="grid grid-cols-3 gap-2">
              {CARE_TYPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  aria-pressed={type === value}
                  className={cn(
                    'rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 transition',
                    type === value ? 'ring-2 ring-gray-900' : 'ring-1 ring-gray-200 hover:ring-gray-300',
                  )}
                >
                  {careTypeLabel[value]}
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Ngày đến hạn" required name="dueAt" error={f.show('dueAt')} onBlur={f.blur('dueAt')} hint="Nhắc lúc 5 giờ sáng ngày đến hạn.">
          <DateTimePicker
            value={dueAt}
            min={`${todayKey()}T00:00`}
            onChange={(value) => {
              setDueAt(value);
              setNoChangeTried(false);
              if (action.field) action.clearError();
            }}
            invalid={!!f.show('dueAt')}
          />
        </Field>
        {dueChanged && (
          <Field label="Lý do dời ngày" required name="reason" error={f.show('reason')} onBlur={f.blur('reason')}>
            <Input
              value={reason}
              maxLength={500}
              onChange={(event) => {
                setReason(event.target.value);
                if (action.field) action.clearError();
              }}
              placeholder="Ví dụ: Chờ lô vắc-xin mới" className={cn(f.show('reason') && invalidClass)} />
          </Field>
        )}
        <VetAssigneeField
          horseId={horse.id}
          type={schedule?.type ?? type}
          value={assignee}
          onChange={(value) => {
            setAssignee(value);
            setNoChangeTried(false);
            if (action.field) action.clearError();
          }}
          current={current}
          name="assignee"
          error={f.show('assignee')}
          onBlur={f.blur('assignee')}
        />
        <Field label="Ghi chú" hint="Không bắt buộc" counter={<CharCount value={notes} max={2000} />}>
          <Textarea
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setNoChangeTried(false);
            }}
            placeholder="Ví dụ: Vắc-xin cúm ngựa, mũi nhắc lại"
          />
        </Field>
        {noChangeTried && nothingChanged && (
          <p role="alert" className="text-sm font-medium text-red-600">
            Chưa có thay đổi. Đổi ngày, bác sĩ được giao hoặc ghi chú rồi lưu.
          </p>
        )}
        {action.error && !['dueAt', 'reason', 'assignedTo'].includes(action.field ?? '') && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Hoàn tất ===== */

export function CompleteCareModal({
  schedule,
  horseName,
  onClose,
  onDone,
}: {
  schedule: CareSchedule;
  horseName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const { manage } = useCareRights();
  const [next, setNext] = useState('');
  const f = useFormErrors(
    { next: next && next.slice(0, 10) < todayKey() ? 'Ngày hẹn lần tới đã qua, chọn từ hôm nay trở đi' : undefined },
    { fieldErrors: action.fieldErrors.nextDueAt ? { next: action.fieldErrors.nextDueAt } : undefined },
  );
  const submit = () => {
    if (!f.attempt()) return;
    return action.run(
      () => completeCareSchedule(schedule.id, manage ? localToIso(next) : undefined),
      (result) => {
        toast.push(
          result.next
            ? `Đã hoàn tất, hẹn lần tới ${formatDateTime(result.next.dueAt)}`
            : `Đã hoàn tất ${careTypeLabel[schedule.type].toLowerCase()} cho ${horseName}`,
          'success',
        );
        onDone();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Hoàn tất ${careTypeLabel[schedule.type].toLowerCase()}`}
      description={`${horseName} · đến hạn ${formatDateTime(schedule.dueAt)}`}
      dirty={next !== ''}
      busy={action.pending}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button onClick={submit} disabled={action.pending}>
            <Check size={15} /> {action.pending ? 'Đang lưu…' : 'Hoàn tất'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {schedule.notes && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{schedule.notes}</p>}
        {manage ? (
          <Field label="Hẹn lần tới" name="next" error={f.show('next')} onBlur={f.blur('next')} hint="Không bắt buộc. Có ngày thì tạo luôn lịch lần sau.">
            <DateTimePicker value={next} min={`${todayKey()}T00:00`} onChange={setNext} invalid={!!f.show('next')} />
          </Field>
        ) : (
          <p className="text-sm text-gray-600">Xác nhận bạn đã thực hiện xong. Bác sĩ sẽ hẹn lần tiếp theo nếu cần.</p>
        )}
        {action.error && !action.fieldErrors.nextDueAt && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Hủy lịch ===== */

export function CancelCareModal({
  schedule,
  horseName,
  onClose,
  onDone,
}: {
  schedule: CareSchedule;
  horseName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const f = useFormErrors({ reason: reason.trim() ? undefined : 'Nhập lý do hủy' }, { fieldErrors: action.fieldErrors });
  const submit = () => {
    if (!f.attempt()) return;
    return action.run(
      () => cancelCareSchedule(schedule.id, reason.trim()),
      () => {
        toast.push(`Đã hủy lịch ${careTypeLabel[schedule.type].toLowerCase()} của ${horseName}`, 'success');
        onDone();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Hủy lịch ${careTypeLabel[schedule.type].toLowerCase()}`}
      description={`${horseName} · đến hạn ${formatDateTime(schedule.dueAt)}`}
      dirty={reason.trim() !== ''}
      busy={action.pending}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button variant="danger" onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang hủy…' : 'Hủy lịch'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Lý do hủy" required name="reason" error={f.show('reason')} onBlur={f.blur('reason')} counter={<CharCount value={reason} max={500} />}>
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Đã tiêm tại trạm thú y bên ngoài"
            className={cn(f.show('reason') && invalidClass)}
          />
        </Field>
        {action.error && !action.fieldErrors.reason && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Mở lại lịch chăm sóc đã hoàn tất ===== */

export function ReopenCareModal({
  schedule,
  horseName,
  onClose,
  onDone,
}: {
  schedule: CareSchedule;
  horseName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const action = useAction();
  const [reason, setReason] = useState('');
  const f = useFormErrors({ reason: reason.trim() ? undefined : 'Nhập lý do mở lại' }, { fieldErrors: action.fieldErrors });
  const submit = () => {
    if (!f.attempt()) return;
    return action.run(
      () => reopenCareSchedule(schedule.id, reason.trim()),
      () => {
        toast.push(`Đã mở lại lịch ${careTypeLabel[schedule.type].toLowerCase()} của ${horseName}`, 'success');
        onDone();
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Mở lại lịch ${careTypeLabel[schedule.type].toLowerCase()}`}
      description={`${horseName} · hoàn tất ${schedule.completedAt ? formatDateTime(schedule.completedAt) : ''}`}
      dirty={reason.trim() !== ''}
      busy={action.pending}
      footer={
        <>
          <CancelButton variant="secondary">Quay lại</CancelButton>
          <Button onClick={submit} disabled={action.pending}>
            {action.pending ? 'Đang mở lại…' : 'Mở lại lịch'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Lý do mở lại"
          required
          name="reason"
          error={f.show('reason')}
          onBlur={f.blur('reason')}
          hint="Lịch quay về Đang chờ thực hiện."
          counter={<CharCount value={reason} max={500} />}
        >
          <Textarea
            rows={3}
            autoFocus
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Bấm nhầm hoàn tất, cần kiểm tra lại"
            className={cn(f.show('reason') && invalidClass)}
          />
        </Field>
        {action.error && !action.fieldErrors.reason && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Hộp thoại theo thao tác (dùng chung giữa tab ngựa và trang lịch chăm sóc) ===== */

export type CareDialog =
  | { kind: 'edit'; horse: { id: string; name: string; groom?: Person | null }; schedule: CareSchedule }
  | { kind: 'complete'; horseName: string; schedule: CareSchedule }
  | { kind: 'cancel'; horseName: string; schedule: CareSchedule }
  | { kind: 'reopen'; horseName: string; schedule: CareSchedule }
  | null;

export function CareDialogs({ dialog, onClose, onDone }: { dialog: CareDialog; onClose: () => void; onDone: () => void }) {
  if (!dialog) return null;
  const done = () => {
    onClose();
    onDone();
  };
  if (dialog.kind === 'edit') return <CareFormModal horse={dialog.horse} schedule={dialog.schedule} onClose={onClose} onDone={done} />;
  if (dialog.kind === 'complete') return <CompleteCareModal schedule={dialog.schedule} horseName={dialog.horseName} onClose={onClose} onDone={done} />;
  if (dialog.kind === 'reopen') return <ReopenCareModal schedule={dialog.schedule} horseName={dialog.horseName} onClose={onClose} onDone={done} />;
  return <CancelCareModal schedule={dialog.schedule} horseName={dialog.horseName} onClose={onClose} onDone={done} />;
}

/** Nút thao tác cho một lịch: hoàn tất nổi bật (chỉ bác sĩ), sửa/hủy trong menu, mở lại cho lịch đã xong.
 *  Lịch kiểm tra móng còn chờ: bác sĩ và HLV có nút "Nhờ Groom giữ ngựa" (gắn việc riêng vào checklist, BE kiểm khu của HLV). */
export function CareRowActions({
  schedule,
  horse,
  onDialog,
}: {
  schedule: CareSchedule;
  horse: { id: string; name: string; groom?: Person | null };
  onDialog: (dialog: CareDialog) => void;
}) {
  const rights = useCareRights();
  const navigate = useNavigate();
  const role = useStore((state) => state.currentUser?.role);
  if (schedule.status === 'COMPLETED') {
    const canReopen = rights.manage && (schedule.type === 'VACCINATION' || schedule.type === 'DEWORMING' || schedule.type === 'FARRIER');
    if (!canReopen) return null;
    return (
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="inline" onClick={() => onDialog({ kind: 'reopen', horseName: horse.name, schedule })}>
          <RotateCcw size={13} /> Mở lại
        </Button>
      </div>
    );
  }
  if (schedule.status !== 'SCHEDULED') return null;
  const menu: MenuAction[] = rights.manage
    ? [
        { label: 'Dời ngày, giao lại, ghi chú', onSelect: () => onDialog({ kind: 'edit', horse, schedule }) },
        { label: 'Hủy lịch', danger: true, onSelect: () => onDialog({ kind: 'cancel', horseName: horse.name, schedule }) },
      ]
    : [];
  const canAssist = schedule.type === 'FARRIER' && (role === 'VETERINARIAN' || role === 'HEAD_TRAINER');
  return (
    <div className="flex items-center justify-end gap-1">
      {canAssist && (
        <Button size="sm" variant="inline" title="Gắn việc giữ ngựa vào checklist của Groom phụ trách" onClick={() => navigate(groomAssistLink(horse.id))}>
          <HandHelping size={14} /> Nhờ Groom giữ ngựa
        </Button>
      )}
      {rights.canComplete(schedule) && (
        <Button size="sm" variant="secondary" onClick={() => onDialog({ kind: 'complete', horseName: horse.name, schedule })}>
          <Check size={14} /> Hoàn tất
        </Button>
      )}
      <ActionMenu items={menu} />
    </div>
  );
}

/** Một dòng lịch: loại, hạn, người được giao, ghi chú. */
export function CareLine({ schedule, people }: { schedule: CareSchedule; people: People }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className={cn('font-semibold text-gray-900', schedule.status === 'CANCELLED' && 'text-gray-500 line-through decoration-gray-400')}>
          {careTypeLabel[schedule.type]}
        </span>
        <CareDue dueAt={schedule.dueAt} status={schedule.status} />
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {schedule.status === 'COMPLETED' && schedule.completedAt
          ? `Hoàn tất ${formatDateTime(schedule.completedAt)} · ${people.name(schedule.completedBy)}`
          : `Đến hạn ${formatDateTime(schedule.dueAt)} · ${assigneeText(schedule, (id) => people.name(id, 'vet'))}`}
      </p>
      {schedule.status === 'CANCELLED' && schedule.cancelReason && <p className="mt-0.5 text-xs text-gray-500">Hủy: {schedule.cancelReason}</p>}
      {schedule.notes && schedule.status === 'SCHEDULED' && <p className="mt-1 text-sm text-gray-700">{schedule.notes}</p>}
    </div>
  );
}

/** Mục lịch chăm sóc trong hồ sơ ngựa. Mọi vai trò xem được; chỉ bác sĩ thao tác. */
export function CareScheduleSection({
  horse,
  readOnly = false,
  title = 'Lịch chăm sóc',
}: {
  horse: { id: string; name: string; groom: Person | null };
  /** Ngựa đã chuyển nhượng: chỉ xem. */
  readOnly?: boolean;
  title?: string;
}) {
  const list = useService(() => listCareSchedules(horse.id), [horse.id]);
  const people = usePeople(horse.groom ? [horse.groom] : []);
  const rights = useCareRights();
  const [dialog, setDialog] = useState<CareDialog>(null);
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const rows = list.data ?? [];
  const upcoming = rows.filter((row) => row.status === 'SCHEDULED');
  const history = rows.filter((row) => row.status !== 'SCHEDULED').reverse();

  return (
    <Card>
      <SectionTitle
        icon={<Syringe size={16} />}
        action={
          rights.manage &&
          !readOnly && (
            <Button size="sm" variant="secondary" onClick={() => navigate(links.careNew(horse.id, `${location.pathname}${location.search}`))}>
              <CalendarPlus size={14} /> Tạo lịch
            </Button>
          )
        }
      >
        {title}
      </SectionTitle>
      {list.loading && !list.data ? (
        <Skeleton rows={2} />
      ) : list.error ? (
        <ErrorBox message={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          className="py-6"
          title="Chưa có lịch chăm sóc"
          hint="Tiêm phòng, tẩy giun, kiểm tra móng định kỳ do bác sĩ lên lịch."
        />
      ) : (
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-500">Không có lịch nào đang chờ thực hiện.</p>
          ) : (
            <ul className="-my-2 divide-y divide-gray-100">
              {upcoming.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                  <CareLine schedule={row} people={people} />
                  {!readOnly && <CareRowActions schedule={row} horse={horse} onDialog={setDialog} />}
                </li>
              ))}
            </ul>
          )}
          {history.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs font-medium text-gray-500 hover:text-gray-800">
                {showHistory ? 'Ẩn lịch đã xong' : `Xem ${history.length} lịch đã hoàn tất hoặc đã hủy`}
              </button>
              {showHistory && (
                <ul className="mt-2 space-y-2.5">
                  {history.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3">
                      <CareLine schedule={row} people={people} />
                      {!readOnly && <CareRowActions schedule={row} horse={horse} onDialog={setDialog} />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      <CareDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={list.reload} />
    </Card>
  );
}
