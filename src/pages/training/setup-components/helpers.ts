// Tiện ích hiển thị dùng chung cho các trang thiết lập Flow 2 (môn học, giáo án, lớp, lịch).
import { dayOfWeekLabel } from '../../../lib/labels';
import { isoDayOfWeek } from '../../../lib/format';

const SHORT_DAY: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };

/** "T2" … "CN" */
export function weekdayShort(date: string): string {
  return SHORT_DAY[isoDayOfWeek(date)];
}

/** "Thứ 2" … "Chủ nhật" */
export function weekdayLong(date: string): string {
  return dayOfWeekLabel[isoDayOfWeek(date)];
}

/** "400 m × 3" — lặp 1 lần thì chỉ ghi cự ly. */
export function workoutLine(distanceM: number, repetitions: number): string {
  const distance = `${distanceM.toLocaleString('vi-VN')} m`;
  return repetitions > 1 ? `${distance} × ${repetitions}` : distance;
}

export function volumeLabel(meters: number): string {
  if (meters >= 10_000) return `${(meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
  return `${meters.toLocaleString('vi-VN')} m`;
}

/** Màu các giai đoạn trên thanh thời gian — chỉ các sắc độ xanh cỏ xen kẽ, không màu nào khác. */
export const PHASE_TONES = ['bg-emerald-800 text-white', 'bg-emerald-600 text-white', 'bg-emerald-700 text-white'];

export function phaseTone(index: number): string {
  return PHASE_TONES[index % PHASE_TONES.length];
}
