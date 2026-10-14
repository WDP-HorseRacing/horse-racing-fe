// Mảnh giao diện dùng chung cho các trang báo cáo: thanh chia tỷ lệ có chú thích, ô số nhỏ.
import type { ReactNode } from 'react';
import { cn } from '../../components/ui';

export interface SplitPart {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Chữ hiện ở chú thích thay cho số (vd số tiền). */
  text?: string;
}

/** Một thanh ngang chia theo tỷ lệ, chú thích luôn có nhãn và số (không chỉ dựa vào màu). */
export function SplitBar({ parts, className }: { parts: SplitPart[]; className?: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-200/70" role="img" aria-label={parts.map((part) => `${part.label} ${part.text ?? part.value}`).join(', ')}>
        {total > 0 &&
          parts.map((part) =>
            part.value > 0 ? <span key={part.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(part.value / total) * 100}%`, background: part.color }} /> : null,
          )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: part.color }} aria-hidden />
            {part.label} <span className="font-semibold tabular-nums text-gray-900">{part.text ?? part.value.toLocaleString('vi-VN')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ô số nhỏ: nhãn, số, dòng phụ. tone đổi màu số khi cần nhấn. */
export function StatTile({ label, value, sub, tone, className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'amber' | 'red' | 'muted'; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-white p-4 shadow-card ring-1 ring-gray-200/80', className)}>
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-2xl font-bold tabular-nums leading-tight',
          tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : tone === 'muted' ? 'text-gray-400' : 'text-gray-900',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
