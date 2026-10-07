// Biểu đồ đường vẽ bằng SVG, không thêm thư viện ngoài.
// Ba kiểu trục ngang:
// - "linear": giá trị x thật, chỉ ghi nhãn hai đầu (trục giây của buổi tập).
// - "days": thời gian thật, có vạch và nhãn theo ngày.
// - "sequence": các lần đo cách đều nhau theo thứ tự, nhãn là ngày đo. Ít lần đo thì mỗi lần chiếm nhiều chỗ hơn,
//   nhiều lần đo thì đường dày dần thành hình liền mạch, không có khoảng trống dài khi lâu ngày không đo.
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
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);

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
  area = false,
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
  /** Kiểu trục ngang, xem chú thích đầu file. */
  xAxis?: 'linear' | 'days' | 'sequence';
  /** Tô nhạt vùng dưới đường. */
  area?: boolean;
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
  const seq = xAxis === 'sequence';
  /** Trục có nhãn ngày đo (thời gian thật nằm trong series gốc). */
  const dated = days || seq;

  // Trục thứ tự: điểm thứ i nằm ở x = i. Thời điểm đo thật vẫn lấy từ series gốc để ghi nhãn.
  const plotted = useMemo(
    () => (seq ? series.map((item) => ({ ...item, points: item.points.map((point, index) => ({ x: index, y: point.y })) })) : series),
    [series, seq],
  );
  const timeOf = (seriesIndex: number, index: number) => series[seriesIndex]?.points[index]?.x ?? 0;

  const bounds = useMemo(() => {
    const all = plotted.flatMap((item) => item.points);
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
    if (seq) {
      // Lề nửa khoảng cách giữa hai lần đo, một lần đo duy nhất thì nằm giữa.
      const pad = maxX === minX ? 1 : 0.35;
      minX -= pad;
      maxX += pad;
    }
    return { minX, maxX, minY: minY - spanY * 0.12, maxY: maxY + spanY * 0.12 };
  }, [plotted, band, threshold, days, seq]);

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
  const baseline = height - padding.bottom;

  const ticks = Array.from({ length: 4 }, (_, index) => bounds.minY + ((bounds.maxY - bounds.minY) / 3) * index);
  const yText = (value: number) => (formatY ? formatY(value) : String(Math.round(value * 100) / 100));
  const tipX = formatTooltipX ?? formatX;
  /** Thời điểm thật của điểm thứ `index` trong series `seriesIndex`. */
  const realX = (seriesIndex: number, index: number) => (seq ? timeOf(seriesIndex, index) : (plotted[seriesIndex]?.points[index]?.x ?? 0));

  // Nhãn trục ngang.
  const xTicks: { x: number; label: string }[] = (() => {
    if (days) return dayTicks(bounds.minX, bounds.maxX).map((tick) => ({ x: tick, label: formatX ? formatX(tick) : '' }));
    if (!seq || !plotted[0]) return [];
    // Trục thứ tự: ghi ngày của khoảng 6 lần đo trải đều, bỏ nhãn trùng ngày liền nhau.
    const count = plotted[0].points.length;
    const step = Math.max(1, Math.ceil(count / 6));
    const result: { x: number; label: string }[] = [];
    for (let index = 0; index < count; index += 1) {
      if (index % step !== 0 && index !== count - 1) continue;
      const label = formatX ? formatX(timeOf(0, index)) : '';
      if (result.length && result[result.length - 1].label === label) continue;
      if (index === count - 1 && result.length && index - result[result.length - 1].x < step / 2) result.pop();
      result.push({ x: index, label });
    }
    return result;
  })();

  const showTip = (dataX: number) => {
    const rows: ReactNode[] = [];
    let anchor: { x: number; y: number; dataX: number } | null = null;
    plotted.forEach((item, seriesIndex) => {
      if (item.points.length === 0) return;
      const index = item.points.reduce((best, point, at) => (Math.abs(point.x - dataX) < Math.abs(item.points[best].x - dataX) ? at : best), 0);
      const nearest = item.points[index];
      if (!anchor) anchor = { x: scaleX(nearest.x), y: scaleY(nearest.y), dataX: nearest.x };
      // Trục có ngày: liệt kê mọi lần đo trong cùng ngày với điểm gần nhất.
      const group = dated
        ? item.points.map((point, at) => ({ point, at })).filter(({ at }) => sameDay(realX(seriesIndex, at), realX(seriesIndex, index)))
        : [{ point: nearest, at: index }];
      const original = series[seriesIndex].points;
      group.forEach(({ point, at }) => {
        const hint = item.hint?.(original[at], at > 0 ? original[at - 1] : undefined);
        rows.push(
          <div key={`${item.key}-${at}`} className="flex items-baseline gap-2 tabular-nums">
            {(dated || plotted.length > 1) && <span className="text-gray-400">{dated ? (tipX ? tipX(realX(seriesIndex, at)) : '') : item.label}</span>}
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
          {!dated && tipX && <div className="text-gray-400">{tipX(found.dataX)}</div>}
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

        {/* vạch và nhãn trục ngang */}
        {xTicks.map((tick) => (
          <g key={tick.x}>
            {days && <line x1={scaleX(tick.x)} x2={scaleX(tick.x)} y1={padding.top} y2={baseline} stroke="#eef4ee" strokeWidth={1} />}
            <text x={scaleX(tick.x)} y={height - 8} textAnchor="middle" className="fill-gray-400 text-[10px]">
              {tick.label}
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

        {tip && <line x1={scaleX(tip.x0)} x2={scaleX(tip.x0)} y1={padding.top} y2={baseline} stroke="#b0c8b0" strokeWidth={1} />}

        {plotted.map((item, seriesIndex) => {
          if (item.points.length === 0) return null;
          const path = item.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`).join(' ');
          const first = item.points[0];
          const lastPoint = item.points[item.points.length - 1];
          const last = item.points.length - 1;
          return (
            <g key={item.key}>
              {area && item.points.length > 1 && (
                <path d={`${path} L ${scaleX(lastPoint.x)} ${baseline} L ${scaleX(first.x)} ${baseline} Z`} fill={item.color} fillOpacity={0.08} stroke="none" />
              )}
              <path d={path} fill="none" stroke={item.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {item.points.map((point, index) => {
                // Trục có ngày: lần đo không phải cuối ngày vẽ nhỏ và nhạt, lần mới nhất vẽ to có viền trắng.
                const earlierSameDay = dated && index < last && sameDay(realX(seriesIndex, index + 1), realX(seriesIndex, index));
                const latest = dated && index === last;
                return (
                  <circle
                    key={`${point.x}-${index}`}
                    cx={scaleX(point.x)}
                    cy={scaleY(point.y)}
                    r={latest ? 4.5 : earlierSameDay ? 2 : dated ? 3 : 2.5}
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

        {!dated && (
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
