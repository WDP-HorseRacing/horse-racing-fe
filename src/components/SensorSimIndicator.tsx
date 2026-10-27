// Nhãn nổi góc dưới màn hình khi có cảm biến giả lập đang gửi nhịp tim, để HLV rời Sân tập (sang hồ sơ ngựa, đặt ngưỡng…)
// vẫn biết nó còn chạy và tắt được ngay.
import { Link } from 'react-router-dom';
import { Radio, X } from 'lucide-react';
import { stopSim, useSensorSims } from '../lib/sensor-sim';
import { links } from '../lib/links';
import { cn } from './ui';

export function SensorSimIndicator() {
  const sims = Object.values(useSensorSims());
  if (!sims.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {sims.map((sim) => (
        <div
          key={sim.participantId}
          className={cn(
            'pointer-events-auto flex min-w-0 items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-xs shadow-grass-tint ring-1',
            sim.offline ? 'bg-amber-50 text-amber-900 ring-amber-300' : sim.spiking ? 'bg-red-50 text-red-800 ring-red-300' : 'bg-white/95 text-gray-700 ring-emerald-200',
          )}
        >
          <Radio size={13} className={cn('shrink-0', sim.offline ? 'text-amber-600' : 'animate-pulse text-emerald-600')} />
          <Link to={links.participant(sim.participantId)} className="min-w-0 truncate hover:underline">
            Cảm biến giả lập: <b className="font-semibold text-gray-900">{sim.horseName}</b>
          </Link>
          <span className="shrink-0 tabular-nums font-semibold ">{sim.offline ? `giữ ${sim.pending} điểm` : sim.heartRateBpm ? `${sim.heartRateBpm} bpm` : ''}</span>
          <button
            type="button"
            onClick={() => stopSim(sim.participantId)}
            className="shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800"
            aria-label={`Dừng cảm biến giả lập của ${sim.horseName}`}
            title="Dừng cảm biến"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
