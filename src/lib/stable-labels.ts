// Nhãn tiếng Việt và kiểm ô cho Flow 4 (vật tư, khẩu phần, checklist, sự cố).
// Câu lỗi validate của BE ở các API này còn tiếng Anh, nên mọi ô được kiểm ở đây trước khi gửi.
import type { ChecklistStatus, FeedingMeal, FeedingPlanStatus, IncidentStatus, SupplyCategory, SupplyMovementType, SupplyRequestStatus } from '../api/types';

export const supplyCategoryText: Record<SupplyCategory, string> = {
  FEED: 'Thức ăn',
  SUPPLEMENT: 'Thực phẩm bổ sung',
  MEDICINE: 'Thuốc',
  EQUIPMENT: 'Dụng cụ',
};

export const SUPPLY_CATEGORIES: SupplyCategory[] = ['FEED', 'SUPPLEMENT', 'MEDICINE', 'EQUIPMENT'];

/** Chỉ hai loại này được đưa vào khẩu phần. */
export const FEEDING_CATEGORIES: SupplyCategory[] = ['FEED', 'SUPPLEMENT'];

export const supplyRequestStatusText: Record<SupplyRequestStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  FULFILLED: 'Đã cấp',
};

export const movementTypeText: Record<SupplyMovementType, string> = {
  COUNT_ADJUST: 'Kiểm kê',
  RESTOCK: 'Cấp theo đề xuất',
};

export const mealText: Record<FeedingMeal, string> = {
  EARLY_MORNING: 'Sáng sớm',
  NOON: 'Trưa',
  AFTERNOON: 'Chiều',
  EVENING: 'Tối',
};

/** Giờ bắt đầu ước lượng của mỗi bữa, để nhấn bữa sắp tới trên màn Hôm nay. */
export const MEAL_HOUR: Record<FeedingMeal, number> = {
  EARLY_MORNING: 5,
  NOON: 11,
  AFTERNOON: 15,
  EVENING: 19,
};

export const feedingPlanStatusText: Record<FeedingPlanStatus, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang áp dụng',
  ARCHIVED: 'Lưu trữ',
};

export const checklistStatusText: Record<ChecklistStatus, string> = {
  PENDING: 'Chưa làm',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Xong',
  INCOMPLETE: 'Không hoàn thành',
};

export const incidentStatusText: Record<IncidentStatus, string> = {
  OPEN: 'Đang mở',
  RESOLVED: 'Đã đóng',
};

/** Gợi ý chèn vào mô tả sự cố: đúng các ví dụ của đề, thay cho trường phân loại. */
export const INCIDENT_HINTS = ['Bỏ ăn', 'Đau bụng', 'Sốt', 'Móng bị xước'];

/** Sự cố thường mở từ 4 giờ trở lên mà chưa chuyển bác sĩ thì BE nhắc HLV khu và Quản lý CLB. */
export const INCIDENT_STALE_HOURS = 4;

/** Số lượng theo kiểu Việt Nam: 2,5 hoặc 1.200. */
export const formatQuantity = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

/** "2,5 kg". */
export const formatAmount = (value: number, unit: string) => `${formatQuantity(value)} ${unit}`;

/** Đọc số người dùng gõ: nhận cả dấu phẩy thập phân ("2,5"). Trả NaN khi không phải số. */
export function parseQuantity(raw: string): number {
  const text = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return Number.NaN;
  return Number(text);
}

/**
 * Kiểm một ô số lượng: số không âm (hoặc dương), tối đa 2 chữ số lẻ, không vượt `max`.
 * Trả câu lỗi tiếng Việt, hoặc undefined khi hợp lệ.
 */
export function quantityError(raw: string, { label = 'Số lượng', positive = true, max = 1_000_000_000 }: { label?: string; positive?: boolean; max?: number } = {}): string | undefined {
  if (!raw.trim()) return `Nhập ${label.toLowerCase()}`;
  const value = parseQuantity(raw);
  if (Number.isNaN(value)) return `${label} phải là số`;
  if (positive ? value <= 0 : value < 0) return positive ? `${label} phải lớn hơn 0` : `${label} không được âm`;
  // So trên chuỗi, không nhân 100 (2,55 × 100 ra 254,999… do số thực).
  if (!/^\d+([.,]\d{1,2})?$/.test(raw.trim().replace(/\s/g, ''))) return `${label} chỉ có tối đa 2 chữ số sau dấu phẩy`;
  if (value > max) return `${label} tối đa ${formatQuantity(max)}`;
  return undefined;
}

/** Kiểm ô chữ bắt buộc sau khi bỏ khoảng trắng (BE chấp nhận chuỗi chỉ có khoảng trắng rồi lưu thành rỗng). */
export function textError(raw: string, { label, max, required = true }: { label: string; max: number; required?: boolean }): string | undefined {
  const text = raw.trim();
  if (!text) return required ? `Nhập ${label.toLowerCase()}` : undefined;
  if (text.length > max) return `${label} tối đa ${max} ký tự`;
  return undefined;
}
