import type { LifecycleStatus } from '../../../api/types';

/** Thao tác vòng đời trên hồ sơ: đổi trạng thái, xóa mềm, khôi phục. */
export type LifecycleAction = LifecycleStatus | 'DELETE' | 'RESTORE';

export const lifecycleActionLabel: Record<LifecycleAction, string> = {
  RETIRED: 'Giải nghệ',
  TRANSFERRED: 'Chuyển nhượng',
  DECEASED: 'Ghi nhận ngựa mất',
  ACTIVE: 'Kích hoạt lại',
  DELETE: 'Xóa hồ sơ',
  RESTORE: 'Khôi phục hồ sơ',
};

export const lifecycleActionHint: Record<LifecycleAction, string> = {
  RETIRED: 'Ngựa vẫn ở câu lạc bộ, vẫn được chăm sóc và chữa bệnh. Ngựa không học lớp, không đăng ký đua.',
  TRANSFERRED: 'Ngựa rời câu lạc bộ. Hồ sơ chuyển sang chỉ đọc, giữ tên chủ cũ.',
  DECEASED:
    'Ngựa rời câu lạc bộ vĩnh viễn. Hồ sơ chuyển sang chỉ đọc và không đổi lại được. Ngựa còn bệnh án đang mở thì bác sĩ cần đóng bệnh án trước.',
  ACTIVE: 'Đưa ngựa trở lại hoạt động đầy đủ.',
  DELETE: 'Xóa mềm hồ sơ tạo nhầm. Chỉ áp dụng khi hồ sơ chưa phát sinh dữ liệu nghiệp vụ nào.',
  RESTORE: 'Đưa hồ sơ đã xóa trở lại danh sách. Ngựa luôn vào danh sách Chờ xếp khu.',
};

/** Chữ trên nút xác nhận của hộp thoại. */
export const lifecycleActionConfirm: Record<LifecycleAction, string> = {
  RETIRED: 'Xác nhận giải nghệ',
  TRANSFERRED: 'Xác nhận chuyển nhượng',
  DECEASED: 'Xác nhận ngựa đã mất',
  ACTIVE: 'Xác nhận kích hoạt lại',
  DELETE: 'Xác nhận xóa hồ sơ',
  RESTORE: 'Xác nhận khôi phục hồ sơ',
};

/** Câu báo sau khi làm xong. */
export const lifecycleActionDone: Record<LifecycleAction, (name: string) => string> = {
  RETIRED: (name) => `Đã cho ${name} giải nghệ`,
  TRANSFERRED: (name) => `Đã chuyển nhượng ${name} ra khỏi câu lạc bộ`,
  DECEASED: (name) => `Đã ghi nhận ${name} đã mất`,
  ACTIVE: (name) => `Đã kích hoạt lại ${name}`,
  DELETE: (name) => `Đã xóa hồ sơ ${name}`,
  RESTORE: (name) => `Đã khôi phục hồ sơ ${name}`,
};

/** Thao tác làm ngựa rời câu lạc bộ hoặc mất dữ liệu: nút xác nhận màu đỏ. */
export const destructiveActions: ReadonlySet<LifecycleAction> = new Set(['DELETE', 'TRANSFERRED', 'DECEASED']);

/** Các thao tác hợp lệ theo trạng thái hiện tại (khớp máy trạng thái của backend). Đã mất là trạng thái cuối. */
export function lifecycleActionsFor(status: LifecycleStatus, deleted: boolean): LifecycleAction[] {
  if (deleted) return ['RESTORE'];
  if (status === 'ACTIVE') return ['RETIRED', 'TRANSFERRED', 'DECEASED', 'DELETE'];
  if (status === 'RETIRED') return ['ACTIVE', 'TRANSFERRED', 'DECEASED'];
  if (status === 'TRANSFERRED') return ['ACTIVE'];
  return [];
}
