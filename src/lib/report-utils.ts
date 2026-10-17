// Tiện ích cho các trang báo cáo: chèn tuần trống (BE chỉ trả tuần có dữ liệu), màu cường độ.
import type { ReportWeek } from '../api/reports';
import type { TrainingIntensity } from '../api/types';
import type { Column } from '../components/charts/ColumnChart';
import { addDateKey, mondayOf } from './club-time';

/** Đủ mọi tuần (thứ Hai) từ tuần chứa from tới tuần chứa to, tuần không có dữ liệu là 0. */
export function fillWeeks(weekly: ReportWeek[], from: string, to: string): ReportWeek[] {
  const byWeek = new Map(weekly.map((week) => [week.weekStart, week]));
  const weeks: ReportWeek[] = [];
  for (let cursor = mondayOf(from); cursor <= to; cursor = addDateKey(cursor, 7)) {
    weeks.push(byWeek.get(cursor) ?? { weekStart: cursor, completed: 0, avgHeartRateBpm: null, avgSpeedMps: null, alertCount: 0 });
  }
  return weeks;
}

const shortDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;

/** Cột "lượt hoàn thành" mỗi tuần, tooltip kèm nhịp tim trung bình và số cảnh báo. */
export function weeklyColumns(weeks: ReportWeek[], { withHeartRate = true }: { withHeartRate?: boolean } = {}): Column[] {
  return weeks.map((week) => ({
    key: week.weekStart,
    label: shortDate(week.weekStart),
    value: week.completed,
    detail: [
      `Tuần từ ${shortDate(week.weekStart)}`,
      withHeartRate && week.avgHeartRateBpm !== null ? `nhịp tim TB ${week.avgHeartRateBpm} bpm` : undefined,
      week.alertCount ? `${week.alertCount} cảnh báo` : undefined,
    ]
      .filter(Boolean)
      .join(', '),
  }));
}

export const INTENSITY_COLORS: Record<TrainingIntensity, string> = {
  LIGHT: '#6ee7b7',
  HEAVY: '#047857',
};
