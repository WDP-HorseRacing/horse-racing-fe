// Bấm vào thông báo thì mở trang nào: dựa vào nhóm thông báo (category) và đối tượng đích (resource) của BE.
// BE không gửi đường dẫn để web và mobile tự quyết màn hình của mình.
import type { NotificationItem } from '../api/types';
import type { UserRole } from '../types/domain';
import { links } from './links';

export function notificationTarget(item: Pick<NotificationItem, 'category' | 'resource'>, role?: UserRole): string | undefined {
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
    default:
      return links.horse(horseId);
  }
}
