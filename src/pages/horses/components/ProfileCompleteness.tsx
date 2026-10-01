// Mức đầy đủ của hồ sơ khi thêm / sửa ngựa: vòng phần trăm + danh sách thông tin nên có.
// Bấm mục còn thiếu để cuộn tới đúng ô.
import { Check } from 'lucide-react';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { cn } from '../../../components/ui';
import { focusField } from '../../../lib/focus-field';

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
  /** Không bấm được (ví dụ khu khi sửa hồ sơ — đổi khu ở màn khác). */
  readOnly?: boolean;
}

export function ProfileCompleteness({ items }: { items: CompletenessItem[] }) {
  const done = items.filter((item) => item.done).length;
  const full = done === items.length;
  return (
    <div className="rounded-2xl bg-gray-50/80 p-4 ring-1 ring-gray-100">
      <div className="flex items-center gap-3">
        <ProgressRing value={done} max={items.length} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{full ? 'Hồ sơ đầy đủ' : 'Mức đầy đủ của hồ sơ'}</p>
          <p className="text-xs text-gray-500">{full ? 'Đã có mọi thông tin nên có.' : `Còn ${items.length - done} mục nên bổ sung, bấm để điền.`}</p>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              disabled={item.done || item.readOnly}
              onClick={() => focusField(item.key)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[13px] transition',
                item.done ? 'text-gray-600' : 'text-gray-500 hover:bg-white hover:text-emerald-800',
                'disabled:cursor-default disabled:hover:bg-transparent',
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  item.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-dashed border-gray-300 bg-white',
                )}
              >
                {item.done && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span className={cn('truncate', !item.done && 'underline decoration-gray-300 decoration-dotted underline-offset-4')}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
