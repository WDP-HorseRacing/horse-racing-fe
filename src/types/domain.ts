// Mô hình dữ liệu nghiệp vụ — bám theo bản chốt Flow 1-2-3 sau review.
// Mã enum giữ tiếng Anh, nhãn tiếng Việt nằm ở `src/lib/labels.ts`.

/* ===== Enum dùng chung ===== */

export type UserRole = 'CLUB_MANAGER' | 'HEAD_TRAINER' | 'VETERINARIAN' | 'GROOM' | 'HORSE_OWNER';

export type NotificationLevel = 'NORMAL' | 'HIGH' | 'URGENT';

/* ===== Enum Flow 1 ===== */

export type HorseSex = 'MALE' | 'FEMALE' | 'GELDING';
export type DistancePreference = 'SPRINTER' | 'MILER' | 'STAYER';
/** Trạng thái sức khỏe — Flow 3 sở hữu, Flow 1 và Flow 2 chỉ đọc. */
export type HealthStatus = 'ELIGIBLE' | 'UNDER_OBSERVATION' | 'INJURED' | 'QUARANTINED';
/** Trạng thái vòng đời — Flow 1 sở hữu. */
export type LifecycleStatus = 'ACTIVE' | 'RETIRED' | 'TRANSFERRED';
export type ZoneStatus = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
/** AVAILABLE và OCCUPIED do hệ thống tự đặt; người dùng chỉ chuyển AVAILABLE ⇄ MAINTENANCE. */
export type StallStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
/** Vị trí của ngựa trong quy trình xếp chỗ — chỉ tính ra, không lưu. */
export type HorsePlacement = 'NO_ZONE' | 'WAITING_STALL' | 'WAITING_GROOM' | 'PLACED' | 'NONE';
export type MeasurementType = 'WEIGHT' | 'HEIGHT' | 'BODY_CONDITION' | 'TEMPERATURE';

/* ===== Enum Flow 2 ===== */

export type WorkoutType = 'WALK' | 'TROT' | 'CANTER' | 'BREEZE' | 'TIME_TRIAL';
export type TrainingIntensity = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'MAX';
export type TrackSurface = 'TURF' | 'DIRT' | 'SYNTHETIC';
/** Trạng thái lớp — tính ra từ ngày và các mốc kết thúc sớm / hủy. */
export type ClassStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'AWAITING_REVIEW' | 'COMPLETED' | 'CANCELLED';
export type SessionCancelKind = 'MANUAL' | 'CLASS_CANCELLED' | 'CLASS_ENDED_EARLY';
export type SessionEndReason = 'NORMAL' | 'EMERGENCY_STOP' | 'AUTO_TIMEOUT';
export type AttendanceStatus = 'EXPECTED' | 'PRESENT' | 'ABSENT';
/** Nhóm lý do vắng của MỘT con ngựa trong MỘT buổi — không bao giờ hủy buổi của cả lớp. */
export type AbsenceReason = 'MEDICAL_BLOCK' | 'GROOM_REPORTED' | 'TRAINER_CHANGED' | 'LIFECYCLE';
export type EnrollmentCloseReason = 'MANUAL' | 'ZONE_CHANGE' | 'LIFECYCLE';
export type GroomTaskKind = 'PREPARE' | 'TO_TRACK' | 'COOL_DOWN';
export type SimScenario = 'NORMAL' | 'HEART_OVER' | 'INJURY_RISK' | 'SIGNAL_LOST' | 'RANDOM';
export type AlertRule = 'R1' | 'R3' | 'R6';
export type AlertLevel = 'RED' | 'GRAY';
export type AlertAckAction = 'STOP_HORSE' | 'CONTINUE';

/* ===== Enum Flow 3 ===== */

export type ExamRequestSource = 'GROOM_REPORT' | 'BODY_METRIC_ALERT' | 'TRAINING_ALERT' | 'MANUAL' | 'VET_SELF';
export type ExamUrgency = 'NORMAL' | 'URGENT';
export type ExamRequestStatus = 'PENDING' | 'EXAMINED' | 'DISMISSED';
export type ExaminationKind = 'PERIODIC' | 'CASE';
export type MedicalCaseStatus = 'OPEN' | 'CLOSED';
export type LockLiftKind = 'MANUAL' | 'CASE_CLOSED' | 'TRANSFER';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/* ===== Flow 1 — tài khoản, khu, ô, ngựa ===== */

export interface User extends BaseEntity {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  /** Mọi vai trò trong token (người kiêm nhiều vai trò). */
  roles?: UserRole[];
  avatar: string;
  active: boolean;
  // Không còn zoneId: khu của HT = các khu có headTrainerId trỏ tới HT đó.
}

export interface Zone extends BaseEntity {
  code: string;
  name: string;
  /** Một khu có đúng một HT phụ trách; chỉ được để trống khi khu không còn ngựa. */
  headTrainerId?: string;
  status: ZoneStatus;
  statusReason?: string;
  deletedAt?: string;
}

export interface Stall extends BaseEntity {
  code: string;
  zoneId: string;
  status: StallStatus;
  maintenanceNote?: string;
  deletedAt?: string;
}

export interface Horse extends BaseEntity {
  name: string;
  sex: HorseSex;
  breed?: string;
  color?: string;
  birthDate?: string;
  /** Duy nhất, tính cả hồ sơ đã xóa và đã chuyển nhượng. */
  chipNumber?: string;
  distancePreference?: DistancePreference;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  /** Chỉ trỏ tới ngựa có hồ sơ tại câu lạc bộ. */
  sireId?: string;
  damId?: string;
  /** Ảnh đại diện duy nhất, chỉ CM thay. */
  avatar?: string;
  /** Một chủ sở hữu duy nhất (tài khoản HORSE_OWNER). */
  ownerId?: string;
  /** Không có khu → "Chờ xếp khu", chỉ CM xử lý. */
  zoneId?: string;
  /** Có khu nhưng chưa có ô → "Chờ xếp ô". */
  stallId?: string;
  /** Groom phân công theo con ngựa. */
  groomId?: string;
  /** Hạn khám (YYYY-MM-DD) đã được gửi cảnh báo quá hạn — mỗi hạn chỉ gửi một lần. */
  periodicOverdueNotifiedFor?: string;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
}

export interface BodyMeasurement extends BaseEntity {
  horseId: string;
  type: MeasurementType;
  value: number;
  measuredAt: string;
  recordedBy: string;
  /** Ngoài khoảng bình thường (người nhập đã xác nhận). */
  abnormal: boolean;
  note?: string;
  /** Có giá trị = ghi trong buổi khám của Flow 3, không xóa được ở Flow 1. */
  examinationId?: string;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
}

export interface LifecycleConsequences {
  enrollmentsClosed: number;
  stallFreed?: string;
  zoneCleared?: string;
  groomEnded?: string;
  lockLifted?: boolean;
  ownerCleared?: string;
  healthReset?: boolean;
}

export interface LifecycleEvent extends BaseEntity {
  horseId: string;
  from: LifecycleStatus | 'DELETED';
  to: LifecycleStatus | 'DELETED';
  reason: string;
  by: string;
  at: string;
  consequences: LifecycleConsequences;
}

/* ===== Flow 2 — môn học, giáo án, lớp, buổi học ===== */

export interface TrainingSlot {
  id: string;
  code: string;
  startTime: string;
  endTime: string;
}

export interface TrainingSubject extends BaseEntity {
  name: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  description?: string;
  createdBy: string;
  deletedAt?: string;
}

export interface ProgramItem {
  subjectId: string;
  sessionsPerWeek: number;
}

export interface ProgramPhase {
  name: string;
  weeks: number;
  items: ProgramItem[];
}

/** Giáo án: khuôn mẫu không ngày, không gắn ngựa. */
export interface TrainingProgram extends BaseEntity {
  name: string;
  description?: string;
  phases: ProgramPhase[];
  createdBy: string;
  deletedAt?: string;
}

export interface TrainingClass extends BaseEntity {
  name: string;
  programId: string;
  /** Lớp chỉ nhận ngựa thuộc khu này; HT phụ trách lớp = HT của khu. */
  zoneId: string;
  slotId: string;
  startDate: string;
  endDate: string;
  capacity: number;
  createdBy: string;
  endedEarlyAt?: string;
  endedEarlyBy?: string;
  endNote?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
}

/** Buổi học thuộc về lớp, nhiều ngựa chung một buổi. Nội dung chụp lại từ môn học khi sinh buổi. */
export interface ClassSession extends BaseEntity {
  classId: string;
  date: string;
  slotId: string;
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
  isExtra: boolean;
  note?: string;
  status: SessionStatus;
  startedAt?: string;
  startedBy?: string;
  endedAt?: string;
  endedBy?: string;
  endReason?: SessionEndReason;
  stopReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  cancelKind?: SessionCancelKind;
  simScenario?: SimScenario;
  simSeed?: number;
  simSpeed?: number;
  simTargetHorseId?: string;
  completedAt?: string;
}

export interface ClassEnrollment extends BaseEntity {
  classId: string;
  horseId: string;
  joinedAt: string;
  joinedBy: string;
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawReason?: EnrollmentCloseReason;
  withdrawNote?: string;
}

export interface GroomTaskMark {
  at: string;
  by: string;
}

export interface SessionSummary {
  avgHeartRate: number;
  maxHeartRate: number;
  avgSpeedMps: number;
  maxSpeedMps: number;
  distanceM: number;
  durationSec: number;
  fastDistanceM: number;
  volumeRatio: number;
  alertCountRed: number;
  mainAvgSpeedMps: number;
  mainAvgHeartRate: number;
  suggestedTrialSeconds?: number;
}

export interface Evaluation {
  score: number;
  notes: string;
  trialTimeSeconds?: number;
  trialNotCompleted?: boolean;
  videoSrc?: string;
  videoThumbnail?: string;
  evaluatedAt: string;
  evaluatedBy: string;
  editedAt?: string;
}

/** Kết quả của một con ngựa trong một buổi học. Tạo lười; lúc bấm Bắt đầu thì tạo đủ cho cả buổi. */
export interface SessionAttendance extends BaseEntity {
  sessionId: string;
  horseId: string;
  enrollmentId: string;
  status: AttendanceStatus;
  absenceReason?: AbsenceReason;
  absenceNote?: string;
  markedBy?: string;
  markedAt?: string;
  /** Groom riêng cho buổi này (HT đổi); lúc bắt đầu được chốt thành Groom thực tế. */
  groomId?: string;
  groomOverridden?: boolean;
  tasks: Partial<Record<GroomTaskKind, GroomTaskMark>>;
  simScenario?: Exclude<SimScenario, 'RANDOM'>;
  simSeed?: number;
  /** Không có = ngựa chưa được VET đặt ngưỡng, quy tắc R1 không chạy. */
  maxHeartRateUsed?: number;
  stoppedAtSecond?: number;
  stoppedAt?: string;
  stoppedBy?: string;
  stopReason?: string;
  summary?: SessionSummary;
  evaluation?: Evaluation;
}

export interface TrainingAlert extends BaseEntity {
  sessionId: string;
  horseId: string;
  rule: AlertRule;
  level: AlertLevel;
  atSecond: number;
  at: string;
  value: number;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  ackAction?: AlertAckAction;
  examRequestId?: string;
}

export interface HorseMaxHeartRate extends BaseEntity {
  horseId: string;
  value: number;
  reason: string;
  createdBy: string;
  active: boolean;
}

/* ===== Flow 3 — y tế ===== */

export interface ExamRequest extends BaseEntity {
  horseId: string;
  source: ExamRequestSource;
  urgency: ExamUrgency;
  description: string;
  /** Mã người gửi, hoặc 'SYSTEM' với yêu cầu tự động. */
  createdBy: string;
  refType?: 'MEASUREMENT' | 'ALERT' | 'SESSION';
  refId?: string;
  status: ExamRequestStatus;
  examinationId?: string;
  resolvedAt?: string;
  dismissedBy?: string;
  dismissReason?: string;
}

export interface MedicalCase extends BaseEntity {
  horseId: string;
  title?: string;
  status: MedicalCaseStatus;
  openedBy: string;
  openedAt: string;
  closedBy?: string;
  closedAt?: string;
  /** Một trường chi phí duy nhất, nhập một lần khi đóng bệnh án. */
  cost?: number;
  closeNote?: string;
}

export interface ExamCorrection {
  note: string;
  by: string;
  at: string;
}

/** Buổi khám: không sửa, không xóa — chỉ thêm ghi chú đính chính. */
export interface Examination extends BaseEntity {
  horseId: string;
  kind: ExaminationKind;
  caseId?: string;
  examinedAt: string;
  vetId: string;
  diagnosisAndTreatment: string;
  healthStatusBefore: HealthStatus;
  healthStatusAfter: HealthStatus;
  nextAppointment?: string;
  linkedRequestIds: string[];
  corrections: ExamCorrection[];
}

export interface HealthStatusLog extends BaseEntity {
  horseId: string;
  fromStatus: HealthStatus;
  toStatus: HealthStatus;
  reason: string;
  examinationId?: string;
  changedBy: string;
  changedAt: string;
}

export interface TrainingLock extends BaseEntity {
  horseId: string;
  reason: string;
  placedAt: string;
  placedBy: string;
  expectedLiftDate?: string;
  caseId?: string;
  liftedAt?: string;
  liftedBy?: string;
  liftReason?: string;
  liftKind?: LockLiftKind;
}

/* ===== Chung ===== */

export interface AppNotification extends BaseEntity {
  userId: string;
  level: NotificationLevel;
  title: string;
  body: string;
  link?: string;
  readAt?: string;
}

export interface AuditLog extends BaseEntity {
  at: string;
  userId: string;
  userName: string;
  role: UserRole | 'SYSTEM';
  action: string;
  entityType: string;
  entityId: string;
  horseId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export interface AppSettings {
  clockMode: 'REAL' | 'SHIFTED';
  /** Chênh lệch giữa giờ hệ thống và giờ thực, tính bằng mili giây. */
  clockOffsetMs: number;
  simSpeed: number;
  /** Chu kỳ khám định kỳ chung của câu lạc bộ (ngày), do CM đặt. */
  examCycleDays: number;
  /** Chỉ là giá trị gợi ý trong form của VET — quy tắc R1 không dùng giá trị này. */
  defaultMaxHeartRate: number;
}

export interface Database {
  meta: { seededAt: string; schema: number };
  settings: AppSettings;
  users: User[];
  zones: Zone[];
  stalls: Stall[];
  slots: TrainingSlot[];
  horses: Horse[];
  bodyMeasurements: BodyMeasurement[];
  lifecycleEvents: LifecycleEvent[];
  subjects: TrainingSubject[];
  programs: TrainingProgram[];
  classes: TrainingClass[];
  sessions: ClassSession[];
  enrollments: ClassEnrollment[];
  attendances: SessionAttendance[];
  alerts: TrainingAlert[];
  maxHeartRates: HorseMaxHeartRate[];
  examRequests: ExamRequest[];
  medicalCases: MedicalCase[];
  examinations: Examination[];
  healthStatusLogs: HealthStatusLog[];
  trainingLocks: TrainingLock[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
}
