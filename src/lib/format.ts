// Định dạng hiển thị dùng chung. Mọi thời điểm theo múi giờ Asia/Ho_Chi_Minh.

export const DAY_MS = 86_400_000;

/** YYYY-MM-DD theo giờ địa phương (không dùng toISOString vì lệch múi giờ). */
export function toDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(value: Date | string, days: number): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(value.getTime());
  date.setDate(date.getDate() + days);
  return date;
}

export function startOfWeek(value: Date | string): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(value.getTime());
  const day = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

/** 1 = thứ 2 … 7 = chủ nhật */
export function isoDayOfWeek(value: Date | string): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = new Date(toDateKey(from)).getTime();
  const b = new Date(toDateKey(to)).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatDateShort(value?: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  return `${formatTime(value)} ${formatDate(value)}`;
}

/** "2 giờ trước", "hôm qua"… dùng cho thông báo và nhật ký. */
export function formatRelative(value: string, now: Date): string {
  const diff = now.getTime() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hôm qua';
  if (days < 30) return `${days} ngày trước`;
  return formatDate(value);
}

export function formatMoney(amount?: number | null): string {
  if (amount === undefined || amount === null) return '—';
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export function formatDistance(meters: number): string {
  return `${meters.toLocaleString('vi-VN')} m`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Tuổi tính theo ngày sinh. */
export function ageOf(birthDate: string | undefined, now: Date): number | undefined {
  if (!birthDate) return undefined;
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1]?.[0] ?? '?').toUpperCase();
}
