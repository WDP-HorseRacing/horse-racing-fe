// Flow 3 — y tế và xử lý chấn thương (F3.1–F3.10).
// Nguyên tắc hiển thị được áp ngay trong service (A.8.2):
//   - GROOM không nhận nội dung bệnh án / buổi khám; chỉ gửi và xem yêu cầu khám của chính mình.
//   - HT xem toàn bộ nội dung y tế TRỪ chi phí (không trả trường cost).
//   - OWNER chỉ thấy ngựa của mình, và chỉ thấy chi phí của bệnh án ĐÃ ĐÓNG.
//   - Tổng chi phí y tế của ngựa = tổng chi phí các bệnh án đã đóng.
import type {
  Database,
  ExamRequest,
  ExamRequestSource,
  ExamRequestStatus,
  ExamUrgency,
  Examination,
  ExaminationKind,
  HealthStatus,
  Horse,
  LifecycleStatus,
  LockLiftKind,
  MeasurementType,
  MedicalCase,
  MedicalCaseStatus,
  StallStatus,
  TrainingLock,
  User,
  ZoneStatus,
} from '../types/domain';
import { AppError, ERR_FORBIDDEN, ERR_NOT_FOUND, newId, stamp, touch } from './db';
import { commit, notifyMany, pushNotification, query, requirePermission, requireUser, writeAudit } from './api';
import {
  activeLock,
  findHorse,
  findUser,
  horsesOfZone,
  managerIds,
  openCaseOf,
  periodicStatus,
  stallOf,
  userName,
  zoneOf,
  type PeriodicState,
} from './selectors';
import { applyHealthStatus, createExamRequestInternal, liftLockInternal, placeLockInternal } from './ops';
import { can, canViewHorse, inActionScope, visibleHorses } from '../auth/permissions';
import { checkMeasurement } from '../lib/rules';
import { examKindLabel, examRequestSourceLabel, healthLabel, lockLiftLabel, measurementLabel } from '../lib/labels';
import { daysBetween, formatDate, formatMoney, toDateKey } from '../lib/format';
import { links } from '../lib/links';
import { now } from '../lib/clock';

/* ===================================================================== */
/* ===== Kiểu dữ liệu trả về cho giao diện ============================= */
/* ===================================================================== */

export interface MedHorseRef {
  id: string;
  name: string;
  avatar?: string;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  deleted: boolean;
  zoneName?: string;
  stallCode?: string;
}

export interface ExamRequestRow {
  id: string;
  horse: MedHorseRef;
  source: ExamRequestSource;
  sourceLabel: string;
  urgency: ExamUrgency;
  description: string;
  /** Mô tả tách dòng (yêu cầu cùng nguồn được gộp bằng "• "). */
  descriptionLines: string[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  status: ExamRequestStatus;
  examinationId?: string;
  examinedAt?: string;
  /** Bệnh án của buổi khám đã xử lý — không trả cho GROOM. */
  caseId?: string;
  caseTitle?: string;
  resolvedAt?: string;
  dismissedByName?: string;
  dismissReason?: string;
  canDismiss: boolean;
  canExamine: boolean;
}

export interface MetricReading {
  type: MeasurementType;
  label: string;
  unit: string;
  value: number;
  abnormal: boolean;
}

export interface ExamCard {
  id: string;
  horse: MedHorseRef;
  kind: ExaminationKind;
  kindLabel: string;
  caseId?: string;
  caseTitle?: string;
  /** Buổi đầu tiên của bệnh án (buổi mở bệnh án). */
  opensCase: boolean;
  examinedAt: string;
  vetId: string;
  vetName: string;
  diagnosisAndTreatment: string;
  healthStatusBefore: HealthStatus;
  healthStatusAfter: HealthStatus;
  nextAppointment?: string;
  metrics: MetricReading[];
  linkedRequests: {
    id: string;
    sourceLabel: string;
    urgency: ExamUrgency;
    description: string;
    createdByName: string;
    createdAt: string;
  }[];
  corrections: { note: string; byName: string; at: string }[];
  canCorrect: boolean;
}

export interface LockRow {
  id: string;
  horse: MedHorseRef;
  reason: string;
  placedAt: string;
  placedByName: string;
  expectedLiftDate?: string;
  /** Đã qua ngày dự kiến gỡ nhưng bác sĩ chưa gỡ — không tự gỡ. */
  pastExpected: boolean;
  caseId?: string;
  caseTitle?: string;
  active: boolean;
  liftedAt?: string;
  liftedByName?: string;
  liftReason?: string;
  liftKind?: LockLiftKind;
  liftKindLabel?: string;
  canLift: boolean;
}

export interface CaseRow {
  id: string;
  horse: MedHorseRef;
  title: string;
  status: MedicalCaseStatus;
  openedAt: string;
  openedByName: string;
  closedAt?: string;
  closedByName?: string;
  closeNote?: string;
  examCount: number;
  lastExamAt?: string;
  /** Mở từ một buổi khám định kỳ phát hiện vấn đề. */
  fromPeriodic: boolean;
  nextAppointment?: string;
  activeLock?: { id: string; reason: string; expectedLiftDate?: string };
  /** Chỉ có khi người xem được phép thấy (không bao giờ trả cho HT; OWNER chỉ khi đã đóng). */
  cost?: number;
  costVisible: boolean;
}

export interface HealthLogRow {
  id: string;
  fromStatus: HealthStatus;
  toStatus: HealthStatus;
  reason: string;
  changedAt: string;
  changedByName: string;
  examinationId?: string;
  caseId?: string;
  caseTitle?: string;
  /** Bác sĩ đổi trực tiếp, không qua buổi khám. */
  direct: boolean;
}

export type PeriodicRowState = Exclude<PeriodicState, 'NONE'>;

export const periodicStateLabel: Record<PeriodicRowState, string> = {
  OK: 'Đúng hạn',
  DUE_SOON: 'Sắp tới hạn',
  OVERDUE: 'Quá hạn',
  OVERDUE_ALERT: 'Quá hạn > 7 ngày',
};

export interface PeriodicRow {
  horse: MedHorseRef;
  lastExamAt?: string;
  lastExamKind?: ExaminationKind;
  lastExamCaseId?: string;
  neverExamined: boolean;
  /** Mốc tính hạn: buổi khám gần nhất, chưa khám thì ngày tạo hồ sơ. */
  baseDate: string;
  dueDate: string;
  /** Số ngày đã quá hạn (âm = còn bao nhiêu ngày nữa tới hạn). */
  overdueDays: number;
  state: PeriodicRowState;
  stateLabel: string;
  /** Đã gửi cảnh báo quá hạn > 7 ngày cho VET và CM. */
  alerted: boolean;
  openCase?: { id: string; title: string };
  canExamine: boolean;
}

export interface MedicalHorseOption {
  id: string;
  name: string;
  avatar?: string;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  zoneName?: string;
  stallCode?: string;
  openCase?: { id: string; title: string };
  activeLock?: { id: string; reason: string };
  pendingRequestCount: number;
}

export interface BoardHorse {
  id: string;
  name: string;
  avatar?: string;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  locked: boolean;
  lockReason?: string;
  openCaseId?: string;
  pendingRequests: number;
  urgentRequest: boolean;
}

export interface BoardZone {
  id: string;
  code: string;
  name: string;
  status: ZoneStatus;
  trainerName?: string;
  cells: { stallId: string; code: string; status: StallStatus; horse?: BoardHorse }[];
  /** Ngựa thuộc khu nhưng chưa có ô. */
  waiting: BoardHorse[];
}

/* ===================================================================== */
/* ===== Tiện ích nội bộ =============================================== */
/* ===================================================================== */

function inClub(horse: Horse): boolean {
  return !horse.deletedAt && horse.lifecycleStatus !== 'TRANSFERRED';
}

function horseRef(db: Database, horse: Horse): MedHorseRef {
  return {
    id: horse.id,
    name: horse.name,
    avatar: horse.avatar,
    healthStatus: horse.healthStatus,
    lifecycleStatus: horse.lifecycleStatus,
    deleted: !!horse.deletedAt,
    zoneName: zoneOf(db, horse)?.name,
    stallCode: stallOf(db, horse)?.code,
  };
}

function refById(db: Database, horseId: string): MedHorseRef {
  const horse = findHorse(db, horseId);
  if (horse) return horseRef(db, horse);
  return { id: horseId, name: 'Ngựa không xác định', healthStatus: 'ELIGIBLE', lifecycleStatus: 'ACTIVE', deleted: true };
}

/** Các ngựa người dùng được xem nội dung y tế (OWNER: ngựa của mình). */
function medicalHorseIds(db: Database, user: User): Set<string> {
  return new Set(visibleHorses(db, user).map((horse) => horse.id));
}

/** Chi phí chỉ trả về khi được phép: CM/VET khi đã đóng; OWNER khi đã đóng; HT không bao giờ. */
function visibleCost(user: User, item: MedicalCase): number | undefined {
  if (item.status !== 'CLOSED' || item.cost === undefined) return undefined;
  if (!can(user, 'medical.cost.view')) return undefined;
  return item.cost;
}

function caseTitle(item?: MedicalCase): string {
  return item?.title?.trim() || 'Bệnh án chưa đặt tiêu đề';
}

function descriptionLines(description: string): string[] {
  return description
    .split('\n')
    .map((line) => line.replace(/^\s*•\s*/, '').trim())
    .filter(Boolean);
}

function assertVisibleHorse(db: Database, user: User, horseId: string): Horse {
  const horse = findHorse(db, horseId);
  if (!horse || !canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
  return horse;
}

function assertHorseInClub(horse: Horse, what: string) {
  if (horse.deletedAt) throw new AppError(`Hồ sơ ${horse.name} đã bị xóa — không thể ${what}`);
  if (horse.lifecycleStatus === 'TRANSFERRED') {
    throw new AppError(`${horse.name} đã chuyển nhượng, hồ sơ chỉ đọc — không thể ${what}`);
  }
}

function requireText(value: string | undefined, min: number, message: string, field: string): string {
  const text = (value ?? '').trim();
  if (text.length < min) throw new AppError(message, field);
  return text;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function casesOfHorse(db: Database, horseId: string): MedicalCase[] {
  return db.medicalCases.filter((item) => item.horseId === horseId);
}

function examsOfCase(db: Database, caseId: string): Examination[] {
  return db.examinations
    .filter((exam) => exam.caseId === caseId)
    .sort((a, b) => a.examinedAt.localeCompare(b.examinedAt));
}

function requestRow(db: Database, user: User, request: ExamRequest): ExamRequestRow {
  const exam = request.examinationId ? db.examinations.find((item) => item.id === request.examinationId) : undefined;
  const medicalCase = exam?.caseId ? db.medicalCases.find((item) => item.id === exam.caseId) : undefined;
  const seesMedical = can(user, 'medical.view');
  return {
    id: request.id,
    horse: refById(db, request.horseId),
    source: request.source,
    sourceLabel: examRequestSourceLabel[request.source],
    urgency: request.urgency,
    description: request.description,
    descriptionLines: descriptionLines(request.description),
    createdBy: request.createdBy,
    createdByName: userName(db, request.createdBy),
    createdAt: request.createdAt,
    status: request.status,
    examinationId: seesMedical ? request.examinationId : undefined,
    examinedAt: exam?.examinedAt,
    caseId: seesMedical ? medicalCase?.id : undefined,
    caseTitle: seesMedical && medicalCase ? caseTitle(medicalCase) : undefined,
    resolvedAt: request.resolvedAt,
    dismissedByName: request.dismissedBy ? userName(db, request.dismissedBy) : undefined,
    dismissReason: request.dismissReason,
    canDismiss: request.status === 'PENDING' && can(user, 'examRequest.dismiss'),
    canExamine:
      request.status === 'PENDING' &&
      can(user, 'exam.record') &&
      !!findHorse(db, request.horseId) &&
      inClub(findHorse(db, request.horseId)!),
  };
}

function metricsOf(db: Database, examId: string): MetricReading[] {
  const order: MeasurementType[] = ['WEIGHT', 'HEIGHT', 'BODY_CONDITION', 'TEMPERATURE'];
  return db.bodyMeasurements
    .filter((item) => item.examinationId === examId && !item.deletedAt)
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .map((item) => ({
      type: item.type,
      label: measurementLabel[item.type].name,
      unit: measurementLabel[item.type].unit,
      value: item.value,
      abnormal: item.abnormal,
    }));
}

function examCard(db: Database, user: User, exam: Examination): ExamCard {
  const medicalCase = exam.caseId ? db.medicalCases.find((item) => item.id === exam.caseId) : undefined;
  const firstOfCase = medicalCase ? examsOfCase(db, medicalCase.id)[0] : undefined;
  const horse = findHorse(db, exam.horseId);
  return {
    id: exam.id,
    horse: refById(db, exam.horseId),
    kind: exam.kind,
    kindLabel: examKindLabel[exam.kind],
    caseId: medicalCase?.id,
    caseTitle: medicalCase ? caseTitle(medicalCase) : undefined,
    opensCase: !!firstOfCase && firstOfCase.id === exam.id,
    examinedAt: exam.examinedAt,
    vetId: exam.vetId,
    vetName: userName(db, exam.vetId),
    diagnosisAndTreatment: exam.diagnosisAndTreatment,
    healthStatusBefore: exam.healthStatusBefore,
    healthStatusAfter: exam.healthStatusAfter,
    nextAppointment: exam.nextAppointment,
    metrics: metricsOf(db, exam.id),
    linkedRequests: exam.linkedRequestIds
      .map((requestId) => db.examRequests.find((item) => item.id === requestId))
      .filter((item): item is ExamRequest => !!item)
      .map((item) => ({
        id: item.id,
        sourceLabel: examRequestSourceLabel[item.source],
        urgency: item.urgency,
        description: item.description,
        createdByName: userName(db, item.createdBy),
        createdAt: item.createdAt,
      })),
    corrections: exam.corrections.map((item) => ({ note: item.note, byName: userName(db, item.by), at: item.at })),
    canCorrect: can(user, 'exam.record') && !!horse && inClub(horse),
  };
}

function lockRow(db: Database, user: User, lock: TrainingLock, todayKey: string): LockRow {
  const medicalCase = lock.caseId ? db.medicalCases.find((item) => item.id === lock.caseId) : undefined;
  const horse = findHorse(db, lock.horseId);
  const active = !lock.liftedAt;
  return {
    id: lock.id,
    horse: refById(db, lock.horseId),
    reason: lock.reason,
    placedAt: lock.placedAt,
    placedByName: userName(db, lock.placedBy),
    expectedLiftDate: lock.expectedLiftDate,
    pastExpected: active && !!lock.expectedLiftDate && lock.expectedLiftDate < todayKey,
    caseId: medicalCase?.id,
    caseTitle: medicalCase ? caseTitle(medicalCase) : undefined,
    active,
    liftedAt: lock.liftedAt,
    liftedByName: lock.liftedAt ? userName(db, lock.liftedBy) : undefined,
    liftReason: lock.liftReason,
    liftKind: lock.liftKind,
    liftKindLabel: lock.liftKind ? lockLiftLabel[lock.liftKind] : undefined,
    canLift: active && !!horse && inActionScope(db, user, 'lock.manage', horse.id),
  };
}

function caseRow(db: Database, user: User, item: MedicalCase): CaseRow {
  const exams = examsOfCase(db, item.id);
  const last = exams[exams.length - 1];
  const lock = db.trainingLocks.find((entry) => entry.caseId === item.id && !entry.liftedAt);
  const withAppointment = [...exams].reverse().find((exam) => exam.nextAppointment);
  return {
    id: item.id,
    horse: refById(db, item.horseId),
    title: caseTitle(item),
    status: item.status,
    openedAt: item.openedAt,
    openedByName: userName(db, item.openedBy),
    closedAt: item.closedAt,
    closedByName: item.closedBy ? userName(db, item.closedBy) : undefined,
    closeNote: item.closeNote,
    examCount: exams.length,
    lastExamAt: last?.examinedAt,
    fromPeriodic: exams[0]?.kind === 'PERIODIC',
    nextAppointment: item.status === 'OPEN' ? withAppointment?.nextAppointment : undefined,
    activeLock: lock ? { id: lock.id, reason: lock.reason, expectedLiftDate: lock.expectedLiftDate } : undefined,
    cost: visibleCost(user, item),
    costVisible: can(user, 'medical.cost.view'),
  };
}

function healthLogRow(db: Database, log: Database['healthStatusLogs'][number]): HealthLogRow {
  const exam = log.examinationId ? db.examinations.find((item) => item.id === log.examinationId) : undefined;
  const medicalCase = exam?.caseId ? db.medicalCases.find((item) => item.id === exam.caseId) : undefined;
  return {
    id: log.id,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    reason: log.reason,
    changedAt: log.changedAt,
    changedByName: userName(db, log.changedBy),
    examinationId: log.examinationId,
    caseId: medicalCase?.id,
    caseTitle: medicalCase ? caseTitle(medicalCase) : undefined,
    direct: !log.examinationId,
  };
}

function periodicRow(db: Database, user: User, horse: Horse, at: Date): PeriodicRow | undefined {
  const status = periodicStatus(db, horse, at);
  if (status.state === 'NONE') return undefined;
  const lastExam = status.lastExamAt
    ? db.examinations.find((exam) => exam.horseId === horse.id && exam.examinedAt === status.lastExamAt)
    : undefined;
  const open = openCaseOf(db, horse.id);
  return {
    horse: horseRef(db, horse),
    lastExamAt: status.lastExamAt,
    lastExamKind: lastExam?.kind,
    lastExamCaseId: lastExam?.caseId,
    neverExamined: !status.lastExamAt,
    baseDate: status.lastExamAt ?? horse.createdAt,
    dueDate: status.dueDate,
    overdueDays: status.overdueDays,
    state: status.state,
    stateLabel: periodicStateLabel[status.state],
    alerted: status.state === 'OVERDUE_ALERT' && horse.periodicOverdueNotifiedFor === status.dueDate,
    openCase: open ? { id: open.id, title: caseTitle(open) } : undefined,
    canExamine: can(user, 'exam.record'),
  };
}

function boardHorse(db: Database, horse: Horse): BoardHorse {
  const lock = activeLock(db, horse.id);
  const pending = db.examRequests.filter((item) => item.horseId === horse.id && item.status === 'PENDING');
  return {
    id: horse.id,
    name: horse.name,
    avatar: horse.avatar,
    healthStatus: horse.healthStatus,
    lifecycleStatus: horse.lifecycleStatus,
    locked: !!lock,
    lockReason: lock?.reason,
    openCaseId: openCaseOf(db, horse.id)?.id,
    pendingRequests: pending.length,
    urgentRequest: pending.some((item) => item.urgency === 'URGENT'),
  };
}

function sortPending(a: ExamRequest, b: ExamRequest): number {
  if (a.urgency !== b.urgency) return a.urgency === 'URGENT' ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt);
}

/* ===================================================================== */
/* ===== F3.1 — Bảng điều khiển y tế =================================== */
/* ===================================================================== */

export function getMedicalBoard() {
  return query((db) => {
    const user = requirePermission('medical.board');
    const at = now();
    const todayKey = toDateKey(at);
    const clubHorses = db.horses.filter(inClub);

    const counts: Record<HealthStatus, number> = { ELIGIBLE: 0, UNDER_OBSERVATION: 0, INJURED: 0, QUARANTINED: 0 };
    clubHorses.forEach((horse) => {
      counts[horse.healthStatus] += 1;
    });

    const pendingRequests = db.examRequests
      .filter((item) => item.status === 'PENDING')
      .sort(sortPending)
      .map((item) => requestRow(db, user, item));

    const periodic = clubHorses
      .map((horse) => periodicRow(db, user, horse, at))
      .filter((row): row is PeriodicRow => !!row);
    const periodicDue = periodic
      .filter((row) => row.state !== 'OK')
      .sort((a, b) => b.overdueDays - a.overdueDays);

    const openCases = db.medicalCases
      .filter((item) => item.status === 'OPEN')
      .map((item) => caseRow(db, user, item))
      .sort((a, b) => (a.nextAppointment ?? '9999').localeCompare(b.nextAppointment ?? '9999'));

    const activeLocks = db.trainingLocks
      .filter((lock) => !lock.liftedAt)
      .map((lock) => lockRow(db, user, lock, todayKey))
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt));

    const zones: BoardZone[] = db.zones
      .filter((zone) => !zone.deletedAt)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((zone) => {
        const zoneHorses = horsesOfZone(db, zone.id).filter(inClub);
        return {
          id: zone.id,
          code: zone.code,
          name: zone.name,
          status: zone.status,
          trainerName: zone.headTrainerId ? findUser(db, zone.headTrainerId)?.name : undefined,
          cells: db.stalls
            .filter((stall) => stall.zoneId === zone.id && !stall.deletedAt)
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((stall) => {
              const horse = zoneHorses.find((item) => item.stallId === stall.id);
              return { stallId: stall.id, code: stall.code, status: stall.status, horse: horse ? boardHorse(db, horse) : undefined };
            }),
          waiting: zoneHorses.filter((horse) => !horse.stallId).map((horse) => boardHorse(db, horse)),
        };
      });
    const noZone = clubHorses.filter((horse) => !horse.zoneId).map((horse) => boardHorse(db, horse));

    return {
      counts,
      totalHorses: clubHorses.length,
      pendingRequests,
      urgentCount: pendingRequests.filter((row) => row.urgency === 'URGENT').length,
      periodicDue,
      periodicAlertCount: periodic.filter((row) => row.state === 'OVERDUE_ALERT').length,
      openCases,
      activeLocks,
      zones,
      noZone,
      canExamine: can(user, 'exam.record'),
      canChangeHealth: can(user, 'health.status.edit'),
      canLock: can(user, 'lock.manage'),
    };
  });
}

/* ===================================================================== */
/* ===== F3.10 — Hồ sơ y tế của một ngựa (tab Y tế) ==================== */
/* ===================================================================== */

export function getHorseMedical(horseId: string) {
  return query((db) => {
    const user = requirePermission('medical.view');
    const horse = assertVisibleHorse(db, user, horseId);
    const at = now();
    const todayKey = toDateKey(at);
    const writable = inClub(horse);

    const cases = casesOfHorse(db, horse.id)
      .map((item) => caseRow(db, user, item))
      .sort((a, b) => (a.status === b.status ? b.openedAt.localeCompare(a.openedAt) : a.status === 'OPEN' ? -1 : 1));
    const exams = db.examinations
      .filter((exam) => exam.horseId === horse.id)
      .sort((a, b) => b.examinedAt.localeCompare(a.examinedAt))
      .map((exam) => examCard(db, user, exam));
    const locks = db.trainingLocks
      .filter((lock) => lock.horseId === horse.id)
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      .map((lock) => lockRow(db, user, lock, todayKey));
    // Yêu cầu khám: OWNER không có quyền xem danh sách yêu cầu (chỉ thấy yêu cầu gắn trong buổi khám).
    const requestsVisible = can(user, 'examRequest.view');
    const requests = db.examRequests
      .filter((item) => item.horseId === horse.id && requestsVisible)
      .sort((a, b) => (a.status === 'PENDING' && b.status !== 'PENDING' ? -1 : b.status === 'PENDING' && a.status !== 'PENDING' ? 1 : b.createdAt.localeCompare(a.createdAt)))
      .map((item) => requestRow(db, user, item));
    const costVisible = can(user, 'medical.cost.view');
    const closedCosts = casesOfHorse(db, horse.id)
      .map((item) => visibleCost(user, item))
      .filter((value): value is number => value !== undefined);
    const open = openCaseOf(db, horse.id);

    return {
      horse: horseRef(db, horse),
      writable,
      healthLogs: db.healthStatusLogs
        .filter((log) => log.horseId === horse.id)
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
        .map((log) => healthLogRow(db, log)),
      activeLock: locks.find((lock) => lock.active),
      lockHistory: locks.filter((lock) => !lock.active),
      openCase: open ? { id: open.id, title: caseTitle(open) } : undefined,
      cases,
      exams,
      requests,
      requestsVisible,
      pendingRequestCount: requests.filter((row) => row.status === 'PENDING').length,
      periodic: writable ? periodicRow(db, user, horse, at) : undefined,
      costVisible,
      /** Tổng chi phí các bệnh án đã đóng — không có khi người xem không được thấy chi phí. */
      totalCost: costVisible ? closedCosts.reduce((sum, value) => sum + value, 0) : undefined,
      closedCaseCount: cases.filter((row) => row.status === 'CLOSED').length,
      canChangeHealth: writable && inActionScope(db, user, 'health.status.edit', horse.id),
      canLock: writable && inActionScope(db, user, 'lock.manage', horse.id),
      canExamine: writable && inActionScope(db, user, 'exam.record', horse.id),
      canRequest: writable && inActionScope(db, user, 'examRequest.create', horse.id),
    };
  });
}

/* ===================================================================== */
/* ===== F3.2 — Chu kỳ và lịch khám định kỳ ============================ */
/* ===================================================================== */

export function getExamCycle() {
  return query((db) => {
    const user = requireUser();
    return { days: db.settings.examCycleDays, canEdit: can(user, 'exam.cycle.set') };
  });
}

export function setExamCycle(days: number, reason: string) {
  return commit((db) => {
    const actor = requirePermission('exam.cycle.set');
    const at = now();
    if (!Number.isInteger(days) || days < 7 || days > 365) {
      throw new AppError('Chu kỳ khám phải là số nguyên từ 7 đến 365 ngày', 'days');
    }
    const note = requireText(reason, 5, 'Nhập lý do đổi chu kỳ (ít nhất 5 ký tự)', 'reason');
    const before = db.settings.examCycleDays;
    if (before === days) throw new AppError(`Chu kỳ hiện tại đã là ${days} ngày`, 'days');
    db.settings.examCycleDays = days;
    writeAudit(db, at, {
      action: 'Đổi chu kỳ khám định kỳ',
      entityType: 'AppSettings',
      entityId: 'examCycleDays',
      before: { examCycleDays: before },
      after: { examCycleDays: days },
      reason: note,
      actor,
    });
  });
}

/** Lịch khám định kỳ: ngựa ACTIVE và RETIRED (TRANSFERRED và đã xóa không có lịch), sắp theo hạn. */
export function listPeriodicStatus(filter: { state?: PeriodicRowState } = {}) {
  return query((db) => {
    const user = requirePermission('medical.board');
    const at = now();
    return db.horses
      .filter(inClub)
      .map((horse) => periodicRow(db, user, horse, at))
      .filter((row): row is PeriodicRow => !!row)
      .filter((row) => !filter.state || row.state === filter.state)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.horse.name.localeCompare(b.horse.name));
  });
}

/* ===================================================================== */
/* ===== F3.4 — Yêu cầu khám ========================================== */
/* ===================================================================== */

/** GROOM: chỉ yêu cầu mình gửi. OWNER: không có quyền (ERR_FORBIDDEN). */
export function listExamRequests(filter: { status?: ExamRequestStatus; horseId?: string; urgency?: ExamUrgency } = {}) {
  return query((db) => {
    const user = requirePermission('examRequest.view');
    const visible = medicalHorseIds(db, user);
    return db.examRequests
      .filter((item) => visible.has(item.horseId))
      .filter((item) => user.role !== 'GROOM' || item.createdBy === user.id)
      .filter((item) => !filter.status || item.status === filter.status)
      .filter((item) => !filter.horseId || item.horseId === filter.horseId)
      .filter((item) => !filter.urgency || item.urgency === filter.urgency)
      .sort((a, b) => {
        if (a.status === 'PENDING' && b.status === 'PENDING') return sortPending(a, b);
        if (a.status === 'PENDING') return -1;
        if (b.status === 'PENDING') return 1;
        return (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt);
      })
      .map((item) => requestRow(db, user, item));
  });
}

/** Nguồn yêu cầu theo vai trò người gửi. */
function sourceForRole(user: User): ExamRequestSource {
  if (user.role === 'GROOM') return 'GROOM_REPORT';
  if (user.role === 'VETERINARIAN') return 'VET_SELF';
  return 'MANUAL';
}

export function createExamRequest(input: { horseId: string; urgency: ExamUrgency; description: string }) {
  return commit((db) => {
    const actor = requirePermission('examRequest.create');
    const at = now();
    const horse = findHorse(db, input.horseId);
    if (!input.horseId || !horse) throw new AppError('Chọn ngựa cần khám', 'horseId');
    if (!canViewHorse(db, actor, horse.id)) throw new AppError(ERR_NOT_FOUND);
    assertHorseInClub(horse, 'gửi yêu cầu khám');
    if (!inActionScope(db, actor, 'examRequest.create', horse.id)) {
      throw new AppError(
        actor.role === 'GROOM'
          ? `${horse.name} không phải ngựa bạn được phân công chăm sóc`
          : actor.role === 'HEAD_TRAINER'
            ? `${horse.name} không thuộc khu bạn phụ trách`
            : ERR_FORBIDDEN,
        'horseId',
      );
    }
    if (input.urgency !== 'NORMAL' && input.urgency !== 'URGENT') throw new AppError('Chọn mức độ', 'urgency');
    const description = requireText(input.description, 5, 'Mô tả tình trạng ít nhất 5 ký tự', 'description');

    const request = createExamRequestInternal(db, at, {
      horseId: horse.id,
      source: sourceForRole(actor),
      urgency: input.urgency,
      description,
      createdBy: actor.id,
    });
    writeAudit(db, at, {
      action: 'Gửi yêu cầu khám',
      entityType: 'ExamRequest',
      entityId: request.id,
      horseId: horse.id,
      after: { source: request.source, urgency: request.urgency, description },
      actor,
    });
    return { requestId: request.id, merged: request.description !== description };
  });
}

export function dismissExamRequest(requestId: string, reason: string) {
  return commit((db) => {
    const actor = requirePermission('examRequest.dismiss');
    const at = now();
    const request = db.examRequests.find((item) => item.id === requestId);
    if (!request) throw new AppError(ERR_NOT_FOUND);
    if (request.status !== 'PENDING') {
      throw new AppError('Yêu cầu này đã được xử lý — chỉ bỏ qua được yêu cầu đang chờ');
    }
    const note = requireText(reason, 5, 'Nhập lý do bỏ qua (ít nhất 5 ký tự)', 'reason');
    request.status = 'DISMISSED';
    request.dismissedBy = actor.id;
    request.dismissReason = note;
    request.resolvedAt = at.toISOString();
    touch(request, at);
    const horse = findHorse(db, request.horseId);
    if (request.createdBy !== 'SYSTEM' && request.createdBy !== actor.id) {
      pushNotification(db, at, {
        userId: request.createdBy,
        level: 'NORMAL',
        title: `Yêu cầu khám ${horse?.name ?? ''} đã được bỏ qua`,
        body: `Bác sĩ ${actor.name}: ${note}`,
        link: links.requests,
      });
    }
    writeAudit(db, at, {
      action: 'Bỏ qua yêu cầu khám',
      entityType: 'ExamRequest',
      entityId: request.id,
      horseId: request.horseId,
      before: { status: 'PENDING' },
      after: { status: 'DISMISSED' },
      reason: note,
      actor,
    });
  });
}

/* ===================================================================== */
/* ===== F3.5/F3.6/F3.10 — Bệnh án và buổi khám ======================== */
/* ===================================================================== */

export function listCases(filter: { status?: MedicalCaseStatus; horseId?: string } = {}) {
  return query((db) => {
    const user = requirePermission('medical.view');
    const visible = medicalHorseIds(db, user);
    return db.medicalCases
      .filter((item) => visible.has(item.horseId))
      .filter((item) => !filter.status || item.status === filter.status)
      .filter((item) => !filter.horseId || item.horseId === filter.horseId)
      .map((item) => caseRow(db, user, item))
      .sort((a, b) => (a.status === b.status ? b.openedAt.localeCompare(a.openedAt) : a.status === 'OPEN' ? -1 : 1));
  });
}

export function getCase(caseId: string) {
  return query((db) => {
    const user = requirePermission('medical.view');
    const item = db.medicalCases.find((entry) => entry.id === caseId);
    if (!item) throw new AppError(ERR_NOT_FOUND);
    const horse = assertVisibleHorse(db, user, item.horseId);
    const todayKey = toDateKey(now());
    const exams = examsOfCase(db, item.id).map((exam) => examCard(db, user, exam));
    const linkedIds = new Set(examsOfCase(db, item.id).flatMap((exam) => exam.linkedRequestIds));
    const locks = db.trainingLocks
      .filter((lock) => lock.caseId === item.id)
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      .map((lock) => lockRow(db, user, lock, todayKey));
    const horseLock = activeLock(db, horse.id);
    const writable = inClub(horse);
    const isOpen = item.status === 'OPEN';
    return {
      medicalCase: caseRow(db, user, item),
      horse: horseRef(db, horse),
      exams,
      locks,
      /** Khóa hiệu lực của ngựa (có thể không gắn bệnh án này) — đóng bệnh án phải quyết định gỡ/giữ. */
      horseActiveLock: horseLock ? lockRow(db, user, horseLock, todayKey) : undefined,
      linkedRequests: db.examRequests
        .filter((request) => linkedIds.has(request.id))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((request) => requestRow(db, user, request)),
      canAddExam: isOpen && writable && inActionScope(db, user, 'exam.record', horse.id),
      canClose: isOpen && inActionScope(db, user, 'case.close', horse.id),
      canLock: isOpen && writable && inActionScope(db, user, 'lock.manage', horse.id),
      canCorrect: writable && can(user, 'exam.record'),
    };
  });
}

export function listExaminations(filter: { horseId?: string; kind?: ExaminationKind; caseId?: string } = {}) {
  return query((db) => {
    const user = requirePermission('medical.view');
    const visible = medicalHorseIds(db, user);
    return db.examinations
      .filter((exam) => visible.has(exam.horseId))
      .filter((exam) => !filter.horseId || exam.horseId === filter.horseId)
      .filter((exam) => !filter.kind || exam.kind === filter.kind)
      .filter((exam) => !filter.caseId || exam.caseId === filter.caseId)
      .sort((a, b) => b.examinedAt.localeCompare(a.examinedAt))
      .map((exam) => examCard(db, user, exam));
  });
}

export type CaseTarget = 'NONE' | 'NEW' | { caseId: string };

export interface CreateExaminationInput {
  horseId: string;
  kind: ExaminationKind;
  caseTarget: CaseTarget;
  caseTitle?: string;
  /** ISO — không ở tương lai, lùi tối đa 7 ngày. */
  examinedAt: string;
  diagnosisAndTreatment: string;
  healthStatusAfter: HealthStatus;
  healthReason?: string;
  /** YYYY-MM-DD */
  nextAppointment?: string;
  linkedRequestIds: string[];
  metrics?: Partial<Record<MeasurementType, number>>;
  confirmAbnormal?: boolean;
  placeLock?: { reason: string; expectedLiftDate?: string };
}

const HEALTH_VALUES: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];

function summarize(text: string): string {
  const first = text.split(/(?<=[.!?])\s|\n/)[0]?.trim() ?? text.trim();
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}

/**
 * Ghi một buổi khám (F3.3 định kỳ / F3.6 trong bệnh án), có thể mở bệnh án tại buổi này (F3.5).
 * Mọi kiểm tra chạy trước khi ghi để lỗi không để lại dữ liệu dở dang.
 */
export function createExamination(input: CreateExaminationInput) {
  return commit((db) => {
    const actor = requirePermission('exam.record');
    const at = now();
    const todayKey = toDateKey(at);

    /* --- Ngựa --- */
    const horse = findHorse(db, input.horseId);
    if (!input.horseId || !horse) throw new AppError('Chọn ngựa được khám', 'horseId');
    assertHorseInClub(horse, 'ghi buổi khám');

    /* --- Thời điểm khám --- */
    const examined = new Date(input.examinedAt);
    if (!input.examinedAt || Number.isNaN(examined.getTime())) {
      throw new AppError('Nhập ngày giờ khám', 'examinedAt');
    }
    if (examined.getTime() > at.getTime() + 60_000) {
      throw new AppError('Thời điểm khám không được ở tương lai', 'examinedAt');
    }
    if (daysBetween(examined, at) > 7) {
      throw new AppError('Chỉ được ghi lùi buổi khám tối đa 7 ngày', 'examinedAt');
    }

    /* --- Nội dung --- */
    const diagnosis = requireText(
      input.diagnosisAndTreatment,
      5,
      'Nhập "Chẩn đoán và hướng điều trị" (ít nhất 5 ký tự)',
      'diagnosisAndTreatment',
    );
    if (!HEALTH_VALUES.includes(input.healthStatusAfter)) {
      throw new AppError('Chọn trạng thái sức khỏe sau khám', 'healthStatusAfter');
    }
    const healthChanged = input.healthStatusAfter !== horse.healthStatus;
    const healthReason = healthChanged ? (input.healthReason?.trim() || summarize(diagnosis)) : '';
    if (input.nextAppointment) {
      if (!isDateKey(input.nextAppointment)) throw new AppError('Ngày hẹn khám không hợp lệ', 'nextAppointment');
      if (input.nextAppointment < toDateKey(examined)) {
        throw new AppError('Ngày hẹn khám tiếp phải từ ngày khám trở đi', 'nextAppointment');
      }
    }

    /* --- Loại buổi khám và bệnh án --- */
    const open = openCaseOf(db, horse.id);
    let targetCase: MedicalCase | undefined;
    let opensCase = false;
    let newCaseTitle = '';
    const target = input.caseTarget;
    if (input.kind !== 'PERIODIC' && input.kind !== 'CASE') throw new AppError('Chọn loại buổi khám', 'kind');
    if (input.kind === 'CASE' && target === 'NONE') {
      throw new AppError('Buổi khám trong bệnh án phải chọn bệnh án đang mở hoặc mở bệnh án mới', 'caseTarget');
    }
    if (input.kind === 'PERIODIC' && typeof target === 'object') {
      throw new AppError(
        'Buổi khám định kỳ chỉ là bản ghi độc lập hoặc mở bệnh án mới — muốn thêm vào bệnh án đang mở hãy chọn "Trong bệnh án"',
        'caseTarget',
      );
    }
    if (target === 'NEW') {
      if (open) {
        throw new AppError(`Ngựa đang có bệnh án mở "${caseTitle(open)}". Hãy thêm buổi khám vào bệnh án đó.`, 'caseTarget');
      }
      newCaseTitle = requireText(input.caseTitle, 3, 'Nhập tiêu đề bệnh án (ít nhất 3 ký tự)', 'caseTitle');
      opensCase = true;
    } else if (typeof target === 'object') {
      targetCase = db.medicalCases.find((item) => item.id === target.caseId);
      if (!targetCase || targetCase.horseId !== horse.id) {
        throw new AppError('Bệnh án không thuộc con ngựa này', 'caseTarget');
      }
      if (targetCase.status !== 'OPEN') {
        throw new AppError('Bệnh án đã đóng — không mở lại. Tái phát thì mở bệnh án mới.', 'caseTarget');
      }
      if (examined.toISOString() < targetCase.openedAt) {
        throw new AppError(`Thời điểm khám phải sau ngày mở bệnh án (${formatDate(targetCase.openedAt)})`, 'examinedAt');
      }
    }

    /* --- Yêu cầu khám được gắn --- */
    const linkedIds = [...new Set(input.linkedRequestIds ?? [])];
    const linked = linkedIds.map((requestId) => {
      const request = db.examRequests.find((item) => item.id === requestId);
      if (!request || request.horseId !== horse.id) {
        throw new AppError('Có yêu cầu khám không thuộc con ngựa này', 'linkedRequestIds');
      }
      if (request.status !== 'PENDING') {
        throw new AppError('Có yêu cầu khám đã được xử lý — tải lại để cập nhật danh sách', 'linkedRequestIds');
      }
      return request;
    });

    /* --- Chỉ số đo được --- */
    const readings: { type: MeasurementType; value: number; abnormal: boolean }[] = [];
    let anyAbnormal = false;
    (Object.entries(input.metrics ?? {}) as [MeasurementType, number | undefined][]).forEach(([type, value]) => {
      if (value === undefined || value === null || Number.isNaN(value)) return;
      const check = checkMeasurement(type, value);
      if (!check.valid) throw new AppError(`${measurementLabel[type].name}: ${check.reason}`, `metric.${type}`);
      if (check.abnormal) anyAbnormal = true;
      readings.push({ type, value, abnormal: check.abnormal });
    });
    if (anyAbnormal && !input.confirmAbnormal) {
      throw new AppError('Có chỉ số ngoài khoảng bình thường — tích xác nhận để lưu và đánh dấu bất thường', 'confirmAbnormal');
    }

    /* --- Khóa huấn luyện --- */
    let lockInput: { reason: string; expectedLiftDate?: string } | undefined;
    if (input.placeLock) {
      if (activeLock(db, horse.id)) {
        throw new AppError('Ngựa đang có một khóa huấn luyện còn hiệu lực — mỗi ngựa tối đa một khóa', 'placeLock');
      }
      const reason = requireText(input.placeLock.reason, 5, 'Nhập lý do khóa huấn luyện (ít nhất 5 ký tự)', 'lockReason');
      const expected = input.placeLock.expectedLiftDate || undefined;
      if (expected && (!isDateKey(expected) || expected < todayKey)) {
        throw new AppError('Ngày dự kiến gỡ khóa phải từ hôm nay trở đi', 'lockExpectedLiftDate');
      }
      lockInput = { reason, expectedLiftDate: expected };
    }

    /* ===== Ghi dữ liệu ===== */
    const examinedIso = examined.toISOString();
    if (opensCase) {
      targetCase = {
        id: newId('case'),
        horseId: horse.id,
        title: newCaseTitle,
        status: 'OPEN',
        openedBy: actor.id,
        openedAt: examinedIso,
        ...stamp(at),
      };
      db.medicalCases.unshift(targetCase);
      // Khám khi có vấn đề luôn xuất phát từ yêu cầu khám: không gắn yêu cầu nào thì bác sĩ tự tạo một yêu cầu.
      if (linked.length === 0) {
        linked.push(
          createExamRequestInternal(db, at, {
            horseId: horse.id,
            source: 'VET_SELF',
            urgency: 'NORMAL',
            description: newCaseTitle,
            createdBy: actor.id,
          }),
        );
      }
    }

    const exam: Examination = {
      id: newId('ex'),
      horseId: horse.id,
      kind: input.kind,
      caseId: targetCase?.id,
      examinedAt: examinedIso,
      vetId: actor.id,
      diagnosisAndTreatment: diagnosis,
      healthStatusBefore: horse.healthStatus,
      healthStatusAfter: input.healthStatusAfter,
      nextAppointment: input.nextAppointment || undefined,
      linkedRequestIds: linked.map((request) => request.id),
      corrections: [],
      ...stamp(at),
    };
    db.examinations.unshift(exam);

    linked.forEach((request) => {
      request.status = 'EXAMINED';
      request.examinationId = exam.id;
      request.resolvedAt = at.toISOString();
      touch(request, at);
    });

    // Chỉ số ghi vào đúng bảng chỉ số cơ thể F1.5, kèm nguồn "từ buổi khám".
    // Không tự sinh yêu cầu khám từ các chỉ số này — bác sĩ đang khám chính con ngựa đó.
    readings.forEach((reading) => {
      db.bodyMeasurements.push({
        id: newId('bm'),
        horseId: horse.id,
        type: reading.type,
        value: reading.value,
        measuredAt: examinedIso,
        recordedBy: actor.id,
        abnormal: reading.abnormal,
        note: 'Đo trong buổi khám',
        examinationId: exam.id,
        ...stamp(at),
      });
    });

    if (healthChanged) {
      applyHealthStatus(db, at, actor, horse.id, input.healthStatusAfter, healthReason, exam.id);
    }

    if (lockInput) {
      placeLockInternal(db, at, actor, {
        horseId: horse.id,
        reason: lockInput.reason,
        expectedLiftDate: lockInput.expectedLiftDate,
        caseId: targetCase?.id,
      });
    }

    if (opensCase && targetCase) {
      notifyMany(db, at, [...managerIds(db), horse.ownerId], {
        level: 'NORMAL',
        title: `Mở bệnh án: ${horse.name}`,
        body: `${newCaseTitle} — bác sĩ ${actor.name}.`,
        link: links.case(targetCase.id),
      });
      writeAudit(db, at, {
        action: 'Mở bệnh án',
        entityType: 'MedicalCase',
        entityId: targetCase.id,
        horseId: horse.id,
        after: { title: newCaseTitle, status: 'OPEN', fromExamination: exam.id, kind: input.kind },
        actor,
      });
    }

    writeAudit(db, at, {
      action: input.kind === 'PERIODIC' ? 'Ghi buổi khám định kỳ' : 'Ghi buổi khám trong bệnh án',
      entityType: 'Examination',
      entityId: exam.id,
      horseId: horse.id,
      after: {
        kind: exam.kind,
        caseId: exam.caseId,
        examinedAt: exam.examinedAt,
        healthStatusBefore: exam.healthStatusBefore,
        healthStatusAfter: exam.healthStatusAfter,
        nextAppointment: exam.nextAppointment,
        linkedRequestIds: exam.linkedRequestIds,
        metrics: readings,
      },
      actor,
    });

    return { examinationId: exam.id, caseId: targetCase?.id };
  });
}

/** Buổi khám đã lưu không sửa, không xóa — chỉ thêm ghi chú đính chính. */
export function addExamCorrection(examinationId: string, note: string) {
  return commit((db) => {
    const actor = requirePermission('exam.record');
    const at = now();
    const exam = db.examinations.find((item) => item.id === examinationId);
    if (!exam) throw new AppError(ERR_NOT_FOUND);
    const horse = findHorse(db, exam.horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    assertHorseInClub(horse, 'thêm ghi chú đính chính');
    const text = requireText(note, 5, 'Ghi chú đính chính ít nhất 5 ký tự', 'note');
    exam.corrections.push({ note: text, by: actor.id, at: at.toISOString() });
    touch(exam, at);
    writeAudit(db, at, {
      action: 'Thêm ghi chú đính chính buổi khám',
      entityType: 'Examination',
      entityId: exam.id,
      horseId: exam.horseId,
      after: { correction: text },
      actor,
    });
  });
}

export type LockDecision = { action: 'LIFT'; reason: string } | { action: 'KEEP'; expectedLiftDate: string };

/** F3.9 — Đóng bệnh án và chốt chi phí (một lần, không sửa sau). Không mở lại bệnh án đã đóng. */
export function closeCase(caseId: string, input: { cost: number; closeNote: string; lockDecision?: LockDecision }) {
  return commit((db) => {
    const actor = requirePermission('case.close');
    const at = now();
    const todayKey = toDateKey(at);
    const item = db.medicalCases.find((entry) => entry.id === caseId);
    if (!item) throw new AppError(ERR_NOT_FOUND);
    if (item.status !== 'OPEN') throw new AppError('Bệnh án đã đóng — không mở lại. Tái phát thì mở bệnh án mới.');
    const horse = findHorse(db, item.horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (!Number.isInteger(input.cost) || input.cost < 0) {
      throw new AppError('Chi phí là số nguyên không âm (đồng)', 'cost');
    }
    const note = requireText(input.closeNote, 5, 'Nhập kết luận khi đóng bệnh án (ít nhất 5 ký tự)', 'closeNote');

    const lock = activeLock(db, horse.id);
    let decision: LockDecision | undefined;
    if (lock) {
      if (!input.lockDecision) {
        throw new AppError('Ngựa còn khóa huấn luyện hiệu lực — chọn gỡ khóa hoặc giữ khóa kèm ngày dự kiến gỡ', 'lockDecision');
      }
      if (input.lockDecision.action === 'LIFT') {
        const reason = requireText(input.lockDecision.reason, 5, 'Nhập lý do gỡ khóa (ít nhất 5 ký tự)', 'lockReason');
        decision = { action: 'LIFT', reason };
      } else {
        const date = input.lockDecision.expectedLiftDate;
        if (!date || !isDateKey(date) || date < todayKey) {
          throw new AppError('Giữ khóa phải kèm ngày dự kiến gỡ, từ hôm nay trở đi', 'lockExpectedLiftDate');
        }
        decision = { action: 'KEEP', expectedLiftDate: date };
      }
    }

    item.status = 'CLOSED';
    item.closedBy = actor.id;
    item.closedAt = at.toISOString();
    item.cost = input.cost;
    item.closeNote = note;
    touch(item, at);

    if (lock && decision) {
      if (decision.action === 'LIFT') {
        liftLockInternal(db, at, actor, lock, decision.reason, 'CASE_CLOSED');
      } else {
        const before = lock.expectedLiftDate;
        lock.expectedLiftDate = decision.expectedLiftDate;
        touch(lock, at);
        writeAudit(db, at, {
          action: 'Giữ khóa huấn luyện khi đóng bệnh án',
          entityType: 'TrainingLock',
          entityId: lock.id,
          horseId: horse.id,
          before: { expectedLiftDate: before },
          after: { expectedLiftDate: decision.expectedLiftDate },
          actor,
        });
      }
    }

    notifyMany(db, at, [horse.ownerId, ...managerIds(db)], {
      level: 'NORMAL',
      title: `Đóng bệnh án: ${horse.name}`,
      body: `${caseTitle(item)} — chi phí ${formatMoney(input.cost)}. ${note}`,
      link: links.case(item.id),
    });
    writeAudit(db, at, {
      action: 'Đóng bệnh án',
      entityType: 'MedicalCase',
      entityId: item.id,
      horseId: horse.id,
      before: { status: 'OPEN' },
      after: {
        status: 'CLOSED',
        cost: input.cost,
        lockDecision: decision?.action,
        lockExpectedLiftDate: decision?.action === 'KEEP' ? decision.expectedLiftDate : undefined,
      },
      reason: note,
      actor,
    });
  });
}

/* ===================================================================== */
/* ===== F3.7 — Trạng thái sức khỏe ==================================== */
/* ===================================================================== */

/**
 * Bác sĩ đổi trực tiếp (không cần buổi khám). Không tự gỡ khóa khi về ELIGIBLE,
 * không tự rút ngựa khỏi lớp khi INJURED/QUARANTINED.
 */
export function changeHealthStatus(input: { horseId: string; to: HealthStatus; reason: string }) {
  return commit((db) => {
    const actor = requirePermission('health.status.edit');
    const at = now();
    const horse = findHorse(db, input.horseId);
    if (!input.horseId || !horse) throw new AppError('Chọn ngựa', 'horseId');
    assertHorseInClub(horse, 'đổi trạng thái sức khỏe');
    if (!HEALTH_VALUES.includes(input.to)) throw new AppError('Chọn trạng thái mới', 'to');
    if (input.to === horse.healthStatus) {
      throw new AppError(`${horse.name} đang ở trạng thái ${healthLabel[input.to]}`, 'to');
    }
    const reason = requireText(input.reason, 5, 'Nhập lý do đổi trạng thái (ít nhất 5 ký tự)', 'reason');
    applyHealthStatus(db, at, actor, horse.id, input.to, reason);
    const lock = activeLock(db, horse.id);
    return { lockStillActive: input.to === 'ELIGIBLE' && !!lock, lockReason: lock?.reason };
  });
}

export function getHealthTimeline(horseId: string) {
  return query((db) => {
    const user = requirePermission('medical.view');
    const horse = assertVisibleHorse(db, user, horseId);
    return db.healthStatusLogs
      .filter((log) => log.horseId === horse.id)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
      .map((log) => healthLogRow(db, log));
  });
}

/* ===================================================================== */
/* ===== F3.8 — Khóa huấn luyện ======================================== */
/* ===================================================================== */

export function listTrainingLocks(filter: { active?: boolean; horseId?: string } = {}) {
  return query((db) => {
    const user = requirePermission('lock.view');
    const visible = medicalHorseIds(db, user);
    const todayKey = toDateKey(now());
    return db.trainingLocks
      .filter((lock) => visible.has(lock.horseId))
      .filter((lock) => filter.active === undefined || filter.active === !lock.liftedAt)
      .filter((lock) => !filter.horseId || lock.horseId === filter.horseId)
      .sort((a, b) => {
        if (!a.liftedAt && b.liftedAt) return -1;
        if (a.liftedAt && !b.liftedAt) return 1;
        return (b.liftedAt ?? b.placedAt).localeCompare(a.liftedAt ?? a.placedAt);
      })
      .map((lock) => lockRow(db, user, lock, todayKey));
  });
}

export function placeTrainingLock(input: { horseId: string; reason: string; expectedLiftDate?: string; caseId?: string }) {
  return commit((db) => {
    const actor = requirePermission('lock.manage');
    const at = now();
    const horse = findHorse(db, input.horseId);
    if (!input.horseId || !horse) throw new AppError('Chọn ngựa', 'horseId');
    assertHorseInClub(horse, 'đặt khóa huấn luyện');
    if (!inActionScope(db, actor, 'lock.manage', horse.id)) throw new AppError(ERR_FORBIDDEN);
    const existing = activeLock(db, horse.id);
    if (existing) {
      throw new AppError(
        `${horse.name} đang có khóa huấn luyện từ ${formatDate(existing.placedAt)} — mỗi ngựa tối đa một khóa hiệu lực`,
        'horseId',
      );
    }
    const reason = requireText(input.reason, 5, 'Nhập lý do khóa (ít nhất 5 ký tự)', 'reason');
    const expected = input.expectedLiftDate || undefined;
    if (expected && (!isDateKey(expected) || expected < toDateKey(at))) {
      throw new AppError('Ngày dự kiến gỡ phải từ hôm nay trở đi', 'expectedLiftDate');
    }
    if (input.caseId) {
      const item = db.medicalCases.find((entry) => entry.id === input.caseId);
      if (!item || item.horseId !== horse.id || item.status !== 'OPEN') {
        throw new AppError('Bệnh án liên quan phải là bệnh án đang mở của chính con ngựa này', 'caseId');
      }
    }
    const lock = placeLockInternal(db, at, actor, {
      horseId: horse.id,
      reason,
      expectedLiftDate: expected,
      caseId: input.caseId || undefined,
    });
    return { lockId: lock.id };
  });
}

export function liftTrainingLock(lockId: string, reason: string) {
  return commit((db) => {
    const actor = requirePermission('lock.manage');
    const at = now();
    const lock = db.trainingLocks.find((item) => item.id === lockId);
    if (!lock) throw new AppError(ERR_NOT_FOUND);
    if (lock.liftedAt) throw new AppError('Khóa này đã được gỡ trước đó');
    if (!inActionScope(db, actor, 'lock.manage', lock.horseId)) throw new AppError(ERR_FORBIDDEN);
    const note = requireText(reason, 5, 'Nhập lý do gỡ khóa (ít nhất 5 ký tự)', 'reason');
    liftLockInternal(db, at, actor, lock, note, 'MANUAL');
  });
}

/* ===================================================================== */
/* ===== Tùy chọn cho biểu mẫu ========================================= */
/* ===================================================================== */

/** Ngựa ACTIVE/RETIRED còn ở CLB trong phạm vi thao tác y tế của người dùng. */
export function listMedicalHorseOptions() {
  return query((db) => {
    const user = requireUser();
    const vet = can(user, 'exam.record');
    return db.horses
      .filter(inClub)
      .filter((horse) => (vet ? true : inActionScope(db, user, 'examRequest.create', horse.id)))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map<MedicalHorseOption>((horse) => {
        const open = openCaseOf(db, horse.id);
        const lock = activeLock(db, horse.id);
        return {
          id: horse.id,
          name: horse.name,
          avatar: horse.avatar,
          healthStatus: horse.healthStatus,
          lifecycleStatus: horse.lifecycleStatus,
          zoneName: zoneOf(db, horse)?.name,
          stallCode: stallOf(db, horse)?.code,
          // Tiêu đề bệnh án là nội dung y tế — GROOM không nhận.
          openCase: open && can(user, 'medical.view') ? { id: open.id, title: caseTitle(open) } : undefined,
          activeLock: lock ? { id: lock.id, reason: lock.reason } : undefined,
          pendingRequestCount: db.examRequests.filter((item) => item.horseId === horse.id && item.status === 'PENDING').length,
        };
      });
  });
}

/** Yêu cầu khám đang chờ của một ngựa — để bác sĩ gắn vào buổi khám. */
export function listPendingRequestsForHorse(horseId: string) {
  return query((db) => {
    const user = requirePermission('exam.record');
    assertVisibleHorse(db, user, horseId);
    return db.examRequests
      .filter((item) => item.horseId === horseId && item.status === 'PENDING')
      .sort(sortPending)
      .map((item) => requestRow(db, user, item));
  });
}
