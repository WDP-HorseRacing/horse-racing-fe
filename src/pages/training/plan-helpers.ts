// Hàm thuần đọc giáo án theo giai đoạn: tải tối thiểu mỗi tuần (số buổi Nhẹ, Nặng, số phút), tổng buổi, tổng phút,
// giai đoạn của lớp chứa một ngày. Dùng chung cho trình lập giáo án, chi tiết giáo án, mở lớp và lịch tuần của lớp.
// Kèm hạn gắn video chạy thử.
import type { ClassPlan, HorseTrainingSession, TrainingIntensity, TrainingPlan, TrainingSession, TrainingSubject } from '../../api/types';
import { addDateKey, addMinutes, minutesBetween } from '../../lib/club-time';

/** Một môn trong giai đoạn: số buổi tối thiểu mỗi tuần. */
export interface PhaseSubjectLike {
  subject: Pick<TrainingSubject, 'id' | 'name' | 'intensity' | 'sessionType' | 'durationMinutes'>;
  minSessionsPerWeek: number;
}

/** Tải tối thiểu một tuần của giai đoạn. */
export interface WeekLoad {
  sessions: number;
  light: number;
  heavy: number;
  /** Có môn chạy thử. */
  trial: boolean;
  minutes: number;
}

export function weekLoad(subjects: PhaseSubjectLike[]): WeekLoad {
  return subjects.reduce<WeekLoad>(
    (load, { subject, minSessionsPerWeek: count }) => ({
      sessions: load.sessions + count,
      light: load.light + (subject.intensity === 'LIGHT' ? count : 0),
      heavy: load.heavy + (subject.intensity === 'HEAVY' ? count : 0),
      trial: load.trial || subject.sessionType === 'TIME_TRIAL',
      minutes: load.minutes + count * subject.durationMinutes,
    }),
    { sessions: 0, light: 0, heavy: 0, trial: false, minutes: 0 },
  );
}

/** Một giai đoạn trên dải giai đoạn: số tuần và tải tối thiểu mỗi tuần. */
export interface RibbonPhase extends WeekLoad {
  key: string;
  /** Thứ tự giai đoạn, bắt đầu từ 1. */
  position: number;
  weeks: number;
}

/** Đổi các giai đoạn của giáo án (mẫu hoặc của lớp) sang các đoạn của dải giai đoạn. */
export const planPhases = (plan: { phases: { position: number; weeks: number; subjects: PhaseSubjectLike[] }[] }): RibbonPhase[] =>
  plan.phases.map((phase) => ({ key: `phase-${phase.position}`, position: phase.position, weeks: phase.weeks, ...weekLoad(phase.subjects) }));

/** Các môn khác nhau trong giáo án, theo thứ tự xuất hiện. */
export const planSubjects = (plan: Pick<TrainingPlan, 'phases'>) => {
  const seen = new Map<string, TrainingSubject>();
  plan.phases.forEach((phase) => phase.subjects.forEach((item) => seen.set(item.subject.id, item.subject)));
  return [...seen.values()];
};

/** Tổng số buổi tối thiểu của giáo án. */
export const planSessionCount = (plan: { phases: { weeks: number; subjects: PhaseSubjectLike[] }[] }) =>
  plan.phases.reduce((sum, phase) => sum + phase.weeks * weekLoad(phase.subjects).sessions, 0);

/** Tổng phút tối thiểu (khi đang soạn, BE chưa tính). */
export const planMinMinutes = (plan: { phases: { weeks: number; subjects: PhaseSubjectLike[] }[] }) =>
  plan.phases.reduce((sum, phase) => sum + phase.weeks * weekLoad(phase.subjects).minutes, 0);

/** Giai đoạn của lớp chứa một ngày ('YYYY-MM-DD' lịch CLB), undefined khi ngoài khoảng lớp. */
export const classPhaseAt = (plan: ClassPlan, dateKey: string) => plan.phases.find((phase) => dateKey >= phase.startDate && dateKey <= phase.endDate);

/** Ngày đầu tuần thứ `week` (bắt đầu từ 1) của lớp: tuần lớp tính từ ngày bắt đầu, giống tiến độ của BE. */
export const classWeekStart = (classStart: string, week: number) => addDateKey(classStart, (week - 1) * 7);

/** Thời điểm kết thúc giữ nguyên thời lượng khi đổi giờ bắt đầu. */
export const shiftEnd = (session: Pick<TrainingSession, 'scheduledStartAt' | 'scheduledEndAt'>, startAt: string) =>
  addMinutes(startAt, minutesBetween(session.scheduledStartAt, session.scheduledEndAt));

/** "45 phút", "2 giờ", "3 giờ 30 phút". */
export function formatTotalMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} phút`;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

/** Sắc xanh theo cường độ (khối buổi trên lịch, dải giai đoạn). */
export const INTENSITY_FILL: Record<TrainingIntensity, string> = {
  LIGHT: 'bg-emerald-200 text-emerald-950',
  HEAVY: 'bg-emerald-700 text-white',
};

const VIDEO_EDIT_DAYS = 7;

/** BE cho gắn, đổi, gỡ video chạy thử trong 7 ngày kể từ giờ kết thúc dự kiến của buổi, buổi chưa hủy. */
export function trialVideoEditable(row: Pick<HorseTrainingSession, 'sessionStatus' | 'scheduledEndAt'>, now = Date.now()) {
  return row.sessionStatus !== 'CANCELLED' && now <= new Date(row.scheduledEndAt).getTime() + VIDEO_EDIT_DAYS * 24 * 60 * 60 * 1000;
}
