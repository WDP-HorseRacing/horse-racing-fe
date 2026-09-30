// F3.2 — Lịch khám định kỳ (VET, CM, HT) từ GET /medical/checkups.
// Chu kỳ cố định 30 ngày (không có chỗ sửa). VET đặt / dời ngày hẹn và ghi buổi khám định kỳ.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Repeat, Stethoscope } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listCheckups } from '../../api/medical';
import { listBarns } from '../../api/stable';
import type { CheckupDueStatus, CheckupItem } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Button, ChipFilter, DataTable, ErrorBox, FilterSelect, PageHeader, SearchInput, Skeleton, Toolbar } from '../../components/ui';
import { HealthPill } from '../../components/ui/status';
import { checkupStatusLabel } from '../../lib/api-labels';
import { formatDate, formatDateTime } from '../../lib/format';
import { links } from '../../lib/links';
import { AppointmentModal } from './components/modals';
import { CheckupDue, HorseChip } from './components/parts';

export default function PeriodicExams() {
  const user = useStore((state) => state.currentUser);
  const isVet = can(user, 'exam.record');
  const canAppoint = can(user, 'checkup.appointment');
  const [barnId, setBarnId] = useState('');
  const [status, setStatus] = useState<CheckupDueStatus | ''>('');
  const [search, setSearch] = useState('');
  const barns = useService(() => listBarns(), []);
  const list = useService(() => listCheckups({ barnId: barnId || undefined }), [barnId]);
  const navigate = useNavigate();
  const exam = (horseId?: string) => navigate(links.visitNew({ horseId, kind: 'ROUTINE', back: links.periodic }));
  const [appointing, setAppointing] = useState<CheckupItem | null>(null);

  const barnName = useMemo(() => new Map((barns.data ?? []).map((barn) => [barn.id, barn.name])), [barns.data]);
  const all = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => {
    const result: Record<CheckupDueStatus, number> = { OK: 0, DUE_SOON: 0, OVERDUE: 0 };
    all.forEach((row) => {
      result[row.dueStatus] += 1;
    });
    return result;
  }, [all]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((row) => !status || row.dueStatus === status).filter((row) => !term || row.horseName.toLowerCase().includes(term));
  }, [all, status, search]);

  if (list.loading && !list.data) return <Skeleton rows={6} />;
  if (list.error && !list.data) return <ErrorBox message={list.error} />;

  const alertCount = all.filter((row) => row.dueStatus === 'OVERDUE' && row.daysLeft < -7).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khám định kỳ"
        description="Hạn khám của từng ngựa, quá hạn lên đầu. Buổi khám định kỳ kết luận bình thường là bản ghi độc lập, không có chi phí."
        actions={
          isVet && (
            <Button onClick={() => exam()}>
              <Stethoscope size={16} /> Ghi buổi khám định kỳ
            </Button>
          )
        }
      />

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
        <Repeat size={14} className="text-gray-400" />
        Chu kỳ cố định 30 ngày: hạn = buổi khám gần nhất (mọi loại, kể cả trong bệnh án) + 30 ngày. Quá hạn hơn 7 ngày thì bác sĩ và quản lý nhận thông báo.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <ChipFilter<CheckupDueStatus | ''>
          value={status}
          onChange={(value) => setStatus(value === status ? '' : value)}
          options={[
            { value: '', label: 'Tất cả', count: all.length },
            { value: 'OVERDUE', label: checkupStatusLabel.OVERDUE, count: counts.OVERDUE },
            { value: 'DUE_SOON', label: checkupStatusLabel.DUE_SOON, count: counts.DUE_SOON },
            { value: 'OK', label: checkupStatusLabel.OK, count: counts.OK },
          ]}
        />
        {alertCount > 0 && <span className="text-sm font-medium text-red-700">{alertCount} ngựa quá hạn hơn 7 ngày</span>}
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa…" className="min-w-60 flex-1" />
        <FilterSelect value={barnId} onChange={setBarnId} label="Khu chuồng">
          <option value="">Mọi khu</option>
          {barns.data?.map((barn) => (
            <option key={barn.id} value={barn.id}>
              {barn.name}
            </option>
          ))}
        </FilterSelect>
      </Toolbar>
      {list.error && <ErrorBox message={list.error} />}

      <DataTable
        rows={rows}
        rowKey={(row) => row.horseId}
        pageSize={20}
        emptyTitle={all.length === 0 ? 'Chưa có ngựa nào cần khám định kỳ' : 'Không có ngựa phù hợp'}
        emptyHint={all.length === 0 ? 'Ngựa đang hoạt động hoặc đã giải nghệ đều có hạn khám; ngựa đã chuyển nhượng thì không.' : 'Thử bỏ bộ lọc tình trạng hoặc khu.'}
        columns={[
          {
            key: 'horse',
            header: 'Ngựa',
            render: (row) => <HorseChip horse={{ id: row.horseId, name: row.horseName }} sub={row.barnId ? barnName.get(row.barnId) : 'Chưa xếp khu'} />,
          },
          { key: 'health', header: 'Sức khỏe', render: (row) => <HealthPill status={row.healthStatus} /> },
          {
            key: 'last',
            header: 'Buổi khám gần nhất',
            render: (row) =>
              row.lastVisitDate ? (
                <span className="text-sm text-gray-700">{formatDate(row.lastVisitDate)}</span>
              ) : (
                <span className="text-xs text-gray-500">Chưa khám, tính từ ngày tạo hồ sơ</span>
              ),
          },
          {
            key: 'due',
            header: 'Hạn khám',
            render: (row) => (
              <div className="space-y-1">
                <p className="font-semibold tabular-nums text-gray-900">{formatDate(row.dueDate)}</p>
                <CheckupDue status={row.dueStatus} daysLeft={row.daysLeft} />
              </div>
            ),
          },
          {
            key: 'appointment',
            header: 'Ngày hẹn',
            render: (row) =>
              row.appointment ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                  <CalendarClock size={13} className="text-gray-400" /> {formatDateTime(row.appointment.scheduledAt)}
                </span>
              ) : (
                <span className="text-xs text-gray-400">Chưa hẹn</span>
              ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (row) =>
              isVet || canAppoint ? (
                <div className="flex justify-end gap-1">
                  {canAppoint && (
                    <Button size="sm" variant="ghost" onClick={() => setAppointing(row)}>
                      {row.appointment ? 'Dời hẹn' : 'Đặt hẹn'}
                    </Button>
                  )}
                  {isVet && (
                    <Button size="sm" variant="secondary" onClick={() => exam(row.horseId)}>
                      <Stethoscope size={14} /> Ghi khám
                    </Button>
                  )}
                </div>
              ) : null,
          },
        ]}
      />

      {appointing && (
        <AppointmentModal
          item={appointing}
          onClose={() => setAppointing(null)}
          onDone={() => {
            setAppointing(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
