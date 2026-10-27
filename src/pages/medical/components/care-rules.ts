// Luật nhỏ của lịch chăm sóc (F3.11) dùng chung giữa các màn hình.
import type { CareSchedule, CareTaskType } from '../../../api/types';
import { daysBetween, formatDate } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';
import { links } from '../../../lib/links';

export const CARE_TYPES: CareTaskType[] = ['VACCINATION', 'DEWORMING', 'FARRIER'];

/** Số ngày còn lại tới hạn (âm là quá hạn), tính theo ngày lịch. */
export function careDaysLeft(dueAt: string): number {
  return daysBetween(now(), dueAt);
}

/** Quyền thao tác theo vai trò (backend kiểm lại): lịch chỉ thuộc bác sĩ, chỉ bác sĩ tạo, sửa, hủy, hoàn tất. */
export function useCareRights() {
  const user = useStore((state) => state.currentUser);
  const manage = can(user, 'care.manage');
  const complete = can(user, 'care.complete');
  return {
    manage,
    canComplete: (schedule: CareSchedule) => schedule.status === 'SCHEDULED' && complete,
  };
}

/* ===== Bác sĩ được giao ===== */
// Từ BE 27/10 lịch chỉ giao bác sĩ (bỏ giao Groom). Bác sĩ không tải được danh sách bác sĩ khác (chỉ Quản lý CLB),
// nên chọn được: chưa giao ai, chính mình, hoặc giữ bác sĩ đang được giao khi sửa.

/** "BS Lan". Tên chung khi không tra được người (vd "Bác sĩ thú y") thì giữ nguyên, không thêm "BS". */
export const vetLabel = (name: string) => (name.startsWith('Bác sĩ') ? name : `BS ${name}`);

/** Chữ "bác sĩ được giao" của một lịch. */
export function assigneeText(schedule: Pick<CareSchedule, 'assignedTo'>, name: (id: string) => string) {
  return schedule.assignedTo ? vetLabel(name(schedule.assignedTo)) : 'Chưa giao, mọi bác sĩ cùng thấy';
}

/** Thông báo sau khi lưu lịch: giao ai, nhắc lúc 5 giờ sáng ngày đến hạn. */
export function careSavedText(action: string, typeLabel: string, horseName: string, vetName: string | null, dueAt: string): string {
  const who = vetName ? `giao ${vetLabel(vetName)}` : 'chưa giao ai, mọi bác sĩ cùng thấy';
  return `${action} lịch ${typeLabel.toLowerCase()} cho ${horseName}, ${who}, nhắc lúc 5 giờ sáng ngày ${formatDate(dueAt)}`;
}

/** Link sang tab Chăm sóc của ngựa, mở sẵn hộp gắn việc riêng (vd giữ ngựa cho thợ móng). */
export const groomAssistLink = (horseId: string) => `${links.horse(horseId, 'care')}&addTask=1`;
