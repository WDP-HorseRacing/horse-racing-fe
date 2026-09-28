// Tab Huấn luyện trong hồ sơ ngựa: ngựa học trong LỚP — lớp đang học và đã rút, lịch 14 ngày tới
// (tính ra từ đăng ký), kết quả từng buổi, biểu đồ thể lực và nhịp tim tối đa. GROOM không xem (F1.3).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  CalendarDays,
  CalendarCheck,
  GraduationCap,
  HeartOff,
  HeartPulse,
  History,
  Info,
  LineChart as LineIcon,
  Pencil,
  Star,
  Timer,
} from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Notice,
  Pill,
  SectionTitle,
  FilterSelect,
  Skeleton,
  Stat,
  cn,
} from '../../../components/ui';
import { AttendancePill, EligibilityBadge, IntensityPill, SessionPill } from '../../../components/ui/status';
import { LineChart, chartColors } from '../../../components/charts/LineChart';
import { useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';
import { getHorseTraining, type HorseTrainingView } from '../../../services/session.service';
import { dayOfWeekLabel, workoutLabel } from '../../../lib/labels';
import { links } from '../../../lib/links';
import { formatDate, formatDateShort, formatPercent, isoDayOfWeek } from '../../../lib/format';
import MaxHeartRateHistory from '../../training/components/MaxHeartRateHistory';
import MaxHeartRateModal from '../../training/components/MaxHeartRateModal';
import { subjectLine, trialText } from '../../training/components/session-helpers';

export default function TrainingTab({ horseId }: { horseId: string }) {
  const user = useStore((state) => state.currentUser);
  if (user?.role === 'GROOM') {
    return (
      <Notice tone="info" icon={<Info size={16} />}>
        Lớp đang học và kết quả buổi tập của ngựa dành cho HT, bác sĩ, quản lý và chủ ngựa. Việc của bạn trong từng buổi nằm
        ở màn hình Buổi tập hôm nay.
      </Notice>
    );
  }
  return <TrainingBody horseId={horseId} />;
}

function TrainingBody({ horseId }: { horseId: string }) {
  const { data, loading, error, reload } = useService(() => getHorseTraining(horseId), [horseId]);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (loading && !data) return <Skeleton rows={5} />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu huấn luyện'} />;

  const openClasses = data.classes.filter((item) => item.open);
  const pastClasses = data.classes.filter((item) => !item.open);

  return (
    <div className="space-y-5">
      {!data.trainable.allowed && (
        <EligibilityBadge allowed={false} reason={data.trainable.reason} label="Hiện không được tập" />
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Cột trái: lớp, lịch, kết quả */}
        <div className="space-y-5 lg:col-span-5">
          <Card>
            <SectionTitle icon={<GraduationCap size={16} />}>Lớp đang học</SectionTitle>
            {openClasses.length === 0 ? (
              <p className="text-sm font-light text-gray-400">Ngựa chưa học lớp nào đang mở.</p>
            ) : (
              <ul className="space-y-2.5">
                {openClasses.map((item) => (
                  <li key={item.enrollmentId} className="rounded-xl bg-emerald-50/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={links.class(item.classId)} className="font-semibold text-gray-900 hover:text-emerald-700">
                        {item.className}
                      </Link>
                      <Pill tone={item.classStatusLabel === 'Đang chạy' ? 'blue' : 'gray'}>{item.classStatusLabel}</Pill>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Slot {item.slotLabel}
                      {item.zoneName ? ` · ${item.zoneName}` : ''} · vào lớp {formatDate(item.joinedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {pastClasses.length > 0 && (
              <div className="mt-4 border-t border-gray-50 pt-3">
                <p className="mb-2 text-xs font-medium text-gray-400">Đã rút hoặc lớp đã kết thúc</p>
                <ul className="space-y-2">
                  {pastClasses.map((item) => (
                    <li key={item.enrollmentId} className="text-sm">
                      <Link to={links.class(item.classId)} className="font-medium text-gray-700 hover:text-emerald-700">
                        {item.className}
                      </Link>
                      <span className="text-gray-400">
                        {' '}
                        · {formatDate(item.joinedAt)} – {item.withdrawnAt ? formatDate(item.withdrawnAt) : item.classStatusLabel.toLowerCase()}
                      </span>
                      {item.withdrawLabel && (
                        <p className="text-xs text-orange-700">
                          Rút: {item.withdrawLabel}
                          {item.withdrawNote ? ` — ${item.withdrawNote}` : ''}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <UpcomingCard data={data} />
          <ResultsCard data={data} />
        </div>

        {/* Cột phải: KPI, biểu đồ, nhịp tim tối đa */}
        <div className="space-y-5 lg:col-span-7">
          <div className="grid gap-4 sm:grid-cols-12">
            <Stat
              className="sm:col-span-5"
              value={data.kpi.attendance28.rate === null ? '—' : formatPercent(data.kpi.attendance28.rate)}
              label="Có mặt 28 ngày"
              hint={`${data.kpi.attendance28.present}/${data.kpi.attendance28.total} buổi`}
              icon={<CalendarCheck size={18} />}
            />
            <Stat
              className="sm:col-span-4"
              value={data.kpi.avgScore14 === null ? '—' : data.kpi.avgScore14.toLocaleString('vi-VN')}
              label="Điểm TB 14 ngày"
              hint={`${data.kpi.sessionsDone} buổi đã tập`}
              icon={<Star size={18} />}
            />
            <Stat
              className="sm:col-span-3"
              value={data.kpi.alerts7}
              label="Cảnh báo 7 ngày"
              tone={data.kpi.alerts7 > 0 ? 'danger' : 'success'}
              icon={<AlertOctagon size={18} />}
            />
          </div>

          <Card>
            <SectionTitle icon={<LineIcon size={16} />}>Điểm đánh giá theo buổi</SectionTitle>
            <LineChart
              height={200}
              series={[
                {
                  key: 'score',
                  label: 'Điểm',
                  color: chartColors.emerald,
                  points: data.scoreSeries.map((point) => ({ x: new Date(point.date).getTime(), y: point.value })),
                },
              ]}
              formatX={(value) => formatDateShort(new Date(value))}
              formatY={(value) => value.toFixed(1)}
              yLabel="Thang 1–10, do HT chấm sau mỗi buổi"
            />
          </Card>

          <div className="grid gap-5 xl:grid-cols-5">
            <TrialCard data={data} className="xl:col-span-2" />
            <CardiacCard data={data} className="xl:col-span-3" />
          </div>

          {data.maxHeartRate.canView && (
            <Card tone={data.maxHeartRate.current === undefined ? 'warning' : 'default'}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-2xl',
                      data.maxHeartRate.current === undefined ? 'bg-amber-100 text-amber-700' : 'bg-red-50 text-red-600',
                    )}
                  >
                    {data.maxHeartRate.current === undefined ? <HeartOff size={22} /> : <HeartPulse size={22} />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Nhịp tim tối đa (R1)</p>
                    {data.maxHeartRate.current !== undefined ? (
                      <p className="text-2xl font-bold tabular-nums text-gray-900">
                        {data.maxHeartRate.current}
                        <span className="ml-1 text-sm font-normal text-gray-400">nhịp/phút</span>
                      </p>
                    ) : (
                      <p className="text-lg font-semibold text-amber-800">Chưa đặt — R1 không chạy</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {data.maxHeartRate.canEdit && (
                    <Button size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil size={13} /> {data.maxHeartRate.current === undefined ? 'Đặt ngưỡng' : 'Sửa ngưỡng'}
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(true)}>
                    <History size={13} /> Lịch sử
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <MaxHeartRateModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        horse={{
          id: data.horseId,
          name: data.horseName,
          current: data.maxHeartRate.current,
          suggested: data.maxHeartRate.suggested,
        }}
        onDone={reload}
      />
      <MaxHeartRateHistory horseId={historyOpen ? data.horseId : undefined} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

function UpcomingCard({ data }: { data: HorseTrainingView }) {
  const byDate = useMemo(() => {
    const map = new Map<string, HorseTrainingView['upcoming']>();
    data.upcoming.forEach((item) => map.set(item.date, [...(map.get(item.date) ?? []), item]));
    return [...map.entries()];
  }, [data.upcoming]);

  return (
    <Card variant="flat">
      <SectionTitle icon={<CalendarDays size={16} />}>Lịch 14 ngày tới</SectionTitle>
      {byDate.length === 0 ? (
        <p className="text-sm font-light text-gray-400">Không có buổi nào — lịch tính ra từ các lớp ngựa đang học.</p>
      ) : (
        <ol className="space-y-3">
          {byDate.map(([date, items]) => (
            <li key={date} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
              <div className="pt-0.5 text-right">
                <p className="text-sm font-bold tabular-nums text-gray-800">{formatDateShort(date)}</p>
                <p className="text-[11px] text-gray-400">{dayOfWeekLabel[isoDayOfWeek(date)]}</p>
              </div>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <Link
                    key={item.sessionId}
                    to={links.session(item.sessionId)}
                    className={cn(
                      'block rounded-xl bg-white px-3 py-2 ring-1 ring-emerald-950/[0.05] transition hover:ring-emerald-200',
                      item.status === 'CANCELLED' && 'opacity-60',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-emerald-700">{item.slotLabel.split('–')[0]}</span>
                      <span className="text-sm font-medium text-gray-800">{item.className}</span>
                      <IntensityPill intensity={item.intensity} />
                      {item.status !== 'SCHEDULED' && <SessionPill status={item.status} />}
                      {item.attendanceStatus === 'ABSENT' && <Pill tone="orange">Vắng · {item.absenceLabel}</Pill>}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {subjectLine(item)}
                    </p>
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function ResultsCard({ data }: { data: HorseTrainingView }) {
  const [limit, setLimit] = useState(6);
  const items = data.results.slice(0, limit);
  return (
    <Card>
      <SectionTitle icon={<CalendarCheck size={16} />}>Kết quả buổi gần đây</SectionTitle>
      {items.length === 0 ? (
        <EmptyState title="Chưa có buổi nào kết thúc" hint="Kết quả xuất hiện sau khi buổi đầu tiên kết thúc." />
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => (
            <li key={item.sessionId} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={links.session(item.sessionId)} className="text-sm font-semibold text-gray-900 hover:text-emerald-700">
                    {formatDate(item.date)} · {item.className}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {subjectLine(item)}
                    {item.endLabel ? ` · ${item.endLabel}` : ''}
                  </p>
                </div>
                {item.attendanceStatus === 'ABSENT' ? (
                  <AttendancePill status="ABSENT" />
                ) : item.evaluation ? (
                  <span
                    className={cn(
                      'rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums',
                      item.evaluation.score >= 7 ? 'bg-emerald-50 text-emerald-700' : item.evaluation.score >= 5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
                    )}
                  >
                    {item.evaluation.score}/10
                  </span>
                ) : (
                  <Pill tone="amber">Chờ chấm</Pill>
                )}
              </div>
              {item.attendanceStatus === 'ABSENT' ? (
                <p className="mt-1 text-xs text-orange-800">
                  {item.absenceLabel}
                  {item.absenceNote ? ` — ${item.absenceNote}` : ''}
                </p>
              ) : (
                <>
                  {item.summary && (
                    <p className="mt-1 text-xs tabular-nums text-gray-500">
                      Khối lượng {formatPercent(item.summary.volumeRatio)} · nhịp tim TB {item.summary.avgHeartRate}, cao nhất{' '}
                      {item.summary.maxHeartRate}
                      {item.summary.alertCountRed > 0 && <span className="text-red-600"> · {item.summary.alertCountRed} cảnh báo đỏ</span>}
                    </p>
                  )}
                  {item.stoppedReason && <p className="mt-1 text-xs text-red-700">Dừng giữa buổi: {item.stoppedReason}</p>}
                  {item.evaluation?.notes && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-gray-700">{item.evaluation.notes}</p>
                  )}
                  {item.evaluation && item.workoutType === 'TIME_TRIAL' && (
                    <p className="mt-1 text-xs text-gray-600">
                      Chạy thử: {trialText(item.evaluation.trialTimeSeconds, item.evaluation.trialNotCompleted)}
                      {item.evaluation.videoSrc ? ' · có video' : ''}
                    </p>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.results.length > limit && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setLimit(limit + 10)}>
          Xem thêm {Math.min(10, data.results.length - limit)} buổi
        </Button>
      )}
    </Card>
  );
}

function TrialCard({ data, className }: { data: HorseTrainingView; className?: string }) {
  const distances = [...new Set(data.trialSeries.map((point) => point.distanceM))];
  const colors = [chartColors.amber, chartColors.emerald, chartColors.sky];
  return (
    <Card className={className}>
      <SectionTitle icon={<Timer size={16} />}>Chạy thử</SectionTitle>
      {data.kpi.lastTrial && (
        <p className="-mt-2 mb-3 text-sm text-gray-600">
          Gần nhất:{' '}
          <span className="font-semibold tabular-nums text-gray-900">
            {trialText(data.kpi.lastTrial.seconds, data.kpi.lastTrial.notCompleted)}
          </span>{' '}
          · {data.kpi.lastTrial.distanceM} m, {formatDate(data.kpi.lastTrial.date)}
        </p>
      )}
      {data.trialSeries.length < 2 ? (
        <div className="rounded-xl bg-amber-50/50 px-4 py-5 text-sm text-gray-600">
          {data.trialSeries.length === 0
            ? 'Chưa có buổi chạy thử nào được chấm.'
            : 'Mới có một lần chạy thử — biểu đồ xuất hiện từ lần thứ hai để so sánh.'}
        </div>
      ) : (
      <LineChart
        height={170}
        series={distances.map((distance, index) => ({
          key: String(distance),
          label: `${distance} m`,
          color: colors[index % colors.length],
          points: data.trialSeries
            .filter((point) => point.distanceM === distance)
            .map((point) => ({ x: new Date(point.date).getTime(), y: point.value })),
        }))}
        formatX={(value) => formatDateShort(new Date(value))}
        formatY={(value) => `${value.toFixed(1)}s`}
        yLabel="Giây — càng thấp càng tốt"
      />
      )}
    </Card>
  );
}

function CardiacCard({ data, className }: { data: HorseTrainingView; className?: string }) {
  const types = [...new Set(data.cardiacSeries.map((point) => point.workoutType))];
  const [type, setType] = useState(types.includes('CANTER') ? 'CANTER' : types[0]);
  const points = data.cardiacSeries.filter((point) => point.workoutType === type);
  return (
    <Card className={className}>
      <SectionTitle
        icon={<HeartPulse size={16} />}
        action={
          types.length > 1 ? (
            <FilterSelect value={type ?? ''} onChange={(value) => setType(value as typeof type)} label="Loại bài" className="h-9">
              {types.map((item) => (
                <option key={item} value={item}>
                  {workoutLabel[item]}
                </option>
              ))}
            </FilterSelect>
          ) : undefined
        }
      >
        Hiệu suất tim
      </SectionTitle>
      <LineChart
        height={170}
        series={[
          {
            key: 'cardiac',
            label: 'Tốc độ chính ÷ nhịp tim chính × 100',
            color: chartColors.sky,
            points: points.map((point) => ({ x: new Date(point.date).getTime(), y: point.value })),
          },
        ]}
        formatX={(value) => formatDateShort(new Date(value))}
        formatY={(value) => value.toFixed(1)}
        yLabel="Tăng dần = cùng tốc độ với nhịp tim thấp hơn. Chỉ so sánh cùng loại bài."
      />
    </Card>
  );
}
