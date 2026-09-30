// F3.10 — Danh sách bệnh án. VET mở bệnh án (F3.5); CM, HT, OWNER xem (HT không thấy chi phí).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Lock } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { listCases } from '../../services/medical.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Button,
  ChipFilter,
  DataTable,
  ErrorBox,
  PageHeader,
  Pill,
  SearchInput,
  Skeleton,
  Toolbar,
  cn,
} from '../../components/ui';
import { CasePill } from '../../components/ui/status';
import { formatDate, formatMoney, toDateKey } from '../../lib/format';
import { links } from '../../lib/links';
import { now } from '../../lib/clock';
import type { MedicalCaseStatus } from '../../types/domain';
import ExaminationSheet from './components/ExaminationSheet';
import { HorseChip } from './components/parts';

export default function CaseList() {
  const navigate = useNavigate();
  const user = useStore((state) => state.currentUser);
  const list = useService(() => listCases(), []);
  const [status, setStatus] = useState<MedicalCaseStatus | ''>('');
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState(false);

  const isOwner = user?.role === 'HORSE_OWNER';
  const costVisible = can(user, 'medical.cost.view');
  const canOpen = can(user, 'case.open');
  const all = useMemo(() => list.data ?? [], [list.data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((row) => !status || row.status === status)
      .filter((row) => !term || `${row.horse.name} ${row.title}`.toLowerCase().includes(term));
  }, [all, status, search]);

  if (list.loading && !list.data) return <Skeleton rows={6} />;
  if (list.error) return <ErrorBox message={list.error} />;

  const openCount = all.filter((row) => row.status === 'OPEN').length;
  const closed = all.filter((row) => row.status === 'CLOSED');
  const totalCost = closed.reduce((sum, row) => sum + (row.cost ?? 0), 0);
  const todayKey = toDateKey(now());

  return (
    <div className="space-y-6">
      <PageHeader
        title={isOwner ? 'Bệnh án của ngựa tôi' : 'Bệnh án'}
        description={
          isOwner
            ? 'Quá trình điều trị của ngựa bạn sở hữu; chi phí chỉ hiện khi bệnh án đã đóng.'
            : 'Mỗi ngựa tối đa một bệnh án đang mở; chi phí chốt một lần khi đóng.'
        }
        actions={
          canOpen && (
            <Button onClick={() => setOpening(true)}>
              <FolderPlus size={16} /> Mở bệnh án
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <ChipFilter<MedicalCaseStatus | ''>
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Tất cả', count: all.length },
            { value: 'OPEN', label: 'Đang điều trị', count: openCount, dot: 'warn' },
            { value: 'CLOSED', label: 'Đã đóng', count: closed.length },
          ]}
        />
        {costVisible ? (
          <p className="text-sm text-gray-500" title="Bệnh án đang mở chưa có chi phí — nhập một lần khi đóng. Khám định kỳ không có chi phí.">
            Tổng chi phí {closed.length} bệnh án đã đóng{' '}
            <span className="font-semibold tabular-nums text-gray-900">{formatMoney(totalCost)}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">Chi phí y tế không hiển thị với vai trò của bạn.</p>
        )}
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa hoặc tiêu đề bệnh án…" className="min-w-60 flex-1" />
      </Toolbar>

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(links.case(row.id))}
        pageSize={15}
        emptyTitle={all.length === 0 ? 'Chưa có bệnh án nào' : 'Không có bệnh án phù hợp'}
        emptyHint={all.length === 0 ? 'Bệnh án được mở tại buổi khám khi bác sĩ phát hiện vấn đề.' : undefined}
        columns={[
          { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={row.horse} /> },
          {
            key: 'title',
            header: 'Bệnh án',
            className: 'min-w-[220px]',
            render: (row) => (
              <div>
                <p className="font-semibold text-gray-900">{row.title}</p>
                <p className="text-xs text-gray-500">
                  {row.fromPeriodic ? 'Mở từ buổi khám định kỳ' : 'Mở từ yêu cầu khám'} · {row.examCount} buổi khám
                </p>
              </div>
            ),
          },
          { key: 'status', header: 'Trạng thái', render: (row) => <CasePill status={row.status} /> },
          {
            key: 'opened',
            header: 'Mở',
            render: (row) => (
              <div className="text-xs">
                <p className="font-medium text-gray-700">{formatDate(row.openedAt)}</p>
                <p className="text-gray-500">{row.openedByName}</p>
              </div>
            ),
          },
          {
            key: 'closed',
            header: 'Đóng / hẹn tiếp',
            render: (row) =>
              row.status === 'CLOSED' ? (
                <div className="text-xs">
                  <p className="font-medium text-gray-700">{formatDate(row.closedAt)}</p>
                  <p className="text-gray-500">{row.closedByName}</p>
                </div>
              ) : row.nextAppointment ? (
                <span className={cn('text-xs', row.nextAppointment <= todayKey ? 'font-medium text-amber-800' : 'text-gray-600')}>
                  Hẹn {formatDate(row.nextAppointment)}
                </span>
              ) : (
                <span className="text-xs text-gray-300">—</span>
              ),
          },
          {
            key: 'lock',
            header: 'Khóa liên quan',
            render: (row) =>
              row.activeLock ? (
                <Pill tone="red" title={row.activeLock.reason}>
                  <Lock size={11} /> Còn hiệu lực
                </Pill>
              ) : (
                <span className="text-xs text-gray-300">—</span>
              ),
          },
          ...(costVisible
            ? [
                {
                  key: 'cost',
                  header: 'Chi phí',
                  className: 'text-right',
                  render: (row: (typeof rows)[number]) =>
                    row.cost !== undefined ? (
                      <span className="font-semibold tabular-nums text-gray-900">{formatMoney(row.cost)}</span>
                    ) : (
                      <span className="text-xs text-gray-500">{row.status === 'OPEN' ? 'Chốt khi đóng' : '—'}</span>
                    ),
                },
              ]
            : []),
        ]}
      />

      {opening && (
        <ExaminationSheet
          kind="CASE"
          newCase
          onClose={() => setOpening(false)}
          onDone={(result) => {
            setOpening(false);
            if (result.caseId) navigate(links.case(result.caseId));
            else list.reload();
          }}
        />
      )}
    </div>
  );
}
