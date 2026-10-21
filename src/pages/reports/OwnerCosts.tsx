// Chi phí của một chủ ngựa theo kỳ: phí nuôi (theo ngày), phụ phí và chi phí y tế (theo ngày khám), từng ngựa.
// Quản lý CLB mở từ báo cáo tài chính (/reports/owners/:ownerId). Chủ ngựa xem của mình (/reports/my-costs), BE bỏ qua ownerId.
import { useNavigate, useParams } from 'react-router-dom';
import { getOwnerCosts } from '../../api/reports';
import { can } from '../../auth/permissions';
import { BackLink } from '../../components/BackLink';
import { useCrumbs } from '../../components/Breadcrumb';
import { PeriodBar } from '../../components/PeriodBar';
import { DataTable, ErrorBox, NotFound, PageHeader, Skeleton, cn } from '../../components/ui';
import { usePeriod } from '../../hooks/usePeriod';
import { useService } from '../../hooks/useService';
import { formatDate, formatMoney } from '../../lib/format';
import { links } from '../../lib/links';
import { useStore } from '../../store/store';
import { SplitBar, StatTile } from './parts';

export default function OwnerCosts() {
  const user = useStore((state) => state.currentUser);
  const navigate = useNavigate();
  const { ownerId } = useParams();
  const period = usePeriod();
  const manager = can(user, 'report.finance');
  const self = can(user, 'report.ownerCosts');
  const allowed = manager ? !!ownerId : self;
  const report = useService(
    () => (!allowed || period.invalid ? Promise.resolve(null) : getOwnerCosts({ from: period.from, to: period.to, ownerId: manager ? ownerId : undefined })),
    [allowed, manager, ownerId, period.from, period.to, period.invalid],
  );
  const data = report.data;
  useCrumbs(!allowed ? null : manager ? [{ label: 'Báo cáo', to: links.reports('finance') }, { label: data?.ownerName ?? 'Chi phí chủ ngựa' }] : [{ label: 'Chi phí' }]);

  if (!allowed) return <NotFound />;

  return (
    <div className="space-y-6">
      {manager && <BackLink fallback={links.reports('finance')}>Báo cáo tài chính</BackLink>}
      <PageHeader
        title={manager ? `Chi phí của ${data?.ownerName ?? 'chủ ngựa'}` : 'Chi phí'}
        description="Phí nuôi theo ngày, phụ phí riêng từng ngựa và chi phí y tế của các buổi khám trong kỳ."
      />
      <PeriodBar period={period} />

      {period.invalid ? null : report.loading && !data ? (
        <Skeleton rows={5} />
      ) : report.error ? (
        <ErrorBox message={report.error} />
      ) : (
        data && (
          <div className={cn('space-y-5 transition-opacity', report.loading && 'opacity-60')}>
            <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
              <section className="rounded-3xl bg-white p-6 shadow-grass-tint ring-1 ring-emerald-100 lg:col-span-8">
                <p className="text-sm text-gray-500">Tổng chi phí</p>
                <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-emerald-900 sm:text-5xl">{formatMoney(data.total)}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {formatDate(data.from)} đến {formatDate(data.to)} · {data.horses.length} ngựa
                </p>
                <SplitBar
                  className="mt-5"
                  parts={[
                    { key: 'fee', label: 'Phí nuôi', value: data.dailyFee, color: '#059669', text: formatMoney(data.dailyFee) },
                    { key: 'surcharge', label: 'Phụ phí', value: data.surcharge, color: '#84cc16', text: formatMoney(data.surcharge) },
                    { key: 'medical', label: 'Y tế', value: data.medicalCost, color: '#f59e0b', text: formatMoney(data.medicalCost) },
                  ]}
                />
              </section>
              <StatTile label="Tiền thưởng" value={formatMoney(data.prizeMoney)} sub="Chưa có giải đua" tone="muted" className="lg:col-span-4" />
            </div>

            <DataTable
              rows={data.horses}
              rowKey={(row) => row.horseId}
              onRowClick={(row) => navigate(links.horse(row.horseId))}
              pageSize={15}
              emptyTitle="Không có ngựa nào trong kỳ này"
              columns={[
                { key: 'horse', header: 'Ngựa', render: (row) => <span className="font-semibold text-gray-900">{row.horseName}</span> },
                { key: 'days', header: 'Ngày tính phí', className: 'text-right', render: (row) => <span className="tabular-nums text-gray-700">{row.billedDays}</span> },
                { key: 'fee', header: 'Phí nuôi', className: 'text-right', render: (row) => <span className="tabular-nums text-gray-700">{formatMoney(row.dailyFee)}</span> },
                { key: 'surcharge', header: 'Phụ phí', className: 'text-right', render: (row) => <span className="tabular-nums text-gray-700">{formatMoney(row.surcharge)}</span> },
                { key: 'visits', header: 'Buổi khám', className: 'text-right', render: (row) => <span className="tabular-nums text-gray-700">{row.visitCount}</span> },
                { key: 'medical', header: 'Y tế', className: 'text-right', render: (row) => <span className="tabular-nums text-gray-700">{formatMoney(row.medicalCost)}</span> },
                { key: 'total', header: 'Tổng', className: 'text-right', render: (row) => <span className="font-semibold tabular-nums text-gray-900">{formatMoney(row.total)}</span> },
              ]}
            />
            <p className="text-xs leading-relaxed text-gray-500">
              Phí nuôi tính từng ngày ngựa còn ở CLB, cho người làm chủ lúc hết ngày (ngày chuyển chủ tính cho chủ mới). Ngựa đã chuyển nhượng ra ngoài hoặc đã mất không tính phí. Phụ phí là khoản riêng từng ngựa do CLB ghi, tính theo ngày trong khoảng của khoản đó. Y tế
              tính từng buổi khám theo ngày khám, cho người làm chủ vào ngày đó, kể cả buổi khám của bệnh án đang điều trị.
            </p>
          </div>
        )
      )}
    </div>
  );
}
