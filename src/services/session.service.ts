// Thực hiện buổi học (Flow 2 — mô hình lớp): buổi hôm nay, Groom cho buổi, việc của Groom (F2.6, F2.7),
// theo dõi realtime và cảnh báo (F2.8), đánh giá từng ngựa (F2.9), tiến độ (F2.10), nhịp tim tối đa (F2.11).
//
// Một buổi thuộc về một lớp và có nhiều ngựa; kết quả của mỗi ngựa là một dòng SessionAttendance.
// Luồng dữ liệu thiết bị được tính lại bằng bộ mô phỏng thuần (cùng hạt giống → cùng số liệu), nên mọi
// người mở lúc nào cũng thấy cùng một chuỗi mẫu; chỉ cảnh báo và chỉ số chốt được ghi vào kho.
import type {
  AbsenceReason,
  AlertAckAction,
  AlertLevel,
  AlertRule,
  AttendanceStatus,
  ClassSession,
  Database,
  Evaluation,
  GroomTaskKind,
  HealthStatus,
  LifecycleStatus,
  SessionAttendance,
  SessionEndReason,
  SessionStatus,
  SessionSummary,
  SimScenario,
  TrackSurface,
  TrainingAlert,
  TrainingIntensity,
  User,
  UserRole,
  WorkoutType,
} from '../types/domain';
import { AppError, ERR_FORBIDDEN, ERR_NOT_FOUND, getDb, mutate, newId, stamp, touch } from './db';
import { commit, notifyMany, pushNotification, query, requirePermission, requireUser, writeAudit } from './api';
import { can, canViewHorse, inActionScope, inSessionScope, visibleHorses } from '../auth/permissions';
import {
  activeEnrollments,
  activeLock,
  attendanceOf,
  classOf,
  classStatus,
  effectiveGroomId,
  findHorse,
  findUser,
  horseSchedule,
  maxHeartRateOf,
  programOf,
  runningSessions,
  sessionDerivedLabel,
  sessionEndAt,
  sessionRoster,
  sessionStartAt,
  slotLabel,
  slotOf,
  trainerOfZone,
  userName,
  vetIds,
  type RosterEntry,
} from './selectors';
import { createExamRequestInternal, ensureAttendance } from './ops';
import { canTrain, canTrainAtAll, fastThreshold } from '../lib/rules';
import { getSimSpeed, now } from '../lib/clock';
import {
  currentSecond,
  deriveSeed,
  phaseLabel,
  resolveScenario,
  simulate,
  type SimAlert,
  type SimConfig,
  type SimPhase,
  type SimResult,
} from '../lib/simulator';
import {
  absenceLabel,
  alertRuleLabel,
  enrollmentCloseLabel,
  groomTaskLabel,
  scenarioLabel,
  sessionCancelLabel,
  sessionEndLabel,
  workoutLabel,
} from '../lib/labels';
import { addDays, formatDate, toDateKey } from '../lib/format';
import { links } from '../lib/links';

/* ===================================================================== */
/* ===== Kiểu dữ liệu trả về cho màn hình ===== */
/* ===================================================================== */

export interface TaskView {
  kind: GroomTaskKind;
  label: string;
  done: boolean;
  at?: string;
  byName?: string;
  /** Người đang xem bấm được (đánh dấu hoặc bỏ đánh dấu). */
  canToggle: boolean;
  /** Vì sao chưa bấm được — hiện ở tooltip. */
  hint?: string;
}

export interface SessionHeader {
  id: string;
  classId: string;
  className: string;
  programName?: string;
  zoneId?: string;
  zoneName?: string;
  trainerId?: string;
  trainerName?: string;
  date: string;
  isToday: boolean;
  slotId: string;
  slotLabel: string;
  slotStart: string;
  slotEnd: string;
  subjectName: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  phaseName?: string;
  weekNo?: number;
  isExtra: boolean;
  note?: string;
  status: SessionStatus;
  /** "Quá giờ" / "Bỏ lỡ" — tính ra, không lưu. */
  derivedLabel?: string;
  startedAt?: string;
  startedByName?: string;
  endedAt?: string;
  endedByName?: string;
  endReason?: SessionEndReason;
  endLabel?: string;
  stopReason?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledByName?: string;
  cancelReason?: string;
  cancelKindLabel?: string;
  simScenario?: SimScenario;
  simScenarioLabel?: string;
  simSpeed?: number;
}

export interface SessionFlags {
  canStart: boolean;
  /** Có quyền nhưng chưa bấm được (không phải hôm nay…). */
  startBlockedReason?: string;
  /** Cảnh báo mềm khi bắt đầu ngoài khung giờ. */
  startWarning?: string;
  canFinish: boolean;
  canStop: boolean;
  canAck: boolean;
  canViewLive: boolean;
  canManage: boolean;
  canReview: boolean;
}

export interface StoppedInfo {
  atSecond: number;
  at?: string;
  byName: string;
  reason?: string;
}

export interface EvaluationView extends Evaluation {
  evaluatedByName: string;
}

export interface SessionHorseRow {
  horseId: string;
  horseName: string;
  avatar?: string;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  status: AttendanceStatus;
  absenceReason?: AbsenceReason;
  absenceLabel?: string;
  absenceNote?: string;
  markedByName?: string;
  markedAt?: string;
  groomId?: string;
  groomName?: string;
  groomOverridden: boolean;
  defaultGroomId?: string;
  defaultGroomName?: string;
  /** Được tập ở cường độ của buổi, tính tại thời điểm xem. */
  readiness: { allowed: boolean; reason?: string };
  tasks: TaskView[];
  /** Người xem là Groom đang dắt ngựa này. */
  mine: boolean;
  canDoTasks: boolean;
  canMarkAbsent: boolean;
  canClearAbsence: boolean;
  canChangeGroom: boolean;
  /** Buổi đã bắt đầu: ngưỡng đã chốt; chưa bắt đầu: ngưỡng hiện tại. */
  maxHeartRate?: number;
  r1Disabled: boolean;
  scenarioLabel?: string;
  stopped?: StoppedInfo;
  summary?: SessionSummary;
  evaluation?: EvaluationView;
  canScore: boolean;
  scoreEditableUntil?: string;
  redAlertCount: number;
}

export interface AlertView {
  id: string;
  horseId: string;
  horseName: string;
  rule: AlertRule;
  ruleLabel: string;
  level: AlertLevel;
  atSecond: number;
  at: string;
  value: number;
  text: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  ackAction?: AlertAckAction;
  examRequestId?: string;
}

export interface TodaySessionRow {
  header: SessionHeader;
  horses: SessionHorseRow[];
  totalHorses: number;
  /** Số ngựa của buổi mà người xem không thấy (Groom chỉ thấy ngựa mình dắt, chủ chỉ thấy ngựa mình). */
  hiddenCount: number;
  presentCount: number;
  absentCount: number;
  blockedCount: number;
  unackedRed: number;
  flags: SessionFlags;
}

export interface SessionDetail {
  header: SessionHeader;
  horses: SessionHorseRow[];
  totalHorses: number;
  hiddenCount: number;
  alerts: AlertView[];
  flags: SessionFlags;
  groomOptions: { id: string; name: string }[];
  plannedVolumeM: number;
  fastThreshold: number;
  /** GROOM không xem chỉ số và điểm (F1.3, F2.9). */
  canSeeResults: boolean;
  viewerRole: UserRole;
}

export interface StartSessionInput {
  scenario: SimScenario;
  targetHorseId?: string;
}

export interface StartSessionResult {
  sessionId: string;
  present: string[];
  absent: { horseName: string; reason: string; auto: boolean }[];
  targetHorseName?: string;
}

export interface MarkAbsentInput {
  note: string;
  requestExam?: { urgency: 'NORMAL' | 'URGENT' };
}

export interface GroomTaskRow {
  sessionId: string;
  className: string;
  date: string;
  slotLabel: string;
  slotStart: string;
  sessionStatus: SessionStatus;
  subjectName: string;
  workoutType: WorkoutType;
  intensity: TrainingIntensity;
  horseId: string;
  horseName: string;
  avatar?: string;
  attendanceStatus: AttendanceStatus;
  absenceReason?: AbsenceReason;
  tasks: TaskView[];
  doneCount: number;
}

export interface LiveSessionRow {
  id: string;
  className: string;
  zoneName?: string;
  slotLabel: string;
  subjectName: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  startedAt?: string;
  second: number;
  simSpeed: number;
  horses: { id: string; name: string; avatar?: string; stopped: boolean; hasRed: boolean }[];
  absentCount: number;
  unackedRed: number;
}

export interface LiveHorse {
  horseId: string;
  horseName: string;
  avatar?: string;
  groomName?: string;
  second: number;
  current?: { heartRate: number; speedMps: number; phase: SimPhase; phaseLabel: string; runIndex: number };
  signalLost: boolean;
  samples: { t: number; heartRate: number; speedMps: number }[];
  metrics: SimResult['metrics'];
  maxHeartRate?: number;
  r1Enabled: boolean;
  fastThreshold: number;
  overMax: boolean;
  finished: boolean;
  stopped?: StoppedInfo;
  scenarioLabel: string;
  alerts: AlertView[];
  unackedRed: number;
}

export interface LiveView {
  header: SessionHeader;
  status: SessionStatus;
  second: number;
  simSpeed: number;
  horses: LiveHorse[];
  absent: { horseId: string; horseName: string; reasonLabel: string; note?: string }[];
  unackedRed: AlertView[];
  alerts: AlertView[];
  flags: SessionFlags;
}

export interface ReviewRow {
  id: string;
  classId: string;
  className: string;
  zoneName?: string;
  date: string;
  slotLabel: string;
  subjectName: string;
  workoutType: WorkoutType;
  intensity: TrainingIntensity;
  endedAt?: string;
  endReason?: SessionEndReason;
  endLabel?: string;
  presentCount: number;
  scoredCount: number;
  absentCount: number;
  hoursSinceEnd: number;
  overdue: boolean;
  canReview: boolean;
}

export interface ScoreInput {
  score: number;
  notes: string;
  trialTimeSeconds?: number;
  trialNotCompleted?: boolean;
  videoSrc?: string;
  videoThumbnail?: string;
}

export interface ProgressRow {
  horseId: string;
  horseName: string;
  avatar?: string;
  zoneId?: string;
  zoneName?: string;
  healthStatus: HealthStatus;
  locked: boolean;
  classes: { id: string; name: string }[];
  attendance: { present: number; total: number; rate: number | null };
  avgScore14: number | null;
  scored14: number;
  alerts7: number;
  redAlerts7: number;
  lastTrial?: { date: string; seconds?: number; notCompleted?: boolean; distanceM: number };
  trainable: { allowed: boolean; reason?: string };
  maxHeartRate?: number;
  nextSession?: { date: string; slotLabel: string; className: string };
}

export interface ZoneProgress {
  zoneId: string;
  zoneName: string;
  trainerName?: string;
  horseCount: number;
  attendanceRate: number | null;
  avgScore: number | null;
  alerts7: number;
  blocked: number;
}

export interface ProgressBoard {
  rows: ProgressRow[];
  zones: ZoneProgress[];
}

export interface HorseTrainingView {
  horseId: string;
  horseName: string;
  lifecycleStatus: LifecycleStatus;
  trainable: { allowed: boolean; reason?: string };
  classes: {
    enrollmentId: string;
    classId: string;
    className: string;
    zoneName?: string;
    slotLabel: string;
    joinedAt: string;
    withdrawnAt?: string;
    withdrawLabel?: string;
    withdrawNote?: string;
    open: boolean;
    classStatusLabel: string;
  }[];
  upcoming: {
    sessionId: string;
    date: string;
    slotLabel: string;
    className: string;
    subjectName: string;
    workoutType: WorkoutType;
    distanceM: number;
    repetitions: number;
    intensity: TrainingIntensity;
    status: SessionStatus;
    attendanceStatus?: AttendanceStatus;
    absenceLabel?: string;
  }[];
  results: {
    sessionId: string;
    date: string;
    className: string;
    subjectName: string;
    workoutType: WorkoutType;
    distanceM: number;
    repetitions: number;
    intensity: TrainingIntensity;
    sessionStatus: SessionStatus;
    endLabel?: string;
    attendanceStatus: AttendanceStatus;
    absenceLabel?: string;
    absenceNote?: string;
    summary?: SessionSummary;
    evaluation?: EvaluationView;
    stoppedReason?: string;
  }[];
  kpi: {
    attendance28: { present: number; total: number; rate: number | null };
    avgScore14: number | null;
    alerts7: number;
    sessionsDone: number;
    lastTrial?: { date: string; seconds?: number; notCompleted?: boolean; distanceM: number };
  };
  scoreSeries: { date: string; value: number }[];
  trialSeries: { date: string; distanceM: number; value: number }[];
  cardiacSeries: { date: string; workoutType: WorkoutType; value: number }[];
  maxHeartRate: { current?: number; suggested: number; canView: boolean; canEdit: boolean };
}

export interface TimeTrialRow {
  sessionId: string;
  horseId: string;
  horseName: string;
  date: string;
  className: string;
  distanceM: number;
  surface: TrackSurface;
  seconds?: number;
  notCompleted?: boolean;
  videoSrc?: string;
  score?: number;
}

export interface MaxHeartRateView {
  horseId: string;
  horseName: string;
  current?: number;
  suggested: number;
  history: { id: string; value: number; reason: string; active: boolean; createdAt: string; createdByName: string }[];
  canEdit: boolean;
}

export interface MaxHeartRateRow {
  horseId: string;
  horseName: string;
  avatar?: string;
  zoneName?: string;
  lifecycleStatus: LifecycleStatus;
  healthStatus: HealthStatus;
  current?: number;
  setAt?: string;
  setByName?: string;
  reason?: string;
  upcoming7: number;
  /** Giá trị gợi ý trong form của VET (không dùng cho R1). */
  suggested: number;
  canEdit: boolean;
}

/* ===================================================================== */
/* ===== Tiện ích nội bộ ===== */
/* ===================================================================== */

const TASK_KINDS: GroomTaskKind[] = ['PREPARE', 'TO_TRACK', 'COOL_DOWN'];
const HOUR_MS = 3_600_000;
const AUTO_TIMEOUT_MS = 30 * 60_000;
const LIVE_SAMPLE_WINDOW = 150;

function findSession(db: Database, sessionId: string): ClassSession {
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) throw new AppError(ERR_NOT_FOUND);
  return session;
}

function sessionZoneId(db: Database, session: ClassSession): string | undefined {
  return classOf(db, session.classId)?.zoneId;
}

function sessionTrainer(db: Database, session: ClassSession): string | undefined {
  return trainerOfZone(db, sessionZoneId(db, session));
}

function horseNameOf(db: Database, horseId: string): string {
  return findHorse(db, horseId)?.name ?? '—';
}

function sessionCaption(db: Database, session: ClassSession): string {
  const cls = classOf(db, session.classId);
  return `${cls?.name ?? 'Lớp'} ngày ${formatDate(session.date)} (${slotLabel(db, session.slotId)})`;
}

function isStarted(session: ClassSession): boolean {
  return session.status === 'IN_PROGRESS' || session.status === 'AWAITING_REVIEW' || session.status === 'COMPLETED';
}

/** Ai được mở trang của buổi: CM/HT/VET toàn CLB; Groom buổi có ngựa mình dắt; chủ buổi có ngựa mình. */
function canViewSession(db: Database, user: User, session: ClassSession): boolean {
  if (user.role === 'CLUB_MANAGER' || user.role === 'HEAD_TRAINER' || user.role === 'VETERINARIAN') return true;
  return inSessionScope(db, user, 'class.view', session);
}

/** Chủ ngựa chỉ thấy ngựa của mình trong buổi. */
function horseVisibleInSession(db: Database, user: User, horseId: string): boolean {
  if (user.role !== 'HORSE_OWNER') return true;
  return findHorse(db, horseId)?.ownerId === user.id;
}

function presentRows(db: Database, session: ClassSession): SessionAttendance[] {
  return db.attendances.filter((row) => row.sessionId === session.id && row.status === 'PRESENT');
}

/* ----- mô phỏng ----- */

function simSecondOf(session: ClassSession, at: Date): number {
  if (!session.startedAt) return 0;
  return currentSecond(session.startedAt, at, session.simSpeed ?? 1);
}

function configFor(session: ClassSession, row: SessionAttendance): SimConfig {
  return {
    sessionId: session.id,
    workoutType: session.workoutType,
    distanceM: session.distanceM,
    repetitions: session.repetitions,
    intensity: session.intensity,
    scenario: row.simScenario ?? 'NORMAL',
    seed: row.simSeed ?? deriveSeed(session.simSeed ?? 1, row.horseId),
    maxHeartRate: row.maxHeartRateUsed,
  };
}

function horseLimit(row: SessionAttendance, second: number): number {
  return row.stoppedAtSecond !== undefined ? Math.min(second, row.stoppedAtSecond) : second;
}

function runHorse(session: ClassSession, row: SessionAttendance, second: number): SimResult {
  return simulate(configFor(session, row), horseLimit(row, second));
}

function alertIdOf(sessionId: string, horseId: string, rule: AlertRule, atSecond: number): string {
  return `${sessionId}-${horseId}-${rule}-${atSecond}`;
}

function alertTime(session: ClassSession, atSecond: number, fallback: Date): string {
  if (!session.startedAt) return fallback.toISOString();
  const speed = session.simSpeed ?? 1;
  return new Date(new Date(session.startedAt).getTime() + (atSecond / speed) * 1000).toISOString();
}

function alertText(rule: AlertRule, value: number, maxHeartRate?: number): string {
  if (rule === 'R1') return `Nhịp tim ${Math.round(value)} nhịp/phút${maxHeartRate ? `, vượt ngưỡng ${maxHeartRate}` : ''}`;
  if (rule === 'R3') return `Tốc độ tụt đột ngột còn ${value.toFixed(1)} m/s — nghi chấn thương`;
  return 'Hơn 15 giây không nhận được dữ liệu từ thiết bị đeo';
}

function toAlertView(db: Database, alert: TrainingAlert): AlertView {
  const row = attendanceOf(db, alert.sessionId, alert.horseId);
  return {
    id: alert.id,
    horseId: alert.horseId,
    horseName: horseNameOf(db, alert.horseId),
    rule: alert.rule,
    ruleLabel: alertRuleLabel[alert.rule],
    level: alert.level,
    atSecond: alert.atSecond,
    at: alert.at,
    value: alert.value,
    text: alertText(alert.rule, alert.value, row?.maxHeartRateUsed),
    acknowledgedByName: alert.acknowledgedBy ? userName(db, alert.acknowledgedBy) : undefined,
    acknowledgedAt: alert.acknowledgedAt,
    ackAction: alert.ackAction,
    examRequestId: alert.examRequestId,
  };
}

/** Ghi các cảnh báo mới của một ngựa và gửi thông báo theo bảng A.7. Trả số cảnh báo mới. */
function recordAlerts(db: Database, session: ClassSession, row: SessionAttendance, at: Date, alerts: SimAlert[]): number {
  let added = 0;
  const cls = classOf(db, session.classId);
  const horse = findHorse(db, row.horseId);
  const trainer = sessionTrainer(db, session);
  const link = links.session(session.id);
  alerts.forEach((alert) => {
    const id = alertIdOf(session.id, row.horseId, alert.rule, alert.atSecond);
    if (db.alerts.some((item) => item.id === id)) return;
    const level: AlertLevel = alert.rule === 'R6' ? 'GRAY' : 'RED';
    const entry: TrainingAlert = {
      id,
      sessionId: session.id,
      horseId: row.horseId,
      rule: alert.rule,
      level,
      atSecond: alert.atSecond,
      at: alertTime(session, alert.atSecond, at),
      value: alert.value,
      ...stamp(at),
    };
    db.alerts.push(entry);
    added += 1;

    const name = horse?.name ?? 'ngựa';
    const detail = alertText(alert.rule, alert.value, row.maxHeartRateUsed);
    if (level === 'RED') {
      notifyMany(db, at, [...vetIds(db), trainer], {
        level: 'URGENT',
        title: `${alertRuleLabel[alert.rule]}: ${name}`,
        body: `${detail}. Buổi ${cls?.name ?? ''} — cần xác nhận dừng ngựa hoặc tiếp tục theo dõi.`,
        link,
      });
      if (row.groomId) {
        pushNotification(db, at, {
          userId: row.groomId,
          level: 'URGENT',
          title: `Dừng ngựa ngay: ${name}`,
          body: `${alertRuleLabel[alert.rule]} — ${detail}. Cho ngựa đi bộ chậm và chờ HT hoặc bác sĩ.`,
          link,
        });
      }
      if (alert.rule === 'R3') {
        const request = createExamRequestInternal(db, at, {
          horseId: row.horseId,
          source: 'TRAINING_ALERT',
          urgency: 'URGENT',
          description: `Cảnh báo nghi chấn thương trong buổi ${sessionCaption(db, session)}: tốc độ tụt còn ${alert.value.toFixed(1)} m/s ở giây ${alert.atSecond}.`,
          createdBy: 'SYSTEM',
          refType: 'ALERT',
          refId: id,
        });
        entry.examRequestId = request.id;
      }
    } else {
      notifyMany(db, at, [trainer], {
        level: 'NORMAL',
        title: `Mất tín hiệu thiết bị: ${name}`,
        body: `${detail} (buổi ${cls?.name ?? ''}). Kiểm tra thiết bị đeo.`,
        link,
      });
    }
  });
  return added;
}

/** Chốt chỉ số của một ngựa: chạy tới lúc dừng/kết thúc; ngựa đã xong bài thì cắt ở lúc xong. */
function summarizeHorse(db: Database, session: ClassSession, row: SessionAttendance, second: number): SessionSummary {
  const limit = horseLimit(row, second);
  const config = configFor(session, row);
  let result = simulate(config, limit);
  if (result.finished) {
    const idle = result.samples.find((sample) => sample.phase === 'IDLE');
    if (idle && idle.t < limit) result = simulate(config, idle.t);
  }
  const alertCountRed = db.alerts.filter(
    (alert) => alert.sessionId === session.id && alert.horseId === row.horseId && alert.level === 'RED',
  ).length;
  return { ...result.metrics, alertCountRed };
}

/** Kết thúc buổi (bình thường, dừng khẩn hoặc quá giờ): chốt chỉ số từng ngựa có mặt, chuyển Chờ đánh giá. */
function finalizeSession(
  db: Database,
  session: ClassSession,
  at: Date,
  endReason: SessionEndReason,
  actor: User | null,
  stopReason?: string,
) {
  const second = simSecondOf(session, at);
  const rows = presentRows(db, session);
  rows.forEach((row) => recordAlerts(db, session, row, at, runHorse(session, row, second).alerts));
  rows.forEach((row) => {
    row.summary = summarizeHorse(db, session, row, second);
    touch(row, at);
  });
  session.status = 'AWAITING_REVIEW';
  session.endedAt = at.toISOString();
  session.endedBy = actor?.id;
  session.endReason = endReason;
  session.stopReason = stopReason;
  touch(session, at);

  const cls = classOf(db, session.classId);
  notifyMany(db, at, [sessionTrainer(db, session)], {
    level: 'NORMAL',
    title: `Buổi ${cls?.name ?? ''} chờ đánh giá`,
    body: `${rows.length} ngựa có mặt cần chấm điểm${endReason !== 'NORMAL' ? ` · ${sessionEndLabel[endReason]}` : ''}.`,
    link: links.session(session.id),
  });
  writeAudit(db, at, {
    action:
      endReason === 'EMERGENCY_STOP'
        ? 'Dừng khẩn buổi học'
        : endReason === 'AUTO_TIMEOUT'
          ? 'Tự kết thúc buổi học do quá giờ'
          : 'Kết thúc buổi học',
    entityType: 'ClassSession',
    entityId: session.id,
    before: { status: 'IN_PROGRESS' },
    after: { status: 'AWAITING_REVIEW', endReason, horses: rows.length },
    reason: stopReason,
    actor,
    bySystem: !actor,
  });
}

function stopHorseInternal(
  db: Database,
  session: ClassSession,
  row: SessionAttendance,
  at: Date,
  actor: User,
  reason: string,
) {
  row.stoppedAtSecond = simSecondOf(session, at);
  row.stoppedAt = at.toISOString();
  row.stoppedBy = actor.id;
  row.stopReason = reason;
  touch(row, at);
  writeAudit(db, at, {
    action: 'Dừng ngựa trong buổi học',
    entityType: 'SessionAttendance',
    entityId: row.id,
    horseId: row.horseId,
    after: { stoppedAtSecond: row.stoppedAtSecond },
    reason,
    actor,
  });
}

/* ----- việc của Groom ----- */

/** Quy tắc thời điểm của từng việc (chưa xét quyền). Trả lý do nếu chưa làm được. */
function taskBlockReason(session: ClassSession, row: SessionAttendance | undefined, kind: GroomTaskKind): string | undefined {
  if (session.status === 'CANCELLED') return 'Buổi đã hủy';
  if (row?.status === 'ABSENT') return 'Ngựa vắng buổi này';
  if (kind === 'COOL_DOWN') {
    const ran =
      session.status === 'AWAITING_REVIEW' ||
      session.status === 'COMPLETED' ||
      (session.status === 'IN_PROGRESS' && row?.stoppedAtSecond !== undefined);
    return ran ? undefined : 'Chỉ đánh dấu sau khi ngựa đã chạy xong';
  }
  if (session.status !== 'SCHEDULED' && session.status !== 'IN_PROGRESS') return 'Buổi đã kết thúc';
  return undefined;
}

function taskViews(
  db: Database,
  user: User,
  session: ClassSession,
  row: SessionAttendance | undefined,
  inScope: boolean,
): TaskView[] {
  return TASK_KINDS.map((kind) => {
    const mark = row?.tasks[kind];
    let hint = taskBlockReason(session, row, kind);
    if (!hint && mark && mark.by !== user.id) hint = 'Chỉ bỏ đánh dấu được việc do chính bạn làm';
    if (!hint && !inScope) hint = 'Bạn không dắt ngựa này trong buổi';
    return {
      kind,
      label: groomTaskLabel[kind],
      done: !!mark,
      at: mark?.at,
      byName: mark ? userName(db, mark.by) : undefined,
      canToggle: !hint,
      hint,
    };
  });
}

/* ----- dựng dòng dữ liệu ----- */

function buildHeader(db: Database, session: ClassSession, at: Date): SessionHeader {
  const cls = classOf(db, session.classId);
  const zone = cls ? db.zones.find((item) => item.id === cls.zoneId) : undefined;
  const trainerId = sessionTrainer(db, session);
  const slot = slotOf(db, session.slotId);
  return {
    id: session.id,
    classId: session.classId,
    className: cls?.name ?? '—',
    programName: programOf(db, cls?.programId)?.name,
    zoneId: zone?.id,
    zoneName: zone?.name,
    trainerId,
    trainerName: trainerId ? userName(db, trainerId) : undefined,
    date: session.date,
    isToday: session.date === toDateKey(at),
    slotId: session.slotId,
    slotLabel: slotLabel(db, session.slotId),
    slotStart: slot?.startTime ?? '—',
    slotEnd: slot?.endTime ?? '—',
    subjectName: session.subjectName,
    workoutType: session.workoutType,
    distanceM: session.distanceM,
    repetitions: session.repetitions,
    intensity: session.intensity,
    surface: session.surface,
    phaseName: session.phaseName,
    weekNo: session.weekNo,
    isExtra: session.isExtra,
    note: session.note,
    status: session.status,
    derivedLabel: sessionDerivedLabel(db, session, at),
    startedAt: session.startedAt,
    startedByName: session.startedBy ? userName(db, session.startedBy) : undefined,
    endedAt: session.endedAt,
    endedByName: session.endedAt ? userName(db, session.endedBy) : undefined,
    endReason: session.endReason,
    endLabel: session.endReason && session.endReason !== 'NORMAL' ? sessionEndLabel[session.endReason] : undefined,
    stopReason: session.stopReason,
    completedAt: session.completedAt,
    cancelledAt: session.cancelledAt,
    cancelledByName: session.cancelledBy ? userName(db, session.cancelledBy) : undefined,
    cancelReason: session.cancelReason,
    cancelKindLabel: session.cancelKind ? sessionCancelLabel[session.cancelKind] : undefined,
    simScenario: session.simScenario,
    simScenarioLabel: session.simScenario ? scenarioLabel[session.simScenario] : undefined,
    simSpeed: session.simSpeed,
  };
}

function buildFlags(db: Database, user: User, session: ClassSession, at: Date): SessionFlags {
  const todayKey = toDateKey(at);
  const run = inSessionScope(db, user, 'session.run', session);
  let startBlockedReason: string | undefined;
  let startWarning: string | undefined;
  if (session.status === 'SCHEDULED' && run) {
    if (session.date < todayKey) startBlockedReason = 'Buổi đã qua ngày, không bắt đầu được nữa';
    else if (session.date > todayKey) startBlockedReason = 'Chỉ bắt đầu được buổi của ngày hôm nay';
    else {
      const slot = slotOf(db, session.slotId);
      if (at < sessionStartAt(db, session)) {
        startWarning = `Chưa tới giờ của slot (${slot?.startTime ?? '—'}). Vẫn bắt đầu được nếu ngựa đã sẵn sàng.`;
      } else if (at > sessionEndAt(db, session)) {
        startWarning = `Đã quá giờ slot (kết thúc ${slot?.endTime ?? '—'}). Buổi sẽ tự kết thúc sau 30 phút kể từ lúc bắt đầu nếu chưa xong.`;
      }
    }
  }
  const running = session.status === 'IN_PROGRESS';
  return {
    canStart: session.status === 'SCHEDULED' && session.date === todayKey && run,
    startBlockedReason,
    startWarning,
    canFinish: running && run,
    canStop: running && inSessionScope(db, user, 'session.stop', session),
    canAck: running && inSessionScope(db, user, 'alert.ack', session),
    canViewLive: can(user, 'realtime.view'),
    canManage: inSessionScope(db, user, 'session.manage', session),
    canReview: inSessionScope(db, user, 'session.review', session),
  };
}

function toEvaluationView(db: Database, evaluation?: Evaluation): EvaluationView | undefined {
  return evaluation ? { ...evaluation, evaluatedByName: userName(db, evaluation.evaluatedBy) } : undefined;
}

function buildHorseRow(
  db: Database,
  user: User,
  session: ClassSession,
  entry: RosterEntry,
  at: Date,
  opts: { canSeeResults: boolean },
): SessionHorseRow {
  const horse = findHorse(db, entry.horseId);
  const row = entry.attendance;
  const groomId = effectiveGroomId(db, session, entry.horseId);
  const status: AttendanceStatus = row?.status ?? 'EXPECTED';
  const readiness = horse ? canTrain(db, horse, session.intensity) : { allowed: false, reason: 'Không tìm thấy hồ sơ' };
  const manage = inSessionScope(db, user, 'session.manage', session);
  const mine = user.role === 'GROOM' && groomId === user.id;
  const taskScope = inSessionScope(db, user, 'groomtask.do', session, entry.horseId);
  const scheduled = session.status === 'SCHEDULED';
  const maxHeartRate = isStarted(session) ? row?.maxHeartRateUsed : maxHeartRateOf(db, entry.horseId);

  let canScore = false;
  let scoreEditableUntil: string | undefined;
  if (status === 'PRESENT' && inSessionScope(db, user, 'session.review', session)) {
    if (session.status === 'AWAITING_REVIEW') canScore = true;
    else if (session.status === 'COMPLETED' && row?.evaluation) {
      const until = new Date(row.evaluation.evaluatedAt).getTime() + 24 * HOUR_MS;
      if (at.getTime() <= until) {
        canScore = true;
        scoreEditableUntil = new Date(until).toISOString();
      }
    }
  }

  return {
    horseId: entry.horseId,
    horseName: horse?.name ?? '—',
    avatar: horse?.avatar,
    healthStatus: horse?.healthStatus ?? 'ELIGIBLE',
    lifecycleStatus: horse?.lifecycleStatus ?? 'ACTIVE',
    status,
    absenceReason: row?.absenceReason,
    absenceLabel: row?.absenceReason ? absenceLabel[row.absenceReason] : undefined,
    absenceNote: row?.absenceNote,
    markedByName: row?.markedBy ? userName(db, row.markedBy) : undefined,
    markedAt: row?.markedAt,
    groomId,
    groomName: groomId ? userName(db, groomId) : undefined,
    groomOverridden: !!row?.groomOverridden,
    defaultGroomId: horse?.groomId,
    defaultGroomName: horse?.groomId ? userName(db, horse.groomId) : undefined,
    readiness: { allowed: readiness.allowed, reason: readiness.reason },
    tasks: taskViews(db, user, session, row, taskScope),
    mine,
    canDoTasks: taskScope && status !== 'ABSENT' && session.status !== 'CANCELLED',
    canMarkAbsent: scheduled && status !== 'ABSENT' && (manage || (mine && can(user, 'session.run'))),
    canClearAbsence: scheduled && status === 'ABSENT' && manage,
    canChangeGroom: scheduled && manage,
    maxHeartRate,
    r1Disabled: maxHeartRate === undefined,
    scenarioLabel: row?.simScenario ? scenarioLabel[row.simScenario] : undefined,
    stopped:
      row?.stoppedAtSecond !== undefined
        ? { atSecond: row.stoppedAtSecond, at: row.stoppedAt, byName: userName(db, row.stoppedBy), reason: row.stopReason }
        : undefined,
    summary: opts.canSeeResults ? row?.summary : undefined,
    evaluation: opts.canSeeResults ? toEvaluationView(db, row?.evaluation) : undefined,
    canScore,
    scoreEditableUntil,
    redAlertCount: db.alerts.filter(
      (alert) => alert.sessionId === session.id && alert.horseId === entry.horseId && alert.level === 'RED',
    ).length,
  };
}

function unackedRedOf(db: Database, sessionId: string): TrainingAlert[] {
  return db.alerts.filter((alert) => alert.sessionId === sessionId && alert.level === 'RED' && !alert.acknowledgedAt);
}

/* ===================================================================== */
/* ===== F2.6 / F2.7 — buổi hôm nay, trang buổi học ===== */
/* ===================================================================== */

export function listSlots() {
  return query((db) => db.slots.map((slot) => ({ id: slot.id, start: slot.startTime, end: slot.endTime })));
}

/** Buổi của hôm nay theo phạm vi người xem, sắp theo slot. */
export function listTodaySessions(): Promise<TodaySessionRow[]> {
  return query((db) => {
    const user = requireUser();
    const at = now();
    const todayKey = toDateKey(at);
    const zones = user.role === 'HEAD_TRAINER' ? db.zones.filter((zone) => zone.headTrainerId === user.id).map((zone) => zone.id) : [];

    return db.sessions
      .filter((session) => session.date === todayKey)
      .flatMap((session): TodaySessionRow[] => {
        const roster = sessionRoster(db, session);
        let visible = roster;
        if (user.role === 'HEAD_TRAINER') {
          if (!zones.includes(sessionZoneId(db, session) ?? '')) return [];
        } else if (user.role === 'GROOM') {
          visible = roster.filter((entry) => effectiveGroomId(db, session, entry.horseId) === user.id);
          if (visible.length === 0) return [];
        } else if (user.role === 'HORSE_OWNER') {
          visible = roster.filter((entry) => findHorse(db, entry.horseId)?.ownerId === user.id);
          if (visible.length === 0) return [];
        }
        const canSeeResults = user.role !== 'GROOM';
        const horses = visible.map((entry) => buildHorseRow(db, user, session, entry, at, { canSeeResults }));
        return [
          {
            header: buildHeader(db, session, at),
            horses,
            totalHorses: roster.length,
            hiddenCount: roster.length - visible.length,
            presentCount: roster.filter((entry) => entry.attendance?.status === 'PRESENT').length,
            absentCount: roster.filter((entry) => entry.attendance?.status === 'ABSENT').length,
            blockedCount:
              session.status === 'SCHEDULED'
                ? horses.filter((row) => row.status !== 'ABSENT' && !row.readiness.allowed).length
                : 0,
            unackedRed: unackedRedOf(db, session.id).filter((alert) => horseVisibleInSession(db, user, alert.horseId)).length,
            flags: buildFlags(db, user, session, at),
          },
        ];
      })
      .sort((a, b) => a.header.slotStart.localeCompare(b.header.slotStart) || a.header.className.localeCompare(b.header.className, 'vi'));
  });
}

/** Chi tiết một buổi: đầu buổi, danh sách ngựa theo quyền, cảnh báo, cờ thao tác. */
export function getSession(sessionId: string): Promise<SessionDetail> {
  return query((db) => {
    const user = requireUser();
    const session = findSession(db, sessionId);
    if (!canViewSession(db, user, session)) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    const roster = sessionRoster(db, session);
    const visible = roster.filter((entry) => horseVisibleInSession(db, user, entry.horseId));
    const canSeeResults = user.role !== 'GROOM';
    const flags = buildFlags(db, user, session, at);
    return {
      header: buildHeader(db, session, at),
      horses: visible.map((entry) => buildHorseRow(db, user, session, entry, at, { canSeeResults })),
      totalHorses: roster.length,
      hiddenCount: roster.length - visible.length,
      alerts: db.alerts
        .filter((alert) => alert.sessionId === session.id && horseVisibleInSession(db, user, alert.horseId))
        .sort((a, b) => b.atSecond - a.atSecond)
        .map((alert) => toAlertView(db, alert)),
      flags,
      groomOptions:
        flags.canManage && session.status === 'SCHEDULED'
          ? db.users
              .filter((item) => item.role === 'GROOM' && item.active)
              .map((item) => ({ id: item.id, name: item.name }))
          : [],
      plannedVolumeM: session.distanceM * session.repetitions,
      fastThreshold: fastThreshold(session.workoutType),
      canSeeResults,
      viewerRole: user.role,
    };
  });
}

/** HT đổi Groom dắt một ngựa cho riêng buổi này; `null` = trả về Groom phụ trách ngựa. */
export function setSessionGroom(sessionId: string, horseId: string, groomId: string | null) {
  return commit((db) => {
    const actor = requirePermission('session.manage');
    const session = findSession(db, sessionId);
    if (!inSessionScope(db, actor, 'session.manage', session)) throw new AppError(ERR_FORBIDDEN);
    if (session.status !== 'SCHEDULED') throw new AppError('Chỉ đổi Groom được cho buổi chưa bắt đầu');
    const entry = sessionRoster(db, session).find((item) => item.horseId === horseId);
    if (!entry) throw new AppError('Ngựa không thuộc danh sách của buổi học này');
    const horse = findHorse(db, horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (groomId) {
      const groom = findUser(db, groomId);
      if (!groom || groom.role !== 'GROOM' || !groom.active) throw new AppError('Người được chọn không phải Groom đang hoạt động', 'groomId');
    }
    const at = now();
    const before = effectiveGroomId(db, session, horseId);
    const row = ensureAttendance(db, session, horseId, at);
    if (!groomId || groomId === horse.groomId) {
      row.groomId = undefined;
      row.groomOverridden = false;
    } else {
      row.groomId = groomId;
      row.groomOverridden = true;
    }
    touch(row, at);
    const after = effectiveGroomId(db, session, horseId);
    if (after && after !== before) {
      notifyMany(db, at, [after], {
        level: 'NORMAL',
        title: `Bạn dắt ${horse.name} trong buổi ${classOf(db, session.classId)?.name ?? ''}`,
        body: `${sessionCaption(db, session)}: chuẩn bị ngựa, đưa ra sân và chăm sóc sau tập.`,
        link: links.session(session.id),
      });
    }
    writeAudit(db, at, {
      action: 'Đổi Groom cho buổi học',
      entityType: 'SessionAttendance',
      entityId: row.id,
      horseId,
      before: { groom: before ? userName(db, before) : null },
      after: { groom: after ? userName(db, after) : null, overridden: row.groomOverridden },
      actor,
    });
  });
}

/** Đánh dấu vắng riêng một ngựa (không hủy buổi của lớp). Groom báo hoặc HT cho nghỉ. */
export function markAbsent(sessionId: string, horseId: string, input: MarkAbsentInput) {
  return commit((db) => {
    const actor = requireUser();
    const session = findSession(db, sessionId);
    const manage = inSessionScope(db, actor, 'session.manage', session);
    const leading =
      actor.role === 'GROOM' &&
      can(actor, 'session.run') &&
      effectiveGroomId(db, session, horseId) === actor.id;
    if (!manage && !leading) throw new AppError(ERR_FORBIDDEN);
    if (session.status !== 'SCHEDULED') throw new AppError('Chỉ đánh dấu vắng được khi buổi chưa bắt đầu');
    const entry = sessionRoster(db, session).find((item) => item.horseId === horseId);
    if (!entry) throw new AppError('Ngựa không thuộc danh sách của buổi học này');
    if (entry.attendance?.status === 'ABSENT') throw new AppError('Ngựa đã được đánh dấu vắng buổi này');
    const note = input.note.trim();
    if (note.length < 5) throw new AppError('Vui lòng ghi rõ lý do (ít nhất 5 ký tự)', 'note');
    const horse = findHorse(db, horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);

    const at = now();
    const byGroom = leading && !manage;
    const row = ensureAttendance(db, session, horseId, at);
    row.status = 'ABSENT';
    row.absenceReason = byGroom ? 'GROOM_REPORTED' : 'TRAINER_CHANGED';
    row.absenceNote = note;
    row.markedBy = actor.id;
    row.markedAt = at.toISOString();
    touch(row, at);

    if (byGroom) {
      notifyMany(db, at, [sessionTrainer(db, session)], {
        level: 'NORMAL',
        title: `${horse.name} không tập được buổi ${classOf(db, session.classId)?.name ?? ''}`,
        body: `${actor.name} báo: ${note}`,
        link: links.session(session.id),
      });
    }
    if (input.requestExam) {
      createExamRequestInternal(db, at, {
        horseId,
        source: byGroom ? 'GROOM_REPORT' : 'MANUAL',
        urgency: input.requestExam.urgency,
        description: `Vắng buổi ${sessionCaption(db, session)}: ${note}`,
        createdBy: actor.id,
        refType: 'SESSION',
        refId: session.id,
      });
    }
    writeAudit(db, at, {
      action: 'Đánh dấu ngựa vắng buổi học',
      entityType: 'SessionAttendance',
      entityId: row.id,
      horseId,
      before: { status: 'EXPECTED' },
      after: { status: 'ABSENT', reason: row.absenceReason, requestExam: input.requestExam?.urgency },
      reason: note,
      actor,
    });
  });
}

/** HT bỏ đánh dấu vắng (buổi chưa bắt đầu). */
export function clearAbsence(sessionId: string, horseId: string) {
  return commit((db) => {
    const actor = requirePermission('session.manage');
    const session = findSession(db, sessionId);
    if (!inSessionScope(db, actor, 'session.manage', session)) throw new AppError(ERR_FORBIDDEN);
    if (session.status !== 'SCHEDULED') throw new AppError('Chỉ bỏ vắng được khi buổi chưa bắt đầu');
    const row = attendanceOf(db, sessionId, horseId);
    if (!row || row.status !== 'ABSENT') throw new AppError('Ngựa không ở trạng thái vắng');
    const at = now();
    const before = { status: row.status, reason: row.absenceReason, note: row.absenceNote };
    row.status = 'EXPECTED';
    row.absenceReason = undefined;
    row.absenceNote = undefined;
    row.markedBy = undefined;
    row.markedAt = undefined;
    touch(row, at);
    writeAudit(db, at, {
      action: 'Bỏ đánh dấu vắng',
      entityType: 'SessionAttendance',
      entityId: row.id,
      horseId,
      before,
      after: { status: 'EXPECTED' },
      actor,
    });
  });
}

/** Việc của Groom trong ngày: mỗi dòng là một ngựa trong một buổi. */
export function listGroomTasks(date?: string): Promise<GroomTaskRow[]> {
  return query((db) => {
    const user = requirePermission('groomtask.do');
    const at = now();
    const day = date ?? toDateKey(at);
    const rows: GroomTaskRow[] = [];
    db.sessions
      .filter((session) => session.date === day && session.status !== 'CANCELLED')
      .forEach((session) => {
        sessionRoster(db, session).forEach((entry) => {
          if (!inSessionScope(db, user, 'groomtask.do', session, entry.horseId)) return;
          const horse = findHorse(db, entry.horseId);
          const slot = slotOf(db, session.slotId);
          const tasks = taskViews(db, user, session, entry.attendance, true);
          rows.push({
            sessionId: session.id,
            className: classOf(db, session.classId)?.name ?? '—',
            date: session.date,
            slotLabel: slotLabel(db, session.slotId),
            slotStart: slot?.startTime ?? '—',
            sessionStatus: session.status,
            subjectName: session.subjectName,
            workoutType: session.workoutType,
            intensity: session.intensity,
            horseId: entry.horseId,
            horseName: horse?.name ?? '—',
            avatar: horse?.avatar,
            attendanceStatus: entry.attendance?.status ?? 'EXPECTED',
            absenceReason: entry.attendance?.absenceReason,
            tasks,
            doneCount: tasks.filter((task) => task.done).length,
          });
        });
      });
    return rows.sort((a, b) => a.slotStart.localeCompare(b.slotStart) || a.horseName.localeCompare(b.horseName, 'vi'));
  });
}

/** Groom đang dắt ngựa (hoặc HT khu) đánh dấu / bỏ đánh dấu một việc. */
export function setGroomTask(sessionId: string, horseId: string, kind: GroomTaskKind, done: boolean) {
  return commit((db) => {
    const actor = requirePermission('groomtask.do');
    const session = findSession(db, sessionId);
    if (!inSessionScope(db, actor, 'groomtask.do', session, horseId)) {
      throw new AppError('Bạn không dắt ngựa này trong buổi học');
    }
    const entry = sessionRoster(db, session).find((item) => item.horseId === horseId);
    if (!entry) throw new AppError('Ngựa không thuộc danh sách của buổi học này');
    const blocked = taskBlockReason(session, entry.attendance, kind);
    if (blocked) throw new AppError(blocked);
    const mark = entry.attendance?.tasks[kind];
    if (done && mark) throw new AppError(`Việc "${groomTaskLabel[kind]}" đã được ${userName(db, mark.by)} đánh dấu`);
    if (!done && !mark) throw new AppError('Việc này chưa được đánh dấu');
    if (!done && mark && mark.by !== actor.id) throw new AppError('Chỉ bỏ đánh dấu được việc do chính bạn làm');

    const at = now();
    const row = ensureAttendance(db, session, horseId, at);
    if (done) row.tasks[kind] = { at: at.toISOString(), by: actor.id };
    else delete row.tasks[kind];
    touch(row, at);
    writeAudit(db, at, {
      action: done ? `Đánh dấu việc: ${groomTaskLabel[kind]}` : `Bỏ đánh dấu việc: ${groomTaskLabel[kind]}`,
      entityType: 'SessionAttendance',
      entityId: row.id,
      horseId,
      after: { kind, done },
      actor,
    });
  });
}

/**
 * Bắt đầu buổi: kiểm tra lại được tập cho TỪNG ngựa tại thời điểm bấm.
 * Ngựa không đạt được đánh dấu vắng (chặn y tế), buổi vẫn chạy với các ngựa còn lại.
 */
export function startSession(sessionId: string, input: StartSessionInput): Promise<StartSessionResult> {
  return commit((db) => {
    const actor = requirePermission('session.run');
    const session = findSession(db, sessionId);
    if (!inSessionScope(db, actor, 'session.run', session)) {
      throw new AppError('Bạn không phụ trách buổi học này (HT của khu hoặc Groom dắt ngựa trong buổi mới bắt đầu được)');
    }
    if (session.status !== 'SCHEDULED') throw new AppError('Buổi học không còn ở trạng thái Đã lên lịch');
    const at = now();
    if (session.date !== toDateKey(at)) throw new AppError('Chỉ bắt đầu được buổi của ngày hôm nay');
    const roster = sessionRoster(db, session);
    if (roster.length === 0) throw new AppError('Buổi học chưa có ngựa nào trong danh sách lớp');

    // Kiểm tra toàn bộ trước khi ghi — lỗi giữa chừng không được để lại dữ liệu dở dang.
    const busy = roster.find(
      (entry) =>
        entry.attendance?.status !== 'ABSENT' &&
        db.attendances.some(
          (row) =>
            row.horseId === entry.horseId &&
            row.sessionId !== session.id &&
            row.status === 'PRESENT' &&
            row.stoppedAtSecond === undefined &&
            db.sessions.find((item) => item.id === row.sessionId)?.status === 'IN_PROGRESS',
        ),
    );
    if (busy) throw new AppError(`${horseNameOf(db, busy.horseId)} đang ở một buổi học khác chưa kết thúc`);

    const plan = roster.map((entry) => {
      const horse = findHorse(db, entry.horseId);
      if (entry.attendance?.status === 'ABSENT') {
        return { entry, present: false, keep: true, reason: entry.attendance.absenceReason, note: entry.attendance.absenceNote };
      }
      const check = horse ? canTrain(db, horse, session.intensity) : { allowed: false, reason: 'Không tìm thấy hồ sơ', code: 'DELETED' as const };
      if (check.allowed) return { entry, present: true, keep: false, reason: undefined, note: undefined };
      const reason: AbsenceReason = check.code === 'LIFECYCLE' || check.code === 'DELETED' ? 'LIFECYCLE' : 'MEDICAL_BLOCK';
      return { entry, present: false, keep: false, reason, note: check.reason };
    });
    const presentPlan = plan.filter((item) => item.present);
    if (presentPlan.length === 0) {
      throw new AppError('Không còn ngựa nào đủ điều kiện tập — hãy hủy buổi hoặc đánh dấu vắng');
    }

    const scenario = input.scenario;
    let targetHorseId: string | undefined;
    if (scenario !== 'NORMAL' && scenario !== 'RANDOM') {
      if (input.targetHorseId) {
        if (!presentPlan.some((item) => item.entry.horseId === input.targetHorseId)) {
          throw new AppError('Ngựa mục tiêu của kịch bản không có mặt trong buổi', 'targetHorseId');
        }
        targetHorseId = input.targetHorseId;
      } else {
        const withThreshold = presentPlan.find((item) => maxHeartRateOf(db, item.entry.horseId) !== undefined);
        targetHorseId = (scenario === 'HEART_OVER' && withThreshold ? withThreshold : presentPlan[0]).entry.horseId;
      }
    }

    // Ghi: tạo đủ dòng tham gia, chốt Groom hiệu lực, trạng thái có mặt/vắng, kịch bản từng ngựa.
    const seed = Math.floor(Math.random() * 1_000_000_000) + 1;
    const grooms = new Map(roster.map((entry) => [entry.horseId, effectiveGroomId(db, session, entry.horseId)]));
    const result: StartSessionResult = { sessionId: session.id, present: [], absent: [] };
    plan.forEach((item) => {
      const horseId = item.entry.horseId;
      const row = ensureAttendance(db, session, horseId, at);
      row.groomId = grooms.get(horseId);
      const name = horseNameOf(db, horseId);
      if (item.present) {
        row.status = 'PRESENT';
        const rowSeed = deriveSeed(seed, horseId);
        row.simSeed = rowSeed;
        row.simScenario =
          scenario === 'RANDOM'
            ? resolveScenario('RANDOM', deriveSeed(rowSeed, 'scenario'))
            : scenario === 'NORMAL' || horseId !== targetHorseId
              ? 'NORMAL'
              : scenario;
        row.maxHeartRateUsed = maxHeartRateOf(db, horseId);
        result.present.push(name);
      } else {
        if (!item.keep) {
          row.status = 'ABSENT';
          row.absenceReason = item.reason;
          row.absenceNote = item.note;
          row.markedBy = 'SYSTEM';
          row.markedAt = at.toISOString();
        }
        result.absent.push({
          horseName: name,
          reason: `${item.reason ? absenceLabel[item.reason] : 'Vắng'}${item.note ? `: ${item.note}` : ''}`,
          auto: !item.keep,
        });
      }
      touch(row, at);
    });

    session.status = 'IN_PROGRESS';
    session.startedAt = at.toISOString();
    session.startedBy = actor.id;
    session.simScenario = scenario;
    session.simSeed = seed;
    session.simSpeed = getSimSpeed();
    session.simTargetHorseId = targetHorseId;
    touch(session, at);
    result.targetHorseName = targetHorseId ? horseNameOf(db, targetHorseId) : undefined;

    const blocked = result.absent.filter((item) => item.auto);
    const trainer = sessionTrainer(db, session);
    if (blocked.length > 0 && trainer && trainer !== actor.id) {
      notifyMany(db, at, [trainer], {
        level: 'NORMAL',
        title: `Buổi ${classOf(db, session.classId)?.name ?? ''} bắt đầu, ${blocked.length} ngựa vắng`,
        body: blocked.map((item) => `${item.horseName} — ${item.reason}`).join('; '),
        link: links.session(session.id),
      });
    }
    writeAudit(db, at, {
      action: 'Bắt đầu buổi học',
      entityType: 'ClassSession',
      entityId: session.id,
      before: { status: 'SCHEDULED' },
      after: {
        status: 'IN_PROGRESS',
        scenario,
        target: result.targetHorseName,
        present: result.present,
        absent: result.absent.map((item) => item.horseName),
      },
      actor,
    });
    return result;
  });
}

/**
 * Chạy nền mỗi 2 giây: ghi cảnh báo mới, tự kết thúc buổi khi mọi ngựa đã xong bài hoặc quá giờ.
 * Không có buổi đang diễn ra thì trả 0 ngay và không ghi gì.
 */
export function syncRunningSessions(): Promise<number> {
  try {
    const db = getDb();
    const running = runningSessions(db);
    if (running.length === 0) return Promise.resolve(0);
    const at = now();

    const plans = running.map((session) => {
      // Hạn chót = muộn hơn giữa "hết slot" và "lúc bấm bắt đầu", cộng 30 phút (được bắt đầu ngoài khung giờ).
      const dueAt = Math.max(sessionEndAt(db, session).getTime(), new Date(session.startedAt ?? at).getTime());
      const deadline = dueAt + AUTO_TIMEOUT_MS;
      const overdue = at.getTime() > deadline;
      // Quá hạn chót (ví dụ không ai mở ứng dụng): chỉ tính dữ liệu tới hạn chót.
      const endAt = overdue ? new Date(deadline) : at;
      const second = simSecondOf(session, endAt);
      const rows = presentRows(db, session);
      const results = rows.map((row) => ({ row, result: runHorse(session, row, second) }));
      const hasNewAlert = results.some(({ row, result }) =>
        result.alerts.some(
          (alert) => !db.alerts.some((item) => item.id === alertIdOf(session.id, row.horseId, alert.rule, alert.atSecond)),
        ),
      );
      const allDone = results.every(({ row, result }) => row.stoppedAtSecond !== undefined || result.finished);
      const finish: SessionEndReason | undefined = allDone ? 'NORMAL' : overdue ? 'AUTO_TIMEOUT' : undefined;
      return { session, results, hasNewAlert, finish, endAt };
    });

    const dirty = plans.filter((plan) => plan.hasNewAlert || plan.finish);
    if (dirty.length === 0) return Promise.resolve(0);

    mutate((store) => {
      dirty.forEach((plan) => {
        const session = store.sessions.find((item) => item.id === plan.session.id);
        if (!session || session.status !== 'IN_PROGRESS') return;
        plan.results.forEach(({ row, result }) => recordAlerts(store, session, row, at, result.alerts));
        if (plan.finish) finalizeSession(store, session, plan.endAt, plan.finish, null);
      });
    });
    return Promise.resolve(dirty.length);
  } catch {
    return Promise.resolve(0);
  }
}

/** Groom dắt ngựa hoặc HT khu kết thúc buổi: chốt chỉ số, chuyển Chờ đánh giá. */
export function finishSession(sessionId: string) {
  return commit((db) => {
    const actor = requirePermission('session.run');
    const session = findSession(db, sessionId);
    if (!inSessionScope(db, actor, 'session.run', session)) throw new AppError(ERR_FORBIDDEN);
    if (session.status !== 'IN_PROGRESS') throw new AppError('Buổi học không ở trạng thái Đang diễn ra');
    finalizeSession(db, session, now(), 'NORMAL', actor);
  });
}

/** Dừng khẩn cả buổi (HT khu hoặc VET), bắt buộc lý do. */
export function emergencyStop(sessionId: string, reason: string) {
  return commit((db) => {
    const actor = requirePermission('session.stop');
    const session = findSession(db, sessionId);
    if (!inSessionScope(db, actor, 'session.stop', session)) throw new AppError(ERR_FORBIDDEN);
    if (session.status !== 'IN_PROGRESS') throw new AppError('Buổi học không ở trạng thái Đang diễn ra');
    const text = reason.trim();
    if (text.length < 5) throw new AppError('Vui lòng ghi rõ lý do dừng khẩn (ít nhất 5 ký tự)', 'reason');
    finalizeSession(db, session, now(), 'EMERGENCY_STOP', actor, text);
  });
}

/** Dừng riêng một ngựa (HT khu hoặc VET); buổi vẫn chạy với các ngựa khác. */
export function stopHorse(sessionId: string, horseId: string, reason: string) {
  return commit((db) => {
    const actor = requirePermission('alert.ack');
    const session = findSession(db, sessionId);
    if (!inSessionScope(db, actor, 'alert.ack', session)) throw new AppError(ERR_FORBIDDEN);
    if (session.status !== 'IN_PROGRESS') throw new AppError('Buổi học không ở trạng thái Đang diễn ra');
    const row = attendanceOf(db, sessionId, horseId);
    if (!row || row.status !== 'PRESENT') throw new AppError('Ngựa không có mặt trong buổi này');
    if (row.stoppedAtSecond !== undefined) throw new AppError('Ngựa đã được dừng trước đó');
    const text = reason.trim();
    if (text.length < 5) throw new AppError('Vui lòng ghi rõ lý do dừng ngựa (ít nhất 5 ký tự)', 'reason');
    stopHorseInternal(db, session, row, now(), actor, text);
  });
}

/* ===================================================================== */
/* ===== F2.8 — theo dõi realtime và cảnh báo ===== */
/* ===================================================================== */

export function listLiveSessions(): Promise<LiveSessionRow[]> {
  return query((db) => {
    requirePermission('realtime.view');
    const at = now();
    return runningSessions(db)
      .map((session) => {
        const cls = classOf(db, session.classId);
        const rows = db.attendances.filter((row) => row.sessionId === session.id);
        const unacked = unackedRedOf(db, session.id);
        return {
          id: session.id,
          className: cls?.name ?? '—',
          zoneName: db.zones.find((zone) => zone.id === cls?.zoneId)?.name,
          slotLabel: slotLabel(db, session.slotId),
          subjectName: session.subjectName,
          workoutType: session.workoutType,
          distanceM: session.distanceM,
          repetitions: session.repetitions,
          intensity: session.intensity,
          startedAt: session.startedAt,
          second: simSecondOf(session, at),
          simSpeed: session.simSpeed ?? 1,
          horses: rows
            .filter((row) => row.status === 'PRESENT')
            .map((row) => {
              const horse = findHorse(db, row.horseId);
              return {
                id: row.horseId,
                name: horse?.name ?? '—',
                avatar: horse?.avatar,
                stopped: row.stoppedAtSecond !== undefined,
                hasRed: unacked.some((alert) => alert.horseId === row.horseId),
              };
            }),
          absentCount: rows.filter((row) => row.status === 'ABSENT').length,
          unackedRed: unacked.length,
        };
      })
      .sort((a, b) => b.unackedRed - a.unackedRed || (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
  });
}

/** Bảng theo dõi trực tiếp của một buổi — tính bằng bộ mô phỏng, không ghi gì. */
export function getLiveSession(sessionId: string): Promise<LiveView> {
  return query((db) => {
    const user = requirePermission('realtime.view');
    const session = findSession(db, sessionId);
    const at = now();
    const second = simSecondOf(session, at);
    const running = session.status === 'IN_PROGRESS';
    const rows = db.attendances.filter((row) => row.sessionId === session.id);
    const alerts = db.alerts
      .filter((alert) => alert.sessionId === session.id)
      .sort((a, b) => b.atSecond - a.atSecond)
      .map((alert) => toAlertView(db, alert));

    const horses: LiveHorse[] = running
      ? rows
          .filter((row) => row.status === 'PRESENT')
          .map((row) => {
            const horse = findHorse(db, row.horseId);
            const limit = horseLimit(row, second);
            const result = simulate(configFor(session, row), limit);
            const last = result.samples[result.samples.length - 1];
            const lastGood = [...result.samples].reverse().find((sample) => !sample.lost);
            const signalLost = !!last && last.lost && last.t === limit && row.stoppedAtSecond === undefined;
            const horseAlerts = alerts.filter((alert) => alert.horseId === row.horseId);
            const current = lastGood
              ? {
                  heartRate: lastGood.heartRate,
                  speedMps: lastGood.speedMps,
                  phase: lastGood.phase,
                  phaseLabel: phaseLabel[lastGood.phase],
                  runIndex: lastGood.runIndex,
                }
              : undefined;
            return {
              horseId: row.horseId,
              horseName: horse?.name ?? '—',
              avatar: horse?.avatar,
              groomName: row.groomId ? userName(db, row.groomId) : undefined,
              second: limit,
              current,
              signalLost,
              samples: result.samples
                .filter((sample) => !sample.lost)
                .slice(-LIVE_SAMPLE_WINDOW)
                .map((sample) => ({ t: sample.t, heartRate: sample.heartRate, speedMps: sample.speedMps })),
              metrics: result.metrics,
              maxHeartRate: row.maxHeartRateUsed,
              r1Enabled: row.maxHeartRateUsed !== undefined,
              fastThreshold: fastThreshold(session.workoutType),
              overMax: !!current && row.maxHeartRateUsed !== undefined && current.heartRate > row.maxHeartRateUsed,
              finished: result.finished,
              stopped:
                row.stoppedAtSecond !== undefined
                  ? { atSecond: row.stoppedAtSecond, at: row.stoppedAt, byName: userName(db, row.stoppedBy), reason: row.stopReason }
                  : undefined,
              scenarioLabel: scenarioLabel[row.simScenario ?? 'NORMAL'],
              alerts: horseAlerts,
              unackedRed: horseAlerts.filter((alert) => alert.level === 'RED' && !alert.acknowledgedAt).length,
            };
          })
      : [];

    return {
      header: buildHeader(db, session, at),
      status: session.status,
      second,
      simSpeed: session.simSpeed ?? 1,
      horses,
      absent: rows
        .filter((row) => row.status === 'ABSENT')
        .map((row) => ({
          horseId: row.horseId,
          horseName: horseNameOf(db, row.horseId),
          reasonLabel: row.absenceReason ? absenceLabel[row.absenceReason] : 'Vắng',
          note: row.absenceNote,
        })),
      unackedRed: alerts.filter((alert) => alert.level === 'RED' && !alert.acknowledgedAt),
      alerts,
      flags: buildFlags(db, user, session, at),
    };
  });
}

/** HT khu hoặc VET xác nhận cảnh báo: đã dừng ngựa hoặc tiếp tục theo dõi. CM chỉ xem. */
export function acknowledgeAlert(alertId: string, action: AlertAckAction) {
  return commit((db) => {
    const actor = requirePermission('alert.ack');
    const alert = db.alerts.find((item) => item.id === alertId);
    if (!alert) throw new AppError(ERR_NOT_FOUND);
    const session = findSession(db, alert.sessionId);
    if (!inSessionScope(db, actor, 'alert.ack', session)) throw new AppError(ERR_FORBIDDEN);
    if (alert.acknowledgedAt) {
      throw new AppError(`Cảnh báo đã được ${userName(db, alert.acknowledgedBy)} xác nhận lúc trước`);
    }
    const at = now();
    alert.acknowledgedBy = actor.id;
    alert.acknowledgedAt = at.toISOString();
    alert.ackAction = action;
    touch(alert, at);
    if (action === 'STOP_HORSE' && session.status === 'IN_PROGRESS') {
      const row = attendanceOf(db, session.id, alert.horseId);
      if (row && row.status === 'PRESENT' && row.stoppedAtSecond === undefined) {
        stopHorseInternal(db, session, row, at, actor, `${alertRuleLabel[alert.rule]} — xác nhận dừng ngựa`);
      }
    }
    writeAudit(db, at, {
      action: action === 'STOP_HORSE' ? 'Xác nhận cảnh báo — đã dừng ngựa' : 'Xác nhận cảnh báo — tiếp tục theo dõi',
      entityType: 'TrainingAlert',
      entityId: alert.id,
      horseId: alert.horseId,
      after: { rule: alert.rule, ackAction: action },
      actor,
    });
  });
}

/* ===================================================================== */
/* ===== F2.9 — đánh giá từng ngựa ===== */
/* ===================================================================== */

export function listAwaitingReview(): Promise<ReviewRow[]> {
  return query((db) => {
    const user = requireUser();
    if (user.role !== 'HEAD_TRAINER' && user.role !== 'CLUB_MANAGER' && user.role !== 'VETERINARIAN') {
      throw new AppError(ERR_FORBIDDEN);
    }
    const at = now();
    return db.sessions
      .filter((session) => session.status === 'AWAITING_REVIEW')
      .filter((session) => user.role !== 'HEAD_TRAINER' || inSessionScope(db, user, 'session.review', session))
      .map((session) => {
        const cls = classOf(db, session.classId);
        const rows = db.attendances.filter((row) => row.sessionId === session.id);
        const present = rows.filter((row) => row.status === 'PRESENT');
        const endedMs = session.endedAt ? new Date(session.endedAt).getTime() : at.getTime();
        const hours = Math.max(0, (at.getTime() - endedMs) / HOUR_MS);
        return {
          id: session.id,
          classId: session.classId,
          className: cls?.name ?? '—',
          zoneName: db.zones.find((zone) => zone.id === cls?.zoneId)?.name,
          date: session.date,
          slotLabel: slotLabel(db, session.slotId),
          subjectName: session.subjectName,
          workoutType: session.workoutType,
          intensity: session.intensity,
          endedAt: session.endedAt,
          endReason: session.endReason,
          endLabel: session.endReason ? sessionEndLabel[session.endReason] : undefined,
          presentCount: present.length,
          scoredCount: present.filter((row) => row.evaluation).length,
          absentCount: rows.filter((row) => row.status === 'ABSENT').length,
          hoursSinceEnd: Math.round(hours),
          overdue: hours > 48,
          canReview: inSessionScope(db, user, 'session.review', session),
        };
      })
      .sort((a, b) => (a.endedAt ?? '').localeCompare(b.endedAt ?? ''));
  });
}

/** HT chấm một ngựa; chấm đủ mọi ngựa có mặt thì buổi Hoàn thành. Sửa được trong 24 giờ. */
export function scoreHorse(
  sessionId: string,
  horseId: string,
  input: ScoreInput,
): Promise<{ completed: boolean; remaining: number }> {
  return commit((db) => {
    const actor = requirePermission('session.review');
    const session = findSession(db, sessionId);
    if (!inSessionScope(db, actor, 'session.review', session)) throw new AppError('Buổi học không thuộc khu bạn phụ trách');
    const row = attendanceOf(db, sessionId, horseId);
    if (!row || row.status !== 'PRESENT') throw new AppError('Chỉ chấm được ngựa có mặt trong buổi');
    const at = now();
    const before = row.evaluation;
    if (session.status === 'COMPLETED') {
      if (!before || at.getTime() - new Date(before.evaluatedAt).getTime() > 24 * HOUR_MS) {
        throw new AppError('Đã quá 24 giờ kể từ lúc chấm, không sửa được nữa');
      }
    } else if (session.status !== 'AWAITING_REVIEW') {
      throw new AppError('Buổi học chưa kết thúc nên chưa chấm được');
    }
    if (!Number.isInteger(input.score) || input.score < 1 || input.score > 10) {
      throw new AppError('Điểm phải là số nguyên từ 1 đến 10', 'score');
    }
    const notes = input.notes.trim();
    if (notes.length < 10) throw new AppError('Nhận xét tối thiểu 10 ký tự — chủ ngựa đọc được nội dung này', 'notes');
    const isTrial = session.workoutType === 'TIME_TRIAL';
    if (isTrial && !input.trialNotCompleted) {
      const seconds = input.trialTimeSeconds;
      if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
        throw new AppError('Nhập thời gian chạy thử hoặc chọn "Không hoàn thành"', 'trialTimeSeconds');
      }
      if (seconds < 10 || seconds > 600) throw new AppError('Thời gian chạy thử phải trong khoảng 10–600 giây', 'trialTimeSeconds');
    }

    const evaluation: Evaluation = {
      score: input.score,
      notes,
      trialTimeSeconds: isTrial && !input.trialNotCompleted ? Math.round((input.trialTimeSeconds ?? 0) * 100) / 100 : undefined,
      trialNotCompleted: isTrial ? !!input.trialNotCompleted : undefined,
      videoSrc: isTrial ? (input.videoSrc ?? before?.videoSrc) : undefined,
      videoThumbnail: isTrial ? (input.videoThumbnail ?? before?.videoThumbnail) : undefined,
      evaluatedAt: before?.evaluatedAt ?? at.toISOString(),
      evaluatedBy: before?.evaluatedBy ?? actor.id,
      editedAt: before ? at.toISOString() : undefined,
    };
    row.evaluation = evaluation;
    touch(row, at);

    const present = presentRows(db, session);
    const remaining = present.filter((item) => !item.evaluation).length;
    let completed = false;
    if (session.status === 'AWAITING_REVIEW' && remaining === 0) {
      session.status = 'COMPLETED';
      session.completedAt = at.toISOString();
      touch(session, at);
      completed = true;
    }

    const horse = findHorse(db, horseId);
    if (!before && horse?.ownerId) {
      notifyMany(db, at, [horse.ownerId], {
        level: 'NORMAL',
        title: evaluation.videoSrc ? `${horse.name} có video chạy thử mới` : `${horse.name} có nhận xét mới`,
        body: `${classOf(db, session.classId)?.name ?? ''} · ${formatDate(session.date)}: ${notes.slice(0, 90)}`,
        link: links.horse(horse.id, 'training'),
      });
    }
    writeAudit(db, at, {
      action: before ? 'Sửa đánh giá ngựa trong buổi' : 'Chấm điểm ngựa trong buổi',
      entityType: 'SessionAttendance',
      entityId: row.id,
      horseId,
      before: before ? { score: before.score, trialTimeSeconds: before.trialTimeSeconds } : undefined,
      after: { score: evaluation.score, trialTimeSeconds: evaluation.trialTimeSeconds, sessionCompleted: completed },
      actor,
    });
    return { completed, remaining };
  });
}

/* ===================================================================== */
/* ===== F2.10 — tiến độ và biểu đồ thể lực ===== */
/* ===================================================================== */

interface HorseStats {
  attendance: { present: number; total: number; rate: number | null };
  avgScore14: number | null;
  scored14: number;
  alerts7: number;
  redAlerts7: number;
  lastTrial?: { date: string; seconds?: number; notCompleted?: boolean; distanceM: number };
}

/** Các dòng tham gia của ngựa trong buổi đã chạy (có mặt hoặc vắng), kèm buổi. */
function pastRowsOf(db: Database, horseId: string) {
  return db.attendances
    .filter((row) => row.horseId === horseId && row.status !== 'EXPECTED')
    .map((row) => ({ row, session: db.sessions.find((item) => item.id === row.sessionId) }))
    .filter(
      (item): item is { row: SessionAttendance; session: ClassSession } =>
        !!item.session && (item.session.status === 'AWAITING_REVIEW' || item.session.status === 'COMPLETED'),
    )
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.session.slotId.localeCompare(b.session.slotId));
}

function horseStats(db: Database, horseId: string, at: Date): HorseStats {
  const today = toDateKey(at);
  const from28 = toDateKey(addDays(at, -27));
  const from14 = toDateKey(addDays(at, -13));
  const since7 = at.getTime() - 7 * 24 * HOUR_MS;
  const past = pastRowsOf(db, horseId);
  const window28 = past.filter((item) => item.session.date >= from28 && item.session.date <= today);
  const present = window28.filter((item) => item.row.status === 'PRESENT').length;
  const scores = past
    .filter((item) => item.session.date >= from14 && item.row.evaluation)
    .map((item) => item.row.evaluation!.score);
  const alerts = db.alerts.filter((alert) => alert.horseId === horseId && new Date(alert.at).getTime() >= since7);
  const trial = [...past]
    .reverse()
    .find((item) => item.session.workoutType === 'TIME_TRIAL' && item.row.status === 'PRESENT' && item.row.evaluation);
  return {
    attendance: { present, total: window28.length, rate: window28.length ? present / window28.length : null },
    avgScore14: scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null,
    scored14: scores.length,
    alerts7: alerts.length,
    redAlerts7: alerts.filter((alert) => alert.level === 'RED').length,
    lastTrial: trial
      ? {
          date: trial.session.date,
          seconds: trial.row.evaluation?.trialTimeSeconds,
          notCompleted: trial.row.evaluation?.trialNotCompleted,
          distanceM: trial.session.distanceM,
        }
      : undefined,
  };
}

export function getProgressBoard(): Promise<ProgressBoard> {
  return query((db) => {
    const user = requirePermission('progress.view');
    const at = now();
    const todayKey = toDateKey(at);
    const horses = visibleHorses(db, user).filter((horse) => !horse.deletedAt && horse.lifecycleStatus === 'ACTIVE');

    const rows: ProgressRow[] = horses.map((horse) => {
      const stats = horseStats(db, horse.id, at);
      const trainable = canTrainAtAll(db, horse);
      const next = horseSchedule(db, horse.id, todayKey, toDateKey(addDays(at, 30))).find(
        (entry) => entry.session.status === 'SCHEDULED' && entry.attendance?.status !== 'ABSENT',
      );
      return {
        horseId: horse.id,
        horseName: horse.name,
        avatar: horse.avatar,
        zoneId: horse.zoneId,
        zoneName: db.zones.find((zone) => zone.id === horse.zoneId)?.name,
        healthStatus: horse.healthStatus,
        locked: !!activeLock(db, horse.id),
        classes: activeEnrollments(db, horse.id, todayKey).map((item) => ({
          id: item.classId,
          name: classOf(db, item.classId)?.name ?? '—',
        })),
        ...stats,
        trainable: { allowed: trainable.allowed, reason: trainable.reason },
        maxHeartRate: maxHeartRateOf(db, horse.id),
        nextSession: next
          ? { date: next.session.date, slotLabel: slotLabel(db, next.session.slotId), className: next.cls.name }
          : undefined,
      };
    });

    const zoneIds = [...new Set(rows.map((row) => row.zoneId).filter(Boolean) as string[])];
    const zones: ZoneProgress[] = zoneIds.map((zoneId) => {
      const zone = db.zones.find((item) => item.id === zoneId);
      const inZone = rows.filter((row) => row.zoneId === zoneId);
      const present = inZone.reduce((sum, row) => sum + row.attendance.present, 0);
      const total = inZone.reduce((sum, row) => sum + row.attendance.total, 0);
      const scored = inZone.filter((row) => row.avgScore14 !== null);
      return {
        zoneId,
        zoneName: zone?.name ?? '—',
        trainerName: zone?.headTrainerId ? userName(db, zone.headTrainerId) : undefined,
        horseCount: inZone.length,
        attendanceRate: total ? present / total : null,
        avgScore: scored.length
          ? Math.round((scored.reduce((sum, row) => sum + (row.avgScore14 ?? 0), 0) / scored.length) * 10) / 10
          : null,
        alerts7: inZone.reduce((sum, row) => sum + row.alerts7, 0),
        blocked: inZone.filter((row) => !row.trainable.allowed).length,
      };
    });

    return {
      rows: rows.sort(
        (a, b) =>
          b.redAlerts7 - a.redAlerts7 ||
          Number(a.trainable.allowed) - Number(b.trainable.allowed) ||
          a.horseName.localeCompare(b.horseName, 'vi'),
      ),
      zones: zones.sort((a, b) => a.zoneName.localeCompare(b.zoneName, 'vi')),
    };
  });
}

/** Dữ liệu tab Huấn luyện trong hồ sơ ngựa. GROOM không xem (F1.3). */
export function getHorseTraining(horseId: string): Promise<HorseTrainingView> {
  return query((db) => {
    const user = requireUser();
    if (user.role === 'GROOM') throw new AppError(ERR_FORBIDDEN);
    if (!canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
    const horse = findHorse(db, horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    const todayKey = toDateKey(at);
    const trainable = canTrainAtAll(db, horse);

    const classes = db.enrollments
      .filter((item) => item.horseId === horseId)
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
      .map((item) => {
        const cls = classOf(db, item.classId);
        const status = cls ? classStatus(cls, todayKey) : 'CANCELLED';
        return {
          enrollmentId: item.id,
          classId: item.classId,
          className: cls?.name ?? '—',
          zoneName: db.zones.find((zone) => zone.id === cls?.zoneId)?.name,
          slotLabel: cls ? slotLabel(db, cls.slotId) : '—',
          joinedAt: item.joinedAt,
          withdrawnAt: item.withdrawnAt,
          withdrawLabel: item.withdrawReason ? enrollmentCloseLabel[item.withdrawReason] : undefined,
          withdrawNote: item.withdrawNote,
          open: !item.withdrawnAt && (status === 'SCHEDULED' || status === 'ACTIVE'),
          classStatusLabel:
            status === 'ACTIVE' ? 'Đang chạy' : status === 'SCHEDULED' ? 'Sắp tới' : status === 'COMPLETED' ? 'Đã kết thúc' : 'Đã hủy',
        };
      });

    const upcoming = horseSchedule(db, horseId, todayKey, toDateKey(addDays(at, 13)))
      .filter((entry) => entry.session.status === 'SCHEDULED' || entry.session.status === 'IN_PROGRESS' || entry.session.status === 'CANCELLED')
      .map((entry) => ({
        sessionId: entry.session.id,
        date: entry.session.date,
        slotLabel: slotLabel(db, entry.session.slotId),
        className: entry.cls.name,
        subjectName: entry.session.subjectName,
        workoutType: entry.session.workoutType,
        distanceM: entry.session.distanceM,
        repetitions: entry.session.repetitions,
        intensity: entry.session.intensity,
        status: entry.session.status,
        attendanceStatus: entry.attendance?.status,
        absenceLabel: entry.attendance?.absenceReason ? absenceLabel[entry.attendance.absenceReason] : undefined,
      }));

    const past = pastRowsOf(db, horseId);
    const results = [...past]
      .reverse()
      .slice(0, 30)
      .map(({ row, session }) => ({
        sessionId: session.id,
        date: session.date,
        className: classOf(db, session.classId)?.name ?? '—',
        subjectName: session.subjectName,
        workoutType: session.workoutType,
        distanceM: session.distanceM,
        repetitions: session.repetitions,
        intensity: session.intensity,
        sessionStatus: session.status,
        endLabel: session.endReason && session.endReason !== 'NORMAL' ? sessionEndLabel[session.endReason] : undefined,
        attendanceStatus: row.status,
        absenceLabel: row.absenceReason ? absenceLabel[row.absenceReason] : undefined,
        absenceNote: row.absenceNote,
        summary: row.summary,
        evaluation: toEvaluationView(db, row.evaluation),
        stoppedReason: row.stoppedAtSecond !== undefined ? row.stopReason ?? 'Đã dừng giữa buổi' : undefined,
      }));

    const stats = horseStats(db, horseId, at);
    const presentPast = past.filter((item) => item.row.status === 'PRESENT');
    const canSeeMaxHr = user.role === 'CLUB_MANAGER' || user.role === 'HEAD_TRAINER' || user.role === 'VETERINARIAN';
    return {
      horseId,
      horseName: horse.name,
      lifecycleStatus: horse.lifecycleStatus,
      trainable: { allowed: trainable.allowed, reason: trainable.reason },
      classes,
      upcoming,
      results,
      kpi: {
        attendance28: stats.attendance,
        avgScore14: stats.avgScore14,
        alerts7: stats.alerts7,
        sessionsDone: presentPast.length,
        lastTrial: stats.lastTrial,
      },
      scoreSeries: presentPast
        .filter((item) => item.row.evaluation)
        .map((item) => ({ date: item.session.date, value: item.row.evaluation!.score })),
      trialSeries: presentPast
        .filter((item) => item.session.workoutType === 'TIME_TRIAL' && item.row.evaluation?.trialTimeSeconds)
        .map((item) => ({ date: item.session.date, distanceM: item.session.distanceM, value: item.row.evaluation!.trialTimeSeconds! })),
      cardiacSeries: presentPast
        .filter((item) => item.row.summary && item.row.summary.mainAvgHeartRate > 0)
        .map((item) => ({
          date: item.session.date,
          workoutType: item.session.workoutType,
          value: Math.round((item.row.summary!.mainAvgSpeedMps / item.row.summary!.mainAvgHeartRate) * 1000) / 10,
        })),
      maxHeartRate: {
        current: canSeeMaxHr ? maxHeartRateOf(db, horseId) : undefined,
        suggested: db.settings.defaultMaxHeartRate,
        canView: canSeeMaxHr,
        canEdit: inActionScope(db, user, 'maxhr.edit', horseId),
      },
    };
  });
}

export function listTimeTrials(horseId?: string): Promise<TimeTrialRow[]> {
  return query((db) => {
    const user = requirePermission('progress.view');
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    return db.attendances
      .filter((row) => row.status === 'PRESENT' && allowed.has(row.horseId) && (!horseId || row.horseId === horseId))
      .map((row) => ({ row, session: db.sessions.find((item) => item.id === row.sessionId) }))
      .filter(
        (item): item is { row: SessionAttendance; session: ClassSession } =>
          !!item.session && item.session.workoutType === 'TIME_TRIAL' && !!item.row.evaluation,
      )
      .sort((a, b) => b.session.date.localeCompare(a.session.date))
      .map(({ row, session }) => ({
        sessionId: session.id,
        horseId: row.horseId,
        horseName: horseNameOf(db, row.horseId),
        date: session.date,
        className: classOf(db, session.classId)?.name ?? '—',
        distanceM: session.distanceM,
        surface: session.surface,
        seconds: row.evaluation?.trialTimeSeconds,
        notCompleted: row.evaluation?.trialNotCompleted,
        videoSrc: row.evaluation?.videoSrc,
        score: row.evaluation?.score,
      }));
  });
}

/* ===================================================================== */
/* ===== F2.11 — nhịp tim tối đa ===== */
/* ===================================================================== */

function requireMaxHrViewer(): User {
  const user = requireUser();
  if (user.role !== 'CLUB_MANAGER' && user.role !== 'HEAD_TRAINER' && user.role !== 'VETERINARIAN') {
    throw new AppError(ERR_FORBIDDEN);
  }
  return user;
}

/** Ngưỡng hiện tại (không có giá trị dự phòng cho R1), gợi ý mặc định và lịch sử. */
export function getMaxHeartRate(horseId: string): Promise<MaxHeartRateView> {
  return query((db) => {
    const user = requireMaxHrViewer();
    const horse = findHorse(db, horseId);
    if (!horse || !canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
    return {
      horseId,
      horseName: horse.name,
      current: maxHeartRateOf(db, horseId),
      suggested: db.settings.defaultMaxHeartRate,
      history: db.maxHeartRates
        .filter((item) => item.horseId === horseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((item) => ({
          id: item.id,
          value: item.value,
          reason: item.reason,
          active: item.active,
          createdAt: item.createdAt,
          createdByName: userName(db, item.createdBy),
        })),
      canEdit: inActionScope(db, user, 'maxhr.edit', horseId),
    };
  });
}

export function setMaxHeartRate(horseId: string, value: number, reason: string) {
  return commit((db) => {
    const actor = requirePermission('maxhr.edit');
    const horse = findHorse(db, horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, actor, 'maxhr.edit', horseId)) throw new AppError('Hồ sơ ngựa chỉ đọc, không đặt được ngưỡng');
    if (!Number.isInteger(value) || value < 180 || value > 260) {
      throw new AppError('Nhịp tim tối đa phải là số nguyên trong khoảng 180–260 nhịp/phút', 'value');
    }
    const text = reason.trim();
    if (text.length < 5) throw new AppError('Vui lòng ghi rõ lý do (ít nhất 5 ký tự)', 'reason');
    const at = now();
    const before = maxHeartRateOf(db, horseId);
    if (before === value) throw new AppError('Giá trị mới trùng với ngưỡng đang áp dụng', 'value');
    db.maxHeartRates
      .filter((item) => item.horseId === horseId && item.active)
      .forEach((item) => {
        item.active = false;
        touch(item, at);
      });
    const entry = { id: newId('mhr'), horseId, value, reason: text, createdBy: actor.id, active: true, ...stamp(at) };
    db.maxHeartRates.push(entry);
    writeAudit(db, at, {
      action: before === undefined ? 'Đặt nhịp tim tối đa' : 'Sửa nhịp tim tối đa',
      entityType: 'HorseMaxHeartRate',
      entityId: entry.id,
      horseId,
      before: { value: before ?? null },
      after: { value },
      reason: text,
      actor,
    });
  });
}

export function clearMaxHeartRate(horseId: string, reason: string) {
  return commit((db) => {
    const actor = requirePermission('maxhr.edit');
    const horse = findHorse(db, horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, actor, 'maxhr.edit', horseId)) throw new AppError('Hồ sơ ngựa chỉ đọc, không sửa được ngưỡng');
    const active = db.maxHeartRates.filter((item) => item.horseId === horseId && item.active);
    if (active.length === 0) throw new AppError('Ngựa chưa có ngưỡng nhịp tim để xóa');
    const text = reason.trim();
    if (text.length < 5) throw new AppError('Vui lòng ghi rõ lý do (ít nhất 5 ký tự)', 'reason');
    const at = now();
    const before = maxHeartRateOf(db, horseId);
    active.forEach((item) => {
      item.active = false;
      touch(item, at);
    });
    writeAudit(db, at, {
      action: 'Xóa nhịp tim tối đa',
      entityType: 'HorseMaxHeartRate',
      entityId: active[0].id,
      horseId,
      before: { value: before },
      after: { value: null },
      reason: text,
      actor,
    });
  });
}

/** Bảng ngưỡng nhịp tim của ngựa còn ở CLB (ACTIVE/RETIRED). */
export function listMaxHeartRates(): Promise<MaxHeartRateRow[]> {
  return query((db) => {
    const user = requireMaxHrViewer();
    const at = now();
    const todayKey = toDateKey(at);
    const weekEnd = toDateKey(addDays(at, 6));
    return db.horses
      .filter((horse) => !horse.deletedAt && horse.lifecycleStatus !== 'TRANSFERRED')
      .map((horse) => {
        const active = db.maxHeartRates.find((item) => item.horseId === horse.id && item.active);
        return {
          horseId: horse.id,
          horseName: horse.name,
          avatar: horse.avatar,
          zoneName: db.zones.find((zone) => zone.id === horse.zoneId)?.name,
          lifecycleStatus: horse.lifecycleStatus,
          healthStatus: horse.healthStatus,
          current: active?.value,
          setAt: active?.createdAt,
          setByName: active ? userName(db, active.createdBy) : undefined,
          reason: active?.reason,
          upcoming7: horseSchedule(db, horse.id, todayKey, weekEnd).filter(
            (entry) => entry.session.status === 'SCHEDULED' && entry.attendance?.status !== 'ABSENT',
          ).length,
          suggested: db.settings.defaultMaxHeartRate,
          canEdit: inActionScope(db, user, 'maxhr.edit', horse.id),
        };
      })
      .sort(
        (a, b) =>
          Number(a.current !== undefined) - Number(b.current !== undefined) ||
          b.upcoming7 - a.upcoming7 ||
          a.horseName.localeCompare(b.horseName, 'vi'),
      );
  });
}

/** Nhãn loại bài dùng lại ở màn hình (để trang không phải tự ghép). */
export function describeWorkout(input: { workoutType: WorkoutType; distanceM: number; repetitions: number }): string {
  return `${workoutLabel[input.workoutType]} ${input.distanceM.toLocaleString('vi-VN')} m${input.repetitions > 1 ? ` × ${input.repetitions}` : ''}`;
}
