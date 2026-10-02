// Biểu đồ tròn rỗng (donut) cho cơ cấu một tổng: sức khỏe đàn, tuân thủ khám định kỳ…
// Mảng cách nhau 2px màu nền; số tổng ở giữa; chú thích bên cạnh luôn có nhãn + số (không chỉ dựa vào màu).
// Bấm một mảng hoặc một dòng chú thích để lọc (onSelect), rê chuột để xem tooltip.
import { useState } from 'react';
import { cn } from '../ui';
import { ChartTooltip, type TipState } from './ChartTooltip';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

function arc(cx: number, cy: number, r: number, start: number, end: number) {
  const point = (angle: number) => [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function DonutChart({
  segments,
  size = 168,
  thickness = 20,
  centerLabel,
  selected,
  onSelect,
  className = '',
  legendClassName = '',
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  /** Mảng đang được chọn (bộ lọc); các mảng khác mờ đi. */
  selected?: string;
  onSelect?: (key: string) => void;
  className?: string;
  legendClassName?: string;
}) {
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const visible = segments.filter((item) => item.value > 0);
  // Khe 2px giữa các mảng, tính theo góc trên bán kính giữa.
  const gap = visible.length > 1 ? 2 / r : 0;
  let cursor = 0;
  const arcs = visible.map((item) => {
    const sweep = (item.value / total) * Math.PI * 2;
    const start = cursor + gap / 2;
    const end = cursor + sweep - gap / 2;
    cursor += sweep;
    return { ...item, start, end: Math.max(start + 0.001, end) };
  });
  const focusKey = hover ?? selected;
  const pct = (value: number) => (total ? Math.round((value / total) * 100) : 0);

  return (
    <div className={cn('flex flex-wrap items-center gap-5', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }} onMouseLeave={() => (setTip(null), setHover(null))}>
        <svg width={size} height={size} role="img" aria-label={segments.map((item) => `${item.label}: ${item.value}`).join(', ')}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="#eef2ef" strokeWidth={thickness} />
          {arcs.length === 1 ? (
            <circle cx={c} cy={c} r={r} fill="none" stroke={arcs[0].color} strokeWidth={thickness} />
          ) : (
            arcs.map((item) => (
              <path
                key={item.key}
                d={arc(c, c, r, item.start, item.end)}
                fill="none"
                stroke={item.color}
                strokeWidth={focusKey === item.key ? thickness + 4 : thickness}
                opacity={focusKey && focusKey !== item.key ? 0.35 : 1}
                className={cn('transition-[opacity,stroke-width] duration-200', onSelect && 'cursor-pointer')}
                onClick={() => onSelect?.(item.key)}
                onMouseMove={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover(item.key);
                  setTip({ x: event.clientX - box.left, y: event.clientY - box.top, content: `${item.label}: ${item.value} (${pct(item.value)}%)` });
                }}
              />
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold leading-none text-gray-900">{total}</span>
          {centerLabel && <span className="mt-1 max-w-[70%] text-xs text-gray-500">{centerLabel}</span>}
        </div>
        <ChartTooltip tip={tip} />
      </div>

      <ul className={cn('min-w-40 flex-1 space-y-1', legendClassName)}>
        {segments.map((item) => {
          const active = selected === item.key;
          const body = (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{item.label}</span>
              <span className="text-sm font-semibold tabular-nums text-gray-900">{item.value}</span>
              <span className="w-10 text-right text-xs tabular-nums text-gray-400">{pct(item.value)}%</span>
            </>
          );
          return (
            <li key={item.key}>
              {onSelect ? (
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(item.key)}
                  onMouseEnter={() => setHover(item.key)}
                  onMouseLeave={() => setHover(null)}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-gray-50', active && 'bg-emerald-50 ring-1 ring-emerald-200')}
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-2 py-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
