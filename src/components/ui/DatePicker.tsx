// Chọn ngày thay cho <input type="date"> mặc định của trình duyệt. Dựng trên Radix Popover.
// Giá trị luôn là 'YYYY-MM-DD' (hoặc '') như input date cũ, nên đổi chỗ dùng không phải sửa logic form.
// Gõ tay dd/mm/yyyy được; bấm biểu tượng lịch để chọn. Tiêu đề lịch bấm được để đổi sang chọn tháng / năm
// (ngày sinh ngựa cách nhau nhiều năm). Bàn phím: mũi tên, PgUp/PgDn (tháng), Shift+PgUp/PgDn (năm), Enter.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { VI_MONTHS, VI_WEEKDAYS, displayKey, inRange, keyOf, maskTyped, monthGrid, parseKey, parseTime, parseTyped, shiftKey, todayKey } from '../../lib/calendar';
import { cn, invalidClass } from './index';

type View = 'day' | 'month' | 'year';

const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70';

interface CalendarPanelProps {
  value: string;
  min?: string;
  max?: string;
  defaultView?: View;
  /** Tháng hiện khi chưa có giá trị, 'YYYY-MM-DD'. */
  defaultMonth?: string;
  onSelect: (key: string) => void;
  onClear?: () => void;
}

export function CalendarPanel({ value, min, max, defaultView = 'day', defaultMonth, onSelect, onClear }: CalendarPanelProps) {
  const today = todayKey();
  const start = parseKey(value) ? value : parseKey(defaultMonth) ? defaultMonth! : inRange(today, min, max) ? today : (max?.slice(0, 10) ?? min?.slice(0, 10) ?? today);
  const startParts = parseKey(start)!;
  const [view, setView] = useState<View>(value ? 'day' : defaultView);
  const [cursor, setCursor] = useState({ year: startParts.year, month: startParts.month });
  const [focused, setFocused] = useState(start);
  const [direction, setDirection] = useState(0);
  // Trang 20 năm: đặt năm đang xem ở giữa, không vượt quá năm lớn nhất được chọn (ngày sinh: hết ở năm nay).
  const maxYear = parseKey(max)?.year;
  const [yearStart, setYearStart] = useState(() => {
    const startYear = startParts.year - 12;
    return maxYear !== undefined ? Math.min(startYear, maxYear - 19) : startYear;
  });
  const grid = useRef<HTMLDivElement>(null);
  const labelId = useId();

  // Ô ngày đang có tiêu điểm bàn phím (roving tabindex).
  useEffect(() => {
    if (view !== 'day') return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-key="${focused}"]`)?.focus({ preventScroll: true });
  }, [focused, view, cursor]);

  const goMonth = (delta: number) => {
    setDirection(delta);
    const date = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  };
  const moveFocus = (next: string) => {
    const parts = parseKey(next)!;
    if (parts.year !== cursor.year || parts.month !== cursor.month) {
      setDirection(next > focused ? 1 : -1);
      setCursor({ year: parts.year, month: parts.month });
    }
    setFocused(next);
  };
  const onDayKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const map: Record<string, Parameters<typeof shiftKey>[1]> = {
      ArrowLeft: { days: -1 },
      ArrowRight: { days: 1 },
      ArrowUp: { days: -7 },
      ArrowDown: { days: 7 },
      PageUp: event.shiftKey ? { years: -1 } : { months: -1 },
      PageDown: event.shiftKey ? { years: 1 } : { months: 1 },
    };
    if (map[event.key]) {
      event.preventDefault();
      moveFocus(shiftKey(focused, map[event.key]));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const parts = parseKey(focused)!;
      const weekday = (new Date(parts.year, parts.month, parts.day).getDay() + 6) % 7;
      moveFocus(shiftKey(focused, { days: event.key === 'Home' ? -weekday : 6 - weekday }));
    }
  };

  const title =
    view === 'day' ? `${VI_MONTHS[cursor.month]}, ${cursor.year}` : view === 'month' ? String(cursor.year) : `${yearStart} – ${yearStart + 19}`;
  const step = (delta: number) => {
    if (view === 'day') goMonth(delta);
    else if (view === 'month') setCursor((current) => ({ ...current, year: current.year + delta }));
    else setYearStart((current) => current + delta * 20);
  };
  const monthAllowed = (year: number, month: number) => {
    const first = keyOf(year, month, 1);
    const last = keyOf(year, month, new Date(year, month + 1, 0).getDate());
    return (!max || first <= max.slice(0, 10)) && (!min || last >= min.slice(0, 10));
  };
  const yearAllowed = (year: number) => (!max || `${year}-01-01` <= max.slice(0, 10)) && (!min || `${year}-12-31` >= min.slice(0, 10));
  const navButton = 'flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-emerald-50 hover:text-emerald-800';

  return (
    <div className="w-[19rem] select-none p-3">
      <div className="mb-2 flex items-center justify-between gap-1">
        <button type="button" className={navButton} onClick={() => step(-1)} aria-label="Trước">
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          id={labelId}
          onClick={() => setView(view === 'day' ? 'month' : view === 'month' ? 'year' : 'day')}
          className="rounded-lg px-2.5 py-1 text-sm font-semibold text-gray-900 transition hover:bg-emerald-50 hover:text-emerald-800"
          aria-live="polite"
        >
          {title}
        </button>
        <button type="button" className={navButton} onClick={() => step(1)} aria-label="Sau">
          <ChevronRight size={16} />
        </button>
      </div>

      {view === 'day' && (
        <>
          <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium text-gray-400">
            {VI_WEEKDAYS.map((day) => (
              <span key={day} className={cn('py-1', day === 'CN' && 'text-red-400/80')}>
                {day}
              </span>
            ))}
          </div>
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.div
                key={`${cursor.year}-${cursor.month}`}
                ref={grid}
                role="grid"
                aria-labelledby={labelId}
                className="grid grid-cols-7 gap-0.5"
                custom={direction}
                initial={{ opacity: 0, x: direction * 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -14 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {monthGrid(cursor.year, cursor.month).map((cell) => {
                  const allowed = inRange(cell.key, min, max);
                  const selected = cell.key === value;
                  const isToday = cell.key === today;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      role="gridcell"
                      data-key={cell.key}
                      tabIndex={cell.key === focused ? 0 : -1}
                      aria-selected={selected}
                      aria-disabled={!allowed || undefined}
                      aria-label={displayKey(cell.key)}
                      onClick={() => allowed && onSelect(cell.key)}
                      onKeyDown={onDayKey}
                      onFocus={() => setFocused(cell.key)}
                      className={cn(
                        'relative flex h-9 items-center justify-center rounded-lg text-sm tabular-nums outline-none transition',
                        !cell.inMonth && 'text-gray-300',
                        cell.inMonth && !selected && 'text-gray-700',
                        allowed && !selected && 'hover:bg-emerald-50 hover:text-emerald-900',
                        !allowed && 'cursor-not-allowed opacity-30',
                        selected && 'bg-emerald-700 font-semibold text-white shadow-[0_8px_18px_-10px_rgba(6,78,59,0.8)]',
                        isToday && !selected && 'font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300',
                        'focus-visible:ring-2 focus-visible:ring-emerald-500',
                      )}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

      {view === 'month' && (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {VI_MONTHS.map((label, month) => {
            const allowed = monthAllowed(cursor.year, month);
            const active = parseKey(value)?.year === cursor.year && parseKey(value)?.month === month;
            return (
              <button
                key={label}
                type="button"
                disabled={!allowed}
                onClick={() => {
                  setCursor({ year: cursor.year, month });
                  setView('day');
                }}
                className={cn(
                  'rounded-lg py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-30',
                  active ? 'bg-emerald-700 font-semibold text-white' : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-900',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {view === 'year' && (
        <div className="grid grid-cols-4 gap-1.5 py-1">
          {Array.from({ length: 20 }, (_, index) => yearStart + index).map((year) => {
            const allowed = yearAllowed(year);
            const active = parseKey(value)?.year === year;
            return (
              <button
                key={year}
                type="button"
                disabled={!allowed}
                onClick={() => {
                  setCursor({ year, month: cursor.month });
                  setView('month');
                }}
                className={cn(
                  'rounded-lg py-2 text-sm tabular-nums transition disabled:cursor-not-allowed disabled:opacity-30',
                  active ? 'bg-emerald-700 font-semibold text-white' : year === new Date().getFullYear() ? 'font-semibold text-emerald-700 hover:bg-emerald-50' : 'text-gray-700 hover:bg-emerald-50',
                )}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <button
          type="button"
          disabled={!inRange(today, min, max)}
          onClick={() => onSelect(today)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Hôm nay
        </button>
        {onClear && (
          <button type="button" onClick={onClear} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
            Xóa
          </button>
        )}
      </div>
    </div>
  );
}

export interface DatePickerProps {
  /** '' hoặc 'YYYY-MM-DD'. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Class của khung bao (độ rộng, khoảng cách). */
  className?: string;
  /** Ô đang lỗi: viền đỏ như các ô nhập khác. */
  invalid?: boolean;
  size?: 'md' | 'sm';
  /** Mở lịch ở chế độ chọn năm khi chưa có giá trị (ví dụ ngày sinh). */
  defaultView?: View;
  defaultMonth?: string;
  /** Cho xóa trống (mặc định có). */
  clearable?: boolean;
  onBlur?: () => void;
  name?: string;
  title?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'dd/mm/yyyy',
  disabled,
  className,
  invalid,
  size = 'md',
  defaultView,
  defaultMonth,
  clearable = true,
  onBlur,
  name,
  title,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(displayKey(value));
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const lastSelected = useRef<string | null>(null);
  // Giá trị từ ngoài đổi (chọn trên lịch, form nạp lại) thì cập nhật chữ trong ô, trừ khi đang gõ.
  const shown = editing ? draft : (parseKey(value) ? displayKey(value) : value);

  const commit = () => {
    setEditing(false);
    if (!draft.trim()) {
      if (clearable && value) onChange('');
      return;
    }
    const key = parseTyped(draft);
    if (key) {
      if (key !== value) onChange(key);
      setDraft(displayKey(key));
    } else {
      if (draft !== value) onChange(draft);
      setDraft(draft);
    }
  };

  const select = (key: string) => {
    lastSelected.current = key;
    onChange(key);
    setDraft(displayKey(key));
    setEditing(false);
    setOpen(false);
    input.current?.focus({ preventScroll: true });
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <Popover.Anchor asChild>
        <div className={cn('relative', className)}>
          <input
            ref={input}
            id={id}
            name={name}
            title={title}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            value={shown}
            onFocus={() => {
              const actualValue = lastSelected.current ?? value;
              setDraft(parseKey(actualValue) ? displayKey(actualValue) : actualValue);
              setEditing(true);
              lastSelected.current = null;
            }}
            onChange={(event) => setDraft(maskTyped(event.target.value))}
            onBlur={() => {
              commit();
              if (!open) onBlur?.();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              } else if (event.key === 'ArrowDown' && event.altKey) {
                event.preventDefault();
                setOpen(true);
              }
            }}
            aria-invalid={invalid || undefined}
            className={cn(fieldClass, 'tabular-nums', size === 'sm' ? 'h-9 py-0 pl-3 pr-9' : 'px-3 py-2 pr-10', invalid && invalidClass)}
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Mở lịch chọn ngày"
              className={cn(
                'absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:pointer-events-none data-[state=open]:bg-emerald-50 data-[state=open]:text-emerald-700',
                size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
              )}
            >
              <CalendarDays size={16} />
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          data-lenis-prevent
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="anim-pop z-[60] rounded-2xl bg-white shadow-[0_22px_48px_-20px_rgba(6,78,59,0.45)] ring-1 ring-gray-200"
        >
          <CalendarPanel
            value={value}
            min={min}
            max={max}
            defaultView={defaultView}
            defaultMonth={defaultMonth}
            onSelect={select}
            onClear={
              clearable
                ? () => {
                    onChange('');
                    setDraft('');
                    setOpen(false);
                  }
                : undefined
            }
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Ngày + giờ thay cho <input type="datetime-local">: giá trị 'YYYY-MM-DDTHH:mm' (hoặc ''). */
export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  invalid,
  size = 'md',
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  invalid?: boolean;
  size?: 'md' | 'sm';
  title?: string;
}) {
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  const [draft, setDraft] = useState(time);
  const [editing, setEditing] = useState(false);
  const shownTime = editing ? draft : time;

  /** Giờ nhỏ nhất / lớn nhất chỉ áp khi chọn đúng ngày đầu / cuối của khoảng. */
  const clampTime = (day: string, hhmm: string) => {
    const full = `${day}T${hhmm}`;
    if (min && full < min.slice(0, 16)) return min.slice(11, 16);
    if (max && full > max.slice(0, 16)) return max.slice(11, 16);
    return hhmm;
  };
  const setDate = (next: string) => {
    if (!next) return onChange('');
    onChange(`${next}T${clampTime(next, time || '08:00')}`);
  };
  const commitTime = () => {
    setEditing(false);
    const parsed = parseTime(draft);
    if (!parsed || !date) return setDraft(time);
    const next = clampTime(date, parsed);
    setDraft(next);
    if (next !== time) onChange(`${date}T${next}`);
  };

  return (
    <div className={cn('flex gap-2', className)} title={title}>
      <DatePicker value={date} onChange={setDate} min={min?.slice(0, 10)} max={max?.slice(0, 10)} disabled={disabled} invalid={invalid} size={size} clearable={false} className="min-w-0 flex-1" />
      <div className="relative w-28 shrink-0">
        <Clock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          inputMode="numeric"
          aria-label="Giờ"
          placeholder="HH:mm"
          disabled={disabled || !date}
          value={shownTime}
          onFocus={() => {
            setDraft(time);
            setEditing(true);
          }}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d:h.]/g, '').slice(0, 5))}
          onBlur={commitTime}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitTime();
            }
          }}
          className={cn(fieldClass, 'pl-8 pr-2 tabular-nums', size === 'sm' ? 'h-9 py-0' : 'py-2', invalid && invalidClass)}
        />
      </div>
    </div>
  );
}
