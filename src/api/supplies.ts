// Flow 4: vật tư kho chung CLB, kiểm kê, sổ nhập xuất, đề xuất bổ sung.
// Số lượng BE trả dạng chuỗi ("12.50"): đổi sang number ngay ở đây. Body gửi lên phải là số JSON.
// Câu lỗi validate của BE ở đây còn tiếng Anh: màn hình tự kiểm ô trước khi gửi.
import { fetchAll, http } from './http';
import type { Page, SupplyCategory, SupplyItem, SupplyItemInput, SupplyMovement, SupplyRequest, SupplyRequestStatus } from './types';

const num = (value: unknown) => Number(value ?? 0);

const toItem = (row: SupplyItem): SupplyItem => ({ ...row, quantityOnHand: num(row.quantityOnHand), reorderThreshold: num(row.reorderThreshold) });
const toMovement = (row: SupplyMovement): SupplyMovement => ({ ...row, delta: num(row.delta), balanceAfter: num(row.balanceAfter) });
const toRequest = (row: SupplyRequest): SupplyRequest => ({ ...row, quantity: num(row.quantity), item: toItem(row.item) });

/* ===== Vật tư (mọi vai trò trừ chủ ngựa xem, chỉ Quản lý CLB sửa) ===== */

/** Vật tư chưa xóa, theo tên A đến Z. */
export const listSupplyItems = async (query: { category?: SupplyCategory; search?: string } = {}) =>
  (await fetchAll<SupplyItem>('/supplies/items', query)).map(toItem);
/** Tồn nhỏ hơn hoặc bằng ngưỡng báo thiếu. Không phân trang. */
export const listLowStock = async () => (await http.get<SupplyItem[]>('/supplies/items/low-stock')).map(toItem);
export const getSupplyItem = async (id: string) => toItem(await http.get<SupplyItem>(`/supplies/items/${id}`));
/** Tồn ban đầu khác 0 thì BE ghi luôn một dòng kiểm kê vào sổ. */
export const createSupplyItem = async (input: SupplyItemInput) => toItem(await http.post<SupplyItem>('/supplies/items', input));
/** Không đổi được tồn (gửi quantityOnHand thì 400): đổi tồn bằng kiểm kê. */
export const updateSupplyItem = async (id: string, input: Partial<Omit<SupplyItemInput, 'quantityOnHand'>>) =>
  toItem(await http.patch<SupplyItem>(`/supplies/items/${id}`, input));
/** Xóa mềm. Còn đề xuất chờ duyệt hoặc đã duyệt thì 409. */
export const deleteSupplyItem = (id: string) => http.del<void>(`/supplies/items/${id}`);
/** Kiểm kê: nhập số đếm thực tế (Quản lý CLB, HLV, Groom). BE ghi chênh lệch vào sổ. */
export const countSupplyStock = async (id: string, quantityOnHand: number, note?: string) =>
  toItem(await http.post<SupplyItem>(`/supplies/items/${id}/stock-counts`, note ? { quantityOnHand, note } : { quantityOnHand }));
/** Sổ nhập xuất của một vật tư, mới nhất trước. */
export const listSupplyMovements = async (id: string, page = 1, limit = 20) => {
  const result = await http.get<Page<SupplyMovement>>(`/supplies/items/${id}/movements`, { page, limit });
  return { ...result, items: result.items.map(toMovement) };
};

/* ===== Đề xuất bổ sung (HLV, Groom gửi. Quản lý CLB duyệt, cấp) ===== */

/** Quản lý CLB thấy tất cả, HLV và Groom chỉ thấy đề xuất của mình. Mới nhất trước. Bác sĩ nhận 403. */
export const listSupplyRequests = async (status?: SupplyRequestStatus) =>
  (await fetchAll<SupplyRequest>('/supplies/requests', status ? { status } : {})).map(toRequest);
/** Chỉ đếm (Tổng quan). */
export const countSupplyRequests = async (status: SupplyRequestStatus) =>
  (await http.get<Page<SupplyRequest>>('/supplies/requests', { status, limit: 1 })).meta.total;
export const createSupplyRequest = async (input: { itemId: string; quantity: number; note?: string }) =>
  toRequest(await http.post<SupplyRequest>('/supplies/requests', input));
/** Người gửi sửa khi còn chờ duyệt. Không gửi null (BE lỗi 500), bỏ trường để giữ nguyên. */
export const editSupplyRequest = async (id: string, input: { quantity?: number; note?: string }) =>
  toRequest(await http.patch<SupplyRequest>(`/supplies/requests/${id}`, input));
/** Chờ duyệt → Đã duyệt hoặc Từ chối (bắt buộc lý do). Đã duyệt → Đã cấp (cộng vào tồn). */
export const setSupplyRequestStatus = async (id: string, status: Exclude<SupplyRequestStatus, 'PENDING'>, reason?: string) =>
  toRequest(await http.patch<SupplyRequest>(`/supplies/requests/${id}/status`, status === 'REJECTED' ? { status, reason } : { status }));
