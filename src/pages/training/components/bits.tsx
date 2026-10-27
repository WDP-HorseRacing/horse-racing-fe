// Mảnh giao diện nhỏ dùng chung cho các trang huấn luyện: thanh cường độ, nhãn trạng thái, dải giai đoạn và tải mỗi tuần của giáo án.
import type { ReactNode } from 'react';
import { Flag, Lock } from 'lucide-react';
import { Pill, cn } from '../../../components/ui';
import { INTENSITY_FILL, formatTotalMinutes, type RibbonPhase, type WeekLoad } from '../plan-helpers';
import type {
  MetricAlertLevel,
  ParticipantStatus,
  TrainingClassStatus,
  TrainingSessionStatus,
  TrainingSessionType,
} from '../../../api/types';
import {
  alertLevelText,
  classStatusText,
  participantStatusText,
  sessionStatusText,
} from '../../../lib/training-labels';

/** Cường độ: ba vạch đơn sắc cao dần (dùng chung với components/ui/status). */
export { IntensityMeter as IntensityBars } from '../../../components/ui/status';

/** Dấu "Chạy thử" nhỏ cạnh tên buổi hoặc môn. */
export function TrialBadge({ type, className = '' }: { type: TrainingSessionType; className?: string }) {
  if (type !== 'TIME_TRIAL') return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/70', className)}>
      <Flag size={11} /> Chạy thử
    </span>
  );
}

export function ClassStatusPill({ status }: { status: TrainingClassStatus }) {
  if (status === 'ACTIVE') return <Pill tone="green" pulse>{classStatusText.ACTIVE}</Pill>;
  return (
    <Pill tone="gray" className={status === 'CANCELLED' ? 'line-through decoration-gray-400' : ''}>
      {classStatusText[status]}
    </Pill>
  );
}

export function SessionStatusPill({ status }: { status: TrainingSessionStatus }) {
  if (status === 'IN_PROGRESS') return <Pill tone="green" pulse>{sessionStatusText.IN_PROGRESS}</Pill>;
  if (status === 'SCHEDULED') return <Pill tone="slate">{sessionStatusText.SCHEDULED}</Pill>;
  return (
    <Pill tone="gray" className={status === 'CANCELLED' ? 'line-through decoration-gray-400' : ''}>
      {sessionStatusText[status]}
    </Pill>
  );
}

const PARTICIPANT_TONE: Record<ParticipantStatus, 'green' | 'amber' | 'red' | 'gray' | 'slate'> = {
  PLANNED: 'slate',
  PRESENT: 'gray',
  READY: 'gray',
  ONGOING: 'green',
  COMPLETED: 'green',
  STOPPED: 'amber',
  ABSENT: 'amber',
  SKIPPED: 'gray',
  INELIGIBLE: 'amber',
  CANCELLED_BY_LOCK: 'red',
  CANCELLED: 'gray',
};

export function ParticipantPill({ status, title }: { status: ParticipantStatus; title?: string }) {
  return (
    <Pill tone={PARTICIPANT_TONE[status]} pulse={status === 'ONGOING'} title={title}>
      {status === 'CANCELLED_BY_LOCK' && <Lock size={11} />}
      {participantStatusText[status]}
    </Pill>
  );
}

export function AlertLevelPill({ level }: { level: MetricAlertLevel }) {
  if (level === 'NORMAL') return <Pill tone="gray">{alertLevelText.NORMAL}</Pill>;
  return <Pill tone={level === 'CRITICAL' ? 'red' : 'amber'}>{alertLevelText[level]}</Pill>;
}

/* ===== Dải giai đoạn của giáo án ===== */

const loadTitle = (phase: RibbonPhase) =>
  phase.sessions
    ? `tối thiểu ${phase.sessions} buổi mỗi tuần (${phase.light} Nhẹ, ${phase.heavy} Nặng), ${formatTotalMinutes(phase.minutes)} mỗi tuần`
    : 'chưa có môn';

/**
 * Thanh ngang chia đoạn theo số tuần của từng giai đoạn. Mỗi đoạn chia theo số buổi Nặng (đậm) và Nhẹ (nhạt) tối thiểu mỗi tuần,
 * giai đoạn có chạy thử thì thêm vân sọc. Nhìn là biết giai đoạn nào nặng hơn.
 * `size="lg"` ghi thêm tên giai đoạn, số tuần và số buổi mỗi tuần, `sm` chỉ là dải màu (thẻ giáo án, thẻ lớp).
 */
export function WeekRibbon({
  phases,
  size = 'sm',
  className = '',
  highlightWeek,
}: {
  phases: RibbonPhase[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Tuần hiện tại của lớp (bắt đầu từ 1): vẽ vạch "bây giờ". */
  highlightWeek?: number;
}) {
  const total = phases.reduce((sum, item) => sum + item.weeks, 0);
  if (total === 0) {
    return <div className={cn('rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-400', size === 'lg' ? 'py-5' : 'h-2.5', className)}>{size === 'lg' ? 'Chưa có giai đoạn nào' : null}</div>;
  }
  const heights = { sm: 'h-2.5', md: 'h-7', lg: 'h-12' };
  const starts = phases.map((_, index) => phases.slice(0, index).reduce((sum, item) => sum + item.weeks, 0) + 1);
  return (
    <div className={cn('relative', className)}>
      <div className={cn('flex w-full gap-1 overflow-hidden rounded-lg', heights[size])} data-ribbon>
        {phases.map((phase, index) => {
          const startWeek = starts[index];
          const lastWeek = startWeek + phase.weeks - 1;
          return (
            <div
              key={phase.key}
              data-ribbon-segment={phase.key}
              title={`Giai đoạn ${phase.position}, tuần ${startWeek}${phase.weeks > 1 ? ` đến ${lastWeek}` : ''}: ${loadTitle(phase)}`}
              style={{ flexGrow: phase.weeks, flexBasis: 0 }}
              className={cn('flex min-w-0 gap-px overflow-hidden rounded-[5px]', phase.trial && 'ribbon-trial')}
            >
              {phase.sessions === 0 ? (
                <span className="min-w-0 flex-1 bg-gray-200/70" />
              ) : (
                <>
                  {phase.heavy > 0 && <span className={cn('min-w-0', INTENSITY_FILL.HEAVY)} style={{ flexGrow: phase.heavy }} />}
                  {phase.light > 0 && <span className={cn('min-w-0', INTENSITY_FILL.LIGHT)} style={{ flexGrow: phase.light }} />}
                </>
              )}
            </div>
          );
        })}
      </div>
      {highlightWeek !== undefined && highlightWeek >= 1 && highlightWeek <= total && (
        <span
          aria-hidden
          className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full bg-gray-900"
          style={{ left: `calc(${((highlightWeek - 0.5) / total) * 100}% - 1px)` }}
        />
      )}
      {size === 'lg' && (
        <div className="mt-1.5 flex gap-1 text-[11px] tabular-nums text-gray-500">
          {phases.map((phase) => (
            <span key={phase.key} style={{ flexGrow: phase.weeks, flexBasis: 0 }} className="min-w-0 truncate">
              Giai đoạn {phase.position} · {phase.weeks} tuần · {phase.sessions} buổi/tuần
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tải tối thiểu một tuần của giai đoạn: số buổi, Nhẹ, Nặng, số phút. */
export function PhaseLoad({ load, className = '' }: { load: WeekLoad; className?: string }) {
  if (!load.sessions) return <p className={cn('text-xs text-gray-400', className)}>Chưa có môn</p>;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)} data-phase-load>
      <span className="rounded-md bg-gray-100 px-2 py-1 font-medium text-gray-800">
        Tối thiểu <b className="tabular-nums">{load.sessions}</b> buổi mỗi tuần
      </span>
      {load.heavy > 0 && <span className={cn('rounded-md px-2 py-1 font-medium', INTENSITY_FILL.HEAVY)}>{load.heavy} Nặng</span>}
      {load.light > 0 && <span className={cn('rounded-md px-2 py-1 font-medium', INTENSITY_FILL.LIGHT)}>{load.light} Nhẹ</span>}
      <span className="rounded-md bg-gray-100 px-2 py-1 tabular-nums text-gray-700">{formatTotalMinutes(load.minutes)}/tuần</span>
    </div>
  );
}

/** Ô thông số nhỏ (nhãn trên, số dưới) dùng trong các thẻ huấn luyện. */
export function Figure({ label, value, mono = true, className = '' }: { label: ReactNode; value: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn('mt-0.5 truncate text-sm font-semibold text-gray-900', mono && 'font-mono tabular-nums')}>{value ?? '—'}</p>
    </div>
  );
}
