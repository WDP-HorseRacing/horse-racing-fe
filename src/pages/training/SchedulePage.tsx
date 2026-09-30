import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listSchedule, listScheduleFilters, listSlots, type ScheduleEntry } from '../../services/training.service';
import { Button, cn, ErrorBox, FilterSelect, Notice, PageHeader, Pill, Skeleton, ToggleChip, Toolbar } from '../../components/ui';
import { AttendancePill, IntensityMeter, SessionPill } from '../../components/ui/status';
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
        title="Lịch tập tuần"
        description={
          horseMode
            ? `Lịch tính ra từ các lớp ${schedule.data?.horse?.name} đang học — không lưu riêng cho từng ngựa.`
            : 'Mọi buổi học của các lớp theo khung giờ — bấm một buổi để mở trang buổi học.'
        }
      />

      {filters.data?.scoped && (
        <Notice tone="info">Bạn chỉ thấy các buổi có ngựa trong phạm vi của mình (ngựa bạn phụ trách hoặc sở hữu).</Notice>
      )}

      <Toolbar>
        <div className="flex items-center gap-1 rounded-lg bg-white p-0.5 ring-1 ring-gray-200">
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
        <Button variant={weekStart === thisWeek ? 'soft' : 'secondary'} onClick={() => setWeekStart(thisWeek)} className="h-10">
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
            <CalendarRange size={15} className="text-gray-400" />
            <span className="font-medium text-gray-900 tabular-nums">{active.length}</span> buổi trong tuần
          </span>
          {heavy > 0 && (
            <span>
              <span className="font-medium text-gray-900 tabular-nums">{heavy}</span> buổi Nặng/Tối đa
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
        <div className="overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80 custom-scrollbar">
          <div className="grid min-w-[1080px] grid-cols-[92px_repeat(7,minmax(0,1fr))]">
            <div className="border-b border-gray-200" />
            {days.map((date) => (
              <div
                key={date}
                className={cn(
                  'border-b border-l border-gray-200 px-3 py-2.5',
                  date === today && 'bg-gray-50',
                )}
              >
                <p className={cn('text-xs', date === today ? 'font-medium text-emerald-800' : 'text-gray-500')}>
                  {weekdayLong(date)}
                  {date === today && ' · hôm nay'}
                </p>
                <p className={cn('text-sm font-semibold tabular-nums', date === today ? 'text-emerald-800' : 'text-gray-900')}>
                  {formatDateShort(date)}
                </p>
              </div>
            ))}

            {slots.data?.map((slot) => (
              <SlotRow key={slot.id} label={slot.label} days={days} today={today} entries={(date) => cell(date, slot.id)} horseMode={horseMode} />
            ))}
          </div>
        </div>
      )}

      {!schedule.loading && entries.length === 0 && (
        <p className="text-center text-sm text-gray-500">
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
      <div className="border-b border-gray-100 px-3 py-3">
        <p className="text-sm font-semibold text-gray-800 tabular-nums">{label.split('–')[0]}</p>
        <p className="text-[11px] text-gray-500 tabular-nums">{label.split('–')[1]}</p>
      </div>
      {days.map((date) => {
        const list = entries(date);
        return (
          <div
            key={date}
            className={cn('min-h-[92px] space-y-1.5 border-b border-l border-gray-100 p-1.5', date === today && 'bg-gray-50')}
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
        'block rounded-lg p-2 text-left ring-1 transition',
        cancelled ? 'bg-gray-50 ring-gray-100' : 'bg-white ring-gray-200 hover:ring-gray-400',
        entry.status === 'AWAITING_REVIEW' && 'shadow-[inset_3px_0_0_0_#f59e0b]',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('min-w-0 flex-1 truncate text-xs font-semibold', cancelled ? 'text-gray-400 line-through' : 'text-gray-900')}>
          {entry.className}
        </span>
        {!cancelled && <IntensityMeter intensity={entry.intensity} showLabel={false} />}
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
        {entry.status === 'COMPLETED' ? (
          <span className="text-[11px] text-gray-400">· đã xong</span>
        ) : entry.status !== 'SCHEDULED' && entry.status !== 'CANCELLED' ? (
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
