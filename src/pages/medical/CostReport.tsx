// F3.10 — Chi phí y tế (chỉ Club Manager), hiện ở Báo cáo › Tài chính › Y tế: tổng chi phí các buổi khám chưa hủy
// có ngày khám trong kỳ [từ, đến], trong hay ngoài bệnh án, lọc theo khu lúc khám và người làm chủ vào ngày khám.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useService } from '../../hooks/useService';
import { getCostReport } from '../../api/medical';
import { listBarns } from '../../api/stable';
import { listAllUsers } from '../../api/users';
import { Card, DataTable, ErrorBox, FilterSelect, Meter, Skeleton, Toolbar, cn } from '../../components/ui';
import { formatDate, formatMoney } from '../../lib/format';
import { links } from '../../lib/links';
import { HorseChip } from './components/parts';

/** Kỳ do trang chứa quyết định (thanh chọn kỳ của Báo cáo). */
export function MedicalCostView({ from, to }: { from: string; to: string }) {
  const navigate = useNavigate();
  const [barnId, setBarnId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const barns = useService(() => listBarns(), []);
  const owners = useService(() => listAllUsers({ role: 'HORSE_OWNER' }), []);
  const report = useService(() => getCostReport({ from, to, barnId: barnId || undefined, ownerId: ownerId || undefined }), [from, to, barnId, ownerId]);
  const top = useMemo(() => Math.max(1, ...(report.data?.items ?? []).map((item) => item.totalCost)), [report.data]);

  return (
    <div className="space-y-4">
      <Toolbar>
        <FilterSelect value={barnId} onChange={setBarnId} label="Khu của ngựa lúc khám">
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

      {report.loading && !report.data ? (
        <Skeleton rows={5} />
      ) : report.error ? (
        <ErrorBox message={report.error} />
      ) : (
        report.data && (
          <div className={cn('grid items-start gap-5 transition-opacity lg:grid-cols-12', report.loading && 'opacity-60')}>
            <Card className="lg:col-span-4">
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Wallet size={15} className="text-gray-400" /> Tổng chi phí y tế
              </p>
              <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-gray-900 tabular-nums">{formatMoney(report.data.totalCost)}</p>
              <p className="mt-3 text-sm text-gray-600">
                {report.data.visitCount} buổi khám · {report.data.items.length} ngựa
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(report.data.from)} – {formatDate(report.data.to)}
              </p>
              <p className="mt-4 text-xs text-gray-500">
                Tính theo ngày khám, trong hay ngoài bệnh án, gồm cả ngựa đã chuyển nhượng hoặc đã xóa hồ sơ. Buổi khám đã hủy không tính. Lọc theo chủ ngựa tính theo giai đoạn sở hữu: buổi khám thuộc người làm chủ vào ngày khám. Lọc theo khu tính theo khu ngựa ở lúc khám, nên ngựa đã đổi khu vẫn tính đúng chỗ cũ.
              </p>
            </Card>
            <div className="lg:col-span-8">
              <DataTable
                rows={report.data.items}
                rowKey={(row) => row.horseId}
                onRowClick={(row) => navigate(links.horseMedical(row.horseId))}
                pageSize={15}
                emptyTitle="Không có buổi khám nào trong kỳ này"
                emptyHint="Thử mở rộng kỳ hoặc bỏ lọc khu, chủ ngựa."
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
