// Kiểu dữ liệu đúng như backend trả về (DTO của NestJS). Ngày giờ là chuỗi ISO,
// ngày thuần là 'YYYY-MM-DD'. Nhãn tiếng Việt của các giá trị nằm ở lib/labels.ts.

/* ===== Chung ===== */

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export type Role = 'CLUB_MANAGER' | 'HEAD_TRAINER' | 'VETERINARIAN' | 'GROOM' | 'HORSE_OWNER';
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'INACTIVE';

/* ===== Tài khoản ===== */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface CurrentUser {
  userId: string;
  role: Role | null;
  status: UserStatus;
  email: string;
  fullName: string;
  roles: string[];
}

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  role: Role | null;
  status: UserStatus;
}

/* ===== Ngựa (Flow 1) ===== */

export type Gender = 'MALE' | 'FEMALE' | 'GELDING';
export type RaceAptitude = 'SPRINTER' | 'MILER' | 'STAYER';
export type HealthStatus = 'ELIGIBLE' | 'UNDER_OBSERVATION' | 'INJURED' | 'QUARANTINED';
export type LifecycleStatus = 'ACTIVE' | 'RETIRED' | 'TRANSFERRED' | 'DECEASED';
export type PlacementStatus = 'PENDING_BARN' | 'PENDING_STALL' | 'PLACED' | 'NOT_APPLICABLE';
export type EligibilityReason =
  | 'PROFILE_DELETED'
  | 'LIFECYCLE_RETIRED'
  | 'LIFECYCLE_TRANSFERRED'
  | 'LIFECYCLE_DECEASED'
  | 'HEALTH_UNDER_OBSERVATION'
  | 'HEALTH_INJURED'
  | 'HEALTH_QUARANTINED'
  | 'ACTIVE_TRAINING_LOCK';
export type MeasurementType = 'WEIGHT' | 'HEIGHT' | 'BODY_CONDITION' | 'TEMPERATURE';
export type MeasurementSource = 'MANUAL' | 'MEDICAL_EXAM';

export interface HorseBase {
  id: string;
  name: string;
  gender: Gender | null;
  breed: string | null;
  color: string | null;
  raceAptitude: RaceAptitude | null;
  dateOfBirth: string | null;
  microchipId: string | null;
  mediaId: string | null;
  sireId: string | null;
  damId: string | null;
  ownerId: string | null;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  lifecycleReason: string | null;
  lifecycleChangedAt: string | null;
  /** Ngày mất (YYYY-MM-DD), null nếu ngựa chưa mất. */
  dateOfDeath: string | null;
  version: number;
}

export interface HorseLocation {
  /** Không có id khi người xem là chủ ngựa. */
  barn: { id?: string; name: string } | null;
  stall: { id?: string; code: string } | null;
  placementStatus: PlacementStatus;
}

export interface HorseListItem extends HorseBase {
  location: HorseLocation;
  photoUrl: string | null;
  canRegisterRace: boolean;
  isDeleted: boolean;
}

export interface Eligibility {
  trainingEligible: boolean;
  racingEligible: boolean;
  trainingReasons: EligibilityReason[];
  racingReasons: EligibilityReason[];
  reasons: EligibilityReason[];
}

export interface LatestMeasurement {
  type: MeasurementType;
  value: string;
  unit: string;
  measuredAt: string;
  isAbnormal: boolean;
}

export interface Person {
  id: string;
  fullName: string;
}

/** Một giai đoạn sở hữu ngựa. Chủ ngựa chỉ nhận các giai đoạn của chính mình. */
export interface OwnershipPeriod {
  id: string;
  owner: Person;
  startedAt: string;
  /** null là giai đoạn hiện tại. */
  endedAt: string | null;
  /** Lý do chuyển chủ, null với dữ liệu chuyển đổi. */
  reason: string | null;
  /** Người ghi nhận, null với dữ liệu chuyển đổi. */
  recordedBy: Person | null;
}

export interface HorseDetail extends HorseBase {
  location: HorseLocation;
  groom: Person | null;
  owner: Person | null;
  /** Ngày bắt đầu sở hữu của chủ hiện tại (YYYY-MM-DD), null nếu chưa có chủ. */
  ownerSince: string | null;
  latestMeasurements: LatestMeasurement[];
  activeTrainingLock: boolean;
  eligibility: Eligibility;
  isDeleted: boolean;
}

export interface HorsePermissions {
  horseId: string;
  canEditProfile: boolean;
  canEditRaceAptitude: boolean;
  canAssignBarn: boolean;
  canAssignStallAndGroom: boolean;
  canChangeLifecycle: boolean;
  canDelete: boolean;
  canRestore: boolean;
  canChangeHealth: boolean;
  canRecordMeasurement: boolean;
  canDeleteMeasurement: boolean;
  canViewMedicalTab: boolean;
  canViewTrainingTab: boolean;
  canViewPerformanceTab: boolean;
}

export interface PedigreeNode {
  id: string;
  name: string;
  gender?: Gender | null;
  breed?: string | null;
  color?: string | null;
  dateOfBirth?: string | null;
  raceAptitude?: RaceAptitude | null;
  canOpen: boolean;
  generation: number;
  parentRole: 'SIRE' | 'DAM';
  childId: string;
}

export interface Pedigree {
  horseId: string;
  horseName: string;
  depth: number;
  ancestors: PedigreeNode[];
}

export interface HorseListQuery {
  search?: string;
  healthStatus?: HealthStatus;
  lifecycleStatus?: LifecycleStatus;
  gender?: Gender;
  raceAptitude?: RaceAptitude;
  barnId?: string;
  placementStatus?: PlacementStatus;
  myBarns?: boolean;
  myHorses?: boolean;
  includeDeleted?: boolean;
  sortBy?: 'NAME' | 'HEALTH_PRIORITY';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface CreateHorseInput {
  name: string;
  gender: Gender;
  breed?: string | null;
  color?: string | null;
  microchipId?: string | null;
  dateOfBirth?: string | null;
  sireId?: string | null;
  damId?: string | null;
  mediaId?: string | null;
  ownerId?: string | null;
  barnId?: string;
}

export type UpdateHorseInput = Partial<Omit<CreateHorseInput, 'barnId'>> & {
  version: number;
  raceAptitude?: RaceAptitude | null;
};

export interface Measurement extends LatestMeasurement {
  id: string;
  horseId: string;
  measuredBy: string;
  measuredByName: string;
  source: MeasurementSource;
}

export interface MeasurementAlert {
  alert: 'FEVER' | 'WEIGHT_DROP';
  severity: 'URGENT' | 'WARNING';
  baselineValue: number | null;
  dropPercent: number | null;
}

export interface CreatedMeasurement extends Measurement {
  alerts: MeasurementAlert[];
}

export interface LifecyclePreview {
  horseId: string;
  from: LifecycleStatus;
  to: LifecycleStatus;
  allowed: boolean;
  blockedReason: string | null;
  classesWithdrawn: number;
  raceRegistrationsWithdrawn: number;
  stallReleased: string | null;
  groomEnded: string | null;
  barnCleared: string | null;
  trainingLockReleased: boolean;
  examRequestsDismissed: number;
  careSchedulesCancelled: number;
  healthResetTo: HealthStatus | null;
  pendingBarnAfter: boolean;
  ownerCleared: string | null;
  summary: string | null;
}

export interface DeletionPreview {
  horseId: string;
  allowed: boolean;
  transferred: boolean;
  deceased: boolean;
  businessData: string[];
  isParent: boolean;
}

export interface RestorePreview {
  horseId: string;
  barnCleared: string | null;
  ownerCleared: string | null;
  summary: string;
}

export interface BarnPreview {
  horseId: string;
  allowed: boolean;
  blockedReason: string | null;
  fromBarnName: string | null;
  toBarnName: string;
  newHeadTrainerName: string | null;
  stallReleased: string | null;
  classesWithdrawn: number;
  groomKept: string | null;
  summary: string | null;
}

/* ===== Khu, ô, Groom ===== */

export type BarnStatus = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
export type StallStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
export type StallType = 'STANDARD' | 'ISOLATION' | 'RECOVERY' | 'FOALING';

export interface Barn {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  status: BarnStatus;
  headTrainerId: string | null;
}

export interface BarnListItem extends Barn {
  headTrainerFullName: string | null;
  hasActiveHeadTrainer: boolean;
  /** Số chỗ còn nhận = ô trống − ngựa đang chờ xếp ô. */
  availableStallCount: number;
  pendingStallHorseCount: number;
}

export interface Stall {
  id: string;
  barnId: string;
  code: string;
  type: StallType;
  status: StallStatus;
  description: string | null;
  hasCamera: boolean;
}

export interface StallAssignment {
  id: string;
  stallId: string;
  horseId: string;
  horse?: { id: string; name: string } | null;
  startAt: string;
  endAt: string | null;
}

export interface GroomAssignment {
  id: string;
  horseId: string;
  groomId: string;
  groom?: { id: string; fullName: string; email: string } | null;
  startAt: string;
  endAt: string | null;
}

export interface GroomWorkload {
  groomId: string;
  fullName: string;
  activeHorseCount: number;
}

/* ===== Ảnh ===== */

export interface UploadRequest {
  assetId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
}

/* ===== Y tế (Flow 3) ===== */

export type VisitKind = 'ROUTINE' | 'REQUEST' | 'FOLLOW_UP';
export type VisitConclusion = 'NORMAL' | 'ISSUE';
export type CaseStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type ExamRequestStatus = 'PENDING' | 'EXAMINED' | 'DISMISSED';
export type ExamRequestSource = 'GROOM_INCIDENT' | 'MEASUREMENT_ALERT' | 'STAFF' | 'VET';
export type CheckupDueStatus = 'OK' | 'DUE_SOON' | 'OVERDUE';
export type CareType = 'VACCINATION' | 'DEWORMING' | 'FARRIER' | 'ROUTINE_CHECKUP';
export type CareTaskType = Exclude<CareType, 'ROUTINE_CHECKUP'>;
export type CareStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type LockStatus = 'ACTIVE' | 'RELEASED';
export type BodyRegion =
  | 'HEAD'
  | 'NECK'
  | 'BACK'
  | 'CHEST'
  | 'ABDOMEN'
  | 'PELVIS'
  | 'LEFT_FRONT_LEG'
  | 'RIGHT_FRONT_LEG'
  | 'LEFT_HIND_LEG'
  | 'RIGHT_HIND_LEG'
  | 'OTHER';
export type InjuryType =
  | 'FRACTURE'
  | 'SPRAIN'
  | 'STRAIN'
  | 'WOUND'
  | 'LACERATION'
  | 'INFLAMMATION'
  | 'CONTUSION'
  | 'INFECTION'
  | 'OTHER';
export type RecoveryStatus = 'ACUTE' | 'RECOVERING' | 'HEALED';

export interface Prescription {
  id: string;
  medicine: string;
  /** Không có khi người xem là chủ ngựa. */
  dosage?: string;
  frequency?: string;
  startDate: string;
  endDate: string | null;
}

export interface Injury {
  id: string;
  medicalRecordId: string;
  bodyRegion: BodyRegion;
  position: { x: number; y: number; z: number } | null;
  injuryType: InjuryType;
  recoveryStatus: RecoveryStatus;
  notes: string | null;
}

export interface InjuryTimelineItem extends Injury {
  examDate: string;
  caseId: string | null;
}

export interface MedicalRecord {
  id: string;
  horseId: string;
  kind: VisitKind;
  caseId: string | null;
  conclusion: VisitConclusion | null;
  examDate: string;
  diagnosis: string | null;
  resultingStatus: HealthStatus;
  careInstructions: string | null;
  nextVisitAt: string | null;
  vetId: string;
  voidedAt: string | null;
  voidReason: string | null;
  replacesRecordId: string | null;
  prescriptions: Prescription[];
  injuries: Injury[];
}

export interface PrescriptionInput {
  medicine: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
}

export interface InjuryInput {
  bodyRegion: BodyRegion;
  injuryType: InjuryType;
  recoveryStatus: RecoveryStatus;
  notes?: string;
}

export interface VisitInputBase {
  examDate?: string;
  requestIds?: string[];
  diagnosis?: string;
  healthStatus?: HealthStatus;
  healthReason?: string;
  careInstructions?: string;
  nextVisitAt?: string;
  measurements?: { type: MeasurementType; value: number }[];
  confirmAbnormal?: boolean;
  prescriptions?: PrescriptionInput[];
  injuries?: InjuryInput[];
  replacesRecordId?: string;
}

export interface StandaloneVisitInput extends VisitInputBase {
  kind: 'ROUTINE' | 'REQUEST';
  conclusion: VisitConclusion;
  initialDiagnosis?: string;
}

export interface MedicalCase {
  id: string;
  horseId: string;
  status: CaseStatus;
  openedAt: string;
  openedBy: string;
  initialDiagnosis: string;
  closedAt: string | null;
  finalConclusion: string | null;
  /** Không có key với HT. null khi bệnh án chưa đóng, hoặc khi chi phí thuộc chủ khác (costHidden). */
  totalCost?: number | null;
  /** Chủ ngựa xem bệnh án đóng trong thời gian chủ khác sở hữu: chi phí bị ẩn. Không có key với HT. */
  costHidden?: boolean;
}

export interface MedicalCaseList {
  items: MedicalCase[];
  totalCost?: number;
}

export interface MedicalCaseDetail extends MedicalCase {
  visits: MedicalRecord[];
}

export interface ClosePreview {
  activeLock: { id: string; reason: string; lockEnd: string | null } | null;
  healthStatus: HealthStatus;
  healthWarning: boolean;
  pendingRequestCount: number;
}

export interface CloseCaseInput {
  finalConclusion: string;
  totalCost: number;
  lockDecision?: 'RELEASE' | 'KEEP';
  lockExpectedEnd?: string;
}

export interface ExamRequest {
  id: string;
  horseId: string;
  horseName: string;
  requestedBy: string | null;
  requestedBySystem: boolean;
  source: ExamRequestSource;
  urgent: boolean;
  description: string;
  status: ExamRequestStatus;
  dismissReason: string | null;
  handledBy: string | null;
  handledBySystem: boolean;
  handledAt: string | null;
  medicalRecordId: string | null;
  alertType: 'FEVER' | 'WEIGHT_DROP' | null;
  createdAt: string;
}

export interface TrainingLock {
  id: string;
  horseId: string;
  caseId: string | null;
  reason: string;
  lockStart: string;
  lockEnd: string | null;
  status: LockStatus;
  lockedBy: string;
  releasedBy: string | null;
  releasedBySystem: boolean;
  releasedAt: string | null;
  releaseConclusion: string | null;
}

export interface HealthHistoryItem {
  changedAt: string;
  from: HealthStatus | null;
  to: HealthStatus;
  reason: string | null;
  feature: string | null;
  actorId: string | null;
}

export interface HealthChangeResult {
  horseId: string;
  from: HealthStatus;
  to: HealthStatus;
  changed: boolean;
}

export interface CareSchedule {
  id: string;
  horseId: string;
  type: CareType;
  dueAt: string;
  assignedTo: string | null;
  status: CareStatus;
  completedAt: string | null;
  completedBy: string | null;
  cancelReason: string | null;
  notes: string | null;
}

export interface CareInstructions {
  horseId: string;
  current: { careInstructions: string; examDate: string; medicalRecordId: string } | null;
}

export interface CheckupItem {
  horseId: string;
  horseName: string;
  barnId: string | null;
  healthStatus: HealthStatus;
  lastVisitDate: string | null;
  dueDate: string;
  /** Âm là đã quá hạn. */
  daysLeft: number;
  dueStatus: CheckupDueStatus;
  appointment: { id: string; horseId: string; scheduledAt: string } | null;
}

export interface MedicalDashboard {
  herd: {
    counts: Record<HealthStatus, number>;
    horses: {
      horseId: string;
      horseName: string;
      barnId: string | null;
      stallId: string | null;
      stallCode: string | null;
      healthStatus: HealthStatus;
    }[];
  };
  checkups: CheckupItem[];
  careSchedules: {
    scheduleId: string;
    horseId: string;
    horseName: string;
    type: CareType;
    dueDate: string;
    assignedTo: string | null;
  }[];
  openCases: {
    caseId: string;
    horseId: string;
    horseName: string;
    initialDiagnosis: string;
    openedAt: string;
    lastVisitAt: string | null;
    nextVisitAt: string | null;
  }[];
  pendingRequests: ExamRequest[];
}

export interface CostReport {
  from: string;
  to: string;
  caseCount: number;
  totalCost: number;
  items: { horseId: string; horseName: string; caseCount: number; totalCost: number }[];
}

/* ===== Thông báo (socket notification.created và REST /notifications dùng chung một dạng) ===== */

export type NotificationCategory =
  | 'MEASUREMENT_ALERT'
  | 'EXAM_REQUEST'
  | 'BARN_ASSIGNED'
  | 'GROOM_ASSIGNMENT'
  | 'TRAINING_LOCK'
  | 'HEALTH_STATUS'
  | 'MEDICAL_CASE'
  | 'CARE_REMINDER'
  | 'HORSE_LIFECYCLE'
  | 'OWNERSHIP';
export type NotificationPriority = 'NORMAL' | 'HIGH' | 'URGENT';

/** Đối tượng mà thông báo nói tới. Mỗi ứng dụng tự đổi sang màn hình của mình (BE không gửi link). */
export interface NotificationResource {
  type: 'HORSE' | 'MEDICAL_CASE' | 'TRAINING_LOCK';
  id: string;
  /** Luôn có với thông báo mới. Thông báo cũ trong Mongo có thể thiếu. */
  horseId?: string;
}

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  /** null khi không có trang nào để mở (ví dụ chủ cũ đã bán ngựa). */
  resource: NotificationResource | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string | null;
}
