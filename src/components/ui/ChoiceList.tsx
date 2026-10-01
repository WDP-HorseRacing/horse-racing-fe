// Danh sách chọn một dạng thẻ (radio) thay cho <select> mặc định của trình duyệt:
// mỗi lựa chọn có ảnh/chữ cái, tên, dòng phụ, nhãn và (tùy chọn) thanh khối lượng việc.
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Avatar, cn } from './index';

export interface Choice {
  value: string;
  title: string;
  meta?: ReactNode;
  /** Nhãn nhỏ bên phải tên, ví dụ "Hiện tại". */
  badge?: string;
  disabled?: boolean;
  /** Thanh khối lượng việc: 0..1. */
  load?: number;
}

export function ChoiceList({
  label,
  choices,
  value,
  onChange,
  empty = 'Không có lựa chọn nào.',
  className = '',
}: {
  label: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  empty?: string;
  className?: string;
}) {
  if (choices.length === 0) return <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">{empty}</p>;
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={choice.disabled}
            onClick={() => onChange(choice.value)}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition',
              selected
                ? 'border-emerald-600 bg-emerald-50/60 shadow-[0_10px_24px_-18px_rgba(6,78,59,0.6)] ring-2 ring-emerald-500/15'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30',
              choice.disabled && 'cursor-not-allowed opacity-50 hover:border-gray-200 hover:bg-white',
            )}
          >
            <Avatar name={choice.title} size={36} className="rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-gray-900">{choice.title}</span>
                {choice.badge && <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">{choice.badge}</span>}
              </span>
              {choice.meta && <span className="block truncate text-xs text-gray-500">{choice.meta}</span>}
              {choice.load !== undefined && (
                <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-gray-200/70">
                  <span
                    className={cn('block h-full rounded-full', choice.load > 0.75 ? 'bg-amber-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.round(Math.min(1, Math.max(0.04, choice.load)) * 100)}%` }}
                  />
                </span>
              )}
            </span>
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white text-transparent',
              )}
              aria-hidden
            >
              <Check size={12} strokeWidth={3} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
