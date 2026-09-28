// Sơ đồ chuồng: mỗi khu một khối lưới ô; cột phụ dính bên phải gom các danh sách chờ xếp chỗ.
// CM xếp/đổi khu (F1.6); HT của khu xếp ô, đổi ô, gỡ ô và phân công Groom (F1.7).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Info, Lock, ShieldAlert, UserRound, Wrench } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { getStableMap, unassignGroom, unassignStall, type MapHorse, type MapStall, type MapZone } from '../../services/horse.service';
import { useStore } from '../../store/store';
import {
  ActionMenu,
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  PageHeader,
  Pill,
  SectionTitle,
  Skeleton,
  Tip,
  cn,
  useToast,
  type MenuAction,
} from '../../components/ui';
import { HealthPill, ZoneStatusPill, stallBorder } from '../../components/ui/status';
import { healthLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import type { HealthStatus } from '../../types/domain';
import {
  AssignStallDialog,
  AssignZoneDialog,
  GroomDialog,
  ReasonDialog,
  type PlacementHorse,
} from './components/PlacementDialogs';

function toPlacement(horse: MapHorse): PlacementHorse {
  return {
    id: horse.id,
    name: horse.name,
    zoneId: horse.zoneId,
    zoneName: horse.zoneName,
    stallCode: horse.stallCode,
    groomId: horse.groomId,
    groomName: horse.groomName,
    quarantined: horse.quarantined,
  };
}

function capacityTip(zone: MapZone) {
  const c = zone.capacity;
  return (
    <span>
      Chỗ trống = ô không bảo trì − ngựa đang trong ô − ngựa thuộc khu nhưng chưa có ô
      <br />= ({c.total} − {c.maintenance}) − {c.occupied} − {c.waitingForStall} = <strong>{c.free}</strong>
    </span>
  );
}

function StallCell({
  stall,
  zone,
  canAssignZone,
  onAction,
}: {
  stall: MapStall;
  zone: MapZone;
  canAssignZone: boolean;
  onAction: (kind: 'open' | 'zone' | 'stall' | 'unstall' | 'groom' | 'ungroom', horse: MapHorse, presetStallId?: string) => void;
}) {
  const horse = stall.horse;

  if (stall.status === 'MAINTENANCE') {
    return (
      <Tip content={stall.maintenanceNote ? `Bảo trì: ${stall.maintenanceNote}` : 'Ô đang bảo trì'}>
        <div className="flex h-27 flex-col justify-between rounded-xl border border-dashed border-amber-200 bg-[repeating-linear-gradient(135deg,rgba(251,191,36,0.10)_0_8px,transparent_8px_16px)] p-3">
          <span className="font-mono text-xs font-semibold text-amber-700/80">{stall.code}</span>
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
            <Wrench size={12} /> Bảo trì
          </span>
        </div>
      </Tip>
    );
  }

  if (!horse) {
    const items: MenuAction[] = zone.canManage
      ? zone.waitingStall.map((item) => ({
          label: `Xếp ${item.name} vào ô này`,
          onSelect: () => onAction('stall', item, stall.id),
        }))
      : [];
    const body = (
      <button
        type="button"
        disabled={items.length === 0}
        className={cn(
          'flex h-27 w-full flex-col justify-between rounded-xl border border-dashed border-emerald-900/15 bg-white/60 p-3 text-left transition',
          items.length > 0 && 'hover:border-emerald-400 hover:bg-emerald-50/60',
          items.length === 0 && 'cursor-default',
        )}
      >
        <span className="font-mono text-xs font-semibold text-gray-400">{stall.code}</span>
        <span className="text-xs font-medium text-emerald-600/70">{items.length > 0 ? 'Trống · bấm để xếp' : 'Trống'}</span>
      </button>
    );
    return items.length > 0 ? <ActionMenu items={items} trigger={body} align="start" /> : body;
  }

  const items: MenuAction[] = [{ label: 'Mở hồ sơ ngựa', onSelect: () => onAction('open', horse) }];
  if (zone.canManage) {
    items.push({ label: horse.quarantined ? 'Đổi ô (gợi ý tách đàn)' : 'Đổi ô', onSelect: () => onAction('stall', horse) });
    items.push({ label: 'Gỡ khỏi ô', onSelect: () => onAction('unstall', horse) });
    items.push({ label: horse.groomId ? 'Đổi Groom' : 'Phân công Groom', onSelect: () => onAction('groom', horse) });
    if (horse.groomId) items.push({ label: 'Gỡ Groom', onSelect: () => onAction('ungroom', horse), danger: true });
  }
  if (canAssignZone) items.push({ label: 'Đổi khu (rút khỏi lớp của khu cũ)', onSelect: () => onAction('zone', horse) });

  return (
    <ActionMenu
      align="start"
      items={items}
      trigger={
        <button
          type="button"
          className={cn(
            'group relative flex h-27 w-full flex-col justify-between rounded-xl border-2 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-grass',
            stallBorder[horse.healthStatus],
          )}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-xs font-semibold text-gray-500">{stall.code}</span>
            <span className="flex items-center gap-1">
              {horse.quarantined && <ShieldAlert size={13} className="text-fuchsia-600" />}
              {horse.locked && <Lock size={12} className="text-red-500" />}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar src={horse.avatar} name={horse.name} size={30} className="rounded-lg" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">{horse.name}</div>
              <div className={cn('truncate text-[11px]', horse.groomName ? 'text-gray-500' : 'font-semibold text-amber-600')}>
                {horse.groomName ?? 'Chờ phân công Groom'}
              </div>
            </div>
          </div>
          {horse.retired && (
            <span className="absolute -top-2 right-2 rounded-md bg-gray-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">Đã giải nghệ</span>
          )}
        </button>
      }
    />
  );
}

function WaitingItem({ horse, action, note }: { horse: MapHorse; action?: React.ReactNode; note?: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar src={horse.avatar} name={horse.name} size={34} className="rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-900">
          <span className="truncate">{horse.name}</span>
          {horse.retired && <Pill tone="gray">Đã giải nghệ</Pill>}
        </p>
        <div className="truncate text-xs text-gray-400">{note ?? healthLabel[horse.healthStatus]}</div>
      </div>
      {action}
    </li>
  );
}

export default function StableMap() {
  const navigate = useNavigate();
  const toast = useToast();
  const role = useStore((state) => state.currentUser?.role);
  const isOwner = role === 'HORSE_OWNER';
  const { data, loading, error, reload } = useService(() => (isOwner ? Promise.resolve(undefined) : getStableMap()), [isOwner]);
  const action = useAction();

  const [zoneHorse, setZoneHorse] = useState<PlacementHorse | null>(null);
  const [stallTarget, setStallTarget] = useState<{ horse: PlacementHorse; preset?: string } | null>(null);
  const [groomHorse, setGroomHorse] = useState<PlacementHorse | null>(null);
  const [unassign, setUnassign] = useState<{ kind: 'stall' | 'groom'; horse: MapHorse } | null>(null);

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

  const onAction = (kind: 'open' | 'zone' | 'stall' | 'unstall' | 'groom' | 'ungroom', horse: MapHorse, preset?: string) => {
    if (kind === 'open') navigate(links.horse(horse.id));
    if (kind === 'zone') setZoneHorse(toPlacement(horse));
    if (kind === 'stall') setStallTarget({ horse: toPlacement(horse), preset });
    if (kind === 'groom') setGroomHorse(toPlacement(horse));
    if (kind === 'unstall') setUnassign({ kind: 'stall', horse });
    if (kind === 'ungroom') setUnassign({ kind: 'groom', horse });
  };

  const waitingStall = data.zones.flatMap((zone) => zone.waitingStall.map((horse) => ({ zone, horse })));
  const waitingGroom = data.zones.flatMap((zone) => zone.waitingGroom.map((horse) => ({ zone, horse })));
  const totals = data.zones.reduce(
    (acc, zone) => ({
      stalls: acc.stalls + zone.capacity.total,
      horses: acc.horses + zone.capacity.horseCount,
      // Chỉ khu đang hoạt động và có HT mới nhận ngựa.
      free: acc.free + (zone.status === 'ACTIVE' && zone.headTrainerName ? Math.max(0, zone.capacity.free) : 0),
    }),
    { stalls: 0, horses: 0, free: 0 },
  );
  const myZones = data.zones.filter((zone) => zone.canManage).map((zone) => zone.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sơ đồ chuồng"
        description={`${data.zones.length} khu · ${totals.stalls} ô · ${totals.horses} ngựa đang thuộc khu · ${totals.free} chỗ trống. ${
          myZones.length ? `Bạn phụ trách ${myZones.join(', ')}: bấm ô để xếp, đổi ô hoặc phân công Groom.` : data.canAssignZone ? 'Quản lý câu lạc bộ xếp ngựa vào khu; HT của khu xếp ô và Groom.' : ''
        }`}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
        {(Object.keys(healthLabel) as HealthStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={cn('h-3.5 w-3.5 rounded border-2', stallBorder[status])} />
            {healthLabel[status]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-dashed border-emerald-900/20 bg-white" /> Trống
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-dashed border-amber-300 bg-amber-50" /> Bảo trì
        </span>
        <span className="flex items-center gap-1.5">
          <Lock size={12} className="text-red-500" /> Khóa huấn luyện
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldAlert size={12} className="text-fuchsia-600" /> Cách ly — cân nhắc tách đàn
        </span>
      </div>

      {action.error && !unassign && <ErrorBox message={action.error} />}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8 xl:col-span-9">
          {data.zones.map((zone) => (
            <Card key={zone.id} variant={zone.status === 'ACTIVE' ? 'raised' : 'outline'} tone={zone.status === 'ACTIVE' ? 'default' : 'warning'}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white shadow-[0_8px_18px_-10px_rgba(5,150,105,0.9)]">
                    {zone.code}
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                      {zone.name} <ZoneStatusPill status={zone.status} />
                      {zone.canManage && <Pill tone="green">Khu của bạn</Pill>}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <UserRound size={12} /> {zone.headTrainerName ? `HT ${zone.headTrainerName}` : 'Chưa có HT phụ trách'}
                      {zone.statusReason ? ` · ${zone.statusReason}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Tip content={capacityTip(zone)}>
                    <span
                      className={cn(
                        'inline-flex cursor-help items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold',
                        zone.capacity.free > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      Chỗ trống {Math.max(0, zone.capacity.free)} <Info size={13} className="opacity-60" />
                    </span>
                  </Tip>
                  {zone.capacity.maintenance > 0 && <Pill tone="amber">{zone.capacity.maintenance} ô bảo trì</Pill>}
                  <span className="text-xs text-gray-400">
                    {zone.capacity.horseCount} ngựa / {zone.capacity.total} ô
                  </span>
                </div>
              </div>

              {zone.stalls.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Khu chưa có ô chuồng.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                  {zone.stalls.map((stall) => (
                    <StallCell key={stall.id} stall={stall} zone={zone} canAssignZone={data.canAssignZone} onAction={onAction} />
                  ))}
                </div>
              )}

              {zone.waitingStall.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50/70 px-3 py-2 text-sm text-amber-800">
                  <span className="font-medium">Chờ xếp ô:</span>
                  {zone.waitingStall.map((horse) => (
                    <span key={horse.id} className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold ring-1 ring-amber-200">
                      {horse.name}
                      {horse.retired ? ' · Đã giải nghệ' : ''}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>

        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="space-y-4 lg:sticky lg:top-6">
            <Card tone={data.noZone.length ? 'warning' : 'default'} className="p-5">
              <SectionTitle icon={<Building2 size={16} />} action={<Pill tone={data.noZone.length ? 'orange' : 'gray'}>{data.noZone.length}</Pill>}>
                Chờ xếp khu
              </SectionTitle>
              {data.noZone.length === 0 ? (
                <p className="text-sm font-light text-gray-400">Không có ngựa nào chờ xếp khu.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {data.noZone.map((horse) => (
                    <WaitingItem
                      key={horse.id}
                      horse={horse}
                      note={data.canAssignZone ? undefined : "Chỉ Quản lý câu lạc bộ xếp khu"}
                      action={
                        data.canAssignZone ? (
                          <Button size="sm" onClick={() => setZoneHorse(toPlacement(horse))}>
                            Xếp khu
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => navigate(links.horse(horse.id))}>
                            Xem
                          </Button>
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>

            <Card variant="flat" tone={waitingStall.length ? 'warning' : 'muted'} className="p-5">
              <SectionTitle action={<Pill tone={waitingStall.length ? 'amber' : 'gray'}>{waitingStall.length}</Pill>}>Chờ xếp ô</SectionTitle>
              {waitingStall.length === 0 ? (
                <p className="text-sm font-light text-gray-400">Mọi ngựa đã có khu đều đã có ô.</p>
              ) : (
                <ul className="divide-y divide-amber-100/70">
                  {waitingStall.map(({ zone, horse }) => (
                    <WaitingItem
                      key={horse.id}
                      horse={horse}
                      note={`${zone.name}${horse.groomName ? ` · Groom ${horse.groomName}` : ''}`}
                      action={
                        zone.canManage ? (
                          <Button size="sm" onClick={() => setStallTarget({ horse: toPlacement(horse) })}>
                            Xếp ô
                          </Button>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>

            <Card variant="outline" className="p-5">
              <SectionTitle action={<Pill tone={waitingGroom.length ? 'amber' : 'gray'}>{waitingGroom.length}</Pill>}>Chờ phân công Groom</SectionTitle>
              {waitingGroom.length === 0 ? (
                <p className="text-sm font-light text-gray-400">Mọi ngựa trong ô đều có Groom.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {waitingGroom.map(({ zone, horse }) => (
                    <WaitingItem
                      key={horse.id}
                      horse={horse}
                      note={`${zone.name} · ô ${horse.stallCode}`}
                      action={
                        zone.canManage ? (
                          <Button size="sm" variant="soft" onClick={() => setGroomHorse(toPlacement(horse))}>
                            Phân công
                          </Button>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>

            {data.zones.some((zone) => zone.stalls.some((stall) => stall.horse?.quarantined)) && (
              <Card variant="flat" tone="muted" className="p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fuchsia-800">
                  <ShieldAlert size={14} /> Ngựa đang cách ly
                </p>
                {data.zones.flatMap((zone) =>
                  zone.stalls
                    .filter((stall) => stall.horse?.quarantined)
                    .map((stall) => (
                      <div key={stall.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                        <span className="text-gray-700">
                          {stall.horse!.name} · <span className="font-mono">{stall.code}</span>
                        </span>
                        <HealthPill status="QUARANTINED" />
                      </div>
                    )),
                )}
                <p className="mt-2 text-xs text-gray-500">Gợi ý: cân nhắc chuyển sang ô trống để tách đàn. Hệ thống không tự chuyển ô.</p>
              </Card>
            )}
          </div>
        </aside>
      </div>

      <AssignZoneDialog horse={zoneHorse} onClose={() => setZoneHorse(null)} onDone={reload} />
      <AssignStallDialog
        horse={stallTarget?.horse ?? null}
        presetStallId={stallTarget?.preset}
        onClose={() => setStallTarget(null)}
        onDone={reload}
      />
      <GroomDialog horse={groomHorse} onClose={() => setGroomHorse(null)} onDone={reload} />
      <ReasonDialog
        open={!!unassign}
        title={unassign?.kind === 'stall' ? `Gỡ ${unassign.horse.name} khỏi ô ${unassign.horse.stallCode ?? ''}` : `Gỡ Groom của ${unassign?.horse.name ?? ''}`}
        message={
          unassign?.kind === 'stall'
            ? 'Ngựa về danh sách "Chờ xếp ô" của khu, ô trở về trống. Groom được giữ nguyên.'
            : 'Ngựa về danh sách "Chờ phân công Groom". Groom hiện tại nhận thông báo kết thúc phân công.'
        }
        confirmLabel={unassign?.kind === 'stall' ? 'Gỡ khỏi ô' : 'Gỡ Groom'}
        error={action.error}
        onClose={() => {
          setUnassign(null);
          action.clearError();
        }}
        onSubmit={async (reason) => {
          if (!unassign) return false;
          const target = unassign;
          const done = await action.run(() =>
            target.kind === 'stall' ? unassignStall(target.horse.id, reason) : unassignGroom(target.horse.id, reason),
          );
          if (done) {
            toast.push(target.kind === 'stall' ? `${target.horse.name} đã về Chờ xếp ô` : `${target.horse.name} đã về Chờ phân công Groom`, 'success');
            reload();
          }
          return !!done;
        }}
      />
    </div>
  );
}
