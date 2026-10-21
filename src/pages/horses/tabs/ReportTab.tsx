// Tab Báo cáo của một ngựa (Quản lý CLB, HLV, bác sĩ, chủ ngựa): tiến độ huấn luyện và sức khỏe trong một kỳ.
// GET /reports/horses/:id/progress và /health. Chủ ngựa không xem nhịp tim, tốc độ (giống màn chi tiết lượt tập).
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { getHorseHealthReport, getHorseProgress, type HorseHealthReport } from '../../../api/reports';
import type { HorseDetail } from '../../../api/types';
import { PeriodBar } from '../../../components/PeriodBar';
import { ColumnChart } from '../../../components/charts/ColumnChart';
import { Card, DataTable, ErrorBox, Skeleton, cn } from '../../../components/ui';
import { HealthPill } from '../../../components/ui/status';
import { usePeriod } from '../../../hooks/usePeriod';
import { useService } from '../../../hooks/useService';
import { bodyRegionLabel, caseStatusText, injuryTypeLabel, measurementSpec, recoveryLabel } from '../../../lib/api-labels';
import { formatDate, formatDateShort } from '../../../lib/format';
import { links } from '../../../lib/links';
import { INTENSITY_COLORS, fillWeeks, weeklyColumns } from '../../../lib/report-utils';
import { INTENSITIES, intensityText, participantStatusText } from '../../../lib/training-labels';
import { formatMeters, formatRaceTime, formatSpeed } from '../../../lib/training-format';
import { HealthShift } from '../../medical/components/parts';
import { SplitBar } from '../../reports/parts';

export default function ReportTab({ horse, owner }: { horse: HorseDetail; owner: boolean }) {
  const period = usePeriod();
  const navigate = useNavigate();
  const progress = useService(
    () => (period.invalid ? Promise.resolve(null) : getHorseProgress(horse.id, { from: period.from, to: period.to })),
    [horse.id, period.from, period.to, period.invalid],
  );
  const health = useService(
    () => (period.invalid ? Promise.resolve(null) : getHorseHealthReport(horse.id, { from: period.from, to: period.to })),
    [horse.id, period.from, period.to, period.invalid],
  );
  const p = progress.data;

  return (
    <div className="space-y-6">
      <PeriodBar period={period} />
      {period.invalid ? null : (
        <>
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Tiến độ huấn luyện</h3>
            {progress.loading && !p ? (
              <Skeleton rows={4} />
            ) : progress.error ? (
              <ErrorBox message={progress.error} />
            ) : (
              p && (
                <>
                  <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
                    <div className="rounded-3xl bg-white p-5 shadow-grass-tint ring-1 ring-emerald-100 lg:col-span-5">
                      <p className="text-sm text-gray-500">Lượt hoàn thành</p>
                      <p className="mt-1 font-mono text-4xl font-bold tabular-nums leading-none text-emerald-900">{p.totals.completed}</p>
                      <SplitBar
                        className="mt-4"
                        parts={INTENSITIES.map((intensity) => ({ key: intensity, label: intensityText[intensity], value: p.totals.completedByIntensity[intensity], color: INTENSITY_COLORS[intensity] }))}
                      />
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-sm">
                        <dt className="text-gray-500">Quãng đường</dt>
                        <dd className="text-right tabular-nums text-gray-900">{formatMeters(p.totals.plannedDistanceM)}</dd>
                        <dt className="text-gray-500">Thời gian tập</dt>
                        <dd className="text-right tabular-nums text-gray-900">{p.totals.trainedMinutes} phút</dd>
                        <dt className="text-gray-500">Dừng sớm</dt>
                        <dd className={cn('text-right tabular-nums', p.totals.stopped ? 'text-amber-700' : 'text-gray-400')}>{p.totals.stopped}</dd>
                        <dt className="text-gray-500">Vắng</dt>
                        <dd className={cn('text-right tabular-nums', p.totals.absent ? 'text-amber-700' : 'text-gray-400')}>{p.totals.absent}</dd>
                        <dt className="text-gray-500">Không đủ điều kiện</dt>
                        <dd className={cn('text-right tabular-nums', p.totals.ineligible ? 'text-red-700' : 'text-gray-400')}>{p.totals.ineligible}</dd>
                      </dl>
                    </div>
                    <Card className="lg:col-span-7">
                      <h4 className="text-sm font-semibold text-gray-900">Theo tuần</h4>
                      <p className="mb-3 mt-0.5 text-xs text-gray-500">{owner ? 'Số lượt hoàn thành mỗi tuần.' : 'Rê chuột vào cột để xem nhịp tim trung bình và số cảnh báo.'}</p>
                      <ColumnChart columns={weeklyColumns(fillWeeks(p.weekly, p.from, p.to), { withHeartRate: !owner })} height={170} caption="Lượt hoàn thành theo tuần" />
                    </Card>
                  </div>
                  <DataTable
                    rows={p.sessions}
                    rowKey={(row) => row.participantId}
                    onRowClick={owner ? undefined : (row) => navigate(links.participant(row.participantId, horse.id))}
                    pageSize={10}
                    emptyTitle="Không có lượt tập nào trong kỳ"
                    columns={[
                      {
                        key: 'session',
                        header: 'Buổi',
                        render: (row) => (
                          <span>
                            <span className="font-medium text-gray-900">{row.sessionName}</span>
                            <span className="block text-xs text-gray-500">
                              {formatDateShort(row.scheduledStartAt)} · {intensityText[row.intensity]}
                              {row.sessionType === 'TIME_TRIAL' ? ' · chạy thử' : ''}
                            </span>
                          </span>
                        ),
                      },
                      { key: 'status', header: 'Trạng thái', render: (row) => <span className="text-sm text-gray-700">{participantStatusText[row.status]}</span> },
                      ...(owner
                        ? []
                        : [
                            {
                              key: 'hr',
                              header: 'Nhịp tim TB',
                              className: 'text-right',
                              render: (row: (typeof p.sessions)[number]) => <span className="tabular-nums text-gray-700">{row.avgHeartRateBpm === null ? '' : `${row.avgHeartRateBpm} bpm`}</span>,
                            },
                            {
                              key: 'speed',
                              header: 'Tốc độ TB',
                              className: 'text-right',
                              render: (row: (typeof p.sessions)[number]) => <span className="tabular-nums text-gray-700">{row.avgSpeedMps === null ? '' : formatSpeed(row.avgSpeedMps)}</span>,
                            },
                          ]),
                      {
                        key: 'score',
                        header: 'Điểm',
                        className: 'text-right',
                        render: (row) => <span className="font-semibold tabular-nums text-gray-900">{row.evaluation ? `${row.evaluation.score}/10` : ''}</span>,
                      },
                      {
                        key: 'trial',
                        header: 'Chạy thử tốt nhất',
                        className: 'text-right',
                        render: (row) => <span className="font-mono tabular-nums text-gray-700">{row.bestTrialMs === null ? '' : formatRaceTime(row.bestTrialMs)}</span>,
                      },
                    ]}
                  />
                </>
              )
            )}
          </section>

          <section className="space-y-4">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
              Sức khỏe
              {health.data && <HealthPill status={health.data.currentHealthStatus} />}
            </h3>
            {health.loading && !health.data ? (
              <Skeleton rows={4} />
            ) : health.error ? (
              <ErrorBox message={health.error} />
            ) : (
              health.data && <HealthTimeline report={health.data} onOpenCase={(id) => navigate(links.case(id))} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

interface TimelineEntry {
  key: string;
  at: string;
  tone: 'green' | 'amber' | 'red' | 'gray';
  title: ReactNode;
  detail?: ReactNode;
  caseId?: string;
}

const DOT = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', gray: 'bg-gray-400' };

function HealthTimeline({ report, onOpenCase }: { report: HorseHealthReport; onOpenCase: (id: string) => void }) {
  const abnormal = report.measurements.filter((item) => item.isAbnormal);
  const entries: TimelineEntry[] = [
    ...report.statusChanges.map((item, index) => ({
      key: `status-${index}`,
      at: item.changedAt,
      tone: item.to === 'ELIGIBLE' ? ('green' as const) : item.to === 'UNDER_OBSERVATION' ? ('amber' as const) : ('red' as const),
      title: <HealthShift from={item.from} to={item.to} />,
      detail: item.reason ?? undefined,
    })),
    ...abnormal.map((item, index) => ({
      key: `measure-${index}`,
      at: item.measuredAt,
      tone: 'amber' as const,
      title: `${measurementSpec[item.type].name} bất thường: ${item.value.toLocaleString('vi-VN')} ${measurementSpec[item.type].unit}`,
    })),
    ...report.medicalCases.map((item) => ({
      key: `case-${item.caseId}`,
      at: item.openedAt,
      tone: item.status === 'OPEN' ? ('red' as const) : ('gray' as const),
      title: `Bệnh án: ${item.initialDiagnosis}`,
      detail: `${caseStatusText[item.status]}${item.closedAt ? `, đóng ${formatDate(item.closedAt)}` : ''}${item.finalConclusion ? `. ${item.finalConclusion}` : ''}`,
      caseId: item.caseId,
    })),
    ...report.injuries.map((item, index) => ({
      key: `injury-${index}`,
      at: item.examDate,
      tone: item.recoveryStatus === 'HEALED' ? ('gray' as const) : ('amber' as const),
      title: `Chấn thương: ${injuryTypeLabel[item.injuryType]} ở ${bodyRegionLabel[item.bodyRegion].toLowerCase()}`,
      detail: recoveryLabel[item.recoveryStatus],
    })),
    ...report.trainingLocks.map((item) => ({
      key: `lock-${item.lockId}`,
      at: item.lockStart,
      tone: item.status === 'ACTIVE' ? ('red' as const) : ('gray' as const),
      title: (
        <span className="inline-flex items-center gap-1.5">
          <Lock size={13} /> Khóa tập
        </span>
      ),
      detail: `${item.reason}. ${item.status === 'ACTIVE' ? (item.lockEnd ? `Đến ${formatDate(item.lockEnd)}` : 'Chưa có ngày mở') : `Đã gỡ${item.releasedAt ? ` ${formatDate(item.releasedAt)}` : ''}`}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="grid gap-4 lg:grid-cols-12 [&>*]:min-w-0">
      <dl className="grid h-fit grid-cols-2 gap-3 lg:col-span-4 lg:grid-cols-1">
        {[
          { label: 'Lần đổi sức khỏe', value: report.statusChanges.length },
          { label: 'Số đo bất thường', value: abnormal.length, sub: `trên ${report.measurements.length} lần đo` },
          { label: 'Bệnh án', value: report.medicalCases.length },
          { label: 'Khóa tập', value: report.trainingLocks.length },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-gray-200/80">
            <dt className="text-xs text-gray-500">{item.label}</dt>
            <dd className="font-mono text-xl font-bold tabular-nums text-gray-900">
              {item.value}
              {item.sub && <span className="ml-1.5 font-sans text-xs font-normal text-gray-500">{item.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-gray-200/80 lg:col-span-8">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">Không có thay đổi sức khỏe, bệnh án hay khóa tập nào trong kỳ.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-gray-200 pl-4">
            {entries.map((entry) => (
              <li key={entry.key} className="relative">
                <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', DOT[entry.tone])} aria-hidden />
                <p className="text-xs tabular-nums text-gray-500">{formatDate(entry.at)}</p>
                <div className="text-sm font-medium text-gray-900">{entry.title}</div>
                {entry.detail && <p className="mt-0.5 text-sm text-gray-600">{entry.detail}</p>}
                {entry.caseId && (
                  <button type="button" onClick={() => onOpenCase(entry.caseId!)} className="mt-0.5 text-sm font-medium text-emerald-700 hover:underline">
                    Xem bệnh án
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
