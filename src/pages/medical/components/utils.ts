// Tiện ích nhỏ dùng chung cho các màn hình y tế.
import type { HealthStatus } from '../../../types/domain';
import type { PeriodicRowState } from '../../../services/medical.service';
import type { PillTone } from '../../../components/ui';

/** Giá trị cho <input type="datetime-local"> theo giờ địa phương. */
export function toLocalInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Màu nhận diện của 4 trạng thái sức khỏe (nút chọn, chấm, ô chuồng). */
export const healthSwatch: Record<HealthStatus, { dot: string; active: string; idle: string; text: string; bar: string }> = {
  ELIGIBLE: {
    dot: 'bg-emerald-500',
    active: 'bg-emerald-600 text-white ring-emerald-600 shadow-[0_10px_24px_-12px_rgba(5,150,105,0.9)]',
    idle: 'bg-emerald-50/60 text-emerald-800 ring-emerald-100 hover:ring-emerald-300',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
  UNDER_OBSERVATION: {
    dot: 'bg-amber-500',
    active: 'bg-amber-500 text-white ring-amber-500 shadow-[0_10px_24px_-12px_rgba(217,119,6,0.9)]',
    idle: 'bg-amber-50/60 text-amber-800 ring-amber-100 hover:ring-amber-300',
    text: 'text-amber-700',
    bar: 'bg-amber-400',
  },
  INJURED: {
    dot: 'bg-red-500',
    active: 'bg-red-600 text-white ring-red-600 shadow-[0_10px_24px_-12px_rgba(220,38,38,0.9)]',
    idle: 'bg-red-50/60 text-red-800 ring-red-100 hover:ring-red-300',
    text: 'text-red-700',
    bar: 'bg-red-500',
  },
  QUARANTINED: {
    dot: 'bg-fuchsia-500',
    active: 'bg-fuchsia-600 text-white ring-fuchsia-600 shadow-[0_10px_24px_-12px_rgba(192,38,211,0.9)]',
    idle: 'bg-fuchsia-50/60 text-fuchsia-800 ring-fuchsia-100 hover:ring-fuchsia-300',
    text: 'text-fuchsia-700',
    bar: 'bg-fuchsia-500',
  },
};

export const HEALTH_ORDER: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];

export const periodicTone: Record<PeriodicRowState, PillTone> = {
  OK: 'green',
  DUE_SOON: 'amber',
  OVERDUE: 'orange',
  OVERDUE_ALERT: 'red',
};

/** "còn 3 ngày" / "hôm nay" / "quá 5 ngày". */
export function dueText(overdueDays: number): string {
  if (overdueDays === 0) return 'Tới hạn hôm nay';
  if (overdueDays > 0) return `Quá ${overdueDays} ngày`;
  return `Còn ${-overdueDays} ngày`;
}
