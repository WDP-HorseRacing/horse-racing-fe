// Flow 1 — quản lý hồ sơ và lý lịch ngựa.
import type {
  BodyMeasurement,
  Database,
  DistancePreference,
  Horse,
  HorsePhoto,
  HorseSex,
  LifecycleStatus,
  MeasurementType,
  StallType,
  Ownership,
} from '../types/domain';
import { AppError, ERR_NOT_FOUND, newId, stamp, touch } from './db';
import { assertVersion, commit, getCurrentUser, pushNotification, query, requirePermission, requireUser, writeAudit } from './api';
import { canViewHorse, inActionScope, visibleHorses } from '../auth/permissions';
import { canRace, canTrainAtAll } from '../lib/rules';
import { activeLock, currentAssignment, findUser, groomIdOf, openOwnerships, stallOf, zoneIdOf } from './selectors';
import { now } from '../lib/clock';
import { ageOf, toDateKey } from '../lib/format';
import { measurementLabel } from '../lib/labels';

export interface HorseRow {
  id: string;
  name: string;
  avatar?: string;
  sex: HorseSex;
  breed?: string;
  color?: string;
  birthDate?: string;
  age?: number;
  chipNumber?: string;
  distancePreference?: DistancePreference;
  healthStatus: Horse['healthStatus'];
  lifecycleStatus: LifecycleStatus;
  isReference: boolean;
  deleted: boolean;
  zoneId?: string;
  zoneName?: string;
  stallCode?: string;
  groomId?: string;
  groomName?: string;
  locked: boolean;
  raceAllowed: boolean;
  raceReason?: string;
  trainAllowed: boolean;
  trainReason?: string;
}

function toRow(db: Database, horse: Horse): HorseRow {
  const stall = stallOf(db, horse.id);
  const zone = stall ? db.zones.find((item) => item.id === stall.zoneId) : undefined;
  const groomId = groomIdOf(db, horse.id);
  const race = canRace(db, horse);
  const train = canTrainAtAll(db, horse);
  return {
    id: horse.id,
    name: horse.name,
    avatar: horse.avatar,
    sex: horse.sex,
    breed: horse.breed,
    color: horse.color,
    birthDate: horse.birthDate,
    age: ageOf(horse.birthDate, now()),
    chipNumber: horse.chipNumber,
    distancePreference: horse.distancePreference,
    healthStatus: horse.healthStatus,
    lifecycleStatus: horse.lifecycleStatus,
    isReference: horse.isReference,
    deleted: !!horse.deletedAt,
    zoneId: zone?.id,
    zoneName: zone?.name,
    stallCode: stall?.code,
    groomId,
    groomName: findUser(db, groomId)?.name,
    locked: !!activeLock(db, horse.id),
    raceAllowed: race.allowed,
    raceReason: race.reason,
    trainAllowed: train.allowed,
    trainReason: train.reason,
  };
}

const healthOrder: Record<Horse['healthStatus'], number> = {
  INJURED: 0,
  QUARANTINED: 1,
  UNDER_OBSERVATION: 2,
  ELIGIBLE: 3,
};

export interface HorseFilters {
  search?: string;
  sex?: HorseSex | '';
  distancePreference?: DistancePreference | '';
  healthStatus?: Horse['healthStatus'] | '';
  lifecycleStatus?: LifecycleStatus | '';
  zoneId?: string;
  includeDeleted?: boolean;
  includeReference?: boolean;
}

export function listHorses(filters: HorseFilters = {}): Promise<HorseRow[]> {
  return query((db) => {
    const user = requireUser();
    let rows = visibleHorses(db, user);

    if (!filters.includeDeleted) rows = rows.filter((horse) => !horse.deletedAt);
    if (!filters.includeReference) rows = rows.filter((horse) => !horse.isReference);

    const search = filters.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (horse) =>
          horse.name.toLowerCase().includes(search) ||
          (horse.chipNumber ?? '').includes(search),
      );
    }
    if (filters.sex) rows = rows.filter((horse) => horse.sex === filters.sex);
    if (filters.distancePreference) rows = rows.filter((horse) => horse.distancePreference === filters.distancePreference);
    if (filters.healthStatus) rows = rows.filter((horse) => horse.healthStatus === filters.healthStatus);
    if (filters.lifecycleStatus) rows = rows.filter((horse) => horse.lifecycleStatus === filters.lifecycleStatus);
    if (filters.zoneId) rows = rows.filter((horse) => zoneIdOf(db, horse.id) === filters.zoneId);

    return rows
      .map((horse) => toRow(db, horse))
      .sort(
        (a, b) =>
          healthOrder[a.healthStatus] - healthOrder[b.healthStatus] ||
          a.name.localeCompare(b.name, 'vi'),
      );
  });
}

export interface HorseDetail extends HorseRow {
  sireId?: string;
  damId?: string;
  /** Phí nuôi dưỡng đang áp dụng: mức riêng của ngựa, nếu không có thì mức mặc định của câu lạc bộ. */
  dailyRate?: number;
  /** true nghĩa là ngựa có mức riêng, false là đang dùng mức mặc định. */
  dailyRateIsCustom?: boolean;
  clubDefaultDailyRate?: number;
  version: number;
  deleteReason?: string;
  /** undefined = ngoài quyền xem; null = ngựa chưa có chủ đại diện. */
  representativeName?: string | null;
  canEditIdentity: boolean;
  canEditPreference: boolean;
  activeLockReason?: string;
  activeLockSince?: string;
}

export function getHorse(horseId: string): Promise<HorseDetail> {
  return query((db) => {
    const user = requireUser();
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse || !canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
    const lock = activeLock(db, horseId);
    const representative = openOwnerships(db, horseId).find((item) => item.isRepresentative);
    const showRepresentative = user.role !== 'VETERINARIAN' && user.role !== 'GROOM';
    return {
      ...toRow(db, horse),
      sireId: horse.sireId,
      damId: horse.damId,
      dailyRate:
        user.role === 'CLUB_MANAGER' || user.role === 'HORSE_OWNER'
          ? (horse.dailyRate ?? db.settings.defaultDailyRate)
          : undefined,
      dailyRateIsCustom: user.role === 'CLUB_MANAGER' ? horse.dailyRate !== undefined : undefined,
      clubDefaultDailyRate: user.role === 'CLUB_MANAGER' ? db.settings.defaultDailyRate : undefined,
      version: horse.version,
      deleteReason: horse.deleteReason,
      representativeName: showRepresentative ? (findUser(db, representative?.ownerId)?.name ?? null) : undefined,
      canEditIdentity: inActionScope(db, user, 'horse.edit.identity', horseId),
      canEditPreference: inActionScope(db, user, 'horse.edit.preference', horseId),
      activeLockReason: lock?.reason,
      activeLockSince: lock?.placedAt,
    };
  });
}

/* ===== F1.2 — tạo hồ sơ ===== */

export interface CreateHorseInput {
  name: string;
  sex: HorseSex;
  breed?: string;
  color?: string;
  birthDate?: string;
  chipNumber?: string;
  distancePreference?: DistancePreference;
  sireId?: string;
  damId?: string;
  stallId?: string;
  groomId?: string;
  owners: { ownerId: string; percent: number; isRepresentative: boolean }[];
  avatar?: string;
}

function validateParents(db: Database, sireId?: string, damId?: string, birthDate?: string) {
  if (sireId && damId && sireId === damId) {
    throw new AppError('Bố và mẹ phải là hai con ngựa khác nhau', 'damId');
  }
  if (sireId) {
    const sire = db.horses.find((item) => item.id === sireId);
    if (!sire) throw new AppError('Không tìm thấy ngựa bố', 'sireId');
    if (sire.sex === 'FEMALE') throw new AppError('Bố phải là ngựa đực hoặc đực đã thiến', 'sireId');
    if (birthDate && sire.birthDate && sire.birthDate >= birthDate) {
      throw new AppError('Ngựa bố phải sinh trước con', 'sireId');
    }
  }
  if (damId) {
    const dam = db.horses.find((item) => item.id === damId);
    if (!dam) throw new AppError('Không tìm thấy ngựa mẹ', 'damId');
    if (dam.sex !== 'FEMALE') throw new AppError('Mẹ phải là ngựa cái', 'damId');
    if (birthDate && dam.birthDate && dam.birthDate >= birthDate) {
      throw new AppError('Ngựa mẹ phải sinh trước con', 'damId');
    }
  }
}

function assertChipUnique(db: Database, chipNumber?: string, ignoreId?: string) {
  if (!chipNumber) return;
  // Trùng kể cả với hồ sơ đã xóa và ngựa đã chuyển nhượng.
  const clash = db.horses.find((item) => item.chipNumber === chipNumber && item.id !== ignoreId);
  if (clash) {
    throw new AppError(`Số chip đã được dùng cho hồ sơ "${clash.name}"`, 'chipNumber');
  }
}

export function createHorse(input: CreateHorseInput): Promise<Horse> {
  return commit((db) => {
    const user = requirePermission('horse.create');
    const at = now();

    if (!input.name.trim()) throw new AppError('Vui lòng nhập tên ngựa', 'name');
    if (!input.sex) throw new AppError('Vui lòng chọn giới tính', 'sex');
    if (input.birthDate && input.birthDate > toDateKey(at)) {
      throw new AppError('Ngày sinh không được ở tương lai', 'birthDate');
    }
    assertChipUnique(db, input.chipNumber);
    validateParents(db, input.sireId, input.damId, input.birthDate);

    if (input.stallId) {
      const occupied = db.stallAssignments.some((item) => item.stallId === input.stallId && !item.endAt);
      if (occupied) throw new AppError('Ô chuồng vừa được xếp cho ngựa khác, vui lòng chọn ô khác', 'stallId');
    }

    if (input.owners.length > 0) {
      const total = input.owners.reduce((sum, item) => sum + item.percent, 0);
      if (total !== 100) {
        const diff = 100 - total;
        throw new AppError(
          diff > 0 ? `Tổng tỉ lệ sở hữu còn thiếu ${diff}%` : `Tổng tỉ lệ sở hữu đang vượt ${-diff}%`,
          'owners',
        );
      }
      const reps = input.owners.filter((item) => item.isRepresentative).length;
      if (reps !== 1) throw new AppError('Phải chọn đúng một chủ đại diện', 'owners');
    }

    const horse: Horse = {
      id: newId('h'),
      name: input.name.trim(),
      sex: input.sex,
      breed: input.breed?.trim() || undefined,
      color: input.color?.trim() || undefined,
      birthDate: input.birthDate || undefined,
      chipNumber: input.chipNumber?.trim() || undefined,
      distancePreference: input.distancePreference,
      healthStatus: 'ELIGIBLE',
      lifecycleStatus: 'ACTIVE',
      isReference: false,
      sireId: input.sireId,
      damId: input.damId,
      avatar: input.avatar,
      dailyRate: undefined,
      ...stamp(at),
    };
    db.horses.push(horse);

    if (input.stallId) {
      db.stallAssignments.push({
        id: newId('sa'),
        horseId: horse.id,
        stallId: input.stallId,
        groomId: input.groomId,
        startAt: at.toISOString(),
        ...stamp(at),
      });
    }

    input.owners.forEach((owner) => {
      db.ownerships.push({
        id: newId('ow'),
        horseId: horse.id,
        ownerId: owner.ownerId,
        percent: owner.percent,
        isRepresentative: owner.isRepresentative,
        startDate: toDateKey(at),
        ...stamp(at),
      });
    });

    writeAudit(db, at, {
      action: 'Tạo hồ sơ ngựa',
      entityType: 'Horse',
      entityId: horse.id,
      after: { name: horse.name, chipNumber: horse.chipNumber },
      actor: user,
    });
    return horse;
  });
}

/* ===== F1.4 — cập nhật ===== */

export interface UpdateHorseInput {
  name?: string;
  sex?: HorseSex;
  breed?: string;
  color?: string;
  birthDate?: string;
  chipNumber?: string;
  distancePreference?: DistancePreference;
  version: number;
}

export function updateHorse(horseId: string, input: UpdateHorseInput): Promise<Horse> {
  return commit((db) => {
    const user = requireUser();
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    assertVersion(horse, input.version);

    if (horse.lifecycleStatus === 'TRANSFERRED' || horse.deletedAt) {
      throw new AppError('Hồ sơ này không còn sửa được');
    }

    const canIdentity = inActionScope(db, user, 'horse.edit.identity', horseId);
    const canPreference = inActionScope(db, user, 'horse.edit.preference', horseId);
    if (!canIdentity && !canPreference) throw new AppError('Bạn không có quyền sửa hồ sơ này');

    const before = { ...horse };
    const at = now();

    if (!canIdentity) {
      // Huấn luyện viên chỉ được sửa sở trường cự ly; mọi trường khác bị từ chối.
      const attempted = (['name', 'sex', 'breed', 'color', 'birthDate', 'chipNumber'] as const).filter(
        (field) => input[field] !== undefined && input[field] !== horse[field],
      );
      if (attempted.length > 0) {
        throw new AppError('Bạn chỉ được sửa sở trường cự ly của ngựa trong khu phụ trách');
      }
    } else {
      if (input.chipNumber !== undefined) {
        assertChipUnique(db, input.chipNumber, horseId);
        horse.chipNumber = input.chipNumber.trim() || undefined;
      }
      if (input.birthDate !== undefined) {
        if (input.birthDate && input.birthDate > toDateKey(at)) {
          throw new AppError('Ngày sinh không được ở tương lai', 'birthDate');
        }
        horse.birthDate = input.birthDate || undefined;
      }
      if (input.sex !== undefined && input.sex !== horse.sex) {
        const asSire = db.horses.some((item) => item.sireId === horseId);
        const asDam = db.horses.some((item) => item.damId === horseId);
        if (asDam && input.sex !== 'FEMALE') {
          throw new AppError('Ngựa đang là mẹ của con khác nên không đổi được sang giới tính này', 'sex');
        }
        if (asSire && input.sex === 'FEMALE') {
          throw new AppError('Ngựa đang là bố của con khác nên không đổi được sang ngựa cái', 'sex');
        }
        horse.sex = input.sex;
      }
      if (input.name !== undefined) {
        if (!input.name.trim()) throw new AppError('Vui lòng nhập tên ngựa', 'name');
        horse.name = input.name.trim();
      }
      if (input.breed !== undefined) horse.breed = input.breed.trim() || undefined;
      if (input.color !== undefined) horse.color = input.color.trim() || undefined;
    }

    if (input.distancePreference !== undefined) horse.distancePreference = input.distancePreference;
    touch(horse, at);

    writeAudit(db, at, {
      action: 'Cập nhật hồ sơ ngựa',
      entityType: 'Horse',
      entityId: horseId,
      before: {
        name: before.name,
        sex: before.sex,
        chipNumber: before.chipNumber,
        distancePreference: before.distancePreference,
      },
      after: {
        name: horse.name,
        sex: horse.sex,
        chipNumber: horse.chipNumber,
        distancePreference: horse.distancePreference,
      },
      actor: user,
    });
    return horse;
  });
}

/* ===== F1.5 — phả hệ ===== */

export interface PedigreeNode {
  id: string;
  name: string;
  sex: HorseSex;
  birthYear?: number;
  isReference: boolean;
  avatar?: string;
  sire?: PedigreeNode;
  dam?: PedigreeNode;
}

export function getPedigree(horseId: string): Promise<PedigreeNode | null> {
  return query((db) => {
    const user = requireUser();
    if (!canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
    const build = (id: string | undefined, depth: number): PedigreeNode | undefined => {
      if (!id || depth > 3) return undefined;
      const horse = db.horses.find((item) => item.id === id);
      if (!horse) return undefined;
      return {
        id: horse.id,
        name: horse.name,
        sex: horse.sex,
        birthYear: horse.birthDate ? new Date(horse.birthDate).getFullYear() : undefined,
        isReference: horse.isReference,
        avatar: horse.avatar,
        sire: build(horse.sireId, depth + 1),
        dam: build(horse.damId, depth + 1),
      };
    };
    return build(horseId, 1) ?? null;
  });
}

/** Con ngựa `targetId` có nằm trong nhánh tổ tiên của `startId` không (kể cả chính nó). */
function hasAncestor(db: Database, startId: string, targetId: string, depth = 0): boolean {
  if (depth > 12) return false;
  if (startId === targetId) return true;
  const horse = db.horses.find((item) => item.id === startId);
  if (!horse) return false;
  return (
    (horse.sireId ? hasAncestor(db, horse.sireId, targetId, depth + 1) : false) ||
    (horse.damId ? hasAncestor(db, horse.damId, targetId, depth + 1) : false)
  );
}

export function setParent(horseId: string, role: 'sire' | 'dam', parentId?: string) {
  return commit((db) => {
    const user = requirePermission('pedigree.edit');
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    const before = { sireId: horse.sireId, damId: horse.damId };

    if (parentId) {
      if (parentId === horseId) throw new AppError('Một con ngựa không thể là bố mẹ của chính nó');
      if (hasAncestor(db, parentId, horseId)) {
        throw new AppError('Không hợp lệ: sẽ tạo thành vòng lặp trên cây phả hệ');
      }
      validateParents(
        db,
        role === 'sire' ? parentId : horse.sireId,
        role === 'dam' ? parentId : horse.damId,
        horse.birthDate,
      );
    }

    if (role === 'sire') horse.sireId = parentId;
    else horse.damId = parentId;
    touch(horse, at);

    writeAudit(db, at, {
      action: parentId ? 'Khai báo phả hệ' : 'Gỡ liên kết phả hệ',
      entityType: 'Horse',
      entityId: horseId,
      before,
      after: { sireId: horse.sireId, damId: horse.damId },
      actor: user,
    });
  });
}

export function createReferenceHorse(input: { name: string; sex: HorseSex; birthDate?: string }): Promise<Horse> {
  return commit((db) => {
    const user = requirePermission('pedigree.edit');
    if (!input.name.trim()) throw new AppError('Vui lòng nhập tên ngựa', 'name');
    const at = now();
    const horse: Horse = {
      id: newId('h'),
      name: input.name.trim(),
      sex: input.sex,
      birthDate: input.birthDate || undefined,
      healthStatus: 'ELIGIBLE',
      lifecycleStatus: 'ACTIVE',
      isReference: true,
      ...stamp(at),
    };
    db.horses.push(horse);
    writeAudit(db, at, {
      action: 'Tạo ngựa tham chiếu',
      entityType: 'Horse',
      entityId: horse.id,
      after: { name: horse.name },
      actor: user,
    });
    return horse;
  });
}

export function activateReferenceHorse(horseId: string) {
  return commit((db) => {
    const user = requirePermission('pedigree.edit');
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (!horse.isReference) throw new AppError('Ngựa này đã là ngựa của câu lạc bộ');
    const at = now();
    horse.isReference = false;
    horse.healthStatus = 'ELIGIBLE';
    horse.lifecycleStatus = 'ACTIVE';
    horse.dailyRate = undefined;
    touch(horse, at);
    writeAudit(db, at, {
      action: 'Kích hoạt ngựa tham chiếu',
      entityType: 'Horse',
      entityId: horseId,
      after: { isReference: false },
      actor: user,
    });
  });
}

/* ===== F1.6 — quyền sở hữu ===== */

export interface OwnershipRow {
  id: string;
  ownerId: string;
  ownerName: string;
  email?: string;
  phone?: string;
  percent: number;
  isRepresentative: boolean;
  startDate: string;
  endDate?: string;
}

export function listOwnerships(horseId: string): Promise<{ current: OwnershipRow[]; history: OwnershipRow[] }> {
  return query((db) => {
    const user = requireUser();
    if (!canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);

    const toRowLocal = (item: Ownership): OwnershipRow => {
      const owner = findUser(db, item.ownerId);
      // Liên hệ của đồng sở hữu khác bị bỏ trước khi trả về (không gửi rồi ẩn).
      const showContact =
        user.role === 'CLUB_MANAGER' || (user.role === 'HORSE_OWNER' && item.ownerId === user.id);
      return {
        id: item.id,
        ownerId: item.ownerId,
        ownerName: owner?.name ?? '—',
        email: showContact ? owner?.email : undefined,
        phone: showContact ? owner?.phone : undefined,
        percent: item.percent,
        isRepresentative: item.isRepresentative,
        startDate: item.startDate,
        endDate: item.endDate,
      };
    };

    const all = db.ownerships.filter((item) => item.horseId === horseId);
    return {
      current: all.filter((item) => !item.endDate).map(toRowLocal),
      history: all.filter((item) => item.endDate).map(toRowLocal),
    };
  });
}

export function saveOwnerships(
  horseId: string,
  owners: { ownerId: string; percent: number; isRepresentative: boolean }[],
) {
  return commit((db) => {
    const user = requirePermission('ownership.edit');
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (horse.isReference) throw new AppError('Ngựa tham chiếu không có chủ sở hữu');

    if (owners.length > 0) {
      const total = owners.reduce((sum, item) => sum + item.percent, 0);
      if (total !== 100) {
        const diff = 100 - total;
        throw new AppError(
          diff > 0 ? `Tổng tỉ lệ sở hữu còn thiếu ${diff}%` : `Tổng tỉ lệ sở hữu đang vượt ${-diff}%`,
          'owners',
        );
      }
      if (owners.filter((item) => item.isRepresentative).length > 1) {
        throw new AppError('Chỉ được chọn một chủ đại diện', 'owners');
      }
      const ids = new Set(owners.map((item) => item.ownerId));
      if (ids.size !== owners.length) throw new AppError('Một người chỉ xuất hiện một lần', 'owners');
    }

    const at = now();
    const before = openOwnerships(db, horseId).map((item) => ({
      ownerId: item.ownerId,
      percent: item.percent,
    }));

    // Không sửa bản ghi cũ: đóng bản ghi đang mở rồi tạo bản ghi mới.
    openOwnerships(db, horseId).forEach((item) => {
      item.endDate = toDateKey(at);
      touch(item, at);
    });
    owners.forEach((owner) => {
      db.ownerships.push({
        id: newId('ow'),
        horseId,
        ownerId: owner.ownerId,
        percent: owner.percent,
        isRepresentative: owner.isRepresentative,
        startDate: toDateKey(at),
        ...stamp(at),
      });
    });

    writeAudit(db, at, {
      action: 'Cập nhật quyền sở hữu',
      entityType: 'Ownership',
      entityId: horseId,
      before,
      after: owners.map((item) => ({ ownerId: item.ownerId, percent: item.percent })),
      actor: user,
    });
  });
}

/* ===== F1.7 — chỉ số cơ thể ===== */

export function listMeasurements(horseId: string): Promise<BodyMeasurement[]> {
  return query((db) => {
    const user = requireUser();
    if (!canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
    const rows = db.bodyMeasurements
      .filter((item) => item.horseId === horseId)
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
    if (user.role === 'GROOM') {
      // Nhân viên chăm sóc chỉ thấy số đo mới nhất của cân nặng và thân nhiệt.
      const latest: BodyMeasurement[] = [];
      (['WEIGHT', 'TEMPERATURE'] as MeasurementType[]).forEach((type) => {
        const hit = rows.find((item) => item.type === type);
        if (hit) latest.push(hit);
      });
      return latest;
    }
    return rows;
  });
}

export function addMeasurement(input: {
  horseId: string;
  type: MeasurementType;
  value: number;
  measuredAt: string;
}) {
  return commit((db) => {
    const user = requireUser();
    if (!inActionScope(db, user, 'measurement.add', input.horseId)) {
      throw new AppError('Bạn không có quyền ghi chỉ số cho ngựa này');
    }
    const allowed: Record<string, MeasurementType[]> = {
      HEAD_TRAINER: ['WEIGHT', 'BODY_CONDITION'],
      VETERINARIAN: ['WEIGHT', 'HEIGHT', 'BODY_CONDITION', 'TEMPERATURE'],
      GROOM: ['WEIGHT', 'TEMPERATURE'],
    };
    if (!allowed[user.role]?.includes(input.type)) {
      throw new AppError(`Vai trò của bạn không ghi được chỉ số ${measurementLabel[input.type].name.toLowerCase()}`, 'type');
    }

    const at = now();
    const measuredAt = new Date(input.measuredAt);
    if (measuredAt.getTime() > at.getTime()) {
      throw new AppError('Thời điểm đo không được ở tương lai', 'measuredAt');
    }
    if (at.getTime() - measuredAt.getTime() > 7 * 86_400_000) {
      throw new AppError('Chỉ được nhập lùi tối đa 7 ngày', 'measuredAt');
    }
    if (!Number.isFinite(input.value) || input.value <= 0) {
      throw new AppError('Giá trị đo không hợp lệ', 'value');
    }

    db.bodyMeasurements.push({
      id: newId('bm'),
      horseId: input.horseId,
      type: input.type,
      value: input.value,
      measuredAt: measuredAt.toISOString(),
      recordedBy: user.id,
      ...stamp(at),
    });

    const horse = db.horses.find((item) => item.id === input.horseId);
    const zoneId = zoneIdOf(db, input.horseId);
    const trainer = db.users.find((item) => item.role === 'HEAD_TRAINER' && item.zoneId === zoneId);
    const vets = db.users.filter((item) => item.role === 'VETERINARIAN');

    // Cảnh báo thân nhiệt vượt 38,6 °C.
    if (input.type === 'TEMPERATURE' && input.value > 38.6) {
      [...vets, ...(trainer ? [trainer] : [])].forEach((receiver) => {
        pushNotification(db, at, {
          userId: receiver.id,
          level: 'URGENT',
          title: `Thân nhiệt ${horse?.name} ${input.value.toFixed(1)} °C`,
          body: 'Vượt ngưỡng 38,6 °C, cần kiểm tra ngay.',
          link: `/horses/${input.horseId}?tab=medical`,
        });
      });
    }

    // Cảnh báo giảm cân quá 5% trong 14 ngày.
    if (input.type === 'WEIGHT') {
      const twoWeeksAgo = at.getTime() - 14 * 86_400_000;
      const window = db.bodyMeasurements.filter(
        (item) =>
          item.horseId === input.horseId &&
          item.type === 'WEIGHT' &&
          new Date(item.measuredAt).getTime() >= twoWeeksAgo,
      );
      const peak = Math.max(...window.map((item) => item.value));
      if (peak > 0 && (peak - input.value) / peak > 0.05) {
        [...vets, ...(trainer ? [trainer] : [])].forEach((receiver) => {
          pushNotification(db, at, {
            userId: receiver.id,
            level: 'URGENT',
            title: `${horse?.name} giảm cân bất thường`,
            body: `Giảm hơn 5% trong 14 ngày (${peak} kg → ${input.value} kg).`,
            link: `/horses/${input.horseId}?tab=body`,
          });
        });
      }
    }

    writeAudit(db, at, {
      action: 'Ghi chỉ số cơ thể',
      entityType: 'BodyMeasurement',
      entityId: input.horseId,
      after: { type: input.type, value: input.value },
      actor: user,
    });
  });
}

export function deleteMeasurement(measurementId: string) {
  return commit((db) => {
    const user = requireUser();
    const index = db.bodyMeasurements.findIndex((item) => item.id === measurementId);
    if (index < 0) throw new AppError(ERR_NOT_FOUND);
    const record = db.bodyMeasurements[index];
    if (record.recordedBy !== user.id && user.role !== 'CLUB_MANAGER') {
      throw new AppError('Chỉ người đã ghi hoặc quản lý câu lạc bộ được xóa số đo');
    }
    const at = now();
    db.bodyMeasurements.splice(index, 1);
    writeAudit(db, at, {
      action: 'Xóa số đo',
      entityType: 'BodyMeasurement',
      entityId: record.horseId,
      before: { type: record.type, value: record.value },
      actor: user,
    });
  });
}

/* ===== F1.8 — ảnh ===== */

export function listPhotos(horseId: string): Promise<HorsePhoto[]> {
  return query((db) =>
    db.horsePhotos
      .filter((item) => item.horseId === horseId && !item.removedAt)
      .sort((a, b) => Number(b.isAvatar) - Number(a.isAvatar)),
  );
}

export function addPhoto(horseId: string, src: string, caption?: string) {
  return commit((db) => {
    const user = requireUser();
    if (!inActionScope(db, user, 'photo.add', horseId)) throw new AppError('Bạn không có quyền tải ảnh cho ngựa này');
    const at = now();
    db.horsePhotos.push({
      id: newId('hp'),
      horseId,
      src,
      caption,
      uploadedBy: user.id,
      isAvatar: false,
      ...stamp(at),
    });
    writeAudit(db, at, { action: 'Tải ảnh hồ sơ', entityType: 'HorsePhoto', entityId: horseId, actor: user });
  });
}

export function setAvatarPhoto(photoId: string) {
  return commit((db) => {
    const user = requirePermission('photo.manage');
    const photo = db.horsePhotos.find((item) => item.id === photoId);
    if (!photo) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    db.horsePhotos
      .filter((item) => item.horseId === photo.horseId)
      .forEach((item) => {
        item.isAvatar = item.id === photoId;
      });
    const horse = db.horses.find((item) => item.id === photo.horseId);
    if (horse) {
      horse.avatar = photo.src;
      touch(horse, at);
    }
    writeAudit(db, at, { action: 'Đặt ảnh đại diện', entityType: 'HorsePhoto', entityId: photo.horseId, actor: user });
  });
}

export function removePhoto(photoId: string) {
  return commit((db) => {
    const user = requirePermission('photo.manage');
    const photo = db.horsePhotos.find((item) => item.id === photoId);
    if (!photo) throw new AppError(ERR_NOT_FOUND);
    if (photo.isAvatar) throw new AppError('Không gỡ được ảnh đang dùng làm ảnh đại diện');
    const at = now();
    // Ảnh bị gỡ chỉ đánh dấu, tác vụ định kỳ xóa hẳn sau 30 ngày.
    photo.removedAt = at.toISOString();
    touch(photo, at);
    writeAudit(db, at, { action: 'Gỡ ảnh hồ sơ', entityType: 'HorsePhoto', entityId: photo.horseId, actor: user });
  });
}

/* ===== F1.9 — sơ đồ chuồng ===== */

export interface StallCell {
  stallId: string;
  code: string;
  type: StallType;
  horseId?: string;
  horseName?: string;
  healthStatus?: Horse['healthStatus'];
  locked?: boolean;
  groomName?: string;
}

export interface ZoneMap {
  zoneId: string;
  zoneName: string;
  headTrainerName?: string;
  capacity: number;
  occupied: number;
  cells: StallCell[];
}

export function getStableMap(): Promise<ZoneMap[]> {
  return query((db) => {
    requireUser();
    return db.zones.map((zone) => {
      const cells = db.stalls
        .filter((stall) => stall.zoneId === zone.id)
        .map((stall) => {
          const assignment = db.stallAssignments.find((item) => item.stallId === stall.id && !item.endAt);
          const horse = assignment ? db.horses.find((item) => item.id === assignment.horseId) : undefined;
          return {
            stallId: stall.id,
            code: stall.code,
            type: stall.type,
            horseId: horse?.id,
            horseName: horse?.name,
            healthStatus: horse?.healthStatus,
            locked: horse ? !!activeLock(db, horse.id) : false,
            groomName: findUser(db, assignment?.groomId)?.name,
          } as StallCell;
        });
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        headTrainerName: findUser(db, zone.headTrainerId)?.name,
        capacity: cells.length,
        occupied: cells.filter((cell) => cell.horseId).length,
        cells,
      };
    });
  });
}

export function assignStall(input: {
  horseId: string;
  stallId: string;
  groomId?: string;
  reason?: string;
}) {
  return commit((db) => {
    const user = requireUser();
    const horse = db.horses.find((item) => item.id === input.horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (horse.isReference) throw new AppError('Ngựa tham chiếu không được xếp chuồng');

    const target = db.stalls.find((item) => item.id === input.stallId);
    if (!target) throw new AppError('Không tìm thấy ô chuồng', 'stallId');

    const scopeOk =
      user.role === 'CLUB_MANAGER' ||
      user.role === 'VETERINARIAN' ||
      (user.role === 'HEAD_TRAINER' && user.zoneId === target.zoneId && zoneIdOf(db, input.horseId) === user.zoneId);
    if (!scopeOk) throw new AppError('Bạn chỉ được chuyển ô trong khu mình phụ trách');

    const occupied = db.stallAssignments.find((item) => item.stallId === input.stallId && !item.endAt);
    if (occupied && occupied.horseId !== input.horseId) {
      throw new AppError('Ô chuồng đang có ngựa khác', 'stallId');
    }
    if (horse.healthStatus === 'QUARANTINED' && target.type !== 'ISOLATION') {
      throw new AppError('Ngựa đang cách ly phải ở ô cách ly', 'stallId');
    }

    const at = now();
    const previous = currentAssignment(db, input.horseId);
    const previousGroomId = previous?.groomId;
    if (previous) {
      previous.endAt = at.toISOString();
      touch(previous, at);
    }
    db.stallAssignments.push({
      id: newId('sa'),
      horseId: input.horseId,
      stallId: input.stallId,
      groomId: input.groomId ?? previousGroomId,
      startAt: at.toISOString(),
      ...stamp(at),
    });

    const newZoneId = target.zoneId;
    const oldZoneId = previous ? db.stalls.find((item) => item.id === previous.stallId)?.zoneId : undefined;

    // Đổi khu: gắn cờ "cần xem lại" cho giáo án đang áp dụng và sắp tới.
    if (oldZoneId && oldZoneId !== newZoneId) {
      db.plans
        .filter((plan) => plan.horseId === input.horseId && !plan.cancelledAt && plan.endDate >= toDateKey(at))
        .forEach((plan) => {
          plan.needsReview = true;
          plan.needsReviewReason = `Ngựa chuyển sang ${db.zones.find((z) => z.id === newZoneId)?.name} ngày ${toDateKey(at)}`;
          touch(plan, at);
        });
      const newTrainer = db.users.find((item) => item.role === 'HEAD_TRAINER' && item.zoneId === newZoneId);
      if (newTrainer) {
        pushNotification(db, at, {
          userId: newTrainer.id,
          title: `Giáo án của ${horse.name} cần xem lại`,
          body: 'Ngựa vừa chuyển sang khu bạn phụ trách.',
          link: `/horses/${input.horseId}?tab=training`,
        });
      }
    }

    // Đổi nhân viên chăm sóc: chuyển buổi tập tương lai và việc chưa làm trong ngày.
    const nextGroomId = input.groomId ?? previousGroomId;
    if (nextGroomId && nextGroomId !== previousGroomId) {
      db.sessions
        .filter(
          (session) =>
            session.horseId === input.horseId &&
            session.status === 'SCHEDULED' &&
            session.sessionDate >= toDateKey(at),
        )
        .forEach((session) => {
          const clash = db.sessions.some(
            (item) =>
              item.id !== session.id &&
              item.groomId === nextGroomId &&
              item.sessionDate === session.sessionDate &&
              item.slotId === session.slotId &&
              item.status !== 'CANCELLED',
          );
          session.groomId = clash ? undefined : nextGroomId;
          touch(session, at);
        });
      db.dailyTasks
        .filter((task) => task.horseId === input.horseId && task.date >= toDateKey(at) && !task.doneAt)
        .forEach((task) => {
          task.groomId = nextGroomId;
          touch(task, at);
        });
      pushNotification(db, at, {
        userId: nextGroomId,
        title: `Bạn được giao chăm sóc ${horse.name}`,
        body: `Ô chuồng ${target.code}.`,
        link: '/care/today',
      });
    }

    writeAudit(db, at, {
      action: previous ? 'Chuyển ô chuồng' : 'Xếp ô chuồng',
      entityType: 'StallAssignment',
      entityId: input.horseId,
      before: previous ? { stallId: previous.stallId, groomId: previousGroomId } : undefined,
      after: { stallId: input.stallId, groomId: nextGroomId },
      reason: input.reason,
      actor: user,
    });
  });
}

/* ===== F1.10 — vòng đời và xóa mềm ===== */

export function getDeleteBlockers(horseId: string): Promise<string[]> {
  return query((db) => {
    const blockers: string[] = [];
    if (db.medicalRecords.some((item) => item.horseId === horseId)) blockers.push('đã có hồ sơ khám bệnh');
    if (db.careSchedules.some((item) => item.horseId === horseId)) blockers.push('đã có lịch chăm sóc định kỳ');
    if (db.trainingLocks.some((item) => item.horseId === horseId)) blockers.push('đã từng có khóa huấn luyện');
    if (db.plans.some((item) => item.horseId === horseId)) blockers.push('đã có giáo án huấn luyện');
    if (db.raceRegistrations.some((item) => item.horseId === horseId)) blockers.push('đã có đăng ký thi đấu');
    if (db.ownerships.some((item) => item.horseId === horseId)) blockers.push('đã gán quyền sở hữu');
    if (db.stallAssignments.some((item) => item.horseId === horseId)) blockers.push('đã xếp ô chuồng');
    if (db.dietPlans.some((item) => item.horseId === horseId)) blockers.push('đã có khẩu phần ăn');
    if (db.incidents.some((item) => item.horseId === horseId)) blockers.push('đã có báo cáo sự cố');
    if (db.bodyMeasurements.some((item) => item.horseId === horseId)) blockers.push('đã có chỉ số đo');
    if (db.maxHeartRates.some((item) => item.horseId === horseId)) blockers.push('đã đặt nhịp tim tối đa riêng');
    if (db.horses.some((item) => item.sireId === horseId || item.damId === horseId)) {
      blockers.push('đang là bố hoặc mẹ của ngựa khác');
    }
    return blockers;
  });
}

export function changeLifecycle(horseId: string, to: LifecycleStatus, reason: string) {
  return commit((db) => {
    const user = requirePermission('horse.lifecycle');
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (!reason.trim()) throw new AppError('Vui lòng nhập lý do', 'reason');
    if (horse.lifecycleStatus === 'TRANSFERRED') throw new AppError('Ngựa đã chuyển nhượng, không đổi được nữa');
    if (horse.lifecycleStatus === to) throw new AppError('Ngựa đang ở trạng thái này');

    const at = now();
    const from = horse.lifecycleStatus;
    horse.lifecycleStatus = to;
    touch(horse, at);

    db.lifecycleEvents.push({
      id: newId('le'),
      horseId,
      from,
      to,
      reason: reason.trim(),
      by: user.id,
      at: at.toISOString(),
      ...stamp(at),
    });

    if (to === 'RETIRED' || to === 'TRANSFERRED') {
      // Hủy giáo án sắp tới và đang áp dụng, cùng buổi tập chưa diễn ra.
      db.plans
        .filter((plan) => plan.horseId === horseId && !plan.cancelledAt && plan.endDate >= toDateKey(at))
        .forEach((plan) => {
          plan.cancelledAt = at.toISOString();
          plan.cancelledBy = user.id;
          plan.closeReason = 'LIFECYCLE';
          plan.closeNote = 'Hủy do đổi vòng đời';
          touch(plan, at);
        });
      db.sessions
        .filter(
          (session) =>
            session.horseId === horseId &&
            session.status === 'SCHEDULED' &&
            session.sessionDate >= toDateKey(at),
        )
        .forEach((session) => {
          session.status = 'CANCELLED';
          session.cancelCategory = 'LIFECYCLE';
          session.cancelReason = 'Ngựa đổi vòng đời';
          session.cancelledAt = at.toISOString();
          session.cancelledBy = user.id;
          touch(session, at);
        });
      db.raceRegistrations
        .filter((item) => item.horseId === horseId && item.status !== 'CANCELLED')
        .forEach((item) => {
          item.status = 'CANCELLED';
          item.cancelReason = 'Ngựa đổi vòng đời';
          touch(item, at);
        });
    }

    if (to === 'TRANSFERRED') {
      const assignment = currentAssignment(db, horseId);
      if (assignment) {
        assignment.endAt = at.toISOString();
        touch(assignment, at);
      }
      openOwnerships(db, horseId).forEach((item) => {
        item.endDate = toDateKey(at);
        touch(item, at);
      });
      const lock = activeLock(db, horseId);
      if (lock) {
        lock.liftedAt = at.toISOString();
        lock.liftReason = 'Gỡ do chuyển nhượng';
        touch(lock, at);
      }
    }

    writeAudit(db, at, {
      action: 'Đổi vòng đời ngựa',
      entityType: 'Horse',
      entityId: horseId,
      before: { lifecycleStatus: from },
      after: { lifecycleStatus: to },
      reason,
      actor: user,
    });
  });
}

export function softDeleteHorse(horseId: string, reason: string) {
  return commit((db) => {
    const user = requirePermission('horse.lifecycle');
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (!reason.trim()) throw new AppError('Vui lòng nhập lý do xóa', 'reason');
    const at = now();
    horse.deletedAt = at.toISOString();
    horse.deleteReason = reason.trim();
    touch(horse, at);
    writeAudit(db, at, {
      action: 'Xóa hồ sơ ngựa',
      entityType: 'Horse',
      entityId: horseId,
      before: { deletedAt: undefined },
      after: { deletedAt: horse.deletedAt },
      reason,
      actor: user,
    });
  });
}

/**
 * Đặt phí nuôi dưỡng theo ngày cho một con ngựa.
 * Truyền `undefined` để gỡ mức riêng, đưa ngựa về mức mặc định của câu lạc bộ.
 */
export function setHorseDailyRate(horseId: string, value: number | undefined, reason: string) {
  return commit((db) => {
    const user = requirePermission('boarding.rate');
    const horse = db.horses.find((item) => item.id === horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (horse.isReference) throw new AppError('Ngựa tham chiếu không có phí nuôi dưỡng');
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      throw new AppError('Phí nuôi dưỡng phải lớn hơn 0', 'value');
    }

    const at = now();
    const before = horse.dailyRate ?? db.settings.defaultDailyRate;
    horse.dailyRate = value;
    touch(horse, at);

    writeAudit(db, at, {
      action: value === undefined ? 'Gỡ phí nuôi dưỡng riêng' : 'Đặt phí nuôi dưỡng riêng',
      entityType: 'Horse',
      entityId: horseId,
      before: { dailyRate: before },
      after: { dailyRate: value ?? db.settings.defaultDailyRate },
      reason,
      actor: user,
    });
  });
}

/** Mức phí nuôi dưỡng mặc định áp cho mọi ngựa chưa có mức riêng. */
export function setClubDefaultDailyRate(value: number, reason: string) {
  return commit((db) => {
    const user = requirePermission('boarding.rate');
    if (!Number.isFinite(value) || value <= 0) {
      throw new AppError('Phí nuôi dưỡng phải lớn hơn 0', 'value');
    }
    const at = now();
    const before = db.settings.defaultDailyRate;
    db.settings.defaultDailyRate = value;

    writeAudit(db, at, {
      action: 'Đổi phí nuôi dưỡng mặc định của câu lạc bộ',
      entityType: 'ClubSetting',
      entityId: 'defaultDailyRate',
      before: { defaultDailyRate: before },
      after: { defaultDailyRate: value },
      reason,
      actor: user,
    });
  });
}

/** Ngựa của câu lạc bộ chưa được xếp vào ô chuồng nào. */
export function listUnstabledHorses() {
  return query((db) => {
    const user = requireUser();
    return visibleHorses(db, user)
      .filter(
        (horse) =>
          !horse.isReference &&
          !horse.deletedAt &&
          horse.lifecycleStatus !== 'TRANSFERRED' &&
          !currentAssignment(db, horse.id),
      )
      .map((horse) => ({
        id: horse.id,
        name: horse.name,
        avatar: horse.avatar,
        healthStatus: horse.healthStatus,
      }));
  });
}

export function listGrooms(): Promise<{ id: string; name: string }[]> {
  return query((db) =>
    db.users.filter((user) => user.role === 'GROOM' && user.active).map(({ id, name }) => ({ id, name })),
  );
}

export function listOwnerAccounts(): Promise<{ id: string; name: string; email: string }[]> {
  return query((db) =>
    db.users
      .filter((user) => user.role === 'HORSE_OWNER' && user.active)
      .map(({ id, name, email }) => ({ id, name, email })),
  );
}

export function listFreeStalls(): Promise<{ id: string; code: string; zoneName: string; type: string }[]> {
  return query((db) =>
    db.stalls
      .filter((stall) => !db.stallAssignments.some((item) => item.stallId === stall.id && !item.endAt))
      .map((stall) => ({
        id: stall.id,
        code: stall.code,
        zoneName: db.zones.find((zone) => zone.id === stall.zoneId)?.name ?? '—',
        type: stall.type,
      })),
  );
}

export function listZones(): Promise<{ id: string; name: string }[]> {
  return query((db) => db.zones.map(({ id, name }) => ({ id, name })));
}

export function listHorseOptions(): Promise<{ id: string; name: string; sex: HorseSex; isReference: boolean }[]> {
  return query((db) => {
    const user = getCurrentUser();
    return db.horses
      .filter((horse) => !horse.deletedAt && canViewHorse(db, user, horse.id))
      .map(({ id, name, sex, isReference }) => ({ id, name, sex, isReference }));
  });
}
