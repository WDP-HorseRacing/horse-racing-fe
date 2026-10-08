// Bảng quyền dùng chung: menu, nút bấm và service đều hỏi cùng một nơi.
// Quyền chi tiết theo vai trò; giao diện ẩn/hiện nút theo bảng này, backend vẫn kiểm lại.
// Ký hiệu phạm vi: all = toàn câu lạc bộ, zone = khu HT phụ trách, assigned = ngựa được giao, owned = ngựa sở hữu.
import type { User, UserRole } from '../types/domain';

export type Scope = 'all' | 'zone' | 'assigned' | 'owned' | 'self';

export interface Capability {
  key: string;
  code: string;
  group: string;
  feature: string;
  roles: Partial<Record<UserRole, Scope>>;
}

const A: Scope = 'all';
const Z: Scope = 'zone';
const G: Scope = 'assigned';
const O: Scope = 'owned';
const S: Scope = 'self';

export const CAPABILITIES: Capability[] = [
  // ===== Flow 1 — hồ sơ và lý lịch ngựa =====
  { key: 'horse.view', code: 'F1.1', group: 'Hồ sơ ngựa', feature: 'Xem danh sách và hồ sơ ngựa', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, GROOM: A, HORSE_OWNER: O } },
  { key: 'horse.viewDeleted', code: 'F1.1', group: 'Hồ sơ ngựa', feature: 'Xem hồ sơ đã xóa', roles: { CLUB_MANAGER: A } },
  { key: 'horse.create', code: 'F1.2', group: 'Hồ sơ ngựa', feature: 'Tạo hồ sơ ngựa mới', roles: { CLUB_MANAGER: A } },
  { key: 'horse.edit.identity', code: 'F1.4', group: 'Hồ sơ ngựa', feature: 'Sửa thông tin định danh', roles: { CLUB_MANAGER: A } },
  { key: 'horse.edit.preference', code: 'F1.4', group: 'Hồ sơ ngựa', feature: 'Sửa sở trường cự ly', roles: { CLUB_MANAGER: A, HEAD_TRAINER: Z } },
  { key: 'horse.avatar', code: 'F1.4', group: 'Hồ sơ ngựa', feature: 'Thay ảnh đại diện', roles: { CLUB_MANAGER: A } },
  { key: 'pedigree.edit', code: 'F1.4', group: 'Hồ sơ ngựa', feature: 'Khai báo cha mẹ', roles: { CLUB_MANAGER: A } },
  { key: 'owner.assign', code: 'F1.4', group: 'Hồ sơ ngựa', feature: 'Gán hoặc đổi chủ sở hữu', roles: { CLUB_MANAGER: A } },
  { key: 'measurement.add', code: 'F1.5', group: 'Hồ sơ ngựa', feature: 'Ghi chỉ số cơ thể', roles: { HEAD_TRAINER: Z, VETERINARIAN: A, GROOM: G } },
  { key: 'measurement.delete', code: 'F1.5', group: 'Hồ sơ ngựa', feature: 'Xóa bản ghi chỉ số ghi sai', roles: { VETERINARIAN: A } },
  { key: 'zone.assignHorse', code: 'F1.6', group: 'Hồ sơ ngựa', feature: 'Xếp khu chuồng cho ngựa', roles: { CLUB_MANAGER: A } },
  { key: 'stall.assign', code: 'F1.7', group: 'Hồ sơ ngựa', feature: 'Xếp ô chuồng', roles: { HEAD_TRAINER: Z } },
  { key: 'groom.assign', code: 'F1.7', group: 'Hồ sơ ngựa', feature: 'Phân công Groom', roles: { HEAD_TRAINER: Z } },
  { key: 'horse.lifecycle', code: 'F1.8', group: 'Hồ sơ ngựa', feature: 'Đổi trạng thái vòng đời', roles: { CLUB_MANAGER: A } },
  { key: 'horse.delete', code: 'F1.8', group: 'Hồ sơ ngựa', feature: 'Xóa và khôi phục hồ sơ', roles: { CLUB_MANAGER: A } },
  { key: 'facility.view', code: 'F1.7', group: 'Hồ sơ ngựa', feature: 'Xem khu chuồng và ô chuồng', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, GROOM: A } },
  { key: 'zone.manage', code: 'F1.6', group: 'Hồ sơ ngựa', feature: 'Quản lý danh mục khu chuồng, gán HT phụ trách', roles: { CLUB_MANAGER: A } },
  { key: 'stall.manage', code: 'F1.7', group: 'Hồ sơ ngựa', feature: 'Quản lý ô chuồng và bảo trì', roles: { CLUB_MANAGER: A } },

  // ===== Flow 2 — lập và thực hiện giáo án huấn luyện =====
  { key: 'subject.view', code: 'F2.2', group: 'Huấn luyện', feature: 'Xem danh mục môn học', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, GROOM: A } },
  { key: 'subject.manage', code: 'F2.2', group: 'Huấn luyện', feature: 'Thêm, sửa, xóa môn học', roles: { CLUB_MANAGER: A } },
  { key: 'plan.view', code: 'F2.2', group: 'Huấn luyện', feature: 'Xem giáo án', roles: { CLUB_MANAGER: A, HEAD_TRAINER: S } },
  { key: 'plan.manage', code: 'F2.2', group: 'Huấn luyện', feature: 'Lập, sửa, xóa giáo án của mình', roles: { HEAD_TRAINER: S } },
  { key: 'class.view', code: 'F2.3', group: 'Huấn luyện', feature: 'Xem lớp và buổi tập', roles: { CLUB_MANAGER: A, HEAD_TRAINER: Z, VETERINARIAN: A, GROOM: G, HORSE_OWNER: O } },
  { key: 'class.manage', code: 'F2.3', group: 'Huấn luyện', feature: 'Mở lớp, ghi danh, công bố và hủy buổi', roles: { HEAD_TRAINER: Z } },
  { key: 'session.run', code: 'F2.3', group: 'Huấn luyện', feature: 'Điểm danh, bắt đầu, hoàn thành lượt tập, ghi kết quả chạy thử', roles: { HEAD_TRAINER: Z, GROOM: G } },
  { key: 'realtime.view', code: 'F2.4', group: 'Huấn luyện', feature: 'Theo dõi nhịp tim, tốc độ khi tập', roles: { CLUB_MANAGER: A, HEAD_TRAINER: Z, VETERINARIAN: A, GROOM: G } },
  { key: 'threshold.view', code: 'F2.4', group: 'Huấn luyện', feature: 'Xem ngưỡng nhịp tim và tốc độ', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A } },
  { key: 'threshold.manage', code: 'F2.4', group: 'Huấn luyện', feature: 'Đặt ngưỡng nhịp tim và tốc độ cho ngựa', roles: { HEAD_TRAINER: Z } },
  { key: 'alert.view', code: 'F2.4', group: 'Huấn luyện', feature: 'Xem lịch sử cảnh báo thể lực', roles: { CLUB_MANAGER: A, HEAD_TRAINER: Z, VETERINARIAN: A } },
  { key: 'session.review', code: 'F2.5', group: 'Huấn luyện', feature: 'Đánh giá và nhận xét sau buổi tập', roles: { HEAD_TRAINER: Z } },
  { key: 'progress.view', code: 'F2.1', group: 'Huấn luyện', feature: 'Xem lịch tập, khối lượng tập và xu hướng thể lực', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, HORSE_OWNER: O } },
  { key: 'trainer.handover', code: 'QT', group: 'Huấn luyện', feature: 'Bàn giao công việc của huấn luyện viên trưởng', roles: { CLUB_MANAGER: A } },

  // ===== Flow 3 — y tế và xử lý chấn thương =====
  { key: 'medical.board', code: 'F3.1', group: 'Y tế', feature: 'Xem bảng điều khiển y tế', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A } },
  { key: 'checkup.view', code: 'F3.2', group: 'Y tế', feature: 'Xem lịch khám định kỳ (chu kỳ cố định 30 ngày)', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A } },
  { key: 'checkup.appointment', code: 'F3.2', group: 'Y tế', feature: 'Đặt và dời ngày hẹn khám định kỳ', roles: { VETERINARIAN: A } },
  { key: 'exam.record', code: 'F3.3', group: 'Y tế', feature: 'Ghi buổi khám (định kỳ, theo yêu cầu, tái khám)', roles: { VETERINARIAN: A } },
  { key: 'examRequest.view', code: 'F3.4', group: 'Y tế', feature: 'Xem hàng đợi yêu cầu khám', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, GROOM: G } },
  { key: 'examRequest.create', code: 'F3.4', group: 'Y tế', feature: 'Gửi yêu cầu khám', roles: { CLUB_MANAGER: A, HEAD_TRAINER: Z, VETERINARIAN: A, GROOM: G } },
  { key: 'examRequest.dismiss', code: 'F3.4', group: 'Y tế', feature: 'Đổi mức khẩn, bỏ qua yêu cầu khám', roles: { VETERINARIAN: A } },
  { key: 'case.open', code: 'F3.5', group: 'Y tế', feature: 'Mở bệnh án', roles: { VETERINARIAN: A } },
  { key: 'exam.void', code: 'F3.6', group: 'Y tế', feature: 'Hủy buổi khám ghi sai và ghi buổi thay thế', roles: { VETERINARIAN: A } },
  { key: 'health.status.edit', code: 'F3.7', group: 'Y tế', feature: 'Cập nhật trạng thái sức khỏe', roles: { VETERINARIAN: A } },
  { key: 'lock.view', code: 'F3.8', group: 'Y tế', feature: 'Xem khóa huấn luyện', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, HORSE_OWNER: O } },
  { key: 'lock.manage', code: 'F3.8', group: 'Y tế', feature: 'Đặt và gỡ khóa huấn luyện', roles: { VETERINARIAN: A } },
  { key: 'case.close', code: 'F3.9', group: 'Y tế', feature: 'Đóng bệnh án, chốt và điều chỉnh chi phí', roles: { VETERINARIAN: A } },
  { key: 'medical.view', code: 'F3.10', group: 'Y tế', feature: 'Xem bệnh án, buổi khám, chấn thương, lịch sử sức khỏe', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, HORSE_OWNER: O } },
  { key: 'medical.cost.view', code: 'F3.10', group: 'Y tế', feature: 'Xem chi phí y tế', roles: { CLUB_MANAGER: A, VETERINARIAN: A, HORSE_OWNER: O } },
  { key: 'medical.cost.report', code: 'F3.10', group: 'Y tế', feature: 'Báo cáo chi phí y tế theo khoảng ngày', roles: { CLUB_MANAGER: A } },
  { key: 'careInstructions.view', code: 'F3.10', group: 'Y tế', feature: 'Xem ghi chú chăm sóc của bác sĩ', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, GROOM: G, HORSE_OWNER: O } },
  { key: 'care.view', code: 'F3.11', group: 'Y tế', feature: 'Xem lịch tiêm phòng, tẩy giun, kiểm tra móng', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, GROOM: G, HORSE_OWNER: O } },
  { key: 'care.manage', code: 'F3.11', group: 'Y tế', feature: 'Tạo, dời, hủy lịch chăm sóc', roles: { VETERINARIAN: A } },
  { key: 'care.complete', code: 'F3.11', group: 'Y tế', feature: 'Hoàn tất lịch chăm sóc được giao', roles: { VETERINARIAN: A, GROOM: G } },

  // ===== Quản trị =====
  { key: 'admin.users', code: 'QT', group: 'Quản trị', feature: 'Quản lý nhân sự: tạo tài khoản, đổi vai trò, khóa tài khoản', roles: { CLUB_MANAGER: A } },
];

const byKey = new Map(CAPABILITIES.map((capability) => [capability.key, capability]));

export function capabilityScope(role: UserRole | undefined, key: string): Scope | undefined {
  if (!role) return undefined;
  return byKey.get(key)?.roles[role];
}

/** Kiểm tra quyền thuần theo vai trò, chưa xét phạm vi dữ liệu. */
export function can(user: User | null | undefined, key: string): boolean {
  if (!user || !user.active) return false;
  return capabilityScope(user.role, key) !== undefined;
}

export const SCOPE_LABEL: Record<Scope, string> = {
  all: 'Toàn câu lạc bộ',
  zone: 'Khu phụ trách',
  assigned: 'Ngựa được giao',
  owned: 'Ngựa sở hữu',
  self: 'Của bản thân',
};
