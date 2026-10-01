// Logic lịch cho DatePicker: khóa ngày dạng 'YYYY-MM-DD', lưới tháng bắt đầu từ thứ Hai, gõ tay dd/mm/yyyy.

export const VI_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const VI_MONTHS = Array.from({ length: 12 }, (_, index) => `Tháng ${index + 1}`);

const pad = (value: number) => String(value).padStart(2, '0');

export function keyOf(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** 'YYYY-MM-DD' → { year, month (0-11), day }; sai định dạng thì undefined. */
export function parseKey(key?: string | null) {
  const match = key ? /^(\d{4})-(\d{2})-(\d{2})/.exec(key) : null;
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return undefined;
  return { year, month, day };
}

export function todayKey() {
  const now = new Date();
  return keyOf(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy'. */
export function displayKey(key?: string | null) {
  const parts = parseKey(key);
  return parts ? `${pad(parts.day)}/${pad(parts.month + 1)}/${parts.year}` : '';
}

/** Cộng ngày/tháng/năm, giữ trong tháng đích (31/01 + 1 tháng → 28/02). */
export function shiftKey(key: string, { days = 0, months = 0, years = 0 }: { days?: number; months?: number; years?: number }) {
  const parts = parseKey(key)!;
  if (days) {
    const date = new Date(parts.year, parts.month, parts.day + days);
    return keyOf(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const target = new Date(parts.year + years, parts.month + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return keyOf(target.getFullYear(), target.getMonth(), Math.min(parts.day, last));
}

/** Lưới 6 tuần × 7 ngày của một tháng, bắt đầu từ thứ Hai. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index);
    return { key: keyOf(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), inMonth: date.getMonth() === month };
  });
}

export function inRange(key: string, min?: string, max?: string) {
  return (!min || key >= min.slice(0, 10)) && (!max || key <= max.slice(0, 10));
}

/** Gõ tay: chỉ giữ chữ số, tự chèn '/' thành dd/mm/yyyy. */
export function maskTyped(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** 'dd/mm/yyyy', 'd/m/yyyy', 'dd/mm/yy' hoặc 'ddmmyyyy' → 'YYYY-MM-DD'. */
export function parseTyped(text: string): string | undefined {
  const value = text.trim();
  if (!value) return undefined;
  let day: number;
  let month: number;
  let year: number;
  const parts = value.split(/[/.\-\s]+/).filter(Boolean);
  if (parts.length === 3) {
    [day, month, year] = parts.map(Number);
  } else if (/^\d{8}$/.test(value)) {
    day = Number(value.slice(0, 2));
    month = Number(value.slice(2, 4));
    year = Number(value.slice(4));
  } else return undefined;
  if (year < 100) year += year > 50 ? 1900 : 2000;
  const key = `${year}-${pad(month)}-${pad(day)}`;
  return parseKey(key) ? key : undefined;
}

/** 'HH:mm' hợp lệ thì trả về chuẩn hóa, sai thì undefined. Gõ '930' hoặc '9:30' đều được. */
export function parseTime(text: string): string | undefined {
  const value = text.trim();
  const match = /^(\d{1,2})[:h.]?(\d{2})$/.exec(value) ?? /^(\d{1,2})$/.exec(value);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour > 23 || minute > 59) return undefined;
  return `${pad(hour)}:${pad(minute)}`;
}
