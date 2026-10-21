// F4.3 — Việc chăm sóc riêng của ngựa: HLV khu và bác sĩ gắn, gỡ (bác sĩ đổi thì HLV khu được báo), Quản lý CLB, Groom xem. Hai kiểu:
// - Gắn thêm (vd "Ngâm chân nước đá 10/10 đến 17/10"): loại việc không áp mọi ngựa, cộng vào checklist mỗi ngày trong khoảng.
// - Miễn việc chung (vd không tắm 5 ngày vì ngựa sốt): loại việc đang áp mọi ngựa, bỏ khỏi checklist trong khoảng, lý do bắt buộc.
// Gắn từ hôm nay thì checklist hôm nay đổi ngay. Gỡ: chưa tới ngày bắt đầu thì xóa hẳn, đang chạy thì kết thúc sớm.
import { useState } from 'react';
import { CalendarPlus, ChevronDown, Trash2 } from 'lucide-react';
import { attachCareTask, listHorseCareTasks, listTaskTypes, removeCareTask } from '../../../api/stable-care';
import type { HorseCareTask, HorseCareTaskMode } from '../../../api/types';
import { Button, ConfirmDialog, ErrorBox, Field, Modal, Pill, Segmented, Select, Skeleton, Textarea, cn, useToast } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useAction, useService } from '../../../hooks/useService';
import { addDateKey, clubToday, diffDateKeys } from '../../../lib/club-time';
import { formatDateShort } from '../../../lib/format';
import { textError } from '../../../lib/stable-labels';

const MAX_DAYS = 366;

function taskState(task: HorseCareTask, today: string): 'running' | 'upcoming' | 'ended' {
  if (task.toDate < today) return 'ended';
  return task.fromDate > today ? 'upcoming' : 'running';
}

export function CareTasksSection({
  horse,
  canManage,
  notifyTrainer = false,
  onChanged,
  className,
}: {
  horse: { id: string; name: string };
  canManage: boolean;
  /** Bác sĩ thao tác: nhắc rằng HLV khu nhận thông báo. */
  notifyTrainer?: boolean;
  onChanged?: () => void;
  className?: string;
}) {
  const toast = useToast();
  const today = clubToday();
  const tasks = useService(() => listHorseCareTasks(horse.id), [horse.id]);
  const [attaching, setAttaching] = useState(false);
  const [removing, setRemoving] = useState<HorseCareTask | null>(null);
  const [showEnded, setShowEnded] = useState(false);
  const remove = useAction();

  const rows = tasks.data ?? [];
  const live = rows.filter((task) => taskState(task, today) !== 'ended').sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  const ended = rows.filter((task) => taskState(task, today) === 'ended');

  const row = (task: HorseCareTask) => {
    const state = taskState(task, today);
    const exempt = task.mode === 'EXEMPT';
    return (
      <li
        key={task.id}
        className={cn(
          'flex items-start gap-3 rounded-xl px-3 py-2.5 ring-1',
          state !== 'running' ? 'bg-white ring-gray-200/80' : exempt ? 'bg-amber-50/70 ring-amber-100' : 'bg-emerald-50/60 ring-emerald-100',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
            {exempt ? <span className="text-amber-900">Miễn: {task.taskType.name}</span> : task.taskType.name}
            <Pill tone={state === 'running' ? 'green' : state === 'upcoming' ? 'amber' : 'gray'}>{state === 'running' ? 'Đang áp dụng' : state === 'upcoming' ? 'Sắp tới' : 'Đã kết thúc'}</Pill>
          </p>
          <p className="text-xs text-gray-500">
            {task.fromDate === task.toDate ? `Ngày ${formatDateShort(task.fromDate)}` : `${formatDateShort(task.fromDate)} đến ${formatDateShort(task.toDate)}`} · {task.creator.fullName}
          </p>
          {task.note && <p className="mt-0.5 text-xs text-gray-600">{exempt ? `Lý do: ${task.note}` : task.note}</p>}
        </div>
        {canManage && state !== 'ended' && (
          <Button variant="ghost" size="icon" title={exempt ? 'Gỡ miễn' : 'Gỡ việc'} onClick={() => setRemoving(task)}>
            <Trash2 size={15} />
          </Button>
        )}
      </li>
    );
  };

  return (
    <section className={cn('rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">Việc riêng của ngựa</h3>
          {notifyTrainer && canManage && <p className="text-xs text-gray-500">Bạn gắn, miễn hay gỡ việc thì HLV khu nhận thông báo.</p>}
        </div>
        {canManage && (
          <Button variant="inline" size="sm" onClick={() => setAttaching(true)}>
            <CalendarPlus size={14} /> Thêm hoặc miễn việc
          </Button>
        )}
      </div>
      {tasks.loading && !tasks.data ? (
        <Skeleton rows={2} />
      ) : tasks.error ? (
        <ErrorBox message={tasks.error} />
      ) : (
        <>
          {live.length === 0 ? <p className="text-sm text-gray-500">Chưa có việc riêng.</p> : <ul className="space-y-2">{live.map(row)}</ul>}
          {ended.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowEnded((open) => !open)} className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
                <ChevronDown size={15} className={cn('transition', showEnded && 'rotate-180')} /> Đã kết thúc ({ended.length})
              </button>
              {showEnded && <ul className="mt-2 space-y-2">{ended.map(row)}</ul>}
            </div>
          )}
        </>
      )}

      {attaching && (
        <AttachTaskDialog
          horse={horse}
          onClose={() => setAttaching(false)}
          onDone={(task) => {
            const what = task.mode === 'EXEMPT' ? `Đã miễn ${task.taskType.name}` : `Đã thêm ${task.taskType.name}`;
            toast.push(task.fromDate === today ? what : `${what} từ ${formatDateShort(task.fromDate)}`, 'success');
            tasks.reload();
            onChanged?.();
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        title={removing?.mode === 'EXEMPT' ? `Gỡ miễn ${removing.taskType.name}` : `Gỡ ${removing?.taskType.name ?? 'việc'}`}
        message={
          removing?.mode === 'EXEMPT'
            ? `${removing.taskType.name} có lại trong checklist từ hôm nay, Groom được báo.`
            : removing && removing.fromDate > today
              ? 'Việc này sẽ bị xóa.'
              : 'Việc dừng từ ngày mai.'
        }
        confirmLabel="Gỡ"
        pending={remove.pending}
        onClose={() => {
          remove.clearError();
          setRemoving(null);
        }}
        onConfirm={() =>
          removing &&
          void remove.run(
            () => removeCareTask(removing.id),
            () => {
              toast.push(`Đã gỡ ${removing.taskType.name}`, 'success');
              setRemoving(null);
              tasks.reload();
              onChanged?.();
            },
          )
        }
      >
        {remove.error && <ErrorBox message={remove.error} />}
      </ConfirmDialog>
    </section>
  );
}

function AttachTaskDialog({ horse, onClose, onDone }: { horse: { id: string; name: string }; onClose: () => void; onDone: (task: HorseCareTask) => void }) {
  const today = clubToday();
  const action = useAction();
  const [mode, setMode] = useState<HorseCareTaskMode>('EXTRA');
  const exempt = mode === 'EXEMPT';
  // Gắn thêm: loại đang dùng và không áp mọi ngựa. Miễn: loại đang dùng và đang áp mọi ngựa.
  const allTypes = useService(async () => (await listTaskTypes()).filter((type) => type.active), []);
  const types = { ...allTypes, data: allTypes.data?.filter((type) => type.appliesToAll === exempt) };
  const [typeId, setTypeId] = useState('');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(addDateKey(today, 6));
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const chosenType = (types.data?.some((type) => type.id === typeId) ? typeId : '') || types.data?.[0]?.id || '';

  const errors = {
    type: !chosenType ? 'Chọn loại việc' : undefined,
    from: !fromDate ? 'Chọn ngày bắt đầu' : fromDate < today ? 'Không chọn ngày đã qua' : undefined,
    to: !toDate ? 'Chọn ngày kết thúc' : toDate < fromDate ? 'Ngày kết thúc không được trước ngày bắt đầu' : diffDateKeys(fromDate, toDate) + 1 > MAX_DAYS ? `Tối đa ${MAX_DAYS} ngày` : undefined,
    note: textError(note, { label: exempt ? 'Lý do' : 'Ghi chú', max: 200, required: exempt }),
  };

  const submit = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    void action.run(
      () => attachCareTask(horse.id, { taskTypeId: chosenType, fromDate, toDate, mode, ...(note.trim() ? { note: note.trim() } : {}) }),
      (task) => {
        onDone(task);
        onClose();
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Việc riêng của ${horse.name}`}
      description={exempt ? 'Checklist của ngựa không có việc này trong khoảng đã chọn, hết hạn thì tự có lại.' : 'Groom sẽ thấy việc này mỗi ngày trong khoảng đã chọn.'}
      dirty={!!typeId || exempt || fromDate !== today || toDate !== addDateKey(today, 6) || note !== ''}
      onSave={submit}
      saveLabel={exempt ? 'Miễn' : 'Thêm'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || types.loading}>
            {action.pending ? 'Đang lưu…' : exempt ? 'Miễn việc' : 'Thêm'}
          </Button>
        </>
      }
    >
      <Segmented<HorseCareTaskMode>
        value={mode}
        onChange={(value) => {
          setMode(value);
          setTouched(false);
          action.clearError();
        }}
        options={[
          { value: 'EXTRA', label: 'Gắn thêm việc' },
          { value: 'EXEMPT', label: 'Miễn việc chung' },
        ]}
      />
      <div className="mt-4" />
      {types.loading && !types.data ? (
        <Skeleton rows={3} />
      ) : types.error ? (
        <ErrorBox message={types.error} />
      ) : types.data?.length === 0 ? (
        <ErrorBox message={exempt ? 'Chưa có loại việc nào áp mọi ngựa để miễn.' : 'Chưa có loại việc riêng nào. Nhờ Quản lý CLB thêm ở trang Chăm sóc khu.'} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={exempt ? 'Việc chung được miễn' : 'Loại việc'} required error={touched ? errors.type : undefined} className="sm:col-span-2">
            <Select value={chosenType} onChange={(event) => setTypeId(event.target.value)}>
              {types.data?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Từ ngày" required error={touched ? errors.from : undefined}>
            <DatePicker value={fromDate} onChange={setFromDate} min={today} clearable={false} invalid={touched && !!errors.from} />
          </Field>
          <Field label="Đến ngày" required error={touched ? errors.to : undefined}>
            <DatePicker value={toDate} onChange={setToDate} min={fromDate || today} clearable={false} invalid={touched && !!errors.to} />
          </Field>
          <Field label={exempt ? 'Lý do miễn' : 'Ghi chú'} required={exempt} error={touched ? errors.note : undefined} className="sm:col-span-2">
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={exempt ? 'Ví dụ: Ngựa sốt, không tắm trong 5 ngày' : 'Ví dụ: Ngâm 15 phút sau buổi tập, nước có đá'}
            />
          </Field>
          {action.error && (
            <div className="sm:col-span-2">
              <ErrorBox message={action.error} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
