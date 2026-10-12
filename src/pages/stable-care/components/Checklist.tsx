// F4.1 — Checklist chăm sóc hằng ngày của một ngựa: các dòng việc (Cho ăn, Vệ sinh chuồng, Tắm rửa, Ngâm chân nước đá…).
// Groom được giao tick hoặc gỡ tick, chỉ trong ngày. Đổi ngay trên màn rồi gửi, lỗi thì trả lại như cũ.
// Ghi chú từng việc: bấm "Ghi chú", Enter hoặc rời ô để lưu. Ngày đã qua thì chỉ xem.
import { useState } from 'react';
import { Check, MessageSquarePlus } from 'lucide-react';
import { tickChecklistItem } from '../../../api/stable-care';
import type { ChecklistItem, ChecklistStatus, DailyChecklist } from '../../../api/types';
import { Pill, cn, useToast } from '../../../components/ui';
import { errorMessage } from '../../../lib/errors';
import { formatTime } from '../../../lib/format';
import { checklistStatusText } from '../../../lib/stable-labels';

const STATUS_TONE: Record<ChecklistStatus, 'gray' | 'amber' | 'green' | 'red'> = { PENDING: 'gray', IN_PROGRESS: 'amber', COMPLETED: 'green', INCOMPLETE: 'red' };

export function ChecklistPill({ status }: { status: ChecklistStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{checklistStatusText[status]}</Pill>;
}

export function ChecklistItems({
  checklist,
  editable,
  onChanged,
  large = false,
}: {
  checklist: DailyChecklist;
  /** Groom được giao, checklist của hôm nay. */
  editable: boolean;
  onChanged: (checklist: DailyChecklist) => void;
  /** Hàng tick lớn cho điện thoại (màn Việc hôm nay). */
  large?: boolean;
}) {
  const toast = useToast();
  // Giá trị tạm trong lúc chờ BE: id việc → đã xong hay chưa.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [noting, setNoting] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const save = async (item: ChecklistItem, done: boolean, note?: string | null) => {
    setPending((current) => ({ ...current, [item.id]: done }));
    try {
      onChanged(await tickChecklistItem(item.id, done, note));
    } catch (caught) {
      toast.push(errorMessage(caught), 'error');
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  };

  const saveNote = (item: ChecklistItem) => {
    const text = draft.trim().slice(0, 200);
    setNoting(null);
    if (text === (item.note ?? '')) return;
    void save(item, item.done, text || null);
  };

  return (
    <ul className={cn('space-y-1.5', large && 'space-y-2')}>
      {checklist.items.map((item) => {
        const done = pending[item.id] ?? item.done;
        const busy = item.id in pending;
        return (
          <li key={item.id} className={cn('rounded-xl ring-1 transition', done ? 'bg-emerald-50/70 ring-emerald-100' : 'bg-white ring-gray-200/80')}>
            <div className={cn('flex items-center gap-3', large ? 'px-3 py-3' : 'px-3 py-2')}>
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={item.name}
                disabled={!editable || busy}
                onClick={() => void save(item, !done)}
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-lg ring-2 transition disabled:cursor-default',
                  large ? 'h-9 w-9' : 'h-6 w-6',
                  done ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-transparent ring-gray-300',
                  editable && !done && 'hover:ring-emerald-500',
                  busy && 'opacity-60',
                )}
              >
                <Check size={large ? 20 : 15} strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('font-medium', large ? 'text-base' : 'text-sm', done ? 'text-emerald-900' : 'text-gray-900')}>{item.name}</p>
                {item.doneAt && done && (
                  <p className="text-xs text-gray-500">
                    {formatTime(item.doneAt)}
                    {item.doer ? ` · ${item.doer.fullName}` : ''}
                  </p>
                )}
              </div>
              {editable && noting !== item.id && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(item.note ?? '');
                    setNoting(item.id);
                  }}
                  title={item.note ? 'Sửa ghi chú' : 'Thêm ghi chú'}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <MessageSquarePlus size={16} />
                </button>
              )}
            </div>
            {noting === item.id ? (
              <div className="px-3 pb-2.5">
                <input
                  autoFocus
                  value={draft}
                  maxLength={200}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => saveNote(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveNote(item);
                    if (event.key === 'Escape') setNoting(null);
                  }}
                  placeholder="Ghi chú ngắn, Enter để lưu"
                  className="h-9 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ) : (
              item.note && <p className="px-3 pb-2 text-xs text-gray-600">{item.note}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
