import type { LifecyclePreview, LifecycleStatus } from '../../../api/types';
import { healthLabel } from '../../../lib/labels';

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
  TRANSFERRED: 'Ngựa rời câu lạc bộ. Hồ sơ chuyển sang chỉ đọc, kết thúc sở hữu của chủ hiện tại.',
  DECEASED: 'Ngựa rời câu lạc bộ vĩnh viễn, ngày mất là hôm nay. Hồ sơ chỉ còn xem, không đổi lại được.',
  ACTIVE: 'Đưa ngựa trở lại hoạt động. Ngựa về từ chuyển nhượng sẽ được cách ly chờ bác sĩ khám.',
  DELETE: 'Xóa hồ sơ tạo nhầm. Chỉ xóa được khi hồ sơ chưa có dữ liệu.',
  RESTORE: 'Đưa hồ sơ đã xóa trở lại danh sách. Ngựa luôn vào danh sách Chờ xếp khu.',
};

/** Chữ trên nút xác nhận của hộp thoại. */
export const lifecycleActionConfirm: Record<LifecycleAction, string> = {
  RETIRED: 'Giải nghệ',
  TRANSFERRED: 'Chuyển nhượng',
  DECEASED: 'Ghi nhận đã mất',
  ACTIVE: 'Kích hoạt lại',
  DELETE: 'Xóa hồ sơ',
  RESTORE: 'Khôi phục',
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

/** Dòng hệ quả của bảng xem trước đổi vòng đời. Đóng bệnh án kèm ngựa mất dùng lại. */
export function lifecycleConsequences(data: LifecyclePreview): string[] {
  const lines: string[] = [];
  if (data.classesWithdrawn) lines.push(`Rút khỏi ${data.classesWithdrawn} lớp đang học`);
  if (data.raceRegistrationsWithdrawn) lines.push(`Rút ${data.raceRegistrationsWithdrawn} đăng ký thi đấu chưa diễn ra`);
  if (data.stallReleased) lines.push(`Trả ô ${data.stallReleased} về trống`);
  if (data.barnCleared) lines.push(`Rời ${data.barnCleared}`);
  if (data.groomEnded) lines.push(`Groom ${data.groomEnded} thôi chăm con ngựa này`);
  if (data.trainingLockReleased) lines.push('Gỡ lệnh khóa huấn luyện');
  if (data.examRequestsDismissed) lines.push(`Bỏ ${data.examRequestsDismissed} yêu cầu khám đang chờ`);
  if (data.careSchedulesCancelled) lines.push(`Hủy ${data.careSchedulesCancelled} lịch chăm sóc và lịch hẹn khám`);
  if (data.feedingPlansArchived) lines.push(`Ngừng ${data.feedingPlansArchived} khẩu phần ăn đang áp dụng`);
  if (data.draftFeedingPlansDeleted) lines.push(`Xóa ${data.draftFeedingPlansDeleted} khẩu phần ăn chưa áp dụng`);
  if (data.careTasksEnded) lines.push(`Kết thúc ${data.careTasksEnded} việc chăm sóc riêng đang làm`);
  if (data.careTasksDeleted) lines.push(`Xóa ${data.careTasksDeleted} việc chăm sóc riêng chưa bắt đầu`);
  if (data.checklistCancelled) lines.push('Hủy việc chăm sóc hôm nay');
  if (data.incidentsClosed) lines.push(`Đóng ${data.incidentsClosed} sự cố tại chuồng đang mở`);
  if (data.healthResetTo) lines.push(`Sức khỏe đặt về "${healthLabel[data.healthResetTo]}"`);
  if (data.pendingBarnAfter) lines.push('Ngựa vào danh sách Chờ xếp khu');
  if (data.ownerCleared) lines.push(`${data.ownerCleared} thôi là chủ, chỉ còn xem thông tin cơ bản của ngựa`);
  if (data.to === 'TRANSFERRED') lines.push('Hồ sơ chuyển sang chỉ đọc');
  if (data.ownerRequired) lines.push('Chủ mới sở hữu ngựa từ lúc lưu');
  if (data.to === 'DECEASED') lines.push('Hồ sơ chỉ còn xem, ngựa vẫn hiện trong phả hệ');
  if (data.to === 'RETIRED' && lines.length === 0) lines.push('Giữ khu, ô, Groom và toàn bộ dữ liệu y tế');
  return lines;
}
