// Menu chọn một giá trị, thay cho danh sách thả xuống mặc định của trình duyệt. Dùng chung cho Select (ô nhập trong
// biểu mẫu) và FilterSelect (bộ lọc dạng pill). Dựng trên Radix Popover: danh sách role="listbox", phím ↑↓ Home End,
// Enter chọn, Esc đóng, gõ chữ để nhảy tới lựa chọn; trên 8 lựa chọn thì có ô tìm nhanh.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { MenuOption } from './option-utils';

const cx = (...items: Parameters<typeof clsx>) => twMerge(clsx(items));

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

export function OptionMenu({
  options,
  value,
  onSelect,
  onClosed,
  trigger,
  align = 'start',
  disabled,
  searchPlaceholder = 'Tìm nhanh…',
}: {
  options: MenuOption[];
  value: string;
  onSelect: (value: string) => void;
  /** Gọi khi menu đóng (để đánh dấu ô đã chạm, như onBlur). */
  onClosed?: () => void;
  /** Nút mở menu (Popover.Trigger asChild). */
  trigger: ReactElement;
  align?: 'start' | 'end';
  disabled?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const searchable = options.length > 8;
  const shown = useMemo(() => {
    const term = fold(query.trim());
    return term ? options.filter((option) => fold(option.text).includes(term)) : options;
  }, [options, query]);

  // Mở menu: đặt dòng sáng ở lựa chọn hiện tại và cuộn tới đó.
  useEffect(() => {
    if (!open) return;
    const index = shown.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : shown.findIndex((option) => !option.disabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open || active < 0) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const move = (from: number, step: number) => {
    for (let i = 1; i <= shown.length; i += 1) {
      const next = (from + step * i + shown.length * 2) % shown.length;
      if (!shown[next].disabled) return next;
    }
    return from;
  };
  const choose = (option?: MenuOption) => {
    if (!option || option.disabled) return;
    onSelect(option.value);
    setOpen(false);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => move(index, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => move(index < 0 ? 0 : index, -1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(move(-1, 1));
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(move(shown.length, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(shown[active]);
    } else if (!searchable && event.key.length === 1 && /\S/.test(event.key)) {
      // Gõ chữ để nhảy tới lựa chọn bắt đầu bằng chữ đó.
      const now = Date.now();
      typed.current = { text: now - typed.current.at < 700 ? typed.current.text + event.key : event.key, at: now };
      const term = fold(typed.current.text);
      const index = shown.findIndex((option) => !option.disabled && fold(option.text).startsWith(term));
      if (index >= 0) setActive(index);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (disabled && next) return;
        setOpen(next);
        if (!next) {
          setQuery('');
          onClosed?.();
        }
      }}
    >
      <Popover.Trigger
        asChild
        onKeyDown={(event: KeyboardEvent) => {
          if (!open && !disabled && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          data-lenis-prevent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (searchable ? (event.currentTarget as HTMLElement).querySelector('input') : list.current)?.focus();
          }}
          onKeyDown={onKey}
          className="anim-pop z-[60] w-[var(--radix-popover-trigger-width)] min-w-44 overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_-18px_rgba(6,78,59,0.4)] ring-1 ring-gray-200"
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search size={14} className="shrink-0 text-gray-400" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                aria-label="Tìm trong danh sách"
              />
            </div>
          )}
          <ul ref={list} role="listbox" tabIndex={-1} aria-activedescendant={active >= 0 ? `opt-${active}` : undefined} className="max-h-72 overflow-y-auto p-1 outline-none">
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">Không có lựa chọn phù hợp</li>}
            {shown.map((option, index) => {
              const selected = option.value === value;
              return (
                <li
                  key={`${option.value}-${index}`}
                  id={`opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  onMouseEnter={() => !option.disabled && setActive(index)}
                  onClick={() => choose(option)}
                  className={cx(
                    'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    selected ? 'font-medium text-emerald-900' : 'text-gray-700',
                    index === active && !option.disabled && (selected ? 'bg-emerald-100/70' : 'bg-gray-100'),
                    selected && index !== active && 'bg-emerald-50',
                    option.disabled && 'cursor-not-allowed opacity-45',
                  )}
                >
                  <span className="min-w-0 flex-1">{option.label}</span>
                  {selected && <Check size={14} className="shrink-0 text-emerald-600" />}
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
