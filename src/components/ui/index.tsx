// Bộ thành phần dùng chung. Tự style trên Radix primitives, nhấn xanh cỏ (emerald),
// bóng đổ ám màu theo vai trò của thẻ thay vì một kiểu viền + bóng cho mọi thứ.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as RadixTabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Inbox, MoreHorizontal, Search, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import gsap from 'gsap';

/** Ghép class Tailwind, class truyền sau thắng class mặc định. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ===== Thẻ và tiêu đề ===== */

type CardTone = 'default' | 'danger' | 'warning' | 'success' | 'muted';
type CardVariant = 'raised' | 'flat' | 'outline';

const cardRaised: Record<CardTone, string> = {
  default: 'bg-white shadow-grass ring-1 ring-emerald-950/[0.04]',
  danger: 'bg-white shadow-red ring-1 ring-red-100',
  warning: 'bg-white shadow-amber ring-1 ring-amber-100',
  success: 'bg-white shadow-grass ring-1 ring-emerald-100',
  muted: 'bg-white/70 ring-1 ring-emerald-950/[0.04]',
};
const cardFlat: Record<CardTone, string> = {
  default: 'bg-emerald-50/40',
  danger: 'bg-red-50/70',
  warning: 'bg-amber-50/70',
  success: 'bg-emerald-50/70',
  muted: 'bg-gray-50/80',
};
const cardOutline: Record<CardTone, string> = {
  default: 'border border-emerald-900/10 bg-white/60',
  danger: 'border border-red-200 bg-white/60',
  warning: 'border border-amber-200 bg-white/60',
  success: 'border border-emerald-200 bg-white/60',
  muted: 'border border-dashed border-gray-200 bg-transparent',
};

export function Card({
  children,
  className = '',
  tone = 'default',
  variant = 'raised',
}: {
  children: ReactNode;
  className?: string;
  tone?: CardTone;
  variant?: CardVariant;
}) {
  const palette = variant === 'raised' ? cardRaised : variant === 'flat' ? cardFlat : cardOutline;
  return <div className={cn('rounded-2xl p-5 sm:p-6', palette[tone], className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Dòng nhỏ phía trên tiêu đề, viết thường (không in hoa). */
  eyebrow?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1">
        {back && <div className="mb-2">{back}</div>}
        {eyebrow && <p className="mb-1 text-sm font-medium text-emerald-700">{eyebrow}</p>}
        <h2 className="text-[1.65rem] font-bold leading-tight tracking-tight text-gray-900">{title}</h2>
        {description && <p className="mt-1 max-w-3xl font-light text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  icon,
  action,
  className = '',
}: {
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-3', className)}>
      <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold text-gray-800">
        {icon && <span className="text-emerald-600">{icon}</span>}
        {children}
      </h3>
      {action}
    </div>
  );
}

/* ===== Nút ===== */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft';

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  className = '',
  size = 'md',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  size?: 'sm' | 'md' | 'icon';
  title?: string;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_8px_20px_-10px_rgba(5,150,105,0.8)]',
    secondary: 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-500 shadow-[0_8px_20px_-10px_rgba(220,38,38,0.8)]',
    ghost: 'text-gray-500 hover:bg-emerald-50/70 hover:text-emerald-800',
    soft: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  };
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', icon: 'h-9 w-9 p-0' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ===== Nhãn trạng thái: luôn có màu kèm chữ ===== */

export type PillTone = 'green' | 'amber' | 'red' | 'purple' | 'blue' | 'gray' | 'slate' | 'orange';

const pillTones: Record<PillTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  purple: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  orange: 'bg-orange-50 text-orange-700 ring-orange-100',
  gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  slate: 'bg-white text-gray-500 ring-gray-200',
};

export function Pill({
  children,
  tone = 'gray',
  pulse = false,
  className = '',
  title,
}: {
  children: ReactNode;
  tone?: PillTone;
  pulse?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold ring-1',
        pillTones[tone],
        className,
      )}
    >
      {pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ===== Trạng thái trống và đang tải ===== */

export function EmptyState({
  title,
  hint,
  action,
  className = '',
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-900/10 bg-white/50 px-6 py-12 text-center',
        className,
      )}
    >
      <Inbox className="mb-3 text-emerald-200" size={30} />
      <p className="font-semibold text-gray-700">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm font-light text-gray-400">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Notice({
  children,
  tone = 'info',
  icon,
  className = '',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'danger' | 'success';
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'bg-sky-50 text-sky-800 ring-sky-100',
    warning: 'bg-amber-50 text-amber-800 ring-amber-100',
    danger: 'bg-red-50 text-red-800 ring-red-100',
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  };
  return (
    <div className={cn('flex items-start gap-3 rounded-xl p-3.5 text-sm ring-1', tones[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function NotFound({ message = 'Không tìm thấy dữ liệu bạn yêu cầu, hoặc dữ liệu nằm ngoài phạm vi của bạn.' }) {
  return (
    <div className="py-24 text-center">
      <p className="text-5xl font-bold tracking-tight text-emerald-100">404</p>
      <p className="mt-4 text-lg font-semibold text-gray-800">Không tìm thấy</p>
      <p className="mx-auto mt-1 max-w-md font-light text-gray-500">{message}</p>
    </div>
  );
}

/* ===== Biểu mẫu ===== */

export function Field({
  label,
  children,
  error,
  hint,
  required,
  className = '',
}: {
  label?: ReactNode;
  children: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-gray-600">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs font-light text-gray-400">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'min-h-24', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, 'pr-8', props.className)} />;
}

/** Select gọn dùng trong thanh lọc. */
export function FilterSelect({
  value,
  onChange,
  children,
  className = '',
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        'h-10 rounded-xl border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 transition hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15',
        value && 'border-emerald-300 bg-emerald-50/50 text-emerald-900',
        className,
      )}
    >
      {children}
    </select>
  );
}

/** Công tắc dạng chip, dùng cho các bộ lọc bật/tắt. */
export function ToggleChip({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium ring-1 transition',
        checked
          ? 'bg-emerald-600 text-white ring-emerald-600'
          : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-[5px] ring-1',
          checked ? 'bg-white text-emerald-700 ring-white' : 'ring-gray-300',
        )}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}

/** Thanh công cụ lọc một hàng: ô tìm kiếm co giãn + các bộ lọc gọn. */
export function Toolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

/** Nhóm nút chọn một trong nhiều (thay cho tab nhỏ). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; badge?: number }[];
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-xl bg-emerald-950/[0.04] p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === option.value ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800',
          )}
        >
          {option.label}
          {option.badge !== undefined && option.badge > 0 && (
            <span className="rounded-md bg-emerald-100 px-1.5 text-[11px] font-semibold text-emerald-800 tabular-nums">
              {option.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ===== Hộp thoại (Radix Dialog) ===== */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
  description,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  description?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'anim-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-float focus:outline-none',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold tracking-tight text-gray-900">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-sm font-light text-gray-500">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Panel trượt từ phải — dùng cho form dài thay vì hộp thoại giữa màn hình. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-emerald-950/20 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'anim-sheet fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-float focus:outline-none sm:inset-y-3 sm:right-3 sm:rounded-2xl',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold tracking-tight text-gray-900">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-sm font-light text-gray-500">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  consequences,
  confirmLabel = 'Xác nhận',
  danger = true,
  pending,
  disabled,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  consequences?: string[];
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Quay lại
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending || disabled}>
            {pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-gray-600">{message}</div>
      {consequences && consequences.length > 0 && (
        <ul className="mt-4 space-y-1.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          {consequences.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              {item}
            </li>
          ))}
        </ul>
      )}
      {children && <div className="mt-4">{children}</div>}
    </Modal>
  );
}

/* ===== Menu thao tác (Radix Dropdown) ===== */

export interface MenuAction {
  label: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export function ActionMenu({
  items,
  trigger,
  align = 'end',
}: {
  items: MenuAction[];
  trigger?: ReactNode;
  align?: 'start' | 'end';
}) {
  if (items.length === 0) return null;
  return (
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label="Thao tác"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={6}
          className="anim-pop z-50 min-w-48 rounded-xl bg-white p-1 shadow-float ring-1 ring-emerald-950/5"
        >
          {items.map((item, index) => (
            <Dropdown.Item
              key={index}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
                item.danger ? 'text-red-600 data-[highlighted]:bg-red-50' : 'text-gray-700 data-[highlighted]:bg-emerald-50',
              )}
            >
              {item.icon}
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/* ===== Chú thích khi rê chuột (Radix Tooltip) ===== */

export function Tip({ content, children }: { content: ReactNode; children: ReactNode }) {
  if (!content) return <>{children}</>;
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="anim-pop z-50 max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-lg"
          >
            {content}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/* ===== Bảng dữ liệu ===== */

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  pageSize = 12,
  emptyTitle = 'Chưa có dữ liệu',
  emptyHint,
  rowClassName,
  flat = false,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyHint?: string;
  rowClassName?: (row: T) => string;
  /** Bảng nằm trong thẻ khác: bỏ nền và bóng riêng. */
  flat?: boolean;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const slice = rows.slice(current * pageSize, current * pageSize + pageSize);

  useEffect(() => setPage(0), [rows.length]);

  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <div>
      <div
        className={cn(
          'overflow-x-auto custom-scrollbar',
          !flat && 'rounded-2xl bg-white shadow-grass ring-1 ring-emerald-950/[0.04]',
        )}
      >
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-emerald-950/[0.06] bg-emerald-50/30">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn('whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-500', column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-gray-50 last:border-0',
                  onRowClick && 'cursor-pointer transition hover:bg-emerald-50/50',
                  rowClassName?.(row),
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between px-1 text-sm text-gray-500">
          <span className="font-light">
            {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} trên {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, current - 1))}
              disabled={current === 0}
              className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-2 tabular-nums">
              {current + 1}/{pageCount}
            </span>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
              disabled={current >= pageCount - 1}
              className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm…',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, 'h-10 py-0 pl-10')}
      />
    </div>
  );
}

/* ===== Tab (Radix Tabs, điều khiển từ ngoài) ===== */

export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: { key: string; label: ReactNode; badge?: number }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <RadixTabs.Root value={active} onValueChange={onChange} className={className}>
      <RadixTabs.List className="flex gap-1 overflow-x-auto border-b border-emerald-950/[0.07] custom-scrollbar">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.key}
            value={tab.key}
            className={cn(
              'relative shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium outline-none transition',
              'text-gray-400 hover:bg-white/70 hover:text-gray-700',
              'data-[state=active]:text-emerald-800 data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-emerald-600',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 tabular-nums">
                {tab.badge}
              </span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}

/* ===== Ảnh đại diện ===== */

export function Avatar({
  src,
  name,
  size = 40,
  className = '',
}: {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const letter = name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? '?';
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={cn('shrink-0 rounded-[12px] object-cover ring-1 ring-emerald-950/5', className)}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[12px] bg-emerald-100/70 font-bold text-emerald-800',
        className,
      )}
    >
      {letter}
    </span>
  );
}

/* ===== Thông báo nổi ===== */

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{ push: (message: string, tone?: Toast['tone']) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const value = useMemo(
    () => ({
      push: (message: string, tone: Toast['tone'] = 'info') => {
        counter.current += 1;
        const id = counter.current;
        setToasts((current) => [...current, { id, message, tone }]);
        setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 5000);
      },
    }),
    [],
  );

  const tones = {
    success: 'bg-white text-emerald-800 ring-emerald-100 shadow-grass-lift',
    error: 'bg-white text-red-700 ring-red-100 shadow-red',
    info: 'bg-white text-gray-700 ring-gray-100 shadow-grass',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn('anim-pop pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium ring-1', tones[toast.tone])}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ===== Hiệu ứng vào màn hình ===== */

export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const targets = ref.current.querySelectorAll('[data-reveal]');
    if (targets.length === 0) return;
    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', clearProps: 'transform' },
    );
    return () => {
      tween.kill();
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/* ===== Hàng thông tin ===== */

export function InfoRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 py-2.5 last:border-0">
      <span className="text-sm font-light text-gray-400">{label}</span>
      <span className="text-right text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}

/** Lưới thông tin nhãn–giá trị, xếp nhiều cột theo bề rộng. */
export function InfoGrid({
  items,
  className = '',
}: {
  items: { label: ReactNode; value: ReactNode; wide?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-4', className)}>
      {items.map((item, index) => (
        <div key={index} className={cn('min-w-0', item.wide && 'col-span-2')}>
          <dt className="text-xs font-light text-gray-400">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-gray-800">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

type StatTone = 'default' | 'danger' | 'warning' | 'success';

export function Stat({
  value,
  label,
  icon,
  tone = 'default',
  onClick,
  hint,
  active,
  className = '',
}: {
  value: ReactNode;
  label: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  onClick?: () => void;
  hint?: ReactNode;
  active?: boolean;
  className?: string;
}) {
  const iconTones: Record<StatTone, string> = {
    default: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-red-50 text-red-600',
    warning: 'bg-amber-50 text-amber-600',
    success: 'bg-emerald-50 text-emerald-600',
  };
  const valueTones: Record<StatTone, string> = {
    default: 'text-gray-900',
    danger: 'text-red-700',
    warning: 'text-amber-700',
    success: 'text-emerald-700',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group flex w-full items-start justify-between gap-3 rounded-2xl bg-white p-5 text-left ring-1 ring-emerald-950/[0.05] transition-all duration-200 disabled:cursor-default',
        onClick && 'hover:-translate-y-0.5 hover:shadow-grass-lift',
        active && 'ring-2 ring-emerald-500',
        className,
      )}
    >
      <div className="min-w-0">
        <p className={cn('text-3xl font-bold leading-none tabular-nums', valueTones[tone])}>{value}</p>
        <p className="mt-2 text-sm text-gray-500">{label}</p>
        {hint && <p className="mt-1 text-xs font-light text-gray-400">{hint}</p>}
      </div>
      {icon && <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconTones[tone])}>{icon}</div>}
    </button>
  );
}

/** Thanh tiến độ mảnh. */
export function Meter({
  value,
  max,
  tone = 'green',
  className = '',
}: {
  value: number;
  max: number;
  tone?: 'green' | 'amber' | 'red';
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const tones = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' };
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-emerald-950/[0.06]', className)}>
      <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
