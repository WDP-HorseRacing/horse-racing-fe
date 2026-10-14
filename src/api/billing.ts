// Phí nuôi ngựa theo ngày (chỉ Quản lý CLB): một mức chung cho mọi ngựa, đồng mỗi con mỗi ngày.
// Đặt mức áp dụng từ một ngày (từ hôm nay trở đi). Không sửa được: muốn đổi thì xóa mức chưa áp dụng hoặc đặt mức mới.
import { http } from './http';

export interface DailyFee {
  id: string;
  /** 'YYYY-MM-DD' theo lịch CLB. */
  effectiveFrom: string;
  dailyFee: number;
  createdBy: string;
  createdAt: string;
}

/** Mọi mức, ngày áp dụng mới nhất trước. */
export const listDailyFees = () => http.get<DailyFee[]>('/daily-fees');
/** Ngày trước hôm nay: 400 ở effectiveFrom. Trùng ngày: 409 ở effectiveFrom. */
export const createDailyFee = (input: { effectiveFrom: string; dailyFee: number }) => http.post<DailyFee>('/daily-fees', input);
/** Chỉ xóa được mức chưa áp dụng (ngày sau hôm nay), còn lại 409. */
export const deleteDailyFee = (id: string) => http.del<void>(`/daily-fees/${id}`);
