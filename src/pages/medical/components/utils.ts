// Tiện ích nhỏ dùng chung cho các màn hình y tế.
import type { HealthStatus } from '../../../types/domain';
import type { PeriodicRowState } from '../../../services/medical.service';

/** Giá trị cho <input type="datetime-local"> theo giờ địa phương. */
export function toLocalInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Màu chữ theo sức khỏe: bình thường giữ màu mực, chỉ bất thường mới tô (hổ phách / đỏ). */
export const healthText: Record<HealthStatus, string> = {
  ELIGIBLE: 'text-gray-900',
  UNDER_OBSERVATION: 'text-amber-800',
  INJURED: 'text-red-700',
  QUARANTINED: 'text-red-700',
};

export const HEALTH_ORDER: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];

/** Màu chữ tình trạng khám định kỳ: đúng hạn xám, sắp tới hạn / quá hạn hổ phách, quá hạn > 7 ngày đỏ. */
export const periodicText: Record<PeriodicRowState, string> = {
  OK: 'text-gray-500',
  DUE_SOON: 'text-amber-800',
  OVERDUE: 'text-amber-800',
  OVERDUE_ALERT: 'text-red-700',
};

/** "còn 3 ngày" / "hôm nay" / "quá 5 ngày". */
export function dueText(overdueDays: number): string {
  if (overdueDays === 0) return 'Tới hạn hôm nay';
  if (overdueDays > 0) return `Quá ${overdueDays} ngày`;
  return `Còn ${-overdueDays} ngày`;
}
