// Tab "Buổi học": nhóm theo tuần/giai đoạn; hủy buổi (cả lớp) và mở trang buổi học.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarPlus, XCircle } from 'lucide-react';
import type { ClassDetail, ClassSessionRow } from '../../../services/training.service';
import { Button, Card, cn, EmptyState, Pill, Segmented, Tip } from '../../../components/ui';
import { IntensityMeter, SessionPill } from '../../../components/ui/status';
import { sessionCancelLabel, surfaceLabel } from '../../../lib/labels';
import { formatDateShort } from '../../../lib/format';
import { links } from '../../../lib/links';
import { weekdayLong, workoutLine } from '../setup-components/helpers';

type Filter = 'all' | 'upcoming' | 'done' | 'cancelled';

export function ClassSessionsTab({
  detail,
  today,
  onAdd,
  onCancel,
}: {
  detail: ClassDetail;
  today: string;
  onAdd: () => void;
  onCancel: (row: ClassSessionRow) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const counts = useMemo(
    () => ({
      upcoming: detail.sessions.filter((row) => row.status === 'SCHEDULED' || row.status === 'IN_PROGRESS').length,
      done: detail.sessions.filter((row) => row.status === 'COMPLETED' || row.status === 'AWAITING_REVIEW').length,
      cancelled: detail.sessions.filter((row) => row.status === 'CANCELLED').length,
    }),
    [detail.sessions],
  );

  const groups = useMemo(() => {
    const rows = detail.sessions.filter((row) => {
      if (filter === 'upcoming') return row.status === 'SCHEDULED' || row.status === 'IN_PROGRESS';
      if (filter === 'done') return row.status === 'COMPLETED' || row.status === 'AWAITING_REVIEW';
      if (filter === 'cancelled') return row.status === 'CANCELLED';
      return true;
    });
    const map = new Map<number, ClassSessionRow[]>();
    rows.forEach((row) => {
      const week = row.weekNo ?? 0;
      map.set(week, [...(map.get(week) ?? []), row]);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [detail.sessions, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tất cả', badge: detail.sessions.length },
            { value: 'upcoming', label: 'Sắp tới', badge: counts.upcoming },
            { value: 'done', label: 'Đã học', badge: counts.done },
            { value: 'cancelled', label: 'Đã hủy', badge: counts.cancelled },
          ]}
        />
        {detail.canAddSession && (
          <Button size="sm" variant="secondary" onClick={onAdd}>
            <CalendarPlus size={14} /> Thêm buổi
          </Button>
        )}
      </div>

      {groups.length === 0 && <EmptyState title="Không có buổi nào trong mục này" />}

      {groups.map(([week, rows]) => {
        const phase = rows.find((row) => row.phaseName)?.phaseName;
        const current = rows.some((row) => row.date === today);
        return (
          <Card key={week} className="p-0 sm:p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
              <span className="font-semibold text-gray-900">{week > 0 ? `Tuần ${week}` : 'Ngoài tuần'}</span>
              {phase && <span className="text-sm text-gray-500">{phase}</span>}
              {current && <span className="text-sm font-medium text-emerald-700">· tuần này</span>}
              <span className="ml-auto text-xs text-gray-500 tabular-nums">{rows.length} buổi</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {rows.map((row) => (
                <SessionLine key={row.id} row={row} today={today} onCancel={() => onCancel(row)} />
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function SessionLine({ row, today, onCancel }: { row: ClassSessionRow; today: string; onCancel: () => void }) {
  const cancelled = row.status === 'CANCELLED';
  const started = row.status !== 'SCHEDULED' && !cancelled;
  return (
    <li
      className={cn(
        'grid items-center gap-x-4 gap-y-2 px-5 py-3 text-sm md:grid-cols-12',
        row.date === today && 'bg-gray-50',
        cancelled && 'opacity-70',
      )}
    >
      <div className="md:col-span-2">
        <p className={cn('font-semibold tabular-nums', row.date === today ? 'text-emerald-800' : 'text-gray-900')}>
          {formatDateShort(row.date)}
          {row.date === today && <span className="ml-1 text-xs font-medium">hôm nay</span>}
        </p>
        <p className="text-xs text-gray-500 tabular-nums">
          {weekdayLong(row.date)} · {row.slotLabel}
        </p>
      </div>
      <div className="min-w-0 md:col-span-4">
        <p className={cn('font-medium text-gray-900', cancelled && 'line-through decoration-gray-300')}>
          {row.subjectName}
          {row.isExtra && (
            <Pill tone="gray" className="ml-2">
              Buổi thêm
            </Pill>
          )}
        </p>
        <p className="text-xs text-gray-500">
          {workoutLine(row.distanceM, row.repetitions)} · sân {surfaceLabel[row.surface].toLowerCase()}
          {row.note && ` · ${row.note}`}
        </p>
      </div>
      <div className="md:col-span-1">
        <IntensityMeter intensity={row.intensity} />
      </div>
      <div className="md:col-span-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <SessionPill status={row.status} />
          {row.derivedLabel && <Pill tone="amber">{row.derivedLabel}</Pill>}
        </div>
        {cancelled ? (
          <p className="mt-1 text-xs text-gray-500">
            {row.cancelKind ? `${sessionCancelLabel[row.cancelKind]}: ` : ''}
            {row.cancelReason}
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500 tabular-nums">
            {row.horseCount} ngựa
            {started && (
              <>
                {' · '}
                <span>{row.presentCount} có mặt</span>
                {row.absentCount > 0 && <span className="text-amber-700"> · {row.absentCount} vắng</span>}
              </>
            )}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-1 md:col-span-2">
        {row.canCancel && (
          <Tip content="Hủy buổi cho cả lớp">
            <button
              type="button"
              onClick={onCancel}
              aria-label="Hủy buổi"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <XCircle size={16} />
            </button>
          </Tip>
        )}
        {!cancelled && (
          <Link
            to={links.session(row.id)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            Mở buổi <ArrowUpRight size={13} />
          </Link>
        )}
      </div>
    </li>
  );
}
