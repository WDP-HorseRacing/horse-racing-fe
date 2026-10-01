// Thông tin thêm cho chế độ phóng to một khu: Groom, khóa huấn luyện (từ hồ sơ từng ngựa, tối đa 9 con)
// và chẩn đoán của bệnh án đang mở (bảng điều khiển y tế lọc theo khu). Danh sách ngựa không có các trường này.
import { getHorse } from '../../../api/horses';
import { getMedicalDashboard } from '../../../api/medical';

export interface OccupantDetail {
  groomName?: string;
  locked?: boolean;
  openCase?: string;
}

export async function loadZoneDetail(barnId: string, horseIds: string[], withCases: boolean): Promise<Map<string, OccupantDetail>> {
  const [horses, dashboard] = await Promise.all([
    Promise.all(horseIds.map((id) => getHorse(id).catch(() => null))),
    withCases ? getMedicalDashboard({ barnId }).catch(() => null) : Promise.resolve(null),
  ]);
  const cases = new Map((dashboard?.openCases ?? []).map((item) => [item.horseId, item.initialDiagnosis]));
  const detail = new Map<string, OccupantDetail>();
  horseIds.forEach((id, index) => {
    const horse = horses[index];
    detail.set(id, { groomName: horse?.groom?.fullName, locked: horse?.activeTrainingLock, openCase: cases.get(id) });
  });
  return detail;
}
