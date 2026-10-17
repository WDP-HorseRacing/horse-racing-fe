// Kiểu dữ liệu Flow 4 (chăm sóc chuồng, dinh dưỡng, vật tư) đúng như backend trả về, xuất lại qua api/types.ts.
// Số lượng gửi và nhận đều là số JSON.
// Ngày thuần (checklist, việc riêng) là 'YYYY-MM-DD' theo lịch CLB.
import type { CareType, ExamRequestStatus } from './types';
import type { ParticipantStatus } from './training-types';

/** Người làm, người duyệt… BE chỉ trả id và họ tên (vật tư trả thêm email, FE không dùng). */
export interface UserBrief {
  id: string;
  fullName: string;
}

/* ===== Vật tư (kho chung CLB) ===== */

export type SupplyCategory = 'FEED' | 'SUPPLEMENT' | 'MEDICINE' | 'EQUIPMENT';

export interface SupplyItem {
  id: string;
  name: string;
  category: SupplyCategory;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  /** Tồn nhỏ hơn hoặc bằng ngưỡng báo thiếu. */
  lowStock: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyItemInput {
  name: string;
  category: SupplyCategory;
  unit: string;
  reorderThreshold: number;
  /** Chỉ khi thêm. Sửa vật tư không đổi được tồn, phải nhập hàng hoặc xuất dùng. */
  quantityOnHand?: number;
  /** Đơn giá (đồng, số nguyên) của tồn ban đầu. Bỏ trống là 0. */
  openingUnitPrice?: number;
}

/**
 * OPENING: tồn ban đầu. RESTOCK: nhập hàng hoặc cấp theo đề xuất. USAGE: xuất dùng.
 * USAGE_REVERSAL: hủy một lần xuất ghi nhầm (số dương, ghi chú là lý do). COUNT_ADJUST: kiểm kê, chỉ còn ở dữ liệu cũ.
 */
export type SupplyMovementType = 'OPENING' | 'RESTOCK' | 'USAGE' | 'USAGE_REVERSAL' | 'COUNT_ADJUST';

export interface SupplyMovement {
  id: string;
  itemId: string;
  delta: number;
  balanceAfter: number;
  type: SupplyMovementType;
  requestId: string | null;
  /** Lô của dòng. Ba trường lô là null với dòng ghi trước khi có lô. */
  lotId: string | null;
  /** Đơn giá của lô (đồng). */
  unitPrice: number | null;
  /** Tiền của dòng = chênh lệch × đơn giá, âm là xuất. */
  amount: number | null;
  /** Mã lần xuất: chung cho các dòng USAGE của một lần xuất (trừ nhiều lô) và dòng USAGE_REVERSAL hủy nó. null với dòng xuất cũ (không hủy được). */
  usageId: string | null;
  /** true ở dòng USAGE của lần xuất đã hủy. */
  cancelled: boolean;
  note: string | null;
  creator: UserBrief;
  createdAt: string;
}

/** Một lần nhập (tồn ban đầu, nhập hàng, cấp theo đề xuất). Xuất dùng trừ lô cũ trước. */
export interface SupplyLot {
  id: string;
  quantity: number;
  remaining: number;
  unitPrice: number;
  createdAt: string;
}

export type SupplyRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';

export interface SupplyRequest {
  id: string;
  itemId: string;
  /** Vật tư đầy đủ, kể cả khi đã xóa (deletedAt khác null). */
  item: SupplyItem;
  requestedBy: string;
  requester: UserBrief;
  quantity: number;
  status: SupplyRequestStatus;
  note: string | null;
  reviewer: UserBrief | null;
  reviewedAt: string | null;
  fulfiller: UserBrief | null;
  fulfilledAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ===== Khẩu phần (theo từng ngựa) ===== */

export type FeedingMeal = 'EARLY_MORNING' | 'NOON' | 'AFTERNOON' | 'EVENING';
export type FeedingPlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface FeedingPlanLine {
  supplyItemId: string;
  name: string;
  category: SupplyCategory;
  unit: string;
  quantity: number;
  note: string | null;
}

export interface FeedingPlanMeal {
  meal: FeedingMeal;
  items: FeedingPlanLine[];
}

export interface FeedingPlan {
  id: string;
  horseId: string;
  horseName: string;
  status: FeedingPlanStatus;
  note: string | null;
  creator: UserBrief;
  /** HLV bấm Áp dụng (route BE tên `approve`). */
  approver: UserBrief | null;
  /** Bắt đầu áp dụng. */
  approvedAt: string | null;
  /** Hết áp dụng (khi bản mới được áp dụng). */
  archivedAt: string | null;
  /** Theo thứ tự Sáng sớm, Trưa, Chiều, Tối. Bữa không có món bị bỏ. */
  meals: FeedingPlanMeal[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedingPlanItemInput {
  meal: FeedingMeal;
  supplyItemId: string;
  quantity: number;
  note?: string;
}

/* ===== Loại việc, việc riêng, checklist hằng ngày ===== */

/** Danh mục việc chăm sóc (Cho ăn, Vệ sinh chuồng…). Tên khác `CareTaskType` của lịch chăm sóc Flow 3. */
export interface ChecklistTaskType {
  id: string;
  name: string;
  /** Có trong checklist của mọi ngựa mỗi ngày. */
  appliesToAll: boolean;
  active: boolean;
}

/** EXTRA: gắn thêm loại việc không áp mọi ngựa. EXEMPT: miễn loại việc đang áp mọi ngựa (lý do ở `note`). */
export type HorseCareTaskMode = 'EXTRA' | 'EXEMPT';

export interface HorseCareTask {
  id: string;
  horseId: string;
  mode: HorseCareTaskMode;
  taskType: ChecklistTaskType;
  fromDate: string;
  toDate: string;
  note: string | null;
  creator: UserBrief;
  createdAt: string;
}

export type ChecklistStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'INCOMPLETE';

export interface ChecklistItem {
  id: string;
  taskTypeId: string;
  name: string;
  done: boolean;
  doneAt: string | null;
  doer: UserBrief | null;
  note: string | null;
}

export interface DailyChecklist {
  id: string;
  horseId: string;
  horseName: string;
  checklistDate: string;
  status: ChecklistStatus;
  groom: UserBrief;
  completedAt: string | null;
  items: ChecklistItem[];
}

/* ===== Màn Hôm nay của Groom ===== */

export interface GroomTodayRun {
  participantId: string;
  sessionId: string;
  sessionName: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: ParticipantStatus;
}

export interface GroomTodayCare {
  id: string;
  type: CareType;
  dueAt: string;
  overdue: boolean;
  notes: string | null;
}

export interface GroomTodayHorse {
  horseId: string;
  horseName: string;
  barnName: string | null;
  stallCode: string | null;
  /** null khi ngày đó không có việc nào áp cho ngựa. */
  checklist: DailyChecklist | null;
  feedingPlan: FeedingPlan | null;
  trainingRuns: GroomTodayRun[];
  careSchedules: GroomTodayCare[];
}

/** Lịch chăm sóc giao đích danh cho Groom ở ngựa Groom không phụ trách (vd Groom chuyên làm móng). */
export interface GroomTodayOtherCare extends GroomTodayCare {
  horseId: string;
  horseName: string;
}

export interface GroomToday {
  date: string;
  horses: GroomTodayHorse[];
  otherCareSchedules: GroomTodayOtherCare[];
}

/* ===== Sự cố tại chuồng ===== */

export type IncidentStatus = 'OPEN' | 'RESOLVED';

export interface IncidentExamRequest {
  id: string;
  status: ExamRequestStatus;
  urgent: boolean;
  handledAt: string | null;
  dismissReason: string | null;
}

export interface Incident {
  id: string;
  horseId: string;
  horseName: string;
  description: string;
  /** Theo yêu cầu khám của sự cố. Chưa chuyển bác sĩ thì false. */
  urgent: boolean;
  status: IncidentStatus;
  /** Link xem có hạn (15 phút). */
  photoUrl: string | null;
  reporter: UserBrief;
  resolution: string | null;
  resolver: UserBrief | null;
  /** Hệ thống tự đóng khi ngựa chuyển nhượng hoặc đã mất. Lúc đó `resolver` là null. */
  resolvedBySystem: boolean;
  resolvedAt: string | null;
  examRequest: IncidentExamRequest | null;
  createdAt: string;
}
