// Phạm vi khu của người xem. BE trả mọi khu cho mọi vai trò nhân sự, nên FE tự giới hạn cho Head Trainer:
// HT chỉ thấy khu mình phụ trách và khu cách ly (khu cách ly của HT khác chỉ xem, không thao tác).
// BE không có loại khu: khu cách ly = khu có ít nhất một ô và mọi ô đều là ô cách ly.
import type { BarnListItem, Role, Stall } from '../api/types';

export interface ZoneScope {
  /** Người xem là Head Trainer: các trang lọc theo `visibleBarnIds`. */
  trainer: boolean;
  userId: string;
  myBarns: BarnListItem[];
  myBarnIds: ReadonlySet<string>;
  isolationBarnIds: ReadonlySet<string>;
  /** null = không giới hạn (CM, bác sĩ, Groom, chủ ngựa giữ hành vi cũ). HT: khu của mình ∪ khu cách ly. */
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
    visibleBarnIds: trainer ? new Set([...myBarnIds, ...isolationBarnIds]) : null,
  };
}

/** HT phụ trách khu này (thao tác được ô, ngựa trong khu). */
export const canManageBarn = (scope: ZoneScope, barnId?: string | null) => scope.trainer && !!barnId && scope.myBarnIds.has(barnId);

/** Khu nằm trong phạm vi xem. Vai trò không bị giới hạn thì luôn đúng. */
export const canSeeBarn = (scope: ZoneScope, barnId?: string | null) => !scope.visibleBarnIds || (!!barnId && scope.visibleBarnIds.has(barnId));
