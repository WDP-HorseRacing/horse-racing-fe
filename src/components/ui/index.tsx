// Bộ thành phần dùng chung. Mọi class bám theo ngôn ngữ thiết kế sẵn có của dự án:
// thẻ bo 2xl, viền gray-100, đổ bóng ám xanh lá, nhấn emerald-600.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Search, X } from 'lucide-react';
import gsap from 'gsap';

/* ===== Thẻ và tiêu đề ===== */

export function Card({
  children,
  className = '',
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'danger' | 'warning' | 'success' | 'muted';
}) {
  const tones = {
    default: 'border-gray-100 bg-white',
    danger: 'border-red-100 bg-red-50/50',
    warning: 'border-amber-100 bg-amber-50/50',
    success: 'border-emerald-100 bg-emerald-50/50',
    muted: 'border-gray-100 bg-gray-50/60',
  };
  return (
    <div
      className={`rounded-2xl border p-6 shadow-[0_2px_8px_rgba(5,96,69,0.05)] ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
        {description && <p className="mt-1 font-light text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-500">
      {icon}
      {children}
    </h3>
  );
}

/* ===== Nút ===== */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  className = '',
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  size?: 'sm' | 'md';
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20',
    secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-600/20',
    ghost: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ===== Nhãn trạng thái: luôn có màu kèm chữ ===== */

export type PillTone = 'green' | 'amber' | 'red' | 'purple' | 'blue' | 'gray' | 'slate';

const pillTones: Record<PillTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  gray: 'bg-gray-100 text-gray-600 ring-gray-200',
  slate: 'bg-gray-100 text-gray-500 ring-gray-200',
};

export function Pill({
  children,
  tone = 'gray',
  pulse = false,
  className = '',
}: {
  children: ReactNode;
  tone?: PillTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${pillTones[tone]} ${className}`}
    >
      {pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ===== Trạng thái trống và đang tải ===== */

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-14 text-center">
      <Inbox className="mb-3 text-gray-300" size={30} />
      <p className="font-semibold text-gray-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm font-light text-gray-400">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function NotFound({ message = 'Không tìm thấy dữ liệu bạn yêu cầu, hoặc dữ liệu nằm ngoài phạm vi của bạn.' }) {
  return (
    <div className="py-24 text-center">
      <p className="text-5xl font-bold tracking-tight text-gray-200">404</p>
      <p className="mt-4 text-lg font-semibold text-gray-800">Không tìm thấy</p>
      <p className="mx-auto mt-1 max-w-sm font-light text-gray-500">{message}</p>
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
  label?: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-2 block text-sm font-medium text-gray-600">
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
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-28 ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

/* ===== Hộp thoại ===== */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/30 p-4 backdrop-blur-sm sm:p-8">
      <div className={`my-auto w-full ${width} rounded-2xl bg-white shadow-[0_16px_48px_rgba(5,96,69,0.18)]`}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-bold tracking-tight text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
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
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  consequences?: string[];
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
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
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending}>
            {pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
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

/* ===== Bảng dữ liệu ===== */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  pageSize = 10,
  emptyTitle = 'Chưa có dữ liệu',
  emptyHint,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const slice = rows.slice(current * pageSize, current * pageSize + pageSize);

  useEffect(() => setPage(0), [rows.length]);

  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-[0_2px_8px_rgba(5,96,69,0.05)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-xs font-semibold text-gray-400 ${column.className ?? ''}`}
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
                className={`border-b border-gray-50 last:border-0 ${onRowClick ? 'cursor-pointer transition hover:bg-emerald-50/40' : ''}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 align-middle ${column.className ?? ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span className="font-light">
            {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} trên {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, current - 1))}
              disabled={current === 0}
              className="rounded-lg p-1.5 transition hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-2 tabular-nums">
              {current + 1}/{pageCount}
            </span>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
              disabled={current >= pageCount - 1}
              className="rounded-lg p-1.5 transition hover:bg-gray-100 disabled:opacity-30"
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
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-10`}
      />
    </div>
  );
}

/* ===== Tab ===== */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; badge?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-gray-100 pb-px">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
            active === tab.key
              ? 'text-emerald-700 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-emerald-600'
              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
          }`}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="ml-1.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 tabular-nums">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
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
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-[12px] object-cover ring-1 ring-gray-100 ${className}`}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`flex shrink-0 items-center justify-center rounded-[12px] bg-emerald-50 font-bold text-emerald-700 ${className}`}
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
    success: 'border-emerald-100 bg-white text-emerald-800',
    error: 'border-red-100 bg-white text-red-700',
    info: 'border-gray-100 bg-white text-gray-700',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_8px_24px_rgba(5,96,69,0.12)] ${tones[toast.tone]}`}
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
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: 'power3.out' },
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

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 py-2.5 last:border-0">
      <span className="text-sm font-light text-gray-400">{label}</span>
      <span className="text-right text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}

export function Stat({
  value,
  label,
  icon,
  tone = 'default',
  onClick,
}: {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger' | 'warning' | 'success';
  onClick?: () => void;
}) {
  const iconTones = {
    default: 'bg-gray-50 text-gray-500',
    danger: 'bg-red-50 text-red-500',
    warning: 'bg-amber-50 text-amber-500',
    success: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-[0_2px_8px_rgba(5,96,69,0.05)] transition-all duration-200 ${
        onClick ? 'hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(5,96,69,0.1)]' : ''
      }`}
    >
      <div>
        <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
        <p className="mt-1 text-sm text-gray-400">{label}</p>
      </div>
      {icon && <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconTones[tone]}`}>{icon}</div>}
    </button>
  );
}
