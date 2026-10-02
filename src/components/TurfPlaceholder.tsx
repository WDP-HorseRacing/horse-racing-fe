// Chỗ ảnh khi ngựa chưa có ảnh: sọc cỏ cắt + dáng ngựa + chữ cái đầu, thay cho ô xám.
import type { ReactNode } from 'react';
import { cn } from './ui';

export function TurfPlaceholder({ size = 'lg', className = '', children }: { name?: string; size?: 'sm' | 'lg'; className?: string; children?: ReactNode }) {
  const large = size === 'lg';
  return (
    <div className={cn('turf noise-overlay relative flex items-center justify-center overflow-hidden text-emerald-900', className)}>
      <img src="/horse_placeholder.jpg" alt="Placeholder" className="relative mix-blend-multiply opacity-90" style={{ width: large ? '75%' : '70%', height: 'auto', objectFit: 'contain' }} />
      {children}
    </div>
  );
}
