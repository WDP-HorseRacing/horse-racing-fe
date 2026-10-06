// Bộ thành phần dùng chung. Tự style trên Radix primitives.
// Bảng màu 2 + 1: xanh cỏ (chủ đạo) · xám (trung tính, mọi trạng thái bình thường) · hổ phách (cần chú ý).
// Đỏ chỉ dành cho điều nghiêm trọng. Chỉ tô màu khi có điều bất thường — phần bình thường để trung tính.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type ReactNode,
  type FormEvent,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as RadixTabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Inbox, MoreHorizontal, Search, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import gsap from 'gsap';
import { Toaster, toast as sonnerToast } from 'sonner';
import { prefersReducedMotion } from '../../lib/motion';
import { OptionMenu } from './OptionMenu';
import { readOptions } from './option-utils';

/** Ghép class Tailwind, class truyền sau thắng class mặc định. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ===== Thẻ và tiêu đề ===== */

type CardTone = 'default' | 'danger' | 'warning' | 'success' | 'muted';
type CardVariant = 'raised' | 'flat' | 'outline';

// Tone của thẻ chỉ còn là một dải màu 3px bên trái — không tô nền cả khối.
const toneAccent: Record<CardTone, string> = {
  default: '',
  muted: '',
  success: '',
  // Gộp dải nhấn và bóng nhẹ vào MỘT giá trị box-shadow để không đè nhau.
  warning: 'shadow-[inset_3px_0_0_0_#f59e0b,0_1px_2px_rgba(20,30,25,0.04)]',
  danger: 'shadow-[inset_3px_0_0_0_#ef4444,0_1px_2px_rgba(20,30,25,0.04)]',
};
const cardBase: Record<CardVariant, string> = {
  raised: 'bg-white ring-1 ring-gray-200/80',
  flat: 'bg-white/55 ring-1 ring-gray-200/50',
  outline: 'bg-transparent ring-1 ring-gray-200',
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
  return (
    <div className={cn('rounded-2xl p-5', cardBase[variant], toneAccent[tone] || (variant === 'raised' && 'shadow-card'), tone === 'muted' && 'opacity-90', className)}>
      {children}
    </div>
  );
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
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-72">
        {back && <div className="mb-2">{back}</div>}
        {eyebrow && <p className="mb-1 text-sm text-gray-500">{eyebrow}</p>}
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-gray-900">{title}</h2>
        {description && (
          <p
            className="mt-1 line-clamp-1 max-w-4xl text-sm text-gray-500"
            title={typeof description === 'string' ? description : undefined}
          >
            {description}
          </p>
        )}
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
      <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold text-gray-900">
        {icon && <span className="text-gray-400">{icon}</span>}
        {children}
      </h3>
      {action}
    </div>
  );
}

/* ===== Nút ===== */

/**
 * `inline` / `inlineDanger`: nút thao tác nằm trong một dòng thông tin (Đổi khu, Gỡ…). Có nền và viền nhạt
 * để nhìn là biết bấm được, khác `ghost` chỉ là chữ xám (dùng cho nút Hủy của biểu mẫu).
 */
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft' | 'inline' | 'inlineDanger';

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
    primary: 'bg-emerald-700 text-white hover:bg-emerald-600',
    secondary: 'bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    soft: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    inline: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 hover:ring-emerald-300',
    inlineDanger: 'bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50 hover:ring-red-300',
  };
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-3.5 text-sm', icon: 'h-9 w-9 p-0' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ===== Nhãn trạng thái =====
 * Chỉ 4 sắc: xanh cỏ (đang chạy / tích cực), hổ phách (cần chú ý), đỏ (nghiêm trọng), xám (bình thường).
 * Các tone cũ (blue, purple, orange, slate…) được quy về 4 sắc này để các trang không phải sửa. */

export type PillTone = 'green' | 'amber' | 'red' | 'purple' | 'blue' | 'gray' | 'slate' | 'orange';

const pillTones: Record<PillTone, string> = {
  green: 'bg-emerald-50 text-emerald-800',
  amber: 'bg-amber-50 text-amber-800',
  orange: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-gray-100 text-gray-700',
  blue: 'bg-gray-100 text-gray-700',
  gray: 'bg-gray-100 text-gray-700',
  slate: 'bg-white text-gray-600 ring-1 ring-gray-200',
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
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
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/60 px-6 py-10 text-center',
        className,
      )}
    >
      <Inbox className="mb-3 text-gray-300" size={28} />
      <p className="font-semibold text-gray-700">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-gray-500">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={cn('skeleton-delay space-y-3', className)} role="status" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-red-50 p-3.5 text-sm text-red-800 ring-1 ring-red-100">
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
    info: 'bg-white text-gray-700 ring-gray-200',
    warning: 'bg-amber-50/70 text-amber-900 ring-amber-200/70',
    danger: 'bg-red-50/80 text-red-800 ring-red-200/70',
    success: 'bg-emerald-50/70 text-emerald-900 ring-emerald-200/70',
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
      <p className="text-5xl font-bold tracking-tight text-gray-200">404</p>
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
  counter,
  required,
  name,
  className = '',
}: {
  label?: ReactNode;
  children: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Bộ đếm ký tự ở góc phải dưới ô, ví dụ <CharCount value={name} max={160} />. */
  counter?: ReactNode;
  required?: boolean;
  /** Tên ô — để cuộn tới ô lỗi đầu tiên khi bấm lưu (xem scrollToFirstError). */
  name?: string;
  className?: string;
}) {
  const note = error ? (
    <span role="alert" className="block text-xs font-medium text-red-600">
      {error}
    </span>
  ) : hint ? (
    <span className="block text-xs font-light text-gray-400">{hint}</span>
  ) : null;
  return (
    <label className={cn('block', className)} data-field={name} data-invalid={error ? 'true' : undefined}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-gray-600">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      {children}
      {(note || counter) && (
        <span className="mt-1.5 flex items-start justify-between gap-3">
          <span className="min-w-0">{note}</span>
          {counter}
        </span>
      )}
    </label>
  );
}

/** Bộ đếm ký tự: xám bình thường, hổ phách khi gần chạm giới hạn. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const length = value.length;
  return (
    <span className={cn('shrink-0 text-xs tabular-nums', length >= max ? 'font-medium text-amber-700' : 'text-gray-400')}>
      {length}/{max}
    </span>
  );
}

/** Cuộn tới ô đang báo lỗi đầu tiên trong vùng chứa và đặt con trỏ vào đó. */
export function scrollToFirstError(root: ParentNode = document) {
  window.requestAnimationFrame(() => {
    const field = root.querySelector<HTMLElement>('[data-invalid="true"]');
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.querySelector<HTMLElement>('input, select, textarea, button[data-select-trigger]')?.focus({ preventScroll: true });
  });
}

/** Viền đỏ nhạt cho ô đang lỗi. */
export const invalidClass = 'border-red-300 focus:border-red-400 focus:ring-red-500/15';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

/** Ô mật khẩu có nút con mắt bên phải để hiện / ẩn mật khẩu. */
export function PasswordInput({ className, wrapperClassName = '', ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { wrapperClassName?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn('relative', wrapperClassName)}>
      <input {...props} type={visible ? 'text' : 'password'} className={cn(inputClass, className, 'pr-11')} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-gray-400 transition hover:text-gray-700 focus-visible:text-emerald-700 focus-visible:outline-none"
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, onInput, ...props }, ref) => {
    const handleInput = (e: FormEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      target.style.height = 'auto';
      target.style.height = `${target.scrollHeight + 2}px`;
      if (onInput) onInput(e as unknown as any);
    };
    return (
      <textarea 
        {...props} 
        ref={ref}
        onInput={handleInput}
        className={cn(inputClass, 'min-h-24 resize-none overflow-hidden', className)} 
      />
    );
  }
);

export function Select({
  value,
  onChange,
  onBlur,
  children,
  disabled,
  className,
  id,
  title,
  'aria-label': ariaLabel,
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // Ô chọn tự thiết kế, giữ nguyên cách dùng của <select>: <Select value onChange={(e) => e.target.value}><option/></Select>.
  const options = readOptions(children);
  const current = String(value ?? '');
  const selected = options.find((option) => option.value === current) ?? options[0];
  const placeholder = !selected || selected.value === '';
  return (
    <OptionMenu
      options={options}
      value={current}
      disabled={disabled}
      onSelect={(next) => {
        if (next === current) return;
        onChange?.({ target: { value: next }, currentTarget: { value: next } } as unknown as React.ChangeEvent<HTMLSelectElement>);
      }}
      onClosed={() => onBlur?.({ target: { value: current } } as unknown as React.FocusEvent<HTMLSelectElement>)}
      trigger={
        <button
          type="button"
          id={id}
          title={title}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          data-select-trigger
          className={cn(
            inputClass,
            'flex items-center justify-between gap-2 text-left data-[state=open]:border-emerald-500 data-[state=open]:ring-2 data-[state=open]:ring-emerald-500/15',
            className,
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', placeholder && 'text-gray-500')}>{selected?.label ?? '—'}</span>
          <ChevronDown size={16} className="shrink-0 text-gray-400 transition-transform [[data-state=open]_&]:rotate-180" />
        </button>
      }
    />
  );
}

/** Ô chọn gọn dạng pill dùng trong thanh lọc. */
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
  const options = readOptions(children);
  const selected = options.find((option) => option.value === String(value));
  return (
    <OptionMenu
      options={options}
      value={String(value)}
      onSelect={onChange}
      trigger={
        <button
          type="button"
          aria-label={label}
          aria-haspopup="listbox"
          className={cn(
            'inline-flex h-9 max-w-64 items-center justify-between gap-2 rounded-full border border-gray-200 bg-white pl-4 pr-3 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15',
            value && 'border-emerald-600/30 bg-emerald-50 font-medium text-emerald-900',
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : label}</span>
          <ChevronDown size={14} className={cn('shrink-0 transition-colors', value ? 'text-emerald-700' : 'text-gray-400')} />
        </button>
      }
    />
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
        'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ring-1 transition',
        checked
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/40'
          : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-[5px] ring-1',
          checked ? 'bg-emerald-700 text-white ring-emerald-700' : 'ring-gray-300',
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
    <div className={cn('inline-flex rounded-lg bg-gray-100 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
            value === option.value ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-500 hover:text-gray-800',
          )}
        >
          {option.label}
          {option.badge !== undefined && option.badge > 0 && (
            <span className="rounded bg-gray-200/80 px-1.5 text-[11px] font-semibold text-gray-700 tabular-nums">
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
  tip,
  tipVariant = 'dark',
}: {
  items: MenuAction[];
  trigger?: ReactNode;
  align?: 'start' | 'end';
  /** Chú thích khi rê chuột vào nút mở menu (Tooltip lồng Dropdown theo đúng cách Radix hướng dẫn). */
  tip?: ReactNode;
  tipVariant?: 'dark' | 'card';
}) {
  if (items.length === 0) return null;
  const button = (
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
  );
  return (
    <Dropdown.Root modal={false}>
      {tip ? (
        <Tooltip.Provider delayDuration={tipVariant === 'card' ? 120 : 200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
            <TipBubble content={tip} variant={tipVariant} />
          </Tooltip.Root>
        </Tooltip.Provider>
      ) : (
        button
      )}
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={6}
          className="anim-pop z-50 min-w-48 rounded-xl bg-white p-1 shadow-float ring-1 ring-gray-200"
        >
          {items.map((item, index) => (
            <Dropdown.Item
              key={index}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
                item.danger ? 'text-red-600 data-[highlighted]:bg-red-50' : 'text-gray-700 data-[highlighted]:bg-gray-100',
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

export function Tip({
  content,
  children,
  variant = 'dark',
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  /** `card`: thẻ nhỏ nền trắng (ví dụ thông tin ngựa khi rê chuột vào ô chuồng). */
  variant?: 'dark' | 'card';
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  if (!content) return <>{children}</>;
  return (
    <Tooltip.Provider delayDuration={variant === 'card' ? 120 : 200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <TipBubble content={content} variant={variant} side={side} />
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function TipBubble({ content, variant, side = 'top' }: { content: ReactNode; variant: 'dark' | 'card'; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  const card = variant === 'card';
  return (
    <Tooltip.Portal>
      <Tooltip.Content
        side={side}
        sideOffset={card ? 8 : 6}
        collisionPadding={12}
        className={
          card
            ? 'anim-pop z-50 w-60 rounded-xl bg-white p-3 text-sm text-gray-700 shadow-[0_18px_40px_-18px_rgba(6,78,59,0.45)] ring-1 ring-gray-200'
            : 'anim-pop z-50 max-w-xs rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-lg'
        }
      >
        {content}
        <Tooltip.Arrow className={card ? 'fill-white' : 'fill-gray-900'} />
      </Tooltip.Content>
    </Tooltip.Portal>
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

  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} className={flat ? 'rounded-none border-0 bg-transparent' : ''} />;

  return (
    <div>
      <div
        className={cn(
          'overflow-x-auto custom-scrollbar',
          !flat && 'rounded-2xl bg-white shadow-card ring-1 ring-gray-200/80',
        )}
      >
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200/80">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn('whitespace-nowrap px-4 py-2.5 text-xs font-medium text-gray-500', column.className)}
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
                  'border-b border-gray-100 last:border-0',
                  onRowClick && 'cursor-pointer transition hover:bg-gray-50',
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
        <div className={cn('flex items-center justify-between text-sm text-gray-500', flat ? 'border-t border-gray-100 px-4 py-2.5' : 'mt-3 px-1')}>
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

/* ===== Tab kiểu trình duyệt (Radix Tabs, điều khiển từ ngoài) =====
 * Tab đang chọn là một "thẻ" trắng bo góc trên, đè lên đường kẻ để nối liền với nội dung bên dưới.
 * Dùng cho cả chuyển mục (hồ sơ ngựa) lẫn bộ lọc (danh sách ngựa, yêu cầu khám…). Bộ lọc thì bọc
 * nội dung bằng <TabPanel> để tab và bảng thành một khối. */

export interface TabItem {
  key: string;
  label: ReactNode;
  /** Số nhỏ bên phải, ẩn khi bằng 0 (dùng cho chuyển mục). */
  badge?: number;
  /** Số đếm của bộ lọc, luôn hiện kể cả 0. */
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <RadixTabs.Root value={active} onValueChange={onChange} className={className}>
      <RadixTabs.List className="no-scrollbar flex items-end gap-1 overflow-x-auto border-b border-gray-200 px-1">
        {tabs.map((tab) => {
          const number = tab.count ?? (tab.badge ? tab.badge : undefined);
          const isActive = tab.key === active;
          return (
            <RadixTabs.Trigger
              key={tab.key}
              value={tab.key}
              className={cn(
                'relative -mb-px flex shrink-0 items-center gap-2 rounded-t-xl border px-4 py-2.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500/30',
                isActive
                  ? 'z-1 border-gray-200 border-b-white bg-white font-semibold text-emerald-900'
                  : 'border-transparent font-medium text-gray-500 hover:bg-white/60 hover:text-gray-800',
                tab.count === 0 && !isActive && 'text-gray-400',
              )}
            >
              {tab.label}
              {number !== undefined && (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-px text-[11px] font-semibold tabular-nums',
                    isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-200/70 text-gray-600',
                  )}
                >
                  {number}
                </span>
              )}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}

/** Khung nội dung nối liền ngay dưới <Tabs>: cùng viền, bo góc dưới. */
export function TabPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-b-2xl border border-t-0 border-gray-200 bg-white shadow-[0_14px_32px_-26px_rgba(6,78,59,0.35)]', className)}>
      {children}
    </div>
  );
}

/** Tab bộ lọc + khung nội dung liền nhau. `toolbar` là hàng tìm kiếm/bộ lọc phụ nằm trong khung, trên nội dung. */
export function FilterTabs({
  tabs,
  active,
  onChange,
  toolbar,
  children,
  className = '',
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Tabs tabs={tabs} active={active} onChange={onChange} />
      <TabPanel>
        {toolbar && <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">{toolbar}</div>}
        {children}
      </TabPanel>
    </div>
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
  // Ảnh tải xong mới hiện dần lên trên ô chữ cái; lỗi (vd. link ký sẵn hết hạn) thì giữ ô chữ cái.
  const [state, setState] = useState<{ src?: string; status: 'loading' | 'loaded' | 'failed' }>({ src, status: 'loading' });
  const status = state.src === src ? state.status : 'loading';
  if (state.src !== src) setState({ src, status: 'loading' });
  const showImage = !!src && status !== 'failed';
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-emerald-50 font-semibold text-emerald-800/70',
        showImage && 'ring-1 ring-black/5',
        className,
      )}
    >
      <span aria-hidden={showImage || undefined}>{letter}</span>
      {showImage && (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setState({ src, status: 'loaded' })}
          onError={() => setState({ src, status: 'failed' })}
          className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-300', status === 'loaded' ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </span>
  );
}

/* ===== Thông báo nổi ===== */

/** Nút phụ trong thông báo nổi, ví dụ "Giao Groom" ngay sau khi xếp ô. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  action?: ToastAction;
}

const ToastContext = createContext<{ push: (message: string, tone?: Toast['tone'], action?: ToastAction) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}



export function ToastHost({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({
      push: (message: string, tone: Toast['tone'] = 'info', action?: ToastAction) => {
        const options = action
          ? {
              action: {
                label: action.label,
                onClick: action.onClick,
              },
            }
          : undefined;

        if (tone === 'success') {
          sonnerToast.success(message, options);
        } else if (tone === 'error') {
          sonnerToast.error(message, options);
        } else {
          sonnerToast.info(message, options);
        }
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'font-sans',
          classNames: {
            toast: 'group rounded-xl border shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur px-4 py-3',
            title: 'text-sm font-semibold',
            success: '!border-emerald-200 !text-emerald-900 !bg-emerald-50/95',
            error: '!border-red-200 !text-red-900 !bg-red-50/95',
            info: '!border-gray-200 !text-gray-900 !bg-white/95',
            actionButton: '!bg-emerald-100 !text-emerald-800 hover:!bg-emerald-200 font-semibold rounded-lg px-2.5 py-1',
          }
        }}
      />
    </ToastContext.Provider>
  );
}

/* ===== Hiệu ứng vào màn hình ===== */

export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const targets = ref.current.querySelectorAll('[data-reveal]');
    if (targets.length === 0 || prefersReducedMotion()) return;
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
      <span className="text-sm text-gray-500">{label}</span>
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
          <dt className="text-xs text-gray-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-gray-900">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

type StatTone = 'default' | 'danger' | 'warning' | 'success';

/**
 * Ô số liệu. Số luôn màu mực; chỉ khi tone là warning/danger VÀ giá trị khác 0 thì mới tô màu
 * và hiện dải nhấn bên trái — để chỗ cần chú ý thật sự nổi lên giữa các số bình thường.
 */
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
  const quiet = value === 0 || value === '0' || tone === 'success' || tone === 'default';
  const effective: StatTone = quiet ? 'default' : tone;
  const valueTones: Record<StatTone, string> = {
    default: 'text-gray-900',
    success: 'text-gray-900',
    danger: 'text-red-700',
    warning: 'text-amber-700',
  };
  // Chấm icon: xanh cỏ khi bình thường, hổ phách / đỏ nhạt khi có việc cần chú ý.
  const chip: Record<StatTone, string> = {
    default: 'tint-emerald',
    success: 'tint-emerald',
    danger: 'tint-red',
    warning: 'tint-amber',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group flex w-full items-start justify-between gap-3 rounded-2xl bg-white px-4 py-4 text-left shadow-[0_10px_26px_-22px_rgba(6,78,59,0.55)] ring-1 ring-gray-200/70 transition duration-150 disabled:cursor-default',
        onClick && 'hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-22px_rgba(6,78,59,0.6)] hover:ring-emerald-200',
        active && 'ring-2 ring-emerald-500/60',
        className,
      )}
    >
      <div className="min-w-0">
        <p className={cn('text-[1.75rem] font-bold leading-none tabular-nums', valueTones[effective])}>
          <CountUp value={value} />
        </p>
        <p className="mt-2 text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-gray-500">{hint}</p>}
      </div>
      {icon && <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', chip[effective])}>{icon}</div>}
    </button>
  );
}

/** Số đếm từ 0 lên khi vào trang (chỉ với số; chuỗi như số tiền thì hiện thẳng). */
function CountUp({ value }: { value: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (typeof value !== 'number' || value === 0 || !ref.current || prefersReducedMotion()) return;
    const counter = { n: 0 };
    const tween = gsap.to(counter, {
      n: value,
      duration: 0.9,
      ease: 'power3.out',
      delay: 0.1,
      onUpdate: () => {
        if (ref.current) ref.current.textContent = String(Math.round(counter.n));
      },
    });
    return () => {
      tween.kill();
      if (ref.current) ref.current.textContent = String(value);
    };
  }, [value]);
  return <span ref={ref}>{value}</span>;
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
  const tones = { green: 'bg-emerald-600', amber: 'bg-amber-500', red: 'bg-red-500' };
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-gray-200/70', className)}>
      <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

/** Chấm trạng thái nhỏ — dùng thay cho pill màu trong bảng và danh sách. */
export type DotTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'live';

const dotTones: Record<DotTone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-gray-300',
  live: 'bg-emerald-500 animate-pulse',
};

export function Dot({ tone = 'neutral', hollow = false, className = '' }: { tone?: DotTone; hollow?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        hollow ? `bg-white ring-2 ${tone === 'danger' ? 'ring-red-500' : tone === 'warn' ? 'ring-amber-500' : 'ring-gray-400'}` : dotTones[tone],
        className,
      )}
    />
  );
}

/**
 * Hàng chip lọc gọn thay cho các thẻ KPI to: "Tất cả 13 · ● Cần theo dõi 1 · …".
 * Một màu duy nhất: chip đang chọn nền xanh cỏ nhạt; không dùng chấm màu trong chip
 * (mức nghiêm trọng đã thể hiện ở nội dung bên dưới). Prop `dot` giữ lại cho tương thích.
 */
export function ChipFilter<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; count?: number; dot?: DotTone; hollow?: boolean }[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        const quiet = option.count === 0;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm ring-1 transition-colors',
              selected
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/40'
                : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300',
              quiet && !selected && 'text-gray-400',
            )}
          >
            <span className="font-medium">{option.label}</span>
            {option.count !== undefined && (
              <span className={cn('tabular-nums', selected ? 'text-emerald-700/70' : 'text-gray-400')}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
