// Mảnh giao diện nhỏ dùng lại giữa các màn hình y tế.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing } from 'lucide-react';
import { Avatar, Dot, cn } from '../../../components/ui';
import { HealthPill, healthDot } from '../../../components/ui/status';
import { healthHint, healthLabel, lifecycleLabel } from '../../../lib/labels';
import { links } from '../../../lib/links';
import type { HealthStatus } from '../../../types/domain';
import type { MedHorseRef, PeriodicRowState } from '../../../services/medical.service';
import { HEALTH_ORDER, dueText, periodicText } from './utils';

/** Ảnh + tên ngựa, bấm để sang tab Y tế trong hồ sơ. */
export function HorseChip({
  horse,
  size = 36,
  sub,
  tab = 'medical',
  plain = false,
}: {
  horse: Pick<MedHorseRef, 'id' | 'name' | 'avatar'> & Partial<MedHorseRef>;
  size?: number;
  sub?: ReactNode;
  tab?: string;
  /** Không bọc link (dùng trong hàng bảng đã bấm được). */
  plain?: boolean;
}) {
  const meta =
    sub ??
    ([horse.zoneName, horse.stallCode].filter(Boolean).join(' · ') ||
      (horse.lifecycleStatus && horse.lifecycleStatus !== 'ACTIVE' ? lifecycleLabel[horse.lifecycleStatus] : ''));
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar src={horse.avatar} name={horse.name} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-gray-900">{horse.name}</span>
        {meta && <span className="block truncate text-xs text-gray-500">{meta}</span>}
      </span>
    </span>
  );
  if (plain) return body;
  return (
    <Link
      to={links.horse(horse.id, tab)}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-w-0 rounded-xl transition hover:opacity-80"
    >
      {body}
    </Link>
  );
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
export function HealthShift({ from, to }: { from: HealthStatus; to: HealthStatus }) {
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

/** Mô tả yêu cầu khám (có thể gộp nhiều dòng). */
export function RequestLines({ lines, compact = false }: { lines: string[]; compact?: boolean }) {
  if (lines.length <= 1) {
    return <p className={cn('text-sm text-gray-700', compact && 'line-clamp-2')}>{lines[0] ?? '—'}</p>;
  }
  return (
    <ul className="space-y-0.5 text-sm text-gray-700">
      {lines.map((line, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-300" />
          <span className={cn(compact && 'line-clamp-1')}>{line}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tình trạng khám định kỳ — MỘT nhãn chữ mỗi dòng:
 * đúng hạn xám · sắp tới hạn / quá hạn hổ phách · quá hạn > 7 ngày đỏ (kèm chuông nếu đã cảnh báo).
 */
export function PeriodicPill({
  state,
  label,
  overdueDays,
  alerted,
}: {
  state: PeriodicRowState;
  label: string;
  overdueDays: number;
  alerted?: boolean;
}) {
  const text =
    state === 'OVERDUE' || state === 'OVERDUE_ALERT'
      ? overdueDays > 0
        ? `Quá hạn ${overdueDays} ngày`
        : label
      : `${label} · ${dueText(overdueDays).toLowerCase()}`;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]', state !== 'OK' && 'font-medium', periodicText[state])}
      title={alerted ? 'Đã gửi cảnh báo cho bác sĩ và quản lý' : undefined}
    >
      {text}
      {alerted && <BellRing size={12} aria-label="đã cảnh báo" />}
    </span>
  );
}
