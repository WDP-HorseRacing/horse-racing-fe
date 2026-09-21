// Flow 4 — chăm sóc chuồng trại và dinh dưỡng hằng ngày.
import type { DailyTask, DietMeal, IncidentType } from '../types/domain';
import { AppError, ERR_NOT_FOUND, newId, stamp, touch } from './db';
import { commit, pushNotification, query, requirePermission, requireUser, writeAudit } from './api';
import { visibleHorses } from '../auth/permissions';
import { findUser, groomIdOf, zoneIdOf } from './selectors';
import { now } from '../lib/clock';
import { toDateKey } from '../lib/format';
import { dailyTaskLabel, incidentTypeLabel, mealLabel } from '../lib/labels';

/* ===== F4.3 — checklist hằng ngày ===== */

/** Danh sách công việc trong ngày; công việc của ngày được sinh sẵn nếu chưa có. */
export function listDailyTasks(dateKey?: string) {
  return commit((db) => {
    const user = requireUser();
    const at = now();
    const date = dateKey ?? toDateKey(at);

    // Sinh công việc của ngày nếu chưa có.
    db.horses
      .filter((horse) => !horse.isReference && !horse.deletedAt && horse.lifecycleStatus !== 'TRANSFERRED')
      .forEach((horse) => {
        const groomId = groomIdOf(db, horse.id);
        if (!groomId) return;
        if (db.dailyTasks.some((task) => task.horseId === horse.id && task.date === date)) return;

        const diet = db.dietPlans.find((item) => item.horseId === horse.id && item.status === 'APPROVED');
        const tasks: Omit<DailyTask, 'id' | 'createdAt' | 'updatedAt' | 'version'>[] = [];
        (diet?.meals ?? []).forEach((meal: DietMeal) => {
          tasks.push({ horseId: horse.id, date, type: 'FEED', meal: meal.meal, label: `${dailyTaskLabel.FEED} — ${mealLabel[meal.meal].toLowerCase()}`, groomId });
        });
        tasks.push({ horseId: horse.id, date, type: 'CLEAN', label: dailyTaskLabel.CLEAN, groomId });
        tasks.push({ horseId: horse.id, date, type: 'BATH', label: dailyTaskLabel.BATH, groomId });

        const instruction = db.medicalRecords.find(
          (record) => record.horseId === horse.id && record.status === 'IN_TREATMENT' && record.careInstruction,
        );
        if (instruction) {
          tasks.push({ horseId: horse.id, date, type: 'CARE', label: instruction.careInstruction!, groomId });
        }

        tasks.forEach((task) => db.dailyTasks.push({ id: newId('dt'), ...task, ...stamp(at) }));
      });

    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    let rows = db.dailyTasks.filter((task) => task.date === date && allowed.has(task.horseId));
    if (user.role === 'GROOM') rows = rows.filter((task) => task.groomId === user.id);
    if (user.role === 'HEAD_TRAINER') rows = rows.filter((task) => zoneIdOf(db, task.horseId) === user.zoneId);

    return rows
      .map((task) => ({
        id: task.id,
        horseId: task.horseId,
        horseName: db.horses.find((horse) => horse.id === task.horseId)?.name ?? '—',
        horseAvatar: db.horses.find((horse) => horse.id === task.horseId)?.avatar,
        type: task.type,
        label: task.label,
        groomName: findUser(db, task.groomId)?.name,
        doneAt: task.doneAt,
        mine: task.groomId === user.id,
      }))
      .sort((a, b) => a.horseName.localeCompare(b.horseName, 'vi') || a.type.localeCompare(b.type));
  });
}

export function completeTask(taskId: string) {
  return commit((db) => {
    const user = requireUser();
    const task = db.dailyTasks.find((item) => item.id === taskId);
    if (!task) throw new AppError(ERR_NOT_FOUND);
    if (task.groomId !== user.id) throw new AppError('Công việc này không thuộc phân công của bạn');
    const at = now();
    task.doneAt = at.toISOString();
    task.doneBy = user.id;
    touch(task, at);
    writeAudit(db, at, {
      action: 'Hoàn thành công việc chăm sóc',
      entityType: 'DailyTask',
      entityId: taskId,
      after: { label: task.label, doneAt: task.doneAt },
      actor: user,
    });
  });
}

/* ===== F4.2 — khẩu phần ăn ===== */

export function listDietPlans(horseId?: string) {
  return query((db) => {
    const user = requireUser();
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    return db.dietPlans
      .filter((plan) => allowed.has(plan.horseId))
      .filter((plan) => !horseId || plan.horseId === horseId)
      // Nhân viên chăm sóc chỉ thấy khẩu phần đã duyệt.
      .filter((plan) => user.role !== 'GROOM' || plan.status === 'APPROVED')
      .sort((a, b) => b.revision - a.revision)
      .map((plan) => ({
        id: plan.id,
        horseId: plan.horseId,
        horseName: db.horses.find((horse) => horse.id === plan.horseId)?.name ?? '—',
        revision: plan.revision,
        status: plan.status,
        meals: plan.meals,
        proposedByName: findUser(db, plan.proposedBy)?.name ?? '—',
        approvedByName: findUser(db, plan.approvedBy)?.name,
      }));
  });
}

export function approveDietPlan(planId: string) {
  return commit((db) => {
    const user = requirePermission('diet.approve');
    const plan = db.dietPlans.find((item) => item.id === planId);
    if (!plan) throw new AppError(ERR_NOT_FOUND);
    if (plan.status !== 'PENDING') throw new AppError('Khẩu phần này không ở trạng thái chờ duyệt');
    const at = now();
    db.dietPlans
      .filter((item) => item.horseId === plan.horseId && item.status === 'APPROVED')
      .forEach((item) => {
        item.status = 'SUPERSEDED';
        touch(item, at);
      });
    plan.status = 'APPROVED';
    plan.approvedBy = user.id;
    touch(plan, at);

    const groomId = groomIdOf(db, plan.horseId);
    if (groomId) {
      pushNotification(db, at, {
        userId: groomId,
        title: `Khẩu phần mới cho ${db.horses.find((h) => h.id === plan.horseId)?.name}`,
        body: 'Bác sĩ đã duyệt phiên bản mới, áp dụng từ bữa kế tiếp.',
        link: '/care/diet',
      });
    }
    writeAudit(db, at, {
      action: 'Duyệt khẩu phần ăn',
      entityType: 'DietPlan',
      entityId: planId,
      before: { status: 'PENDING' },
      after: { status: 'APPROVED' },
      actor: user,
    });
  });
}

/* ===== F4.4 — báo cáo sự cố ===== */

export function listIncidents() {
  return query((db) => {
    const user = requireUser();
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    return db.incidents
      .filter((incident) => allowed.has(incident.horseId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((incident) => ({
        id: incident.id,
        horseId: incident.horseId,
        horseName: db.horses.find((horse) => horse.id === incident.horseId)?.name ?? '—',
        type: incident.type,
        description: incident.description,
        photos: incident.photos,
        urgent: incident.urgent,
        status: incident.status,
        reportedByName: findUser(db, incident.reportedBy)?.name ?? '—',
        handledByName: findUser(db, incident.handledBy)?.name,
        conclusion: incident.conclusion,
        createdAt: incident.createdAt,
      }));
  });
}

export function createIncident(input: {
  horseId: string;
  type: IncidentType;
  description: string;
  photos: string[];
  urgent: boolean;
}) {
  return commit((db) => {
    const user = requireUser();
    if (user.role !== 'GROOM' && user.role !== 'HEAD_TRAINER') {
      throw new AppError('Chỉ nhân viên chăm sóc hoặc huấn luyện viên gửi được báo cáo sự cố');
    }
    if (!input.description.trim()) throw new AppError('Vui lòng mô tả sự cố', 'description');
    if (input.photos.length === 0) throw new AppError('Vui lòng đính kèm ít nhất một ảnh', 'photos');

    const at = now();
    const incidentId = newId('inc');
    db.incidents.push({
      id: incidentId,
      horseId: input.horseId,
      type: input.type,
      description: input.description.trim(),
      photos: input.photos,
      urgent: input.urgent,
      status: 'NEW',
      reportedBy: user.id,
      ...stamp(at),
    });

    const horse = db.horses.find((item) => item.id === input.horseId);
    db.users
      .filter((item) => item.role === 'VETERINARIAN' && item.active)
      .forEach((vet) => {
        pushNotification(db, at, {
          userId: vet.id,
          level: input.urgent ? 'URGENT' : 'NORMAL',
          title: `Sự cố: ${horse?.name} — ${incidentTypeLabel[input.type].toLowerCase()}`,
          body: input.description.trim(),
          link: '/medical/board',
        });
      });
    const zoneId = zoneIdOf(db, input.horseId);
    const trainer = db.users.find((item) => item.role === 'HEAD_TRAINER' && item.zoneId === zoneId);
    if (trainer) {
      pushNotification(db, at, {
        userId: trainer.id,
        title: `Sự cố tại chuồng: ${horse?.name}`,
        body: input.description.trim(),
        link: '/care/incidents',
      });
    }

    writeAudit(db, at, {
      action: 'Gửi báo cáo sự cố',
      entityType: 'Incident',
      entityId: incidentId,
      after: { type: input.type, urgent: input.urgent },
      actor: user,
    });
    return incidentId;
  });
}

export function resolveIncident(incidentId: string, conclusion: string) {
  return commit((db) => {
    const user = requirePermission('incident.handle');
    const incident = db.incidents.find((item) => item.id === incidentId);
    if (!incident) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    incident.status = 'RESOLVED';
    incident.handledBy = user.id;
    incident.conclusion = conclusion.trim();
    touch(incident, at);
    writeAudit(db, at, {
      action: 'Xử lý xong sự cố',
      entityType: 'Incident',
      entityId: incidentId,
      after: { status: 'RESOLVED' },
      reason: conclusion,
      actor: user,
    });
  });
}

/* ===== F4.5 — vật tư ===== */

export function listStock() {
  return query((db) => {
    requireUser();
    return db.zones.map((zone) => ({
      zoneId: zone.id,
      zoneName: zone.name,
      items: db.zoneStocks
        .filter((stock) => stock.zoneId === zone.id)
        .map((stock) => {
          const item = db.supplyItems.find((supply) => supply.id === stock.itemId);
          return {
            id: stock.id,
            itemId: stock.itemId,
            name: item?.name ?? '—',
            group: item?.group ?? 'TOOL',
            unit: item?.unit ?? '',
            quantity: stock.quantity,
            minQuantity: stock.minQuantity,
            low: stock.quantity < stock.minQuantity,
          };
        }),
    }));
  });
}

export function listRestockRequests() {
  return query((db) => {
    requireUser();
    return db.restockRequests
      .sort((a, b) => a.status.localeCompare(b.status) || b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({
        id: request.id,
        zoneName: db.zones.find((zone) => zone.id === request.zoneId)?.name ?? '—',
        itemName: db.supplyItems.find((item) => item.id === request.itemId)?.name ?? '—',
        unit: db.supplyItems.find((item) => item.id === request.itemId)?.unit ?? '',
        quantity: request.quantity,
        reason: request.reason,
        status: request.status,
        requestedByName: findUser(db, request.requestedBy)?.name ?? '—',
        decidedByName: findUser(db, request.decidedBy)?.name,
        decisionNote: request.decisionNote,
        createdAt: request.createdAt,
      }));
  });
}

export function createRestockRequest(input: { zoneId: string; itemId: string; quantity: number; reason: string }) {
  return commit((db) => {
    const user = requirePermission('restock.request');
    if (input.quantity <= 0) throw new AppError('Số lượng phải lớn hơn 0', 'quantity');
    if (!input.reason.trim()) throw new AppError('Vui lòng nhập lý do đề xuất', 'reason');
    const at = now();
    db.restockRequests.push({
      id: newId('rr'),
      zoneId: input.zoneId,
      itemId: input.itemId,
      quantity: input.quantity,
      reason: input.reason.trim(),
      status: 'PENDING',
      requestedBy: user.id,
      ...stamp(at),
    });
    db.users
      .filter((item) => item.role === 'CLUB_MANAGER')
      .forEach((manager) => {
        pushNotification(db, at, {
          userId: manager.id,
          title: 'Có đề xuất bổ sung vật tư',
          body: `${db.supplyItems.find((i) => i.id === input.itemId)?.name}: ${input.quantity}`,
          link: '/care/supplies',
        });
      });
    writeAudit(db, at, { action: 'Đề xuất bổ sung vật tư', entityType: 'RestockRequest', entityId: input.itemId, after: input, actor: user });
  });
}

export function decideRestockRequest(requestId: string, approve: boolean, note: string) {
  return commit((db) => {
    const user = requirePermission('restock.approve');
    const request = db.restockRequests.find((item) => item.id === requestId);
    if (!request) throw new AppError(ERR_NOT_FOUND);
    if (request.status !== 'PENDING') throw new AppError('Đề xuất này đã được xử lý');
    if (!approve && !note.trim()) throw new AppError('Vui lòng nhập lý do từ chối', 'note');

    const at = now();
    request.status = approve ? 'APPROVED' : 'REJECTED';
    request.decidedBy = user.id;
    request.decisionNote = note.trim() || undefined;
    touch(request, at);

    if (approve) {
      const stock = db.zoneStocks.find(
        (item) => item.zoneId === request.zoneId && item.itemId === request.itemId,
      );
      if (stock) {
        stock.quantity += request.quantity;
        touch(stock, at);
      } else {
        db.zoneStocks.push({
          id: newId('zs'),
          zoneId: request.zoneId,
          itemId: request.itemId,
          quantity: request.quantity,
          minQuantity: 0,
          ...stamp(at),
        });
      }
    }

    pushNotification(db, at, {
      userId: request.requestedBy,
      title: approve ? 'Đề xuất vật tư đã được duyệt' : 'Đề xuất vật tư bị từ chối',
      body: note.trim() || `${db.supplyItems.find((i) => i.id === request.itemId)?.name}: ${request.quantity}`,
      link: '/care/supplies',
    });

    writeAudit(db, at, {
      action: approve ? 'Duyệt đề xuất bổ sung' : 'Từ chối đề xuất bổ sung',
      entityType: 'RestockRequest',
      entityId: requestId,
      before: { status: 'PENDING' },
      after: { status: request.status },
      reason: note,
      actor: user,
    });
  });
}

export function listSupplyItems() {
  return query((db) => db.supplyItems);
}

