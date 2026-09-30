// Số liệu tổng quan theo vai trò. Chỉ đọc, tính từ selectors — dữ liệu đã lọc theo phạm vi của người dùng.
import type { ClassSession, Database, HealthStatus, Horse, User } from '../types/domain';
import { query, requireUser } from './api';
import {
  activeLock,
  classOf,
  classSessions,
  classStatus,
  effectiveGroomId,
  findUser,
  horsesOfGroom,
  managedZoneIds,
  maxHeartRateOf,
  openCaseOf,
  openEnrollments,
  periodicStatus,
  placementOf,
  sessionDerivedLabel,
  sessionRoster,
  slotLabel,
  zoneCapacity,
  zoneOf,
  stallOf,
} from './selectors';
import { canRace, canTrain, canTrainAtAll, type RuleCheck } from '../lib/rules';
import { now } from '../lib/clock';
import { addDays, toDateKey } from '../lib/format';
import { links } from '../lib/links';

const HEALTH: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];

function inClub(horse: Horse) {
  return !horse.deletedAt && horse.lifecycleStatus !== 'TRANSFERRED';
}

function healthCounts(horses: Horse[]) {
  return HEALTH.map((status) => ({ status, count: horses.filter((horse) => horse.healthStatus === status).length }));
}

export interface HorseBrief {
  id: string;
  name: string;
  avatar?: string;
  healthStatus: HealthStatus;
  lifecycleStatus: Horse['lifecycleStatus'];
  zoneName?: string;
  stallCode?: string;
  locked: boolean;
  train: RuleCheck;
  race: RuleCheck;
}

function brief(db: Database, horse: Horse): HorseBrief {
  return {
    id: horse.id,
    name: horse.name,
    avatar: horse.avatar,
    healthStatus: horse.healthStatus,
    lifecycleStatus: horse.lifecycleStatus,
    zoneName: zoneOf(db, horse)?.name,
    stallCode: stallOf(db, horse)?.code,
    locked: !!activeLock(db, horse.id),
    train: canTrainAtAll(db, horse),
    race: canRace(db, horse),
  };
}

export interface SessionBrief {
  id: string;
  classId: string;
  className: string;
  zoneName?: string;
  date: string;
  slot: string;
  subjectName: string;
  intensity: ClassSession['intensity'];
  status: ClassSession['status'];
  derived?: string;
  horseCount: number;
  blocked: { name: string; reason: string }[];
}

function sessionBrief(db: Database, session: ClassSession, at: Date, horseFilter?: (horseId: string) => boolean): SessionBrief {
  const cls = classOf(db, session.classId);
  const roster = sessionRoster(db, session).filter((entry) => !horseFilter || horseFilter(entry.horseId));
  const blocked: { name: string; reason: string }[] = [];
  roster.forEach((entry) => {
    const horse = db.horses.find((item) => item.id === entry.horseId);
    if (!horse) return;
    if (entry.attendance?.status === 'ABSENT') {
      blocked.push({ name: horse.name, reason: entry.attendance.absenceNote ?? 'Vắng' });
      return;
    }
    if (session.status === 'SCHEDULED') {
      const check = canTrain(db, horse, session.intensity);
      if (!check.allowed) blocked.push({ name: horse.name, reason: check.reason ?? 'Không đủ điều kiện' });
    }
  });
  return {
    id: session.id,
    classId: session.classId,
    className: cls?.name ?? '—',
    zoneName: cls ? db.zones.find((zone) => zone.id === cls.zoneId)?.name : undefined,
    date: session.date,
    slot: slotLabel(db, session.slotId),
    subjectName: session.subjectName,
    intensity: session.intensity,
    status: session.status,
    derived: sessionDerivedLabel(db, session, at),
    horseCount: roster.length,
    blocked,
  };
}

export interface WeekItem {
  id: string;
  time?: string;
  title: string;
  detail?: string;
  intensity?: ClassSession['intensity'];
  status?: ClassSession['status'];
  tone?: 'warn' | 'danger';
  to: string;
}

export interface WeekDay {
  date: string;
  isToday: boolean;
  items: WeekItem[];
}

function emptyWeek(at: Date): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = toDateKey(addDays(at, index));
    return { date, isToday: index === 0, items: [] };
  });
}

/** Các buổi học 7 ngày tới (trừ buổi đã hủy) theo bộ lọc phạm vi. */
function weekSessions(
  db: Database,
  at: Date,
  filter: (session: ClassSession) => boolean,
  horseFilter?: (session: ClassSession, horseId: string) => boolean,
): WeekDay[] {
  const days = emptyWeek(at);
  const byDate = new Map(days.map((day) => [day.date, day]));
  db.sessions
    .filter((session) => byDate.has(session.date) && session.status !== 'CANCELLED' && filter(session))
    .sort((a, b) => a.slotId.localeCompare(b.slotId))
    .forEach((session) => {
      const roster = sessionRoster(db, session).filter((entry) => !horseFilter || horseFilter(session, entry.horseId));
      if (horseFilter && roster.length === 0) return;
      const cls = classOf(db, session.classId);
      byDate.get(session.date)!.items.push({
        id: session.id,
        time: slotLabel(db, session.slotId).split('–')[0],
        title: cls?.name ?? '—',
        detail: horseFilter
          ? roster.map((entry) => db.horses.find((horse) => horse.id === entry.horseId)?.name).filter(Boolean).join(', ')
          : `${session.subjectName} · ${roster.length} ngựa`,
        intensity: session.intensity,
        status: session.status,
        tone: session.status === 'AWAITING_REVIEW' ? 'warn' : undefined,
        to: links.session(session.id),
      });
    });
  return days;
}

function todaySessions(db: Database, at: Date, filter: (session: ClassSession) => boolean) {
  const key = toDateKey(at);
  return db.sessions
    .filter((session) => session.date === key && session.status !== 'CANCELLED' && filter(session))
    .sort((a, b) => a.slotId.localeCompare(b.slotId));
}

function pendingRequests(db: Database, horseFilter: (horse: Horse) => boolean) {
  return db.examRequests
    .filter((item) => item.status === 'PENDING')
    .map((item) => ({ item, horse: db.horses.find((horse) => horse.id === item.horseId) }))
    .filter(({ horse }) => !!horse && horseFilter(horse))
    .sort(
      (a, b) =>
        (a.item.urgency === 'URGENT' ? 0 : 1) - (b.item.urgency === 'URGENT' ? 0 : 1) ||
        a.item.createdAt.localeCompare(b.item.createdAt),
    )
    .map(({ item, horse }) => ({
      id: item.id,
      horseId: item.horseId,
      horseName: horse!.name,
      urgency: item.urgency,
      source: item.source,
      description: item.description,
      createdAt: item.createdAt,
    }));
}

function periodicAttention(db: Database, horses: Horse[], at: Date) {
  return horses
    .map((horse) => ({ horse, status: periodicStatus(db, horse, at) }))
    .filter(({ status }) => status.state === 'OVERDUE' || status.state === 'OVERDUE_ALERT' || status.state === 'DUE_SOON')
    .sort((a, b) => b.status.overdueDays - a.status.overdueDays)
    .map(({ horse, status }) => ({ id: horse.id, name: horse.name, dueDate: status.dueDate, overdueDays: status.overdueDays, state: status.state }));
}

function openCases(db: Database, horseFilter: (horse: Horse) => boolean, withCost: boolean) {
  return db.medicalCases
    .filter((item) => item.status === 'OPEN')
    .map((item) => ({ item, horse: db.horses.find((horse) => horse.id === item.horseId) }))
    .filter(({ horse }) => !!horse && horseFilter(horse))
    .map(({ item, horse }) => {
      const exams = db.examinations.filter((exam) => exam.caseId === item.id).sort((a, b) => b.examinedAt.localeCompare(a.examinedAt));
      return {
        id: item.id,
        horseId: horse!.id,
        horseName: horse!.name,
        title: item.title ?? 'Bệnh án',
        openedAt: item.openedAt,
        examCount: exams.length,
        nextAppointment: exams[0]?.nextAppointment,
        cost: withCost ? item.cost : undefined,
      };
    });
}

function activeLocks(db: Database, horseFilter: (horse: Horse) => boolean) {
  return db.trainingLocks
    .filter((lock) => !lock.liftedAt)
    .map((lock) => ({ lock, horse: db.horses.find((horse) => horse.id === lock.horseId) }))
    .filter(({ horse }) => !!horse && horseFilter(horse))
    .map(({ lock, horse }) => ({
      id: lock.id,
      horseId: horse!.id,
      horseName: horse!.name,
      reason: lock.reason,
      placedAt: lock.placedAt,
      expectedLiftDate: lock.expectedLiftDate,
    }));
}

function activeClassesOf(db: Database, zoneIds: string[] | null, at: Date) {
  const key = toDateKey(at);
  return db.classes
    .filter((cls) => (zoneIds === null || zoneIds.includes(cls.zoneId)) && ['ACTIVE', 'SCHEDULED'].includes(classStatus(cls, key)))
    .map((cls) => {
      const sessions = classSessions(db, cls.id).filter((session) => session.status !== 'CANCELLED');
      const done = sessions.filter((session) => session.status === 'COMPLETED' || session.status === 'AWAITING_REVIEW').length;
      return {
        id: cls.id,
        name: cls.name,
        status: classStatus(cls, key),
        zoneName: db.zones.find((zone) => zone.id === cls.zoneId)?.name,
        slot: slotLabel(db, cls.slotId),
        enrolled: openEnrollments(db, cls.id).length,
        capacity: cls.capacity,
        done,
        total: sessions.length,
        startDate: cls.startDate,
        endDate: cls.endDate,
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function awaitingReview(db: Database, zoneIds: string[] | null) {
  return db.sessions
    .filter((session) => session.status === 'AWAITING_REVIEW')
    .filter((session) => zoneIds === null || zoneIds.includes(classOf(db, session.classId)?.zoneId ?? ''))
    .map((session) => {
      const rows = db.attendances.filter((row) => row.sessionId === session.id && row.status === 'PRESENT');
      return {
        id: session.id,
        className: classOf(db, session.classId)?.name ?? '—',
        date: session.date,
        subjectName: session.subjectName,
        scored: rows.filter((row) => row.evaluation).length,
        present: rows.length,
      };
    });
}

/* ===== Quản lý câu lạc bộ ===== */

export function getManagerDashboard() {
  return query((db) => {
    requireUser();
    const at = now();
    const horses = db.horses.filter(inClub);
    const all = () => true;
    return {
      total: horses.length,
      active: horses.filter((horse) => horse.lifecycleStatus === 'ACTIVE').length,
      retired: horses.filter((horse) => horse.lifecycleStatus === 'RETIRED').length,
      health: healthCounts(horses),
      waitingZone: horses.filter((horse) => placementOf(horse) === 'NO_ZONE').map((horse) => brief(db, horse)),
      waitingStall: horses.filter((horse) => placementOf(horse) === 'WAITING_STALL').length,
      waitingGroom: horses.filter((horse) => placementOf(horse) === 'WAITING_GROOM').length,
      zones: db.zones
        .filter((zone) => !zone.deletedAt)
        .map((zone) => ({
          id: zone.id,
          name: zone.name,
          status: zone.status,
          trainer: findUser(db, zone.headTrainerId)?.name,
          capacity: zoneCapacity(db, zone.id),
        })),
      today: todaySessions(db, at, () => true).map((session) => sessionBrief(db, session, at)),
      requests: pendingRequests(db, all),
      periodic: periodicAttention(db, horses, at),
      cases: openCases(db, all, true),
      locks: activeLocks(db, all),
      classes: activeClassesOf(db, null, at),
      week: weekSessions(db, at, () => true),
    };
  });
}

/* ===== Huấn luyện viên trưởng ===== */

export function getTrainerDashboard() {
  return query((db) => {
    const user = requireUser();
    const at = now();
    const zoneIds = managedZoneIds(db, user.id);
    const mine = (horse: Horse) => !!horse.zoneId && zoneIds.includes(horse.zoneId);
    const horses = db.horses.filter((horse) => inClub(horse) && mine(horse));
    const weekAgo = addDays(at, -7).toISOString();
    return {
      zones: zoneIds.map((id) => {
        const zone = db.zones.find((item) => item.id === id)!;
        return { id, name: zone.name, capacity: zoneCapacity(db, id) };
      }),
      horseCount: horses.length,
      health: healthCounts(horses),
      waitingStall: horses.filter((horse) => placementOf(horse) === 'WAITING_STALL').map((horse) => brief(db, horse)),
      waitingGroom: horses.filter((horse) => placementOf(horse) === 'WAITING_GROOM').map((horse) => brief(db, horse)),
      watch: horses
        .filter((horse) => horse.healthStatus !== 'ELIGIBLE' || activeLock(db, horse.id))
        .map((horse) => ({ ...brief(db, horse), openCase: openCaseOf(db, horse.id)?.title })),
      today: todaySessions(db, at, (session) => zoneIds.includes(classOf(db, session.classId)?.zoneId ?? '')).map((session) =>
        sessionBrief(db, session, at),
      ),
      review: awaitingReview(db, zoneIds),
      classes: activeClassesOf(db, zoneIds, at),
      alerts7: db.alerts.filter(
        (alert) => alert.level === 'RED' && alert.at >= weekAgo && horses.some((horse) => horse.id === alert.horseId),
      ).length,
      requests: pendingRequests(db, mine),
      week: weekSessions(db, at, (session) => zoneIds.includes(classOf(db, session.classId)?.zoneId ?? '')),
      zoneHorses: horses
        .map((horse) => ({
          ...brief(db, horse),
          groomName: findUser(db, horse.groomId)?.name,
          classCount: db.enrollments.filter((item) => item.horseId === horse.id && !item.withdrawnAt).length,
          placement: placementOf(horse),
        }))
        .sort((a, b) => Number(a.train.allowed && a.race.allowed) - Number(b.train.allowed && b.race.allowed) || a.name.localeCompare(b.name)),
    };
  });
}

/* ===== Bác sĩ thú y ===== */

export function getVetDashboard() {
  return query((db) => {
    requireUser();
    const at = now();
    const horses = db.horses.filter(inClub);
    const all = () => true;
    return {
      health: healthCounts(horses),
      requests: pendingRequests(db, all),
      periodic: periodicAttention(db, horses, at),
      cases: openCases(db, all, true),
      locks: activeLocks(db, all),
      live: db.sessions
        .filter((session) => session.status === 'IN_PROGRESS')
        .map((session) => ({
          ...sessionBrief(db, session, at),
          redAlerts: db.alerts.filter((alert) => alert.sessionId === session.id && alert.level === 'RED' && !alert.acknowledgedAt).length,
        })),
      missingMaxHr: horses
        .filter((horse) => horse.lifecycleStatus === 'ACTIVE' && maxHeartRateOf(db, horse.id) === undefined)
        .map((horse) => ({ id: horse.id, name: horse.name })),
      recentExams: [...db.examinations]
        .sort((a, b) => b.examinedAt.localeCompare(a.examinedAt))
        .slice(0, 6)
        .map((exam) => ({
          id: exam.id,
          horseId: exam.horseId,
          horseName: db.horses.find((horse) => horse.id === exam.horseId)?.name ?? '—',
          kind: exam.kind,
          caseId: exam.caseId,
          examinedAt: exam.examinedAt,
          vetName: findUser(db, exam.vetId)?.name,
          before: exam.healthStatusBefore,
          after: exam.healthStatusAfter,
        })),
      week: (() => {
        // Lịch y tế 7 ngày: hạn khám định kỳ + hẹn tái khám trong bệnh án.
        const days = emptyWeek(at);
        const byDate = new Map(days.map((day) => [day.date, day]));
        horses.forEach((horse) => {
          const status = periodicStatus(db, horse, at);
          const day = byDate.get(status.dueDate);
          if (day) day.items.push({ id: `due-${horse.id}`, title: horse.name, detail: 'Tới hạn khám định kỳ', to: links.periodic });
        });
        db.medicalCases
          .filter((item) => item.status === 'OPEN')
          .forEach((item) => {
            const next = db.examinations
              .filter((exam) => exam.caseId === item.id)
              .sort((a, b) => b.examinedAt.localeCompare(a.examinedAt))[0]?.nextAppointment;
            const day = next ? byDate.get(next) : undefined;
            if (day) {
              day.items.push({
                id: `appt-${item.id}`,
                title: db.horses.find((horse) => horse.id === item.horseId)?.name ?? '—',
                detail: `Tái khám · ${item.title ?? 'bệnh án'}`,
                tone: 'warn',
                to: links.case(item.id),
              });
            }
          });
        return days;
      })(),
    };
  });
}

/* ===== Nhân viên chăm sóc ===== */

export function getGroomDashboard() {
  return query((db) => {
    const user = requireUser();
    const at = now();
    const myHorses = horsesOfGroom(db, user.id).filter(inClub);
    const today = todaySessions(db, at, (session) =>
      sessionRoster(db, session).some((entry) => effectiveGroomId(db, session, entry.horseId) === user.id),
    ).map((session) => {
      const mine = (horseId: string) => effectiveGroomId(db, session, horseId) === user.id;
      const base = sessionBrief(db, session, at, mine);
      const horses = sessionRoster(db, session)
        .filter((entry) => mine(entry.horseId))
        .map((entry) => {
          const horse = db.horses.find((item) => item.id === entry.horseId)!;
          return {
            id: horse.id,
            name: horse.name,
            avatar: horse.avatar,
            attendance: entry.attendance?.status ?? 'EXPECTED',
            absence: entry.attendance?.absenceReason,
            tasks: entry.attendance?.tasks ?? {},
            ready: session.status === 'SCHEDULED' ? canTrain(db, horse, session.intensity) : { allowed: true },
          };
        });
      return { ...base, horses };
    });
    return {
      today,
      horses: myHorses.map((horse) => ({ ...brief(db, horse), groomNote: undefined as string | undefined })),
      week: weekSessions(
        db,
        at,
        () => true,
        (session, horseId) => effectiveGroomId(db, session, horseId) === user.id,
      ),
      myRequests: db.examRequests
        .filter((item) => item.createdBy === user.id)
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          horseName: db.horses.find((horse) => horse.id === item.horseId)?.name ?? '—',
          status: item.status,
          urgency: item.urgency,
          createdAt: item.createdAt,
        })),
    };
  });
}

/* ===== Chủ sở hữu ===== */

export function getOwnerDashboard() {
  return query((db) => {
    const user: User = requireUser();
    const at = now();
    const horses = db.horses.filter((horse) => horse.ownerId === user.id && !horse.deletedAt);
    const ids = new Set(horses.map((horse) => horse.id));
    const todayKey = toDateKey(at);
    const upcoming = db.sessions
      .filter((session) => session.date >= todayKey && session.status === 'SCHEDULED')
      .flatMap((session) =>
        sessionRoster(db, session)
          .filter((entry) => ids.has(entry.horseId))
          .map((entry) => ({
            sessionId: session.id,
            horseName: db.horses.find((horse) => horse.id === entry.horseId)?.name ?? '—',
            className: classOf(db, session.classId)?.name ?? '—',
            date: session.date,
            slot: slotLabel(db, session.slotId),
            subjectName: session.subjectName,
            intensity: session.intensity,
          })),
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
      .slice(0, 8);
    const notes = db.attendances
      .filter((row) => ids.has(row.horseId) && row.evaluation)
      .sort((a, b) => (b.evaluation!.evaluatedAt ?? '').localeCompare(a.evaluation!.evaluatedAt ?? ''))
      .slice(0, 5)
      .map((row) => {
        const session = db.sessions.find((item) => item.id === row.sessionId);
        return {
          id: row.id,
          sessionId: row.sessionId,
          horseName: db.horses.find((horse) => horse.id === row.horseId)?.name ?? '—',
          subjectName: session?.subjectName ?? '—',
          date: session?.date ?? '',
          score: row.evaluation!.score,
          notes: row.evaluation!.notes,
        };
      });
    const closedCases = db.medicalCases.filter((item) => ids.has(item.horseId) && item.status === 'CLOSED');
    return {
      horses: horses.map((horse) => ({
        ...brief(db, horse),
        classes: db.enrollments
          .filter((item) => item.horseId === horse.id && !item.withdrawnAt)
          .map((item) => classOf(db, item.classId)?.name)
          .filter(Boolean) as string[],
        openCase: openCaseOf(db, horse.id)?.title,
      })),
      upcoming,
      week: weekSessions(db, at, () => true, (_session, horseId) => ids.has(horseId)),
      notes,
      medicalCost: closedCases.reduce((sum, item) => sum + (item.cost ?? 0), 0),
      closedCases: closedCases.map((item) => ({
        id: item.id,
        horseName: db.horses.find((horse) => horse.id === item.horseId)?.name ?? '—',
        title: item.title ?? 'Bệnh án',
        closedAt: item.closedAt,
        cost: item.cost,
      })),
    };
  });
}

/** Lịch buổi học 7 ngày tới theo phạm vi của người dùng hiện tại (dùng ở trang Buổi tập hôm nay). */
export function getMyWeek() {
  return query((db) => {
    const user = requireUser();
    const at = now();
    if (user.role === 'HEAD_TRAINER') {
      const zoneIds = managedZoneIds(db, user.id);
      return weekSessions(db, at, (session) => zoneIds.includes(classOf(db, session.classId)?.zoneId ?? ''));
    }
    if (user.role === 'GROOM') {
      return weekSessions(db, at, () => true, (session, horseId) => effectiveGroomId(db, session, horseId) === user.id);
    }
    if (user.role === 'HORSE_OWNER') {
      const ids = new Set(db.horses.filter((horse) => horse.ownerId === user.id && !horse.deletedAt).map((horse) => horse.id));
      return weekSessions(db, at, () => true, (_session, horseId) => ids.has(horseId));
    }
    return weekSessions(db, at, () => true);
  });
}
