// Khung giờ thao tác lượt tập, khớp BE (`training/constants/participant-window.constants.ts`):
// điểm danh, báo vắng mở 30 phút trước giờ buổi; báo sẵn sàng, bắt đầu mở 15 phút trước; tất cả đóng lúc buổi kết thúc.
// Hoàn thành không giới hạn. Con số còn chờ BA chốt: BE đổi thì sửa hai hằng dưới đây.
// Hết giờ mà lượt chưa tập thì BE tự chuyển trong 1 phút: Chờ điểm danh thành Vắng, Có mặt, Sẵn sàng thành Bỏ qua.
import { clubDateKey, clubTime } from './club-time';
import { now } from './clock';

export const CHECK_IN_OPENS_BEFORE_MIN = 30;
export const START_OPENS_BEFORE_MIN = 15;

/** `checkIn`: điểm danh, báo vắng. `start`: báo sẵn sàng, bắt đầu. */
export type WindowKind = 'checkIn' | 'start';

export type ActionWindow = { state: 'open' } | { state: 'early'; opensAt: Date } | { state: 'closed'; closedAt: Date };

interface SessionTimes {
  scheduledStartAt: string;
  scheduledEndAt: string;
}

export function windowOpensAt(session: SessionTimes, kind: WindowKind): Date {
  const before = kind === 'checkIn' ? CHECK_IN_OPENS_BEFORE_MIN : START_OPENS_BEFORE_MIN;
  return new Date(new Date(session.scheduledStartAt).getTime() - before * 60_000);
}

export function actionWindow(session: SessionTimes, kind: WindowKind, at: Date = now()): ActionWindow {
  const opensAt = windowOpensAt(session, kind);
  const closedAt = new Date(session.scheduledEndAt);
  if (at < opensAt) return { state: 'early', opensAt };
  if (at >= closedAt) return { state: 'closed', closedAt };
  return { state: 'open' };
}

/** Giờ mở theo giờ câu lạc bộ, khác ngày hôm nay thì kèm ngày: "14:30" hoặc "14:30 ngày 14/10". */
export function openingText(opensAt: Date, at: Date = now()): string {
  const day = clubDateKey(opensAt);
  return day === clubDateKey(at) ? clubTime(opensAt) : `${clubTime(opensAt)} ngày ${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** Câu thay cho nút khi ngoài khung giờ ("Điểm danh mở lúc 14:30", "Hết giờ điểm danh"). Trong khung thì null. */
export function lockedText(label: string, window: ActionWindow, at: Date = now()): string | null {
  if (window.state === 'early') return `${label} mở lúc ${openingText(window.opensAt, at)}`;
  if (window.state === 'closed') return `Hết giờ ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  return null;
}
