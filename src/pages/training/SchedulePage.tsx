import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listSchedule, listScheduleFilters, listSlots, type ScheduleEntry } from '../../services/training.service';
import { Button, cn, ErrorBox, FilterSelect, Notice, PageHeader, Pill, Skeleton, ToggleChip, Toolbar } from '../../components/ui';
import { AttendancePill, intensityDot, SessionPill } from '../../components/ui/status';
import { intensityLabel } from '../../lib/labels';
import { now } from '../../lib/clock';
import { addDays, formatDate, formatDateShort, startOfWeek, toDateKey } from '../../lib/format';
import { links } from '../../lib/links';
import { isHeavy } from '../../lib/rules';
import { IntensityLegend } from './setup-components/SessionPlanGrid';
import { weekdayLong } from './setup-components/helpers';

export default function SchedulePage() {
  const today = toDateKey(now());
  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek(now())));
  const [zoneId, setZoneId] = useState('');
  const [classId, setClassId] = useState('');
  const [horseId, setHorseId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => toDateKey(addDays(weekStart, index))), [weekStart]);
  const from = days[0];
  const to = days[6];

  const filters = useService(() => listScheduleFilters(), []);
  const slots = useService(() => listSlots(), []);
  const schedule = useService(
    () => listSchedule({ from, to, zoneId: zoneId || undefined, classId: classId || undefined, horseId: horseId || undefined }),
    [from, to, zoneId, classId, horseId],
  );

  const entries = schedule.data?.entries ?? [];
  const cell = (date: string, slotId: string) =>
    entries.filter(
      (entry) => entry.date === date && entry.slotId === slotId && (showCancelled || entry.status !== 'CANCELLED'),
    );
  const active = entries.filter((entry) => entry.status !== 'CANCELLED');
  const heavy = active.filter((entry) => isHeavy(entry.intensity)).length;
  const classOptions = (filters.data?.classes ?? []).filter((item) => !zoneId || item.zoneId === zoneId);
  const shift = (weeks: number) => setWeekStart((current) => toDateKey(addDays(current, weeks * 7)));
  const thisWeek = toDateKey(startOfWeek(now()));
  const horseMode = !!schedule.data?.horse;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Huấn luyện · lịch tập"
        title="Lịch tập tuần"
        description={
          horseMode
            ? `Lịch tính ra từ các lớp ${schedule.data?.horse?.name} đang học — không lưu riêng cho từng ngựa.`
            : 'Mọi buổi học của các lớp theo khung giờ và ngày. Bấm vào một buổi để mở trang buổi học.'
        }
      />

      {filters.data?.scoped && (
        <Notice tone="info">Bạn chỉ thấy các buổi có ngựa trong phạm vi của mình (ngựa bạn phụ trách hoặc sở hữu).</Notice>
      )}

      <Toolbar>
        <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-gray-200">
          <Button size="icon" variant="ghost" title="Tuần trước" onClick={() => shift(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="min-w-[190px] px-2 text-center text-sm font-semibold text-gray-800 tabular-nums">
            {formatDateShort(from)} – {formatDate(to)}
          </span>
          <Button size="icon" variant="ghost" title="Tuần sau" onClick={() => shift(1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
        <Button size="sm" variant={weekStart === thisWeek ? 'soft' : 'secondary'} onClick={() => setWeekStart(thisWeek)} className="h-10">
          Tuần này
        </Button>
        <div className="flex-1" />
        <FilterSelect
          value={zoneId}
          onChange={(value) => {
            setZoneId(value);
            setClassId('');
          }}
          label="Khu"
        >
          <option value="">Mọi khu</option>
          {filters.data?.zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={classId} onChange={setClassId} label="Lớp">
          <option value="">Mọi lớp</option>
          {classOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={horseId} onChange={setHorseId} label="Ngựa">
          <option value="">Mọi ngựa</option>
          {filters.data?.horses.map((horse) => (
            <option key={horse.id} value={horse.id}>
              {horse.name}
            </option>
          ))}
        </FilterSelect>
      </Toolbar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange size={15} className="text-emerald-600" />
            <span className="font-semibold text-gray-900 tabular-nums">{active.length}</span> buổi trong tuần
          </span>
          {heavy > 0 && (
            <span>
              <span className="font-semibold text-amber-700 tabular-nums">{heavy}</span> buổi Nặng/Tối đa
            </span>
          )}
          {entries.length > active.length && (
            <ToggleChip checked={showCancelled} onChange={setShowCancelled}>
              Hiện {entries.length - active.length} buổi đã hủy
            </ToggleChip>
          )}
        </div>
        <IntensityLegend />
      </div>

      {schedule.error && <ErrorBox message={schedule.error} />}
      {(schedule.loading && !schedule.data) || slots.loading ? (
        <Skeleton rows={6} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-grass ring-1 ring-emerald-950/[0.04] custom-scrollbar">
          <div className="grid min-w-[1080px] grid-cols-[92px_repeat(7,minmax(0,1fr))]">
            <div className="border-b border-emerald-950/[0.06] bg-emerald-50/30" />
            {days.map((date) => (
              <div
                key={date}
                className={cn(
                  'border-b border-l border-emerald-950/[0.06] px-3 py-2.5',
                  date === today ? 'bg-emerald-600 text-white' : 'bg-emerald-50/30',
                )}
              >
                <p className={cn('text-xs font-medium', date === today ? 'text-emerald-100' : 'text-gray-500')}>{weekdayLong(date)}</p>
                <p className="text-sm font-semibold tabular-nums">{formatDateShort(date)}</p>
              </div>
            ))}

            {slots.data?.map((slot) => (
              <SlotRow key={slot.id} label={slot.label} days={days} today={today} entries={(date) => cell(date, slot.id)} horseMode={horseMode} />
            ))}
          </div>
        </div>
      )}

      {!schedule.loading && entries.length === 0 && (
        <p className="text-center text-sm font-light text-gray-400">
          Không có buổi học nào trong tuần này{horseMode ? ' cho ngựa đã chọn' : ''}. Dùng nút tuần trước/sau để xem tuần khác.
        </p>
      )}
    </div>
  );
}

function SlotRow({
  label,
  days,
  today,
  entries,
  horseMode,
}: {
  label: string;
  days: string[];
  today: string;
  entries: (date: string) => ScheduleEntry[];
  horseMode: boolean;
}) {
  return (
    <>
      <div className="border-b border-emerald-950/[0.05] px-3 py-3">
        <p className="font-mono text-xs font-semibold text-gray-700">{label.split('–')[0]}</p>
        <p className="font-mono text-[11px] text-gray-400">{label.split('–')[1]}</p>
      </div>
      {days.map((date) => {
        const list = entries(date);
        return (
          <div
            key={date}
            className={cn('min-h-[92px] space-y-1.5 border-b border-l border-emerald-950/[0.05] p-1.5', date === today && 'bg-emerald-50/40')}
          >
            {list.map((entry) => (
              <SessionCard key={entry.sessionId} entry={entry} horseMode={horseMode} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function SessionCard({ entry, horseMode }: { entry: ScheduleEntry; horseMode: boolean }) {
  const cancelled = entry.status === 'CANCELLED';
  return (
    <Link
      to={links.session(entry.sessionId)}
      title={cancelled ? `Đã hủy: ${entry.cancelReason ?? ''}` : `${entry.subjectName} · ${intensityLabel[entry.intensity]}`}
      className={cn(
        'block rounded-xl p-2 text-left ring-1 transition hover:-translate-y-px',
        cancelled
          ? 'bg-gray-50 ring-gray-100'
          : entry.status === 'IN_PROGRESS'
            ? 'bg-sky-50/70 ring-sky-200 hover:shadow-grass'
            : entry.status === 'AWAITING_REVIEW'
              ? 'bg-amber-50/60 ring-amber-100 hover:shadow-amber'
              : 'bg-white ring-emerald-950/[0.07] hover:shadow-grass hover:ring-emerald-300',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', intensityDot[entry.intensity])} />
        <span className={cn('truncate text-xs font-semibold', cancelled ? 'text-gray-400 line-through' : 'text-gray-900')}>
          {entry.className}
        </span>
      </div>
      <p className={cn('mt-0.5 truncate text-nowrap text-[11px]', cancelled ? 'text-gray-400' : 'text-gray-600')}>
        {entry.subjectName}
        {entry.isExtra && ' · buổi thêm'}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {horseMode && entry.horseAttendance ? (
          <span className="origin-left scale-90">
            <AttendancePill status={entry.horseAttendance} reason={entry.horseAbsenceReason} />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 tabular-nums">
            <Users size={11} /> {entry.horseCount}
          </span>
        )}
        {entry.status !== 'SCHEDULED' ? (
          <span className="origin-left scale-90">
            <SessionPill status={entry.status} />
          </span>
        ) : entry.derivedLabel ? (
          <Pill tone="amber" className="px-1.5 text-[10px]">
            {entry.derivedLabel}
          </Pill>
        ) : null}
      </div>
    </Link>
  );
}
