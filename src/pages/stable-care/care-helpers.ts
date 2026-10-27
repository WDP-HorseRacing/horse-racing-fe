// Hàm phụ dùng chung của các màn Flow 4 (không phải component, tách riêng để Fast Refresh chạy đúng).
import type { DailyChecklist, Incident, SupplyItem } from '../../api/types';
import { now } from '../../lib/clock';
import { INCIDENT_STALE_HOURS } from '../../lib/stable-labels';

const HOUR = 60 * 60 * 1000;

/** Sự cố thường còn mở từ 4 giờ trở lên mà chưa chuyển bác sĩ (BE đã nhắc HLV khu và Quản lý CLB). */
export const incidentStale = (incident: Incident, at = now()) =>
  incident.status === 'OPEN' && !incident.examRequest && at.getTime() - new Date(incident.createdAt).getTime() >= INCIDENT_STALE_HOURS * HOUR;

/** Màu thanh tồn kho: đỏ khi sắp hết, hổ phách khi gần ngưỡng (dưới 1,5 lần), xanh khi đủ. */
export function stockTone(item: SupplyItem): 'green' | 'amber' | 'red' {
  // Hết hẳn mới đỏ; sắp hết là việc cần chú ý (hổ phách).
  if (item.quantityOnHand <= 0) return 'red';
  return item.lowStock || item.quantityOnHand <= item.reorderThreshold * 1.5 ? 'amber' : 'green';
}

/** Số việc đã xong trên tổng số của một checklist. */
export function checklistProgress(checklist: DailyChecklist | null | undefined) {
  const items = checklist?.items ?? [];
  return { done: items.filter((item) => item.done).length, total: items.length };
}
