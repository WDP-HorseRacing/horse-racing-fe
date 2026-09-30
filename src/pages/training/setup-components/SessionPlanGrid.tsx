// Lịch xem trước của một lớp: mỗi tuần một hàng, 7 ô ngày tính từ ngày bắt đầu lớp.
import { cn, Tip } from '../../../components/ui';
import { IntensityMeter } from '../../../components/ui/status';
import { intensityLabel, surfaceLabel } from '../../../lib/labels';
import { addDays, daysBetween, formatDateShort, toDateKey } from '../../../lib/format';
import type { TrackSurface, TrainingIntensity } from '../../../types/domain';
import { weekdayShort, workoutLine } from './helpers';

export interface PlanCell {
  date: string;
  subjectName: string;
  intensity: TrainingIntensity;
  weekNo?: number;
  phaseName?: string;
  distanceM?: number;
  repetitions?: number;
  surface?: TrackSurface;
}

export function SessionPlanGrid({
  sessions,
  startDate,
  endDate,
  today,
  maxHeight = 'max-h-[560px]',
}: {
  sessions: PlanCell[];
  startDate: string;
  endDate: string;
  today?: string;
  maxHeight?: string;
}) {
  const weekCount = Math.max(1, Math.ceil((daysBetween(startDate, endDate) + 1) / 7));
  const byDate = new Map<string, PlanCell[]>();
  sessions.forEach((session) => byDate.set(session.date, [...(byDate.get(session.date) ?? []), session]));
  const header = Array.from({ length: 7 }, (_, index) => weekdayShort(toDateKey(addDays(startDate, index))));

  return (
    <div className={cn('overflow-auto custom-scrollbar', maxHeight)}>
      <div className="min-w-[560px]">
        <div className="sticky top-0 z-10 grid grid-cols-[88px_repeat(7,minmax(0,1fr))] gap-1 bg-white/95 pb-1.5 backdrop-blur">
          <span />
          {header.map((label, index) => (
            <span key={index} className="text-center text-[11px] font-medium text-gray-500">
              {label}
            </span>
          ))}
        </div>
        <div className="space-y-1">
          {Array.from({ length: weekCount }, (_, week) => {
            const days = Array.from({ length: 7 }, (_, day) => toDateKey(addDays(startDate, week * 7 + day)));
            const first = days.flatMap((date) => byDate.get(date) ?? [])[0];
            return (
              <div key={week} className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))] gap-1">
                <div className="flex flex-col justify-center pr-1">
                  <span className="text-xs font-semibold text-gray-700">Tuần {week + 1}</span>
                  {first?.phaseName && <span className="truncate text-[11px] text-gray-500">{first.phaseName}</span>}
                </div>
                {days.map((date) => {
                  const cells = byDate.get(date) ?? [];
                  const out = date > endDate;
                  return (
                    <div
                      key={date}
                      className={cn(
                        'min-h-[52px] rounded-lg p-1.5',
                        out ? 'bg-transparent' : cells.length > 0 ? 'bg-white ring-1 ring-gray-200' : 'bg-gray-50',
                        date === today && 'ring-2 ring-emerald-600',
                      )}
                    >
                      {!out && <p className="text-[10px] text-gray-400 tabular-nums">{formatDateShort(date)}</p>}
                      {cells.map((cell, index) => (
                        <Tip
                          key={index}
                          content={
                            <span>
                              {cell.subjectName} · {intensityLabel[cell.intensity]}
                              {cell.distanceM !== undefined && ` · ${workoutLine(cell.distanceM, cell.repetitions ?? 1)}`}
                              {cell.surface && ` · sân ${surfaceLabel[cell.surface].toLowerCase()}`}
                            </span>
                          }
                        >
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium leading-tight text-gray-700">
                            <IntensityMeter intensity={cell.intensity} showLabel={false} />
                            <span className="line-clamp-2">{cell.subjectName}</span>
                          </p>
                        </Tip>
                      ))}
                      {!out && cells.length === 0 && <p className="mt-1 text-[10px] text-gray-400">Nghỉ</p>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const INTENSITIES: TrainingIntensity[] = ['LIGHT', 'MEDIUM', 'HEAVY', 'MAX'];

export function IntensityLegend({ className = '' }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500', className)}>
      {INTENSITIES.map((key) => (
        <IntensityMeter key={key} intensity={key} />
      ))}
    </div>
  );
}
