// Mảnh giao diện nhỏ dùng lại giữa các màn hình y tế.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Avatar, Dot, Pill, cn } from '../../../components/ui';
import { CheckupPill, HealthPill, UrgentPill, healthDot } from '../../../components/ui/status';
import { healthHint, healthLabel } from '../../../lib/labels';
import { requestSourceLabel } from '../../../lib/api-labels';
import { formatDateTime, formatRelative } from '../../../lib/format';
import { links } from '../../../lib/links';
import { now } from '../../../lib/clock';
import type { CheckupDueStatus, ExamRequest, HealthStatus } from '../../../api/types';
import type { People } from './people';
import { HEALTH_ORDER } from './utils';

/** Ảnh + tên ngựa, bấm để sang hồ sơ y tế của ngựa. */
export function HorseChip({
  horse,
  size = 36,
  sub,
  to,
  plain = false,
}: {
  horse: { id: string; name: string; photoUrl?: string | null };
  size?: number;
  sub?: ReactNode;
  /** Đích khi bấm; mặc định là hồ sơ y tế của ngựa. */
  to?: string;
  /** Không bọc link (dùng trong hàng bảng đã bấm được). */
  plain?: boolean;
}) {
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar src={horse.photoUrl ?? undefined} name={horse.name} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-gray-900">{horse.name}</span>
        {sub && <span className="block truncate text-xs text-gray-500">{sub}</span>}
      </span>
    </span>
  );
  if (plain) return body;
  return (
    <Link
      to={to ?? links.horseMedical(horse.id)}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-w-0 rounded-xl transition hover:opacity-80"
    >
      {body}
    </Link>
  );
}

export function LinkAction({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
      {children} <ArrowUpRight size={14} />
    </Link>
  );
}

export function Count({ value }: { value: number }) {
  return <span className="rounded-md bg-gray-100 px-1.5 text-xs font-semibold text-gray-600 tabular-nums">{value}</span>;
}

/** Bốn nút chọn trạng thái sức khỏe: viền xám, đang chọn → viền đậm + chấm màu tương ứng. */
export function HealthPicker({
  value,
  onChange,
  current,
  error,
}: {
  value: HealthStatus | '';
  onChange: (value: HealthStatus) => void;
  current?: HealthStatus;
  error?: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {HEALTH_ORDER.map((status) => {
          const active = value === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(status)}
              className={cn(
                'rounded-lg bg-white px-3 py-2.5 text-left transition active:scale-[0.99]',
                active ? 'ring-2 ring-gray-900' : 'ring-1 ring-gray-200 hover:ring-gray-300',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Dot tone={active ? healthDot[status] : 'neutral'} hollow={active && status === 'QUARANTINED'} />
                {healthLabel[status]}
                {current === status && <span className="ml-auto text-[11px] font-medium text-gray-500">hiện tại</span>}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-gray-500">{healthHint[status]}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

/** Sức khỏe trước → sau. */
export function HealthShift({ from, to }: { from: HealthStatus | null; to: HealthStatus }) {
  if (!from) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        Khởi tạo <ArrowRight size={13} className="text-gray-400" /> <HealthPill status={to} />
      </span>
    );
  }
  if (from === to) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <HealthPill status={to} /> giữ nguyên
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <HealthPill status={from} />
      <ArrowRight size={13} className="text-gray-400" />
      <HealthPill status={to} />
    </span>
  );
}

/** Mô tả yêu cầu khám (giữ xuống dòng). */
export function RequestText({ text, compact = false }: { text: string; compact?: boolean }) {
  return <p className={cn('whitespace-pre-line text-sm text-gray-700', compact && 'line-clamp-2')}>{text || '—'}</p>;
}

/** "Groom báo · Nguyễn Văn Bình · 2 giờ trước". */
export function RequestMeta({ request, people, showUrgent = true }: { request: ExamRequest; people: People; showUrgent?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
      {showUrgent && request.urgent && <UrgentPill urgent />}
      <span className="font-medium text-gray-700">{requestSourceLabel[request.source]}</span>
      <span>· {request.requestedBySystem ? 'Hệ thống' : people.name(request.requestedBy)}</span>
      <span title={formatDateTime(request.createdAt)}>· {formatRelative(request.createdAt, now())}</span>
    </span>
  );
}

/**
 * Hạn khám định kỳ — một nhãn: còn hạn xám · sắp đến hạn hổ phách · quá hạn tới 7 ngày hổ phách ·
 * quá hạn hơn 7 ngày đỏ (mốc bác sĩ và quản lý nhận thông báo).
 */
export function CheckupDue({ status, daysLeft }: { status: CheckupDueStatus; daysLeft: number }) {
  if (status === 'OVERDUE' && daysLeft >= -7) return <Pill tone="amber">{`Quá hạn ${-daysLeft} ngày`}</Pill>;
  return <CheckupPill status={status} daysLeft={daysLeft} />;
}

/** Dòng giải thích nhỏ, chữ xám. */
export function Quiet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-xs text-gray-500', className)}>{children}</p>;
}
