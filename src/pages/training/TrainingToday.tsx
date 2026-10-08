// F2.3 — Lịch tập trong ngày.
// Groom ("Dắt ngựa tập"): các buổi trong ngày kèm ngựa mình dắt và nút bước kế tiếp, làm ngay ở đây không cần mở sân tập.
// HLV ("Hôm nay trên sân"): mọi buổi hôm nay của các lớp mình, số ngựa theo trạng thái, nút vào sân tập.
// Dòng thời gian trong ngày có vạch "bây giờ" chạy theo giờ thật.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock3, Flag, MapPin, UserX } from 'lucide-react';
import { checkInParticipant, getTimeTrial, readyParticipant, startParticipant, markParticipantAbsent } from '../../api/training';
import type { Participant } from '../../api/types';
import { Avatar, Button, EmptyState, ErrorBox, NotFound, PageHeader, Skeleton, cn, useToast } from '../../components/ui';
import { useAction, useService } from '../../hooks/useService';
import { useStore } from '../../store/store';
import { links } from '../../lib/links';
import { addDateKey, clubTime, clubToday, isoWeekdayOf } from '../../lib/club-time';
import { formatMeters } from '../../lib/training-format';
import { PARTICIPANT_FLOW, PARTICIPANT_OUT, ineligibleReasonText, participantStatusText, weekdayLong, weekdayShort } from '../../lib/training-labels';
import { gsap, useGSAP } from '../../lib/gsap';
import { prefersReducedMotion } from '../../lib/motion';
import { IntensityBars, ParticipantPill, SessionStatusPill, TrialBadge } from './components/bits';
import { ReasonDialog } from './components/ReasonDialog';
import { Elapsed } from './components/LiveMonitor';
import { CompleteDialog, TrialDialog } from './session/dialogs';
import { loadDayBoard, useHorseIndex, type DayBoardItem } from './hooks';

export default function TrainingToday() {
  const user = useStore((state) => state.currentUser);
  const toast = useToast();
  const groom = user?.role === 'GROOM';
  const trainer = user?.role === 'HEAD_TRAINER';
  const today = clubToday();
  const [day, setDay] = useState(today);
  const board = useService(() => loadDayBoard(day), [day], { silent: true });
  const { index: horses } = useHorseIndex();
  const scope = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<{ kind: 'absent' | 'complete' | 'trial'; participant: Participant; target?: number | null } | null>(null);
  const action = useAction();
  const { reload } = board;

  // Lượt có thể do HLV hoặc Groom khác đổi: tải lại mỗi 15 giây.
  useEffect(() => {
    const timer = window.setInterval(() => !document.hidden && reload(), 15_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  useGSAP(
    () => {
      if (!board.data || prefersReducedMotion()) return;
      gsap.from('[data-day-item]', { opacity: 0, x: -16, duration: 0.45, stagger: 0.07, ease: 'power3.out', clearProps: 'all' });
      gsap.from('[data-now-line]', { scaleX: 0, transformOrigin: 'left center', duration: 0.7, delay: 0.2, ease: 'power3.out' });
    },
    { scope, dependencies: [day, !!board.data] },
  );

  if (!groom && !trainer) return <NotFound message="Lịch dắt ngựa tập dành cho Groom và huấn luyện viên trưởng." />;

  const items = board.data ?? [];
  const nowIso = new Date().toISOString();
  const nowIndex = day === today ? items.findIndex((item) => item.session.scheduledStartAt > nowIso) : -1;
  const myCount = items.reduce((sum, item) => sum + item.participants.length, 0);

  const run = (label: string, fn: () => Promise<unknown>) =>
    void action.run(fn, () => {
      toast.push(label, 'success');
      reload();
    }).then((result) => result === undefined && reload());

  const nextStep = (item: DayBoardItem, participant: Participant) => {
    const name = horses.get(participant.horseId)?.name ?? 'Ngựa';
    const operational = item.session.status === 'SCHEDULED' || item.session.status === 'IN_PROGRESS';
    if (!operational) return null;
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
          onClick: async () => {
            if (item.session.sessionType === 'TIME_TRIAL') {
              const target = (await getTimeTrial(item.session.id).catch(() => null))?.targetTimeMs ?? null;
              setDialog({ kind: 'trial', participant, target });
            } else setDialog({ kind: 'complete', participant });
          },
        };
      default:
        return null;
    }
  };

  const days = Array.from({ length: 7 }, (_, offset) => addDateKey(day, offset - 3));

  return (
    <div ref={scope} className="space-y-5">
      <PageHeader
        title={groom ? 'Dắt ngựa tập' : 'Hôm nay trên sân'}
        description={groom ? 'Các buổi tập có ngựa bạn được giao dắt. Điểm danh, báo sẵn sàng, bắt đầu và hoàn thành ngay ở đây.' : 'Mọi buổi đã công bố trong ngày của các lớp bạn phụ trách.'}
      />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" title="Lùi một tuần" onClick={() => setDay(addDateKey(day, -7))}>
          <ChevronLeft size={16} />
        </Button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {days.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setDay(key)}
              className={cn(
                'rounded-xl px-1 py-2 text-center ring-1 transition',
                key === day ? 'bg-emerald-700 text-white ring-emerald-700' : key === today ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-white text-gray-700 ring-gray-200 hover:ring-gray-300',
              )}
            >
              <span className="block text-xs">{key === today ? 'Hôm nay' : weekdayShort[isoWeekdayOf(key)]}</span>
              <span className="block font-mono text-sm font-semibold">{key.slice(8, 10)}/{key.slice(5, 7)}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" title="Tới một tuần" onClick={() => setDay(addDateKey(day, 7))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      <p className="text-sm text-gray-600">
        {weekdayLong[isoWeekdayOf(day)]} {day.slice(8, 10)}/{day.slice(5, 7)} · <b className="font-mono">{items.length}</b> buổi
        {groom && (
          <>
            {' '}· <b className="font-mono">{myCount}</b> lượt bạn dắt
          </>
        )}
      </p>

      {action.error && <ErrorBox message={action.error} />}

      {board.loading && !board.data ? (
        <Skeleton rows={4} />
      ) : board.error ? (
        <ErrorBox message={board.error} />
      ) : items.length === 0 ? (
        <EmptyState title="Không có buổi tập nào trong ngày" hint={groom ? 'Khi HLV công bố buổi có ngựa bạn được giao, lịch hiện ở đây.' : 'Công bố buổi ở trang lớp để buổi hiện ở đây.'} />
      ) : (
        <ol className="relative space-y-4 border-l-2 border-emerald-100 pl-6">
          {items.map((item, position) => (
            <li key={item.session.id} data-day-item className="relative">
              {position === nowIndex && <NowLine />}
              <span
                className={cn(
                  'absolute -left-[31px] top-5 h-3.5 w-3.5 rounded-full ring-4 ring-[#f5f6f4]',
                  item.session.status === 'IN_PROGRESS' ? 'bg-emerald-600' : item.session.status === 'COMPLETED' ? 'bg-gray-400' : 'bg-white ring-emerald-200',
                )}
                aria-hidden
              />
              <article className={cn('rounded-2xl bg-white p-4 ring-1', item.session.status === 'IN_PROGRESS' ? 'shadow-grass-tint ring-2 ring-emerald-400/70' : 'ring-gray-200/80')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-mono text-sm font-semibold text-gray-900">
                      <Clock3 size={14} /> {clubTime(item.session.scheduledStartAt)} đến {clubTime(item.session.scheduledEndAt)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                      {item.session.name} <TrialBadge type={item.session.sessionType} />
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span>
                        {item.trainingClass.code} {item.trainingClass.name}
                      </span>
                      <IntensityBars intensity={item.session.intensity} />
                      <span className="font-mono">{formatMeters(item.session.plannedDistanceM)}</span>
                      {item.session.surface && <span>{item.session.surface}</span>}
                      {item.session.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} /> {item.session.location}
                        </span>
                      )}
                    </p>
                    {item.session.notes && <p className="mt-1 text-xs text-gray-600">Ghi chú: {item.session.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <SessionStatusPill status={item.session.status} />
                    <Link to={links.session(item.session.id)}>
                      <Button size="sm" variant={item.session.status === 'IN_PROGRESS' ? 'primary' : 'secondary'}>
                        {item.session.status === 'IN_PROGRESS' ? 'Vào sân tập' : 'Mở sân tập'}
                      </Button>
                    </Link>
                  </div>
                </div>

                {trainer ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[...PARTICIPANT_FLOW, 'OUT' as const].map((status) => {
                      const count = status === 'OUT' ? item.participants.filter((participant) => PARTICIPANT_OUT.includes(participant.status)).length : item.participants.filter((participant) => participant.status === status).length;
                      if (!count) return null;
                      return (
                        <span key={status} className={cn('rounded-lg px-2 py-1 text-xs ring-1', status === 'ONGOING' ? 'bg-emerald-50 font-semibold text-emerald-800 ring-emerald-200' : status === 'OUT' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-gray-50 text-gray-700 ring-gray-100')}>
                          {status === 'OUT' ? 'Không tập' : participantStatusText[status]} <b className="font-mono">{count}</b>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {item.participants.map((participant) => {
                      const horse = horses.get(participant.horseId);
                      const step = nextStep(item, participant);
                      return (
                        <li key={participant.id} className="flex items-center gap-3 rounded-xl bg-gray-50/80 p-2.5 ring-1 ring-gray-100">
                          <Avatar src={horse?.photoUrl ?? undefined} name={horse?.name ?? 'Ngựa'} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-gray-900">{horse?.name ?? 'Ngựa'}</p>
                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                              <ParticipantPill status={participant.status} />
                              {participant.status === 'ONGOING' && <Elapsed since={participant.startedAt} />}
                              {participant.status === 'INELIGIBLE' && <span>{ineligibleReasonText(participant.ineligibilityReason)}</span>}
                              {participant.status === 'ABSENT' && <span>{participant.absenceReason}</span>}
                            </div>
                          </div>
                          {participant.status === 'PLANNED' && step && (
                            <Button variant="ghost" size="icon" title="Báo vắng" onClick={() => setDialog({ kind: 'absent', participant })}>
                              <UserX size={15} />
                            </Button>
                          )}
                          {step && (
                            <Button size="sm" disabled={action.pending} variant={participant.status === 'ONGOING' ? 'secondary' : 'primary'} onClick={() => void step.onClick()}>
                              {participant.status === 'ONGOING' && item.session.sessionType === 'TIME_TRIAL' && <Flag size={13} />}
                              {step.label}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            </li>
          ))}
          {nowIndex === -1 && day === today && items.length > 0 && items.every((item) => item.session.scheduledStartAt <= nowIso) && (
            <li className="relative">
              <NowLine />
            </li>
          )}
        </ol>
      )}

      {dialog?.kind === 'absent' && (
        <ReasonDialog
          title={`Báo vắng ${horses.get(dialog.participant.horseId)?.name ?? 'ngựa'}`}
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
                toast.push('Đã báo vắng', 'success');
                setDialog(null);
                reload();
              },
            )
          }
        />
      )}
      {dialog?.kind === 'complete' && (
        <CompleteDialog participant={dialog.participant} horseName={horses.get(dialog.participant.horseId)?.name ?? 'Ngựa'} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload(); }} />
      )}
      {dialog?.kind === 'trial' && (
        <TrialDialog
          participant={dialog.participant}
          horseName={horses.get(dialog.participant.horseId)?.name ?? 'Ngựa'}
          targetTimeMs={dialog.target}
          completeAfter
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Vạch "bây giờ" trên dòng thời gian trong ngày. */
function NowLine() {
  const [time, setTime] = useState(() => clubTime(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setTime(clubTime(new Date())), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="relative -ml-[30px] mb-3 flex items-center gap-2" aria-label={`Bây giờ ${time}`}>
      <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-4 ring-red-100" />
      <span data-now-line className="h-0.5 flex-1 rounded-full bg-red-400" />
      <span className="font-mono text-xs font-semibold text-red-600">{time}</span>
    </div>
  );
}
