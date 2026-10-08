// Ô nhập thời gian chạy dạng "1:15.40" (phút:giây.phần trăm giây). Giá trị ngoài là mili giây.
import { useState } from 'react';
import { Timer } from 'lucide-react';
import { cn, invalidClass } from '../../../components/ui';
import { formatRaceTime, parseRaceTime } from '../../../lib/training-format';

export function RaceTimeInput({
  value,
  onChange,
  invalid,
  placeholder = '1:15.00',
  autoFocus,
  name,
  className = '',
}: {
  value: number | undefined;
  onChange: (ms: number | undefined, raw: string) => void;
  invalid?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  name?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? formatRaceTime(value) : '');
  return (
    <div className={cn('relative', className)}>
      <Timer size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        name={name}
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={shown}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseRaceTime(event.target.value), event.target.value);
        }}
        onBlur={() => setDraft(null)}
        className={cn(
          'w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 font-mono text-sm tabular-nums text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15',
          invalid && invalidClass,
        )}
      />
    </div>
  );
}
