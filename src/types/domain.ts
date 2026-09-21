// Mô hình dữ liệu nghiệp vụ — bám theo thiết kế dữ liệu của BE (mục 13 của tài liệu phân tích).
// Mã enum giữ tiếng Anh, nhãn tiếng Việt nằm ở `src/lib/labels.ts`.

export type UserRole =
  | 'CLUB_MANAGER'
  | 'HEAD_TRAINER'
  | 'VETERINARIAN'
  | 'GROOM'
  | 'HORSE_OWNER';

export type HorseSex = 'MALE' | 'FEMALE' | 'GELDING';
export type DistancePreference = 'SPRINTER' | 'MILER' | 'STAYER';
export type HealthStatus = 'ELIGIBLE' | 'UNDER_OBSERVATION' | 'INJURED' | 'QUARANTINED';
export type LifecycleStatus = 'ACTIVE' | 'RETIRED' | 'TRANSFERRED';
export type StallType = 'STANDARD' | 'ISOLATION' | 'RECOVERY';

export type WorkoutType = 'WALK' | 'TROT' | 'CANTER' | 'BREEZE' | 'TIME_TRIAL';
export type TrainingIntensity = 'LIGHT' | 'MODERATE' | 'HEAVY' | 'MAXIMUM';
export type TrackSurface = 'TURF' | 'DIRT' | 'SYNTHETIC';
export type PlanStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type SessionStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';
export type CancelCategory =
  | 'TRAINER_CHANGED'
  | 'GROOM_REPORTED'
  | 'MEDICAL_BLOCK'
  | 'PLAN_CLOSED'
  | 'LIFECYCLE';
export type EarlyEndReason = 'HORSE_UNWELL' | 'TRAINER_ORDER' | 'WEATHER_TRACK' | 'OTHER';
export type EndReason = 'NORMAL' | 'STOPPED_BY_USER' | 'TRAINING_LOCK' | 'AUTO_TIMEOUT';
export type CompletionLevel = 'BELOW' | 'MET' | 'EXCEEDED';
export type PlanCloseReason =
  | 'GOAL_REACHED'
  | 'NEW_PLAN'
  | 'INJURY_ILLNESS'
  | 'GOAL_CHANGED'
  | 'OWNER_REQUEST'
  | 'LIFECYCLE'
  | 'OTHER';
export type SimScenario = 'NORMAL' | 'HEART_OVER' | 'INJURY_RISK' | 'SIGNAL_LOST' | 'RANDOM';
export type AlertRule = 'R1' | 'R3' | 'R6';
export type AlertLevel = 'RED' | 'GRAY';

export type Severity = 'MILD' | 'MODERATE' | 'SEVERE';
export type MedicalRecordStatus = 'IN_TREATMENT' | 'RESOLVED';
export type MedicalReason = 'ROUTINE' | 'INCIDENT' | 'RECHECK' | 'OTHER';
export type CareScheduleType = 'VACCINE' | 'DEWORMING' | 'FARRIER';
export type BodyRegion =
  | 'HEAD'
  | 'NECK'
  | 'SHOULDER'
  | 'BACK'
  | 'HIP'
  | 'CHEST'
  | 'ABDOMEN'
  | 'FORE_THIGH'
  | 'FORE_CANNON'
  | 'FORE_FETLOCK'
  | 'FORE_HOOF'
  | 'HIND_THIGH'
  | 'HIND_CANNON'
  | 'HIND_FETLOCK'
  | 'HIND_HOOF';
export type BodySide = 'LEFT' | 'RIGHT';

export type MeasurementType = 'WEIGHT' | 'HEIGHT' | 'BODY_CONDITION' | 'TEMPERATURE';
export type DailyTaskType = 'FEED' | 'CLEAN' | 'BATH' | 'CARE';
export type IncidentType = 'NOT_EATING' | 'COLIC_FEVER' | 'HOOF_DAMAGE' | 'OTHER';
export type IncidentStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
export type SupplyGroup = 'FEED' | 'MEDICINE' | 'TOOL';
export type RaceStatus = 'OPEN' | 'CLOSED' | 'FINISHED';
export type RegistrationStatus = 'PENDING_OWNER' | 'REGISTERED' | 'REJECTED' | 'CANCELLED';
export type ExpenseCategory = 'BOARDING' | 'MEDICAL' | 'RACE_FEE' | 'OPERATION' | 'OTHER';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface User extends BaseEntity {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  zoneId?: string;
  avatar: string;
  active: boolean;
}

export interface Zone extends BaseEntity {
  code: string;
  name: string;
  headTrainerId?: string;
}

export interface Stall extends BaseEntity {
  code: string;
  zoneId: string;
  type: StallType;
}

export interface TrainingSlot {
  id: string;
  code: string;
  startTime: string;
  endTime: string;
}

export interface Horse extends BaseEntity {
  name: string;
  sex: HorseSex;
  breed?: string;
  color?: string;
  birthDate?: string;
  chipNumber?: string;
  distancePreference?: DistancePreference;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  isReference: boolean;
  sireId?: string;
  damId?: string;
  avatar?: string;
  dailyRate?: number;
  deletedAt?: string;
  deleteReason?: string;
}

export interface StallAssignment extends BaseEntity {
  horseId: string;
  stallId: string;
  groomId?: string;
  startAt: string;
  endAt?: string;
}

export interface Ownership extends BaseEntity {
  horseId: string;
  ownerId: string;
  percent: number;
  isRepresentative: boolean;
  startDate: string;
  endDate?: string;
}

export interface BodyMeasurement extends BaseEntity {
  horseId: string;
  type: MeasurementType;
  value: number;
  measuredAt: string;
  recordedBy: string;
}

export interface HorsePhoto extends BaseEntity {
  horseId: string;
  src: string;
  caption?: string;
  uploadedBy: string;
  isAvatar: boolean;
  removedAt?: string;
}

export interface LifecycleEvent extends BaseEntity {
  horseId: string;
  from: LifecycleStatus;
  to: LifecycleStatus;
  reason: string;
  by: string;
  at: string;
}

/* ===== Flow 2 ===== */

export interface TrainingPlan extends BaseEntity {
  horseId: string;
  name: string;
  goal: string;
  targetDistanceM?: number;
  startDate: string;
  endDate: string;
  createdBy: string;
  cancelledAt?: string;
  cancelledBy?: string;
  closeReason?: PlanCloseReason;
  closeNote?: string;
  completedEarlyAt?: string;
  completedEarlyBy?: string;
  needsReview: boolean;
  needsReviewReason?: string;
  endingSoonNotifiedAt?: string;
}

export interface TrainingPhase extends BaseEntity {
  planId: string;
  orderNo: number;
  name: string;
  goal: string;
  weeks: number;
  startDate: string;
  endDate: string;
}

export interface PhaseWorkout extends BaseEntity {
  phaseId: string;
  dayOfWeek: number; // 1 = thứ 2 … 7 = chủ nhật
  slotId: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  notes?: string;
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
  performanceScore: number;
  completionLevel: CompletionLevel;
  ownerComment: string;
  internalNote?: string;
  trialTimeSeconds?: number;
  trialNotCompleted?: boolean;
  videoSrc?: string;
  videoThumbnail?: string;
  evaluatedAt: string;
  evaluatedBy: string;
  editedAt?: string;
}

export interface TrainingSession extends BaseEntity {
  horseId: string;
  planId: string;
  phaseId: string;
  phaseWorkoutId?: string;
  sessionDate: string; // YYYY-MM-DD
  slotId: string;
  groomId?: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  trainerNote?: string;
  status: SessionStatus;
  startedAt?: string;
  startedBy?: string;
  endedAt?: string;
  endedBy?: string;
  endReason?: EndReason;
  earlyEndReason?: EarlyEndReason;
  earlyEndNote?: string;
  stopReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelCategory?: CancelCategory;
  cancelReason?: string;
  simScenario?: SimScenario;
  simScenarioResolved?: Exclude<SimScenario, 'RANDOM'>;
  simSeed?: number;
  simStartedAt?: string;
  simSpeed?: number;
  maxHeartRateUsed?: number;
  edited?: boolean;
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
  ackAction?: 'STOPPED' | 'CONTINUE';
}

export interface HorseMaxHeartRate extends BaseEntity {
  horseId: string;
  value: number;
  reason: string;
  createdBy: string;
  active: boolean;
}

/* ===== Flow 3 ===== */

export interface Prescription {
  drug: string;
  dosage: string;
  days: number;
}

export interface MedicalRecord extends BaseEntity {
  horseId: string;
  examDate: string;
  reason: MedicalReason;
  symptoms: string;
  diagnosis: string;
  severity: Severity;
  treatmentPlan?: string;
  prescriptions: Prescription[];
  careInstruction?: string;
  recheckDate?: string;
  noRaceUntil?: string;
  cost?: number;
  status: MedicalRecordStatus;
  sourceType?: string;
  sourceId?: string;
  createdBy: string;
  editedAt?: string;
}

export interface MedicalFollowUp extends BaseEntity {
  recordId: string;
  date: string;
  note: string;
  cost?: number;
  createdBy: string;
}

export interface HealthStatusLog extends BaseEntity {
  horseId: string;
  fromStatus: HealthStatus;
  toStatus: HealthStatus;
  reason: string;
  recordId?: string;
  changedBy: string;
  changedAt: string;
}

export interface InjuryMark extends BaseEntity {
  horseId: string;
  region: BodyRegion;
  side?: BodySide;
  description: string;
  severity: Severity;
  detectedAt: string;
  recordId?: string;
  resolvedAt?: string;
}

export interface InjuryUpdate extends BaseEntity {
  markId: string;
  date: string;
  severity: Severity;
  note: string;
  photoSrc?: string;
  createdBy: string;
}

export interface TrainingLock extends BaseEntity {
  horseId: string;
  reason: string;
  expectedLiftDate?: string;
  placedBy: string;
  placedAt: string;
  liftedBy?: string;
  liftedAt?: string;
  liftReason?: string;
}

export interface CareSchedule extends BaseEntity {
  horseId: string;
  type: CareScheduleType;
  name?: string;
  dueDate: string;
  intervalDays: number;
  doneAt?: string;
  doneBy?: string;
  doneNote?: string;
  cost?: number;
  notifiedBeforeAt?: string;
  notifiedOverdueAt?: string;
}

/* ===== Flow 4 ===== */

export interface DietItem {
  kind: 'GRAIN' | 'HAY' | 'VITAMIN' | 'OTHER';
  name: string;
  amount: number;
  unit: string;
}

export interface DietMeal {
  meal: 'MORNING' | 'NOON' | 'AFTERNOON' | 'EVENING';
  items: DietItem[];
}

export interface DietPlan extends BaseEntity {
  horseId: string;
  revision: number;
  status: 'PENDING' | 'APPROVED' | 'SUPERSEDED';
  meals: DietMeal[];
  proposedBy: string;
  approvedBy?: string;
}

export interface DailyTask extends BaseEntity {
  horseId: string;
  date: string;
  type: DailyTaskType;
  meal?: DietMeal['meal'];
  label: string;
  groomId: string;
  doneAt?: string;
  doneBy?: string;
}

export interface Incident extends BaseEntity {
  horseId: string;
  type: IncidentType;
  description: string;
  photos: string[];
  urgent: boolean;
  status: IncidentStatus;
  reportedBy: string;
  handledBy?: string;
  conclusion?: string;
}

export interface SupplyItem extends BaseEntity {
  name: string;
  group: SupplyGroup;
  unit: string;
}

export interface ZoneStock extends BaseEntity {
  zoneId: string;
  itemId: string;
  quantity: number;
  minQuantity: number;
}

export interface RestockRequest extends BaseEntity {
  zoneId: string;
  itemId: string;
  quantity: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  decidedBy?: string;
  decisionNote?: string;
}

/* ===== Flow 5 ===== */

export interface Race extends BaseEntity {
  name: string;
  date: string;
  venue: string;
  distanceM: number;
  surface: TrackSurface;
  minAge?: number;
  fee: number;
  purse: number;
  registrationDeadline: string;
  status: RaceStatus;
}

export interface RaceRegistration extends BaseEntity {
  raceId: string;
  horseId: string;
  status: RegistrationStatus;
  createdBy: string;
  ownerDecisionBy?: string;
  cancelReason?: string;
}

export interface RaceResult extends BaseEntity {
  raceId: string;
  horseId: string;
  rank: number;
  timeSeconds: number;
  prize: number;
}

export interface Expense extends BaseEntity {
  horseId?: string;
  zoneId?: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  sourceType?: string;
  sourceId?: string;
  note?: string;
}

/* ===== Chung ===== */

export interface AppNotification extends BaseEntity {
  userId: string;
  level: 'NORMAL' | 'URGENT';
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
  before?: unknown;
  after?: unknown;
  reason?: string;
}

/** Dòng trong khung "Việc cần xử lý" đã được Bác sĩ bỏ qua. */
export interface TaskDismissal extends BaseEntity {
  key: string;
  note: string;
  by: string;
}

export interface AppSettings {
  clockMode: 'REAL' | 'SHIFTED';
  /** Chênh lệch giữa giờ hệ thống và giờ thực, tính bằng mili giây. */
  clockOffsetMs: number;
  simSpeed: number;
  defaultDailyRate: number;
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
  stallAssignments: StallAssignment[];
  ownerships: Ownership[];
  bodyMeasurements: BodyMeasurement[];
  horsePhotos: HorsePhoto[];
  lifecycleEvents: LifecycleEvent[];
  plans: TrainingPlan[];
  phases: TrainingPhase[];
  phaseWorkouts: PhaseWorkout[];
  sessions: TrainingSession[];
  alerts: TrainingAlert[];
  maxHeartRates: HorseMaxHeartRate[];
  medicalRecords: MedicalRecord[];
  medicalFollowUps: MedicalFollowUp[];
  healthStatusLogs: HealthStatusLog[];
  injuryMarks: InjuryMark[];
  injuryUpdates: InjuryUpdate[];
  trainingLocks: TrainingLock[];
  careSchedules: CareSchedule[];
  dietPlans: DietPlan[];
  dailyTasks: DailyTask[];
  incidents: Incident[];
  supplyItems: SupplyItem[];
  zoneStocks: ZoneStock[];
  restockRequests: RestockRequest[];
  races: Race[];
  raceRegistrations: RaceRegistration[];
  raceResults: RaceResult[];
  expenses: Expense[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  taskDismissals: TaskDismissal[];
}
