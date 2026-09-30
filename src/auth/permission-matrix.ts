// Ma trận phân quyền hiển thị ở trang Phân quyền và Hồ sơ cá nhân — sinh thẳng từ bảng CAPABILITIES.
// Nhóm Huấn luyện (Flow 2) ẩn khi phần huấn luyện đang tắt.
import type { UserRole } from '../types/domain';
import { CAPABILITIES, SCOPE_LABEL } from './permissions';
import { FEATURES } from '../config/features';

export function getPermissionMatrix() {
  const roles: UserRole[] = ['CLUB_MANAGER', 'HEAD_TRAINER', 'VETERINARIAN', 'GROOM', 'HORSE_OWNER'];
  const visible = CAPABILITIES.filter((item) => FEATURES.training || !item.code.startsWith('F2'));
  const groups = [...new Set(visible.map((item) => item.group))];
  return Promise.resolve({
    roles,
    groups: groups.map((group) => ({
      group,
      rows: visible
        .filter((item) => item.group === group)
        .map((item) => ({
          key: item.key,
          code: item.code,
          feature: item.feature,
          cells: roles.map((role) => {
            const scope = item.roles[role];
            return { role, allowed: !!scope, scopeLabel: scope ? SCOPE_LABEL[scope] : undefined };
          }),
        })),
    })),
  });
}
