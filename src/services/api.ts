// Hạ tầng chung cho mọi service: độ trễ, phiên đăng nhập, nhật ký thao tác, thông báo.
import type { AppNotification, AuditLog, Database, NotificationLevel, User, UserRole } from '../types/domain';
import { AppError, ERR_FORBIDDEN, getDb, mutate, newId, stamp } from './db';
import { can } from '../auth/permissions';

const SESSION_KEY = 'horseracing_session';

/** Giả lập độ trễ mạng để giao diện có trạng thái đang tải thật. */
export function delay<T>(value: T): Promise<T> {
  const ms = 120 + Math.random() * 160;
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/* ===== Phiên đăng nhập ===== */

export function getCurrentUserId(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function getCurrentUser(): User | null {
  const userId = getCurrentUserId();
  if (!userId) return null;
  return getDb().users.find((user) => user.id === userId && user.active) ?? null;
}

export function setCurrentUser(userId: string | null) {
  if (userId) window.localStorage.setItem(SESSION_KEY, userId);
  else window.localStorage.removeItem(SESSION_KEY);
}

export function requireUser(): User {
  const user = getCurrentUser();
  if (!user) throw new AppError('Phiên đăng nhập đã hết hạn');
  return user;
}

export function requirePermission(key: string): User {
  const user = requireUser();
  if (!can(user, key)) throw new AppError(ERR_FORBIDDEN);
  return user;
}

/* ===== Nhật ký thao tác ===== */

export interface AuditInput {
  action: string;
  entityType: string;
  entityId: string;
  horseId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  actor?: User | null;
  bySystem?: boolean;
}

export function writeAudit(db: Database, at: Date, input: AuditInput) {
  const actor = input.actor ?? getCurrentUser();
  const entry: AuditLog = {
    id: newId('al'),
    at: at.toISOString(),
    userId: input.bySystem ? 'SYSTEM' : actor?.id ?? 'SYSTEM',
    userName: input.bySystem ? 'Hệ thống' : actor?.name ?? 'Hệ thống',
    role: input.bySystem ? 'SYSTEM' : ((actor?.role ?? 'SYSTEM') as UserRole | 'SYSTEM'),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    horseId: input.horseId,
    before: input.before,
    after: input.after,
    reason: input.reason,
    ...stamp(at),
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 600) db.auditLogs.length = 600;
}

/* ===== Thông báo ===== */

export interface NotifyInput {
  userId: string;
  level?: NotificationLevel;
  title: string;
  body: string;
  link?: string;
}

export function pushNotification(db: Database, at: Date, input: NotifyInput) {
  if (!input.userId) return;
  const entry: AppNotification = {
    id: newId('nt'),
    userId: input.userId,
    level: input.level ?? 'NORMAL',
    title: input.title,
    body: input.body,
    link: input.link,
    ...stamp(at),
  };
  db.notifications.unshift(entry);
  // Giới hạn theo từng người nhận để thông báo của người này không đẩy mất của người khác.
  const mine = db.notifications.filter((item) => item.userId === input.userId);
  if (mine.length > 60) {
    const drop = new Set(mine.slice(60).map((item) => item.id));
    db.notifications = db.notifications.filter((item) => !drop.has(item.id));
  }
}

/** Gửi cùng một thông báo cho nhiều người, bỏ trùng và bỏ mã rỗng. */
export function notifyMany(
  db: Database,
  at: Date,
  userIds: (string | undefined)[],
  input: Omit<NotifyInput, 'userId'>,
) {
  [...new Set(userIds.filter(Boolean) as string[])].forEach((userId) => pushNotification(db, at, { ...input, userId }));
}

/* ===== Chống ghi đè ===== */

export function assertVersion(current: { version: number }, expected?: number) {
  if (expected !== undefined && current.version !== expected) {
    throw new AppError('Dữ liệu vừa được người khác thay đổi, vui lòng tải lại biểu mẫu');
  }
}

/**
 * Kết quả của một thao tác ghi.
 * Thao tác không trả dữ liệu riêng thì trả `true` để màn hình phân biệt được
 * "ghi thành công" với "thất bại" — tầng gọi coi `undefined` là thất bại.
 */
export type Committed<T> = [T] extends [void] ? true : T;

/** Bọc một thao tác ghi: mở kho, chạy, lưu, trả kết quả kèm độ trễ. */
export function commit<T>(fn: (db: Database) => T): Promise<Committed<T>> {
  try {
    const result = mutate(fn);
    return delay((result === undefined ? true : result) as Committed<T>);
  } catch (error) {
    // Lỗi nghiệp vụ luôn trả về dạng Promise bị từ chối, không ném đồng bộ.
    return Promise.reject(error);
  }
}

/** Bọc một truy vấn chỉ đọc. */
export function query<T>(fn: (db: Database) => T): Promise<T> {
  try {
    return delay(fn(getDb()));
  } catch (error) {
    return Promise.reject(error);
  }
}

export { AppError };
