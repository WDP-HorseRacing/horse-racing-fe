// Thông báo của người đang đăng nhập: lịch sử, số chưa đọc, đánh dấu đã đọc. Thông báo mới đến qua socket (realtime.ts).
import { http } from './http';
import type { NotificationItem, NotificationPage, NotificationPriority } from './types';

/** Mới nhất lên trên, phân trang bằng cursor. BE nhận tối đa 50 bản ghi mỗi trang. */
export const listNotifications = (query: { limit?: number; cursor?: string | null; unreadOnly?: boolean; priority?: NotificationPriority } = {}) =>
  http.get<NotificationPage>('/notifications', query);
export const getUnreadNotificationCount = () => http.get<{ count: number }>('/notifications/unread-count');
export const markNotificationRead = (id: string) => http.patch<NotificationItem>(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => http.patch<{ count: number }>('/notifications/read-all');
