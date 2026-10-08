// Biểu đồ nhịp tim và tốc độ của một lượt tập theo thời gian: vùng tô theo ngưỡng (cảnh báo, nguy hiểm),
// điểm cảnh báo đánh dấu tròn, đường tốc độ phụ (trục phải). Rê chuột xem từng giây. Đường vẽ dần khi mở (DrawSVG).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MetricPoint, ThresholdLimits } from '../../../api/types';
import { formatClock, toKmh } from '../../../lib/training-format';
import { alertLevelText } from '../../../lib/training-labels';
import { cn } from '../../../components/ui';
import { useDrawIn } from './motion';

export function MetricChart({ points, limits, height = 280 }: { points: MetricPoint[]; limits: ThresholdLimits; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const node = box.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Vẽ lại hiệu ứng khi đổi lượt (số điểm từ 0 lên), không vẽ lại mỗi giây khi đang chạy.
  useDrawIn(svg, points.length > 0);

  const pad = { top: 14, right: 46, bottom: 26, left: 40 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const start = points.length ? new Date(points[0].recordedAt).getTime() : 0;
  const end = points.length ? new Date(points[points.length - 1].recordedAt).getTime() : 1;
  const span = Math.max(1000, end - start);
  const top = Math.max(limits.heartRateCriticalBpm + 20, ...points.map((point) => point.heartRateBpm + 10));
  const bottom = Math.min(60, ...points.map((point) => point.heartRateBpm - 10));
  const speedTop = Math.max(limits.maxSpeedMps + 2, ...points.map((point) => point.speedMps + 1));
  const x = (time: number) => pad.left + ((time - start) / span) * innerW;
  const y = (bpm: number) => pad.top + innerH - ((bpm - bottom) / (top - bottom)) * innerH;
  const ys = (speed: number) => pad.top + innerH - (speed / speedTop) * innerH;

  const heartPath = useMemo(
    () => points.map((point, index) => `${index ? 'L' : 'M'}${x(new Date(point.recordedAt).getTime()).toFixed(1)},${y(point.heartRateBpm).toFixed(1)}`).join(' '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, width, top, bottom],
  );
  const speedPath = useMemo(
    () => points.map((point, index) => `${index ? 'L' : 'M'}${x(new Date(point.recordedAt).getTime()).toFixed(1)},${ys(point.speedMps).toFixed(1)}`).join(' '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, width, speedTop],
  );
  const alerts = points.filter((point) => point.alertLevel !== 'NORMAL');
  const ticks = [bottom, limits.heartRateWarningBpm, limits.heartRateCriticalBpm, top].filter((value, index, list) => list.indexOf(value) === index);
  const timeTicks = Array.from({ length: 5 }, (_, index) => start + (span * index) / 4);
  const hovered = hover !== null ? points[hover] : undefined;

  const onMove = (event: React.MouseEvent<SVGRectElement>) => {
    if (points.length === 0) return;
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect();
    const time = start + ((event.clientX - rect.left) / rect.width) * span;
    let best = 0;
    let gap = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(new Date(point.recordedAt).getTime() - time);
      if (distance < gap) {
        gap = distance;
        best = index;
      }
    });
    setHover(best);
  };

  if (points.length === 0) {
    return <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">Chưa có điểm đo nào cho lượt này</div>;
  }

  return (
    <div ref={box} className="relative">
      <svg ref={svg} width={width} height={height} className="block">
        <rect x={pad.left} y={y(top)} width={innerW} height={y(limits.heartRateCriticalBpm) - y(top)} className="fill-red-50" />
        <rect x={pad.left} y={y(limits.heartRateCriticalBpm)} width={innerW} height={y(limits.heartRateWarningBpm) - y(limits.heartRateCriticalBpm)} className="fill-amber-50" />
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={pad.left + innerW} y1={y(tick)} y2={y(tick)} className={tick === limits.heartRateCriticalBpm ? 'stroke-red-300' : tick === limits.heartRateWarningBpm ? 'stroke-amber-300' : 'stroke-gray-100'} strokeDasharray={tick === limits.heartRateCriticalBpm || tick === limits.heartRateWarningBpm ? '4 4' : undefined} />
            <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end" className="fill-gray-400 font-mono text-[10px]">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        {timeTicks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 8} textAnchor="middle" className="fill-gray-400 font-mono text-[10px]">
            {formatClock((tick - start) / 1000)}
          </text>
        ))}
        <text x={width - 4} y={pad.top + 8} textAnchor="end" className="fill-gray-400 text-[10px]">
          m/s
        </text>
        <text x={width - 4} y={ys(limits.maxSpeedMps) + 3} textAnchor="end" className="fill-gray-400 font-mono text-[10px]">
          {limits.maxSpeedMps}
        </text>
        <path data-draw d={speedPath} fill="none" className="stroke-gray-400" strokeWidth={1.2} strokeDasharray="0" opacity={0.7} />
        <path data-draw d={heartPath} fill="none" className="stroke-emerald-700" strokeWidth={2} strokeLinejoin="round" />
        {alerts.map((point) => (
          <circle
            key={point.recordedAt}
            data-pop
            cx={x(new Date(point.recordedAt).getTime())}
            cy={y(point.heartRateBpm)}
            r={point.alertLevel === 'CRITICAL' ? 4 : 3}
            className={point.alertLevel === 'CRITICAL' ? 'fill-red-600 stroke-white' : 'fill-amber-500 stroke-white'}
            strokeWidth={1.5}
          />
        ))}
        {hovered && (
          <g pointerEvents="none">
            <line x1={x(new Date(hovered.recordedAt).getTime())} x2={x(new Date(hovered.recordedAt).getTime())} y1={pad.top} y2={pad.top + innerH} className="stroke-gray-300" />
            <circle cx={x(new Date(hovered.recordedAt).getTime())} cy={y(hovered.heartRateBpm)} r={4.5} className="fill-white stroke-emerald-700" strokeWidth={2} />
          </g>
        )}
        <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-2 rounded-xl bg-white/95 px-3 py-2 text-xs shadow-float ring-1 ring-gray-200"
          style={{ left: Math.min(width - 170, Math.max(0, x(new Date(hovered.recordedAt).getTime()) + 10)) }}
        >
          <p className="font-mono text-gray-500">giây {formatClock((new Date(hovered.recordedAt).getTime() - start) / 1000)}</p>
          <p className="font-mono text-sm font-semibold text-gray-900">{hovered.heartRateBpm} bpm</p>
          <p className="font-mono text-gray-600">
            {hovered.speedMps.toFixed(1)} m/s · {toKmh(hovered.speedMps).toFixed(1)} km/h
          </p>
          <p className={cn('font-medium', hovered.alertLevel === 'CRITICAL' ? 'text-red-700' : hovered.alertLevel === 'WARNING' ? 'text-amber-700' : 'text-gray-500')}>{alertLevelText[hovered.alertLevel]}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-emerald-700" /> Nhịp tim (bpm)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-gray-400" /> Tốc độ (m/s, trục phải)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-100 ring-1 ring-amber-300" /> Vùng cảnh báo từ {limits.heartRateWarningBpm}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-100 ring-1 ring-red-300" /> Vùng nguy hiểm từ {limits.heartRateCriticalBpm}
        </span>
      </div>
    </div>
  );
}
