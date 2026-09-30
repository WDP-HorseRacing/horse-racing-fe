// F3.11 — Lịch chăm sóc định kỳ (tiêm phòng, tẩy giun, kiểm tra móng).
// VET tạo, dời/giao lại, hủy, hoàn tất (kèm hẹn lần tới); Groom hoàn tất lịch được giao cho mình.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarPlus, Check, Syringe } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { getHorse } from '../../../api/horses';
import { cancelCareSchedule, completeCareSchedule, createCareSchedule, listCareSchedules, updateCareSchedule } from '../../../api/medical';
import type { CareSchedule, CareTaskType, Person } from '../../../api/types';
import {
  ActionMenu,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
  cn,
  useToast,
  type MenuAction,
} from '../../../components/ui';
import { CareStatusPill } from '../../../components/ui/status';
import { careTypeLabel } from '../../../lib/api-labels';
import { formatDateTime } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { useStore } from '../../../store/store';
import { links } from '../../../lib/links';
import { CARE_TYPES, careDaysLeft, useCareRights } from './care-rules';
import { usePeople, type People } from './people';
import { localToIso, toLocalInput, todayKey } from './utils';

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
  const user = useStore((state) => state.currentUser);
  const detail = useService(() => (horse.groom === undefined ? getHorse(horse.id).then((item) => item.groom) : Promise.resolve(horse.groom)), [horse.id]);
  const groom = detail.data ?? null;
  const people = usePeople(groom ? [groom] : []);

  const [type, setType] = useState<CareTaskType>((schedule?.type as CareTaskType | undefined) ?? 'VACCINATION');
  const [dueAt, setDueAt] = useState(() => {
    if (schedule) return toLocalInput(schedule.dueAt);
    const date = now();
    date.setDate(date.getDate() + 7);
    date.setHours(8, 0, 0, 0);
    return toLocalInput(date);
  });
  const [assignedTo, setAssignedTo] = useState(schedule?.assignedTo ?? '');
  const [notes, setNotes] = useState(schedule?.notes ?? '');
  const [reason, setReason] = useState('');

  const dueIso = localToIso(dueAt);
  const dueChanged = !!schedule && !!dueIso && new Date(dueIso).getTime() !== new Date(schedule.dueAt).getTime();
  const dayError = dueAt && dueAt.slice(0, 10) < todayKey() && (!schedule || dueChanged) ? 'Ngày đến hạn không được ở quá khứ' : undefined;

  const assignees: { id: string; label: string }[] = [];
  if (groom) assignees.push({ id: groom.id, label: `${groom.fullName} (Groom của ngựa)` });
  if (user && user.id !== groom?.id) assignees.push({ id: user.id, label: `Tôi (${user.name})` });
  if (schedule?.assignedTo && !assignees.some((item) => item.id === schedule.assignedTo)) {
    assignees.push({ id: schedule.assignedTo, label: `${people.name(schedule.assignedTo)} (đang được giao)` });
  }

  const submit = () =>
    action.run(
      async () => {
        if (!schedule) {
          return createCareSchedule(horse.id, {
            type,
            dueAt: dueIso!,
            ...(assignedTo ? { assignedTo } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          });
        }
        const patch: { dueAt?: string; assignedTo?: string | null; notes?: string | null; reason?: string } = {};
        if (dueChanged) {
          patch.dueAt = dueIso;
          patch.reason = reason.trim();
        }
        if ((schedule.assignedTo ?? '') !== assignedTo) patch.assignedTo = assignedTo || null;
        if ((schedule.notes ?? '') !== notes.trim()) patch.notes = notes.trim() || null;
        return updateCareSchedule(schedule.id, patch);
      },
      () => {
        toast.push(schedule ? `Đã cập nhật lịch ${careTypeLabel[schedule.type].toLowerCase()} của ${horse.name}` : `Đã tạo lịch ${careTypeLabel[type].toLowerCase()} cho ${horse.name}`, 'success');
        onDone();
      },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={schedule ? `Sửa lịch ${careTypeLabel[schedule.type].toLowerCase()}` : 'Tạo lịch chăm sóc'}
      description={horse.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || !dueIso || !!dayError || (dueChanged && !reason.trim())}>
            {action.pending ? 'Đang lưu…' : schedule ? 'Lưu thay đổi' : 'Tạo lịch'}
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
        <Field label="Ngày đến hạn" required error={dayError} hint="Hệ thống nhắc bác sĩ và người được giao lúc 7 giờ sáng ngày đến hạn.">
          <Input type="datetime-local" value={dueAt} min={`${todayKey()}T00:00`} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        {dueChanged && (
          <Field label="Lý do dời ngày" required>
            <Input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Chờ lô vắc-xin mới" />
          </Field>
        )}
        <Field label="Người thực hiện" hint={groom ? 'Groom chỉ nhận nhắc và hoàn tất được khi còn phụ trách ngựa.' : 'Ngựa chưa có Groom phụ trách.'}>
          {detail.loading && !detail.data ? (
            <Skeleton rows={1} />
          ) : (
            <Select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
              <option value="">Chưa giao</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ghi chú" hint="Không bắt buộc">
          <Textarea rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ví dụ: Vắc-xin cúm ngựa, mũi nhắc lại" />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
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
  const submit = () =>
    action.run(
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
  return (
    <Modal
      open
      onClose={onClose}
      title={`Hoàn tất ${careTypeLabel[schedule.type].toLowerCase()}`}
      description={`${horseName} · đến hạn ${formatDateTime(schedule.dueAt)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button onClick={submit} disabled={action.pending || (!!next && next.slice(0, 10) < todayKey())}>
            <Check size={15} /> {action.pending ? 'Đang lưu…' : 'Hoàn tất'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {schedule.notes && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{schedule.notes}</p>}
        {manage ? (
          <Field label="Hẹn lần tới" hint="Không bắt buộc. Nhập thì hệ thống tạo lịch mới cùng loại, giữ người được giao nếu còn hợp lệ.">
            <Input type="datetime-local" value={next} min={`${todayKey()}T00:00`} onChange={(event) => setNext(event.target.value)} />
          </Field>
        ) : (
          <p className="text-sm text-gray-600">Xác nhận bạn đã thực hiện xong. Bác sĩ sẽ hẹn lần tiếp theo nếu cần.</p>
        )}
        {action.error && <ErrorBox message={action.error} />}
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
  const submit = () =>
    action.run(
      () => cancelCareSchedule(schedule.id, reason.trim()),
      () => {
        toast.push(`Đã hủy lịch ${careTypeLabel[schedule.type].toLowerCase()} của ${horseName}`, 'success');
        onDone();
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={`Hủy lịch ${careTypeLabel[schedule.type].toLowerCase()}`}
      description={`${horseName} · đến hạn ${formatDateTime(schedule.dueAt)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant="danger" onClick={submit} disabled={action.pending || !reason.trim()}>
            {action.pending ? 'Đang hủy…' : 'Hủy lịch'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Lý do hủy" required>
          <Textarea rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Đã tiêm tại trạm thú y bên ngoài" />
        </Field>
        {action.error && <ErrorBox message={action.error} />}
      </div>
    </Modal>
  );
}

/* ===== Hộp thoại theo thao tác (dùng chung giữa tab ngựa và trang lịch chăm sóc) ===== */

export type CareDialog =
  | { kind: 'edit'; horse: { id: string; name: string; groom?: Person | null }; schedule: CareSchedule }
  | { kind: 'complete'; horseName: string; schedule: CareSchedule }
  | { kind: 'cancel'; horseName: string; schedule: CareSchedule }
  | null;

export function CareDialogs({ dialog, onClose, onDone }: { dialog: CareDialog; onClose: () => void; onDone: () => void }) {
  if (!dialog) return null;
  const done = () => {
    onClose();
    onDone();
  };
  if (dialog.kind === 'edit') return <CareFormModal horse={dialog.horse} schedule={dialog.schedule} onClose={onClose} onDone={done} />;
  if (dialog.kind === 'complete') return <CompleteCareModal schedule={dialog.schedule} horseName={dialog.horseName} onClose={onClose} onDone={done} />;
  return <CancelCareModal schedule={dialog.schedule} horseName={dialog.horseName} onClose={onClose} onDone={done} />;
}

/** Nút thao tác cho một lịch: hoàn tất nổi bật, sửa/hủy trong menu. */
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
  if (schedule.status !== 'SCHEDULED') return null;
  const menu: MenuAction[] = rights.manage
    ? [
        { label: 'Dời ngày, giao lại, ghi chú', onSelect: () => onDialog({ kind: 'edit', horse, schedule }) },
        { label: 'Hủy lịch', danger: true, onSelect: () => onDialog({ kind: 'cancel', horseName: horse.name, schedule }) },
      ]
    : [];
  return (
    <div className="flex items-center justify-end gap-1">
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
          : `Đến hạn ${formatDateTime(schedule.dueAt)} · ${schedule.assignedTo ? people.name(schedule.assignedTo) : 'chưa giao người thực hiện'}`}
      </p>
      {schedule.status === 'CANCELLED' && schedule.cancelReason && <p className="mt-0.5 text-xs text-gray-500">Hủy: {schedule.cancelReason}</p>}
      {schedule.notes && schedule.status === 'SCHEDULED' && <p className="mt-1 text-sm text-gray-700">{schedule.notes}</p>}
    </div>
  );
}

/** Mục lịch chăm sóc trong hồ sơ ngựa. Groom chỉ thấy lịch được giao cho mình (backend lọc). */
export function CareScheduleSection({
  horse,
  readOnly = false,
}: {
  horse: { id: string; name: string; groom: Person | null };
  /** Ngựa đã chuyển nhượng: chỉ xem. */
  readOnly?: boolean;
}) {
  const list = useService(() => listCareSchedules(horse.id), [horse.id]);
  const people = usePeople(horse.groom ? [horse.groom] : []);
  const rights = useCareRights();
  const user = useStore((state) => state.currentUser);
  const [dialog, setDialog] = useState<CareDialog>(null);
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const rows = list.data ?? [];
  const upcoming = rows.filter((row) => row.status === 'SCHEDULED');
  const history = rows.filter((row) => row.status !== 'SCHEDULED').reverse();
  const isGroomOnly = user?.role === 'GROOM';

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
        Lịch chăm sóc
      </SectionTitle>
      {list.loading && !list.data ? (
        <Skeleton rows={2} />
      ) : list.error ? (
        <ErrorBox message={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          className="py-6"
          title={isGroomOnly ? 'Không có lịch nào giao cho bạn' : 'Chưa có lịch chăm sóc'}
          hint={isGroomOnly ? 'Bác sĩ giao lịch tiêm phòng, tẩy giun, kiểm tra móng cho Groom phụ trách ngựa.' : 'Tiêm phòng, tẩy giun, kiểm tra móng định kỳ do bác sĩ lên lịch.'}
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
                    <li key={row.id}>
                      <CareLine schedule={row} people={people} />
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
