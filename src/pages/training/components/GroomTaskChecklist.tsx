// Ba việc của Groom cho một ngựa trong một buổi: chuẩn bị, đưa ra sân, chăm sóc sau tập.
import { Check, Footprints, Sparkles, Wrench } from 'lucide-react';
import type { GroomTaskKind } from '../../../types/domain';
import { Tip, cn, useToast } from '../../../components/ui';
import { useAction } from '../../../hooks/useService';
import { setGroomTask, type TaskView } from '../../../services/session.service';
import { formatTime } from '../../../lib/format';

const ICONS: Record<GroomTaskKind, typeof Check> = {
  PREPARE: Wrench,
  TO_TRACK: Footprints,
  COOL_DOWN: Sparkles,
};

export default function GroomTaskChecklist({
  sessionId,
  horseId,
  tasks,
  onChanged,
  readOnly = false,
  className = '',
}: {
  sessionId: string;
  horseId: string;
  tasks: TaskView[];
  onChanged?: () => void;
  /** Chỉ hiện trạng thái, không bấm được (người xem không dắt ngựa). */
  readOnly?: boolean;
  className?: string;
}) {
  const action = useAction();
  const toast = useToast();

  const toggle = async (task: TaskView) => {
    const done = await action.run(() => setGroomTask(sessionId, horseId, task.kind, !task.done));
    if (done === undefined) return;
    toast.push(task.done ? `Đã bỏ đánh dấu "${task.label}"` : `Đã xong: ${task.label}`, 'success');
    onChanged?.();
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {tasks.map((task) => {
        const Icon = task.done ? Check : ICONS[task.kind];
        const clickable = !readOnly && task.canToggle && !action.pending;
        const detail = task.done
          ? `${task.byName ?? '—'} · ${formatTime(task.at)}`
          : readOnly
            ? 'Chưa làm'
            : (task.hint ?? 'Bấm khi đã làm xong');
        const chip = (
          <button
            type="button"
            aria-disabled={!clickable}
            onClick={() => {
              if (clickable) void toggle(task);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition',
              task.done
                ? 'bg-emerald-600 text-white shadow-[0_6px_14px_-8px_rgba(5,150,105,0.9)]'
                : 'bg-white text-gray-600 ring-1 ring-gray-200',
              clickable && !task.done && 'hover:bg-emerald-50 hover:text-emerald-800 hover:ring-emerald-200',
              clickable && task.done && 'hover:bg-emerald-500',
              !clickable && !task.done && 'text-gray-400 ring-gray-100',
              !clickable && 'cursor-default',
            )}
          >
            <Icon size={12} strokeWidth={task.done ? 3 : 2} />
            {task.label}
            {task.done && task.at && <span className="font-normal text-emerald-100">{formatTime(task.at)}</span>}
          </button>
        );
        return (
          <Tip key={task.kind} content={detail}>
            {chip}
          </Tip>
        );
      })}
      {action.error && <span className="w-full text-xs font-medium text-red-600">{action.error}</span>}
    </div>
  );
}
