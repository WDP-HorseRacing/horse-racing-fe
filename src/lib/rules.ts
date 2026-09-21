// Quy tắc nghiệp vụ dùng chung cho mọi màn hình và mọi service.
// Điều kiện được tập là quy tắc duy nhất (Flow 2, mục III.5); giới hạn trong ngày ở mục III.6.
import type { Database, Horse, TrainingIntensity, TrainingSession } from '../types/domain';
import { activeLock, healthAllows } from './rule-helpers';
import { healthLabel, intensityLabel } from './labels';
import { formatDate } from './format';

export interface RuleCheck {
  allowed: boolean;
  reason?: string;
}

const HEAVY: TrainingIntensity[] = ['HEAVY', 'MAXIMUM'];

export function isHeavy(intensity: TrainingIntensity): boolean {
  return HEAVY.includes(intensity);
}

/** Điều kiện nền: ngựa của câu lạc bộ, đang hoạt động, chưa bị xóa. */
export function baseTrainable(horse: Horse): RuleCheck {
  if (horse.isReference) return { allowed: false, reason: 'Ngựa tham chiếu không có dữ liệu huấn luyện' };
  if (horse.deletedAt) return { allowed: false, reason: 'Hồ sơ đã bị xóa' };
  if (horse.lifecycleStatus === 'RETIRED') return { allowed: false, reason: 'Ngựa đã giải nghệ' };
  if (horse.lifecycleStatus === 'TRANSFERRED') return { allowed: false, reason: 'Ngựa đã chuyển nhượng' };
  return { allowed: true };
}

export function canTrain(db: Database, horse: Horse, intensity: TrainingIntensity): RuleCheck {
  const base = baseTrainable(horse);
  if (!base.allowed) return base;

  const lock = activeLock(db, horse.id);
  if (lock) {
    return {
      allowed: false,
      reason: `Bác sĩ đã khóa huấn luyện ngày ${formatDate(lock.placedAt)}. Lý do: ${lock.reason}`,
    };
  }

  if (!healthAllows(horse.healthStatus, intensity)) {
    return {
      allowed: false,
      reason: `Trạng thái sức khỏe: ${healthLabel[horse.healthStatus]} — không được tập mức ${intensityLabel[intensity].toLowerCase()}`,
    };
  }
  return { allowed: true };
}

/** Ngựa có được tập ở bất kỳ mức nào không (dùng cho nhãn tóm tắt). */
export function canTrainAtAll(db: Database, horse: Horse): RuleCheck {
  return canTrain(db, horse, 'LIGHT');
}

export function canRace(db: Database, horse: Horse): RuleCheck {
  const base = baseTrainable(horse);
  if (!base.allowed) return base;
  const lock = activeLock(db, horse.id);
  if (lock) return { allowed: false, reason: `Bác sĩ đã khóa huấn luyện ngày ${formatDate(lock.placedAt)}` };
  if (horse.healthStatus !== 'ELIGIBLE') {
    return { allowed: false, reason: `Trạng thái sức khỏe: ${healthLabel[horse.healthStatus]}` };
  }
  const blocking = db.medicalRecords.find(
    (record) => record.horseId === horse.id && record.noRaceUntil && record.noRaceUntil >= new Date().toISOString().slice(0, 10),
  );
  if (blocking) {
    return { allowed: false, reason: `Bác sĩ chỉ định không được đua tới ${formatDate(blocking.noRaceUntil!)}` };
  }
  return { allowed: true };
}

export interface DayLimitInput {
  horseId: string;
  groomId?: string;
  sessionDate: string;
  slotId: string;
  intensity: TrainingIntensity;
  ignoreSessionId?: string;
}

/** Giới hạn trong ngày — chỉ tính buổi chưa hủy. Trả lỗi chặn, hoặc cảnh báo mềm. */
export function checkDayLimits(db: Database, input: DayLimitInput): RuleCheck {
  const sameDay = db.sessions.filter(
    (session) =>
      session.sessionDate === input.sessionDate &&
      session.status !== 'CANCELLED' &&
      session.id !== input.ignoreSessionId,
  );

  const horseSessions = sameDay.filter((session) => session.horseId === input.horseId);

  if (horseSessions.some((session) => session.slotId === input.slotId)) {
    return { allowed: false, reason: 'Ngựa đã có buổi tập ở khung giờ này' };
  }
  if (input.groomId && sameDay.some((s) => s.groomId === input.groomId && s.slotId === input.slotId)) {
    return { allowed: false, reason: 'Nhân viên chăm sóc đã có buổi tập khác ở khung giờ này' };
  }
  if (horseSessions.length >= 2) {
    return { allowed: false, reason: 'Mỗi ngựa tối đa 2 buổi tập mỗi ngày' };
  }
  const moderateOrAbove = horseSessions.filter((session) => session.intensity !== 'LIGHT');
  if (input.intensity !== 'LIGHT' && moderateOrAbove.length >= 1) {
    return {
      allowed: false,
      reason: 'Mỗi ngày chỉ được 1 buổi từ Trung bình trở lên; buổi còn lại phải là Nhẹ',
    };
  }
  return { allowed: true };
}

/** Cảnh báo mềm: Nặng/Tối đa hai ngày liên tiếp. */
export function warnConsecutiveHeavy(
  db: Database,
  horseId: string,
  sessionDate: string,
  intensity: TrainingIntensity,
): string | undefined {
  if (!isHeavy(intensity)) return undefined;
  const previous = new Date(sessionDate);
  previous.setDate(previous.getDate() - 1);
  const key = previous.toISOString().slice(0, 10);
  const hit = db.sessions.some(
    (session) =>
      session.horseId === horseId &&
      session.sessionDate === key &&
      session.status !== 'CANCELLED' &&
      isHeavy(session.intensity),
  );
  return hit ? 'Ngựa đã có buổi Nặng/Tối đa vào ngày liền trước' : undefined;
}

/** Ràng buộc loại bài tập ↔ cường độ (mục III.1). */
export function checkWorkoutIntensity(
  workoutType: TrainingSession['workoutType'],
  intensity: TrainingIntensity,
): RuleCheck {
  if ((workoutType === 'WALK' || workoutType === 'TROT') && isHeavy(intensity)) {
    return { allowed: false, reason: 'Đi bộ và Nước kiệu không được đặt cường độ Nặng hoặc Tối đa' };
  }
  if (workoutType === 'TIME_TRIAL' && !isHeavy(intensity)) {
    return { allowed: false, reason: 'Chạy thử chỉ nhận cường độ Nặng hoặc Tối đa' };
  }
  return { allowed: true };
}

export function checkDistance(distanceM: number, repetitions: number): RuleCheck {
  if (distanceM < 200 || distanceM > 4000) {
    return { allowed: false, reason: 'Cự ly phải nằm trong khoảng 200–4000 m' };
  }
  if (repetitions < 1 || repetitions > 10) {
    return { allowed: false, reason: 'Số lần lặp phải từ 1 đến 10' };
  }
  return { allowed: true };
}

/** Ngưỡng "chạy nhanh" theo loại bài tập. */
export function fastThreshold(workoutType: TrainingSession['workoutType']): number {
  if (workoutType === 'WALK') return 1;
  if (workoutType === 'TROT') return 3;
  return 6;
}
