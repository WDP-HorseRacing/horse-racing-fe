// Nhãn tiếng Việt cho mọi mã enum. Mã giữ tiếng Anh, giao diện luôn đọc qua đây.
import type {
  AlertRule,
  CancelCategory,
  CareScheduleType,
  CompletionLevel,
  DistancePreference,
  EarlyEndReason,
  ExpenseCategory,
  HealthStatus,
  HorseSex,
  IncidentType,
  LifecycleStatus,
  MedicalReason,
  MedicalRecordStatus,
  PlanCloseReason,
  PlanStatus,
  RaceStatus,
  RegistrationStatus,
  SessionStatus,
  Severity,
  SimScenario,
  StallType,
  SupplyGroup,
  TrackSurface,
  TrainingIntensity,
  UserRole,
  WorkoutType,
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
  HEAD_TRAINER: 'Huấn luyện viên',
  VETERINARIAN: 'Bác sĩ',
  GROOM: 'Chăm sóc',
  HORSE_OWNER: 'Chủ ngựa',
};

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

export const lifecycleLabel: Record<LifecycleStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  RETIRED: 'Đã giải nghệ',
  TRANSFERRED: 'Đã chuyển nhượng',
};

export const stallTypeLabel: Record<StallType, string> = {
  STANDARD: 'Ô thường',
  ISOLATION: 'Ô cách ly',
  RECOVERY: 'Ô phục hồi',
};

export const workoutLabel: Record<WorkoutType, string> = {
  WALK: 'Đi bộ',
  TROT: 'Nước kiệu',
  CANTER: 'Canter',
  BREEZE: 'Nước rút',
  TIME_TRIAL: 'Chạy thử',
};

export const intensityLabel: Record<TrainingIntensity, string> = {
  LIGHT: 'Nhẹ',
  MODERATE: 'Trung bình',
  HEAVY: 'Nặng',
  MAXIMUM: 'Tối đa',
};

export const surfaceLabel: Record<TrackSurface, string> = {
  TURF: 'Cỏ',
  DIRT: 'Cát',
  SYNTHETIC: 'Tổng hợp',
};

export const planStatusLabel: Record<PlanStatus, string> = {
  SCHEDULED: 'Sắp tới',
  ACTIVE: 'Đang áp dụng',
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

export const cancelCategoryLabel: Record<CancelCategory, string> = {
  TRAINER_CHANGED: 'Huấn luyện viên thay đổi kế hoạch',
  GROOM_REPORTED: 'Không thực hiện được',
  MEDICAL_BLOCK: 'Chặn y tế',
  PLAN_CLOSED: 'Theo giáo án',
  LIFECYCLE: 'Đổi vòng đời',
};

export const earlyEndLabel: Record<EarlyEndReason, string> = {
  HORSE_UNWELL: 'Ngựa mệt hoặc có dấu hiệu bất thường',
  TRAINER_ORDER: 'Theo chỉ đạo của huấn luyện viên',
  WEATHER_TRACK: 'Thời tiết hoặc sân không dùng được',
  OTHER: 'Khác',
};

export const completionLabel: Record<CompletionLevel, string> = {
  BELOW: 'Chưa đạt',
  MET: 'Đạt',
  EXCEEDED: 'Vượt',
};

export const planCloseLabel: Record<PlanCloseReason, string> = {
  GOAL_REACHED: 'Đạt mục tiêu sớm',
  NEW_PLAN: 'Chuyển sang giáo án mới',
  INJURY_ILLNESS: 'Chấn thương hoặc bệnh kéo dài',
  GOAL_CHANGED: 'Đổi mục tiêu thi đấu',
  OWNER_REQUEST: 'Theo yêu cầu chủ ngựa',
  LIFECYCLE: 'Hủy do đổi vòng đời',
  OTHER: 'Khác',
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

export const severityLabel: Record<Severity, string> = {
  MILD: 'Nhẹ',
  MODERATE: 'Vừa',
  SEVERE: 'Nặng',
};

export const medicalStatusLabel: Record<MedicalRecordStatus, string> = {
  IN_TREATMENT: 'Đang điều trị',
  RESOLVED: 'Đã khỏi',
};

export const medicalReasonLabel: Record<MedicalReason, string> = {
  ROUTINE: 'Định kỳ',
  INCIDENT: 'Theo sự cố',
  RECHECK: 'Tái khám',
  OTHER: 'Khác',
};

export const careTypeLabel: Record<CareScheduleType, string> = {
  VACCINE: 'Tiêm phòng',
  DEWORMING: 'Tẩy giun',
  FARRIER: 'Kiểm tra móng',
};

export const careInterval: Record<CareScheduleType, number> = {
  VACCINE: 180,
  DEWORMING: 90,
  FARRIER: 42,
};

export const incidentTypeLabel: Record<IncidentType, string> = {
  NOT_EATING: 'Ngựa bỏ ăn',
  COLIC_FEVER: 'Có dấu hiệu đau bụng hoặc sốt',
  HOOF_DAMAGE: 'Móng bị xước',
  OTHER: 'Khác',
};

export const supplyGroupLabel: Record<SupplyGroup, string> = {
  FEED: 'Thức ăn',
  MEDICINE: 'Thuốc',
  TOOL: 'Dụng cụ',
};

export const raceStatusLabel: Record<RaceStatus, string> = {
  OPEN: 'Mở đăng ký',
  CLOSED: 'Đóng đăng ký',
  FINISHED: 'Đã diễn ra',
};

export const registrationStatusLabel: Record<RegistrationStatus, string> = {
  PENDING_OWNER: 'Chờ chủ ngựa duyệt',
  REGISTERED: 'Đã đăng ký',
  REJECTED: 'Chủ ngựa từ chối',
  CANCELLED: 'Đã hủy',
};

export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  BOARDING: 'Nuôi dưỡng',
  MEDICAL: 'Y tế',
  RACE_FEE: 'Phí đăng ký giải',
  OPERATION: 'Vận hành',
  OTHER: 'Khác',
};

export const mealLabel: Record<'MORNING' | 'NOON' | 'AFTERNOON' | 'EVENING', string> = {
  MORNING: 'Bữa sáng',
  NOON: 'Bữa trưa',
  AFTERNOON: 'Bữa chiều',
  EVENING: 'Bữa tối',
};

export const dietKindLabel: Record<'GRAIN' | 'HAY' | 'VITAMIN' | 'OTHER', string> = {
  GRAIN: 'Ngũ cốc',
  HAY: 'Cỏ',
  VITAMIN: 'Vitamin',
  OTHER: 'Khác',
};

export const measurementLabel = {
  WEIGHT: { name: 'Cân nặng', unit: 'kg', min: 400, max: 600 },
  HEIGHT: { name: 'Chiều cao', unit: 'cm', min: 150, max: 175 },
  BODY_CONDITION: { name: 'Điểm thể trạng', unit: 'điểm', min: 4, max: 6 },
  TEMPERATURE: { name: 'Thân nhiệt', unit: '°C', min: 37.2, max: 38.3 },
} as const;

export const bodyRegionLabel: Record<string, string> = {
  HEAD: 'Đầu',
  NECK: 'Cổ',
  SHOULDER: 'Vai',
  BACK: 'Lưng',
  HIP: 'Hông',
  CHEST: 'Ngực',
  ABDOMEN: 'Bụng',
  FORE_THIGH: 'Đùi trước',
  FORE_CANNON: 'Cẳng trước',
  FORE_FETLOCK: 'Khớp cổ chân trước',
  FORE_HOOF: 'Móng trước',
  HIND_THIGH: 'Đùi sau',
  HIND_CANNON: 'Cẳng sau',
  HIND_FETLOCK: 'Khớp cổ chân sau',
  HIND_HOOF: 'Móng sau',
};

export const sideLabel: Record<string, string> = { LEFT: 'trái', RIGHT: 'phải' };

export const dayOfWeekLabel: Record<number, string> = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ nhật',
};

export const dailyTaskLabel: Record<string, string> = {
  FEED: 'Cho ăn',
  CLEAN: 'Vệ sinh chuồng',
  BATH: 'Tắm rửa',
  CARE: 'Chăm sóc theo chỉ định',
};
