// Truy vấn dẫn xuất trên kho dữ liệu. Không sửa dữ liệu, chỉ đọc.
import type {
  Database,
  Horse,
  PlanStatus,
  SessionStatus,
  TrainingLock,
  TrainingPlan,
  TrainingSession,
  User,
} from '../types/domain';
import { toDateKey } from '../lib/format';

export function findHorse(db: Database, horseId?: string): Horse | undefined {
  return db.horses.find((horse) => horse.id === horseId);
}

export function findUser(db: Database, userId?: string): User | undefined {
  return db.users.find((user) => user.id === userId);
}

export function userName(db: Database, userId?: string): string {
  return findUser(db, userId)?.name ?? 'Hệ thống';
}

export function currentAssignment(db: Database, horseId: string) {
  return db.stallAssignments.find((item) => item.horseId === horseId && !item.endAt);
}

export function stallOf(db: Database, horseId: string) {
  const assignment = currentAssignment(db, horseId);
  if (!assignment) return undefined;
  return db.stalls.find((stall) => stall.id === assignment.stallId);
}

export function zoneIdOf(db: Database, horseId: string): string | undefined {
  return stallOf(db, horseId)?.zoneId;
}

export function zoneOf(db: Database, horseId: string) {
  const zoneId = zoneIdOf(db, horseId);
  return db.zones.find((zone) => zone.id === zoneId);
}

export function groomIdOf(db: Database, horseId: string): string | undefined {
  return currentAssignment(db, horseId)?.groomId;
}

export function stallLabel(db: Database, horseId: string): string {
  const stall = stallOf(db, horseId);
  if (!stall) return 'Chưa xếp chuồng';
  const zone = db.zones.find((item) => item.id === stall.zoneId);
  return `${zone?.name ?? '—'} · ${stall.code}`;
}

export function activeLock(db: Database, horseId: string): TrainingLock | undefined {
  return db.trainingLocks.find((lock) => lock.horseId === horseId && !lock.liftedAt);
}

export function openOwnerships(db: Database, horseId: string) {
  return db.ownerships.filter((item) => item.horseId === horseId && !item.endDate);
}

export function representativeOwner(db: Database, horseId: string) {
  const record = openOwnerships(db, horseId).find((item) => item.isRepresentative);
  return record ? findUser(db, record.ownerId) : undefined;
}

export function ownedHorseIds(db: Database, ownerId: string): string[] {
  return db.ownerships
    .filter((item) => item.ownerId === ownerId && !item.endDate)
    .map((item) => item.horseId);
}

export function horsesOfZone(db: Database, zoneId: string): Horse[] {
  return db.horses.filter((horse) => !horse.isReference && zoneIdOf(db, horse.id) === zoneId);
}

export function horsesOfGroom(db: Database, groomId: string): Horse[] {
  return db.horses.filter((horse) => groomIdOf(db, horse.id) === groomId);
}

export function maxHeartRateOf(db: Database, horseId: string): number {
  const own = db.maxHeartRates.find((item) => item.horseId === horseId && item.active);
  return own?.value ?? db.settings.defaultMaxHeartRate;
}

export function slotOf(db: Database, slotId: string) {
  return db.slots.find((slot) => slot.id === slotId);
}

export function slotLabel(db: Database, slotId: string): string {
  const slot = slotOf(db, slotId);
  return slot ? `${slot.startTime}–${slot.endTime}` : '—';
}

/** Trạng thái giáo án tính theo ngày, chỉ "Đã hủy" là lưu cứng. */
export function planStatus(plan: TrainingPlan, today: Date): PlanStatus {
  if (plan.cancelledAt) return 'CANCELLED';
  const key = toDateKey(today);
  if (plan.completedEarlyAt || key > plan.endDate) return 'COMPLETED';
  if (key < plan.startDate) return 'SCHEDULED';
  return 'ACTIVE';
}

export function activePlanOf(db: Database, horseId: string, today: Date): TrainingPlan | undefined {
  return db.plans.find(
    (plan) => plan.horseId === horseId && planStatus(plan, today) === 'ACTIVE',
  );
}

export function plansOf(db: Database, horseId: string): TrainingPlan[] {
  return db.plans
    .filter((plan) => plan.horseId === horseId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function phasesOf(db: Database, planId: string) {
  return db.phases.filter((phase) => phase.planId === planId).sort((a, b) => a.orderNo - b.orderNo);
}

export function currentPhaseOf(db: Database, planId: string, today: Date) {
  const key = toDateKey(today);
  return phasesOf(db, planId).find((phase) => key >= phase.startDate && key <= phase.endDate);
}

export function workoutsOf(db: Database, phaseId: string) {
  return db.phaseWorkouts
    .filter((workout) => workout.phaseId === phaseId)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.slotId.localeCompare(b.slotId));
}

export function sessionsOf(db: Database, horseId: string): TrainingSession[] {
  return db.sessions
    .filter((session) => session.horseId === horseId)
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.slotId.localeCompare(b.slotId));
}

export function sessionsOnDate(db: Database, dateKey: string): TrainingSession[] {
  return db.sessions
    .filter((session) => session.sessionDate === dateKey)
    .sort((a, b) => a.slotId.localeCompare(b.slotId));
}

export function runningSessions(db: Database): TrainingSession[] {
  return db.sessions.filter((session) => session.status === 'IN_PROGRESS');
}

/** Nhãn tính ra, không lưu: Quá giờ / Bỏ lỡ. */
export function sessionDerivedLabel(
  db: Database,
  session: TrainingSession,
  nowDate: Date,
): string | undefined {
  if (session.status !== 'SCHEDULED') return undefined;
  const today = toDateKey(nowDate);
  if (session.sessionDate < today) return 'Bỏ lỡ';
  if (session.sessionDate === today) {
    const slot = slotOf(db, session.slotId);
    if (slot) {
      const current = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
      if (current > slot.endTime) return 'Quá giờ';
    }
  }
  return undefined;
}

export function sessionStatusOrder(status: SessionStatus): number {
  const order: Record<SessionStatus, number> = {
    IN_PROGRESS: 0,
    AWAITING_REVIEW: 1,
    SCHEDULED: 2,
    COMPLETED: 3,
    CANCELLED: 4,
  };
  return order[status];
}

export function openMedicalRecords(db: Database, horseId: string) {
  return db.medicalRecords.filter(
    (record) => record.horseId === horseId && record.status === 'IN_TREATMENT',
  );
}
