// Logo HorseRacing: đầu ngựa nhìn nghiêng, nét trắng trên nền xanh cỏ.
import { cn } from './ui';

/** Hình đầu ngựa dạng nét (viewBox 24), cùng phong cách với bộ icon lucide. */
export function HorseMark({ size = 20, strokeWidth = 2, className = '' }: { size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M5 22c-.2-7 .9-12.8 3.2-16.7l.4-3 2 2.1c3.9 1.6 7.6 5.4 10.2 9.6.8 1.4.3 3.5-1.3 4.1-1.4.5-3.1.2-4.5-.6-1.4-.8-2.9-1.2-4-.7-.5 1.6 0 3.5 1 5.2" />
      <circle cx="13" cy="8.6" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="19.9" cy="15.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Ô logo bo góc nền xanh cỏ, kèm chữ "HorseRacing" nếu cần. */
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
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src="/logo.png"
        alt="Logo"
        width={size}
        height={size}
        className="shrink-0 object-contain"
      />
      {withText && <span className={cn('text-lg font-bold tracking-tight', textClassName)}>HorseRacing</span>}
    </span>
  );
}
