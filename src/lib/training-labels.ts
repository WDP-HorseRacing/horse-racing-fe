// Nhãn tiếng Việt cho các giá trị Flow 2 của backend.
import type {
  EnrollmentStatus,
  MetricAlertLevel,
  ParticipantStatus,
  TrainingClassStatus,
  TrainingIntensity,
  TrainingSessionStatus,
  TrainingSessionType,
} from '../api/types';

export const intensityText: Record<TrainingIntensity, string> = {
  LIGHT: 'Nhẹ',
  MODERATE: 'Trung bình',
  HEAVY: 'Nặng',
};

export const INTENSITIES: TrainingIntensity[] = ['LIGHT', 'MODERATE', 'HEAVY'];

export const sessionTypeText: Record<TrainingSessionType, string> = {
  REGULAR: 'Buổi thường',
  TIME_TRIAL: 'Chạy thử',
};

export const classStatusText: Record<TrainingClassStatus, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang chạy',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const sessionStatusText: Record<TrainingSessionStatus, string> = {
  DRAFT: 'Nháp',
  SCHEDULED: 'Đã công bố',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã xong',
  CANCELLED: 'Đã hủy',
};

export const participantStatusText: Record<ParticipantStatus, string> = {
  PLANNED: 'Chờ điểm danh',
  PRESENT: 'Có mặt',
  READY: 'Sẵn sàng',
  ONGOING: 'Đang chạy',
  COMPLETED: 'Hoàn thành',
  ABSENT: 'Vắng',
  SKIPPED: 'Bỏ qua',
  INELIGIBLE: 'Không đủ điều kiện',
  CANCELLED_BY_LOCK: 'Hủy do khóa huấn luyện',
  CANCELLED: 'Đã hủy',
};

/** Các bước của một lượt tập, theo thứ tự. */
export const PARTICIPANT_FLOW: ParticipantStatus[] = ['PLANNED', 'PRESENT', 'READY', 'ONGOING', 'COMPLETED'];
/** Lượt không tập: gom vào dải riêng dưới đường đua. */
export const PARTICIPANT_OUT: ParticipantStatus[] = ['ABSENT', 'SKIPPED', 'INELIGIBLE', 'CANCELLED_BY_LOCK', 'CANCELLED'];
export const isParticipantOpen = (status: ParticipantStatus) => status === 'PLANNED' || status === 'PRESENT' || status === 'READY';

export const enrollmentStatusText: Record<EnrollmentStatus, string> = {
  ACTIVE: 'Đang học',
  LEFT: 'Đã rời lớp',
  CANCELLED: 'Đã hủy',
};

export const alertLevelText: Record<MetricAlertLevel, string> = {
  NORMAL: 'Bình thường',
  WARNING: 'Cảnh báo',
  CRITICAL: 'Nguy hiểm',
};

/** Lý do lượt "Không đủ điều kiện" BE ghi bằng mã. */
const INELIGIBLE_REASON: Record<string, string> = {
  HEALTH_UNDER_OBSERVATION: 'Đang cần theo dõi, không tập buổi nặng',
  HEALTH_INJURED: 'Đang chấn thương',
  HEALTH_QUARANTINED: 'Đang cách ly',
  LIFECYCLE_RETIRED: 'Đã giải nghệ',
  LIFECYCLE_TRANSFERRED: 'Đã chuyển nhượng',
  LIFECYCLE_DECEASED: 'Ngựa đã mất',
  PROFILE_DELETED: 'Hồ sơ đã xóa',
  ACTIVE_TRAINING_LOCK: 'Đang bị khóa huấn luyện',
};

export function ineligibleReasonText(reason: string | null | undefined): string | undefined {
  if (!reason) return undefined;
  return reason
    .split(/[,|]/)
    .map((part) => INELIGIBLE_REASON[part.trim()] ?? part.trim())
    .filter(Boolean)
    .join(', ');
}

/** Gợi ý mặt sân. BE nhận chuỗi tự do, tối đa 80 ký tự. */
export const SURFACE_SUGGESTIONS = ['Cỏ', 'Cát', 'Đất', 'Sợi tổng hợp', 'Đường dốc'];

/** Thứ trong tuần, ISO 1 là thứ Hai. */
export const weekdayShort: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };
export const weekdayLong: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ nhật',
};
