// Chỗ ảnh khi ngựa chưa có ảnh: sọc cỏ cắt + dáng ngựa + chữ cái đầu, thay cho ô xám.
import type { ReactNode } from 'react';
import { HorseMark } from './Logo';
import { cn } from './ui';

export function TurfPlaceholder({ name, size = 'lg', className = '', children }: { name?: string; size?: 'sm' | 'lg'; className?: string; children?: ReactNode }) {
  const letter = name?.trim().split(/\s+/).pop()?.[0]?.toUpperCase();
  const large = size === 'lg';
  return (
    <div className={cn('turf noise-overlay relative flex items-center justify-center overflow-hidden text-emerald-900', className)}>
      {letter && (
        <span className={cn('pointer-events-none absolute select-none font-extrabold leading-none text-emerald-900/8', large ? '-bottom-6 -right-2 text-[11rem]' : '-bottom-3 -right-1 text-7xl')} aria-hidden>
          {letter}
        </span>
      )}
      <HorseMark size={large ? 72 : 32} strokeWidth={1.4} className="relative text-emerald-900/25" />
      {children}
    </div>
  );
}
