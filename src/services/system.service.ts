// Thông báo, nhật ký thao tác, quản trị và các tác vụ nền.
import type { UserRole } from '../types/domain';
import { AppError, ERR_NOT_FOUND, getDb, mutate, resetDatabase, stamp, touch } from './db';
import { commit, getCurrentUser, pushNotification, query, requirePermission, requireUser, writeAudit } from './api';
import { CAPABILITIES, SCOPE_LABEL } from '../auth/permissions';
import { findUser, groomIdOf, zoneIdOf } from './selectors';
import { clockOffsetMs, now, resetToRealTime, setSystemTime, shiftTime } from '../lib/clock';
import { addDays, toDateKey } from '../lib/format';
import { careTypeLabel } from '../lib/labels';

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
  return query((db) =>
    db.auditLogs
      .filter((item) => item.entityId === horseId || item.entityId.includes(horseId))
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

export function listAuditOptions() {
  return query((db) => ({
    actions: [...new Set(db.auditLogs.map((item) => item.action))].sort(),
    entityTypes: [...new Set(db.auditLogs.map((item) => item.entityType))].sort(),
    users: db.users.map(({ id, name, role }) => ({ id, name, role })),
  }));
}

/* ===== Quản trị ===== */

export function listUsers() {
  return query((db) => {
    requirePermission('admin.users');
    return db.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      zoneName: db.zones.find((zone) => zone.id === user.zoneId)?.name,
      active: user.active,
      horseCount: db.horses.filter((horse) => groomIdOf(db, horse.id) === user.id).length,
    }));
  });
}

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
      after: { active },
      actor,
    });
  });
}

export function setUserRole(userId: string, role: UserRole, zoneId?: string) {
  return commit((db) => {
    const actor = requirePermission('admin.users');
    const user = db.users.find((item) => item.id === userId);
    if (!user) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    const before = { role: user.role, zoneId: user.zoneId };
    user.role = role;
    user.zoneId = role === 'HEAD_TRAINER' ? zoneId : undefined;
    touch(user, at);
    if (role === 'HEAD_TRAINER' && zoneId) {
      db.zones.forEach((zone) => {
        if (zone.id === zoneId) zone.headTrainerId = userId;
        else if (zone.headTrainerId === userId) zone.headTrainerId = undefined;
      });
    }
    writeAudit(db, at, {
      action: 'Gán vai trò',
      entityType: 'User',
      entityId: userId,
      before,
      after: { role, zoneId },
      actor,
    });
  });
}

export function getPermissionMatrix() {
  const roles: UserRole[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'];
  const groups = [...new Set(CAPABILITIES.map((item) => item.group))];
  return Promise.resolve({
    roles,
    groups: groups.map((group) => ({
      group,
      rows: CAPABILITIES.filter((item) => item.group === group).map((item) => ({
        key: item.key,
        feature: item.feature,
        cells: roles.map((role) => {
          const scope = item.roles[role];
          return { role, allowed: !!scope, scopeLabel: scope ? SCOPE_LABEL[scope] : undefined };
        }),
      })),
    })),
  });
}

export function getZonesAndStalls() {
  return query((db) =>
    db.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      headTrainerName: findUser(db, zone.headTrainerId)?.name,
      stalls: db.stalls
        .filter((stall) => stall.zoneId === zone.id)
        .map((stall) => {
          const assignment = db.stallAssignments.find((item) => item.stallId === stall.id && !item.endAt);
          return {
            id: stall.id,
            code: stall.code,
            type: stall.type,
            horseName: assignment ? db.horses.find((horse) => horse.id === assignment.horseId)?.name : undefined,
          };
        }),
    })),
  );
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
 * Chạy theo giờ hệ thống hiện tại.
 */
export function runScheduledJobs() {
  return commit((db) => {
    requirePermission('admin.system');
    const at = now();
    const todayKey = toDateKey(at);
    const log: string[] = [];

    // 1. Giáo án đã qua ngày kết thúc → báo huấn luyện viên.
    db.plans
      .filter((plan) => !plan.cancelledAt && plan.endDate < todayKey && !plan.endingSoonNotifiedAt)
      .forEach((plan) => {
        const trainer = db.users.find(
          (user) => user.role === 'HEAD_TRAINER' && user.zoneId === zoneIdOf(db, plan.horseId),
        );
        if (trainer) {
          pushNotification(db, at, {
            userId: trainer.id,
            title: `Giáo án "${plan.name}" đã kết thúc`,
            body: 'Hãy chuẩn bị giáo án mới cho ngựa.',
            link: `/training/plans/${plan.id}`,
          });
          log.push(`Giáo án "${plan.name}" đã kết thúc`);
        }
        plan.endingSoonNotifiedAt = at.toISOString();
        touch(plan, at);
      });

    // 2. Giáo án đang áp dụng còn ≤ 7 ngày và chưa có giáo án nối tiếp.
    db.plans
      .filter(
        (plan) =>
          !plan.cancelledAt &&
          plan.startDate <= todayKey &&
          plan.endDate >= todayKey &&
          !plan.endingSoonNotifiedAt,
      )
      .forEach((plan) => {
        const daysLeft = Math.round(
          (new Date(plan.endDate).getTime() - new Date(todayKey).getTime()) / 86_400_000,
        );
        if (daysLeft > 7) return;
        const hasNext = db.plans.some(
          (item) => item.horseId === plan.horseId && !item.cancelledAt && item.startDate > plan.endDate,
        );
        if (hasNext) return;
        const trainer = db.users.find(
          (user) => user.role === 'HEAD_TRAINER' && user.zoneId === zoneIdOf(db, plan.horseId),
        );
        if (trainer) {
          const horse = db.horses.find((item) => item.id === plan.horseId);
          pushNotification(db, at, {
            userId: trainer.id,
            title: `Giáo án ${horse?.name} còn ${daysLeft} ngày`,
            body: 'Thêm giai đoạn nối tiếp hoặc chuẩn bị giáo án mới.',
            link: `/training/plans/${plan.id}`,
          });
          log.push(`Nhắc giáo án sắp hết của ${horse?.name}`);
        }
        plan.endingSoonNotifiedAt = at.toISOString();
        touch(plan, at);
      });

    // 3. Lịch chăm sóc sắp đến hạn hoặc quá hạn.
    db.careSchedules
      .filter((item) => !item.doneAt)
      .forEach((item) => {
        const horse = db.horses.find((horse) => horse.id === item.horseId);
        if (!horse || horse.lifecycleStatus === 'TRANSFERRED') return;
        const overdue = item.dueDate < todayKey;
        const soon = !overdue && item.dueDate <= toDateKey(addDays(at, 7));
        if (overdue && item.notifiedOverdueAt) return;
        if (soon && item.notifiedBeforeAt) return;
        if (!overdue && !soon) return;

        const receivers = [
          ...db.users.filter((user) => user.role === 'VETERINARIAN').map((user) => user.id),
          groomIdOf(db, item.horseId),
        ].filter(Boolean) as string[];
        receivers.forEach((userId) => {
          pushNotification(db, at, {
            userId,
            level: overdue ? 'URGENT' : 'NORMAL',
            title: `${horse.name}: ${careTypeLabel[item.type].toLowerCase()} ${overdue ? 'quá hạn' : 'sắp đến hạn'}`,
            body: `Hạn ${item.dueDate}.`,
            link: '/medical/care',
          });
        });
        if (overdue) item.notifiedOverdueAt = at.toISOString();
        else item.notifiedBeforeAt = at.toISOString();
        touch(item, at);
        log.push(`${horse.name}: ${careTypeLabel[item.type].toLowerCase()} ${overdue ? 'quá hạn' : 'sắp đến hạn'}`);
      });

    // 4. Ảnh đã gỡ quá 30 ngày → xóa hẳn.
    const before = db.horsePhotos.length;
    db.horsePhotos = db.horsePhotos.filter(
      (photo) => !photo.removedAt || at.getTime() - new Date(photo.removedAt).getTime() < 30 * 86_400_000,
    );
    if (db.horsePhotos.length < before) log.push(`Xóa hẳn ${before - db.horsePhotos.length} ảnh đã gỡ quá 30 ngày`);

    writeAudit(db, at, {
      action: 'Chạy tác vụ định kỳ',
      entityType: 'System',
      entityId: todayKey,
      after: { jobs: log.length },
      bySystem: true,
    });

    return log;
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
