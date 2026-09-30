// Thông báo, nhật ký thao tác, quản trị và các tác vụ nền.
import type { Database, User, UserRole } from '../types/domain';
import { AppError, ERR_NOT_FOUND, getDb, mutate, resetDatabase, stamp, touch } from './db';
import { commit, getCurrentUser, query, requirePermission, requireUser, writeAudit } from './api';
import { CAPABILITIES, SCOPE_LABEL } from '../auth/permissions';
import { horsesOfGroom, horsesOfZone, managedZoneIds, periodicStatus } from './selectors';
import { runPeriodicOverdueJob } from './ops';
import { clockOffsetMs, now, resetToRealTime, setSystemTime, shiftTime } from '../lib/clock';
import { toDateKey } from '../lib/format';
import { roleLabel } from '../lib/labels';
import { FEATURES } from '../config/features';

/* ===== Thông báo ===== */

export function listNotifications() {
  return query((db) => {
    const user = requireUser();
    return db.notifications
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40);
  });
}

/** Đọc đồng bộ để chuông cập nhật tức thì khi kho dữ liệu đổi. */
export function readNotificationsSync() {
  const user = getCurrentUser();
  if (!user) return [];
  return getDb()
    .notifications.filter((item) => item.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);
}

export function markNotificationRead(notificationId: string) {
  return commit((db) => {
    const at = now();
    const item = db.notifications.find((entry) => entry.id === notificationId);
    if (item && !item.readAt) {
      item.readAt = at.toISOString();
      touch(item, at);
    }
  });
}

export function markAllNotificationsRead() {
  return commit((db) => {
    const user = requireUser();
    const at = now();
    db.notifications
      .filter((item) => item.userId === user.id && !item.readAt)
      .forEach((item) => {
        item.readAt = at.toISOString();
        touch(item, at);
      });
  });
}

/* ===== Nhật ký thao tác ===== */

export function listAuditLogs(filters: { userId?: string; action?: string; entityType?: string; from?: string; to?: string } = {}) {
  return query((db) => {
    requirePermission('admin.audit');
    return db.auditLogs
      .filter((item) => !filters.userId || item.userId === filters.userId)
      .filter((item) => !filters.action || item.action === filters.action)
      .filter((item) => !filters.entityType || item.entityType === filters.entityType)
      .filter((item) => !filters.from || toDateKey(item.at) >= filters.from)
      .filter((item) => !filters.to || toDateKey(item.at) <= filters.to)
      .sort((a, b) => b.at.localeCompare(a.at));
  });
}

export function listAuditForHorse(horseId: string) {
  return query((db) => {
    requirePermission('admin.audit');
    return db.auditLogs
      .filter((item) => item.horseId === horseId || item.entityId === horseId)
      .sort((a, b) => b.at.localeCompare(a.at));
  });
}

export function listAuditOptions() {
  return query((db) => ({
    actions: [...new Set(db.auditLogs.map((item) => item.action))].sort(),
    entityTypes: [...new Set(db.auditLogs.map((item) => item.entityType))].sort(),
    users: db.users.map(({ id, name, role }) => ({ id, name, role })),
  }));
}

/* ===== Quản trị nhân sự (A.9) ===== */

/** Trách nhiệm đang vướng của một tài khoản: khu phụ trách, ngựa được giao, ngựa sở hữu. */
function responsibilitiesOf(db: Database, user: User): string[] {
  const list: string[] = [];
  managedZoneIds(db, user.id).forEach((zoneId) => {
    const zone = db.zones.find((item) => item.id === zoneId);
    const count = horsesOfZone(db, zoneId).filter((horse) => horse.lifecycleStatus !== 'TRANSFERRED').length;
    list.push(`Phụ trách ${zone?.name ?? zoneId}${count ? ` (${count} ngựa)` : ''}`);
  });
  const groomHorses = horsesOfGroom(db, user.id);
  if (groomHorses.length) list.push(`Groom của ${groomHorses.map((horse) => horse.name).join(', ')}`);
  const owned = db.horses.filter(
    (horse) => horse.ownerId === user.id && !horse.deletedAt && horse.lifecycleStatus !== 'TRANSFERRED',
  );
  if (owned.length) list.push(`Chủ của ${owned.map((horse) => horse.name).join(', ')}`);
  return list;
}

export function listUsers() {
  return query((db) => {
    requirePermission('admin.users');
    return db.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active,
      zoneNames: managedZoneIds(db, user.id).map((zoneId) => db.zones.find((zone) => zone.id === zoneId)?.name ?? ''),
      groomHorseCount: horsesOfGroom(db, user.id).length,
      ownedHorseCount: db.horses.filter((horse) => horse.ownerId === user.id && !horse.deletedAt).length,
      responsibilities: responsibilitiesOf(db, user),
    }));
  });
}

/** Khóa tài khoản chỉ cảnh báo kèm danh sách trách nhiệm và bắt xác nhận, không chặn cứng (A.9.3). */
export function setUserActive(userId: string, active: boolean) {
  return commit((db) => {
    const actor = requirePermission('admin.users');
    const user = db.users.find((item) => item.id === userId);
    if (!user) throw new AppError(ERR_NOT_FOUND);
    if (user.id === actor.id) throw new AppError('Không khóa được tài khoản đang đăng nhập');
    const at = now();
    const before = user.active;
    user.active = active;
    touch(user, at);
    writeAudit(db, at, {
      action: active ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
      entityType: 'User',
      entityId: userId,
      before: { active: before },
      after: { active, responsibilities: active ? undefined : responsibilitiesOf(db, user) },
      actor,
    });
  });
}

/**
 * Đổi vai trò (A.9.2): không cho đổi khi tài khoản còn là chủ của ngựa ACTIVE/RETIRED,
 * còn phụ trách khu có ngựa, hoặc còn là Groom của ngựa nào. Bỏ qua hồ sơ đã xóa.
 */
export function setUserRole(userId: string, role: UserRole) {
  return commit((db) => {
    const actor = requirePermission('admin.users');
    const user = db.users.find((item) => item.id === userId);
    if (!user) throw new AppError(ERR_NOT_FOUND);
    if (user.role === role) return;
    const at = now();

    if (user.role === 'HORSE_OWNER') {
      const owned = db.horses.filter(
        (horse) => horse.ownerId === user.id && !horse.deletedAt && horse.lifecycleStatus !== 'TRANSFERRED',
      );
      if (owned.length) {
        throw new AppError(
          `Tài khoản đang là chủ của ${owned.map((horse) => horse.name).join(', ')}. Hãy gán chủ mới trước khi đổi vai trò.`,
        );
      }
    }
    if (user.role === 'HEAD_TRAINER') {
      const busy = managedZoneIds(db, user.id).filter((zoneId) => horsesOfZone(db, zoneId).length > 0);
      if (busy.length) {
        throw new AppError(
          `Tài khoản đang phụ trách ${busy.map((zoneId) => db.zones.find((zone) => zone.id === zoneId)?.name).join(', ')} còn ngựa. Hãy đổi HT phụ trách khu trước.`,
        );
      }
      db.zones.forEach((zone) => {
        if (zone.headTrainerId === user.id) {
          zone.headTrainerId = undefined;
          touch(zone, at);
        }
      });
    }
    if (user.role === 'GROOM') {
      const horses = horsesOfGroom(db, user.id);
      if (horses.length) {
        throw new AppError(
          `Tài khoản đang là Groom của ${horses.map((horse) => horse.name).join(', ')}. Hãy phân công Groom khác trước.`,
        );
      }
    }

    const before = { role: user.role };
    user.role = role;
    touch(user, at);
    writeAudit(db, at, {
      action: 'Đổi vai trò',
      entityType: 'User',
      entityId: userId,
      before,
      after: { role },
      reason: `${roleLabel[before.role]} → ${roleLabel[role]}`,
      actor,
    });
  });
}

export function getPermissionMatrix() {
  const roles: UserRole[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'];
  const visible = CAPABILITIES.filter((item) => FEATURES.training || !item.code.startsWith('F2'));
  const groups = [...new Set(visible.map((item) => item.group))];
  return Promise.resolve({
    roles,
    groups: groups.map((group) => ({
      group,
      rows: visible.filter((item) => item.group === group).map((item) => ({
        key: item.key,
        code: item.code,
        feature: item.feature,
        cells: roles.map((role) => {
          const scope = item.roles[role];
          return { role, allowed: !!scope, scopeLabel: scope ? SCOPE_LABEL[scope] : undefined };
        }),
      })),
    })),
  });
}

/* ===== Công cụ hệ thống ===== */

export function getSettings() {
  return query((db) => db.settings);
}

export function resetToSeedData() {
  requirePermission('admin.system');
  resetDatabase(new Date());
}

/**
 * Tác vụ nền theo chu kỳ — phần BE sẽ chạy bằng cron.
 * Hiện gồm: cảnh báo quá hạn khám định kỳ trên 7 ngày.
 */
export function runScheduledJobs() {
  return commit((db) => {
    requirePermission('admin.system');
    const at = now();
    const overdue = runPeriodicOverdueJob(db, at);
    const log = overdue.map((name) => `Cảnh báo quá hạn khám định kỳ: ${name}`);
    writeAudit(db, at, {
      action: 'Chạy tác vụ định kỳ',
      entityType: 'System',
      entityId: toDateKey(at),
      after: { jobs: log.length },
      bySystem: true,
    });
    return log;
  });
}

/** Kiểm tra nền khi mở ứng dụng — không cần quyền, không ghi gì nếu không có việc. */
export function runBackgroundChecks() {
  const db = getDb();
  const at = now();
  const pending = db.horses.some((horse) => {
    if (horse.deletedAt || horse.lifecycleStatus === 'TRANSFERRED') return false;
    const status = periodicStatus(db, horse, at);
    return status.state === 'OVERDUE_ALERT' && horse.periodicOverdueNotifiedFor !== status.dueDate;
  });
  if (!pending) return;
  mutate((draft) => {
    runPeriodicOverdueJob(draft, at);
  });
}

/** Đặt giờ hệ thống tới một mốc, hoặc trả về giờ thực. Đồng hồ vẫn chạy tiếp sau khi đặt. */
export function setClock(mode: 'REAL' | 'SHIFTED', value?: string) {
  requirePermission('admin.system');
  if (mode === 'REAL' || !value) resetToRealTime();
  else setSystemTime(new Date(value));
}

/** Dịch giờ hệ thống thêm một khoảng, ví dụ +1 giờ. */
export function nudgeClock(ms: number) {
  requirePermission('admin.system');
  shiftTime(ms);
}

/** Chênh lệch hiện tại giữa giờ hệ thống và giờ thực. */
export function getClockOffsetMs() {
  return clockOffsetMs();
}

export function setSimulationSpeed(speed: number) {
  requirePermission('admin.system');
  mutate((db) => {
    db.settings.simSpeed = speed;
  });
}

export { stamp };
