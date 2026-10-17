// Báo cáo của BE. Kỳ from, to là 'YYYY-MM-DD' theo lịch CLB, lấy trọn cả hai ngày.
// Bỏ trống to là hôm nay, bỏ trống from là 30 ngày tính tới to. from sau to thì BE trả 400.
// Tiền là số nguyên đồng. Nhịp tim làm tròn số nguyên, tốc độ m/s. Không có số đo thì null.
import { http } from './http';
import type {
  BodyRegion,
  CaseStatus,
  HealthStatus,
  InjuryType,
  LockStatus,
  MeasurementType,
  ParticipantStatus,
  RecoveryStatus,
  TrainingIntensity,
  TrainingSessionType,
} from './types';

export interface ReportPeriod {
  from?: string;
  to?: string;
}

export type IntensityCounts = Record<TrainingIntensity, number>;

/** Một tuần (bắt đầu thứ Hai). BE chỉ trả tuần có lượt hoàn thành hoặc có số đo. */
export interface ReportWeek {
  weekStart: string;
  completed: number;
  avgHeartRateBpm: number | null;
  avgSpeedMps: number | null;
  alertCount: number;
}

/* ===== Tổng quan huấn luyện (Quản lý CLB, HLV, bác sĩ) ===== */

export interface TrainingDashboard {
  from: string;
  to: string;
  herd: { total: number; byHealthStatus: Record<HealthStatus, number>; trainingLocked: number };
  training: { sessions: number; completed: number; absent: number; ineligible: number; completedByIntensity: IntensityCounts };
  weekly: ReportWeek[];
  horses: {
    horseId: string;
    horseName: string;
    barnId: string | null;
    barnName: string | null;
    healthStatus: HealthStatus;
    trainingLocked: boolean;
    completed: number;
    avgHeartRateBpm: number | null;
    maxHeartRateBpm: number | null;
    avgSpeedMps: number | null;
    maxSpeedMps: number | null;
    alertCount: number;
    latestWeightKg: number | null;
  }[];
}

/** Chỉ ngựa đang hoạt động. barnId: một khu. mine: các khu người gọi phụ trách (HLV). Mặc định toàn CLB. */
export const getTrainingDashboard = (query: ReportPeriod & { barnId?: string; mine?: boolean }) =>
  http.get<TrainingDashboard>('/reports/dashboard', { ...query, mine: query.mine ? 'true' : undefined });

/* ===== Báo cáo một ngựa (Quản lý CLB, HLV, bác sĩ, chủ ngựa) ===== */

export interface HorseProgress {
  horseId: string;
  horseName: string;
  from: string;
  to: string;
  totals: { completed: number; absent: number; ineligible: number; plannedDistanceM: number; trainedMinutes: number; completedByIntensity: IntensityCounts };
  weekly: ReportWeek[];
  sessions: {
    participantId: string;
    sessionId: string;
    sessionName: string;
    scheduledStartAt: string;
    sessionType: TrainingSessionType;
    intensity: TrainingIntensity;
    plannedDistanceM: number;
    status: ParticipantStatus;
    avgHeartRateBpm: number | null;
    maxHeartRateBpm: number | null;
    avgSpeedMps: number | null;
    maxSpeedMps: number | null;
    alertCount: number;
    evaluation: { score: number; comment: string | null } | null;
    bestTrialMs: number | null;
  }[];
}

export interface HorseHealthReport {
  horseId: string;
  horseName: string;
  from: string;
  to: string;
  currentHealthStatus: HealthStatus;
  statusChanges: { changedAt: string; from: HealthStatus | null; to: HealthStatus; reason: string | null }[];
  measurements: { type: MeasurementType; value: number; measuredAt: string; isAbnormal: boolean }[];
  medicalCases: { caseId: string; status: CaseStatus; openedAt: string; closedAt: string | null; initialDiagnosis: string; finalConclusion: string | null }[];
  injuries: { examDate: string; bodyRegion: BodyRegion; injuryType: InjuryType; recoveryStatus: RecoveryStatus }[];
  trainingLocks: { lockId: string; status: LockStatus; reason: string; lockStart: string; lockEnd: string | null; releasedAt: string | null }[];
}

/** Ngựa ngoài phạm vi xem hoặc không có: 404. */
export const getHorseProgress = (horseId: string, period: ReportPeriod) => http.get<HorseProgress>(`/reports/horses/${horseId}/progress`, { ...period });
export const getHorseHealthReport = (horseId: string, period: ReportPeriod) => http.get<HorseHealthReport>(`/reports/horses/${horseId}/health`, { ...period });

/* ===== Tài chính (Quản lý CLB) và chi phí chủ ngựa ===== */

export interface ClubFinance {
  from: string;
  to: string;
  /** Khoản CLB thu của chủ: phí nuôi + phụ phí riêng từng ngựa + chi phí y tế (bệnh án đóng trong kỳ). */
  ownerCharges: { dailyFee: number; surcharge: number; medicalCost: number; total: number };
  /** purchased: giá trị nhập hàng trong kỳ (không gồm tồn ban đầu). used: giá trị đã xuất dùng. */
  supplies: { purchased: number; used: number };
  /** Luôn 0 (chưa có giải đua). */
  prizeMoney: number;
  owners: { ownerId: string; ownerName: string; dailyFee: number; surcharge: number; medicalCost: number; total: number }[];
  /**
   * Phần không có chủ: ngày ngựa ở CLB mà lúc hết ngày không có chủ (sau kích hoạt lại, khôi phục hồ sơ khi chủ cũ không còn hoạt động)
   * và bệnh án đóng lúc ngựa không có chủ. `ownerCharges` = tổng `owners` + `unowned`. Không có thì các số bằng 0.
   */
  unowned: { billedDays: number; dailyFee: number; surcharge: number; medicalCost: number; total: number };
}

export interface OwnerCosts {
  ownerId: string;
  ownerName: string;
  from: string;
  to: string;
  dailyFee: number;
  /** Phụ phí riêng từng ngựa, đã cộng vào total. */
  surcharge: number;
  medicalCost: number;
  total: number;
  prizeMoney: number;
  horses: { horseId: string; horseName: string; billedDays: number; dailyFee: number; surcharge: number; caseCount: number; medicalCost: number; total: number }[];
}

export const getClubFinance = (period: ReportPeriod) => http.get<ClubFinance>('/reports/club/finance', { ...period });
/** Quản lý CLB phải gửi ownerId. Chủ ngựa luôn nhận của chính mình, BE bỏ qua ownerId. */
export const getOwnerCosts = (query: ReportPeriod & { ownerId?: string }) => http.get<OwnerCosts>('/reports/owner/costs', { ...query });
