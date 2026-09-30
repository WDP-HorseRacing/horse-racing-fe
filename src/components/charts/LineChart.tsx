// Biểu đồ đường vẽ bằng SVG, không thêm thư viện ngoài.
import { useEffect, useMemo, useState } from 'react';

export interface Series {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

export interface Band {
  from: number;
  to: number;
  label?: string;
}

export function LineChart({
  series,
  height = 220,
  yLabel,
  band,
  formatX,
  formatY,
  threshold,
}: {
  series: Series[];
  height?: number;
  yLabel?: string;
  band?: Band;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  threshold?: { value: number; label: string };
}) {
  const [hover, setHover] = useState<{ x: number; items: { label: string; value: number; color: string }[] } | null>(
    null,
  );

  // Đo bề rộng thật của khung để biểu đồ giãn theo layout, không bị kẹt ở 720px.
  const [box, boxRef] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const node = box;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [box]);
  const padding = { top: 16, right: 16, bottom: 28, left: 46 };

  const bounds = useMemo(() => {
    const all = series.flatMap((item) => item.points);
    if (all.length === 0) return null;
    const xs = all.map((point) => point.x);
    const ys = all.map((point) => point.y);
    if (band) ys.push(band.from, band.to);
    if (threshold) ys.push(threshold.value);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = maxY - minY || 1;
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: minY - span * 0.12,
      maxY: maxY + span * 0.12,
    };
  }, [series, band, threshold]);

  if (!bounds) {
    return (
      <div ref={boxRef} className="flex h-44 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-sm font-light text-gray-400">
        Chưa có dữ liệu để vẽ biểu đồ
      </div>
    );
  }

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const scaleX = (value: number) =>
    padding.left + ((value - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * innerWidth;
  const scaleY = (value: number) =>
    padding.top + innerHeight - ((value - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * innerHeight;

  const ticks = Array.from({ length: 4 }, (_, index) => bounds.minY + ((bounds.maxY - bounds.minY) / 3) * index);

  return (
    <div ref={boxRef} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const svgX = ratio * width;
          const dataX = bounds.minX + ((svgX - padding.left) / innerWidth) * (bounds.maxX - bounds.minX);
          const items = series
            .map((item) => {
              const nearest = item.points.reduce(
                (best, point) => (Math.abs(point.x - dataX) < Math.abs(best.x - dataX) ? point : best),
                item.points[0],
              );
              return nearest ? { label: item.label, value: nearest.y, color: item.color, x: nearest.x } : null;
            })
            .filter(Boolean) as { label: string; value: number; color: string; x: number }[];
          if (items.length > 0) setHover({ x: items[0].x, items });
        }}
      >
        {/* dải khoảng bình thường */}
        {band && (
          <rect
            x={padding.left}
            y={scaleY(band.to)}
            width={innerWidth}
            height={Math.max(0, scaleY(band.from) - scaleY(band.to))}
            fill="rgb(107 114 128 / 0.07)"
          />
        )}

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={scaleY(tick)}
              y2={scaleY(tick)}
              stroke="#eef4ee"
              strokeWidth={1}
            />
            <text x={padding.left - 8} y={scaleY(tick) + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
              {formatY ? formatY(tick) : Math.round(tick * 10) / 10}
            </text>
          </g>
        ))}

        {threshold && (
          <g>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={scaleY(threshold.value)}
              y2={scaleY(threshold.value)}
              stroke="#dc2626"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text x={width - padding.right} y={scaleY(threshold.value) - 6} textAnchor="end" className="fill-red-500 text-[10px] font-semibold">
              {threshold.label}
            </text>
          </g>
        )}

        {series.map((item) => {
          if (item.points.length === 0) return null;
          const path = item.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`)
            .join(' ');
          return (
            <g key={item.key}>
              <path d={path} fill="none" stroke={item.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {item.points.map((point) => (
                <circle key={point.x} cx={scaleX(point.x)} cy={scaleY(point.y)} r={2.5} fill={item.color} />
              ))}
            </g>
          );
        })}

        {hover && (
          <line
            x1={scaleX(hover.x)}
            x2={scaleX(hover.x)}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="#b0c8b0"
            strokeWidth={1}
          />
        )}

        <text x={padding.left} y={height - 6} className="fill-gray-400 text-[10px]">
          {formatX ? formatX(bounds.minX) : ''}
        </text>
        <text x={width - padding.right} y={height - 6} textAnchor="end" className="fill-gray-400 text-[10px]">
          {formatX ? formatX(bounds.maxX) : ''}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        {yLabel && <span className="text-xs font-light text-gray-400">{yLabel}</span>}
        {series.length > 1 &&
          series.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        {hover && (
          <span className="ml-auto flex flex-wrap items-center gap-3 text-xs font-medium text-gray-600">
            {formatX && <span className="text-gray-400">{formatX(hover.x)}</span>}
            {hover.items.map((item) => (
              <span key={item.label} className="tabular-nums" style={{ color: item.color }}>
                {item.label}: {formatY ? formatY(item.value) : Math.round(item.value * 100) / 100}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/** Màu biểu đồ trong bảng màu 2 + 1. Tên cũ (sky, violet) giữ lại nhưng quy về sắc xám. Đỏ chỉ dùng cho đường ngưỡng. */
export const chartColors = {
  emerald: '#047857',
  amber: '#b45309',
  sky: '#4b5563',
  red: '#dc2626',
  violet: '#9ca3af',
};
