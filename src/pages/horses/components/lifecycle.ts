import type { LifecycleStatus } from '../../../api/types';

/** Thao tác vòng đời trên hồ sơ: đổi trạng thái, xóa mềm, khôi phục. */
export type LifecycleAction = LifecycleStatus | 'DELETE' | 'RESTORE';

export const lifecycleActionLabel: Record<LifecycleAction, string> = {
  RETIRED: 'Giải nghệ',
  TRANSFERRED: 'Chuyển nhượng',
  ACTIVE: 'Kích hoạt lại',
  DELETE: 'Xóa hồ sơ',
  RESTORE: 'Khôi phục hồ sơ',
};

export const lifecycleActionHint: Record<LifecycleAction, string> = {
  RETIRED: 'Ngựa vẫn ở câu lạc bộ, vẫn được chăm sóc và chữa bệnh; không học lớp, không đăng ký đua.',
  TRANSFERRED: 'Ngựa rời câu lạc bộ. Hồ sơ chuyển sang chỉ đọc, giữ tên chủ cũ.',
  ACTIVE: 'Đưa ngựa trở lại hoạt động đầy đủ.',
  DELETE: 'Xóa mềm hồ sơ tạo nhầm. Chỉ áp dụng khi hồ sơ chưa phát sinh dữ liệu nghiệp vụ nào.',
  RESTORE: 'Đưa hồ sơ đã xóa trở lại danh sách. Ngựa luôn vào danh sách Chờ xếp khu.',
};

/** Các thao tác hợp lệ theo trạng thái hiện tại (khớp máy trạng thái của backend). */
export function lifecycleActionsFor(status: LifecycleStatus, deleted: boolean): LifecycleAction[] {
  if (deleted) return ['RESTORE'];
  if (status === 'ACTIVE') return ['RETIRED', 'TRANSFERRED', 'DELETE'];
  if (status === 'RETIRED') return ['ACTIVE', 'TRANSFERRED'];
  return ['ACTIVE'];
}
