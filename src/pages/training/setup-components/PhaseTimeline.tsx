// Thanh giai đoạn nằm ngang, bề rộng mỗi giai đoạn tỉ lệ với số tuần.
import { cn, Tip } from '../../../components/ui';
import { intensityLabel } from '../../../lib/labels';
import type { TrainingIntensity } from '../../../types/domain';
import { phaseTone, volumeLabel } from './helpers';

export interface TimelinePhase {
  name: string;
  weeks: number;
  sessionsPerWeek?: number;
  maxIntensity?: TrainingIntensity;
  weeklyVolumeM?: number;
}

export function PhaseTimeline({
  phases,
  size = 'md',
  showRuler = false,
  className = '',
}: {
  phases: TimelinePhase[];
  size?: 'sm' | 'md' | 'lg';
  showRuler?: boolean;
  className?: string;
}) {
  const total = phases.reduce((sum, phase) => sum + Math.max(0, phase.weeks || 0), 0);
  if (phases.length === 0) {
    return <div className={cn('h-3 rounded-full bg-gray-100', className)} />;
  }
  return (
    <div className={cn('w-full', className)}>
      <div className="flex w-full gap-1">
        {phases.map((phase, index) => {
          const tip = (
            <span>
              {phase.name || `Giai đoạn ${index + 1}`} · {phase.weeks} tuần
              {phase.sessionsPerWeek !== undefined && ` · ${phase.sessionsPerWeek} buổi/tuần`}
              {phase.maxIntensity && ` · cao nhất ${intensityLabel[phase.maxIntensity]}`}
              {phase.weeklyVolumeM ? ` · ${volumeLabel(phase.weeklyVolumeM)}/tuần` : ''}
            </span>
          );
          return (
            <Tip key={index} content={tip}>
              <div
                style={{ flexGrow: Math.max(phase.weeks || 0, 0.4), flexBasis: 0 }}
                className={cn(
                  'min-w-0 overflow-hidden transition-[flex-grow] duration-300',
                  size === 'sm' ? 'h-2.5 rounded-full' : 'rounded-lg px-3',
                  size === 'md' && 'py-2',
                  size === 'lg' && 'py-3',
                  phaseTone(index),
                )}
              >
                {size !== 'sm' && (
                  <>
                    <p className="truncate text-nowrap text-xs font-semibold">{phase.name || `Giai đoạn ${index + 1}`}</p>
                    <p className="truncate text-nowrap text-[11px] opacity-80 tabular-nums">
                      {phase.weeks} tuần
                      {phase.sessionsPerWeek !== undefined && ` · ${phase.sessionsPerWeek} buổi/tuần`}
                    </p>
                    {size === 'lg' && phase.maxIntensity && (
                      <p className="truncate text-nowrap text-[11px] opacity-70">Cao nhất: {intensityLabel[phase.maxIntensity]}</p>
                    )}
                  </>
                )}
              </div>
            </Tip>
          );
        })}
      </div>
      {showRuler && total > 0 && (
        <div className="mt-1.5 flex justify-between text-[11px] text-gray-500 tabular-nums">
          <span>Tuần 1</span>
          {total > 2 && <span>Tuần {Math.ceil(total / 2)}</span>}
          <span>Tuần {total}</span>
        </div>
      )}
    </div>
  );
}
