import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { listClasses, type ClassRow } from '../../../services/training.service';
import {
  Button,
  ChipFilter,
  DataTable,
  ErrorBox,
  FilterSelect,
  Meter,
  PageHeader,
  SearchInput,
  Skeleton,
  Toolbar,
  type Column,
} from '../../../components/ui';
import { ClassPill, IntensityMeter } from '../../../components/ui/status';
import { classStatusLabel } from '../../../lib/labels';
import { formatDate, formatDateShort, toDateKey } from '../../../lib/format';
import { now } from '../../../lib/clock';
import { links } from '../../../lib/links';
import type { ClassStatus } from '../../../types/domain';
import { weekdayShort } from '../setup-components/helpers';

type StatusFilter = ClassStatus | '';

export default function ClassList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('');
  const [zoneId, setZoneId] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error } = useService(() => listClasses({ status, zoneId }), [status, zoneId]);

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return (data?.rows ?? []).filter(
      (row) => !term || `${row.name} ${row.programName} ${row.trainerName}`.toLocaleLowerCase('vi').includes(term),
    );
  }, [data, search]);

  const counts = data?.counts;
  const today = toDateKey(now());

  const columns: Column<ClassRow>[] = [
    {
      key: 'name',
      header: 'Lớp',
      className: 'min-w-[200px]',
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">Giáo án {row.programName}</p>
        </div>
      ),
    },
    {
      key: 'zone',
      header: 'Khu · HT phụ trách',
      render: (row) => (
        <div>
          <p className="text-gray-800">{row.zoneName}</p>
          <p className="text-xs text-gray-500">{row.trainerName}</p>
        </div>
      ),
    },
    {
      key: 'slot',
      header: 'Khung giờ',
      render: (row) => <span className="whitespace-nowrap text-sm text-gray-700 tabular-nums">{row.slotLabel}</span>,
    },
    {
      key: 'time',
      header: 'Thời gian',
      render: (row) => (
        <span className="whitespace-nowrap text-gray-700 tabular-nums">
          {formatDateShort(row.startDate)} → {formatDate(row.endDate)}
        </span>
      ),
    },
    {
      key: 'capacity',
      header: 'Sĩ số',
      className: 'w-36',
      render: (row) => (
        <div className="w-28">
          <div className="mb-1 flex justify-between text-xs tabular-nums">
            <span className="font-medium text-gray-800">
              {row.enrolled}/{row.capacity}
            </span>
            {row.enrolled >= row.capacity && <span className="text-gray-500">Đủ chỗ</span>}
          </div>
          <Meter value={row.enrolled} max={row.capacity} />
        </div>
      ),
    },
    { key: 'status', header: 'Trạng thái', render: (row) => <ClassPill status={row.status} /> },
    {
      key: 'progress',
      header: 'Tiến độ buổi',
      className: 'min-w-[190px]',
      render: (row) => (
        <div>
          <p className="text-sm text-gray-800 tabular-nums">
            <span className="font-medium">{row.sessionsDone}</span>
            <span className="text-gray-500">/{row.sessionsTotal} buổi</span>
          </p>
          {row.nextSession && (row.status === 'ACTIVE' || row.status === 'SCHEDULED') && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
              <IntensityMeter intensity={row.nextSession.intensity} showLabel={false} />
              Kế tiếp{' '}
              {row.nextSession.date === today
                ? 'hôm nay'
                : `${weekdayShort(row.nextSession.date)} ${formatDateShort(row.nextSession.date)}`}{' '}
              · {row.nextSession.subjectName}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lớp huấn luyện"
        description="Mỗi lớp mở từ một giáo án, thuộc một khu và một khung giờ cố định."
        actions={
          data?.canCreate ? (
            <Button onClick={() => navigate(links.classNew)}>
              <Plus size={16} /> Mở lớp
            </Button>
          ) : undefined
        }
      />

      <ChipFilter<StatusFilter>
        value={status}
        onChange={setStatus}
        options={[
          {
            value: '',
            label: 'Tất cả',
            count: counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : undefined,
          },
          ...(['ACTIVE', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as ClassStatus[]).map((value) => ({
            value,
            label: classStatusLabel[value],
            count: counts?.[value],
          })),
        ]}
      />

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm lớp, giáo án, HT…" className="min-w-[220px] flex-1" />
        <FilterSelect value={zoneId} onChange={setZoneId} label="Khu chuồng">
          <option value="">Mọi khu</option>
          {data?.zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </FilterSelect>
      </Toolbar>

      {error && <ErrorBox message={error} />}
      {loading && !data ? (
        <Skeleton rows={6} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(links.class(row.id))}
          rowClassName={(row) => (row.status === 'CANCELLED' ? 'opacity-70' : '')}
          emptyTitle="Không có lớp nào khớp bộ lọc"
          emptyHint={data?.canCreate ? 'Mở lớp mới từ một giáo án có sẵn.' : 'Bỏ bớt điều kiện lọc để xem thêm.'}
        />
      )}

      {data && !data.canCreate && data.rows.length > 0 && (
        <p className="text-xs text-gray-500">
          Chỉ xem. Mở, sửa, kết thúc sớm hoặc hủy lớp là việc của huấn luyện viên trưởng phụ trách khu.
        </p>
      )}
    </div>
  );
}
