// Sơ đồ một khu chuồng: lưới 3×3 ô, mỗi ô có vạch màu bên trái theo tình trạng ngựa,
// rê chuột vào ô thì hiện thẻ nhỏ thông tin ngựa. Dùng ở Sơ đồ chuồng (cỡ full), Tổng quan và
// Bảng điều khiển y tế (cỡ compact). Luôn vẽ đủ 9 chỗ; chỗ chưa có ô vẽ mờ, CM bấm để thêm ô.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Eye, FolderOpen, Lock, Maximize2, Plus, ShieldAlert, UserRound, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import type { BarnListItem } from '../../../api/types';
import { ActionMenu, Avatar, Tip, cn, type MenuAction } from '../../../components/ui';
import { HealthPill, ZoneStatusPill } from '../../../components/ui/status';
import { healthLabel } from '../../../lib/labels';
import { MAX_STALLS_PER_BARN, barnBlocker, occupantBarClass, occupantStatusText, type StallOccupant, type ZoneCell } from './barn';

export type ZoneSize = 'full' | 'compact';

const STRIPES = 'bg-[repeating-linear-gradient(135deg,rgba(17,24,39,0.05)_0_6px,transparent_6px_12px)]';

/** Thẻ nhỏ hiện khi rê chuột vào ô có ngựa. */
function OccupantTip({ occupant, stallCode, zoneName, hint }: { occupant: StallOccupant; stallCode: string; zoneName: string; hint?: string }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar src={occupant.photoUrl ?? undefined} name={occupant.name} size={36} className="rounded-lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{occupant.name}</p>
          <p className="text-xs text-gray-500">
            <span className="font-mono">{stallCode}</span> · {zoneName}
          </p>
        </div>
      </div>
      <div className="space-y-1 text-xs">
        {occupant.retired ? <p className="text-gray-500">Đã giải nghệ</p> : <HealthPill status={occupant.healthStatus} className="text-xs" />}
        {occupant.locked && (
          <p className="flex items-center gap-1.5 font-medium text-red-700">
            <Lock size={12} /> Đang khóa huấn luyện
          </p>
        )}
        {occupant.openCase && (
          <p className="flex items-start gap-1.5 text-gray-700">
            <FolderOpen size={12} className="mt-0.5 shrink-0 text-gray-400" /> {occupant.openCase}
          </p>
        )}
      </div>
      {hint && <p className="border-t border-gray-100 pt-2 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

/** Một chỗ trong lưới: ô có ngựa, ô trống, ô bảo trì hoặc chỗ chưa có ô. */
function Slot({
  cell,
  size,
  zoneName,
  menu = [],
  to,
  onAdd,
  emptyLabel,
}: {
  cell?: ZoneCell;
  size: ZoneSize;
  zoneName: string;
  menu?: MenuAction[];
  /** Bấm ô có ngựa thì sang trang này (khi không có menu). */
  to?: string;
  /** Chỗ chưa có ô: CM bấm để thêm ô. */
  onAdd?: () => void;
  emptyLabel?: string;
}) {
  const full = size === 'full';
  const height = full ? 'h-24' : 'h-14';
  const base = cn('relative flex w-full flex-col justify-between overflow-hidden rounded-xl border text-left transition', height, full ? 'px-3 py-2.5 pl-4' : 'px-2 py-1.5 pl-3');

  // Chỗ chưa có ô (khu dưới 9 ô).
  if (!cell) {
    if (!onAdd) return <div className={cn(base, 'border-dashed border-gray-200/80 bg-transparent')} aria-hidden />;
    return (
      <button
        type="button"
        onClick={onAdd}
        className={cn(base, 'items-center justify-center border-dashed border-gray-200 bg-transparent text-gray-400 hover:border-emerald-500 hover:bg-white hover:text-emerald-700')}
      >
        <span className="flex items-center gap-1 text-xs font-medium">
          <Plus size={13} /> {full ? 'Thêm ô' : ''}
        </span>
      </button>
    );
  }

  const { stall, occupant } = cell;
  const code = <span className={cn('font-mono font-semibold text-gray-500', full ? 'text-xs' : 'text-[10px]')}>{stall.code}</span>;

  if (stall.status === 'MAINTENANCE') {
    const body = (
      <button type="button" disabled={menu.length === 0} className={cn(base, 'border-dashed border-gray-300 bg-white/60 disabled:cursor-default', STRIPES)}>
        {code}
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <Wrench size={11} className="text-gray-400" /> Bảo trì
        </span>
      </button>
    );
    const tip = stall.description ? `Bảo trì: ${stall.description}` : 'Ô đang bảo trì';
    return menu.length ? <ActionMenu items={menu} trigger={body} align="start" tip={tip} /> : <Tip content={tip}>{body}</Tip>;
  }

  if (!occupant) {
    const actionable = menu.length > 0;
    const body = (
      <button
        type="button"
        disabled={!actionable}
        className={cn(
          base,
          'border-dashed bg-white/50',
          cell.filtered ? 'border-gray-200 opacity-40' : 'border-gray-300',
          actionable ? 'hover:border-emerald-500 hover:bg-white' : 'cursor-default',
        )}
      >
        {code}
        <span className={cn('truncate', full ? 'text-xs' : 'text-[10px]', actionable ? 'font-medium text-emerald-700' : 'text-gray-400')}>
          {cell.filtered ? 'Có ngựa' : (emptyLabel ?? 'Trống')}
        </span>
      </button>
    );
    return actionable ? <ActionMenu items={menu} trigger={body} align="start" /> : body;
  }

  const tile = (
    <span className={cn(base, 'border-gray-200 bg-white shadow-[0_1px_2px_rgba(20,30,25,0.04)] hover:border-gray-300 hover:shadow-[0_10px_24px_-16px_rgba(6,78,59,0.45)]')}>
      <span className={cn('absolute bottom-2 left-1.5 top-2 w-1 rounded-full', full && 'w-1.5', occupantBarClass(occupant))} aria-hidden />
      <span className="flex items-center justify-between gap-1">
        {code}
        <span className="flex items-center gap-1">
          {occupant.openCase && <FolderOpen size={full ? 12 : 10} className="text-gray-400" />}
          {occupant.locked && <Lock size={full ? 12 : 10} className="text-red-600" />}
        </span>
      </span>
      {full ? (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar src={occupant.photoUrl ?? undefined} name={occupant.name} size={28} className="rounded-lg max-sm:hidden" />
          <span className="min-w-0">
            <span className={cn('block truncate text-sm font-semibold', occupant.retired ? 'text-gray-500' : 'text-gray-900')}>{occupant.name}</span>
            <span className="block truncate text-[11px] text-gray-500">{occupantStatusText(occupant)}</span>
          </span>
        </span>
      ) : (
        <span className={cn('block truncate text-xs font-semibold', occupant.retired ? 'text-gray-500' : 'text-gray-900')}>{occupant.name}</span>
      )}
    </span>
  );

  if (menu.length) {
    const tip = <OccupantTip occupant={occupant} stallCode={stall.code} zoneName={zoneName} hint="Bấm để xem thao tác" />;
    return <ActionMenu items={menu} trigger={<button type="button" className="block w-full text-left">{tile}</button>} align="start" tip={tip} tipVariant="card" />;
  }
  const tip = <OccupantTip occupant={occupant} stallCode={stall.code} zoneName={zoneName} hint={to ? 'Bấm để mở hồ sơ' : undefined} />;
  return (
    <Tip content={tip} variant="card">
      {to ? (
        <Link to={to} className="block">
          {tile}
        </Link>
      ) : (
        <span className="block">{tile}</span>
      )}
    </Tip>
  );
}

/** Chú thích màu vạch của ô. */
export function ZoneLegend({ className = '' }: { className?: string }) {
  const items: [string, string][] = [
    ['bg-emerald-500', 'Bình thường'],
    ['bg-amber-500', healthLabel.UNDER_OBSERVATION],
    ['bg-red-500', `${healthLabel.INJURED} / khóa huấn luyện`],
    ['border-2 border-red-500 bg-white', healthLabel.QUARANTINED],
    ['bg-gray-300', 'Đã giải nghệ'],
  ];
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500', className)}>
      {items.map(([bar, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={cn('h-3.5 w-1.5 rounded-full', bar)} /> {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className={cn('h-3.5 w-3.5 rounded border border-dashed border-gray-300', STRIPES)} /> Bảo trì
      </span>
    </div>
  );
}

export interface ZoneBoardProps {
  barn: BarnListItem;
  cells: ZoneCell[];
  size?: ZoneSize;
  /** Khu người xem phụ trách. */
  mine?: boolean;
  /** Khu cách ly (mọi ô là ô cách ly). */
  isolation?: boolean;
  /** Người xem chỉ xem được khu này (HT xem khu cách ly của HT khác). */
  readOnly?: boolean;
  /** Menu ⋯ của khu (CM). */
  zoneMenu?: MenuAction[];
  /** Menu khi bấm một ô. */
  cellMenu?: (cell: ZoneCell) => MenuAction[];
  /** Link khi bấm ô có ngựa (dùng khi không có cellMenu). */
  cellLink?: (cell: ZoneCell) => string | undefined;
  /** Chữ cho ô trống bấm được, ví dụ "Trống · bấm để xếp". */
  emptyLabel?: (cell: ZoneCell) => string | undefined;
  /** CM bấm chỗ chưa có ô để thêm ô. */
  onAddStall?: () => void;
  /** Tiêu đề khu bấm được (ví dụ từ Tổng quan sang Sơ đồ chuồng). */
  titleTo?: string;
  /** Có thì tiêu đề và nút phóng to mở chế độ xem riêng khu này. */
  onExpand?: () => void;
  /** Nền dùng chung với chế độ phóng to để chạy hiệu ứng mở rộng (motion layoutId). */
  layoutId?: string;
  /** Nội dung dưới lưới: ngựa chờ xếp ô, mô tả khu. */
  footer?: ReactNode;
  /** Nhấn mạnh viền (mở từ link ?zone=). */
  highlight?: boolean;
  /** `nested`: nằm trong một thẻ khác (Tổng quan) — nền xám nhạt, không đổ bóng. */
  variant?: 'card' | 'nested';
  className?: string;
  id?: string;
}

/** Nhãn nhỏ cạnh tên khu. */
export function ZoneTags({ mine, isolation, readOnly, inactive, status }: { mine?: boolean; isolation?: boolean; readOnly?: boolean; inactive?: boolean; status: BarnListItem['status'] }) {
  return (
    <>
      {inactive && <ZoneStatusPill status={status} />}
      {mine && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">Khu của bạn</span>}
      {isolation && (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
          <ShieldAlert size={11} /> Khu cách ly
        </span>
      )}
      {readOnly && (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
          <Eye size={11} /> Chỉ xem
        </span>
      )}
    </>
  );
}

export function ZoneBoard({
  barn,
  cells,
  size = 'full',
  mine,
  isolation,
  readOnly,
  zoneMenu = [],
  cellMenu,
  cellLink,
  emptyLabel,
  onAddStall,
  titleTo,
  onExpand,
  layoutId,
  footer,
  highlight,
  variant = 'card',
  className = '',
  id,
}: ZoneBoardProps) {
  const full = size === 'full';
  const blocker = barnBlocker(barn);
  const inactive = barn.status !== 'ACTIVE';
  const slotCount = Math.max(MAX_STALLS_PER_BARN, Math.ceil(cells.length / 3) * 3);
  const slots = Array.from({ length: slotCount }, (_, index) => cells[index]);
  const occupied = cells.filter((cell) => cell.occupant || cell.filtered).length;
  const titleText = <span className={cn('font-bold tracking-tight text-gray-900', full ? 'text-xl' : 'text-base')}>{barn.name}</span>;
  const title = onExpand ? (
    <button type="button" onClick={onExpand} className="rounded-md text-left decoration-emerald-600/40 underline-offset-4 hover:underline">
      {titleText}
    </button>
  ) : titleTo ? (
    <Link to={titleTo} className="hover:underline">
      {titleText}
    </Link>
  ) : (
    titleText
  );
  const surface = cn(
    'rounded-2xl ring-1',
    variant === 'nested' ? 'bg-gray-50/70' : 'bg-white',
    inactive
      ? 'ring-amber-200 shadow-[inset_3px_0_0_0_#f59e0b]'
      : variant === 'nested'
        ? 'ring-gray-200/60'
        : 'ring-gray-200/80 shadow-[0_12px_30px_-24px_rgba(6,78,59,0.4)]',
    highlight && 'ring-2 ring-emerald-500',
  );

  return (
    <section id={id} className={cn('relative transition-shadow', !layoutId && surface, full ? 'p-4 sm:p-5' : 'p-3.5', className)}>
      {layoutId && <motion.div layoutId={layoutId} className={cn('absolute inset-0', surface)} transition={{ type: 'spring', bounce: 0.12, duration: 0.5 }} aria-hidden />}
      <div className="relative flex flex-col flex-1">
        <header className={cn('flex items-start justify-between gap-3', full ? 'mb-4' : 'mb-3')}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {title}
              <ZoneTags mine={mine} isolation={isolation} readOnly={readOnly} inactive={inactive} status={barn.status} />
            </div>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
              <UserRound size={12} className="shrink-0 text-gray-400" />
              {barn.headTrainerFullName ? `HT ${barn.headTrainerFullName}` : 'Chưa có HT phụ trách'}
              {barn.headTrainerId && !barn.hasActiveHeadTrainer ? ' (không còn hoạt động)' : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <div className="text-right">
              <p className={cn('font-semibold tabular-nums', full ? 'text-lg' : 'text-sm', blocker && !inactive ? 'text-amber-700' : 'text-gray-900')}>
                {occupied}/{cells.length}
              </p>
              <p className="text-[11px] text-gray-500">{blocker ? (inactive ? 'không nhận ngựa' : 'hết chỗ nhận') : `còn nhận ${barn.availableStallCount}`}</p>
            </div>
            {onExpand && (
              <Tip content="Phóng to khu">
                <button
                  type="button"
                  onClick={onExpand}
                  aria-label={`Phóng to ${barn.name}`}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Maximize2 size={16} />
                </button>
              </Tip>
            )}
            {zoneMenu.length > 0 && <ActionMenu items={zoneMenu} />}
          </div>
        </header>

        <div className={cn('grid grid-cols-3', full ? 'gap-2.5' : 'gap-1.5')}>
          {slots.map((cell, index) => (
            <Slot
              key={cell?.stall.id ?? `slot-${index}`}
              cell={cell}
              size={size}
              zoneName={barn.name}
              menu={cell ? cellMenu?.(cell) : undefined}
              to={cell ? cellLink?.(cell) : undefined}
              emptyLabel={cell ? emptyLabel?.(cell) : undefined}
              // Chỉ chỗ trống đầu tiên hiện "Thêm ô" để lưới không rối.
              onAdd={!cell && index === cells.length && cells.length < MAX_STALLS_PER_BARN ? onAddStall : undefined}
            />
          ))}
        </div>

        <div className="mt-auto">
          {footer && <div className={cn('border-t border-gray-100', full ? 'mt-4 pt-3' : 'mt-3 pt-2.5')}>{footer}</div>}
        </div>
      </div>
    </section>
  );
}
