import type { LifecycleAction } from '../../../services/horse.service';
import type { LifecycleStatus } from '../../../types/domain';

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
  DELETE: 'Xóa mềm hồ sơ nhập nhầm. Chỉ áp dụng khi hồ sơ chưa phát sinh dữ liệu nghiệp vụ nào.',
  RESTORE: 'Đưa hồ sơ đã xóa trở lại danh sách.',
};

/** Các thao tác vòng đời hợp lệ theo trạng thái hiện tại. */
export function lifecycleActionsFor(status: LifecycleStatus, deleted: boolean): LifecycleAction[] {
  if (deleted) return ['RESTORE'];
  if (status === 'ACTIVE') return ['RETIRED', 'TRANSFERRED', 'DELETE'];
  return ['ACTIVE'];
}
