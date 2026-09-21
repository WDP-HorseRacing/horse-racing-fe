import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, X } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listHorses, listZones, type HorseFilters } from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Avatar,
  Button,
  Card,
  DataTable,
  ErrorBox,
  PageHeader,
  Pill,
  SearchInput,
  Select,
  Skeleton,
  type Column,
} from '../../components/ui';
import { HealthPill, LifecyclePill } from '../../components/ui/status';
import { distanceLabel, healthLabel, lifecycleLabel, sexLabel } from '../../lib/labels';
import { formatDate } from '../../lib/format';
import type { HorseRow } from '../../services/horse.service';

export default function HorseList() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const isManager = currentUser?.role === 'CLUB_MANAGER';

  const [filters, setFilters] = useState<HorseFilters>({
    search: '',
    sex: '',
    distancePreference: '',
    healthStatus: '',
    lifecycleStatus: '',
    zoneId: '',
    includeDeleted: false,
    includeReference: false,
  });

  const zones = useService(() => listZones(), []);
  const { data, loading, error } = useService(
    () => listHorses(filters),
    [
      filters.search,
      filters.sex,
      filters.distancePreference,
      filters.healthStatus,
      filters.lifecycleStatus,
      filters.zoneId,
      filters.includeDeleted,
      filters.includeReference,
    ],
  );

  const update = (patch: Partial<HorseFilters>) => setFilters((current) => ({ ...current, ...patch }));

  const columns = useMemo<Column<HorseRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Ngựa',
        render: (row) => (
          <div className="flex items-center gap-3">
            <Avatar src={row.avatar} name={row.name} size={38} />
            <div className="min-w-0">
              <p className={`truncate font-semibold text-gray-900 ${row.deleted ? 'line-through' : ''}`}>
                {row.name}
              </p>
              <p className="font-mono text-xs text-gray-400">{row.chipNumber ?? 'Chưa gắn chip'}</p>
            </div>
            {row.isReference && <Pill tone="gray">Tham chiếu</Pill>}
            {row.deleted && <Pill tone="red">Đã xóa</Pill>}
          </div>
        ),
      },
      {
        key: 'basic',
        header: 'Giới tính · Giống · Tuổi',
        render: (row) => (
          <div className="text-sm">
            <p className="text-gray-700">
              {sexLabel[row.sex]} · {row.breed ?? '—'}
            </p>
            <p className="text-xs text-gray-400">
              {row.birthDate ? `${formatDate(row.birthDate)} · ${row.age} tuổi` : 'Chưa có ngày sinh'}
            </p>
          </div>
        ),
      },
      {
        key: 'preference',
        header: 'Sở trường',
        render: (row) => (
          <span className="text-sm text-gray-600">
            {row.distancePreference ? distanceLabel[row.distancePreference] : '—'}
          </span>
        ),
      },
      {
        key: 'health',
        header: 'Sức khỏe · Vòng đời',
        render: (row) => (
          <div className="flex flex-wrap gap-1.5">
            <HealthPill status={row.healthStatus} />
            <LifecyclePill status={row.lifecycleStatus} />
          </div>
        ),
      },
      {
        key: 'stall',
        header: 'Chuồng',
        render: (row) => (
          <div className="text-sm">
            <p className="text-gray-700">{row.stallCode ?? '—'}</p>
            <p className="text-xs text-gray-400">{row.zoneName ?? 'Chưa xếp chuồng'}</p>
          </div>
        ),
      },
      {
        key: 'race',
        header: 'Được đua',
        render: (row) =>
          row.raceAllowed ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <Check size={15} /> Có
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-400" title={row.raceReason}>
              <X size={15} className="text-red-400" />
              <span className="max-w-[160px] truncate">{row.raceReason}</span>
            </span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={currentUser?.role === 'HORSE_OWNER' ? 'Ngựa của tôi' : 'Danh sách ngựa'}
        description={
          currentUser?.role === 'HORSE_OWNER'
            ? 'Hồ sơ những con ngựa bạn đang sở hữu.'
            : 'Ngựa cần chú ý được xếp lên đầu danh sách.'
        }
        actions={
          can(currentUser, 'horse.create') ? (
            <Button onClick={() => navigate('/horses/new')}>
              <Plus size={16} /> Thêm ngựa mới
            </Button>
          ) : undefined
        }
      />

      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput
            value={filters.search ?? ''}
            onChange={(value) => update({ search: value })}
            placeholder="Tìm theo tên hoặc số chip…"
            className="sm:col-span-2"
          />
          <Select value={filters.healthStatus} onChange={(event) => update({ healthStatus: event.target.value as never })}>
            <option value="">Mọi trạng thái sức khỏe</option>
            {Object.entries(healthLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={filters.lifecycleStatus} onChange={(event) => update({ lifecycleStatus: event.target.value as never })}>
            <option value="">Mọi vòng đời</option>
            {Object.entries(lifecycleLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={filters.sex} onChange={(event) => update({ sex: event.target.value as never })}>
            <option value="">Mọi giới tính</option>
            {Object.entries(sexLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={filters.distancePreference}
            onChange={(event) => update({ distancePreference: event.target.value as never })}
          >
            <option value="">Mọi sở trường</option>
            {Object.entries(distanceLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={filters.zoneId} onChange={(event) => update({ zoneId: event.target.value })}>
            <option value="">Mọi khu chuồng</option>
            {zones.data?.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
        </div>

        {isManager && (
          <div className="flex flex-wrap gap-5 border-t border-gray-50 pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={filters.includeReference}
                onChange={(event) => update({ includeReference: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
              />
              Hiện ngựa tham chiếu
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={filters.includeDeleted}
                onChange={(event) => update({ includeDeleted: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
              />
              Hiện hồ sơ đã xóa
            </label>
          </div>
        )}
      </Card>

      {error && <ErrorBox message={error} />}
      {loading && <Skeleton rows={5} />}
      {!loading && data && (
        <DataTable
          rows={data}
          columns={columns}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/horses/${row.id}`)}
          emptyTitle="Không có ngựa nào khớp bộ lọc"
          emptyHint="Thử bỏ bớt một vài điều kiện lọc hoặc xóa từ khóa tìm kiếm."
        />
      )}
    </div>
  );
}
