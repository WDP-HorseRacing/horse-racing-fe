// Tiện ích nhỏ dùng chung cho các màn hình y tế.
import type { HealthStatus } from '../../../api/types';
import { toDateKey } from '../../../lib/format';
import { now } from '../../../lib/clock';

/** Giá trị cho <input type="datetime-local"> theo giờ địa phương. */
export function toLocalInput(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Ô datetime-local → chuỗi ISO gửi BE; ô trống → undefined. */
export function localToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Ô ngày (YYYY-MM-DD) → ISO lúc 12:00 giờ địa phương, tránh lệch ngày do múi giờ. */
export function dateToIso(value: string): string | undefined {
  if (!value) return undefined;
  return localToIso(`${value}T12:00`);
}

export function todayKey(): string {
  return toDateKey(now());
}

/** Đã quá ngày (so theo ngày lịch, hôm nay chưa tính là quá hạn). */
export function isPastDay(value: string | Date): boolean {
  return toDateKey(value) < todayKey();
}

/** Màu chữ theo sức khỏe: bình thường giữ màu mực, chỉ bất thường mới tô (hổ phách / đỏ). */
export const healthText: Record<HealthStatus, string> = {
  ELIGIBLE: 'text-gray-900',
  UNDER_OBSERVATION: 'text-amber-800',
  INJURED: 'text-red-700',
  QUARANTINED: 'text-red-700',
};

export const HEALTH_ORDER: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];

/** Thứ tự ưu tiên trên bảng điều khiển: nghiêm trọng lên trước. */
export const HEALTH_SEVERITY: HealthStatus[] = ['QUARANTINED', 'INJURED', 'UNDER_OBSERVATION', 'ELIGIBLE'];

export const isSevere = (status: HealthStatus) => status === 'INJURED' || status === 'QUARANTINED';

/** "12500000" / "12.500.000" → 12500000; rỗng hoặc sai → NaN. */
export function parseMoney(value: string): number {
  const digits = value.replace(/[.\s,đ]/g, '');
  if (!digits || !/^\d+$/.test(digits)) return Number.NaN;
  return Number(digits);
}

/** Hiện số tiền đang gõ có dấu chấm ngăn cách hàng nghìn. */
export function formatMoneyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

export const MAX_COST = 10_000_000_000;
