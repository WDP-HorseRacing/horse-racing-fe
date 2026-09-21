// Nguồn thời gian duy nhất của ứng dụng.
// Mọi quy tắc thời gian phải gọi now() — không gọi Date.now() rải rác trong màn hình.
//
// Giờ hệ thống có thể được đặt lệch so với giờ thực để kiểm thử các mốc nghiệp vụ.
// Đây là đồng hồ **lệch giờ chứ không đứng yên**: nó vẫn chạy tiếp theo thời gian thực,
// nếu không thì buổi tập đang diễn ra sẽ không nhận thêm được mẫu dữ liệu nào.
import { getDb, mutate } from '../services/db';

export function now(): Date {
  const { settings } = getDb();
  if (settings.clockMode === 'SHIFTED') {
    return new Date(Date.now() + (settings.clockOffsetMs ?? 0));
  }
  return new Date();
}

/** Đặt giờ hệ thống tới một mốc cụ thể; đồng hồ tiếp tục chạy từ mốc đó. */
export function setSystemTime(value: Date) {
  mutate((db) => {
    db.settings.clockMode = 'SHIFTED';
    db.settings.clockOffsetMs = value.getTime() - Date.now();
  });
}

/** Dịch giờ hệ thống thêm một khoảng, ví dụ +1 giờ hoặc +1 ngày. */
export function shiftTime(ms: number) {
  mutate((db) => {
    db.settings.clockMode = 'SHIFTED';
    db.settings.clockOffsetMs = (db.settings.clockOffsetMs ?? 0) + ms;
  });
}

export function resetToRealTime() {
  mutate((db) => {
    db.settings.clockMode = 'REAL';
    db.settings.clockOffsetMs = 0;
  });
}

/** Chênh lệch hiện tại giữa giờ hệ thống và giờ thực, tính bằng mili giây. */
export function clockOffsetMs(): number {
  const { settings } = getDb();
  return settings.clockMode === 'SHIFTED' ? (settings.clockOffsetMs ?? 0) : 0;
}

export function getSimSpeed(): number {
  return getDb().settings.simSpeed || 1;
}

export function setSimSpeed(speed: number) {
  mutate((db) => {
    db.settings.simSpeed = speed;
  });
}
