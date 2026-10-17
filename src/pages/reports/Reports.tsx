// Trang Báo cáo theo kỳ. Tab Huấn luyện (Quản lý CLB, HLV, bác sĩ): GET /reports/dashboard, chỉ ngựa đang hoạt động.
// Tab Tài chính (chỉ Quản lý CLB): GET /reports/club/finance, bấm một chủ ngựa để xem chi phí của chủ đó.
// HLV mặc định xem các khu mình phụ trách (mine=true), đổi được sang toàn CLB hoặc một khu (luật phạm vi đã chốt).
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { getClubFinance, getTrainingDashboard } from '../../api/reports';
import { listBarns } from '../../api/stable';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import { PeriodBar } from '../../components/PeriodBar';
import { ColumnChart } from '../../components/charts/ColumnChart';
import { DonutChart } from '../../components/charts/DonutChart';
import { Card, DataTable, ErrorBox, FilterSelect, NotFound, PageHeader, Skeleton, TabPanel, Tabs, cn } from '../../components/ui';
import { HealthPill } from '../../components/ui/status';
import { usePeriod, type Period } from '../../hooks/usePeriod';
import { useService } from '../../hooks/useService';
import { formatDate, formatMoney } from '../../lib/format';
import { links } from '../../lib/links';
import { INTENSITY_COLORS, fillWeeks, weeklyColumns } from '../../lib/report-utils';
import { INTENSITIES, intensityText } from '../../lib/training-labels';
import { formatSpeed } from '../../lib/training-format';
import { useStore } from '../../store/store';
import { healthSegments } from '../dashboard/charts';
import { SplitBar, StatTile } from './parts';

export default function Reports() {
  const user = useStore((state) => state.currentUser);
  const [params, setParams] = useSearchParams();
  const period = usePeriod();
  useCrumbs([{ label: 'Báo cáo' }]);
  const canTraining = can(user, 'report.training');
  const canFinance = can(user, 'report.finance');
  if (!canTraining && !canFinance) return <NotFound message="Trang này dành cho Quản lý CLB, HLV và bác sĩ." />;
  const tab = canFinance && (params.get('tab') === 'finance' || !canTraining) ? 'finance' : 'training';

  return (
    <div className="space-y-6">
      <PageHeader title="Báo cáo" description={tab === 'finance' ? 'Khoản thu của chủ ngựa và tiền vật tư trong kỳ.' : 'Buổi tập, lượt hoàn thành và sức khỏe đàn trong kỳ.'} />
      {canTraining && canFinance && (
        <Tabs
          active={tab}
          onChange={(key) => setParams(key === 'finance' ? { tab: 'finance' } : {}, { replace: true })}
          tabs={[
            { key: 'training', label: 'Huấn luyện' },
            { key: 'finance', label: 'Tài chính' },
          ]}
        />
      )}
      {tab === 'finance' ? <FinanceReport period={period} /> : <TrainingReport period={period} trainer={user?.role === 'HEAD_TRAINER'} />}
    </div>
  );
}

/* ===== Huấn luyện ===== */

const MINE = 'mine';

function TrainingReport({ period, trainer }: { period: Period; trainer: boolean }) {
  const navigate = useNavigate();
  // '' = toàn CLB, 'mine' = khu tôi phụ trách, còn lại là id một khu.
  const [barn, setBarn] = useState(trainer ? MINE : '');
  const barns = useService(() => listBarns(), []);
  const report = useService(
    () => (period.invalid ? Promise.resolve(null) : getTrainingDashboard({ from: period.from, to: period.to, mine: barn === MINE, barnId: barn && barn !== MINE ? barn : undefined })),
    [period.from, period.to, period.invalid, barn],
  );
  const data = report.data;

  return (
    <TabPanel className="space-y-5">
      <PeriodBar period={period}>
        <FilterSelect value={barn} onChange={setBarn} label="Khu chuồng">
          {trainer && <option value={MINE}>Khu của tôi</option>}
          <option value="">Toàn CLB</option>
          {barns.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </FilterSelect>
      </PeriodBar>

      {period.invalid ? null : report.loading && !data ? (
        <Skeleton rows={6} />
      ) : report.error ? (
        <ErrorBox message={report.error} />
      ) : (
        data && (
          <div className={cn('space-y-5 transition-opacity', report.loading && 'opacity-60')}>
            <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
              <section className="rounded-3xl bg-white p-6 shadow-grass-tint ring-1 ring-emerald-100 lg:col-span-7">
                <p className="text-sm text-gray-500">Lượt hoàn thành</p>
                <p className="mt-1 font-mono text-5xl font-bold tabular-nums leading-none text-emerald-900">{data.training.completed}</p>
                <p className="mt-2 text-sm text-gray-600">
                  trong {data.training.sessions} buổi tập, {formatDate(data.from)} đến {formatDate(data.to)}
                </p>
                <SplitBar
                  className="mt-5"
                  parts={INTENSITIES.map((intensity) => ({ key: intensity, label: intensityText[intensity], value: data.training.completedByIntensity[intensity], color: INTENSITY_COLORS[intensity] }))}
                />
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-[1fr_1.4fr]">
                  <div>
                    <p className="text-xs text-gray-500">Vắng</p>
                    <p className={cn('font-mono text-xl font-bold tabular-nums', data.training.absent ? 'text-amber-700' : 'text-gray-400')}>{data.training.absent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Không đủ điều kiện</p>
                    <p className={cn('font-mono text-xl font-bold tabular-nums', data.training.ineligible ? 'text-red-700' : 'text-gray-400')}>{data.training.ineligible}</p>
                    <p className="text-xs text-gray-500">gồm cả lượt hủy do khóa tập</p>
                  </div>
                </div>
              </section>
              <Card className="lg:col-span-5">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="text-[0.95rem] font-semibold text-gray-900">Sức khỏe đàn</h3>
                  {data.herd.trainingLocked > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700">
                      <Lock size={12} /> {data.herd.trainingLocked} ngựa đang khóa tập
                    </span>
                  )}
                </div>
                <DonutChart segments={healthSegments(data.herd.byHealthStatus)} centerLabel="ngựa" />
              </Card>
            </div>

            <Card>
              <h3 className="text-[0.95rem] font-semibold text-gray-900">Lượt hoàn thành theo tuần</h3>
              <p className="mb-3 mt-0.5 text-xs text-gray-500">Rê chuột vào cột để xem nhịp tim trung bình và số cảnh báo.</p>
              <ColumnChart columns={weeklyColumns(fillWeeks(data.weekly, data.from, data.to))} caption="Lượt hoàn thành theo tuần" />
            </Card>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Từng ngựa ({data.horses.length})</h3>
              <DataTable
                rows={data.horses}
                rowKey={(row) => row.horseId}
                onRowClick={(row) => navigate(links.horse(row.horseId, 'report'))}
                pageSize={15}
                emptyTitle="Không có ngựa đang hoạt động trong phạm vi này"
                columns={[
                  {
                    key: 'horse',
                    header: 'Ngựa',
                    render: (row) => (
                      <span>
                        <span className="font-semibold text-gray-900">{row.horseName}</span>
                        {row.trainingLocked && <Lock size={12} className="ml-1.5 inline text-red-600" aria-label="Đang khóa tập" />}
                        <span className="block text-xs text-gray-500">{row.barnName ?? 'Chưa xếp khu'}</span>
                      </span>
                    ),
                  },
                  { key: 'health', header: 'Sức khỏe', render: (row) => <HealthPill status={row.healthStatus} /> },
                  { key: 'done', header: 'Lượt xong', className: 'text-right', render: (row) => <span className="tabular-nums">{row.completed}</span> },
                  {
                    key: 'hr',
                    header: 'Nhịp tim TB / cao nhất',
                    className: 'text-right',
                    render: (row) => <span className="tabular-nums text-gray-700">{row.avgHeartRateBpm === null ? 'Chưa đo' : `${row.avgHeartRateBpm} / ${row.maxHeartRateBpm ?? '?'} bpm`}</span>,
                  },
                  {
                    key: 'speed',
                    header: 'Tốc độ TB',
                    className: 'text-right',
                    render: (row) => <span className="tabular-nums text-gray-700">{row.avgSpeedMps === null ? 'Chưa đo' : formatSpeed(row.avgSpeedMps)}</span>,
                  },
                  {
                    key: 'alerts',
                    header: 'Cảnh báo',
                    className: 'text-right',
                    render: (row) => <span className={cn('tabular-nums', row.alertCount ? 'font-semibold text-red-700' : 'text-gray-400')}>{row.alertCount}</span>,
                  },
                  {
                    key: 'weight',
                    header: 'Cân nặng',
                    className: 'text-right',
                    render: (row) => <span className="tabular-nums text-gray-700">{row.latestWeightKg === null ? 'Chưa đo' : `${row.latestWeightKg.toLocaleString('vi-VN')} kg`}</span>,
                  },
                ]}
              />
            </section>
          </div>
        )
      )}
    </TabPanel>
  );
}

/* ===== Tài chính ===== */

const FEE_COLOR = '#059669';
const MEDICAL_COLOR = '#f59e0b';
const SURCHARGE_COLOR = '#84cc16';
/** Mã dòng "Chưa có chủ" trong bảng theo chủ. */
const UNOWNED = 'unowned';

function FinanceReport({ period }: { period: Period }) {
  const navigate = useNavigate();
  const report = useService(() => (period.invalid ? Promise.resolve(null) : getClubFinance({ from: period.from, to: period.to })), [period.from, period.to, period.invalid]);
  const data = report.data;

  return (
    <TabPanel className="space-y-5">
      <PeriodBar period={period} />
      {period.invalid ? null : report.loading && !data ? (
        <Skeleton rows={6} />
      ) : report.error ? (
        <ErrorBox message={report.error} />
      ) : (
        data && (
          <div className={cn('space-y-5 transition-opacity', report.loading && 'opacity-60')}>
            <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
              <section className="rounded-3xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 text-white shadow-[0_24px_48px_-28px_rgba(6,78,59,0.85)] lg:col-span-7">
                <p className="text-sm text-emerald-100">Khoản thu của chủ ngựa</p>
                <p className="mt-1 font-mono text-4xl font-bold tabular-nums sm:text-5xl">{formatMoney(data.ownerCharges.total)}</p>
                <p className="mt-2 text-sm text-emerald-100">
                  {formatDate(data.from)} đến {formatDate(data.to)} · {data.owners.length} chủ ngựa
                </p>
                <div className="mt-5 rounded-2xl bg-white/95 p-4 text-gray-900">
                  <SplitBar
                    parts={[
                      { key: 'fee', label: 'Phí nuôi', value: data.ownerCharges.dailyFee, color: FEE_COLOR, text: formatMoney(data.ownerCharges.dailyFee) },
                      { key: 'surcharge', label: 'Phụ phí', value: data.ownerCharges.surcharge, color: SURCHARGE_COLOR, text: formatMoney(data.ownerCharges.surcharge) },
                      { key: 'medical', label: 'Y tế', value: data.ownerCharges.medicalCost, color: MEDICAL_COLOR, text: formatMoney(data.ownerCharges.medicalCost) },
                    ]}
                  />
                </div>
                {data.ownerCharges.dailyFee === 0 && (
                  <p className="mt-3 text-xs text-emerald-100">
                    Phí nuôi bằng 0.{' '}
                    <Link to={links.adminFees} className="font-medium text-white underline">
                      Xem mức phí nuôi
                    </Link>
                  </p>
                )}
              </section>
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
                <StatTile label="Tiền nhập vật tư" value={formatMoney(data.supplies.purchased)} sub="Không gồm tồn ban đầu" />
                <StatTile label="Vật tư đã dùng" value={formatMoney(data.supplies.used)} sub="Theo đơn giá của từng lô" />
                <StatTile label="Tiền thưởng" value={formatMoney(data.prizeMoney)} sub="Chưa có giải đua" tone="muted" className="sm:col-span-2 lg:col-span-1" />
              </div>
            </div>

            <section>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Theo chủ ngựa</h3>
                <Link to={links.costReport} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
                  Báo cáo chi phí y tế <ArrowRight size={14} />
                </Link>
              </div>
              <DataTable
                rows={[
                  ...data.owners,
                  // Phần chưa có chủ: dòng cuối, không mở được trang chi phí.
                  ...(data.unowned?.total ? [{ ...data.unowned, ownerId: UNOWNED, ownerName: 'Chưa có chủ' }] : []),
                ]}
                rowKey={(row) => row.ownerId}
                onRowClick={(row) => row.ownerId !== UNOWNED && navigate(links.ownerCosts(row.ownerId))}
                pageSize={15}
                emptyTitle="Không có chủ ngựa nào phát sinh chi phí trong kỳ"
                columns={[
                  {
                    key: 'owner',
                    header: 'Chủ ngựa',
                    render: (row) =>
                      row.ownerId === UNOWNED ? (
                        <span className="text-gray-500" title="Ngày ngựa ở CLB mà không có chủ, và bệnh án đóng lúc ngựa không có chủ">
                          Chưa có chủ <span className="text-xs">({data.unowned.billedDays} ngày tính phí)</span>
                        </span>
                      ) : (
                        <span className="font-semibold text-gray-900">{row.ownerName}</span>
                      ),
                  },
                  { key: 'fee', header: 'Phí nuôi', className: 'text-right', render: (row) => <span className="tabular-nums text-gray-700">{formatMoney(row.dailyFee)}</span> },
                  { key: 'surcharge', header: 'Phụ phí', className: 'text-right', render: (row) => <span className="tabular-nums text-gray-700">{formatMoney(row.surcharge)}</span> },
                  { key: 'medical', header: 'Y tế', className: 'text-right', render: (row) => <span className="tabular-nums text-gray-700">{formatMoney(row.medicalCost)}</span> },
                  { key: 'total', header: 'Tổng', className: 'text-right', render: (row) => <span className="font-semibold tabular-nums text-gray-900">{formatMoney(row.total)}</span> },
                ]}
              />
            </section>
            <p className="text-xs leading-relaxed text-gray-500">
              Phí nuôi tính từng ngày cho người làm chủ lúc hết ngày, ngày chuyển chủ tính cho chủ mới. Phụ phí là khoản riêng từng ngựa, tính theo ngày trong khoảng đã ghi. Y tế chỉ tính bệnh án đã đóng trong kỳ. Dòng "Chưa có chủ" gom các ngày ngựa ở CLB mà không có chủ (sau kích hoạt lại hoặc khôi phục hồ sơ) và bệnh án đóng lúc đó, nên tổng các dòng bằng khoản thu ở trên.
            </p>
          </div>
        )
      )}
    </TabPanel>
  );
}
