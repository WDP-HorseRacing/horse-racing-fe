// Lịch tuần kiểu Google Calendar cho lớp huấn luyện: 7 cột ngày (tuần của lớp), hàng giờ theo giờ CLB.
// Bấm ô trống để thêm buổi (làm tròn 30 phút), bấm một buổi để mở, kéo buổi sửa được sang ô khác để đổi ngày giờ
// (giữ thời lượng, làm tròn 15 phút). Kéo bằng sự kiện con trỏ nên chạy được cả chuột lẫn màn cảm ứng.
// Ngày ngoài khoảng của lớp gạch chéo, không thêm buổi được. Điện thoại cuộn ngang, cột giờ đứng yên.
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Flag } from 'lucide-react';
import type { TrainingSession } from '../../../api/types';
import { cn } from '../../../components/ui';
import { addDateKey, clubDateKey, clubInstant, clubTime, clubToday, isoWeekdayOf, minutesBetween } from '../../../lib/club-time';
import { weekdayShort } from '../../../lib/training-labels';
import { INTENSITY_FILL } from '../plan-helpers';

const HOUR_PX = 48;
const TIME_COL = 52;
const DEFAULT_FROM = 5;
const DEFAULT_TO = 21;
const ADD_STEP = 30;
const MOVE_STEP = 15;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const snap = (minutes: number, step: number) => Math.round(minutes / step) * step;

interface Placed {
  session: TrainingSession;
  day: number;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** Xếp buổi chồng giờ trong cùng ngày thành các làn cạnh nhau. */
function placeDay(items: { session: TrainingSession; day: number; start: number; end: number }[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    group.forEach((item) => placed.push({ ...item, lanes }));
    group = [];
  };
  for (const item of sorted) {
    if (item.start >= groupEnd && group.length) flush();
    const used = new Set(group.filter((other) => other.end > item.start).map((other) => other.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    group.push({ ...item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, item.end);
  }
  if (group.length) flush();
  return placed;
}

interface Drag {
  session: TrainingSession;
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
  day: number;
  start: number;
  duration: number;
}

export function WeekCalendar({
  weekStart,
  sessions,
  range,
  canAdd,
  canMove,
  onAdd,
  onOpen,
  onMove,
}: {
  /** Ngày đầu của tuần lớp ('YYYY-MM-DD'). */
  weekStart: string;
  sessions: TrainingSession[];
  /** Khoảng ngày của lớp. */
  range: { from: string; to: string };
  canAdd: boolean;
  canMove: (session: TrainingSession) => boolean;
  onAdd: (dateKey: string, time: string) => void;
  onOpen: (session: TrainingSession) => void;
  /** Thả buổi ở chỗ mới: thời điểm bắt đầu mới (ISO). */
  onMove: (session: TrainingSession, startAt: string) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDateKey(weekStart, index)), [weekStart]);
  const today = clubToday();
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const items = useMemo(
    () =>
      sessions
        .map((session) => {
          const day = days.indexOf(clubDateKey(session.scheduledStartAt));
          const start = toMinutes(clubTime(session.scheduledStartAt));
          return { session, day, start, end: start + Math.max(15, minutesBetween(session.scheduledStartAt, session.scheduledEndAt)) };
        })
        .filter((item) => item.day >= 0),
    [sessions, days],
  );
  // Khung giờ mặc định 05:00 đến 21:00, nới ra nếu có buổi nằm ngoài.
  const fromHour = Math.min(DEFAULT_FROM, ...items.map((item) => Math.floor(item.start / 60)));
  const toHour = Math.max(DEFAULT_TO, ...items.map((item) => Math.ceil(item.end / 60)));
  const hours = Array.from({ length: toHour - fromHour }, (_, index) => fromHour + index);
  const height = hours.length * HOUR_PX;
  const placed = useMemo(() => days.flatMap((_, day) => placeDay(items.filter((item) => item.day === day))), [days, items]);

  const top = (minutes: number) => ((minutes - fromHour * 60) / 60) * HOUR_PX;
  const inRange = (day: string) => day >= range.from && day <= range.to;

  /** Ô (ngày, phút) dưới con trỏ, theo khung lưới. */
  const cellAt = (clientX: number, clientY: number) => {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const columnWidth = (rect.width - TIME_COL) / 7;
    const day = Math.floor((clientX - rect.left - TIME_COL) / columnWidth);
    const minutes = fromHour * 60 + ((clientY - rect.top) / HOUR_PX) * 60;
    return { day: Math.min(6, Math.max(0, day)), minutes };
  };

  const clickEmpty = (event: React.MouseEvent<HTMLDivElement>, day: number) => {
    if (!canAdd || !inRange(days[day])) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = snap(fromHour * 60 + ((event.clientY - rect.top) / HOUR_PX) * 60 - ADD_STEP / 2, ADD_STEP);
    onAdd(days[day], toClock(Math.min(23 * 60 + 30, Math.max(0, minutes))));
  };

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, item: Placed) => {
    if (event.button !== 0) return;
    // Con trỏ có thể đã nhả trước khi bắt (vd chạm rất nhanh): vẫn cho bấm mở buổi.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* bỏ qua */
    }
    setDrag({ session: item.session, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, day: item.day, start: item.start, duration: item.end - item.start });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>, item: Placed) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved || Math.abs(event.clientX - drag.x) > 4 || Math.abs(event.clientY - drag.y) > 4;
    if (!moved || !canMove(item.session)) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (!cell) return;
    const offset = ((drag.y - (gridRef.current?.getBoundingClientRect().top ?? 0)) / HOUR_PX) * 60 + fromHour * 60 - item.start;
    const start = snap(cell.minutes - offset, MOVE_STEP);
    const clamped = Math.min(24 * 60 - drag.duration, Math.max(0, start));
    setDrag({ ...drag, moved: true, day: inRange(days[cell.day]) ? cell.day : drag.day, start: clamped });
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>, item: Placed) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = drag;
    setDrag(null);
    if (!current.moved) {
      onOpen(item.session);
      return;
    }
    if (current.day === item.day && current.start === item.start) return;
    onMove(item.session, clubInstant(days[current.day], toClock(current.start)));
  };

  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-gray-200/80 custom-scrollbar" data-lenis-prevent>
      <div className="min-w-[760px]">
        {/* Hàng tiêu đề ngày */}
        <div className="grid border-b border-gray-200 bg-gray-50/80" style={{ gridTemplateColumns: `${TIME_COL}px repeat(7, minmax(0, 1fr))` }}>
          <div className="sticky left-0 z-20 bg-gray-50/95" />
          {days.map((day) => (
            <div key={day} className={cn('border-l border-gray-200 px-2 py-2 text-center', !inRange(day) && 'text-gray-300')}>
              <p className="text-xs font-semibold text-gray-500">{weekdayShort[isoWeekdayOf(day)]}</p>
              <p className={cn('mx-auto mt-0.5 w-fit rounded-full px-2 font-mono text-sm font-semibold', day === today ? 'bg-emerald-700 text-white' : 'text-gray-900')}>
                {day.slice(8, 10)}/{day.slice(5, 7)}
              </p>
            </div>
          ))}
        </div>

        {/* Lưới giờ */}
        <div ref={gridRef} className="relative grid select-none" style={{ gridTemplateColumns: `${TIME_COL}px repeat(7, minmax(0, 1fr))`, height }}>
          <div className="sticky left-0 z-20 bg-white">
            {hours.map((hour) => (
              <div key={hour} className="relative border-t border-gray-100 pr-1.5 text-right font-mono text-[11px] text-gray-400" style={{ height: HOUR_PX }}>
                <span className="relative -top-2 bg-white px-0.5">{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {days.map((day, index) => (
            <div
              key={day}
              role={canAdd && inRange(day) ? 'button' : undefined}
              aria-label={canAdd && inRange(day) ? `Thêm buổi ngày ${day.slice(8, 10)}/${day.slice(5, 7)}` : undefined}
              onClick={(event) => {
                if (event.target === event.currentTarget) clickEmpty(event, index);
              }}
              className={cn(
                'relative border-l border-gray-200',
                !inRange(day) ? 'calendar-off cursor-not-allowed' : canAdd ? 'cursor-cell hover:bg-emerald-50/30' : '',
                day === today && 'bg-emerald-50/40',
              )}
              style={{ backgroundImage: inRange(day) ? `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #f1f5f9 ${HOUR_PX - 1}px, #f1f5f9 ${HOUR_PX}px)` : undefined }}
            >
              {day === today && <NowLine fromHour={fromHour} />}
            </div>
          ))}

          {/* Các buổi */}
          {placed.map((item) => {
            const dragging = drag?.session.id === item.session.id && drag.moved;
            const day = dragging ? drag.day : item.day;
            const start = dragging ? drag.start : item.start;
            const duration = item.end - item.start;
            const movable = canMove(item.session);
            const cancelled = item.session.status === 'CANCELLED';
            const finished = item.session.status === 'COMPLETED';
            return (
              <button
                key={item.session.id}
                type="button"
                data-calendar-session={item.session.id}
                title={`${item.session.name}, ${toClock(start)} đến ${toClock(start + duration)}${movable ? '. Kéo để đổi giờ' : ''}`}
                onPointerDown={(event) => startDrag(event, item)}
                onPointerMove={(event) => moveDrag(event, item)}
                onPointerUp={(event) => endDrag(event, item)}
                onPointerCancel={() => setDrag(null)}
                className={cn(
                  'absolute z-10 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ring-1 ring-white/70 transition-shadow',
                  cancelled ? 'bg-gray-100 text-gray-400 line-through' : finished ? cn(INTENSITY_FILL[item.session.intensity], 'opacity-60') : INTENSITY_FILL[item.session.intensity],
                  movable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
                  dragging && 'z-30 shadow-lg ring-2 ring-emerald-500',
                )}
                style={{
                  top: top(start) + 1,
                  height: Math.max(22, (duration / 60) * HOUR_PX - 2),
                  left: `calc(${TIME_COL}px + (100% - ${TIME_COL}px) / 7 * ${day} + (100% - ${TIME_COL}px) / 7 / ${dragging ? 1 : item.lanes} * ${dragging ? 0 : item.lane} + 2px)`,
                  width: `calc((100% - ${TIME_COL}px) / 7 / ${dragging ? 1 : item.lanes} - 4px)`,
                }}
              >
                <span className="flex items-center gap-1 font-semibold">
                  {item.session.sessionType === 'TIME_TRIAL' && <Flag size={10} className="shrink-0" />}
                  <span className="truncate">{item.session.name}</span>
                </span>
                <span className="block font-mono opacity-80">
                  {toClock(start)} đến {toClock(start + duration)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Vạch đỏ "bây giờ" trên cột hôm nay. */
function NowLine({ fromHour }: { fromHour: number }) {
  const minutes = toMinutes(clubTime(new Date().toISOString())) - fromHour * 60;
  if (minutes < 0) return null;
  return <span aria-hidden className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-red-500" style={{ top: (minutes / 60) * HOUR_PX }} />;
}

