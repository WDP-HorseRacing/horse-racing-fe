import type { BarnListItem } from '../../../api/types';

/**
 * Lý do khu không nhận thêm ngựa (khu nhận được thì trả undefined). Khớp luật backend:
 * khu đang hoạt động, có HT đang hoạt động, còn chỗ = ô trống − ngựa của khu đang chờ xếp ô.
 */
export function barnBlocker(barn: BarnListItem): string | undefined {
  if (barn.status !== 'ACTIVE') return 'Khu không ở trạng thái hoạt động';
  if (!barn.headTrainerId) return 'Khu chưa có HT phụ trách';
  if (!barn.hasActiveHeadTrainer) return 'HT phụ trách không còn hoạt động';
  if (barn.availableStallCount <= 0) {
    return barn.pendingStallHorseCount > 0 ? `Hết chỗ: ${barn.pendingStallHorseCount} ngựa đang chờ xếp ô` : 'Hết ô trống';
  }
  return undefined;
}
