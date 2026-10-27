import { useService } from '../../../hooks/useService';
import { listGroomHistory } from '../../../api/stable';
import type { PlacementHorse } from './PlacementDialogs';

/**
 * Groom đang phụ trách một con ngựa: lấy `groomId` có sẵn, không có thì tra lịch sử phân công
 * (dòng chưa kết thúc). Sơ đồ chuồng không mang Groom theo ngựa nên phải tra; gỡ khỏi ô vẫn giữ Groom.
 * `ready` chỉ đúng khi dữ liệu là của đúng con ngựa đang mở (tránh hiện dữ liệu ngựa trước).
 */
export function useCurrentGroom(horse: PlacementHorse | null) {
  const result = useService(async () => {
    if (!horse) return { horseId: undefined, groom: null };
    if (horse.groomId) return { horseId: horse.id, groom: { id: horse.groomId, fullName: horse.groomName ?? 'Groom' } };
    const history = await listGroomHistory(horse.id).catch(() => []);
    const active = history.find((item) => !item.endAt);
    return { horseId: horse.id, groom: active ? { id: active.groomId, fullName: active.groom?.fullName ?? 'Groom' } : null };
  }, [horse?.id, horse?.groomId]);
  const ready = !!horse && !result.loading && result.data?.horseId === horse.id;
  return { ready, groom: ready ? (result.data?.groom ?? null) : null };
}
