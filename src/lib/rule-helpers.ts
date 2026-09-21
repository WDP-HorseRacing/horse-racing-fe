// Tách riêng để rules.ts không phụ thuộc vòng vào services/selectors.ts.
import type { Database, HealthStatus, TrainingIntensity, TrainingLock } from '../types/domain';

export function activeLock(db: Database, horseId: string): TrainingLock | undefined {
  return db.trainingLocks.find((lock) => lock.horseId === horseId && !lock.liftedAt);
}

/** Bảng điều kiện được tập theo trạng thái sức khỏe (Flow 2, mục III.5). */
export function healthAllows(status: HealthStatus, intensity: TrainingIntensity): boolean {
  if (status === 'ELIGIBLE') return true;
  if (status === 'UNDER_OBSERVATION') return intensity === 'LIGHT' || intensity === 'MODERATE';
  return false;
}
