// Bảng quyền dùng chung: menu, nút bấm và service đều hỏi cùng một nơi.
// Màn hình "Phân quyền" ở phần Quản trị được sinh thẳng từ bảng này.
// Ký hiệu phạm vi: all = toàn câu lạc bộ, zone = khu HT phụ trách, assigned = ngựa được giao, owned = ngựa sở hữu.
import type { ClassSession, Database, Horse, User, UserRole } from '../types/domain';
import { effectiveGroomId, managedZoneIds, sessionRoster } from '../services/selectors';

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
  { key: 'subject.view', code: 'F2.2', group: 'Huấn luyện', feature: 'Xem môn học', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A } },
  { key: 'subject.manage', code: 'F2.2', group: 'Huấn luyện', feature: 'Thêm, sửa, xóa môn học', roles: { HEAD_TRAINER: A } },
  { key: 'program.view', code: 'F2.3', group: 'Huấn luyện', feature: 'Xem giáo án', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A } },
  { key: 'program.manage', code: 'F2.3', group: 'Huấn luyện', feature: 'Thêm, sửa, xóa giáo án', roles: { HEAD_TRAINER: A } },
  { key: 'class.view', code: 'F2.4', group: 'Huấn luyện', feature: 'Xem lớp huấn luyện', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, GROOM: G, HORSE_OWNER: O } },
  { key: 'class.manage', code: 'F2.4', group: 'Huấn luyện', feature: 'Mở, sửa, kết thúc sớm, hủy lớp', roles: { HEAD_TRAINER: Z } },
  { key: 'enrollment.manage', code: 'F2.5', group: 'Huấn luyện', feature: 'Đăng ký và rút ngựa khỏi lớp', roles: { HEAD_TRAINER: Z } },
  { key: 'session.manage', code: 'F2.6', group: 'Huấn luyện', feature: 'Điều chỉnh buổi học, đổi Groom cho buổi', roles: { HEAD_TRAINER: Z } },
  { key: 'session.run', code: 'F2.7', group: 'Huấn luyện', feature: 'Bắt đầu và kết thúc buổi tập', roles: { HEAD_TRAINER: Z, GROOM: G } },
  { key: 'session.stop', code: 'F2.7', group: 'Huấn luyện', feature: 'Dừng khẩn buổi tập', roles: { HEAD_TRAINER: Z, VETERINARIAN: A } },
  { key: 'groomtask.do', code: 'F2.7', group: 'Huấn luyện', feature: 'Đánh dấu việc chuẩn bị và chăm sóc sau tập', roles: { GROOM: G, HEAD_TRAINER: Z } },
  { key: 'realtime.view', code: 'F2.8', group: 'Huấn luyện', feature: 'Theo dõi chỉ số thời gian thực', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A } },
  { key: 'alert.ack', code: 'F2.8', group: 'Huấn luyện', feature: 'Xác nhận cảnh báo', roles: { HEAD_TRAINER: Z, VETERINARIAN: A } },
  { key: 'session.review', code: 'F2.9', group: 'Huấn luyện', feature: 'Đánh giá buổi tập', roles: { HEAD_TRAINER: Z } },
  { key: 'progress.view', code: 'F2.10', group: 'Huấn luyện', feature: 'Xem bảng tiến độ và biểu đồ thể lực', roles: { CLUB_MANAGER: A, HEAD_TRAINER: A, VETERINARIAN: A, HORSE_OWNER: O } },
  { key: 'maxhr.edit', code: 'F2.11', group: 'Huấn luyện', feature: 'Thiết lập nhịp tim tối đa', roles: { VETERINARIAN: A } },

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

/** Thao tác vòng đời vẫn dùng được trên hồ sơ chỉ đọc (TRANSFERRED hoặc đã xóa). */
const READONLY_EXEMPT = new Set(['horse.lifecycle', 'horse.delete', 'horse.view', 'horse.viewDeleted', 'medical.view', 'lock.view', 'progress.view', 'class.view']);

export function capabilityScope(role: UserRole | undefined, key: string): Scope | undefined {
  if (!role) return undefined;
  return byKey.get(key)?.roles[role];
}

/** Kiểm tra quyền thuần theo vai trò, chưa xét phạm vi dữ liệu. */
export function can(user: User | null | undefined, key: string): boolean {
  if (!user || !user.active) return false;
  return capabilityScope(user.role, key) !== undefined;
}

function horseMatches(db: Database, user: User, scope: Scope, horse: Horse): boolean {
  if (scope === 'all') return true;
  if (scope === 'zone') return !!horse.zoneId && managedZoneIds(db, user.id).includes(horse.zoneId);
  if (scope === 'assigned') return horse.groomId === user.id;
  if (scope === 'owned') return horse.ownerId === user.id;
  return false;
}

/** Người dùng có được **xem** con ngựa này không. */
export function canViewHorse(db: Database, user: User | null | undefined, horseId: string): boolean {
  if (!user) return false;
  const horse = db.horses.find((item) => item.id === horseId);
  if (!horse) return false;
  if (user.role === 'CLUB_MANAGER') return true;
  if (horse.deletedAt) return false;
  if (user.role === 'HORSE_OWNER') return horse.ownerId === user.id;
  return true;
}

/** Người dùng có được **thao tác** chức năng này trên con ngựa này không. */
export function inActionScope(db: Database, user: User | null | undefined, key: string, horseId: string): boolean {
  if (!user || !user.active) return false;
  const scope = capabilityScope(user.role, key);
  if (!scope) return false;
  const horse = db.horses.find((item) => item.id === horseId);
  if (!horse) return false;
  const readonly = !!horse.deletedAt || horse.lifecycleStatus === 'TRANSFERRED';
  if (readonly && !READONLY_EXEMPT.has(key)) return false;
  return horseMatches(db, user, scope, horse);
}

/** Thao tác gắn với một khu (lớp, ô chuồng…). */
export function inZoneScope(db: Database, user: User | null | undefined, key: string, zoneId: string | undefined): boolean {
  if (!user || !user.active || !zoneId) return false;
  const scope = capabilityScope(user.role, key);
  if (scope === 'all') return true;
  if (scope === 'zone') return managedZoneIds(db, user.id).includes(zoneId);
  return false;
}

/**
 * Thao tác trên một buổi học (hoặc một con ngựa trong buổi).
 * - zone: lớp thuộc khu của HT.
 * - assigned: Groom đang dắt con ngựa đó (hoặc ít nhất một ngựa trong buổi).
 */
export function inSessionScope(
  db: Database,
  user: User | null | undefined,
  key: string,
  session: ClassSession,
  horseId?: string,
): boolean {
  if (!user || !user.active) return false;
  const scope = capabilityScope(user.role, key);
  if (!scope) return false;
  if (scope === 'all') return true;
  const cls = db.classes.find((item) => item.id === session.classId);
  if (scope === 'zone') return !!cls && managedZoneIds(db, user.id).includes(cls.zoneId);
  if (scope === 'assigned') {
    if (horseId) return effectiveGroomId(db, session, horseId) === user.id;
    return sessionRoster(db, session).some((entry) => effectiveGroomId(db, session, entry.horseId) === user.id);
  }
  if (scope === 'owned') {
    if (horseId) return db.horses.find((item) => item.id === horseId)?.ownerId === user.id;
    return sessionRoster(db, session).some((entry) => db.horses.find((item) => item.id === entry.horseId)?.ownerId === user.id);
  }
  return false;
}

/** Danh sách ngựa trong phạm vi xem của người dùng. */
export function visibleHorses(db: Database, user: User | null | undefined): Horse[] {
  if (!user) return [];
  if (user.role === 'CLUB_MANAGER') return db.horses;
  if (user.role === 'HORSE_OWNER') return db.horses.filter((horse) => horse.ownerId === user.id && !horse.deletedAt);
  return db.horses.filter((horse) => !horse.deletedAt);
}

export const SCOPE_LABEL: Record<Scope, string> = {
  all: 'Toàn câu lạc bộ',
  zone: 'Khu phụ trách',
  assigned: 'Ngựa được giao',
  owned: 'Ngựa sở hữu',
  self: 'Của bản thân',
};
