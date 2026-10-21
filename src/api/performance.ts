// Flow 2 — nhịp tim, tốc độ của lượt tập, ngưỡng của câu lạc bộ, lịch sử cảnh báo, khối lượng tập.
import { http, request } from './http';
import type {
  HorseAlert,
  HorseThresholds,
  HorseWorkload,
  MetricAlertLevel,
  MetricPoint,
  Page,
  ParticipantSummary,
  SessionPerformanceSummary,
} from './types';

/** Điểm đo của một lượt (7.200 điểm mới nhất), cũ trước. Chỉ Quản lý CLB, bác sĩ, HLV trưởng gọi được, Groom và chủ ngựa nhận 403. */
export const listMetrics = (participantId: string) => http.get<MetricPoint[]>(`/session-participants/${participantId}/metrics`);

/** Tổng kết lượt tập: Quản lý CLB, bác sĩ, HLV trưởng, chủ ngựa. Groom nhận 403. */
export const getParticipantSummary = (participantId: string) => http.get<ParticipantSummary>(`/session-participants/${participantId}/performance-summary`);

/** Tổng kết từng buổi của ngựa (tối đa 100 buổi), để vẽ xu hướng thể lực. */
export const listSessionSummaries = (horseId: string) => http.get<SessionPerformanceSummary[]>(`/horses/${horseId}/performance/sessions`);

export const listHorseAlerts = (
  horseId: string,
  query: { level?: Exclude<MetricAlertLevel, 'NORMAL'>; from?: string; to?: string; page?: number; limit?: number } = {},
) => http.get<Page<HorseAlert>>(`/horses/${horseId}/alerts`, query);

export const getWorkload = (horseId: string, range: { from?: string; to?: string } = {}) =>
  http.get<HorseWorkload>(`/horses/${horseId}/workload`, range);

/** Ngưỡng áp cho ngựa: mọi ngựa dùng chung ngưỡng câu lạc bộ, không đặt riêng được. HT của khu, CM, bác sĩ. */
export const getThresholds = (horseId: string) => http.get<HorseThresholds>(`/horses/${horseId}/thresholds`);

/** Ngưỡng câu lạc bộ (khớp BE), dùng khi chưa tải được hoặc vai trò không gọi được API ngưỡng. */
export const CLUB_DEFAULT_LIMITS = { heartRateWarningBpm: 220, heartRateCriticalBpm: 240, maxSpeedMps: 18 };

/** Một điểm đo cảm biến gửi lên (tốc độ m/s). */
export interface MetricInput {
  sourceId: string;
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
}

/**
 * Gửi một lô điểm đo cho lượt đang chạy (tối đa 500 điểm). Route này không cần đăng nhập, đúng như thiết bị thật.
 * BE bỏ qua điểm trùng cảm biến và thời điểm đo, nên gửi lại một lô không sinh dữ liệu đôi. Lượt không còn Đang chạy trả 409.
 * BE cũng bỏ điểm vô lý (`skippedInvalid`): tốc độ trên 25 m/s, hoặc thời điểm đo trước lúc bắt đầu lượt quá 5 giây
 * hay sau giờ máy chủ quá 5 giây (đồng hồ máy gửi chạy nhanh).
 */
export const ingestMetrics = (participantId: string, metrics: MetricInput[]) =>
  request<{ accepted: number; skippedDuplicates: number; skippedInvalid: number; highestAlertLevel: MetricAlertLevel }>('POST', `/session-participants/${participantId}/metrics/batch`, {
    body: { metrics },
    auth: false,
  });
