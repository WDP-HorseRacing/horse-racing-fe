// Định dạng số liệu huấn luyện: thời gian chạy, tốc độ, cự ly, thời lượng.

/** 75400 ms → "1:15.40". Dưới 1 phút → "58.20". */
export function formatRaceTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const totalHundredths = Math.round(ms / 10);
  const minutes = Math.floor(totalHundredths / 6000);
  const seconds = Math.floor((totalHundredths % 6000) / 100);
  const hundredths = totalHundredths % 100;
  const tail = `${String(seconds).padStart(minutes ? 2 : 1, '0')}.${String(hundredths).padStart(2, '0')}`;
  return minutes ? `${minutes}:${tail}` : tail;
}

/** Ô phút hợp lệ: trống hoặc 0 đến 59. */
export function minutePartValid(minutes: string): boolean {
  return minutes === '' || (/^\d{1,2}$/.test(minutes) && Number(minutes) <= 59);
}

/** Ô giây hợp lệ: trống hoặc 0 đến 59,99 (dấu chấm hay phẩy đều được, tối đa 2 chữ số lẻ). */
export function secondPartValid(seconds: string): boolean {
  return seconds === '' || (/^\d{1,2}(?:[.,]\d{0,2})?$/.test(seconds) && Number(seconds.replace(',', '.')) < 60);
}

/** Ghép ô phút và ô giây thành mili giây: ("1", "14,8") → 74800. Trống cả hai hoặc sai thì trả undefined. */
export function msFromParts(minutes: string, seconds: string): number | undefined {
  if ((!minutes && !seconds) || !minutePartValid(minutes) || !secondPartValid(seconds)) return undefined;
  const ms = Math.round((Number(minutes || 0) * 60 + Number((seconds || '0').replace(',', '.'))) * 1000);
  return ms > 0 ? ms : undefined;
}

/** Tách mili giây ra hai ô để sửa: 74800 → { minutes: "1", seconds: "14.8" }. */
export function partsFromMs(ms: number | null | undefined): { minutes: string; seconds: string } {
  if (!ms || !Number.isFinite(ms)) return { minutes: '', seconds: '' };
  const totalHundredths = Math.round(ms / 10);
  const seconds = ((totalHundredths % 6000) / 100).toFixed(2).replace(/\.?0+$/, '');
  return { minutes: String(Math.floor(totalHundredths / 6000)), seconds };
}

/** Chênh lệch so với mục tiêu: "+1.20 giây" hoặc "−0.35 giây". */
export function formatDelta(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '±';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)} giây`;
}

/** m/s → km/h. */
export const toKmh = (mps: number) => mps * 3.6;

export function formatSpeed(mps: number | null | undefined, unit: 'mps' | 'kmh' = 'mps'): string {
  if (mps === null || mps === undefined || !Number.isFinite(mps)) return '—';
  return unit === 'kmh' ? `${toKmh(mps).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km/h` : `${mps.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} m/s`;
}

export function formatMeters(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
  if (meters >= 10_000) return `${(meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
  return `${Math.round(meters).toLocaleString('vi-VN')} m`;
}

/** 2580 giây → "43 phút", 5400 → "1 giờ 30 phút". */
export function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

/** Đồng hồ đếm "mm:ss" cho lượt đang chạy. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(rest).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
