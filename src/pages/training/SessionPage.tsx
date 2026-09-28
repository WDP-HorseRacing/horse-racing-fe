// Trang một buổi học — nội dung đổi theo trạng thái:
// Đã lên lịch → danh sách ngựa + bắt đầu; Đang diễn ra → bảng theo dõi trực tiếp;
// Chờ đánh giá / Hoàn thành → chấm từng ngựa; Đã hủy → lý do hủy.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock, Flag, MapPin, Octagon, Play, Square, UserRound } from 'lucide-react';
import { Button, ConfirmDialog, Notice, NotFound, Pill, Skeleton, useToast } from '../../components/ui';
import { IntensityPill, SessionPill } from '../../components/ui/status';
import { useAction, useService } from '../../hooks/useService';
import {
  emergencyStop,
  finishSession,
  getSession,
  type SessionDetail,
  type StartSessionResult,
} from '../../services/session.service';
import { dayOfWeekLabel, surfaceLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { formatDate, formatDateTime, isoDayOfWeek } from '../../lib/format';
import LiveBoard from './components/LiveBoard';
import ReasonModal from './components/ReasonModal';
import ReviewView from './components/ReviewView';
import RosterStatusView from './components/RosterStatusView';
import ScheduledView from './components/ScheduledView';
import StartResultNotice from './components/StartResultNotice';
import StartSessionModal from './components/StartSessionModal';
import { subjectExtra } from './components/session-helpers';

export default function SessionPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useService(() => getSession(id), [id]);
  const [startResult, setStartResult] = useState<StartSessionResult | undefined>(
    (location.state as { startResult?: StartSessionResult } | null)?.startResult,
  );
  const [startOpen, setStartOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const finishAction = useAction();

  const status = data?.header.status;
  const live = status === 'IN_PROGRESS' && !!data?.flags.canViewLive;

  // Ai không có bảng realtime thì làm tươi trang để thấy buổi tự kết thúc, việc của Groom khác…
  useEffect(() => {
    if (!status || live) return;
    const every = status === 'IN_PROGRESS' ? 3000 : status === 'SCHEDULED' ? 8000 : 0;
    if (!every) return;
    const timer = window.setInterval(reload, every);
    return () => window.clearInterval(timer);
  }, [status, live, reload]);

  const onEnded = useCallback(() => {
    reload();
  }, [reload]);

  if (loading && !data) return <Skeleton rows={6} />;
  if (error || !data) return <NotFound message={error} />;

  const { header, flags } = data;

  return (
    <div className="space-y-6">
      <SessionHeaderStrip
        detail={data}
        onBack={() => navigate(header.status === 'AWAITING_REVIEW' ? links.review : links.today)}
        actions={
          <>
            {flags.canStart && header.status !== 'SCHEDULED' && (
              <Button onClick={() => setStartOpen(true)}>
                <Play size={15} /> Bắt đầu
              </Button>
            )}
            {flags.canFinish && (
              <Button variant="soft" onClick={() => setFinishOpen(true)}>
                <Square size={14} /> Kết thúc buổi
              </Button>
            )}
            {flags.canStop && (
              <Button variant="danger" onClick={() => setStopOpen(true)}>
                <Octagon size={14} /> Dừng khẩn
              </Button>
            )}
          </>
        }
      />

      {startResult && status !== 'SCHEDULED' && (
        <StartResultNotice result={startResult} onDismiss={() => setStartResult(undefined)} />
      )}

      {header.status === 'CANCELLED' && (
        <Notice tone="danger">
          <p className="font-semibold">Buổi đã hủy{header.cancelKindLabel ? ` — ${header.cancelKindLabel}` : ''}</p>
          <p className="mt-0.5">{header.cancelReason ?? 'Không ghi lý do'}</p>
          <p className="mt-1 text-xs opacity-75">
            {header.cancelledByName ?? 'Hệ thống'} · {formatDateTime(header.cancelledAt)}. Hủy buổi áp dụng cho cả lớp.
          </p>
        </Notice>
      )}

      {(header.status === 'SCHEDULED' || header.status === 'CANCELLED') && (
        <ScheduledView detail={data} onChanged={reload} onStart={() => setStartOpen(true)} />
      )}

      {header.status === 'IN_PROGRESS' &&
        (live ? <LiveBoard sessionId={header.id} onEnded={onEnded} /> : <RosterStatusView detail={data} onChanged={reload} />)}

      {(header.status === 'AWAITING_REVIEW' || header.status === 'COMPLETED') &&
        (data.canSeeResults ? (
          <ReviewView detail={data} onChanged={reload} />
        ) : (
          <RosterStatusView detail={data} onChanged={reload} />
        ))}

      {startOpen && (
        <StartSessionModal
          open={startOpen}
          onClose={() => setStartOpen(false)}
          header={header}
          horses={data.horses}
          totalHorses={data.totalHorses}
          startWarning={flags.startWarning}
          onStarted={(result) => {
            setStartResult(result);
            toast.push(`Buổi ${header.className} đã bắt đầu`, 'success');
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={finishOpen}
        title="Kết thúc buổi học"
        message="Chốt chỉ số tổng hợp cho từng ngựa có mặt, dừng luồng dữ liệu và chuyển buổi sang Chờ đánh giá. Chỉ số đã chốt không ai sửa được."
        confirmLabel="Kết thúc buổi"
        danger={false}
        pending={finishAction.pending}
        onClose={() => {
          setFinishOpen(false);
          finishAction.clearError();
        }}
        onConfirm={async () => {
          const done = await finishAction.run(() => finishSession(header.id));
          if (done === undefined) return;
          setFinishOpen(false);
          toast.push('Đã kết thúc buổi, chờ HT đánh giá', 'success');
          reload();
        }}
      >
        {finishAction.error && <Notice tone="danger">{finishAction.error}</Notice>}
      </ConfirmDialog>

      <ReasonModal
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        title="Dừng khẩn buổi học"
        description="Mọi ngựa dừng ngay, chỉ số được chốt và buổi chuyển sang Chờ đánh giá với nhãn Dừng khẩn."
        message="Thao tác không hoàn tác được. Muốn dừng riêng một ngựa thì dùng nút Dừng ngựa này trên bảng theo dõi."
        confirmLabel="Dừng khẩn"
        placeholder="Ví dụ: sân trơn sau mưa, nguy cơ trượt ngã"
        onSubmit={async (reason) => {
          const done = await emergencyStop(header.id, reason);
          toast.push('Đã dừng khẩn buổi học', 'success');
          reload();
          return done;
        }}
      />
    </div>
  );
}

function SessionHeaderStrip({
  detail,
  onBack,
  actions,
}: {
  detail: SessionDetail;
  onBack: () => void;
  actions: ReactNode;
}) {
  const { header } = detail;
  const facts = [
    {
      icon: <CalendarDays size={14} />,
      label: `${dayOfWeekLabel[isoDayOfWeek(header.date)]}, ${formatDate(header.date)}`,
    },
    { icon: <Clock size={14} />, label: `Slot ${header.slotLabel}` },
    { icon: <Flag size={14} />, label: `Mặt sân ${surfaceLabel[header.surface].toLowerCase()}` },
    ...(header.zoneName ? [{ icon: <MapPin size={14} />, label: header.zoneName }] : []),
    ...(header.trainerName ? [{ icon: <UserRound size={14} />, label: `HT ${header.trainerName}` }] : []),
  ];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 transition hover:text-emerald-700"
      >
        <ArrowLeft size={15} /> {header.status === 'AWAITING_REVIEW' ? 'Buổi chờ đánh giá' : 'Buổi tập hôm nay'}
      </button>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-3xl bg-linear-to-br from-emerald-50/80 via-white to-lime-50/60 px-6 py-5 ring-1 ring-emerald-950/[0.05]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-700">
            <Link to={links.class(header.classId)} className="hover:underline">
              Lớp {header.className}
            </Link>
            {header.phaseName ? ` · ${header.phaseName}${header.weekNo ? `, tuần ${header.weekNo}` : ''}` : ''}
          </p>
          <h2 className="mt-1 text-[1.65rem] font-bold leading-tight tracking-tight text-gray-900">
            {header.subjectName}
            {subjectExtra(header) && (
              <span className="font-light text-gray-400">
                {subjectExtra(header).startsWith('×') ? ' ' : ' · '}
                {subjectExtra(header)}
              </span>
            )}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SessionPill status={header.status} />
            <IntensityPill intensity={header.intensity} />
            {header.derivedLabel && <Pill tone="amber">{header.derivedLabel}</Pill>}
            {header.endLabel && (
              <Pill tone={header.endReason === 'EMERGENCY_STOP' ? 'red' : 'amber'}>{header.endLabel}</Pill>
            )}
            {header.isExtra && <Pill tone="slate">Buổi thêm tay</Pill>}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-500">
            {facts.map((fact) => (
              <span key={fact.label} className="inline-flex items-center gap-1.5">
                <span className="text-emerald-600">{fact.icon}</span>
                {fact.label}
              </span>
            ))}
          </div>
          {header.stopReason && (
            <p className="mt-2 text-sm text-red-700">
              Lý do dừng khẩn: {header.stopReason} · {header.endedByName}
            </p>
          )}
          {header.endedAt && !header.stopReason && (
            <p className="mt-2 text-xs font-light text-gray-400">
              Bắt đầu {formatDateTime(header.startedAt)} ({header.startedByName}) · kết thúc {formatDateTime(header.endedAt)}
              {header.endedByName ? ` (${header.endedByName})` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
