import type { UserRole } from '../types/domain';
export { roleLabel } from './labels';

export const SCOPE_TEXT: Record<UserRole, string> = {
  CLUB_MANAGER: 'Toàn câu lạc bộ, kể cả hồ sơ đã xóa và ngựa tham chiếu',
  HEAD_TRAINER: 'Xem toàn câu lạc bộ; thao tác trong khu phụ trách',
  VETERINARIAN: 'Toàn câu lạc bộ',
  GROOM: 'Xem toàn câu lạc bộ; thao tác trên ngựa và buổi tập được giao',
  HORSE_OWNER: 'Ngựa đang sở hữu',
};
