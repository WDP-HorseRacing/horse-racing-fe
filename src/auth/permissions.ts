// Bảng quyền dùng chung: menu, nút bấm và service đều hỏi cùng một nơi.
// Màn hình "Phân quyền" ở phần Quản trị được sinh thẳng từ bảng này.
import type { Database, User, UserRole } from '../types/domain';
import { ownedHorseIds, zoneIdOf, groomIdOf } from '../services/selectors';

export type Scope = 'all' | 'zone' | 'assigned' | 'owned' | 'self';

export interface Capability {
  key: string;
  group: string;
  feature: string;
  roles: Partial<Record<UserRole, Scope>>;
}

const ALL: Scope = 'all';

export const CAPABILITIES: Capability[] = [
  // ===== Flow 1 =====
  { key: 'horse.view', group: 'Hồ sơ ngựa', feature: 'Xem hồ sơ ngựa', roles: { CLUB_MANAGER: ALL, HEAD_TRAINER: ALL, VETERINARIAN: ALL, GROOM: ALL, HORSE_OWNER: 'owned' } },
  { key: 'horse.create', group: 'Hồ sơ ngựa', feature: 'Tạo hồ sơ ngựa mới', roles: { CLUB_MANAGER: ALL } },
  { key: 'horse.edit.identity', group: 'Hồ sơ ngựa', feature: 'Sửa thông tin định danh', roles: { CLUB_MANAGER: ALL } },
  { key: 'horse.edit.preference', group: 'Hồ sơ ngựa', feature: 'Sửa sở trường cự ly', roles: { CLUB_MANAGER: ALL, HEAD_TRAINER: 'zone' } },
  { key: 'horse.lifecycle', group: 'Hồ sơ ngựa', feature: 'Đổi vòng đời, xóa hồ sơ', roles: { CLUB_MANAGER: ALL } },
  { key: 'horse.viewDeleted', group: 'Hồ sơ ngựa', feature: 'Xem hồ sơ đã xóa và ngựa tham chiếu', roles: { CLUB_MANAGER: ALL } },
  { key: 'pedigree.edit', group: 'Hồ sơ ngựa', feature: 'Khai báo phả hệ, ngựa tham chiếu', roles: { CLUB_MANAGER: ALL } },
  { key: 'ownership.edit', group: 'Hồ sơ ngựa', feature: 'Gán và chuyển nhượng quyền sở hữu', roles: { CLUB_MANAGER: ALL } },
  { key: 'ownership.viewFull', group: 'Hồ sơ ngựa', feature: 'Xem danh sách đồng sở hữu và liên hệ', roles: { CLUB_MANAGER: ALL, HORSE_OWNER: 'owned' } },
  { key: 'measurement.add', group: 'Hồ sơ ngựa', feature: 'Ghi chỉ số cơ thể', roles: { HEAD_TRAINER: 'zone', VETERINARIAN: ALL, GROOM: 'assigned' } },
  { key: 'photo.add', group: 'Hồ sơ ngựa', feature: 'Tải ảnh hồ sơ', roles: { CLUB_MANAGER: ALL, HEAD_TRAINER: 'zone' } },
  { key: 'photo.manage', group: 'Hồ sơ ngựa', feature: 'Gỡ ảnh, đặt ảnh đại diện', roles: { CLUB_MANAGER: ALL } },
  { key: 'stall.assign', group: 'Hồ sơ ngựa', feature: 'Xếp và chuyển ô chuồng', roles: { CLUB_MANAGER: ALL, HEAD_TRAINER: 'zone', VETERINARIAN: ALL } },
  { key: 'boarding.rate', group: 'Hồ sơ ngựa', feature: 'Đặt phí nuôi dưỡng theo ngày', roles: { CLUB_MANAGER: ALL } },

  // ===== Flow 2 =====
  { key: 'plan.view', group: 'Huấn luyện', feature: 'Xem giáo án', roles: { CLUB_MANAGER: ALL, HEAD_TRAINER: ALL, VETERINARIAN: ALL, GROOM: ALL, HORSE_OWNER: 'owned' } },
  { key: 'plan.edit', group: 'Huấn luyện', feature: 'Lập và sửa giáo án', roles: { HEAD_TRAINER: 'zone' } },
  { key: 'plan.close', group: 'Huấn luyện', feature: 'Kết thúc sớm hoặc hủy giáo án', roles: { HEAD_TRAINER: 'zone' } },
  { key: 'session.edit', group: 'Huấn luyện', feature: 'Phân công, sửa, hủy buổi tập', roles: { HEAD_TRAINER: 'zone' } },
  { key: 'session.start', group: 'Huấn luyện', feature: 'Bắt đầu và kết thúc buổi tập', roles: { HEAD_TRAINER: 'zone', GROOM: 'assigned' } },
  { key: 'session.stop', group: 'Huấn luyện', feature: 'Dừng khẩn buổi tập', roles: { HEAD_TRAINER: 'zone', VETERINARIAN: ALL } },
  { key: 'session.evaluate', group: 'Huấn luyện', feature: 'Đánh giá buổi tập', roles: { HEAD_TRAINER: 'zone' } },
  { key: 'realtime.view', group: 'Huấn luyện', feature: 'Theo dõi chỉ số thời gian thực', roles: { CLUB_MANAGER: ALL, HEAD_TRAINER: ALL, VETERINARIAN: ALL } },
  { key: 'alert.ack', group: 'Huấn luyện', feature: 'Xác nhận cảnh báo', roles: { HEAD_TRAINER: 'zone', VETERINARIAN: ALL } },
  { key: 'maxhr.edit', group: 'Huấn luyện', feature: 'Đặt nhịp tim tối đa', roles: { VETERINARIAN: ALL } },
  { key: 'progress.view', group: 'Huấn luyện', feature: 'Xem bảng tiến độ và biểu đồ thể lực', roles: { CLUB_MANAGER: ALL, HEAD_TRAINER: ALL, VETERINARIAN: ALL, HORSE_OWNER: 'owned' } },

  // ===== Flow 3 =====
  { key: 'medical.view', group: 'Y tế', feature: 'Xem hồ sơ khám', roles: { CLUB_MANAGER: ALL, HEAD_TRAINER: 'zone', VETERINARIAN: ALL, HORSE_OWNER: 'owned' } },
  { key: 'medical.edit', group: 'Y tế', feature: 'Ghi và cập nhật hồ sơ khám', roles: { VETERINARIAN: ALL } },
  { key: 'health.status.edit', group: 'Y tế', feature: 'Đổi trạng thái sức khỏe', roles: { VETERINARIAN: ALL } },
  { key: 'injury.edit', group: 'Y tế', feature: 'Đánh dấu và theo dõi chấn thương', roles: { VETERINARIAN: ALL } },
  { key: 'lock.edit', group: 'Y tế', feature: 'Đặt và gỡ khóa huấn luyện', roles: { VETERINARIAN: ALL } },
  { key: 'care.edit', group: 'Y tế', feature: 'Quản lý lịch chăm sóc định kỳ', roles: { VETERINARIAN: ALL } },
  { key: 'care.done.farrier', group: 'Y tế', feature: 'Đánh dấu đã kiểm tra móng', roles: { CLUB_MANAGER: ALL, VETERINARIAN: ALL } },

  // ===== Flow 4 =====
  { key: 'task.done', group: 'Chăm sóc', feature: 'Đánh dấu hoàn thành công việc', roles: { GROOM: 'assigned' } },
  { key: 'diet.propose', group: 'Chăm sóc', feature: 'Đề xuất khẩu phần ăn', roles: { HEAD_TRAINER: 'zone' } },
  { key: 'diet.approve', group: 'Chăm sóc', feature: 'Duyệt khẩu phần ăn', roles: { VETERINARIAN: ALL } },
  { key: 'incident.create', group: 'Chăm sóc', feature: 'Gửi báo cáo sự cố', roles: { GROOM: 'assigned' } },
  { key: 'incident.handle', group: 'Chăm sóc', feature: 'Xử lý sự cố', roles: { VETERINARIAN: ALL } },
  { key: 'restock.request', group: 'Chăm sóc', feature: 'Đề xuất bổ sung vật tư', roles: { GROOM: 'assigned' } },
  { key: 'restock.approve', group: 'Chăm sóc', feature: 'Duyệt đề xuất bổ sung', roles: { CLUB_MANAGER: ALL } },

  // ===== Flow 5 =====
  { key: 'race.manage', group: 'Thi đấu', feature: 'Quản lý danh mục giải đua và kết quả', roles: { CLUB_MANAGER: ALL } },
  { key: 'race.register', group: 'Thi đấu', feature: 'Tạo đăng ký thi đấu', roles: { HEAD_TRAINER: 'zone' } },
  { key: 'race.approve', group: 'Thi đấu', feature: 'Duyệt đăng ký thi đấu', roles: { HORSE_OWNER: 'owned' } },
  { key: 'report.owner', group: 'Thi đấu', feature: 'Xem báo cáo chi phí và tiền thưởng', roles: { CLUB_MANAGER: ALL, HORSE_OWNER: 'owned' } },
  { key: 'report.club', group: 'Thi đấu', feature: 'Xem báo cáo vận hành toàn câu lạc bộ', roles: { CLUB_MANAGER: ALL } },

  // ===== Quản trị =====
  { key: 'admin.users', group: 'Quản trị', feature: 'Quản lý nhân sự và phân quyền', roles: { CLUB_MANAGER: ALL } },
  { key: 'admin.audit', group: 'Quản trị', feature: 'Xem nhật ký thao tác', roles: { CLUB_MANAGER: ALL } },
  { key: 'admin.system', group: 'Quản trị', feature: 'Công cụ hệ thống', roles: { CLUB_MANAGER: ALL } },
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

/** Người dùng có được **xem** con ngựa này không. */
export function canViewHorse(db: Database, user: User | null | undefined, horseId: string): boolean {
  if (!user) return false;
  const horse = db.horses.find((item) => item.id === horseId);
  if (!horse) return false;
  if (user.role === 'CLUB_MANAGER') return true;
  if (horse.deletedAt) return false;
  if (horse.isReference) {
    // Ngựa tham chiếu chỉ là nút trên cây phả hệ — xem được khi có quyền xem phả hệ.
    return user.role === 'HEAD_TRAINER' || user.role === 'VETERINARIAN' || user.role === 'HORSE_OWNER';
  }
  if (user.role === 'HORSE_OWNER') return ownedHorseIds(db, user.id).includes(horseId);
  return true;
}

/** Người dùng có được **thao tác** trên con ngựa này không (đã có quyền chức năng). */
export function inActionScope(
  db: Database,
  user: User | null | undefined,
  key: string,
  horseId: string,
): boolean {
  if (!user) return false;
  const scope = capabilityScope(user.role, key);
  if (!scope) return false;
  if (scope === 'all') return true;
  if (scope === 'zone') return !!user.zoneId && zoneIdOf(db, horseId) === user.zoneId;
  if (scope === 'assigned') return groomIdOf(db, horseId) === user.id;
  if (scope === 'owned') return ownedHorseIds(db, user.id).includes(horseId);
  return false;
}

/** Danh sách ngựa trong phạm vi xem của người dùng. */
export function visibleHorses(db: Database, user: User | null | undefined) {
  if (!user) return [];
  if (user.role === 'CLUB_MANAGER') return db.horses;
  if (user.role === 'HORSE_OWNER') {
    const ids = ownedHorseIds(db, user.id);
    return db.horses.filter((horse) => ids.includes(horse.id) && !horse.deletedAt);
  }
  return db.horses.filter((horse) => !horse.deletedAt && !horse.isReference);
}

export const SCOPE_LABEL: Record<Scope, string> = {
  all: 'Toàn câu lạc bộ',
  zone: 'Khu phụ trách',
  assigned: 'Ngựa được giao',
  owned: 'Ngựa sở hữu',
  self: 'Của bản thân',
};
