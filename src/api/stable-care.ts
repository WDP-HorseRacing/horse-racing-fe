// Flow 4: khẩu phần, loại việc, việc riêng của ngựa, checklist hằng ngày, màn Hôm nay của Groom, sự cố tại chuồng.
// Ngày thuần luôn gửi 'YYYY-MM-DD'.
import { fetchAll, http } from './http';
import type {
  ChecklistTaskType,
  DailyChecklist,
  FeedingMeal,
  FeedingPlan,
  FeedingPlanItemInput,
  FeedingPlanStatus,
  GroomToday,
  HorseCareTask,
  HorseCareTaskMode,
  Incident,
  IncidentStatus,
  Page,
} from './types';

export const MEAL_ORDER: FeedingMeal[] = ['EARLY_MORNING', 'NOON', 'AFTERNOON', 'EVENING'];

/** Trải các bữa ra thành dòng để sửa, sao chép hoặc gửi lại (PUT thay toàn bộ dòng). */
export const planLines = (plan: FeedingPlan): FeedingPlanItemInput[] =>
  plan.meals.flatMap((meal) => meal.items.map((item) => ({ meal: meal.meal, supplyItemId: item.supplyItemId, quantity: item.quantity, ...(item.note ? { note: item.note } : {}) })));

/* ===== Khẩu phần (HLV khu lập và áp dụng. Quản lý CLB, bác sĩ xem. Groom chỉ thấy bản đang áp dụng) ===== */

/** Mới nhất trước. Groom luôn nhận bản đang áp dụng, BE bỏ qua `status`. */
export const listFeedingPlans = (horseId: string, status?: FeedingPlanStatus) =>
  http.get<FeedingPlan[]>(`/horses/${horseId}/feeding-plans`, status ? { status } : undefined);
export const getFeedingPlan = (id: string) => http.get<FeedingPlan>(`/feeding-plans/${id}`);
/** Lập bản nháp cho một ngựa. */
export const createFeedingPlan = async (horseId: string, items: FeedingPlanItemInput[], note?: string) => {
  const [plan] = await http.post<FeedingPlan[]>('/feeding-plans', note ? { horseIds: [horseId], items, note } : { horseIds: [horseId], items });
  return plan;
};
/** Thay toàn bộ dòng của bản nháp. `note: null` để xóa ghi chú. */
export const replaceFeedingPlan = (id: string, items: FeedingPlanItemInput[], note: string | null) => http.put<FeedingPlan>(`/feeding-plans/${id}`, { items, note });
export const deleteFeedingPlan = (id: string) => http.del<void>(`/feeding-plans/${id}`);
/** Áp dụng bản nháp (route BE tên `approve`). Bản đang áp dụng cũ chuyển vào lịch sử. */
export const applyFeedingPlan = (id: string) => http.post<FeedingPlan>(`/feeding-plans/${id}/approve`);

/* ===== Loại việc (Quản lý CLB sửa, mọi nhân viên xem) ===== */

/** Gồm cả loại đã ngưng. */
export const listTaskTypes = () => http.get<ChecklistTaskType[]>('/care-task-types');
export const createTaskType = (input: { name: string; appliesToAll: boolean }) => http.post<ChecklistTaskType>('/care-task-types', input);
/** Chỉ áp cho checklist sinh sau, checklist đã sinh giữ nguyên. */
export const updateTaskType = (id: string, input: { name?: string; appliesToAll?: boolean; active?: boolean }) =>
  http.patch<ChecklistTaskType>(`/care-task-types/${id}`, input);

/* ===== Việc riêng của ngựa (HLV khu gắn, gỡ) ===== */

/** Gồm cả việc đã kết thúc, mới nhất trước. */
export const listHorseCareTasks = (horseId: string) => http.get<HorseCareTask[]>(`/horses/${horseId}/care-tasks`);
/**
 * `mode` mặc định EXTRA. EXEMPT miễn một loại việc đang áp mọi ngựa trong khoảng ngày, `note` (lý do) bắt buộc (thiếu: 400).
 * Miễn loại không áp mọi ngựa, hoặc trùng khoảng ngày với dòng khác cùng loại: 409.
 */
export const attachCareTask = (horseId: string, input: { taskTypeId: string; fromDate: string; toDate: string; mode?: HorseCareTaskMode; note?: string }) =>
  http.post<HorseCareTask>(`/horses/${horseId}/care-tasks`, input);
/** Chưa tới ngày bắt đầu thì xóa hẳn, đang chạy thì kết thúc ở hôm nay. Gỡ dòng miễn: việc chung có lại ngay trong checklist hôm nay. */
export const removeCareTask = (id: string) => http.del<void>(`/horse-care-tasks/${id}`);

/* ===== Checklist hằng ngày ===== */

/** Kết quả sinh lại checklist hôm nay: số checklist vừa sinh và các ngựa vẫn lỗi. */
export interface RegenerateChecklistResult {
  date: string;
  generated: number;
  failures: { horseId: string; horseName: string; message: string }[];
}

/**
 * Chỉ Quản lý CLB. Sinh checklist hôm nay cho ngựa có Groom mà còn thiếu, checklist đã có giữ nguyên.
 * BE cũng tự thử lại khi lỗi và báo Quản lý CLB (thông báo DAILY_CHECKLIST không kèm ngựa).
 */
export const regenerateTodayChecklists = () => http.post<RegenerateChecklistResult>('/daily-checklists/regenerate-today');

/**
 * Tối đa 31 ngày. Xem không tạo checklist: BE tạo sẵn lúc 00:05 (và khi khởi động) cho mọi ngựa đang có Groom,
 * tạo thêm khi giao Groom trong ngày hoặc khi gắn việc từ hôm nay. Ngựa không có việc thì không có dòng.
 * Ngày đã qua mà chưa xong thì BE chuyển "Không hoàn thành".
 */
export const listChecklists = (horseId: string, from: string, to: string) => http.get<DailyChecklist[]>(`/horses/${horseId}/checklists`, { from, to });
/** Groom được giao tick hoặc gỡ tick, chỉ trong ngày. `note: null` để xóa ghi chú, bỏ trống để giữ. Trả về cả checklist. */
export const tickChecklistItem = (itemId: string, done: boolean, note?: string | null) =>
  http.patch<DailyChecklist>(`/checklist-items/${itemId}`, note === undefined ? { done } : { done, note });

/** Màn Hôm nay của Groom: mọi ngựa đang phụ trách. checklist là null khi hôm nay ngựa không có việc. Chỉ có lượt tập còn phải dắt. */
export const getGroomToday = () => http.get<GroomToday>('/grooms/me/today');

/* ===== Sự cố tại chuồng ===== */

/** Quản lý CLB, bác sĩ thấy tất cả. HLV thấy ngựa đang ở khu mình. Groom thấy sự cố mình báo. Mới nhất trước. */
export const listIncidents = (query: { status?: IncidentStatus; horseId?: string; barnId?: string } = {}) => fetchAll<Incident>('/incidents', query);
/** Chỉ đếm (Tổng quan). */
export const countIncidents = async (query: { status?: IncidentStatus; barnId?: string } = {}) =>
  (await http.get<Page<Incident>>('/incidents', { ...query, limit: 1 })).meta.total;
export const getIncident = (id: string) => http.get<Incident>(`/incidents/${id}`);
/** Groom báo cho ngựa mình phụ trách. Khẩn thì BE tạo ngay yêu cầu khám khẩn và báo mọi bác sĩ. */
export const reportIncident = (input: { horseId: string; description: string; urgent: boolean; photoMediaId?: string }) => http.post<Incident>('/incidents', input);
/** HLV khu chuyển bác sĩ: tạo yêu cầu khám gắn sự cố. Mỗi sự cố một lần. */
export const referIncident = (id: string, urgent: boolean) => http.post<Incident>(`/incidents/${id}/refer`, { urgent });
/** HLV khu đóng sự cố kèm kết quả xử lý. Yêu cầu khám còn chờ thì 409. */
export const resolveIncident = (id: string, resolution: string) => http.post<Incident>(`/incidents/${id}/resolve`, { resolution });
