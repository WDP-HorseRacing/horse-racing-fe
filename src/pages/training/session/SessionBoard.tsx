// F2.3, F2.4, F2.5 — Sân tập của một buổi.
// Đường đua năm cột theo vòng đời lượt tập (Chờ điểm danh, Có mặt, Sẵn sàng, Đang chạy, Hoàn thành): thẻ ngựa trượt sang cột mới (GSAP Flip).
// Ngựa đang chạy có thẻ giám sát nhịp tim: HLV của lớp nhận qua socket, vai trò khác gọi lại mỗi 3 giây.
// Có điểm nguy hiểm thì băng đỏ trượt xuống, thẻ rung, bíp một lần mỗi lượt. Dải "Không tập" gom vắng, không đủ điều kiện, hủy do khóa.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertOctagon, ArrowLeft, CheckCircle2, Clock3, Flag, Lock, MapPin, MoreHorizontal, Radio, UserCog, UserX, XCircle } from 'lucide-react';
import {
  cancelSession,
  checkInParticipant,
  getClass,
  getEvaluation,
  getSession,
  getTimeTrial,
  listParticipants,
  listTrialResults,
  markParticipantAbsent,
  publishSession,
  readyParticipant,
  startParticipant,
} from '../../../api/training';
import { CLUB_DEFAULT_LIMITS, getThresholds } from '../../../api/performance';
import type { Evaluation, HorseThresholds, Participant, ParticipantStatus, TrialResult } from '../../../api/types';
import { ActionMenu, Avatar, Button, EmptyState, ErrorBox, NotFound, cn, useToast } from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { useStore } from '../../../store/store';
import { useCrumbs } from '../../../components/Breadcrumb';
import { links } from '../../../lib/links';
import { formatDate, formatTime } from '../../../lib/format';
import { clubTime } from '../../../lib/club-time';
import { formatMeters, formatRaceTime } from '../../../lib/training-format';
import { PARTICIPANT_FLOW, PARTICIPANT_OUT, ineligibleReasonText, isParticipantOpen, participantStatusText } from '../../../lib/training-labels';
import { playAlertBeep } from '../../../lib/sound';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { IntensityBars, ParticipantPill, SessionStatusPill, TrialBadge } from '../components/bits';
import { HeartbeatIcon, LiveNumber, useFlip } from '../components/motion';
import { Elapsed, LiveMonitorCard } from '../components/LiveMonitor';
import { ReasonDialog } from '../components/ReasonDialog';
import { useGroomIndex, useHorseIndex, useLiveMetrics, type LiveSeries } from '../hooks';
import { CompleteDialog, EvaluationSheet, GroomDialog, TrialDialog } from './dialogs';

type Dialog =
  | { kind: 'absent'; participant: Participant }
  | { kind: 'groom'; participant: Participant }
  | { kind: 'trial'; participant: Participant; complete?: boolean }
  | { kind: 'complete'; participant: Participant }
  | { kind: 'evaluate'; participant: Participant }
  | { kind: 'cancelSession' };

const COLUMN_HINT: Partial<Record<ParticipantStatus, string>> = {
  PLANNED: 'Groom dắt ngựa ra sân rồi điểm danh',
  PRESENT: 'Khởi động xong thì báo sẵn sàng',
  READY: 'HLV hoặc Groom bấm bắt đầu',
  ONGOING: 'Cảm biến gửi nhịp tim mỗi giây',
  COMPLETED: 'HLV đánh giá sau buổi',
};

export default function SessionBoard() {
  const { id = '' } = useParams();
  const user = useStore((state) => state.currentUser);
  const toast = useToast();
  const board = useService(
    async () => {
      const session = await getSession(id);
      const [trainingClass, participants, timeTrial] = await Promise.all([
        getClass(session.classId).catch(() => undefined),
        listParticipants(id),
        session.sessionType === 'TIME_TRIAL' ? getTimeTrial(id).catch(() => null) : Promise.resolve(null),
      ]);
      return { session, trainingClass, participants, timeTrial };
    },
    [id],
    { silent: true },
  );
  const { index: horses } = useHorseIndex();
  const role = user?.role;
  const session = board.data?.session;
  const trainingClass = board.data?.trainingClass;
  const participants = useMemo(() => board.data?.participants ?? [], [board.data]);
  const manage = role === 'HEAD_TRAINER' && !!trainingClass && trainingClass.headTrainerId === user?.id;
  const { index: grooms, grooms: groomList } = useGroomIndex(role === 'HEAD_TRAINER' || role === 'CLUB_MANAGER');
  useCrumbs(session ? [...(trainingClass ? [{ label: trainingClass.name, to: links.class(trainingClass.id) }] : []), { label: session.name }] : null, [{ label: 'Lớp huấn luyện', to: links.classes }]);

  // Lượt có thể do người khác thao tác (Groom điểm danh, HLV bắt đầu): tải lại mỗi 10 giây khi tab đang mở.
  const { reload } = board;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) reload();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const ongoing = participants.filter((participant) => participant.status === 'ONGOING');
  const live = useLiveMetrics({ sessionId: id, participantIds: ongoing.map((participant) => participant.id), socket: manage, enabled: role !== 'HORSE_OWNER' });

  // Ngưỡng của ngựa đang chạy (Groom không đọc được ngưỡng: dùng mặc định câu lạc bộ).
  const canReadThresholds = role === 'HEAD_TRAINER' || role === 'CLUB_MANAGER' || role === 'VETERINARIAN';
  const ongoingHorseKey = ongoing.map((participant) => participant.horseId).sort().join(',');
  const thresholds = useService(
    async () => {
      if (!canReadThresholds || !ongoingHorseKey) return new Map<string, HorseThresholds>();
      const entries = await Promise.all(ongoingHorseKey.split(',').map(async (horseId) => [horseId, await getThresholds(horseId).catch(() => null)] as const));
      return new Map(entries.filter((entry): entry is [string, HorseThresholds] => !!entry[1]));
    },
    [ongoingHorseKey, canReadThresholds],
    { silent: true },
  );

  // Kết quả chạy thử và đánh giá của các lượt đã chạy.
  const finishedKey = participants
    .filter((participant) => participant.status === 'ONGOING' || participant.status === 'COMPLETED')
    .map((participant) => `${participant.id}:${participant.status}`)
    .join(',');
  const extras = useService(
    async () => {
      const ran = participants.filter((participant) => participant.status === 'ONGOING' || participant.status === 'COMPLETED');
      const trials = new Map<string, TrialResult[]>();
      const evaluations = new Map<string, Evaluation | null>();
      await Promise.all(
        ran.map(async (participant) => {
          if (session?.sessionType === 'TIME_TRIAL') trials.set(participant.id, await listTrialResults(participant.id).catch(() => []));
          if (participant.status === 'COMPLETED') evaluations.set(participant.id, await getEvaluation(participant.id).catch(() => null));
        }),
      );
      return { trials, evaluations };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finishedKey, session?.sessionType],
    { silent: true },
  );

  // Cảnh báo nguy hiểm: bíp một lần mỗi lượt, băng đỏ tới khi bấm Đã xem.
  const beeped = useRef(new Set<string>());
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const criticalIds = Object.entries(live)
    .filter(([, series]) => series.hadCritical)
    .map(([participantId]) => participantId);
  useEffect(() => {
    criticalIds.forEach((participantId) => {
      if (beeped.current.has(participantId)) return;
      beeped.current.add(participantId);
      playAlertBeep();
    });
  }, [criticalIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const alerting = criticalIds.filter((participantId) => !acked.has(participantId) && ongoing.some((participant) => participant.id === participantId));

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const action = useAction();
  const sessionAction = useAction();
  const trackRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const scope = useRef<HTMLDivElement>(null);
  const statusKey = participants.map((participant) => `${participant.id}:${participant.status}`).join(',');
  useFlip(trackRef, statusKey);

  useGSAP(
    () => {
      if (!board.data || prefersReducedMotion()) return;
      gsap.from('[data-lane]', { opacity: 0, y: 18, duration: 0.45, stagger: 0.06, ease: 'power3.out', clearProps: 'all' });
    },
    { scope, dependencies: [!!board.data] },
  );
  // Băng cảnh báo trượt xuống khi có ngựa vượt ngưỡng nguy hiểm.
  useGSAP(
    () => {
      if (!bannerRef.current || alerting.length === 0 || prefersReducedMotion()) return;
      gsap.fromTo(bannerRef.current, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(2)' });
    },
    { dependencies: [alerting.length > 0] },
  );

  if (board.loading && !board.data) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-36 w-full rounded-3xl" />
        <div className="grid gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (board.error || !board.data || !session) return <NotFound message={board.error} />;

  const horseName = (participant: Participant) => horses.get(participant.horseId)?.name ?? 'Ngựa';
  const canOperate = (participant: Participant) => manage || (role === 'GROOM' && participant.assignedGroomId === user?.id);
  const target = board.data.timeTrial?.targetTimeMs ?? null;
  const operational = session.status === 'SCHEDULED' || session.status === 'IN_PROGRESS';
  // BE chuyển buổi sang Đang diễn ra khi lượt đầu tiên bắt đầu, không so với giờ trên lịch.
  const firstStart = participants.map((participant) => participant.startedAt).filter((value): value is string => !!value).sort()[0];
  const startedEarly = !!firstStart && firstStart < session.scheduledStartAt;

  const run = (label: string, fn: () => Promise<unknown>) =>
    void action.run(fn, () => {
      toast.push(label, 'success');
      reload();
    }).then((result) => {
      // 409 ở điểm danh, bắt đầu vẫn đổi trạng thái lượt ở BE: tải lại để thẻ nhảy đúng cột.
      if (result === undefined) reload();
    });

  const primaryAction = (participant: Participant) => {
    if (!operational || !canOperate(participant)) return null;
    const name = horseName(participant);
    switch (participant.status) {
      case 'PLANNED':
        return { label: 'Điểm danh', onClick: () => run(`${name} có mặt`, () => checkInParticipant(participant.id)) };
      case 'PRESENT':
        return { label: 'Báo sẵn sàng', onClick: () => run(`${name} sẵn sàng`, () => readyParticipant(participant.id)) };
      case 'READY':
        return { label: 'Bắt đầu', onClick: () => run(`${name} bắt đầu chạy`, () => startParticipant(participant.id)) };
      case 'ONGOING':
        return {
          label: 'Hoàn thành',
          onClick: () => setDialog(session.sessionType === 'TIME_TRIAL' ? { kind: 'trial', participant, complete: true } : { kind: 'complete', participant }),
        };
      default:
        return null;
    }
  };

  const lanes = PARTICIPANT_FLOW.map((status) => ({ status, items: participants.filter((participant) => participant.status === status) }));
  const out = participants.filter((participant) => PARTICIPANT_OUT.includes(participant.status));
  const counts = PARTICIPANT_FLOW.map((status) => participants.filter((participant) => participant.status === status).length);
  const leaderboard =
    session.sessionType === 'TIME_TRIAL'
      ? participants
          .map((participant) => {
            const list = extras.data?.trials.get(participant.id) ?? [];
            return { participant, best: list.length ? Math.min(...list.map((item) => item.elapsedMs)) : undefined };
          })
          .filter((row): row is { participant: Participant; best: number } => row.best !== undefined)
          .sort((a, b) => a.best - b.best)
      : [];

  return (
    <div ref={scope} className="space-y-5">
      {trainingClass && (
        <Link to={links.class(trainingClass.id)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
          <ArrowLeft size={15} /> {trainingClass.code} {trainingClass.name}
        </Link>
      )}

      {alerting.length > 0 && (
        <div ref={bannerRef} className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl bg-red-600 px-5 py-3.5 text-white shadow-red-tint">
          <AlertOctagon size={22} className="shrink-0 animate-pulse" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {alerting.map((participantId) => horseName(participants.find((participant) => participant.id === participantId)!)).join(', ')} vượt ngưỡng nhịp tim nguy hiểm
            </p>
            <p className="text-sm text-red-100">Cân nhắc dừng bài tập và kiểm tra ngựa ngay. Bác sĩ thú y đã nhận thông báo khẩn.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setAcked((current) => new Set([...current, ...alerting]))}>
            Đã xem
          </Button>
        </div>
      )}

      <section className="turf-soft rounded-3xl p-5 shadow-grass-tint ring-1 ring-emerald-900/10 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">Sân tập · {formatDate(session.scheduledStartAt)}</p>
            <h2 className="flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight text-gray-900">
              {session.name} <TrialBadge type={session.sessionType} className="text-xs" />
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
              <SessionStatusPill status={session.status} />
              {startedEarly && (
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200" title="Lượt đầu tiên bắt đầu trước giờ trên lịch">
                  Bắt đầu sớm hơn lịch
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-mono">
                <Clock3 size={13} /> {clubTime(session.scheduledStartAt)} đến {clubTime(session.scheduledEndAt)}
              </span>
              <IntensityBars intensity={session.intensity} />
              <span className="font-mono">{formatMeters(session.plannedDistanceM)}</span>
              {session.surface && <span>{session.surface}</span>}
              {session.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {session.location}
                </span>
              )}
              {target && <span className="font-mono text-amber-800">Mục tiêu {formatRaceTime(target)}</span>}
            </div>
            {session.notes && <p className="mt-2 max-w-2xl text-sm text-gray-600">{session.notes}</p>}
            {session.cancelReason && <p className="mt-2 text-sm text-red-700">Lý do hủy: {session.cancelReason}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {ongoing.length > 0 && role !== 'HORSE_OWNER' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                <Radio size={13} className="animate-pulse" /> {manage ? 'Nhận nhịp tim trực tiếp' : 'Cập nhật mỗi 3 giây'}
              </span>
            )}
            {manage && (
              <div className="flex gap-2">
                {session.status === 'DRAFT' && trainingClass?.status === 'ACTIVE' && (
                  <Button
                    disabled={sessionAction.pending}
                    onClick={() =>
                      void sessionAction.run(
                        () => publishSession(session.id),
                        () => {
                          toast.push('Đã công bố buổi', 'success');
                          reload();
                        },
                      )
                    }
                  >
                    Công bố buổi
                  </Button>
                )}
                {session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
                  <Button variant="inlineDanger" onClick={() => setDialog({ kind: 'cancelSession' })}>
                    <XCircle size={14} /> Hủy buổi
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Thanh đếm theo cột */}
        <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-emerald-900/10">
          {counts.map((count, index) =>
            count ? (
              <span
                key={PARTICIPANT_FLOW[index]}
                title={`${participantStatusText[PARTICIPANT_FLOW[index]]}: ${count}`}
                className={cn('transition-all duration-500', ['bg-gray-300', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600', 'bg-emerald-800'][index])}
                style={{ flexGrow: count }}
              />
            ) : null,
          )}
          {out.length > 0 && <span className="bg-amber-300" style={{ flexGrow: out.length }} title={`Không tập: ${out.length}`} />}
        </div>
      </section>

      {(action.error || sessionAction.error) && <ErrorBox message={(action.error ?? sessionAction.error)!} />}
      {session.status === 'DRAFT' && <EmptyState title="Buổi còn nháp" hint="Công bố buổi thì mỗi ngựa đang học trong lớp có một lượt tập ở đây." />}

      {/* Giám sát nhịp tim của ngựa đang chạy */}
      {ongoing.length > 0 && role !== 'HORSE_OWNER' && (
        <section className="grid gap-4 lg:grid-cols-12">
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
            {ongoing.map((participant) => {
              const horse = horses.get(participant.horseId);
              const limits = thresholds.data?.get(participant.horseId);
              return (
                <LiveMonitorCard
                  key={participant.id}
                  participantId={participant.id}
                  horseId={participant.horseId}
                  horseName={horse?.name ?? 'Ngựa'}
                  photoUrl={horse?.photoUrl ?? undefined}
                  startedAt={participant.startedAt}
                  live={live[participant.id]}
                  limits={limits?.activeLimits ?? CLUB_DEFAULT_LIMITS}
                  limitsSource={limits?.source ?? 'CLUB_DEFAULT'}
                  acknowledged={acked.has(participant.id)}
                  onAcknowledge={() => setAcked((current) => new Set([...current, participant.id]))}
                  actions={
                    canOperate(participant) && operational ? (
                      <Button size="sm" onClick={() => primaryAction(participant)?.onClick()}>
                        <CheckCircle2 size={13} /> Hoàn thành
                      </Button>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
          <aside className="space-y-3 lg:col-span-4">
            <SessionSummary participants={participants} leaderboard={leaderboard} target={target} horseName={horseName} />
          </aside>
        </section>
      )}

      {/* Đường đua trạng thái */}
      {session.status !== 'DRAFT' && (
        <div ref={trackRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {lanes.map((lane) => (
            <section key={lane.status} data-lane className="track-lane flex min-h-48 flex-col rounded-2xl bg-white/70 p-2.5 ring-1 ring-gray-200/80">
              <header className="mb-2 px-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">{participantStatusText[lane.status]}</h3>
                  <span className="rounded-md bg-gray-100 px-1.5 font-mono text-xs font-semibold text-gray-600">{lane.items.length}</span>
                </div>
                <p className="text-[11px] text-gray-400">{COLUMN_HINT[lane.status]}</p>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {lane.items.map((participant) => (
                  <ParticipantCard
                    key={participant.id}
                    participant={participant}
                    horseName={horseName(participant)}
                    photoUrl={horses.get(participant.horseId)?.photoUrl ?? undefined}
                    groomLabel={
                      // Bác sĩ, Groom không đọc được danh sách Groom: có người dắt nhưng không biết tên thì ghi chung.
                      !participant.assignedGroomId
                        ? 'Chưa giao Groom'
                        : participant.assignedGroomId === user?.id
                          ? 'Bạn dắt'
                          : grooms.get(participant.assignedGroomId)
                            ? `Groom ${grooms.get(participant.assignedGroomId)!.fullName}`
                            : 'Đã có Groom dắt'
                    }
                    live={live[participant.id]}
                    primary={primaryAction(participant)}
                    pending={action.pending}
                    evaluation={extras.data?.evaluations.get(participant.id)}
                    trials={extras.data?.trials.get(participant.id)}
                    target={target}
                    menu={[
                      ...(participant.status === 'PLANNED' && operational && canOperate(participant)
                        ? [{ label: 'Báo vắng', icon: <UserX size={14} />, onSelect: () => setDialog({ kind: 'absent', participant }) }]
                        : []),
                      ...(manage && isParticipantOpen(participant.status) ? [{ label: 'Đổi Groom dắt', icon: <UserCog size={14} />, onSelect: () => setDialog({ kind: 'groom', participant }) }] : []),
                      ...(session.sessionType === 'TIME_TRIAL' && session.status === 'IN_PROGRESS' && canOperate(participant) && (participant.status === 'ONGOING' || participant.status === 'COMPLETED')
                        ? [{ label: 'Ghi thời gian chạy', icon: <Flag size={14} />, onSelect: () => setDialog({ kind: 'trial', participant }) }]
                        : []),
                    ]}
                    onEvaluate={manage && participant.status === 'COMPLETED' && extras.data && extras.data.evaluations.get(participant.id) === null ? () => setDialog({ kind: 'evaluate', participant }) : undefined}
                  />
                ))}
                {lane.items.length === 0 && <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-300">Trống</div>}
              </div>
            </section>
          ))}
        </div>
      )}

      {out.length > 0 && (
        <section className="rounded-2xl bg-amber-50/50 p-4 ring-1 ring-amber-200/60">
          <h3 className="mb-2 text-sm font-semibold text-amber-900">Không tập buổi này</h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {out.map((participant) => (
              <li key={participant.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white p-2.5 ring-1 ring-amber-100">
                <Avatar src={horses.get(participant.horseId)?.photoUrl ?? undefined} name={horseName(participant)} size={34} />
                <div className="min-w-0 flex-1">
                  <Link to={links.horse(participant.horseId)} className="block truncate text-sm font-semibold text-gray-900 hover:text-emerald-800">
                    {horseName(participant)}
                  </Link>
                  <p className="truncate text-xs text-gray-600">
                    {participant.status === 'ABSENT'
                      ? participant.absenceReason
                      : participant.status === 'INELIGIBLE'
                        ? ineligibleReasonText(participant.ineligibilityReason)
                        : participant.status === 'CANCELLED_BY_LOCK'
                          ? 'Đang bị khóa huấn luyện'
                          : participant.cancelReason}
                  </p>
                </div>
                <ParticipantPill status={participant.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {ongoing.length === 0 && session.status !== 'DRAFT' && participants.length > 0 && (
        <SessionSummary participants={participants} leaderboard={leaderboard} target={target} horseName={horseName} inline />
      )}

      {/* Hộp thoại */}
      {dialog?.kind === 'absent' && (
        <ReasonDialog
          title={`Báo vắng ${horseName(dialog.participant)}`}
          label="Lý do vắng"
          suggestions={['Ngựa bỏ ăn', 'Móng trước bị xước nhẹ', 'Ngựa có dấu hiệu mệt']}
          confirmLabel="Báo vắng"
          pending={action.pending}
          error={action.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) =>
            void action.run(
              () => markParticipantAbsent(dialog.participant.id, reason),
              () => {
                toast.push(`Đã báo vắng ${horseName(dialog.participant)}`, 'success');
                setDialog(null);
                reload();
              },
            )
          }
        />
      )}
      {dialog?.kind === 'groom' && <GroomDialog participant={dialog.participant} horseName={horseName(dialog.participant)} grooms={groomList} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload(); }} />}
      {dialog?.kind === 'trial' && (
        <TrialDialog
          participant={dialog.participant}
          horseName={horseName(dialog.participant)}
          targetTimeMs={target}
          completeAfter={dialog.complete}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            reload();
            extras.reload();
          }}
        />
      )}
      {dialog?.kind === 'complete' && <CompleteDialog participant={dialog.participant} horseName={horseName(dialog.participant)} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload(); }} />}
      {dialog?.kind === 'evaluate' && (
        <EvaluationSheet
          participant={dialog.participant}
          horseName={horseName(dialog.participant)}
          sessionName={session.name}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            extras.reload();
          }}
        />
      )}
      {dialog?.kind === 'cancelSession' && (
        <ReasonDialog
          title="Hủy buổi tập"
          message="Lượt tập còn mở của buổi bị hủy theo. Không hủy được khi còn ngựa đang chạy."
          label="Lý do hủy buổi"
          suggestions={['Mưa lớn, sân trơn', 'Sân tập bảo trì']}
          confirmLabel="Hủy buổi"
          pending={sessionAction.pending}
          error={sessionAction.error}
          onClose={() => setDialog(null)}
          onConfirm={(reason) =>
            void sessionAction.run(
              () => cancelSession(session.id, reason),
              () => {
                toast.push('Đã hủy buổi tập', 'success');
                setDialog(null);
                reload();
              },
            )
          }
        />
      )}
    </div>
  );
}

function ParticipantCard({
  participant,
  horseName,
  photoUrl,
  groomLabel,
  live,
  primary,
  pending,
  evaluation,
  trials,
  target,
  menu,
  onEvaluate,
}: {
  participant: Participant;
  horseName: string;
  photoUrl?: string;
  groomLabel: string;
  live?: LiveSeries;
  primary: { label: string; onClick: () => void } | null;
  pending: boolean;
  evaluation?: Evaluation | null;
  trials?: TrialResult[];
  target: number | null;
  menu: { label: string; icon: React.ReactNode; onSelect: () => void }[];
  onEvaluate?: () => void;
}) {
  const level = live?.level ?? 'NORMAL';
  const best = trials?.length ? Math.min(...trials.map((item) => item.elapsedMs)) : undefined;
  const lockedWarning = participant.trainingLocked && isParticipantOpen(participant.status);
  return (
    <article
      data-flip-id={participant.id}
      className={cn(
        'rounded-xl bg-white p-2.5 ring-1 transition-colors',
        participant.status === 'ONGOING' ? (level === 'CRITICAL' ? 'ring-2 ring-red-400' : level === 'WARNING' ? 'ring-2 ring-amber-300' : 'ring-2 ring-emerald-400/70') : 'ring-gray-200/80',
        'shadow-[0_8px_18px_-16px_rgba(6,78,59,0.6)]',
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar src={photoUrl} name={horseName} size={30} />
        <div className="min-w-0 flex-1">
          <Link to={links.horse(participant.horseId)} className="block truncate text-sm font-semibold text-gray-900 hover:text-emerald-800">
            {horseName}
          </Link>
          <p className="truncate text-[11px] text-gray-500">{groomLabel}</p>
        </div>
        {menu.length > 0 && (
          <ActionMenu
            items={menu}
            trigger={
              <button type="button" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Thao tác khác">
                <MoreHorizontal size={16} />
              </button>
            }
          />
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
        {participant.status === 'PRESENT' && participant.checkedInAt && <span>Có mặt {formatTime(participant.checkedInAt)}</span>}
        {participant.status === 'ONGOING' && (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
            <Clock3 size={11} /> <Elapsed since={participant.startedAt} />
          </span>
        )}
        {participant.status === 'COMPLETED' && participant.startedAt && participant.completedAt && (
          <span>
            Chạy <Elapsed since={participant.startedAt} until={participant.completedAt} />
          </span>
        )}
        {participant.status === 'ONGOING' && live?.latest && (
          <span className={cn('ml-auto inline-flex items-center gap-1 font-mono text-xs font-semibold', level === 'CRITICAL' ? 'text-red-700' : level === 'WARNING' ? 'text-amber-800' : 'text-gray-800')}>
            <HeartbeatIcon bpm={live.latest.heartRateBpm} level={level} size={13} />
            <LiveNumber value={live.latest.heartRateBpm} />
          </span>
        )}
      </div>

      {lockedWarning && (
        <p className="mt-1.5 flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-1 text-[11px] font-medium text-red-700">
          <Lock size={11} /> Đang khóa huấn luyện, sẽ bị chặn khi bắt đầu
        </p>
      )}

      {(best !== undefined || evaluation) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {best !== undefined && (
            <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold', target && best <= target ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
              {formatRaceTime(best)}
            </span>
          )}
          {evaluation && <span className="rounded-md bg-emerald-700 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{evaluation.score} điểm</span>}
        </div>
      )}

      {(primary || onEvaluate) && (
        <div className="mt-2">
          {primary && (
            <Button size="sm" className="w-full" disabled={pending} variant={participant.status === 'ONGOING' ? 'secondary' : 'primary'} onClick={primary.onClick}>
              {primary.label}
            </Button>
          )}
          {onEvaluate && (
            <Button size="sm" variant="inline" className="w-full" onClick={onEvaluate}>
              Đánh giá
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function SessionSummary({
  participants,
  leaderboard,
  target,
  horseName,
  inline,
}: {
  participants: Participant[];
  leaderboard: { participant: Participant; best: number }[];
  target: number | null;
  horseName: (participant: Participant) => string;
  inline?: boolean;
}) {
  const done = participants.filter((participant) => participant.status === 'COMPLETED').length;
  const running = participants.filter((participant) => participant.status === 'ONGOING').length;
  const waiting = participants.filter((participant) => isParticipantOpen(participant.status)).length;
  const out = participants.filter((participant) => PARTICIPANT_OUT.includes(participant.status)).length;
  return (
    <div className={cn('rounded-2xl bg-white p-4 ring-1 ring-gray-200/80', inline && 'grid gap-4 sm:grid-cols-2')}>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Tình hình buổi</h3>
        <dl className="grid grid-cols-2 gap-2">
          {[
            { label: 'Đang chạy', value: running },
            { label: 'Hoàn thành', value: done },
            { label: 'Chờ', value: waiting },
            { label: 'Không tập', value: out },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100">
              <dt className="text-xs text-gray-500">{item.label}</dt>
              <dd className="font-mono text-xl font-bold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {leaderboard.length > 0 && (
        <div className={inline ? '' : 'mt-4'}>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Bảng thời gian chạy thử</h3>
          <ol className="space-y-1">
            {leaderboard.map((row, index) => (
              <li key={row.participant.id} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm', index === 0 ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-gray-50')}>
                <span className="w-5 font-mono text-xs text-gray-400">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{horseName(row.participant)}</span>
                <span className="font-mono font-semibold">{formatRaceTime(row.best)}</span>
                {target && <span className={cn('font-mono text-xs', row.best <= target ? 'text-emerald-700' : 'text-amber-700')}>{row.best <= target ? 'đạt' : `+${((row.best - target) / 1000).toFixed(2)}`}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
