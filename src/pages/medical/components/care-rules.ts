// Luật nhỏ của lịch chăm sóc (F3.11) dùng chung giữa các màn hình.
import type { CareSchedule, CareTaskType } from '../../../api/types';
import { daysBetween } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';

export const CARE_TYPES: CareTaskType[] = ['VACCINATION', 'DEWORMING', 'FARRIER'];

/** Số ngày còn lại tới hạn (âm là quá hạn), tính theo ngày lịch. */
export function careDaysLeft(dueAt: string): number {
  return daysBetween(now(), dueAt);
}

/** Quyền thao tác trên một lịch theo vai trò của người xem (backend kiểm lại). */
export function useCareRights() {
  const user = useStore((state) => state.currentUser);
  const manage = can(user, 'care.manage');
  return {
    manage,
    canComplete: (schedule: CareSchedule) =>
      schedule.status === 'SCHEDULED' && (manage || (can(user, 'care.complete') && schedule.assignedTo === user?.id)),
  };
}
