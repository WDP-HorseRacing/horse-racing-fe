// Lịch tuần kiểu Google Calendar cho lớp huấn luyện: 7 cột ngày (tuần của lớp), hàng giờ theo giờ CLB.
// Bấm ô trống để thêm buổi (làm tròn 30 phút), bấm một buổi để mở, kéo buổi sửa được sang ô khác để đổi ngày giờ
// (giữ thời lượng, làm tròn 15 phút). Kéo buổi bằng sự kiện con trỏ nên chạy được cả chuột lẫn màn cảm ứng.
// Kéo môn từ bảng môn bên cạnh vào lịch (kéo thả HTML5, như trình lập giáo án): bóng mờ báo giờ sẽ xếp, có lỗi luật
// thì viền đỏ kèm lý do và không thả được. Khối chờ (`pending`) là buổi vừa thả chưa lưu, kèm popover hỏi lưu hay bỏ.
// Chế độ tuần mẫu (`template`): cột chỉ ghi thứ, không có hôm nay hay giờ đã qua.
// Ngày ngoài khoảng của lớp gạch chéo, không thêm buổi được. Giờ đã qua tô xám: không thêm buổi, kéo buổi vào đó thì trả về chỗ cũ.
// Điện thoại cuộn ngang, cột giờ đứng yên.
import { useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { AlertTriangle, Flag } from 'lucide-react';
import type { TrainingIntensity, TrainingSessionStatus, TrainingSessionType } from '../../../api/types';
import { cn } from '../../../components/ui';
import { addDateKey, clubDateKey, clubInstant, clubTime, clubToday, isoWeekdayOf, minutesBetween } from '../../../lib/club-time';
import { weekdayLong, weekdayShort } from '../../../lib/training-labels';
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

/** Một khối trên lịch: buổi đã lưu hoặc slot của tuần mẫu. */
export interface CalendarItem {
  id: string;
  name: string;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status?: TrainingSessionStatus;
  /** Viền đỏ (lỗi) hoặc hổ phách (cảnh báo) kèm lý do. */
  flag?: { tone: 'error' | 'warning'; message: string };
}

/** Môn đang được kéo từ bảng môn. */
export interface IncomingSubject {
  name: string;
  intensity: TrainingIntensity;
  sessionType: TrainingSessionType;
  durationMinutes: number;
}

interface Placed<T> {
  item: T;
  day: number;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** Xếp buổi chồng giờ trong cùng ngày thành các làn cạnh nhau. */
function placeDay<T>(items: { item: T; day: number; start: number; end: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((entry) => entry.lane + 1));
    group.forEach((entry) => placed.push({ ...entry, lanes }));
    group = [];
  };
  for (const entry of sorted) {
    if (entry.start >= groupEnd && group.length) flush();
    const used = new Set(group.filter((other) => other.end > entry.start).map((other) => other.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    group.push({ ...entry, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, entry.end);
  }
  if (group.length) flush();
  return placed;
}

interface Drag<T> {
  item: T;
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
  day: number;
  start: number;
  duration: number;
}

export function WeekCalendar<T extends CalendarItem>({
  weekStart,
  sessions,
  range,
  canAdd,
  canMove,
  onAdd,
  onOpen,
  onMove,
  onBlocked,
  template = false,
  incoming,
  checkDrop,
  onDrop,
  pending,
}: {
  /** Ngày đầu của tuần lớp ('YYYY-MM-DD'). */
  weekStart: string;
  sessions: T[];
  /** Khoảng ngày của lớp. */
  range: { from: string; to: string };
  canAdd: boolean;
  canMove: (item: T) => boolean;
  onAdd: (dateKey: string, time: string) => void;
  onOpen: (item: T) => void;
  /** Thả buổi ở chỗ mới: thời điểm bắt đầu mới (ISO). */
  onMove: (item: T, startAt: string) => void;
  /** Bấm hoặc thả vào giờ đã qua: câu báo cho người dùng. */
  onBlocked?: (message: string) => void;
  /** Tuần mẫu: không có hôm nay, giờ đã qua. */
  template?: boolean;
  /** Môn đang kéo từ bảng môn (dataTransfer không đọc được lúc đang kéo nên truyền qua prop). */
  incoming?: IncomingSubject | null;
  /** Lý do không thả được môn đang kéo vào (ngày, giờ), hoặc undefined nếu thả được. */
  checkDrop?: (dateKey: string, time: string) => string | undefined;
  onDrop?: (dateKey: string, time: string) => void;
  /** Buổi vừa thả chưa lưu: khối nét đứt kèm popover. */
  pending?: { item: CalendarItem; content: ReactNode; onDismiss: () => void } | null;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDateKey(weekStart, index)), [weekStart]);
  const today = template ? '' : clubToday();
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag<T> | null>(null);
  const [ghost, setGhost] = useState<{ day: number; start: number; message?: string } | null>(null);

  const items = useMemo(
    () =>
      sessions
        .map((item) => {
          const day = days.indexOf(clubDateKey(item.scheduledStartAt));
          const start = toMinutes(clubTime(item.scheduledStartAt));
          return { item, day, start, end: start + Math.max(15, minutesBetween(item.scheduledStartAt, item.scheduledEndAt)) };
        })
        .filter((entry) => entry.day >= 0),
    [sessions, days],
  );
  const pendingSpan = pending
    ? (() => {
        const day = days.indexOf(clubDateKey(pending.item.scheduledStartAt));
        const start = toMinutes(clubTime(pending.item.scheduledStartAt));
        return day >= 0 ? { day, start, end: start + Math.max(15, minutesBetween(pending.item.scheduledStartAt, pending.item.scheduledEndAt)) } : undefined;
      })()
    : undefined;
  // Khung giờ mặc định 05:00 đến 21:00, nới ra nếu có buổi nằm ngoài.
  const spans = [...items, ...(pendingSpan ? [pendingSpan] : [])];
  const fromHour = Math.min(DEFAULT_FROM, ...spans.map((entry) => Math.floor(entry.start / 60)));
  const toHour = Math.max(DEFAULT_TO, ...spans.map((entry) => Math.ceil(entry.end / 60)));
  const hours = Array.from({ length: toHour - fromHour }, (_, index) => fromHour + index);
  const height = hours.length * HOUR_PX;
  const placed = useMemo(() => days.flatMap((_, day) => placeDay(items.filter((entry) => entry.day === day))), [days, items]);

  const top = (minutes: number) => ((minutes - fromHour * 60) / 60) * HOUR_PX;
  const inRange = (day: string) => day >= range.from && day <= range.to;
  // Không xếp buổi ở quá khứ (BE chặn): ngày đã qua và phần giờ đã qua của hôm nay.
  const nowMinutes = toMinutes(clubTime(new Date().toISOString()));
  const isPast = (day: string, minutes: number) => !template && (day < today || (day === today && minutes <= nowMinutes));
  const addable = (day: string) => inRange(day) && (template || day >= today);
  const columnLeft = (day: number) => `calc(${TIME_COL}px + (100% - ${TIME_COL}px) / 7 * ${day} + 2px)`;
  const columnWidth = `calc((100% - ${TIME_COL}px) / 7 - 4px)`;

  /** Ô (ngày, phút) dưới con trỏ, theo khung lưới. */
  const cellAt = (clientX: number, clientY: number) => {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const width = (rect.width - TIME_COL) / 7;
    const day = Math.floor((clientX - rect.left - TIME_COL) / width);
    const minutes = fromHour * 60 + ((clientY - rect.top) / HOUR_PX) * 60;
    return { day: Math.min(6, Math.max(0, day)), minutes };
  };

  const clickEmpty = (event: React.MouseEvent<HTMLDivElement>, day: number) => {
    if (!canAdd || !inRange(days[day])) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = Math.min(23 * 60 + 30, Math.max(0, snap(fromHour * 60 + ((event.clientY - rect.top) / HOUR_PX) * 60 - ADD_STEP / 2, ADD_STEP)));
    if (isPast(days[day], minutes)) {
      onBlocked?.('Không thêm buổi vào giờ đã qua');
      return;
    }
    onAdd(days[day], toClock(minutes));
  };

  /* ----- Kéo môn từ bảng môn vào ----- */
  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!incoming || !canAdd) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (!cell || !addable(days[cell.day])) {
      if (ghost) setGhost(null);
      return;
    }
    event.preventDefault();
    const start = Math.min(24 * 60 - incoming.durationMinutes, Math.max(0, Math.floor(cell.minutes / MOVE_STEP) * MOVE_STEP));
    const message = isPast(days[cell.day], start) ? 'Giờ này đã qua' : checkDrop?.(days[cell.day], toClock(start));
    event.dataTransfer.dropEffect = message ? 'none' : 'copy';
    if (!ghost || ghost.day !== cell.day || ghost.start !== start || ghost.message !== message) setGhost({ day: cell.day, start, message });
  };
  const dragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGhost(null);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const current = ghost;
    setGhost(null);
    if (!current) return;
    if (current.message) onBlocked?.(current.message);
    else onDrop?.(days[current.day], toClock(current.start));
  };

  /* ----- Kéo buổi đã có để đổi giờ ----- */
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, entry: Placed<T>) => {
    if (event.button !== 0) return;
    // Con trỏ có thể đã nhả trước khi bắt (vd chạm rất nhanh): vẫn cho bấm mở buổi.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* bỏ qua */
    }
    setDrag({ item: entry.item, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, day: entry.day, start: entry.start, duration: entry.end - entry.start });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>, entry: Placed<T>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved || Math.abs(event.clientX - drag.x) > 4 || Math.abs(event.clientY - drag.y) > 4;
    if (!moved || !canMove(entry.item)) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (!cell) return;
    const offset = ((drag.y - (gridRef.current?.getBoundingClientRect().top ?? 0)) / HOUR_PX) * 60 + fromHour * 60 - entry.start;
    const start = snap(cell.minutes - offset, MOVE_STEP);
    const clamped = Math.min(24 * 60 - drag.duration, Math.max(0, start));
    setDrag({ ...drag, moved: true, day: inRange(days[cell.day]) ? cell.day : drag.day, start: clamped });
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>, entry: Placed<T>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = drag;
    setDrag(null);
    if (!current.moved) {
      onOpen(entry.item);
      return;
    }
    if (current.day === entry.day && current.start === entry.start) return;
    if (isPast(days[current.day], current.start)) {
      onBlocked?.('Không dời buổi vào giờ đã qua, buổi giữ chỗ cũ');
      return;
    }
    onMove(entry.item, clubInstant(days[current.day], toClock(current.start)));
  };

  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-gray-200/80 custom-scrollbar" data-lenis-prevent>
      <div className="min-w-[760px]">
        {/* Hàng tiêu đề ngày */}
        <div className="grid border-b border-gray-200 bg-gray-50/80" style={{ gridTemplateColumns: `${TIME_COL}px repeat(7, minmax(0, 1fr))` }}>
          <div className="sticky left-0 z-20 bg-gray-50/95" />
          {days.map((day) => (
            <div key={day} className={cn('border-l border-gray-200 px-2 py-2 text-center', !inRange(day) && 'text-gray-300')}>
              {template ? (
                <p className="py-1.5 text-sm font-semibold text-gray-800">{weekdayLong[isoWeekdayOf(day)]}</p>
              ) : (
                <>
                  <p className="text-xs font-semibold text-gray-500">{weekdayShort[isoWeekdayOf(day)]}</p>
                  <p className={cn('mx-auto mt-0.5 w-fit rounded-full px-2 text-sm font-semibold tabular-nums', day === today ? 'bg-emerald-700 text-white' : 'text-gray-900')}>
                    {day.slice(8, 10)}/{day.slice(5, 7)}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Lưới giờ */}
        <div
          ref={gridRef}
          className="relative grid select-none"
          style={{ gridTemplateColumns: `${TIME_COL}px repeat(7, minmax(0, 1fr))`, height }}
          onDragOver={dragOver}
          onDragLeave={dragLeave}
          onDrop={drop}
        >
          <div className="sticky left-0 z-20 bg-white">
            {hours.map((hour) => (
              <div key={hour} className="relative border-t border-gray-100 pr-1.5 text-right text-[11px] tabular-nums text-gray-400" style={{ height: HOUR_PX }}>
                <span className="relative -top-2 bg-white px-0.5">{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {days.map((day, index) => (
            <div
              key={day}
              role={canAdd && addable(day) ? 'button' : undefined}
              aria-label={canAdd && addable(day) ? `Thêm buổi ${template ? weekdayLong[isoWeekdayOf(day)] : `ngày ${day.slice(8, 10)}/${day.slice(5, 7)}`}` : undefined}
              onClick={(event) => {
                if (event.target === event.currentTarget) clickEmpty(event, index);
              }}
              className={cn(
                'relative border-l border-gray-200',
                !inRange(day) ? 'calendar-off cursor-not-allowed' : !template && day < today ? 'bg-gray-50 cursor-not-allowed' : canAdd ? 'cursor-cell hover:bg-emerald-50/30' : '',
                day === today && 'bg-emerald-50/40',
              )}
              style={{ backgroundImage: inRange(day) ? `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #f1f5f9 ${HOUR_PX - 1}px, #f1f5f9 ${HOUR_PX}px)` : undefined }}
            >
              {day === today && inRange(day) && nowMinutes > fromHour * 60 && (
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bg-gray-100/70" style={{ height: top(Math.min(nowMinutes, toHour * 60)) }} />
              )}
              {day === today && <NowLine fromHour={fromHour} />}
            </div>
          ))}

          {/* Các buổi */}
          {placed.map((entry) => {
            const dragging = drag?.item.id === entry.item.id && drag.moved;
            const day = dragging ? drag.day : entry.day;
            const start = dragging ? drag.start : entry.start;
            const duration = entry.end - entry.start;
            const movable = canMove(entry.item);
            const cancelled = entry.item.status === 'CANCELLED';
            const finished = entry.item.status === 'COMPLETED';
            const flag = entry.item.flag;
            return (
              <button
                key={entry.item.id}
                type="button"
                data-calendar-session={entry.item.id}
                title={`${entry.item.name}, ${toClock(start)} đến ${toClock(start + duration)}${flag ? `. ${flag.message}` : movable ? '. Kéo để đổi giờ' : ''}`}
                onPointerDown={(event) => startDrag(event, entry)}
                onPointerMove={(event) => moveDrag(event, entry)}
                onPointerUp={(event) => endDrag(event, entry)}
                onPointerCancel={() => setDrag(null)}
                className={cn(
                  'absolute z-10 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ring-1 ring-white/70 transition-shadow',
                  cancelled ? 'bg-gray-100 text-gray-400 line-through' : finished ? cn(INTENSITY_FILL[entry.item.intensity], 'opacity-60') : INTENSITY_FILL[entry.item.intensity],
                  movable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
                  flag?.tone === 'error' && 'ring-2 ring-red-500',
                  flag?.tone === 'warning' && 'ring-2 ring-amber-400',
                  dragging && 'z-30 shadow-lg ring-2 ring-emerald-500',
                )}
                style={{
                  top: top(start) + 1,
                  height: Math.max(22, (duration / 60) * HOUR_PX - 2),
                  left: `calc(${TIME_COL}px + (100% - ${TIME_COL}px) / 7 * ${day} + (100% - ${TIME_COL}px) / 7 / ${dragging ? 1 : entry.lanes} * ${dragging ? 0 : entry.lane} + 2px)`,
                  width: `calc((100% - ${TIME_COL}px) / 7 / ${dragging ? 1 : entry.lanes} - 4px)`,
                }}
              >
                <span className="flex items-center gap-1 font-semibold">
                  {flag && <AlertTriangle size={10} className="shrink-0" />}
                  {entry.item.sessionType === 'TIME_TRIAL' && <Flag size={10} className="shrink-0" />}
                  <span className="truncate">{entry.item.name}</span>
                </span>
                <span className="block tabular-nums opacity-80">
                  {toClock(start)} đến {toClock(start + duration)}
                </span>
              </button>
            );
          })}

          {/* Bóng mờ khi kéo môn vào */}
          {ghost && incoming && (
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute z-30 overflow-hidden rounded-lg border-2 border-dashed px-1.5 py-1 text-[11px] leading-tight',
                ghost.message ? 'border-red-500 bg-red-50/90 text-red-800' : cn(INTENSITY_FILL[incoming.intensity], 'border-emerald-700/40 opacity-80'),
              )}
              style={{ top: top(ghost.start) + 1, height: Math.max(22, (incoming.durationMinutes / 60) * HOUR_PX - 2), left: columnLeft(ghost.day), width: columnWidth }}
            >
              <span className="block truncate font-semibold">{incoming.name}</span>
              <span className="block tabular-nums">
                {toClock(ghost.start)} đến {toClock(ghost.start + incoming.durationMinutes)}
              </span>
              {ghost.message && <span className="mt-0.5 block font-medium">{ghost.message}</span>}
            </div>
          )}

          {/* Buổi vừa thả, chờ lưu */}
          {pending && pendingSpan && (
            <Popover.Root open onOpenChange={(open) => !open && pending.onDismiss()}>
              <Popover.Anchor asChild>
                <div
                  className={cn('absolute z-30 overflow-hidden rounded-lg border-2 border-dashed border-emerald-800/50 px-1.5 py-1 text-[11px] leading-tight', INTENSITY_FILL[pending.item.intensity])}
                  style={{ top: top(pendingSpan.start) + 1, height: Math.max(22, ((pendingSpan.end - pendingSpan.start) / 60) * HOUR_PX - 2), left: columnLeft(pendingSpan.day), width: columnWidth }}
                >
                  <span className="block truncate font-semibold">{pending.item.name}</span>
                  <span className="block tabular-nums">
                    {toClock(pendingSpan.start)} đến {toClock(pendingSpan.end)}
                  </span>
                </div>
              </Popover.Anchor>
              <Popover.Portal>
                <Popover.Content side="right" align="start" sideOffset={8} collisionPadding={12} className="anim-pop z-50 w-72 rounded-xl bg-white p-3 shadow-float ring-1 ring-gray-200">
                  {pending.content}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
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
