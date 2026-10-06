// Nhãn tiếng Việt cho mọi mã enum. Mã giữ tiếng Anh, giao diện luôn đọc qua đây.
import type {
  AbsenceReason,
  AlertRule,
  AttendanceStatus,
  ClassStatus,
  DistancePreference,
  EnrollmentCloseReason,
  ExamRequestSource,
  ExamRequestStatus,
  ExamUrgency,
  ExaminationKind,
  GroomTaskKind,
  HealthStatus,
  HorsePlacement,
  HorseSex,
  LifecycleStatus,
  LockLiftKind,
  MedicalCaseStatus,
  NotificationLevel,
  SessionCancelKind,
  SessionEndReason,
  SessionStatus,
  SimScenario,
  StallStatus,
  TrackSurface,
  TrainingIntensity,
  UserRole,
  WorkoutType,
  ZoneStatus,
} from '../types/domain';

export const roleLabel: Record<UserRole, string> = {
  CLUB_MANAGER: 'Quản lý câu lạc bộ',
  HEAD_TRAINER: 'Huấn luyện viên trưởng',
  VETERINARIAN: 'Bác sĩ thú y',
  GROOM: 'Nhân viên chăm sóc',
  HORSE_OWNER: 'Chủ sở hữu ngựa',
};

export const roleShortLabel: Record<UserRole, string> = {
  CLUB_MANAGER: 'Quản lý',
  HEAD_TRAINER: 'HLV trưởng',
  VETERINARIAN: 'Bác sĩ',
  GROOM: 'Groom',
  HORSE_OWNER: 'Chủ ngựa',
};

export const notificationLevelLabel: Record<NotificationLevel, string> = {
  NORMAL: 'Thấp',
  HIGH: 'Trung bình',
  URGENT: 'Khẩn',
};

/* ===== Flow 1 ===== */

export const sexLabel: Record<HorseSex, string> = {
  MALE: 'Đực',
  FEMALE: 'Cái',
  GELDING: 'Đực đã thiến',
};

export const distanceLabel: Record<DistancePreference, string> = {
  SPRINTER: 'Cự ly ngắn',
  MILER: 'Trung bình',
  STAYER: 'Đường dài',
};

export const distanceHint: Record<DistancePreference, string> = {
  SPRINTER: 'dưới 1400 m',
  MILER: '1400–1800 m',
  STAYER: 'trên 1800 m',
};

export const healthLabel: Record<HealthStatus, string> = {
  ELIGIBLE: 'Đủ điều kiện',
  UNDER_OBSERVATION: 'Cần theo dõi',
  INJURED: 'Chấn thương',
  QUARANTINED: 'Cách ly',
};

export const healthHint: Record<HealthStatus, string> = {
  ELIGIBLE: 'Khỏe mạnh, tập và đua bình thường',
  UNDER_OBSERVATION: 'Vẫn được tập, không đăng ký đua',
  INJURED: 'Không tập, không đua',
  QUARANTINED: 'Không tập, không đua',
};

export const lifecycleLabel: Record<LifecycleStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  RETIRED: 'Đã giải nghệ',
  TRANSFERRED: 'Đã chuyển nhượng',
  DECEASED: 'Đã mất',
};

/** Câu thay cho "được tập / được đua" khi ngựa không còn hoạt động: không tập không đua là hiển nhiên. */
export const lifecycleEligibilityText: Record<Exclude<LifecycleStatus, 'ACTIVE'>, string> = {
  RETIRED: 'Không học lớp, không đua (đã giải nghệ)',
  TRANSFERRED: 'Đã rời câu lạc bộ',
  DECEASED: 'Ngựa đã mất',
};

export const zoneStatusLabel: Record<ZoneStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  MAINTENANCE: 'Bảo trì',
  CLOSED: 'Đóng',
};

export const stallStatusLabel: Record<StallStatus, string> = {
  AVAILABLE: 'Trống',
  OCCUPIED: 'Có ngựa',
  MAINTENANCE: 'Bảo trì',
};

export const placementLabel: Record<HorsePlacement, string> = {
  NO_ZONE: 'Chờ xếp khu',
  WAITING_STALL: 'Chờ xếp ô',
  WAITING_GROOM: 'Chờ phân công Groom',
  PLACED: 'Đã xếp chỗ',
  NONE: 'Không ở câu lạc bộ',
};

export const measurementLabel = {
  WEIGHT: { name: 'Cân nặng', unit: 'kg', min: 400, max: 600, step: 1 },
  HEIGHT: { name: 'Chiều cao', unit: 'cm', min: 150, max: 175, step: 1 },
  BODY_CONDITION: { name: 'Điểm thể trạng', unit: '/9', min: 4, max: 6, step: 1 },
  TEMPERATURE: { name: 'Thân nhiệt', unit: '°C', min: 37.2, max: 38.3, step: 0.1 },
} as const;

/* ===== Flow 2 ===== */

export const workoutLabel: Record<WorkoutType, string> = {
  WALK: 'Đi bộ',
  TROT: 'Nước kiệu',
  CANTER: 'Canter',
  BREEZE: 'Nước rút',
  TIME_TRIAL: 'Chạy thử',
};

export const intensityLabel: Record<TrainingIntensity, string> = {
  LIGHT: 'Nhẹ',
  MEDIUM: 'Trung bình',
  HEAVY: 'Nặng',
  MAX: 'Tối đa',
};

export const surfaceLabel: Record<TrackSurface, string> = {
  TURF: 'Cỏ',
  DIRT: 'Cát',
  SYNTHETIC: 'Tổng hợp',
};

export const classStatusLabel: Record<ClassStatus, string> = {
  SCHEDULED: 'Sắp tới',
  ACTIVE: 'Đang chạy',
  COMPLETED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
};

export const sessionStatusLabel: Record<SessionStatus, string> = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang diễn ra',
  AWAITING_REVIEW: 'Chờ đánh giá',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const sessionCancelLabel: Record<SessionCancelKind, string> = {
  MANUAL: 'HT hủy buổi',
  CLASS_CANCELLED: 'Lớp bị hủy',
  CLASS_ENDED_EARLY: 'Lớp kết thúc sớm',
};

export const sessionEndLabel: Record<SessionEndReason, string> = {
  NORMAL: 'Kết thúc bình thường',
  EMERGENCY_STOP: 'Dừng khẩn',
  AUTO_TIMEOUT: 'Tự kết thúc do quá giờ',
};

export const attendanceLabel: Record<AttendanceStatus, string> = {
  EXPECTED: 'Dự kiến',
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng',
};

export const absenceLabel: Record<AbsenceReason, string> = {
  MEDICAL_BLOCK: 'Chặn y tế',
  GROOM_REPORTED: 'Groom báo không thực hiện được',
  TRAINER_CHANGED: 'HT cho nghỉ buổi này',
  LIFECYCLE: 'Đổi vòng đời',
};

export const enrollmentCloseLabel: Record<EnrollmentCloseReason, string> = {
  MANUAL: 'HT rút khỏi lớp',
  ZONE_CHANGE: 'Đổi khu chuồng',
  LIFECYCLE: 'Đổi vòng đời',
};

export const groomTaskLabel: Record<GroomTaskKind, string> = {
  PREPARE: 'Chuẩn bị ngựa',
  TO_TRACK: 'Đưa ra sân',
  COOL_DOWN: 'Chăm sóc sau tập',
};

export const scenarioLabel: Record<SimScenario, string> = {
  NORMAL: 'Bình thường',
  HEART_OVER: 'Tim vượt ngưỡng',
  INJURY_RISK: 'Nghi chấn thương',
  SIGNAL_LOST: 'Mất tín hiệu',
  RANDOM: 'Ngẫu nhiên',
};

export const alertRuleLabel: Record<AlertRule, string> = {
  R1: 'Vượt nhịp tim tối đa',
  R3: 'Nghi chấn thương',
  R6: 'Mất tín hiệu thiết bị',
};

export const dayOfWeekLabel: Record<number, string> = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ nhật',
};

/* ===== Flow 3 ===== */

export const examRequestSourceLabel: Record<ExamRequestSource, string> = {
  GROOM_REPORT: 'Groom báo',
  BODY_METRIC_ALERT: 'Cảnh báo chỉ số cơ thể',
  TRAINING_ALERT: 'Cảnh báo buổi tập',
  MANUAL: 'Gửi tay',
  VET_SELF: 'Bác sĩ tự tạo',
};

export const examUrgencyLabel: Record<ExamUrgency, string> = {
  NORMAL: 'Bình thường',
  URGENT: 'Khẩn',
};

export const examRequestStatusLabel: Record<ExamRequestStatus, string> = {
  PENDING: 'Chờ xử lý',
  EXAMINED: 'Đã khám',
  DISMISSED: 'Đã bỏ qua',
};

export const examKindLabel: Record<ExaminationKind, string> = {
  PERIODIC: 'Khám định kỳ',
  CASE: 'Khám trong bệnh án',
};

export const caseStatusLabel: Record<MedicalCaseStatus, string> = {
  OPEN: 'Đang điều trị',
  CLOSED: 'Đã đóng',
};

export const lockLiftLabel: Record<LockLiftKind, string> = {
  MANUAL: 'Bác sĩ gỡ',
  CASE_CLOSED: 'Gỡ khi đóng bệnh án',
  TRANSFER: 'Gỡ do chuyển nhượng',
};
