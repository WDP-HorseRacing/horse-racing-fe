// Flow 2 — nhịp tim, tốc độ của lượt tập, ngưỡng của ngựa, lịch sử cảnh báo, khối lượng tập.
// Tốc độ BE trả dạng chuỗi 3 chữ số thập phân: đổi sang number ngay ở đây.
import { http } from './http';
import type {
  HorseAlert,
  HorseThresholds,
  HorseWorkload,
  MetricAlertLevel,
  MetricPoint,
  Page,
  ParticipantSummary,
  SessionPerformanceSummary,
  ThresholdInput,
  ThresholdProfile,
} from './types';

const num = (value: unknown) => Number(value ?? 0);
const numOrNull = (value: unknown) => (value === null || value === undefined ? null : Number(value));

export const toMetricPoint = (point: MetricPoint): MetricPoint => ({ ...point, heartRateBpm: num(point.heartRateBpm), speedMps: num(point.speedMps) });

/** Điểm đo của một lượt, cũ trước. Chủ ngựa không gọi được (403). */
export const listMetrics = async (participantId: string) =>
  (await http.get<MetricPoint[]>(`/session-participants/${participantId}/metrics`)).map(toMetricPoint);

/** Tổng kết lượt tập, kể cả chủ ngựa xem được. */
export const getParticipantSummary = async (participantId: string): Promise<ParticipantSummary> => {
  const row = await http.get<ParticipantSummary>(`/session-participants/${participantId}/performance-summary`);
  return { ...row, avgSpeedMps: numOrNull(row.avgSpeedMps), maxSpeedMps: numOrNull(row.maxSpeedMps) };
};

/** Tổng kết từng buổi của ngựa (tối đa 100 buổi), để vẽ xu hướng thể lực. */
export const listSessionSummaries = async (horseId: string) =>
  (await http.get<SessionPerformanceSummary[]>(`/horses/${horseId}/performance/sessions`)).map((row) => ({
    ...row,
    avgSpeedMps: num(row.avgSpeedMps),
    maxSpeedMps: num(row.maxSpeedMps),
  }));

export const listHorseAlerts = async (
  horseId: string,
  query: { level?: Exclude<MetricAlertLevel, 'NORMAL'>; from?: string; to?: string; page?: number; limit?: number } = {},
) => {
  const page = await http.get<Page<HorseAlert>>(`/horses/${horseId}/alerts`, query);
  return { ...page, items: page.items.map((item) => ({ ...item, speedMps: num(item.speedMps) })) };
};

export const getWorkload = (horseId: string, range: { from?: string; to?: string } = {}) =>
  http.get<HorseWorkload>(`/horses/${horseId}/workload`, range);

export const getThresholds = (horseId: string) => http.get<HorseThresholds>(`/horses/${horseId}/thresholds`);
/** Mỗi lần gọi tạo một phiên bản ngưỡng mới. Chỉ HLV của khu chứa ngựa. */
export const setThresholds = (horseId: string, input: ThresholdInput) => http.put<ThresholdProfile>(`/horses/${horseId}/thresholds`, input);

/** Mặc định CLB khi ngựa chưa có ngưỡng riêng (khớp BE). */
export const CLUB_DEFAULT_LIMITS = { heartRateWarningBpm: 220, heartRateCriticalBpm: 240, maxSpeedMps: 18 };
