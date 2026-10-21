// Phí nuôi ngựa theo ngày (chỉ Quản lý CLB) và phụ phí riêng từng ngựa.
// Đặt mức áp dụng từ một ngày (từ hôm nay trở đi). Sửa số tiền được ở mức sắp áp dụng và mức đang áp dụng (kèm lý do).
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
/**
 * Sửa số tiền (bắt buộc lý do), không sửa ngày áp dụng. Chỉ mức sắp áp dụng và mức đang áp dụng, mức đã thay thì 409.
 * Báo cáo phí tính lại theo số mới cho mọi ngày mức đó áp dụng, không báo chủ ngựa.
 */
export const updateDailyFee = (id: string, input: { dailyFee: number; reason: string }) => http.patch<DailyFee>(`/daily-fees/${id}`, input);
/** Chỉ xóa được mức chưa áp dụng (ngày sau hôm nay), còn lại 409. */
export const deleteDailyFee = (id: string) => http.del<void>(`/daily-fees/${id}`);

// ===== Phụ phí riêng từng ngựa (thay cho gói chăm sóc) =====
// Quản lý CLB ghi khoản (nội dung, tiền mỗi ngày, từ ngày đến ngày). HLV khu hiện tại của ngựa bấm "Đã áp dụng" một lần.
// Tiền tính theo ngày trong khoảng, cộng vào chi phí chủ ngựa và báo cáo tài chính, không phụ thuộc HLV đã áp dụng hay chưa.

export interface HorseSurcharge {
  id: string;
  horseId: string;
  description: string;
  /** Đồng mỗi ngày. */
  dailyAmount: number;
  /** 'YYYY-MM-DD' theo lịch CLB, tính cả hai đầu. */
  startDate: string;
  endDate: string;
  createdBy: string;
  createdAt: string;
  /** Cả ba null khi HLV chưa xác nhận áp dụng. */
  appliedBy: string | null;
  appliedByName: string | null;
  appliedAt: string | null;
}

export interface UnappliedSurcharge extends HorseSurcharge {
  horseName: string;
  /** null: ngựa chưa xếp khu. */
  barnName: string | null;
  /** null: khu chưa có HLV. */
  headTrainerName: string | null;
}

/** CM, HLV khu của ngựa, chủ ngựa. Ngày bắt đầu mới nhất trước. */
export const listHorseSurcharges = (horseId: string) => http.get<HorseSurcharge[]>(`/horses/${horseId}/surcharges`);
/** CM. Ngày bắt đầu trước hôm nay: 400 ở startDate. Ngày kết thúc trước ngày bắt đầu: 400 ở endDate. Ngựa không còn ở CLB: 409. */
export const createHorseSurcharge = (horseId: string, input: { description: string; dailyAmount: number; startDate: string; endDate: string }) =>
  http.post<HorseSurcharge>(`/horses/${horseId}/surcharges`, input);
/** HLV khu hiện tại của ngựa. Đã áp dụng hoặc đã kết thúc: 409. */
export const applyHorseSurcharge = (id: string) => http.post<HorseSurcharge>(`/horse-surcharges/${id}/apply`);
/** CM. Kết thúc sớm, tính tới hết hôm nay. Chỉ khoản đã bắt đầu và còn tính sau hôm nay. */
export const endHorseSurcharge = (id: string) => http.post<HorseSurcharge>(`/horse-surcharges/${id}/end`);
/** CM. Chỉ khoản chưa tới ngày bắt đầu. */
export const deleteHorseSurcharge = (id: string) => http.del<void>(`/horse-surcharges/${id}`);
/** CM. Khoản HLV chưa xác nhận và chưa kết thúc. */
export const listUnappliedSurcharges = () => http.get<UnappliedSurcharge[]>('/horse-surcharges/unapplied');
