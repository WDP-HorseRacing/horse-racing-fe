// Danh mục khu và ô chuồng. CM thêm/sửa/xóa, gán HT phụ trách; HT, VET, GROOM chỉ xem.
import { useState } from 'react';
import { Info, Plus, Warehouse, Wrench } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { listAllHorses } from '../../api/horses';
import { deleteBarn, deleteStall, listBarns, listStalls, updateStall } from '../../api/stable';
import { listAllUsers } from '../../api/users';
import type { BarnListItem, HorseListItem, Stall } from '../../api/types';
import { useStore } from '../../store/store';
import {
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorBox,
  PageHeader,
  Pill,
  SectionTitle,
  Skeleton,
  Tip,
  cn,
  useToast,
  type Column,
  type MenuAction,
} from '../../components/ui';
import { ZoneStatusPill } from '../../components/ui/status';
import { stallStatusLabel } from '../../lib/labels';
import { stallTypeLabel } from '../../lib/api-labels';
import { AddStallsDialog, HeadTrainerDialog, MaintenanceDialog, ZoneFormDialog, ZoneStatusDialog } from './components/ZoneDialogs';

interface ZoneRow {
  barn: BarnListItem;
  stalls: Stall[];
  occupant: Map<string, HorseListItem>;
  horseCount: number;
  maintenance: number;
  occupied: number;
}

async function loadCatalog(isManager: boolean) {
  const [barns, stalls, horses, headTrainers] = await Promise.all([
    listBarns(),
    listStalls(),
    listAllHorses(),
    isManager ? listAllUsers({ role: 'HEAD_TRAINER', status: 'ACTIVE' }) : Promise.resolve([]),
  ]);
  const inClub = horses.filter((horse) => !horse.isDeleted && horse.lifecycleStatus !== 'TRANSFERRED');
  const zones: ZoneRow[] = barns
    .map((barn) => {
      const own = stalls.filter((stall) => stall.barnId === barn.id).sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }));
      const occupant = new Map(inClub.filter((horse) => horse.location.stall?.id && own.some((stall) => stall.id === horse.location.stall?.id)).map((horse) => [horse.location.stall!.id!, horse]));
      return {
        barn,
        stalls: own,
        occupant,
        horseCount: inClub.filter((horse) => horse.location.barn?.id === barn.id).length,
        maintenance: own.filter((stall) => stall.status === 'MAINTENANCE').length,
        occupied: occupant.size,
      };
    })
    .sort((a, b) => a.barn.name.localeCompare(b.barn.name, 'vi', { numeric: true }));
  return { zones, headTrainers };
}

function zoneDeleteBlockers(zone: ZoneRow): string[] {
  const list: string[] = [];
  if (zone.horseCount > 0) list.push(`Khu còn ${zone.horseCount} ngựa`);
  if (zone.stalls.length > 0) list.push(`Khu còn ${zone.stalls.length} ô — xóa hết ô trước`);
  return list;
}

export default function ZoneCatalog() {
  const toast = useToast();
  const role = useStore((state) => state.currentUser?.role);
  const isOwner = role === 'HORSE_OWNER';
  const canManage = role === 'CLUB_MANAGER';
  const { data, loading, error, reload } = useService(() => (isOwner ? Promise.resolve(undefined) : loadCatalog(canManage)), [isOwner, canManage]);
  const action = useAction();

  const [selectedId, setSelectedId] = useState<string>();
  const [formOpen, setFormOpen] = useState<{ zone?: BarnListItem } | null>(null);
  const [trainerZone, setTrainerZone] = useState<BarnListItem | null>(null);
  const [statusZone, setStatusZone] = useState<BarnListItem | null>(null);
  const [stallsZone, setStallsZone] = useState<ZoneRow | null>(null);
  const [deletingZone, setDeletingZone] = useState<ZoneRow | null>(null);
  const [maintStall, setMaintStall] = useState<Stall | null>(null);
  const [deletingStall, setDeletingStall] = useState<Stall | null>(null);

  if (isOwner) {
    return (
      <div className="space-y-6">
        <PageHeader title="Khu và ô chuồng" />
        <EmptyState title="Danh mục khu và ô dành cho nhân sự câu lạc bộ" />
      </div>
    );
  }
  if (loading && !data) return <Skeleton rows={6} />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được danh mục khu'} />;

  const { zones, headTrainers } = data;
  const selected = zones.find((zone) => zone.barn.id === selectedId) ?? zones[0];

  const zoneMenu = (zone: ZoneRow): MenuAction[] => {
    const blockers = zoneDeleteBlockers(zone);
    return [
      { label: 'Sửa tên, sức chứa, mô tả', onSelect: () => setFormOpen({ zone: zone.barn }) },
      { label: 'Đổi HT phụ trách', onSelect: () => setTrainerZone(zone.barn) },
      { label: 'Đổi trạng thái', onSelect: () => setStatusZone(zone.barn) },
      { label: 'Thêm ô', onSelect: () => setStallsZone(zone) },
      { label: blockers.length ? `Xóa khu (${blockers[0].toLowerCase()})` : 'Xóa khu', danger: true, onSelect: () => setDeletingZone(zone) },
    ];
  };

  const columns: Column<ZoneRow>[] = [
    { key: 'zone', header: 'Khu', render: (zone) => <span className="font-semibold text-gray-900">{zone.barn.name}</span> },
    {
      key: 'ht',
      header: 'HT phụ trách',
      render: (zone) =>
        zone.barn.headTrainerFullName ? (
          <span className={cn('text-sm', zone.barn.hasActiveHeadTrainer ? 'text-gray-700' : 'font-medium text-amber-700')}>
            {zone.barn.headTrainerFullName}
            {!zone.barn.hasActiveHeadTrainer && ' (không còn hoạt động)'}
          </span>
        ) : (
          <span className="text-sm font-medium text-amber-700">Chưa có</span>
        ),
    },
    { key: 'status', header: 'Trạng thái', render: (zone) => <ZoneStatusPill status={zone.barn.status} /> },
    {
      key: 'total',
      header: 'Số ô',
      className: 'text-right tabular-nums',
      render: (zone) => (
        <span>
          {zone.stalls.length}
          {zone.barn.capacity ? <span className="text-gray-400">/{zone.barn.capacity}</span> : null}
        </span>
      ),
    },
    { key: 'maint', header: 'Bảo trì', className: 'text-right tabular-nums', render: (zone) => zone.maintenance || <span className="text-gray-300">—</span> },
    { key: 'occupied', header: 'Có ngựa', className: 'text-right tabular-nums', render: (zone) => zone.occupied },
    {
      key: 'waiting',
      header: 'Chờ xếp ô',
      className: 'text-right tabular-nums',
      render: (zone) =>
        zone.barn.pendingStallHorseCount ? <span className="font-semibold text-amber-700">{zone.barn.pendingStallHorseCount}</span> : <span className="text-gray-300">—</span>,
    },
    {
      key: 'free',
      header: 'Còn nhận',
      className: 'text-right',
      render: (zone) => (
        <Tip content="Còn nhận = ô trống − ngựa của khu đang chờ xếp ô">
          <span
            className={cn(
              'inline-flex cursor-help items-center gap-1 text-sm tabular-nums',
              zone.barn.availableStallCount <= 0 && zone.barn.status === 'ACTIVE' ? 'font-semibold text-amber-700' : 'text-gray-900',
            )}
          >
            {zone.barn.availableStallCount} <Info size={12} className="text-gray-400" />
          </span>
        </Tip>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-12',
            render: (zone: ZoneRow) => (
              <div onClick={(event) => event.stopPropagation()}>
                <ActionMenu items={zoneMenu(zone)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  const stallMenu = (zone: ZoneRow, stall: Stall): MenuAction[] => {
    const horse = zone.occupant.get(stall.id);
    if (horse || stall.status === 'OCCUPIED') {
      return [{ label: `Ô đang có ${horse?.name ?? 'ngựa'} — chỉ đổi được khi ô trống`, disabled: true, onSelect: () => {} }];
    }
    // Đưa một ô trống ra khỏi danh sách ô trống sẽ làm khu thiếu chỗ nếu đã hết chỗ nhận.
    const short = stall.status === 'AVAILABLE' && zone.barn.availableStallCount <= 0 && zone.barn.pendingStallHorseCount > 0;
    const shortReason = `khu sẽ thiếu ô cho ${zone.barn.pendingStallHorseCount} ngựa chờ xếp ô`;
    const items: MenuAction[] = [];
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
    return items;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Khu và ô chuồng"
        description={canManage ? 'Danh mục khu, HT phụ trách và ô chuồng; bấm một khu để xem ô.' : 'Danh mục khu và ô chuồng của câu lạc bộ (chỉ xem).'}
        actions={
          canManage && (
            <Button onClick={() => setFormOpen({})}>
              <Plus size={16} /> Thêm khu
            </Button>
          )
        }
      />

      {action.error && !deletingZone && <ErrorBox message={action.error} />}

      <DataTable
        rows={zones}
        columns={columns}
        rowKey={(zone) => zone.barn.id}
        onRowClick={(zone) => setSelectedId(zone.barn.id)}
        rowClassName={(zone) => (zone.barn.id === selected?.barn.id ? 'bg-gray-50 [&>td:first-child]:shadow-[inset_2px_0_0_0_#047857]' : '')}
        emptyTitle="Chưa có khu chuồng nào"
      />

      {selected && (
        <div className="grid gap-5 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <SectionTitle
              icon={<Warehouse size={16} />}
              action={
                canManage && (
                  <Button size="sm" variant="soft" onClick={() => setStallsZone(selected)}>
                    <Plus size={14} /> Thêm ô
                  </Button>
                )
              }
            >
              Ô chuồng của {selected.barn.name}
            </SectionTitle>
            {selected.stalls.length === 0 ? (
              <EmptyState title="Khu chưa có ô" hint={canManage ? 'Bấm Thêm ô để sinh mã ô nối tiếp.' : undefined} />
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                {selected.stalls.map((stall) => {
                  const horse = selected.occupant.get(stall.id);
                  const chip = (
                    <button
                      type="button"
                      disabled={!canManage}
                      className={cn(
                        'flex h-20 w-full flex-col justify-between rounded-xl border p-2.5 text-left transition disabled:cursor-default',
                        stall.status === 'OCCUPIED' && 'border-gray-200 bg-white',
                        stall.status === 'AVAILABLE' && 'border-dashed border-gray-300',
                        stall.status === 'MAINTENANCE' && 'border-dashed border-gray-300 bg-[repeating-linear-gradient(135deg,rgba(17,24,39,0.045)_0_6px,transparent_6px_12px)]',
                        canManage && 'hover:border-gray-400',
                      )}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold text-gray-600">{stall.code}</span>
                        {stall.type !== 'STANDARD' && <span className="text-[10px] text-gray-400">{stallTypeLabel[stall.type]}</span>}
                      </span>
                      <span className={cn('truncate text-[11px]', stall.status === 'OCCUPIED' ? 'font-medium text-gray-800' : 'text-gray-500')}>
                        {stall.status === 'OCCUPIED' ? (
                          (horse?.name ?? stallStatusLabel.OCCUPIED)
                        ) : stall.status === 'MAINTENANCE' ? (
                          <span className="flex items-center gap-1">
                            <Wrench size={11} className="text-gray-400" /> {stall.description ?? stallStatusLabel.MAINTENANCE}
                          </span>
                        ) : (
                          stallStatusLabel.AVAILABLE
                        )}
                      </span>
                    </button>
                  );
                  return canManage ? <ActionMenu key={stall.id} items={stallMenu(selected, stall)} trigger={chip} align="start" /> : <div key={stall.id}>{chip}</div>;
                })}
              </div>
            )}
          </Card>

          <aside className="lg:col-span-4">
            <Card variant="flat" className="space-y-4 lg:sticky lg:top-6">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-900">{selected.barn.name}</p>
                <ZoneStatusPill status={selected.barn.status} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200/70">
                  <p
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      selected.barn.availableStallCount <= 0 && selected.barn.status === 'ACTIVE' ? 'text-amber-700' : 'text-gray-900',
                    )}
                  >
                    {selected.barn.availableStallCount}
                  </p>
                  <p className="text-xs text-gray-500">còn nhận</p>
                </div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-gray-200/70">
                  <p className="text-2xl font-bold tabular-nums text-gray-900">{selected.horseCount}</p>
                  <p className="text-xs text-gray-500">ngựa thuộc khu</p>
                </div>
              </div>
              {selected.barn.description && <p className="text-sm text-gray-600">{selected.barn.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="slate">HT: {selected.barn.headTrainerFullName ?? 'chưa có'}</Pill>
                {selected.barn.capacity && <Pill tone="slate">Tối đa {selected.barn.capacity} ô</Pill>}
              </div>
              <ul className="space-y-1.5 border-t border-gray-200/70 pt-3 text-xs text-gray-500">
                <li>Khu nhận ngựa khi đang hoạt động, có HT đang hoạt động và còn chỗ (ô trống trừ ngựa chờ xếp ô).</li>
                <li>Khu còn ngựa thì không chuyển sang Đóng/Bảo trì, không gỡ HT, không xóa. Đổi sang HT khác luôn được.</li>
                <li>Ô chỉ chuyển Trống ⇄ Bảo trì khi không có ngựa; trạng thái Có ngựa do hệ thống tự đặt.</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}

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
            setSelectedId(undefined);
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
