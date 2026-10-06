// F1.1 — danh sách ngựa: hàng chip lọc theo sức khỏe, thanh lọc một hàng, xem dạng thẻ ảnh hoặc bảng
// (nhớ lựa chọn trên máy).
// Lọc ở backend; câu lạc bộ ít ngựa nên lấy hết các trang rồi phân trang trên bảng.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { useDebounced } from '../../hooks/useDebounced';
import { countHorses, listAllHorses } from '../../api/horses';
import { listBarns } from '../../api/stable';
import type { Gender, HealthStatus, HorseListItem, HorseListQuery, LifecycleStatus, PlacementStatus, RaceAptitude } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Avatar,
  Button,
  DataTable,
  EmptyState,
  ErrorBox,
  FilterTabs,
  FilterSelect,
  PageHeader,
  SearchInput,
  Segmented,
  Tip,
  ToggleChip,
  cn,
  type Column,
} from '../../components/ui';
import { DeletedPill, HealthPill, LifecyclePill, PlacementStatusPill } from '../../components/ui/status';
import { distanceLabel, healthLabel, lifecycleLabel, sexLabel } from '../../lib/labels';
import { placementStatusLabel } from '../../lib/api-labels';
import { links } from '../../lib/links';
import { breedLabel } from '../../lib/horse-options';
import { HorseCard } from './components/HorseCard';
import { HorseCardsSkeleton, HorseRowsSkeleton } from '../../components/skeletons';
import { horseAge, isReadOnlyHorse } from '../../lib/horse-rules';

type View = 'cards' | 'table';
const VIEW_KEY = 'horseracing_horse_view';

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

type ChipValue = 'ALL' | HealthStatus;
const HEALTH: HealthStatus[] = ['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'];

/**
 * Một cột "Tình trạng" thay cho hai cột Được tập / Được đua: bình thường để "—", chỉ lên tiếng khi bị chặn.
 * Danh sách của backend chỉ có cờ được đua; ngựa đang hoạt động, sức khỏe đủ điều kiện mà vẫn không được đua
 * thì chỉ có thể là đang bị khóa huấn luyện.
 */
function StandingCell({ row }: { row: HorseListItem }) {
  const quiet = <span className="text-sm text-gray-300">—</span>;
  if (row.isDeleted || row.lifecycleStatus !== 'ACTIVE') return quiet;
  if (row.healthStatus === 'INJURED' || row.healthStatus === 'QUARANTINED') {
    return (
      <Tip content={`${healthLabel[row.healthStatus]}: không được tập, không được đua.`}>
        <span className="cursor-help text-sm font-medium text-red-700">Không tập</span>
      </Tip>
    );
  }
  if (!row.canRegisterRace && row.healthStatus === 'ELIGIBLE') {
    return (
      <Tip content="Đang có lệnh khóa huấn luyện của bác sĩ: không được tập, không được đua.">
        <span className="cursor-help text-sm font-medium text-red-700">Khóa huấn luyện</span>
      </Tip>
    );
  }
  if (row.healthStatus === 'UNDER_OBSERVATION') {
    return (
      <Tip content="Cần theo dõi: vẫn được tập, không được đăng ký đua.">
        <span className="cursor-help text-sm font-medium text-amber-800">Không được đua</span>
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
  const isTrainer = role === 'HEAD_TRAINER';
  const isGroom = role === 'GROOM';

  const [search, setSearch] = useState('');
  const [health, setHealth] = useState<HealthStatus | ''>('');
  const [lifecycle, setLifecycle] = useState('');
  const [gender, setGender] = useState('');
  const [aptitude, setAptitude] = useState('');
  const [barn, setBarn] = useState('');
  const [placement, setPlacement] = useState('');
  // HT và Groom mặc định chỉ xem ngựa mình phụ trách; bỏ chọn để xem toàn câu lạc bộ.
  const [mine, setMine] = useState(isTrainer || isGroom);
  const [withDeleted, setWithDeleted] = useState(false);
  const [view, setViewState] = useState<View>(readView);
  const setView = (next: View) => {
    setViewState(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Trình duyệt chặn lưu trữ: chỉ mất ghi nhớ chế độ xem.
    }
  };
  // Gõ tìm kiếm: đợi ngừng gõ 300 ms mới gọi API.
  const searchTerm = useDebounced(search.trim());

  const scope: HorseListQuery = useMemo(
    () => ({
      myBarns: isTrainer && mine ? true : undefined,
      myHorses: isGroom && mine ? true : undefined,
    }),
    [isTrainer, isGroom, mine],
  );

  const query: HorseListQuery = useMemo(
    () => ({
      ...scope,
      search: searchTerm || undefined,
      healthStatus: health || undefined,
      lifecycleStatus: (lifecycle || undefined) as LifecycleStatus | undefined,
      gender: (gender || undefined) as Gender | undefined,
      raceAptitude: (aptitude || undefined) as RaceAptitude | undefined,
      barnId: barn || undefined,
      placementStatus: (placement || undefined) as PlacementStatus | undefined,
      includeDeleted: withDeleted || undefined,
    }),
    [scope, searchTerm, health, lifecycle, gender, aptitude, barn, placement, withDeleted],
  );

  const list = useService(() => listAllHorses(query), [query]);
  // Số trên chip đếm theo phạm vi đang xem (không theo các bộ lọc còn lại).
  const counts = useService(
    async () => {
      const values = await Promise.all([countHorses(scope), ...HEALTH.map((item) => countHorses({ ...scope, healthStatus: item }))]);
      return { total: values[0], byHealth: Object.fromEntries(HEALTH.map((item, index) => [item, values[index + 1]])) as Record<HealthStatus, number> };
    },
    [scope],
  );
  const barns = useService(() => (isOwner ? Promise.resolve([]) : listBarns()), [isOwner]);

  const columns: Column<HorseListItem>[] = [
    {
      key: 'horse',
      header: 'Ngựa',
      render: (row) => (
        <div className="flex min-w-[180px] items-center gap-3">
          <Avatar src={row.photoUrl ?? undefined} name={row.name} size={40} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{row.name}</div>
            <p className="font-mono text-[11px] text-gray-400">{row.microchipId ?? 'chưa có chip'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'identity',
      header: 'Giới tính · giống · tuổi',
      render: (row) => {
        const age = horseAge(row.dateOfBirth, row.dateOfDeath);
        return (
          <div className="text-sm text-gray-700">
            <p>{row.gender ? sexLabel[row.gender] : <span className="text-gray-400">Chưa rõ</span>}</p>
            <p className="text-xs text-gray-500">
              {breedLabel(row.breed) ?? 'Chưa rõ giống'}
              {age !== undefined ? ` · ${age} tuổi` : ''}
            </p>
          </div>
        );
      },
    },
    {
      key: 'distance',
      header: 'Sở trường',
      render: (row) =>
        row.raceAptitude ? <span className="text-sm text-gray-700">{distanceLabel[row.raceAptitude]}</span> : <span className="text-sm text-gray-300">—</span>,
    },
    {
      key: 'status',
      header: 'Sức khỏe',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.isDeleted ? <DeletedPill /> : <HealthPill status={row.healthStatus} />}
          {!row.isDeleted && <LifecyclePill status={row.lifecycleStatus} />}
        </div>
      ),
    },
    {
      key: 'place',
      header: 'Khu · ô',
      render: (row) => {
        const { barn: rowBarn, stall, placementStatus } = row.location;
        if (placementStatus === 'PLACED') {
          return (
            <p className="text-sm text-gray-700">
              {rowBarn?.name} · <span className="font-mono text-[13px]">{stall?.code}</span>
            </p>
          );
        }
        if (placementStatus === 'NOT_APPLICABLE') return <span className="text-sm text-gray-400">{placementStatusLabel.NOT_APPLICABLE}</span>;
        return (
          <div className="space-y-1">
            <PlacementStatusPill status={placementStatus} />
            {rowBarn && <p className="text-xs text-gray-500">{rowBarn.name}</p>}
          </div>
        );
      },
    },
    { key: 'standing', header: 'Tình trạng', render: (row) => <StandingCell row={row} /> },
  ];

  const stats = counts.data;
  const chip: ChipValue = health || 'ALL';

  return (
    <div className="space-y-5">
      <PageHeader
        title={isOwner ? 'Ngựa của tôi' : 'Danh sách ngựa'}
        description={isOwner ? 'Hồ sơ, sức khỏe và chỗ ở của các ngựa bạn sở hữu.' : undefined}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'cards', label: <><LayoutGrid size={14} /> Thẻ</> },
                { value: 'table', label: <><List size={14} /> Bảng</> },
              ]}
            />
            {can(user, 'horse.create') && (
              <Button onClick={() => navigate(links.horseNew)}>
                <Plus size={16} /> Thêm ngựa mới
              </Button>
            )}
          </>
        }
      />

      <FilterTabs
        active={chip}
        onChange={(value) => setHealth(value === 'ALL' ? '' : (value as HealthStatus))}
        tabs={[
          { key: 'ALL', label: 'Tất cả', count: stats?.total },
          ...HEALTH.map((item) => ({ key: item, label: healthLabel[item], count: stats?.byHealth[item] })),
        ]}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc số chip…" className="min-w-55 flex-1" />
            <FilterSelect value={lifecycle} onChange={setLifecycle} label="Vòng đời">
              <option value="">Mọi vòng đời</option>
              {(Object.keys(lifecycleLabel) as LifecycleStatus[]).map((item) => (
                <option key={item} value={item}>
                  {lifecycleLabel[item]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={gender} onChange={setGender} label="Giới tính">
              <option value="">Mọi giới tính</option>
              {(Object.keys(sexLabel) as Gender[]).map((item) => (
                <option key={item} value={item}>
                  {sexLabel[item]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={aptitude} onChange={setAptitude} label="Sở trường">
              <option value="">Mọi sở trường</option>
              {(Object.keys(distanceLabel) as RaceAptitude[]).map((item) => (
                <option key={item} value={item}>
                  {distanceLabel[item]}
                </option>
              ))}
            </FilterSelect>
            {!isOwner && (
              <>
                <FilterSelect value={barn} onChange={setBarn} label="Khu chuồng">
                  <option value="">Mọi khu</option>
                  {(barns.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect value={placement} onChange={setPlacement} label="Xếp chỗ">
                  <option value="">Mọi tình trạng xếp chỗ</option>
                  {(['PENDING_BARN', 'PENDING_STALL', 'PLACED'] as PlacementStatus[]).map((item) => (
                    <option key={item} value={item}>
                      {placementStatusLabel[item]}
                    </option>
                  ))}
                </FilterSelect>
              </>
            )}
            {(isTrainer || isGroom) && (
              <ToggleChip checked={mine} onChange={setMine}>
                {isTrainer ? 'Khu của tôi' : 'Ngựa tôi phụ trách'}
              </ToggleChip>
            )}
            {can(user, 'horse.viewDeleted') && (
              <ToggleChip checked={withDeleted} onChange={setWithDeleted}>
                Hiện hồ sơ đã xóa
              </ToggleChip>
            )}
          </>
        }
      >
        {list.error && (
          <div className="p-4">
            <ErrorBox message={list.error} />
          </div>
        )}
        {list.loading && !list.data ? (
          view === 'cards' ? (
            <div className="p-4">
              <HorseCardsSkeleton />
            </div>
          ) : (
            <HorseRowsSkeleton />
          )
        ) : view === 'cards' ? (
          (list.data ?? []).length === 0 ? (
            <EmptyState
              title={isOwner ? 'Bạn chưa sở hữu ngựa nào' : 'Không có ngựa phù hợp bộ lọc'}
              hint={isOwner ? undefined : mine ? 'Đang chỉ xem ngựa bạn phụ trách. Bỏ chọn để xem toàn câu lạc bộ.' : 'Thử bỏ bớt điều kiện lọc hoặc tìm theo tên khác.'}
            />
          ) : (
            <div className={cn('grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-4 transition-opacity', list.refreshing && 'opacity-60')}>
              {(list.data ?? []).map((horse, index) => (
                <HorseCard key={horse.id} horse={horse} age={horseAge(horse.dateOfBirth, horse.dateOfDeath)} index={index} />
              ))}
            </div>
          )
        ) : (
          <DataTable
            flat
            rows={list.data ?? []}
            columns={columns}
            rowKey={(row) => row.id}
            onRowClick={(row) => navigate(links.horse(row.id))}
            pageSize={12}
            emptyTitle={isOwner ? 'Bạn chưa sở hữu ngựa nào' : 'Không có ngựa phù hợp bộ lọc'}
            emptyHint={isOwner ? undefined : mine ? 'Đang chỉ xem ngựa bạn phụ trách. Bỏ chọn để xem toàn câu lạc bộ.' : 'Thử bỏ bớt điều kiện lọc hoặc tìm theo tên khác.'}
            rowClassName={(row) => cn(isReadOnlyHorse(row) && 'opacity-60')}
          />
        )}
      </FilterTabs>
    </div>
  );
}
