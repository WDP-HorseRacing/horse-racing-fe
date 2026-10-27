// F4.1 — Khối checklist trong tab Chăm sóc: checklist hôm nay và dải 14 ngày gần nhất (bấm một ngày để xem).
// Groom phụ trách tick hôm nay. Quản lý CLB, HLV khu chỉ xem ai tick, lúc nào. Bác sĩ không xem được (BE chặn).
// BE tạo sẵn checklist mỗi ngày cho ngựa có Groom. Ngày ngựa không có việc thì không có checklist.
import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { listChecklists } from '../../../api/stable-care';
import type { ChecklistStatus, DailyChecklist } from '../../../api/types';
import { EmptyState, ErrorBox, Skeleton, Tip, cn } from '../../../components/ui';
import { useService } from '../../../hooks/useService';
import { addDateKey, clubToday, isoWeekdayOf } from '../../../lib/club-time';
import { formatDate } from '../../../lib/format';
import { checklistStatusText } from '../../../lib/stable-labels';
import { weekdayShort } from '../../../lib/training-labels';
import { checklistProgress } from '../care-helpers';
import { ChecklistItems, ChecklistPill } from './Checklist';

const DAYS = 14;
const DOT: Record<ChecklistStatus, string> = {
  COMPLETED: 'bg-emerald-600 ring-emerald-600',
  IN_PROGRESS: 'bg-amber-400 ring-amber-400',
  PENDING: 'bg-gray-300 ring-gray-300',
  INCOMPLETE: 'bg-red-500 ring-red-500',
  CANCELLED: 'bg-white ring-gray-300',
};

export function ChecklistSection({ horse, canTick, hasGroom, version = 0, className }: { horse: { id: string }; canTick: boolean; hasGroom: boolean; version?: number; className?: string }) {
  const today = clubToday();
  const from = addDateKey(today, -(DAYS - 1));
  const data = useService(() => listChecklists(horse.id, from, today), [horse.id, from, today, version]);
  const [selected, setSelected] = useState(today);
  // Checklist vừa tick (BE trả về cả checklist). Chỉ áp cho đúng lần tải đó, tải lại thì lấy dữ liệu mới.
  const [local, setLocal] = useState<{ source?: DailyChecklist[]; map: Record<string, DailyChecklist> }>({ map: {} });
  const ticked = local.source === data.data ? local.map : {};

  const byDate = new Map((data.data ?? []).map((item) => [item.checklistDate, ticked[item.id] ?? item]));
  const current = byDate.get(selected);
  const days = Array.from({ length: DAYS }, (_, index) => addDateKey(from, index));
  const progress = checklistProgress(current);

  return (
    <section className={cn('rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <ListChecks size={17} className="text-emerald-700" /> {selected === today ? 'Việc chăm sóc hôm nay' : `Việc chăm sóc ${formatDate(selected)}`}
        </h3>
        {current && (
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <span className="tabular-nums">
              {progress.done}/{progress.total}
            </span>
            <ChecklistPill status={current.status} />
          </span>
        )}
      </div>

      {data.loading && !data.data ? (
        <Skeleton rows={4} />
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : (
        <>
          <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
            {days.map((day) => {
              const item = byDate.get(day);
              const active = day === selected;
              return (
                <Tip key={day} content={`${formatDate(day)}: ${item ? checklistStatusText[item.status] : 'Không có checklist'}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(day)}
                    className={cn('flex w-8 shrink-0 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] transition', active ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'hover:bg-gray-50')}
                  >
                    <span className={cn('font-medium', day === today ? 'text-emerald-800' : 'text-gray-400')}>{day === today ? 'Nay' : weekdayShort[isoWeekdayOf(day)]}</span>
                    <span className={cn('h-3 w-3 rounded-full ring-2', item ? DOT[item.status] : 'bg-white ring-gray-200')} />
                    <span className="text-gray-500">{day.slice(8)}</span>
                  </button>
                </Tip>
              );
            })}
          </div>

          {current ? (
            <>
              <ChecklistItems
                checklist={current}
                editable={canTick && selected === today && current.status !== 'INCOMPLETE' && current.status !== 'CANCELLED'}
                onChanged={(next) => setLocal({ source: data.data, map: { ...ticked, [next.id]: next } })}
              />
              <p className="mt-2 text-xs text-gray-500">
                Groom {current.groom.fullName}
                {current.completedAt ? ` · xong lúc ${new Date(current.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </>
          ) : (
            <EmptyState
              title={selected === today ? (hasGroom ? 'Hôm nay chưa có việc nào' : 'Ngựa chưa có Groom') : 'Ngày này không có checklist'}
              className="py-6"
            />
          )}
        </>
      )}
    </section>
  );
}
