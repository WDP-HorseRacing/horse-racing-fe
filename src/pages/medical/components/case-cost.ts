// Chi phí y tế tính theo từng buổi khám, cho người làm chủ vào ngày khám.
// Chủ ngựa xem buổi khám thuộc giai đoạn chủ khác sở hữu thì backend ẩn số (costHidden ở buổi khám).
// Tổng chi phí của bệnh án đã là phần của người đang xem nên không cần ẩn.
import type { MedicalRecord } from '../../../api/types';

export const HIDDEN_COST_TEXT = 'Chi phí thuộc chủ khác';

/** Chi phí buổi khám thuộc chủ khác nên bị ẩn với người đang xem. */
export const isCostHidden = (record: Pick<MedicalRecord, 'costHidden'>) => record.costHidden === true;
