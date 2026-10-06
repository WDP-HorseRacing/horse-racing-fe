import type { BarnListItem, HealthStatus, HorseListItem, Stall } from '../../../api/types';
import { healthLabel } from '../../../lib/labels';
import { isReadOnlyHorse } from '../../../lib/horse-rules';

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
      .filter((horse) => !isReadOnlyHorse(horse) && horse.location.stall?.id)
      .map((horse) => [horse.location.stall!.id!, occupantFromHorse(horse)]),
  );
}

/** Màu vạch tình trạng của ô có ngựa (lưới khu và chế độ phóng to). */
export function occupantBarClass(occupant: StallOccupant) {
  if (occupant.retired) return 'bg-gray-300';
  if (occupant.healthStatus === 'QUARANTINED') return 'border-2 border-red-500 bg-white';
  if (occupant.locked || occupant.healthStatus === 'INJURED') return 'bg-red-500';
  if (occupant.healthStatus === 'UNDER_OBSERVATION') return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function occupantStatusText(occupant: StallOccupant) {
  if (occupant.retired) return 'Đã giải nghệ';
  if (occupant.locked) return 'Khóa huấn luyện';
  return healthLabel[occupant.healthStatus];
}

/* ===== Số ô thêm được ===== */

/**
 * Số ô tối đa của khu = sức chứa (BE chặn tạo ô khi số ô ≥ sức chứa) nhưng không quá 9 (lưới 3×3).
 * Khu không đặt sức chứa thì tối đa 9.
 */
export function stallLimit(barn: Pick<BarnListItem, 'capacity'>) {
  return Math.min(MAX_STALLS_PER_BARN, barn.capacity ?? MAX_STALLS_PER_BARN);
}

/** Số ô còn thêm được vào khu đang có `count` ô. */
export function stallRoom(barn: Pick<BarnListItem, 'capacity'>, count: number) {
  return Math.max(0, stallLimit(barn) - count);
}

/** Lý do không thêm được ô (để ghi vào nhãn nút / menu), hoặc undefined nếu còn thêm được. */
export function stallFullReason(barn: Pick<BarnListItem, 'capacity'>, count: number) {
  if (stallRoom(barn, count) > 0) return undefined;
  return barn.capacity !== null && barn.capacity < MAX_STALLS_PER_BARN ? `đã đạt sức chứa ${barn.capacity} ô` : `đã đủ ${MAX_STALLS_PER_BARN} ô`;
}
