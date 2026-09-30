// Danh sách ngựa để chọn trong các biểu mẫu y tế, theo phạm vi của vai trò.
// Chỉ ngựa ACTIVE và RETIRED (ngựa đã chuyển nhượng chỉ còn xem được).
import { useMemo } from 'react';
import { listAllHorses } from '../../../api/horses';
import type { HorseListItem, HorseListQuery } from '../../../api/types';
import { useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';

export type HorseScope = 'all' | 'myBarns' | 'myHorses';

export async function listMedicalHorses(scope: HorseScope = 'all'): Promise<HorseListItem[]> {
  const base: Omit<HorseListQuery, 'page' | 'limit'> = scope === 'myBarns' ? { myBarns: true } : scope === 'myHorses' ? { myHorses: true } : {};
  const [active, retired] = await Promise.all([
    listAllHorses({ ...base, lifecycleStatus: 'ACTIVE' }),
    listAllHorses({ ...base, lifecycleStatus: 'RETIRED' }),
  ]);
  return [...active, ...retired].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/** Phạm vi gửi yêu cầu khám: HT theo khu phụ trách, Groom theo ngựa được giao, VET/CM toàn CLB. */
export function useRequestScope(): HorseScope {
  const role = useStore((state) => state.currentUser?.role);
  if (role === 'HEAD_TRAINER') return 'myBarns';
  if (role === 'GROOM') return 'myHorses';
  return 'all';
}

export function useMedicalHorses(scope: HorseScope, enabled = true) {
  const result = useService(() => (enabled ? listMedicalHorses(scope) : Promise.resolve([])), [scope, enabled]);
  const byId = useMemo(() => new Map((result.data ?? []).map((horse) => [horse.id, horse])), [result.data]);
  return { ...result, byId };
}

/** "Khu A · SD-A05" hoặc trạng thái vòng đời. */
export function horsePlace(horse: Pick<HorseListItem, 'location' | 'lifecycleStatus'>): string {
  const parts = [horse.location.barn?.name, horse.location.stall?.code].filter(Boolean);
  if (horse.lifecycleStatus === 'RETIRED') parts.push('đã giải nghệ');
  return parts.join(' · ');
}
