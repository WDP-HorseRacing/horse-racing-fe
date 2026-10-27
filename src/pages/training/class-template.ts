// Tuần mẫu khi mở lớp: mỗi giai đoạn của giáo án xếp một tuần, lúc tạo lớp nhân ra mọi tuần của giai đoạn đó.
// Slot lưu theo thứ (ISO 1 đến 7) và giờ, nên đổi ngày bắt đầu lớp không phải dời slot: thứ Hai vẫn là thứ Hai.
// Tuần của lớp là khối 7 ngày tính từ ngày bắt đầu (giống BE), nên mỗi tuần có đúng một ngày cho mỗi thứ.
import type { SessionInput, TrainingIntensity, TrainingPlan, TrainingPlanPhase, TrainingSubject } from '../../api/types';
import { addDateKey, addMinutes, classEndDate, clubDateKey, clubInstant, clubTime, isoWeekdayOf, minutesBetween } from '../../lib/club-time';
import type { SessionDraft } from './components/SessionEditSheet';
import { BLOCKING, acceptInOrder, problemsAmong, type BusyItem, type PlannedItem, type Problem, type RuleContext } from './schedule-rules';

/** Bỏ buổi bắt đầu trong vài phút tới: lúc bấm Tạo lớp tới lúc BE lưu có độ trễ. */
const PAST_MARGIN_MINUTES = 5;

export interface TemplateSlot {
  id: string;
  /** Thứ theo ISO: 1 là thứ Hai, 7 là Chủ nhật. */
  weekday: number;
  /** HH:mm theo lịch CLB. */
  start: string;
  duration: number;
  subjectId: string;
  name: string;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  surface: string;
  location: string;
  notes: string;
  targetTimeMs?: number;
}

/** Tuần mẫu theo thứ tự giai đoạn (position). */
export type Templates = Record<number, TemplateSlot[]>;

export interface PhaseRange {
  phase: TrainingPlanPhase;
  from: string;
  to: string;
}

/** Khoảng ngày của từng giai đoạn tính từ ngày bắt đầu lớp (tuần 1 bắt đầu đúng ngày bắt đầu, như BE). */
export const phaseRanges = (plan: TrainingPlan, startDate: string): PhaseRange[] =>
  plan.phases.map((phase) => {
    const from = addDateKey(startDate, (phase.startWeek - 1) * 7);
    return { phase, from, to: addDateKey(from, phase.weeks * 7 - 1) };
  });

/** Ngày mang thứ `weekday` trong tuần 7 ngày bắt đầu ở `weekStart`. */
export const dateInWeek = (weekStart: string, weekday: number) => addDateKey(weekStart, (weekday - isoWeekdayOf(weekStart) + 7) % 7);

let counter = 0;
export const newSlotId = () => `slot-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function slotFromSubject(subject: TrainingSubject, weekday: number, start: string): TemplateSlot {
  return {
    id: newSlotId(),
    weekday,
    start,
    duration: subject.durationMinutes,
    subjectId: subject.id,
    name: subject.name,
    intensity: subject.intensity,
    plannedDistanceM: subject.plannedDistanceM,
    surface: subject.surface ?? '',
    location: '',
    notes: '',
    targetTimeMs: subject.sessionType === 'TIME_TRIAL' ? (subject.targetTimeMs ?? undefined) : undefined,
  };
}

/** Thời điểm của slot trong một tuần cụ thể. */
export function slotWindow(slot: Pick<TemplateSlot, 'weekday' | 'start' | 'duration'>, weekStart: string) {
  const startAt = clubInstant(dateInWeek(weekStart, slot.weekday), slot.start);
  return { startAt, endAt: addMinutes(startAt, slot.duration) };
}

export function slotToDraft(slot: TemplateSlot, weekStart: string): SessionDraft {
  const { startAt, endAt } = slotWindow(slot, weekStart);
  return {
    subjectId: slot.subjectId,
    name: slot.name,
    intensity: slot.intensity,
    plannedDistanceM: slot.plannedDistanceM,
    surface: slot.surface,
    location: slot.location,
    notes: slot.notes,
    targetTimeMs: slot.targetTimeMs,
    scheduledStartAt: startAt,
    scheduledEndAt: endAt,
  };
}

export function draftToSlot(draft: SessionDraft, id: string): TemplateSlot {
  return {
    id,
    weekday: isoWeekdayOf(clubDateKey(draft.scheduledStartAt)),
    start: clubTime(draft.scheduledStartAt),
    duration: Math.max(15, minutesBetween(draft.scheduledStartAt, draft.scheduledEndAt)),
    subjectId: draft.subjectId,
    name: draft.name.trim(),
    intensity: draft.intensity,
    plannedDistanceM: draft.plannedDistanceM,
    surface: draft.surface,
    location: draft.location,
    notes: draft.notes,
    targetTimeMs: draft.targetTimeMs,
  };
}

/** Chép tuần mẫu sang giai đoạn khác: chỉ giữ môn có trong giai đoạn đích. */
export function copyPhase(slots: TemplateSlot[], allowed: ReadonlySet<string>) {
  const kept = slots.filter((slot) => allowed.has(slot.subjectId)).map((slot) => ({ ...slot, id: newSlotId() }));
  const dropped = slots.filter((slot) => !allowed.has(slot.subjectId));
  return { kept, dropped };
}

/** Thân request của một buổi. Sửa buổi: ô xóa trắng gửi null để BE xóa giá trị cũ; thêm buổi: bỏ trống thì không gửi. */
export function draftToInput(draft: SessionDraft, subject: TrainingSubject, mode: 'create' | 'update'): SessionInput {
  const trial = subject.sessionType === 'TIME_TRIAL';
  const empty = mode === 'update' ? null : undefined;
  const body: SessionInput = {
    name: draft.name.trim(),
    subjectId: subject.id,
    intensity: draft.intensity,
    plannedDistanceM: draft.plannedDistanceM,
    scheduledStartAt: draft.scheduledStartAt,
    scheduledEndAt: draft.scheduledEndAt,
    location: draft.location.trim() || empty,
    surface: draft.surface.trim() || empty,
    notes: draft.notes.trim() || empty,
  };
  // Loại buổi theo môn. Môn thường thì BE tự bỏ mục tiêu, không gửi.
  if (mode === 'create') return { ...body, sessionType: subject.sessionType, ...(trial ? { targetTimeMs: draft.targetTimeMs ?? null } : {}) };
  return trial ? { ...body, targetTimeMs: draft.targetTimeMs ?? null } : body;
}

/** Một buổi sinh ra từ slot ở một tuần cụ thể của lớp. */
export interface Expanded extends PlannedItem {
  slot: TemplateSlot;
  phase: number;
  /** Tuần của lớp, bắt đầu từ 1. */
  week: number;
}

/** Luật môn theo giai đoạn của một ngày. */
export function phaseLookup(ranges: PhaseRange[]): RuleContext['phaseSubjects'] {
  const sets = ranges.map((range) => ({ ...range, ids: new Set(range.phase.subjects.map((item) => item.subject.id)) }));
  return (dateKey) => {
    const found = sets.find((range) => dateKey >= range.from && dateKey <= range.to);
    return found ? { position: found.phase.position, ids: found.ids } : undefined;
  };
}

export function expandTemplates(plan: TrainingPlan, startDate: string, templates: Templates, subjects: Map<string, TrainingSubject>): Expanded[] {
  return phaseRanges(plan, startDate)
    .flatMap(({ phase, from }) =>
      (templates[phase.position] ?? []).flatMap((slot) =>
        Array.from({ length: phase.weeks }, (_, offset) => {
          const { startAt, endAt } = slotWindow(slot, addDateKey(from, offset * 7));
          return {
            key: `${slot.id}@${offset}`,
            name: slot.name,
            intensity: slot.intensity,
            startAt,
            endAt,
            subjectId: slot.subjectId,
            sessionType: subjects.get(slot.subjectId)?.sessionType,
            plannedDistanceM: slot.plannedDistanceM,
            slot,
            phase: phase.position,
            week: phase.startWeek + offset,
          };
        }),
      ),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export interface Submission {
  /** Buổi sẽ gửi lên BE, theo giờ. */
  accepted: Expanded[];
  /** Buổi bỏ vì đã qua giờ (lớp bắt đầu hôm nay). */
  past: Expanded[];
  /** Buổi bỏ vì trùng lịch lớp khác của HLV. */
  busySkipped: { item: Expanded; problem: Problem }[];
  /** Lỗi chặn tạo lớp, theo slot. */
  errors: Map<string, Problem>;
  /** Cảnh báo không chặn, theo slot (câu đã gộp). */
  warnings: Map<string, string>;
  minutes: number;
  /** Môn còn thiếu buổi tối thiểu mỗi tuần, theo giai đoạn. */
  short: { phase: number; subjectName: string; placed: number; min: number }[];
}

export function buildSubmission(plan: TrainingPlan, startDate: string, templates: Templates, subjects: Map<string, TrainingSubject>, busy: BusyItem[], at: Date): Submission {
  const ranges = phaseRanges(plan, startDate);
  const ctx: RuleContext = { range: { from: startDate, to: classEndDate(startDate, plan.totalWeeks) }, phaseSubjects: phaseLookup(ranges) };
  const expanded = expandTemplates(plan, startDate, templates, subjects);

  const errors = new Map<string, Problem>();
  problemsAmong(expanded, [], ctx).forEach((problem, key) => {
    const slotId = key.slice(0, key.lastIndexOf('@'));
    if (BLOCKING.has(problem.kind) && !errors.has(slotId)) errors.set(slotId, problem);
  });

  const cutoff = at.getTime() + PAST_MARGIN_MINUTES * 60_000;
  const past = expanded.filter((item) => new Date(item.startAt).getTime() <= cutoff);
  const upcoming = expanded.filter((item) => new Date(item.startAt).getTime() > cutoff);
  const { accepted, skipped } = acceptInOrder(upcoming, [], { ...ctx, trainerBusy: busy });
  const busySkipped = skipped.filter((entry) => entry.problem.kind === 'TRAINER_BUSY');

  const warnings = new Map<string, string>();
  const note = (slotId: string, text: string) => warnings.set(slotId, warnings.has(slotId) ? `${warnings.get(slotId)}. ${text}` : text);
  const count = (items: Expanded[]) => items.reduce((map, item) => map.set(item.slot.id, (map.get(item.slot.id) ?? 0) + 1), new Map<string, number>());
  count(past).forEach((n, slotId) => note(slotId, `Bỏ ${n} buổi đã qua giờ`));
  count(busySkipped.map((entry) => entry.item)).forEach((n, slotId) => note(slotId, `Bỏ ${n} buổi trùng lịch lớp khác của bạn`));

  const short = ranges.flatMap(({ phase }) =>
    phase.subjects.flatMap((item) => {
      const placed = (templates[phase.position] ?? []).filter((slot) => slot.subjectId === item.subject.id).length;
      return placed < item.minSessionsPerWeek ? [{ phase: phase.position, subjectName: item.subject.name, placed, min: item.minSessionsPerWeek }] : [];
    }),
  );

  return {
    accepted,
    past,
    busySkipped,
    errors,
    warnings,
    minutes: accepted.reduce((sum, item) => sum + item.slot.duration, 0),
    short,
  };
}

/** Thân request của một buổi sinh từ slot. */
export function expandedInput(item: Expanded, subject: TrainingSubject): SessionInput {
  return draftToInput({ ...slotToDraft(item.slot, clubDateKey(item.startAt)), scheduledStartAt: item.startAt, scheduledEndAt: item.endAt }, subject, 'create');
}
