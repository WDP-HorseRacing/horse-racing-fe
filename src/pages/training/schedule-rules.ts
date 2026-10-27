// Luật xếp buổi của một lớp, chép theo BE (training.policy.ts, training-sessions.service.ts) để FE báo trước khi gửi:
// trong khoảng ngày của lớp, môn thuộc giai đoạn, chạy thử có cự ly, không trùng giờ, nghỉ đủ 3 giờ, tối đa 2 buổi
// và 1 buổi Nặng mỗi ngày, HLV không trùng lịch lớp khác của mình, giờ bắt đầu ở tương lai. Kiểm đúng thứ tự BE
// để câu báo khớp. Không kiểm được ngựa trùng lịch ở lớp khác (BE vẫn kiểm lại khi lưu).
import type { TrainingIntensity, TrainingSession, TrainingSessionType } from '../../api/types';
import { addDateKey, clubDateKey, clubTime, isoWeekdayOf } from '../../lib/club-time';
import { weekdayShort } from '../../lib/training-labels';

/** Khớp BE horse-daily-load.constants.ts. */
export const MAX_SESSIONS_PER_DAY = 2;
export const MAX_HEAVY_PER_DAY = 1;
export const MIN_REST_MINUTES = 180;

/** Một buổi đã có hoặc đang định xếp. */
export interface PlannedItem {
  key: string;
  name: string;
  intensity: TrainingIntensity;
  startAt: string;
  endAt: string;
  subjectId?: string | null;
  sessionType?: TrainingSessionType;
  plannedDistanceM?: number;
}

/** Buổi ở lớp khác của chính HLV. */
export interface BusyItem {
  startAt: string;
  endAt: string;
  classCode: string;
}

export type ProblemKind = 'OUT_OF_RANGE' | 'OUT_OF_PHASE' | 'NO_DISTANCE' | 'OVERLAP' | 'REST' | 'DAY_LIMIT' | 'HEAVY_LIMIT' | 'TRAINER_BUSY' | 'PAST';

export interface Problem {
  kind: ProblemKind;
  message: string;
}

export interface RuleContext {
  /** Khoảng ngày của lớp (lịch CLB). */
  range: { from: string; to: string };
  /** Môn của giai đoạn chứa ngày; undefined khi ngày ngoài mọi giai đoạn. Bỏ trống thì không kiểm. */
  phaseSubjects?: (dateKey: string) => { position: number; ids: ReadonlySet<string> } | undefined;
  trainerBusy?: BusyItem[];
  /** Buổi bắt đầu trước mốc này là giờ đã qua. Bỏ trống thì không kiểm (tuần mẫu). */
  pastBefore?: Date;
}

/** Lỗi chặn lưu; còn lại (giờ đã qua, trùng lịch HLV) chỉ bỏ qua buổi đó. */
export const BLOCKING: ReadonlySet<ProblemKind> = new Set(['OUT_OF_RANGE', 'OUT_OF_PHASE', 'NO_DISTANCE', 'OVERLAP', 'REST', 'DAY_LIMIT', 'HEAVY_LIMIT']);

/** "T3 05/11 06:00". */
export function slotText(iso: string) {
  const day = clubDateKey(iso);
  return `${weekdayShort[isoWeekdayOf(day)]} ${day.slice(8, 10)}/${day.slice(5, 7)} ${clubTime(iso)}`;
}

const dayText = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
const ms = (iso: string) => new Date(iso).getTime();
const REST_MS = MIN_REST_MINUTES * 60_000;

export type ScheduleIndex = Map<string, PlannedItem[]>;

/** Gom buổi theo ngày bắt đầu (lịch CLB) để chỉ so với ngày kề. */
export function scheduleIndex(items: PlannedItem[]): ScheduleIndex {
  const index: ScheduleIndex = new Map();
  items.forEach((item) => {
    const day = clubDateKey(item.startAt);
    const list = index.get(day);
    if (list) list.push(item);
    else index.set(day, [item]);
  });
  return index;
}

function addToIndex(index: ScheduleIndex, item: PlannedItem) {
  const day = clubDateKey(item.startAt);
  const list = index.get(day);
  if (list) list.push(item);
  else index.set(day, [item]);
}

/** Buổi cùng ngày và hai ngày kề (buổi dài tối đa 8 giờ, cộng 3 giờ nghỉ, không với tới xa hơn), xếp theo giờ. */
function nearby(index: ScheduleIndex, item: PlannedItem) {
  const day = clubDateKey(item.startAt);
  return [addDateKey(day, -1), day, addDateKey(day, 1)]
    .flatMap((key) => index.get(key) ?? [])
    .filter((other) => other.key !== item.key)
    .sort((a, b) => ms(a.startAt) - ms(b.startAt));
}

/** Lỗi đầu tiên của một buổi so với các buổi trong index (bỏ qua chính nó), theo thứ tự BE. */
export function problemOf(item: PlannedItem, index: ScheduleIndex, ctx: RuleContext): Problem | undefined {
  const startDay = clubDateKey(item.startAt);
  const endDay = clubDateKey(item.endAt);
  if (startDay < ctx.range.from || endDay > ctx.range.to) return { kind: 'OUT_OF_RANGE', message: 'Buổi phải nằm trong thời gian của lớp' };
  if (ctx.phaseSubjects && item.subjectId) {
    const phase = ctx.phaseSubjects(startDay);
    if (!phase?.ids.has(item.subjectId)) return { kind: 'OUT_OF_PHASE', message: `Môn ${item.name} không có trong giai đoạn ${phase?.position ?? 'của ngày này'}` };
  }
  if (item.sessionType === 'TIME_TRIAL' && !(item.plannedDistanceM && item.plannedDistanceM > 0)) return { kind: 'NO_DISTANCE', message: 'Môn chạy thử cần cự ly lớn hơn 0' };

  const start = ms(item.startAt);
  const end = ms(item.endAt);
  const others = nearby(index, item);
  const overlap = others.find((other) => start < ms(other.endAt) && ms(other.startAt) < end);
  if (overlap) return { kind: 'OVERLAP', message: `Trùng giờ với buổi ${overlap.name} lúc ${slotText(overlap.startAt)}` };
  const rest = others.find((other) => start < ms(other.endAt) + REST_MS && ms(other.startAt) < end + REST_MS);
  if (rest) return { kind: 'REST', message: `Chưa nghỉ đủ 3 giờ so với buổi ${rest.name} (${slotText(rest.startAt)})` };
  const sameDay = others.filter((other) => clubDateKey(other.startAt) === startDay);
  if (sameDay.length >= MAX_SESSIONS_PER_DAY) return { kind: 'DAY_LIMIT', message: `Ngày ${dayText(startDay)} đã đủ ${MAX_SESSIONS_PER_DAY} buổi` };
  if (item.intensity === 'HEAVY' && sameDay.filter((other) => other.intensity === 'HEAVY').length >= MAX_HEAVY_PER_DAY) {
    return { kind: 'HEAVY_LIMIT', message: `Ngày ${dayText(startDay)} đã có buổi Nặng` };
  }
  const busy = ctx.trainerBusy?.find((other) => start < ms(other.endAt) && ms(other.startAt) < end);
  if (busy) return { kind: 'TRAINER_BUSY', message: `Trùng lịch của bạn ở lớp ${busy.classCode} lúc ${slotText(busy.startAt)}` };
  if (ctx.pastBefore && start <= ctx.pastBefore.getTime()) return { kind: 'PAST', message: 'Giờ bắt đầu đã qua' };
  return undefined;
}

/** Lỗi của từng buổi khi xét chung với nhau và với các buổi đã có. Dùng để tô khối lỗi trên lịch. */
export function problemsAmong<T extends PlannedItem>(items: T[], existing: PlannedItem[], ctx: RuleContext): Map<string, Problem> {
  const index = scheduleIndex([...existing, ...items]);
  const result = new Map<string, Problem>();
  items.forEach((item) => {
    const problem = problemOf(item, index, ctx);
    if (problem) result.set(item.key, problem);
  });
  return result;
}

/**
 * Nhận lần lượt theo giờ, mỗi buổi so với buổi đã có cộng các buổi đã nhận trước nó: đúng cách BE lưu một lô,
 * nên danh sách nhận qua được BE (trừ phần BE kiểm mà FE không thấy).
 */
export function acceptInOrder<T extends PlannedItem>(candidates: T[], existing: PlannedItem[], ctx: RuleContext) {
  const index = scheduleIndex(existing);
  const accepted: T[] = [];
  const skipped: { item: T; problem: Problem }[] = [];
  [...candidates]
    .sort((a, b) => ms(a.startAt) - ms(b.startAt))
    .forEach((item) => {
      const problem = problemOf(item, index, ctx);
      if (problem) skipped.push({ item, problem });
      else {
        accepted.push(item);
        addToIndex(index, item);
      }
    });
  return { accepted, skipped };
}

/** Buổi đã lưu (chưa hủy) dưới dạng dùng cho luật. */
export const sessionItem = (session: Pick<TrainingSession, 'id' | 'name' | 'intensity' | 'scheduledStartAt' | 'scheduledEndAt' | 'subjectId' | 'sessionType' | 'plannedDistanceM'>): PlannedItem => ({
  key: session.id,
  name: session.name,
  intensity: session.intensity,
  startAt: session.scheduledStartAt,
  endAt: session.scheduledEndAt,
  subjectId: session.subjectId,
  sessionType: session.sessionType,
  plannedDistanceM: session.plannedDistanceM,
});
