// Tách riêng để rules.ts không phụ thuộc vòng vào services/selectors.ts.
import type { Database, HealthStatus, TrainingIntensity, TrainingLock } from '../types/domain';

export function activeLock(db: Database, horseId: string): TrainingLock | undefined {
  return db.trainingLocks.find((lock) => lock.horseId === horseId && !lock.liftedAt);
}

export const INTENSITY_ORDER: TrainingIntensity[] = ['LIGHT', 'MEDIUM', 'HEAVY', 'MAX'];

export function intensityRank(intensity: TrainingIntensity): number {
  return INTENSITY_ORDER.indexOf(intensity);
}

/** Bảng cường độ được phép tập theo trạng thái sức khỏe (bản chốt A.4). */
export function healthAllows(status: HealthStatus, intensity: TrainingIntensity): boolean {
  if (status === 'ELIGIBLE') return true;
  if (status === 'UNDER_OBSERVATION') return intensity === 'LIGHT' || intensity === 'MEDIUM';
  return false;
}
