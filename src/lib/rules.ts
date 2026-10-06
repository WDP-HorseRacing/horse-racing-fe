// Quy tắc nghiệp vụ dùng chung cho mọi màn hình và mọi service (bản chốt A.4, C.2, C.3, B.2).
// "Được tập" và "Được đua" luôn tính lại mỗi lần đọc, không lưu vào dữ liệu.
import type {
  Database,
  Horse,
  LifecycleStatus,
  MeasurementType,
  TrainingIntensity,
  WorkoutType,
} from '../types/domain';
import { activeLock, healthAllows, intensityRank } from './rule-helpers';
import { healthLabel, intensityLabel, workoutLabel } from './labels';
import { addDays, formatDate, toDateKey } from './format';

export interface RuleCheck {
  allowed: boolean;
  reason?: string;
  code?: 'DELETED' | 'LIFECYCLE' | 'LOCK' | 'HEALTH';
}

export function isHeavy(intensity: TrainingIntensity): boolean {
  return intensity === 'HEAVY' || intensity === 'MAX';
}

export function maxIntensity(list: TrainingIntensity[]): TrainingIntensity | undefined {
  return list.reduce<TrainingIntensity | undefined>(
    (best, item) => (best === undefined || intensityRank(item) > intensityRank(best) ? item : best),
    undefined,
  );
}

/** Điều kiện nền: hồ sơ còn hiệu lực và ngựa đang hoạt động. */
export function baseTrainable(horse: Horse): RuleCheck {
  if (horse.deletedAt) return { allowed: false, reason: 'Hồ sơ đã bị xóa', code: 'DELETED' };
  if (horse.lifecycleStatus === 'RETIRED') return { allowed: false, reason: 'Ngựa đã giải nghệ', code: 'LIFECYCLE' };
  if (horse.lifecycleStatus === 'TRANSFERRED')
    return { allowed: false, reason: 'Ngựa đã chuyển nhượng', code: 'LIFECYCLE' };
  return { allowed: true };
}

/** Được tập = ACTIVE + sức khỏe cho phép cường độ + không có khóa huấn luyện. */
export function canTrain(db: Database, horse: Horse, intensity: TrainingIntensity): RuleCheck {
  const base = baseTrainable(horse);
  if (!base.allowed) return base;

  const lock = activeLock(db, horse.id);
  if (lock) {
    return {
      allowed: false,
      code: 'LOCK',
      reason: `Bác sĩ đã khóa huấn luyện từ ${formatDate(lock.placedAt)}. Lý do: ${lock.reason}`,
    };
  }

  if (!healthAllows(horse.healthStatus, intensity)) {
    return {
      allowed: false,
      code: 'HEALTH',
      reason:
        horse.healthStatus === 'UNDER_OBSERVATION'
          ? `Sức khỏe: ${healthLabel[horse.healthStatus]}, chỉ được tập Nhẹ và Trung bình, không được ${intensityLabel[intensity].toLowerCase()}`
          : `Sức khỏe: ${healthLabel[horse.healthStatus]}, không được tập`,
    };
  }
  return { allowed: true };
}

/** Ngựa có được tập ở bất kỳ mức nào không (dùng cho nhãn "Được tập"). */
export function canTrainAtAll(db: Database, horse: Horse): RuleCheck {
  return canTrain(db, horse, 'LIGHT');
}

/** Được đua = ACTIVE + ELIGIBLE + không có khóa huấn luyện. */
export function canRace(db: Database, horse: Horse): RuleCheck {
  const base = baseTrainable(horse);
  if (!base.allowed) return base;
  const lock = activeLock(db, horse.id);
  if (lock) {
    return { allowed: false, code: 'LOCK', reason: `Bác sĩ đã khóa huấn luyện từ ${formatDate(lock.placedAt)}` };
  }
  if (horse.healthStatus !== 'ELIGIBLE') {
    return { allowed: false, code: 'HEALTH', reason: `Sức khỏe: ${healthLabel[horse.healthStatus]}` };
  }
  return { allowed: true };
}

/* ===== Giới hạn trong ngày (C.3.16) — tính trên lịch của một con ngựa qua mọi lớp ===== */

export interface DayItem {
  date: string;
  slotId: string;
  intensity: TrainingIntensity;
  /** Nhãn hiển thị trong lý do, ví dụ tên lớp. */
  label?: string;
}

/** `sameDay` = các buổi khác của con ngựa trong cùng ngày với `candidate`. */
export function checkDayLimits(sameDay: DayItem[], candidate: DayItem): RuleCheck {
  const clash = sameDay.find((item) => item.slotId === candidate.slotId);
  if (clash) {
    return { allowed: false, reason: `Trùng khung giờ với ${clash.label ?? 'buổi khác'} ngày ${formatDate(candidate.date)}` };
  }
  if (sameDay.length >= 2) {
    return { allowed: false, reason: `Ngày ${formatDate(candidate.date)} ngựa đã có 2 buổi, tối đa 2 buổi mỗi ngày` };
  }
  const mediumPlus = sameDay.filter((item) => item.intensity !== 'LIGHT');
  if (candidate.intensity !== 'LIGHT' && mediumPlus.length >= 1) {
    return {
      allowed: false,
      reason: `Ngày ${formatDate(candidate.date)} đã có 1 buổi từ Trung bình trở lên, buổi còn lại phải là Nhẹ`,
    };
  }
  return { allowed: true };
}

/** Cảnh báo mềm (không chặn): Nặng/Tối đa ở hai ngày liên tiếp. */
export function consecutiveHeavyWarnings(items: DayItem[]): string[] {
  const heavyDays = new Set(items.filter((item) => isHeavy(item.intensity)).map((item) => item.date));
  const warnings: string[] = [];
  [...heavyDays].sort().forEach((date) => {
    const next = toDateKey(addDays(date, 1));
    if (heavyDays.has(next)) {
      warnings.push(`Có buổi Nặng/Tối đa hai ngày liên tiếp: ${formatDate(date)} và ${formatDate(next)}`);
    }
  });
  return warnings;
}

/* ===== Môn học (C.2.1) ===== */

/** Ràng buộc loại bài tập ↔ cường độ. */
export function checkWorkoutIntensity(workoutType: WorkoutType, intensity: TrainingIntensity): RuleCheck {
  if ((workoutType === 'WALK' || workoutType === 'TROT') && isHeavy(intensity)) {
    return { allowed: false, reason: `${workoutLabel[workoutType]} không được đặt cường độ Nặng hoặc Tối đa` };
  }
  if (workoutType === 'TIME_TRIAL' && !isHeavy(intensity)) {
    return { allowed: false, reason: 'Chạy thử chỉ nhận cường độ Nặng hoặc Tối đa' };
  }
  return { allowed: true };
}

export function checkDistance(distanceM: number, repetitions: number): RuleCheck {
  if (!Number.isFinite(distanceM) || distanceM < 200 || distanceM > 4000) {
    return { allowed: false, reason: 'Cự ly phải nằm trong khoảng 200–4000 m' };
  }
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
    return { allowed: false, reason: 'Số lần lặp phải là số nguyên từ 1 đến 10' };
  }
  return { allowed: true };
}

export function checkSubject(input: {
  workoutType: WorkoutType;
  intensity: TrainingIntensity;
  distanceM: number;
  repetitions: number;
}): RuleCheck {
  const intensity = checkWorkoutIntensity(input.workoutType, input.intensity);
  if (!intensity.allowed) return intensity;
  if (input.workoutType === 'TIME_TRIAL' && input.repetitions !== 1) {
    return { allowed: false, reason: 'Chạy thử luôn lặp đúng 1 lần' };
  }
  return checkDistance(input.distanceM, input.repetitions);
}

/** Ngưỡng "chạy nhanh" (m/s) theo loại bài tập. */
export function fastThreshold(workoutType: WorkoutType): number {
  if (workoutType === 'WALK') return 1;
  if (workoutType === 'TROT') return 3;
  return 6;
}

/* ===== Chỉ số cơ thể (B.2.9–B.2.13) ===== */

export const MEASUREMENT_RULES: Record<
  MeasurementType,
  { normalMin: number; normalMax: number; hardMin: number; hardMax: number; integer?: boolean }
> = {
  WEIGHT: { normalMin: 400, normalMax: 600, hardMin: 150, hardMax: 1000 },
  HEIGHT: { normalMin: 150, normalMax: 175, hardMin: 100, hardMax: 200 },
  BODY_CONDITION: { normalMin: 4, normalMax: 6, hardMin: 1, hardMax: 9, integer: true },
  TEMPERATURE: { normalMin: 37.2, normalMax: 38.3, hardMin: 30, hardMax: 45 },
};

export function checkMeasurement(
  type: MeasurementType,
  value: number,
): { valid: boolean; abnormal: boolean; reason?: string } {
  const rule = MEASUREMENT_RULES[type];
  if (!Number.isFinite(value)) return { valid: false, abnormal: false, reason: 'Giá trị không hợp lệ' };
  if (rule.integer && !Number.isInteger(value)) {
    return { valid: false, abnormal: false, reason: 'Điểm thể trạng là số nguyên trên thang 1–9' };
  }
  if (value < rule.hardMin || value > rule.hardMax) {
    return { valid: false, abnormal: false, reason: `Giá trị phải nằm trong khoảng ${rule.hardMin}–${rule.hardMax}` };
  }
  const abnormal = value < rule.normalMin || value > rule.normalMax;
  return { valid: true, abnormal, reason: abnormal ? `Ngoài khoảng bình thường ${rule.normalMin}–${rule.normalMax}` : undefined };
}

/** Thân nhiệt trên ngưỡng này sinh cảnh báo URGENT và yêu cầu khám khẩn. */
export const TEMP_ALERT_C = 38.6;
/** Cân nặng giảm quá tỉ lệ này trong số ngày này sinh cảnh báo HIGH. */
export const WEIGHT_DROP = { ratio: 0.05, days: 14 };
/** Quá hạn khám định kỳ quá số ngày này thì gửi cảnh báo HIGH. */
export const PERIODIC_ALERT_DAYS = 7;

/* ===== Vòng đời (A.2) ===== */

export function canTransition(from: LifecycleStatus, to: LifecycleStatus): boolean {
  if (from === to) return false;
  return from === 'ACTIVE' || to === 'ACTIVE';
}
