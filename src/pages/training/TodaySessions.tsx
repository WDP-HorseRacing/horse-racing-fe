// Buổi tập hôm nay — dòng thời gian theo slot, mỗi buổi của lớp là một thẻ rộng với danh sách ngựa.
// Groom thấy các ngựa mình dắt và bấm checklist 3 việc; HT bắt đầu / theo dõi / kết thúc buổi của khu mình.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  CalendarClock,
  ClipboardCheck,
  Flag,
  MapPin,
  Play,
  Radio,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Notice,
  PageHeader,
  Pill,
  Skeleton,
  Stat,
  cn,
  useToast,
} from '../../components/ui';
import { AttendancePill, EligibilityBadge, IntensityPill, SessionPill } from '../../components/ui/status';
import { useAction, useService } from '../../hooks/useService';
import { useStore } from '../../store/store';
import {
  finishSession,
  listSlots,
  listTodaySessions,
  type SessionHorseRow,
  type TodaySessionRow,
} from '../../services/session.service';
import { surfaceLabel, dayOfWeekLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { now } from '../../lib/clock';
import { formatDate, isoDayOfWeek } from '../../lib/format';
import GroomTaskChecklist from './components/GroomTaskChecklist';
import MarkAbsentModal from './components/MarkAbsentModal';
import StartSessionModal from './components/StartSessionModal';
import { workoutText } from './components/session-helpers';

export default function TodaySessions() {
  const user = useStore((state) => state.currentUser);
  const navigate = useNavigate();
  const toast = useToast();
  const finishAction = useAction();
  const { data, loading, error, reload } = useService(() => listTodaySessions(), []);
  const slots = useService(() => listSlots(), []);

  const [startFor, setStartFor] = useState<TodaySessionRow | null>(null);
  const [finishFor, setFinishFor] = useState<TodaySessionRow | null>(null);
  const [absent, setAbsent] = useState<{ sessionId: string; horse: { id: string; name: string } } | null>(null);
  const [clock, setClock] = useState(() => now());

  // Làm tươi nhẹ để thấy buổi tự kết thúc, việc Groom khác vừa đánh dấu…
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(now());
      reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const isGroom = user?.role === 'GROOM';
  const rows = useMemo(() => data ?? [], [data]);
  const currentTime = `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`;
  const currentSlotId = slots.data?.find((slot) => currentTime >= slot.start && currentTime < slot.end)?.id;

  const stats = useMemo(() => {
    const horses = rows.flatMap((row) => row.horses);
    const running = rows.filter((row) => row.header.status === 'IN_PROGRESS').length;
    const blocked = rows.flatMap((row) =>
      row.header.status === 'SCHEDULED'
        ? row.horses.filter((horse) => horse.status !== 'ABSENT' && !horse.readiness.allowed)
        : [],
    );
    const tasksLeft = horses
      .filter((horse) => horse.mine && horse.status !== 'ABSENT')
      .reduce((sum, horse) => sum + horse.tasks.filter((task) => !task.done && task.canToggle).length, 0);
    return {
      sessions: rows.filter((row) => row.header.status !== 'CANCELLED').length,
      horses: horses.filter((horse) => horse.status !== 'ABSENT').length,
      running,
      blocked,
      tasksLeft,
      unacked: rows.reduce((sum, row) => sum + row.unackedRed, 0),
    };
  }, [rows]);

  const today = now();
  const canLive = rows.some((row) => row.flags.canViewLive);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${dayOfWeekLabel[isoDayOfWeek(today)]}, ${formatDate(today)}`}
        title="Buổi tập hôm nay"
        description={
          isGroom
            ? 'Các buổi có ngựa bạn dắt. Đánh dấu từng việc ngay khi làm xong để HT nắm được tình hình.'
            : 'Mỗi buổi thuộc một lớp và có nhiều ngựa. Hệ thống kiểm tra lại được tập cho từng ngựa lúc bấm Bắt đầu.'
        }
        actions={
          <>
            {canLive && (
              <Button variant="secondary" onClick={() => navigate(links.live)}>
                <Radio size={15} /> Đang diễn ra
              </Button>
            )}
            {(user?.role === 'HEAD_TRAINER' || user?.role === 'CLUB_MANAGER' || user?.role === 'VETERINARIAN') && (
              <Button variant="soft" onClick={() => navigate(links.review)}>
                <ClipboardCheck size={15} /> Chờ đánh giá
              </Button>
            )}
          </>
        }
      />

      {error && <ErrorBox message={error} />}
      {loading && !data && <Skeleton rows={4} />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
            <Stat
              className="lg:col-span-3"
              value={stats.sessions}
              label="Buổi học hôm nay"
              icon={<CalendarClock size={18} />}
              hint={`${rows.length - stats.sessions > 0 ? `${rows.length - stats.sessions} buổi đã hủy` : 'Theo slot 60 phút'}`}
            />
            <Stat
              className="lg:col-span-3"
              value={stats.horses}
              label={isGroom ? 'Ngựa bạn dắt' : 'Ngựa dự kiến tập'}
              icon={<UserRound size={18} />}
            />
            {isGroom ? (
              <Stat
                className="lg:col-span-2"
                value={stats.tasksLeft}
                label="Việc còn lại"
                tone={stats.tasksLeft > 0 ? 'warning' : 'success'}
                icon={<ClipboardCheck size={18} />}
              />
            ) : (
              <Stat
                className="lg:col-span-2"
                value={stats.running}
                label="Đang diễn ra"
                tone={stats.unacked > 0 ? 'danger' : 'default'}
                hint={stats.unacked > 0 ? `${stats.unacked} cảnh báo đỏ chờ xác nhận` : undefined}
                icon={<Activity size={18} />}
              />
            )}
            <Stat
              className="lg:col-span-4"
              value={stats.blocked.length}
              label="Chưa đủ điều kiện tập"
              tone={stats.blocked.length > 0 ? 'warning' : 'success'}
              hint={
                stats.blocked.length > 0
                  ? `${stats.blocked.map((horse) => horse.horseName).join(', ')} — sẽ bị đánh dấu vắng lúc bắt đầu`
                  : 'Mọi ngựa đều sẵn sàng'
              }
              icon={<ShieldAlert size={18} />}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="Hôm nay không có buổi tập nào"
              hint={
                isGroom
                  ? 'Không có buổi nào có ngựa bạn dắt trong hôm nay.'
                  : 'Các buổi học được sinh từ giáo án khi mở lớp. Xem lịch tập để biết các ngày tới.'
              }
              action={
                <Button variant="secondary" onClick={() => navigate(links.schedule)}>
                  Xem lịch tập
                </Button>
              }
            />
          ) : (
            <div className="relative">
              {(slots.data ?? []).map((slot) => {
                const inSlot = rows.filter((row) => row.header.slotId === slot.id);
                const isCurrent = slot.id === currentSlotId;
                const past = currentTime >= slot.end;
                if (inSlot.length === 0) {
                  return (
                    <div key={slot.id} className="grid grid-cols-[76px_minmax(0,1fr)] gap-4 sm:grid-cols-[104px_minmax(0,1fr)]">
                      <TimeRail start={slot.start} end={slot.end} current={isCurrent} past={past} compact />
                      <div className="flex items-center pb-3 text-xs font-light text-gray-300">Không có buổi</div>
                    </div>
                  );
                }
                return (
                  <div key={slot.id} className="grid grid-cols-[76px_minmax(0,1fr)] gap-4 sm:grid-cols-[104px_minmax(0,1fr)]">
                    <TimeRail start={slot.start} end={slot.end} current={isCurrent} past={past} />
                    <div className="space-y-4 pb-6">
                      {inSlot.map((row) => (
                        <SessionCard
                          key={row.header.id}
                          row={row}
                          isGroom={isGroom}
                          onStart={() => setStartFor(row)}
                          onFinish={() => setFinishFor(row)}
                          onOpen={() => navigate(links.session(row.header.id))}
                          onAbsent={(horse) => setAbsent({ sessionId: row.header.id, horse })}
                          onChanged={reload}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {startFor && (
        <StartSessionModal
          open={!!startFor}
          onClose={() => setStartFor(null)}
          header={startFor.header}
          horses={startFor.horses}
          totalHorses={startFor.totalHorses}
          startWarning={startFor.flags.startWarning}
          onStarted={(result) => {
            toast.push(`Buổi ${startFor.header.className} đã bắt đầu`, 'success');
            navigate(links.session(result.sessionId), { state: { startResult: result } });
          }}
        />
      )}

      <ConfirmDialog
        open={!!finishFor}
        title="Kết thúc buổi học"
        message={
          finishFor
            ? `Chốt chỉ số cho các ngựa có mặt của buổi ${finishFor.header.className} và chuyển sang Chờ đánh giá. Chỉ số đã chốt không ai sửa được.`
            : ''
        }
        confirmLabel="Kết thúc buổi"
        pending={finishAction.pending}
        onClose={() => {
          setFinishFor(null);
          finishAction.clearError();
        }}
        onConfirm={async () => {
          if (!finishFor) return;
          const done = await finishAction.run(() => finishSession(finishFor.header.id));
          if (done === undefined) return;
          toast.push('Đã kết thúc buổi, chờ HT đánh giá', 'success');
          setFinishFor(null);
          reload();
        }}
      >
        {finishAction.error && <Notice tone="danger">{finishAction.error}</Notice>}
      </ConfirmDialog>

      <MarkAbsentModal
        open={!!absent}
        onClose={() => setAbsent(null)}
        sessionId={absent?.sessionId ?? ''}
        horse={absent?.horse}
        byGroom={isGroom}
        onDone={reload}
      />
    </div>
  );
}

function TimeRail({
  start,
  end,
  current,
  past,
  compact = false,
}: {
  start: string;
  end: string;
  current: boolean;
  past: boolean;
  compact?: boolean;
}) {
  return (
    <div className="relative flex justify-end pr-5">
      <div className="absolute bottom-0 right-[7px] top-0 w-px bg-emerald-900/10" />
      <span
        className={cn(
          'absolute right-0 top-1.5 h-[15px] w-[15px] rounded-full ring-4 ring-white',
          current ? 'bg-emerald-500' : past ? 'bg-emerald-900/15' : 'bg-white',
          !current && !past && 'border-2 border-emerald-300',
        )}
      >
        {current && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />}
      </span>
      <div className={cn('text-right', compact ? 'pb-3' : 'pb-6')}>
        <p
          className={cn(
            'font-bold tabular-nums leading-none',
            compact ? 'text-sm text-gray-300' : 'text-xl',
            !compact && (current ? 'text-emerald-700' : past ? 'text-gray-400' : 'text-gray-800'),
          )}
        >
          {start}
        </p>
        {!compact && <p className="mt-1 text-xs font-light text-gray-400 tabular-nums">đến {end}</p>}
        {current && !compact && <p className="mt-1.5 text-[11px] font-semibold text-emerald-600">Đang trong giờ</p>}
      </div>
    </div>
  );
}

function SessionCard({
  row,
  isGroom,
  onStart,
  onFinish,
  onOpen,
  onAbsent,
  onChanged,
}: {
  row: TodaySessionRow;
  isGroom: boolean;
  onStart: () => void;
  onFinish: () => void;
  onOpen: () => void;
  onAbsent: (horse: { id: string; name: string }) => void;
  onChanged: () => void;
}) {
  const { header, flags } = row;
  const running = header.status === 'IN_PROGRESS';
  const cancelled = header.status === 'CANCELLED';
  const tone = row.unackedRed > 0 ? 'danger' : running ? 'success' : cancelled ? 'muted' : 'default';

  return (
    <Card tone={tone} className={cn('p-0 sm:p-0', cancelled && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={links.session(header.id)} className="text-lg font-bold tracking-tight text-gray-900 hover:text-emerald-700">
              {header.className}
            </Link>
            <SessionPill status={header.status} />
            {header.derivedLabel && <Pill tone="amber">{header.derivedLabel}</Pill>}
            {header.isExtra && <Pill tone="slate">Buổi thêm</Pill>}
            {row.unackedRed > 0 && (
              <Pill tone="red" pulse>
                <AlertOctagon size={11} /> {row.unackedRed} cảnh báo đỏ
              </Pill>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{workoutText(header)}</span>
            <IntensityPill intensity={header.intensity} />
            <span className="inline-flex items-center gap-1">
              <Flag size={13} className="text-emerald-600" /> Mặt sân {surfaceLabel[header.surface].toLowerCase()}
            </span>
            {header.zoneName && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} className="text-emerald-600" /> {header.zoneName}
              </span>
            )}
            {!isGroom && header.trainerName && <span>HT {header.trainerName}</span>}
          </div>
          {cancelled && header.cancelReason && (
            <p className="mt-2 text-sm text-red-600">Đã hủy: {header.cancelReason}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {flags.canStart && (
            <Button onClick={onStart}>
              <Play size={15} /> Bắt đầu
            </Button>
          )}
          {running && flags.canViewLive && (
            <Button variant={row.unackedRed > 0 ? 'danger' : 'secondary'} onClick={onOpen}>
              <Radio size={15} /> Mở theo dõi
            </Button>
          )}
          {flags.canFinish && (
            <Button variant="soft" onClick={onFinish}>
              Kết thúc
            </Button>
          )}
          {!(running && flags.canViewLive) && (
            <Button variant="ghost" onClick={onOpen}>
              Chi tiết
            </Button>
          )}
        </div>
      </div>

      <div className="border-t border-emerald-950/[0.05]">
        {row.horses.map((horse, index) => (
          <HorseLine
            key={horse.horseId}
            horse={horse}
            sessionId={header.id}
            scheduled={header.status === 'SCHEDULED'}
            isGroom={isGroom}
            striped={index % 2 === 1}
            onAbsent={() => onAbsent({ id: horse.horseId, name: horse.horseName })}
            onChanged={onChanged}
          />
        ))}
        {row.hiddenCount > 0 && (
          <p className="px-5 py-2.5 text-xs font-light text-gray-400 sm:px-6">
            Buổi có {row.totalHorses} ngựa — {row.hiddenCount} ngựa khác không do bạn phụ trách.
          </p>
        )}
        {row.horses.length === 0 && (
          <p className="px-5 py-4 text-sm font-light text-gray-400 sm:px-6">Lớp chưa có ngựa nào tham gia buổi này.</p>
        )}
      </div>
    </Card>
  );
}

function HorseLine({
  horse,
  sessionId,
  scheduled,
  isGroom,
  striped,
  onAbsent,
  onChanged,
}: {
  horse: SessionHorseRow;
  sessionId: string;
  scheduled: boolean;
  isGroom: boolean;
  striped: boolean;
  onAbsent: () => void;
  onChanged: () => void;
}) {
  const absent = horse.status === 'ABSENT';
  return (
    <div
      className={cn(
        'grid items-center gap-x-5 gap-y-2.5 px-5 py-3 sm:px-6 lg:grid-cols-[minmax(200px,0.9fr)_minmax(220px,1fr)_auto]',
        striped && 'bg-emerald-50/25',
        absent && 'bg-orange-50/40',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={horse.avatar} name={horse.horseName} size={38} className={cn(absent && 'grayscale')} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{horse.horseName}</p>
          <p className="truncate text-xs text-gray-500">
            {horse.groomName ? (
              <>
                Groom {horse.groomName}
                {horse.groomOverridden && <span className="text-emerald-700"> · riêng buổi này</span>}
              </>
            ) : (
              <span className="text-amber-600">Chưa có Groom dắt</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {absent ? (
          <AttendancePill status="ABSENT" reason={horse.absenceReason} />
        ) : scheduled ? (
          <EligibilityBadge
            allowed={horse.readiness.allowed}
            reason={horse.readiness.reason}
            label={horse.readiness.allowed ? 'Sẵn sàng' : 'Sẽ vắng lúc bắt đầu'}
          />
        ) : (
          <AttendancePill status={horse.status} />
        )}
        {horse.stopped && <Pill tone="red">Đã dừng</Pill>}
        {horse.r1Disabled && !absent && !isGroom && (
          <Pill tone="amber" title="Bác sĩ chưa đặt nhịp tim tối đa — quy tắc R1 không chạy">
            R1 tắt
          </Pill>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {!absent && (
          <GroomTaskChecklist
            sessionId={sessionId}
            horseId={horse.horseId}
            tasks={horse.tasks}
            readOnly={!horse.canDoTasks}
            onChanged={onChanged}
          />
        )}
        {absent && horse.absenceNote && (
          <span className="max-w-md text-xs text-orange-800">{horse.absenceNote}</span>
        )}
        {horse.canMarkAbsent && (
          <Button size="sm" variant="ghost" onClick={onAbsent} className="text-orange-700 hover:bg-orange-50 hover:text-orange-800">
            {isGroom ? 'Báo không thực hiện được' : 'Cho nghỉ buổi này'}
          </Button>
        )}
      </div>
    </div>
  );
}
