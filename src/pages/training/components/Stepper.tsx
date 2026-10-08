// Ô số có nút trừ, cộng: số tuần của môn, cự ly, thời lượng, sĩ số.
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../../components/ui';

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  suffix,
  disabled,
  size = 'md',
  label,
  className = '',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Bước của nút trừ, cộng. Gõ tay thì nhận mọi số nguyên trong khoảng. */
  step?: number;
  suffix?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const button = cn(
    'flex items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30',
    size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
  );
  const width = Math.max(2, String(max).length) + 0.5;
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-lg bg-white p-1 ring-1 ring-gray-200', disabled && 'opacity-60', className)}>
      <button
        type="button"
        aria-label={label ? `Giảm ${label}` : 'Giảm'}
        className={button}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(step > 1 ? Math.ceil(value / step) * step - step : value - step))}
      >
        <Minus size={14} />
      </button>
      <input
        aria-label={label}
        type="number"
        inputMode="numeric"
        value={draft ?? (Number.isFinite(value) ? value : '')}
        min={min}
        max={max}
        disabled={disabled}
        style={{ width: `${width}ch` }}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = Number(event.target.value);
          if (event.target.value !== '' && Number.isFinite(next)) onChange(clamp(Math.round(next)));
        }}
        onBlur={() => setDraft(null)}
        className={cn(
          'bg-transparent text-center font-mono font-semibold text-gray-800 tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          size === 'sm' ? 'text-sm' : 'text-base',
        )}
      />
      {suffix && <span className="pr-1 text-xs text-gray-500">{suffix}</span>}
      <button
        type="button"
        aria-label={label ? `Tăng ${label}` : 'Tăng'}
        className={button}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(step > 1 ? Math.floor(value / step) * step + step : value + step))}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
