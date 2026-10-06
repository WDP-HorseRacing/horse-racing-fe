// F3.11 — Lịch chăm sóc định kỳ toàn CLB (VET, CM, HT): tiêm phòng, tẩy giun, kiểm tra móng.
// Khối "Cần làm" lấy từ bảng điều khiển (quá hạn + đến hạn trong 3 ngày); danh sách đầy đủ gom lịch
// đang chờ của từng ngựa (CLB nhỏ nên tải song song theo ngựa).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Syringe } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getMedicalDashboard, listCareSchedules } from '../../api/medical';
import type { CareSchedule, CareTaskType } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Button,
  Card,
  DataTable,
  ErrorBox,
  FilterSelect,
  PageHeader,
  SearchInput,
  SectionTitle,
  Skeleton,
  ToggleChip,
  Toolbar,
} from '../../components/ui';
import { careTypeLabel } from '../../lib/api-labels';
import { formatDateTime } from '../../lib/format';
import { links } from '../../lib/links';
import { CareDialogs, CareDue, CareRowActions, type CareDialog } from './components/care';
import { CARE_TYPES, careDaysLeft } from './components/care-rules';
import { horsePlace, listMedicalHorses } from './components/horses';
import { usePeople } from './components/people';
import { Count, HorseChip } from './components/parts';

type Row = CareSchedule & { horseName: string; place: string };

export default function CareSchedules() {
  const user = useStore((state) => state.currentUser);
  const canManage = can(user, 'care.manage');
  const people = usePeople();
  const board = useService(() => getMedicalDashboard(), []);
  const full = useService(async () => {
    const horses = await listMedicalHorses('all');
    const lists = await Promise.all(
      horses.map((horse) =>
        listCareSchedules(horse.id).then((items) =>
          items.filter((item) => item.status === 'SCHEDULED').map((item) => ({ ...item, horseName: horse.name, place: horsePlace(horse) })),
        ),
      ),
    );
    return {
      horses: horses.map((horse) => ({ id: horse.id, name: horse.name, place: horsePlace(horse) })),
      rows: lists.flat().sort((a, b) => a.dueAt.localeCompare(b.dueAt)) as Row[],
    };
  }, []);
  const [type, setType] = useState<CareTaskType | ''>('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<CareDialog>(null);
  const navigate = useNavigate();

  const all = useMemo(() => full.data?.rows ?? [], [full.data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((row) => !type || row.type === type)
      .filter((row) => !overdueOnly || careDaysLeft(row.dueAt) < 0)
      .filter((row) => !term || row.horseName.toLowerCase().includes(term));
  }, [all, type, overdueOnly, search]);
  const overdueCount = all.filter((row) => careDaysLeft(row.dueAt) < 0).length;

  const reload = () => {
    board.reload();
    full.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch chăm sóc"
        description="Tiêm phòng, tẩy giun, kiểm tra móng đang chờ thực hiện. Hệ thống nhắc bác sĩ và người được giao lúc 7 giờ sáng ngày đến hạn."
        actions={
          canManage && (
            <Button onClick={() => navigate(links.careNew())}>
              <CalendarPlus size={16} /> Tạo lịch
            </Button>
          )
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa…" className="min-w-52 flex-1" />
            <FilterSelect value={type} onChange={(value) => setType(value as CareTaskType | '')} label="Loại">
              <option value="">Mọi loại</option>
              {CARE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {careTypeLabel[value]}
                </option>
              ))}
            </FilterSelect>
            <ToggleChip checked={overdueOnly} onChange={setOverdueOnly}>
              Chỉ quá hạn{overdueCount > 0 ? ` (${overdueCount})` : ''}
            </ToggleChip>
          </Toolbar>
          {full.loading && !full.data ? (
            <Skeleton rows={6} />
          ) : full.error ? (
            <ErrorBox message={full.error} />
          ) : (
            <DataTable
              rows={rows}
              rowKey={(row) => row.id}
              pageSize={15}
              emptyTitle={all.length === 0 ? 'Chưa có lịch chăm sóc nào đang chờ' : 'Không có lịch phù hợp'}
              emptyHint={all.length === 0 ? 'Bác sĩ tạo lịch trong hồ sơ y tế của từng ngựa hoặc bằng nút Tạo lịch.' : 'Thử bỏ bớt bộ lọc.'}
              columns={[
                { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={{ id: row.horseId, name: row.horseName }} sub={row.place || undefined} /> },
                {
                  key: 'type',
                  header: 'Loại',
                  render: (row) => (
                    <div>
                      <p className="font-medium text-gray-900">{careTypeLabel[row.type]}</p>
                      {row.notes && <p className="line-clamp-1 max-w-56 text-xs text-gray-500">{row.notes}</p>}
                    </div>
                  ),
                },
                {
                  key: 'due',
                  header: 'Đến hạn',
                  render: (row) => (
                    <div className="space-y-1">
                      <p className="text-sm tabular-nums text-gray-700">{formatDateTime(row.dueAt)}</p>
                      <CareDue dueAt={row.dueAt} />
                    </div>
                  ),
                },
                {
                  key: 'assignee',
                  header: 'Người thực hiện',
                  render: (row) =>
                    row.assignedTo ? <span className="text-sm text-gray-700">{people.name(row.assignedTo)}</span> : <span className="text-xs text-gray-400">Chưa giao</span>,
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'text-right',
                  render: (row) => <CareRowActions schedule={row} horse={{ id: row.horseId, name: row.horseName }} onDialog={setDialog} />,
                },
              ]}
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          <Card>
            <SectionTitle icon={<Syringe size={16} />}>
              Cần làm trong 3 ngày{board.data && board.data.careSchedules.length > 0 && <Count value={board.data.careSchedules.length} />}
            </SectionTitle>
            {board.loading && !board.data ? (
              <Skeleton rows={2} />
            ) : board.error ? (
              <ErrorBox message={board.error} />
            ) : board.data!.careSchedules.length === 0 ? (
              <p className="text-sm text-gray-500">Không có lịch nào quá hạn hoặc đến hạn trong 3 ngày tới.</p>
            ) : (
              <ul className="-my-2 divide-y divide-gray-100">
                {board.data!.careSchedules.map((row) => (
                  <li key={row.scheduleId} className="flex items-center justify-between gap-3 py-2.5">
                    <HorseChip
                      horse={{ id: row.horseId, name: row.horseName }}
                      size={32}
                      sub={`${careTypeLabel[row.type]} · ${row.assignedTo ? people.name(row.assignedTo) : 'chưa giao'}`}
                    />
                    <CareDue dueAt={`${row.dueDate}T12:00:00`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="px-1 text-xs leading-relaxed text-gray-500">
            Người thực hiện là Groom đang phụ trách ngựa hoặc bác sĩ. Groom hoàn tất lịch được giao trong hồ sơ ngựa. Khi hoàn tất, bác sĩ có thể hẹn luôn lần tới.
          </p>
        </aside>
      </div>

      <CareDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={reload} />
    </div>
  );
}
