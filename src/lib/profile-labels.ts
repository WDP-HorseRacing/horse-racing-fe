import type { UserRole } from '../types/domain';
export { roleLabel } from './labels';

export const SCOPE_TEXT: Record<UserRole, string> = {
  CLUB_MANAGER: 'Toàn câu lạc bộ, kể cả hồ sơ đã xóa',
  HEAD_TRAINER: 'Xem toàn câu lạc bộ; thao tác trên ngựa thuộc các khu phụ trách (có thể nhiều khu)',
  VETERINARIAN: 'Toàn câu lạc bộ (nội dung y tế)',
  GROOM: 'Xem toàn câu lạc bộ; thao tác trên ngựa được phân công',
  HORSE_OWNER: 'Ngựa đang sở hữu',
};
