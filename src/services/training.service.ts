// Flow 2 — lập và thực hiện giáo án huấn luyện.
import type {
  CompletionLevel,
  Database,
  EarlyEndReason,
  PlanCloseReason,
  SimScenario,
  TrackSurface,
  TrainingIntensity,
  TrainingPlan,
  TrainingSession,
  User,
  WorkoutType,
} from '../types/domain';
import { AppError, ERR_NOT_FOUND, newId, stamp, touch } from './db';
import { commit, pushNotification, query, requirePermission, requireUser, writeAudit } from './api';
import { canViewHorse, inActionScope, visibleHorses } from '../auth/permissions';
import {
  activeLock,
  currentPhaseOf,
  findUser,
  groomIdOf,
  maxHeartRateOf,
  phasesOf,
  planStatus,
  sessionDerivedLabel,
  slotOf,
  stallOf,
  zoneIdOf,
} from './selectors';
import { canTrain, checkDayLimits, checkDistance, checkWorkoutIntensity, fastThreshold, warnConsecutiveHeavy } from '../lib/rules';
import { now, getSimSpeed } from '../lib/clock';
import { addDays, isoDayOfWeek, startOfWeek, toDateKey } from '../lib/format';
import { currentSecond, resolveScenario, simulate, type SimConfig, type SimResult } from '../lib/simulator';
import { alertRuleLabel, intensityLabel, workoutLabel } from '../lib/labels';

/* ===== tiện ích nội bộ ===== */

function trainerOfZone(db: Database, zoneId?: string): User | undefined {
  if (!zoneId) return undefined;
  return db.users.find((user) => user.role === 'HEAD_TRAINER' && user.zoneId === zoneId && user.active);
}

function vets(db: Database): User[] {
  return db.users.filter((user) => user.role === 'VETERINARIAN' && user.active);
}

function simConfigOf(db: Database, session: TrainingSession): SimConfig {
  return {
    sessionId: session.id,
    workoutType: session.workoutType,
    distanceM: session.distanceM,
    repetitions: session.repetitions,
    intensity: session.intensity,
    scenario: session.simScenarioResolved ?? 'NORMAL',
    seed: session.simSeed ?? 1,
    maxHeartRate: session.maxHeartRateUsed ?? db.settings.defaultMaxHeartRate,
  };
}

function slotEndTime(db: Database, session: TrainingSession): Date {
  const slot = slotOf(db, session.slotId);
  const [hour, minute] = (slot?.endTime ?? '23:59').split(':').map(Number);
  const date = new Date(session.sessionDate);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/* ===== F2.8 — nhịp tim tối đa ===== */

export function getMaxHeartRate(horseId: string) {
  return query((db) => ({
    current: maxHeartRateOf(db, horseId),
    isCustom: db.maxHeartRates.some((item) => item.horseId === horseId && item.active),
    clubDefault: db.settings.defaultMaxHeartRate,
    history: db.maxHeartRates
      .filter((item) => item.horseId === horseId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({
        id: item.id,
        value: item.value,
        reason: item.reason,
        active: item.active,
        createdAt: item.createdAt,
        createdByName: findUser(db, item.createdBy)?.name ?? '—',
      })),
  }));
}

export function setMaxHeartRate(horseId: string, value: number, reason: string) {
  return commit((db) => {
    const user = requirePermission('maxhr.edit');
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (horse.isReference) throw new AppError('Ngựa tham chiếu không đặt được ngưỡng');
    if (!Number.isFinite(value) || value < 180 || value > 260) {
      throw new AppError('Nhịp tim tối đa phải nằm trong khoảng 180–260 nhịp/phút', 'value');
    }
    if (!reason.trim()) throw new AppError('Vui lòng nhập lý do', 'reason');

    const at = now();
    const before = maxHeartRateOf(db, horseId);
    db.maxHeartRates.filter((item) => item.horseId === horseId).forEach((item) => {
      item.active = false;
      touch(item, at);
    });
    db.maxHeartRates.push({
      id: newId('mhr'),
      horseId,
      value,
      reason: reason.trim(),
      createdBy: user.id,
      active: true,
      ...stamp(at),
    });
    writeAudit(db, at, {
      action: 'Đặt nhịp tim tối đa',
      entityType: 'HorseMaxHeartRate',
      entityId: horseId,
      before: { value: before },
      after: { value },
      reason,
      actor: user,
    });
  });
}

export function clearMaxHeartRate(horseId: string) {
  return commit((db) => {
    const user = requirePermission('maxhr.edit');
    const at = now();
    const before = maxHeartRateOf(db, horseId);
    db.maxHeartRates.filter((item) => item.horseId === horseId).forEach((item) => {
      item.active = false;
      touch(item, at);
    });
    writeAudit(db, at, {
      action: 'Gỡ nhịp tim tối đa riêng',
      entityType: 'HorseMaxHeartRate',
      entityId: horseId,
      before: { value: before },
      after: { value: db.settings.defaultMaxHeartRate },
      actor: user,
    });
  });
}

/* ===== F2.2 — giáo án ===== */

export interface PlanRow {
  id: string;
  horseId: string;
  horseName: string;
  horseAvatar?: string;
  name: string;
  goal: string;
  targetDistanceM?: number;
  startDate: string;
  endDate: string;
  status: ReturnType<typeof planStatus>;
  needsReview: boolean;
  needsReviewReason?: string;
  phaseCount: number;
  currentPhaseNo?: number;
  zoneName?: string;
  canEdit: boolean;
}

function toPlanRow(db: Database, plan: TrainingPlan, user: User, today: Date): PlanRow {
  const horse = db.horses.find((item) => item.id === plan.horseId);
  const planPhases = phasesOf(db, plan.id);
  const current = currentPhaseOf(db, plan.id, today);
  const stall = stallOf(db, plan.horseId);
  const zone = stall ? db.zones.find((item) => item.id === stall.zoneId) : undefined;
  return {
    id: plan.id,
    horseId: plan.horseId,
    horseName: horse?.name ?? '—',
    horseAvatar: horse?.avatar,
    name: plan.name,
    goal: plan.goal,
    targetDistanceM: plan.targetDistanceM,
    startDate: plan.startDate,
    endDate: plan.completedEarlyAt ? toDateKey(plan.completedEarlyAt) : plan.endDate,
    status: planStatus(plan, today),
    needsReview: plan.needsReview,
    needsReviewReason: plan.needsReviewReason,
    phaseCount: planPhases.length,
    currentPhaseNo: current?.orderNo,
    zoneName: zone?.name,
    canEdit: inActionScope(db, user, 'plan.edit', plan.horseId),
  };
}

export function listPlans(filters: { horseId?: string; zoneId?: string; status?: string } = {}) {
  return query((db) => {
    const user = requireUser();
    const today = now();
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    return db.plans
      .filter((plan) => allowed.has(plan.horseId))
      .filter((plan) => !filters.horseId || plan.horseId === filters.horseId)
      .filter((plan) => !filters.zoneId || zoneIdOf(db, plan.horseId) === filters.zoneId)
      .map((plan) => toPlanRow(db, plan, user, today))
      .filter((row) => !filters.status || row.status === filters.status)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  });
}

export interface PhaseDetail {
  id: string;
  orderNo: number;
  name: string;
  goal: string;
  weeks: number;
  startDate: string;
  endDate: string;
  state: 'PAST' | 'CURRENT' | 'FUTURE' | 'NOT_RUN';
  workouts: {
    id: string;
    dayOfWeek: number;
    slotId: string;
    workoutType: WorkoutType;
    distanceM: number;
    repetitions: number;
    intensity: TrainingIntensity;
    surface: TrackSurface;
    notes?: string;
  }[];
  weeklyVolumeM: number;
  generatedSessions: number;
}

export function getPlan(planId: string) {
  return query((db) => {
    const user = requireUser();
    const plan = db.plans.find((item) => item.id === planId);
    if (!plan || !canViewHorse(db, user, plan.horseId)) throw new AppError(ERR_NOT_FOUND);
    const today = now();
    const key = toDateKey(today);

    const detail: PhaseDetail[] = phasesOf(db, planId).map((phase) => {
      const workouts = db.phaseWorkouts
        .filter((item) => item.phaseId === phase.id)
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.slotId.localeCompare(b.slotId));
      const effectiveEnd = plan.completedEarlyAt ? toDateKey(plan.completedEarlyAt) : plan.endDate;
      const state: PhaseDetail['state'] =
        phase.startDate > effectiveEnd
          ? 'NOT_RUN'
          : key > phase.endDate
            ? 'PAST'
            : key < phase.startDate
              ? 'FUTURE'
              : 'CURRENT';
      return {
        id: phase.id,
        orderNo: phase.orderNo,
        name: phase.name,
        goal: phase.goal,
        weeks: phase.weeks,
        startDate: phase.startDate,
        endDate: phase.endDate,
        state,
        workouts: workouts.map((item) => ({
          id: item.id,
          dayOfWeek: item.dayOfWeek,
          slotId: item.slotId,
          workoutType: item.workoutType,
          distanceM: item.distanceM,
          repetitions: item.repetitions,
          intensity: item.intensity,
          surface: item.surface,
          notes: item.notes,
        })),
        weeklyVolumeM: workouts.reduce((sum, item) => sum + item.distanceM * item.repetitions, 0),
        generatedSessions: db.sessions.filter((item) => item.phaseId === phase.id).length,
      };
    });

    return {
      plan: toPlanRow(db, plan, user, today),
      phases: detail,
      closeNote: plan.closeNote,
      closeReason: plan.closeReason,
      createdByName: findUser(db, plan.createdBy)?.name ?? '—',
    };
  });
}

export interface WorkoutTemplateInput {
  dayOfWeek: number;
  slotId: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  notes?: string;
}

export interface CreatePlanInput {
  horseId: string;
  name: string;
  goal: string;
  targetDistanceM?: number;
  startDate: string;
  phases: { name: string; goal: string; weeks: number; template: WorkoutTemplateInput[] }[];
}

function validateTemplate(template: WorkoutTemplateInput[]) {
  template.forEach((workout) => {
    const distance = checkDistance(workout.distanceM, workout.repetitions);
    if (!distance.allowed) throw new AppError(distance.reason!, 'template');
    const intensity = checkWorkoutIntensity(workout.workoutType, workout.intensity);
    if (!intensity.allowed) throw new AppError(intensity.reason!, 'template');
    if (workout.workoutType === 'TIME_TRIAL' && workout.repetitions !== 1) {
      throw new AppError('Bài chạy thử luôn lặp 1 lần', 'template');
    }
  });

  const perDay = new Map<number, WorkoutTemplateInput[]>();
  template.forEach((workout) => {
    perDay.set(workout.dayOfWeek, [...(perDay.get(workout.dayOfWeek) ?? []), workout]);
  });
  perDay.forEach((items, day) => {
    if (items.length > 2) throw new AppError(`Thứ ${day === 7 ? 'chủ nhật' : day + 1}: mỗi ngựa tối đa 2 buổi mỗi ngày`, 'template');
    if (items.filter((item) => item.intensity !== 'LIGHT').length > 1) {
      throw new AppError('Mỗi ngày chỉ được 1 buổi từ Trung bình trở lên', 'template');
    }
    const slots = new Set(items.map((item) => item.slotId));
    if (slots.size !== items.length) throw new AppError('Hai bài tập trong ngày không được trùng khung giờ', 'template');
  });
}

export function planWarnings(template: WorkoutTemplateInput[]): string[] {
  const warnings: string[] = [];
  const days = new Set(template.map((item) => item.dayOfWeek));
  if (days.size >= 7) warnings.push('Tuần mẫu không có ngày nghỉ nào');
  const heavyDays = [...new Set(template.filter((item) => item.intensity === 'HEAVY' || item.intensity === 'MAXIMUM').map((item) => item.dayOfWeek))].sort();
  for (let index = 1; index < heavyDays.length; index += 1) {
    if (heavyDays[index] - heavyDays[index - 1] === 1) {
      warnings.push('Có bài Nặng hoặc Tối đa ở hai ngày liên tiếp');
      break;
    }
  }
  return warnings;
}

export function createPlan(input: CreatePlanInput) {
  return commit((db) => {
    const user = requireUser();
    if (!inActionScope(db, user, 'plan.edit', input.horseId)) {
      throw new AppError('Bạn chỉ lập được giáo án cho ngựa trong khu phụ trách');
    }
    const horse = db.horses.find((item) => item.id === input.horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (horse.isReference || horse.lifecycleStatus !== 'ACTIVE') {
      throw new AppError('Chỉ lập giáo án cho ngựa của câu lạc bộ đang hoạt động');
    }
    if (!input.name.trim()) throw new AppError('Vui lòng nhập tên giáo án', 'name');
    if (!input.phases.length) throw new AppError('Giáo án phải có ít nhất một giai đoạn', 'phases');
    if (input.phases.length > 6) throw new AppError('Tối đa 6 giai đoạn', 'phases');

    const at = now();
    if (input.startDate < toDateKey(at)) {
      throw new AppError('Giáo án mới không được bắt đầu ở quá khứ', 'startDate');
    }
    const totalWeeks = input.phases.reduce((sum, phase) => sum + phase.weeks, 0);
    if (totalWeeks > 52) throw new AppError('Tổng số tuần của giáo án tối đa là 52', 'phases');
    input.phases.forEach((phase) => {
      if (phase.weeks < 1 || phase.weeks > 12) throw new AppError('Mỗi giai đoạn từ 1 đến 12 tuần', 'phases');
      validateTemplate(phase.template);
    });

    let cursor = new Date(input.startDate);
    let endKey = input.startDate;
    const planId = newId('plan');

    input.phases.forEach((spec, index) => {
      const phaseStart = toDateKey(cursor);
      const phaseEnd = toDateKey(addDays(cursor, spec.weeks * 7 - 1));
      endKey = phaseEnd;
      const phaseId = `${planId}_p${index + 1}`;
      db.phases.push({
        id: phaseId,
        planId,
        orderNo: index + 1,
        name: spec.name.trim() || `Giai đoạn ${index + 1}`,
        goal: spec.goal,
        weeks: spec.weeks,
        startDate: phaseStart,
        endDate: phaseEnd,
        ...stamp(at),
      });
      spec.template.forEach((workout) => {
        db.phaseWorkouts.push({ id: newId('pw'), phaseId, ...workout, ...stamp(at) });
      });
      cursor = addDays(cursor, spec.weeks * 7);
    });

    // Không cho chồng ngày với giáo án khác của cùng con ngựa.
    const overlap = db.plans.find(
      (plan) =>
        plan.horseId === input.horseId &&
        !plan.cancelledAt &&
        plan.startDate <= endKey &&
        plan.endDate >= input.startDate,
    );
    if (overlap) {
      db.phases = db.phases.filter((phase) => phase.planId !== planId);
      db.phaseWorkouts = db.phaseWorkouts.filter((workout) => !workout.phaseId.startsWith(planId));
      throw new AppError(`Chồng ngày với giáo án "${overlap.name}" (${overlap.startDate} → ${overlap.endDate})`, 'startDate');
    }

    db.plans.push({
      id: planId,
      horseId: input.horseId,
      name: input.name.trim(),
      goal: input.goal,
      targetDistanceM: input.targetDistanceM,
      startDate: input.startDate,
      endDate: endKey,
      createdBy: user.id,
      needsReview: false,
      ...stamp(at),
    });

    writeAudit(db, at, {
      action: 'Lập giáo án',
      entityType: 'TrainingPlan',
      entityId: planId,
      after: { name: input.name, startDate: input.startDate, endDate: endKey },
      actor: user,
    });
    return planId;
  });
}

export function clearNeedsReview(planId: string) {
  return commit((db) => {
    const user = requireUser();
    const plan = db.plans.find((item) => item.id === planId);
    if (!plan) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'plan.edit', plan.horseId)) throw new AppError('Bạn không phụ trách khu của ngựa này');
    const at = now();
    plan.needsReview = false;
    plan.needsReviewReason = undefined;
    touch(plan, at);
    writeAudit(db, at, {
      action: 'Tiếp tục áp dụng giáo án',
      entityType: 'TrainingPlan',
      entityId: planId,
      before: { needsReview: true },
      after: { needsReview: false },
      actor: user,
    });
  });
}

/**
 * Sửa một giai đoạn. Giai đoạn đã qua thì không sửa;
 * giai đoạn đang diễn ra sửa được mục tiêu và tuần mẫu nhưng không đổi số tuần;
 * giai đoạn chưa tới sửa được tất cả, và các giai đoạn sau dồn ngày theo.
 */
export function updatePhase(
  phaseId: string,
  spec: { name: string; goal: string; weeks: number; template: WorkoutTemplateInput[] },
) {
  return commit((db) => {
    const user = requireUser();
    const phase = db.phases.find((item) => item.id === phaseId);
    if (!phase) throw new AppError(ERR_NOT_FOUND);
    const plan = db.plans.find((item) => item.id === phase.planId);
    if (!plan) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'plan.edit', plan.horseId)) {
      throw new AppError('Bạn chỉ sửa được giáo án của ngựa trong khu phụ trách');
    }

    const at = now();
    const key = toDateKey(at);
    const status = planStatus(plan, at);
    if (status === 'CANCELLED' || status === 'COMPLETED') {
      throw new AppError('Giáo án đã đóng, không sửa được nữa');
    }
    if (key > phase.endDate) throw new AppError('Giai đoạn đã qua, không sửa được');

    const isCurrent = key >= phase.startDate && key <= phase.endDate;
    if (isCurrent && spec.weeks !== phase.weeks) {
      throw new AppError(
        'Giai đoạn đang diễn ra không đổi được số tuần. Muốn kéo dài thì thêm một giai đoạn nối tiếp.',
        'weeks',
      );
    }
    if (spec.weeks < 1 || spec.weeks > 12) throw new AppError('Mỗi giai đoạn từ 1 đến 12 tuần', 'weeks');
    validateTemplate(spec.template);

    const before = {
      name: phase.name,
      weeks: phase.weeks,
      workouts: db.phaseWorkouts.filter((item) => item.phaseId === phaseId).length,
    };

    phase.name = spec.name.trim() || phase.name;
    phase.goal = spec.goal;
    phase.weeks = spec.weeks;
    phase.endDate = toDateKey(addDays(phase.startDate, spec.weeks * 7 - 1));
    touch(phase, at);

    // Tuần mẫu mới chỉ áp dụng cho các buổi sinh sau đó; buổi đã sinh sửa trực tiếp ở lưới tuần.
    db.phaseWorkouts = db.phaseWorkouts.filter((item) => item.phaseId !== phaseId);
    spec.template.forEach((workout) => {
      db.phaseWorkouts.push({ id: newId('pw'), phaseId, ...workout, ...stamp(at) });
    });

    // Các giai đoạn sau dồn ngày theo.
    let cursor = addDays(phase.endDate, 1);
    phasesOf(db, plan.id)
      .filter((item) => item.orderNo > phase.orderNo)
      .forEach((item) => {
        item.startDate = toDateKey(cursor);
        item.endDate = toDateKey(addDays(cursor, item.weeks * 7 - 1));
        touch(item, at);
        cursor = addDays(item.endDate, 1);
      });
    const last = phasesOf(db, plan.id).at(-1);
    if (last) {
      plan.endDate = last.endDate;
      touch(plan, at);
    }

    writeAudit(db, at, {
      action: 'Sửa giai đoạn giáo án',
      entityType: 'TrainingPhase',
      entityId: phaseId,
      before,
      after: { name: phase.name, weeks: phase.weeks, workouts: spec.template.length },
      actor: user,
    });
  });
}

/** Các tuần của một giai đoạn kèm buổi tập thật đã sinh trong tuần đó. */
export function getPhaseWeeks(phaseId: string) {
  return query((db) => {
    const user = requireUser();
    const phase = db.phases.find((item) => item.id === phaseId);
    if (!phase) throw new AppError(ERR_NOT_FOUND);
    const plan = db.plans.find((item) => item.id === phase.planId);
    if (!plan || !canViewHorse(db, user, plan.horseId)) throw new AppError(ERR_NOT_FOUND);
    const todayKey = toDateKey(now());

    return Array.from({ length: phase.weeks }, (_, index) => {
      const start = toDateKey(addDays(phase.startDate, index * 7));
      const end = toDateKey(addDays(phase.startDate, index * 7 + 6));
      const sessions = db.sessions
        .filter(
          (session) => session.phaseId === phaseId && session.sessionDate >= start && session.sessionDate <= end,
        )
        .map((session) => toSessionRow(db, session, user))
        .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.slotId.localeCompare(b.slotId));
      return {
        weekNo: index + 1,
        startDate: start,
        endDate: end,
        isCurrent: todayKey >= start && todayKey <= end,
        isPast: todayKey > end,
        sessions,
        volumeM: sessions
          .filter((session) => session.status !== 'CANCELLED')
          .reduce((sum, session) => sum + session.distanceM * session.repetitions, 0),
      };
    });
  });
}

export function addPhase(planId: string, spec: { name: string; goal: string; weeks: number; template: WorkoutTemplateInput[] }) {
  return commit((db) => {
    const user = requireUser();
    const plan = db.plans.find((item) => item.id === planId);
    if (!plan) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'plan.edit', plan.horseId)) throw new AppError('Bạn không phụ trách khu của ngựa này');
    const at = now();
    if (planStatus(plan, at) === 'COMPLETED' || planStatus(plan, at) === 'CANCELLED') {
      throw new AppError('Giáo án đã đóng, hãy lập giáo án mới');
    }
    if (spec.weeks < 1 || spec.weeks > 12) throw new AppError('Mỗi giai đoạn từ 1 đến 12 tuần', 'weeks');
    validateTemplate(spec.template);

    const existing = phasesOf(db, planId);
    if (existing.length >= 6) throw new AppError('Tối đa 6 giai đoạn');
    const start = addDays(plan.endDate, 1);
    const phaseStart = toDateKey(start);
    const phaseEnd = toDateKey(addDays(start, spec.weeks * 7 - 1));
    const phaseId = `${planId}_p${existing.length + 1}`;

    db.phases.push({
      id: phaseId,
      planId,
      orderNo: existing.length + 1,
      name: spec.name.trim() || `Giai đoạn ${existing.length + 1}`,
      goal: spec.goal,
      weeks: spec.weeks,
      startDate: phaseStart,
      endDate: phaseEnd,
      ...stamp(at),
    });
    spec.template.forEach((workout) => {
      db.phaseWorkouts.push({ id: newId('pw'), phaseId, ...workout, ...stamp(at) });
    });
    plan.endDate = phaseEnd;
    touch(plan, at);

    writeAudit(db, at, {
      action: 'Thêm giai đoạn nối tiếp',
      entityType: 'TrainingPhase',
      entityId: phaseId,
      after: { name: spec.name, weeks: spec.weeks },
      actor: user,
    });
    return phaseId;
  });
}

/* ===== F2.3 — kết thúc sớm và hủy giáo án ===== */

export function countSessionsToCancel(planId: string) {
  return query((db) => {
    const today = toDateKey(now());
    return db.sessions.filter(
      (session) => session.planId === planId && session.status === 'SCHEDULED' && session.sessionDate >= today,
    ).length;
  });
}

function closePlan(
  db: Database,
  user: User,
  planId: string,
  mode: 'EARLY' | 'CANCEL',
  reason: PlanCloseReason,
  note: string,
) {
  const plan = db.plans.find((item) => item.id === planId);
  if (!plan) throw new AppError(ERR_NOT_FOUND);
  if (!inActionScope(db, user, 'plan.close', plan.horseId)) throw new AppError('Bạn không phụ trách khu của ngựa này');

  const at = now();
  const status = planStatus(plan, at);
  if (mode === 'EARLY' && status !== 'ACTIVE') throw new AppError('Chỉ kết thúc sớm được giáo án đang áp dụng');
  if (mode === 'CANCEL' && status !== 'ACTIVE' && status !== 'SCHEDULED') {
    throw new AppError('Chỉ hủy được giáo án sắp tới hoặc đang áp dụng');
  }
  if (db.sessions.some((session) => session.horseId === plan.horseId && session.status === 'IN_PROGRESS')) {
    throw new AppError('Ngựa đang có buổi tập diễn ra, hãy kết thúc buổi đó trước');
  }
  if (reason === 'OTHER' && note.trim().length < 10) {
    throw new AppError('Vui lòng mô tả lý do, tối thiểu 10 ký tự', 'note');
  }

  const todayKey = toDateKey(at);
  if (mode === 'EARLY') {
    plan.completedEarlyAt = at.toISOString();
    plan.completedEarlyBy = user.id;
    plan.endDate = todayKey;
    const current = currentPhaseOf(db, planId, at);
    if (current) {
      current.endDate = todayKey;
      touch(current, at);
    }
  } else {
    plan.cancelledAt = at.toISOString();
    plan.cancelledBy = user.id;
  }
  plan.closeReason = reason;
  plan.closeNote = note.trim() || undefined;
  touch(plan, at);

  const affected = db.sessions.filter(
    (session) => session.planId === planId && session.status === 'SCHEDULED' && session.sessionDate >= todayKey,
  );
  affected.forEach((session) => {
    session.status = 'CANCELLED';
    session.cancelCategory = 'PLAN_CLOSED';
    session.cancelReason = mode === 'EARLY' ? 'Giáo án kết thúc sớm' : 'Giáo án bị hủy';
    session.cancelledAt = at.toISOString();
    session.cancelledBy = user.id;
    touch(session, at);
  });

  const grooms = new Set(affected.map((session) => session.groomId).filter(Boolean) as string[]);
  const horse = db.horses.find((item) => item.id === plan.horseId);
  grooms.forEach((groomId) => {
    pushNotification(db, at, {
      userId: groomId,
      title: `Lịch tập của ${horse?.name} thay đổi`,
      body: `${affected.length} buổi tập đã bị hủy theo giáo án.`,
      link: '/training/schedule',
    });
  });

  writeAudit(db, at, {
    action: mode === 'EARLY' ? 'Kết thúc sớm giáo án' : 'Hủy giáo án',
    entityType: 'TrainingPlan',
    entityId: planId,
    before: { status },
    after: { status: mode === 'EARLY' ? 'COMPLETED' : 'CANCELLED', cancelledSessions: affected.length },
    reason: note || reason,
    actor: user,
  });
}

export function completePlanEarly(planId: string, reason: PlanCloseReason, note: string) {
  return commit((db) => closePlan(db, requireUser(), planId, 'EARLY', reason, note));
}

export function cancelPlan(planId: string, reason: PlanCloseReason, note: string) {
  return commit((db) => closePlan(db, requireUser(), planId, 'CANCEL', reason, note));
}

/* ===== F2.4 — phân công lịch tập ===== */

export interface SessionRow {
  id: string;
  horseId: string;
  horseName: string;
  horseAvatar?: string;
  planId: string;
  phaseId: string;
  sessionDate: string;
  slotId: string;
  slotLabel: string;
  groomId?: string;
  groomName?: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  trainerNote?: string;
  status: TrainingSession['status'];
  derivedLabel?: string;
  marks: string[];
  cancelCategory?: TrainingSession['cancelCategory'];
  cancelReason?: string;
  volumeRatio?: number;
  zoneId?: string;
  canOperate: boolean;
  canEdit: boolean;
}

function toSessionRow(db: Database, session: TrainingSession, user: User): SessionRow {
  const horse = db.horses.find((item) => item.id === session.horseId);
  const slot = slotOf(db, session.slotId);
  const marks: string[] = [];
  if (session.endReason === 'AUTO_TIMEOUT') marks.push('Tự kết thúc do quá giờ');
  if (session.endReason === 'STOPPED_BY_USER' && session.stopReason) marks.push('Dừng khẩn');
  if (session.endReason === 'TRAINING_LOCK') marks.push('Dừng khẩn');
  if (session.earlyEndReason) marks.push('Kết thúc sớm');
  if (session.evaluation?.editedAt) marks.push('Đã chỉnh sửa');

  const isGroomOwner = session.groomId === user.id;
  return {
    id: session.id,
    horseId: session.horseId,
    horseName: horse?.name ?? '—',
    horseAvatar: horse?.avatar,
    planId: session.planId,
    phaseId: session.phaseId,
    sessionDate: session.sessionDate,
    slotId: session.slotId,
    slotLabel: slot ? `${slot.startTime}–${slot.endTime}` : '—',
    groomId: user.role === 'HORSE_OWNER' ? undefined : session.groomId,
    groomName: user.role === 'HORSE_OWNER' ? undefined : findUser(db, session.groomId)?.name,
    workoutType: session.workoutType,
    distanceM: session.distanceM,
    repetitions: session.repetitions,
    intensity: session.intensity,
    surface: session.surface,
    // Ghi chú của huấn luyện viên là thông tin điều hành nội bộ, không gửi cho chủ ngựa.
    trainerNote: user.role === 'HORSE_OWNER' ? undefined : session.trainerNote,
    status: session.status,
    derivedLabel: sessionDerivedLabel(db, session, now()),
    marks,
    cancelCategory: session.cancelCategory,
    cancelReason: session.cancelReason,
    volumeRatio: session.summary?.volumeRatio,
    zoneId: zoneIdOf(db, session.horseId),
    canOperate:
      inActionScope(db, user, 'session.start', session.horseId) &&
      (user.role !== 'GROOM' || isGroomOwner),
    canEdit: inActionScope(db, user, 'session.edit', session.horseId),
  };
}

export function listSessions(filters: { from: string; to: string; horseId?: string; zoneId?: string }) {
  return query((db) => {
    const user = requireUser();
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    return db.sessions
      .filter((session) => allowed.has(session.horseId))
      .filter((session) => session.sessionDate >= filters.from && session.sessionDate <= filters.to)
      .filter((session) => !filters.horseId || session.horseId === filters.horseId)
      .filter((session) => !filters.zoneId || zoneIdOf(db, session.horseId) === filters.zoneId)
      .map((session) => toSessionRow(db, session, user))
      .sort(
        (a, b) =>
          a.sessionDate.localeCompare(b.sessionDate) ||
          a.slotId.localeCompare(b.slotId) ||
          a.horseName.localeCompare(b.horseName, 'vi'),
      );
  });
}

export function getSession(sessionId: string) {
  return query((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session || !canViewHorse(db, user, session.horseId)) throw new AppError(ERR_NOT_FOUND);
    const row = toSessionRow(db, session, user);
    const hideInternal = user.role === 'HORSE_OWNER';
    return {
      ...row,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      earlyEndReason: session.earlyEndReason,
      earlyEndNote: session.earlyEndNote,
      stopReason: session.stopReason,
      maxHeartRateUsed: session.maxHeartRateUsed,
      scenario: session.simScenarioResolved,
      summary: session.summary,
      evaluation: session.evaluation
        ? { ...session.evaluation, internalNote: hideInternal ? undefined : session.evaluation.internalNote }
        : undefined,
      evaluatedByName: findUser(db, session.evaluation?.evaluatedBy)?.name,
      alerts: db.alerts
        .filter((alert) => alert.sessionId === sessionId)
        .map((alert) => ({
          id: alert.id,
          rule: alert.rule,
          level: alert.level,
          atSecond: alert.atSecond,
          value: alert.value,
          acknowledgedByName: findUser(db, alert.acknowledgedBy)?.name,
          ackAction: alert.ackAction,
        })),
    };
  });
}

export interface GenerateResult {
  created: number;
  skipped: { date: string; reason: string }[];
}

export function generateSessions(phaseId: string): Promise<GenerateResult> {
  return commit((db) => {
    const user = requireUser();
    const phase = db.phases.find((item) => item.id === phaseId);
    if (!phase) throw new AppError(ERR_NOT_FOUND);
    const plan = db.plans.find((item) => item.id === phase.planId);
    if (!plan) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'session.edit', plan.horseId)) throw new AppError('Bạn không phụ trách khu của ngựa này');

    const horse = db.horses.find((item) => item.id === plan.horseId)!;
    const at = now();
    const todayKey = toDateKey(at);
    const templates = db.phaseWorkouts.filter((item) => item.phaseId === phaseId);
    const groomId = groomIdOf(db, plan.horseId);

    const result: GenerateResult = { created: 0, skipped: [] };
    const from = phase.startDate > todayKey ? phase.startDate : todayKey;

    for (let cursor = new Date(from); toDateKey(cursor) <= phase.endDate; cursor = addDays(cursor, 1)) {
      const dateKey = toDateKey(cursor);
      const dayOfWeek = isoDayOfWeek(cursor);
      templates
        .filter((template) => template.dayOfWeek === dayOfWeek)
        .forEach((template) => {
          const duplicate = db.sessions.some(
            (session) =>
              session.phaseWorkoutId === template.id &&
              session.sessionDate === dateKey &&
              session.status !== 'CANCELLED',
          );
          if (duplicate) {
            result.skipped.push({ date: dateKey, reason: 'Đã có buổi sinh từ cùng bài tập mẫu' });
            return;
          }
          const trainable = canTrain(db, horse, template.intensity);
          if (!trainable.allowed) {
            result.skipped.push({ date: dateKey, reason: trainable.reason! });
            return;
          }
          const limits = checkDayLimits(db, {
            horseId: plan.horseId,
            groomId,
            sessionDate: dateKey,
            slotId: template.slotId,
            intensity: template.intensity,
          });
          if (!limits.allowed) {
            result.skipped.push({ date: dateKey, reason: limits.reason! });
            return;
          }
          db.sessions.push({
            id: newId('ses'),
            horseId: plan.horseId,
            planId: plan.id,
            phaseId,
            phaseWorkoutId: template.id,
            sessionDate: dateKey,
            slotId: template.slotId,
            groomId,
            workoutType: template.workoutType,
            distanceM: template.distanceM,
            repetitions: template.repetitions,
            intensity: template.intensity,
            surface: template.surface,
            trainerNote: template.notes,
            status: 'SCHEDULED',
            ...stamp(at),
          });
          result.created += 1;
        });
    }

    if (result.created > 0 && groomId) {
      pushNotification(db, at, {
        userId: groomId,
        title: `Bạn được phân công ${result.created} buổi tập`,
        body: `Giáo án "${plan.name}" của ${horse.name}, giai đoạn ${phase.name}.`,
        link: '/training/today',
      });
    }

    writeAudit(db, at, {
      action: 'Sinh lịch tập',
      entityType: 'TrainingPhase',
      entityId: phaseId,
      after: { created: result.created, skipped: result.skipped.length },
      actor: user,
    });
    return result;
  });
}

export interface SessionInput {
  horseId: string;
  planId: string;
  phaseId: string;
  sessionDate: string;
  slotId: string;
  groomId?: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
  trainerNote?: string;
}

function validateSessionInput(db: Database, input: SessionInput, ignoreSessionId?: string) {
  const horse = db.horses.find((item) => item.id === input.horseId);
  if (!horse) throw new AppError(ERR_NOT_FOUND);

  const distance = checkDistance(input.distanceM, input.repetitions);
  if (!distance.allowed) throw new AppError(distance.reason!, 'distanceM');
  const intensity = checkWorkoutIntensity(input.workoutType, input.intensity);
  if (!intensity.allowed) throw new AppError(intensity.reason!, 'intensity');

  const trainable = canTrain(db, horse, input.intensity);
  if (!trainable.allowed) throw new AppError(trainable.reason!, 'intensity');

  const phase = db.phases.find((item) => item.id === input.phaseId);
  if (!phase) throw new AppError('Không tìm thấy giai đoạn', 'phaseId');
  if (input.sessionDate < phase.startDate || input.sessionDate > phase.endDate) {
    throw new AppError(`Ngày tập phải nằm trong giai đoạn (${phase.startDate} → ${phase.endDate})`, 'sessionDate');
  }

  const limits = checkDayLimits(db, {
    horseId: input.horseId,
    groomId: input.groomId,
    sessionDate: input.sessionDate,
    slotId: input.slotId,
    intensity: input.intensity,
    ignoreSessionId,
  });
  if (!limits.allowed) throw new AppError(limits.reason!, 'slotId');
}

export function createSession(input: SessionInput) {
  return commit((db) => {
    const user = requireUser();
    if (!inActionScope(db, user, 'session.edit', input.horseId)) {
      throw new AppError('Bạn chỉ thêm được buổi tập cho ngựa trong khu phụ trách');
    }
    validateSessionInput(db, input);
    const at = now();
    const session: TrainingSession = {
      id: newId('ses'),
      ...input,
      status: 'SCHEDULED',
      ...stamp(at),
    };
    db.sessions.push(session);

    if (input.groomId) {
      const horse = db.horses.find((item) => item.id === input.horseId);
      pushNotification(db, at, {
        userId: input.groomId,
        title: `Buổi tập mới cho ${horse?.name}`,
        body: `${input.sessionDate} · ${workoutLabel[input.workoutType]} ${input.distanceM} m × ${input.repetitions}`,
        link: '/training/today',
      });
    }
    writeAudit(db, at, {
      action: 'Thêm buổi tập',
      entityType: 'TrainingSession',
      entityId: session.id,
      after: { date: input.sessionDate, slotId: input.slotId, workoutType: input.workoutType },
      actor: user,
    });
    return session.id;
  });
}

export function updateSession(sessionId: string, input: SessionInput) {
  return commit((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'session.edit', session.horseId)) throw new AppError('Bạn không phụ trách khu của ngựa này');
    if (session.status !== 'SCHEDULED') throw new AppError('Chỉ sửa được buổi tập đang ở trạng thái Đã lên lịch');
    const at = now();
    if (session.sessionDate < toDateKey(at)) throw new AppError('Không sửa được buổi tập của ngày đã qua');

    validateSessionInput(db, input, sessionId);
    const before = {
      sessionDate: session.sessionDate,
      slotId: session.slotId,
      groomId: session.groomId,
      workoutType: session.workoutType,
      distanceM: session.distanceM,
      repetitions: session.repetitions,
      intensity: session.intensity,
    };
    Object.assign(session, input);
    touch(session, at);

    if (session.groomId) {
      const horse = db.horses.find((item) => item.id === session.horseId);
      pushNotification(db, at, {
        userId: session.groomId,
        title: `Buổi tập của ${horse?.name} đã thay đổi`,
        body: `${session.sessionDate} · ${workoutLabel[session.workoutType]} · ${intensityLabel[session.intensity]}`,
        link: '/training/today',
      });
    }
    writeAudit(db, at, {
      action: 'Sửa buổi tập',
      entityType: 'TrainingSession',
      entityId: sessionId,
      before,
      after: input,
      actor: user,
    });
  });
}

export function cancelSession(sessionId: string, reason: string) {
  return commit((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'session.edit', session.horseId)) throw new AppError('Bạn không phụ trách khu của ngựa này');
    if (session.status !== 'SCHEDULED') throw new AppError('Chỉ hủy được buổi tập đang ở trạng thái Đã lên lịch');
    if (!reason.trim()) throw new AppError('Vui lòng nhập lý do hủy', 'reason');

    const at = now();
    session.status = 'CANCELLED';
    session.cancelCategory = 'TRAINER_CHANGED';
    session.cancelReason = reason.trim();
    session.cancelledAt = at.toISOString();
    session.cancelledBy = user.id;
    touch(session, at);

    if (session.groomId) {
      const horse = db.horses.find((item) => item.id === session.horseId);
      pushNotification(db, at, {
        userId: session.groomId,
        title: `Buổi tập của ${horse?.name} bị hủy`,
        body: reason.trim(),
        link: '/training/today',
      });
    }
    writeAudit(db, at, {
      action: 'Hủy buổi tập',
      entityType: 'TrainingSession',
      entityId: sessionId,
      before: { status: 'SCHEDULED' },
      after: { status: 'CANCELLED' },
      reason,
      actor: user,
    });
  });
}

/* ===== F2.5 — thực hiện buổi tập ===== */

export function listTodaySessions() {
  return query((db) => {
    const user = requireUser();
    const todayKey = toDateKey(now());
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    let rows = db.sessions.filter((session) => session.sessionDate === todayKey && allowed.has(session.horseId));
    if (user.role === 'GROOM') rows = rows.filter((session) => session.groomId === user.id);
    if (user.role === 'HEAD_TRAINER') rows = rows.filter((session) => zoneIdOf(db, session.horseId) === user.zoneId);
    return rows
      .map((session) => toSessionRow(db, session, user))
      .sort((a, b) => a.slotId.localeCompare(b.slotId));
  });
}

export function startSession(sessionId: string, scenario: SimScenario) {
  return commit((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'session.start', session.horseId)) {
      throw new AppError('Buổi tập này không được phân công cho bạn');
    }
    if (user.role === 'GROOM' && session.groomId !== user.id) {
      throw new AppError('Buổi tập này không được phân công cho bạn');
    }
    if (session.status !== 'SCHEDULED') throw new AppError('Buổi tập không còn ở trạng thái Đã lên lịch');

    const at = now();
    if (session.sessionDate !== toDateKey(at)) {
      throw new AppError('Chỉ bắt đầu được buổi tập của ngày hôm nay');
    }

    const horse = db.horses.find((item) => item.id === session.horseId)!;
    const trainable = canTrain(db, horse, session.intensity);
    if (!trainable.allowed) throw new AppError(trainable.reason!);

    if (db.sessions.some((item) => item.horseId === session.horseId && item.status === 'IN_PROGRESS')) {
      throw new AppError('Ngựa này đang có một buổi tập diễn ra');
    }
    if (session.groomId && db.sessions.some((item) => item.groomId === session.groomId && item.status === 'IN_PROGRESS')) {
      throw new AppError('Nhân viên chăm sóc đang dắt một buổi tập khác');
    }

    const seed = Math.floor(Math.random() * 1_000_000) + 1;
    session.status = 'IN_PROGRESS';
    session.startedAt = at.toISOString();
    session.startedBy = user.id;
    session.simScenario = scenario;
    session.simScenarioResolved = resolveScenario(scenario, seed);
    session.simSeed = seed;
    session.simStartedAt = at.toISOString();
    session.simSpeed = getSimSpeed();
    session.maxHeartRateUsed = maxHeartRateOf(db, session.horseId);
    touch(session, at);

    writeAudit(db, at, {
      action: 'Bắt đầu buổi tập',
      entityType: 'TrainingSession',
      entityId: sessionId,
      before: { status: 'SCHEDULED' },
      after: { status: 'IN_PROGRESS', scenario: session.simScenarioResolved },
      actor: user,
    });
  });
}

/** Chốt chỉ số của một buổi và chuyển sang Chờ đánh giá. Dùng chung cho kết thúc, dừng khẩn, quá giờ. */
function finalizeSession(
  db: Database,
  session: TrainingSession,
  at: Date,
  endReason: TrainingSession['endReason'],
  actor: User | null,
  options: { earlyEndReason?: EarlyEndReason; earlyEndNote?: string; stopReason?: string } = {},
) {
  const result = liveResult(db, session, at);
  session.status = 'AWAITING_REVIEW';
  session.endedAt = at.toISOString();
  session.endedBy = actor?.id;
  session.endReason = endReason;
  session.stopReason = options.stopReason;
  session.summary = {
    ...result.metrics,
    alertCountRed: db.alerts.filter((alert) => alert.sessionId === session.id && alert.level === 'RED').length,
  };
  if (result.metrics.volumeRatio < 0.9) {
    session.earlyEndReason = options.earlyEndReason ?? (endReason === 'AUTO_TIMEOUT' ? 'OTHER' : 'TRAINER_ORDER');
    session.earlyEndNote = options.earlyEndNote;
  }
  touch(session, at);

  const horse = db.horses.find((item) => item.id === session.horseId);
  const trainer = trainerOfZone(db, zoneIdOf(db, session.horseId));
  const ratio = Math.round(result.metrics.volumeRatio * 100);
  if (trainer) {
    pushNotification(db, at, {
      userId: trainer.id,
      title: `${horse?.name} đã tập xong — chờ đánh giá`,
      body:
        ratio < 90
          ? `Kết thúc sớm ở ${ratio}% khối lượng.`
          : `Đạt ${ratio}% khối lượng kế hoạch.`,
      link: '/training/review',
    });
  }
  if (session.earlyEndReason === 'HORSE_UNWELL') {
    vets(db).forEach((vet) => {
      pushNotification(db, at, {
        userId: vet.id,
        level: 'URGENT',
        title: `${horse?.name} kết thúc sớm vì có dấu hiệu bất thường`,
        body: options.earlyEndNote ?? 'Huấn luyện viên hoặc nhân viên chăm sóc báo ngựa mệt.',
        link: '/medical/board',
      });
    });
  }
}

export function endSession(sessionId: string, earlyEndReason?: EarlyEndReason, earlyEndNote?: string) {
  return commit((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'session.start', session.horseId)) throw new AppError('Bạn không có quyền kết thúc buổi tập này');
    if (session.status !== 'IN_PROGRESS') throw new AppError('Buổi tập không ở trạng thái Đang diễn ra');

    const at = now();
    const result = liveResult(db, session, at);
    if (result.metrics.volumeRatio < 0.9 && !earlyEndReason) {
      throw new AppError('Khối lượng dưới 90%, vui lòng chọn lý do kết thúc sớm', 'earlyEndReason');
    }
    if (earlyEndReason === 'OTHER' && !earlyEndNote?.trim()) {
      throw new AppError('Vui lòng ghi rõ lý do', 'earlyEndNote');
    }

    finalizeSession(db, session, at, 'NORMAL', user, { earlyEndReason, earlyEndNote: earlyEndNote?.trim() });
    writeAudit(db, at, {
      action: 'Kết thúc buổi tập',
      entityType: 'TrainingSession',
      entityId: sessionId,
      before: { status: 'IN_PROGRESS' },
      after: { status: 'AWAITING_REVIEW', volumeRatio: session.summary?.volumeRatio },
      reason: earlyEndNote,
      actor: user,
    });
  });
}

export function stopSession(sessionId: string, reason: string) {
  return commit((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'session.stop', session.horseId)) throw new AppError('Bạn không có quyền dừng buổi tập này');
    if (session.status !== 'IN_PROGRESS') throw new AppError('Buổi tập không ở trạng thái Đang diễn ra');

    const at = now();
    finalizeSession(db, session, at, 'STOPPED_BY_USER', user, {
      stopReason: reason,
      earlyEndReason: 'HORSE_UNWELL',
      earlyEndNote: reason,
    });
    writeAudit(db, at, {
      action: 'Dừng khẩn buổi tập',
      entityType: 'TrainingSession',
      entityId: sessionId,
      before: { status: 'IN_PROGRESS' },
      after: { status: 'AWAITING_REVIEW' },
      reason,
      actor: user,
    });
  });
}

export function reportNotPerformed(sessionId: string, reason: string, note: string) {
  return commit((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'session.start', session.horseId)) throw new AppError('Buổi tập này không được phân công cho bạn');
    if (session.status !== 'SCHEDULED') throw new AppError('Chỉ báo được với buổi tập chưa bắt đầu');
    const at = now();
    if (session.sessionDate !== toDateKey(at)) throw new AppError('Chỉ báo được với buổi tập của hôm nay');
    if (!reason) throw new AppError('Vui lòng chọn lý do', 'reason');
    if ((reason === 'Ngựa có dấu hiệu bất thường' || reason === 'Khác') && !note.trim()) {
      throw new AppError('Vui lòng mô tả thêm', 'note');
    }

    session.status = 'CANCELLED';
    session.cancelCategory = 'GROOM_REPORTED';
    session.cancelReason = note.trim() ? `${reason} — ${note.trim()}` : reason;
    session.cancelledAt = at.toISOString();
    session.cancelledBy = user.id;
    touch(session, at);

    const horse = db.horses.find((item) => item.id === session.horseId);
    const trainer = trainerOfZone(db, zoneIdOf(db, session.horseId));
    if (trainer) {
      pushNotification(db, at, {
        userId: trainer.id,
        title: `${horse?.name}: buổi tập không thực hiện được`,
        body: session.cancelReason!,
        link: '/training/schedule',
      });
    }
    if (reason === 'Ngựa có dấu hiệu bất thường') {
      vets(db).forEach((vet) => {
        pushNotification(db, at, {
          userId: vet.id,
          level: 'URGENT',
          title: `${horse?.name} có dấu hiệu bất thường`,
          body: note.trim(),
          link: '/medical/board',
        });
      });
    }
    writeAudit(db, at, {
      action: 'Báo buổi tập không thực hiện được',
      entityType: 'TrainingSession',
      entityId: sessionId,
      after: { status: 'CANCELLED', reason: session.cancelReason },
      actor: user,
    });
  });
}

/* ===== F2.6 — theo dõi thời gian thực ===== */

function liveResult(db: Database, session: TrainingSession, at: Date): SimResult {
  if (!session.simStartedAt) {
    return simulate(simConfigOf(db, session), 0);
  }
  const second = currentSecond(session.simStartedAt, at, session.simSpeed ?? 1);
  return simulate(simConfigOf(db, session), second);
}

/**
 * Bộ xử lý nền: sinh mẫu, ghi cảnh báo mới, tự kết thúc buổi quá giờ.
 * Mã cảnh báo cố định theo buổi + quy tắc + giây nên nhiều tab không ghi trùng.
 */
export function syncRunningSessions() {
  return commit((db) => {
    const at = now();
    const running = db.sessions.filter((session) => session.status === 'IN_PROGRESS');
    running.forEach((session) => {
      const result = liveResult(db, session, at);

      result.alerts.forEach((alert) => {
        const alertId = `${session.id}-${alert.rule}-${alert.atSecond}`;
        if (db.alerts.some((item) => item.id === alertId)) return;
        const level = alert.rule === 'R6' ? 'GRAY' : 'RED';
        db.alerts.push({
          id: alertId,
          sessionId: session.id,
          horseId: session.horseId,
          rule: alert.rule,
          level,
          atSecond: alert.atSecond,
          at: at.toISOString(),
          value: alert.value,
          ...stamp(at),
        });

        const horse = db.horses.find((item) => item.id === session.horseId);
        const trainer = trainerOfZone(db, zoneIdOf(db, session.horseId));
        const title = `${alertRuleLabel[alert.rule]} — ${horse?.name}`;
        const body =
          alert.rule === 'R1'
            ? `Nhịp tim ${alert.value} nhịp/phút, vượt ngưỡng ${session.maxHeartRateUsed}.`
            : alert.rule === 'R3'
              ? `Tốc độ tụt đột ngột còn ${alert.value.toFixed(1)} m/s trong phần chạy nhanh.`
              : 'Hơn 10 giây không nhận được dữ liệu từ thiết bị.';
        if (trainer) {
          pushNotification(db, at, { userId: trainer.id, level: level === 'RED' ? 'URGENT' : 'NORMAL', title, body, link: `/training/live/${session.id}` });
        }
        if (level === 'RED') {
          vets(db).forEach((vet) => {
            pushNotification(db, at, { userId: vet.id, level: 'URGENT', title, body, link: `/training/live/${session.id}` });
          });
          if (session.groomId) {
            pushNotification(db, at, {
              userId: session.groomId,
              level: 'URGENT',
              title: 'Dừng ngựa ngay',
              body: `${horse?.name}: ${alertRuleLabel[alert.rule].toLowerCase()}.`,
              link: '/training/today',
            });
          }
        }
      });

      // Quá giờ kết thúc khung giờ 30 phút thì hệ thống tự kết thúc.
      // Quá 30 phút kể từ khi buổi lẽ ra phải xong thì hệ thống tự kết thúc.
      // Mốc tính là muộn hơn giữa "hết khung giờ" và "lúc bấm bắt đầu", vì được phép bắt đầu
      // ngoài khung giờ — nếu chỉ tính theo khung giờ thì buổi bắt đầu muộn sẽ bị đóng ngay.
      const dueAt = Math.max(slotEndTime(db, session).getTime(), new Date(session.startedAt ?? at).getTime());
      if (at.getTime() > dueAt + 30 * 60_000) {
        finalizeSession(db, session, at, 'AUTO_TIMEOUT', null);
        writeAudit(db, at, {
          action: 'Tự kết thúc buổi tập do quá giờ',
          entityType: 'TrainingSession',
          entityId: session.id,
          after: { status: 'AWAITING_REVIEW' },
          bySystem: true,
        });
      }
    });
    return running.length;
  });
}

export function getLiveSession(sessionId: string) {
  return query((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    if (user.role === 'GROOM' || user.role === 'HORSE_OWNER') {
      throw new AppError('Bạn không có quyền xem luồng dữ liệu thời gian thực');
    }
    const at = now();
    const result = liveResult(db, session, at);
    const horse = db.horses.find((item) => item.id === session.horseId);
    const last = [...result.samples].reverse().find((sample) => !sample.lost);
    return {
      session: toSessionRow(db, session, user),
      horseName: horse?.name ?? '—',
      horseAvatar: horse?.avatar,
      maxHeartRate: session.maxHeartRateUsed ?? db.settings.defaultMaxHeartRate,
      scenario: session.simScenarioResolved,
      simulated: true,
      second: result.metrics.durationSec,
      current: last ? { heartRate: last.heartRate, speedMps: last.speedMps, phase: last.phase, runIndex: last.runIndex } : undefined,
      signalLost: result.samples[result.samples.length - 1]?.lost ?? false,
      samples: result.samples.filter((sample) => !sample.lost),
      metrics: result.metrics,
      fastThresholdMps: fastThreshold(session.workoutType),
      alerts: db.alerts
        .filter((alert) => alert.sessionId === sessionId)
        .sort((a, b) => b.atSecond - a.atSecond)
        .map((alert) => ({
          id: alert.id,
          rule: alert.rule,
          level: alert.level,
          atSecond: alert.atSecond,
          value: alert.value,
          acknowledgedByName: findUser(db, alert.acknowledgedBy)?.name,
          ackAction: alert.ackAction,
        })),
      canStop: inActionScope(db, user, 'session.stop', session.horseId),
      canAck: inActionScope(db, user, 'alert.ack', session.horseId),
    };
  });
}

export function listLiveSessions() {
  return query((db) => {
    const user = requireUser();
    return db.sessions
      .filter((session) => session.status === 'IN_PROGRESS')
      .map((session) => toSessionRow(db, session, user));
  });
}

export function acknowledgeAlert(alertId: string, action: 'STOPPED' | 'CONTINUE') {
  return commit((db) => {
    const user = requireUser();
    const alert = db.alerts.find((item) => item.id === alertId);
    if (!alert) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'alert.ack', alert.horseId)) throw new AppError('Bạn không có quyền xác nhận cảnh báo này');
    const at = now();
    alert.acknowledgedBy = user.id;
    alert.acknowledgedAt = at.toISOString();
    alert.ackAction = action;
    touch(alert, at);
    writeAudit(db, at, {
      action: action === 'STOPPED' ? 'Xác nhận cảnh báo — đã dừng ngựa' : 'Xác nhận cảnh báo — tiếp tục theo dõi',
      entityType: 'TrainingAlert',
      entityId: alertId,
      after: { ackAction: action },
      actor: user,
    });
  });
}

/* ===== F2.7 — đánh giá ===== */

export function listAwaitingReview() {
  return query((db) => {
    const user = requireUser();
    const at = now();
    let rows = db.sessions.filter((session) => session.status === 'AWAITING_REVIEW');
    if (user.role === 'HEAD_TRAINER') rows = rows.filter((session) => zoneIdOf(db, session.horseId) === user.zoneId);
    return rows
      .map((session) => ({
        ...toSessionRow(db, session, user),
        endedAt: session.endedAt,
        overdue: session.endedAt ? at.getTime() - new Date(session.endedAt).getTime() > 48 * 3_600_000 : false,
      }))
      .sort((a, b) => (a.endedAt ?? '').localeCompare(b.endedAt ?? ''));
  });
}

export interface EvaluationInput {
  performanceScore: number;
  completionLevel: CompletionLevel;
  ownerComment: string;
  internalNote?: string;
  trialTimeSeconds?: number;
  trialNotCompleted?: boolean;
  videoSrc?: string;
  videoThumbnail?: string;
}

export function saveEvaluation(sessionId: string, input: EvaluationInput) {
  return commit((db) => {
    const user = requireUser();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) throw new AppError(ERR_NOT_FOUND);
    if (!inActionScope(db, user, 'session.evaluate', session.horseId)) throw new AppError('Bạn không phụ trách khu của ngựa này');

    const at = now();
    const isEdit = session.status === 'COMPLETED';
    if (!isEdit && session.status !== 'AWAITING_REVIEW') throw new AppError('Buổi tập không ở trạng thái Chờ đánh giá');
    if (isEdit) {
      const evaluatedAt = session.evaluation?.evaluatedAt;
      if (!evaluatedAt || at.getTime() - new Date(evaluatedAt).getTime() > 24 * 3_600_000) {
        throw new AppError('Đã quá 24 giờ kể từ lúc đánh giá, không sửa được nữa');
      }
    }

    if (!Number.isFinite(input.performanceScore) || input.performanceScore < 1 || input.performanceScore > 10) {
      throw new AppError('Điểm phong độ phải từ 1 đến 10', 'performanceScore');
    }
    if (!input.completionLevel) throw new AppError('Vui lòng chọn mức hoàn thành', 'completionLevel');
    if (input.ownerComment.trim().length < 20) {
      throw new AppError('Nhận xét chuyên môn tối thiểu 20 ký tự', 'ownerComment');
    }
    if (session.workoutType === 'TIME_TRIAL' && !input.trialNotCompleted && !input.trialTimeSeconds) {
      throw new AppError('Vui lòng nhập thời gian chạy thử', 'trialTimeSeconds');
    }

    const before = session.evaluation;
    session.evaluation = {
      performanceScore: input.performanceScore,
      completionLevel: input.completionLevel,
      ownerComment: input.ownerComment.trim(),
      internalNote: input.internalNote?.trim() || undefined,
      trialTimeSeconds: input.trialTimeSeconds,
      trialNotCompleted: input.trialNotCompleted,
      videoSrc: input.videoSrc ?? before?.videoSrc,
      videoThumbnail: input.videoThumbnail ?? before?.videoThumbnail,
      evaluatedAt: before?.evaluatedAt ?? at.toISOString(),
      evaluatedBy: before?.evaluatedBy ?? user.id,
      editedAt: isEdit ? at.toISOString() : undefined,
    };
    session.status = 'COMPLETED';
    touch(session, at);

    const horse = db.horses.find((item) => item.id === session.horseId);
    db.ownerships
      .filter((item) => item.horseId === session.horseId && !item.endDate)
      .forEach((item) => {
        pushNotification(db, at, {
          userId: item.ownerId,
          title: session.evaluation?.videoSrc ? `Có video chạy thử mới của ${horse?.name}` : `Có nhận xét mới cho ${horse?.name}`,
          body: input.ownerComment.trim().slice(0, 90),
          link: `/horses/${session.horseId}?tab=training`,
        });
      });

    writeAudit(db, at, {
      action: isEdit ? 'Sửa đánh giá buổi tập' : 'Đánh giá buổi tập',
      entityType: 'TrainingSession',
      entityId: sessionId,
      before: before ? { score: before.performanceScore, level: before.completionLevel } : undefined,
      after: { score: input.performanceScore, level: input.completionLevel },
      actor: user,
    });
  });
}

export function listTimeTrials(horseId?: string) {
  return query((db) => {
    const user = requireUser();
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    return db.sessions
      .filter(
        (session) =>
          session.workoutType === 'TIME_TRIAL' &&
          session.status === 'COMPLETED' &&
          allowed.has(session.horseId) &&
          (!horseId || session.horseId === horseId),
      )
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
      .map((session) => ({
        id: session.id,
        horseId: session.horseId,
        horseName: db.horses.find((item) => item.id === session.horseId)?.name ?? '—',
        sessionDate: session.sessionDate,
        distanceM: session.distanceM,
        surface: session.surface,
        timeSeconds: session.evaluation?.trialTimeSeconds,
        notCompleted: session.evaluation?.trialNotCompleted,
        videoThumbnail: session.evaluation?.videoThumbnail,
      }));
  });
}

/* ===== F2.1 — tiến độ ===== */

export interface ProgressRow {
  horseId: string;
  horseName: string;
  horseAvatar?: string;
  zoneId?: string;
  zoneName?: string;
  healthStatus: string;
  locked: boolean;
  planName?: string;
  planId?: string;
  phaseLabel?: string;
  planTag?: 'NO_PLAN' | 'ENDING_SOON';
  weekDone: number;
  weekPlanned: number;
  score7: number | null;
  alerts7: number;
  blocked: boolean;
  blockReason?: string;
}

export function getProgressBoard() {
  return query((db) => {
    const user = requireUser();
    const at = now();
    const weekStart = toDateKey(startOfWeek(at));
    const weekEnd = toDateKey(addDays(startOfWeek(at), 6));
    const sevenDaysAgo = at.getTime() - 7 * 86_400_000;

    const horses = visibleHorses(db, user).filter(
      (horse) => !horse.isReference && !horse.deletedAt && horse.lifecycleStatus === 'ACTIVE',
    );

    const rows: ProgressRow[] = horses.map((horse) => {
      const plans = db.plans.filter((plan) => plan.horseId === horse.id && planStatus(plan, at) === 'ACTIVE');
      const plan = plans[0];
      const phase = plan ? currentPhaseOf(db, plan.id, at) : undefined;
      const phaseCount = plan ? phasesOf(db, plan.id).length : 0;

      const weekSessions = db.sessions.filter(
        (session) =>
          session.horseId === horse.id &&
          session.sessionDate >= weekStart &&
          session.sessionDate <= weekEnd &&
          session.status !== 'CANCELLED',
      );
      const recent = db.sessions.filter(
        (session) =>
          session.horseId === horse.id &&
          session.status === 'COMPLETED' &&
          session.evaluation &&
          new Date(session.sessionDate).getTime() >= sevenDaysAgo,
      );
      const scores = recent.map((session) => session.evaluation!.performanceScore);

      let planTag: ProgressRow['planTag'];
      if (!plan) planTag = 'NO_PLAN';
      else {
        const daysLeft = Math.round((new Date(plan.endDate).getTime() - new Date(toDateKey(at)).getTime()) / 86_400_000);
        const hasNext = db.plans.some(
          (item) => item.horseId === horse.id && !item.cancelledAt && item.startDate > plan.endDate,
        );
        if (daysLeft <= 7 && !hasNext) planTag = 'ENDING_SOON';
      }

      const trainable = canTrain(db, horse, 'LIGHT');
      return {
        horseId: horse.id,
        horseName: horse.name,
        horseAvatar: horse.avatar,
        zoneId: zoneIdOf(db, horse.id),
        zoneName: db.zones.find((zone) => zone.id === zoneIdOf(db, horse.id))?.name,
        healthStatus: horse.healthStatus,
        locked: !!activeLock(db, horse.id),
        planName: plan?.name,
        planId: plan?.id,
        phaseLabel: phase ? `giai đoạn ${phase.orderNo}/${phaseCount}` : undefined,
        planTag,
        weekDone: weekSessions.filter((session) => session.status === 'COMPLETED').length,
        weekPlanned: weekSessions.length,
        score7: scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null,
        alerts7: db.alerts.filter(
          (alert) => alert.horseId === horse.id && new Date(alert.at).getTime() >= sevenDaysAgo,
        ).length,
        blocked: !trainable.allowed,
        blockReason: trainable.reason,
      };
    });

    return rows.sort(
      (a, b) =>
        Number(b.alerts7 > 0) - Number(a.alerts7 > 0) ||
        Number(b.blocked) - Number(a.blocked) ||
        Number(!!b.planTag) - Number(!!a.planTag) ||
        a.horseName.localeCompare(b.horseName, 'vi'),
    );
  });
}

export function getHorseProgress(horseId: string, days = 90) {
  return query((db) => {
    const user = requireUser();
    if (!canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    const plan = db.plans.find((item) => item.horseId === horseId && planStatus(item, at) === 'ACTIVE');
    const since = at.getTime() - days * 86_400_000;

    const planSessions = plan ? db.sessions.filter((session) => session.planId === plan.id) : [];
    const denominator = planSessions.filter(
      (session) =>
        !(session.status === 'CANCELLED' &&
          (session.cancelCategory === 'TRAINER_CHANGED' || session.cancelCategory === 'PLAN_CLOSED')),
    ).length;
    const completed = planSessions.filter((session) => session.status === 'COMPLETED').length;
    const fullVolume = planSessions.filter(
      (session) => session.status === 'COMPLETED' && (session.summary?.volumeRatio ?? 0) >= 0.9,
    ).length;

    const history = db.sessions
      .filter(
        (session) =>
          session.horseId === horseId &&
          session.status === 'COMPLETED' &&
          new Date(session.sessionDate).getTime() >= since,
      )
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

    return {
      planName: plan?.name,
      planId: plan?.id,
      progress: denominator ? completed / denominator : 0,
      completed,
      denominator,
      fullVolumeRatio: completed ? fullVolume / completed : 0,
      earlyEnded: history
        .filter((session) => session.earlyEndReason)
        .map((session) => ({
          id: session.id,
          date: session.sessionDate,
          reason: session.earlyEndReason!,
          note: session.earlyEndNote,
          volumeRatio: session.summary?.volumeRatio ?? 0,
        })),
      scoreSeries: history
        .filter((session) => session.evaluation)
        .map((session) => ({ date: session.sessionDate, value: session.evaluation!.performanceScore })),
      trialSeries: history
        .filter((session) => session.workoutType === 'TIME_TRIAL' && session.evaluation?.trialTimeSeconds)
        .map((session) => ({
          date: session.sessionDate,
          distanceM: session.distanceM,
          value: session.evaluation!.trialTimeSeconds!,
        })),
      cardiacSeries: history
        .filter((session) => session.summary && session.summary.mainAvgHeartRate > 0)
        .map((session) => ({
          date: session.sessionDate,
          workoutType: session.workoutType,
          value: Math.round((session.summary!.mainAvgSpeedMps / session.summary!.mainAvgHeartRate) * 100 * 10) / 10,
        })),
    };
  });
}

export function getZoneSummary() {
  return query((db) => {
    const at = now();
    return db.zones.map((zone) => {
      const horses = db.horses.filter(
        (horse) => !horse.isReference && zoneIdOf(db, horse.id) === zone.id && horse.lifecycleStatus === 'ACTIVE',
      );
      const ids = new Set(horses.map((horse) => horse.id));
      const sessions = db.sessions.filter((session) => ids.has(session.horseId));
      const sevenDaysAgo = at.getTime() - 7 * 86_400_000;
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        horseCount: horses.length,
        sessionCount: sessions.filter((session) => session.status === 'COMPLETED').length,
        alerts7: db.alerts.filter((alert) => ids.has(alert.horseId) && new Date(alert.at).getTime() >= sevenDaysAgo).length,
      };
    });
  });
}

export function listSlots() {
  return query((db) => db.slots);
}

export function listPhaseOptions(horseId: string) {
  return query((db) => {
    const at = now();
    const plans = db.plans.filter(
      (plan) => plan.horseId === horseId && !plan.cancelledAt && planStatus(plan, at) !== 'COMPLETED',
    );
    return plans.flatMap((plan) =>
      phasesOf(db, plan.id).map((phase) => ({
        planId: plan.id,
        planName: plan.name,
        phaseId: phase.id,
        phaseName: `Giai đoạn ${phase.orderNo} — ${phase.name}`,
        startDate: phase.startDate,
        endDate: phase.endDate,
      })),
    );
  });
}

export { warnConsecutiveHeavy };
