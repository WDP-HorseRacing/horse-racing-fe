// Sơ đồ chuồng (gộp cả danh mục khu và ô). Cột trái: tổng quan, các danh sách chờ xếp chỗ, ngựa cần chú ý,
// khu cần xử lý. Cột phải: mỗi khu một thẻ lưới 3×3 ô, rê chuột vào ô để xem ngựa, bấm ô để thao tác.
// CM: xếp/đổi khu (F1.6), quản lý khu và ô. HT của khu: xếp ô kèm Groom, chuyển ô, gỡ ô, đổi Groom (F1.7).
// Dữ liệu ghép từ /barns, /stalls và /horses (ô có ngựa xác định qua location.stall.id).
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Building2, Plus, Warehouse } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { listAllHorses } from '../../api/horses';
import { deleteBarn, deleteStall, listBarns, listStalls, updateStall } from '../../api/stable';
import { listAllUsers } from '../../api/users';
import type { BarnListItem, HorseListItem, Stall } from '../../api/types';
import { useStore } from '../../store/store';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, ErrorBox, PageHeader, SectionTitle, Skeleton, cn, useToast, type MenuAction } from '../../components/ui';
import { healthLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { AssignStallDialog, AssignZoneDialog, GroomDialog, RemoveStallDialog, type PlacementHorse } from './components/PlacementDialogs';
import { AddStallsDialog, HeadTrainerDialog, MaintenanceDialog, ZoneFormDialog, ZoneStatusDialog } from './components/ZoneDialogs';
import { MAX_STALLS_PER_BARN, barnBlocker, buildCells, isLockedHorse, occupantsByStall, type ZoneCell } from './components/barn';
import { ZoneBoard, ZoneLegend } from './components/ZoneBoard';

interface MapZone {
  barn: BarnListItem;
  stalls: Stall[];
  cells: ZoneCell[];
  horseByStall: Map<string, HorseListItem>;
  waitingStall: HorseListItem[];
  horseCount: number;
  /** Người xem là HT phụ trách khu này. */
  canManage: boolean;
}

async function loadMap(userId: string | undefined, isTrainer: boolean, isManager: boolean) {
  const [barns, stalls, horses, headTrainers] = await Promise.all([
    listBarns(),
    listStalls(),
    listAllHorses(),
    isManager ? listAllUsers({ role: 'HEAD_TRAINER', status: 'ACTIVE' }) : Promise.resolve([]),
  ]);
  const inClub = horses.filter((horse) => !horse.isDeleted && horse.lifecycleStatus !== 'TRANSFERRED');
  const occupants = occupantsByStall(inClub);
  const horseByStall = new Map(inClub.filter((horse) => horse.location.stall?.id).map((horse) => [horse.location.stall!.id!, horse]));
  const zones: MapZone[] = barns
    .map((barn) => {
      const horsesOfBarn = inClub.filter((horse) => horse.location.barn?.id === barn.id);
      return {
        barn,
        stalls: stalls.filter((stall) => stall.barnId === barn.id),
        cells: buildCells(barn.id, stalls, occupants),
        horseByStall,
        waitingStall: horsesOfBarn.filter((horse) => horse.location.placementStatus === 'PENDING_STALL'),
        horseCount: horsesOfBarn.length,
        canManage: isTrainer && barn.headTrainerId === userId,
      };
    })
    .sort((a, b) => Number(b.canManage) - Number(a.canManage) || a.barn.name.localeCompare(b.barn.name, 'vi', { numeric: true }));
  const noZone = inClub.filter((horse) => horse.location.placementStatus === 'PENDING_BARN');
  return { zones, noZone, stalls, headTrainers };
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
  const toast = useToast();
  const action = useAction();
  const [params] = useSearchParams();
  const user = useStore((state) => state.currentUser);
  const role = user?.role;
  const isOwner = role === 'HORSE_OWNER';
  const isManager = role === 'CLUB_MANAGER';
  const { data, loading, error, reload } = useService(
    () => (isOwner ? Promise.resolve(undefined) : loadMap(user?.id, role === 'HEAD_TRAINER', isManager)),
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
  const [statusZone, setStatusZone] = useState<BarnListItem | null>(null);
  const [stallsZone, setStallsZone] = useState<MapZone | null>(null);
  const [deletingZone, setDeletingZone] = useState<MapZone | null>(null);
  const [maintStall, setMaintStall] = useState<Stall | null>(null);
  const [deletingStall, setDeletingStall] = useState<Stall | null>(null);

  // Mở từ Tổng quan với ?zone=<id>: cuộn tới khu đó và nhấn mạnh viền trong giây lát.
  const focusZone = params.get('zone');
  const [highlight, setHighlight] = useState<string | null>(null);
  const loaded = !!data;
  useEffect(() => {
    if (!focusZone || !loaded) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`zone-${focusZone}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlight(focusZone);
    });
    const timer = window.setTimeout(() => setHighlight(null), 2600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusZone, loaded]);

  if (isOwner) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sơ đồ chuồng" />
        <EmptyState title="Sơ đồ chuồng dành cho nhân sự câu lạc bộ" hint="Bạn xem khu và ô của ngựa mình trong hồ sơ từng con ở mục Ngựa của tôi." />
      </div>
    );
  }
  if (loading && !data) return <Skeleton rows={6} />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được sơ đồ chuồng'} />;

  const { zones, noZone, stalls, headTrainers } = data;
  const waitingStall = zones.flatMap((zone) => zone.waitingStall.map((horse) => ({ zone, horse })));
  const attention = zones.flatMap((zone) =>
    zone.cells.flatMap((cell) => {
      const horse = zone.horseByStall.get(cell.stall.id);
      const label = horse ? attentionOf(horse) : undefined;
      return horse && label ? [{ horse, label, code: cell.stall.code }] : [];
    }),
  );
  const pendingZones = zones.filter((zone) => barnBlocker(zone.barn));
  const totals = {
    active: zones.filter((zone) => zone.barn.status === 'ACTIVE').length,
    free: stalls.filter((stall) => stall.status === 'AVAILABLE').length,
    maintenance: stalls.filter((stall) => stall.status === 'MAINTENANCE').length,
    receiving: zones.reduce((sum, zone) => sum + (barnBlocker(zone.barn) ? 0 : zone.barn.availableStallCount), 0),
    horses: zones.reduce((sum, zone) => sum + zone.horseCount, 0),
  };
  const myZones = zones.filter((zone) => zone.canManage).map((zone) => zone.barn.name);

  const openHorse = (horse: HorseListItem) => navigate(links.horse(horse.id));

  const zoneMenu = (zone: MapZone): MenuAction[] => {
    if (!isManager) return [];
    const blockers = zoneDeleteBlockers(zone);
    const full = zone.stalls.length >= MAX_STALLS_PER_BARN;
    return [
      { label: 'Sửa tên, sức chứa, mô tả', onSelect: () => setFormOpen({ zone: zone.barn }) },
      { label: 'Đổi HT phụ trách', onSelect: () => setTrainerZone(zone.barn) },
      { label: 'Đổi trạng thái', onSelect: () => setStatusZone(zone.barn) },
      { label: full ? `Thêm ô (đã đủ ${MAX_STALLS_PER_BARN} ô)` : 'Thêm ô', disabled: full, onSelect: () => setStallsZone(zone) },
      { label: blockers.length ? `Xóa khu (${blockers[0].toLowerCase()})` : 'Xóa khu', danger: true, onSelect: () => setDeletingZone(zone) },
    ];
  };

  const cellMenu = (zone: MapZone) => (cell: ZoneCell): MenuAction[] => {
    const { stall } = cell;
    const horse = zone.horseByStall.get(stall.id);
    if (horse) {
      const items: MenuAction[] = [{ label: 'Mở hồ sơ ngựa', onSelect: () => openHorse(horse) }];
      if (zone.canManage) {
        items.push({ label: horse.healthStatus === 'QUARANTINED' ? 'Chuyển ô (tách đàn)' : 'Chuyển ô', onSelect: () => setStallTarget({ horse: toPlacement(horse) }) });
        items.push({ label: 'Đổi Groom', onSelect: () => setGroomHorse(toPlacement(horse)) });
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sơ đồ chuồng"
        description={`${zones.length} khu · ${stalls.length} ô · ${totals.horses} ngựa thuộc khu${myZones.length ? ` · bạn phụ trách ${myZones.join(', ')}` : ''}. Rê chuột vào ô để xem ngựa, bấm ô để thao tác.`}
        actions={
          isManager && (
            <Button onClick={() => setFormOpen({})}>
              <Plus size={16} /> Thêm khu
            </Button>
          )
        }
      />

      {action.error && !deletingZone && <ErrorBox message={action.error} />}

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* ===== Cột trái ===== */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 xl:col-span-3">
          <Card className="p-4">
            <SectionTitle icon={<Warehouse size={16} />} className="mb-3">
              Tổng quan chuồng
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat value={`${totals.active}/${zones.length}`} label="khu hoạt động" />
              <MiniStat value={totals.free} label="ô trống" />
              <MiniStat value={totals.maintenance} label="ô bảo trì" warn={totals.maintenance > 0} />
              <MiniStat value={totals.receiving} label="còn nhận ngựa" warn={totals.receiving === 0} />
            </div>
          </Card>

          <Card tone={noZone.length ? 'warning' : 'default'} className="p-4">
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

          <Card tone={waitingStall.length ? 'warning' : 'default'} className="p-4">
            <SectionTitle action={<Count value={waitingStall.length} />} className="mb-1">
              Chờ xếp ô
            </SectionTitle>
            {waitingStall.length === 0 ? (
              <p className="py-1.5 text-sm text-gray-500">Mọi ngựa đã có khu đều đã có ô.</p>
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
            <Card className="p-4">
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
            <Card variant="flat" className="p-4">
              <SectionTitle className="mb-1">Khu cần xử lý</SectionTitle>
              <ul className="divide-y divide-gray-100">
                {pendingZones.map((zone) => {
                  const noTrainer = !zone.barn.headTrainerId || !zone.barn.hasActiveHeadTrainer;
                  const inactive = zone.barn.status !== 'ACTIVE';
                  const canAdd = zone.stalls.length < MAX_STALLS_PER_BARN;
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
                        <span className="text-xs text-gray-400">Đủ {MAX_STALLS_PER_BARN} ô</span>
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
            <EmptyState title="Chưa có khu chuồng nào" hint={isManager ? 'Bấm Thêm khu để tạo khu đầu tiên.' : 'Quản lý câu lạc bộ sẽ tạo khu và ô chuồng.'} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {zones.map((zone) => (
                <ZoneBoard
                  key={zone.barn.id}
                  id={`zone-${zone.barn.id}`}
                  barn={zone.barn}
                  cells={zone.cells}
                  mine={zone.canManage}
                  highlight={highlight === zone.barn.id}
                  zoneMenu={zoneMenu(zone)}
                  cellMenu={cellMenu(zone)}
                  emptyLabel={(cell) => (cell.stall.status === 'AVAILABLE' && zone.canManage && zone.waitingStall.length > 0 ? 'Trống · bấm để xếp' : undefined)}
                  onAddStall={isManager ? () => setStallsZone(zone) : undefined}
                  footer={
                    zone.waitingStall.length > 0 || zone.barn.description ? (
                      <div className="space-y-1.5 text-sm">
                        {zone.waitingStall.length > 0 && (
                          <p className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-amber-800">Chờ xếp ô:</span>
                            {zone.waitingStall.map((horse) => (
                              <span key={horse.id} className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                                {horse.name}
                              </span>
                            ))}
                          </p>
                        )}
                        {zone.barn.description && <p className="text-xs text-gray-500">{zone.barn.description}</p>}
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AssignZoneDialog horse={zoneHorse} onClose={() => setZoneHorse(null)} onDone={reload} />
      <AssignStallDialog horse={stallTarget?.horse ?? null} presetStallId={stallTarget?.preset} onClose={() => setStallTarget(null)} onDone={reload} />
      <GroomDialog horse={groomHorse} onClose={() => setGroomHorse(null)} onDone={reload} />
      <RemoveStallDialog horse={removeHorse} onClose={() => setRemoveHorse(null)} onDone={reload} />

      <ZoneFormDialog open={!!formOpen} zone={formOpen?.zone} headTrainers={headTrainers} onClose={() => setFormOpen(null)} onDone={reload} />
      <HeadTrainerDialog zone={trainerZone} headTrainers={headTrainers} onClose={() => setTrainerZone(null)} onDone={reload} />
      <ZoneStatusDialog zone={statusZone} onClose={() => setStatusZone(null)} onDone={reload} />
      <AddStallsDialog zone={stallsZone?.barn ?? null} stalls={stallsZone?.stalls ?? []} onClose={() => setStallsZone(null)} onDone={reload} />
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
