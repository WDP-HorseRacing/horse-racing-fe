// Giới hạn bảng điều khiển y tế cho Head Trainer: BE trả toàn câu lạc bộ, FE chỉ giữ ngựa thuộc các khu
// HT được xem (khu mình phụ trách + khu cách ly). Mọi khối khác lọc theo tập ngựa đó; số đếm tính lại.
import type { HealthStatus, MedicalDashboard } from '../../../api/types';

export function scopeDashboard(dashboard: MedicalDashboard, barnIds: ReadonlySet<string>, health?: HealthStatus | ''): MedicalDashboard {
  const inScope = dashboard.herd.horses.filter((horse) => !!horse.barnId && barnIds.has(horse.barnId));
  const counts = { ELIGIBLE: 0, UNDER_OBSERVATION: 0, INJURED: 0, QUARANTINED: 0 } as Record<HealthStatus, number>;
  inScope.forEach((horse) => {
    counts[horse.healthStatus] += 1;
  });
  // Bộ lọc sức khỏe áp ở FE (gọi BE không kèm healthStatus để số đếm từng tab vẫn đúng).
  const horses = health ? inScope.filter((horse) => horse.healthStatus === health) : inScope;
  const ids = new Set(horses.map((horse) => horse.horseId));
  return {
    herd: { counts, horses },
    checkups: dashboard.checkups.filter((item) => ids.has(item.horseId)),
    careSchedules: dashboard.careSchedules.filter((item) => ids.has(item.horseId)),
    openCases: dashboard.openCases.filter((item) => ids.has(item.horseId)),
    pendingRequests: dashboard.pendingRequests.filter((item) => ids.has(item.horseId)),
  };
}

/** Lọc theo một trạng thái sức khỏe ở FE: số đếm giữ nguyên (để biểu đồ vẫn đủ), các khối chỉ giữ ngựa khớp. */
export function filterHealth(dashboard: MedicalDashboard, health?: HealthStatus | ''): MedicalDashboard {
  if (!health) return dashboard;
  const horses = dashboard.herd.horses.filter((horse) => horse.healthStatus === health);
  const ids = new Set(horses.map((horse) => horse.horseId));
  return {
    herd: { counts: dashboard.herd.counts, horses },
    checkups: dashboard.checkups.filter((item) => ids.has(item.horseId)),
    careSchedules: dashboard.careSchedules.filter((item) => ids.has(item.horseId)),
    openCases: dashboard.openCases.filter((item) => ids.has(item.horseId)),
    pendingRequests: dashboard.pendingRequests.filter((item) => ids.has(item.horseId)),
  };
}
