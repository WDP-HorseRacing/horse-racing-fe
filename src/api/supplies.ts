// Flow 4: vật tư kho chung CLB, quản lý theo lô (nhập trước xuất trước), sổ nhập xuất, đề xuất bổ sung.
// Số lượng gửi và nhận đều là số JSON. Màn hình tự kiểm ô trước khi gửi.
import { fetchAll, http } from './http';
import type { Page, SupplyCategory, SupplyItem, SupplyItemInput, SupplyLot, SupplyMovement, SupplyRequest, SupplyRequestStatus } from './types';

/* ===== Vật tư (mọi vai trò trừ chủ ngựa xem, chỉ Quản lý CLB sửa) ===== */

/** Vật tư chưa xóa, theo tên A đến Z. */
export const listSupplyItems = (query: { category?: SupplyCategory; search?: string } = {}) => fetchAll<SupplyItem>('/supplies/items', query);
/** Tồn nhỏ hơn hoặc bằng ngưỡng báo thiếu. Không phân trang. */
export const listLowStock = () => http.get<SupplyItem[]>('/supplies/items/low-stock');
export const getSupplyItem = (id: string) => http.get<SupplyItem>(`/supplies/items/${id}`);
/** Tồn ban đầu khác 0 thì BE tạo lô đầu tiên (giá openingUnitPrice) và một dòng Tồn ban đầu trong sổ. */
export const createSupplyItem = (input: SupplyItemInput) => http.post<SupplyItem>('/supplies/items', input);
/** Không đổi được tồn (gửi quantityOnHand thì 400): đổi tồn bằng nhập hàng hoặc xuất dùng. */
export const updateSupplyItem = (id: string, input: Partial<Omit<SupplyItemInput, 'quantityOnHand'>>) => http.patch<SupplyItem>(`/supplies/items/${id}`, input);
/** Xóa mềm. Còn đề xuất chờ duyệt hoặc đã duyệt thì 409. */
export const deleteSupplyItem = (id: string) => http.del<void>(`/supplies/items/${id}`);
/** Nhập hàng trực tiếp, không qua đề xuất (chỉ Quản lý CLB). Tạo một lô mới với đơn giá này. */
export const receiveSupply = (id: string, input: { quantity: number; unitPrice: number; note?: string }) =>
  http.post<SupplyItem>(`/supplies/items/${id}/receipts`, input);
/** Lấy hàng ra dùng (Quản lý CLB, HLV, bác sĩ, Groom), trừ tồn ngay, lô cũ trừ trước. Lấy quá tồn thì 409. */
export const recordSupplyUsage = (id: string, input: { quantity: number; note: string }) => http.post<SupplyItem>(`/supplies/items/${id}/usages`, input);
/**
 * Hủy lần xuất ghi nhầm: cộng trả đúng số đã trừ vào từng lô. Người xuất tự hủy trong 24 giờ, Quản lý CLB bất kỳ lúc nào (khác: 403).
 * Đã hủy: 409. Trả vật tư sau khi cộng trả.
 */
export const cancelSupplyUsage = (usageId: string, reason: string) => http.post<SupplyItem>(`/supplies/usages/${usageId}/cancel`, { reason });
/** Các lô của vật tư, lô nhập sớm nhất trước, kể cả lô đã hết. */
export const listSupplyLots = (id: string) => http.get<SupplyLot[]>(`/supplies/items/${id}/lots`);
/** Sổ nhập xuất của một vật tư, mới nhất trước. */
export const listSupplyMovements = (id: string, page = 1, limit = 20) => http.get<Page<SupplyMovement>>(`/supplies/items/${id}/movements`, { page, limit });

/* ===== Đề xuất bổ sung (HLV, Groom gửi. Quản lý CLB duyệt, cấp) ===== */

/** Quản lý CLB thấy tất cả, HLV và Groom chỉ thấy đề xuất của mình. Mới nhất trước. Bác sĩ nhận 403. */
export const listSupplyRequests = (status?: SupplyRequestStatus) => fetchAll<SupplyRequest>('/supplies/requests', status ? { status } : {});
/** Chỉ đếm (Tổng quan). */
export const countSupplyRequests = async (status: SupplyRequestStatus) =>
  (await http.get<Page<SupplyRequest>>('/supplies/requests', { status, limit: 1 })).meta.total;
export const createSupplyRequest = (input: { itemId: string; quantity: number; note?: string }) => http.post<SupplyRequest>('/supplies/requests', input);
/** Người gửi sửa khi còn chờ duyệt. Bỏ trường để giữ nguyên, ghi chú "" để xóa (gửi null thì BE trả 400). */
export const editSupplyRequest = (id: string, input: { quantity?: number; note?: string }) => http.patch<SupplyRequest>(`/supplies/requests/${id}`, input);
/** Chờ duyệt → Đã duyệt hoặc Từ chối (bắt buộc lý do). */
export const reviewSupplyRequest = (id: string, status: 'APPROVED' | 'REJECTED', reason?: string) =>
  http.patch<SupplyRequest>(`/supplies/requests/${id}/status`, status === 'REJECTED' ? { status, reason } : { status });
/** Đã duyệt → Đã cấp: cộng vào tồn thành một lô mới, bắt buộc đơn giá (đồng). */
export const fulfillSupplyRequest = (id: string, unitPrice: number) =>
  http.patch<SupplyRequest>(`/supplies/requests/${id}/status`, { status: 'FULFILLED', unitPrice });
