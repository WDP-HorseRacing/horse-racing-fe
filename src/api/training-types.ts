// Kiểu dữ liệu Flow 2 (huấn luyện) đúng như backend trả về, xuất lại qua api/types.ts.
// Vài số BE trả dạng chuỗi (cự ly chạy thử, thời gian, tốc độ): lớp API đã đổi sang number.
import type { RaceAptitude } from './types';

export type TrainingIntensity = 'LIGHT' | 'MODERATE' | 'HEAVY';
export type TrainingSessionType = 'REGULAR' | 'TIME_TRIAL';
export type TrainingClassStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TrainingSessionStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ParticipantStatus =
  | 'PLANNED'
  | 'PRESENT'
  | 'READY'
  | 'ONGOING'
  | 'COMPLETED'
  | 'ABSENT'
  | 'SKIPPED'
  | 'INELIGIBLE'
  | 'CANCELLED_BY_LOCK'
  | 'CANCELLED';
export type EnrollmentStatus = 'ACTIVE' | 'LEFT' | 'CANCELLED';
export type MetricAlertLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

/* ===== Môn học, giáo án ===== */

export interface TrainingSubject {
  id: string;
  name: string;
  description: string | null;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  surface: string | null;
  /** Chỉ môn chạy thử. */
  targetTimeMs: number | null;
  updatedAt: string;
}

export interface TrainingSubjectInput {
  name: string;
  description?: string | null;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  surface?: string | null;
  targetTimeMs?: number | null;
}

/** Một môn trong giai đoạn, học vào các thứ cố định mỗi tuần (ISO: 1 là thứ Hai, 7 là Chủ nhật). */
export interface TrainingPlanSubject {
  subject: TrainingSubject;
  weekdays: number[];
}

/** Giai đoạn của giáo án: kéo dài `weeks` tuần, mỗi tuần lặp lại cùng các môn theo thứ. */
export interface TrainingPlanPhase {
  /** Thứ tự, bắt đầu từ 1. */
  position: number;
  /** Tuần đầu của giai đoạn, bắt đầu từ 1. */
  startWeek: number;
  weeks: number;
  subjects: TrainingPlanSubject[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  description: string | null;
  headTrainerId: string;
  totalWeeks: number;
  phases: TrainingPlanPhase[];
  updatedAt: string;
}

export interface TrainingPlanInput {
  name: string;
  description?: string | null;
  phases: { weeks: number; subjects: { subjectId: string; weekdays: number[] }[] }[];
}

/* ===== Lớp, lịch ===== */

export interface TrainingClass {
  id: string;
  code: string;
  name: string;
  description: string | null;
  raceAptitude: RaceAptitude | null;
  maxHorses: number;
  headTrainerId: string | null;
  planId: string;
  startDate: string;
  endDate: string;
  status: TrainingClassStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInput {
  planId: string;
  startDate: string;
  /** HH:mm theo giờ CLB. Thứ có buổi lấy theo giáo án. */
  startTime: string;
  durationMinutes: number;
}

export interface ScheduledSession {
  week: number;
  subjectId: string;
  name: string;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  surface: string | null;
  targetTimeMs: number | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
}

export interface SchedulePreview {
  startDate: string;
  endDate: string;
  sessions: ScheduledSession[];
}

export interface ClassSessionInput {
  subjectId: string;
  name: string;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  surface?: string;
  location?: string;
  notes?: string;
  targetTimeMs?: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
}

export interface CreateClassInput {
  code: string;
  name: string;
  description?: string;
  raceAptitude?: RaceAptitude;
  maxHorses?: number;
  planId: string;
  startDate: string;
  sessions: ClassSessionInput[];
}

export interface UpdateClassInput {
  code?: string;
  name?: string;
  description?: string;
  raceAptitude?: RaceAptitude;
  maxHorses?: number;
  startDate?: string;
}

export interface Enrollment {
  id: string;
  classId: string;
  horseId: string;
  enrolledAt: string;
  leftAt: string | null;
  status: EnrollmentStatus;
  createdAt: string;
  updatedAt: string;
  /** Chỉ có ở danh sách ghi danh của lớp. */
  horseName?: string;
  /** Link có hạn, null khi ngựa chưa có ảnh. Chỉ có ở danh sách. */
  horsePhotoUrl?: string | null;
}

/* ===== Buổi, lượt ===== */

export interface TrainingSession {
  id: string;
  classId: string;
  subjectId: string | null;
  name: string;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  location: string | null;
  surface: string | null;
  notes: string | null;
  status: TrainingSessionStatus;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
}

/** Ngựa không được tạo lượt khi công bố vì đã có buổi trùng giờ ở lớp khác. */
export interface SkippedHorse {
  horseId: string;
  horseName: string;
  conflictClassCode: string;
  conflictStartAt: string;
}

/** Buổi vừa công bố, kèm các ngựa bị bỏ qua (luôn có, có thể rỗng). */
export interface PublishedSession extends TrainingSession {
  skippedHorses: SkippedHorse[];
}

export interface SessionInput {
  name: string;
  /** BE lấy loại buổi theo môn. Gửi lệch loại buổi của môn thì 400. */
  sessionType: TrainingSessionType;
  subjectId: string;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  /** Khi sửa: gửi `null` để xóa, không gửi thì giữ nguyên. */
  location?: string | null;
  surface?: string | null;
  notes?: string | null;
  /** Chỉ khi thêm buổi chạy thử: BE tạo luôn cấu hình chạy thử. DTO sửa buổi không nhận. */
  targetTimeMs?: number | null;
}

export interface TimeTrial {
  id: string;
  sessionId: string;
  distanceM: number;
  targetTimeMs: number | null;
  notes: string | null;
  createdAt: string;
}

export interface Participant {
  id: string;
  sessionId: string;
  horseId: string;
  horseEnrollmentId: string;
  assignedGroomId: string | null;
  status: ParticipantStatus;
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  absenceReason: string | null;
  cancelReason: string | null;
  ineligibilityReason: string | null;
  /** Chỉ có ở danh sách lượt: ngựa đang có lệnh khóa huấn luyện, tính lúc đọc. */
  trainingLocked?: boolean;
  /** Ba field dưới chỉ có ở danh sách lượt. Ngựa, Groom đã xóa vẫn có tên. */
  horseName?: string;
  horsePhotoUrl?: string | null;
  assignedGroomName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrialResult {
  id: string;
  timeTrialId: string;
  sessionParticipantId: string;
  attemptNo: number;
  elapsedMs: number;
  notes: string | null;
  videoMediaId: string | null;
  /** Link xem có hạn (15 phút), null khi không có video. */
  videoUrl: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface Evaluation {
  id: string;
  sessionParticipantId: string;
  evaluatorId: string;
  score: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ===== Tab Huấn luyện của ngựa ===== */

export interface HorseTrainingClass {
  enrollmentId: string;
  classId: string;
  code: string;
  name: string;
  classStatus: TrainingClassStatus;
  headTrainerName: string | null;
  enrollmentStatus: EnrollmentStatus;
  enrolledAt: string;
  leftAt: string | null;
}

export interface HorseTrialResult {
  attemptNo: number;
  elapsedMs: number;
  notes: string | null;
  /** Link xem có hạn (15 phút), null khi không có video. */
  videoUrl: string | null;
  recordedAt: string;
}

export interface HorseEvaluation {
  score: number;
  comment: string | null;
  evaluatorName: string | null;
  createdAt: string;
}

export interface HorseTrainingSession {
  participantId: string;
  sessionId: string;
  classId: string;
  className: string;
  planName: string;
  subjectName: string | null;
  name: string;
  sessionType: TrainingSessionType;
  scheduledStartAt: string;
  scheduledEndAt: string;
  location: string | null;
  surface: string | null;
  sessionStatus: TrainingSessionStatus;
  participantStatus: ParticipantStatus;
  groomName: string | null;
  absenceReason: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  trialResults: HorseTrialResult[];
  evaluation: HorseEvaluation | null;
}

/* ===== Nhịp tim, tốc độ, ngưỡng ===== */

export interface MetricPoint {
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
  alertLevel: MetricAlertLevel;
}

export interface ParticipantSummary {
  sessionParticipantId: string;
  count: number;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  warningCount: number;
  criticalCount: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
}

export interface SessionPerformanceSummary {
  sessionId: string;
  scheduledAt: string;
  avgHeartRateBpm: number;
  maxHeartRateBpm: number;
  avgSpeedMps: number;
  maxSpeedMps: number;
  alertCount: number;
}

export interface HorseAlert {
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
  alertLevel: Exclude<MetricAlertLevel, 'NORMAL'>;
  sessionParticipantId: string;
  sessionId: string;
  sessionName: string | null;
}

export interface HorseWorkload {
  horseId: string;
  from: string;
  to: string;
  sessionsCompleted: number;
  byIntensity: Record<TrainingIntensity, number>;
  plannedDistanceM: number;
  actualDurationSeconds: number;
  actualDistanceM: number;
}

export interface ThresholdLimits {
  heartRateWarningBpm: number;
  heartRateCriticalBpm: number;
  maxSpeedMps: number;
}

export interface ThresholdProfile {
  id: string;
  horseId: string;
  profileName: string;
  ruleVersion: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  limits: ThresholdLimits;
}

export interface HorseThresholds {
  source: 'HORSE' | 'CLUB_DEFAULT';
  activeLimits: ThresholdLimits;
  profiles: ThresholdProfile[];
}

export interface ThresholdInput {
  profileName: string;
  effectiveFrom: string;
  effectiveTo?: string;
  limits: ThresholdLimits;
}

/** Sự kiện socket `performance.metrics`: chỉ gửi cho HLV trưởng của lớp. */
export interface MetricsSocketPayload {
  sessionParticipantId: string;
  sessionId: string;
  horseId: string;
  points: MetricPoint[];
}

export interface HandoverResult {
  barnsMoved: number;
  plansMoved: number;
  classesMoved: number;
}
