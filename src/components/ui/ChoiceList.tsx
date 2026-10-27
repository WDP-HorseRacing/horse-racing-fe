// Danh sách chọn một dạng thẻ (radio) thay cho <select> mặc định của trình duyệt:
// mỗi lựa chọn có ảnh/chữ cái, tên, dòng phụ, nhãn và (tùy chọn) thanh khối lượng việc.
import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';
import { Avatar, cn } from './index';

export interface Choice {
  value: string;
  title: string;
  meta?: ReactNode;
  /** Nhãn nhỏ bên phải tên, ví dụ "Hiện tại". */
  badge?: string;
  disabled?: boolean;
  /** Lựa chọn đang áp dụng, không đổi được (ví dụ Groom đang phụ trách): xếp đầu, nền xanh nhạt, khóa thay radio, không mờ. */
  locked?: boolean;
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
      {[...choices].sort((a, b) => Number(!!b.locked) - Number(!!a.locked)).map((choice) => {
        const selected = !choice.locked && choice.value === value;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={choice.locked || undefined}
            disabled={choice.disabled || choice.locked}
            onClick={() => onChange(choice.value)}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition',
              selected
                ? 'border-emerald-600 bg-emerald-50/60 shadow-raised ring-2 ring-emerald-500/15'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30',
              choice.disabled && 'cursor-not-allowed opacity-50 hover:border-gray-200 hover:bg-white',
              choice.locked && 'cursor-default overflow-hidden border-emerald-200 bg-emerald-50/70 pl-4 hover:border-emerald-200 hover:bg-emerald-50/70',
            )}
          >
            {choice.locked && <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" aria-hidden />}
            <Avatar name={choice.title} size={36} className="rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-gray-900">{choice.title}</span>
                {choice.badge && (
                  <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium', choice.locked ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600')}>{choice.badge}</span>
                )}
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
            {choice.locked ? (
              <Lock size={15} className="shrink-0 text-emerald-700" aria-hidden />
            ) : (
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                  selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white text-transparent',
                )}
                aria-hidden
              >
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
