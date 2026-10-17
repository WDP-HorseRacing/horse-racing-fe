// Luật nhỏ của lịch chăm sóc (F3.11) dùng chung giữa các màn hình.
import type { CareAssigneeType, CareSchedule, CareTaskType } from '../../../api/types';
import { daysBetween } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';

export const CARE_TYPES: CareTaskType[] = ['VACCINATION', 'DEWORMING', 'FARRIER'];

/** Số ngày còn lại tới hạn (âm là quá hạn), tính theo ngày lịch. */
export function careDaysLeft(dueAt: string): number {
  return daysBetween(now(), dueAt);
}

/**
 * Quyền thao tác trên một lịch theo vai trò của người xem (backend kiểm lại).
 * Groom hoàn tất lịch giao đích danh cho mình, hoặc lịch giao "Groom phụ trách" ở ngựa mình phụ trách.
 * Không biết Groom của ngựa (`horseGroomId` undefined) thì tin danh sách BE đã lọc cho Groom.
 */
export function useCareRights() {
  const user = useStore((state) => state.currentUser);
  const manage = can(user, 'care.manage');
  return {
    manage,
    canComplete: (schedule: CareSchedule, horseGroomId?: string | null) => {
      if (schedule.status !== 'SCHEDULED') return false;
      if (manage) return true;
      if (!can(user, 'care.complete') || !user) return false;
      if (schedule.assignedTo) return schedule.assignedTo === user.id;
      return schedule.assigneeType === 'GROOM' && (horseGroomId === undefined || horseGroomId === user.id);
    },
  };
}

/* ===== Cách giao lịch ===== */

/** Lựa chọn trên form: chưa giao, Groom phụ trách, một Groom cụ thể, một bác sĩ cụ thể. */
export type AssigneeMode = 'NONE' | 'HORSE_GROOM' | 'GROOM' | 'VET';
export interface AssigneeChoice {
  mode: AssigneeMode;
  userId: string;
}

export const ASSIGNEE_MODE_LABEL: Record<AssigneeMode, string> = {
  NONE: 'Chưa giao',
  HORSE_GROOM: 'Groom phụ trách',
  GROOM: 'Groom cụ thể',
  VET: 'Bác sĩ',
};

export function assigneeOf(schedule?: Pick<CareSchedule, 'assigneeType' | 'assignedTo'>): AssigneeChoice {
  if (!schedule?.assigneeType) return { mode: 'NONE', userId: '' };
  if (schedule.assigneeType === 'VET') return { mode: 'VET', userId: schedule.assignedTo ?? '' };
  return schedule.assignedTo ? { mode: 'GROOM', userId: schedule.assignedTo } : { mode: 'HORSE_GROOM', userId: '' };
}

/** Body gửi BE. Chưa giao: cả hai null. */
export function assigneeInput(choice: AssigneeChoice): { assigneeType: CareAssigneeType | null; assignedTo: string | null } {
  if (choice.mode === 'NONE') return { assigneeType: null, assignedTo: null };
  if (choice.mode === 'HORSE_GROOM') return { assigneeType: 'GROOM', assignedTo: null };
  return { assigneeType: choice.mode, assignedTo: choice.userId || null };
}

export const sameAssignee = (a: AssigneeChoice, b: AssigneeChoice) => a.mode === b.mode && (a.mode === 'NONE' || a.mode === 'HORSE_GROOM' || a.userId === b.userId);

export const assigneeError = (choice: AssigneeChoice) => ((choice.mode === 'GROOM' || choice.mode === 'VET') && !choice.userId ? 'Chọn người thực hiện' : undefined);

/** Chữ "người làm" của một lịch. `name` tra tên theo id, `groomName` là Groom đang phụ trách ngựa nếu biết. */
export function assigneeText(schedule: Pick<CareSchedule, 'assigneeType' | 'assignedTo'>, name: (id: string) => string, groomName?: string | null) {
  if (!schedule.assigneeType) return 'chưa giao người thực hiện';
  if (schedule.assignedTo) return name(schedule.assignedTo);
  return groomName ? `Groom phụ trách (${groomName})` : 'Groom phụ trách';
}
