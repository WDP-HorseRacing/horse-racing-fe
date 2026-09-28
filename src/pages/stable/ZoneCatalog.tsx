// F2.1 — danh mục khu và ô chuồng. CM thêm/sửa/xóa; HT, VET, GROOM chỉ xem.
import { useState } from 'react';
import { Info, Plus, Warehouse, Wrench } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { deleteStall, deleteZone, listZones, setStallMaintenance, type StallRow, type ZoneRow } from '../../services/horse.service';
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
import { AddStallsDialog, HeadTrainerDialog, MaintenanceDialog, ZoneFormDialog, ZoneStatusDialog } from './components/ZoneDialogs';

function freeTip(zone: ZoneRow) {
  const c = zone.capacity;
  return `Chỗ trống = (${c.total} ô − ${c.maintenance} bảo trì) − ${c.occupied} ngựa trong ô − ${c.waitingForStall} ngựa chờ xếp ô = ${c.free}`;
}

function zoneDeleteBlockers(zone: ZoneRow): string[] {
  const list: string[] = [];
  if (zone.capacity.horseCount > 0) list.push(`Khu còn ${zone.capacity.horseCount} ngựa`);
  if (zone.openClassCount > 0) list.push(`Khu còn ${zone.openClassCount} lớp chưa kết thúc`);
  return list;
}

export default function ZoneCatalog() {
  const toast = useToast();
  const role = useStore((state) => state.currentUser?.role);
  const isOwner = role === 'HORSE_OWNER';
  const { data, loading, error, reload } = useService(() => (isOwner ? Promise.resolve(undefined) : listZones()), [isOwner]);
  const action = useAction();

  const [selectedId, setSelectedId] = useState<string>();
  const [formOpen, setFormOpen] = useState<{ zone?: ZoneRow } | null>(null);
  const [trainerZone, setTrainerZone] = useState<ZoneRow | null>(null);
  const [statusZone, setStatusZone] = useState<ZoneRow | null>(null);
  const [stallsZone, setStallsZone] = useState<ZoneRow | null>(null);
  const [deletingZone, setDeletingZone] = useState<ZoneRow | null>(null);
  const [maintStall, setMaintStall] = useState<StallRow | null>(null);
  const [deletingStall, setDeletingStall] = useState<StallRow | null>(null);

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

  const { zones, canManage, headTrainers } = data;
  const selected = zones.find((zone) => zone.id === selectedId) ?? zones[0];

  const zoneMenu = (zone: ZoneRow): MenuAction[] => {
    const blockers = zoneDeleteBlockers(zone);
    return [
      { label: 'Sửa mã và tên', onSelect: () => setFormOpen({ zone }) },
      { label: 'Đổi HT phụ trách', onSelect: () => setTrainerZone(zone) },
      { label: 'Đổi trạng thái', onSelect: () => setStatusZone(zone) },
      { label: 'Thêm ô', onSelect: () => setStallsZone(zone) },
      {
        label: blockers.length ? `Xóa khu (${blockers.join(', ').toLowerCase()})` : 'Xóa khu',
        danger: true,
        onSelect: () => setDeletingZone(zone),
      },
    ];
  };

  const columns: Column<ZoneRow>[] = [
    {
      key: 'zone',
      header: 'Khu',
      render: (zone) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white">{zone.code}</span>
          <span className="font-semibold text-gray-900">{zone.name}</span>
        </div>
      ),
    },
    {
      key: 'ht',
      header: 'HT phụ trách',
      render: (zone) => (zone.headTrainerName ? <span className="text-sm text-gray-700">{zone.headTrainerName}</span> : <span className="text-sm text-amber-600">Chưa có</span>),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (zone) => (
        <div>
          <ZoneStatusPill status={zone.status} />
          {zone.statusReason && <div className="mt-0.5 max-w-48 truncate text-xs text-gray-400">{zone.statusReason}</div>}
        </div>
      ),
    },
    { key: 'total', header: 'Tổng ô', className: 'text-right tabular-nums', render: (zone) => zone.capacity.total },
    { key: 'maint', header: 'Bảo trì', className: 'text-right tabular-nums', render: (zone) => zone.capacity.maintenance || '—' },
    { key: 'occupied', header: 'Có ngựa', className: 'text-right tabular-nums', render: (zone) => zone.capacity.occupied },
    {
      key: 'waiting',
      header: 'Chờ xếp ô',
      className: 'text-right tabular-nums',
      render: (zone) => (zone.capacity.waitingForStall ? <span className="font-semibold text-amber-600">{zone.capacity.waitingForStall}</span> : '—'),
    },
    {
      key: 'free',
      header: 'Chỗ trống',
      className: 'text-right',
      render: (zone) => (
        <Tip content={freeTip(zone)}>
          <span
            className={cn(
              'inline-flex cursor-help items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums',
              zone.capacity.free > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-500',
            )}
          >
            {zone.capacity.free} <Info size={12} className="opacity-50" />
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

  const stallMenu = (zone: ZoneRow, stall: StallRow): MenuAction[] => {
    if (stall.horseId || stall.status === 'OCCUPIED') {
      return [{ label: `Ô đang có ${stall.horseName ?? 'ngựa'} — chỉ đổi được khi ô trống`, disabled: true, onSelect: () => {} }];
    }
    const short = zone.capacity.free - 1 < 0;
    const shortReason = `khu sẽ thiếu chỗ cho ${zone.capacity.waitingForStall} ngựa chờ xếp ô`;
    const items: MenuAction[] = [];
    if (stall.status === 'MAINTENANCE') {
      items.push({
        label: 'Kết thúc bảo trì',
        onSelect: async () => {
          const done = await action.run(() => setStallMaintenance(stall.id, false));
          if (done) {
            toast.push(`Ô ${stall.code} trở lại trống`, 'success');
            reload();
          }
        },
      });
    } else {
      items.push({
        label: short ? `Chuyển sang bảo trì (${shortReason})` : 'Chuyển sang bảo trì',
        disabled: short,
        onSelect: () => setMaintStall(stall),
      });
    }
    const deleteShort = stall.status === 'AVAILABLE' && short;
    items.push({
      label: deleteShort ? `Xóa ô (${shortReason})` : 'Xóa ô',
      danger: true,
      disabled: deleteShort,
      onSelect: () => setDeletingStall(stall),
    });
    return items;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khu và ô chuồng"
        description={canManage ? 'Quản lý danh mục khu, HT phụ trách và ô chuồng. Mọi chặn đều nêu lý do.' : 'Danh mục khu và ô chuồng của câu lạc bộ (chỉ xem).'}
        actions={
          canManage && (
            <Button onClick={() => setFormOpen({})}>
              <Plus size={16} /> Thêm khu
            </Button>
          )
        }
      />

      {action.error && <ErrorBox message={action.error} />}

      <DataTable
        rows={zones}
        columns={columns}
        rowKey={(zone) => zone.id}
        onRowClick={(zone) => setSelectedId(zone.id)}
        rowClassName={(zone) => (zone.id === selected?.id ? 'bg-emerald-50/60' : '')}
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
              Ô chuồng của {selected.name}
            </SectionTitle>
            {selected.stalls.length === 0 ? (
              <EmptyState title="Khu chưa có ô" hint={canManage ? 'Bấm Thêm ô để sinh mã ô nối tiếp.' : undefined} />
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
                {selected.stalls.map((stall) => {
                  const chip = (
                    <button
                      type="button"
                      disabled={!canManage}
                      className={cn(
                        'flex h-20 w-full flex-col justify-between rounded-xl border p-2.5 text-left transition disabled:cursor-default',
                        stall.status === 'OCCUPIED' && 'border-sky-200 bg-sky-50/60',
                        stall.status === 'AVAILABLE' && 'border-dashed border-emerald-300 bg-white',
                        stall.status === 'MAINTENANCE' &&
                          'border-dashed border-amber-300 bg-[repeating-linear-gradient(135deg,rgba(251,191,36,0.12)_0_7px,transparent_7px_14px)]',
                        canManage && 'hover:-translate-y-0.5 hover:shadow-grass',
                      )}
                    >
                      <span className="font-mono text-xs font-semibold text-gray-600">{stall.code}</span>
                      <span className="truncate text-[11px] text-gray-500">
                        {stall.status === 'OCCUPIED' ? stall.horseName : stall.status === 'MAINTENANCE' ? (
                          <span className="flex items-center gap-1 text-amber-700">
                            <Wrench size={11} /> {stall.maintenanceNote ?? stallStatusLabel.MAINTENANCE}
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
                <p className="font-semibold text-gray-900">{selected.name}</p>
                <ZoneStatusPill status={selected.status} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">{selected.capacity.free}</p>
                  <p className="text-xs text-gray-500">chỗ trống</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-2xl font-bold tabular-nums text-gray-900">{selected.capacity.horseCount}</p>
                  <p className="text-xs text-gray-500">ngựa thuộc khu</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">{freeTip(selected)}</p>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="slate">HT: {selected.headTrainerName ?? 'chưa có'}</Pill>
                {selected.openClassCount > 0 && <Pill tone="blue">{selected.openClassCount} lớp chưa kết thúc</Pill>}
              </div>
              <ul className="space-y-1.5 border-t border-emerald-900/5 pt-3 text-xs text-gray-500">
                <li>Khu còn ngựa thì không chuyển sang Đóng/Bảo trì, không gỡ HT, không xóa. Đổi sang HT khác luôn được.</li>
                <li>Ô chỉ chuyển Trống ⇄ Bảo trì khi không có ngựa; trạng thái Có ngựa do hệ thống tự đặt.</li>
                <li>Không chuyển ô sang bảo trì hay xóa ô nếu việc đó làm khu thiếu chỗ cho ngựa đang chờ xếp ô.</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}

      <ZoneFormDialog open={!!formOpen} zone={formOpen?.zone} headTrainers={headTrainers} onClose={() => setFormOpen(null)} onDone={reload} />
      <HeadTrainerDialog zone={trainerZone} headTrainers={headTrainers} onClose={() => setTrainerZone(null)} onDone={reload} />
      <ZoneStatusDialog zone={statusZone} onClose={() => setStatusZone(null)} onDone={reload} />
      <AddStallsDialog zone={stallsZone} onClose={() => setStallsZone(null)} onDone={reload} />
      <MaintenanceDialog stall={maintStall} onClose={() => setMaintStall(null)} onDone={reload} />

      <ConfirmDialog
        open={!!deletingZone}
        title={`Xóa ${deletingZone?.name ?? ''}`}
        message={
          deletingZone && zoneDeleteBlockers(deletingZone).length > 0
            ? 'Không xóa được khu này:'
            : 'Khu và toàn bộ ô của khu sẽ bị xóa mềm (vẫn giữ trong nhật ký).'
        }
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
          const done = await action.run(() => deleteZone(deletingZone.id));
          if (done) {
            toast.push(`Đã xóa ${deletingZone.name}`, 'success');
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
          const done = await action.run(() => deleteStall(deletingStall.id));
          setDeletingStall(null);
          if (done) {
            toast.push(`Đã xóa ô ${deletingStall.code}`, 'success');
            reload();
          }
        }}
      />
    </div>
  );
}
