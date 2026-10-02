// Chế độ phóng to một khu: header xanh rừng, lưới 3 cột ô lớn có ảnh ngựa, tình trạng, Groom,
// khóa huấn luyện và chẩn đoán bệnh án đang mở. Quyền thao tác giữ nguyên như lưới thường
// (cùng cellMenu / cellLink), khu chỉ xem thì không có thao tác.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { FolderOpen, Lock, Minimize2, Plus, UserRound, Wrench } from 'lucide-react';
import type { BarnListItem } from '../../../api/types';
import { ActionMenu, cn, type MenuAction } from '../../../components/ui';
import { HealthPill, ZoneStatusPill } from '../../../components/ui/status';
import { TurfPlaceholder } from '../../../components/TurfPlaceholder';
import { MAX_STALLS_PER_BARN, barnBlocker, occupantBarClass, type ZoneCell } from './barn';
import type { OccupantDetail } from './zone-detail';

const STRIPES = 'bg-[repeating-linear-gradient(135deg,rgba(17,24,39,0.05)_0_8px,transparent_8px_16px)]';

/** Ảnh ngựa trong ô lớn: hiện dần khi tải xong, lỗi thì về họa tiết sọc cỏ. */
function CellPhoto({ src, name }: { src?: string | null; name: string }) {
  const [state, setState] = useState<{ src?: string | null; status: 'loading' | 'loaded' | 'failed' }>({ src, status: 'loading' });
  const status = state.src === src ? state.status : 'loading';
  if (state.src !== src) setState({ src, status: 'loading' });
  return (
    <div className="relative aspect-[16/10] overflow-hidden">
      <TurfPlaceholder name={name} size="sm" className="absolute inset-0" />
      {src && status !== 'failed' && (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setState({ src, status: 'loaded' })}
          onError={() => setState({ src, status: 'failed' })}
          className={cn('absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]', status === 'loaded' ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  );
}

function Bone({ className }: { className?: string }) {
  return <span className={cn('skeleton inline-block h-3 rounded', className)} />;
}

function FocusSlot({
  cell,
  detail,
  detailLoading,
  menu = [],
  to,
  emptyLabel,
  onAdd,
}: {
  cell?: ZoneCell;
  detail?: OccupantDetail;
  detailLoading?: boolean;
  menu?: MenuAction[];
  to?: string;
  emptyLabel?: string;
  onAdd?: () => void;
}) {
  const shell = 'flex h-full min-h-56 w-full flex-col overflow-hidden rounded-2xl border text-left transition';
  if (!cell) {
    if (!onAdd) return <div className={cn(shell, 'border-dashed border-gray-200/80 bg-transparent')} aria-hidden />;
    return (
      <button type="button" onClick={onAdd} className={cn(shell, 'items-center justify-center border-dashed border-gray-300 text-sm font-medium text-gray-400 hover:border-emerald-500 hover:bg-white hover:text-emerald-700')}>
        <Plus size={18} /> Thêm ô
      </button>
    );
  }
  const { stall, occupant } = cell;
  const tag = <span className="saddle-tag text-xs">{stall.code}</span>;

  if (stall.status === 'MAINTENANCE' || !occupant) {
    const maintenance = stall.status === 'MAINTENANCE';
    const actionable = menu.length > 0;
    const body = (
      <button
        type="button"
        disabled={!actionable}
        className={cn(
          shell,
          'items-start justify-between border-dashed p-4',
          maintenance ? cn('border-gray-300 bg-white/60', STRIPES) : 'border-gray-300 bg-white/50',
          actionable ? 'hover:border-emerald-500 hover:bg-white' : 'cursor-default',
        )}
      >
        {tag}
        <span className={cn('flex items-center gap-1.5 text-sm', actionable ? 'font-medium text-emerald-700' : 'text-gray-400')}>
          {maintenance ? (
            <>
              <Wrench size={14} /> Bảo trì{stall.description ? ` · ${stall.description}` : ''}
            </>
          ) : cell.filtered ? (
            'Có ngựa'
          ) : (
            (emptyLabel ?? 'Ô trống')
          )}
        </span>
      </button>
    );
    return actionable ? <ActionMenu items={menu} trigger={body} align="start" /> : body;
  }

  const locked = detail?.locked ?? occupant.locked;
  const openCase = detail?.openCase ?? occupant.openCase;
  const card = (
    <span className={cn(shell, 'group border-gray-200 bg-white shadow-[0_1px_2px_rgba(20,30,25,0.04)] hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_22px_40px_-26px_rgba(6,78,59,0.55)]')}>
      <span className="relative block">
        <CellPhoto src={occupant.photoUrl} name={occupant.name} />
        <span className="absolute left-2.5 top-2.5">{tag}</span>
        <span className="absolute right-2.5 top-2.5 flex gap-1">
          {openCase && (
            <span className="rounded-md bg-white/90 p-1 text-gray-600 shadow-sm" title="Có bệnh án đang mở">
              <FolderOpen size={13} />
            </span>
          )}
          {locked && (
            <span className="rounded-md bg-red-600 p-1 text-white shadow-sm" title="Khóa huấn luyện">
              <Lock size={13} />
            </span>
          )}
        </span>
        <span className={cn('absolute inset-x-0 bottom-0 h-1', occupantBarClass(occupant))} aria-hidden />
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3.5">
        <span className={cn('truncate text-base font-semibold', occupant.retired ? 'text-gray-500' : 'text-gray-900')}>{occupant.name}</span>
        {occupant.retired ? <span className="text-[13px] text-gray-500">Đã giải nghệ</span> : <HealthPill status={occupant.healthStatus} />}
        <span className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-gray-500">
          <UserRound size={12} className="shrink-0 text-gray-400" />
          {detailLoading && !detail ? <Bone className="w-24" /> : detail?.groomName ? `Groom ${detail.groomName}` : <span className="text-amber-700">Chưa có Groom</span>}
        </span>
        {locked && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-700">
            <Lock size={12} /> Đang khóa huấn luyện
          </span>
        )}
        {openCase && <span className="line-clamp-2 text-xs text-gray-600">Bệnh án: {openCase}</span>}
      </span>
    </span>
  );
  if (menu.length) return <ActionMenu items={menu} trigger={<button type="button" className="block w-full text-left">{card}</button>} align="start" />;
  if (to)
    return (
      <Link to={to} className="block">
        {card}
      </Link>
    );
  return card;
}

export interface ZoneFocusProps {
  barn: BarnListItem;
  cells: ZoneCell[];
  mine?: boolean;
  isolation?: boolean;
  readOnly?: boolean;
  layoutId: string;
  detail?: Map<string, OccupantDetail>;
  detailLoading?: boolean;
  zoneMenu?: MenuAction[];
  cellMenu?: (cell: ZoneCell) => MenuAction[];
  cellLink?: (cell: ZoneCell) => string | undefined;
  emptyLabel?: (cell: ZoneCell) => string | undefined;
  onAddStall?: () => void;
  footer?: ReactNode;
  onClose: () => void;
}

export function ZoneFocus({
  barn,
  cells,
  mine,
  isolation,
  readOnly,
  layoutId,
  detail,
  detailLoading,
  zoneMenu = [],
  cellMenu,
  cellLink,
  emptyLabel,
  onAddStall,
  footer,
  onClose,
}: ZoneFocusProps) {
  const inactive = barn.status !== 'ACTIVE';
  const blocker = barnBlocker(barn);
  const occupied = cells.filter((cell) => cell.occupant || cell.filtered).length;
  const slotCount = Math.max(MAX_STALLS_PER_BARN, Math.ceil(cells.length / 3) * 3);
  const slots = Array.from({ length: slotCount }, (_, index) => cells[index]);
  const ratio = cells.length ? occupied / cells.length : 0;

  return (
    <section className="relative" aria-label={`Khu ${barn.name} phóng to`}>
      <motion.div
        layoutId={layoutId}
        className="absolute inset-0 rounded-3xl bg-white shadow-[0_30px_70px_-40px_rgba(6,78,59,0.55)] ring-1 ring-gray-200/80"
        transition={{ type: 'spring', bounce: 0.12, duration: 0.5 }}
        aria-hidden
      />
      <motion.div className="relative" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.3 }}>
        <header className="turf-soft relative overflow-hidden rounded-t-3xl border-b border-emerald-900/6 px-5 pb-5 pt-5 text-gray-900 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-bold tracking-tight">{barn.name}</h2>
                {inactive && <ZoneStatusPill status={barn.status} />}
                {mine && <span className="tint-emerald rounded-md px-2 py-0.5 text-xs font-medium">Khu của bạn</span>}
                {isolation && <span className="tint-red rounded-md px-2 py-0.5 text-xs font-medium">Khu cách ly</span>}
                {readOnly && <span className="tint-gray rounded-md px-2 py-0.5 text-xs font-medium">Chỉ xem</span>}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                <UserRound size={14} /> {barn.headTrainerFullName ? `HT ${barn.headTrainerFullName}` : 'Chưa có HT phụ trách'}
                {barn.description ? <span className="text-gray-400">· {barn.description}</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {zoneMenu.length > 0 && (
                <ActionMenu
                  items={zoneMenu}
                  trigger={
                    <button type="button" className="rounded-xl bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition hover:bg-white">
                      Quản lý khu
                    </button>
                  }
                />
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_-14px_rgba(4,120,87,0.9)] transition hover:bg-emerald-600"
              >
                <Minimize2 size={15} /> Thu nhỏ <kbd className="rounded bg-white/15 px-1 font-mono text-[10px] text-white/80">Esc</kbd>
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-4xl font-bold tabular-nums leading-none">
                {occupied}
                <span className="text-xl font-semibold text-gray-400">/{cells.length}</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">ô có ngựa</p>
            </div>
            <div className="min-w-48 flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-emerald-900/8">
                <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${ratio * 100}%` }} transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }} />
              </div>
              <p className={cn('mt-1.5 text-xs', blocker && !inactive ? 'font-medium text-amber-700' : 'text-gray-500')}>
                {blocker ?? `Còn nhận ${barn.availableStallCount} ngựa`}
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          {slots.map((cell, index) => (
            <motion.div key={cell?.stall.id ?? `slot-${index}`} className="h-full" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 + index * 0.035, duration: 0.3 }}>
              <FocusSlot
                cell={cell}
                detail={cell?.occupant ? detail?.get(cell.occupant.id) : undefined}
                detailLoading={detailLoading}
                menu={cell ? cellMenu?.(cell) : undefined}
                to={cell ? cellLink?.(cell) : undefined}
                emptyLabel={cell ? emptyLabel?.(cell) : undefined}
                onAdd={!cell && index === cells.length && cells.length < MAX_STALLS_PER_BARN ? onAddStall : undefined}
              />
            </motion.div>
          ))}
        </div>
        {footer && <div className="border-t border-gray-100 px-4 py-4 sm:px-6">{footer}</div>}
      </motion.div>
    </section>
  );
}
