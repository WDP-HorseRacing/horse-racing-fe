// F4.1, F4.2 — Màn Việc hôm nay của Groom (GET /grooms/me/today): mỗi ngựa đang phụ trách một thẻ gồm
// checklist hôm nay (tick to, dễ bấm trên điện thoại), khẩu phần đang áp dụng theo bữa (nhấn bữa sắp tới),
// lượt dắt ngựa tập hôm nay (kèm sân, mặt sân) và lịch chăm sóc đến hạn. BE không trả ảnh và sức khỏe ngựa: lấy từ danh sách ngựa của tôi.
// Thêm hai khối chung: lịch chăm sóc ở ngựa khác và lượt dắt hộ (HLV giao dắt ngựa Groom không phụ trách).
import { Link } from 'react-router-dom';
import { CalendarClock, Flag, Siren, Stethoscope } from 'lucide-react';
import type { DailyChecklist, FeedingMeal, GroomToday, GroomTodayHorse, GroomTodayRun, HorseListItem } from '../../../api/types';
import { Avatar, Button, EmptyState, cn } from '../../../components/ui';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { HealthPill } from '../../../components/ui/status';
import { careTypeLabel } from '../../../lib/api-labels';
import { clubTime } from '../../../lib/club-time';
import { formatDate, formatTime } from '../../../lib/format';
import { links } from '../../../lib/links';
import { MEAL_HOUR, mealText } from '../../../lib/stable-labels';
import { participantStatusText } from '../../../lib/training-labels';
import { checklistProgress } from '../care-helpers';
import { ChecklistItems, ChecklistPill } from './Checklist';
import { MealPlan } from './MealPlan';

/** "Sân 1 · Cát": Groom biết dắt ngựa ra đâu. */
const runPlace = (run: GroomTodayRun) => [run.location, run.surface].filter(Boolean).join(' · ');

function RunLine({ run, horseName }: { run: GroomTodayRun; horseName?: string }) {
  const place = runPlace(run);
  return (
    <Link to={links.today} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-emerald-50">
      <Flag size={14} className="shrink-0 text-emerald-700" />
      <span className="font-mono text-xs font-semibold">{clubTime(run.scheduledStartAt)}</span>
      <span className="min-w-0 flex-1 truncate text-gray-800">
        {horseName ? <b className="font-semibold">{horseName}</b> : 'Dắt tập'}: {run.sessionName}
        {place && <span className="text-gray-500"> · {place}</span>}
      </span>
      <span className="shrink-0 text-xs text-gray-500" title={run.stoppedReason ?? undefined}>
        {participantStatusText[run.status]}
      </span>
    </Link>
  );
}

/** Bữa sắp tới hoặc đang trong khoảng 2 giờ, theo giờ CLB. */
function nextMeal(horse: GroomTodayHorse): FeedingMeal | undefined {
  const meals = horse.feedingPlan?.meals.map((meal) => meal.meal) ?? [];
  const hour = Number(clubTime(new Date()).slice(0, 2));
  return meals.find((meal) => MEAL_HOUR[meal] + 2 > hour);
}

export function GroomDay({
  today,
  horses,
  ticked,
  onTicked,
  onReport,
}: {
  today: GroomToday;
  /** Danh sách ngựa của tôi: ảnh, sức khỏe. */
  horses: HorseListItem[];
  /** Checklist vừa tick (BE trả cả checklist), theo id. Nơi dùng giữ để số tổng trên đầu trang khớp. */
  ticked: Record<string, DailyChecklist>;
  onTicked: (checklist: DailyChecklist) => void;
  onReport: (horse: { id: string; name: string }) => void;
}) {
  const byId = new Map(horses.map((horse) => [horse.id, horse]));

  const others = today.otherCareSchedules ?? [];
  // Lịch ở ngựa không phụ trách: Groom vẫn có việc dù chưa được giao ngựa nào.
  const otherBlock = others.length > 0 && (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 xl:col-span-2">
      <h3 className="text-sm font-semibold text-gray-900">Lịch chăm sóc ở ngựa khác</h3>
      <p className="mt-0.5 text-xs text-gray-500">Bác sĩ giao đích danh cho bạn ở ngựa bạn không phụ trách.</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {others.map((care) => (
          <li key={care.id}>
            <Link
              to={links.horseMedical(care.horseId)}
              className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition', care.overdue ? 'bg-red-50 text-red-800 hover:bg-red-100' : 'hover:bg-gray-50')}
            >
              <CalendarClock size={14} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                <b className="font-semibold">{care.horseName}</b> · {careTypeLabel[care.type]}
              </span>
              <span className="shrink-0 text-xs">{care.overdue ? `Quá hạn từ ${formatDate(care.dueAt)}` : 'Đến hạn hôm nay'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );

  const assisted = today.assistedRuns ?? [];
  // Lượt dắt hộ: HLV giao Groom dắt ngựa của Groom khác, Groom vẫn có lượt dù không phụ trách ngựa nào.
  const assistedBlock = assisted.length > 0 && (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-emerald-200/70 xl:col-span-2">
      <h3 className="text-sm font-semibold text-gray-900">Lượt dắt hộ hôm nay</h3>
      <p className="mt-0.5 text-xs text-gray-500">HLV giao bạn dắt ngựa bạn không phụ trách. Bấm để mở Dắt ngựa tập.</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {assisted.map((run) => (
          <li key={run.participantId}>
            <RunLine run={run} horseName={run.horseName} />
          </li>
        ))}
      </ul>
    </section>
  );

  const vetAppointments = today.horseVetAppointments ?? [];
  // Ngày hẹn khám định kỳ, tái khám hôm nay: Groom chuẩn bị ngựa, bác sĩ ghi buổi khám.
  const vetBlock = vetAppointments.length > 0 && (
    <section className="rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-200/80 xl:col-span-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <Stethoscope size={15} className="text-amber-700" /> Lịch hẹn bác sĩ hôm nay
      </h3>
      <p className="mt-0.5 text-xs text-gray-500">Giữ ngựa ở chuồng, sạch sẽ trước giờ hẹn để bác sĩ khám.</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {vetAppointments.map((appointment) => (
          <li key={appointment.id}>
            <Link to={links.horse(appointment.horseId)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-amber-100/60">
              <span className="w-11 shrink-0 font-semibold tabular-nums text-amber-800">{formatTime(appointment.scheduledAt)}</span>
              <span className="min-w-0 flex-1 truncate">
                <b className="font-semibold">{appointment.horseName}</b> · {appointment.type === 'FOLLOW_UP' ? 'Tái khám' : 'Khám định kỳ'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );

  if (today.horses.length === 0)
    return otherBlock || assistedBlock || vetBlock ? (
      <div className="space-y-4">
        {vetBlock}
        {assistedBlock}
        {otherBlock}
        <EmptyState title="Bạn chưa được giao ngựa nào" hint="Hỏi HLV khu để được giao ngựa." />
      </div>
    ) : (
      <EmptyState title="Bạn chưa được giao ngựa nào" hint="Hỏi HLV khu để được giao ngựa." />
    );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {vetBlock}
      {assistedBlock}
      {otherBlock}
      {today.horses.map((entry) => {
        const horse = byId.get(entry.horseId);
        const checklist = entry.checklist ? (ticked[entry.checklist.id] ?? entry.checklist) : null;
        const progress = checklistProgress(checklist);
        // BE chỉ trả lượt còn phải dắt (Chờ điểm danh tới Hoàn thành), không cần lọc thêm.
        const runs = entry.trainingRuns;
        const place = [entry.barnName, entry.stallCode ? `Ô ${entry.stallCode}` : null].filter(Boolean).join(' · ');
        return (
          <article key={entry.horseId} data-reveal className="flex flex-col rounded-3xl bg-white p-4 shadow-grass-tint ring-1 ring-emerald-900/10 sm:p-5">
            <header className="flex items-center gap-3">
              <Link to={links.horse(entry.horseId, 'care')} className="shrink-0">
                <Avatar src={horse?.photoUrl ?? undefined} name={entry.horseName} size={48} className="rounded-2xl" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={links.horse(entry.horseId, 'care')} className="block truncate text-lg font-bold text-gray-900 hover:underline">
                  {entry.horseName}
                </Link>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                  {place || 'Chưa xếp ô'}
                  {horse && <HealthPill status={horse.healthStatus} />}
                </p>
              </div>
              {checklist && (
                <ProgressRing value={progress.done} max={progress.total} size={46}>
                  <span className="font-mono text-[11px] font-bold text-gray-900">
                    {progress.done}/{progress.total}
                  </span>
                </ProgressRing>
              )}
            </header>

            <div className="mt-4 grid flex-1 gap-4 md:grid-cols-5">
              <div className="md:col-span-3">
                <p className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
                  Việc cần làm {checklist && <ChecklistPill status={checklist.status} />}
                </p>
                {checklist ? (
                  <ChecklistItems
                    large
                    checklist={checklist}
                    editable={checklist.status !== 'INCOMPLETE' && checklist.status !== 'CANCELLED'}
                    onChanged={onTicked}
                  />
                ) : (
                  <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">Hôm nay không có việc chăm sóc.</p>
                )}
              </div>
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-semibold text-gray-500">Khẩu phần{nextMeal(entry) ? ` · bữa tới: ${mealText[nextMeal(entry)!].toLowerCase()}` : ''}</p>
                {entry.feedingPlan ? (
                  <MealPlan plan={entry.feedingPlan} compact highlight={nextMeal(entry)} />
                ) : (
                  <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-100">Chưa có khẩu phần, báo HLV khu.</p>
                )}
              </div>
            </div>

            {(runs.length > 0 || entry.careSchedules.length > 0) && (
              <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-sm">
                {runs.map((run) => (
                  <li key={run.participantId}>
                    <RunLine run={run} />
                  </li>
                ))}
                {entry.careSchedules.map((care) => (
                  <li key={care.id}>
                    <Link to={links.horseMedical(entry.horseId)} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 transition', care.overdue ? 'bg-red-50 text-red-800 hover:bg-red-100' : 'hover:bg-gray-50')}>
                      <CalendarClock size={14} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{careTypeLabel[care.type]}</span>
                      <span className="shrink-0 text-xs">{care.overdue ? `Quá hạn từ ${formatDate(care.dueAt)}` : 'Đến hạn hôm nay'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex justify-end">
              <Button variant="inlineDanger" size="sm" onClick={() => onReport({ id: entry.horseId, name: entry.horseName })}>
                <Siren size={13} /> Báo sự cố
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
