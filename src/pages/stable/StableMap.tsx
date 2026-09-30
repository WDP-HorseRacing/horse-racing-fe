// Sơ đồ chuồng: mỗi khu một khối lưới ô; cột phụ dính bên phải gom các danh sách chờ xếp chỗ.
// CM xếp/đổi khu (F1.6); HT của khu xếp ô (kèm Groom), chuyển ô, gỡ ô và đổi Groom (F1.7).
// Dữ liệu ghép từ /barns, /stalls và /horses (ô có ngựa xác định qua location.stall.id).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Info, Lock, ShieldAlert, UserRound, Wrench } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listAllHorses } from '../../api/horses';
import { listBarns, listStalls } from '../../api/stable';
import type { BarnListItem, HorseListItem, Stall } from '../../api/types';
import { useStore } from '../../store/store';
import { ActionMenu, Avatar, Button, Card, Dot, EmptyState, ErrorBox, PageHeader, SectionTitle, Skeleton, Tip, cn, type MenuAction } from '../../components/ui';
import { HealthPill, ZoneStatusPill, healthDot, stallBorder } from '../../components/ui/status';
import { healthLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { AssignStallDialog, AssignZoneDialog, GroomDialog, RemoveStallDialog, type PlacementHorse } from './components/PlacementDialogs';

interface MapZone {
  barn: BarnListItem;
  code: string;
  stalls: { stall: Stall; horse?: HorseListItem }[];
  waitingStall: HorseListItem[];
  canManage: boolean;
  counts: { total: number; maintenance: number; occupied: number; horses: number };
}

/** Ký hiệu ngắn của khu: "Khu A" → "A", "Khu cách ly" → "CL". */
function shortCode(name: string) {
  const words = name.replace(/^khu\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.map((word) => word[0]).join('').slice(0, 3).toUpperCase();
}

async function loadMap(userId: string | undefined, isTrainer: boolean) {
  const [barns, stalls, horses] = await Promise.all([listBarns(), listStalls(), listAllHorses()]);
  const inClub = horses.filter((horse) => !horse.isDeleted && horse.lifecycleStatus !== 'TRANSFERRED');
  const byStall = new Map(inClub.filter((horse) => horse.location.stall?.id).map((horse) => [horse.location.stall!.id!, horse]));
  const zones: MapZone[] = barns
    .map((barn) => {
      const own = stalls
        .filter((stall) => stall.barnId === barn.id)
        .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
        .map((stall) => ({ stall, horse: byStall.get(stall.id) }));
      const horsesOfBarn = inClub.filter((horse) => horse.location.barn?.id === barn.id);
      return {
        barn,
        code: shortCode(barn.name),
        stalls: own,
        waitingStall: horsesOfBarn.filter((horse) => horse.location.placementStatus === 'PENDING_STALL'),
        canManage: isTrainer && barn.headTrainerId === userId,
        counts: {
          total: own.length,
          maintenance: own.filter((item) => item.stall.status === 'MAINTENANCE').length,
          occupied: own.filter((item) => item.horse).length,
          horses: horsesOfBarn.length,
        },
      };
    })
    .sort((a, b) => Number(b.canManage) - Number(a.canManage) || a.barn.name.localeCompare(b.barn.name, 'vi', { numeric: true }));
  const noZone = inClub.filter((horse) => horse.location.placementStatus === 'PENDING_BARN');
  return { zones, noZone };
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

/** Ngựa đang hoạt động, đủ điều kiện sức khỏe mà không được đua ⇒ đang bị khóa huấn luyện. */
const isLocked = (horse: HorseListItem) => horse.lifecycleStatus === 'ACTIVE' && horse.healthStatus === 'ELIGIBLE' && !horse.canRegisterRace;

/** Mức bất thường của một ngựa trong ô: khóa/chấn thương/cách ly → đỏ, cần theo dõi → hổ phách. */
function severityOf(horse: HorseListItem): 'danger' | 'warn' | null {
  if (horse.lifecycleStatus === 'RETIRED') return null;
  if (isLocked(horse) || horse.healthStatus === 'INJURED' || horse.healthStatus === 'QUARANTINED') return 'danger';
  if (horse.healthStatus === 'UNDER_OBSERVATION') return 'warn';
  return null;
}

const MAINTENANCE_STRIPES = 'bg-[repeating-linear-gradient(135deg,rgba(17,24,39,0.045)_0_6px,transparent_6px_12px)]';

type MapAction = 'open' | 'zone' | 'stall' | 'unstall' | 'groom';

function StallCell({
  stall,
  horse,
  zone,
  canAssignZone,
  onAction,
}: {
  stall: Stall;
  horse?: HorseListItem;
  zone: MapZone;
  canAssignZone: boolean;
  onAction: (kind: MapAction, horse: HorseListItem, presetStallId?: string) => void;
}) {
  if (stall.status === 'MAINTENANCE') {
    return (
      <Tip content={stall.description ? `Bảo trì: ${stall.description}` : 'Ô đang bảo trì'}>
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
      ? zone.waitingStall.map((item) => ({ label: `Xếp ${item.name} vào ô này`, onSelect: () => onAction('stall', item, stall.id) }))
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
    items.push({ label: horse.healthStatus === 'QUARANTINED' ? 'Chuyển ô (tách đàn)' : 'Chuyển ô', onSelect: () => onAction('stall', horse) });
    items.push({ label: 'Đổi Groom', onSelect: () => onAction('groom', horse) });
    items.push({ label: 'Gỡ khỏi ô', onSelect: () => onAction('unstall', horse), danger: true });
  }
  if (canAssignZone) items.push({ label: 'Đổi khu', onSelect: () => onAction('zone', horse) });

  const severity = severityOf(horse);
  const retired = horse.lifecycleStatus === 'RETIRED';
  const locked = isLocked(horse);

  return (
    <ActionMenu
      align="start"
      items={items}
      trigger={
        <button
          type="button"
          title={severity ? [healthLabel[horse.healthStatus], locked ? 'Đang khóa huấn luyện' : undefined].filter(Boolean).join(' · ') : undefined}
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
              {locked && <Lock size={12} className="text-red-600" />}
              {severity && horse.healthStatus !== 'ELIGIBLE' && <Dot tone={healthDot[horse.healthStatus]} hollow={horse.healthStatus === 'QUARANTINED'} />}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar src={horse.photoUrl ?? undefined} name={horse.name} size={30} className="rounded-lg" />
            <div className="min-w-0">
              <div className={cn('truncate text-sm font-semibold', retired ? 'text-gray-600' : 'text-gray-900')}>{horse.name}</div>
              <div className="truncate text-[11px] text-gray-500">{retired ? 'Đã giải nghệ' : locked ? 'Khóa huấn luyện' : healthLabel[horse.healthStatus]}</div>
            </div>
          </div>
        </button>
      }
    />
  );
}

function WaitingItem({ horse, action, note }: { horse: HorseListItem; action?: React.ReactNode; note?: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar src={horse.photoUrl ?? undefined} name={horse.name} size={34} className="rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-1.5 text-sm font-semibold text-gray-900">
          <span className="truncate">{horse.name}</span>
          {horse.lifecycleStatus === 'RETIRED' && <span className="text-xs font-normal text-gray-400">Đã giải nghệ</span>}
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
  const user = useStore((state) => state.currentUser);
  const role = user?.role;
  const isOwner = role === 'HORSE_OWNER';
  const canAssignZone = role === 'CLUB_MANAGER';
  const { data, loading, error, reload } = useService(
    () => (isOwner ? Promise.resolve(undefined) : loadMap(user?.id, role === 'HEAD_TRAINER')),
    [isOwner, user?.id, role],
  );

  const [zoneHorse, setZoneHorse] = useState<PlacementHorse | null>(null);
  const [stallTarget, setStallTarget] = useState<{ horse: PlacementHorse; preset?: string } | null>(null);
  const [groomHorse, setGroomHorse] = useState<PlacementHorse | null>(null);
  const [removeHorse, setRemoveHorse] = useState<PlacementHorse | null>(null);

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

  const onAction = (kind: MapAction, horse: HorseListItem, preset?: string) => {
    if (kind === 'open') navigate(links.horse(horse.id));
    if (kind === 'zone') setZoneHorse(toPlacement(horse));
    if (kind === 'stall') setStallTarget({ horse: toPlacement(horse), preset });
    if (kind === 'groom') setGroomHorse(toPlacement(horse));
    if (kind === 'unstall') setRemoveHorse(toPlacement(horse));
  };

  const waitingStall = data.zones.flatMap((zone) => zone.waitingStall.map((horse) => ({ zone, horse })));
  const totals = data.zones.reduce(
    (acc, zone) => ({
      stalls: acc.stalls + zone.counts.total,
      horses: acc.horses + zone.counts.horses,
      free: acc.free + (zone.barn.status === 'ACTIVE' && zone.barn.hasActiveHeadTrainer ? zone.barn.availableStallCount : 0),
    }),
    { stalls: 0, horses: 0, free: 0 },
  );
  const myZones = data.zones.filter((zone) => zone.canManage).map((zone) => zone.barn.name);
  const quarantined = data.zones.flatMap((zone) =>
    zone.stalls.filter((item) => item.horse?.healthStatus === 'QUARANTINED').map((item) => ({ stall: item.stall, horse: item.horse! })),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sơ đồ chuồng"
        description={`${data.zones.length} khu · ${totals.stalls} ô · ${totals.horses} ngựa thuộc khu · còn nhận ${totals.free} ngựa${
          myZones.length ? ` · bạn phụ trách ${myZones.join(', ')}, bấm ô để xếp, chuyển ô hoặc đổi Groom` : ''
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

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8 xl:col-span-9">
          {data.zones.length === 0 && <EmptyState title="Chưa có khu chuồng nào" hint="Quản lý câu lạc bộ tạo khu và ô ở mục Khu và ô chuồng." />}
          {data.zones.map((zone) => {
            const receiving = zone.barn.status === 'ACTIVE';
            const free = zone.barn.availableStallCount;
            return (
              <Card key={zone.barn.id} variant={receiving ? 'raised' : 'outline'} tone={receiving ? 'default' : 'warning'}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">{zone.code}</span>
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                        {zone.barn.name}
                        {!receiving && <ZoneStatusPill status={zone.barn.status} />}
                        {zone.canManage && <span className="text-xs font-normal text-gray-500">· khu của bạn</span>}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-gray-500">
                        <UserRound size={12} className="text-gray-400" />
                        {zone.barn.headTrainerFullName ? `HT ${zone.barn.headTrainerFullName}` : 'Chưa có HT phụ trách'}
                        {zone.barn.headTrainerId && !zone.barn.hasActiveHeadTrainer ? ' (không còn hoạt động)' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Tip
                      content={
                        <span>
                          Còn nhận = ô trống − ngựa của khu đang chờ xếp ô. Khu chỉ nhận ngựa khi đang hoạt động và có HT đang hoạt động.
                        </span>
                      }
                    >
                      <span className={cn('inline-flex cursor-help items-center gap-1', free === 0 && receiving ? 'font-medium text-amber-700' : 'text-gray-600')}>
                        Còn nhận <span className="font-semibold tabular-nums">{free}</span>
                        <Info size={13} className="text-gray-400" />
                      </span>
                    </Tip>
                    <span className="text-xs text-gray-500">
                      {zone.counts.horses} ngựa / {zone.counts.total} ô{zone.barn.capacity ? ` (tối đa ${zone.barn.capacity})` : ''}
                      {zone.counts.maintenance > 0 ? ` · ${zone.counts.maintenance} ô bảo trì` : ''}
                    </span>
                  </div>
                </div>

                {zone.stalls.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">Khu chưa có ô chuồng.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                    {zone.stalls.map((item) => (
                      <StallCell key={item.stall.id} stall={item.stall} horse={item.horse} zone={zone} canAssignZone={canAssignZone} onAction={onAction} />
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
                        {horse.lifecycleStatus === 'RETIRED' ? ' · Đã giải nghệ' : ''}
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
                      note={canAssignZone ? undefined : 'Chỉ Quản lý câu lạc bộ xếp khu'}
                      action={
                        canAssignZone ? (
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
                      note={zone.barn.name}
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
              {waitingStall.length > 0 && <p className="mt-2 text-xs text-gray-500">HT của khu xếp ô và phân công Groom trong cùng một lần.</p>}
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
                <p className="mt-2 text-xs text-gray-500">HT có thể chuyển sang ô cách xa để tách đàn. Hệ thống không tự chuyển ô.</p>
              </Card>
            )}
          </div>
        </aside>
      </div>

      <AssignZoneDialog horse={zoneHorse} onClose={() => setZoneHorse(null)} onDone={reload} />
      <AssignStallDialog horse={stallTarget?.horse ?? null} presetStallId={stallTarget?.preset} onClose={() => setStallTarget(null)} onDone={reload} />
      <GroomDialog horse={groomHorse} onClose={() => setGroomHorse(null)} onDone={reload} />
      <RemoveStallDialog horse={removeHorse} onClose={() => setRemoveHorse(null)} onDone={reload} />
    </div>
  );
}
