// Mảnh giao diện nhỏ dùng chung cho các trang huấn luyện: thanh cường độ, nhãn trạng thái, dải tuần và tuần mẫu của giáo án.
import type { ReactNode } from 'react';
import { Flag, Lock } from 'lucide-react';
import { Pill, cn } from '../../../components/ui';
import { DAY_FILL, type DaySlot, type RibbonPhase } from '../plan-helpers';
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
  weekdayShort,
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
  if (status === 'DRAFT') return <Pill tone="slate" className="border border-dashed border-gray-300 ring-0">{classStatusText.DRAFT}</Pill>;
  return (
    <Pill tone="gray" className={status === 'CANCELLED' ? 'line-through decoration-gray-400' : ''}>
      {classStatusText[status]}
    </Pill>
  );
}

export function SessionStatusPill({ status }: { status: TrainingSessionStatus }) {
  if (status === 'IN_PROGRESS') return <Pill tone="green" pulse>{sessionStatusText.IN_PROGRESS}</Pill>;
  if (status === 'DRAFT') return <Pill tone="slate" className="border border-dashed border-gray-300 ring-0">{sessionStatusText.DRAFT}</Pill>;
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

/* ===== Dải tuần của giáo án ===== */

const dayTitle = (day: DaySlot | null, index: number) => `${weekdayShort[index + 1]}: ${day ? day.name : 'nghỉ'}`;

/**
 * Thanh ngang chia đoạn theo số tuần của từng giai đoạn. Mỗi đoạn là tuần mẫu 7 ngày: ngày có môn tô sắc xanh theo cường độ,
 * ngày chạy thử có vân sọc, ngày nghỉ để nhạt. Nhìn là biết tuần có xen kẽ nhẹ và nặng hay không.
 * `size="lg"` ghi thêm tên giai đoạn và số tuần, `sm` chỉ là dải màu (thẻ giáo án, ô chọn).
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
              title={`Giai đoạn ${phase.position}, tuần ${startWeek}${phase.weeks > 1 ? ` đến ${lastWeek}` : ''}. ${phase.days.map(dayTitle).join(', ')}`}
              style={{ flexGrow: phase.weeks, flexBasis: 0 }}
              className="grid min-w-0 grid-cols-7 gap-px overflow-hidden rounded-[5px]"
            >
              {phase.days.map((day, index) => (
                <span key={index} className={cn('min-w-0', day ? DAY_FILL[day.intensity] : 'bg-gray-200/70', day?.sessionType === 'TIME_TRIAL' && 'ribbon-trial')} />
              ))}
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
              Giai đoạn {phase.position} · {phase.weeks} tuần
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tuần mẫu của một giai đoạn: 7 ô thứ, ô có môn ghi tên môn và tô theo cường độ. */
export function WeekPattern({ days, className = '', compact }: { days: (DaySlot | null)[]; className?: string; compact?: boolean }) {
  return (
    <div className={cn('grid grid-cols-7 gap-1', className)} data-week-pattern>
      {days.map((day, index) => (
        <div
          key={index}
          data-pattern-day
          title={dayTitle(day, index)}
          className={cn(
            'flex min-w-0 flex-col justify-between rounded-lg px-1.5 py-1',
            compact ? 'h-9' : 'h-14',
            day ? DAY_FILL[day.intensity] : 'border border-dashed border-gray-200 bg-white text-gray-300',
            day?.sessionType === 'TIME_TRIAL' && 'ribbon-trial',
          )}
        >
          <span className="font-mono text-[10px] font-semibold opacity-80">{weekdayShort[index + 1]}</span>
          {!compact && <span className="truncate text-[11px] font-semibold leading-tight">{day ? day.name : 'Nghỉ'}</span>}
        </div>
      ))}
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
