// Biểu đồ cột theo thời gian (tháng / tuần), một chuỗi. Cột rộng tối đa 24px, đầu bo 4px, mọc từ đường đáy;
// lưới ngang mảnh 3 vạch số tròn; chỉ ghi số ở cột cao nhất và cột cuối, phần còn lại xem ở tooltip.
// Có bảng ẩn cho trình đọc màn hình.
import { useEffect, useRef, useState } from 'react';
import { cn } from '../ui';
import { ChartTooltip, type TipState } from './ChartTooltip';

export interface Column {
  key: string;
  label: string;
  value: number;
  /** Dòng phụ trong tooltip (ví dụ "3 bệnh án đã đóng"). */
  detail?: string;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((item) => item * power >= value / 3) ?? 10;
  return Math.ceil(value / (step * power)) * step * power;
}

export function ColumnChart({
  columns,
  height = 180,
  color = '#059669',
  format = (value: number) => value.toLocaleString('vi-VN'),
  formatTick,
  caption,
  className = '',
}: {
  columns: Column[];
  height?: number;
  color?: string;
  format?: (value: number) => string;
  /** Định dạng gọn cho trục (ví dụ 1,2 tr). */
  formatTick?: (value: number) => string;
  caption: string;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const left = 44;
  const bottom = 24;
  const top = 18;
  const plotW = width - left - 4;
  const plotH = height - bottom - top;
  const max = niceMax(Math.max(0, ...columns.map((item) => item.value)));
  const ticks = [0, max / 2, max];
  const band = plotW / Math.max(1, columns.length);
  const barW = Math.min(24, band * 0.55);
  const peak = columns.reduce((best, item, index) => (item.value > (columns[best]?.value ?? -1) ? index : best), 0);
  const tick = formatTick ?? format;

  return (
    <div ref={root} className={cn('relative w-full', className)} onMouseLeave={() => (setTip(null), setHover(null))}>
      <svg width={width} height={height} role="img" aria-label={caption}>
        {ticks.map((value) => {
          const y = top + plotH - (value / max) * plotH;
          return (
            <g key={value}>
              <line x1={left} x2={width - 4} y1={y} y2={y} stroke={value === 0 ? '#d7dcd8' : '#eef1ef'} strokeWidth={1} />
              <text x={left - 8} y={y + 4} textAnchor="end" className="fill-gray-400 text-[11px] tabular-nums">
                {tick(value)}
              </text>
            </g>
          );
        })}
        {columns.map((item, index) => {
          const h = (item.value / max) * plotH;
          const x = left + band * index + (band - barW) / 2;
          const y = top + plotH - h;
          const r = Math.min(4, h / 2);
          const path = h > 0 ? `M ${x} ${top + plotH} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + barW - r} Q ${x + barW} ${y} ${x + barW} ${y + r} V ${top + plotH} Z` : '';
          const labelled = item.value > 0 && (index === peak || index === columns.length - 1);
          return (
            <g key={item.key}>
              {/* Vùng bắt chuột rộng hơn cột để dễ rê. */}
              <rect
                x={left + band * index}
                y={top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseMove={(event) => {
                  const box = root.current!.getBoundingClientRect();
                  setHover(item.key);
                  setTip({
                    x: event.clientX - box.left,
                    y: y - 4,
                    content: (
                      <span>
                        <span className="font-semibold">{item.label}</span> · {format(item.value)}
                        {item.detail && <span className="block text-white/70">{item.detail}</span>}
                      </span>
                    ),
                  });
                }}
              />
              {path && <path d={path} fill={color} opacity={hover && hover !== item.key ? 0.45 : 1} className="pointer-events-none transition-opacity" />}
              {labelled && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="pointer-events-none fill-gray-700 text-[11px] font-semibold">
                  {format(item.value)}
                </text>
              )}
              <text x={left + band * index + band / 2} y={height - 6} textAnchor="middle" className="pointer-events-none fill-gray-500 text-[11px]">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {columns.map((item) => (
            <tr key={item.key}>
              <th scope="row">{item.label}</th>
              <td>{format(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
