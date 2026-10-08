// F2.1, F2.4, F2.5 — Tab Huấn luyện của hồ sơ ngựa (CM, HLV, bác sĩ, chủ ngựa).
// Bento: lớp đang học và buổi sắp tới, khối lượng tập, xu hướng thể lực theo buổi, nhật ký buổi tập (kết quả chạy thử, nhận xét của HLV),
// lịch sử cảnh báo thể lực, ngưỡng nhịp tim và tốc độ (HLV của khu đặt phiên bản mới). Mỗi khối một nguồn API, tải riêng.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Flag, Gauge, Layers, MessageSquareQuote, SlidersHorizontal } from 'lucide-react';
import { listHorseClasses, listHorseSessions } from '../../../api/training';
import { getThresholds, getWorkload, listHorseAlerts, listSessionSummaries } from '../../../api/performance';
import type { HorseDetail, HorsePermissions } from '../../../api/types';
import { Button, EmptyState, ErrorBox, Segmented, Skeleton, cn } from '../../../components/ui';
import { LineChart, chartColors } from '../../../components/charts/LineChart';
import { useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';
import { links } from '../../../lib/links';
import { formatDate, formatDateTime } from '../../../lib/format';
import { addDateKey, clubTime, clubToday } from '../../../lib/club-time';
import { formatMeters, formatMinutes, formatRaceTime } from '../../../lib/training-format';
import { INTENSITIES, alertLevelText, classStatusText, enrollmentStatusText, intensityText } from '../../../lib/training-labels';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { IntensityBars, ParticipantPill, TrialBadge } from '../../training/components/bits';
import { ProgressFill } from '../../training/components/motion';
import ThresholdSheet from '../components/ThresholdSheet';

export default function TrainingTab({ horse, permissions }: { horse: HorseDetail; permissions: HorsePermissions }) {
  const user = useStore((state) => state.currentUser);
  const role = user?.role;
  const scope = useRef<HTMLDivElement>(null);
  const staffView = role === 'CLUB_MANAGER' || role === 'HEAD_TRAINER' || role === 'VETERINARIAN';
  const canSetThreshold = role === 'HEAD_TRAINER' && permissions.canAssignStallAndGroom && !horse.isDeleted && horse.lifecycleStatus === 'ACTIVE';

  const overview = useService(async () => {
    const [classes, upcoming] = await Promise.all([listHorseClasses(horse.id), listHorseSessions(horse.id, { when: 'upcoming', limit: 8 })]);
    // BE xếp "sắp tới" theo giờ buổi: ngựa bắt đầu sớm thì lượt đã chạy vẫn nằm đây. Chỉ giữ lượt còn chờ.
    const waiting = upcoming.items.filter((item) => item.participantStatus === 'PLANNED' || item.participantStatus === 'PRESENT' || item.participantStatus === 'READY');
    return { classes, upcoming: waiting.slice(0, 5) };
  }, [horse.id]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('[data-training-block]', { opacity: 0, y: 18, duration: 0.45, stagger: 0.07, ease: 'power3.out', clearProps: 'all' });
    },
    { scope },
  );

  const active = (overview.data?.classes ?? []).filter((item) => item.enrollmentStatus === 'ACTIVE');
  const past = (overview.data?.classes ?? []).filter((item) => item.enrollmentStatus !== 'ACTIVE');
  const next = overview.data?.upcoming[0];

  return (
    <div ref={scope} className="space-y-4 pt-4">
      <div className="grid gap-4 lg:grid-cols-12">
        <section data-training-block className="turf-soft rounded-2xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10 lg:col-span-7">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
            <Layers size={17} className="text-emerald-700" /> Lớp và lịch tập
          </h3>
          {overview.loading && !overview.data ? (
            <Skeleton rows={2} />
          ) : overview.error ? (
            <ErrorBox message={overview.error} />
          ) : (
            <div className="space-y-3">
              {active.length === 0 ? (
                <p className="rounded-xl bg-white/80 px-3.5 py-3 text-sm text-gray-500 ring-1 ring-emerald-900/10">Ngựa chưa học lớp nào.</p>
              ) : (
                active.map((item) => (
                  <Link key={item.enrollmentId} to={links.class(item.classId)} className="flex items-center justify-between gap-3 rounded-xl bg-white/85 px-4 py-3 ring-1 ring-emerald-900/10 transition hover:ring-emerald-300">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        <span className="font-mono text-gray-500">{item.code}</span> {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.headTrainerName ? `HLV ${item.headTrainerName} · ` : ''}vào lớp {formatDate(item.enrolledAt)}
                      </p>
                    </div>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">{classStatusText[item.classStatus]}</span>
                  </Link>
                ))
              )}
              {next && (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-700 px-4 py-3 text-white">
                  <CalendarClock size={18} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-emerald-100">Buổi tập kế tiếp</p>
                    <p className="truncate font-semibold">{next.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold">{formatDate(next.scheduledStartAt).slice(0, 5)} {clubTime(next.scheduledStartAt)}</p>
                    <p className="text-xs text-emerald-100">{countdown(next.scheduledStartAt)}</p>
                  </div>
                </div>
              )}
              {(overview.data?.upcoming.length ?? 0) > 1 && (
                <ul className="space-y-1">
                  {overview.data!.upcoming.slice(1).map((item) => (
                    <li key={item.participantId} className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2 text-sm">
                      <span className="w-24 shrink-0 font-mono text-xs text-gray-500">
                        {formatDate(item.scheduledStartAt).slice(0, 5)} {clubTime(item.scheduledStartAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-gray-800">{item.name}</span>
                      <TrialBadge type={item.sessionType} />
                      {item.surface && <span className="text-xs text-gray-500">{item.surface}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {past.length > 0 && (
                <p className="text-xs text-gray-500">
                  Đã học: {past.map((item) => `${item.code} (${enrollmentStatusText[item.enrollmentStatus].toLowerCase()})`).join(', ')}
                </p>
              )}
            </div>
          )}
        </section>

        <WorkloadCard horseId={horse.id} className="lg:col-span-5" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <TrendCard horseId={horse.id} className={staffView ? 'lg:col-span-8' : 'lg:col-span-12'} />
        {staffView && <ThresholdCard horseId={horse.id} horseName={horse.name} canSet={canSetThreshold} className="lg:col-span-4" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <HistoryCard horseId={horse.id} className={staffView ? 'lg:col-span-7' : 'lg:col-span-12'} />
        {staffView && <AlertsCard horseId={horse.id} className="lg:col-span-5" />}
      </div>
    </div>
  );
}

function countdown(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes < 0) return 'đã tới giờ';
  if (minutes < 60) return `còn ${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `còn ${hours} giờ`;
  return `còn ${Math.round(hours / 24)} ngày`;
}

/* ===== Khối lượng tập ===== */

function WorkloadCard({ horseId, className = '' }: { horseId: string; className?: string }) {
  const [days, setDays] = useState<'7' | '28'>('7');
  const today = clubToday();
  const data = useService(() => getWorkload(horseId, { from: addDateKey(today, -(Number(days) - 1)), to: today }), [horseId, days], { silent: true });
  const load = data.data;
  const maxDistance = Math.max(1, load?.plannedDistanceM ?? 0, load?.actualDistanceM ?? 0);
  return (
    <section data-training-block className={cn('rounded-2xl bg-white p-5 ring-1 ring-gray-200/80', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Gauge size={17} className="text-emerald-700" /> Khối lượng tập
        </h3>
        <Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7 ngày' }, { value: '28', label: '28 ngày' }]} />
      </div>
      {data.loading && !load ? (
        <Skeleton rows={2} />
      ) : data.error || !load ? (
        <ErrorBox message={data.error ?? 'Không tải được khối lượng tập'} />
      ) : load.sessionsCompleted === 0 ? (
        <EmptyState title="Chưa có lượt tập hoàn thành" hint={`Trong ${days} ngày gần nhất.`} className="py-6" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-end gap-6">
            <div>
              <p className="font-mono text-4xl font-bold tabular-nums text-gray-900">{load.sessionsCompleted}</p>
              <p className="text-xs text-gray-500">lượt hoàn thành</p>
            </div>
            <div>
              <p className="font-mono text-xl font-semibold tabular-nums">{formatMinutes(load.actualDurationSeconds)}</p>
              <p className="text-xs text-gray-500">thời gian tập thực</p>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-gray-500">Theo cường độ</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
              {INTENSITIES.map((intensity) =>
                load.byIntensity[intensity] ? (
                  <span
                    key={intensity}
                    title={`${intensityText[intensity]}: ${load.byIntensity[intensity]} lượt`}
                    className={intensity === 'HEAVY' ? 'bg-emerald-700' : intensity === 'MODERATE' ? 'bg-emerald-400' : 'bg-emerald-200'}
                    style={{ flexGrow: load.byIntensity[intensity] }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-gray-600">
              {INTENSITIES.map((intensity) => (
                <span key={intensity} className="inline-flex items-center gap-1">
                  <IntensityBars intensity={intensity} showLabel={false} /> {intensityText[intensity]} <b className="font-mono">{load.byIntensity[intensity]}</b>
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="mb-1 flex justify-between text-xs text-gray-600">
                <span>Cự ly dự kiến</span>
                <span className="font-mono">{formatMeters(load.plannedDistanceM)}</span>
              </div>
              <ProgressFill ratio={load.plannedDistanceM / maxDistance} tone="gray" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-gray-600">
                <span>Cự ly thực (từ cảm biến)</span>
                <span className="font-mono">{formatMeters(load.actualDistanceM)}</span>
              </div>
              <ProgressFill ratio={load.actualDistanceM / maxDistance} delay={0.15} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ===== Xu hướng thể lực ===== */

function TrendCard({ horseId, className = '' }: { horseId: string; className?: string }) {
  const data = useService(() => listSessionSummaries(horseId), [horseId], { silent: true });
  const rows = [...(data.data ?? [])].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  // Xu hướng: so nhịp tim trung bình 3 buổi gần nhất với 3 buổi trước đó (cùng cường độ thì nhịp thấp hơn là thể lực tốt hơn).
  const recent = rows.slice(-3);
  const before = rows.slice(-6, -3);
  const avg = (list: typeof rows) => (list.length ? list.reduce((sum, row) => sum + row.avgHeartRateBpm, 0) / list.length : 0);
  const delta = recent.length && before.length ? avg(recent) - avg(before) : undefined;
  return (
    <section data-training-block className={cn('rounded-2xl bg-white p-5 ring-1 ring-gray-200/80', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Activity size={17} className="text-emerald-700" /> Xu hướng thể lực theo buổi
        </h3>
        {delta !== undefined && (
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', delta <= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
            Nhịp tim TB 3 buổi gần {delta <= 0 ? 'giảm' : 'tăng'} {Math.abs(Math.round(delta))} bpm
          </span>
        )}
      </div>
      {data.loading && !data.data ? (
        <Skeleton rows={3} />
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : rows.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu nhịp tim" hint="Biểu đồ hiện sau khi ngựa có lượt tập gắn cảm biến." className="py-8" />
      ) : (
        <LineChart
          height={220}
          xAxis="sequence"
          area
          yLabel="bpm"
          formatY={(value) => `${Math.round(value)}`}
          formatTooltipX={(value) => formatDate(new Date(value))}
          series={[
            { key: 'max', label: 'Nhịp tim cao nhất', color: chartColors.amber, points: rows.map((row) => ({ x: new Date(row.scheduledAt).getTime(), y: row.maxHeartRateBpm })) },
            {
              key: 'avg',
              label: 'Nhịp tim trung bình',
              color: chartColors.emerald,
              points: rows.map((row) => ({ x: new Date(row.scheduledAt).getTime(), y: row.avgHeartRateBpm })),
              hint: (point, previous) => (previous ? `${point.y - previous.y >= 0 ? '+' : ''}${Math.round(point.y - previous.y)} bpm so với buổi trước` : undefined),
            },
          ]}
        />
      )}
      {rows.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {rows.length} buổi có số đo · tổng {rows.reduce((sum, row) => sum + row.alertCount, 0)} điểm vượt ngưỡng. Cùng cường độ, nhịp tim trung bình giảm dần là thể lực đang lên.
        </p>
      )}
    </section>
  );
}

/* ===== Ngưỡng ===== */

function ThresholdCard({ horseId, horseName, canSet, className = '' }: { horseId: string; horseName: string; canSet: boolean; className?: string }) {
  const data = useService(() => getThresholds(horseId), [horseId], { silent: true });
  const [open, setOpen] = useState(false);
  const current = data.data;
  return (
    <section data-training-block className={cn('rounded-2xl bg-white p-5 ring-1 ring-gray-200/80', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <SlidersHorizontal size={16} className="text-emerald-700" /> Ngưỡng cảnh báo
        </h3>
        {canSet && (
          <Button variant="inline" size="sm" onClick={() => setOpen(true)}>
            Đặt ngưỡng mới
          </Button>
        )}
      </div>
      {data.loading && !current ? (
        <Skeleton rows={2} />
      ) : data.error || !current ? (
        <ErrorBox message={data.error ?? 'Không tải được ngưỡng'} />
      ) : (
        <>
          <span className={cn('inline-block rounded-md px-2 py-0.5 text-xs font-medium', current.source === 'HORSE' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600')}>
            {current.source === 'HORSE' ? 'Ngưỡng riêng của ngựa' : 'Mặc định câu lạc bộ'}
          </span>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-amber-50 p-2.5 ring-1 ring-amber-100">
              <dt className="text-[11px] text-amber-800">Cảnh báo</dt>
              <dd className="font-mono text-lg font-bold">{current.activeLimits.heartRateWarningBpm}</dd>
              <dd className="text-[10px] text-gray-500">bpm</dd>
            </div>
            <div className="rounded-xl bg-red-50 p-2.5 ring-1 ring-red-100">
              <dt className="text-[11px] text-red-700">Nguy hiểm</dt>
              <dd className="font-mono text-lg font-bold">{current.activeLimits.heartRateCriticalBpm}</dd>
              <dd className="text-[10px] text-gray-500">bpm</dd>
            </div>
            <div className="rounded-xl bg-gray-50 p-2.5 ring-1 ring-gray-100">
              <dt className="text-[11px] text-gray-600">Tốc độ tối đa</dt>
              <dd className="font-mono text-lg font-bold">{current.activeLimits.maxSpeedMps}</dd>
              <dd className="text-[10px] text-gray-500">m/s</dd>
            </div>
          </dl>
          {current.profiles.length > 0 && (
            <ol className="mt-4 space-y-1.5 border-l-2 border-gray-100 pl-3">
              {current.profiles.slice(0, 4).map((profile) => (
                <li key={profile.id} className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-800">
                    Phiên bản {profile.ruleVersion} · {profile.profileName}
                  </span>
                  <span className="block font-mono text-gray-500">
                    {profile.limits.heartRateWarningBpm}/{profile.limits.heartRateCriticalBpm} bpm · {profile.limits.maxSpeedMps} m/s
                  </span>
                  <span className="block">
                    Từ {formatDateTime(profile.effectiveFrom)}
                    {profile.effectiveTo ? ` đến ${formatDateTime(profile.effectiveTo)}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!canSet && <p className="mt-3 text-xs text-gray-400">Chỉ huấn luyện viên trưởng phụ trách khu của ngựa đặt được ngưỡng.</p>}
        </>
      )}
      {open && current && (
        <ThresholdSheet
          horseId={horseId}
          horseName={horseName}
          current={current.activeLimits}
          nextVersion={(current.profiles[0]?.ruleVersion ?? 0) + 1}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            data.reload();
          }}
        />
      )}
    </section>
  );
}

/* ===== Nhật ký buổi tập ===== */

function HistoryCard({ horseId, className = '' }: { horseId: string; className?: string }) {
  const [page, setPage] = useState(1);
  // BE tính "lịch sử" theo giờ buổi: ngựa chạy sớm hơn giờ buổi thì lượt chưa vào lịch sử. Lấy mọi lượt rồi bỏ lượt còn chờ.
  const data = useService(
    async () => (await listHorseSessions(horseId, { limit: 100 })).items.filter((item) => !['PLANNED', 'PRESENT', 'READY'].includes(item.participantStatus)),
    [horseId],
    { silent: true },
  );
  const PAGE = 6;
  const all = data.data ?? [];
  const items = all.slice((page - 1) * PAGE, page * PAGE);
  const meta = { totalPages: Math.max(1, Math.ceil(all.length / PAGE)) };
  return (
    <section data-training-block className={cn('rounded-2xl bg-white p-5 ring-1 ring-gray-200/80', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <MessageSquareQuote size={17} className="text-emerald-700" /> Nhật ký buổi tập
        </h3>
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} title="Trang trước">
              <ChevronLeft size={15} />
            </Button>
            {page}/{meta.totalPages}
            <Button variant="ghost" size="icon" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} title="Trang sau">
              <ChevronRight size={15} />
            </Button>
          </div>
        )}
      </div>
      {data.loading && !data.data ? (
        <Skeleton rows={3} />
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : items.length === 0 ? (
        <EmptyState title="Chưa có buổi tập nào đã diễn ra" className="py-8" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => {
            const best = item.trialResults.length ? Math.min(...item.trialResults.map((trial) => trial.elapsedMs)) : undefined;
            return (
              <li key={item.participantId} className="py-3 first:pt-0">
                <Link to={links.participant(item.participantId, horseId)} className="group block">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-gray-500">
                        {formatDate(item.scheduledStartAt)} {clubTime(item.scheduledStartAt)} · {item.className}
                      </p>
                      <p className="flex items-center gap-2 font-semibold text-gray-900 group-hover:text-emerald-800">
                        {item.name} <TrialBadge type={item.sessionType} />
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {best !== undefined && (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800">
                          <Flag size={11} className="mr-1 inline" />
                          {formatRaceTime(best)}
                        </span>
                      )}
                      {item.evaluation && <span className="rounded-md bg-emerald-700 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">{item.evaluation.score}/10</span>}
                      <ParticipantPill status={item.participantStatus} />
                    </div>
                  </div>
                  {item.evaluation?.comment && (
                    <p className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      “{item.evaluation.comment}”{item.evaluation.evaluatorName && <span className="text-xs text-gray-400"> · {item.evaluation.evaluatorName}</span>}
                    </p>
                  )}
                  {item.absenceReason && <p className="mt-1 text-xs text-amber-800">Vắng: {item.absenceReason}</p>}
                  {item.cancelReason && <p className="mt-1 text-xs text-gray-500">{item.cancelReason}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ===== Lịch sử cảnh báo ===== */

function AlertsCard({ horseId, className = '' }: { horseId: string; className?: string }) {
  const [level, setLevel] = useState<'ALL' | 'WARNING' | 'CRITICAL'>('ALL');
  const data = useService(() => listHorseAlerts(horseId, { level: level === 'ALL' ? undefined : level, limit: 50 }), [horseId, level], { silent: true });
  // Gom điểm cảnh báo theo lượt tập: mỗi lượt một dòng, kèm nhịp tim cao nhất.
  const groups = new Map<string, { sessionName: string | null; participantId: string; first: string; count: number; critical: number; peak: number }>();
  (data.data?.items ?? []).forEach((alert) => {
    const group = groups.get(alert.sessionParticipantId) ?? { sessionName: alert.sessionName, participantId: alert.sessionParticipantId, first: alert.recordedAt, count: 0, critical: 0, peak: 0 };
    group.count += 1;
    if (alert.alertLevel === 'CRITICAL') group.critical += 1;
    group.peak = Math.max(group.peak, alert.heartRateBpm);
    if (alert.recordedAt < group.first) group.first = alert.recordedAt;
    groups.set(alert.sessionParticipantId, group);
  });
  const forbidden = data.error && /quyền|tìm thấy/i.test(data.error);
  return (
    <section data-training-block className={cn('rounded-2xl bg-white p-5 ring-1 ring-gray-200/80', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <AlertTriangle size={16} className="text-amber-600" /> Cảnh báo thể lực
        </h3>
        <Segmented
          value={level}
          onChange={setLevel}
          options={[
            { value: 'ALL', label: 'Tất cả' },
            { value: 'WARNING', label: alertLevelText.WARNING },
            { value: 'CRITICAL', label: alertLevelText.CRITICAL },
          ]}
        />
      </div>
      {data.loading && !data.data ? (
        <Skeleton rows={2} />
      ) : forbidden ? (
        <p className="text-sm text-gray-400">Lịch sử cảnh báo dành cho HLV phụ trách khu của ngựa, bác sĩ và quản lý.</p>
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : groups.size === 0 ? (
        <EmptyState title="Chưa có lần vượt ngưỡng nào" className="py-8" />
      ) : (
        <ul className="space-y-2">
          {[...groups.values()].map((group) => (
            <li key={group.participantId}>
              <Link to={links.participant(group.participantId, horseId)} className={cn('block rounded-xl px-3.5 py-2.5 ring-1 transition hover:ring-2', group.critical ? 'bg-red-50/70 ring-red-200 hover:ring-red-300' : 'bg-amber-50/70 ring-amber-200 hover:ring-amber-300')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-gray-900">{group.sessionName ?? 'Buổi đã xóa'}</p>
                  <span className={cn('font-mono text-sm font-bold', group.critical ? 'text-red-700' : 'text-amber-800')}>{group.peak} bpm</span>
                </div>
                <p className="text-xs text-gray-600">
                  {formatDateTime(group.first)} · {group.count} điểm vượt ngưỡng{group.critical ? `, ${group.critical} nguy hiểm` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

