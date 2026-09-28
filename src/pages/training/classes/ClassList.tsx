import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, CalendarClock, CheckCircle2, PlayCircle, Plus } from 'lucide-react';
import { useService } from '../../../hooks/useService';
import { listClasses, type ClassRow } from '../../../services/training.service';
import {
  Button,
  cn,
  DataTable,
  ErrorBox,
  FilterSelect,
  Meter,
  PageHeader,
  Pill,
  SearchInput,
  Segmented,
  Skeleton,
  Stat,
  Toolbar,
  type Column,
} from '../../../components/ui';
import { ClassPill, intensityDot } from '../../../components/ui/status';
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
  const toggle = (value: ClassStatus) => setStatus((current) => (current === value ? '' : value));

  const columns: Column<ClassRow>[] = [
    {
      key: 'name',
      header: 'Lớp',
      className: 'min-w-[200px]',
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">{row.name}</p>
          <p className="text-xs font-light text-gray-500">Giáo án {row.programName}</p>
        </div>
      ),
    },
    {
      key: 'zone',
      header: 'Khu · HT phụ trách',
      render: (row) => (
        <div>
          <p className="text-gray-800">{row.zoneName}</p>
          <p className="text-xs font-light text-gray-500">{row.trainerName}</p>
        </div>
      ),
    },
    {
      key: 'slot',
      header: 'Khung giờ',
      render: (row) => <span className="font-mono text-xs font-medium text-gray-700">{row.slotLabel}</span>,
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
            <span className="font-semibold text-gray-800">
              {row.enrolled}/{row.capacity}
            </span>
            {row.enrolled >= row.capacity && <span className="text-amber-700">Đủ</span>}
          </div>
          <Meter value={row.enrolled} max={row.capacity} tone={row.enrolled >= row.capacity ? 'amber' : 'green'} />
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
            <span className="font-semibold">{row.sessionsDone}</span>
            <span className="text-gray-400">/{row.sessionsTotal} buổi</span>
          </p>
          {row.nextSession && (row.status === 'ACTIVE' || row.status === 'SCHEDULED') && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
              <span className={cn('h-1.5 w-1.5 rounded-full', intensityDot[row.nextSession.intensity])} />
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
        eyebrow="Huấn luyện · lớp học"
        title="Lớp huấn luyện"
        description="Mỗi lớp mở từ một giáo án, thuộc một khu và một khung giờ cố định. Buổi học thuộc về lớp; ngựa vào lớp bằng đăng ký."
        actions={
          data?.canCreate ? (
            <Button onClick={() => navigate(links.classNew)}>
              <Plus size={16} /> Mở lớp
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <Stat
          className="lg:col-span-4"
          value={counts?.ACTIVE ?? '—'}
          label="Đang chạy"
          hint="Lớp trong thời gian học"
          icon={<PlayCircle size={20} />}
          tone="success"
          active={status === 'ACTIVE'}
          onClick={() => toggle('ACTIVE')}
        />
        <Stat
          className="lg:col-span-3"
          value={counts?.SCHEDULED ?? '—'}
          label="Sắp tới"
          hint="Chưa tới ngày bắt đầu"
          icon={<CalendarClock size={20} />}
          active={status === 'SCHEDULED'}
          onClick={() => toggle('SCHEDULED')}
        />
        <Stat
          className="lg:col-span-3"
          value={counts?.COMPLETED ?? '—'}
          label="Đã kết thúc"
          icon={<CheckCircle2 size={20} />}
          active={status === 'COMPLETED'}
          onClick={() => toggle('COMPLETED')}
        />
        <Stat
          className="lg:col-span-2"
          value={counts?.CANCELLED ?? '—'}
          label="Đã hủy"
          icon={<Ban size={20} />}
          tone="danger"
          active={status === 'CANCELLED'}
          onClick={() => toggle('CANCELLED')}
        />
      </div>

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
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Tất cả' },
            ...(['ACTIVE', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as ClassStatus[]).map((value) => ({
              value,
              label: classStatusLabel[value],
            })),
          ]}
        />
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
        <p className="text-xs font-light text-gray-400">
          <Pill tone="slate" className="mr-2">
            Chỉ xem
          </Pill>
          Mở, sửa, kết thúc sớm hoặc hủy lớp là việc của huấn luyện viên trưởng phụ trách khu.
        </p>
      )}
    </div>
  );
}
