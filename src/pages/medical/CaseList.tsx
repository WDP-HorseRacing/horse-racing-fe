// F3.10 — Danh sách bệnh án.
// Nhân viên (CM, HT, VET): bệnh án đang mở toàn CLB (từ bảng điều khiển y tế); bệnh án đã đóng xem trong hồ sơ y tế của từng ngựa.
// Chủ ngựa: mọi bệnh án của ngựa mình sở hữu; chi phí chỉ có khi bệnh án đã đóng.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Info } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getMedicalDashboard, listHorseCases } from '../../api/medical';
import { listMyOwnedHorses } from '../../api/horses';
import type { CaseStatus, MedicalCase } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Button, ChipFilter, DataTable, ErrorBox, PageHeader, SearchInput, Skeleton, Toolbar, cn } from '../../components/ui';
import { CaseStatusPill } from '../../components/ui/status';
import { formatDate, formatMoney } from '../../lib/format';
import { links } from '../../lib/links';
import { HorseChip } from './components/parts';
import { todayKey } from './components/utils';

export default function CaseList() {
  const user = useStore((state) => state.currentUser);
  return user?.role === 'HORSE_OWNER' ? <OwnerCases /> : <StaffCases />;
}

function StaffCases() {
  const navigate = useNavigate();
  const user = useStore((state) => state.currentUser);
  const canOpen = can(user, 'case.open');
  const board = useService(() => getMedicalDashboard(), []);
  const [search, setSearch] = useState('');
  const all = useMemo(() => board.data?.openCases ?? [], [board.data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((row) => !term || `${row.horseName} ${row.initialDiagnosis}`.toLowerCase().includes(term));
  }, [all, search]);
  const today = todayKey();

  if (board.loading && !board.data) return <Skeleton rows={6} />;
  if (board.error) return <ErrorBox message={board.error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bệnh án đang điều trị"
        description="Mỗi ngựa tối đa một bệnh án đang mở. Hẹn tái khám sớm nhất lên trên."
        actions={
          canOpen && (
            <Button onClick={() => navigate(links.visitNew({ conclusion: 'ISSUE', back: links.cases }))}>
              <FolderPlus size={16} /> Mở bệnh án
            </Button>
          )
        }
      />

      <p className="flex items-start gap-2 text-sm text-gray-500">
        <Info size={15} className="mt-0.5 shrink-0 text-gray-400" />
        Bệnh án đã đóng hoặc đã hủy xem trong hồ sơ y tế của từng ngựa. Bệnh án được mở tại buổi khám khi bác sĩ kết luận Có vấn đề.
      </p>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa hoặc chẩn đoán…" className="min-w-60 flex-1" />
      </Toolbar>

      <DataTable
        rows={rows}
        rowKey={(row) => row.caseId}
        onRowClick={(row) => navigate(links.case(row.caseId))}
        pageSize={15}
        emptyTitle={all.length === 0 ? 'Không có bệnh án nào đang mở' : 'Không có bệnh án phù hợp'}
        emptyHint={all.length === 0 ? 'Khi bác sĩ kết luận Có vấn đề ở buổi khám, bệnh án mới sẽ hiện ở đây.' : undefined}
        columns={[
          { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={{ id: row.horseId, name: row.horseName }} /> },
          {
            key: 'diagnosis',
            header: 'Chẩn đoán ban đầu',
            className: 'min-w-[240px]',
            render: (row) => <p className="font-semibold text-gray-900">{row.initialDiagnosis}</p>,
          },
          { key: 'opened', header: 'Mở', render: (row) => <span className="text-sm text-gray-700">{formatDate(row.openedAt)}</span> },
          {
            key: 'last',
            header: 'Khám gần nhất',
            render: (row) => <span className="text-sm text-gray-700">{row.lastVisitAt ? formatDate(row.lastVisitAt) : '—'}</span>,
          },
          {
            key: 'next',
            header: 'Hẹn tái khám',
            render: (row) =>
              row.nextVisitAt ? (
                <span className={cn('text-sm', row.nextVisitAt.slice(0, 10) <= today ? 'font-medium text-amber-800' : 'text-gray-700')}>
                  {formatDate(row.nextVisitAt)}
                  {row.nextVisitAt.slice(0, 10) <= today && ' · đã tới hẹn'}
                </span>
              ) : (
                <span className="text-xs text-gray-400">Chưa hẹn</span>
              ),
          },
          { key: 'status', header: 'Trạng thái', render: () => <CaseStatusPill status="OPEN" /> },
        ]}
      />

    </div>
  );
}

type OwnerCase = MedicalCase & { horseName: string };

function OwnerCases() {
  const navigate = useNavigate();
  const list = useService(async () => {
    const horses = await listMyOwnedHorses();
    const lists = await Promise.all(horses.map((horse) => listHorseCases(horse.id).then((result) => result.items.map((item) => ({ ...item, horseName: horse.name })))));
    return lists.flat().sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }, []);
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [search, setSearch] = useState('');
  const all = useMemo<OwnerCase[]>(() => list.data ?? [], [list.data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((row) => !status || row.status === status)
      .filter((row) => !term || `${row.horseName} ${row.initialDiagnosis}`.toLowerCase().includes(term));
  }, [all, status, search]);

  if (list.loading && !list.data) return <Skeleton rows={6} />;
  if (list.error) return <ErrorBox message={list.error} />;

  const closed = all.filter((row) => row.status === 'CLOSED');
  const totalCost = closed.reduce((sum, row) => sum + (row.totalCost ?? 0), 0);
  const count = (value: CaseStatus) => all.filter((row) => row.status === value).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Bệnh án của ngựa tôi" description="Quá trình điều trị của ngựa bạn sở hữu. Chi phí chỉ hiện khi bệnh án đã đóng." />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <ChipFilter<CaseStatus | ''>
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Tất cả', count: all.length },
            { value: 'OPEN', label: 'Đang điều trị', count: count('OPEN') },
            { value: 'CLOSED', label: 'Đã đóng', count: closed.length },
            { value: 'CANCELLED', label: 'Đã hủy', count: count('CANCELLED') },
          ]}
        />
        <p className="text-sm text-gray-500">
          Tổng chi phí {closed.length} bệnh án đã đóng <span className="font-semibold tabular-nums text-gray-900">{formatMoney(totalCost)}</span>
        </p>
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa hoặc chẩn đoán…" className="min-w-60 flex-1" />
      </Toolbar>

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(links.case(row.id))}
        pageSize={15}
        emptyTitle={all.length === 0 ? 'Ngựa của bạn chưa có bệnh án nào' : 'Không có bệnh án phù hợp'}
        emptyHint={all.length === 0 ? 'Bệnh án được mở khi bác sĩ phát hiện vấn đề tại buổi khám.' : undefined}
        columns={[
          { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={{ id: row.horseId, name: row.horseName }} /> },
          {
            key: 'diagnosis',
            header: 'Chẩn đoán ban đầu',
            className: 'min-w-[220px]',
            render: (row) => (
              <div>
                <p className="font-semibold text-gray-900">{row.initialDiagnosis}</p>
                {row.finalConclusion && <p className="line-clamp-1 text-xs text-gray-500">{row.finalConclusion}</p>}
              </div>
            ),
          },
          { key: 'status', header: 'Trạng thái', render: (row) => <CaseStatusPill status={row.status} /> },
          { key: 'opened', header: 'Mở', render: (row) => <span className="text-sm text-gray-700">{formatDate(row.openedAt)}</span> },
          { key: 'closed', header: 'Đóng', render: (row) => <span className="text-sm text-gray-700">{row.closedAt ? formatDate(row.closedAt) : '—'}</span> },
          {
            key: 'cost',
            header: 'Chi phí',
            className: 'text-right',
            render: (row) =>
              row.status === 'CLOSED' ? (
                <span className="font-semibold tabular-nums text-gray-900">{formatMoney(row.totalCost)}</span>
              ) : (
                <span className="text-xs text-gray-500">{row.status === 'OPEN' ? 'Chốt khi đóng' : '—'}</span>
              ),
          },
        ]}
      />
    </div>
  );
}
