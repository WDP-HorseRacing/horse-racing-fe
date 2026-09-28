// Thao tác nghiệp vụ dùng chung ở tầng dữ liệu, được nhiều service gọi tới.
// Không kiểm tra quyền — service gọi vào phải kiểm quyền trước.
import type {
  ClassEnrollment,
  ClassSession,
  Database,
  EnrollmentCloseReason,
  ExamRequest,
  ExamRequestSource,
  ExamUrgency,
  HealthStatus,
  Horse,
  LockLiftKind,
  SessionAttendance,
  TrainingLock,
  User,
} from '../types/domain';
import { AppError, newId, stamp, touch } from './db';
import { notifyMany, writeAudit } from './api';
import {
  activeLock,
  classOf,
  findHorse,
  isClassOpen,
  managerIds,
  periodicStatus,
  sessionRoster,
  trainerOfZone,
  vetIds,
} from './selectors';
import { currentSecond } from '../lib/simulator';
import { formatDate, toDateKey } from '../lib/format';
import { healthLabel } from '../lib/labels';
import { links } from '../lib/links';

/* ===== Ô chuồng ===== */

/** Trả ô hiện tại của ngựa về Trống. Trả mã ô vừa trả (nếu có). */
export function vacateStall(db: Database, horse: Horse, at: Date): string | undefined {
  if (!horse.stallId) return undefined;
  const stall = db.stalls.find((item) => item.id === horse.stallId);
  if (stall && stall.status === 'OCCUPIED') {
    stall.status = 'AVAILABLE';
    touch(stall, at);
  }
  horse.stallId = undefined;
  touch(horse, at);
  return stall?.code;
}

/** Đưa ngựa vào ô (ô cũ, nếu có, được trả về Trống). */
export function occupyStall(db: Database, horse: Horse, stallId: string, at: Date) {
  if (horse.stallId && horse.stallId !== stallId) vacateStall(db, horse, at);
  const stall = db.stalls.find((item) => item.id === stallId);
  if (!stall) throw new AppError('Không tìm thấy ô chuồng');
  stall.status = 'OCCUPIED';
  touch(stall, at);
  horse.stallId = stallId;
  touch(horse, at);
}

/* ===== Lớp học ===== */

/**
 * Rút ngựa khỏi mọi lớp chưa kết thúc (hoặc chỉ các lớp của một khu).
 * Chỉ đăng ký bị đóng — không buổi học nào bị hủy. Buổi chưa bắt đầu biến mất khỏi lịch con ngựa.
 */
export function closeOpenEnrollments(
  db: Database,
  horseId: string,
  reason: EnrollmentCloseReason,
  at: Date,
  actorId: string,
  opts: { zoneId?: string; note?: string } = {},
): ClassEnrollment[] {
  const todayKey = toDateKey(at);
  const closed = db.enrollments.filter((item) => {
    if (item.horseId !== horseId || item.withdrawnAt) return false;
    const cls = classOf(db, item.classId);
    if (!cls || !isClassOpen(cls, todayKey)) return false;
    return !opts.zoneId || cls.zoneId === opts.zoneId;
  });
  closed.forEach((item) => {
    item.withdrawnAt = at.toISOString();
    item.withdrawnBy = actorId;
    item.withdrawReason = reason;
    item.withdrawNote = opts.note;
    touch(item, at);
  });
  const closedIds = new Set(closed.map((item) => item.id));
  const scheduled = new Set(db.sessions.filter((session) => session.status === 'SCHEDULED').map((session) => session.id));
  db.attendances = db.attendances.filter(
    (row) => !(closedIds.has(row.enrollmentId) && scheduled.has(row.sessionId)),
  );
  return closed;
}

/** Tạo dòng tham gia của một ngựa trong buổi nếu chưa có (dùng trước giờ bắt đầu). */
export function ensureAttendance(db: Database, session: ClassSession, horseId: string, at: Date): SessionAttendance {
  const existing = db.attendances.find((row) => row.sessionId === session.id && row.horseId === horseId);
  if (existing) return existing;
  const entry = sessionRoster(db, session).find((item) => item.horseId === horseId);
  if (!entry) throw new AppError('Ngựa không thuộc danh sách của buổi học này');
  const row: SessionAttendance = {
    id: newId('att'),
    sessionId: session.id,
    horseId,
    enrollmentId: entry.enrollmentId,
    status: 'EXPECTED',
    tasks: {},
    ...stamp(at),
  };
  db.attendances.push(row);
  return row;
}

/* ===== Yêu cầu khám ===== */

export function createExamRequestInternal(
  db: Database,
  at: Date,
  input: {
    horseId: string;
    source: ExamRequestSource;
    urgency: ExamUrgency;
    description: string;
    createdBy: string;
    refType?: ExamRequest['refType'];
    refId?: string;
  },
): ExamRequest {
  const horse = findHorse(db, input.horseId);
  if (!horse) throw new AppError('Không tìm thấy ngựa');

  // Cùng nguồn và còn đang chờ thì gộp vào yêu cầu cũ, nâng mức nếu cần.
  const pending = db.examRequests.find(
    (item) => item.horseId === input.horseId && item.source === input.source && item.status === 'PENDING',
  );
  if (pending) {
    pending.description = `${pending.description}\n• ${input.description}`;
    const escalated = input.urgency === 'URGENT' && pending.urgency !== 'URGENT';
    if (escalated) pending.urgency = 'URGENT';
    touch(pending, at);
    if (escalated) {
      notifyMany(db, at, vetIds(db), {
        level: 'URGENT',
        title: `Yêu cầu khám khẩn: ${horse.name}`,
        body: input.description,
        link: links.requests,
      });
    }
    return pending;
  }

  const request: ExamRequest = {
    id: newId('req'),
    horseId: input.horseId,
    source: input.source,
    urgency: input.urgency,
    description: input.description,
    createdBy: input.createdBy,
    refType: input.refType,
    refId: input.refId,
    status: 'PENDING',
    ...stamp(at),
  };
  db.examRequests.unshift(request);
  if (input.source !== 'VET_SELF') {
    notifyMany(db, at, vetIds(db), {
      level: input.urgency === 'URGENT' ? 'URGENT' : 'NORMAL',
      title: `${input.urgency === 'URGENT' ? 'Yêu cầu khám khẩn' : 'Yêu cầu khám'}: ${horse.name}`,
      body: input.description,
      link: links.requests,
    });
  }
  return request;
}

/* ===== Trạng thái sức khỏe ===== */

/**
 * Đổi trạng thái sức khỏe (chỉ VET gọi tới). Không tự rút ngựa khỏi lớp, không đụng khóa huấn luyện.
 * Trả false nếu trạng thái không đổi.
 */
export function applyHealthStatus(
  db: Database,
  at: Date,
  actor: User | null,
  horseId: string,
  to: HealthStatus,
  reason: string,
  examinationId?: string,
): boolean {
  const horse = findHorse(db, horseId);
  if (!horse) throw new AppError('Không tìm thấy ngựa');
  const from = horse.healthStatus;
  if (from === to) return false;
  horse.healthStatus = to;
  touch(horse, at);
  db.healthStatusLogs.unshift({
    id: newId('hsl'),
    horseId,
    fromStatus: from,
    toStatus: to,
    reason,
    examinationId,
    changedBy: actor?.id ?? 'SYSTEM',
    changedAt: at.toISOString(),
    ...stamp(at),
  });

  const trainer = trainerOfZone(db, horse.zoneId);
  if (to === 'INJURED' || to === 'QUARANTINED') {
    notifyMany(db, at, [trainer, ...managerIds(db)], {
      level: 'HIGH',
      title: `${horse.name}: ${healthLabel[to]}`,
      body:
        to === 'QUARANTINED'
          ? `${reason}. Ngựa không được tập và đua. Gợi ý: cân nhắc chuyển ngựa sang ô trống để tách đàn.`
          : `${reason}. Ngựa không được tập và đua cho tới khi bác sĩ đổi trạng thái.`,
      link: links.horse(horse.id, 'medical'),
    });
  } else {
    notifyMany(db, at, [trainer], {
      level: 'NORMAL',
      title: `${horse.name}: ${healthLabel[from]} → ${healthLabel[to]}`,
      body: reason,
      link: links.horse(horse.id, 'medical'),
    });
  }

  writeAudit(db, at, {
    action: 'Đổi trạng thái sức khỏe',
    entityType: 'Horse',
    entityId: horse.id,
    horseId: horse.id,
    before: { healthStatus: from },
    after: { healthStatus: to },
    reason,
    actor,
  });
  return true;
}

/* ===== Khóa huấn luyện ===== */

export function placeLockInternal(
  db: Database,
  at: Date,
  actor: User,
  input: { horseId: string; reason: string; expectedLiftDate?: string; caseId?: string },
): TrainingLock {
  const horse = findHorse(db, input.horseId);
  if (!horse) throw new AppError('Không tìm thấy ngựa');
  if (activeLock(db, horse.id)) throw new AppError('Ngựa đang có một khóa huấn luyện còn hiệu lực');
  const lock: TrainingLock = {
    id: newId('lock'),
    horseId: horse.id,
    reason: input.reason,
    placedAt: at.toISOString(),
    placedBy: actor.id,
    expectedLiftDate: input.expectedLiftDate,
    caseId: input.caseId,
    ...stamp(at),
  };
  db.trainingLocks.unshift(lock);
  notifyMany(db, at, [trainerOfZone(db, horse.zoneId), ...managerIds(db)], {
    level: 'HIGH',
    title: `Khóa huấn luyện: ${horse.name}`,
    body: `${input.reason}${input.expectedLiftDate ? ` · dự kiến gỡ ${formatDate(input.expectedLiftDate)}` : ''}. Ngựa sẽ vắng các buổi học cho tới khi được gỡ khóa.`,
    link: links.horse(horse.id, 'medical'),
  });
  stopHorseInRunningSessions(db, at, horse.id, 'Bác sĩ đặt khóa huấn luyện', actor.id);
  writeAudit(db, at, {
    action: 'Đặt khóa huấn luyện',
    entityType: 'TrainingLock',
    entityId: lock.id,
    horseId: horse.id,
    after: { reason: lock.reason, expectedLiftDate: lock.expectedLiftDate, caseId: lock.caseId },
    actor,
  });
  return lock;
}

export function liftLockInternal(
  db: Database,
  at: Date,
  actor: User | null,
  lock: TrainingLock,
  reason: string,
  kind: LockLiftKind,
) {
  lock.liftedAt = at.toISOString();
  lock.liftedBy = actor?.id ?? 'SYSTEM';
  lock.liftReason = reason;
  lock.liftKind = kind;
  touch(lock, at);
  const horse = findHorse(db, lock.horseId);
  if (horse && kind !== 'TRANSFER') {
    notifyMany(db, at, [trainerOfZone(db, horse.zoneId)], {
      level: 'NORMAL',
      title: `Đã gỡ khóa huấn luyện: ${horse.name}`,
      body: reason,
      link: links.horse(horse.id, 'medical'),
    });
  }
  writeAudit(db, at, {
    action: 'Gỡ khóa huấn luyện',
    entityType: 'TrainingLock',
    entityId: lock.id,
    horseId: lock.horseId,
    after: { liftKind: kind },
    reason,
    actor,
    bySystem: !actor,
  });
}

/** Dừng ngựa trong các buổi đang diễn ra (ví dụ khi bác sĩ đặt khóa). */
export function stopHorseInRunningSessions(db: Database, at: Date, horseId: string, reason: string, actorId?: string) {
  db.attendances.forEach((row) => {
    if (row.horseId !== horseId || row.status !== 'PRESENT' || row.stoppedAtSecond !== undefined) return;
    const session = db.sessions.find((item) => item.id === row.sessionId);
    if (!session || session.status !== 'IN_PROGRESS' || !session.startedAt) return;
    row.stoppedAtSecond = currentSecond(session.startedAt, at, session.simSpeed ?? 1);
    row.stoppedAt = at.toISOString();
    row.stoppedBy = actorId;
    row.stopReason = reason;
    touch(row, at);
  });
}

/* ===== Khám định kỳ ===== */

/** Quá hạn khám định kỳ trên 7 ngày: HIGH cho VET và CM, mỗi ngựa một lần cho tới khi được khám. */
export function runPeriodicOverdueJob(db: Database, at: Date): string[] {
  const notified: string[] = [];
  db.horses.forEach((horse) => {
    if (horse.deletedAt || horse.lifecycleStatus === 'TRANSFERRED') return;
    const status = periodicStatus(db, horse, at);
    if (status.state !== 'OVERDUE_ALERT' || horse.periodicOverdueNotifiedFor === status.dueDate) return;
    horse.periodicOverdueNotifiedFor = status.dueDate;
    touch(horse, at);
    notifyMany(db, at, [...vetIds(db), ...managerIds(db)], {
      level: 'HIGH',
      title: `Quá hạn khám định kỳ: ${horse.name}`,
      body: `Hạn khám ${formatDate(status.dueDate)}, đã quá ${status.overdueDays} ngày.`,
      link: links.periodic,
    });
    notified.push(horse.name);
  });
  return notified;
}
