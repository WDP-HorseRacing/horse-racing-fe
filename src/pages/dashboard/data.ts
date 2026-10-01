// Dữ liệu trang Tổng quan theo vai trò, ghép từ API thật. Câu lạc bộ nhỏ (vài chục ngựa) nên
// lấy cả danh sách ngựa một lần rồi tính trên máy; các số y tế lấy từ /medical/dashboard.
import { listAllHorses } from '../../api/horses';
import { listBarns, listStalls } from '../../api/stable';
import { getCareInstructions, getMedicalDashboard, listCareSchedules, listExamRequests, listHorseCases } from '../../api/medical';
import type { CareSchedule, HorseListItem, MedicalCase, MedicalDashboard } from '../../api/types';
import type { WeekDay, WeekItem } from '../../components/WeekStrip';
import { careTypeLabel } from '../../lib/api-labels';
import { addDays, daysBetween, formatDateShort, formatTime, toDateKey } from '../../lib/format';
import { links } from '../../lib/links';
import { primeZoneScope } from '../../hooks/useMyScope';
import { now } from '../../lib/clock';

export const inClub = (horse: HorseListItem) => !horse.isDeleted && horse.lifecycleStatus !== 'TRANSFERRED';
/** Ngựa đang hoạt động, sức khỏe đủ điều kiện mà không được đua ⇒ đang bị khóa huấn luyện. */
export const isLocked = (horse: HorseListItem) => horse.lifecycleStatus === 'ACTIVE' && horse.healthStatus === 'ELIGIBLE' && !horse.canRegisterRace;
export const cannotTrain = (horse: HorseListItem) =>
  horse.lifecycleStatus === 'ACTIVE' && (horse.healthStatus === 'INJURED' || horse.healthStatus === 'QUARANTINED' || isLocked(horse));

function emptyWeek(): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => ({ date: toDateKey(addDays(now(), index)), isToday: index === 0, items: [] }));
}

/**
 * Lịch y tế 7 ngày tới: hạn khám định kỳ, ngày hẹn khám, hẹn tái khám của bệnh án, lịch chăm sóc.
 * `horseIds` giới hạn theo phạm vi (HT: ngựa trong khu; bỏ trống = toàn câu lạc bộ).
 */
export function medicalWeek(dashboard: MedicalDashboard | undefined, care: { schedule: CareSchedule; horseName: string }[], horseIds?: Set<string>): WeekDay[] {
  const days = emptyWeek();
  const byDate = new Map(days.map((day) => [day.date, day]));
  const allowed = (id: string) => !horseIds || horseIds.has(id);
  const push = (date: string | null | undefined, item: WeekItem) => {
    if (!date) return;
    byDate.get(toDateKey(date))?.items.push(item);
  };
  dashboard?.checkups.filter((item) => allowed(item.horseId)).forEach((item) => {
    if (item.appointment) {
      push(item.appointment.scheduledAt, {
        id: `appt-${item.appointment.id}`,
        time: formatTime(item.appointment.scheduledAt),
        title: item.horseName,
        detail: 'Hẹn khám định kỳ',
        to: links.periodic,
      });
    } else if (item.daysLeft >= 0) {
      push(item.dueDate, { id: `due-${item.horseId}`, title: item.horseName, detail: 'Tới hạn khám định kỳ', tone: 'warn', to: links.periodic });
    }
  });
  dashboard?.openCases.filter((item) => allowed(item.horseId)).forEach((item) => {
    push(item.nextVisitAt, {
      id: `visit-${item.caseId}`,
      time: item.nextVisitAt ? formatTime(item.nextVisitAt) : undefined,
      title: item.horseName,
      detail: `Tái khám · ${item.initialDiagnosis}`,
      tone: 'warn',
      to: links.case(item.caseId),
    });
  });
  care
    .filter((item) => item.schedule.status === 'SCHEDULED' && allowed(item.schedule.horseId))
    .forEach(({ schedule, horseName }) => {
      push(schedule.dueAt, {
        id: `care-${schedule.id}`,
        title: horseName,
        detail: careTypeLabel[schedule.type],
        to: links.horseMedical(schedule.horseId),
      });
    });
  days.forEach((day) => day.items.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')));
  return days;
}

/**
 * Việc y tế đã quá hạn (nhóm "Quá hạn" đầu lịch): khám định kỳ quá hạn, hẹn tái khám đã qua, lịch chăm sóc quá hạn.
 * Quá hạn hơn 7 ngày tô đỏ (mốc bác sĩ và quản lý nhận thông báo), còn lại hổ phách. Quá hạn lâu nhất lên trên.
 */
export function medicalOverdue(dashboard: MedicalDashboard | undefined, care: { schedule: CareSchedule; horseName: string }[], horseIds?: Set<string>): WeekItem[] {
  const today = toDateKey(now());
  const allowed = (id: string) => !horseIds || horseIds.has(id);
  const late = (date: string) => -daysBetween(now(), date);
  const items: { days: number; item: WeekItem }[] = [];
  dashboard?.checkups
    .filter((item) => allowed(item.horseId) && item.daysLeft < 0)
    .forEach((item) =>
      items.push({
        days: -item.daysLeft,
        item: {
          id: `od-due-${item.horseId}`,
          title: item.horseName,
          detail: `Khám định kỳ quá hạn ${-item.daysLeft} ngày${item.appointment ? ` · đã hẹn ${formatDateShort(item.appointment.scheduledAt)}` : ''}`,
          tone: item.daysLeft < -7 ? 'danger' : 'warn',
          to: links.periodic,
        },
      }),
    );
  dashboard?.openCases
    .filter((item) => allowed(item.horseId) && item.nextVisitAt && toDateKey(item.nextVisitAt) < today)
    .forEach((item) =>
      items.push({
        days: late(item.nextVisitAt!),
        item: {
          id: `od-visit-${item.caseId}`,
          title: item.horseName,
          detail: `Quá hẹn tái khám ${late(item.nextVisitAt!)} ngày · ${item.initialDiagnosis}`,
          tone: 'warn',
          to: links.case(item.caseId),
        },
      }),
    );
  care
    .filter((item) => item.schedule.status === 'SCHEDULED' && allowed(item.schedule.horseId) && toDateKey(item.schedule.dueAt) < today)
    .forEach(({ schedule, horseName }) =>
      items.push({
        days: late(schedule.dueAt),
        item: {
          id: `od-care-${schedule.id}`,
          title: horseName,
          detail: `${careTypeLabel[schedule.type]} quá hạn ${late(schedule.dueAt)} ngày`,
          tone: late(schedule.dueAt) > 7 ? 'danger' : 'warn',
          to: links.horseMedical(schedule.horseId),
        },
      }),
    );
  return items.sort((a, b) => b.days - a.days).map((entry) => entry.item);
}

/** Lịch chăm sóc đến hạn trong dashboard y tế (quá hạn + 3 ngày tới) đổi sang dạng chung. */
function dashboardCare(dashboard: MedicalDashboard): { schedule: CareSchedule; horseName: string }[] {
  return dashboard.careSchedules.map((item) => ({
    horseName: item.horseName,
    schedule: {
      id: item.scheduleId,
      horseId: item.horseId,
      type: item.type,
      dueAt: item.dueDate,
      assignedTo: item.assignedTo,
      status: 'SCHEDULED',
      completedAt: null,
      completedBy: null,
      cancelReason: null,
      notes: null,
    },
  }));
}

export const todayKey = () => toDateKey(now());

/* ===== Quản lý câu lạc bộ ===== */

export async function loadManager() {
  const [horses, barns, stalls, medical] = await Promise.all([listAllHorses(), listBarns(), listStalls(), getMedicalDashboard()]);
  const club = horses.filter(inClub);
  const care = dashboardCare(medical);
  return {
    horses: club,
    barns,
    stalls,
    medical,
    week: medicalWeek(medical, care),
    overdue: medicalOverdue(medical, care),
  };
}

/* ===== Huấn luyện viên trưởng ===== */

export async function loadTrainer(userId: string) {
  const [horses, barns, stalls, medical] = await Promise.all([listAllHorses({ myBarns: true }), listBarns(), listStalls(), getMedicalDashboard()]);
  const mine = horses.filter(inClub);
  const ids = new Set(mine.map((horse) => horse.id));
  const care = dashboardCare(medical);
  primeZoneScope(userId, barns, stalls);
  return {
    horses: mine,
    barns: barns.filter((barn) => barn.headTrainerId === userId),
    stalls,
    medical,
    ids,
    week: medicalWeek(medical, care, ids),
    overdue: medicalOverdue(medical, care, ids),
  };
}

/* ===== Bác sĩ thú y ===== */

export async function loadVet() {
  const [medical, barns, stalls] = await Promise.all([getMedicalDashboard(), listBarns(), listStalls()]);
  const care = dashboardCare(medical);
  return { medical, barns, stalls, week: medicalWeek(medical, care), overdue: medicalOverdue(medical, care) };
}

/* ===== Nhân viên chăm sóc ===== */

export async function loadGroom() {
  const horses = (await listAllHorses({ myHorses: true })).filter(inClub);
  const [care, notes, requests] = await Promise.all([
    // Groom chỉ nhận lịch được giao cho chính mình.
    Promise.all(horses.map((horse) => listCareSchedules(horse.id).then((items) => items.map((schedule) => ({ schedule, horseName: horse.name }))).catch(() => []))),
    Promise.all(horses.map((horse) => getCareInstructions(horse.id).then((result) => ({ horse, current: result.current })).catch(() => ({ horse, current: null })))),
    listExamRequests({ status: 'PENDING', limit: 100 }).catch(() => undefined),
  ]);
  const schedules = care.flat().filter((item) => item.schedule.status === 'SCHEDULED');
  return {
    horses,
    schedules: schedules.sort((a, b) => a.schedule.dueAt.localeCompare(b.schedule.dueAt)),
    notes: notes.filter((item) => item.current),
    requests: requests?.items ?? [],
    week: medicalWeek(undefined, schedules),
    overdue: medicalOverdue(undefined, schedules),
  };
}

/* ===== Chủ ngựa ===== */

export async function loadOwner() {
  const horses = await listAllHorses();
  const active = horses.filter(inClub);
  const [cases, care] = await Promise.all([
    Promise.all(horses.map((horse) => listHorseCases(horse.id).then((result) => ({ horse, ...result })).catch(() => ({ horse, items: [] as MedicalCase[], totalCost: undefined })))),
    Promise.all(active.map((horse) => listCareSchedules(horse.id).then((items) => items.map((schedule) => ({ schedule, horseName: horse.name }))).catch(() => []))),
  ]);
  const schedules = care.flat().filter((item) => item.schedule.status === 'SCHEDULED');
  const allCases = cases.flatMap((entry) => entry.items.map((item) => ({ ...item, horseName: entry.horse.name })));
  return {
    horses,
    active,
    openCases: allCases.filter((item) => item.status === 'OPEN'),
    closedCases: allCases.filter((item) => item.status === 'CLOSED').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? '')),
    medicalCost: cases.reduce((sum, entry) => sum + (entry.totalCost ?? 0), 0),
    schedules,
    week: medicalWeek(undefined, schedules),
    overdue: medicalOverdue(undefined, schedules),
  };
}
