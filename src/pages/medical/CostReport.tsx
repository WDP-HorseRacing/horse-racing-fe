// F3.10 — Báo cáo chi phí y tế (chỉ Club Manager): tổng chi phí các bệnh án đã đóng
// có ngày đóng trong khoảng [từ, đến], lọc theo khu và chủ ngựa hiện tại.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getCostReport } from '../../api/medical';
import { listBarns } from '../../api/stable';
import { listAllUsers } from '../../api/users';
import { Card, DataTable, ErrorBox, FilterSelect, Meter, NotFound, PageHeader, Skeleton, Toolbar } from '../../components/ui';
import { can } from '../../auth/permissions';
import { useStore } from '../../store/store';
import { formatDate, formatMoney, toDateKey } from '../../lib/format';
import { links } from '../../lib/links';
import { now } from '../../lib/clock';
import { HorseChip } from './components/parts';
import { DatePicker } from '../../components/ui/DatePicker';

function monthStart(): string {
  const date = now();
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

export default function CostReport() {
  const user = useStore((state) => state.currentUser);
  // Mở thẳng link khi không phải Quản lý CLB: báo không có quyền, không gọi API (BE trả 403).
  if (!can(user, 'medical.cost.report')) return <NotFound message="Báo cáo chi phí y tế dành cho Quản lý câu lạc bộ." />;
  return <CostReportPage />;
}

function CostReportPage() {
  const navigate = useNavigate();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => toDateKey(now()));
  const [barnId, setBarnId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const barns = useService(() => listBarns(), []);
  const owners = useService(() => listAllUsers({ role: 'HORSE_OWNER' }), []);
  const invalid = !from || !to || from > to;
  const report = useService(
    () => (invalid ? Promise.resolve(null) : getCostReport({ from, to, barnId: barnId || undefined, ownerId: ownerId || undefined })),
    [from, to, barnId, ownerId, invalid],
  );
  const top = useMemo(() => Math.max(1, ...(report.data?.items ?? []).map((item) => item.totalCost)), [report.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo chi phí y tế"
        description="Tổng chi phí các buổi khám trong khoảng ngày (theo ngày khám), trong hay ngoài bệnh án, gồm cả ngựa đã chuyển nhượng hoặc đã xóa hồ sơ."
      />

      <Toolbar>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          Từ
          <DatePicker value={from} max={to || undefined} onChange={setFrom} size="sm" className="w-40" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          đến
          <DatePicker value={to} min={from || undefined} onChange={setTo} size="sm" className="w-40" />
        </label>
        <FilterSelect value={barnId} onChange={setBarnId} label="Khu chuồng">
          <option value="">Mọi khu</option>
          {barns.data?.map((barn) => (
            <option key={barn.id} value={barn.id}>
              {barn.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={ownerId} onChange={setOwnerId} label="Chủ ngựa">
          <option value="">Mọi chủ ngựa</option>
          {owners.data?.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.fullName}
            </option>
          ))}
        </FilterSelect>
      </Toolbar>

      {invalid ? (
        <ErrorBox message="Ngày bắt đầu phải trước ngày kết thúc" />
      ) : report.loading && !report.data ? (
        <Skeleton rows={5} />
      ) : report.error ? (
        <ErrorBox message={report.error} />
      ) : (
        report.data && (
          <div className="grid items-start gap-5 lg:grid-cols-12">
            <Card className="lg:col-span-4">
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Wallet size={15} className="text-gray-400" /> Tổng chi phí
              </p>
              <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-gray-900 tabular-nums">{formatMoney(report.data.totalCost)}</p>
              <p className="mt-3 text-sm text-gray-600">
                {report.data.visitCount} buổi khám · {report.data.items.length} ngựa
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(report.data.from)} – {formatDate(report.data.to)}
              </p>
              <p className="mt-4 text-xs text-gray-500">Buổi khám đã hủy không tính. Lọc theo chủ ngựa tính theo giai đoạn sở hữu: buổi khám thuộc người làm chủ vào ngày khám. Lọc theo khu tính theo khu hiện tại của ngựa.</p>
            </Card>
            <div className="lg:col-span-8">
              <DataTable
                rows={report.data.items}
                rowKey={(row) => row.horseId}
                onRowClick={(row) => navigate(links.horseMedical(row.horseId))}
                pageSize={15}
                emptyTitle="Không có buổi khám nào trong khoảng này"
                emptyHint="Thử mở rộng khoảng ngày hoặc bỏ lọc khu, chủ ngựa."
                columns={[
                  { key: 'horse', header: 'Ngựa', render: (row) => <HorseChip horse={{ id: row.horseId, name: row.horseName }} plain /> },
                  { key: 'visits', header: 'Buổi khám', render: (row) => <span className="text-sm tabular-nums text-gray-700">{row.visitCount}</span> },
                  {
                    key: 'share',
                    header: 'Tỷ trọng',
                    className: 'w-48',
                    render: (row) => <Meter value={row.totalCost} max={top} />,
                  },
                  {
                    key: 'cost',
                    header: 'Chi phí',
                    className: 'text-right',
                    render: (row) => <span className="font-semibold tabular-nums text-gray-900">{formatMoney(row.totalCost)}</span>,
                  },
                ]}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}
