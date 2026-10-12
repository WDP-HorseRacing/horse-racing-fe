// Ô nhập thời gian chạy gồm hai ô [phút] : [giây]. Giây có thể lẻ tới phần trăm (14,8 hoặc 14.80). Giá trị ngoài là mili giây.
import { useRef, useState } from 'react';
import { cn, invalidClass } from '../../../components/ui';
import { formatRaceTime, minutePartValid, msFromParts, partsFromMs, secondPartValid } from '../../../lib/training-format';

const boxClass =
  'w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 font-mono text-sm tabular-nums text-gray-900 placeholder:text-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15';

/** Chỉ giữ chữ số, tối đa 2 chữ số. */
const cleanMinutes = (raw: string) => raw.replace(/\D/g, '').slice(0, 2);

/** Giữ chữ số và một dấu thập phân, tối đa 2 chữ số trước và 2 chữ số sau dấu. */
function cleanSeconds(raw: string) {
  const match = /^(\d{0,2})\d*([.,]?)(\d{0,2})/.exec(raw.replace(/[^\d.,]/g, ''));
  return match ? `${match[1]}${match[2]}${match[3]}` : '';
}

export function RaceTimeInput({
  value,
  onChange,
  invalid,
  autoFocus,
  name,
  className = '',
}: {
  value: number | undefined;
  /** `raw` rỗng khi cả hai ô trống, để nơi dùng phân biệt "chưa nhập" với "nhập sai". */
  onChange: (ms: number | undefined, raw: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  name?: string;
  className?: string;
}) {
  const [parts, setParts] = useState(() => partsFromMs(value));
  const [synced, setSynced] = useState(value);
  const secondsRef = useRef<HTMLInputElement>(null);

  // Giá trị ngoài đổi mà không phải do hai ô này gõ ra (mở lại form, đặt lại) thì nạp lại hai ô.
  if (value !== synced) {
    setSynced(value);
    if (value !== msFromParts(parts.minutes, parts.seconds)) setParts(partsFromMs(value));
  }

  const update = (next: { minutes: string; seconds: string }) => {
    setParts(next);
    const ms = msFromParts(next.minutes, next.seconds);
    setSynced(ms);
    onChange(ms, next.minutes || next.seconds ? `${next.minutes}:${next.seconds}` : '');
  };

  const minutesBad = !minutePartValid(parts.minutes);
  const secondsBad = !secondPartValid(parts.seconds);
  const ms = msFromParts(parts.minutes, parts.seconds);

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <div className="relative w-[4.75rem] shrink-0">
        <input
          name={name}
          aria-label="Phút"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="1"
          value={parts.minutes}
          onChange={(event) => {
            // Gõ hoặc dán "1:14.8" vào ô phút (bàn phím điện thoại không báo phím dấu hai chấm): tách sang ô giây.
            const split = /^([^:.,]*)[:.,](.*)$/.exec(event.target.value);
            if (split) {
              update({ minutes: cleanMinutes(split[1]), seconds: split[2] ? cleanSeconds(split[2]) : parts.seconds });
              secondsRef.current?.focus();
            } else update({ ...parts, minutes: cleanMinutes(event.target.value) });
          }}
          onKeyDown={(event) => {
            // Gõ dấu hai chấm hoặc dấu chấm ở ô phút thì nhảy sang ô giây.
            if (event.key === ':' || event.key === '.' || event.key === ',') {
              event.preventDefault();
              secondsRef.current?.focus();
            }
          }}
          className={cn(boxClass, 'pr-10', (minutesBad || invalid) && invalidClass)}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">phút</span>
      </div>
      <span className="font-mono text-lg font-semibold text-gray-300">:</span>
      <div className="relative min-w-[6.5rem] flex-1">
        <input
          ref={secondsRef}
          aria-label="Giây"
          inputMode="decimal"
          autoComplete="off"
          placeholder="15.00"
          value={parts.seconds}
          onChange={(event) => update({ ...parts, seconds: cleanSeconds(event.target.value) })}
          className={cn(boxClass, 'pr-10', (secondsBad || invalid) && invalidClass)}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">giây</span>
      </div>
      {secondsBad ? (
        <span className="shrink-0 text-xs font-medium text-red-600">Giây tối đa 59,99</span>
      ) : minutesBad ? (
        <span className="shrink-0 text-xs font-medium text-red-600">Phút tối đa 59</span>
      ) : (
        ms !== undefined && <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-800">= {formatRaceTime(ms)}</span>
      )}
    </div>
  );
}
