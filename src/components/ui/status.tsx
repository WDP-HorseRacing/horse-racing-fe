// Nhãn trạng thái dùng chung. Mã màu cố định theo quy ước, luôn kèm chữ.
import { Lock } from 'lucide-react';
import { Pill, type PillTone } from './index';
import {
  healthLabel,
  lifecycleLabel,
  planStatusLabel,
  registrationStatusLabel,
  sessionStatusLabel,
  severityLabel,
} from '../../lib/labels';
import type {
  HealthStatus,
  LifecycleStatus,
  PlanStatus,
  RegistrationStatus,
  SessionStatus,
  Severity,
} from '../../types/domain';

const healthTone: Record<HealthStatus, PillTone> = {
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

const planTone: Record<PlanStatus, PillTone> = {
  SCHEDULED: 'gray',
  ACTIVE: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

export function PlanPill({ status }: { status: PlanStatus }) {
  return <Pill tone={planTone[status]}>{planStatusLabel[status]}</Pill>;
}

const severityTone: Record<Severity, PillTone> = {
  MILD: 'amber',
  MODERATE: 'amber',
  SEVERE: 'red',
};

export function SeverityPill({ severity }: { severity: Severity }) {
  return <Pill tone={severityTone[severity]}>{severityLabel[severity]}</Pill>;
}

const registrationTone: Record<RegistrationStatus, PillTone> = {
  PENDING_OWNER: 'amber',
  REGISTERED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
};

export function RegistrationPill({ status }: { status: RegistrationStatus }) {
  return <Pill tone={registrationTone[status]}>{registrationStatusLabel[status]}</Pill>;
}

export function LockPill({ reason }: { reason?: string }) {
  return (
    <Pill tone="red" className="max-w-full">
      <Lock size={11} />
      <span className="truncate">{reason ? `Khóa huấn luyện — ${reason}` : 'Khóa huấn luyện'}</span>
    </Pill>
  );
}

/** Màu viền ô chuồng theo trạng thái sức khỏe. */
export const stallBorder: Record<HealthStatus, string> = {
  ELIGIBLE: 'border-emerald-200 bg-emerald-50/40',
  UNDER_OBSERVATION: 'border-amber-200 bg-amber-50/50',
  INJURED: 'border-red-200 bg-red-50/50',
  QUARANTINED: 'border-purple-200 bg-purple-50/50',
};
