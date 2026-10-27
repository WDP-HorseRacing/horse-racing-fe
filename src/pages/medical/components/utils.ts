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

/** Loại kết luận quyết định sức khỏe sau khám: mở bệnh án, bình thường, hay tái khám trong bệnh án. */
export type HealthMode = 'ISSUE' | 'NORMAL' | 'FOLLOW_UP';

/**
 * Sức khỏe sau khám được chọn theo kết luận:
 *  - Có vấn đề (mở bệnh án): Cần theo dõi / Chấn thương / Cách ly, bắt buộc chọn.
 *  - Bình thường: Đủ điều kiện / Cần theo dõi / Cách ly; ngựa đang Chấn thương thì phải chọn trạng thái mới.
 *  - Tái khám: cả bốn, không bắt buộc.
 */
export function healthChoices(mode: HealthMode, current?: HealthStatus): { allowed: HealthStatus[]; required: boolean; note?: string } {
  if (mode === 'ISSUE') {
    return { allowed: ['UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'], required: true, note: 'Có bệnh án thì ngựa ít nhất Cần theo dõi.' };
  }
  if (mode === 'NORMAL') {
    return {
      allowed: ['ELIGIBLE', 'UNDER_OBSERVATION', 'QUARANTINED'],
      required: current === 'INJURED',
      note: current === 'INJURED' ? 'Kết luận bình thường thì ngựa không còn Chấn thương, chọn trạng thái mới.' : 'Kết luận bình thường thì không ghi Chấn thương, cần thì mở bệnh án.',
    };
  }
  return { allowed: HEALTH_ORDER, required: false };
}

export { formatMoneyInput, parseMoney } from '../../../lib/format';

export const MAX_COST = 10_000_000_000;
