// Lịch của câu lạc bộ theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè), khớp CLUB_TIME_ZONE của backend.
// Dựng thời điểm gửi lên BE luôn kèm +07:00 để không phụ thuộc múi giờ của máy đang mở trang.

const OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY = 24 * 60 * 60 * 1000;

/** Thời điểm ISO của một ngày lịch CLB lúc HH:mm. */
export function clubInstant(dateKey: string, time: string): string {
  return new Date(`${dateKey.slice(0, 10)}T${time}:00+07:00`).toISOString();
}

/** Ngày lịch CLB (YYYY-MM-DD) của một thời điểm. */
export function clubDateKey(value: string | Date): string {
  const time = (typeof value === 'string' ? new Date(value) : value).getTime();
  return new Date(time + OFFSET_MS).toISOString().slice(0, 10);
}

/** Giờ HH:mm theo lịch CLB của một thời điểm. */
export function clubTime(value: string | Date): string {
  const time = (typeof value === 'string' ? new Date(value) : value).getTime();
  return new Date(time + OFFSET_MS).toISOString().slice(11, 16);
}

/** Cộng số ngày vào một ngày lịch. */
export function addDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Số ngày từ a tới b (b − a). */
export function diffDateKeys(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY);
}

/** Thứ theo ISO của một ngày lịch: 1 là thứ Hai, 7 là Chủ nhật. */
export function isoWeekdayOf(dateKey: string): number {
  const day = new Date(`${dateKey.slice(0, 10)}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Hôm nay theo lịch CLB. */
export const clubToday = () => clubDateKey(new Date());

/** Ngày kết thúc lớp = ngày bắt đầu + tổng số tuần × 7 − 1 (khớp BE). */
export const classEndDate = (startDate: string, totalWeeks: number) => addDateKey(startDate, totalWeeks * 7 - 1);

/** Thứ Hai của tuần chứa ngày này. */
export const mondayOf = (dateKey: string) => addDateKey(dateKey, 1 - isoWeekdayOf(dateKey));

/** Số phút giữa hai thời điểm. */
export const minutesBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);

/** Cộng phút vào một thời điểm ISO. */
export const addMinutes = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

/** Kiểm tra chuỗi HH:mm hợp lệ, trả chuỗi chuẩn hoặc undefined. Nhận "6", "630", "6:30", "06h30". */
export function parseClockTime(raw: string): string | undefined {
  const text = raw.trim().replace(/[hH.]/g, ':');
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(text);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return undefined;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
