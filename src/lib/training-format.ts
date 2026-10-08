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

/**
 * Đọc thời gian chạy người dùng gõ: "1:15.4", "1:15,40", "75.4", "75". Trả ms hoặc undefined.
 * Phần sau dấu chấm là phần trăm giây (1 hoặc 2 chữ số).
 */
export function parseRaceTime(raw: string): number | undefined {
  const text = raw.trim().replace(',', '.');
  if (!text) return undefined;
  const match = /^(?:(\d{1,2}):)?(\d{1,3})(?:\.(\d{1,3}))?$/.exec(text);
  if (!match) return undefined;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds > 59) return undefined;
  const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
  const ms = Math.round((minutes * 60 + seconds + fraction) * 1000);
  return ms > 0 ? ms : undefined;
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
