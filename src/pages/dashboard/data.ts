// Dữ liệu trang Tổng quan theo vai trò, ghép từ API thật. Câu lạc bộ nhỏ (vài chục ngựa) nên
// lấy cả danh sách ngựa một lần rồi tính trên máy; các số y tế lấy từ /medical/dashboard.
import { listAllHorses } from '../../api/horses';
import { listBarns, listStalls } from '../../api/stable';
import { getCareInstructions, getCostReport, getMedicalDashboard, listCareSchedules, listCheckups, listExamRequests, listHorseCases } from '../../api/medical';
import { fetchAll } from '../../api/http';
import type { CareSchedule, ExamRequest, ExamRequestStatus, HorseListItem, MedicalCase, MedicalDashboard } from '../../api/types';
import { lastMonths } from './charts';
import type { WeekDay, WeekItem } from '../../components/WeekStrip';
import { careTypeLabel } from '../../lib/api-labels';
import { addDays, daysBetween, formatDateShort, formatTime, toDateKey } from '../../lib/format';
import { links } from '../../lib/links';
import { primeZoneScope } from '../../hooks/useMyScope';
import { now } from '../../lib/clock';
import { isReadOnlyHorse } from '../../lib/horse-rules';
import { getGroomToday, listIncidents } from '../../api/stable-care';
import { countSupplyRequests, listLowStock } from '../../api/supplies';
import { getOwnerCosts } from '../../api/reports';
import { listHorseSurcharges, listUnappliedSurcharges, type UnappliedSurcharge } from '../../api/billing';
import { clubDateKey } from '../../lib/club-time';
import { FEATURES } from '../../config/features';

export const inClub = (horse: HorseListItem) => !isReadOnlyHorse(horse);
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
  // Chi phí 6 tháng: BE chưa gom theo tháng nên gọi cost-report cho từng tháng (song song).
  const months = lastMonths(6);
  const [horses, barns, stalls, medical, checkups, costs, stable, surcharges] = await Promise.all([
    listAllHorses(),
    listBarns(),
    listStalls(),
    getMedicalDashboard(),
    listCheckups().catch(() => []),
    Promise.all(
      months.map((month) =>
        getCostReport({ from: month.from, to: month.to })
          .then((report) => ({ key: month.key, label: month.label, total: report.totalCost, count: report.visitCount }))
          .catch(() => ({ key: month.key, label: month.label, total: 0, count: 0 })),
      ),
    ),
    loadStableSummary(true),
    // Phụ phí HLV khu chưa xác nhận áp dụng (chưa kết thúc).
    listUnappliedSurcharges().catch(() => [] as UnappliedSurcharge[]),
  ]);
  const club = horses.filter(inClub);
  const care = dashboardCare(medical);
  return {
    horses: club,
    barns,
    stalls,
    medical,
    checkups,
    costs,
    stable,
    surcharges,
    week: medicalWeek(medical, care),
    overdue: medicalOverdue(medical, care),
  };
}

/* ===== Huấn luyện viên trưởng ===== */

export async function loadTrainer(userId: string) {
  const [horses, barns, stalls, medical, stable] = await Promise.all([listAllHorses({ myBarns: true }), listBarns(), listStalls(), getMedicalDashboard({ mine: true }), loadStableSummary(false)]);
  const mine = horses.filter(inClub);
  const ids = new Set(mine.map((horse) => horse.id));
  const care = dashboardCare(medical);
  primeZoneScope(userId, barns, stalls);
  // BE chưa có danh sách phụ phí chưa áp dụng theo khu: gọi từng ngựa trong khu (vài con), lỗi thì bỏ qua.
  const today = clubDateKey(new Date());
  const surcharges = (
    await Promise.all(
      mine.map((horse) =>
        listHorseSurcharges(horse.id)
          .then((rows) => rows.filter((row) => !row.appliedAt && row.endDate >= today).map((row) => ({ ...row, horseName: horse.name })))
          .catch(() => []),
      ),
    )
  ).flat();
  return {
    horses: mine,
    barns: barns.filter((barn) => barn.headTrainerId === userId),
    stalls,
    medical,
    stable,
    ids,
    surcharges,
    week: medicalWeek(medical, care, ids),
    overdue: medicalOverdue(medical, care, ids),
  };
}

/* ===== Bác sĩ thú y ===== */

export async function loadVet() {
  // Yêu cầu khám theo tuần: /exam-requests chưa lọc theo ngày, nên lấy đủ 3 trạng thái rồi gom ở FE.
  const statuses: ExamRequestStatus[] = ['PENDING', 'EXAMINED', 'DISMISSED'];
  const [medical, barns, stalls, checkups, requests] = await Promise.all([
    getMedicalDashboard(),
    listBarns(),
    listStalls(),
    listCheckups().catch(() => []),
    Promise.all(statuses.map((status) => fetchAll<ExamRequest>('/exam-requests', { status }).catch(() => []))).then((lists) => lists.flat()),
  ]);
  const care = dashboardCare(medical);
  return { medical, barns, stalls, checkups, requests, week: medicalWeek(medical, care), overdue: medicalOverdue(medical, care) };
}

/* ===== Chăm sóc chuồng (Flow 4) cho HLV và Quản lý CLB ===== */

/** Sự cố đang mở (HLV: BE lọc theo khu mình), vật tư sắp hết, đề xuất chờ duyệt (chỉ Quản lý CLB). Lỗi thì coi như rỗng. */
async function loadStableSummary(manager: boolean) {
  if (!FEATURES.stableCare) return { incidents: [], lowStock: [], pendingSupply: 0 };
  const [incidents, lowStock, pendingSupply] = await Promise.all([
    listIncidents({ status: 'OPEN' }).catch(() => []),
    listLowStock().catch(() => []),
    manager ? countSupplyRequests('PENDING').catch(() => 0) : Promise.resolve(0),
  ]);
  return { incidents, lowStock, pendingSupply };
}

/* ===== Nhân viên chăm sóc ===== */

export async function loadGroom() {
  const horses = (await listAllHorses({ myHorses: true })).filter(inClub);
  // Lịch tiêm phòng, tẩy giun, kiểm tra móng là việc của bác sĩ (BE 27/10): màn của Groom không tải nữa.
  const [notes, requests, today, incidents] = await Promise.all([
    Promise.all(horses.map((horse) => getCareInstructions(horse.id).then((result) => ({ horse, current: result.current })).catch(() => ({ horse, current: null })))),
    listExamRequests({ status: 'PENDING', limit: 100 }).catch(() => undefined),
    // Flow 4: việc hôm nay (checklist, khẩu phần, lượt dắt tập) và sự cố còn mở của ngựa mình hoặc mình báo. Lỗi thì màn vẫn hiện phần cũ.
    FEATURES.stableCare ? getGroomToday().catch(() => null) : Promise.resolve(null),
    FEATURES.stableCare ? listIncidents({ status: 'OPEN' }).catch(() => []) : Promise.resolve([]),
  ]);
  return {
    horses,
    notes: notes.filter((item) => item.current),
    requests: requests?.items ?? [],
    today,
    incidents,
  };
}

/* ===== Chủ ngựa ===== */

export async function loadOwner() {
  const horses = await listAllHorses();
  const active = horses.filter(inClub);
  const [cases, care, costs] = await Promise.all([
    Promise.all(horses.map((horse) => listHorseCases(horse.id).then((result) => ({ horse, ...result })).catch(() => ({ horse, items: [] as MedicalCase[], totalCost: undefined })))),
    Promise.all(active.map((horse) => listCareSchedules(horse.id).then((items) => items.map((schedule) => ({ schedule, horseName: horse.name }))).catch(() => []))),
    // 30 ngày gần nhất (mặc định của BE): phí nuôi, phụ phí, y tế theo ngày khám.
    getOwnerCosts({}).catch(() => null),
  ]);
  const schedules = care.flat().filter((item) => item.schedule.status === 'SCHEDULED');
  const allCases = cases.flatMap((entry) => entry.items.map((item) => ({ ...item, horseName: entry.horse.name })));
  return {
    horses,
    active,
    openCases: allCases.filter((item) => item.status === 'OPEN'),
    // Bệnh án gần nhất (đang điều trị hoặc đã đóng), có chi phí ngay từ buổi khám đầu.
    recentCases: allCases
      .filter((item) => item.status !== 'CANCELLED')
      .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
      .slice(0, 6),
    medicalCost: cases.reduce((sum, entry) => sum + (entry.totalCost ?? 0), 0),
    costs,
    schedules,
    week: medicalWeek(undefined, schedules),
    overdue: medicalOverdue(undefined, schedules),
  };
}
