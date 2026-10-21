// F2.4, F2.5 — Chi tiết một lượt tập. Mở từ thông báo khẩn (id lượt + horseId), từ Sân tập, từ lịch sử của ngựa.
// BE chưa có API đọc một lượt: thông tin buổi tìm trong lịch tập của ngựa. Điểm đo, tổng kết, chạy thử, đánh giá đều nhận id lượt.
// Chủ ngựa không xem được điểm đo từng giây (BE chặn), chỉ thấy 5 chỉ số tổng kết, kết quả chạy thử và nhận xét (đặc tả F2.4 xem rút gọn).
// Groom không xem nhịp tim và tổng kết (BE trả 403): trang chỉ báo và dẫn về lịch dắt ngựa.
// Mọi HLV trưởng xem được mọi lượt. Chỉ HLV của lớp sửa thời gian chạy thử, video và đánh giá (lý do bắt buộc khi sửa số),
// ngựa đã rời CLB thì chỉ xem.
import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Film, Flag, HeartPulse, MessageSquareQuote, Pencil, Radio, Timer, Trash2 } from 'lucide-react';
import { getHorse } from '../../api/horses';
import { CLUB_DEFAULT_LIMITS, getParticipantSummary, getThresholds, listMetrics } from '../../api/performance';
import { getClass, getEvaluation, getSession, listHorseSessions, listTrialResults, updateTrialVideo } from '../../api/training';
import type { Evaluation, HorseTrainingSession, TrialResult } from '../../api/types';
import { Button, ConfirmDialog, EmptyState, NotFound, Notice, Skeleton, cn, useToast } from '../../components/ui';
import { useAction, useService } from '../../hooks/useService';
import { useStore } from '../../store/store';
import { useCrumbs } from '../../components/Breadcrumb';
import { leftClub } from '../../lib/horse-rules';
import { links } from '../../lib/links';
import { formatDate, formatDateTime } from '../../lib/format';
import { clubTime } from '../../lib/club-time';
import { formatClock, formatDelta, formatRaceTime, formatSpeed } from '../../lib/training-format';
import { participantStatusText } from '../../lib/training-labels';
import { gsap, useGSAP } from '../../lib/gsap';
import { prefersReducedMotion } from '../../lib/motion';
import { ParticipantPill, TrialBadge } from './components/bits';
import { MetricChart } from './components/MetricChart';
import { TrialVideoAttachDialog, TrialVideoButton } from './components/TrialVideo';
import { resultEditable } from './plan-helpers';
import { EvaluationSheet, TrialEditDialog } from './session/dialogs';
import { ScoreHorseshoe } from './components/motion';
import { useLiveMetrics } from './hooks';
import { BackLink } from '../../components/BackLink';

/** Tìm lượt trong lịch tập của ngựa (tối đa 5 trang, mới nhất trước). */
async function findSessionRow(horseId: string, participantId: string): Promise<HorseTrainingSession | undefined> {
  for (let page = 1; page <= 5; page += 1) {
    const result = await listHorseSessions(horseId, { page, limit: 100 });
    const hit = result.items.find((item) => item.participantId === participantId);
    if (hit || page >= result.meta.totalPages) return hit;
  }
  return undefined;
}

export default function ParticipantDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const horseId = params.get('horse') ?? '';
  const user = useStore((state) => state.currentUser);
  const role = user?.role;
  const scope = useRef<HTMLDivElement>(null);
  const owner = role === 'HORSE_OWNER';
  const canThresholds = role === 'HEAD_TRAINER' || role === 'CLUB_MANAGER' || role === 'VETERINARIAN';

  const groom = role === 'GROOM';
  const toast = useToast();
  const [attaching, setAttaching] = useState<TrialResult | null>(null);
  const [removing, setRemoving] = useState<TrialResult | null>(null);
  const [editingTrial, setEditingTrial] = useState<TrialResult | null>(null);
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
  const removeVideo = useAction();
  const data = useService(async () => {
    if (groom) return null;
    const [horse, row, summary, metrics, trials, evaluation, thresholds] = await Promise.all([
      horseId ? getHorse(horseId).catch(() => undefined) : Promise.resolve(undefined),
      horseId ? findSessionRow(horseId, id).catch(() => undefined) : Promise.resolve(undefined),
      // Tổng kết lỗi thì vẫn hiện trang, các ô số để trống.
      getParticipantSummary(id).catch(() => null),
      owner ? Promise.resolve(null) : listMetrics(id).catch(() => null),
      listTrialResults(id).catch(() => []),
      getEvaluation(id).catch(() => null),
      canThresholds && horseId ? getThresholds(horseId).catch(() => null) : Promise.resolve(null),
    ]);
    const trial = row?.sessionType === 'TIME_TRIAL';
    const [target, trainerId] = await Promise.all([
      // HLV ngoài lớp không đọc được buổi (404): coi như không có mục tiêu.
      trial ? getSession(row.sessionId).then((item) => item.targetTimeMs, () => null) : Promise.resolve(null),
      // Chỉ HLV trưởng của lớp sửa kết quả, video, đánh giá sau buổi: cần biết lớp do ai phụ trách.
      row && role === 'HEAD_TRAINER' ? getClass(row.classId).then((item) => item.headTrainerId, () => null) : Promise.resolve(null),
    ]);
    return { horse, row, summary, metrics, trials, evaluation, thresholds, target, trainerId };
  }, [id, horseId]);

  const ongoing = data.data?.row?.participantStatus === 'ONGOING';
  const classTrainer = !!user && !!data.data?.trainerId && data.data.trainerId === user.id;
  // Socket buổi chỉ mở cho HLV của lớp. Người khác đọc điểm đo đã lưu.
  const live = useLiveMetrics({ sessionId: data.data?.row?.sessionId, participantIds: ongoing ? [id] : [], socket: classTrainer, enabled: ongoing && !owner });
  const points = live[id]?.points.length ? live[id].points : (data.data?.metrics ?? []);

  useCrumbs(
    data.data ? [...(data.data.horse ? [{ label: data.data.horse.name, to: links.horse(data.data.horse.id, 'training') }] : []), { label: data.data.row?.name ?? 'Lượt tập' }] : null,
    owner ? [{ label: 'Ngựa của tôi', to: links.horses }] : [{ label: 'Lớp huấn luyện', to: links.classes }],
  );

  useGSAP(
    () => {
      if (!data.data || prefersReducedMotion()) return;
      gsap.from('[data-fig]', { opacity: 0, y: 12, duration: 0.4, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
    },
    { scope, dependencies: [!!data.data] },
  );

  if (groom) {
    return (
      <EmptyState
        title="Trang này dành cho HLV trưởng"
        hint="Groom xem lịch ở trang Dắt ngựa tập."
        action={
          <Link to={links.today}>
            <Button variant="secondary">Mở lịch dắt ngựa</Button>
          </Link>
        }
      />
    );
  }
  if (data.loading && !data.data) return <Skeleton rows={6} />;
  if (data.error || !data.data) return <NotFound message={data.error} />;
  const { horse, row, summary, trials, evaluation, thresholds, target } = data.data;
  const departed = !!horse && leftClub(horse.lifecycleStatus);
  const videoOpen = !!row && resultEditable(row);
  const canEditVideo = classTrainer && videoOpen && !departed;
  // Sân tập của buổi chỉ HLV của lớp, quản lý, bác sĩ mở được.
  const canOpenBoard = classTrainer || role === 'CLUB_MANAGER' || role === 'VETERINARIAN';
  const limits = thresholds?.limits ?? CLUB_DEFAULT_LIMITS;
  const duration = summary?.firstRecordedAt && summary.lastRecordedAt ? (new Date(summary.lastRecordedAt).getTime() - new Date(summary.firstRecordedAt).getTime()) / 1000 : undefined;
  const best = trials.length ? Math.min(...trials.map((item) => item.elapsedMs)) : undefined;
  const alerts = summary ? summary.warningCount + summary.criticalCount : undefined;

  const figures = [
    { label: 'Nhịp tim trung bình', value: summary?.avgHeartRateBpm ?? '—', unit: 'bpm' },
    { label: 'Nhịp tim cao nhất', value: summary?.maxHeartRateBpm ?? '—', unit: 'bpm', tone: summary?.maxHeartRateBpm && summary.maxHeartRateBpm > limits.heartRateCriticalBpm ? 'red' : summary?.maxHeartRateBpm && summary.maxHeartRateBpm > limits.heartRateWarningBpm ? 'amber' : undefined },
    { label: 'Tốc độ trung bình', value: formatSpeed(summary?.avgSpeedMps ?? null) },
    { label: 'Tốc độ cao nhất', value: formatSpeed(summary?.maxSpeedMps ?? null), tone: summary?.maxSpeedMps && summary.maxSpeedMps > limits.maxSpeedMps ? 'amber' : undefined },
    { label: 'Số giây vượt ngưỡng', value: alerts ?? '—', hint: summary?.criticalCount ? `${summary.criticalCount} giây nguy hiểm` : undefined, tone: summary?.criticalCount ? 'red' : summary?.warningCount ? 'amber' : undefined },
  ];

  return (
    <div ref={scope} className="space-y-5">
      <BackLink fallback={horse ? links.horse(horse.id, 'training') : owner ? links.horses : links.classes} />

      <section className="turf-soft rounded-3xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">{row ? `${row.className} · ${formatDate(row.scheduledStartAt)} ${clubTime(row.scheduledStartAt)}` : 'Lượt tập'}</p>
            <h2 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight text-gray-900">
              {horse?.name ?? 'Ngựa'} <span className="text-gray-400">·</span> {row?.name ?? 'Buổi tập'}
              {row && <TrialBadge type={row.sessionType} className="text-xs" />}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
              {row && <ParticipantPill status={row.participantStatus} />}
              {row?.subjectName && <span>Môn {row.subjectName}</span>}
              {row?.groomName && <span>Groom {row.groomName}</span>}
              {row?.completedAt && (
                <span>
                  {row.participantStatus === 'STOPPED' ? 'Dừng sớm' : 'Hoàn thành'} {formatDateTime(row.completedAt)}
                </span>
              )}
              {duration !== undefined && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Timer size={13} /> {formatClock(duration)}
                </span>
              )}
            </div>
            {row?.participantStatus === 'STOPPED' && row.stoppedReason && <p className="mt-2 text-sm text-amber-800">Lý do dừng sớm: {row.stoppedReason}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {ongoing && !owner && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                <Radio size={13} className="animate-pulse" /> Đang chạy, cập nhật trực tiếp
              </span>
            )}
            {row && canOpenBoard && (
              <Link to={links.session(row.sessionId)} className="text-sm font-medium text-emerald-800 hover:underline">
                Mở sân tập của buổi
              </Link>
            )}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {figures.map((item) => (
            <div key={item.label} data-fig className={cn('rounded-2xl p-3.5 ring-1', item.tone === 'red' ? 'bg-red-50 ring-red-200' : item.tone === 'amber' ? 'bg-amber-50 ring-amber-200' : 'bg-white/80 ring-emerald-900/10')}>
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className={cn('mt-0.5 font-mono text-2xl font-bold tabular-nums', item.tone === 'red' ? 'text-red-700' : item.tone === 'amber' ? 'text-amber-800' : 'text-gray-900')}>
                {item.value}
                {item.unit && <span className="ml-1 text-xs font-normal text-gray-500">{item.unit}</span>}
              </p>
              {item.hint && <p className="text-xs text-red-700">{item.hint}</p>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-gray-200/80 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900">
              <HeartPulse size={17} className="text-emerald-700" /> Nhịp tim và tốc độ theo thời gian
            </h3>
            <span className="text-xs text-gray-500">Ngưỡng câu lạc bộ</span>
          </div>
          {owner ? (
            <Notice tone="info">Chủ ngựa xem các chỉ số tổng kết của buổi tập. Dữ liệu nhịp tim từng giây dành cho huấn luyện viên và bác sĩ.</Notice>
          ) : data.data.metrics === null && !live[id] ? (
            <Notice tone="info">Bạn không có quyền xem điểm đo từng giây của lượt này.</Notice>
          ) : (
            <MetricChart points={points} limits={limits} />
          )}
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200/80">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
              <MessageSquareQuote size={17} className="text-emerald-700" /> Đánh giá của HLV
            </h3>
            {evaluation ? (
              <div className="flex flex-col items-center text-center">
                <ScoreHorseshoe score={evaluation.score} size={120} />
                {evaluation.comment ? <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{evaluation.comment}</p> : <p className="mt-2 text-sm text-gray-400">Không có nhận xét</p>}
                <p className="mt-2 text-xs text-gray-400">
                  {row?.evaluation?.evaluatorName ? `${row.evaluation.evaluatorName} · ` : ''}
                  {formatDateTime(evaluation.createdAt)}
                  {evaluation.updatedAt !== evaluation.createdAt && ` · sửa ${formatDateTime(evaluation.updatedAt)}`}
                </p>
                {canEditVideo && (
                  <Button variant="inline" size="sm" className="mt-2" onClick={() => setEditingEvaluation(evaluation)}>
                    <Pencil size={13} /> Sửa đánh giá
                  </Button>
                )}
              </div>
            ) : (
              <EmptyState title="Chưa có đánh giá" hint={row && row.participantStatus !== 'COMPLETED' && row.participantStatus !== 'STOPPED' ? `Lượt đang ở trạng thái ${participantStatusText[row.participantStatus].toLowerCase()}.` : 'HLV đánh giá sau khi ngựa hoàn thành lượt.'} className="py-6" />
            )}
          </div>

          {(row?.sessionType === 'TIME_TRIAL' || trials.length > 0) && (
            <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200/80">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                <Flag size={16} className="text-amber-700" /> Kết quả chạy thử
              </h3>
              {trials.length === 0 ? (
                <p className="text-sm text-gray-400">Chưa ghi lần chạy nào</p>
              ) : (
                <ul className="space-y-1.5">
                  {trials.map((trial) => (
                    <li key={trial.id} className={cn('rounded-xl px-3 py-2 ring-1', trial.elapsedMs === best ? 'bg-emerald-50 ring-emerald-200' : 'bg-gray-50 ring-gray-100')}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Lần {trial.attemptNo}</span>
                        <span className="font-mono text-lg font-bold">{formatRaceTime(trial.elapsedMs)}</span>
                      </div>
                      {target && <p className={cn('text-right font-mono text-xs', trial.elapsedMs <= target ? 'text-emerald-700' : 'text-amber-700')}>{formatDelta(trial.elapsedMs - target)} so với mục tiêu {formatRaceTime(target)}</p>}
                      {trial.notes && <p className="mt-0.5 text-xs text-gray-600">{trial.notes}</p>}
                      {(trial.videoUrl || canEditVideo) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <TrialVideoButton url={trial.videoUrl} title={`${horse?.name ?? 'Ngựa'} lần chạy ${trial.attemptNo}`} onExpired={data.reload} />
                          {canEditVideo && (
                            <Button variant="inline" size="sm" onClick={() => setEditingTrial(trial)}>
                              <Pencil size={13} /> Sửa thời gian
                            </Button>
                          )}
                          {canEditVideo && (
                            <Button variant="inline" size="sm" onClick={() => setAttaching(trial)}>
                              <Film size={13} /> {trial.videoMediaId ? 'Đổi video' : 'Gắn video'}
                            </Button>
                          )}
                          {canEditVideo && trial.videoMediaId && (
                            <Button variant="ghost" size="sm" onClick={() => setRemoving(trial)}>
                              <Trash2 size={13} /> Gỡ
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {classTrainer && trials.length > 0 && (!videoOpen || departed) && (
                <p className="mt-2 text-xs text-gray-500">{departed ? 'Ngựa đã rời câu lạc bộ, kết quả chỉ được xem.' : 'Buổi đã hủy, không sửa kết quả được.'}</p>
              )}
            </div>
          )}
        </aside>
      </div>

      {editingTrial && (
        <TrialEditDialog
          participantId={id}
          trial={editingTrial}
          horseName={horse?.name ?? 'ngựa'}
          targetTimeMs={target}
          onClose={() => setEditingTrial(null)}
          onDone={() => {
            setEditingTrial(null);
            data.reload();
          }}
        />
      )}
      {editingEvaluation && (
        <EvaluationSheet
          participant={{ id }}
          horseName={horse?.name ?? 'ngựa'}
          sessionName={row?.name ?? 'Buổi tập'}
          existing={editingEvaluation}
          onClose={() => setEditingEvaluation(null)}
          onDone={() => {
            setEditingEvaluation(null);
            data.reload();
          }}
        />
      )}
      {attaching && (
        <TrialVideoAttachDialog
          participantId={id}
          attemptNo={attaching.attemptNo}
          replacing={!!attaching.videoMediaId}
          onClose={() => setAttaching(null)}
          onDone={() => {
            toast.push('Đã lưu video lần chạy', 'success');
            setAttaching(null);
            data.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        title={`Gỡ video lần chạy ${removing?.attemptNo ?? ''}`}
        message="Chủ ngựa sẽ không xem được video này nữa. Thời gian chạy và ghi chú giữ nguyên."
        confirmLabel="Gỡ video"
        pending={removeVideo.pending}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          void removeVideo.run(
            () => updateTrialVideo(id, removing.attemptNo, null),
            () => {
              toast.push('Đã gỡ video', 'success');
              setRemoving(null);
              data.reload();
            },
          )
        }
      >
        {removeVideo.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{removeVideo.error}</p>}
      </ConfirmDialog>
    </div>
  );
}
