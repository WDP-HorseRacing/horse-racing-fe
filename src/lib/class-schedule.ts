// Sinh lịch buổi học của một lớp từ giáo án (bản chốt C.3.8). Hàm thuần, dùng chung cho service và seed.
import type { TrainingIntensity, TrainingProgram, TrainingSubject } from '../types/domain';
import { addDays, toDateKey } from './format';
import { intensityRank } from './rule-helpers';

export function programTotalWeeks(program: Pick<TrainingProgram, 'phases'>): number {
  return program.phases.reduce((sum, phase) => sum + phase.weeks, 0);
}

/** Ngày kết thúc = ngày bắt đầu + 7 × tổng số tuần − 1. */
export function classEndDate(startDate: string, totalWeeks: number): string {
  return toDateKey(addDays(startDate, Math.max(1, totalWeeks) * 7 - 1));
}

export interface PlannedSession {
  date: string;
  subjectId: string;
  subjectName: string;
  workoutType: TrainingSubject['workoutType'];
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrainingSubject['surface'];
  phaseNo: number;
  phaseName: string;
  weekNo: number;
}

/**
 * Mỗi tuần của giai đoạn: gom các buổi của mọi môn học, xếp môn nặng trước rồi rải đều
 * trong 7 ngày. Nhờ vậy buổi Nặng/Tối đa không rơi vào hai ngày liền nhau khi còn chỗ.
 * Một lớp dùng một slot cố định nên mỗi ngày tối đa một buổi.
 */
export function generateSessionPlan(
  program: Pick<TrainingProgram, 'phases'>,
  subjects: TrainingSubject[],
  startDate: string,
): PlannedSession[] {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const result: PlannedSession[] = [];
  let weekIndex = 0;

  program.phases.forEach((phase, phaseIndex) => {
    const weekly: TrainingSubject[] = [];
    phase.items.forEach((item) => {
      const subject = byId.get(item.subjectId);
      if (!subject) return;
      for (let count = 0; count < item.sessionsPerWeek; count += 1) weekly.push(subject);
    });
    weekly.sort((a, b) => intensityRank(b.intensity) - intensityRank(a.intensity));
    const total = Math.min(7, weekly.length);
    const offsets = spreadOffsets(total);
    // Môn nặng nhận trước các ngày cách xa nhau nhất, môn nhẹ lấp các ngày còn lại.
    const ordered = spreadOrder(offsets);

    for (let week = 0; week < phase.weeks; week += 1) {
      const weekStart = addDays(startDate, (weekIndex + week) * 7);
      const days = weekly.slice(0, total).map((subject, index) => ({ subject, offset: ordered[index] }));
      days
        .sort((a, b) => a.offset - b.offset)
        .forEach(({ subject, offset }) => {
          result.push({
            date: toDateKey(addDays(weekStart, offset)),
            subjectId: subject.id,
            subjectName: subject.name,
            workoutType: subject.workoutType,
            distanceM: subject.distanceM,
            repetitions: subject.repetitions,
            intensity: subject.intensity,
            surface: subject.surface,
            phaseNo: phaseIndex + 1,
            phaseName: phase.name,
            weekNo: weekIndex + week + 1,
          });
        });
    }
    weekIndex += phase.weeks;
  });

  return result;
}

/** Thứ tự chọn ngày sao cho mỗi ngày mới cách xa nhất các ngày đã chọn (tính vòng 7 ngày). */
function spreadOrder(offsets: number[]): number[] {
  if (offsets.length === 0) return [];
  const picked = [offsets[0]];
  const rest = offsets.slice(1);
  const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b));
  while (rest.length > 0) {
    let bestIndex = 0;
    let bestScore = -1;
    rest.forEach((offset, index) => {
      const score = Math.min(...picked.map((item) => gap(item, offset)));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    picked.push(rest.splice(bestIndex, 1)[0]);
  }
  return picked;
}

/** Rải n buổi đều trong 7 ngày: 1 → [0], 3 → [0,2,4], 5 → [0,1,2,4,5]… */
export function spreadOffsets(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => Math.floor((index * 7) / count));
}
