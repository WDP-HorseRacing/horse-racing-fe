// Flow 3 — quản lý y tế và xử lý chấn thương.
import type {
  BodyRegion,
  BodySide,
  CareScheduleType,
  Database,
  HealthStatus,
  MedicalReason,
  Prescription,
  Severity,
  User,
} from '../types/domain';
import { AppError, ERR_NOT_FOUND, newId, stamp, touch } from './db';
import { commit, pushNotification, query, requirePermission, requireUser, writeAudit } from './api';
import { canViewHorse, visibleHorses } from '../auth/permissions';
import { activeLock, currentAssignment, findUser, groomIdOf, zoneIdOf } from './selectors';
import { healthAllows } from '../lib/rule-helpers';
import { now } from '../lib/clock';
import { addDays, toDateKey } from '../lib/format';
import { careInterval, careTypeLabel, healthLabel } from '../lib/labels';

function trainerOfZone(db: Database, zoneId?: string): User | undefined {
  if (!zoneId) return undefined;
  return db.users.find((user) => user.role === 'HEAD_TRAINER' && user.zoneId === zoneId && user.active);
}

/** Hủy buổi tập không còn hợp lệ sau khi trạng thái sức khỏe hoặc khóa huấn luyện thay đổi. */
function cancelInvalidSessions(db: Database, horseId: string, at: Date, reason: string, actor: User | null) {
  const todayKey = toDateKey(at);
  const horse = db.horses.find((item) => item.id === horseId);
  if (!horse) return 0;

  const affected = db.sessions.filter(
    (session) =>
      session.horseId === horseId &&
      session.status === 'SCHEDULED' &&
      session.sessionDate >= todayKey &&
      (!!activeLock(db, horseId) || !healthAllows(horse.healthStatus, session.intensity)),
  );
  affected.forEach((session) => {
    session.status = 'CANCELLED';
    session.cancelCategory = 'MEDICAL_BLOCK';
    session.cancelReason = reason;
    session.cancelledAt = at.toISOString();
    session.cancelledBy = actor?.id;
    touch(session, at);
  });

  if (affected.length > 0) {
    const trainer = trainerOfZone(db, zoneIdOf(db, horseId));
    if (trainer) {
      pushNotification(db, at, {
        userId: trainer.id,
        level: 'URGENT',
        title: `${affected.length} buổi tập của ${horse.name} bị hủy`,
        body: `Chặn y tế: ${reason}`,
        link: '/training/schedule',
      });
    }
    const groomId = groomIdOf(db, horseId);
    if (groomId) {
      pushNotification(db, at, {
        userId: groomId,
        title: `Lịch tập của ${horse.name} thay đổi`,
        body: `Chặn y tế: ${reason}`,
        link: '/training/today',
      });
    }
  }
  return affected.length;
}

/* ===== F3.1 — sơ đồ sức khỏe và việc cần xử lý ===== */

export interface TaskItem {
  key: string;
  source: string;
  horseId: string;
  horseName: string;
  detail: string;
  at: string;
  urgent: boolean;
}

export function getHealthBoard() {
  return query((db) => {
    const user = requireUser();
    const at = now();
    const horses = visibleHorses(db, user).filter((horse) => !horse.isReference && !horse.deletedAt);

    const counts: Record<HealthStatus, number> = {
      ELIGIBLE: 0,
      UNDER_OBSERVATION: 0,
      INJURED: 0,
      QUARANTINED: 0,
    };
    horses.forEach((horse) => {
      if (horse.lifecycleStatus !== 'TRANSFERRED') counts[horse.healthStatus] += 1;
    });

    const tasks: TaskItem[] = [];
    if (user.role === 'VETERINARIAN') {
      const dismissed = new Set(db.taskDismissals.map((item) => item.key));
      const push = (item: TaskItem) => {
        if (!dismissed.has(item.key)) tasks.push(item);
      };
      const nameOf = (horseId: string) => db.horses.find((horse) => horse.id === horseId)?.name ?? '—';

      // 1. Sự cố do nhân viên chăm sóc báo, chưa xử lý xong.
      db.incidents
        .filter((incident) => incident.status !== 'RESOLVED')
        .forEach((incident) => {
          push({
            key: `incident:${incident.id}`,
            source: 'Sự cố tại chuồng',
            horseId: incident.horseId,
            horseName: nameOf(incident.horseId),
            detail: incident.description,
            at: incident.createdAt,
            urgent: incident.urgent,
          });
        });

      // 2. Cảnh báo thân nhiệt và giảm cân.
      db.bodyMeasurements
        .filter(
          (item) =>
            item.type === 'TEMPERATURE' &&
            item.value > 38.6 &&
            at.getTime() - new Date(item.measuredAt).getTime() < 7 * 86_400_000,
        )
        .forEach((item) => {
          push({
            key: `temp:${item.id}`,
            source: 'Cảnh báo thân nhiệt',
            horseId: item.horseId,
            horseName: nameOf(item.horseId),
            detail: `Thân nhiệt ${item.value.toFixed(1)} °C, vượt ngưỡng 38,6 °C`,
            at: item.measuredAt,
            urgent: true,
          });
        });

      // 3. Cảnh báo đỏ và buổi tập kết thúc sớm vì ngựa mệt.
      db.sessions
        .filter(
          (session) =>
            session.earlyEndReason === 'HORSE_UNWELL' &&
            session.endedAt &&
            at.getTime() - new Date(session.endedAt).getTime() < 7 * 86_400_000,
        )
        .forEach((session) => {
          push({
            key: `session:${session.id}`,
            source: 'Buổi tập kết thúc sớm',
            horseId: session.horseId,
            horseName: nameOf(session.horseId),
            detail: session.earlyEndNote ?? 'Ngựa mệt hoặc có dấu hiệu bất thường',
            at: session.endedAt!,
            urgent: true,
          });
        });

      // 4. Lịch chăm sóc quá hạn.
      db.careSchedules
        .filter((item) => !item.doneAt && item.dueDate < toDateKey(at))
        .forEach((item) => {
          push({
            key: `care:${item.id}`,
            source: 'Lịch chăm sóc quá hạn',
            horseId: item.horseId,
            horseName: nameOf(item.horseId),
            detail: `${careTypeLabel[item.type]}${item.name ? ` — ${item.name}` : ''} quá hạn từ ${item.dueDate}`,
            at: item.dueDate,
            urgent: false,
          });
        });

      // 5. Hồ sơ đang điều trị tới ngày tái khám.
      db.medicalRecords
        .filter((record) => record.status === 'IN_TREATMENT' && record.recheckDate && record.recheckDate <= toDateKey(at))
        .forEach((record) => {
          push({
            key: `recheck:${record.id}`,
            source: 'Đến hạn tái khám',
            horseId: record.horseId,
            horseName: nameOf(record.horseId),
            detail: `${record.diagnosis} — hẹn tái khám ${record.recheckDate}`,
            at: record.recheckDate!,
            urgent: false,
          });
        });
    }

    return {
      counts,
      tasks: tasks.sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.at.localeCompare(a.at)),
      showTasks: user.role === 'VETERINARIAN',
    };
  });
}

export function dismissTask(key: string, note: string) {
  return commit((db) => {
    const user = requirePermission('medical.edit');
    const at = now();
    db.taskDismissals.push({ id: newId('td'), key, note, by: user.id, ...stamp(at) });
    writeAudit(db, at, {
      action: 'Đánh dấu không cần khám',
      entityType: 'Task',
      entityId: key,
      reason: note,
      actor: user,
    });
  });
}

/* ===== F3.2 — hồ sơ khám ===== */

export interface MedicalRecordView {
  id: string;
  horseId: string;
  horseName: string;
  examDate: string;
  reason: MedicalReason;
  symptoms?: string;
  diagnosis?: string;
  severity?: Severity;
  treatmentPlan?: string;
  prescriptions?: Prescription[];
  careInstruction?: string;
  recheckDate?: string;
  noRaceUntil?: string;
  cost?: number;
  status: 'IN_TREATMENT' | 'RESOLVED';
  createdByName: string;
  createdAt: string;
  editable: boolean;
  restricted: boolean;
  followUps: { id: string; date: string; note: string; cost?: number; byName: string }[];
}

function projectRecord(db: Database, user: User, recordId: string): MedicalRecordView {
  const record = db.medicalRecords.find((item) => item.id === recordId)!;
  const horse = db.horses.find((item) => item.id === record.horseId);
  const at = now();

  // Nhân viên chăm sóc chỉ thấy chỉ dẫn chăm sóc; huấn luyện viên chỉ thấy chi tiết của ngựa trong khu mình.
  const inZone = user.zoneId ? zoneIdOf(db, record.horseId) === user.zoneId : false;
  const restricted =
    user.role === 'GROOM' || (user.role === 'HEAD_TRAINER' && !inZone);
  const showCost = user.role === 'CLUB_MANAGER' || user.role === 'VETERINARIAN' || user.role === 'HORSE_OWNER';

  return {
    id: record.id,
    horseId: record.horseId,
    horseName: horse?.name ?? '—',
    examDate: record.examDate,
    reason: record.reason,
    symptoms: restricted ? undefined : record.symptoms,
    diagnosis: restricted ? undefined : record.diagnosis,
    severity: restricted ? undefined : record.severity,
    treatmentPlan: restricted ? undefined : record.treatmentPlan,
    prescriptions: restricted ? undefined : record.prescriptions,
    careInstruction: record.careInstruction,
    recheckDate: record.recheckDate,
    noRaceUntil: record.noRaceUntil,
    cost: showCost ? record.cost : undefined,
    status: record.status,
    createdByName: findUser(db, record.createdBy)?.name ?? '—',
    createdAt: record.createdAt,
    editable:
      user.role === 'VETERINARIAN' &&
      record.status === 'IN_TREATMENT' &&
      at.getTime() - new Date(record.createdAt).getTime() <= 24 * 3_600_000,
    restricted,
    followUps: restricted
      ? []
      : db.medicalFollowUps
          .filter((item) => item.recordId === record.id)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((item) => ({
            id: item.id,
            date: item.date,
            note: item.note,
            cost: showCost ? item.cost : undefined,
            byName: findUser(db, item.createdBy)?.name ?? '—',
          })),
  };
}

export function listMedicalRecords(filters: { horseId?: string; status?: string } = {}) {
  return query((db) => {
    const user = requireUser();
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    return db.medicalRecords
      .filter((record) => allowed.has(record.horseId))
      .filter((record) => !filters.horseId || record.horseId === filters.horseId)
      .filter((record) => !filters.status || record.status === filters.status)
      .filter((record) => user.role !== 'GROOM' || groomIdOf(db, record.horseId) === user.id)
      .sort((a, b) => b.examDate.localeCompare(a.examDate))
      .map((record) => projectRecord(db, user, record.id));
  });
}

export function getMedicalRecord(recordId: string) {
  return query((db) => {
    const user = requireUser();
    const record = db.medicalRecords.find((item) => item.id === recordId);
    if (!record || !canViewHorse(db, user, record.horseId)) throw new AppError(ERR_NOT_FOUND);
    return projectRecord(db, user, recordId);
  });
}

export interface MedicalRecordInput {
  horseId: string;
  examDate: string;
  reason: MedicalReason;
  symptoms: string;
  diagnosis: string;
  severity: Severity;
  treatmentPlan?: string;
  prescriptions: Prescription[];
  careInstruction?: string;
  recheckDate?: string;
  noRaceUntil?: string;
  cost?: number;
  status: 'IN_TREATMENT' | 'RESOLVED';
  sourceKey?: string;
  newHealthStatus?: HealthStatus;
  healthReason?: string;
  isolationStallId?: string;
}

function validateRecord(input: MedicalRecordInput, at: Date) {
  if (!input.examDate) throw new AppError('Vui lòng chọn ngày khám', 'examDate');
  if (input.examDate > toDateKey(at)) throw new AppError('Ngày khám không được ở tương lai', 'examDate');
  if (!input.symptoms.trim()) throw new AppError('Vui lòng nhập triệu chứng', 'symptoms');
  if (!input.diagnosis.trim()) throw new AppError('Vui lòng nhập chẩn đoán', 'diagnosis');
  if (!input.severity) throw new AppError('Vui lòng chọn mức độ', 'severity');
}

export function createMedicalRecord(input: MedicalRecordInput) {
  return commit((db) => {
    const user = requirePermission('medical.edit');
    const horse = db.horses.find((item) => item.id === input.horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (horse.isReference) throw new AppError('Ngựa tham chiếu không có dữ liệu y tế');
    if (horse.lifecycleStatus === 'TRANSFERRED') throw new AppError('Ngựa đã chuyển nhượng, chỉ xem lại lịch sử');

    const at = now();
    validateRecord(input, at);

    const recordId = newId('mr');
    db.medicalRecords.push({
      id: recordId,
      horseId: input.horseId,
      examDate: input.examDate,
      reason: input.reason,
      symptoms: input.symptoms.trim(),
      diagnosis: input.diagnosis.trim(),
      severity: input.severity,
      treatmentPlan: input.treatmentPlan?.trim() || undefined,
      prescriptions: input.prescriptions.filter((item) => item.drug.trim()),
      careInstruction: input.careInstruction?.trim() || undefined,
      recheckDate: input.recheckDate || undefined,
      noRaceUntil: input.noRaceUntil || undefined,
      cost: input.cost,
      status: input.status,
      createdBy: user.id,
      ...stamp(at),
    });

    if (input.cost) {
      db.expenses.push({
        id: newId('ex'),
        horseId: input.horseId,
        category: 'MEDICAL',
        amount: input.cost,
        date: input.examDate,
        sourceType: 'MEDICAL_RECORD',
        sourceId: recordId,
        note: input.diagnosis.trim(),
        ...stamp(at),
      });
    }

    if (input.sourceKey) {
      db.taskDismissals.push({ id: newId('td'), key: input.sourceKey, note: 'Đã tạo hồ sơ khám', by: user.id, ...stamp(at) });
      const incidentId = input.sourceKey.startsWith('incident:') ? input.sourceKey.slice('incident:'.length) : undefined;
      const incident = incidentId ? db.incidents.find((item) => item.id === incidentId) : undefined;
      if (incident) {
        incident.status = 'IN_PROGRESS';
        incident.handledBy = user.id;
        touch(incident, at);
      }
    }

    writeAudit(db, at, {
      action: 'Ghi hồ sơ khám',
      entityType: 'MedicalRecord',
      entityId: recordId,
      after: { diagnosis: input.diagnosis, severity: input.severity },
      actor: user,
    });

    if (input.newHealthStatus && input.newHealthStatus !== horse.healthStatus) {
      applyHealthStatus(db, user, input.horseId, input.newHealthStatus, input.healthReason ?? input.diagnosis, recordId, input.isolationStallId);
    }
    return recordId;
  });
}

export function updateMedicalRecord(recordId: string, input: Partial<MedicalRecordInput>) {
  return commit((db) => {
    const user = requirePermission('medical.edit');
    const record = db.medicalRecords.find((item) => item.id === recordId);
    if (!record) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    if (at.getTime() - new Date(record.createdAt).getTime() > 24 * 3_600_000) {
      throw new AppError('Đã quá 24 giờ kể từ lúc tạo, chỉ còn thêm được ghi chú theo dõi');
    }
    const before = { diagnosis: record.diagnosis, treatmentPlan: record.treatmentPlan, status: record.status };
    Object.assign(record, {
      symptoms: input.symptoms?.trim() ?? record.symptoms,
      diagnosis: input.diagnosis?.trim() ?? record.diagnosis,
      severity: input.severity ?? record.severity,
      treatmentPlan: input.treatmentPlan?.trim() ?? record.treatmentPlan,
      prescriptions: input.prescriptions ?? record.prescriptions,
      careInstruction: input.careInstruction?.trim() ?? record.careInstruction,
      recheckDate: input.recheckDate ?? record.recheckDate,
      noRaceUntil: input.noRaceUntil ?? record.noRaceUntil,
    });
    record.editedAt = at.toISOString();
    touch(record, at);
    writeAudit(db, at, {
      action: 'Cập nhật phác đồ',
      entityType: 'MedicalRecord',
      entityId: recordId,
      before,
      after: { diagnosis: record.diagnosis, treatmentPlan: record.treatmentPlan, status: record.status },
      actor: user,
    });
  });
}

export function addFollowUp(recordId: string, input: { date: string; note: string; cost?: number }) {
  return commit((db) => {
    const user = requirePermission('medical.edit');
    const record = db.medicalRecords.find((item) => item.id === recordId);
    if (!record) throw new AppError(ERR_NOT_FOUND);
    if (!input.note.trim()) throw new AppError('Vui lòng nhập nội dung theo dõi', 'note');
    const at = now();
    const followUpId = newId('mf');
    db.medicalFollowUps.push({
      id: followUpId,
      recordId,
      date: input.date || toDateKey(at),
      note: input.note.trim(),
      cost: input.cost,
      createdBy: user.id,
      ...stamp(at),
    });
    if (input.cost) {
      db.expenses.push({
        id: newId('ex'),
        horseId: record.horseId,
        category: 'MEDICAL',
        amount: input.cost,
        date: input.date || toDateKey(at),
        sourceType: 'MEDICAL_FOLLOWUP',
        sourceId: followUpId,
        note: 'Ghi chú theo dõi',
        ...stamp(at),
      });
    }
    writeAudit(db, at, { action: 'Thêm ghi chú theo dõi', entityType: 'MedicalRecord', entityId: recordId, after: { note: input.note }, actor: user });
  });
}

export function resolveMedicalRecord(recordId: string) {
  return commit((db) => {
    const user = requirePermission('medical.edit');
    const record = db.medicalRecords.find((item) => item.id === recordId);
    if (!record) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    record.status = 'RESOLVED';
    touch(record, at);
    writeAudit(db, at, {
      action: 'Đánh dấu đã khỏi',
      entityType: 'MedicalRecord',
      entityId: recordId,
      before: { status: 'IN_TREATMENT' },
      after: { status: 'RESOLVED' },
      actor: user,
    });
  });
}

/* ===== F3.3 — đổi trạng thái sức khỏe ===== */

function applyHealthStatus(
  db: Database,
  user: User,
  horseId: string,
  to: HealthStatus,
  reason: string,
  recordId?: string,
  isolationStallId?: string,
) {
  const horse = db.horses.find((item) => item.id === horseId);
  if (!horse) throw new AppError(ERR_NOT_FOUND);
  if (!reason.trim()) throw new AppError('Vui lòng nhập lý do', 'reason');
  const at = now();
  const from = horse.healthStatus;

  if (to === 'QUARANTINED') {
    const stall = isolationStallId ? db.stalls.find((item) => item.id === isolationStallId) : undefined;
    if (!stall || stall.type !== 'ISOLATION') {
      throw new AppError('Vui lòng chọn một ô cách ly còn trống', 'isolationStallId');
    }
    const occupied = db.stallAssignments.some(
      (item) => item.stallId === stall.id && !item.endAt && item.horseId !== horseId,
    );
    if (occupied) throw new AppError('Ô cách ly đã có ngựa khác', 'isolationStallId');

    const previous = currentAssignment(db, horseId);
    if (previous) {
      previous.endAt = at.toISOString();
      touch(previous, at);
    }
    db.stallAssignments.push({
      id: newId('sa'),
      horseId,
      stallId: stall.id,
      groomId: previous?.groomId,
      startAt: at.toISOString(),
      ...stamp(at),
    });
  }

  horse.healthStatus = to;
  touch(horse, at);
  db.healthStatusLogs.push({
    id: newId('hs'),
    horseId,
    fromStatus: from,
    toStatus: to,
    reason: reason.trim(),
    recordId,
    changedBy: user.id,
    changedAt: at.toISOString(),
    ...stamp(at),
  });

  const cancelled = cancelInvalidSessions(db, horseId, at, `Trạng thái sức khỏe: ${healthLabel[to]}`, user);

  if (to !== 'ELIGIBLE') {
    db.raceRegistrations
      .filter(
        (item) =>
          item.horseId === horseId &&
          (item.status === 'PENDING_OWNER' || item.status === 'REGISTERED'),
      )
      .forEach((item) => {
        item.status = 'CANCELLED';
        item.cancelReason = `Trạng thái sức khỏe: ${healthLabel[to]}`;
        touch(item, at);
      });
  }

  if (from === 'QUARANTINED' && to !== 'QUARANTINED') {
    db.users
      .filter((item) => item.role === 'CLUB_MANAGER')
      .forEach((manager) => {
        pushNotification(db, at, {
          userId: manager.id,
          title: `${horse.name} đã rời cách ly`,
          body: 'Hãy xếp ngựa về ô thường trên sơ đồ chuồng.',
          link: '/stable',
        });
      });
  }

  writeAudit(db, at, {
    action: 'Đổi trạng thái sức khỏe',
    entityType: 'Horse',
    entityId: horseId,
    before: { healthStatus: from },
    after: { healthStatus: to, cancelledSessions: cancelled },
    reason,
    actor: user,
  });
  return cancelled;
}

export function changeHealthStatus(input: {
  horseId: string;
  to: HealthStatus;
  reason: string;
  isolationStallId?: string;
}) {
  return commit((db) => {
    const user = requirePermission('health.status.edit');
    return applyHealthStatus(db, user, input.horseId, input.to, input.reason, undefined, input.isolationStallId);
  });
}

export function getHealthTimeline(horseId: string) {
  return query((db) => {
    const user = requireUser();
    if (!canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
    return db.healthStatusLogs
      .filter((item) => item.horseId === horseId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
      .map((item) => ({
        id: item.id,
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        reason: item.reason,
        changedAt: item.changedAt,
        changedByName: findUser(db, item.changedBy)?.name ?? '—',
      }));
  });
}

export function listIsolationStalls() {
  return query((db) =>
    db.stalls
      .filter(
        (stall) =>
          stall.type === 'ISOLATION' &&
          !db.stallAssignments.some((item) => item.stallId === stall.id && !item.endAt),
      )
      .map((stall) => ({ id: stall.id, code: stall.code })),
  );
}

/* ===== F3.4 — bản đồ chấn thương ===== */

export function listInjuryMarks(horseId: string) {
  return query((db) => {
    const user = requireUser();
    if (!canViewHorse(db, user, horseId)) throw new AppError(ERR_NOT_FOUND);
    if (user.role === 'GROOM') return [];
    return db.injuryMarks
      .filter((mark) => mark.horseId === horseId)
      .map((mark) => {
        const updates = db.injuryUpdates
          .filter((item) => item.markId === mark.id)
          .sort((a, b) => b.date.localeCompare(a.date));
        return {
          id: mark.id,
          region: mark.region,
          side: mark.side,
          description: mark.description,
          severity: updates[0]?.severity ?? mark.severity,
          detectedAt: mark.detectedAt,
          resolvedAt: mark.resolvedAt,
          recordId: mark.recordId,
          updates: updates.map((item) => ({
            id: item.id,
            date: item.date,
            severity: item.severity,
            note: item.note,
            photoSrc: item.photoSrc,
            byName: findUser(db, item.createdBy)?.name ?? '—',
          })),
        };
      })
      .sort(
        (a, b) =>
          Number(!!a.resolvedAt) - Number(!!b.resolvedAt) ||
          b.detectedAt.localeCompare(a.detectedAt),
      );
  });
}

export function createInjuryMark(input: {
  horseId: string;
  region: BodyRegion;
  side?: BodySide;
  description: string;
  severity: Severity;
  detectedAt: string;
  recordId?: string;
}) {
  return commit((db) => {
    const user = requirePermission('injury.edit');
    if (!input.region) throw new AppError('Vui lòng chọn vùng trên mô hình', 'region');
    if (!input.description.trim()) throw new AppError('Vui lòng mô tả chấn thương', 'description');
    const at = now();
    const markId = newId('im');
    db.injuryMarks.push({
      id: markId,
      horseId: input.horseId,
      region: input.region,
      side: input.side,
      description: input.description.trim(),
      severity: input.severity,
      detectedAt: input.detectedAt || toDateKey(at),
      recordId: input.recordId,
      ...stamp(at),
    });
    db.injuryUpdates.push({
      id: newId('iu'),
      markId,
      date: input.detectedAt || toDateKey(at),
      severity: input.severity,
      note: input.description.trim(),
      createdBy: user.id,
      ...stamp(at),
    });
    writeAudit(db, at, {
      action: 'Đánh dấu chấn thương',
      entityType: 'InjuryMark',
      entityId: markId,
      after: { region: input.region, side: input.side, severity: input.severity },
      actor: user,
    });
    return markId;
  });
}

export function addInjuryUpdate(markId: string, input: { date: string; severity: Severity; note: string; photoSrc?: string }) {
  return commit((db) => {
    const user = requirePermission('injury.edit');
    const mark = db.injuryMarks.find((item) => item.id === markId);
    if (!mark) throw new AppError(ERR_NOT_FOUND);
    if (!input.note.trim()) throw new AppError('Vui lòng nhập ghi chú', 'note');
    const at = now();
    db.injuryUpdates.push({
      id: newId('iu'),
      markId,
      date: input.date || toDateKey(at),
      severity: input.severity,
      note: input.note.trim(),
      photoSrc: input.photoSrc,
      createdBy: user.id,
      ...stamp(at),
    });
    writeAudit(db, at, {
      action: 'Cập nhật diễn biến chấn thương',
      entityType: 'InjuryMark',
      entityId: markId,
      before: { severity: mark.severity },
      after: { severity: input.severity },
      actor: user,
    });
  });
}

export function resolveInjuryMark(markId: string) {
  return commit((db) => {
    const user = requirePermission('injury.edit');
    const mark = db.injuryMarks.find((item) => item.id === markId);
    if (!mark) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    mark.resolvedAt = at.toISOString();
    touch(mark, at);
    writeAudit(db, at, { action: 'Đánh dấu đã hồi phục', entityType: 'InjuryMark', entityId: markId, actor: user });
  });
}

/* ===== F3.5 — khóa huấn luyện ===== */

export function listTrainingLocks() {
  return query((db) => {
    const user = requireUser();
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    return db.trainingLocks
      .filter((lock) => allowed.has(lock.horseId))
      .sort((a, b) => Number(!!a.liftedAt) - Number(!!b.liftedAt) || b.placedAt.localeCompare(a.placedAt))
      .map((lock) => ({
        id: lock.id,
        horseId: lock.horseId,
        horseName: db.horses.find((item) => item.id === lock.horseId)?.name ?? '—',
        horseAvatar: db.horses.find((item) => item.id === lock.horseId)?.avatar,
        reason: lock.reason,
        expectedLiftDate: lock.expectedLiftDate,
        placedAt: lock.placedAt,
        placedByName: findUser(db, lock.placedBy)?.name ?? '—',
        liftedAt: lock.liftedAt,
        liftedByName: findUser(db, lock.liftedBy)?.name,
        liftReason: lock.liftReason,
      }));
  });
}

export function placeTrainingLock(input: { horseId: string; reason: string; expectedLiftDate?: string }) {
  return commit((db) => {
    const user = requirePermission('lock.edit');
    const horse = db.horses.find((item) => item.id === input.horseId);
    if (!horse) throw new AppError(ERR_NOT_FOUND);
    if (activeLock(db, input.horseId)) throw new AppError('Ngựa đang có khóa huấn luyện hiệu lực');
    if (!input.reason.trim()) throw new AppError('Vui lòng nhập lý do', 'reason');

    const at = now();
    const lockId = newId('lock');
    db.trainingLocks.push({
      id: lockId,
      horseId: input.horseId,
      reason: input.reason.trim(),
      expectedLiftDate: input.expectedLiftDate || undefined,
      placedBy: user.id,
      placedAt: at.toISOString(),
      ...stamp(at),
    });

    // Buổi đang diễn ra bị dừng khẩn với lý do "Khóa huấn luyện".
    db.sessions
      .filter((session) => session.horseId === input.horseId && session.status === 'IN_PROGRESS')
      .forEach((session) => {
        session.status = 'AWAITING_REVIEW';
        session.endedAt = at.toISOString();
        session.endedBy = user.id;
        session.endReason = 'TRAINING_LOCK';
        session.stopReason = 'Khóa huấn luyện';
        session.earlyEndReason = 'HORSE_UNWELL';
        session.earlyEndNote = input.reason.trim();
        touch(session, at);
      });

    const cancelled = cancelInvalidSessions(db, input.horseId, at, input.reason.trim(), user);

    db.raceRegistrations
      .filter(
        (item) =>
          item.horseId === input.horseId &&
          (item.status === 'PENDING_OWNER' || item.status === 'REGISTERED'),
      )
      .forEach((item) => {
        item.status = 'CANCELLED';
        item.cancelReason = 'Đang có khóa huấn luyện';
        touch(item, at);
      });

    writeAudit(db, at, {
      action: 'Đặt khóa huấn luyện',
      entityType: 'TrainingLock',
      entityId: lockId,
      after: { reason: input.reason, cancelledSessions: cancelled },
      reason: input.reason,
      actor: user,
    });
    return cancelled;
  });
}

export function liftTrainingLock(lockId: string, reason: string) {
  return commit((db) => {
    const user = requirePermission('lock.edit');
    const lock = db.trainingLocks.find((item) => item.id === lockId);
    if (!lock) throw new AppError(ERR_NOT_FOUND);
    if (lock.liftedAt) throw new AppError('Khóa này đã được gỡ');
    if (!reason.trim()) throw new AppError('Vui lòng nhập lý do gỡ khóa', 'reason');
    const at = now();
    lock.liftedAt = at.toISOString();
    lock.liftedBy = user.id;
    lock.liftReason = reason.trim();
    touch(lock, at);

    const horse = db.horses.find((item) => item.id === lock.horseId);
    const trainer = trainerOfZone(db, zoneIdOf(db, lock.horseId));
    if (trainer) {
      pushNotification(db, at, {
        userId: trainer.id,
        title: `Đã gỡ khóa huấn luyện cho ${horse?.name}`,
        body: `${reason.trim()} — buổi tập đã hủy không tự khôi phục, hãy sinh lại lịch.`,
        link: '/training/schedule',
      });
    }
    writeAudit(db, at, {
      action: 'Gỡ khóa huấn luyện',
      entityType: 'TrainingLock',
      entityId: lockId,
      before: { liftedAt: undefined },
      after: { liftedAt: lock.liftedAt },
      reason,
      actor: user,
    });
  });
}

/* ===== F3.6 — lịch chăm sóc định kỳ ===== */

export function listCareSchedules(filters: { horseId?: string; type?: string } = {}) {
  return query((db) => {
    const user = requireUser();
    const at = toDateKey(now());
    let allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    if (user.role === 'GROOM') {
      allowed = new Set(db.horses.filter((horse) => groomIdOf(db, horse.id) === user.id).map((horse) => horse.id));
    }
    return db.careSchedules
      .filter((item) => allowed.has(item.horseId))
      .filter((item) => !filters.horseId || item.horseId === filters.horseId)
      .filter((item) => !filters.type || item.type === filters.type)
      .sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || a.dueDate.localeCompare(b.dueDate))
      .map((item) => ({
        id: item.id,
        horseId: item.horseId,
        horseName: db.horses.find((horse) => horse.id === item.horseId)?.name ?? '—',
        type: item.type,
        name: item.name,
        dueDate: item.dueDate,
        intervalDays: item.intervalDays,
        doneAt: item.doneAt,
        doneByName: findUser(db, item.doneBy)?.name,
        cost: item.cost,
        overdue: !item.doneAt && item.dueDate < at,
        dueSoon: !item.doneAt && item.dueDate >= at && item.dueDate <= toDateKey(addDays(new Date(at), 7)),
      }));
  });
}

export function createDefaultCareSchedules(horseIds: string[]) {
  return commit((db) => {
    const user = requirePermission('care.edit');
    const at = now();
    let created = 0;
    horseIds.forEach((horseId) => {
      const horse = db.horses.find((item) => item.id === horseId);
      if (!horse || horse.isReference || horse.lifecycleStatus === 'TRANSFERRED') return;
      (['VACCINE', 'DEWORMING', 'FARRIER'] as CareScheduleType[]).forEach((type) => {
        const exists = db.careSchedules.some((item) => item.horseId === horseId && item.type === type && !item.doneAt);
        if (exists) return;
        db.careSchedules.push({
          id: newId('cs'),
          horseId,
          type,
          dueDate: toDateKey(addDays(at, careInterval[type])),
          intervalDays: careInterval[type],
          ...stamp(at),
        });
        created += 1;
      });
    });
    writeAudit(db, at, {
      action: 'Tạo lịch chăm sóc mặc định',
      entityType: 'CareSchedule',
      entityId: horseIds.join(','),
      after: { created },
      actor: user,
    });
    return created;
  });
}

export function createCareSchedule(input: { horseId: string; type: CareScheduleType; name?: string; dueDate: string; intervalDays: number }) {
  return commit((db) => {
    const user = requirePermission('care.edit');
    if (!input.dueDate) throw new AppError('Vui lòng chọn ngày đến hạn', 'dueDate');
    const at = now();
    db.careSchedules.push({
      id: newId('cs'),
      horseId: input.horseId,
      type: input.type,
      name: input.name?.trim() || undefined,
      dueDate: input.dueDate,
      intervalDays: input.intervalDays || careInterval[input.type],
      ...stamp(at),
    });
    writeAudit(db, at, { action: 'Thêm lịch chăm sóc', entityType: 'CareSchedule', entityId: input.horseId, after: input, actor: user });
  });
}

export function markCareDone(scheduleId: string, input: { doneDate: string; note?: string; cost?: number }) {
  return commit((db) => {
    const user = requireUser();
    const schedule = db.careSchedules.find((item) => item.id === scheduleId);
    if (!schedule) throw new AppError(ERR_NOT_FOUND);
    const allowed =
      user.role === 'VETERINARIAN' || (user.role === 'CLUB_MANAGER' && schedule.type === 'FARRIER');
    if (!allowed) throw new AppError('Bạn không có quyền đánh dấu mục này');
    const at = now();
    if (input.doneDate > toDateKey(at)) throw new AppError('Ngày thực hiện không được ở tương lai', 'doneDate');

    schedule.doneAt = input.doneDate;
    schedule.doneBy = user.id;
    schedule.doneNote = input.note?.trim() || undefined;
    schedule.cost = input.cost;
    touch(schedule, at);

    // Tự tạo mục kế tiếp theo chu kỳ.
    const horse = db.horses.find((item) => item.id === schedule.horseId);
    if (horse && horse.lifecycleStatus !== 'TRANSFERRED') {
      db.careSchedules.push({
        id: newId('cs'),
        horseId: schedule.horseId,
        type: schedule.type,
        name: schedule.name,
        dueDate: toDateKey(addDays(new Date(input.doneDate), schedule.intervalDays)),
        intervalDays: schedule.intervalDays,
        ...stamp(at),
      });
    }

    if (input.cost) {
      db.expenses.push({
        id: newId('ex'),
        horseId: schedule.horseId,
        category: 'MEDICAL',
        amount: input.cost,
        date: input.doneDate,
        sourceType: 'CARE_SCHEDULE',
        sourceId: scheduleId,
        note: careTypeLabel[schedule.type],
        ...stamp(at),
      });
    }

    writeAudit(db, at, {
      action: 'Đánh dấu đã làm lịch chăm sóc',
      entityType: 'CareSchedule',
      entityId: scheduleId,
      before: { doneAt: undefined },
      after: { doneAt: input.doneDate, cost: input.cost },
      actor: user,
    });
  });
}

/* ===== Chỉ dẫn chăm sóc cho nhân viên ===== */

export function listCareInstructions() {
  return query((db) => {
    const user = requireUser();
    if (user.role !== 'GROOM') return [];
    const horseIds = db.horses.filter((horse) => groomIdOf(db, horse.id) === user.id).map((horse) => horse.id);
    return db.medicalRecords
      .filter((record) => horseIds.includes(record.horseId) && record.status === 'IN_TREATMENT' && record.careInstruction)
      .map((record) => ({
        id: record.id,
        horseId: record.horseId,
        horseName: db.horses.find((item) => item.id === record.horseId)?.name ?? '—',
        horseAvatar: db.horses.find((item) => item.id === record.horseId)?.avatar,
        careInstruction: record.careInstruction!,
        examDate: record.examDate,
      }));
  });
}
