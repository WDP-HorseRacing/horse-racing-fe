// F4.3 — Việc chăm sóc riêng của ngựa (vd "Ngâm chân nước đá 10/10 đến 17/10"): HLV khu gắn và gỡ, Quản lý CLB, Groom xem.
// Việc riêng cộng vào checklist mỗi ngày trong khoảng. Gắn từ hôm nay thì checklist hôm nay có thêm dòng và Groom được báo.
// Gỡ: chưa tới ngày bắt đầu thì xóa hẳn, đang chạy thì kết thúc ở hôm nay.
import { useState } from 'react';
import { CalendarPlus, ChevronDown, Trash2 } from 'lucide-react';
import { attachCareTask, listHorseCareTasks, listTaskTypes, removeCareTask } from '../../../api/stable-care';
import type { HorseCareTask } from '../../../api/types';
import { Button, ConfirmDialog, ErrorBox, Field, Modal, Pill, Select, Skeleton, Textarea, cn, useToast } from '../../../components/ui';
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

export function CareTasksSection({ horse, canManage, onChanged, className }: { horse: { id: string; name: string }; canManage: boolean; onChanged?: () => void; className?: string }) {
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
    return (
      <li key={task.id} className={cn('flex items-start gap-3 rounded-xl px-3 py-2.5 ring-1', state === 'running' ? 'bg-emerald-50/60 ring-emerald-100' : 'bg-white ring-gray-200/80')}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
            {task.taskType.name}
            <Pill tone={state === 'running' ? 'green' : state === 'upcoming' ? 'amber' : 'gray'}>{state === 'running' ? 'Đang áp dụng' : state === 'upcoming' ? 'Sắp tới' : 'Đã kết thúc'}</Pill>
          </p>
          <p className="text-xs text-gray-500">
            {task.fromDate === task.toDate ? `Ngày ${formatDateShort(task.fromDate)}` : `${formatDateShort(task.fromDate)} đến ${formatDateShort(task.toDate)}`} · HLV {task.creator.fullName}
          </p>
          {task.note && <p className="mt-0.5 text-xs text-gray-600">{task.note}</p>}
        </div>
        {canManage && state !== 'ended' && (
          <Button variant="ghost" size="icon" title="Gỡ việc" onClick={() => setRemoving(task)}>
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
          <p className="text-xs text-gray-500">Cộng thêm vào checklist mỗi ngày trong khoảng đã chọn</p>
        </div>
        {canManage && (
          <Button variant="inline" size="sm" onClick={() => setAttaching(true)}>
            <CalendarPlus size={14} /> Gắn việc
          </Button>
        )}
      </div>
      {tasks.loading && !tasks.data ? (
        <Skeleton rows={2} />
      ) : tasks.error ? (
        <ErrorBox message={tasks.error} />
      ) : (
        <>
          {live.length === 0 ? <p className="text-sm text-gray-500">Không có việc riêng nào đang hoặc sắp áp dụng.</p> : <ul className="space-y-2">{live.map(row)}</ul>}
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
            toast.push(task.fromDate === today ? `Đã gắn ${task.taskType.name}, checklist hôm nay có thêm việc và Groom đã được báo` : `Đã gắn ${task.taskType.name} từ ${formatDateShort(task.fromDate)}`, 'success');
            tasks.reload();
            onChanged?.();
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        title={`Gỡ ${removing?.taskType.name ?? 'việc'}`}
        message={removing && removing.fromDate > today ? 'Việc chưa bắt đầu nên bị xóa hẳn.' : 'Việc đang chạy sẽ kết thúc ở hôm nay. Checklist hôm nay giữ nguyên.'}
        confirmLabel="Gỡ việc"
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
  // Chỉ loại đang dùng và không áp mọi ngựa mới gắn riêng được.
  const types = useService(async () => (await listTaskTypes()).filter((type) => type.active && !type.appliesToAll), []);
  const [typeId, setTypeId] = useState('');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(addDateKey(today, 6));
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const chosenType = typeId || types.data?.[0]?.id || '';

  const errors = {
    type: !chosenType ? 'Chọn loại việc' : undefined,
    from: !fromDate ? 'Chọn ngày bắt đầu' : fromDate < today ? 'Ngày bắt đầu không được ở quá khứ' : undefined,
    to: !toDate ? 'Chọn ngày kết thúc' : toDate < fromDate ? 'Ngày kết thúc phải từ ngày bắt đầu trở đi' : diffDateKeys(fromDate, toDate) + 1 > MAX_DAYS ? `Việc riêng kéo dài tối đa ${MAX_DAYS} ngày` : undefined,
    note: textError(note, { label: 'Ghi chú', max: 200, required: false }),
  };

  const submit = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    void action.run(
      () => attachCareTask(horse.id, { taskTypeId: chosenType, fromDate, toDate, ...(note.trim() ? { note: note.trim() } : {}) }),
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
      title={`Gắn việc riêng: ${horse.name}`}
      description="Việc được cộng vào checklist của Groom mỗi ngày trong khoảng này."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={action.pending || types.loading}>
            {action.pending ? 'Đang gắn…' : 'Gắn việc'}
          </Button>
        </>
      }
    >
      {types.loading && !types.data ? (
        <Skeleton rows={3} />
      ) : types.error ? (
        <ErrorBox message={types.error} />
      ) : types.data?.length === 0 ? (
        <ErrorBox message="Chưa có loại việc nào để gắn riêng. Quản lý CLB thêm loại việc không áp mọi ngựa ở trang Chăm sóc khu." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loại việc" required error={touched ? errors.type : undefined} className="sm:col-span-2">
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
          <Field label="Ghi chú" error={touched ? errors.note : undefined} className="sm:col-span-2">
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Ngâm 15 phút sau buổi tập, nước có đá" />
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
