// Dải lịch 7 ngày tới: mỗi cột một ngày, liệt kê buổi / việc trong ngày. Hôm nay nhấn nhẹ.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, cn } from './ui';
import { IntensityMeter } from './ui/status';
import type { TrainingIntensity } from '../api/types';

export interface WeekItem {
  id: string;
  time?: string;
  title: string;
  detail?: string;
  intensity?: TrainingIntensity;
  tone?: 'warn' | 'danger';
  to: string;
}

export interface WeekDay {
  /** YYYY-MM-DD */
  date: string;
  isToday: boolean;
  items: WeekItem[];
}

const DAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function dayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return { dow: DAY[date.getDay()], dm: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}` };
}

export default function WeekStrip({
  days,
  title = '7 ngày tới',
  to,
  toLabel = 'Lịch tập',
  empty = 'Không có buổi',
  extra,
}: {
  days: WeekDay[];
  title?: string;
  to?: string;
  toLabel?: string;
  empty?: string;
  extra?: ReactNode;
}) {
  const total = days.reduce((sum, day) => sum + day.items.length, 0);
  return (
    <Card className="p-0 sm:p-0">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h3 className="text-[0.95rem] font-semibold text-gray-900">
          {title} <span className="ml-1 text-sm font-normal text-gray-500">{total} mục</span>
        </h3>
        <div className="flex items-center gap-3">
          {extra}
          {to && (
            <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-emerald-700">
              {toLabel} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
      <div className="overflow-x-auto border-t border-gray-100 custom-scrollbar">
        <div className="grid min-w-[840px] grid-cols-7 divide-x divide-gray-100">
          {days.map((day) => {
            const label = dayLabel(day.date);
            return (
              <div key={day.date} className={cn('min-h-36 px-3 pb-3 pt-2.5', day.isToday && 'bg-emerald-50/40')}>
                <p className={cn('mb-2 text-xs', day.isToday ? 'font-semibold text-emerald-800' : 'text-gray-500')}>
                  {day.isToday ? 'Hôm nay' : label.dow} · <span className="tabular-nums">{label.dm}</span>
                </p>
                {day.items.length === 0 ? (
                  <p className="text-xs text-gray-300">{empty}</p>
                ) : (
                  <div className="space-y-1.5">
                    {day.items.map((item) => (
                      <Link
                        key={item.id}
                        to={item.to}
                        className={cn(
                          'block rounded-lg bg-white px-2 py-1.5 ring-1 ring-gray-200/80 transition hover:ring-gray-300',
                          item.tone === 'warn' && 'shadow-[inset_2px_0_0_0_#f59e0b]',
                          item.tone === 'danger' && 'shadow-[inset_2px_0_0_0_#ef4444]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="truncate text-xs font-semibold text-gray-900">
                            {item.time && <span className="mr-1 tabular-nums text-gray-500">{item.time}</span>}
                            {item.title}
                          </p>
                          {item.intensity && <IntensityMeter intensity={item.intensity} showLabel={false} />}
                        </div>
                        {item.detail && <p className="mt-0.5 truncate text-[11px] text-gray-500">{item.detail}</p>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
