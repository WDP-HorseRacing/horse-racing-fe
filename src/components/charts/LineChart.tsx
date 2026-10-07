// Biểu đồ đường vẽ bằng SVG, không thêm thư viện ngoài.
// xAxis="days": trục ngang là thời gian thật (khoảng cách tỉ lệ đúng theo giờ phút), có vạch và nhãn theo ngày,
// chừa lề hai đầu. Nhiều lần đo trong một ngày vẫn vẽ đủ, lần không phải cuối ngày vẽ nhỏ và nhạt.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChartTooltip, type TipState } from './ChartTooltip';

type Point = { x: number; y: number };

export interface Series {
  key: string;
  label: string;
  color: string;
  points: Point[];
  /** Ghi chú thêm cho điểm đang rê chuột, ví dụ chênh lệch so với điểm liền trước. Điểm phải xếp theo x tăng dần. */
  hint?: (point: Point, previous: Point | undefined) => string | undefined;
}

export interface Band {
  from: number;
  to: number;
  label?: string;
}

const DAY = 24 * 60 * 60 * 1000;
/** Bước vạch ngày có thể dùng: chọn bước nhỏ nhất để không quá MAX_TICKS nhãn. */
const DAY_STEPS = [1, 2, 3, 7, 14, 30];
const MAX_TICKS = 7;

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** Vạch nửa đêm mỗi `step` ngày nằm trong khoảng [min, max]. */
function dayTicks(min: number, max: number) {
  const days = Math.max(1, Math.ceil((max - min) / DAY));
  const step = DAY_STEPS.find((item) => days / item <= MAX_TICKS) ?? Math.ceil(days / MAX_TICKS);
  const ticks: number[] = [];
  const cursor = new Date(startOfDay(min));
  if (cursor.getTime() < min) cursor.setDate(cursor.getDate() + 1);
  while (cursor.getTime() <= max) {
    ticks.push(cursor.getTime());
    cursor.setDate(cursor.getDate() + step);
  }
  return ticks;
}

export function LineChart({
  series,
  height = 220,
  yLabel,
  band,
  formatX,
  formatY,
  formatTooltipX,
  threshold,
  xAxis = 'linear',
}: {
  series: Series[];
  height?: number;
  yLabel?: string;
  band?: Band;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  /** Nhãn thời điểm trong chú thích khi rê chuột (mặc định dùng formatX). */
  formatTooltipX?: (value: number) => string;
  threshold?: { value: number; label: string };
  /** "days": trục thời gian có vạch theo ngày. "linear": chỉ ghi nhãn hai đầu (mặc định, dùng cho trục giây). */
  xAxis?: 'linear' | 'days';
}) {
  const [tip, setTip] = useState<(TipState & { x0: number }) | null>(null);

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
  const days = xAxis === 'days';

  const bounds = useMemo(() => {
    const all = series.flatMap((item) => item.points);
    if (all.length === 0) return null;
    const xs = all.map((point) => point.x);
    const ys = all.map((point) => point.y);
    if (band) ys.push(band.from, band.to);
    if (threshold) ys.push(threshold.value);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanY = maxY - minY || 1;
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    if (days) {
      // Chừa lề hai đầu để điểm đầu và cuối không dính mép, tối thiểu nửa ngày mỗi bên.
      const pad = Math.max((maxX - minX) * 0.04, DAY / 2);
      minX -= pad;
      maxX += pad;
    }
    return { minX, maxX, minY: minY - spanY * 0.12, maxY: maxY + spanY * 0.12 };
  }, [series, band, threshold, days]);

  if (!bounds) {
    return (
      <div ref={boxRef} className="flex h-44 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-sm font-light text-gray-400">
        Chưa có dữ liệu để vẽ biểu đồ
      </div>
    );
  }

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const scaleX = (value: number) => padding.left + ((value - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * innerWidth;
  const scaleY = (value: number) => padding.top + innerHeight - ((value - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * innerHeight;

  const ticks = Array.from({ length: 4 }, (_, index) => bounds.minY + ((bounds.maxY - bounds.minY) / 3) * index);
  const xTicks = days ? dayTicks(bounds.minX, bounds.maxX) : [];
  const yText = (value: number) => (formatY ? formatY(value) : String(Math.round(value * 100) / 100));
  const tipX = formatTooltipX ?? formatX;
  // Hai điểm cùng ngày khi rơi vào cùng một ngày lịch.
  const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);

  const showTip = (dataX: number) => {
    const rows: ReactNode[] = [];
    let anchor: { x: number; y: number; dataX: number } | null = null;
    series.forEach((item) => {
      if (item.points.length === 0) return;
      const index = item.points.reduce((best, point, at) => (Math.abs(point.x - dataX) < Math.abs(item.points[best].x - dataX) ? at : best), 0);
      const nearest = item.points[index];
      if (!anchor) anchor = { x: scaleX(nearest.x), y: scaleY(nearest.y), dataX: nearest.x };
      // Trục ngày: liệt kê mọi lần đo trong cùng ngày với điểm gần nhất.
      const group = days
        ? item.points.map((point, at) => ({ point, at })).filter(({ point }) => sameDay(point.x, nearest.x))
        : [{ point: nearest, at: index }];
      group.forEach(({ point, at }) => {
        const hint = item.hint?.(point, at > 0 ? item.points[at - 1] : undefined);
        rows.push(
          <div key={`${item.key}-${point.x}-${at}`} className="flex items-baseline gap-2 tabular-nums">
            {(days || series.length > 1) && <span className="text-gray-400">{days ? (tipX ? tipX(point.x) : '') : item.label}</span>}
            <span className="font-semibold">{yText(point.y)}</span>
            {hint && <span className="text-gray-300">{hint}</span>}
          </div>,
        );
      });
    });
    const found = anchor as { x: number; y: number; dataX: number } | null;
    if (!found) return;
    setTip({
      x: found.x,
      y: found.y,
      x0: found.dataX,
      content: (
        <div className="space-y-0.5">
          {!days && tipX && <div className="text-gray-400">{tipX(found.dataX)}</div>}
          {rows}
        </div>
      ),
    });
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        onMouseLeave={() => setTip(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const svgX = ((event.clientX - rect.left) / rect.width) * width;
          showTip(bounds.minX + ((svgX - padding.left) / innerWidth) * (bounds.maxX - bounds.minX));
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
            <line x1={padding.left} x2={width - padding.right} y1={scaleY(tick)} y2={scaleY(tick)} stroke="#eef4ee" strokeWidth={1} />
            <text x={padding.left - 8} y={scaleY(tick) + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
              {yText(tick)}
            </text>
          </g>
        ))}

        {/* vạch và nhãn theo ngày */}
        {xTicks.map((tick) => (
          <g key={tick}>
            <line x1={scaleX(tick)} x2={scaleX(tick)} y1={padding.top} y2={height - padding.bottom} stroke="#eef4ee" strokeWidth={1} />
            <text x={scaleX(tick)} y={height - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">
              {formatX ? formatX(tick) : ''}
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

        {tip && <line x1={scaleX(tip.x0)} x2={scaleX(tip.x0)} y1={padding.top} y2={height - padding.bottom} stroke="#b0c8b0" strokeWidth={1} />}

        {series.map((item) => {
          if (item.points.length === 0) return null;
          const path = item.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`).join(' ');
          const last = item.points.length - 1;
          return (
            <g key={item.key}>
              <path d={path} fill="none" stroke={item.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {item.points.map((point, index) => {
                // Trục ngày: lần đo không phải cuối ngày vẽ nhỏ và nhạt, lần mới nhất vẽ to có viền trắng.
                const earlierSameDay = days && index < last && sameDay(item.points[index + 1].x, point.x);
                const latest = days && index === last;
                return (
                  <circle
                    key={`${point.x}-${index}`}
                    cx={scaleX(point.x)}
                    cy={scaleY(point.y)}
                    r={latest ? 4.5 : earlierSameDay ? 2 : days ? 3 : 2.5}
                    fill={item.color}
                    fillOpacity={earlierSameDay ? 0.45 : 1}
                    stroke={latest ? '#fff' : 'none'}
                    strokeWidth={latest ? 2 : 0}
                  />
                );
              })}
            </g>
          );
        })}

        {!days && (
          <>
            <text x={padding.left} y={height - 6} className="fill-gray-400 text-[10px]">
              {formatX ? formatX(bounds.minX) : ''}
            </text>
            <text x={width - padding.right} y={height - 6} textAnchor="end" className="fill-gray-400 text-[10px]">
              {formatX ? formatX(bounds.maxX) : ''}
            </text>
          </>
        )}
      </svg>

      <ChartTooltip tip={tip} />

      {(yLabel || series.length > 1) && (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {yLabel && <span className="text-xs font-light text-gray-400">{yLabel}</span>}
          {series.length > 1 &&
            series.map((item) => (
              <span key={item.key} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
        </div>
      )}
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
