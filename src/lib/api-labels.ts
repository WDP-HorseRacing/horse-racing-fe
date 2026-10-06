// Nhãn tiếng Việt cho các mã chỉ backend mới có. Mã trùng với giao diện cũ
// (sức khỏe, vòng đời, giới tính, sở trường, trạng thái khu/ô, vai trò) vẫn đọc ở lib/labels.ts.
import type {
  BodyRegion,
  CareStatus,
  CareType,
  CaseStatus,
  CheckupDueStatus,
  EligibilityReason,
  ExamRequestSource,
  InjuryType,
  MeasurementType,
  PlacementStatus,
  RecoveryStatus,
  StallType,
  UserStatus,
  VisitConclusion,
  VisitKind,
} from '../api/types';

export const placementStatusLabel: Record<PlacementStatus, string> = {
  PENDING_BARN: 'Chờ xếp khu',
  PENDING_STALL: 'Chờ xếp ô',
  PLACED: 'Đã xếp chỗ',
  NOT_APPLICABLE: 'Không ở câu lạc bộ',
};

/** Lý do không được tập / không được đua. */
export const eligibilityReasonLabel: Record<EligibilityReason, string> = {
  PROFILE_DELETED: 'Hồ sơ đã xóa',
  LIFECYCLE_RETIRED: 'Đã giải nghệ',
  LIFECYCLE_TRANSFERRED: 'Đã chuyển nhượng',
  LIFECYCLE_DECEASED: 'Đã mất',
  HEALTH_UNDER_OBSERVATION: 'Đang cần theo dõi',
  HEALTH_INJURED: 'Đang chấn thương',
  HEALTH_QUARANTINED: 'Đang cách ly',
  ACTIVE_TRAINING_LOCK: 'Đang bị khóa huấn luyện',
};

export const measurementSpec: Record<MeasurementType, { name: string; unit: string; min: number; max: number; hardMin: number; hardMax: number; step: number }> = {
  WEIGHT: { name: 'Cân nặng', unit: 'kg', min: 400, max: 600, hardMin: 30, hardMax: 1500, step: 1 },
  HEIGHT: { name: 'Chiều cao', unit: 'cm', min: 150, max: 175, hardMin: 50, hardMax: 250, step: 1 },
  BODY_CONDITION: { name: 'Điểm thể trạng', unit: '/9', min: 4, max: 6, hardMin: 1, hardMax: 9, step: 1 },
  TEMPERATURE: { name: 'Thân nhiệt', unit: '°C', min: 37.2, max: 38.3, hardMin: 30, hardMax: 45, step: 0.1 },
};

export const visitKindLabel: Record<VisitKind, string> = {
  ROUTINE: 'Khám định kỳ',
  REQUEST: 'Khám theo yêu cầu',
  FOLLOW_UP: 'Tái khám',
};

export const conclusionLabel: Record<VisitConclusion, string> = {
  NORMAL: 'Bình thường',
  ISSUE: 'Có vấn đề',
};

export const caseStatusText: Record<CaseStatus, string> = {
  OPEN: 'Đang điều trị',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
};

export const requestSourceLabel: Record<ExamRequestSource, string> = {
  GROOM_INCIDENT: 'Groom báo',
  MEASUREMENT_ALERT: 'Cảnh báo chỉ số',
  STAFF: 'Nhân viên gửi',
  VET: 'Bác sĩ tạo',
};

export const checkupStatusLabel: Record<CheckupDueStatus, string> = {
  OK: 'Còn hạn',
  DUE_SOON: 'Sắp đến hạn',
  OVERDUE: 'Quá hạn',
};

export const careTypeLabel: Record<CareType, string> = {
  VACCINATION: 'Tiêm phòng',
  DEWORMING: 'Tẩy giun',
  FARRIER: 'Kiểm tra móng',
  ROUTINE_CHECKUP: 'Hẹn khám định kỳ',
};

export const careStatusLabel: Record<CareStatus, string> = {
  SCHEDULED: 'Đã lên lịch',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
};

export const bodyRegionLabel: Record<BodyRegion, string> = {
  HEAD: 'Đầu',
  NECK: 'Cổ',
  BACK: 'Lưng',
  CHEST: 'Ngực',
  ABDOMEN: 'Bụng',
  PELVIS: 'Hông, chậu',
  LEFT_FRONT_LEG: 'Chân trước trái',
  RIGHT_FRONT_LEG: 'Chân trước phải',
  LEFT_HIND_LEG: 'Chân sau trái',
  RIGHT_HIND_LEG: 'Chân sau phải',
  OTHER: 'Vị trí khác',
};

export const injuryTypeLabel: Record<InjuryType, string> = {
  FRACTURE: 'Gãy xương',
  SPRAIN: 'Bong gân',
  STRAIN: 'Căng cơ',
  WOUND: 'Vết thương',
  LACERATION: 'Vết rách',
  INFLAMMATION: 'Viêm',
  CONTUSION: 'Bầm dập',
  INFECTION: 'Nhiễm trùng',
  OTHER: 'Khác',
};

export const recoveryLabel: Record<RecoveryStatus, string> = {
  ACUTE: 'Cấp tính',
  RECOVERING: 'Đang hồi phục',
  HEALED: 'Đã lành',
};

export const stallTypeLabel: Record<StallType, string> = {
  STANDARD: 'Tiêu chuẩn',
  ISOLATION: 'Cách ly',
  RECOVERY: 'Hồi phục',
  FOALING: 'Sinh sản',
};

export const userStatusLabel: Record<UserStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Đã khóa',
  INACTIVE: 'Ngừng hoạt động',
};

/** Chức năng gây ra một lần đổi sức khỏe (lịch sử sức khỏe). */
export function healthChangeSource(feature: string | null): string {
  switch (feature) {
    case 'F1.2':
      return 'Tạo hồ sơ';
    case 'F1.8':
      return 'Đổi vòng đời';
    case 'F3.3':
      return 'Buổi khám';
    case 'F3.6':
      return 'Tái khám';
    case 'F3.7':
      return 'Bác sĩ đổi trực tiếp';
    default:
      return feature ? `Chức năng ${feature}` : 'Hệ thống';
  }
}
