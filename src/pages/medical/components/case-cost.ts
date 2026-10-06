// Chi phí bệnh án theo giai đoạn sở hữu: bệnh án thuộc người làm chủ lúc bệnh án được đóng.
// Chủ ngựa xem bệnh án đóng trong thời gian chủ khác sở hữu thì backend ẩn chi phí (costHidden).
import type { MedicalCase } from '../../../api/types';

export const HIDDEN_COST_TEXT = 'Chi phí thuộc chủ trước';

/** Chi phí bệnh án thuộc chủ khác nên bị ẩn với người đang xem. */
export const isCostHidden = (item: Pick<MedicalCase, 'costHidden'>) => item.costHidden === true;

/** Bệnh án đã đóng và chi phí được tính cho người đang xem. */
export const isOwnClosed = (item: Pick<MedicalCase, 'status' | 'costHidden'>) => item.status === 'CLOSED' && !isCostHidden(item);
