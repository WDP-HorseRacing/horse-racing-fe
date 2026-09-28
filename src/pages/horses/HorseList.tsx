// F1.1 — danh sách ngựa: dải KPI theo sức khỏe, thanh lọc một hàng, bảng full width.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, HeartPulse, MapPinOff, Plus, ShieldAlert, ShieldX } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getHorseListSummary, listHorses, listZoneOptions, type HorseFilters, type HorseRow } from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Avatar,
  Button,
  DataTable,
  ErrorBox,
  FilterSelect,
  PageHeader,
  SearchInput,
  Skeleton,
  Stat,
  ToggleChip,
  Toolbar,
  cn,
  type Column,
} from '../../components/ui';
import { DeletedPill, EligibilityBadge, HealthPill, LifecyclePill, PlacementPill } from '../../components/ui/status';
import { distanceLabel, healthLabel, lifecycleLabel, sexLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import type { DistancePreference, HealthStatus, HorseSex, LifecycleStatus } from '../../types/domain';

const HEALTH: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];

export default function HorseList() {
  const navigate = useNavigate();
  const user = useStore((state) => state.currentUser);
  const role = user?.role;
  const isOwner = role === 'HORSE_OWNER';
  const canScope = role === 'HEAD_TRAINER' || role === 'GROOM';

  const [search, setSearch] = useState('');
  const [health, setHealth] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [sex, setSex] = useState('');
  const [distance, setDistance] = useState('');
  const [zone, setZone] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [mine, setMine] = useState(false);
  const [withDeleted, setWithDeleted] = useState(false);

  const filters: HorseFilters = useMemo(
    () => ({
      search,
      healthStatus: (health || undefined) as HealthStatus | undefined,
      lifecycleStatus: (lifecycle || undefined) as LifecycleStatus | undefined,
      sex: (sex || undefined) as HorseSex | undefined,
      distancePreference: (distance || undefined) as DistancePreference | undefined,
      zoneId: zone || undefined,
      placement: waiting ? 'WAITING' : undefined,
      mine,
      includeDeleted: withDeleted,
    }),
    [search, health, lifecycle, sex, distance, zone, waiting, mine, withDeleted],
  );

  const list = useService(() => listHorses(filters), [filters]);
  const summary = useService(() => getHorseListSummary({ mine }), [mine]);
  const zones = useService(() => (isOwner ? Promise.resolve([]) : listZoneOptions()), [isOwner]);

  const columns: Column<HorseRow>[] = [
    {
      key: 'horse',
      header: 'Ngựa',
      render: (row) => (
        <div className="flex min-w-[180px] items-center gap-3">
          <Avatar src={row.avatar} name={row.name} size={40} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{row.name}</div>
            <p className="font-mono text-[11px] text-gray-400">{row.chipNumber ?? 'chưa có chip'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'identity',
      header: 'Giới tính · giống · tuổi',
      render: (row) => (
        <div className="text-sm text-gray-700">
          <p>{sexLabel[row.sex]}</p>
          <p className="text-xs text-gray-400">
            {row.breed ?? 'Chưa rõ giống'}
            {row.age !== undefined ? ` · ${row.age} tuổi` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'distance',
      header: 'Sở trường',
      render: (row) =>
        row.distancePreference ? (
          <span className="text-sm text-gray-700">{distanceLabel[row.distancePreference]}</span>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Sức khỏe · vòng đời',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.deleted ? <DeletedPill /> : <HealthPill status={row.healthStatus} />}
          {row.lifecycleStatus !== 'ACTIVE' && <LifecyclePill status={row.lifecycleStatus} />}
        </div>
      ),
    },
    {
      key: 'place',
      header: 'Khu · ô · Groom',
      render: (row) =>
        row.placement === 'PLACED' ? (
          <div className="text-sm">
            <p className="font-medium text-gray-800">
              {row.zoneName} · <span className="font-mono">{row.stallCode}</span>
            </p>
            <p className="text-xs text-gray-400">{row.groomName}</p>
          </div>
        ) : row.placement === 'NONE' ? (
          <span className="text-xs text-gray-400">Không ở câu lạc bộ</span>
        ) : (
          <div className="space-y-1">
            <PlacementPill placement={row.placement} />
            {row.zoneName && (
              <p className="text-xs text-gray-400">
                {row.zoneName}
                {row.stallCode ? ` · ${row.stallCode}` : ''}
              </p>
            )}
          </div>
        ),
    },
    {
      key: 'train',
      header: 'Được tập',
      render: (row) => <EligibilityBadge allowed={row.train.allowed} reason={row.train.reason} label={row.train.allowed ? 'Được' : 'Không'} compact />,
    },
    {
      key: 'race',
      header: 'Được đua',
      render: (row) => <EligibilityBadge allowed={row.race.allowed} reason={row.race.reason} label={row.race.allowed ? 'Được' : 'Không'} compact />,
    },
  ];

  const stats = summary.data;
  const toggleHealth = (value: HealthStatus) => {
    setWaiting(false);
    setHealth(health === value ? '' : value);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isOwner ? 'Ngựa của tôi' : 'Danh sách ngựa'}
        description={
          isOwner
            ? 'Hồ sơ, sức khỏe và vị trí chuồng của các ngựa bạn sở hữu.'
            : 'Toàn bộ ngựa của câu lạc bộ. Ngựa cần chú ý (không được tập, không được đua, chờ xếp chỗ) nằm đầu danh sách.'
        }
        actions={
          can(user, 'horse.create') && (
            <Button onClick={() => navigate(links.horseNew)}>
              <Plus size={16} /> Thêm ngựa mới
            </Button>
          )
        }
      />

      {/* KPI bất đối xứng: ô lớn "Đủ điều kiện" + các ô nhỏ + ô chờ xếp chỗ */}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <Stat
            className={cn('lg:col-span-4 lg:items-center lg:p-7 lg:[&_p:first-child]:text-5xl', !isOwner && 'lg:row-span-2')}
            value={stats.byHealth.ELIGIBLE}
            label={`${healthLabel.ELIGIBLE} trên tổng ${stats.total} ngựa`}
            hint="Tập và đua bình thường"
            icon={<HeartPulse size={20} />}
            tone="success"
            active={health === 'ELIGIBLE'}
            onClick={() => toggleHealth('ELIGIBLE')}
          />
          <Stat
            className="lg:col-span-3"
            value={stats.byHealth.UNDER_OBSERVATION}
            label={healthLabel.UNDER_OBSERVATION}
            hint="Chỉ tập Nhẹ và Trung bình"
            icon={<Activity size={18} />}
            tone="warning"
            active={health === 'UNDER_OBSERVATION'}
            onClick={() => toggleHealth('UNDER_OBSERVATION')}
          />
          <Stat
            className="lg:col-span-2"
            value={stats.byHealth.INJURED}
            label={healthLabel.INJURED}
            icon={<ShieldX size={18} />}
            tone="danger"
            active={health === 'INJURED'}
            onClick={() => toggleHealth('INJURED')}
          />
          <Stat
            className="lg:col-span-3"
            value={stats.byHealth.QUARANTINED}
            label={healthLabel.QUARANTINED}
            hint="Không tập, không đua"
            icon={<ShieldAlert size={18} />}
            tone="danger"
            active={health === 'QUARANTINED'}
            onClick={() => toggleHealth('QUARANTINED')}
          />
          {!isOwner && (
            <Stat
              className={cn('lg:col-span-8', stats.waitingPlacement > 0 && 'bg-amber-50/60 ring-amber-200/70')}
              value={stats.waitingPlacement}
              label="Chờ xếp chỗ"
              hint={
                stats.waitingPlacement > 0
                  ? `${stats.noZone} chờ xếp khu · ${stats.waitingPlacement - stats.noZone} chờ xếp ô hoặc phân công Groom — bấm để lọc`
                  : 'Mọi ngựa đều đã có khu, ô và Groom'
              }
              icon={<MapPinOff size={18} />}
              tone={stats.waitingPlacement > 0 ? 'warning' : 'default'}
              active={waiting}
              onClick={() => {
                setHealth('');
                setWaiting(!waiting);
              }}
            />
          )}
        </div>
      ) : (
        <Skeleton rows={2} />
      )}

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc số chip…" className="min-w-[220px] flex-1" />
        <FilterSelect value={health} onChange={setHealth} label="Sức khỏe">
          <option value="">Mọi sức khỏe</option>
          {HEALTH.map((item) => (
            <option key={item} value={item}>
              {healthLabel[item]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={lifecycle} onChange={setLifecycle} label="Vòng đời">
          <option value="">Mọi vòng đời</option>
          {(Object.keys(lifecycleLabel) as LifecycleStatus[]).map((item) => (
            <option key={item} value={item}>
              {lifecycleLabel[item]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={sex} onChange={setSex} label="Giới tính">
          <option value="">Mọi giới tính</option>
          {(Object.keys(sexLabel) as HorseSex[]).map((item) => (
            <option key={item} value={item}>
              {sexLabel[item]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={distance} onChange={setDistance} label="Sở trường">
          <option value="">Mọi sở trường</option>
          {(Object.keys(distanceLabel) as DistancePreference[]).map((item) => (
            <option key={item} value={item}>
              {distanceLabel[item]}
            </option>
          ))}
        </FilterSelect>
        {!isOwner && (
          <FilterSelect value={zone} onChange={setZone} label="Khu chuồng">
            <option value="">Mọi khu</option>
            {(zones.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            <option value="NONE">Chưa xếp khu</option>
          </FilterSelect>
        )}
        {canScope && (
          <ToggleChip checked={mine} onChange={setMine}>
            Ngựa tôi phụ trách
          </ToggleChip>
        )}
        {can(user, 'horse.viewDeleted') && (
          <ToggleChip checked={withDeleted} onChange={setWithDeleted}>
            Hiện hồ sơ đã xóa
          </ToggleChip>
        )}
      </Toolbar>

      {list.error && <ErrorBox message={list.error} />}
      {list.loading && !list.data ? (
        <Skeleton rows={6} />
      ) : (
        <DataTable
          rows={list.data ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(links.horse(row.id))}
          pageSize={12}
          emptyTitle={isOwner ? 'Bạn chưa sở hữu ngựa nào' : 'Không có ngựa phù hợp bộ lọc'}
          emptyHint={isOwner ? undefined : 'Thử bỏ bớt điều kiện lọc hoặc tìm theo tên khác.'}
          rowClassName={(row) =>
            cn(
              row.deleted && 'bg-red-50/30 opacity-70',
              !row.deleted && row.lifecycleStatus === 'TRANSFERRED' && 'opacity-60',
              row.attention && 'shadow-[inset_3px_0_0_0_#f59e0b]',
            )
          }
        />
      )}
    </div>
  );
}
