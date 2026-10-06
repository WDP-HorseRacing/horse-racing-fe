// Sơ đồ chuồng (gộp cả danh mục khu và ô). Cột trái: tổng quan, các danh sách chờ xếp chỗ, ngựa cần chú ý,
// khu cần xử lý. Cột phải: mỗi khu một thẻ lưới 3×3 ô, rê chuột vào ô để xem ngựa, bấm ô để thao tác.
// CM: xếp/đổi khu (F1.6), quản lý khu và ô. HT của khu: xếp ô, chuyển ô, gỡ ô, giao/đổi Groom (F1.7).
// HT chỉ thấy khu mình phụ trách và khu cách ly (khu cách ly của HT khác chỉ xem). Bấm tên khu để phóng to (?focus=).
// Dữ liệu ghép từ /barns, /stalls và /horses (ô có ngựa xác định qua location.stall.id).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGroup } from 'motion/react';
import { AlertTriangle, Building2, Plus, UserMinus, Warehouse } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { listAllHorses } from '../../api/horses';
import { deleteBarn, deleteStall, listBarns, listStalls, updateStall } from '../../api/stable';
import { listAllUsers } from '../../api/users';
import type { BarnListItem, HorseListItem, Stall } from '../../api/types';
import { useStore } from '../../store/store';
import type { User } from '../../types/domain';
import { canManageBarn, canSeeBarn, computeZoneScope } from '../../lib/zone-scope';
import { primeZoneScope } from '../../hooks/useMyScope';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, ErrorBox, PageHeader, SectionTitle, cn, useToast, type MenuAction } from '../../components/ui';
import { StableMapSkeleton } from '../../components/skeletons';
import { healthLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { AssignStallDialog, AssignZoneDialog, GroomDialog, RemoveStallDialog, type PlacementHorse } from './components/PlacementDialogs';
import { AddStallsDialog, HeadTrainerDialog, MaintenanceDialog, UnassignTrainerDialog, ZoneFormDialog, ZoneStatusDialog } from './components/ZoneDialogs';
import { barnBlocker, buildCells, isLockedHorse, occupantsByStall, stallFullReason, type ZoneCell } from './components/barn';
import { ZoneBoard, ZoneLegend } from './components/ZoneBoard';
import { ZoneFocus } from './components/ZoneFocus';
import { loadZoneDetail } from './components/zone-detail';
import { isReadOnlyHorse } from '../../lib/horse-rules';

interface MapZone {
  barn: BarnListItem;
  stalls: Stall[];
  cells: ZoneCell[];
  horseByStall: Map<string, HorseListItem>;
  waitingStall: HorseListItem[];
  horseCount: number;
  /** Người xem là HT phụ trách khu này. */
  canManage: boolean;
  /** Khu cách ly (mọi ô là ô cách ly). */
  isolation: boolean;
  /** HT xem khu cách ly không do mình phụ trách: chỉ xem, không thao tác. */
  readOnly: boolean;
}

async function loadMap(user: User | null, isManager: boolean) {
  const [barns, stalls, horses, headTrainers] = await Promise.all([
    listBarns(),
    listStalls(),
    listAllHorses(),
    isManager ? listAllUsers({ role: 'HEAD_TRAINER', status: 'ACTIVE' }) : Promise.resolve([]),
  ]);
  // HT chỉ thấy khu mình phụ trách và khu cách ly; các vai trò khác thấy toàn câu lạc bộ.
  const scope = computeZoneScope(user, barns, stalls);
  if (user && scope.trainer) primeZoneScope(user.id, barns, stalls);
  const inClub = horses.filter((horse) => !isReadOnlyHorse(horse));
  const occupants = occupantsByStall(inClub);
  const horseByStall = new Map(inClub.filter((horse) => horse.location.stall?.id).map((horse) => [horse.location.stall!.id!, horse]));
  const zones: MapZone[] = barns
    .filter((barn) => canSeeBarn(scope, barn.id))
    .map((barn) => {
      const canManage = canManageBarn(scope, barn.id);
      const horsesOfBarn = inClub.filter((horse) => horse.location.barn?.id === barn.id);
      return {
        barn,
        stalls: stalls.filter((stall) => stall.barnId === barn.id),
        cells: buildCells(barn.id, stalls, occupants),
        horseByStall,
        waitingStall: horsesOfBarn.filter((horse) => horse.location.placementStatus === 'PENDING_STALL'),
        horseCount: horsesOfBarn.length,
        canManage,
        isolation: scope.isolationBarnIds.has(barn.id),
        readOnly: scope.trainer && !canManage,
      };
    })
    .sort(
      (a, b) =>
        Number(b.canManage) - Number(a.canManage) ||
        Number(a.isolation) - Number(b.isolation) ||
        a.barn.name.localeCompare(b.barn.name, 'vi', { numeric: true }),
    );
  // "Chờ xếp khu" là việc của CM: HT không cần thấy.
  const noZone = scope.trainer ? [] : inClub.filter((horse) => horse.location.placementStatus === 'PENDING_BARN');
  return { zones, noZone, stalls: stalls.filter((stall) => canSeeBarn(scope, stall.barnId)), barns, headTrainers, trainer: scope.trainer };
}

function toPlacement(horse: HorseListItem): PlacementHorse {
  return {
    id: horse.id,
    name: horse.name,
    barnId: horse.location.barn?.id,
    barnName: horse.location.barn?.name,
    stallId: horse.location.stall?.id,
    stallCode: horse.location.stall?.code,
    placementStatus: horse.location.placementStatus,
    healthStatus: horse.healthStatus,
  };
}

function zoneDeleteBlockers(zone: MapZone): string[] {
  const list: string[] = [];
  if (zone.horseCount > 0) list.push(`Khu còn ${zone.horseCount} ngựa`);
  if (zone.stalls.length > 0) list.push(`Khu còn ${zone.stalls.length} ô — xóa hết ô trước`);
  return list;
}

/** Mức cần chú ý của ngựa trong ô: cách ly, chấn thương, khóa huấn luyện. */
function attentionOf(horse: HorseListItem): string | undefined {
  if (horse.lifecycleStatus !== 'ACTIVE') return undefined;
  if (horse.healthStatus === 'QUARANTINED' || horse.healthStatus === 'INJURED') return healthLabel[horse.healthStatus];
  if (isLockedHorse(horse)) return 'Khóa huấn luyện';
  return undefined;
}

function PersonRow({ horse, note, action, onOpen }: { horse: HorseListItem; note?: ReactNode; action?: ReactNode; onOpen?: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar src={horse.photoUrl ?? undefined} name={horse.name} size={32} className="rounded-lg" />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-gray-900 hover:underline">{horse.name}</p>
        <p className="truncate text-xs text-gray-500">{note ?? healthLabel[horse.healthStatus]}</p>
      </button>
      {action}
    </li>
  );
}

/** Số bên phải tiêu đề cột trái: > 0 thì hổ phách (có việc cần làm), = 0 thì xám nhạt. */
function Count({ value }: { value: number }) {
  return <span className={cn('text-sm tabular-nums', value > 0 ? 'font-semibold text-amber-700' : 'text-gray-400')}>{value}</span>;
}

function MiniStat({ value, label, warn }: { value: ReactNode; label: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className={cn('text-xl font-bold tabular-nums', warn ? 'text-amber-700' : 'text-gray-900')}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function StableMap() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const action = useAction();
  const [params, setParams] = useSearchParams();
  const user = useStore((state) => state.currentUser);
  const role = user?.role;
  const isOwner = role === 'HORSE_OWNER';
  const isManager = role === 'CLUB_MANAGER';
  const { data, loading, error, reload } = useService(
    () => (isOwner ? Promise.resolve(undefined) : loadMap(user, isManager)),
    [isOwner, user?.id, role, isManager],
  );

  // Hộp thoại xếp chỗ (F1.6, F1.7)
  const [zoneHorse, setZoneHorse] = useState<PlacementHorse | null>(null);
  const [stallTarget, setStallTarget] = useState<{ horse: PlacementHorse; preset?: string } | null>(null);
  const [groomHorse, setGroomHorse] = useState<PlacementHorse | null>(null);
  const [removeHorse, setRemoveHorse] = useState<PlacementHorse | null>(null);
  // Hộp thoại quản lý khu và ô (CM)
  const [formOpen, setFormOpen] = useState<{ zone?: BarnListItem } | null>(null);
  const [trainerZone, setTrainerZone] = useState<BarnListItem | null>(null);
  const [unassignZone, setUnassignZone] = useState<MapZone | null>(null);
  const [statusZone, setStatusZone] = useState<BarnListItem | null>(null);
  const [stallsZone, setStallsZone] = useState<MapZone | null>(null);
  const [deletingZone, setDeletingZone] = useState<MapZone | null>(null);
  const [maintStall, setMaintStall] = useState<Stall | null>(null);
  const [deletingStall, setDeletingStall] = useState<Stall | null>(null);

  // Mở từ Tổng quan với ?zone=<id>: cuộn tới khu đó và nhấn mạnh viền trong giây lát.
  const zoneParam = params.get('zone');
  // ?focus=<id>: phóng to một khu. Đẩy vào lịch sử để nút Back của trình duyệt thu nhỏ lại.
  const focusParam = params.get('focus');
  const focused = focusParam ? data?.zones.find((zone) => zone.barn.id === focusParam) : undefined;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const loaded = !!data;

  useEffect(() => {
    if (!zoneParam || !loaded) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`zone-${zoneParam}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlight(zoneParam);
    });
    const timer = window.setTimeout(() => setHighlight(null), 2600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [zoneParam, loaded]);

  const openFocus = (barnId: string) => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('focus', barnId);
        next.delete('zone');
        return next;
      },
      { state: { focusPushed: true } },
    );
  };
  const closeFocus = useCallback(() => {
    if (focusParam) setReturnTo(focusParam);
    if ((location.state as { focusPushed?: boolean } | null)?.focusPushed) {
      navigate(-1);
      return;
    }
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('focus');
        return next;
      },
      { replace: true },
    );
  }, [focusParam, location.state, navigate, setParams]);

  // Id khu phóng to không còn trong phạm vi xem (đường dẫn cũ, HT bị gỡ khu): bỏ tham số.
  useEffect(() => {
    if (focusParam && loaded && !focused) {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('focus');
          return next;
        },
        { replace: true },
      );
    }
  }, [focusParam, loaded, focused, setParams]);

  // Esc để thu nhỏ; hộp thoại / menu Radix đang mở tự chặn Esc (defaultPrevented).
  useEffect(() => {
    if (!focused) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeFocus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focused, closeFocus]);

  // Thu nhỏ xong: cuộn về khu vừa xem (sau khi hiệu ứng chạy xong) và nhấn mạnh viền.
  useEffect(() => {
    if (focusParam || !returnTo) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`zone-${returnTo}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlight(returnTo);
      setReturnTo(null);
    }, 520);
    const clear = window.setTimeout(() => setHighlight(null), 2600);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clear);
    };
  }, [focusParam, returnTo]);

  // Ô lớn khi phóng to cần Groom, khóa huấn luyện, bệnh án: tải riêng cho khu đang xem.
  const focusHorseIds = focused ? focused.cells.flatMap((cell) => (cell.occupant ? [cell.occupant.id] : [])) : [];
  const idsKey = focusHorseIds.join(',');
  const detail = useService(
    () => (focused ? loadZoneDetail(focused.barn.id, focusHorseIds, role !== 'GROOM') : Promise.resolve(undefined)),
    [focused?.barn.id, idsKey],
  );

  if (isOwner) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sơ đồ chuồng" />
        <EmptyState title="Sơ đồ chuồng dành cho nhân sự câu lạc bộ" hint="Bạn xem khu và ô của ngựa mình trong hồ sơ từng con ở mục Ngựa của tôi." />
      </div>
    );
  }
  if (loading && !data) return <StableMapSkeleton />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được sơ đồ chuồng'} />;

  const { zones, noZone, stalls, barns, headTrainers, trainer } = data;
  // HT: việc cần làm chỉ tính trong khu mình phụ trách (khu cách ly của HT khác chỉ để theo dõi).
  const workZones = trainer ? zones.filter((zone) => zone.canManage) : zones;
  const waitingStall = workZones.flatMap((zone) => zone.waitingStall.map((horse) => ({ zone, horse })));
  const attention = workZones.flatMap((zone) =>
    zone.cells.flatMap((cell) => {
      const horse = zone.horseByStall.get(cell.stall.id);
      const label = horse ? attentionOf(horse) : undefined;
      return horse && label ? [{ horse, label, code: cell.stall.code }] : [];
    }),
  );
  const pendingZones = zones.filter((zone) => barnBlocker(zone.barn));
  const statStalls = trainer ? stalls.filter((stall) => workZones.some((zone) => zone.barn.id === stall.barnId)) : stalls;
  const totals = {
    active: workZones.filter((zone) => zone.barn.status === 'ACTIVE').length,
    free: statStalls.filter((stall) => stall.status === 'AVAILABLE').length,
    maintenance: statStalls.filter((stall) => stall.status === 'MAINTENANCE').length,
    receiving: workZones.reduce((sum, zone) => sum + (barnBlocker(zone.barn) ? 0 : zone.barn.availableStallCount), 0),
    horses: workZones.reduce((sum, zone) => sum + zone.horseCount, 0),
  };
  const myZones = zones.filter((zone) => zone.canManage).map((zone) => zone.barn.name);
  const watchZones = zones.filter((zone) => zone.readOnly).map((zone) => zone.barn.name);

  const openHorse = (horse: HorseListItem) => navigate(links.horse(horse.id));

  const zoneMenu = (zone: MapZone): MenuAction[] => {
    if (!isManager) return [];
    const blockers = zoneDeleteBlockers(zone);
    // Không quá sức chứa của khu (BE chặn) và không quá 9 ô (lưới 3×3).
    const full = stallFullReason(zone.barn, zone.stalls.length);
    const items: MenuAction[] = [
      { label: 'Sửa tên, sức chứa, mô tả', onSelect: () => setFormOpen({ zone: zone.barn }) },
      { label: zone.barn.headTrainerId ? 'Đổi HT phụ trách' : 'Gán HT phụ trách', onSelect: () => setTrainerZone(zone.barn) },
      { label: 'Đổi trạng thái', onSelect: () => setStatusZone(zone.barn) },
      { label: full ? `Thêm ô (${full})` : 'Thêm ô', disabled: !!full, onSelect: () => setStallsZone(zone) },
    ];
    if (zone.barn.headTrainerId) {
      items.push({
        label: zone.horseCount ? `Gỡ HT phụ trách (khu còn ${zone.horseCount} ngựa)` : 'Gỡ HT phụ trách',
        icon: <UserMinus size={14} />,
        danger: true,
        disabled: zone.horseCount > 0,
        onSelect: () => setUnassignZone(zone),
      });
    }
    items.push({ label: blockers.length ? `Xóa khu (${blockers[0].toLowerCase()})` : 'Xóa khu', danger: true, onSelect: () => setDeletingZone(zone) });
    return items;
  };

  const cellMenu = (zone: MapZone) => (cell: ZoneCell): MenuAction[] => {
    const { stall } = cell;
    const horse = zone.horseByStall.get(stall.id);
    if (horse) {
      const items: MenuAction[] = [{ label: 'Mở hồ sơ ngựa', onSelect: () => openHorse(horse) }];
      if (zone.canManage) {
        items.push({ label: horse.healthStatus === 'QUARANTINED' ? 'Chuyển ô (tách đàn)' : 'Chuyển ô', onSelect: () => setStallTarget({ horse: toPlacement(horse) }) });
        items.push({ label: 'Giao / đổi Groom', onSelect: () => setGroomHorse(toPlacement(horse)) });
        items.push({ label: 'Gỡ khỏi ô', danger: true, onSelect: () => setRemoveHorse(toPlacement(horse)) });
      }
      if (isManager) items.push({ label: 'Đổi khu', onSelect: () => setZoneHorse(toPlacement(horse)) });
      return items;
    }
    if (stall.status === 'OCCUPIED') return [];
    const items: MenuAction[] = [];
    if (stall.status === 'AVAILABLE' && zone.canManage) {
      zone.waitingStall.forEach((item) => items.push({ label: `Xếp ${item.name} vào ô này`, onSelect: () => setStallTarget({ horse: toPlacement(item), preset: stall.id }) }));
    }
    if (isManager) {
      // Đưa một ô trống ra khỏi danh sách ô trống sẽ làm khu thiếu chỗ nếu đã hết chỗ nhận.
      const short = stall.status === 'AVAILABLE' && zone.barn.availableStallCount <= 0 && zone.barn.pendingStallHorseCount > 0;
      const shortReason = `khu sẽ thiếu ô cho ${zone.barn.pendingStallHorseCount} ngựa chờ xếp ô`;
      if (stall.status === 'MAINTENANCE') {
        items.push({
          label: 'Kết thúc bảo trì',
          onSelect: async () => {
            const done = await action.run(() => updateStall(stall.id, { status: 'AVAILABLE' }));
            if (done) {
              toast.push(`Ô ${stall.code} trở lại trống`, 'success');
              reload();
            }
          },
        });
      } else {
        items.push({ label: short ? `Chuyển sang bảo trì (${shortReason})` : 'Chuyển sang bảo trì', disabled: short, onSelect: () => setMaintStall(stall) });
      }
      items.push({ label: short ? `Xóa ô (${shortReason})` : 'Xóa ô', danger: true, disabled: short, onSelect: () => setDeletingStall(stall) });
    }
    return items;
  };

  /** Khu chỉ xem: bấm ô có ngựa thì mở hồ sơ, không có menu thao tác. */
  const readOnlyLink = (cell: ZoneCell) => (cell.occupant ? links.horse(cell.occupant.id) : undefined);

  const zoneFooter = (zone: MapZone) =>
    zone.waitingStall.length > 0 ? (
      <div className="space-y-1.5 text-sm">
        {zone.waitingStall.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-amber-800">Chờ xếp ô:</span>
            {zone.waitingStall.map((horse) =>
              zone.canManage ? (
                <button
                  key={horse.id}
                  type="button"
                  onClick={() => setStallTarget({ horse: toPlacement(horse) })}
                  className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200/70 transition hover:bg-amber-100"
                >
                  {horse.name} · Xếp ô
                </button>
              ) : (
                <span key={horse.id} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {horse.name}
                </span>
              ),
            )}
          </p>
        )}
      </div>
    ) : undefined;

  const description = trainer
    ? myZones.length
      ? `Bạn phụ trách ${myZones.join(', ')}${watchZones.length ? ` · theo dõi ${watchZones.join(', ')} (chỉ xem)` : ''}. Bấm tên khu để phóng to, bấm ô để thao tác.`
      : 'Bạn chưa được giao khu nào. Quản lý câu lạc bộ sẽ giao khu cho bạn.'
    : `${zones.length} khu · ${stalls.length} ô · ${totals.horses} ngựa thuộc khu. Bấm tên khu để phóng to, rê chuột vào ô để xem ngựa, bấm ô để thao tác.`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sơ đồ chuồng"
        description={description}
        actions={
          isManager && (
            <Button onClick={() => setFormOpen({})}>
              <Plus size={16} /> Thêm khu
            </Button>
          )
        }
      />

      {action.error && !deletingZone && <ErrorBox message={action.error} />}

      <LayoutGroup>
        {focused ? (
          <ZoneFocus
            barn={focused.barn}
            cells={focused.cells}
            mine={focused.canManage}
            isolation={focused.isolation}
            readOnly={focused.readOnly}
            layoutId={`zone-plate-${focused.barn.id}`}
            detail={detail.data}
            detailLoading={detail.loading}
            zoneMenu={zoneMenu(focused)}
            cellMenu={focused.readOnly ? undefined : cellMenu(focused)}
            cellLink={focused.readOnly ? readOnlyLink : undefined}
            emptyLabel={(cell) => (cell.stall.status === 'AVAILABLE' && focused.canManage && focused.waitingStall.length > 0 ? 'Trống · bấm để xếp ngựa' : undefined)}
            onAddStall={isManager && !stallFullReason(focused.barn, focused.stalls.length) ? () => setStallsZone(focused) : undefined}
            footer={zoneFooter(focused)}
            onClose={closeFocus}
          />
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-12">
            {/* ===== Cột trái ===== */}
            <aside className="space-y-4 rounded-3xl bg-emerald-50/40 p-4 ring-1 ring-emerald-900/5 lg:sticky lg:top-6 lg:col-span-4 xl:col-span-3">
              <Card className="border-none p-4 shadow-[0_4px_20px_-10px_rgba(4,120,87,0.1)]">
                <SectionTitle icon={<Warehouse size={16} />} className="mb-3">
                  {trainer ? 'Khu của bạn' : 'Tổng quan chuồng'}
                </SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat value={`${totals.active}/${workZones.length}`} label="khu hoạt động" />
                  <MiniStat value={totals.free} label="ô trống" />
                  <MiniStat value={totals.maintenance} label="bảo trì" warn={totals.maintenance > 0} />
                  <MiniStat value={totals.receiving} label="nhận ngựa" warn={totals.receiving === 0} />
                </div>
              </Card>

              {!trainer && (
                <Card tone={noZone.length ? 'warning' : 'default'} className="border-none p-4 shadow-[0_4px_20px_-10px_rgba(4,120,87,0.1)]">
                  <SectionTitle icon={<Building2 size={16} />} action={<Count value={noZone.length} />} className="mb-1">
                    Chờ xếp khu
                  </SectionTitle>
                  {noZone.length === 0 ? (
                    <p className="py-1.5 text-sm text-gray-500">Không có ngựa nào chờ xếp khu.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {noZone.map((horse) => (
                        <PersonRow
                          key={horse.id}
                          horse={horse}
                          onOpen={() => openHorse(horse)}
                          note={isManager ? undefined : 'Chỉ Quản lý câu lạc bộ xếp khu'}
                          action={
                            isManager && (
                              <Button size="sm" variant="secondary" onClick={() => setZoneHorse(toPlacement(horse))}>
                                Xếp khu
                              </Button>
                            )
                          }
                        />
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              <Card tone={waitingStall.length ? 'warning' : 'default'} className="border-none p-4 shadow-[0_4px_20px_-10px_rgba(4,120,87,0.1)]">
                <SectionTitle action={<Count value={waitingStall.length} />} className="mb-1">
                  Chờ xếp ô
                </SectionTitle>
                {waitingStall.length === 0 ? (
                  <p className="py-1.5 text-sm text-gray-500">{trainer ? 'Ngựa trong khu của bạn đều đã có ô.' : 'Mọi ngựa đã có khu đều đã có ô.'}</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {waitingStall.map(({ zone, horse }) => (
                      <PersonRow
                        key={horse.id}
                        horse={horse}
                        note={zone.barn.name}
                        onOpen={() => openHorse(horse)}
                        action={
                          zone.canManage && (
                            <Button size="sm" variant="secondary" onClick={() => setStallTarget({ horse: toPlacement(horse) })}>
                              Xếp ô
                            </Button>
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </Card>

              {attention.length > 0 && (
                <Card className="border-none p-4 shadow-[0_4px_20px_-10px_rgba(4,120,87,0.1)]">
                  <SectionTitle icon={<AlertTriangle size={16} />} action={<Count value={attention.length} />} className="mb-1">
                    Cần chú ý
                  </SectionTitle>
                  <ul className="divide-y divide-gray-100">
                    {attention.map(({ horse, label, code }) => (
                      <PersonRow
                        key={horse.id}
                        horse={horse}
                        onOpen={() => openHorse(horse)}
                        note={
                          <>
                            <span className="font-mono">{code}</span> · <span className="font-medium text-red-700">{label}</span>
                          </>
                        }
                      />
                    ))}
                  </ul>
                </Card>
              )}

              {isManager && pendingZones.length > 0 && (
                <Card variant="flat" className="border-none p-4 shadow-[0_4px_20px_-10px_rgba(4,120,87,0.1)]">
                  <SectionTitle className="mb-1">Khu cần xử lý</SectionTitle>
                  <ul className="divide-y divide-gray-100">
                    {pendingZones.map((zone) => {
                      const noTrainer = !zone.barn.headTrainerId || !zone.barn.hasActiveHeadTrainer;
                      const inactive = zone.barn.status !== 'ACTIVE';
                      const fullReason = stallFullReason(zone.barn, zone.stalls.length);
                      const canAdd = !fullReason;
                      return (
                        <li key={zone.barn.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{zone.barn.name}</p>
                            <p className="truncate text-xs text-amber-700">{barnBlocker(zone.barn)}</p>
                          </div>
                          {inactive ? (
                            <Button size="sm" variant="ghost" onClick={() => setStatusZone(zone.barn)}>
                              Đổi trạng thái
                            </Button>
                          ) : noTrainer ? (
                            <Button size="sm" variant="ghost" onClick={() => setTrainerZone(zone.barn)}>
                              Gán HT
                            </Button>
                          ) : canAdd ? (
                            <Button size="sm" variant="ghost" onClick={() => setStallsZone(zone)}>
                              Thêm ô
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">{fullReason}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </aside>

            {/* ===== Các khu ===== */}
            <div className="space-y-4 lg:col-span-8 xl:col-span-9">
              <ZoneLegend />
              {zones.length === 0 ? (
                <EmptyState
                  title={trainer ? 'Bạn chưa được giao khu nào' : 'Chưa có khu chuồng nào'}
                  hint={isManager ? 'Bấm Thêm khu để tạo khu đầu tiên.' : trainer ? 'Quản lý câu lạc bộ sẽ giao khu cho bạn.' : 'Quản lý câu lạc bộ sẽ tạo khu và ô chuồng.'}
                />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,440px),1fr))] gap-4">
                  {zones.map((zone) => (
                    <div key={zone.barn.id} className="h-full">
                      <ZoneBoard
                        id={`zone-${zone.barn.id}`}
                        className="h-full flex flex-col"
                        layoutId={`zone-plate-${zone.barn.id}`}
                        barn={zone.barn}
                        cells={zone.cells}
                        mine={zone.canManage}
                        isolation={zone.isolation}
                        readOnly={zone.readOnly}
                        highlight={highlight === zone.barn.id}
                        zoneMenu={zoneMenu(zone)}
                        cellMenu={zone.readOnly ? undefined : cellMenu(zone)}
                        cellLink={zone.readOnly ? readOnlyLink : undefined}
                        emptyLabel={(cell) => (cell.stall.status === 'AVAILABLE' && zone.canManage && zone.waitingStall.length > 0 ? 'Trống · bấm để xếp' : undefined)}
                        onAddStall={isManager && !stallFullReason(zone.barn, zone.stalls.length) ? () => setStallsZone(zone) : undefined}
                        onExpand={() => openFocus(zone.barn.id)}
                        footer={zoneFooter(zone)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </LayoutGroup>

      <AssignZoneDialog horse={zoneHorse} onClose={() => setZoneHorse(null)} onDone={reload} />
      <AssignStallDialog
        horse={stallTarget?.horse ?? null}
        presetStallId={stallTarget?.preset}
        onClose={() => setStallTarget(null)}
        onDone={reload}
        onAssignGroom={(horse) => setGroomHorse(horse)}
      />
      <GroomDialog
        horse={groomHorse}
        onClose={() => setGroomHorse(null)}
        onDone={() => {
          reload();
          detail.reload();
        }}
      />
      <RemoveStallDialog horse={removeHorse} onClose={() => setRemoveHorse(null)} onDone={reload} />

      <ZoneFormDialog open={!!formOpen} zone={formOpen?.zone} headTrainers={headTrainers} onClose={() => setFormOpen(null)} onDone={reload} />
      <HeadTrainerDialog zone={trainerZone} headTrainers={headTrainers} barns={barns} onClose={() => setTrainerZone(null)} onDone={reload} />
      <UnassignTrainerDialog zone={unassignZone?.barn ?? null} horseCount={unassignZone?.horseCount ?? 0} onClose={() => setUnassignZone(null)} onDone={reload} />
      <ZoneStatusDialog zone={statusZone} onClose={() => setStatusZone(null)} onDone={reload} />
      <AddStallsDialog
        zone={stallsZone?.barn ?? null}
        stalls={stallsZone?.stalls ?? []}
        onClose={() => setStallsZone(null)}
        onDone={reload}
        onEditZone={() => {
          const zone = stallsZone?.barn;
          setStallsZone(null);
          if (zone) setFormOpen({ zone });
        }}
      />
      <MaintenanceDialog stall={maintStall} onClose={() => setMaintStall(null)} onDone={reload} />

      <ConfirmDialog
        open={!!deletingZone}
        title={`Xóa ${deletingZone?.barn.name ?? ''}`}
        message={deletingZone && zoneDeleteBlockers(deletingZone).length > 0 ? 'Không xóa được khu này:' : 'Khu sẽ bị xóa mềm (vẫn giữ trong nhật ký).'}
        consequences={deletingZone ? zoneDeleteBlockers(deletingZone) : []}
        confirmLabel="Xóa khu"
        disabled={!!deletingZone && zoneDeleteBlockers(deletingZone).length > 0}
        pending={action.pending}
        onClose={() => {
          setDeletingZone(null);
          action.clearError();
        }}
        onConfirm={async () => {
          if (!deletingZone) return;
          const done = await action.run(async () => {
            await deleteBarn(deletingZone.barn.id);
            return true;
          });
          if (done) {
            toast.push(`Đã xóa ${deletingZone.barn.name}`, 'success');
            setDeletingZone(null);
            reload();
          }
        }}
      >
        {action.error && <ErrorBox message={action.error} />}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!deletingStall}
        title={`Xóa ô ${deletingStall?.code ?? ''}`}
        message="Ô bị xóa mềm và không còn trong sơ đồ chuồng."
        confirmLabel="Xóa ô"
        pending={action.pending}
        onClose={() => setDeletingStall(null)}
        onConfirm={async () => {
          if (!deletingStall) return;
          const target = deletingStall;
          const done = await action.run(async () => {
            await deleteStall(target.id);
            return true;
          });
          setDeletingStall(null);
          if (done) {
            toast.push(`Đã xóa ô ${target.code}`, 'success');
            reload();
          }
        }}
      />
    </div>
  );
}
