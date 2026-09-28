// Nhãn trạng thái dùng chung. Mã màu cố định theo quy ước, luôn kèm chữ.
import { AlertOctagon, Check, Lock, X } from 'lucide-react';
import { Pill, Tip, cn, type PillTone } from './index';
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

export const healthTone: Record<HealthStatus, PillTone> = {
  ELIGIBLE: 'green',
  UNDER_OBSERVATION: 'amber',
  INJURED: 'red',
  QUARANTINED: 'purple',
};

export function HealthPill({ status }: { status: HealthStatus }) {
  return <Pill tone={healthTone[status]}>{healthLabel[status]}</Pill>;
}

const lifecycleTone: Record<LifecycleStatus, PillTone> = {
  ACTIVE: 'blue',
  RETIRED: 'gray',
  TRANSFERRED: 'slate',
};

export function LifecyclePill({ status }: { status: LifecycleStatus }) {
  return <Pill tone={lifecycleTone[status]}>{lifecycleLabel[status]}</Pill>;
}

export function DeletedPill() {
  return <Pill tone="red">Đã xóa hồ sơ</Pill>;
}

const placementTone: Record<HorsePlacement, PillTone> = {
  NO_ZONE: 'orange',
  WAITING_STALL: 'amber',
  WAITING_GROOM: 'amber',
  PLACED: 'green',
  NONE: 'slate',
};

export function PlacementPill({ placement }: { placement: HorsePlacement }) {
  return <Pill tone={placementTone[placement]}>{placementLabel[placement]}</Pill>;
}

const zoneTone: Record<ZoneStatus, PillTone> = { ACTIVE: 'green', MAINTENANCE: 'amber', CLOSED: 'gray' };

export function ZoneStatusPill({ status }: { status: ZoneStatus }) {
  return <Pill tone={zoneTone[status]}>{zoneStatusLabel[status]}</Pill>;
}

const stallTone: Record<StallStatus, PillTone> = { AVAILABLE: 'green', OCCUPIED: 'blue', MAINTENANCE: 'amber' };

export function StallStatusPill({ status }: { status: StallStatus }) {
  return <Pill tone={stallTone[status]}>{stallStatusLabel[status]}</Pill>;
}

const intensityTone: Record<TrainingIntensity, PillTone> = { LIGHT: 'green', MEDIUM: 'blue', HEAVY: 'amber', MAX: 'red' };

export function IntensityPill({ intensity }: { intensity: TrainingIntensity }) {
  return <Pill tone={intensityTone[intensity]}>{intensityLabel[intensity]}</Pill>;
}

/** Màu chấm cường độ dùng trong lưới lịch. */
export const intensityDot: Record<TrainingIntensity, string> = {
  LIGHT: 'bg-emerald-400',
  MEDIUM: 'bg-sky-500',
  HEAVY: 'bg-amber-500',
  MAX: 'bg-red-500',
};

const classTone: Record<ClassStatus, PillTone> = {
  SCHEDULED: 'gray',
  ACTIVE: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

export function ClassPill({ status }: { status: ClassStatus }) {
  return <Pill tone={classTone[status]}>{classStatusLabel[status]}</Pill>;
}

const sessionTone: Record<SessionStatus, PillTone> = {
  SCHEDULED: 'gray',
  IN_PROGRESS: 'blue',
  AWAITING_REVIEW: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

export function SessionPill({ status }: { status: SessionStatus }) {
  return (
    <Pill tone={sessionTone[status]} pulse={status === 'IN_PROGRESS'}>
      {sessionStatusLabel[status]}
    </Pill>
  );
}

const attendanceTone: Record<AttendanceStatus, PillTone> = { EXPECTED: 'slate', PRESENT: 'green', ABSENT: 'orange' };

export function AttendancePill({ status, reason }: { status: AttendanceStatus; reason?: AbsenceReason }) {
  return (
    <Pill tone={attendanceTone[status]} title={reason ? absenceLabel[reason] : undefined}>
      {attendanceLabel[status]}
      {status === 'ABSENT' && reason && <span className="font-normal">· {absenceLabel[reason]}</span>}
    </Pill>
  );
}

const requestTone: Record<ExamRequestStatus, PillTone> = { PENDING: 'amber', EXAMINED: 'green', DISMISSED: 'gray' };

export function RequestPill({ status }: { status: ExamRequestStatus }) {
  return <Pill tone={requestTone[status]}>{examRequestStatusLabel[status]}</Pill>;
}

export function UrgencyPill({ urgency }: { urgency: ExamUrgency }) {
  return urgency === 'URGENT' ? (
    <Pill tone="red">
      <AlertOctagon size={11} />
      {examUrgencyLabel.URGENT}
    </Pill>
  ) : (
    <Pill tone="slate">{examUrgencyLabel.NORMAL}</Pill>
  );
}

export function CasePill({ status }: { status: MedicalCaseStatus }) {
  return <Pill tone={status === 'OPEN' ? 'amber' : 'green'}>{caseStatusLabel[status]}</Pill>;
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
  NORMAL: { dot: 'bg-emerald-500', label: 'Thấp', pill: 'green' },
  HIGH: { dot: 'bg-amber-500', label: 'Trung bình', pill: 'amber' },
  URGENT: { dot: 'bg-red-500', label: 'Khẩn', pill: 'red' },
};

/** "Được tập" / "Được đua" — luôn hiện lý do khi không được phép (A.4.5). */
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
    <span
      className={cn(
        'inline-flex max-w-full items-start gap-1.5 text-sm',
        allowed ? 'text-emerald-700' : 'text-red-600',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
          allowed ? 'bg-emerald-100' : 'bg-red-100',
        )}
      >
        {allowed ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="font-semibold">{label}</span>
        {!allowed && reason && !compact && <span className="block text-xs font-normal text-red-500/90">{reason}</span>}
      </span>
    </span>
  );
  return compact && !allowed ? <Tip content={reason}>{body}</Tip> : body;
}

/** Màu viền ô chuồng theo trạng thái sức khỏe. */
export const stallBorder: Record<HealthStatus, string> = {
  ELIGIBLE: 'border-emerald-200 bg-emerald-50/50',
  UNDER_OBSERVATION: 'border-amber-200 bg-amber-50/60',
  INJURED: 'border-red-200 bg-red-50/60',
  QUARANTINED: 'border-fuchsia-200 bg-fuchsia-50/60',
};
