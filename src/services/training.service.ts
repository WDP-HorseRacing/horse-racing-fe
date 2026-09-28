// Flow 2 — phần thiết lập theo mô hình lớp học (F2.2–F2.6):
// môn học, giáo án, lớp, đăng ký/rút ngựa, thêm/hủy buổi học và lịch tập tuần.
//
// Nguyên tắc:
// - Giáo án là khuôn mẫu, không có ngày, không gắn ngựa. Lớp mở từ giáo án và sinh TOÀN BỘ buổi học
//   (chụp lại nội dung môn học). Sửa môn học / giáo án KHÔNG đổi buổi đã sinh.
// - Ngựa vào lớp bằng bản ghi đăng ký; lịch của ngựa luôn tính ra từ các đăng ký còn hiệu lực.
// - Rút ngựa chỉ đóng đăng ký, không hủy buổi nào. Hủy buổi là hủy cho cả lớp.
// - Mọi kiểm tra chạy TRƯỚC khi ghi: kho dữ liệu sửa tại chỗ nên không được ném lỗi giữa chừng.
import type {
  ClassEnrollment,
  ClassSession,
  ClassStatus,
  Database,
  EnrollmentCloseReason,
  AbsenceReason,
  AttendanceStatus,
  HealthStatus,
  Horse,
  LifecycleStatus,
  ProgramPhase,
  SessionCancelKind,
  SessionStatus,
  TrackSurface,
  TrainingClass,
  TrainingIntensity,
  TrainingProgram,
  TrainingSlot,
  TrainingSubject,
  User,
  WorkoutType,
} from '../types/domain';
import { AppError, ERR_FORBIDDEN, ERR_NOT_FOUND, newId, stamp, touch } from './db';
import { commit, notifyMany, query, requirePermission, writeAudit } from './api';
import { can, capabilityScope, inZoneScope } from '../auth/permissions';
import {
  attendanceOf,
  classOf,
  classSessions,
  classStatus,
  effectiveGroomId,
  findHorse,
  horseSchedule,
  managedZoneIds,
  maxIntensityOfClass,
  openEnrollments,
  programOf,
  scheduleConflicts,
  sessionDerivedLabel,
  sessionRoster,
  sessionStartAt,
  slotLabel,
  slotOf,
  userName,
} from './selectors';
import { canTrain, consecutiveHeavyWarnings, isHeavy, maxIntensity, checkSubject, type DayItem } from '../lib/rules';
import { classEndDate, generateSessionPlan, programTotalWeeks, type PlannedSession } from '../lib/class-schedule';
import { now } from '../lib/clock';
import { addDays, daysBetween, formatDate, toDateKey } from '../lib/format';
import { intensityLabel } from '../lib/labels';
import { links } from '../lib/links';

/* ============================================================
 * Hằng số và tiện ích nội bộ
 * ============================================================ */

export const PROGRAM_LIMITS = {
  maxPhases: 6,
  minWeeks: 1,
  maxWeeks: 12,
  maxTotalWeeks: 52,
  maxSessionsPerWeek: 7,
} as const;

export const CLASS_LIMITS = { minCapacity: 1, maxCapacity: 20, defaultCapacity: 8 } as const;

const todayKey = () => toDateKey(now());

function liveSubjects(db: Database): TrainingSubject[] {
  return db.subjects.filter((subject) => !subject.deletedAt);
}

function livePrograms(db: Database): TrainingProgram[] {
  return db.programs.filter((program) => !program.deletedAt);
}

function zoneName(db: Database, zoneId?: string): string {
  return db.zones.find((zone) => zone.id === zoneId)?.name ?? '—';
}

function trainerIdOfClass(db: Database, cls: TrainingClass): string | undefined {
  return db.zones.find((zone) => zone.id === cls.zoneId)?.headTrainerId;
}

function slotStart(db: Database, slotId: string): string {
  return slotOf(db, slotId)?.startTime ?? '99:99';
}

function bySessionTime(db: Database) {
  return (a: ClassSession, b: ClassSession) =>
    a.date.localeCompare(b.date) || slotStart(db, a.slotId).localeCompare(slotStart(db, b.slotId));
}

function requireClass(db: Database, classId: string): TrainingClass {
  const cls = classOf(db, classId);
  if (!cls) throw new AppError(ERR_NOT_FOUND);
  return cls;
}

function requireText(value: string | undefined, message: string, field?: string): string {
  const text = (value ?? '').trim();
  if (!text) throw new AppError(message, field);
  return text;
}

function sameName(a: string, b: string) {
  return a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi');
}

/** Người dùng có xem được lớp này không (GROOM: lớp có ngựa mình phụ trách; OWNER: lớp có ngựa của mình). */
function canSeeClass(db: Database, user: User, cls: TrainingClass): boolean {
  const scope = capabilityScope(user.role, 'class.view');
  if (!scope) return false;
  if (scope === 'all') return true;
  return db.enrollments.some((item) => {
    if (item.classId !== cls.id) return false;
    const horse = findHorse(db, item.horseId);
    if (!horse) return false;
    if (scope === 'assigned') return horse.groomId === user.id;
    if (scope === 'owned') return horse.ownerId === user.id && !horse.deletedAt;
    return false;
  });
}

/** Buổi học có nằm trong phạm vi xem lịch của người dùng không. */
function canSeeSession(db: Database, user: User, session: ClassSession): boolean {
  const scope = capabilityScope(user.role, 'class.view');
  if (!scope) return false;
  if (scope === 'all') return true;
  const roster = sessionRoster(db, session);
  if (scope === 'assigned') return roster.some((entry) => effectiveGroomId(db, session, entry.horseId) === user.id);
  if (scope === 'owned') return roster.some((entry) => findHorse(db, entry.horseId)?.ownerId === user.id);
  return false;
}

/** Ngựa có trong phạm vi lọc lịch của người dùng không. */
function horseInViewScope(user: User, horse: Horse): boolean {
  const scope = capabilityScope(user.role, 'class.view');
  if (scope === 'all') return true;
  if (scope === 'assigned') return horse.groomId === user.id;
  if (scope === 'owned') return horse.ownerId === user.id && !horse.deletedAt;
  return false;
}

function attendanceCounts(db: Database, sessionId: string) {
  const rows = db.attendances.filter((row) => row.sessionId === sessionId);
  return {
    present: rows.filter((row) => row.status === 'PRESENT').length,
    absent: rows.filter((row) => row.status === 'ABSENT').length,
  };
}

function hasRunningSession(db: Database, classId: string): ClassSession | undefined {
  return db.sessions.find((session) => session.classId === classId && session.status === 'IN_PROGRESS');
}

/** Người nhận thông báo liên quan tới ngựa: chủ sở hữu và Groom phụ trách (A.7). */
function ownerAndGroom(horse: Horse | undefined): (string | undefined)[] {
  if (!horse) return [];
  return [horse.ownerId, horse.groomId];
}

/* ============================================================
 * Tùy chọn cho biểu mẫu
 * ============================================================ */

export interface SlotOption extends TrainingSlot {
  label: string;
}

export async function listSlots(): Promise<SlotOption[]> {
  return query((db) =>
    [...db.slots]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((slot) => ({ ...slot, label: `${slot.startTime}–${slot.endTime}` })),
  );
}

export interface ZoneOption {
  id: string;
  name: string;
  active: boolean;
  /** Lý do không mở lớp được ở khu này (khu bảo trì/đóng). */
  disabledReason?: string;
}

/** Các khu HT hiện tại phụ trách — chỉ những khu này được chọn khi mở lớp. */
export async function listClassZoneOptions(): Promise<ZoneOption[]> {
  return query((db) => {
    const user = requirePermission('class.view');
    const ids = managedZoneIds(db, user.id);
    return db.zones
      .filter((zone) => ids.includes(zone.id))
      .map((zone) => ({
        id: zone.id,
        name: zone.name,
        active: zone.status === 'ACTIVE',
        disabledReason: zone.status === 'ACTIVE' ? undefined : 'Khu đang bảo trì hoặc đã đóng, không mở lớp mới',
      }));
  });
}

export interface SubjectOption {
  id: string;
  name: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  description?: string;
}

function toSubjectOption(subject: TrainingSubject): SubjectOption {
  return {
    id: subject.id,
    name: subject.name,
    workoutType: subject.workoutType,
    distanceM: subject.distanceM,
    repetitions: subject.repetitions,
    intensity: subject.intensity,
    surface: subject.surface,
    description: subject.description,
  };
}

export async function listSubjectOptions(): Promise<SubjectOption[]> {
  return query((db) => {
    requirePermission('program.view');
    return liveSubjects(db)
      .map(toSubjectOption)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  });
}

export interface ProgramOption {
  id: string;
  name: string;
  description?: string;
  phases: ProgramPhase[];
  summary: ProgramSummary;
}

export async function listProgramOptions(): Promise<ProgramOption[]> {
  return query((db) => {
    requirePermission('program.view');
    const subjects = liveSubjects(db).map(toSubjectOption);
    return livePrograms(db)
      .map((program) => ({
        id: program.id,
        name: program.name,
        description: program.description,
        phases: program.phases,
        summary: summarizeProgram(program.phases, subjectsForProgram(db, program, subjects)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  });
}

/* ============================================================
 * F2.2 — Môn học
 * ============================================================ */

export interface SubjectInput {
  name: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  description?: string;
}

export interface SubjectRow extends SubjectOption {
  volumeM: number;
  createdByName: string;
  updatedAt: string;
  /** Tên các giáo án (chưa xóa) đang dùng môn này. */
  usedByPrograms: { id: string; name: string }[];
  /** Số buổi học đã sinh từ môn này. */
  usedBySessions: number;
  deletable: boolean;
  blockReason?: string;
}

function subjectUsage(db: Database, subjectId: string) {
  const programs = livePrograms(db).filter((program) =>
    program.phases.some((phase) => phase.items.some((item) => item.subjectId === subjectId)),
  );
  const sessions = db.sessions.filter((session) => session.subjectId === subjectId).length;
  let blockReason: string | undefined;
  if (programs.length > 0) {
    blockReason = `Đang dùng trong giáo án ${programs.map((program) => `"${program.name}"`).join(', ')}`;
  } else if (sessions > 0) {
    blockReason = `Đã có ${sessions} buổi học được sinh từ môn này`;
  }
  return { programs, sessions, blockReason };
}

export async function listSubjects(): Promise<{ rows: SubjectRow[]; canManage: boolean }> {
  return query((db) => {
    const user = requirePermission('subject.view');
    const rows = liveSubjects(db)
      .map((subject) => {
        const usage = subjectUsage(db, subject.id);
        return {
          ...toSubjectOption(subject),
          volumeM: subject.distanceM * subject.repetitions,
          createdByName: userName(db, subject.createdBy),
          updatedAt: subject.updatedAt,
          usedByPrograms: usage.programs.map((program) => ({ id: program.id, name: program.name })),
          usedBySessions: usage.sessions,
          deletable: !usage.blockReason,
          blockReason: usage.blockReason,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return { rows, canManage: can(user, 'subject.manage') };
  });
}

function validateSubject(db: Database, input: SubjectInput, ignoreId?: string): SubjectInput {
  const name = requireText(input.name, 'Tên môn học không được để trống', 'name');
  if (name.length > 80) throw new AppError('Tên môn học tối đa 80 ký tự', 'name');
  if (liveSubjects(db).some((subject) => subject.id !== ignoreId && sameName(subject.name, name))) {
    throw new AppError(`Đã có môn học tên "${name}"`, 'name');
  }
  const distanceM = Number(input.distanceM);
  const repetitions = Number(input.repetitions);
  const check = checkSubject({ workoutType: input.workoutType, intensity: input.intensity, distanceM, repetitions });
  if (!check.allowed) {
    const field = /lặp/.test(check.reason ?? '') ? 'repetitions' : /Cự ly/.test(check.reason ?? '') ? 'distanceM' : 'intensity';
    throw new AppError(check.reason ?? 'Môn học không hợp lệ', field);
  }
  return {
    name,
    workoutType: input.workoutType,
    distanceM,
    repetitions,
    intensity: input.intensity,
    surface: input.surface,
    description: input.description?.trim() || undefined,
  };
}

export async function createSubject(input: SubjectInput): Promise<string> {
  return commit((db) => {
    const actor = requirePermission('subject.manage');
    const at = now();
    const clean = validateSubject(db, input);
    const subject: TrainingSubject = { id: newId('sub'), ...clean, createdBy: actor.id, ...stamp(at) };
    db.subjects.push(subject);
    writeAudit(db, at, { action: 'Thêm môn học', entityType: 'TrainingSubject', entityId: subject.id, after: clean, actor });
    return subject.id;
  });
}

/** Sửa môn học — các buổi đã sinh giữ nguyên nội dung đã chụp lại lúc sinh. */
export async function updateSubject(id: string, input: SubjectInput): Promise<string> {
  return commit((db) => {
    const actor = requirePermission('subject.manage');
    const at = now();
    const subject = db.subjects.find((item) => item.id === id && !item.deletedAt);
    if (!subject) throw new AppError(ERR_NOT_FOUND);
    const clean = validateSubject(db, input, id);
    const before = toSubjectOption(subject);
    Object.assign(subject, clean);
    touch(subject, at);
    writeAudit(db, at, {
      action: 'Sửa môn học',
      entityType: 'TrainingSubject',
      entityId: subject.id,
      before,
      after: clean,
      reason: 'Các buổi học đã sinh giữ nguyên nội dung cũ',
      actor,
    });
    return subject.id;
  });
}

export async function deleteSubject(id: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('subject.manage');
    const at = now();
    const subject = db.subjects.find((item) => item.id === id && !item.deletedAt);
    if (!subject) throw new AppError(ERR_NOT_FOUND);
    const usage = subjectUsage(db, id);
    if (usage.blockReason) throw new AppError(`Không xóa được môn "${subject.name}". ${usage.blockReason}`);
    subject.deletedAt = at.toISOString();
    touch(subject, at);
    writeAudit(db, at, { action: 'Xóa môn học', entityType: 'TrainingSubject', entityId: id, before: { name: subject.name }, actor });
  });
}

/* ============================================================
 * F2.3 — Giáo án: hàm thuần dùng chung cho service và trình soạn
 * ============================================================ */

export interface ProgramDraft {
  name?: string;
  description?: string;
  phases: ProgramPhase[];
}

export interface PhaseSummary {
  name: string;
  weeks: number;
  /** Số buổi mỗi tuần (tối đa 7 — lớp dùng một slot cố định). */
  sessionsPerWeek: number;
  restDays: number;
  weeklyVolumeM: number;
  maxIntensity?: TrainingIntensity;
}

export interface ProgramSummary {
  totalWeeks: number;
  totalSessions: number;
  phases: PhaseSummary[];
  maxIntensity?: TrainingIntensity;
  /** Khối lượng lớn nhất trong một tuần (m). */
  peakWeeklyVolumeM: number;
}

/** Tổng hợp giáo án (tổng tuần, buổi, khối lượng, cường độ cao nhất) — hàm thuần. */
export function summarizeProgram(phases: ProgramPhase[], subjects: SubjectOption[]): ProgramSummary {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const phaseSummaries = phases.map((phase) => {
    let count = 0;
    let volume = 0;
    const intensities: TrainingIntensity[] = [];
    phase.items.forEach((item) => {
      const subject = byId.get(item.subjectId);
      const perWeek = Math.max(0, Math.floor(Number(item.sessionsPerWeek) || 0));
      if (!subject || perWeek === 0) return;
      count += perWeek;
      volume += subject.distanceM * subject.repetitions * perWeek;
      intensities.push(subject.intensity);
    });
    const sessionsPerWeek = Math.min(7, count);
    return {
      name: phase.name,
      weeks: Math.max(0, Math.floor(Number(phase.weeks) || 0)),
      sessionsPerWeek,
      restDays: 7 - sessionsPerWeek,
      weeklyVolumeM: volume,
      maxIntensity: maxIntensity(intensities),
    };
  });
  return {
    totalWeeks: phaseSummaries.reduce((sum, phase) => sum + phase.weeks, 0),
    totalSessions: phaseSummaries.reduce((sum, phase) => sum + phase.sessionsPerWeek * phase.weeks, 0),
    phases: phaseSummaries,
    maxIntensity: maxIntensity(phaseSummaries.flatMap((phase) => (phase.maxIntensity ? [phase.maxIntensity] : []))),
    peakWeeklyVolumeM: phaseSummaries.reduce((max, phase) => Math.max(max, phase.weeklyVolumeM), 0),
  };
}

export interface DraftIssue {
  field: string;
  message: string;
}

/** Kiểm tra ràng buộc giáo án (C.2.2) — hàm thuần; trả danh sách lỗi chặn lưu. */
export function validateProgramDraft(draft: ProgramDraft, subjects: SubjectOption[]): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  if (!draft.name?.trim()) issues.push({ field: 'name', message: 'Tên giáo án không được để trống' });
  if (draft.phases.length < 1) issues.push({ field: 'phases', message: 'Giáo án phải có ít nhất 1 giai đoạn' });
  if (draft.phases.length > PROGRAM_LIMITS.maxPhases) {
    issues.push({ field: 'phases', message: `Giáo án có tối đa ${PROGRAM_LIMITS.maxPhases} giai đoạn` });
  }
  draft.phases.forEach((phase, index) => {
    const field = `phase-${index}`;
    const label = phase.name?.trim() ? `Giai đoạn "${phase.name.trim()}"` : `Giai đoạn ${index + 1}`;
    if (!phase.name?.trim()) issues.push({ field, message: `Giai đoạn ${index + 1} chưa có tên` });
    const weeks = Number(phase.weeks);
    if (!Number.isInteger(weeks) || weeks < PROGRAM_LIMITS.minWeeks || weeks > PROGRAM_LIMITS.maxWeeks) {
      issues.push({ field, message: `${label}: số tuần phải từ ${PROGRAM_LIMITS.minWeeks} đến ${PROGRAM_LIMITS.maxWeeks}` });
    }
    if (phase.items.length === 0) issues.push({ field, message: `${label} chưa có môn học nào` });
    const seen = new Set<string>();
    let total = 0;
    phase.items.forEach((item) => {
      if (!item.subjectId) {
        issues.push({ field, message: `${label}: có dòng chưa chọn môn học` });
        return;
      }
      const subject = byId.get(item.subjectId);
      if (!subject) {
        issues.push({ field, message: `${label}: có môn học đã bị xóa, hãy chọn môn khác` });
        return;
      }
      if (seen.has(item.subjectId)) {
        issues.push({ field, message: `${label}: môn "${subject.name}" bị lặp — gộp vào một dòng và tăng số buổi mỗi tuần` });
      }
      seen.add(item.subjectId);
      const perWeek = Number(item.sessionsPerWeek);
      if (!Number.isInteger(perWeek) || perWeek < 1 || perWeek > PROGRAM_LIMITS.maxSessionsPerWeek) {
        issues.push({ field, message: `${label}: số buổi mỗi tuần của "${subject.name}" phải từ 1 đến 7` });
      }
      total += Number.isFinite(perWeek) ? perWeek : 0;
    });
    if (total > PROGRAM_LIMITS.maxSessionsPerWeek) {
      issues.push({
        field,
        message: `${label}: ${total} buổi mỗi tuần vượt quá 7 — lớp dùng một khung giờ cố định nên mỗi ngày tối đa 1 buổi`,
      });
    }
  });
  const totalWeeks = draft.phases.reduce((sum, phase) => sum + (Number(phase.weeks) || 0), 0);
  if (totalWeeks > PROGRAM_LIMITS.maxTotalWeeks) {
    issues.push({ field: 'phases', message: `Tổng thời lượng ${totalWeeks} tuần vượt quá ${PROGRAM_LIMITS.maxTotalWeeks} tuần` });
  }
  return issues;
}

/** Ngày bắt đầu giả (thứ 2) chỉ để thử rải buổi — giáo án không có ngày thật. */
const PROBE_START = '2026-01-05';

/**
 * Cảnh báo mềm của giáo án (không chặn lưu) — hàm thuần, dùng ngay trong trình soạn:
 * - Tuần 7 buổi: ngựa không có ngày nghỉ.
 * - Buổi Nặng/Tối đa có thể rơi vào hai ngày liên tiếp (thử rải lịch trên một ngày bắt đầu giả).
 */
export function programWarnings(draft: ProgramDraft, subjects: SubjectOption[]): string[] {
  const warnings: string[] = [];
  const summary = summarizeProgram(draft.phases, subjects);
  summary.phases.forEach((phase, index) => {
    if (phase.sessionsPerWeek >= 7) {
      warnings.push(`Giai đoạn "${phase.name || index + 1}": 7 buổi mỗi tuần, ngựa không có ngày nghỉ`);
    }
  });

  const phases = draft.phases.map((phase) => ({
    ...phase,
    weeks: Math.min(PROGRAM_LIMITS.maxWeeks, Math.max(0, Math.floor(Number(phase.weeks) || 0))),
  }));
  // generateSessionPlan chỉ đọc các trường nội dung của môn học.
  const plan = generateSessionPlan({ phases }, subjects as unknown as TrainingSubject[], PROBE_START);
  const items: DayItem[] = plan.map((item) => ({ date: item.date, slotId: 'probe', intensity: item.intensity }));
  if (consecutiveHeavyWarnings(items).length > 0) {
    const heavyByDate = new Map<string, PlannedSession>();
    plan.forEach((item) => {
      if (isHeavy(item.intensity)) heavyByDate.set(item.date, item);
    });
    const messages = new Set<string>();
    heavyByDate.forEach((item, date) => {
      const next = heavyByDate.get(toDateKey(addDays(date, 1)));
      if (!next) return;
      messages.add(
        next.phaseNo === item.phaseNo
          ? `Giai đoạn "${item.phaseName}": có buổi Nặng/Tối đa rơi vào hai ngày liên tiếp — cân nhắc bớt môn nặng trong tuần`
          : `Chuyển từ giai đoạn "${item.phaseName}" sang "${next.phaseName}": buổi Nặng/Tối đa có thể rơi vào hai ngày liên tiếp`,
      );
    });
    warnings.push(...messages);
  }
  return warnings;
}

/** Môn học để tính cho một giáo án: môn còn sống + môn đã xóa nhưng giáo án vẫn tham chiếu (để hiển thị). */
function subjectsForProgram(db: Database, program: TrainingProgram, live: SubjectOption[]): SubjectOption[] {
  const ids = new Set(live.map((subject) => subject.id));
  const extra = program.phases
    .flatMap((phase) => phase.items.map((item) => item.subjectId))
    .filter((id) => !ids.has(id))
    .map((id) => db.subjects.find((subject) => subject.id === id))
    .filter(Boolean) as TrainingSubject[];
  return [...live, ...extra.map(toSubjectOption)];
}

/* ============================================================
 * F2.3 — Giáo án: đọc và ghi
 * ============================================================ */

export interface ProgramClassRef {
  id: string;
  name: string;
  status: ClassStatus;
  zoneName: string;
  startDate: string;
  endDate: string;
  enrolled: number;
  capacity: number;
}

export interface ProgramRow {
  id: string;
  name: string;
  description?: string;
  createdByName: string;
  phaseCount: number;
  summary: ProgramSummary;
  /** Số lớp đang chạy hoặc sắp tới dùng giáo án này. */
  openClassCount: number;
  /** Tổng số lớp từng mở từ giáo án (kể cả đã kết thúc/hủy). */
  classCount: number;
  deletable: boolean;
  blockReason?: string;
}

function programClasses(db: Database, programId: string): TrainingClass[] {
  return db.classes.filter((cls) => cls.programId === programId);
}

function programRow(db: Database, program: TrainingProgram, live: SubjectOption[]): ProgramRow {
  const today = todayKey();
  const classes = programClasses(db, program.id);
  const open = classes.filter((cls) => {
    const status = classStatus(cls, today);
    return status === 'ACTIVE' || status === 'SCHEDULED';
  });
  return {
    id: program.id,
    name: program.name,
    description: program.description,
    createdByName: userName(db, program.createdBy),
    phaseCount: program.phases.length,
    summary: summarizeProgram(program.phases, subjectsForProgram(db, program, live)),
    openClassCount: open.length,
    classCount: classes.length,
    deletable: classes.length === 0,
    blockReason: classes.length > 0 ? `Đã có ${classes.length} lớp mở từ giáo án này` : undefined,
  };
}

export async function listPrograms(): Promise<{ rows: ProgramRow[]; canManage: boolean; canOpenClass: boolean }> {
  return query((db) => {
    const user = requirePermission('program.view');
    const live = liveSubjects(db).map(toSubjectOption);
    const rows = livePrograms(db)
      .map((program) => programRow(db, program, live))
      .sort((a, b) => b.openClassCount - a.openClassCount || a.name.localeCompare(b.name, 'vi'));
    return {
      rows,
      canManage: can(user, 'program.manage'),
      canOpenClass: can(user, 'class.manage') && managedZoneIds(db, user.id).length > 0,
    };
  });
}

export interface ProgramPhaseDetail extends PhaseSummary {
  no: number;
  items: (SubjectOption & { sessionsPerWeek: number; deleted: boolean })[];
}

export interface ProgramDetail extends ProgramRow {
  /** Dữ liệu gốc để nạp vào trình soạn. */
  draft: ProgramDraft;
  phaseDetails: ProgramPhaseDetail[];
  classes: ProgramClassRef[];
  warnings: string[];
  updatedAt: string;
  canManage: boolean;
  canOpenClass: boolean;
}

export async function getProgram(id: string): Promise<ProgramDetail> {
  return query((db) => {
    const user = requirePermission('program.view');
    const program = db.programs.find((item) => item.id === id && !item.deletedAt);
    if (!program) throw new AppError(ERR_NOT_FOUND);
    const live = liveSubjects(db).map(toSubjectOption);
    const all = subjectsForProgram(db, program, live);
    const byId = new Map(all.map((subject) => [subject.id, subject]));
    const row = programRow(db, program, live);
    const today = todayKey();
    const phaseDetails = program.phases.map((phase, index) => ({
      ...row.summary.phases[index],
      no: index + 1,
      items: phase.items
        .map((item) => {
          const subject = byId.get(item.subjectId);
          if (!subject) return undefined;
          const deleted = !!db.subjects.find((entry) => entry.id === item.subjectId)?.deletedAt;
          return { ...subject, sessionsPerWeek: item.sessionsPerWeek, deleted };
        })
        .filter(Boolean) as ProgramPhaseDetail['items'],
    }));
    const classes = programClasses(db, program.id)
      .map((cls) => ({
        id: cls.id,
        name: cls.name,
        status: classStatus(cls, today),
        zoneName: zoneName(db, cls.zoneId),
        startDate: cls.startDate,
        endDate: cls.endDate,
        enrolled: openEnrollments(db, cls.id).length,
        capacity: cls.capacity,
      }))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const warnings = programWarnings({ phases: program.phases }, all);
    if (phaseDetails.some((phase) => phase.items.some((item) => item.deleted))) {
      warnings.push('Giáo án còn tham chiếu môn học đã bị xóa — hãy sửa giáo án trước khi mở lớp mới');
    }
    return {
      ...row,
      draft: { name: program.name, description: program.description, phases: program.phases },
      phaseDetails,
      classes,
      warnings,
      updatedAt: program.updatedAt,
      canManage: can(user, 'program.manage'),
      canOpenClass: can(user, 'class.manage') && managedZoneIds(db, user.id).length > 0,
    };
  });
}

function cleanProgram(db: Database, draft: ProgramDraft, ignoreId?: string): ProgramDraft & { name: string } {
  const live = liveSubjects(db).map(toSubjectOption);
  const phases: ProgramPhase[] = draft.phases.map((phase) => ({
    name: (phase.name ?? '').trim(),
    weeks: Number(phase.weeks),
    items: phase.items.map((item) => ({ subjectId: item.subjectId, sessionsPerWeek: Number(item.sessionsPerWeek) })),
  }));
  const issues = validateProgramDraft({ ...draft, phases }, live);
  if (issues.length > 0) throw new AppError(issues[0].message, issues[0].field);
  const name = (draft.name ?? '').trim();
  if (livePrograms(db).some((program) => program.id !== ignoreId && sameName(program.name, name))) {
    throw new AppError(`Đã có giáo án tên "${name}"`, 'name');
  }
  return { name, description: draft.description?.trim() || undefined, phases };
}

export async function createProgram(draft: ProgramDraft): Promise<string> {
  return commit((db) => {
    const actor = requirePermission('program.manage');
    const at = now();
    const clean = cleanProgram(db, draft);
    const program: TrainingProgram = { id: newId('prog'), ...clean, createdBy: actor.id, ...stamp(at) };
    db.programs.push(program);
    writeAudit(db, at, {
      action: 'Thêm giáo án',
      entityType: 'TrainingProgram',
      entityId: program.id,
      after: { name: clean.name, phases: clean.phases.length, totalWeeks: programTotalWeeks(clean) },
      actor,
    });
    return program.id;
  });
}

/** Sửa giáo án — KHÔNG đổi buổi đã sinh của các lớp đang chạy (C.2.6). */
export async function updateProgram(id: string, draft: ProgramDraft): Promise<string> {
  return commit((db) => {
    const actor = requirePermission('program.manage');
    const at = now();
    const program = db.programs.find((item) => item.id === id && !item.deletedAt);
    if (!program) throw new AppError(ERR_NOT_FOUND);
    const clean = cleanProgram(db, draft, id);
    const before = { name: program.name, phases: program.phases };
    program.name = clean.name;
    program.description = clean.description;
    program.phases = clean.phases;
    touch(program, at);
    writeAudit(db, at, {
      action: 'Sửa giáo án',
      entityType: 'TrainingProgram',
      entityId: id,
      before,
      after: { name: clean.name, phases: clean.phases },
      reason: 'Buổi học đã sinh của các lớp giữ nguyên',
      actor,
    });
    return id;
  });
}

export async function deleteProgram(id: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('program.manage');
    const at = now();
    const program = db.programs.find((item) => item.id === id && !item.deletedAt);
    if (!program) throw new AppError(ERR_NOT_FOUND);
    const classes = programClasses(db, id);
    if (classes.length > 0) {
      throw new AppError(
        `Không xóa được giáo án "${program.name}": đã có ${classes.length} lớp mở từ giáo án này (${classes
          .slice(0, 3)
          .map((cls) => cls.name)
          .join(', ')})`,
      );
    }
    program.deletedAt = at.toISOString();
    touch(program, at);
    writeAudit(db, at, { action: 'Xóa giáo án', entityType: 'TrainingProgram', entityId: id, before: { name: program.name }, actor });
  });
}

/* ============================================================
 * F2.4 — Lớp
 * ============================================================ */

export interface ClassPreview {
  startDate: string;
  endDate: string;
  totalWeeks: number;
  sessions: PlannedSession[];
}

function planForProgram(db: Database, program: TrainingProgram, startDate: string): ClassPreview {
  const totalWeeks = programTotalWeeks(program);
  return {
    startDate,
    endDate: classEndDate(startDate, totalWeeks),
    totalWeeks,
    sessions: generateSessionPlan(program, liveSubjects(db), startDate),
  };
}

/** Xem trước các buổi sẽ sinh khi mở lớp từ giáo án vào ngày bắt đầu cho trước. */
export async function previewClassSchedule(programId: string, startDate: string): Promise<ClassPreview> {
  return query((db) => {
    requirePermission('program.view');
    const program = db.programs.find((item) => item.id === programId && !item.deletedAt);
    if (!program) throw new AppError(ERR_NOT_FOUND);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new AppError('Ngày bắt đầu không hợp lệ', 'startDate');
    return planForProgram(db, program, startDate);
  });
}

export interface NextSessionRef {
  id: string;
  date: string;
  slotLabel: string;
  subjectName: string;
  intensity: TrainingIntensity;
}

export interface ClassRow {
  id: string;
  name: string;
  programId: string;
  programName: string;
  zoneId: string;
  zoneName: string;
  trainerName: string;
  slotId: string;
  slotLabel: string;
  startDate: string;
  endDate: string;
  capacity: number;
  enrolled: number;
  status: ClassStatus;
  /** Buổi đã diễn ra (chờ đánh giá hoặc hoàn thành). */
  sessionsDone: number;
  /** Tổng buổi không tính buổi đã hủy. */
  sessionsTotal: number;
  nextSession?: NextSessionRef;
  canManage: boolean;
}

function classRow(db: Database, user: User, cls: TrainingClass, today: string): ClassRow {
  const sessions = classSessions(db, cls.id);
  const live = sessions.filter((session) => session.status !== 'CANCELLED');
  const next = live
    .filter((session) => session.status === 'SCHEDULED' && session.date >= today)
    .sort(bySessionTime(db))[0];
  return {
    id: cls.id,
    name: cls.name,
    programId: cls.programId,
    programName: programOf(db, cls.programId)?.name ?? '—',
    zoneId: cls.zoneId,
    zoneName: zoneName(db, cls.zoneId),
    trainerName: userName(db, trainerIdOfClass(db, cls)),
    slotId: cls.slotId,
    slotLabel: slotLabel(db, cls.slotId),
    startDate: cls.startDate,
    endDate: cls.endDate,
    capacity: cls.capacity,
    enrolled: openEnrollments(db, cls.id).length,
    status: classStatus(cls, today),
    sessionsDone: live.filter((session) => session.status === 'COMPLETED' || session.status === 'AWAITING_REVIEW').length,
    sessionsTotal: live.length,
    nextSession: next
      ? {
          id: next.id,
          date: next.date,
          slotLabel: slotLabel(db, next.slotId),
          subjectName: next.subjectName,
          intensity: next.intensity,
        }
      : undefined,
    canManage: inZoneScope(db, user, 'class.manage', cls.zoneId),
  };
}

const CLASS_STATUS_ORDER: Record<ClassStatus, number> = { ACTIVE: 0, SCHEDULED: 1, COMPLETED: 2, CANCELLED: 3 };

export interface ClassListResult {
  rows: ClassRow[];
  counts: Record<ClassStatus, number>;
  zones: { id: string; name: string }[];
  canCreate: boolean;
}

export async function listClasses(filter: { status?: ClassStatus | ''; zoneId?: string } = {}): Promise<ClassListResult> {
  return query((db) => {
    const user = requirePermission('class.view');
    const today = todayKey();
    const visible = db.classes.filter((cls) => canSeeClass(db, user, cls));
    const counts: Record<ClassStatus, number> = { ACTIVE: 0, SCHEDULED: 0, COMPLETED: 0, CANCELLED: 0 };
    const rows = visible
      .map((cls) => classRow(db, user, cls, today))
      .filter((row) => {
        if (filter.zoneId && row.zoneId !== filter.zoneId) return false;
        counts[row.status] += 1;
        return !filter.status || row.status === filter.status;
      })
      .sort(
        (a, b) =>
          CLASS_STATUS_ORDER[a.status] - CLASS_STATUS_ORDER[b.status] ||
          (a.status === 'SCHEDULED' ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)),
      );
    const zoneIds = new Set(visible.map((cls) => cls.zoneId));
    return {
      rows,
      counts,
      zones: db.zones.filter((zone) => zoneIds.has(zone.id)).map((zone) => ({ id: zone.id, name: zone.name })),
      canCreate: can(user, 'class.manage') && managedZoneIds(db, user.id).length > 0,
    };
  });
}

export interface ClassSessionRow {
  id: string;
  date: string;
  slotId: string;
  slotLabel: string;
  subjectId: string;
  subjectName: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  phaseNo?: number;
  phaseName?: string;
  weekNo?: number;
  status: SessionStatus;
  /** "Quá giờ" / "Bỏ lỡ" — tính ra, không lưu. */
  derivedLabel?: string;
  horseCount: number;
  presentCount: number;
  absentCount: number;
  isExtra: boolean;
  note?: string;
  cancelReason?: string;
  cancelKind?: SessionCancelKind;
  canCancel: boolean;
}

export interface EnrollmentRow {
  id: string;
  horseId: string;
  horseName: string;
  horseAvatar?: string;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  groomName?: string;
  joinedAt: string;
  joinedByName: string;
  withdrawnAt?: string;
  withdrawnByName?: string;
  withdrawReason?: EnrollmentCloseReason;
  withdrawNote?: string;
  /** Được tập ở mức cao nhất còn lại của lớp — tính lại mỗi lần đọc. */
  train: { allowed: boolean; reason?: string };
  canWithdraw: boolean;
}

export interface ResultCell {
  status: AttendanceStatus;
  absenceReason?: AbsenceReason;
  absenceNote?: string;
  score?: number;
}

export interface ClassResults {
  sessions: { id: string; date: string; subjectName: string; intensity: TrainingIntensity; status: SessionStatus }[];
  rows: {
    horseId: string;
    horseName: string;
    horseAvatar?: string;
    withdrawn: boolean;
    cells: Record<string, ResultCell | undefined>;
    presentCount: number;
    absentCount: number;
    attendanceRate?: number;
    avgScore?: number;
  }[];
}

export interface ClassDetail {
  id: string;
  name: string;
  status: ClassStatus;
  programId: string;
  programName: string;
  programDeleted: boolean;
  zoneId: string;
  zoneName: string;
  trainerName: string;
  slotId: string;
  slotLabel: string;
  startDate: string;
  endDate: string;
  totalWeeks: number;
  capacity: number;
  enrolled: number;
  createdByName: string;
  createdAt: string;
  /** Cường độ cao nhất của các buổi còn lại — điều kiện đăng ký. */
  maxIntensity?: TrainingIntensity;
  endedEarlyAt?: string;
  endedEarlyByName?: string;
  endNote?: string;
  cancelledAt?: string;
  cancelledByName?: string;
  cancelReason?: string;
  sessionsDone: number;
  sessionsTotal: number;
  sessionsCancelled: number;
  nextSession?: NextSessionRef;
  sessions: ClassSessionRow[];
  enrollments: { active: EnrollmentRow[]; withdrawn: EnrollmentRow[] };
  /** Không có = người dùng không được xem kết quả (GROOM). */
  results?: ClassResults;
  /** Bị lọc chỉ còn ngựa của chủ sở hữu. */
  ownerFiltered: boolean;
  /** GROOM và OWNER không xem giáo án (C, giao tiếp Flow 2). */
  canViewProgram: boolean;
  canManage: boolean;
  canEdit: boolean;
  canEnroll: boolean;
  canCancelSession: boolean;
  canAddSession: boolean;
  canEndEarly: boolean;
  canCancelClass: boolean;
}

export async function getClass(id: string): Promise<ClassDetail> {
  return query((db) => {
    const user = requirePermission('class.view');
    const cls = requireClass(db, id);
    if (!canSeeClass(db, user, cls)) throw new AppError(ERR_NOT_FOUND);
    const today = todayKey();
    const at = now();
    const status = classStatus(cls, today);
    const open = status === 'ACTIVE' || status === 'SCHEDULED';
    const program = programOf(db, cls.programId);
    const isOwner = capabilityScope(user.role, 'class.view') === 'owned';
    const horseVisible = (horseId: string) => !isOwner || findHorse(db, horseId)?.ownerId === user.id;
    const manage = inZoneScope(db, user, 'class.manage', cls.zoneId);
    const enrollManage = inZoneScope(db, user, 'enrollment.manage', cls.zoneId);
    const sessionManage = inZoneScope(db, user, 'session.manage', cls.zoneId);
    const running = !!hasRunningSession(db, cls.id);
    const maxInt = open ? maxIntensityOfClass(db, cls.id, today > cls.startDate ? today : cls.startDate) : undefined;

    const sessions = classSessions(db, cls.id).sort(bySessionTime(db));
    const sessionRows: ClassSessionRow[] = sessions.map((session) => {
      const counts = attendanceCounts(db, session.id);
      return {
        id: session.id,
        date: session.date,
        slotId: session.slotId,
        slotLabel: slotLabel(db, session.slotId),
        subjectId: session.subjectId,
        subjectName: session.subjectName,
        workoutType: session.workoutType,
        distanceM: session.distanceM,
        repetitions: session.repetitions,
        intensity: session.intensity,
        surface: session.surface,
        phaseNo: session.phaseNo,
        phaseName: session.phaseName,
        weekNo: session.weekNo,
        status: session.status,
        derivedLabel: sessionDerivedLabel(db, session, at),
        horseCount: sessionRoster(db, session).length,
        presentCount: counts.present,
        absentCount: counts.absent,
        isExtra: session.isExtra,
        note: session.note,
        cancelReason: session.cancelReason,
        cancelKind: session.cancelKind,
        canCancel: sessionManage && open && session.status === 'SCHEDULED',
      };
    });

    const trainIntensity = maxInt ?? 'LIGHT';
    const toRow = (item: ClassEnrollment): EnrollmentRow => {
      const horse = findHorse(db, item.horseId);
      const train = horse ? canTrain(db, horse, trainIntensity) : { allowed: false, reason: 'Không tìm thấy ngựa' };
      return {
        id: item.id,
        horseId: item.horseId,
        horseName: horse?.name ?? '—',
        horseAvatar: horse?.avatar,
        healthStatus: horse?.healthStatus ?? 'ELIGIBLE',
        lifecycleStatus: horse?.lifecycleStatus ?? 'ACTIVE',
        groomName: horse?.groomId ? userName(db, horse.groomId) : undefined,
        joinedAt: item.joinedAt,
        joinedByName: userName(db, item.joinedBy),
        withdrawnAt: item.withdrawnAt,
        withdrawnByName: item.withdrawnBy ? userName(db, item.withdrawnBy) : undefined,
        withdrawReason: item.withdrawReason,
        withdrawNote: item.withdrawNote,
        train: { allowed: train.allowed, reason: train.reason },
        canWithdraw: enrollManage && open && !item.withdrawnAt,
      };
    };
    const enrollments = db.enrollments.filter((item) => item.classId === cls.id && horseVisible(item.horseId));
    const active = enrollments
      .filter((item) => !item.withdrawnAt)
      .map(toRow)
      .sort((a, b) => a.horseName.localeCompare(b.horseName, 'vi'));
    const withdrawn = enrollments
      .filter((item) => item.withdrawnAt)
      .map(toRow)
      .sort((a, b) => (b.withdrawnAt ?? '').localeCompare(a.withdrawnAt ?? ''));

    // Kết quả: ma trận ngựa × buổi đã qua. GROOM không xem kết quả buổi tập (F2.9, B hiển thị F1.3).
    let results: ClassResults | undefined;
    if (user.role !== 'GROOM') {
      const past = sessions.filter((session) => session.status === 'COMPLETED' || session.status === 'AWAITING_REVIEW');
      const horseIds = [...new Set(enrollments.map((item) => item.horseId))];
      results = {
        sessions: past.map((session) => ({
          id: session.id,
          date: session.date,
          subjectName: session.subjectName,
          intensity: session.intensity,
          status: session.status,
        })),
        rows: horseIds
          .map((horseId) => {
            const horse = findHorse(db, horseId);
            const cells: Record<string, ResultCell | undefined> = {};
            let presentCount = 0;
            let absentCount = 0;
            const scores: number[] = [];
            past.forEach((session) => {
              const row = attendanceOf(db, session.id, horseId);
              if (!row) return;
              cells[session.id] = {
                status: row.status,
                absenceReason: row.absenceReason,
                absenceNote: row.absenceNote,
                score: row.evaluation?.score,
              };
              if (row.status === 'PRESENT') presentCount += 1;
              if (row.status === 'ABSENT') absentCount += 1;
              if (row.evaluation) scores.push(row.evaluation.score);
            });
            const attended = presentCount + absentCount;
            return {
              horseId,
              horseName: horse?.name ?? '—',
              horseAvatar: horse?.avatar,
              withdrawn: !enrollments.some((item) => item.horseId === horseId && !item.withdrawnAt),
              cells,
              presentCount,
              absentCount,
              attendanceRate: attended > 0 ? presentCount / attended : undefined,
              avgScore: scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : undefined,
            };
          })
          .sort((a, b) => Number(a.withdrawn) - Number(b.withdrawn) || a.horseName.localeCompare(b.horseName, 'vi')),
      };
    }

    const row = classRow(db, user, cls, today);
    return {
      id: cls.id,
      name: cls.name,
      status,
      programId: cls.programId,
      programName: program?.name ?? '—',
      programDeleted: !!program?.deletedAt,
      zoneId: cls.zoneId,
      zoneName: zoneName(db, cls.zoneId),
      trainerName: row.trainerName,
      slotId: cls.slotId,
      slotLabel: row.slotLabel,
      startDate: cls.startDate,
      endDate: cls.endDate,
      totalWeeks: Math.round((daysBetween(cls.startDate, cls.endDate) + 1) / 7),
      capacity: cls.capacity,
      enrolled: openEnrollments(db, cls.id).length,
      createdByName: userName(db, cls.createdBy),
      createdAt: cls.createdAt,
      maxIntensity: maxInt,
      endedEarlyAt: cls.endedEarlyAt,
      endedEarlyByName: cls.endedEarlyBy ? userName(db, cls.endedEarlyBy) : undefined,
      endNote: cls.endNote,
      cancelledAt: cls.cancelledAt,
      cancelledByName: cls.cancelledBy ? userName(db, cls.cancelledBy) : undefined,
      cancelReason: cls.cancelReason,
      sessionsDone: row.sessionsDone,
      sessionsTotal: row.sessionsTotal,
      sessionsCancelled: sessions.filter((session) => session.status === 'CANCELLED').length,
      nextSession: row.nextSession,
      sessions: sessionRows,
      enrollments: { active, withdrawn },
      results,
      ownerFiltered: isOwner,
      canViewProgram: can(user, 'program.view'),
      canManage: manage,
      canEdit: manage && open,
      canEnroll: enrollManage && open,
      canCancelSession: sessionManage && open,
      canAddSession: sessionManage && open,
      canEndEarly: manage && status === 'ACTIVE' && !running,
      canCancelClass: manage && open && !running,
    };
  });
}

export interface ClassInput {
  name: string;
  programId: string;
  zoneId: string;
  slotId: string;
  startDate: string;
  capacity?: number;
}

function validateCapacity(value: unknown): number {
  const capacity = Number(value);
  if (!Number.isInteger(capacity) || capacity < CLASS_LIMITS.minCapacity || capacity > CLASS_LIMITS.maxCapacity) {
    throw new AppError(`Sĩ số tối đa phải là số nguyên từ ${CLASS_LIMITS.minCapacity} đến ${CLASS_LIMITS.maxCapacity}`, 'capacity');
  }
  return capacity;
}

/** Mở lớp và sinh TOÀN BỘ buổi học từ giáo án (C.3.8) — không sinh buổi riêng cho từng ngựa. */
export async function createClass(input: ClassInput): Promise<string> {
  return commit((db) => {
    const actor = requirePermission('class.manage');
    const at = now();
    const today = toDateKey(at);

    const name = requireText(input.name, 'Tên lớp không được để trống', 'name');
    if (name.length > 60) throw new AppError('Tên lớp tối đa 60 ký tự', 'name');
    if (db.classes.some((cls) => sameName(cls.name, name))) throw new AppError(`Đã có lớp tên "${name}"`, 'name');

    const program = db.programs.find((item) => item.id === input.programId && !item.deletedAt);
    if (!program) throw new AppError('Hãy chọn giáo án', 'programId');
    const live = liveSubjects(db).map(toSubjectOption);
    const issues = validateProgramDraft(program, live);
    if (issues.length > 0) {
      throw new AppError(`Giáo án "${program.name}" chưa hợp lệ: ${issues[0].message}. Hãy sửa giáo án trước.`, 'programId');
    }

    const zone = db.zones.find((item) => item.id === input.zoneId && !item.deletedAt);
    if (!zone) throw new AppError('Hãy chọn khu chuồng', 'zoneId');
    if (!inZoneScope(db, actor, 'class.manage', zone.id)) {
      throw new AppError(`Bạn không phụ trách ${zone.name} — chỉ mở lớp ở khu mình phụ trách`, 'zoneId');
    }
    if (zone.status !== 'ACTIVE') throw new AppError(`${zone.name} đang không hoạt động, không mở lớp mới`, 'zoneId');

    const slot = slotOf(db, input.slotId);
    if (!slot) throw new AppError('Hãy chọn khung giờ', 'slotId');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? '')) throw new AppError('Hãy chọn ngày bắt đầu', 'startDate');
    if (input.startDate < today) throw new AppError('Ngày bắt đầu không được ở quá khứ', 'startDate');

    const capacity = validateCapacity(input.capacity ?? CLASS_LIMITS.defaultCapacity);
    const preview = planForProgram(db, program, input.startDate);
    if (preview.sessions.length === 0) throw new AppError('Giáo án không sinh ra buổi học nào', 'programId');
    const first = preview.sessions[0];
    if (first.date === today && sessionStartAt(db, { date: first.date, slotId: slot.id }) <= at) {
      throw new AppError(
        `Buổi đầu tiên rơi vào hôm nay lúc ${slot.startTime} nhưng khung giờ này đã qua — chọn ngày bắt đầu khác hoặc khung giờ muộn hơn`,
        'startDate',
      );
    }

    const cls: TrainingClass = {
      id: newId('cls'),
      name,
      programId: program.id,
      zoneId: zone.id,
      slotId: slot.id,
      startDate: input.startDate,
      endDate: preview.endDate,
      capacity,
      createdBy: actor.id,
      ...stamp(at),
    };
    db.classes.push(cls);
    preview.sessions.forEach((item) => {
      db.sessions.push({
        id: newId('ses'),
        classId: cls.id,
        date: item.date,
        slotId: slot.id,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        workoutType: item.workoutType,
        distanceM: item.distanceM,
        repetitions: item.repetitions,
        intensity: item.intensity,
        surface: item.surface,
        phaseNo: item.phaseNo,
        phaseName: item.phaseName,
        weekNo: item.weekNo,
        isExtra: false,
        status: 'SCHEDULED',
        ...stamp(at),
      });
    });
    writeAudit(db, at, {
      action: 'Mở lớp',
      entityType: 'TrainingClass',
      entityId: cls.id,
      after: {
        name,
        program: program.name,
        zone: zone.name,
        slot: `${slot.startTime}–${slot.endTime}`,
        startDate: cls.startDate,
        endDate: cls.endDate,
        capacity,
        sessions: preview.sessions.length,
      },
      actor,
    });
    return cls.id;
  });
}

function requireManagedClass(db: Database, actor: User, classId: string, key: string): TrainingClass {
  const cls = requireClass(db, classId);
  if (!inZoneScope(db, actor, key, cls.zoneId)) throw new AppError(ERR_FORBIDDEN);
  return cls;
}

export async function updateClass(id: string, input: { name?: string; capacity?: number }): Promise<string> {
  return commit((db) => {
    const actor = requirePermission('class.manage');
    const at = now();
    const cls = requireManagedClass(db, actor, id, 'class.manage');
    const status = classStatus(cls, toDateKey(at));
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      throw new AppError('Lớp đã kết thúc hoặc đã hủy, không sửa được');
    }
    const before = { name: cls.name, capacity: cls.capacity };
    let name = cls.name;
    if (input.name !== undefined) {
      name = requireText(input.name, 'Tên lớp không được để trống', 'name');
      if (db.classes.some((item) => item.id !== id && sameName(item.name, name))) throw new AppError(`Đã có lớp tên "${name}"`, 'name');
    }
    let capacity = cls.capacity;
    if (input.capacity !== undefined) {
      capacity = validateCapacity(input.capacity);
      const enrolled = openEnrollments(db, id).length;
      if (capacity < enrolled) {
        throw new AppError(`Lớp đang có ${enrolled} ngựa — sĩ số tối đa không được nhỏ hơn ${enrolled}`, 'capacity');
      }
    }
    cls.name = name;
    cls.capacity = capacity;
    touch(cls, at);
    writeAudit(db, at, { action: 'Sửa lớp', entityType: 'TrainingClass', entityId: id, before, after: { name, capacity }, actor });
    return id;
  });
}

/** Người nhận thông báo khi lớp đổi trạng thái: Groom và chủ của các ngựa đang học. */
function classAudience(db: Database, classId: string): (string | undefined)[] {
  return openEnrollments(db, classId).flatMap((item) => ownerAndGroom(findHorse(db, item.horseId)));
}

function cancelSessionsOfClass(
  db: Database,
  cls: TrainingClass,
  at: Date,
  actorId: string,
  kind: SessionCancelKind,
  reason: string,
  fromDate?: string,
): number {
  let count = 0;
  db.sessions.forEach((session) => {
    if (session.classId !== cls.id || session.status !== 'SCHEDULED') return;
    if (fromDate && session.date < fromDate) return;
    session.status = 'CANCELLED';
    session.cancelledAt = at.toISOString();
    session.cancelledBy = actorId;
    session.cancelReason = reason;
    session.cancelKind = kind;
    touch(session, at);
    count += 1;
  });
  return count;
}

/** Kết thúc sớm: các buổi chưa diễn ra bị hủy; lịch sử các buổi đã học và đăng ký giữ nguyên. */
export async function endClassEarly(id: string, note: string): Promise<{ cancelledSessions: number }> {
  return commit((db) => {
    const actor = requirePermission('class.manage');
    const at = now();
    const today = toDateKey(at);
    const cls = requireManagedClass(db, actor, id, 'class.manage');
    const text = requireText(note, 'Hãy nhập lý do kết thúc sớm', 'note');
    if (classStatus(cls, today) !== 'ACTIVE') throw new AppError('Chỉ kết thúc sớm được lớp đang chạy');
    const running = hasRunningSession(db, id);
    if (running) {
      throw new AppError(`Lớp đang có buổi diễn ra (${formatDate(running.date)} · ${slotLabel(db, running.slotId)}) — đợi buổi kết thúc rồi thao tác`);
    }
    const audience = classAudience(db, id);
    const cancelled = cancelSessionsOfClass(db, cls, at, actor.id, 'CLASS_ENDED_EARLY', text, today);
    cls.endedEarlyAt = at.toISOString();
    cls.endedEarlyBy = actor.id;
    cls.endNote = text;
    touch(cls, at);
    notifyMany(db, at, audience, {
      level: 'NORMAL',
      title: `Lớp ${cls.name} kết thúc sớm`,
      body: `${text}. ${cancelled} buổi chưa diễn ra đã bị hủy; kết quả các buổi đã học giữ nguyên.`,
      link: links.class(cls.id),
    });
    writeAudit(db, at, {
      action: 'Kết thúc sớm lớp',
      entityType: 'TrainingClass',
      entityId: id,
      before: { status: 'ACTIVE' },
      after: { status: 'COMPLETED', cancelledSessions: cancelled },
      reason: text,
      actor,
    });
    return { cancelledSessions: cancelled };
  });
}

export async function cancelClass(id: string, reason: string): Promise<{ cancelledSessions: number }> {
  return commit((db) => {
    const actor = requirePermission('class.manage');
    const at = now();
    const cls = requireManagedClass(db, actor, id, 'class.manage');
    const text = requireText(reason, 'Hãy nhập lý do hủy lớp', 'reason');
    const status = classStatus(cls, toDateKey(at));
    if (status !== 'SCHEDULED' && status !== 'ACTIVE') throw new AppError('Lớp đã kết thúc hoặc đã hủy');
    const running = hasRunningSession(db, id);
    if (running) {
      throw new AppError(`Lớp đang có buổi diễn ra (${formatDate(running.date)} · ${slotLabel(db, running.slotId)}) — đợi buổi kết thúc rồi hủy lớp`);
    }
    const audience = classAudience(db, id);
    const cancelled = cancelSessionsOfClass(db, cls, at, actor.id, 'CLASS_CANCELLED', text);
    cls.cancelledAt = at.toISOString();
    cls.cancelledBy = actor.id;
    cls.cancelReason = text;
    touch(cls, at);
    notifyMany(db, at, audience, {
      level: 'NORMAL',
      title: `Lớp ${cls.name} đã bị hủy`,
      body: `${text}. ${cancelled} buổi chưa diễn ra đã bị hủy.`,
      link: links.class(cls.id),
    });
    writeAudit(db, at, {
      action: 'Hủy lớp',
      entityType: 'TrainingClass',
      entityId: id,
      before: { status },
      after: { status: 'CANCELLED', cancelledSessions: cancelled },
      reason: text,
      actor,
    });
    return { cancelledSessions: cancelled };
  });
}

/* ============================================================
 * F2.5 — Đăng ký và rút ngựa
 * ============================================================ */

export interface EnrollCandidate {
  horseId: string;
  horseName: string;
  horseAvatar?: string;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  groomName?: string;
  stallCode?: string;
  /** Lớp khác đang học (chưa kết thúc). */
  otherClasses: string[];
  allowed: boolean;
  reasons: string[];
  warnings: string[];
}

export interface EnrollCandidates {
  classId: string;
  className: string;
  /** Ngựa vào lớp sẽ nhận các buổi từ ngày này. */
  fromDate: string;
  maxIntensity?: TrainingIntensity;
  enrolled: number;
  capacity: number;
  full: boolean;
  candidates: EnrollCandidate[];
}

function enrollFromDate(cls: TrainingClass, today: string): string {
  return today > cls.startDate ? today : cls.startDate;
}

/** Kiểm đủ điều kiện đăng ký một ngựa vào lớp (C.3.11, C.3.16). Không ghi gì. */
function evaluateCandidate(db: Database, cls: TrainingClass, horse: Horse, today: string) {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const fromDate = enrollFromDate(cls, today);
  const maxInt = maxIntensityOfClass(db, cls.id, fromDate);

  if (horse.deletedAt) reasons.push('Hồ sơ ngựa đã bị xóa');
  else if (horse.lifecycleStatus === 'RETIRED') reasons.push('Ngựa đã giải nghệ, không học lớp');
  else if (horse.lifecycleStatus === 'TRANSFERRED') reasons.push('Ngựa đã chuyển nhượng, không còn ở câu lạc bộ');
  else if (maxInt) {
    const train = canTrain(db, horse, maxInt);
    if (!train.allowed) {
      reasons.push(
        train.code === 'HEALTH' && horse.healthStatus === 'UNDER_OBSERVATION'
          ? `${train.reason}. Lớp có buổi ${intensityLabel[maxInt]} từ ${formatDate(fromDate)}`
          : train.reason ?? 'Ngựa không được tập',
      );
    }
  }
  if (horse.zoneId !== cls.zoneId) reasons.push(`Ngựa không thuộc ${zoneName(db, cls.zoneId)} — lớp chỉ nhận ngựa của khu này`);
  if (openEnrollments(db, cls.id).some((item) => item.horseId === horse.id)) reasons.push('Ngựa đang học lớp này');
  const enrolled = openEnrollments(db, cls.id).length;
  if (enrolled >= cls.capacity) reasons.push(`Lớp đã đủ sĩ số (${enrolled}/${cls.capacity})`);

  const candidates: DayItem[] = classSessions(db, cls.id)
    .filter((session) => session.status === 'SCHEDULED' && session.date >= fromDate)
    .map((session) => ({ date: session.date, slotId: session.slotId, intensity: session.intensity, label: `lớp ${cls.name}` }));
  if (candidates.length === 0) reasons.push('Lớp không còn buổi học nào sắp tới');
  else {
    const conflicts = scheduleConflicts(db, horse.id, candidates, cls.id);
    conflicts.hard.slice(0, 3).forEach((item) => reasons.push(`Giới hạn trong ngày: ${item.reason}`));
    if (conflicts.hard.length > 3) reasons.push(`và ${conflicts.hard.length - 3} ngày khác vượt giới hạn trong ngày`);
    conflicts.warnings.forEach((item) => warnings.push(`${item} (cảnh báo, không chặn)`));
  }
  if (!horse.groomId && reasons.length === 0) warnings.push('Ngựa chưa có Groom phụ trách — buổi học sẽ chưa có người dắt');
  return { allowed: reasons.length === 0, reasons, warnings, fromDate, maxInt };
}

export async function listEnrollCandidates(classId: string): Promise<EnrollCandidates> {
  return query((db) => {
    const actor = requirePermission('enrollment.manage');
    const cls = requireManagedClass(db, actor, classId, 'enrollment.manage');
    const today = todayKey();
    const fromDate = enrollFromDate(cls, today);
    const enrolled = openEnrollments(db, cls.id).length;
    const candidates = db.horses
      .filter((horse) => horse.zoneId === cls.zoneId && !horse.deletedAt && horse.lifecycleStatus !== 'TRANSFERRED')
      .map((horse) => {
        const check = evaluateCandidate(db, cls, horse, today);
        const otherClasses = db.enrollments
          .filter((item) => item.horseId === horse.id && !item.withdrawnAt && item.classId !== cls.id)
          .map((item) => classOf(db, item.classId))
          .filter((item): item is TrainingClass => !!item && ['ACTIVE', 'SCHEDULED'].includes(classStatus(item, today)))
          .map((item) => item.name);
        return {
          horseId: horse.id,
          horseName: horse.name,
          horseAvatar: horse.avatar,
          healthStatus: horse.healthStatus,
          lifecycleStatus: horse.lifecycleStatus,
          groomName: horse.groomId ? userName(db, horse.groomId) : undefined,
          stallCode: db.stalls.find((stall) => stall.id === horse.stallId)?.code,
          otherClasses,
          allowed: check.allowed,
          reasons: check.reasons,
          warnings: check.warnings,
        };
      })
      .sort((a, b) => Number(b.allowed) - Number(a.allowed) || a.horseName.localeCompare(b.horseName, 'vi'));
    return {
      classId: cls.id,
      className: cls.name,
      fromDate,
      maxIntensity: maxIntensityOfClass(db, cls.id, fromDate),
      enrolled,
      capacity: cls.capacity,
      full: enrolled >= cls.capacity,
      candidates,
    };
  });
}

export async function enrollHorse(classId: string, horseId: string): Promise<string> {
  return commit((db) => {
    const actor = requirePermission('enrollment.manage');
    const at = now();
    const today = toDateKey(at);
    const cls = requireManagedClass(db, actor, classId, 'enrollment.manage');
    const status = classStatus(cls, today);
    if (status !== 'SCHEDULED' && status !== 'ACTIVE') throw new AppError('Lớp đã kết thúc hoặc đã hủy, không nhận thêm ngựa');
    const horse = findHorse(db, horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    const check = evaluateCandidate(db, cls, horse, today);
    if (!check.allowed) throw new AppError(`Không đăng ký được ${horse.name}: ${check.reasons.join('; ')}`);

    const enrollment: ClassEnrollment = {
      id: newId('enr'),
      classId: cls.id,
      horseId: horse.id,
      joinedAt: at.toISOString(),
      joinedBy: actor.id,
      ...stamp(at),
    };
    db.enrollments.push(enrollment);
    notifyMany(db, at, ownerAndGroom(horse), {
      level: 'NORMAL',
      title: `${horse.name} được đăng ký vào lớp ${cls.name}`,
      body: `Học từ ${formatDate(check.fromDate)} tới ${formatDate(cls.endDate)}, khung giờ ${slotLabel(db, cls.slotId)} — ${zoneName(db, cls.zoneId)}.`,
      link: links.class(cls.id),
    });
    writeAudit(db, at, {
      action: 'Đăng ký ngựa vào lớp',
      entityType: 'ClassEnrollment',
      entityId: enrollment.id,
      horseId: horse.id,
      after: { class: cls.name, fromDate: check.fromDate, warnings: check.warnings },
      actor,
    });
    return enrollment.id;
  });
}

/** Rút ngựa khỏi lớp: chỉ đóng đăng ký, không hủy buổi nào (A.5.3). */
export async function withdrawHorse(enrollmentId: string, note: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('enrollment.manage');
    const at = now();
    const enrollment = db.enrollments.find((item) => item.id === enrollmentId);
    if (!enrollment) throw new AppError(ERR_NOT_FOUND);
    const cls = requireManagedClass(db, actor, enrollment.classId, 'enrollment.manage');
    const text = requireText(note, 'Hãy nhập lý do rút ngựa khỏi lớp', 'note');
    if (enrollment.withdrawnAt) throw new AppError('Ngựa đã được rút khỏi lớp này trước đó');
    const status = classStatus(cls, toDateKey(at));
    if (status !== 'SCHEDULED' && status !== 'ACTIVE') throw new AppError('Lớp đã kết thúc hoặc đã hủy');
    const horse = findHorse(db, enrollment.horseId);
    const running = db.sessions.find(
      (session) =>
        session.classId === cls.id &&
        session.status === 'IN_PROGRESS' &&
        db.attendances.some((row) => row.sessionId === session.id && row.horseId === enrollment.horseId),
    );
    if (running) {
      throw new AppError(
        `${horse?.name ?? 'Ngựa'} đang ở buổi học đang diễn ra (${slotLabel(db, running.slotId)}) — đợi buổi kết thúc rồi rút khỏi lớp`,
      );
    }

    enrollment.withdrawnAt = at.toISOString();
    enrollment.withdrawnBy = actor.id;
    enrollment.withdrawReason = 'MANUAL';
    enrollment.withdrawNote = text;
    touch(enrollment, at);
    // Dòng tham gia tạo trước giờ (buổi chưa bắt đầu) của đăng ký này không còn ý nghĩa.
    const scheduled = new Set(
      db.sessions.filter((session) => session.classId === cls.id && session.status === 'SCHEDULED').map((session) => session.id),
    );
    const removed = db.attendances.filter((row) => row.enrollmentId === enrollment.id && scheduled.has(row.sessionId)).length;
    db.attendances = db.attendances.filter((row) => !(row.enrollmentId === enrollment.id && scheduled.has(row.sessionId)));

    notifyMany(db, at, ownerAndGroom(horse), {
      level: 'NORMAL',
      title: `${horse?.name ?? 'Ngựa'} được rút khỏi lớp ${cls.name}`,
      body: `${text}. Các buổi chưa diễn ra của lớp không còn trong lịch của ngựa; kết quả đã học giữ nguyên.`,
      link: links.class(cls.id),
    });
    writeAudit(db, at, {
      action: 'Rút ngựa khỏi lớp',
      entityType: 'ClassEnrollment',
      entityId: enrollment.id,
      horseId: enrollment.horseId,
      before: { withdrawnAt: null },
      after: { withdrawnAt: enrollment.withdrawnAt, withdrawReason: 'MANUAL', removedPendingAttendance: removed },
      reason: text,
      actor,
    });
  });
}

/* ============================================================
 * F2.6 — Thêm buổi, hủy buổi
 * ============================================================ */

export interface ExtraSessionInput {
  date: string;
  slotId: string;
  subjectId: string;
  note?: string;
}

export async function addExtraSession(classId: string, input: ExtraSessionInput): Promise<string> {
  return commit((db) => {
    const actor = requirePermission('session.manage');
    const at = now();
    const today = toDateKey(at);
    const cls = requireManagedClass(db, actor, classId, 'session.manage');
    const status = classStatus(cls, today);
    if (status !== 'SCHEDULED' && status !== 'ACTIVE') throw new AppError('Lớp đã kết thúc hoặc đã hủy, không thêm buổi được');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) throw new AppError('Hãy chọn ngày', 'date');
    const minDate = today > cls.startDate ? today : cls.startDate;
    if (input.date < minDate) throw new AppError(`Ngày phải từ ${formatDate(minDate)} trở đi`, 'date');
    if (input.date > cls.endDate) throw new AppError(`Ngày phải trong thời gian lớp (tới ${formatDate(cls.endDate)})`, 'date');
    const slot = slotOf(db, input.slotId);
    if (!slot) throw new AppError('Hãy chọn khung giờ', 'slotId');
    if (input.date === today && sessionStartAt(db, { date: input.date, slotId: slot.id }) <= at) {
      throw new AppError(`Khung giờ ${slot.startTime} hôm nay đã qua`, 'slotId');
    }
    const subject = db.subjects.find((item) => item.id === input.subjectId && !item.deletedAt);
    if (!subject) throw new AppError('Hãy chọn môn học', 'subjectId');
    const clash = db.sessions.find(
      (session) =>
        session.classId === cls.id && session.date === input.date && session.slotId === slot.id && session.status !== 'CANCELLED',
    );
    if (clash) {
      throw new AppError(`Lớp đã có buổi "${clash.subjectName}" vào ${formatDate(input.date)} lúc ${slot.startTime}`, 'slotId');
    }

    // Mọi ngựa có trong danh sách của buổi đó phải qua giới hạn trong ngày (qua mọi lớp, kể cả lớp này).
    const roster = openEnrollments(db, cls.id).filter((item) => toDateKey(item.joinedAt) <= input.date);
    const candidate: DayItem = { date: input.date, slotId: slot.id, intensity: subject.intensity, label: `buổi thêm của lớp ${cls.name}` };
    const violations: string[] = [];
    roster.forEach((item) => {
      const conflicts = scheduleConflicts(db, item.horseId, [candidate]);
      if (conflicts.hard.length > 0) {
        violations.push(`${findHorse(db, item.horseId)?.name ?? 'Ngựa'}: ${conflicts.hard[0].reason}`);
      }
    });
    if (violations.length > 0) {
      throw new AppError(`Không thêm được buổi vì vượt giới hạn trong ngày của ngựa — ${violations.join('; ')}`, 'date');
    }

    const weekNo = Math.floor(daysBetween(cls.startDate, input.date) / 7) + 1;
    const sameWeek = db.sessions.find((session) => session.classId === cls.id && session.weekNo === weekNo && !session.isExtra);
    const session: ClassSession = {
      id: newId('ses'),
      classId: cls.id,
      date: input.date,
      slotId: slot.id,
      subjectId: subject.id,
      subjectName: subject.name,
      workoutType: subject.workoutType,
      distanceM: subject.distanceM,
      repetitions: subject.repetitions,
      intensity: subject.intensity,
      surface: subject.surface,
      phaseNo: sameWeek?.phaseNo,
      phaseName: sameWeek?.phaseName,
      weekNo,
      isExtra: true,
      note: input.note?.trim() || undefined,
      status: 'SCHEDULED',
      ...stamp(at),
    };
    db.sessions.push(session);

    const grooms = roster.map((item) => findHorse(db, item.horseId)?.groomId);
    notifyMany(db, at, grooms, {
      level: 'NORMAL',
      title: `Buổi thêm: lớp ${cls.name}`,
      body: `${subject.name} (${intensityLabel[subject.intensity]}) ngày ${formatDate(input.date)} lúc ${slot.startTime}.${session.note ? ` ${session.note}` : ''}`,
      link: links.session(session.id),
    });
    writeAudit(db, at, {
      action: 'Thêm buổi học',
      entityType: 'ClassSession',
      entityId: session.id,
      after: { class: cls.name, date: input.date, slot: slot.startTime, subject: subject.name, note: session.note },
      actor,
    });
    return session.id;
  });
}

/** Hủy một buổi cho CẢ LỚP — chỉ buổi chưa bắt đầu, bắt buộc lý do (C.3.14). */
export async function cancelSession(sessionId: string, reason: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('session.manage');
    const at = now();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    const cls = requireManagedClass(db, actor, session.classId, 'session.manage');
    const text = requireText(reason, 'Hãy nhập lý do hủy buổi', 'reason');
    if (session.status !== 'SCHEDULED') throw new AppError('Chỉ hủy được buổi chưa bắt đầu');
    const grooms = sessionRoster(db, session).map((entry) => effectiveGroomId(db, session, entry.horseId));
    session.status = 'CANCELLED';
    session.cancelledAt = at.toISOString();
    session.cancelledBy = actor.id;
    session.cancelReason = text;
    session.cancelKind = 'MANUAL';
    touch(session, at);
    notifyMany(db, at, grooms, {
      level: 'NORMAL',
      title: `Hủy buổi: lớp ${cls.name}`,
      body: `Buổi ${session.subjectName} ngày ${formatDate(session.date)} lúc ${slotOf(db, session.slotId)?.startTime ?? ''} đã hủy cho cả lớp. Lý do: ${text}`,
      link: links.class(cls.id, 'sessions'),
    });
    writeAudit(db, at, {
      action: 'Hủy buổi học',
      entityType: 'ClassSession',
      entityId: session.id,
      before: { status: 'SCHEDULED' },
      after: { status: 'CANCELLED', class: cls.name, date: session.date },
      reason: text,
      actor,
    });
  });
}

/* ============================================================
 * Lịch tập tuần
 * ============================================================ */

export interface ScheduleEntry {
  sessionId: string;
  classId: string;
  className: string;
  zoneId: string;
  zoneName: string;
  date: string;
  slotId: string;
  slotLabel: string;
  subjectName: string;
  workoutType: WorkoutType;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  status: SessionStatus;
  derivedLabel?: string;
  horseCount: number;
  isExtra: boolean;
  cancelReason?: string;
  /** Chỉ có khi lọc theo một con ngựa: trạng thái tham gia của riêng con đó. */
  horseAttendance?: AttendanceStatus;
  horseAbsenceReason?: AbsenceReason;
}

export interface ScheduleResult {
  from: string;
  to: string;
  entries: ScheduleEntry[];
  horse?: { id: string; name: string };
  /** Người dùng chỉ thấy buổi trong phạm vi (GROOM/OWNER). */
  scoped: boolean;
}

export interface ScheduleFilter {
  from: string;
  to: string;
  zoneId?: string;
  classId?: string;
  horseId?: string;
}

export async function listSchedule(filter: ScheduleFilter): Promise<ScheduleResult> {
  return query((db) => {
    const user = requirePermission('class.view');
    const at = now();
    const scope = capabilityScope(user.role, 'class.view');
    const matches = (cls: TrainingClass) =>
      (!filter.zoneId || cls.zoneId === filter.zoneId) && (!filter.classId || cls.id === filter.classId);

    const toEntry = (session: ClassSession, cls: TrainingClass): ScheduleEntry => ({
      sessionId: session.id,
      classId: cls.id,
      className: cls.name,
      zoneId: cls.zoneId,
      zoneName: zoneName(db, cls.zoneId),
      date: session.date,
      slotId: session.slotId,
      slotLabel: slotLabel(db, session.slotId),
      subjectName: session.subjectName,
      workoutType: session.workoutType,
      intensity: session.intensity,
      surface: session.surface,
      status: session.status,
      derivedLabel: sessionDerivedLabel(db, session, at),
      horseCount: sessionRoster(db, session).length,
      isExtra: session.isExtra,
      cancelReason: session.cancelReason,
    });

    if (filter.horseId) {
      const horse = findHorse(db, filter.horseId);
      if (!horse || !horseInViewScope(user, horse)) throw new AppError(ERR_NOT_FOUND);
      const entries = horseSchedule(db, horse.id, filter.from, filter.to)
        .filter((entry) => matches(entry.cls))
        .map((entry) => ({
          ...toEntry(entry.session, entry.cls),
          horseAttendance: entry.attendance?.status ?? (entry.session.status === 'SCHEDULED' ? 'EXPECTED' : undefined),
          horseAbsenceReason: entry.attendance?.absenceReason,
        }));
      return { from: filter.from, to: filter.to, entries, horse: { id: horse.id, name: horse.name }, scoped: scope !== 'all' };
    }

    const entries = db.sessions
      .filter((session) => session.date >= filter.from && session.date <= filter.to)
      .map((session) => ({ session, cls: classOf(db, session.classId) }))
      .filter((item): item is { session: ClassSession; cls: TrainingClass } => !!item.cls && matches(item.cls))
      .filter((item) => canSeeSession(db, user, item.session))
      .sort((a, b) => bySessionTime(db)(a.session, b.session))
      .map((item) => toEntry(item.session, item.cls));
    return { from: filter.from, to: filter.to, entries, scoped: scope !== 'all' };
  });
}

export interface ScheduleFilters {
  zones: { id: string; name: string }[];
  classes: { id: string; name: string; zoneId: string; status: ClassStatus }[];
  horses: { id: string; name: string }[];
  scoped: boolean;
}

/** Khu, lớp, ngựa trong phạm vi người dùng — dùng cho thanh lọc của lịch tập. */
export async function listScheduleFilters(): Promise<ScheduleFilters> {
  return query((db) => {
    const user = requirePermission('class.view');
    const scope = capabilityScope(user.role, 'class.view');
    const today = todayKey();
    const horses = db.horses
      .filter((horse) => !horse.deletedAt && horseInViewScope(user, horse))
      .filter((horse) => db.enrollments.some((item) => item.horseId === horse.id))
      .map((horse) => ({ id: horse.id, name: horse.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const classes = db.classes
      .filter((cls) => canSeeClass(db, user, cls))
      .map((cls) => ({ id: cls.id, name: cls.name, zoneId: cls.zoneId, status: classStatus(cls, today) }))
      .sort((a, b) => CLASS_STATUS_ORDER[a.status] - CLASS_STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'vi'));
    const zoneIds = new Set(classes.map((cls) => cls.zoneId));
    return {
      zones: db.zones.filter((zone) => zoneIds.has(zone.id)).map((zone) => ({ id: zone.id, name: zone.name })),
      classes,
      horses,
      scoped: scope !== 'all',
    };
  });
}
