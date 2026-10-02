// Chuyển dữ liệu API sang dạng biểu đồ cho trang Tổng quan. BE chưa có API gom theo tháng/tuần,
// nên chi phí theo tháng gọi cost-report từng tháng, yêu cầu khám theo tuần gom từ createdAt ở FE.
import type { BarnListItem, CheckupItem, ExamRequest, HealthStatus, Stall } from '../../api/types';
import type { DonutSegment } from '../../components/charts/DonutChart';
import type { BarRow, BarSeries } from '../../components/charts/StackedBars';
import type { Column } from '../../components/charts/ColumnChart';
import { healthLabel } from '../../lib/labels';
import { toDateKey } from '../../lib/format';
import { now } from '../../lib/clock';

/** Màu trạng thái sức khỏe (đã kiểm bằng validator dataviz; luôn đi kèm nhãn + số). */
export const HEALTH_COLORS: Record<HealthStatus, string> = {
  ELIGIBLE: '#10b981',
  UNDER_OBSERVATION: '#f59e0b',
  INJURED: '#ef4444',
  QUARANTINED: '#9f1239',
};
const HEALTH_ORDER: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];

export function healthSegments(counts: Record<HealthStatus, number>): DonutSegment[] {
  return HEALTH_ORDER.map((status) => ({ key: status, label: healthLabel[status], value: counts[status] ?? 0, color: HEALTH_COLORS[status] }));
}

export function countHealth(items: { healthStatus: HealthStatus }[]): Record<HealthStatus, number> {
  const counts = { ELIGIBLE: 0, UNDER_OBSERVATION: 0, INJURED: 0, QUARANTINED: 0 } as Record<HealthStatus, number>;
  items.forEach((item) => {
    counts[item.healthStatus] += 1;
  });
  return counts;
}

/* ===== Công suất chuồng ===== */

export const OCCUPANCY_SERIES: BarSeries[] = [
  { key: 'occupied', label: 'Có ngựa', color: '#059669' },
  { key: 'available', label: 'Còn trống', color: '#a7f3d0' },
  { key: 'maintenance', label: 'Bảo trì', color: '#9ca3af', striped: true },
];

export function occupancyRows(barns: BarnListItem[], stalls: Stall[], onOpen?: (barnId: string) => void): BarRow[] {
  return [...barns]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
    .map((barn) => {
      const own = stalls.filter((stall) => stall.barnId === barn.id);
      const occupied = own.filter((stall) => stall.status === 'OCCUPIED').length;
      return {
        key: barn.id,
        label: barn.name,
        values: {
          occupied,
          available: own.filter((stall) => stall.status === 'AVAILABLE').length,
          maintenance: own.filter((stall) => stall.status === 'MAINTENANCE').length,
        },
        note: barn.pendingStallHorseCount > 0 ? `${occupied}/${own.length} ô · ${barn.pendingStallHorseCount} ngựa chờ ô` : `${occupied}/${own.length} ô`,
        onClick: onOpen ? () => onOpen(barn.id) : undefined,
      };
    });
}

export function occupancyRate(stalls: Stall[]) {
  const usable = stalls.filter((stall) => stall.status !== 'MAINTENANCE').length;
  const occupied = stalls.filter((stall) => stall.status === 'OCCUPIED').length;
  return { usable, occupied, rate: usable ? Math.round((occupied / usable) * 100) : 0 };
}

/* ===== Khám định kỳ ===== */

export function checkupSegments(items: CheckupItem[]): DonutSegment[] {
  return [
    { key: 'OK', label: 'Đúng hạn', value: items.filter((item) => item.dueStatus === 'OK').length, color: '#10b981' },
    { key: 'DUE_SOON', label: 'Sắp đến hạn', value: items.filter((item) => item.dueStatus === 'DUE_SOON').length, color: '#f59e0b' },
    { key: 'OVERDUE', label: 'Quá hạn', value: items.filter((item) => item.dueStatus === 'OVERDUE').length, color: '#ef4444' },
  ];
}

/* ===== Theo thời gian ===== */

export interface MonthRange {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** n tháng gần nhất (cũ → mới), mỗi tháng một khoảng from–to. */
export function lastMonths(n: number): MonthRange[] {
  const today = now();
  return Array.from({ length: n }, (_, index) => {
    const start = new Date(today.getFullYear(), today.getMonth() - (n - 1 - index), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return {
      key: `${start.getFullYear()}-${start.getMonth() + 1}`,
      label: `T${start.getMonth() + 1}`,
      from: toDateKey(start),
      to: toDateKey(end > today ? today : end),
    };
  });
}

/** Yêu cầu khám n tuần gần nhất (cũ → mới), mỗi cột một tuần bắt đầu từ thứ Hai. */
export function weeklyRequests(requests: ExamRequest[], n = 8): Column[] {
  const today = now();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: n }, (_, index) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (n - 1 - index));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const inWeek = requests.filter((item) => {
      const at = new Date(item.createdAt);
      return at >= start && at < end;
    });
    const urgent = inWeek.filter((item) => item.urgent).length;
    const alerts = inWeek.filter((item) => item.source === 'MEASUREMENT_ALERT').length;
    return {
      key: toDateKey(start),
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      value: inWeek.length,
      detail: inWeek.length ? `${urgent} khẩn · ${alerts} cảnh báo chỉ số` : 'Không có yêu cầu',
    };
  });
}

/** Số tiền gọn cho trục: 1,2 tr / 350 k. */
export function compactMoney(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k`;
  return String(value);
}
