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
  Dot,
  EmptyState,
  ErrorBox,
  PageHeader,
  SectionTitle,
  Skeleton,
  Tip,
  cn,
  useToast,
  type MenuAction,
} from '../../components/ui';
import { HealthPill, ZoneStatusPill, healthDot, stallBorder } from '../../components/ui/status';
import { healthLabel } from '../../lib/labels';
import { links } from '../../lib/links';
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

/** Mức bất thường của một ngựa trong ô: khóa/chấn thương/cách ly → đỏ, cần theo dõi → hổ phách. */
function severityOf(horse: MapHorse): 'danger' | 'warn' | null {
  if (horse.retired) return null;
  if (horse.locked || horse.healthStatus === 'INJURED' || horse.healthStatus === 'QUARANTINED') return 'danger';
  if (horse.healthStatus === 'UNDER_OBSERVATION') return 'warn';
  return null;
}

const MAINTENANCE_STRIPES = 'bg-[repeating-linear-gradient(135deg,rgba(17,24,39,0.045)_0_6px,transparent_6px_12px)]';

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
        <div className={cn('flex h-27 flex-col justify-between rounded-xl border border-dashed border-gray-300 p-3', MAINTENANCE_STRIPES)}>
          <span className="font-mono text-xs font-semibold text-gray-400">{stall.code}</span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Wrench size={12} className="text-gray-400" /> Bảo trì
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
          'flex h-27 w-full flex-col justify-between rounded-xl border border-dashed border-gray-300 p-3 text-left transition',
          items.length > 0 ? 'hover:border-emerald-500 hover:bg-white' : 'cursor-default',
        )}
      >
        <span className="font-mono text-xs font-semibold text-gray-400">{stall.code}</span>
        <span className={cn('text-xs', items.length > 0 ? 'font-medium text-emerald-700' : 'text-gray-400')}>
          {items.length > 0 ? 'Trống · bấm để xếp' : 'Trống'}
        </span>
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

  const severity = severityOf(horse);
  const tip = [
    horse.retired ? undefined : healthLabel[horse.healthStatus],
    horse.locked ? 'Đang khóa huấn luyện' : undefined,
    horse.quarantined ? 'Cân nhắc chuyển ô để tách đàn' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ActionMenu
      align="start"
      items={items}
      trigger={
        <button
          type="button"
          title={severity ? tip : undefined}
          className={cn(
            'group relative flex h-27 w-full flex-col justify-between rounded-xl border p-3 text-left transition hover:border-gray-300 hover:shadow-card-hover',
            severity ? stallBorder[horse.healthStatus] : 'border-gray-200 bg-white',
            severity === 'danger' && 'border-red-300 shadow-[inset_3px_0_0_0_#ef4444]',
            severity === 'warn' && 'shadow-[inset_3px_0_0_0_#f59e0b]',
          )}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-xs font-semibold text-gray-500">{stall.code}</span>
            <span className="flex items-center gap-1.5">
              {horse.retired && <span className="text-[11px] text-gray-400">Đã giải nghệ</span>}
              {horse.locked && <Lock size={12} className="text-red-600" />}
              {severity && <Dot tone={healthDot[horse.healthStatus]} hollow={horse.healthStatus === 'QUARANTINED'} />}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar src={horse.avatar} name={horse.name} size={30} className="rounded-lg" />
            <div className="min-w-0">
              <div className={cn('truncate text-sm font-semibold', horse.retired ? 'text-gray-600' : 'text-gray-900')}>{horse.name}</div>
              <div className={cn('truncate text-[11px]', horse.groomName ? 'text-gray-500' : 'font-medium text-amber-700')}>
                {horse.groomName ?? 'Chờ phân công Groom'}
              </div>
            </div>
          </div>
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
        <p className="flex flex-wrap items-baseline gap-1.5 text-sm font-semibold text-gray-900">
          <span className="truncate">{horse.name}</span>
          {horse.retired && <span className="text-xs font-normal text-gray-400">Đã giải nghệ</span>}
        </p>
        <div className="truncate text-xs text-gray-500">{note ?? healthLabel[horse.healthStatus]}</div>
      </div>
      {action}
    </li>
  );
}

/** Số đếm bên phải tiêu đề cột phụ: > 0 thì hổ phách (có việc cần làm), = 0 thì xám nhạt. */
function Count({ value }: { value: number }) {
  return <span className={cn('text-sm tabular-nums', value > 0 ? 'font-semibold text-amber-700' : 'text-gray-400')}>{value}</span>;
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

  const quarantined = data.zones.flatMap((zone) =>
    zone.stalls.filter((stall) => stall.horse?.quarantined).map((stall) => ({ stall, horse: stall.horse! })),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sơ đồ chuồng"
        description={`${data.zones.length} khu · ${totals.stalls} ô · ${totals.horses} ngựa thuộc khu · ${totals.free} chỗ trống${
          myZones.length ? ` · bạn phụ trách ${myZones.join(', ')}, bấm ô để xếp, đổi ô hoặc phân công Groom` : ''
        }.`}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] border border-gray-300 bg-white" /> Bình thường
        </span>
        <span className="flex items-center gap-1.5">
          <Dot tone="warn" /> {healthLabel.UNDER_OBSERVATION}
        </span>
        <span className="flex items-center gap-1.5">
          <Dot tone="danger" /> {healthLabel.INJURED} / <Dot tone="danger" hollow /> {healthLabel.QUARANTINED}
        </span>
        <span className="flex items-center gap-1.5">
          <Lock size={12} className="text-red-600" /> Khóa huấn luyện
        </span>
      </div>

      {action.error && !unassign && <ErrorBox message={action.error} />}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8 xl:col-span-9">
          {data.zones.map((zone) => {
            const free = Math.max(0, zone.capacity.free);
            const receiving = zone.status === 'ACTIVE';
            return (
              <Card key={zone.id} variant={receiving ? 'raised' : 'outline'} tone={receiving ? 'default' : 'warning'}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-base font-bold text-gray-700">
                      {zone.code}
                    </span>
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                        {zone.name}
                        {!receiving && <ZoneStatusPill status={zone.status} />}
                        {zone.canManage && <span className="text-xs font-normal text-gray-500">· khu của bạn</span>}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-gray-500">
                        <UserRound size={12} className="text-gray-400" />
                        {zone.headTrainerName ? `HT ${zone.headTrainerName}` : 'Chưa có HT phụ trách'}
                        {zone.statusReason ? ` · ${zone.statusReason}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Tip content={capacityTip(zone)}>
                      <span
                        className={cn(
                          'inline-flex cursor-help items-center gap-1',
                          free === 0 && receiving ? 'font-medium text-amber-700' : 'text-gray-600',
                        )}
                      >
                        Chỗ trống <span className="font-semibold tabular-nums">{free}</span>
                        <Info size={13} className="text-gray-400" />
                      </span>
                    </Tip>
                    <span className="text-xs text-gray-500">
                      {zone.capacity.horseCount} ngựa / {zone.capacity.total} ô
                      {zone.capacity.maintenance > 0 ? ` · ${zone.capacity.maintenance} ô bảo trì` : ''}
                    </span>
                  </div>
                </div>

                {zone.stalls.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">Khu chưa có ô chuồng.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                    {zone.stalls.map((stall) => (
                      <StallCell key={stall.id} stall={stall} zone={zone} canAssignZone={data.canAssignZone} onAction={onAction} />
                    ))}
                  </div>
                )}

                {zone.waitingStall.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm">
                    <Dot tone="warn" />
                    <span className="font-medium text-amber-800">Chờ xếp ô:</span>
                    {zone.waitingStall.map((horse) => (
                      <span key={horse.id} className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-gray-800 ring-1 ring-gray-200">
                        {horse.name}
                        {horse.retired ? ' · Đã giải nghệ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="space-y-4 lg:sticky lg:top-6">
            <Card tone={data.noZone.length ? 'warning' : 'default'} className="p-5">
              <SectionTitle icon={<Building2 size={16} />} action={<Count value={data.noZone.length} />}>
                Chờ xếp khu
              </SectionTitle>
              {data.noZone.length === 0 ? (
                <p className="text-sm text-gray-500">Không có ngựa nào chờ xếp khu.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.noZone.map((horse) => (
                    <WaitingItem
                      key={horse.id}
                      horse={horse}
                      note={data.canAssignZone ? undefined : 'Chỉ Quản lý câu lạc bộ xếp khu'}
                      action={
                        data.canAssignZone ? (
                          <Button size="sm" variant="secondary" onClick={() => setZoneHorse(toPlacement(horse))}>
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

            <Card tone={waitingStall.length ? 'warning' : 'default'} className="p-5">
              <SectionTitle action={<Count value={waitingStall.length} />}>Chờ xếp ô</SectionTitle>
              {waitingStall.length === 0 ? (
                <p className="text-sm text-gray-500">Mọi ngựa đã có khu đều đã có ô.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {waitingStall.map(({ zone, horse }) => (
                    <WaitingItem
                      key={horse.id}
                      horse={horse}
                      note={`${zone.name}${horse.groomName ? ` · Groom ${horse.groomName}` : ''}`}
                      action={
                        zone.canManage ? (
                          <Button size="sm" variant="secondary" onClick={() => setStallTarget({ horse: toPlacement(horse) })}>
                            Xếp ô
                          </Button>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>

            <Card tone={waitingGroom.length ? 'warning' : 'default'} className="p-5">
              <SectionTitle action={<Count value={waitingGroom.length} />}>Chờ phân công Groom</SectionTitle>
              {waitingGroom.length === 0 ? (
                <p className="text-sm text-gray-500">Mọi ngựa trong ô đều có Groom.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {waitingGroom.map(({ zone, horse }) => (
                    <WaitingItem
                      key={horse.id}
                      horse={horse}
                      note={`${zone.name} · ô ${horse.stallCode}`}
                      action={
                        zone.canManage ? (
                          <Button size="sm" variant="secondary" onClick={() => setGroomHorse(toPlacement(horse))}>
                            Phân công
                          </Button>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>

            {quarantined.length > 0 && (
              <Card tone="warning" className="p-5">
                <SectionTitle icon={<ShieldAlert size={16} />} action={<Count value={quarantined.length} />}>
                  Ngựa đang cách ly
                </SectionTitle>
                {quarantined.map(({ stall, horse }) => (
                  <div key={stall.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                    <span className="text-gray-800">
                      {horse.name} · <span className="font-mono text-[13px] text-gray-500">{stall.code}</span>
                    </span>
                    <HealthPill status="QUARANTINED" />
                  </div>
                ))}
                <p className="mt-2 text-xs text-gray-500">Cân nhắc chuyển sang ô trống để tách đàn. Hệ thống không tự chuyển ô.</p>
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
