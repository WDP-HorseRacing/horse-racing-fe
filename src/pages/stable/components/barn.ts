import type { BarnListItem, HealthStatus, HorseListItem, Stall } from '../../../api/types';

/**
 * Số ô tối đa của một khu. Sơ đồ mỗi khu là lưới 3×3 nên giao diện chặn tạo quá 9 ô.
 * Backend chưa có luật này; khi có thì đổi hằng số (hoặc lấy từ API) ở đây.
 */
export const MAX_STALLS_PER_BARN = 9;

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

/* ===== Dữ liệu cho sơ đồ khu (ZoneBoard) ===== */

/** Ngựa trong một ô — dạng chung cho sơ đồ chuồng, Tổng quan và Bảng điều khiển y tế. */
export interface StallOccupant {
  id: string;
  name: string;
  photoUrl?: string | null;
  healthStatus: HealthStatus;
  retired?: boolean;
  /** Đang có lệnh khóa huấn luyện của bác sĩ. */
  locked?: boolean;
  /** Chẩn đoán của bệnh án đang mở (màn y tế). */
  openCase?: string;
}

export interface ZoneCell {
  stall: Stall;
  occupant?: StallOccupant;
  /** Ô có ngựa nhưng ngựa không khớp bộ lọc đang chọn: vẽ mờ, không ghi "Trống". */
  filtered?: boolean;
}

/** Ngựa đang hoạt động, đủ điều kiện sức khỏe mà không được đua ⇒ đang bị khóa huấn luyện. */
export const isLockedHorse = (horse: HorseListItem) => horse.lifecycleStatus === 'ACTIVE' && horse.healthStatus === 'ELIGIBLE' && !horse.canRegisterRace;

export function occupantFromHorse(horse: HorseListItem): StallOccupant {
  return {
    id: horse.id,
    name: horse.name,
    photoUrl: horse.photoUrl,
    healthStatus: horse.healthStatus,
    retired: horse.lifecycleStatus === 'RETIRED',
    locked: isLockedHorse(horse),
  };
}

/** Ghép ô của một khu với ngựa đang ở (Stall không có thông tin ngựa, nối qua id ô). Sắp theo mã ô. */
export function buildCells(barnId: string, stalls: Stall[], occupantByStall: Map<string, StallOccupant>): ZoneCell[] {
  return stalls
    .filter((stall) => stall.barnId === barnId)
    .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
    .map((stall) => {
      const occupant = occupantByStall.get(stall.id);
      return { stall, occupant, filtered: !occupant && stall.status === 'OCCUPIED' };
    });
}

/** Ngựa đang ở câu lạc bộ, đánh chỉ mục theo id ô. */
export function occupantsByStall(horses: HorseListItem[]): Map<string, StallOccupant> {
  return new Map(
    horses
      .filter((horse) => !horse.isDeleted && horse.lifecycleStatus !== 'TRANSFERRED' && horse.location.stall?.id)
      .map((horse) => [horse.location.stall!.id!, occupantFromHorse(horse)]),
  );
}
