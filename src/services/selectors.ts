// Truy vấn dẫn xuất trên kho dữ liệu. Không sửa dữ liệu, chỉ đọc.
import type {
  ClassEnrollment,
  ClassSession,
  ClassStatus,
  Database,
  Horse,
  HorsePlacement,
  MedicalCase,
  SessionAttendance,
  SessionStatus,
  TrainingClass,
  TrainingIntensity,
  TrainingProgram,
  User,
} from '../types/domain';
import { addDays, daysBetween, toDateKey } from '../lib/format';
import { checkDayLimits, consecutiveHeavyWarnings, maxIntensity, PERIODIC_ALERT_DAYS, type DayItem } from '../lib/rules';
export { activeLock } from '../lib/rule-helpers';

/* ===== Người dùng ===== */

export function findHorse(db: Database, horseId?: string): Horse | undefined {
  return db.horses.find((horse) => horse.id === horseId);
}

export function findUser(db: Database, userId?: string): User | undefined {
  return db.users.find((user) => user.id === userId);
}

export function userName(db: Database, userId?: string): string {
  if (!userId || userId === 'SYSTEM') return 'Hệ thống';
  return findUser(db, userId)?.name ?? 'Hệ thống';
}

/** Các khu mà HT đang phụ trách (một HT có thể phụ trách nhiều khu). */
export function managedZoneIds(db: Database, userId?: string): string[] {
  if (!userId) return [];
  return db.zones.filter((zone) => zone.headTrainerId === userId && !zone.deletedAt).map((zone) => zone.id);
}

/** HT đang phụ trách khu — ngựa chưa xếp khu thì không có HT nhận thông báo. */
export function trainerOfZone(db: Database, zoneId?: string): string | undefined {
  if (!zoneId) return undefined;
  const zone = db.zones.find((item) => item.id === zoneId);
  const user = findUser(db, zone?.headTrainerId);
  return user?.active ? user.id : undefined;
}

export function vetIds(db: Database): string[] {
  return db.users.filter((user) => user.role === 'VETERINARIAN' && user.active).map((user) => user.id);
}

export function managerIds(db: Database): string[] {
  return db.users.filter((user) => user.role === 'CLUB_MANAGER' && user.active).map((user) => user.id);
}

/* ===== Khu, ô, ngựa ===== */

export function zoneOf(db: Database, horse?: Horse) {
  return horse?.zoneId ? db.zones.find((zone) => zone.id === horse.zoneId) : undefined;
}

export function stallOf(db: Database, horse?: Horse) {
  return horse?.stallId ? db.stalls.find((stall) => stall.id === horse.stallId) : undefined;
}

export function zoneIdOf(db: Database, horseId: string): string | undefined {
  return findHorse(db, horseId)?.zoneId;
}

export function groomIdOf(db: Database, horseId: string): string | undefined {
  return findHorse(db, horseId)?.groomId;
}

export function ownedHorseIds(db: Database, ownerId: string): string[] {
  return db.horses.filter((horse) => horse.ownerId === ownerId && !horse.deletedAt).map((horse) => horse.id);
}

export function horsesOfZone(db: Database, zoneId: string): Horse[] {
  return db.horses.filter((horse) => horse.zoneId === zoneId && !horse.deletedAt);
}

export function horsesOfGroom(db: Database, groomId: string): Horse[] {
  return db.horses.filter((horse) => horse.groomId === groomId && !horse.deletedAt);
}

/** Vị trí của ngựa trong quy trình xếp chỗ: khu → ô → Groom. */
export function placementOf(horse: Horse): HorsePlacement {
  if (horse.deletedAt || horse.lifecycleStatus === 'TRANSFERRED') return 'NONE';
  if (!horse.zoneId) return 'NO_ZONE';
  if (!horse.stallId) return 'WAITING_STALL';
  if (!horse.groomId) return 'WAITING_GROOM';
  return 'PLACED';
}

/** Hồ sơ còn thao tác được (không phải TRANSFERRED hay đã xóa). */
export function isHorseWritable(horse: Horse): boolean {
  return !horse.deletedAt && horse.lifecycleStatus !== 'TRANSFERRED';
}

export interface ZoneCapacity {
  total: number;
  maintenance: number;
  occupied: number;
  waitingForStall: number;
  horseCount: number;
  /** Chỗ trống = ô không bảo trì − ngựa đang trong ô − ngựa thuộc khu nhưng chưa có ô (A.6.4). */
  free: number;
}

export function zoneCapacity(db: Database, zoneId: string): ZoneCapacity {
  const stalls = db.stalls.filter((stall) => stall.zoneId === zoneId && !stall.deletedAt);
  const horses = horsesOfZone(db, zoneId);
  const maintenance = stalls.filter((stall) => stall.status === 'MAINTENANCE').length;
  const occupied = horses.filter((horse) => horse.stallId).length;
  const waitingForStall = horses.filter((horse) => !horse.stallId).length;
  return {
    total: stalls.length,
    maintenance,
    occupied,
    waitingForStall,
    horseCount: horses.length,
    free: stalls.length - maintenance - occupied - waitingForStall,
  };
}

export function maxHeartRateOf(db: Database, horseId: string): number | undefined {
  return db.maxHeartRates.find((item) => item.horseId === horseId && item.active)?.value;
}

/* ===== Khung giờ ===== */

export function slotOf(db: Database, slotId: string) {
  return db.slots.find((slot) => slot.id === slotId);
}

export function slotLabel(db: Database, slotId: string): string {
  const slot = slotOf(db, slotId);
  return slot ? `${slot.startTime}–${slot.endTime}` : '—';
}

/** Thời điểm bắt đầu / kết thúc của buổi theo ngày và slot (giờ địa phương Asia/Ho_Chi_Minh). */
export function sessionStartAt(db: Database, session: Pick<ClassSession, 'date' | 'slotId'>): Date {
  const slot = slotOf(db, session.slotId);
  return new Date(`${session.date}T${slot?.startTime ?? '00:00'}:00`);
}

export function sessionEndAt(db: Database, session: Pick<ClassSession, 'date' | 'slotId'>): Date {
  const slot = slotOf(db, session.slotId);
  return new Date(`${session.date}T${slot?.endTime ?? '23:59'}:00`);
}

/* ===== Môn học, giáo án, lớp ===== */

export function classOf(db: Database, classId?: string): TrainingClass | undefined {
  return db.classes.find((item) => item.id === classId);
}

export function programOf(db: Database, programId?: string): TrainingProgram | undefined {
  return db.programs.find((item) => item.id === programId);
}

/** Trạng thái lớp tính theo ngày; chỉ "Đã hủy" và "Kết thúc sớm" là mốc lưu cứng. */
export function classStatus(cls: TrainingClass, todayKey: string): ClassStatus {
  if (cls.cancelledAt) return 'CANCELLED';
  if (cls.endedEarlyAt || todayKey > cls.endDate) return 'COMPLETED';
  if (todayKey < cls.startDate) return 'SCHEDULED';
  return 'ACTIVE';
}

export function isClassOpen(cls: TrainingClass, todayKey: string): boolean {
  const status = classStatus(cls, todayKey);
  return status === 'SCHEDULED' || status === 'ACTIVE';
}

export function classSessions(db: Database, classId: string): ClassSession[] {
  return db.sessions
    .filter((session) => session.classId === classId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.slotId.localeCompare(b.slotId));
}

export function openEnrollments(db: Database, classId: string): ClassEnrollment[] {
  return db.enrollments.filter((item) => item.classId === classId && !item.withdrawnAt);
}

/** Đăng ký còn hiệu lực của ngựa trong các lớp chưa kết thúc. */
export function activeEnrollments(db: Database, horseId: string, todayKey: string): ClassEnrollment[] {
  return db.enrollments.filter((item) => {
    if (item.horseId !== horseId || item.withdrawnAt) return false;
    const cls = classOf(db, item.classId);
    return !!cls && isClassOpen(cls, todayKey);
  });
}

export function maxIntensityOfProgram(db: Database, program: TrainingProgram): TrainingIntensity | undefined {
  const subjectIds = program.phases.flatMap((phase) => phase.items.map((item) => item.subjectId));
  const intensities = subjectIds
    .map((id) => db.subjects.find((subject) => subject.id === id)?.intensity)
    .filter(Boolean) as TrainingIntensity[];
  return maxIntensity(intensities);
}

/** Cường độ cao nhất của các buổi còn lại của lớp (từ ngày cho trước); không còn buổi thì lấy theo giáo án. */
export function maxIntensityOfClass(db: Database, classId: string, fromDate: string): TrainingIntensity | undefined {
  const remaining = classSessions(db, classId).filter(
    (session) => session.date >= fromDate && session.status === 'SCHEDULED',
  );
  if (remaining.length > 0) return maxIntensity(remaining.map((session) => session.intensity));
  const program = programOf(db, classOf(db, classId)?.programId);
  return program ? maxIntensityOfProgram(db, program) : undefined;
}

/* ===== Buổi học và danh sách ngựa ===== */

export function attendanceOf(db: Database, sessionId: string, horseId: string): SessionAttendance | undefined {
  return db.attendances.find((item) => item.sessionId === sessionId && item.horseId === horseId);
}

export interface RosterEntry {
  horseId: string;
  enrollmentId: string;
  attendance?: SessionAttendance;
}

/**
 * Danh sách ngựa của một buổi.
 * - Buổi đã bắt đầu: chính là các dòng tham gia đã được chốt lúc bấm Bắt đầu.
 * - Buổi chưa bắt đầu: các đăng ký chưa rút, có ngày vào lớp không muộn hơn ngày của buổi.
 */
export function sessionRoster(db: Database, session: ClassSession): RosterEntry[] {
  const rows = db.attendances.filter((item) => item.sessionId === session.id);
  if (session.status === 'IN_PROGRESS' || session.status === 'AWAITING_REVIEW' || session.status === 'COMPLETED') {
    return rows.map((attendance) => ({ horseId: attendance.horseId, enrollmentId: attendance.enrollmentId, attendance }));
  }
  return db.enrollments
    .filter(
      (item) =>
        item.classId === session.classId && !item.withdrawnAt && toDateKey(item.joinedAt) <= session.date,
    )
    .map((enrollment) => ({
      horseId: enrollment.horseId,
      enrollmentId: enrollment.id,
      attendance: rows.find((row) => row.horseId === enrollment.horseId),
    }));
}

/** Groom dắt con ngựa trong buổi: Groom HT đổi riêng cho buổi, không có thì Groom phụ trách ngựa. */
export function effectiveGroomId(db: Database, session: ClassSession, horseId: string): string | undefined {
  const attendance = attendanceOf(db, session.id, horseId);
  if (attendance?.groomId && (attendance.groomOverridden || session.status !== 'SCHEDULED')) return attendance.groomId;
  return findHorse(db, horseId)?.groomId;
}

export interface HorseScheduleEntry {
  session: ClassSession;
  cls: TrainingClass;
  attendance?: SessionAttendance;
}

/** Lịch tập của một con ngựa — tính ra từ các đăng ký, không lưu riêng (A.5.2). */
export function horseSchedule(db: Database, horseId: string, from: string, to: string): HorseScheduleEntry[] {
  const enrollments = db.enrollments.filter((item) => item.horseId === horseId);
  const classIds = new Set(enrollments.map((item) => item.classId));
  const result: HorseScheduleEntry[] = [];
  db.sessions.forEach((session) => {
    if (!classIds.has(session.classId) || session.date < from || session.date > to) return;
    const attendance = attendanceOf(db, session.id, horseId);
    const cls = classOf(db, session.classId);
    if (!cls) return;
    if (attendance) {
      result.push({ session, cls, attendance });
      return;
    }
    if (session.status !== 'SCHEDULED' && session.status !== 'CANCELLED') return;
    const open = enrollments.find(
      (item) => item.classId === session.classId && !item.withdrawnAt && toDateKey(item.joinedAt) <= session.date,
    );
    if (open) result.push({ session, cls });
  });
  return result.sort((a, b) => a.session.date.localeCompare(b.session.date) || a.session.slotId.localeCompare(b.session.slotId));
}

/** Các buổi sắp tới (chưa hủy) của ngựa dưới dạng DayItem, để kiểm giới hạn trong ngày. */
export function horseDayItems(db: Database, horseId: string, fromDate: string, ignoreClassId?: string): DayItem[] {
  return horseSchedule(db, horseId, fromDate, '9999-12-31')
    .filter((entry) => entry.cls.id !== ignoreClassId && entry.session.status !== 'CANCELLED')
    .filter((entry) => entry.attendance?.status !== 'ABSENT')
    .map((entry) => ({
      date: entry.session.date,
      slotId: entry.session.slotId,
      intensity: entry.session.intensity,
      label: `lớp ${entry.cls.name}`,
    }));
}

/** Đối chiếu các buổi dự kiến với lịch hiện có của ngựa qua mọi lớp. */
export function scheduleConflicts(
  db: Database,
  horseId: string,
  candidates: DayItem[],
  ignoreClassId?: string,
): { hard: { date: string; reason: string }[]; warnings: string[] } {
  const fromDate = candidates.reduce((min, item) => (item.date < min ? item.date : min), '9999-12-31');
  const existing = horseDayItems(db, horseId, fromDate, ignoreClassId);
  const hard: { date: string; reason: string }[] = [];
  const accepted: DayItem[] = [];
  candidates.forEach((candidate) => {
    const sameDay = [...existing, ...accepted].filter((item) => item.date === candidate.date);
    const check = checkDayLimits(sameDay, candidate);
    if (!check.allowed) hard.push({ date: candidate.date, reason: check.reason ?? 'Vượt giới hạn trong ngày' });
    else accepted.push(candidate);
  });
  const warnings = consecutiveHeavyWarnings([...existing, ...accepted]).slice(0, 3);
  return { hard, warnings };
}

export function runningSessions(db: Database): ClassSession[] {
  return db.sessions.filter((session) => session.status === 'IN_PROGRESS');
}

/** Nhãn tính ra, không lưu: Quá giờ / Bỏ lỡ. */
export function sessionDerivedLabel(db: Database, session: ClassSession, nowDate: Date): string | undefined {
  if (session.status !== 'SCHEDULED') return undefined;
  const today = toDateKey(nowDate);
  if (session.date < today) return 'Bỏ lỡ';
  if (session.date === today && nowDate > sessionEndAt(db, session)) return 'Quá giờ';
  return undefined;
}

export function sessionStatusOrder(status: SessionStatus): number {
  const order: Record<SessionStatus, number> = {
    IN_PROGRESS: 0,
    AWAITING_REVIEW: 1,
    SCHEDULED: 2,
    COMPLETED: 3,
    CANCELLED: 4,
  };
  return order[status];
}

/* ===== Y tế ===== */

export function openCaseOf(db: Database, horseId: string): MedicalCase | undefined {
  return db.medicalCases.find((item) => item.horseId === horseId && item.status === 'OPEN');
}

/** Buổi khám gần nhất bất kể loại (định kỳ hay trong bệnh án). */
export function lastExamAt(db: Database, horseId: string): string | undefined {
  return db.examinations
    .filter((exam) => exam.horseId === horseId)
    .reduce<string | undefined>((latest, exam) => (!latest || exam.examinedAt > latest ? exam.examinedAt : latest), undefined);
}

export type PeriodicState = 'OK' | 'DUE_SOON' | 'OVERDUE' | 'OVERDUE_ALERT' | 'NONE';

export interface PeriodicStatus {
  lastExamAt?: string;
  dueDate: string;
  /** Số ngày đã quá hạn (âm = còn bao nhiêu ngày nữa tới hạn). */
  overdueDays: number;
  state: PeriodicState;
}

/** Hạn khám kế tiếp = buổi khám gần nhất (mọi loại) + chu kỳ; chưa khám thì tính từ ngày tạo hồ sơ. */
export function periodicStatus(db: Database, horse: Horse, today: Date): PeriodicStatus {
  const last = lastExamAt(db, horse.id);
  const base = last ?? horse.createdAt;
  const dueDate = toDateKey(addDays(base, db.settings.examCycleDays));
  const overdueDays = daysBetween(dueDate, today);
  if (horse.deletedAt || horse.lifecycleStatus === 'TRANSFERRED') {
    return { lastExamAt: last, dueDate, overdueDays, state: 'NONE' };
  }
  let state: PeriodicState = 'OK';
  if (overdueDays > PERIODIC_ALERT_DAYS) state = 'OVERDUE_ALERT';
  else if (overdueDays > 0) state = 'OVERDUE';
  else if (overdueDays >= -7) state = 'DUE_SOON';
  return { lastExamAt: last, dueDate, overdueDays, state };
}
