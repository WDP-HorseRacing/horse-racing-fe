// Chỗ ảnh khi ngựa chưa có ảnh: sọc cỏ cắt nhạt + đầu ngựa nét mảnh (SVG, sắc nét ở mọi cỡ), thay cho ô xám.
import type { ReactNode } from 'react';
import { HorseLine } from './Logo';
import { cn } from './ui';

export function TurfPlaceholder({ size = 'lg', className = '', children }: { name?: string; size?: 'sm' | 'lg'; className?: string; children?: ReactNode }) {
  return (
    <div className={cn('turf noise-overlay relative flex items-center justify-center overflow-hidden', className)}>
      {/* Hình chiếm một phần khung để không lấn tên và nhãn đặt trên ảnh. */}
      <span className={cn('relative block aspect-square text-emerald-800/30', size === 'lg' ? 'w-[46%]' : 'w-[40%]')}>
        <HorseLine size={512} bold={6} className="h-full w-full" />
      </span>
      {children}
    </div>
  );
}
