// Luật nghiệp vụ của hồ sơ ngựa dùng chung cho nhiều màn hình, khớp với backend.
// Backend vẫn kiểm lại khi lưu. Ở đây chỉ để báo lỗi ngay tại ô, lọc danh sách chọn và ẩn nút.
import type { LifecycleStatus } from '../api/types';
import { shiftKey } from './calendar';
import { now } from './clock';
import { ageOf } from './format';

/** Ngựa đã rời câu lạc bộ (bán ra ngoài hoặc đã mất): không còn chỗ ở, hồ sơ chỉ đọc. */
export function leftClub(status: LifecycleStatus) {
  return status === 'TRANSFERRED' || status === 'DECEASED';
}

/** Câu báo hồ sơ chỉ đọc vì ngựa đã rời câu lạc bộ. */
export function leftClubText(status: LifecycleStatus) {
  return status === 'DECEASED' ? 'Ngựa đã mất, hồ sơ chỉ được xem.' : 'Ngựa đã chuyển nhượng, hồ sơ chỉ được xem.';
}

/** Hồ sơ chỉ được xem: đã xóa, đã chuyển nhượng hoặc đã mất. */
export function isReadOnlyHorse(horse: { isDeleted?: boolean; lifecycleStatus: LifecycleStatus }) {
  return !!horse.isDeleted || leftClub(horse.lifecycleStatus);
}

/** Tuổi tròn năm. Ngựa đã mất thì tính tới ngày mất, không tăng tuổi theo thời gian. */
export function horseAge(dateOfBirth: string | null | undefined, dateOfDeath?: string | null) {
  if (!dateOfBirth) return undefined;
  const until = dateOfDeath ? new Date(`${dateOfDeath}T00:00:00`) : now();
  return Math.max(0, ageOf(`${dateOfBirth}T00:00:00`, until) ?? 0);
}

/** "7 tuổi", hoặc "Mất lúc 7 tuổi" với ngựa đã mất. */
export function horseAgeText(dateOfBirth: string | null | undefined, dateOfDeath?: string | null) {
  const age = horseAge(dateOfBirth, dateOfDeath);
  if (age === undefined) return undefined;
  const text = age < 1 ? 'dưới 1 tuổi' : `${age} tuổi`;
  return dateOfDeath ? `Mất lúc ${text}` : text.charAt(0).toUpperCase() + text.slice(1);
}

/** Câu lạc bộ chỉ quản lý ngựa trưởng thành: ngựa dưới 1 tuổi còn ở trại nuôi ngựa non. */
export const MIN_HORSE_AGE_YEARS = 1;
/** Mốc trên để bắt lỗi gõ nhầm năm sinh. */
export const MAX_HORSE_AGE_YEARS = 40;
/** Cha, mẹ phải lớn hơn ngựa con ít nhất chừng này năm (dậy thì ~1 tuổi, mang thai ~11 tháng). */
export const PARENT_AGE_GAP_YEARS = 2;

/** Khoảng ngày sinh hợp lệ tính tới hôm nay (YYYY-MM-DD), dùng làm min / max cho lịch chọn ngày. */
export function birthDateRange(today: string) {
  return {
    min: shiftKey(today, { years: -MAX_HORSE_AGE_YEARS }),
    max: shiftKey(today, { years: -MIN_HORSE_AGE_YEARS }),
  };
}

/** Câu lỗi khi ngày sinh nằm ngoài khoảng hợp lệ, undefined nếu hợp lệ. */
export function birthDateError(dateOfBirth: string, today: string): string | undefined {
  const range = birthDateRange(today);
  if (dateOfBirth > today) return 'Ngày sinh không được ở tương lai';
  if (dateOfBirth > range.max) return `Câu lạc bộ chỉ nhận ngựa đủ ${MIN_HORSE_AGE_YEARS} tuổi trở lên`;
  if (dateOfBirth < range.min) return `Ngựa không thể quá ${MAX_HORSE_AGE_YEARS} tuổi, kiểm tra lại năm sinh`;
  return undefined;
}

/** Cha/mẹ đủ lớn so với ngựa con. Thiếu ngày sinh một bên thì không kiểm được, coi như hợp lệ. */
export function parentOldEnough(parentBirth: string | null | undefined, childBirth: string | null | undefined) {
  if (!parentBirth || !childBirth) return true;
  return parentBirth <= shiftKey(childBirth, { years: -PARENT_AGE_GAP_YEARS });
}
