// Mảnh giao diện nhỏ dùng chung cho các trang huấn luyện: thanh cường độ, nhãn trạng thái, dải tuần của giáo án.
import type { ReactNode } from 'react';
import { Flag, Lock } from 'lucide-react';
import { Pill, cn } from '../../../components/ui';
import type {
  MetricAlertLevel,
  ParticipantStatus,
  TrainingClassStatus,
  TrainingIntensity,
  TrainingSessionStatus,
  TrainingPlan,
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

export interface RibbonSegment {
  key: string;
  name: string;
  weeks: number;
  intensity: TrainingIntensity;
  sessionType: TrainingSessionType;
}

/** Đổi danh sách môn của giáo án sang các đoạn của dải tuần. */
export const planSegments = (plan: Pick<TrainingPlan, 'subjects'>): RibbonSegment[] =>
  plan.subjects.map((item) => ({
    key: `${item.position}-${item.subject.id}`,
    name: item.subject.name,
    weeks: item.weeks,
    intensity: item.subject.intensity,
    sessionType: item.subject.sessionType,
  }));

const SEGMENT_FILL: Record<TrainingIntensity, string> = {
  LIGHT: 'bg-emerald-200 text-emerald-950',
  MODERATE: 'bg-emerald-400 text-emerald-950',
  HEAVY: 'bg-emerald-700 text-white',
};

/**
 * Thanh ngang chia đoạn theo số tuần của từng môn, sắc độ xanh theo cường độ, môn chạy thử có vân sọc và cờ.
 * `size="lg"` hiện tên môn và mốc tuần (trình lập giáo án), `sm` chỉ là dải màu (thẻ giáo án, ô chọn).
 */
export function WeekRibbon({
  segments,
  size = 'sm',
  className = '',
  highlightWeek,
}: {
  segments: RibbonSegment[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Tuần hiện tại của lớp (bắt đầu từ 1): vẽ vạch "bây giờ". */
  highlightWeek?: number;
}) {
  const total = segments.reduce((sum, item) => sum + item.weeks, 0);
  if (total === 0) {
    return <div className={cn('rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-400', size === 'lg' ? 'py-5' : 'h-2.5', className)}>{size === 'lg' ? 'Chưa có môn nào' : null}</div>;
  }
  const heights = { sm: 'h-2.5', md: 'h-7', lg: 'h-14' };
  let cursor = 0;
  return (
    <div className={cn('relative', className)}>
      <div className={cn('flex w-full gap-[3px] overflow-hidden rounded-lg', heights[size])} data-ribbon>
        {segments.map((segment) => {
          const startWeek = cursor + 1;
          cursor += segment.weeks;
          const trial = segment.sessionType === 'TIME_TRIAL';
          return (
            <div
              key={segment.key}
              data-ribbon-segment={segment.key}
              title={`${segment.name}, tuần ${startWeek}${segment.weeks > 1 ? ` đến ${cursor}` : ''}`}
              style={{ flexGrow: segment.weeks, flexBasis: 0 }}
              className={cn('relative flex min-w-0 items-center gap-1 overflow-hidden px-2', SEGMENT_FILL[segment.intensity], trial && 'ribbon-trial')}
            >
              {size !== 'sm' && (
                <>
                  {trial && <Flag size={12} className="shrink-0" />}
                  <span className={cn('truncate font-semibold', size === 'lg' ? 'text-xs' : 'text-[11px]')}>{segment.name}</span>
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
        <div className="mt-1.5 flex text-[11px] tabular-nums text-gray-400">
          {Array.from({ length: total }, (_, index) => (
            <span key={index} className="flex-1 text-center">
              {total <= 16 || (index + 1) % 2 === 1 ? `T${index + 1}` : ''}
            </span>
          ))}
        </div>
      )}
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
