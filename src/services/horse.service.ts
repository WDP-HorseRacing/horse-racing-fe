// Flow 1 — hồ sơ và lý lịch ngựa, cộng F2.1 (danh mục khu và ô chuồng).
// Mọi hàm kiểm quyền + phạm vi ở đây; dữ liệu ngoài quyền bị loại trước khi trả về.
import type {
  Database,
  DistancePreference,
  HealthStatus,
  Horse,
  HorsePlacement,
  HorseSex,
  LifecycleConsequences,
  LifecycleStatus,
  MeasurementType,
  StallStatus,
  User,
  Zone,
  ZoneStatus,
} from '../types/domain';
import { AppError, ERR_FORBIDDEN, ERR_NOT_FOUND, newId, stamp, touch } from './db';
import { assertVersion, commit, notifyMany, query, requirePermission, requireUser, writeAudit } from './api';
import {
  activeEnrollments,
  activeLock,
  classOf,
  findHorse,
  findUser,
  horsesOfGroom,
  horsesOfZone,
  isClassOpen,
  isHorseWritable,
  managedZoneIds,
  openCaseOf,
  placementOf,
  stallOf,
  trainerOfZone,
  userName,
  vetIds,
  zoneCapacity,
  zoneOf,
  type ZoneCapacity,
} from './selectors';
import { closeOpenEnrollments, createExamRequestInternal, liftLockInternal, occupyStall, vacateStall } from './ops';
import { can, canViewHorse, inActionScope, inZoneScope, visibleHorses } from '../auth/permissions';
import { canRace, canTrainAtAll, canTransition, checkMeasurement, TEMP_ALERT_C, WEIGHT_DROP, type RuleCheck } from '../lib/rules';
import { now } from '../lib/clock';
import { links } from '../lib/links';
import { ageOf, DAY_MS, formatDate, formatNumber, toDateKey } from '../lib/format';
import { healthLabel, lifecycleLabel, measurementLabel, sexLabel } from '../lib/labels';

/* ===== Tiện ích nội bộ ===== */

const READONLY_MESSAGE = 'Hồ sơ đã chuyển nhượng hoặc đã xóa nên chỉ xem được, không thao tác được';

const FIELD_LABEL: Record<string, string> = {
  name: 'Tên ngựa',
  sex: 'Giới tính',
  breed: 'Giống',
  color: 'Màu lông',
  birthDate: 'Ngày sinh',
  chipNumber: 'Số chip',
  distancePreference: 'Sở trường cự ly',
  sireId: 'Cha',
  damId: 'Mẹ',
  ownerId: 'Chủ sở hữu',
  avatar: 'Ảnh đại diện',
};

function clean(value?: string | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Lấy ngựa trong phạm vi xem; ngoài phạm vi thì coi như không tồn tại (404). */
function viewableHorse(db: Database, user: User, horseId: string): Horse {
  const horse = findHorse(db, horseId);
  if (!horse || !canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
  return horse;
}

/** Ngựa để thao tác: phải xem được, hồ sơ còn ghi được, và nằm trong phạm vi thao tác của chức năng. */
function actionableHorse(db: Database, user: User, horseId: string, key: string): Horse {
  const horse = viewableHorse(db, user, horseId);
  if (!isHorseWritable(horse)) throw new AppError(READONLY_MESSAGE);
  if (!inActionScope(db, user, key, horseId)) throw new AppError(ERR_FORBIDDEN);
  return horse;
}

function requireReason(reason: string | undefined, field = 'reason'): string {
  const value = clean(reason);
  if (!value) throw new AppError('Vui lòng nhập lý do', field);
  return value;
}

/** Tên buổi đang diễn ra mà ngựa đang tham gia (nếu có). */
function runningSessionOf(db: Database, horseId: string): string | undefined {
  const row = db.attendances.find((item) => {
    if (item.horseId !== horseId || item.status === 'ABSENT' || item.stoppedAtSecond !== undefined) return false;
    return db.sessions.find((session) => session.id === item.sessionId)?.status === 'IN_PROGRESS';
  });
  if (!row) return undefined;
  const session = db.sessions.find((item) => item.id === row.sessionId);
  const cls = classOf(db, session?.classId);
  return `${session?.subjectName ?? 'buổi tập'}${cls ? ` (lớp ${cls.name})` : ''}`;
}

/** `ancestorId` có nằm trong tổ tiên của `horseId` không (đi ngược qua cha mẹ, kể cả hồ sơ đã xóa). */
function isAncestorOf(db: Database, ancestorId: string, horseId: string): boolean {
  const seen = new Set<string>();
  const stack = [horseId];
  while (stack.length > 0) {
    const current = findHorse(db, stack.pop());
    if (!current || seen.has(current.id)) continue;
    seen.add(current.id);
    for (const parentId of [current.sireId, current.damId]) {
      if (!parentId) continue;
      if (parentId === ancestorId) return true;
      stack.push(parentId);
    }
  }
  return false;
}

function childrenOf(db: Database, horseId: string): Horse[] {
  return db.horses.filter((horse) => horse.sireId === horseId || horse.damId === horseId);
}

function openClassesOfZone(db: Database, zoneId: string, todayKey: string) {
  return db.classes.filter((cls) => cls.zoneId === zoneId && isClassOpen(cls, todayKey));
}

/** Tên các lớp chưa kết thúc mà ngựa đang học (có thể chỉ lấy lớp của một khu). */
function openClassNames(db: Database, horseId: string, todayKey: string, zoneId?: string): string[] {
  return activeEnrollments(db, horseId, todayKey)
    .map((item) => classOf(db, item.classId))
    .filter((cls) => !!cls && (!zoneId || cls.zoneId === zoneId))
    .map((cls) => cls!.name);
}

/** Thông báo rút khỏi lớp (A.7): OWNER và Groom phụ trách, mức Thấp. */
function notifyWithdrawn(db: Database, at: Date, horse: Horse, classNames: string[], why: string) {
  if (classNames.length === 0) return;
  notifyMany(db, at, [horse.ownerId, horse.groomId], {
    level: 'NORMAL',
    title: `${horse.name} rời ${classNames.length > 1 ? `${classNames.length} lớp` : `lớp ${classNames[0]}`}`,
    body: `${why}. Các buổi chưa diễn ra đã được bỏ khỏi lịch của ngựa.`,
    link: links.horse(horse.id, 'training'),
  });
}

function zoneLabel(zone?: Zone): string | undefined {
  return zone ? zone.name : undefined;
}

/* ===== F1.1 — danh sách ngựa ===== */

export interface HorseFilters {
  search?: string;
  healthStatus?: HealthStatus;
  lifecycleStatus?: LifecycleStatus;
  sex?: HorseSex;
  distancePreference?: DistancePreference;
  /** 'NONE' = chưa xếp khu. */
  zoneId?: string;
  /** 'WAITING' = đang chờ xếp khu / ô / Groom. */
  placement?: HorsePlacement | 'WAITING';
  /** HT: ngựa trong khu mình; GROOM: ngựa được giao. OWNER luôn chỉ thấy ngựa của mình. */
  mine?: boolean;
  /** Chỉ CM. */
  includeDeleted?: boolean;
}

export interface HorseRow {
  id: string;
  name: string;
  avatar?: string;
  chipNumber?: string;
  sex: HorseSex;
  breed?: string;
  age?: number;
  distancePreference?: DistancePreference;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  deleted: boolean;
  placement: HorsePlacement;
  zoneId?: string;
  zoneName?: string;
  stallCode?: string;
  groomName?: string;
  ownerName?: string;
  locked: boolean;
  lockReason?: string;
  hasOpenCase: boolean;
  train: RuleCheck;
  race: RuleCheck;
  inMyScope: boolean;
  /** Cần chú ý: không được tập/đua hoặc đang chờ xếp chỗ. */
  attention: boolean;
}

const WAITING: HorsePlacement[] = ['NO_ZONE', 'WAITING_STALL', 'WAITING_GROOM'];

function inMyScope(db: Database, user: User, horse: Horse): boolean {
  if (user.role === 'HEAD_TRAINER') return !!horse.zoneId && managedZoneIds(db, user.id).includes(horse.zoneId);
  if (user.role === 'GROOM') return horse.groomId === user.id;
  if (user.role === 'HORSE_OWNER') return horse.ownerId === user.id;
  return true;
}

function toRow(db: Database, user: User, horse: Horse, at: Date): HorseRow {
  const lock = activeLock(db, horse.id);
  const train = canTrainAtAll(db, horse);
  const race = canRace(db, horse);
  const placement = placementOf(horse);
  const readonly = !isHorseWritable(horse);
  const noMedical = user.role === 'GROOM';
  return {
    id: horse.id,
    name: horse.name,
    avatar: horse.avatar,
    chipNumber: horse.chipNumber,
    sex: horse.sex,
    breed: horse.breed,
    age: ageOf(horse.birthDate, at),
    distancePreference: horse.distancePreference,
    healthStatus: horse.healthStatus,
    lifecycleStatus: horse.lifecycleStatus,
    deleted: !!horse.deletedAt,
    placement,
    zoneId: horse.zoneId,
    zoneName: zoneLabel(zoneOf(db, horse)),
    stallCode: stallOf(db, horse)?.code,
    groomName: horse.groomId ? userName(db, horse.groomId) : undefined,
    ownerName: horse.ownerId ? userName(db, horse.ownerId) : undefined,
    locked: !!lock,
    lockReason: noMedical ? undefined : lock?.reason,
    hasOpenCase: noMedical ? false : !!openCaseOf(db, horse.id),
    train,
    race,
    inMyScope: inMyScope(db, user, horse),
    attention:
      !readonly &&
      (WAITING.includes(placement) || (horse.lifecycleStatus === 'ACTIVE' && (!train.allowed || !race.allowed))),
  };
}

function scopedHorses(db: Database, user: User, opts: { mine?: boolean; includeDeleted?: boolean }): Horse[] {
  const withDeleted = !!opts.includeDeleted && can(user, 'horse.viewDeleted');
  return visibleHorses(db, user).filter((horse) => {
    if (horse.deletedAt && !withDeleted) return false;
    if (opts.mine && (user.role === 'HEAD_TRAINER' || user.role === 'GROOM')) return inMyScope(db, user, horse);
    return true;
  });
}

export function listHorses(filters: HorseFilters = {}): Promise<HorseRow[]> {
  return query((db) => {
    const user = requirePermission('horse.view');
    const at = now();
    const search = clean(filters.search)?.toLowerCase();
    const rows = scopedHorses(db, user, filters)
      .filter((horse) => {
        if (search && !horse.name.toLowerCase().includes(search) && !(horse.chipNumber ?? '').toLowerCase().includes(search)) {
          return false;
        }
        if (filters.healthStatus && horse.healthStatus !== filters.healthStatus) return false;
        if (filters.lifecycleStatus && horse.lifecycleStatus !== filters.lifecycleStatus) return false;
        if (filters.sex && horse.sex !== filters.sex) return false;
        if (filters.distancePreference && horse.distancePreference !== filters.distancePreference) return false;
        if (filters.zoneId === 'NONE' && horse.zoneId) return false;
        if (filters.zoneId && filters.zoneId !== 'NONE' && horse.zoneId !== filters.zoneId) return false;
        if (filters.placement) {
          const placement = placementOf(horse);
          if (filters.placement === 'WAITING' ? !WAITING.includes(placement) : placement !== filters.placement) return false;
        }
        return true;
      })
      .map((horse) => toRow(db, user, horse, at));
    const rank = (row: HorseRow) => (row.deleted || row.lifecycleStatus === 'TRANSFERRED' ? 2 : row.attention ? 0 : 1);
    return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'vi'));
  });
}

export interface HorseListSummary {
  total: number;
  byHealth: Record<HealthStatus, number>;
  waitingPlacement: number;
  noZone: number;
}

/** Số liệu cho dải KPI của danh sách ngựa (chỉ tính ngựa còn ở câu lạc bộ). */
export function getHorseListSummary(opts: { mine?: boolean } = {}): Promise<HorseListSummary> {
  return query((db) => {
    const user = requirePermission('horse.view');
    const horses = scopedHorses(db, user, { mine: opts.mine }).filter(isHorseWritable);
    const byHealth: Record<HealthStatus, number> = { ELIGIBLE: 0, UNDER_OBSERVATION: 0, INJURED: 0, QUARANTINED: 0 };
    horses.forEach((horse) => {
      byHealth[horse.healthStatus] += 1;
    });
    return {
      total: horses.length,
      byHealth,
      waitingPlacement: horses.filter((horse) => WAITING.includes(placementOf(horse))).length,
      noZone: horses.filter((horse) => placementOf(horse) === 'NO_ZONE').length,
    };
  });
}

/* ===== F1.3 — chi tiết hồ sơ ===== */

export interface HorseRef {
  /** Không có id = người xem không có quyền mở hồ sơ này. */
  id?: string;
  name: string;
}

export interface HorseDetail {
  id: string;
  version: number;
  name: string;
  avatar?: string;
  chipNumber?: string;
  sex: HorseSex;
  breed?: string;
  color?: string;
  birthDate?: string;
  age?: number;
  distancePreference?: DistancePreference;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  createdAt: string;
  deleted: boolean;
  deletedAt?: string;
  deleteReason?: string;
  deletedByName?: string;
  owner?: { id: string; name: string; active: boolean; isOwnerRole: boolean };
  zone?: { id: string; code: string; name: string; headTrainerName?: string };
  stall?: { id: string; code: string };
  groom?: { id: string; name: string; active: boolean };
  sire?: HorseRef;
  dam?: HorseRef;
  sireId?: string;
  damId?: string;
  readOnly: boolean;
  activeLock?: { reason: string; placedAt: string; expectedLiftDate?: string };
  openCase?: { id: string; title: string };
  activeClassCount: number;
  train: RuleCheck;
  race: RuleCheck;
  placement: HorsePlacement;
  /** Ngựa cách ly: gợi ý HT cân nhắc chuyển sang ô trống để tách đàn. */
  quarantineHint: boolean;
  canEditIdentity: boolean;
  canEditPreference: boolean;
  canAvatar: boolean;
  canAssignOwner: boolean;
  canAssignZone: boolean;
  canAssignStall: boolean;
  canAssignGroom: boolean;
  canRecordMetrics: boolean;
  canDeleteMetrics: boolean;
  canLifecycle: boolean;
  canDelete: boolean;
  canViewMedical: boolean;
  canViewTraining: boolean;
  canViewAudit: boolean;
}

function horseRef(db: Database, user: User, horseId?: string): HorseRef | undefined {
  const horse = findHorse(db, horseId);
  if (!horse) return undefined;
  return { id: canViewHorse(db, user, horse.id) ? horse.id : undefined, name: horse.name };
}

export function getHorse(id: string): Promise<HorseDetail> {
  return query((db) => {
    const user = requirePermission('horse.view');
    const horse = viewableHorse(db, user, id);
    const at = now();
    const readOnly = !isHorseWritable(horse);
    const owner = findUser(db, horse.ownerId);
    const zone = zoneOf(db, horse);
    const stall = stallOf(db, horse);
    const groom = findUser(db, horse.groomId);
    const lock = activeLock(db, horse.id);
    const openCase = openCaseOf(db, horse.id);
    const isGroom = user.role === 'GROOM';
    const canLockView = can(user, 'lock.view');
    const canMedical = can(user, 'medical.view');
    const scope = (key: string) => inActionScope(db, user, key, horse.id);
    return {
      id: horse.id,
      version: horse.version,
      name: horse.name,
      avatar: horse.avatar,
      chipNumber: horse.chipNumber,
      sex: horse.sex,
      breed: horse.breed,
      color: horse.color,
      birthDate: horse.birthDate,
      age: ageOf(horse.birthDate, at),
      distancePreference: horse.distancePreference,
      healthStatus: horse.healthStatus,
      lifecycleStatus: horse.lifecycleStatus,
      createdAt: horse.createdAt,
      deleted: !!horse.deletedAt,
      deletedAt: horse.deletedAt,
      deleteReason: horse.deleteReason,
      deletedByName: horse.deletedBy ? userName(db, horse.deletedBy) : undefined,
      owner: owner
        ? { id: owner.id, name: owner.name, active: owner.active, isOwnerRole: owner.role === 'HORSE_OWNER' }
        : undefined,
      zone: zone
        ? { id: zone.id, code: zone.code, name: zone.name, headTrainerName: zone.headTrainerId ? userName(db, zone.headTrainerId) : undefined }
        : undefined,
      stall: stall ? { id: stall.id, code: stall.code } : undefined,
      groom: groom ? { id: groom.id, name: groom.name, active: groom.active } : undefined,
      sire: horseRef(db, user, horse.sireId),
      dam: horseRef(db, user, horse.damId),
      sireId: user.role === 'HORSE_OWNER' ? undefined : horse.sireId,
      damId: user.role === 'HORSE_OWNER' ? undefined : horse.damId,
      readOnly,
      activeLock: lock && canLockView ? { reason: lock.reason, placedAt: lock.placedAt, expectedLiftDate: lock.expectedLiftDate } : undefined,
      openCase: openCase && canMedical ? { id: openCase.id, title: openCase.title ?? 'Bệnh án đang mở' } : undefined,
      activeClassCount: isGroom ? 0 : activeEnrollments(db, horse.id, toDateKey(at)).length,
      train: canTrainAtAll(db, horse),
      race: canRace(db, horse),
      placement: placementOf(horse),
      quarantineHint: horse.healthStatus === 'QUARANTINED' && !readOnly && !isGroom,
      canEditIdentity: !readOnly && scope('horse.edit.identity'),
      canEditPreference: !readOnly && scope('horse.edit.preference'),
      canAvatar: !readOnly && scope('horse.avatar'),
      canAssignOwner: !readOnly && scope('owner.assign'),
      canAssignZone: !readOnly && scope('zone.assignHorse'),
      canAssignStall: !readOnly && !!horse.zoneId && scope('stall.assign'),
      canAssignGroom: !readOnly && !!horse.zoneId && scope('groom.assign'),
      canRecordMetrics: !readOnly && scope('measurement.add'),
      canDeleteMetrics: !readOnly && scope('measurement.delete'),
      canLifecycle: can(user, 'horse.lifecycle'),
      canDelete: can(user, 'horse.delete'),
      canViewMedical: !isGroom && canMedical,
      canViewTraining: !isGroom && (can(user, 'class.view') || can(user, 'progress.view')),
      canViewAudit: can(user, 'admin.audit'),
    };
  });
}

/* ===== Phả hệ ===== */

export interface PedigreeNode {
  id?: string;
  name: string;
  sex?: HorseSex;
  birthYear?: number;
  lifecycleStatus?: LifecycleStatus;
  deleted?: boolean;
  /** OWNER xem tổ tiên không thuộc sở hữu: chỉ có tên và vị trí. */
  restricted: boolean;
}

export interface Pedigree {
  horse: PedigreeNode;
  sire?: PedigreeNode;
  dam?: PedigreeNode;
  sireSire?: PedigreeNode;
  sireDam?: PedigreeNode;
  damSire?: PedigreeNode;
  damDam?: PedigreeNode;
}

export function getPedigree(id: string): Promise<Pedigree> {
  return query((db) => {
    const user = requirePermission('horse.view');
    const horse = viewableHorse(db, user, id);
    const node = (target?: Horse): PedigreeNode | undefined => {
      if (!target) return undefined;
      if (!canViewHorse(db, user, target.id)) return { name: target.name, restricted: true };
      return {
        id: target.id,
        name: target.name,
        sex: target.sex,
        birthYear: target.birthDate ? new Date(target.birthDate).getFullYear() : undefined,
        lifecycleStatus: target.lifecycleStatus,
        deleted: !!target.deletedAt,
        restricted: false,
      };
    };
    const sire = findHorse(db, horse.sireId);
    const dam = findHorse(db, horse.damId);
    return {
      horse: node(horse)!,
      sire: node(sire),
      dam: node(dam),
      sireSire: node(findHorse(db, sire?.sireId)),
      sireDam: node(findHorse(db, sire?.damId)),
      damSire: node(findHorse(db, dam?.sireId)),
      damDam: node(findHorse(db, dam?.damId)),
    };
  });
}

export interface ParentOption {
  id: string;
  name: string;
  sex: HorseSex;
  birthDate?: string;
  chipNumber?: string;
  lifecycleStatus: LifecycleStatus;
}

/** Ngựa chọn được làm cha/mẹ: có hồ sơ tại CLB (kể cả giải nghệ/chuyển nhượng), chưa xóa, đúng giới tính, không tạo vòng lặp. */
export function listParentOptions(role: 'sire' | 'dam', horseId?: string): Promise<ParentOption[]> {
  return query((db) => {
    requirePermission('pedigree.edit');
    return db.horses
      .filter((horse) => {
        if (horse.deletedAt || horse.id === horseId) return false;
        if (role === 'sire' ? horse.sex === 'FEMALE' : horse.sex !== 'FEMALE') return false;
        if (horseId && isAncestorOf(db, horseId, horse.id)) return false;
        return true;
      })
      .map((horse) => ({
        id: horse.id,
        name: horse.name,
        sex: horse.sex,
        birthDate: horse.birthDate,
        chipNumber: horse.chipNumber,
        lifecycleStatus: horse.lifecycleStatus,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  });
}

/* ===== Danh sách chọn ===== */

export interface PersonOption {
  id: string;
  name: string;
  email: string;
}

export function listOwnerAccounts(): Promise<PersonOption[]> {
  return query((db) => {
    requireUser();
    return db.users
      .filter((user) => user.role === 'HORSE_OWNER' && user.active)
      .map((user) => ({ id: user.id, name: user.name, email: user.email }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  });
}

export interface GroomOption extends PersonOption {
  horseCount: number;
}

export function listGrooms(): Promise<GroomOption[]> {
  return query((db) => {
    requireUser();
    return db.users
      .filter((user) => user.role === 'GROOM' && user.active)
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        horseCount: horsesOfGroom(db, user.id).filter(isHorseWritable).length,
      }))
      .sort((a, b) => a.horseCount - b.horseCount || a.name.localeCompare(b.name, 'vi'));
  });
}

export interface ZoneOption {
  id: string;
  code: string;
  name: string;
  headTrainerName?: string;
  free: number;
  available: boolean;
  /** Lý do không chọn được. */
  reason?: string;
}

function zoneAvailability(db: Database, zone: Zone): { available: boolean; reason?: string; free: number } {
  const free = zoneCapacity(db, zone.id).free;
  if (zone.status !== 'ACTIVE') return { available: false, reason: `Khu đang ${zone.status === 'CLOSED' ? 'đóng' : 'bảo trì'}`, free };
  if (!trainerOfZone(db, zone.id)) return { available: false, reason: 'Khu chưa có HT phụ trách', free };
  if (free <= 0) return { available: false, reason: 'Khu đã hết chỗ trống', free };
  return { available: true, free };
}

export function listZoneOptions(): Promise<ZoneOption[]> {
  return query((db) => {
    requireUser();
    return db.zones
      .filter((zone) => !zone.deletedAt)
      .map((zone) => ({
        id: zone.id,
        code: zone.code,
        name: zone.name,
        headTrainerName: zone.headTrainerId ? userName(db, zone.headTrainerId) : undefined,
        ...zoneAvailability(db, zone),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  });
}

/* ===== F1.2 / F1.4 — tạo và sửa hồ sơ ===== */

export interface HorseInput {
  name?: string;
  sex?: HorseSex;
  breed?: string;
  color?: string;
  birthDate?: string;
  chipNumber?: string;
  distancePreference?: DistancePreference | '';
  sireId?: string;
  damId?: string;
  ownerId?: string;
  avatar?: string;
  /** Chỉ dùng khi tạo mới. */
  zoneId?: string;
}

function validateChip(db: Database, chip: string | undefined, selfId?: string) {
  if (!chip) return;
  if (!/^[0-9A-Za-z-]{6,20}$/.test(chip)) throw new AppError('Số chip gồm 6–20 ký tự chữ hoặc số', 'chipNumber');
  const clash = db.horses.find(
    (horse) => horse.id !== selfId && (horse.chipNumber ?? '').trim().toLowerCase() === chip.toLowerCase(),
  );
  if (clash) {
    const state = clash.deletedAt ? ' (hồ sơ đã xóa)' : clash.lifecycleStatus === 'TRANSFERRED' ? ' (đã chuyển nhượng)' : '';
    throw new AppError(`Số chip đã được dùng cho ngựa ${clash.name}${state}`, 'chipNumber');
  }
}

function validateBirthDate(birthDate: string | undefined, at: Date) {
  if (!birthDate) return;
  if (Number.isNaN(new Date(birthDate).getTime())) throw new AppError('Ngày sinh không hợp lệ', 'birthDate');
  if (birthDate > toDateKey(at)) throw new AppError('Ngày sinh không được ở tương lai', 'birthDate');
}

function validateParent(
  db: Database,
  role: 'sire' | 'dam',
  parentId: string | undefined,
  child: { id?: string; birthDate?: string },
) {
  if (!parentId) return;
  const field = role === 'sire' ? 'sireId' : 'damId';
  const title = role === 'sire' ? 'cha' : 'mẹ';
  const parent = findHorse(db, parentId);
  if (!parent || parent.deletedAt) throw new AppError(`Không tìm thấy ngựa ${title}, hoặc hồ sơ đã bị xóa`, field);
  if (child.id && parent.id === child.id) throw new AppError(`Ngựa không thể là ${title} của chính nó`, field);
  if (role === 'sire' && parent.sex === 'FEMALE') throw new AppError('Ngựa cha phải là ngựa đực hoặc đực đã thiến', field);
  if (role === 'dam' && parent.sex !== 'FEMALE') throw new AppError('Ngựa mẹ phải là ngựa cái', field);
  if (child.id && isAncestorOf(db, child.id, parent.id)) {
    throw new AppError(`${parent.name} là hậu duệ của ngựa này — chọn làm ${title} sẽ tạo vòng lặp phả hệ`, field);
  }
  if (child.birthDate && parent.birthDate && parent.birthDate >= child.birthDate) {
    throw new AppError(
      `Ngày sinh của ${title} (${formatDate(parent.birthDate)}) phải trước ngày sinh của ngựa (${formatDate(child.birthDate)})`,
      field,
    );
  }
}

function validateParents(db: Database, child: { id?: string; birthDate?: string }, sireId?: string, damId?: string) {
  validateParent(db, 'sire', sireId, child);
  validateParent(db, 'dam', damId, child);
  if (sireId && damId && sireId === damId) throw new AppError('Cha và mẹ phải là hai ngựa khác nhau', 'damId');
}

function validateOwner(db: Database, ownerId: string | undefined) {
  if (!ownerId) return;
  const owner = findUser(db, ownerId);
  if (!owner || owner.role !== 'HORSE_OWNER') throw new AppError('Chủ sở hữu phải là tài khoản có vai trò Chủ ngựa', 'ownerId');
  if (!owner.active) throw new AppError(`Tài khoản ${owner.name} đang bị khóa, không gán làm chủ được`, 'ownerId');
}

function assertZoneAssignable(db: Database, zoneId: string, field = 'zoneId'): Zone {
  const zone = db.zones.find((item) => item.id === zoneId && !item.deletedAt);
  if (!zone) throw new AppError('Không tìm thấy khu chuồng', field);
  const check = zoneAvailability(db, zone);
  if (!check.available) throw new AppError(`Không xếp được vào ${zone.name}: ${check.reason?.toLowerCase()}`, field);
  return zone;
}

export function createHorse(input: HorseInput): Promise<{ id: string }> {
  return commit((db) => {
    const actor = requirePermission('horse.create');
    const at = now();
    const name = clean(input.name);
    if (!name) throw new AppError('Vui lòng nhập tên ngựa', 'name');
    if (name.length > 60) throw new AppError('Tên ngựa tối đa 60 ký tự', 'name');
    if (!input.sex) throw new AppError('Vui lòng chọn giới tính', 'sex');
    const birthDate = clean(input.birthDate);
    const chipNumber = clean(input.chipNumber);
    const sireId = clean(input.sireId);
    const damId = clean(input.damId);
    const ownerId = clean(input.ownerId);
    const zoneId = clean(input.zoneId);
    validateBirthDate(birthDate, at);
    validateChip(db, chipNumber);
    validateParents(db, { birthDate }, sireId, damId);
    validateOwner(db, ownerId);
    const zone = zoneId ? assertZoneAssignable(db, zoneId) : undefined;

    const horse: Horse = {
      id: newId('h'),
      name,
      sex: input.sex,
      breed: clean(input.breed),
      color: clean(input.color),
      birthDate,
      chipNumber,
      distancePreference: clean(input.distancePreference) as DistancePreference | undefined,
      healthStatus: 'ELIGIBLE',
      lifecycleStatus: 'ACTIVE',
      sireId,
      damId,
      avatar: clean(input.avatar),
      ownerId,
      zoneId: zone?.id,
      ...stamp(at),
    };
    db.horses.push(horse);

    if (zone) {
      notifyMany(db, at, [trainerOfZone(db, zone.id)], {
        level: 'NORMAL',
        title: `Xếp khu: ${horse.name} vào ${zone.name}`,
        body: 'Ngựa mới đang chờ xếp ô và phân công Groom.',
        link: links.stable,
      });
    }
    if (ownerId) {
      notifyMany(db, at, [ownerId], {
        level: 'NORMAL',
        title: `Hồ sơ ${horse.name} đã được tạo`,
        body: zone ? `Ngựa được xếp vào ${zone.name}.` : 'Ngựa đang chờ xếp khu chuồng.',
        link: links.horse(horse.id),
      });
    }
    writeAudit(db, at, {
      action: 'Tạo hồ sơ ngựa',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      after: {
        name,
        sex: sexLabel[horse.sex],
        chipNumber,
        birthDate,
        sire: sireId ? findHorse(db, sireId)?.name : undefined,
        dam: damId ? findHorse(db, damId)?.name : undefined,
        owner: ownerId ? userName(db, ownerId) : undefined,
        zone: zone?.name,
      },
      actor,
    });
    return { id: horse.id };
  });
}

type EditableKey = Exclude<keyof HorseInput, 'zoneId'>;
const EDITABLE_KEYS: EditableKey[] = [
  'name',
  'sex',
  'breed',
  'color',
  'birthDate',
  'chipNumber',
  'distancePreference',
  'sireId',
  'damId',
  'ownerId',
  'avatar',
];

export function updateHorse(id: string, input: HorseInput & { version?: number }): Promise<{ id: string }> {
  return commit((db) => {
    const actor = requirePermission('horse.view');
    const at = now();
    const horse = viewableHorse(db, actor, id);
    if (!isHorseWritable(horse)) throw new AppError(READONLY_MESSAGE);
    assertVersion(horse, input.version);
    if (input.zoneId !== undefined && clean(input.zoneId) !== horse.zoneId) {
      throw new AppError('Đổi khu chuồng thực hiện ở sơ đồ chuồng', 'zoneId');
    }

    // Các trường thực sự thay đổi so với hồ sơ hiện tại.
    const changed = EDITABLE_KEYS.filter((key) => {
      if (!(key in input)) return false;
      return clean(input[key] as string | undefined) !== clean(horse[key] as string | undefined);
    });
    if (changed.length === 0) return { id: horse.id };

    const isManager = inActionScope(db, actor, 'horse.edit.identity', horse.id);
    if (!isManager) {
      if (!inActionScope(db, actor, 'horse.edit.preference', horse.id)) throw new AppError(ERR_FORBIDDEN);
      const others = changed.filter((key) => key !== 'distancePreference');
      if (others.length > 0) {
        throw new AppError(
          `Bạn chỉ được sửa sở trường cự ly. Không được sửa: ${others.map((key) => FIELD_LABEL[key]).join(', ')}`,
          others[0],
        );
      }
    }

    const next = {
      name: 'name' in input ? clean(input.name) : horse.name,
      sex: input.sex ?? horse.sex,
      birthDate: 'birthDate' in input ? clean(input.birthDate) : horse.birthDate,
      chipNumber: 'chipNumber' in input ? clean(input.chipNumber) : horse.chipNumber,
      sireId: 'sireId' in input ? clean(input.sireId) : horse.sireId,
      damId: 'damId' in input ? clean(input.damId) : horse.damId,
      ownerId: 'ownerId' in input ? clean(input.ownerId) : horse.ownerId,
    };

    if (isManager) {
      if (!next.name) throw new AppError('Vui lòng nhập tên ngựa', 'name');
      if (next.name.length > 60) throw new AppError('Tên ngựa tối đa 60 ký tự', 'name');
      if (changed.includes('birthDate')) validateBirthDate(next.birthDate, at);
      if (changed.includes('chipNumber')) validateChip(db, next.chipNumber, horse.id);
      if (changed.some((key) => key === 'sireId' || key === 'damId' || key === 'birthDate')) {
        validateParents(db, { id: horse.id, birthDate: next.birthDate }, next.sireId, next.damId);
      }
      if (changed.includes('ownerId')) validateOwner(db, next.ownerId);

      const children = childrenOf(db, horse.id);
      // B.7 — ngày sinh của ngựa đang là cha/mẹ phải trước ngày sinh của mọi con, kể cả con đã xóa.
      if (changed.includes('birthDate') && next.birthDate) {
        const younger = children.filter((child) => child.birthDate && child.birthDate <= next.birthDate!);
        if (younger.length > 0) {
          throw new AppError(
            `Ngày sinh phải trước ngày sinh của con: ${younger.map((child) => `${child.name}${child.deletedAt ? ' (đã xóa)' : ''} (${formatDate(child.birthDate)})`).join(', ')}`,
            'birthDate',
          );
        }
      }
      // Đổi giới tính không được phá vai trò cha/mẹ hiện có.
      if (changed.includes('sex')) {
        const asSire = children.filter((child) => child.sireId === horse.id);
        const asDam = children.filter((child) => child.damId === horse.id);
        if (asSire.length > 0 && next.sex === 'FEMALE') {
          throw new AppError(`Ngựa đang là cha của ${asSire.map((child) => child.name).join(', ')} nên không đổi sang giống cái được`, 'sex');
        }
        if (asDam.length > 0 && next.sex !== 'FEMALE') {
          throw new AppError(`Ngựa đang là mẹ của ${asDam.map((child) => child.name).join(', ')} nên phải giữ giống cái`, 'sex');
        }
      }
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const display = (key: EditableKey, value: string | undefined) => {
      if (!value) return undefined;
      if (key === 'sex') return sexLabel[value as HorseSex];
      if (key === 'sireId' || key === 'damId') return findHorse(db, value)?.name;
      if (key === 'ownerId') return userName(db, value);
      if (key === 'avatar') return 'ảnh';
      return value;
    };
    changed.forEach((key) => {
      const label = FIELD_LABEL[key];
      before[label] = display(key, horse[key] as string | undefined);
      const value = clean(input[key] as string | undefined);
      after[label] = display(key, value);
      (horse as unknown as Record<string, unknown>)[key] = value;
    });
    touch(horse, at);

    if (changed.includes('ownerId') && horse.ownerId) {
      notifyMany(db, at, [horse.ownerId], {
        level: 'NORMAL',
        title: `Bạn là chủ sở hữu của ${horse.name}`,
        body: 'Quản lý câu lạc bộ vừa gán ngựa cho tài khoản của bạn.',
        link: links.horse(horse.id),
      });
    }
    writeAudit(db, at, {
      action: isManager ? 'Cập nhật hồ sơ ngựa' : 'Cập nhật sở trường cự ly',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before,
      after,
      actor,
    });
    return { id: horse.id };
  });
}

export function setAvatar(id: string, dataUrl: string | null): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('horse.avatar');
    const at = now();
    const horse = actionableHorse(db, actor, id, 'horse.avatar');
    horse.avatar = dataUrl ?? undefined;
    touch(horse, at);
    writeAudit(db, at, {
      action: dataUrl ? 'Thay ảnh đại diện' : 'Gỡ ảnh đại diện',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      actor,
    });
  });
}

export function setOwner(id: string, ownerId: string | null, reason?: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('owner.assign');
    const at = now();
    const horse = actionableHorse(db, actor, id, 'owner.assign');
    const nextId = clean(ownerId);
    if (nextId === horse.ownerId) throw new AppError('Ngựa đang thuộc chủ này rồi', 'ownerId');
    validateOwner(db, nextId);
    const before = horse.ownerId ? userName(db, horse.ownerId) : undefined;
    horse.ownerId = nextId;
    touch(horse, at);
    if (nextId) {
      notifyMany(db, at, [nextId], {
        level: 'NORMAL',
        title: `Bạn là chủ sở hữu của ${horse.name}`,
        body: 'Quản lý câu lạc bộ vừa gán ngựa cho tài khoản của bạn.',
        link: links.horse(horse.id),
      });
    }
    writeAudit(db, at, {
      action: nextId ? 'Đổi chủ sở hữu' : 'Bỏ trống chủ sở hữu',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before: { owner: before },
      after: { owner: nextId ? userName(db, nextId) : undefined },
      reason: clean(reason),
      actor,
    });
  });
}

/* ===== F2.1 — danh mục khu và ô ===== */

export interface StallRow {
  id: string;
  code: string;
  status: StallStatus;
  maintenanceNote?: string;
  horseId?: string;
  horseName?: string;
}

export interface ZoneRow {
  id: string;
  code: string;
  name: string;
  status: ZoneStatus;
  statusReason?: string;
  headTrainerId?: string;
  headTrainerName?: string;
  capacity: ZoneCapacity;
  openClassCount: number;
  stalls: StallRow[];
}

export interface ZoneCatalog {
  zones: ZoneRow[];
  canManage: boolean;
  headTrainers: PersonOption[];
}

export function listZones(): Promise<ZoneCatalog> {
  return query((db) => {
    const user = requirePermission('facility.view');
    const todayKey = toDateKey(now());
    const zones = db.zones
      .filter((zone) => !zone.deletedAt)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((zone) => ({
        id: zone.id,
        code: zone.code,
        name: zone.name,
        status: zone.status,
        statusReason: zone.statusReason,
        headTrainerId: zone.headTrainerId,
        headTrainerName: zone.headTrainerId ? userName(db, zone.headTrainerId) : undefined,
        capacity: zoneCapacity(db, zone.id),
        openClassCount: openClassesOfZone(db, zone.id, todayKey).length,
        stalls: db.stalls
          .filter((stall) => stall.zoneId === zone.id && !stall.deletedAt)
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((stall) => {
            const horse = db.horses.find((item) => item.stallId === stall.id && !item.deletedAt);
            return {
              id: stall.id,
              code: stall.code,
              status: stall.status,
              maintenanceNote: stall.maintenanceNote,
              horseId: horse?.id,
              horseName: horse?.name,
            };
          }),
      }));
    const canManage = can(user, 'zone.manage');
    return {
      zones,
      canManage,
      headTrainers: canManage
        ? db.users
            .filter((item) => item.role === 'HEAD_TRAINER' && item.active)
            .map((item) => ({ id: item.id, name: item.name, email: item.email }))
        : [],
    };
  });
}

function findZone(db: Database, zoneId: string): Zone {
  const zone = db.zones.find((item) => item.id === zoneId && !item.deletedAt);
  if (!zone) throw new AppError('Không tìm thấy khu chuồng');
  return zone;
}

function validateHeadTrainer(db: Database, userId: string): User {
  const trainer = findUser(db, userId);
  if (!trainer || trainer.role !== 'HEAD_TRAINER') throw new AppError('Người phụ trách phải là Huấn luyện viên trưởng', 'headTrainerId');
  if (!trainer.active) throw new AppError(`Tài khoản ${trainer.name} đang bị khóa`, 'headTrainerId');
  return trainer;
}

function validateZoneCode(db: Database, code: string | undefined, selfId?: string): string {
  if (!code) throw new AppError('Vui lòng nhập mã khu', 'code');
  const normalized = code.toUpperCase();
  if (!/^[A-Z0-9]{1,4}$/.test(normalized)) throw new AppError('Mã khu gồm 1–4 chữ cái hoặc số, ví dụ A, B2', 'code');
  const clash = db.zones.find((zone) => zone.id !== selfId && !zone.deletedAt && zone.code.toUpperCase() === normalized);
  if (clash) throw new AppError(`Mã khu ${normalized} đã được dùng cho ${clash.name}`, 'code');
  return normalized;
}

export function createZone(input: { code: string; name: string; headTrainerId?: string }): Promise<{ id: string }> {
  return commit((db) => {
    const actor = requirePermission('zone.manage');
    const at = now();
    const code = validateZoneCode(db, clean(input.code));
    const name = clean(input.name);
    if (!name) throw new AppError('Vui lòng nhập tên khu', 'name');
    const headTrainerId = clean(input.headTrainerId);
    if (headTrainerId) validateHeadTrainer(db, headTrainerId);
    const zone: Zone = { id: newId('zone'), code, name, headTrainerId, status: 'ACTIVE', ...stamp(at) };
    db.zones.push(zone);
    if (headTrainerId) {
      notifyMany(db, at, [headTrainerId], {
        level: 'NORMAL',
        title: `Bạn phụ trách ${zone.name}`,
        body: 'Quản lý câu lạc bộ vừa giao khu chuồng mới cho bạn.',
        link: links.stable,
      });
    }
    writeAudit(db, at, {
      action: 'Thêm khu chuồng',
      entityType: 'Zone',
      entityId: zone.id,
      after: { code, name, headTrainer: headTrainerId ? userName(db, headTrainerId) : undefined },
      actor,
    });
    return { id: zone.id };
  });
}

export function updateZone(id: string, input: { name?: string; code?: string }): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('zone.manage');
    const at = now();
    const zone = findZone(db, id);
    const name = clean(input.name) ?? zone.name;
    const code = input.code !== undefined ? validateZoneCode(db, clean(input.code), zone.id) : zone.code;
    const before = { code: zone.code, name: zone.name };
    zone.name = name;
    zone.code = code;
    touch(zone, at);
    writeAudit(db, at, { action: 'Sửa khu chuồng', entityType: 'Zone', entityId: zone.id, before, after: { code, name }, actor });
  });
}

export function setZoneHeadTrainer(zoneId: string, userId: string | null): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('zone.manage');
    const at = now();
    const zone = findZone(db, zoneId);
    const nextId = clean(userId);
    if (nextId === zone.headTrainerId) throw new AppError('Khu đang do người này phụ trách', 'headTrainerId');
    const horseCount = horsesOfZone(db, zone.id).length;
    if (!nextId && horseCount > 0) {
      throw new AppError(`${zone.name} còn ${horseCount} ngựa nên không gỡ HT phụ trách được — chỉ đổi sang HT khác`, 'headTrainerId');
    }
    if (nextId) validateHeadTrainer(db, nextId);
    const previous = zone.headTrainerId;
    zone.headTrainerId = nextId;
    touch(zone, at);
    if (nextId) {
      notifyMany(db, at, [nextId], {
        level: 'NORMAL',
        title: `Bạn phụ trách ${zone.name}`,
        body: `${horseCount} ngựa trong khu và các lớp của khu chuyển sang bạn quản lý.`,
        link: links.stable,
      });
    }
    notifyMany(db, at, [previous], {
      level: 'NORMAL',
      title: `Kết thúc phụ trách ${zone.name}`,
      body: nextId ? `Khu được giao cho ${userName(db, nextId)}.` : 'Khu hiện chưa có HT phụ trách.',
      link: links.stable,
    });
    writeAudit(db, at, {
      action: 'Đổi HT phụ trách khu',
      entityType: 'Zone',
      entityId: zone.id,
      before: { headTrainer: previous ? userName(db, previous) : undefined },
      after: { headTrainer: nextId ? userName(db, nextId) : undefined },
      actor,
    });
  });
}

export function setZoneStatus(zoneId: string, status: ZoneStatus, reason: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('zone.manage');
    const at = now();
    const zone = findZone(db, zoneId);
    const why = requireReason(reason);
    if (zone.status === status) throw new AppError('Khu đang ở trạng thái này rồi', 'status');
    const horseCount = horsesOfZone(db, zone.id).length;
    if (status !== 'ACTIVE' && horseCount > 0) {
      throw new AppError(`${zone.name} còn ${horseCount} ngựa nên không chuyển sang Đóng hoặc Bảo trì được`, 'status');
    }
    const before = zone.status;
    zone.status = status;
    zone.statusReason = status === 'ACTIVE' ? undefined : why;
    touch(zone, at);
    writeAudit(db, at, {
      action: 'Đổi trạng thái khu',
      entityType: 'Zone',
      entityId: zone.id,
      before: { status: before },
      after: { status },
      reason: why,
      actor,
    });
  });
}

export function deleteZone(id: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('zone.manage');
    const at = now();
    const zone = findZone(db, id);
    const horseCount = horsesOfZone(db, zone.id).length;
    if (horseCount > 0) throw new AppError(`${zone.name} còn ${horseCount} ngựa nên không xóa được`);
    const classes = openClassesOfZone(db, zone.id, toDateKey(at));
    if (classes.length > 0) {
      throw new AppError(`${zone.name} còn ${classes.length} lớp chưa kết thúc (${classes.map((cls) => cls.name).join(', ')}) nên không xóa được`);
    }
    zone.deletedAt = at.toISOString();
    touch(zone, at);
    db.stalls.forEach((stall) => {
      if (stall.zoneId === zone.id && !stall.deletedAt) {
        stall.deletedAt = at.toISOString();
        touch(stall, at);
      }
    });
    writeAudit(db, at, { action: 'Xóa khu chuồng', entityType: 'Zone', entityId: zone.id, before: { code: zone.code, name: zone.name }, actor });
  });
}

export function createStalls(zoneId: string, count: number): Promise<{ codes: string[] }> {
  return commit((db) => {
    const actor = requirePermission('stall.manage');
    const at = now();
    const zone = findZone(db, zoneId);
    if (!Number.isInteger(count) || count < 1 || count > 30) throw new AppError('Số ô thêm mỗi lần từ 1 đến 30', 'count');
    const prefix = `${zone.code}-`;
    let max = db.stalls
      .filter((stall) => stall.zoneId === zone.id && stall.code.startsWith(prefix))
      .reduce((best, stall) => Math.max(best, Number.parseInt(stall.code.slice(prefix.length), 10) || 0), 0);
    const codes: string[] = [];
    for (let index = 0; index < count; index += 1) {
      max += 1;
      const code = `${prefix}${String(max).padStart(2, '0')}`;
      db.stalls.push({ id: newId('stall'), code, zoneId: zone.id, status: 'AVAILABLE', ...stamp(at) });
      codes.push(code);
    }
    writeAudit(db, at, { action: 'Thêm ô chuồng', entityType: 'Zone', entityId: zone.id, after: { codes: codes.join(', ') }, actor });
    return { codes };
  });
}

function findStall(db: Database, stallId: string) {
  const stall = db.stalls.find((item) => item.id === stallId && !item.deletedAt);
  if (!stall) throw new AppError('Không tìm thấy ô chuồng');
  return stall;
}

function stallHasHorse(db: Database, stallId: string) {
  return db.horses.find((horse) => horse.stallId === stallId && !horse.deletedAt);
}

export function deleteStall(stallId: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('stall.manage');
    const at = now();
    const stall = findStall(db, stallId);
    const horse = stallHasHorse(db, stall.id);
    if (horse || stall.status === 'OCCUPIED') throw new AppError(`Ô ${stall.code} đang có ngựa${horse ? ` ${horse.name}` : ''}, không xóa được`);
    if (stall.status === 'AVAILABLE') {
      const cap = zoneCapacity(db, stall.zoneId);
      if (cap.free - 1 < 0) {
        throw new AppError(
          `Không xóa được ô ${stall.code}: khu sẽ thiếu chỗ cho ${cap.waitingForStall} ngựa đang chờ xếp ô`,
        );
      }
    }
    stall.deletedAt = at.toISOString();
    touch(stall, at);
    writeAudit(db, at, { action: 'Xóa ô chuồng', entityType: 'Stall', entityId: stall.id, before: { code: stall.code }, actor });
  });
}

export function setStallMaintenance(stallId: string, on: boolean, note?: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('stall.manage');
    const at = now();
    const stall = findStall(db, stallId);
    const horse = stallHasHorse(db, stall.id);
    if (horse || stall.status === 'OCCUPIED') throw new AppError(`Ô ${stall.code} đang có ngựa, chỉ đổi trạng thái được khi ô trống`);
    if (on) {
      if (stall.status === 'MAINTENANCE') throw new AppError(`Ô ${stall.code} đang bảo trì rồi`);
      const cap = zoneCapacity(db, stall.zoneId);
      if (cap.free - 1 < 0) {
        throw new AppError(
          `Không chuyển ô ${stall.code} sang bảo trì được: khu sẽ thiếu chỗ cho ${cap.waitingForStall} ngựa đang chờ xếp ô`,
        );
      }
      stall.status = 'MAINTENANCE';
      stall.maintenanceNote = clean(note);
    } else {
      if (stall.status !== 'MAINTENANCE') throw new AppError(`Ô ${stall.code} không ở trạng thái bảo trì`);
      stall.status = 'AVAILABLE';
      stall.maintenanceNote = undefined;
    }
    touch(stall, at);
    writeAudit(db, at, {
      action: on ? 'Chuyển ô sang bảo trì' : 'Kết thúc bảo trì ô',
      entityType: 'Stall',
      entityId: stall.id,
      after: { code: stall.code, status: stall.status, note: stall.maintenanceNote },
      actor,
    });
  });
}

/* ===== Sơ đồ chuồng ===== */

export interface MapHorse {
  id: string;
  name: string;
  avatar?: string;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  retired: boolean;
  locked: boolean;
  groomId?: string;
  groomName?: string;
  zoneId?: string;
  zoneName?: string;
  stallId?: string;
  stallCode?: string;
  quarantined: boolean;
}

export interface MapStall {
  id: string;
  code: string;
  status: StallStatus;
  maintenanceNote?: string;
  horse?: MapHorse;
}

export interface MapZone {
  id: string;
  code: string;
  name: string;
  status: ZoneStatus;
  statusReason?: string;
  headTrainerName?: string;
  capacity: ZoneCapacity;
  stalls: MapStall[];
  waitingStall: MapHorse[];
  waitingGroom: MapHorse[];
  /** HT của khu: xếp ô, đổi/gỡ ô, phân công Groom. */
  canManage: boolean;
}

export interface StableMapData {
  zones: MapZone[];
  noZone: MapHorse[];
  canAssignZone: boolean;
}

function mapHorse(db: Database, horse: Horse): MapHorse {
  const zone = zoneOf(db, horse);
  return {
    id: horse.id,
    name: horse.name,
    avatar: horse.avatar,
    healthStatus: horse.healthStatus,
    lifecycleStatus: horse.lifecycleStatus,
    retired: horse.lifecycleStatus === 'RETIRED',
    locked: !!activeLock(db, horse.id),
    groomId: horse.groomId,
    groomName: horse.groomId ? userName(db, horse.groomId) : undefined,
    zoneId: zone?.id,
    zoneName: zone?.name,
    stallId: horse.stallId,
    stallCode: stallOf(db, horse)?.code,
    quarantined: horse.healthStatus === 'QUARANTINED',
  };
}

export function getStableMap(): Promise<StableMapData> {
  return query((db) => {
    const user = requirePermission('facility.view');
    const alive = db.horses.filter(isHorseWritable);
    const zones = db.zones
      .filter((zone) => !zone.deletedAt)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((zone) => {
        const inZone = alive.filter((horse) => horse.zoneId === zone.id);
        return {
          id: zone.id,
          code: zone.code,
          name: zone.name,
          status: zone.status,
          statusReason: zone.statusReason,
          headTrainerName: zone.headTrainerId ? userName(db, zone.headTrainerId) : undefined,
          capacity: zoneCapacity(db, zone.id),
          stalls: db.stalls
            .filter((stall) => stall.zoneId === zone.id && !stall.deletedAt)
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((stall) => {
              const horse = inZone.find((item) => item.stallId === stall.id);
              return {
                id: stall.id,
                code: stall.code,
                status: stall.status,
                maintenanceNote: stall.maintenanceNote,
                horse: horse ? mapHorse(db, horse) : undefined,
              };
            }),
          waitingStall: inZone.filter((horse) => !horse.stallId).map((horse) => mapHorse(db, horse)),
          waitingGroom: inZone.filter((horse) => horse.stallId && !horse.groomId).map((horse) => mapHorse(db, horse)),
          canManage: inZoneScope(db, user, 'stall.assign', zone.id),
        };
      });
    return {
      zones,
      noZone: alive
        .filter((horse) => !horse.zoneId)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        .map((horse) => mapHorse(db, horse)),
      canAssignZone: can(user, 'zone.assignHorse'),
    };
  });
}

/* ===== F1.6 — xếp khu ===== */

export interface ZoneAssignmentPreview {
  horseName: string;
  zoneName: string;
  fromZoneName?: string;
  free: number;
  isChange: boolean;
  stallToFree?: string;
  classesToLeave: string[];
  groomKept?: string;
  /** Lý do chặn (rỗng = làm được). */
  blockers: string[];
}

function zoneAssignmentBlockers(db: Database, horse: Horse, zone: Zone): string[] {
  const blockers: string[] = [];
  if (horse.zoneId === zone.id) blockers.push(`Ngựa đang ở ${zone.name}`);
  const check = zoneAvailability(db, zone);
  if (!check.available && check.reason) blockers.push(check.reason);
  const running = runningSessionOf(db, horse.id);
  if (running) blockers.push(`Ngựa đang trong buổi tập ${running} — đợi buổi kết thúc rồi đổi khu`);
  return blockers;
}

export function previewZoneAssignment(horseId: string, zoneId: string): Promise<ZoneAssignmentPreview> {
  return query((db) => {
    const user = requirePermission('zone.assignHorse');
    const horse = actionableHorse(db, user, horseId, 'zone.assignHorse');
    const zone = findZone(db, zoneId);
    const from = zoneOf(db, horse);
    return {
      horseName: horse.name,
      zoneName: zone.name,
      fromZoneName: from?.name,
      free: zoneCapacity(db, zone.id).free,
      isChange: !!from,
      stallToFree: from ? stallOf(db, horse)?.code : undefined,
      classesToLeave: from ? openClassNames(db, horse.id, toDateKey(now()), from.id) : [],
      groomKept: horse.groomId ? userName(db, horse.groomId) : undefined,
      blockers: zoneAssignmentBlockers(db, horse, zone),
    };
  });
}

export function assignZone(horseId: string, zoneId: string, reason?: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('zone.assignHorse');
    const at = now();
    const horse = actionableHorse(db, actor, horseId, 'zone.assignHorse');
    const zone = findZone(db, zoneId);
    const blockers = zoneAssignmentBlockers(db, horse, zone);
    if (blockers.length > 0) throw new AppError(`Không xếp được vào ${zone.name}: ${blockers.join('; ')}`, 'zoneId');
    const from = zoneOf(db, horse);
    const why = clean(reason);
    if (from && !why) throw new AppError('Đổi khu cần nhập lý do', 'reason');

    let stallFreed: string | undefined;
    let classNames: string[] = [];
    if (from) {
      classNames = openClassNames(db, horse.id, toDateKey(at), from.id);
      stallFreed = vacateStall(db, horse, at);
      closeOpenEnrollments(db, horse.id, 'ZONE_CHANGE', at, actor.id, { zoneId: from.id, note: why });
    }
    horse.zoneId = zone.id;
    touch(horse, at);

    const groomName = horse.groomId ? userName(db, horse.groomId) : undefined;
    notifyMany(db, at, [trainerOfZone(db, zone.id)], {
      level: 'NORMAL',
      title: `Xếp khu: ${horse.name} vào ${zone.name}`,
      body: `Ngựa đang chờ xếp ô.${groomName ? ` Groom ${groomName} được giữ nguyên.` : ' Cần phân công Groom khi xếp ô.'}`,
      link: links.stable,
    });
    if (from) {
      notifyMany(db, at, [trainerOfZone(db, from.id)], {
        level: 'NORMAL',
        title: `${horse.name} rời ${from.name}`,
        body: `Ngựa chuyển sang ${zone.name}${classNames.length ? `, tự rút khỏi ${classNames.length} lớp của khu cũ` : ''}.`,
        link: links.horse(horse.id),
      });
      notifyMany(db, at, [horse.groomId], {
        level: 'NORMAL',
        title: `${horse.name} đổi sang ${zone.name}`,
        body: `Bạn vẫn là Groom phụ trách. Ngựa đang chờ HT ${zone.name} xếp ô.`,
        link: links.horse(horse.id),
      });
      notifyWithdrawn(db, at, horse, classNames, `Ngựa đổi sang ${zone.name}`);
    }
    writeAudit(db, at, {
      action: from ? 'Đổi khu chuồng' : 'Xếp khu chuồng',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before: { zone: from?.name, stall: stallFreed },
      after: { zone: zone.name, stall: undefined, classesLeft: classNames.length || undefined },
      reason: why,
      actor,
    });
  });
}

/* ===== F1.7 — xếp ô và phân công Groom ===== */

export function listAvailableStalls(zoneId: string): Promise<{ id: string; code: string }[]> {
  return query((db) => {
    requirePermission('facility.view');
    return db.stalls
      .filter((stall) => stall.zoneId === zoneId && !stall.deletedAt && stall.status === 'AVAILABLE')
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((stall) => ({ id: stall.id, code: stall.code }));
  });
}

function validateGroom(db: Database, groomId: string | undefined): User {
  if (!groomId) throw new AppError('Phải chọn Groom phụ trách khi xếp ô', 'groomId');
  const groom = findUser(db, groomId);
  if (!groom || groom.role !== 'GROOM') throw new AppError('Người được chọn không phải Groom', 'groomId');
  if (!groom.active) throw new AppError(`Tài khoản ${groom.name} đang bị khóa`, 'groomId');
  return groom;
}

function changeGroom(db: Database, at: Date, horse: Horse, nextId: string | undefined, reason?: string) {
  const previous = horse.groomId;
  if (previous === nextId) return false;
  horse.groomId = nextId;
  touch(horse, at);
  const stall = stallOf(db, horse);
  if (nextId) {
    notifyMany(db, at, [nextId], {
      level: 'NORMAL',
      title: `Phân công Groom: ${horse.name}`,
      body: `Bạn được giao chăm sóc ${horse.name}${stall ? ` tại ô ${stall.code}` : ''}.`,
      link: links.horse(horse.id),
    });
  }
  notifyMany(db, at, [previous], {
    level: 'NORMAL',
    title: `Kết thúc phân công: ${horse.name}`,
    body: nextId
      ? `${horse.name} được giao cho ${userName(db, nextId)}.${reason ? ` Lý do: ${reason}` : ''}`
      : `Bạn không còn phụ trách ${horse.name}.${reason ? ` Lý do: ${reason}` : ''}`,
    link: links.horse(horse.id),
  });
  return true;
}

export function assignStall(horseId: string, stallId: string, groomId: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('stall.assign');
    const at = now();
    const horse = actionableHorse(db, actor, horseId, 'stall.assign');
    if (!inActionScope(db, actor, 'groom.assign', horse.id)) throw new AppError(ERR_FORBIDDEN);
    const stall = db.stalls.find((item) => item.id === stallId && !item.deletedAt);
    if (!stall || stall.zoneId !== horse.zoneId) throw new AppError('Ô chuồng không thuộc khu của ngựa', 'stallId');
    if (horse.stallId === stall.id) throw new AppError(`Ngựa đang ở ô ${stall.code}`, 'stallId');
    if (stall.status !== 'AVAILABLE') {
      throw new AppError(
        stall.status === 'MAINTENANCE' ? `Ô ${stall.code} đang bảo trì` : `Ô ${stall.code} vừa có ngựa khác vào, vui lòng chọn ô khác`,
        'stallId',
      );
    }
    const groom = validateGroom(db, clean(groomId));
    const beforeStall = stallOf(db, horse)?.code;
    const beforeGroom = horse.groomId ? userName(db, horse.groomId) : undefined;
    occupyStall(db, horse, stall.id, at);
    changeGroom(db, at, horse, groom.id);
    writeAudit(db, at, {
      action: beforeStall ? 'Đổi ô chuồng' : 'Xếp ô chuồng',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before: { stall: beforeStall, groom: beforeGroom },
      after: { stall: stall.code, groom: groom.name },
      actor,
    });
  });
}

export function unassignStall(horseId: string, reason: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('stall.assign');
    const at = now();
    const horse = actionableHorse(db, actor, horseId, 'stall.assign');
    const why = requireReason(reason);
    if (!horse.stallId) throw new AppError('Ngựa chưa được xếp ô');
    const code = vacateStall(db, horse, at);
    writeAudit(db, at, {
      action: 'Gỡ ngựa khỏi ô',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before: { stall: code },
      after: { stall: undefined, placement: 'Chờ xếp ô' },
      reason: why,
      actor,
    });
  });
}

export function setGroom(horseId: string, groomId: string, reason?: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('groom.assign');
    const at = now();
    const horse = actionableHorse(db, actor, horseId, 'groom.assign');
    const groom = validateGroom(db, clean(groomId));
    if (horse.groomId === groom.id) throw new AppError(`${groom.name} đang phụ trách ngựa này`, 'groomId');
    const before = horse.groomId ? userName(db, horse.groomId) : undefined;
    const why = clean(reason);
    changeGroom(db, at, horse, groom.id, why);
    writeAudit(db, at, {
      action: before ? 'Đổi Groom phụ trách' : 'Phân công Groom',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before: { groom: before },
      after: { groom: groom.name },
      reason: why,
      actor,
    });
  });
}

export function unassignGroom(horseId: string, reason: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('groom.assign');
    const at = now();
    const horse = actionableHorse(db, actor, horseId, 'groom.assign');
    const why = requireReason(reason);
    if (!horse.groomId) throw new AppError('Ngựa chưa có Groom phụ trách');
    const before = userName(db, horse.groomId);
    changeGroom(db, at, horse, undefined, why);
    writeAudit(db, at, {
      action: 'Gỡ Groom phụ trách',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before: { groom: before },
      after: { groom: undefined },
      reason: why,
      actor,
    });
  });
}

/* ===== F1.5 — chỉ số cơ thể ===== */

export interface MeasurementRow {
  id: string;
  type: MeasurementType;
  value: number;
  measuredAt: string;
  recordedByName: string;
  abnormal: boolean;
  note?: string;
  source: 'MANUAL' | 'EXAM';
  sourceLabel: string;
  deleted: boolean;
  deleteReason?: string;
  deletedByName?: string;
  deletedAt?: string;
  canDelete: boolean;
}

export function listMeasurements(horseId: string, opts: { includeDeleted?: boolean } = {}): Promise<MeasurementRow[]> {
  return query((db) => {
    const user = requirePermission('horse.view');
    const horse = viewableHorse(db, user, horseId);
    const seeDeleted = !!opts.includeDeleted && (user.role === 'VETERINARIAN' || user.role === 'CLUB_MANAGER');
    const canDelete = isHorseWritable(horse) && inActionScope(db, user, 'measurement.delete', horse.id);
    return db.bodyMeasurements
      .filter((row) => row.horseId === horse.id && (!row.deletedAt || seeDeleted))
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
      .map((row) => {
        const exam = row.examinationId ? db.examinations.find((item) => item.id === row.examinationId) : undefined;
        return {
          id: row.id,
          type: row.type,
          value: row.value,
          measuredAt: row.measuredAt,
          recordedByName: userName(db, row.recordedBy),
          abnormal: row.abnormal,
          note: row.note,
          source: row.examinationId ? 'EXAM' : 'MANUAL',
          sourceLabel: row.examinationId
            ? `Từ buổi khám ${formatDate(exam?.examinedAt ?? row.measuredAt)}`
            : 'Nhập tay',
          deleted: !!row.deletedAt,
          deleteReason: row.deleteReason,
          deletedByName: row.deletedBy ? userName(db, row.deletedBy) : undefined,
          deletedAt: row.deletedAt,
          canDelete: canDelete && !row.deletedAt && !row.examinationId,
        } satisfies MeasurementRow;
      });
  });
}

export interface MeasurementInput {
  horseId: string;
  type: MeasurementType;
  value: number;
  measuredAt: string;
  note?: string;
  /** Đã xác nhận lưu giá trị ngoài khoảng bình thường. */
  confirmAbnormal?: boolean;
}

export function addMeasurement(input: MeasurementInput): Promise<{ id: string; abnormal: boolean; alertLevel?: 'URGENT' | 'HIGH' }> {
  return commit((db) => {
    const actor = requirePermission('measurement.add');
    const at = now();
    const horse = actionableHorse(db, actor, input.horseId, 'measurement.add');
    const meta = measurementLabel[input.type];
    if (!meta) throw new AppError('Loại chỉ số không hợp lệ', 'type');
    const check = checkMeasurement(input.type, input.value);
    if (!check.valid) throw new AppError(`${meta.name}: ${check.reason}`, 'value');

    const measured = new Date(input.measuredAt);
    if (Number.isNaN(measured.getTime())) throw new AppError('Thời điểm đo không hợp lệ', 'measuredAt');
    if (measured.getTime() > at.getTime() + 60_000) throw new AppError('Thời điểm đo không được ở tương lai', 'measuredAt');
    if (at.getTime() - measured.getTime() > 7 * DAY_MS) throw new AppError('Chỉ nhập lùi tối đa 7 ngày', 'measuredAt');

    if (check.abnormal && !input.confirmAbnormal) {
      throw new AppError(
        `${meta.name} ${input.value} ${meta.unit} nằm ngoài khoảng bình thường ${meta.min}–${meta.max} ${meta.unit}. Xác nhận để lưu và đánh dấu bất thường`,
        'confirmAbnormal',
      );
    }

    const record = {
      id: newId('bm'),
      horseId: horse.id,
      type: input.type,
      value: input.value,
      measuredAt: measured.toISOString(),
      recordedBy: actor.id,
      abnormal: check.abnormal,
      note: clean(input.note),
      ...stamp(at),
    };
    db.bodyMeasurements.push(record);

    const trainer = trainerOfZone(db, horse.zoneId);
    let alertLevel: 'URGENT' | 'HIGH' | undefined;

    const raiseRequest = (urgency: 'URGENT' | 'NORMAL', description: string) => {
      const pendingBefore = db.examRequests.find(
        (item) => item.horseId === horse.id && item.source === 'BODY_METRIC_ALERT' && item.status === 'PENDING',
      );
      const escalates = !!pendingBefore && urgency === 'URGENT' && pendingBefore.urgency !== 'URGENT';
      createExamRequestInternal(db, at, {
        horseId: horse.id,
        source: 'BODY_METRIC_ALERT',
        urgency,
        description,
        createdBy: 'SYSTEM',
        refType: 'MEASUREMENT',
        refId: record.id,
      });
      // Yêu cầu mới (hoặc được nâng mức) đã tự báo VET; gộp vào yêu cầu cũ thì báo VET ở đây.
      return !pendingBefore || escalates;
    };

    if (input.type === 'TEMPERATURE' && input.value > TEMP_ALERT_C) {
      alertLevel = 'URGENT';
      const description = `Thân nhiệt ${formatNumber(input.value)} °C vượt ngưỡng ${formatNumber(TEMP_ALERT_C)} °C (ghi bởi ${actor.name}).`;
      const vetNotified = raiseRequest('URGENT', description);
      notifyMany(db, at, [trainer, ...(vetNotified ? [] : vetIds(db))], {
        level: 'URGENT',
        title: `Thân nhiệt cao: ${horse.name}`,
        body: `${formatNumber(input.value)} °C (ngưỡng ${formatNumber(TEMP_ALERT_C)} °C). Đã gửi yêu cầu khám khẩn.`,
        link: links.horse(horse.id, 'body'),
      });
    } else if (input.type === 'WEIGHT') {
      const from = measured.getTime() - WEIGHT_DROP.days * DAY_MS;
      const earlier = db.bodyMeasurements
        .filter(
          (row) =>
            row.id !== record.id &&
            row.horseId === horse.id &&
            row.type === 'WEIGHT' &&
            !row.deletedAt &&
            new Date(row.measuredAt).getTime() >= from &&
            new Date(row.measuredAt).getTime() < measured.getTime(),
        )
        .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))[0];
      if (earlier && earlier.value > 0) {
        const drop = (earlier.value - input.value) / earlier.value;
        if (drop > WEIGHT_DROP.ratio) {
          alertLevel = 'HIGH';
          const text = `Giảm ${formatNumber(drop * 100)}% trong ${WEIGHT_DROP.days} ngày (${formatNumber(earlier.value, 0)} → ${formatNumber(input.value, 0)} kg).`;
          raiseRequest('NORMAL', `Cân nặng ${text}`);
          notifyMany(db, at, [trainer, ...vetIds(db)], {
            level: 'HIGH',
            title: `Cân nặng giảm: ${horse.name}`,
            body: text,
            link: links.horse(horse.id, 'body'),
          });
        }
      }
    }

    writeAudit(db, at, {
      action: 'Ghi chỉ số cơ thể',
      entityType: 'BodyMeasurement',
      entityId: record.id,
      horseId: horse.id,
      after: { type: meta.name, value: `${input.value} ${meta.unit}`, abnormal: check.abnormal ? 'Có' : 'Không' },
      actor,
    });
    return { id: record.id, abnormal: check.abnormal, alertLevel };
  });
}

export function deleteMeasurement(id: string, reason: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('measurement.delete');
    const at = now();
    const why = requireReason(reason);
    const record = db.bodyMeasurements.find((item) => item.id === id);
    if (!record) throw new AppError(ERR_NOT_FOUND);
    actionableHorse(db, actor, record.horseId, 'measurement.delete');
    if (record.deletedAt) throw new AppError('Bản ghi đã được xóa trước đó');
    if (record.examinationId) throw new AppError('Bản ghi từ buổi khám, không xóa ở đây');
    record.deletedAt = at.toISOString();
    record.deletedBy = actor.id;
    record.deleteReason = why;
    touch(record, at);
    const meta = measurementLabel[record.type];
    writeAudit(db, at, {
      action: 'Xóa bản ghi chỉ số',
      entityType: 'BodyMeasurement',
      entityId: record.id,
      horseId: record.horseId,
      before: { type: meta.name, value: `${record.value} ${meta.unit}`, measuredAt: formatDate(record.measuredAt) },
      reason: why,
      actor,
    });
  });
}

/* ===== F1.8 — vòng đời, xóa, khôi phục ===== */

export type LifecycleAction = LifecycleStatus | 'DELETE' | 'RESTORE';

export interface LifecyclePreview {
  action: LifecycleAction;
  allowed: boolean;
  reason?: string;
  /** Câu tiếng Việt cho bảng hệ quả. */
  consequences: string[];
  /** Tên các lớp sẽ bị rút. */
  classes: string[];
  /** Lý do chặn xóa hồ sơ. */
  blockers: string[];
}

function deleteBlockers(db: Database, horse: Horse): string[] {
  const list: string[] = [];
  if (horse.lifecycleStatus !== 'ACTIVE') list.push(`Hồ sơ đang ở trạng thái ${lifecycleLabel[horse.lifecycleStatus]} — chỉ xóa được hồ sơ Đang hoạt động`);
  const stall = stallOf(db, horse);
  if (stall) list.push(`Ngựa đang ở ô ${stall.code}`);
  if (horse.groomId) list.push(`Đã phân công Groom ${userName(db, horse.groomId)}`);
  const metrics = db.bodyMeasurements.filter((row) => row.horseId === horse.id).length;
  if (metrics > 0) list.push(`Đã có ${metrics} bản ghi chỉ số cơ thể`);
  const cases = db.medicalCases.filter((row) => row.horseId === horse.id).length;
  if (cases > 0) list.push(`Đã có ${cases} bệnh án`);
  const exams = db.examinations.filter((row) => row.horseId === horse.id).length;
  if (exams > 0) list.push(`Đã có ${exams} buổi khám`);
  const requests = db.examRequests.filter((row) => row.horseId === horse.id).length;
  if (requests > 0) list.push(`Đã có ${requests} yêu cầu khám`);
  if (db.trainingLocks.some((row) => row.horseId === horse.id)) list.push('Đã có khóa huấn luyện');
  const enrollments = db.enrollments.filter((row) => row.horseId === horse.id).length;
  if (enrollments > 0) list.push(`Đã có ${enrollments} lượt đăng ký lớp`);
  const children = childrenOf(db, horse.id);
  if (children.length > 0) list.push(`Đang là cha/mẹ của ${children.map((child) => child.name).join(', ')}`);
  return list;
}

function describeLifecycle(db: Database, horse: Horse, action: LifecycleAction, at: Date): LifecyclePreview {
  const todayKey = toDateKey(at);
  const empty: LifecyclePreview = { action, allowed: false, consequences: [], classes: [], blockers: [] };
  const zone = zoneOf(db, horse);
  const stall = stallOf(db, horse);
  const groomName = horse.groomId ? userName(db, horse.groomId) : undefined;
  const ownerName = horse.ownerId ? userName(db, horse.ownerId) : undefined;

  if (action === 'DELETE') {
    if (horse.deletedAt) return { ...empty, reason: 'Hồ sơ đã bị xóa' };
    const blockers = deleteBlockers(db, horse);
    return {
      ...empty,
      allowed: blockers.length === 0,
      reason: blockers.length ? 'Hồ sơ đã phát sinh dữ liệu nghiệp vụ nên không xóa được' : undefined,
      blockers,
      consequences: [
        'Hồ sơ bị ẩn khỏi mọi danh sách; chỉ Quản lý câu lạc bộ xem được',
        'Dữ liệu không bị xóa vật lý, có thể khôi phục',
        'Số chip vẫn được giữ, không dùng lại cho hồ sơ khác',
      ],
    };
  }

  if (action === 'RESTORE') {
    if (!horse.deletedAt) return { ...empty, reason: 'Hồ sơ chưa bị xóa' };
    const owner = findUser(db, horse.ownerId);
    const consequences = [`Hồ sơ trở về trạng thái ${lifecycleLabel[horse.lifecycleStatus]}`];
    consequences.push(zone ? `Bỏ trống khu (trước khi xóa ở ${zone.name}) — ngựa vào danh sách Chờ xếp khu` : 'Ngựa vào danh sách Chờ xếp khu');
    if (owner && owner.role !== 'HORSE_OWNER') consequences.push(`Bỏ trống chủ sở hữu: ${owner.name} không còn vai trò Chủ ngựa (ghi tên vào nhật ký)`);
    else if (owner && !owner.active) consequences.push(`Giữ chủ sở hữu ${owner.name} — tài khoản đang bị khóa, hồ sơ sẽ có chú thích`);
    else if (owner) consequences.push(`Giữ chủ sở hữu ${owner.name}`);
    return { ...empty, allowed: true, consequences };
  }

  if (horse.deletedAt) return { ...empty, reason: 'Hồ sơ đã bị xóa — khôi phục trước khi đổi vòng đời' };
  if (!canTransition(horse.lifecycleStatus, action)) {
    return { ...empty, reason: `Không chuyển được từ ${lifecycleLabel[horse.lifecycleStatus]} sang ${lifecycleLabel[action]}` };
  }
  const running = runningSessionOf(db, horse.id);
  if (running) return { ...empty, reason: `Ngựa đang trong buổi tập ${running} — đợi buổi kết thúc` };

  const classes = action === 'ACTIVE' ? [] : openClassNames(db, horse.id, todayKey);
  const consequences: string[] = [];
  const classLine = classes.length > 0 ? `Rút khỏi ${classes.length} lớp đang học: ${classes.join(', ')}` : 'Không có lớp nào phải rút';

  if (action === 'RETIRED') {
    consequences.push(classLine);
    consequences.push('Không học lớp, không đăng ký đua');
    consequences.push(
      `Giữ nguyên ${[zone ? zone.name : 'khu (chưa có)', stall ? `ô ${stall.code}` : 'ô (chưa có)', groomName ? `Groom ${groomName}` : 'Groom (chưa có)'].join(', ')}`,
    );
    consequences.push('Vẫn được chăm sóc, khám định kỳ và chữa bệnh');
  } else if (action === 'TRANSFERRED') {
    consequences.push(classLine);
    if (stall) consequences.push(`Trả ô ${stall.code} về trống`);
    if (zone) consequences.push(`Bỏ khu ${zone.name}`);
    if (groomName) consequences.push(`Kết thúc phân công Groom ${groomName} (Groom nhận thông báo)`);
    const lock = activeLock(db, horse.id);
    if (lock) consequences.push(`Tự gỡ khóa huấn luyện "${lock.reason}" với ghi chú "Gỡ do chuyển nhượng"`);
    consequences.push(ownerName ? `Giữ tên chủ sở hữu ${ownerName}` : 'Hồ sơ không có chủ sở hữu');
    consequences.push('Hồ sơ chuyển sang chỉ đọc');
  } else if (horse.lifecycleStatus === 'TRANSFERRED') {
    consequences.push(ownerName ? `Bỏ trống chủ sở hữu (chủ cũ: ${ownerName})` : 'Chủ sở hữu để trống');
    consequences.push('Ngựa vào danh sách Chờ xếp khu');
    consequences.push(`Sức khỏe về ${healthLabel.UNDER_OBSERVATION}`);
    consequences.push('Giữ số chip và toàn bộ dữ liệu cũ');
  } else {
    consequences.push('Giữ nguyên chủ sở hữu, khu, ô và Groom');
    consequences.push('Ngựa được đăng ký lớp trở lại nếu đủ điều kiện sức khỏe');
  }
  return { ...empty, allowed: true, consequences, classes };
}

export function previewLifecycleChange(horseId: string, to: LifecycleAction): Promise<LifecyclePreview> {
  return query((db) => {
    const user = requirePermission(to === 'DELETE' || to === 'RESTORE' ? 'horse.delete' : 'horse.lifecycle');
    const horse = viewableHorse(db, user, horseId);
    return describeLifecycle(db, horse, to, now());
  });
}

export function getDeleteBlockers(id: string): Promise<string[]> {
  return query((db) => {
    const user = requirePermission('horse.delete');
    return deleteBlockers(db, viewableHorse(db, user, id));
  });
}

export function changeLifecycle(horseId: string, to: LifecycleStatus, reason: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('horse.lifecycle');
    const at = now();
    const why = requireReason(reason);
    const horse = viewableHorse(db, actor, horseId);
    const preview = describeLifecycle(db, horse, to, at);
    if (!preview.allowed) throw new AppError(preview.reason ?? 'Không đổi được trạng thái vòng đời');

    const from = horse.lifecycleStatus;
    const consequences: LifecycleConsequences = { enrollmentsClosed: 0 };

    if (to === 'RETIRED' || to === 'TRANSFERRED') {
      const closed = closeOpenEnrollments(db, horse.id, 'LIFECYCLE', at, actor.id, { note: why });
      consequences.enrollmentsClosed = closed.length;
      // Gửi trước khi kết thúc Groom để Groom cũ vẫn nhận được thông báo rút lớp.
      notifyWithdrawn(db, at, horse, preview.classes, to === 'RETIRED' ? 'Ngựa giải nghệ' : 'Ngựa chuyển nhượng');
    }

    if (to === 'TRANSFERRED') {
      const stallCode = vacateStall(db, horse, at);
      if (stallCode) consequences.stallFreed = stallCode;
      const zone = zoneOf(db, horse);
      if (zone) consequences.zoneCleared = zone.name;
      horse.zoneId = undefined;
      if (horse.groomId) {
        const groomId = horse.groomId;
        consequences.groomEnded = userName(db, groomId);
        horse.groomId = undefined;
        notifyMany(db, at, [groomId], {
          level: 'NORMAL',
          title: `Kết thúc phân công: ${horse.name}`,
          body: `${horse.name} đã chuyển nhượng khỏi câu lạc bộ. Bạn không còn phụ trách ngựa này.`,
          link: links.horse(horse.id),
        });
      }
      const lock = activeLock(db, horse.id);
      if (lock) {
        liftLockInternal(db, at, actor, lock, 'Gỡ do chuyển nhượng', 'TRANSFER');
        consequences.lockLifted = true;
      }
    }

    if (to === 'ACTIVE' && from === 'TRANSFERRED') {
      if (horse.ownerId) {
        consequences.ownerCleared = userName(db, horse.ownerId);
        horse.ownerId = undefined;
      }
      horse.zoneId = undefined;
      horse.stallId = undefined;
      horse.groomId = undefined;
      if (horse.healthStatus !== 'UNDER_OBSERVATION') {
        db.healthStatusLogs.unshift({
          id: newId('hsl'),
          horseId: horse.id,
          fromStatus: horse.healthStatus,
          toStatus: 'UNDER_OBSERVATION',
          reason: 'Kích hoạt lại sau chuyển nhượng',
          changedBy: actor.id,
          changedAt: at.toISOString(),
          ...stamp(at),
        });
        horse.healthStatus = 'UNDER_OBSERVATION';
        consequences.healthReset = true;
      }
      horse.periodicOverdueNotifiedFor = undefined;
    }

    horse.lifecycleStatus = to;
    touch(horse, at);
    db.lifecycleEvents.unshift({
      id: newId('lc'),
      horseId: horse.id,
      from,
      to,
      reason: why,
      by: actor.id,
      at: at.toISOString(),
      consequences,
      ...stamp(at),
    });
    writeAudit(db, at, {
      action: 'Đổi vòng đời',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before: { lifecycleStatus: lifecycleLabel[from] },
      after: { lifecycleStatus: lifecycleLabel[to], ...consequences },
      reason: why,
      actor,
    });
  });
}

export function softDeleteHorse(id: string, reason: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('horse.delete');
    const at = now();
    const why = requireReason(reason);
    const horse = viewableHorse(db, actor, id);
    if (horse.deletedAt) throw new AppError('Hồ sơ đã bị xóa');
    const blockers = deleteBlockers(db, horse);
    if (blockers.length > 0) throw new AppError(`Không xóa được hồ sơ: ${blockers.join('; ')}`);
    horse.deletedAt = at.toISOString();
    horse.deletedBy = actor.id;
    horse.deleteReason = why;
    touch(horse, at);
    db.lifecycleEvents.unshift({
      id: newId('lc'),
      horseId: horse.id,
      from: horse.lifecycleStatus,
      to: 'DELETED',
      reason: why,
      by: actor.id,
      at: at.toISOString(),
      consequences: { enrollmentsClosed: 0 },
      ...stamp(at),
    });
    writeAudit(db, at, {
      action: 'Xóa hồ sơ ngựa',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      before: { name: horse.name, chipNumber: horse.chipNumber },
      reason: why,
      actor,
    });
  });
}

export function restoreHorse(id: string, reason: string): Promise<true> {
  return commit((db) => {
    const actor = requirePermission('horse.delete');
    const at = now();
    const why = requireReason(reason);
    const horse = viewableHorse(db, actor, id);
    if (!horse.deletedAt) throw new AppError('Hồ sơ chưa bị xóa');
    const consequences: LifecycleConsequences = { enrollmentsClosed: 0 };
    const zone = zoneOf(db, horse);
    if (zone) consequences.zoneCleared = zone.name;
    horse.zoneId = undefined;
    if (horse.stallId) vacateStall(db, horse, at);
    const owner = findUser(db, horse.ownerId);
    if (owner && owner.role !== 'HORSE_OWNER') {
      consequences.ownerCleared = owner.name;
      horse.ownerId = undefined;
    }
    horse.deletedAt = undefined;
    horse.deletedBy = undefined;
    horse.deleteReason = undefined;
    touch(horse, at);
    db.lifecycleEvents.unshift({
      id: newId('lc'),
      horseId: horse.id,
      from: 'DELETED',
      to: horse.lifecycleStatus,
      reason: why,
      by: actor.id,
      at: at.toISOString(),
      consequences,
      ...stamp(at),
    });
    writeAudit(db, at, {
      action: 'Khôi phục hồ sơ ngựa',
      entityType: 'Horse',
      entityId: horse.id,
      horseId: horse.id,
      after: {
        lifecycleStatus: lifecycleLabel[horse.lifecycleStatus],
        zoneCleared: consequences.zoneCleared,
        ownerCleared: consequences.ownerCleared ? `Chủ cũ: ${consequences.ownerCleared}` : undefined,
        ownerNote: owner && owner.role === 'HORSE_OWNER' && !owner.active ? `Giữ chủ ${owner.name} (tài khoản đang bị khóa)` : undefined,
      },
      reason: why,
      actor,
    });
  });
}

export interface LifecycleEventRow {
  id: string;
  from: LifecycleStatus | 'DELETED';
  to: LifecycleStatus | 'DELETED';
  fromLabel: string;
  toLabel: string;
  reason: string;
  byName: string;
  at: string;
  consequences: string[];
}

function lifecycleStateLabel(value: LifecycleStatus | 'DELETED') {
  return value === 'DELETED' ? 'Đã xóa hồ sơ' : lifecycleLabel[value];
}

export function listLifecycleEvents(horseId: string): Promise<LifecycleEventRow[]> {
  return query((db) => {
    const user = requirePermission('horse.view');
    const horse = viewableHorse(db, user, horseId);
    return db.lifecycleEvents
      .filter((event) => event.horseId === horse.id)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((event) => {
        const c = event.consequences;
        const lines: string[] = [];
        if (c.enrollmentsClosed > 0) lines.push(`Rút khỏi ${c.enrollmentsClosed} lớp`);
        if (c.stallFreed) lines.push(`Trả ô ${c.stallFreed}`);
        if (c.zoneCleared) lines.push(`Bỏ khu ${c.zoneCleared}`);
        if (c.groomEnded) lines.push(`Kết thúc Groom ${c.groomEnded}`);
        if (c.lockLifted) lines.push('Gỡ khóa huấn luyện');
        if (c.ownerCleared) lines.push(`Bỏ trống chủ (chủ cũ ${c.ownerCleared})`);
        if (c.healthReset) lines.push(`Sức khỏe về ${healthLabel.UNDER_OBSERVATION}`);
        return {
          id: event.id,
          from: event.from,
          to: event.to,
          fromLabel: lifecycleStateLabel(event.from),
          toLabel: lifecycleStateLabel(event.to),
          reason: event.reason,
          byName: userName(db, event.by),
          at: event.at,
          consequences: lines,
        };
      });
  });
}

/* ===== Nhật ký hồ sơ (CM) ===== */

export function listHorseAudit(horseId: string) {
  return query((db) => {
    const user = requirePermission('admin.audit');
    const horse = viewableHorse(db, user, horseId);
    return db.auditLogs
      .filter((row) => row.horseId === horse.id || row.entityId === horse.id)
      .sort((a, b) => b.at.localeCompare(a.at));
  });
}
