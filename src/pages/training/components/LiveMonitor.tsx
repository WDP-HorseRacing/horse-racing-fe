// Thẻ giám sát một ngựa đang chạy: tim đập đúng nhịp, số nhịp tim chạy mượt, tốc độ, đồng hồ, đường nhịp tim 60 giây,
// thước vùng ngưỡng có kim. Vượt ngưỡng thì thẻ đổi màu, cảnh báo nguy hiểm thì rung và phập phồng tới khi bấm Đã xem.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Gauge, Timer } from 'lucide-react';
import type { MetricAlertLevel, ThresholdLimits } from '../../../api/types';
import { Avatar, Button, cn, useToast } from '../../../components/ui';
import { formatClock, toKmh } from '../../../lib/training-format';
import { alertLevelText } from '../../../lib/training-labels';
import { links } from '../../../lib/links';
import type { LiveSeries } from '../hooks';
import { HeartbeatIcon, LiveNumber, LiveTrace, useAlertPulse } from './motion';

/** Đồng hồ chạy từ một thời điểm, tự cập nhật mỗi giây mà không render lại cha. */
export function Elapsed({ since, until, className = '' }: { since?: string | null; until?: string | null; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!since) return;
    const tick = () => {
      const end = until ? new Date(until).getTime() : Date.now();
      if (ref.current) ref.current.textContent = formatClock((end - new Date(since).getTime()) / 1000);
    };
    tick();
    if (until) return;
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [since, until]);
  return <span ref={ref} className={cn('font-mono tabular-nums', className)}>{since ? '' : '—'}</span>;
}

/** Thước ngang ba vùng (bình thường, cảnh báo, nguy hiểm) với kim chỉ nhịp tim hiện tại. */
export function ZoneGauge({ bpm, limits, className = '' }: { bpm?: number; limits: ThresholdLimits; className?: string }) {
  const min = 60;
  const max = limits.heartRateCriticalBpm + 30;
  const pos = (value: number) => `${((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100}%`;
  const needle = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (needle.current && bpm !== undefined) needle.current.style.left = pos(bpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, limits.heartRateCriticalBpm]);
  return (
    <div className={cn('relative pt-2', className)}>
      <div className="flex h-2 overflow-hidden rounded-full">
        <span className="bg-emerald-300" style={{ width: pos(limits.heartRateWarningBpm) }} />
        <span className="bg-amber-300" style={{ width: `calc(${pos(limits.heartRateCriticalBpm)} - ${pos(limits.heartRateWarningBpm)})` }} />
        <span className="flex-1 bg-red-400" />
      </div>
      {bpm !== undefined && (
        <span ref={needle} className="absolute top-0 h-5 w-1 -translate-x-1/2 rounded-full bg-gray-900 ring-2 ring-white transition-[left] duration-500 ease-out" style={{ left: pos(bpm) }} aria-hidden />
      )}
      <div className="relative mt-1 h-3 font-mono text-[10px] leading-none">
        <span className="absolute left-0 text-gray-400">{min}</span>
        <span className="absolute -translate-x-1/2 text-amber-700" style={{ left: pos(limits.heartRateWarningBpm) }}>
          {limits.heartRateWarningBpm}
        </span>
        <span className="absolute -translate-x-1/2 text-red-700" style={{ left: pos(limits.heartRateCriticalBpm) }}>
          {limits.heartRateCriticalBpm}
        </span>
        <span className="absolute right-0 text-gray-400">{max}</span>
      </div>
    </div>
  );
}

const LEVEL_SKIN: Record<MetricAlertLevel, string> = {
  NORMAL: 'bg-white ring-gray-200/80 shadow-grass-tint',
  WARNING: 'bg-amber-50/80 ring-amber-300 shadow-amber-tint',
  CRITICAL: 'bg-red-50 ring-red-400 shadow-red-tint',
};

export function LiveMonitorCard({
  participantId,
  horseId,
  horseName,
  photoUrl,
  startedAt,
  live,
  limits,
  limitsSource,
  acknowledged,
  onAcknowledge,
  actions,
}: {
  participantId: string;
  horseId: string;
  horseName: string;
  photoUrl?: string;
  startedAt?: string | null;
  live?: LiveSeries;
  limits: ThresholdLimits;
  limitsSource?: 'HORSE' | 'CLUB_DEFAULT';
  acknowledged: boolean;
  onAcknowledge: () => void;
  actions?: ReactNode;
}) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const level = live?.level ?? 'NORMAL';
  const latest = live?.latest;
  useAlertPulse(ref, level, acknowledged);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  const stale = !live?.receivedAt || now - live.receivedAt > 8000;
  const command = `pnpm sim --participant ${participantId} --spike-at 30`;

  return (
    <div ref={ref} data-monitor={participantId} className={cn('rounded-2xl p-4 ring-1 transition-colors duration-300', LEVEL_SKIN[level])}>
      <div className="flex items-center gap-3">
        <Avatar src={photoUrl} name={horseName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{horseName}</p>
          <p className="flex items-center gap-1 text-xs text-gray-500">
            <Timer size={11} /> <Elapsed since={startedAt} />
            {level !== 'NORMAL' && <span className={cn('ml-1 font-semibold', level === 'CRITICAL' ? 'text-red-700' : 'text-amber-800')}>{alertLevelText[level]}</span>}
          </p>
        </div>
        <HeartbeatIcon bpm={stale ? undefined : latest?.heartRateBpm} level={level} size={26} />
      </div>

      <div className="mt-3 flex items-end gap-4">
        <div>
          <p className={cn('font-mono text-4xl font-bold leading-none', level === 'CRITICAL' ? 'text-red-700' : level === 'WARNING' ? 'text-amber-800' : 'text-gray-900')}>
            <LiveNumber value={latest?.heartRateBpm} />
          </p>
          <p className="mt-1 text-xs text-gray-500">nhịp/phút</p>
        </div>
        <div className="pb-0.5">
          <p className="flex items-baseline gap-1 font-mono text-lg font-semibold text-gray-800">
            <Gauge size={14} className="self-center text-gray-400" />
            <LiveNumber value={latest?.speedMps} digits={1} />
            <span className="text-xs font-normal text-gray-500">m/s</span>
          </p>
          <p className="font-mono text-xs text-gray-500">{latest ? `${toKmh(latest.speedMps).toFixed(1)} km/h` : 'chưa có số đo'}</p>
        </div>
        <span className={cn('ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold', stale ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-800')}>
          {stale ? 'Chờ cảm biến' : 'Trực tiếp'}
        </span>
      </div>

      <LiveTrace points={live?.points ?? []} limits={limits} className="mt-3 rounded-lg" />
      <ZoneGauge bpm={latest?.heartRateBpm} limits={limits} className="mt-2" />
      <p className="mt-3 text-[11px] text-gray-500">
        {limitsSource === 'HORSE' ? 'Ngưỡng riêng của ngựa' : 'Ngưỡng mặc định câu lạc bộ'} · tốc độ tối đa {limits.maxSpeedMps} m/s
      </p>

      {live?.hadCritical && !acknowledged && (
        <Button variant="danger" size="sm" className="mt-3 w-full" onClick={onAcknowledge}>
          Đã xem cảnh báo
        </Button>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link to={links.participant(participantId, horseId)}>
          <Button variant="inline" size="sm">
            Xem chi tiết
          </Button>
        </Link>
        {actions}
        {import.meta.env.DEV && (
          <Button
            variant="ghost"
            size="sm"
            title={command}
            onClick={() => {
              void navigator.clipboard?.writeText(command).then(() => toast.push('Đã sao chép lệnh giả lập cảm biến, chạy trong thư mục backend', 'info'));
            }}
          >
            <Copy size={13} /> Lệnh giả lập
          </Button>
        )}
      </div>
    </div>
  );
}
