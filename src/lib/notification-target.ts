// Bấm vào thông báo thì mở trang nào: dựa vào nhóm thông báo (category) và đối tượng đích (resource) của BE.
// BE không gửi đường dẫn để web và mobile tự quyết màn hình của mình.
import type { NotificationItem } from '../api/types';
import type { UserRole } from '../types/domain';
import { links } from './links';

export function notificationTarget(item: Pick<NotificationItem, 'category' | 'resource' | 'priority'>, role?: UserRole): string | undefined {
  // Vật tư: BE không gửi đối tượng. Sắp hết (HIGH) mở kho, còn lại là tin về đề xuất nên mở tab Đề xuất.
  if (item.category === 'SUPPLY') return item.priority === 'HIGH' ? links.supplies() : links.supplies('requests');
  const resource = item.resource;
  if (!resource) return undefined;
  if (resource.type === 'MEDICAL_CASE') return links.case(resource.id);
  // Cảnh báo thể lực khi tập: mở chi tiết lượt tập (id là lượt tập, horseId đi kèm để tìm buổi).
  if (resource.type === 'SESSION_PARTICIPANT') return links.participant(resource.id, resource.horseId);
  // Thông báo cũ có thể thiếu horseId: với đối tượng là ngựa thì id chính là id ngựa.
  const horseId = resource.horseId ?? (resource.type === 'HORSE' ? resource.id : undefined);
  if (!horseId) return undefined;
  if (resource.type === 'TRAINING_LOCK') return links.horseMedical(horseId);
  switch (item.category) {
    case 'MEASUREMENT_ALERT':
      return links.horse(horseId, 'body');
    case 'EXAM_REQUEST':
      // Bác sĩ xử lý yêu cầu ở hàng đợi; vai trò khác xem ở hồ sơ y tế của ngựa.
      return role === 'VETERINARIAN' ? links.requests : links.horseMedical(horseId);
    case 'HEALTH_STATUS':
    case 'CARE_REMINDER':
      return links.horseMedical(horseId);
    // Flow 4: sự cố mới hoặc mở quá 4 giờ (HLV khu, Quản lý CLB). BE chỉ gửi ngựa, lọc trang Sự cố theo ngựa.
    case 'INCIDENT':
      return links.incidents(horseId);
    // HLV gắn việc có hiệu lực hôm nay: Groom mở màn Việc hôm nay.
    case 'DAILY_CHECKLIST':
      return role === 'GROOM' ? links.dashboard : links.horse(horseId, 'care');
    default:
      return links.horse(horseId);
  }
}
