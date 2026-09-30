// F1.1 — danh sách ngựa: hàng chip lọc theo sức khỏe, thanh lọc một hàng, bảng full width.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getHorseListSummary, listHorses, listZoneOptions, type HorseFilters, type HorseRow } from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Avatar,
  Button,
  ChipFilter,
  DataTable,
  ErrorBox,
  FilterSelect,
  PageHeader,
  SearchInput,
  Skeleton,
  Tip,
  ToggleChip,
  Toolbar,
  cn,
  type Column,
} from '../../components/ui';
import { DeletedPill, HealthPill, LifecyclePill, PlacementPill } from '../../components/ui/status';
import { distanceLabel, healthLabel, lifecycleLabel, sexLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import type { DistancePreference, HealthStatus, HorseSex, LifecycleStatus } from '../../types/domain';


type ChipValue = 'ALL' | HealthStatus | 'WAITING';

/**
 * Một cột "Tình trạng" thay cho hai cột Được tập / Được đua:
 * bình thường để "—", chỉ lên tiếng khi bị chặn; lý do đầy đủ nằm trong chú thích rê chuột.
 */
function StandingCell({ row }: { row: HorseRow }) {
  const quiet = <span className="text-sm text-gray-300">—</span>;
  if (row.deleted || row.lifecycleStatus !== 'ACTIVE') return quiet;
  if (!row.train.allowed) {
    const text =
      row.train.code === 'LOCK'
        ? 'Khóa huấn luyện'
        : row.healthStatus === 'INJURED' || row.healthStatus === 'QUARANTINED'
          ? healthLabel[row.healthStatus]
          : 'Không được tập';
    return (
      <Tip content={`${row.train.reason ?? text}. Không được tập, không được đua.`}>
        <span className="cursor-help text-sm font-medium text-red-700">{text}</span>
      </Tip>
    );
  }
  if (!row.race.allowed) {
    return (
      <Tip content={`${row.race.reason ?? 'Không được đua'}. Chỉ tập Nhẹ và Trung bình, không được đua.`}>
        <span className="cursor-help text-sm font-medium text-amber-800">
          {row.healthStatus === 'UNDER_OBSERVATION' ? 'Chỉ tập Nhẹ–TB' : 'Không được đua'}
        </span>
      </Tip>
    );
  }
  return quiet;
}

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
          <p className="text-xs text-gray-500">
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
      header: 'Sức khỏe',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.deleted ? <DeletedPill /> : <HealthPill status={row.healthStatus} />}
          {!row.deleted && <LifecyclePill status={row.lifecycleStatus} />}
        </div>
      ),
    },
    {
      key: 'place',
      header: 'Khu · ô · Groom',
      render: (row) =>
        row.placement === 'PLACED' ? (
          <div className="text-sm text-gray-700">
            <p>
              {row.zoneName} · <span className="font-mono text-[13px]">{row.stallCode}</span>
            </p>
            <p className="text-xs text-gray-500">{row.groomName}</p>
          </div>
        ) : row.placement === 'NONE' ? (
          <span className="text-sm text-gray-400">Không ở câu lạc bộ</span>
        ) : (
          <div className="space-y-1">
            <PlacementPill placement={row.placement} />
            {row.zoneName && (
              <p className="text-xs text-gray-500">
                {row.zoneName}
                {row.stallCode ? ` · ${row.stallCode}` : ''}
              </p>
            )}
          </div>
        ),
    },
    {
      key: 'standing',
      header: 'Tình trạng',
      render: (row) => <StandingCell row={row} />,
    },
  ];

  const stats = summary.data;
  const chip: ChipValue = waiting ? 'WAITING' : ((health || 'ALL') as ChipValue);
  const selectChip = (value: ChipValue) => {
    setWaiting(value === 'WAITING');
    setHealth(value === 'ALL' || value === 'WAITING' ? '' : value);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={isOwner ? 'Ngựa của tôi' : 'Danh sách ngựa'}
        description={isOwner ? 'Hồ sơ, sức khỏe và chỗ ở của các ngựa bạn sở hữu.' : undefined}
        actions={
          can(user, 'horse.create') && (
            <Button onClick={() => navigate(links.horseNew)}>
              <Plus size={16} /> Thêm ngựa mới
            </Button>
          )
        }
      />

      {stats ? (
        <ChipFilter<ChipValue>
          value={chip}
          onChange={selectChip}
          options={[
            { value: 'ALL', label: 'Tất cả', count: stats.total },
            { value: 'ELIGIBLE', label: healthLabel.ELIGIBLE, count: stats.byHealth.ELIGIBLE },
            { value: 'UNDER_OBSERVATION', label: healthLabel.UNDER_OBSERVATION, count: stats.byHealth.UNDER_OBSERVATION, dot: 'warn' },
            { value: 'INJURED', label: healthLabel.INJURED, count: stats.byHealth.INJURED, dot: 'danger' },
            { value: 'QUARANTINED', label: healthLabel.QUARANTINED, count: stats.byHealth.QUARANTINED, dot: 'danger', hollow: true },
            ...(isOwner ? [] : [{ value: 'WAITING' as const, label: 'Chờ xếp chỗ', count: stats.waitingPlacement, dot: 'warn' as const }]),
          ]}
        />
      ) : (
        <div className="skeleton h-8 w-full max-w-2xl" />
      )}

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc số chip…" className="min-w-[220px] flex-1" />
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
          rowClassName={(row) => cn((row.deleted || row.lifecycleStatus === 'TRANSFERRED') && 'opacity-60')}
        />
      )}
    </div>
  );
}
