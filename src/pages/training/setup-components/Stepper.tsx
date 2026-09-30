// Ô số có nút trừ/cộng — dùng cho số tuần, số buổi mỗi tuần, sĩ số.
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../../components/ui';

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  suffix,
  disabled,
  size = 'md',
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const button = cn(
    'flex items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30',
    size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
  );
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-white p-1 ring-1 ring-gray-200',
        disabled && 'opacity-60',
      )}
    >
      <button
        type="button"
        aria-label={label ? `Giảm ${label}` : 'Giảm'}
        className={button}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus size={14} />
      </button>
      <input
        aria-label={label}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(Number.isFinite(next) ? clamp(Math.round(next)) : min);
        }}
        className={cn(
          'w-10 bg-transparent text-center font-semibold text-gray-800 tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          size === 'sm' ? 'text-sm' : 'text-base',
        )}
      />
      {suffix && <span className="pr-1 text-xs text-gray-500">{suffix}</span>}
      <button
        type="button"
        aria-label={label ? `Tăng ${label}` : 'Tăng'}
        className={button}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
