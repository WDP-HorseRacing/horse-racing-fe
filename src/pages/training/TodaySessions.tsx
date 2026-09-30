// Buổi tập hôm nay — dòng thời gian theo slot, mỗi buổi của lớp là một thẻ rộng với danh sách ngựa.
// Groom thấy các ngựa mình dắt và bấm checklist 3 việc; HT bắt đầu / theo dõi / kết thúc buổi của khu mình.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ClipboardCheck, Flag, MapPin, Play, Radio, X } from 'lucide-react';
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
  cn,
  useToast,
} from '../../components/ui';
import { AttendancePill, IntensityMeter, SessionPill } from '../../components/ui/status';
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
import WeekStrip from '../../components/WeekStrip';
import { getMyWeek } from '../../services/dashboard.service';
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
  const week = useService(() => getMyWeek(), []);

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

  const usedSlots = (slots.data ?? []).filter((slot) => rows.some((row) => row.header.slotId === slot.id));
  const emptySlots = (slots.data ?? []).filter((slot) => !rows.some((row) => row.header.slotId === slot.id));

  const today = now();
  const canLive = rows.some((row) => row.flags.canViewLive);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${dayOfWeekLabel[isoDayOfWeek(today)]}, ${formatDate(today)}`}
        title="Buổi tập hôm nay"
        description={
          isGroom
            ? 'Các buổi có ngựa bạn dắt — đánh dấu từng việc ngay khi làm xong.'
            : 'Hệ thống kiểm tra lại được tập cho từng ngựa lúc bấm Bắt đầu.'
        }
        actions={
          <>
            {canLive && (
              <Button variant="secondary" onClick={() => navigate(links.live)}>
                <Radio size={15} /> Đang diễn ra
              </Button>
            )}
            {(user?.role === 'HEAD_TRAINER' || user?.role === 'CLUB_MANAGER' || user?.role === 'VETERINARIAN') && (
              <Button variant="secondary" onClick={() => navigate(links.review)}>
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
          {rows.length > 0 && (
            <p className="-mt-2 text-sm text-gray-500 tabular-nums">
              {[
                <span key="s">{stats.sessions} buổi</span>,
                rows.length - stats.sessions > 0 && <span key="c">{rows.length - stats.sessions} buổi đã hủy</span>,
                <span key="h">
                  {stats.horses} {isGroom ? 'ngựa bạn dắt' : 'ngựa'}
                </span>,
                stats.running > 0 && <span key="r">{stats.running} buổi đang diễn ra</span>,
                isGroom && stats.tasksLeft > 0 && (
                  <span key="t" className="font-medium text-amber-800">
                    {stats.tasksLeft} việc còn lại
                  </span>
                ),
                stats.blocked.length > 0 && (
                  <span key="b" className="text-red-700" title={stats.blocked.map((horse) => horse.horseName).join(', ')}>
                    {stats.blocked.length} ngựa sẽ vắng
                  </span>
                ),
                stats.unacked > 0 && (
                  <span key="u" className="font-medium text-red-700">
                    {stats.unacked} cảnh báo đỏ chờ xác nhận
                  </span>
                ),
              ]
                .filter(Boolean)
                .map((part, index) => (
                  <span key={index}>
                    {index > 0 && ' · '}
                    {part}
                  </span>
                ))}
            </p>
          )}

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
              {usedSlots.map((slot) => {
                const inSlot = rows.filter((row) => row.header.slotId === slot.id);
                const isCurrent = slot.id === currentSlotId;
                const past = currentTime >= slot.end;
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
              {emptySlots.length > 0 && (
                <p className="pl-23 text-xs text-gray-400 tabular-nums sm:pl-30">
                  {emptySlots.map((slot) => slot.start).join(', ')} — không có buổi
                </p>
              )}
            </div>
          )}
        </>
      )}

      {week.data && <WeekStrip days={week.data} title="7 ngày tới" to={links.schedule} />}

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
      <div className="absolute bottom-0 right-[5px] top-0 w-px bg-gray-200" />
      <span
        className={cn(
          'absolute right-0 top-2 h-[11px] w-[11px] rounded-full ring-4 ring-canvas',
          current ? 'bg-emerald-600' : past ? 'bg-gray-300' : 'border-2 border-gray-300 bg-white',
        )}
      />
      <div className={cn('text-right', compact ? 'pb-3' : 'pb-6')}>
        <p
          className={cn(
            'font-semibold tabular-nums leading-none',
            compact ? 'text-sm text-gray-400' : 'text-xl',
            !compact && (current ? 'text-emerald-800' : past ? 'text-gray-400' : 'text-gray-900'),
          )}
        >
          {start}
        </p>
        {!compact && <p className="mt-1 text-xs text-gray-500 tabular-nums">đến {end}</p>}
        {current && !compact && <p className="mt-1.5 text-xs font-medium text-emerald-700">Đang trong giờ</p>}
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
  const tone = row.unackedRed > 0 ? 'danger' : cancelled ? 'muted' : 'default';

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
            <IntensityMeter intensity={header.intensity} />
            <span className="inline-flex items-center gap-1">
              <Flag size={13} className="text-gray-400" /> Mặt sân {surfaceLabel[header.surface].toLowerCase()}
            </span>
            {header.zoneName && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" /> {header.zoneName}
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

      <div className="divide-y divide-gray-100 border-t border-gray-100">
        {row.horses.map((horse) => (
          <HorseLine
            key={horse.horseId}
            horse={horse}
            sessionId={header.id}
            scheduled={header.status === 'SCHEDULED'}
            isGroom={isGroom}
            onAbsent={() => onAbsent({ id: horse.horseId, name: horse.horseName })}
            onChanged={onChanged}
          />
        ))}
        {row.hiddenCount > 0 && (
          <p className="px-5 py-2.5 text-xs text-gray-500 sm:px-6">
            Buổi có {row.totalHorses} ngựa — {row.hiddenCount} ngựa khác không do bạn phụ trách.
          </p>
        )}
        {row.horses.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-500 sm:px-6">Lớp chưa có ngựa nào tham gia buổi này.</p>
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
  onAbsent,
  onChanged,
}: {
  horse: SessionHorseRow;
  sessionId: string;
  scheduled: boolean;
  isGroom: boolean;
  onAbsent: () => void;
  onChanged: () => void;
}) {
  const absent = horse.status === 'ABSENT';
  const blocked = scheduled && !absent && !horse.readiness.allowed;
  return (
    <div className="grid items-center gap-x-5 gap-y-2.5 px-5 py-3 sm:px-6 lg:grid-cols-[minmax(180px,0.7fr)_minmax(240px,1.3fr)_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={horse.avatar} name={horse.horseName} size={38} className={cn(absent && 'grayscale')} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{horse.horseName}</p>
          <p className="truncate text-xs text-gray-500">
            {horse.groomName ? (
              <>
                Groom {horse.groomName}
                {horse.groomOverridden && <span> · riêng buổi này</span>}
              </>
            ) : (
              <span className="text-amber-700">Chưa có Groom dắt</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {absent && <AttendancePill status="ABSENT" reason={horse.absenceReason} />}
        {blocked && (
          <span className="min-w-0 text-sm text-red-700" title={horse.readiness.reason}>
            <span className="flex items-center gap-1.5 font-medium">
              <X size={13} strokeWidth={2.5} className="shrink-0" /> Sẽ vắng lúc bắt đầu
            </span>
            {horse.readiness.reason && <span className="block truncate pl-[19px] text-xs">{horse.readiness.reason}</span>}
          </span>
        )}
        {horse.stopped && <Pill tone="red">Đã dừng</Pill>}
        {horse.r1Disabled && !absent && !isGroom && (
          <span className="text-xs text-amber-700" title="Bác sĩ chưa đặt nhịp tim tối đa — quy tắc R1 không chạy">
            R1 tắt — chưa đặt ngưỡng
          </span>
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
        {absent && horse.absenceNote && <span className="max-w-md text-xs text-gray-500">{horse.absenceNote}</span>}
        {horse.canMarkAbsent && (
          <Button size="sm" variant="ghost" onClick={onAbsent}>
            {isGroom ? 'Báo không thực hiện được' : 'Cho nghỉ buổi này'}
          </Button>
        )}
      </div>
    </div>
  );
}
