// Phạm vi khu của người xem. Luật đã chốt (BA, 13/10): HLV trưởng làm việc theo khu, tra cứu toàn câu lạc bộ,
// thao tác chỉ khu mình. Từ 18/10 BE trả mọi khu cho HT (`/barns`, bảng điều khiển y tế), kèm bộ lọc `mine=true`.
// Sơ đồ chuồng và bảng điều khiển y tế có công tắc "Khu của tôi" (mặc định bật, lọc theo `visibleBarnIds`), tắt thì xem mọi khu.
// `canManageBarn` chặn thao tác ở khu không do HT phụ trách.
// BE không có loại khu: khu cách ly = khu có ít nhất một ô và mọi ô đều là ô cách ly (chỉ dùng để gắn nhãn).
import type { BarnListItem, Role, Stall } from '../api/types';

export interface ZoneScope {
  /** Người xem là Head Trainer: các trang lọc theo `visibleBarnIds`. */
  trainer: boolean;
  userId: string;
  myBarns: BarnListItem[];
  myBarnIds: ReadonlySet<string>;
  /** Khu cách ly trong danh sách khu người xem nhận được, để gắn nhãn. */
  isolationBarnIds: ReadonlySet<string>;
  /** null = không giới hạn (CM, bác sĩ, Groom, chủ ngựa). HT: chỉ khu mình phụ trách. */
  visibleBarnIds: ReadonlySet<string> | null;
}

export function isIsolationBarn(barnId: string, stalls: Stall[]): boolean {
  const own = stalls.filter((stall) => stall.barnId === barnId);
  return own.length > 0 && own.every((stall) => stall.type === 'ISOLATION');
}

export function computeZoneScope(user: { id: string; role: Role } | null | undefined, barns: BarnListItem[], stalls: Stall[]): ZoneScope {
  const userId = user?.id ?? '';
  const trainer = user?.role === 'HEAD_TRAINER';
  const myBarns = trainer ? barns.filter((barn) => barn.headTrainerId === userId) : [];
  const myBarnIds = new Set(myBarns.map((barn) => barn.id));
  const isolationBarnIds = new Set(barns.filter((barn) => isIsolationBarn(barn.id, stalls)).map((barn) => barn.id));
  return {
    trainer,
    userId,
    myBarns,
    myBarnIds,
    isolationBarnIds,
    visibleBarnIds: trainer ? myBarnIds : null,
  };
}

/** HT phụ trách khu này (thao tác được ô, ngựa trong khu). */
export const canManageBarn = (scope: ZoneScope, barnId?: string | null) => scope.trainer && !!barnId && scope.myBarnIds.has(barnId);

/** Khu nằm trong phạm vi xem. Vai trò không bị giới hạn thì luôn đúng. */
export const canSeeBarn = (scope: ZoneScope, barnId?: string | null) => !scope.visibleBarnIds || (!!barnId && scope.visibleBarnIds.has(barnId));
