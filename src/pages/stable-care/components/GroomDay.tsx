// F4.1, F4.2 — Màn Việc hôm nay của Groom (GET /grooms/me/today): mỗi ngựa đang phụ trách một thẻ gồm
// checklist hôm nay (tick to, dễ bấm trên điện thoại), khẩu phần đang áp dụng theo bữa (nhấn bữa sắp tới),
// lượt dắt ngựa tập hôm nay và lịch chăm sóc đến hạn. BE không trả ảnh và sức khỏe ngựa: lấy từ danh sách ngựa của tôi.
import { Link } from 'react-router-dom';
import { CalendarClock, Flag, Siren } from 'lucide-react';
import type { DailyChecklist, FeedingMeal, GroomToday, GroomTodayHorse, HorseListItem, ParticipantStatus } from '../../../api/types';
import { Avatar, Button, EmptyState, cn } from '../../../components/ui';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { HealthPill } from '../../../components/ui/status';
import { careTypeLabel } from '../../../lib/api-labels';
import { clubTime } from '../../../lib/club-time';
import { formatDate } from '../../../lib/format';
import { links } from '../../../lib/links';
import { MEAL_HOUR, mealText } from '../../../lib/stable-labels';
import { participantStatusText } from '../../../lib/training-labels';
import { checklistProgress } from '../care-helpers';
import { ChecklistItems, ChecklistPill } from './Checklist';
import { MealPlan } from './MealPlan';

/** Lượt BE vẫn trả nhưng không còn phải dắt (đã báo BE lọc). */
const HIDDEN_RUNS: ParticipantStatus[] = ['ABSENT', 'SKIPPED', 'INELIGIBLE', 'CANCELLED_BY_LOCK', 'CANCELLED'];

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

  if (today.horses.length === 0) return <EmptyState title="Bạn chưa được phân công chăm sóc ngựa nào" hint="Quản lý CLB hoặc HLV khu phân công Groom cho từng ngựa." />;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {today.horses.map((entry) => {
        const horse = byId.get(entry.horseId);
        const checklist = entry.checklist ? (ticked[entry.checklist.id] ?? entry.checklist) : null;
        const progress = checklistProgress(checklist);
        const runs = entry.trainingRuns.filter((run) => !HIDDEN_RUNS.includes(run.status));
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
                    editable={checklist.status !== 'INCOMPLETE'}
                    onChanged={onTicked}
                  />
                ) : (
                  <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">Hôm nay không có việc nào cho ngựa này.</p>
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
                    <Link to={links.today} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-emerald-50">
                      <Flag size={14} className="shrink-0 text-emerald-700" />
                      <span className="font-mono text-xs font-semibold">{clubTime(run.scheduledStartAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-gray-800">Dắt tập: {run.sessionName}</span>
                      <span className="shrink-0 text-xs text-gray-500">{participantStatusText[run.status]}</span>
                    </Link>
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
