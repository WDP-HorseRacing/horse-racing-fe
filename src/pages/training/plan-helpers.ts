// Hàm thuần đọc giáo án theo giai đoạn: tuần mẫu, môn của một ngày, số buổi. Dùng chung cho trình lập giáo án,
// chi tiết giáo án, mở lớp và lịch buổi. Kèm vài hàm đọc kết quả công bố buổi và hạn gắn video chạy thử.
import type { HorseTrainingSession, PublishedSession, TrainingIntensity, TrainingPlan, TrainingSessionType, TrainingSubject } from '../../api/types';

/** Một ngày trong tuần mẫu của giai đoạn: môn học vào thứ đó, hoặc null là ngày nghỉ. */
export interface DaySlot {
  subjectId: string;
  name: string;
  intensity: TrainingIntensity;
  sessionType: TrainingSessionType;
}

/** Một giai đoạn trên dải tuần: số tuần và tuần mẫu 7 ngày (chỉ số 0 là thứ Hai). */
export interface RibbonPhase {
  key: string;
  /** Thứ tự giai đoạn, bắt đầu từ 1. */
  position: number;
  weeks: number;
  days: (DaySlot | null)[];
}

/** Tuần mẫu của một giai đoạn từ các môn và thứ của nó. */
export function weekPattern(subjects: { subject: Pick<TrainingSubject, 'id' | 'name' | 'intensity' | 'sessionType'>; weekdays: number[] }[]): (DaySlot | null)[] {
  const days: (DaySlot | null)[] = Array.from({ length: 7 }, () => null);
  subjects.forEach(({ subject, weekdays }) =>
    weekdays.forEach((day) => {
      if (day >= 1 && day <= 7 && !days[day - 1]) days[day - 1] = { subjectId: subject.id, name: subject.name, intensity: subject.intensity, sessionType: subject.sessionType };
    }),
  );
  return days;
}

/** Đổi các giai đoạn của giáo án sang các đoạn của dải tuần. */
export const planPhases = (plan: Pick<TrainingPlan, 'phases'>): RibbonPhase[] =>
  plan.phases.map((phase) => ({ key: `phase-${phase.position}`, position: phase.position, weeks: phase.weeks, days: weekPattern(phase.subjects) }));

/** Giai đoạn chứa một tuần (bắt đầu từ 1) của giáo án. */
export const planPhaseAt = (plan: Pick<TrainingPlan, 'phases'>, week: number) => plan.phases.find((item) => week >= item.startWeek && week < item.startWeek + item.weeks);

/** Môn học vào một tuần (bắt đầu từ 1) và thứ ISO của giáo án, null khi ngày đó nghỉ hoặc ngoài giáo án. */
export const planSubjectAt = (plan: Pick<TrainingPlan, 'phases'>, week: number, weekday: number) =>
  planPhaseAt(plan, week)?.subjects.find((item) => item.weekdays.includes(weekday))?.subject ?? null;

/** Các thứ ISO có buổi trong ít nhất một giai đoạn, tăng dần. */
export const planWeekdays = (plan: Pick<TrainingPlan, 'phases'>) => [...new Set(plan.phases.flatMap((phase) => phase.subjects.flatMap((item) => item.weekdays)))].sort((a, b) => a - b);

/** Các môn khác nhau trong giáo án, theo thứ tự xuất hiện. */
export const planSubjects = (plan: Pick<TrainingPlan, 'phases'>) => {
  const seen = new Map<string, TrainingSubject>();
  plan.phases.forEach((phase) => phase.subjects.forEach((item) => seen.set(item.subject.id, item.subject)));
  return [...seen.values()];
};

/** Tổng số buổi theo giáo án (mỗi tuần, mỗi thứ có môn là một buổi). */
export const planSessionCount = (plan: Pick<TrainingPlan, 'phases'>) =>
  plan.phases.reduce((sum, phase) => sum + phase.weeks * phase.subjects.reduce((count, item) => count + item.weekdays.length, 0), 0);

/** Sắc xanh theo cường độ của ô ngày trong tuần mẫu và nút thứ. */
export const DAY_FILL: Record<TrainingIntensity, string> = {
  LIGHT: 'bg-emerald-200 text-emerald-950',
  MODERATE: 'bg-emerald-400 text-emerald-950',
  HEAVY: 'bg-emerald-700 text-white',
};

/** Các buổi vừa công bố có ngựa bị bỏ qua vì trùng giờ (rỗng thì không cần mở hộp báo). */
export const sessionsWithSkips = (sessions: PublishedSession[]) => sessions.filter((session) => session.skippedHorses.length > 0);

const VIDEO_EDIT_DAYS = 7;

/** BE cho gắn, đổi, gỡ video chạy thử trong 7 ngày kể từ giờ kết thúc dự kiến của buổi, buổi chưa hủy. */
export function trialVideoEditable(row: Pick<HorseTrainingSession, 'sessionStatus' | 'scheduledEndAt'>, now = Date.now()) {
  return row.sessionStatus !== 'CANCELLED' && now <= new Date(row.scheduledEndAt).getTime() + VIDEO_EDIT_DAYS * 24 * 60 * 60 * 1000;
}
