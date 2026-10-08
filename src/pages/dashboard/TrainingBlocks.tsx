// Khối huấn luyện (Flow 2) trên Tổng quan của từng vai trò. Mỗi khối tự tải dữ liệu, hiện khi bật cờ FEATURES.training.
// HLV: hôm nay trên sân và các lớp đang chạy. Groom: ngựa dắt tập hôm nay. Bác sĩ: cảnh báo thể lực gần đây và ngựa đang chạy.
// CM: lớp theo trạng thái và số buổi trong tuần. Chủ ngựa: buổi sắp tới và nhận xét mới nhất của HLV.
import { Link } from 'react-router-dom';
import { ArrowRight, Flag, HeartPulse, MessageSquareQuote, Radio } from 'lucide-react';
import { listClasses, listHorseSessions, listSessions } from '../../api/training';
import { listAllHorses } from '../../api/horses';
import type { HorseTrainingSession, TrainingClass, TrainingSession } from '../../api/types';
import { Card, ErrorBox, SectionTitle, Skeleton, cn } from '../../components/ui';
import { DonutChart } from '../../components/charts/DonutChart';
import { ColumnChart } from '../../components/charts/ColumnChart';
import { useService } from '../../hooks/useService';
import { useStore } from '../../store/store';
import { links } from '../../lib/links';
import { formatDate, formatRelative } from '../../lib/format';
import { addDateKey, clubDateKey, clubTime, clubToday, diffDateKeys, isoWeekdayOf, mondayOf } from '../../lib/club-time';
import { classStatusText, participantStatusText, weekdayShort } from '../../lib/training-labels';
import { now } from '../../lib/clock';
import { IntensityBars, ParticipantPill, TrialBadge } from '../training/components/bits';
import { ProgressFill } from '../training/components/motion';
import { loadDayBoard } from '../training/hooks';

function MoreLink({ to, label = 'Xem tất cả' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
      {label} <ArrowRight size={14} />
    </Link>
  );
}

/* ===== HLV: hôm nay trên sân ===== */

export function TrainerTodayCard() {
  const data = useService(() => loadDayBoard(clubToday()), [], { silent: true });
  const items = data.data ?? [];
  return (
    <Card className="flex flex-col">
      <SectionTitle icon={<Flag size={16} />} action={<MoreLink to={links.today} label="Mở lịch hôm nay" />}>
        Hôm nay trên sân
      </SectionTitle>
      {data.loading && !data.data ? (
        <Skeleton rows={2} />
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">Hôm nay không có buổi tập nào đã công bố.</p>
      ) : (
        <ul className="-mx-2 space-y-1">
          {items.map((item) => {
            const running = item.participants.filter((participant) => participant.status === 'ONGOING').length;
            const done = item.participants.filter((participant) => participant.status === 'COMPLETED').length;
            return (
              <li key={item.session.id}>
                <Link to={links.session(item.session.id)} className={cn('flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-gray-50', item.session.status === 'IN_PROGRESS' && 'bg-emerald-50/60')}>
                  <span className="w-12 font-mono text-sm font-semibold text-gray-900">{clubTime(item.session.scheduledStartAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate text-sm font-semibold text-gray-900">
                      {item.session.name} <TrialBadge type={item.session.sessionType} />
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {item.trainingClass.code} · {item.participants.length} ngựa · {done} đã xong
                    </span>
                  </span>
                  {running > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">
                      <Radio size={11} className="animate-pulse" /> {running} đang chạy
                    </span>
                  )}
                  <IntensityBars intensity={item.session.intensity} showLabel={false} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ===== HLV, CM: các lớp đang chạy ===== */

async function loadOpenClasses() {
  const classes = (await listClasses()).filter((item) => item.status === 'ACTIVE');
  return Promise.all(classes.map(async (item) => ({ item, sessions: await listSessions(item.id).catch(() => [] as TrainingSession[]) })));
}

export function ActiveClassesCard() {
  const data = useService(loadOpenClasses, [], { silent: true });
  const rows = data.data ?? [];
  const today = clubToday();
  return (
    <Card className="flex flex-col">
      <SectionTitle action={<MoreLink to={links.classes} />}>Lớp đang chạy</SectionTitle>
      {data.loading && !data.data ? (
        <Skeleton rows={2} />
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có lớp nào đang chạy.</p>
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 4).map(({ item, sessions }) => {
            const counted = sessions.filter((session) => session.status !== 'CANCELLED');
            const done = counted.filter((session) => session.status === 'COMPLETED').length;
            const total = diffDateKeys(item.startDate, item.endDate) + 1;
            const elapsed = Math.min(total, Math.max(0, diffDateKeys(item.startDate, today) + 1));
            return (
              <li key={item.id}>
                <Link to={links.class(item.id)} className="block rounded-xl px-1 py-1 transition hover:bg-gray-50">
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold text-gray-900">
                      <span className="font-mono text-gray-500">{item.code}</span> {item.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-gray-500">
                      {done}/{counted.length} buổi
                    </span>
                  </div>
                  <ProgressFill ratio={total ? elapsed / total : 0} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ===== Groom: dắt ngựa tập hôm nay ===== */

export function GroomTrainingCard() {
  const data = useService(() => loadDayBoard(clubToday()), [], { silent: true });
  const horses = useService(() => listAllHorses(), [], { silent: true });
  const names = new Map((horses.data ?? []).map((horse) => [horse.id, horse.name]));
  const rows = (data.data ?? []).flatMap((item) => item.participants.map((participant) => ({ item, participant })));
  return (
    <Card className="flex flex-col">
      <SectionTitle icon={<Flag size={16} />} action={<MoreLink to={links.today} label="Mở lịch dắt ngựa" />}>
        Dắt ngựa tập hôm nay
      </SectionTitle>
      {data.loading && !data.data ? (
        <Skeleton rows={2} />
      ) : data.error ? (
        <ErrorBox message={data.error} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">Hôm nay bạn không có ngựa nào phải dắt tập.</p>
      ) : (
        <ul className="-mx-2 space-y-1">
          {rows.map(({ item, participant }) => (
            <li key={participant.id}>
              <Link to={links.today} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50">
                <span className="w-12 font-mono text-sm font-semibold">{clubTime(item.session.scheduledStartAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">{names.get(participant.horseId) ?? 'Ngựa'}</span>
                  <span className="block truncate text-xs text-gray-500">{item.session.name}</span>
                </span>
                <ParticipantPill status={participant.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ===== Bác sĩ: cảnh báo thể lực gần đây ===== */

export function VetAlertsCard() {
  const notifications = useStore((state) => state.notifications);
  const alerts = notifications.filter((item) => item.category === 'PERFORMANCE_ALERT').slice(0, 5);
  return (
    <Card className="flex flex-col">
      <SectionTitle icon={<HeartPulse size={16} />}>Cảnh báo thể lực khi tập</SectionTitle>
      {alerts.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có ngựa nào vượt ngưỡng nhịp tim nguy hiểm khi tập.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((item) => (
            <li key={item.id}>
              <Link
                to={item.resource?.type === 'SESSION_PARTICIPANT' ? links.participant(item.resource.id, item.resource.horseId) : links.classes}
                className={cn('block rounded-xl px-3 py-2.5 ring-1 transition hover:ring-2', item.readAt ? 'bg-gray-50 ring-gray-100' : 'bg-red-50/70 ring-red-200 hover:ring-red-300')}
              >
                <p className="truncate text-sm font-semibold text-gray-900">{item.title.replace(/^KHẨN:\s*/, '')}</p>
                <p className="line-clamp-2 text-xs text-gray-600">{item.message}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{formatRelative(item.createdAt, now())}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function LiveNowCard() {
  const data = useService(() => loadDayBoard(clubToday()), [], { silent: true });
  const running = (data.data ?? []).filter((item) => item.participants.some((participant) => participant.status === 'ONGOING'));
  return (
    <Card className="flex flex-col">
      <SectionTitle icon={<Radio size={16} />} action={<MoreLink to={links.classes} label="Lớp huấn luyện" />}>
        Đang tập trên sân
      </SectionTitle>
      {data.loading && !data.data ? (
        <Skeleton rows={2} />
      ) : running.length === 0 ? (
        <p className="text-sm text-gray-500">Không có ngựa nào đang chạy lúc này.</p>
      ) : (
        <ul className="-mx-2 space-y-1">
          {running.map((item) => (
            <li key={item.session.id}>
              <Link to={links.session(item.session.id)} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50">
                <Radio size={14} className="animate-pulse text-emerald-700" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{item.session.name}</span>
                <span className="text-xs text-gray-500">{item.participants.filter((participant) => participant.status === 'ONGOING').length} ngựa đang chạy</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ===== CM: lớp theo trạng thái, buổi trong tuần ===== */

export function ManagerTrainingCards() {
  const data = useService(async () => {
    const classes = await listClasses();
    const open = classes.filter((item) => item.status === 'ACTIVE');
    const sessions = (await Promise.all(open.map((item) => listSessions(item.id).catch(() => [] as TrainingSession[])))).flat();
    return { classes, sessions };
  }, [], { silent: true });
  const classes: TrainingClass[] = data.data?.classes ?? [];
  const monday = mondayOf(clubToday());
  const week = Array.from({ length: 7 }, (_, index) => addDateKey(monday, index));
  const sessions = (data.data?.sessions ?? []).filter((session) => session.status !== 'DRAFT' && session.status !== 'CANCELLED');
  const colors = { DRAFT: '#9ca3af', ACTIVE: '#047857', COMPLETED: '#6ee7b7', CANCELLED: '#d1d5db' } as const;
  return (
    <>
      <Card className="flex flex-col">
        <SectionTitle action={<MoreLink to={links.classes} />}>Lớp huấn luyện</SectionTitle>
        {data.loading && !data.data ? (
          <Skeleton rows={3} />
        ) : classes.length === 0 ? (
          <p className="text-sm text-gray-500">Chưa có lớp huấn luyện nào.</p>
        ) : (
          <DonutChart
            centerLabel="lớp"
            segments={(['ACTIVE', 'DRAFT', 'COMPLETED', 'CANCELLED'] as const).map((status) => ({
              key: status,
              label: classStatusText[status],
              value: classes.filter((item) => item.status === status).length,
              color: colors[status],
            }))}
          />
        )}
      </Card>
      <Card className="flex flex-col">
        <SectionTitle>Buổi tập tuần này</SectionTitle>
        {data.loading && !data.data ? (
          <Skeleton rows={3} />
        ) : (
          <ColumnChart
            caption="Số buổi đã công bố mỗi ngày trong tuần (lịch câu lạc bộ)"
            columns={week.map((day) => ({
              key: day,
              label: `${weekdayShort[isoWeekdayOf(day)]} ${day.slice(8, 10)}`,
              value: sessions.filter((session) => clubDateKey(session.scheduledStartAt) === day).length,
            }))}
          />
        )}
      </Card>
    </>
  );
}

/* ===== Chủ ngựa: lịch tập và nhận xét ===== */

async function loadOwnerTraining() {
  const horses = await listAllHorses();
  const rows = await Promise.all(
    horses.map(async (horse) => ({ horse, sessions: (await listHorseSessions(horse.id, { limit: 30 }).catch(() => ({ items: [] as HorseTrainingSession[] }))).items })),
  );
  const nowIso = new Date().toISOString();
  const upcoming = rows
    .flatMap((row) => row.sessions.filter((item) => item.scheduledStartAt > nowIso && ['PLANNED', 'PRESENT', 'READY'].includes(item.participantStatus)).map((item) => ({ horse: row.horse.name, horseId: row.horse.id, item })))
    .sort((a, b) => a.item.scheduledStartAt.localeCompare(b.item.scheduledStartAt))
    .slice(0, 5);
  const reviews = rows
    .flatMap((row) => row.sessions.filter((item) => item.evaluation).map((item) => ({ horse: row.horse.name, horseId: row.horse.id, item })))
    .sort((a, b) => b.item.evaluation!.createdAt.localeCompare(a.item.evaluation!.createdAt))
    .slice(0, 4);
  return { upcoming, reviews };
}

export function OwnerTrainingCards() {
  const data = useService(loadOwnerTraining, [], { silent: true });
  return (
    <>
      <Card className="flex flex-col">
        <SectionTitle icon={<Flag size={16} />}>Lịch tập sắp tới</SectionTitle>
        {data.loading && !data.data ? (
          <Skeleton rows={2} />
        ) : (data.data?.upcoming.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">Chưa có buổi tập nào sắp tới.</p>
        ) : (
          <ul className="-mx-2 space-y-1">
            {data.data!.upcoming.map(({ horse, horseId, item }) => (
              <li key={item.participantId}>
                <Link to={links.horse(horseId, 'training')} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50">
                  <span className="w-20 font-mono text-xs text-gray-600">
                    {formatDate(item.scheduledStartAt).slice(0, 5)} {clubTime(item.scheduledStartAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900">{horse}</span>
                    <span className="block truncate text-xs text-gray-500">{item.name}</span>
                  </span>
                  <span className="text-xs text-gray-500">{participantStatusText[item.participantStatus]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="flex flex-col">
        <SectionTitle icon={<MessageSquareQuote size={16} />}>Nhận xét mới của HLV</SectionTitle>
        {data.loading && !data.data ? (
          <Skeleton rows={2} />
        ) : (data.data?.reviews.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">Chưa có nhận xét nào sau buổi tập.</p>
        ) : (
          <ul className="space-y-2">
            {data.data!.reviews.map(({ horse, horseId, item }) => (
              <li key={item.participantId}>
                <Link to={links.participant(item.participantId, horseId)} className="block rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-100 transition hover:ring-emerald-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {horse} · {item.name}
                    </span>
                    <span className="rounded-md bg-emerald-700 px-1.5 py-0.5 font-mono text-xs font-semibold text-white">{item.evaluation!.score}/10</span>
                  </div>
                  {item.evaluation!.comment && <p className="mt-1 line-clamp-2 text-xs text-gray-600">“{item.evaluation!.comment}”</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
