// Lịch dạng danh sách theo ngày (kiểu "Lịch biểu" của Google Calendar): mỗi ngày có việc là một nhóm,
// bên trái là ngày, bên phải là từng việc. Các ngày trống liền nhau gộp thành một dòng. Nhóm "Quá hạn"
// (nếu có) nằm trên cùng. Không có chiều rộng tối thiểu nên màn hẹp không phải cuộn ngang.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, Dot, cn } from './ui';
import type { WeekDay, WeekItem } from './WeekStrip';

const DOW = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const parse = (dateKey: string) => new Date(`${dateKey}T00:00:00`);
const dayMonth = (dateKey: string) => {
  const date = parse(dateKey);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** '04/10', '04–07/10' hoặc '30/10–02/11'. */
function rangeLabel(from: string, to: string) {
  if (from === to) return dayMonth(from);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return sameMonth ? `${dayMonth(from).slice(0, 2)}–${dayMonth(to)}` : `${dayMonth(from)}–${dayMonth(to)}`;
}

function ItemRow({ item }: { item: WeekItem }) {
  return (
    <li>
      <Link to={item.to} className="group flex items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-gray-50">
        <span className="w-10 shrink-0 pt-px text-xs tabular-nums text-gray-500">{item.time ?? ''}</span>
        <Dot tone={item.tone === 'danger' ? 'danger' : item.tone === 'warn' ? 'warn' : 'neutral'} className="mt-1.5" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{item.title}</span>
          {item.detail && <span className="block truncate text-xs text-gray-500">{item.detail}</span>}
        </span>
        <ArrowRight size={14} className="mt-1 shrink-0 text-gray-300 opacity-0 transition group-hover:opacity-100" />
      </Link>
    </li>
  );
}

function Group({ side, children, tone }: { side: ReactNode; children: ReactNode; tone?: 'today' | 'overdue' }) {
  return (
    <div className={cn('grid grid-cols-[4.5rem_1fr] gap-3 px-5 py-3', tone === 'today' && 'bg-emerald-50/40', tone === 'overdue' && 'bg-amber-50/40')}>
      <div className="pt-1">{side}</div>
      <ul className="min-w-0 space-y-0.5">{children}</ul>
    </div>
  );
}

export default function DayAgenda({
  days,
  overdue = [],
  title,
  to,
  toLabel,
  empty = 'Không có lịch',
  className = '',
}: {
  days: WeekDay[];
  overdue?: WeekItem[];
  title: string;
  to?: string;
  toLabel?: string;
  empty?: string;
  className?: string;
}) {
  const total = days.reduce((sum, day) => sum + day.items.length, 0) + overdue.length;

  // Gộp các ngày trống liền nhau thành một đoạn.
  const blocks: ({ kind: 'day'; day: WeekDay } | { kind: 'gap'; from: string; to: string })[] = [];
  days.forEach((day) => {
    const last = blocks[blocks.length - 1];
    if (day.items.length > 0 || day.isToday) blocks.push({ kind: 'day', day });
    else if (last?.kind === 'gap') last.to = day.date;
    else blocks.push({ kind: 'gap', from: day.date, to: day.date });
  });

  return (
    <Card className={cn('flex flex-col p-0 sm:p-0', className)}>
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h3 className="text-[0.95rem] font-semibold text-gray-900">
          {title}
          {total > 0 && <span className="ml-2 text-sm font-normal tabular-nums text-gray-500">{total} việc</span>}
        </h3>
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-emerald-700">
            {toLabel ?? 'Xem tất cả'} <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className="divide-y divide-gray-100 border-t border-gray-100">
        {overdue.length > 0 && (
          <Group
            tone="overdue"
            side={
              <>
                <p className="text-sm font-bold text-amber-800">Quá hạn</p>
                <p className="text-xs text-amber-700">{overdue.length} việc</p>
              </>
            }
          >
            {overdue.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </Group>
        )}
        {blocks.map((block) =>
          block.kind === 'gap' ? (
            <div key={`gap-${block.from}`} className="grid grid-cols-[4.5rem_1fr] gap-3 px-5 py-2.5 text-xs text-gray-400">
              <span className="tabular-nums">{rangeLabel(block.from, block.to)}</span>
              <span>{empty}</span>
            </div>
          ) : (
            <Group
              key={block.day.date}
              tone={block.day.isToday ? 'today' : undefined}
              side={
                <>
                  <p className={cn('text-2xl font-bold leading-none tabular-nums', block.day.isToday ? 'text-emerald-700' : 'text-gray-900')}>
                    {String(parse(block.day.date).getDate()).padStart(2, '0')}
                  </p>
                  <p className={cn('mt-1 text-xs', block.day.isToday ? 'font-semibold text-emerald-700' : 'text-gray-500')}>
                    {block.day.isToday ? 'Hôm nay' : DOW[parse(block.day.date).getDay()]}
                  </p>
                </>
              }
            >
              {block.day.items.length === 0 ? (
                <li className="px-2 py-1.5 text-sm text-gray-400">{empty}</li>
              ) : (
                block.day.items.map((item) => <ItemRow key={item.id} item={item} />)
              )}
            </Group>
          ),
        )}
      </div>
    </Card>
  );
}
