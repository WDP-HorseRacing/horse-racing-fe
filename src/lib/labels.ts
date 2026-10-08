// Nhãn tiếng Việt cho mọi mã enum. Mã giữ tiếng Anh, giao diện luôn đọc qua đây.
import type {
  DistancePreference,
  ExamRequestSource,
  ExamRequestStatus,
  ExamUrgency,
  ExaminationKind,
  HealthStatus,
  HorsePlacement,
  HorseSex,
  LifecycleStatus,
  LockLiftKind,
  MedicalCaseStatus,
  NotificationLevel,
  StallStatus,
  UserRole,
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
