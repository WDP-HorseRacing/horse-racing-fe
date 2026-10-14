// Lọc bảng điều khiển y tế ở FE. BE đã giới hạn Head Trainer theo khu mình, ở đây chỉ còn bộ lọc sức khỏe.
import type { HealthStatus, MedicalDashboard } from '../../../api/types';

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
