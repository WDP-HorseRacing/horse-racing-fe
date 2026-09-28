// Tiện ích hiển thị dùng chung cho các màn hình thực hiện buổi học.
import type { SimScenario, WorkoutType } from '../../../types/domain';
import { workoutLabel } from '../../../lib/labels';
import { formatDuration } from '../../../lib/format';

export const SCENARIO_OPTIONS: { value: SimScenario; label: string; hint: string; targeted: boolean }[] = [
  { value: 'NORMAL', label: 'Bình thường', hint: 'Mọi ngựa chạy đúng bài, không phát sinh cảnh báo.', targeted: false },
  { value: 'HEART_OVER', label: 'Tim vượt ngưỡng', hint: 'Một ngựa vượt nhịp tim tối đa ở lần chạy chính → cảnh báo R1 đỏ.', targeted: true },
  { value: 'INJURY_RISK', label: 'Nghi chấn thương', hint: 'Một ngựa tụt tốc độ đột ngột giữa lần chạy → R3 đỏ và yêu cầu khám khẩn.', targeted: true },
  { value: 'SIGNAL_LOST', label: 'Mất tín hiệu', hint: 'Thiết bị của một ngựa mất dữ liệu khoảng 22 giây → R6 xám.', targeted: true },
  { value: 'RANDOM', label: 'Ngẫu nhiên', hint: 'Mỗi ngựa bốc ngẫu nhiên, khoảng 1/10 có sự cố.', targeted: false },
];

export function workoutText(input: { workoutType: WorkoutType; distanceM: number; repetitions: number }): string {
  const reps = input.repetitions > 1 ? ` × ${input.repetitions}` : '';
  return `${workoutLabel[input.workoutType]} ${input.distanceM.toLocaleString('vi-VN')} m${reps}`;
}

export function speedText(value: number): string {
  return `${value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m/s`;
}

export function secondText(value: number): string {
  return formatDuration(Math.max(0, Math.round(value)));
}

export function trialText(seconds?: number, notCompleted?: boolean): string {
  if (notCompleted) return 'Không hoàn thành';
  if (seconds === undefined) return '—';
  return `${seconds.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} giây`;
}

/** Phần mô tả thêm sau tên môn học, bỏ những gì tên môn đã nói (ví dụ "Nước rút 400 m" chỉ cần "× 3"). */
export function subjectExtra(input: { subjectName: string; workoutType: WorkoutType; distanceM: number; repetitions: number }): string {
  const name = input.subjectName.toLowerCase();
  const parts: string[] = [];
  const label = workoutLabel[input.workoutType];
  if (!name.includes(label.toLowerCase())) parts.push(label);
  const distance = `${input.distanceM.toLocaleString('vi-VN')} m`;
  if (!name.includes(String(input.distanceM)) && !name.includes(distance.toLowerCase())) parts.push(distance);
  const head = parts.join(' ');
  if (input.repetitions > 1) return head ? `${head} × ${input.repetitions}` : `× ${input.repetitions}`;
  return head;
}

/** Tên môn kèm phần mô tả thêm, ví dụ "Nước rút 400 m × 3", "Canter dài · 1.000 m × 2". */
export function subjectLine(input: { subjectName: string; workoutType: WorkoutType; distanceM: number; repetitions: number }): string {
  const extra = subjectExtra(input);
  if (!extra) return input.subjectName;
  return extra.startsWith('×') ? `${input.subjectName} ${extra}` : `${input.subjectName} · ${extra}`;
}
