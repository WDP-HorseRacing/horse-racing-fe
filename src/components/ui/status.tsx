// Nhãn trạng thái dùng chung — theo quy tắc "chỉ tô màu khi bất thường":
// bình thường → xám (hoặc ẩn) · cần chú ý → hổ phách · nghiêm trọng → đỏ · đang chạy → xanh cỏ.
import { Check, Lock, X } from 'lucide-react';
import { Dot, Pill, Tip, cn, type DotTone, type PillTone } from './index';
import {
  absenceLabel,
  attendanceLabel,
  caseStatusLabel,
  classStatusLabel,
  examRequestStatusLabel,
  examUrgencyLabel,
  healthLabel,
  intensityLabel,
  lifecycleLabel,
  placementLabel,
  sessionStatusLabel,
  stallStatusLabel,
  zoneStatusLabel,
} from '../../lib/labels';
import type {
  AbsenceReason,
  AttendanceStatus,
  ClassStatus,
  ExamRequestStatus,
  ExamUrgency,
  HealthStatus,
  HorsePlacement,
  LifecycleStatus,
  MedicalCaseStatus,
  NotificationLevel,
  SessionStatus,
  StallStatus,
  TrainingIntensity,
  ZoneStatus,
} from '../../types/domain';
import { careStatusLabel, caseStatusText, eligibilityReasonLabel, placementStatusLabel } from '../../lib/api-labels';
import type {
  CareStatus as ApiCareStatus,
  CaseStatus as ApiCaseStatus,
  CheckupDueStatus as ApiCheckupStatus,
  Eligibility as ApiEligibility,
  PlacementStatus as ApiPlacementStatus,
} from '../../api/types';

/* ===== Sức khỏe ===== */

/** Dùng khi cần Pill (ví dụ trên nền tối hoặc trong nhóm pill). */
export const healthTone: Record<HealthStatus, PillTone> = {
  ELIGIBLE: 'gray',
  UNDER_OBSERVATION: 'amber',
  INJURED: 'red',
  QUARANTINED: 'red',
};

export const healthDot: Record<HealthStatus, DotTone> = {
  ELIGIBLE: 'ok',
  UNDER_OBSERVATION: 'warn',
  INJURED: 'danger',
  QUARANTINED: 'danger',
};

/** Sức khỏe: bình thường là chữ xám; bất thường có chấm màu. Cách ly dùng chấm rỗng để phân biệt với Chấn thương. */
export function HealthPill({ status, className = '' }: { status: HealthStatus; className?: string }) {
  const text: Record<HealthStatus, string> = {
    ELIGIBLE: 'text-gray-500',
    UNDER_OBSERVATION: 'font-medium text-amber-800',
    INJURED: 'font-medium text-red-700',
    QUARANTINED: 'font-medium text-red-700',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]', text[status], className)}>
      {status !== 'ELIGIBLE' && <Dot tone={healthDot[status]} hollow={status === 'QUARANTINED'} />}
      {healthLabel[status]}
    </span>
  );
}

/* ===== Vòng đời, xếp chỗ, khu, ô ===== */

/** Đang hoạt động là trạng thái bình thường nên mặc định không hiện. */
export function LifecyclePill({ status, showActive = false }: { status: LifecycleStatus; showActive?: boolean }) {
  if (status === 'ACTIVE' && !showActive) return null;
  return <Pill tone="gray">{lifecycleLabel[status]}</Pill>;
}

export function DeletedPill() {
  return <Pill tone="gray" className="line-through decoration-gray-400">Đã xóa hồ sơ</Pill>;
}

export function PlacementPill({ placement }: { placement: HorsePlacement }) {
  if (placement === 'PLACED' || placement === 'NONE') {
    return <span className="text-xs text-gray-500">{placementLabel[placement]}</span>;
  }
  return <Pill tone="amber">{placementLabel[placement]}</Pill>;
}

export function ZoneStatusPill({ status }: { status: ZoneStatus }) {
  if (status === 'ACTIVE') return <span className="text-xs text-gray-500">{zoneStatusLabel[status]}</span>;
  return <Pill tone={status === 'MAINTENANCE' ? 'amber' : 'gray'}>{zoneStatusLabel[status]}</Pill>;
}

export function StallStatusPill({ status }: { status: StallStatus }) {
  return <Pill tone={status === 'MAINTENANCE' ? 'amber' : 'gray'}>{stallStatusLabel[status]}</Pill>;
}

/* ===== Cường độ: thanh 4 vạch đơn sắc, không dùng màu riêng cho từng mức ===== */

const INTENSITY_LEVEL: Record<TrainingIntensity, number> = { LIGHT: 1, MEDIUM: 2, HEAVY: 3, MAX: 4 };

export function IntensityMeter({ intensity, showLabel = true }: { intensity: TrainingIntensity; showLabel?: boolean }) {
  const level = INTENSITY_LEVEL[intensity];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-700" title={`Cường độ ${intensityLabel[intensity]}`}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={cn('w-[3px] rounded-[1px]', bar <= level ? 'bg-gray-800' : 'bg-gray-200')}
            style={{ height: 4 + bar * 2 }}
          />
        ))}
      </span>
      {showLabel && intensityLabel[intensity]}
    </span>
  );
}

/** Giữ tên cũ — nay hiển thị dạng thanh vạch. */
export function IntensityPill({ intensity }: { intensity: TrainingIntensity }) {
  return <IntensityMeter intensity={intensity} />;
}

/** Chấm cường độ trong lưới lịch: bốn sắc độ của cùng một màu. */
export const intensityDot: Record<TrainingIntensity, string> = {
  LIGHT: 'bg-gray-300',
  MEDIUM: 'bg-gray-500',
  HEAVY: 'bg-gray-700',
  MAX: 'bg-gray-900',
};

/* ===== Lớp, buổi, tham gia ===== */

export function ClassPill({ status }: { status: ClassStatus }) {
  if (status === 'ACTIVE') {
    return (
      <Pill tone="green">
        <Dot tone="ok" />
        {classStatusLabel[status]}
      </Pill>
    );
  }
  return (
    <Pill tone={status === 'SCHEDULED' ? 'slate' : 'gray'} className={status === 'CANCELLED' ? 'line-through decoration-gray-400' : ''}>
      {classStatusLabel[status]}
    </Pill>
  );
}

export function SessionPill({ status }: { status: SessionStatus }) {
  if (status === 'IN_PROGRESS') {
    return (
      <Pill tone="green" pulse>
        {sessionStatusLabel[status]}
      </Pill>
    );
  }
  if (status === 'AWAITING_REVIEW') return <Pill tone="amber">{sessionStatusLabel[status]}</Pill>;
  return (
    <Pill tone={status === 'SCHEDULED' ? 'slate' : 'gray'} className={status === 'CANCELLED' ? 'line-through decoration-gray-400' : ''}>
      {sessionStatusLabel[status]}
    </Pill>
  );
}

export function AttendancePill({ status, reason }: { status: AttendanceStatus; reason?: AbsenceReason }) {
  if (status === 'ABSENT') {
    return (
      <Pill tone="amber" title={reason ? absenceLabel[reason] : undefined}>
        {attendanceLabel[status]}
        {reason && <span className="font-normal">· {absenceLabel[reason]}</span>}
      </Pill>
    );
  }
  return <Pill tone={status === 'PRESENT' ? 'gray' : 'slate'}>{attendanceLabel[status]}</Pill>;
}

/* ===== Y tế ===== */

export function RequestPill({ status }: { status: ExamRequestStatus }) {
  return <Pill tone={status === 'PENDING' ? 'amber' : status === 'EXAMINED' ? 'gray' : 'slate'}>{examRequestStatusLabel[status]}</Pill>;
}

export function UrgencyPill({ urgency }: { urgency: ExamUrgency }) {
  return urgency === 'URGENT' ? (
    <Pill tone="red">
      <Dot tone="danger" />
      {examUrgencyLabel.URGENT}
    </Pill>
  ) : (
    <Pill tone="slate">{examUrgencyLabel.NORMAL}</Pill>
  );
}

export function CasePill({ status }: { status: MedicalCaseStatus }) {
  return <Pill tone={status === 'OPEN' ? 'amber' : 'gray'}>{caseStatusLabel[status]}</Pill>;
}

export function LockPill({ reason }: { reason?: string }) {
  return (
    <Pill tone="red" className="max-w-full" title={reason}>
      <Lock size={11} />
      <span className="truncate">{reason ? `Khóa huấn luyện — ${reason}` : 'Khóa huấn luyện'}</span>
    </Pill>
  );
}

export const notificationTone: Record<NotificationLevel, { dot: string; label: string; pill: PillTone }> = {
  NORMAL: { dot: 'bg-gray-300', label: 'Thấp', pill: 'gray' },
  HIGH: { dot: 'bg-amber-500', label: 'Trung bình', pill: 'amber' },
  URGENT: { dot: 'bg-red-500', label: 'Khẩn', pill: 'red' },
};

/* ===== Được tập / Được đua ===== */

/**
 * Được phép → chữ xám nhỏ, không nổi bật. Không được phép → đỏ, kèm lý do (A.4.5).
 */
export function EligibilityBadge({
  allowed,
  reason,
  label,
  compact = false,
}: {
  allowed: boolean;
  reason?: string;
  label: string;
  compact?: boolean;
}) {
  const body = (
    <span className={cn('inline-flex max-w-full items-start gap-1.5 text-sm', allowed ? 'text-gray-500' : 'text-red-700')}>
      <span className="mt-[3px] shrink-0">{allowed ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}</span>
      <span className="min-w-0">
        <span className={allowed ? '' : 'font-medium'}>{label}</span>
        {!allowed && reason && !compact && <span className="block text-xs text-red-600/90">{reason}</span>}
      </span>
    </span>
  );
  return compact && !allowed ? <Tip content={reason}>{body}</Tip> : body;
}

interface Check_ {
  allowed: boolean;
  reason?: string;
  code?: string;
}

/**
 * Gộp "được tập / được đua" thành MỘT câu, lý do chỉ nói một lần.
 * - variant "line": một dòng chữ (dùng trong header, danh sách).
 * - variant "banner": dải cảnh báo có viền trái (chỉ hiện khi bị chặn).
 */
export function EligibilityLine({
  train,
  race,
  lifecycle,
  variant = 'line',
  action,
}: {
  train: Check_;
  race: Check_;
  lifecycle?: LifecycleStatus;
  variant?: 'line' | 'banner';
  action?: React.ReactNode;
}) {
  // Giải nghệ / chuyển nhượng: không tập không đua là điều hiển nhiên — không cảnh báo đỏ.
  if (lifecycle && lifecycle !== 'ACTIVE') {
    if (variant === 'banner') return null;
    return <span className="text-sm text-gray-500">{lifecycle === 'RETIRED' ? 'Không học lớp, không đua (đã giải nghệ)' : 'Đã rời câu lạc bộ'}</span>;
  }
  if (train.allowed && race.allowed) {
    if (variant === 'banner') return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
        <Check size={13} strokeWidth={2.5} /> Được tập · Được đua
      </span>
    );
  }
  const severe = !train.allowed;
  const title = !train.allowed ? 'Không được tập và không được đua' : 'Chỉ tập Nhẹ và Trung bình · không được đua';
  const reason = !train.allowed ? train.reason : race.reason;

  if (variant === 'line') {
    return (
      <Tip content={reason}>
        <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', severe ? 'text-red-700' : 'text-amber-800')}>
          <X size={13} strokeWidth={2.5} /> {title}
        </span>
      </Tip>
    );
  }
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-white px-4 py-3 ring-1',
        severe ? 'shadow-[inset_3px_0_0_0_#ef4444] ring-red-200/70' : 'shadow-[inset_3px_0_0_0_#f59e0b] ring-amber-200/70',
      )}
    >
      <div className="min-w-0 text-sm">
        <span className={cn('font-semibold', severe ? 'text-red-700' : 'text-amber-800')}>{title}</span>
        {reason && <span className="text-gray-700"> — {reason}</span>}
      </div>
      {action}
    </div>
  );
}

/** Viền ô chuồng: bình thường xám; chỉ bất thường có màu. */
export const stallBorder: Record<HealthStatus, string> = {
  ELIGIBLE: 'border-gray-200 bg-white',
  UNDER_OBSERVATION: 'border-amber-300 bg-white',
  INJURED: 'border-red-300 bg-white',
  QUARANTINED: 'border-red-300 bg-white',
};

/* ===== Dữ liệu từ backend ===== */

/** Tình trạng xếp chỗ: chỉ nổi bật khi còn chờ xếp khu / chờ xếp ô. */
export function PlacementStatusPill({ status }: { status: ApiPlacementStatus }) {
  if (status === 'PLACED' || status === 'NOT_APPLICABLE') {
    return <span className="text-xs text-gray-500">{placementStatusLabel[status]}</span>;
  }
  return <Pill tone="amber">{placementStatusLabel[status]}</Pill>;
}

/**
 * Được tập / được đua theo mã lý do của backend, gộp thành một câu.
 * Cần theo dõi: vẫn được tập nhưng không được đua (hổ phách). Chấn thương, cách ly, khóa: không tập, không đua (đỏ).
 */
export function EligibilityView({
  eligibility,
  lifecycle,
  variant = 'line',
  action,
}: {
  eligibility: ApiEligibility;
  lifecycle?: LifecycleStatus;
  variant?: 'line' | 'banner';
  action?: React.ReactNode;
}) {
  if (lifecycle && lifecycle !== 'ACTIVE') {
    if (variant === 'banner') return null;
    return <span className="text-sm text-gray-500">{lifecycle === 'RETIRED' ? 'Không học lớp, không đua (đã giải nghệ)' : 'Đã rời câu lạc bộ'}</span>;
  }
  const train = eligibility.trainingEligible;
  const race = eligibility.racingEligible;
  if (train && race) {
    if (variant === 'banner') return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
        <Check size={13} strokeWidth={2.5} /> Được tập · Được đua
      </span>
    );
  }
  const severe = !train;
  const title = severe ? 'Không được tập và không được đua' : 'Vẫn được tập · không được đua';
  const reasons = (severe ? eligibility.trainingReasons : eligibility.racingReasons).map((code) => eligibilityReasonLabel[code]);
  const reason = reasons.join(', ');
  if (variant === 'line') {
    return (
      <Tip content={reason}>
        <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', severe ? 'text-red-700' : 'text-amber-800')}>
          <X size={13} strokeWidth={2.5} /> {title}
        </span>
      </Tip>
    );
  }
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-white px-4 py-3 ring-1',
        severe ? 'shadow-[inset_3px_0_0_0_#ef4444] ring-red-200/70' : 'shadow-[inset_3px_0_0_0_#f59e0b] ring-amber-200/70',
      )}
    >
      <div className="min-w-0 text-sm">
        <span className={cn('font-semibold', severe ? 'text-red-700' : 'text-amber-800')}>{title}</span>
        {reason && <span className="text-gray-700"> — {reason}</span>}
      </div>
      {action}
    </div>
  );
}

/** Mức khẩn của yêu cầu khám (backend dùng true/false). */
export function UrgentPill({ urgent }: { urgent: boolean }) {
  return urgent ? (
    <Pill tone="red">
      <Dot tone="danger" />
      Khẩn
    </Pill>
  ) : (
    <Pill tone="slate">Bình thường</Pill>
  );
}

export function CaseStatusPill({ status }: { status: ApiCaseStatus }) {
  if (status === 'OPEN') return <Pill tone="amber">{caseStatusText.OPEN}</Pill>;
  return (
    <Pill tone="gray" className={status === 'CANCELLED' ? 'line-through decoration-gray-400' : ''}>
      {caseStatusText[status]}
    </Pill>
  );
}

export function CareStatusPill({ status, overdue = false }: { status: ApiCareStatus; overdue?: boolean }) {
  if (status === 'SCHEDULED') return <Pill tone={overdue ? 'red' : 'amber'}>{overdue ? 'Quá hạn' : careStatusLabel.SCHEDULED}</Pill>;
  return (
    <Pill tone="gray" className={status === 'CANCELLED' ? 'line-through decoration-gray-400' : ''}>
      {careStatusLabel[status]}
    </Pill>
  );
}

export function CheckupPill({ status, daysLeft }: { status: ApiCheckupStatus; daysLeft: number }) {
  if (status === 'OK') return <span className="text-xs text-gray-500">Còn {daysLeft} ngày</span>;
  if (status === 'DUE_SOON') return <Pill tone="amber">{daysLeft === 0 ? 'Đến hạn hôm nay' : `Còn ${daysLeft} ngày`}</Pill>;
  return <Pill tone="red">{`Quá hạn ${-daysLeft} ngày`}</Pill>;
}
