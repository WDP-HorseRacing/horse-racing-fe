// Logo HorseRacing: đầu ngựa nét mảnh màu trắng kem trên ô xanh cỏ.
import { useId } from 'react';
import { cn } from './ui';
import { HORSE_PATH, HORSE_VIEWBOX } from './horse-path';

/** Độ dày thêm cho nét (đơn vị viewBox) theo cỡ hiển thị: càng nhỏ càng cần dày để đọc rõ. */
function boldFor(size: number) {
  if (size <= 28) return 22;
  if (size <= 44) return 16;
  if (size <= 96) return 10;
  return 5;
}

/**
 * Đầu ngựa nét mảnh. Màu lấy từ `currentColor` (hoặc `fill` truyền vào, ví dụ gradient).
 * `size` là cạnh hình vuông bao ngoài, tính bằng px.
 */
export function HorseLine({ size = 24, className = '', paint = 'currentColor', bold }: { size?: number; className?: string; paint?: string; bold?: number }) {
  return (
    <svg viewBox={HORSE_VIEWBOX} width={size} height={size} aria-hidden className={className}>
      <path d={HORSE_PATH} fill={paint} stroke={paint} strokeWidth={bold ?? boldFor(size)} strokeLinejoin="round" fillRule="evenodd" />
    </svg>
  );
}

/** Giữ tên cũ cho các chỗ còn dùng: nay là đầu ngựa nét mảnh. */
export function HorseMark({ size = 20, className = '' }: { size?: number; strokeWidth?: number; className?: string }) {
  return <HorseLine size={size} className={className} />;
}

/** Ô logo bo góc nền xanh cỏ, nét ngựa trắng pha chút vàng kem; kèm chữ "HorseRacing" nếu cần. */
export function Logo({
  size = 36,
  withText = true,
  textClassName = 'text-gray-900',
  className = '',
}: {
  size?: number;
  withText?: boolean;
  textClassName?: string;
  className?: string;
}) {
  const gradient = useId();
  const inner = Math.round(size * 0.8);
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className="flex shrink-0 items-center justify-center bg-emerald-700 shadow-[0_8px_18px_-10px_rgba(4,120,87,0.7)]"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
      >
        <svg width={0} height={0} className="absolute" aria-hidden>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#f3e3b5" />
            </linearGradient>
          </defs>
        </svg>
        <HorseLine size={inner} paint={`url(#${gradient})`} />
      </span>
      {withText && <span className={cn('text-lg font-bold tracking-tight', textClassName)}>HorseRacing</span>}
    </span>
  );
}
