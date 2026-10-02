// Thanh ngang xếp chồng, mỗi hàng một nhóm (ví dụ mỗi khu chuồng: ô có ngựa / trống / bảo trì).
// Mảng cách nhau 2px, đầu thanh bo 4px; nhãn hàng và số bên ngoài thanh (không nhét chữ vào mảng nhỏ);
// chú thích chung ở trên; rê chuột vào mảng để xem tooltip.
import { useState, type ReactNode } from 'react';
import { cn } from '../ui';
import { ChartTooltip, type TipState } from './ChartTooltip';

export interface BarSeries {
  key: string;
  label: string;
  color: string;
  /** Sọc chéo cho mảng "bảo trì" / "không dùng được". */
  striped?: boolean;
}

export interface BarRow {
  key: string;
  label: ReactNode;
  values: Record<string, number>;
  /** Ghi chú bên phải (ví dụ "2 ngựa chờ ô"). */
  note?: ReactNode;
  onClick?: () => void;
}

export function StackedBars({ series, rows, total, className = '' }: { series: BarSeries[]; rows: BarRow[]; /** Tổng cố định cho mọi hàng (mặc định = hàng lớn nhất). */ total?: number; className?: string }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const max = total ?? Math.max(1, ...rows.map((row) => series.reduce((sum, item) => sum + (row.values[item.key] ?? 0), 0)));
  return (
    <div data-chart-root className={cn('relative', className)} onMouseLeave={() => setTip(null)}>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={item.striped ? { backgroundImage: `repeating-linear-gradient(135deg, ${item.color} 0 2px, #fff 2px 4px)` } : { backgroundColor: item.color }} aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>
      <ul className="space-y-3">
        {rows.map((row) => {
          const sum = series.reduce((acc, item) => acc + (row.values[item.key] ?? 0), 0);
          const parts = series.filter((item) => (row.values[item.key] ?? 0) > 0);
          const Wrapper = row.onClick ? 'button' : 'div';
          return (
            <li key={row.key}>
              <Wrapper
                {...(row.onClick ? { type: 'button' as const, onClick: row.onClick } : {})}
                className={cn('block w-full text-left', row.onClick && 'group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40')}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className={cn('truncate font-medium text-gray-800', row.onClick && 'group-hover:text-emerald-800')}>{row.label}</span>
                  <span className="shrink-0 text-xs text-gray-500">{row.note}</span>
                </div>
                <div className="flex h-3.5 gap-[2px] overflow-hidden rounded bg-gray-100" style={{ width: `${Math.max(6, (sum / max) * 100)}%` }}>
                  {parts.map((item) => {
                    const value = row.values[item.key] ?? 0;
                    return (
                      <span
                        key={item.key}
                        className="h-full first:rounded-l last:rounded-r"
                        style={{
                          flexGrow: value,
                          ...(item.striped
                            ? { backgroundImage: `repeating-linear-gradient(135deg, ${item.color} 0 3px, #f3f4f6 3px 6px)` }
                            : { backgroundColor: item.color }),
                        }}
                        onMouseMove={(event) => {
                          const box = (event.currentTarget.closest('[data-chart-root]') as HTMLElement).getBoundingClientRect();
                          setTip({ x: event.clientX - box.left, y: event.clientY - box.top, content: `${item.label}: ${value}` });
                        }}
                      />
                    );
                  })}
                </div>
              </Wrapper>
            </li>
          );
        })}
      </ul>
      <ChartTooltip tip={tip} />
    </div>
  );
}
