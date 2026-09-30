// Tổng quan theo vai trò — cùng một khung 4 tầng:
//   1. Lời chào + 4 ô số liệu (trung tính, chỉ tô màu khi có vấn đề).
//   2. "Cần xử lý" (việc có hành động, xếp đỏ → hổ phách → thường) · "Buổi tập hôm nay".
//   3. Lịch 7 ngày tới.
//   4. Bảng riêng theo vai trò · Hoạt động gần đây.
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Layers,
  ListTodo,
  Lock,
  MapPinned,
  MessageSquareText,
  Stethoscope,
  Syringe,
  Users,
  Wallet,
} from 'lucide-react';
import { useStore } from '../../store/store';
import { useService } from '../../hooks/useService';
import {
  getGroomDashboard,
  getManagerDashboard,
  getOwnerDashboard,
  getTrainerDashboard,
  getVetDashboard,
  type SessionBrief,
} from '../../services/dashboard.service';
import { Avatar, Button, Card, Dot, ErrorBox, Meter, PageHeader, Reveal, SectionTitle, Skeleton, Stat, cn } from '../../components/ui';
import {
  ClassPill,
  EligibilityLine,
  HealthPill,
  IntensityMeter,
  LifecyclePill,
  PlacementPill,
  SessionPill,
  notificationTone,
} from '../../components/ui/status';
import WeekStrip from '../../components/WeekStrip';
import { examKindLabel, groomTaskLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { addDays, formatDate, formatDateShort, formatMoney, formatRelative, toDateKey } from '../../lib/format';
import { now } from '../../lib/clock';
import type { GroomTaskKind } from '../../types/domain';

/* ===== Mảnh ghép dùng chung ===== */

function greeting() {
  const hour = now().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function todayLabel() {
  const date = now();
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return `${days[date.getDay()]}, ${formatDate(date)}`;
}

interface Attention {
  key: string;
  level: 'danger' | 'warn' | 'info';
  title: ReactNode;
  detail?: ReactNode;
  to: string;
  cta: string;
}

const levelOrder = { danger: 0, warn: 1, info: 2 };

/** Danh sách "Cần xử lý": mỗi dòng một việc, một nút hành động. */
function AttentionList({ items, empty = 'Không có việc nào cần xử lý', className = '' }: { items: Attention[]; empty?: string; className?: string }) {
  const sorted = [...items].sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
  return (
    <Card className={cn('flex flex-col p-0 sm:p-0', className)}>
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h3 className="text-[0.95rem] font-semibold text-gray-900">Cần xử lý</h3>
        {sorted.length > 0 && <span className="text-sm tabular-nums text-gray-500">{sorted.length} việc</span>}
      </div>
      {sorted.length === 0 ? (
        <p className="flex items-center gap-2 border-t border-gray-100 px-5 py-5 text-sm text-gray-500">
          <Check size={15} className="text-emerald-600" /> {empty}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {sorted.slice(0, 7).map((item) => (
            <li key={item.key}>
              <Link to={item.to} className="group flex items-center gap-3 px-5 py-3 transition hover:bg-gray-50">
                <Dot tone={item.level === 'danger' ? 'danger' : item.level === 'warn' ? 'warn' : 'neutral'} />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', item.level === 'danger' ? 'text-red-700' : 'text-gray-900')}>{item.title}</p>
                  {item.detail && <p className="truncate text-xs text-gray-500">{item.detail}</p>}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-gray-500 group-hover:text-emerald-700">
                  {item.cta} <ArrowRight size={14} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > 7 && <p className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-500">Và {sorted.length - 7} việc khác</p>}
    </Card>
  );
}

function Panel({
  title,
  to,
  toLabel = 'Xem tất cả',
  children,
  className = '',
  flush = false,
}: {
  title: ReactNode;
  to?: string;
  toLabel?: string;
  children: ReactNode;
  className?: string;
  /** Nội dung chạm mép thẻ (bảng, danh sách có đường kẻ). */
  flush?: boolean;
}) {
  const action = to ? (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-emerald-700">
      {toLabel} <ArrowRight size={14} />
    </Link>
  ) : undefined;
  if (flush) {
    return (
      <Card className={cn('p-0 sm:p-0', className)}>
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h3 className="text-[0.95rem] font-semibold text-gray-900">{title}</h3>
          {action}
        </div>
        <div className="border-t border-gray-100">{children}</div>
      </Card>
    );
  }
  return (
    <Card className={className}>
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </Card>
  );
}

/** Buổi tập trong ngày — dòng thời gian gọn. Ngựa không tập được chỉ hiện khi có. */
function TodayList({ sessions, empty }: { sessions: SessionBrief[]; empty: string }) {
  const navigate = useNavigate();
  if (sessions.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <div className="-mx-2 space-y-1">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => navigate(links.session(session.id))}
          className="flex w-full items-start gap-4 rounded-xl px-2 py-2.5 text-left transition hover:bg-gray-50"
        >
          <span className="w-12 shrink-0 pt-px text-sm font-semibold tabular-nums text-gray-900">{session.slot.split('–')[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-semibold text-gray-900">{session.className}</p>
              <IntensityMeter intensity={session.intensity} />
              {session.status !== 'SCHEDULED' && <SessionPill status={session.status} />}
              {session.derived && <span className="text-xs text-amber-700">{session.derived}</span>}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {session.subjectName} · {session.horseCount} ngựa{session.zoneName ? ` · ${session.zoneName}` : ''}
            </p>
            {session.blocked.length > 0 && <p className="mt-1 text-xs text-red-700">Sẽ vắng: {session.blocked.map((item) => item.name).join(', ')}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

function ClassList({
  classes,
}: {
  classes: { id: string; name: string; status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; zoneName?: string; slot: string; enrolled: number; capacity: number; done: number; total: number }[];
}) {
  if (classes.length === 0) return <p className="text-sm text-gray-500">Chưa có lớp nào đang mở.</p>;
  return (
    <div className="-mx-2 space-y-1">
      {classes.map((cls) => (
        <Link key={cls.id} to={links.class(cls.id)} className="block rounded-xl px-2 py-2.5 transition hover:bg-gray-50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{cls.name}</p>
            <ClassPill status={cls.status} />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {cls.zoneName} · {cls.slot} · {cls.enrolled}/{cls.capacity} ngựa · {cls.done}/{cls.total} buổi
          </p>
          <Meter value={cls.done} max={cls.total} className="mt-2" />
        </Link>
      ))}
    </div>
  );
}

/** Hoạt động gần đây = 6 thông báo mới nhất của chính người dùng. */
function RecentActivity({ className = '' }: { className?: string }) {
  const notifications = useStore((state) => state.notifications);
  const items = notifications.slice(0, 6);
  return (
    <Panel title="Hoạt động gần đây" flush className={className}>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-sm text-gray-500">Chưa có hoạt động nào.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.link ?? links.dashboard} className="flex gap-3 px-5 py-3 transition hover:bg-gray-50">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', notificationTone[item.level].dot)} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', item.readAt ? 'text-gray-600' : 'font-medium text-gray-900')}>{item.title}</span>
                  <span className="block truncate text-xs text-gray-500">{item.body}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-400">{formatRelative(item.createdAt, now())}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton rows={1} className="max-w-md" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton rows={1} />
        <Skeleton rows={1} />
        <Skeleton rows={1} />
        <Skeleton rows={1} />
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <Skeleton rows={4} className="lg:col-span-7" />
        <Skeleton rows={4} className="lg:col-span-5" />
      </div>
    </div>
  );
}

/* ===== Trang ===== */

export default function Dashboard() {
  const user = useStore((state) => state.currentUser);
  if (!user) return null;
  const name = user.name.split(' ').pop() ?? '';
  if (user.role === 'HEAD_TRAINER') return <TrainerDashboard name={name} />;
  if (user.role === 'VETERINARIAN') return <VetDashboard name={name} />;
  if (user.role === 'GROOM') return <GroomDashboard name={name} />;
  if (user.role === 'HORSE_OWNER') return <OwnerDashboard name={name} />;
  return <ManagerDashboard name={name} />;
}

/* ===== Quản lý câu lạc bộ ===== */

function ManagerDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => getManagerDashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const urgent = data.requests.filter((item) => item.urgency === 'URGENT');
  const overdueAlert = data.periodic.filter((item) => item.state === 'OVERDUE_ALERT');
  const waiting = data.waitingZone.length + data.waitingStall + data.waitingGroom;
  const notEligible = data.health.filter((item) => item.status !== 'ELIGIBLE').reduce((sum, item) => sum + item.count, 0);

  const attention: Attention[] = [
    ...urgent.map((item) => ({
      key: `req-${item.id}`,
      level: 'danger' as const,
      title: `Yêu cầu khám khẩn: ${item.horseName}`,
      detail: item.description,
      to: links.requests,
      cta: 'Theo dõi',
    })),
    ...data.waitingZone.map((horse) => ({
      key: `zone-${horse.id}`,
      level: 'warn' as const,
      title: `${horse.name} chờ xếp khu`,
      detail: 'Ngựa chưa thuộc khu nào — chỉ Quản lý xử lý',
      to: links.stable,
      cta: 'Xếp khu',
    })),
    ...overdueAlert.map((item) => ({
      key: `per-${item.id}`,
      level: 'warn' as const,
      title: `${item.name} quá hạn khám định kỳ ${item.overdueDays} ngày`,
      detail: `Hạn ${formatDate(item.dueDate)}`,
      to: links.periodic,
      cta: 'Xem',
    })),
    ...data.zones
      .filter((zone) => zone.status === 'ACTIVE' && zone.capacity.free <= 0)
      .map((zone) => ({
        key: `full-${zone.id}`,
        level: 'info' as const,
        title: `${zone.name} đã hết chỗ`,
        detail: `${zone.capacity.horseCount} ngựa · ${zone.capacity.total - zone.capacity.maintenance} ô dùng được`,
        to: links.zones,
        cta: 'Danh mục khu',
      })),
    ...(data.waitingStall + data.waitingGroom > 0
      ? [
          {
            key: 'placement',
            level: 'info' as const,
            title: `${data.waitingStall + data.waitingGroom} ngựa chờ HT xếp ô hoặc phân công Groom`,
            detail: 'Việc của huấn luyện viên phụ trách khu',
            to: links.stable,
            cta: 'Sơ đồ chuồng',
          },
        ]
      : []),
  ];

  return (
    <Reveal className="space-y-5">
      <div data-reveal>
        <PageHeader
          eyebrow={todayLabel()}
          title={`${greeting()}, ${name}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.stable)}>
                <MapPinned size={15} /> Sơ đồ chuồng
              </Button>
              <Button onClick={() => navigate(links.horseNew)}>Thêm ngựa mới</Button>
            </>
          }
        />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat value={data.total} label="Ngựa ở câu lạc bộ" hint={`${notEligible} không đủ điều kiện`} icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
          <Stat value={waiting} label="Chờ xếp chỗ" hint="khu, ô hoặc Groom" icon={<MapPinned size={18} />} tone="warning" onClick={() => navigate(links.stable)} />
          <Stat value={urgent.length} label="Yêu cầu khám khẩn" hint={`${data.requests.length} yêu cầu đang chờ`} icon={<AlertOctagon size={18} />} tone="danger" onClick={() => navigate(links.requests)} />
          <Stat value={overdueAlert.length} label="Quá hạn khám > 7 ngày" icon={<Syringe size={18} />} tone="warning" onClick={() => navigate(links.periodic)} />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <AttentionList items={attention} className="lg:col-span-7" />
        <Panel title="Buổi tập hôm nay" to={links.schedule} toLabel="Lịch tập" className="lg:col-span-5">
          <TodayList sessions={data.today} empty="Hôm nay không có buổi tập nào." />
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} to={links.schedule} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <div className="space-y-5 lg:col-span-7">
          <Panel title="Khu chuồng" to={links.zones} toLabel="Danh mục khu" flush>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-5 py-2 font-medium">Khu</th>
                  <th className="px-3 py-2 font-medium">HT phụ trách</th>
                  <th className="px-3 py-2 text-right font-medium">Ngựa</th>
                  <th className="px-3 py-2 text-right font-medium">Bảo trì</th>
                  <th className="w-40 px-5 py-2 font-medium">Chỗ trống</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                {data.zones.map((zone) => {
                  const usable = zone.capacity.total - zone.capacity.maintenance;
                  const used = zone.capacity.occupied + zone.capacity.waitingForStall;
                  return (
                    <tr key={zone.id}>
                      <td className="px-5 py-2.5 font-medium text-gray-900">{zone.name}</td>
                      <td className="px-3 py-2.5 text-gray-600">{zone.trainer ?? <span className="text-gray-400">Chưa có HT</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{zone.capacity.horseCount}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{zone.capacity.maintenance || '—'}</td>
                      <td className="px-5 py-2.5">
                        {zone.status !== 'ACTIVE' ? (
                          <span className="text-xs text-gray-500">Khu đang bảo trì</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Meter value={used} max={usable || 1} className="flex-1" />
                            <span className={cn('w-12 text-right text-xs tabular-nums', zone.capacity.free <= 0 ? 'font-medium text-amber-700' : 'text-gray-500')}>
                              {zone.capacity.free <= 0 ? 'hết chỗ' : `còn ${zone.capacity.free}`}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <Panel title="Lớp đang chạy và sắp tới" to={links.classes}>
            <ClassList classes={data.classes} />
          </Panel>
        </div>
        <RecentActivity className="lg:col-span-5" />
      </div>
    </Reveal>
  );
}

/* ===== Huấn luyện viên trưởng ===== */

function TrainerDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => getTrainerDashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const attention: Attention[] = [
    ...data.today.flatMap((session) =>
      session.blocked.map((item) => ({
        key: `blk-${session.id}-${item.name}`,
        level: 'danger' as const,
        title: `${item.name} sẽ vắng buổi ${session.slot.split('–')[0]} (${session.className})`,
        detail: item.reason,
        to: links.session(session.id),
        cta: 'Xem buổi',
      })),
    ),
    ...data.review.map((item) => ({
      key: `rev-${item.id}`,
      level: 'warn' as const,
      title: `Chấm điểm buổi ${item.className}`,
      detail: `${formatDate(item.date)} · ${item.subjectName} · đã chấm ${item.scored}/${item.present} ngựa`,
      to: links.session(item.id),
      cta: 'Chấm điểm',
    })),
    ...data.waitingStall.map((horse) => ({
      key: `stall-${horse.id}`,
      level: 'warn' as const,
      title: `${horse.name} chờ xếp ô`,
      detail: horse.zoneName,
      to: links.stable,
      cta: 'Xếp ô',
    })),
    ...data.waitingGroom.map((horse) => ({
      key: `groom-${horse.id}`,
      level: 'warn' as const,
      title: `${horse.name} chờ phân công Groom`,
      detail: [horse.zoneName, horse.stallCode].filter(Boolean).join(' · '),
      to: links.horse(horse.id),
      cta: 'Phân công',
    })),
    ...data.requests
      .filter((item) => item.urgency === 'URGENT')
      .map((item) => ({
        key: `req-${item.id}`,
        level: 'info' as const,
        title: `Đang chờ bác sĩ khám khẩn: ${item.horseName}`,
        detail: item.description,
        to: links.requests,
        cta: 'Theo dõi',
      })),
  ];

  return (
    <Reveal className="space-y-5">
      <div data-reveal>
        <PageHeader
          eyebrow={`${todayLabel()} · ${data.zones.map((zone) => zone.name).join(', ') || 'chưa được giao khu'}`}
          title={`${greeting()}, ${name}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.classNew)}>
                <Layers size={15} /> Mở lớp
              </Button>
              <Button onClick={() => navigate(links.today)}>
                <CalendarCheck size={15} /> Buổi tập hôm nay
              </Button>
            </>
          }
        />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat value={data.horseCount} label="Ngựa trong khu" hint={`${data.watch.length} cần theo dõi`} icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
          <Stat value={data.today.length} label="Buổi tập hôm nay" icon={<CalendarCheck size={18} />} onClick={() => navigate(links.today)} />
          <Stat value={data.review.length} label="Buổi chờ đánh giá" icon={<ClipboardCheck size={18} />} tone="warning" onClick={() => navigate(links.review)} />
          <Stat value={data.alerts7} label="Cảnh báo đỏ 7 ngày" icon={<AlertOctagon size={18} />} tone="danger" />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <AttentionList items={attention} className="lg:col-span-7" />
        <Panel title="Buổi tập hôm nay" to={links.today} toLabel="Điều hành" className="lg:col-span-5">
          <TodayList sessions={data.today} empty="Hôm nay khu của bạn không có buổi tập nào." />
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} to={links.schedule} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <div className="space-y-5 lg:col-span-7">
          <Panel title="Ngựa trong khu" to={links.horses} toLabel="Danh sách ngựa" flush>
            {data.zoneHorses.length === 0 ? (
              <p className="px-5 py-5 text-sm text-gray-500">Khu của bạn chưa có ngựa.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.zoneHorses.map((horse) => (
                  <li key={horse.id}>
                    <Link to={links.horse(horse.id)} className="grid grid-cols-12 items-center gap-3 px-5 py-2.5 transition hover:bg-gray-50">
                      <span className="col-span-4 flex min-w-0 items-center gap-2.5">
                        <Avatar src={horse.avatar} name={horse.name} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-900">{horse.name}</span>
                          <span className="block truncate text-xs text-gray-500">{horse.classCount ? `${horse.classCount} lớp đang học` : 'Chưa học lớp'}</span>
                        </span>
                      </span>
                      <span className="col-span-3 flex flex-wrap items-center gap-1.5">
                        {horse.lifecycleStatus === 'ACTIVE' ? <HealthPill status={horse.healthStatus} /> : <LifecyclePill status={horse.lifecycleStatus} />}
                      </span>
                      <span className="col-span-3 min-w-0 text-xs text-gray-600">
                        {horse.placement === 'PLACED' ? (
                          <>
                            <span className="font-mono text-gray-900">{horse.stallCode}</span>
                            <span className="block truncate text-gray-500">{horse.groomName}</span>
                          </>
                        ) : (
                          <PlacementPill placement={horse.placement} />
                        )}
                      </span>
                      <span className="col-span-2 text-right text-xs">
                        {horse.lifecycleStatus !== 'ACTIVE' ? (
                          <span className="text-gray-400">—</span>
                        ) : horse.train.allowed ? (
                          <span className="text-gray-500">Tập được</span>
                        ) : (
                          <span className="font-medium text-red-700">Không tập</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Lớp của khu bạn" to={links.classes}>
            <ClassList classes={data.classes} />
          </Panel>
        </div>
        <RecentActivity className="lg:col-span-5" />
      </div>
    </Reveal>
  );
}

/* ===== Bác sĩ thú y ===== */

function VetDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => getVetDashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const todayKey = toDateKey(now());
  const tomorrowKey = toDateKey(addDays(now(), 1));
  const overdue = data.periodic.filter((item) => item.overdueDays > 0);
  const attention: Attention[] = [
    ...data.requests.map((item) => ({
      key: `req-${item.id}`,
      level: item.urgency === 'URGENT' ? ('danger' as const) : ('warn' as const),
      title: `${item.urgency === 'URGENT' ? 'Khám khẩn' : 'Yêu cầu khám'}: ${item.horseName}`,
      detail: `${item.description} · ${formatRelative(item.createdAt, now())}`,
      to: links.requests,
      cta: 'Khám',
    })),
    ...overdue.map((item) => ({
      key: `per-${item.id}`,
      level: 'warn' as const,
      title: `${item.name} quá hạn khám định kỳ ${item.overdueDays} ngày`,
      detail: `Hạn ${formatDate(item.dueDate)}`,
      to: links.periodic,
      cta: 'Ghi buổi khám',
    })),
    ...data.cases
      .filter((item) => item.nextAppointment && item.nextAppointment <= tomorrowKey)
      .map((item) => ({
        key: `case-${item.id}`,
        level: 'warn' as const,
        title: `Hẹn tái khám ${item.horseName}`,
        detail: `${item.title} · hẹn ${formatDateShort(item.nextAppointment!)}${item.nextAppointment === todayKey ? ' (hôm nay)' : item.nextAppointment! < todayKey ? ' (đã qua)' : ''}`,
        to: links.case(item.id),
        cta: 'Mở bệnh án',
      })),
    ...(data.missingMaxHr.length > 0
      ? [
          {
            key: 'maxhr',
            level: 'info' as const,
            title: `${data.missingMaxHr.length} ngựa chưa có ngưỡng nhịp tim tối đa`,
            detail: `${data.missingMaxHr.map((item) => item.name).join(', ')} — quy tắc R1 không chạy với các ngựa này`,
            to: links.heartRate,
            cta: 'Đặt ngưỡng',
          },
        ]
      : []),
  ];

  return (
    <Reveal className="space-y-5">
      <div data-reveal>
        <PageHeader
          eyebrow={todayLabel()}
          title={`${greeting()}, bác sĩ ${name}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.medicalBoard)}>
                Bảng điều khiển y tế
              </Button>
              <Button onClick={() => navigate(links.requests)}>
                <Stethoscope size={15} /> Xử lý yêu cầu khám
              </Button>
            </>
          }
        />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat
            value={data.requests.length}
            label="Yêu cầu khám đang chờ"
            hint={`${data.requests.filter((item) => item.urgency === 'URGENT').length} khẩn`}
            icon={<Stethoscope size={18} />}
            tone={data.requests.some((item) => item.urgency === 'URGENT') ? 'danger' : 'warning'}
            onClick={() => navigate(links.requests)}
          />
          <Stat value={overdue.length} label="Quá hạn khám định kỳ" icon={<Syringe size={18} />} tone="warning" onClick={() => navigate(links.periodic)} />
          <Stat value={data.cases.length} label="Bệnh án đang điều trị" icon={<ClipboardCheck size={18} />} onClick={() => navigate(links.cases)} />
          <Stat value={data.locks.length} label="Khóa huấn luyện hiệu lực" icon={<Lock size={18} />} onClick={() => navigate(links.locks)} />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <AttentionList items={attention} empty="Không có yêu cầu khám hay lịch khám nào cần xử lý" className="lg:col-span-7" />
        <div className="space-y-5 lg:col-span-5">
          <Panel title="Bệnh án đang điều trị" to={links.cases}>
            {data.cases.length === 0 ? (
              <p className="text-sm text-gray-500">Không có bệnh án nào đang mở.</p>
            ) : (
              <div className="-mx-2 space-y-1">
                {data.cases.map((item) => (
                  <Link key={item.id} to={links.case(item.id)} className="block rounded-xl px-2 py-2 transition hover:bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900">{item.horseName}</p>
                    <p className="text-xs text-gray-500">
                      {item.title} · {item.examCount} buổi khám
                      {item.nextAppointment ? ` · hẹn ${formatDateShort(item.nextAppointment)}` : ''}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Khóa huấn luyện đang hiệu lực" to={links.locks}>
            {data.locks.length === 0 ? (
              <p className="text-sm text-gray-500">Không có khóa nào.</p>
            ) : (
              <div className="-mx-2 space-y-1">
                {data.locks.map((lock) => (
                  <Link key={lock.id} to={links.horse(lock.horseId, 'medical')} className="block rounded-xl px-2 py-2 transition hover:bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900">{lock.horseName}</p>
                    <p className="text-xs text-gray-500">
                      {lock.reason}
                      {lock.expectedLiftDate ? ` · dự kiến gỡ ${formatDateShort(lock.expectedLiftDate)}` : ''}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} title="Lịch y tế 7 ngày tới" to={links.periodic} toLabel="Khám định kỳ" empty="Không có lịch" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Buổi khám gần đây" to={links.cases} toLabel="Bệnh án" flush className="lg:col-span-7">
          {data.recentExams.length === 0 ? (
            <p className="px-5 py-5 text-sm text-gray-500">Chưa có buổi khám nào.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recentExams.map((exam) => (
                <li key={exam.id}>
                  <Link
                    to={exam.caseId ? links.case(exam.caseId) : links.horse(exam.horseId, 'medical')}
                    className="grid grid-cols-12 items-center gap-3 px-5 py-2.5 transition hover:bg-gray-50"
                  >
                    <span className="col-span-4 min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">{exam.horseName}</span>
                      <span className="block truncate text-xs text-gray-500">{formatDate(exam.examinedAt)} · {exam.vetName}</span>
                    </span>
                    <span className="col-span-3 text-xs text-gray-600">{examKindLabel[exam.kind]}</span>
                    <span className="col-span-5 flex items-center gap-1.5">
                      <HealthPill status={exam.before} />
                      {exam.before !== exam.after && (
                        <>
                          <ArrowRight size={12} className="text-gray-300" />
                          <HealthPill status={exam.after} />
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <RecentActivity className="lg:col-span-5" />
      </div>
    </Reveal>
  );
}

/* ===== Nhân viên chăm sóc ===== */

const TASKS: GroomTaskKind[] = ['PREPARE', 'TO_TRACK', 'COOL_DOWN'];

function GroomDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => getGroomDashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const pending = data.today.reduce(
    (sum, session) =>
      sum + session.horses.filter((horse) => horse.attendance !== 'ABSENT').reduce((count, horse) => count + TASKS.filter((task) => !horse.tasks[task]).length, 0),
    0,
  );
  const pendingRequests = data.myRequests.filter((item) => item.status === 'PENDING').length;

  return (
    <Reveal className="space-y-5">
      <div data-reveal>
        <PageHeader
          eyebrow={todayLabel()}
          title={`${greeting()}, ${name}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.requests)}>
                <Stethoscope size={15} /> Gửi yêu cầu khám
              </Button>
              <Button onClick={() => navigate(links.today)}>
                <CheckCircle2 size={15} /> Đánh dấu việc
              </Button>
            </>
          }
        />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat value={data.today.length} label="Buổi tập hôm nay" icon={<CalendarCheck size={18} />} onClick={() => navigate(links.today)} />
          <Stat value={pending} label="Việc chưa làm hôm nay" icon={<ListTodo size={18} />} tone="warning" onClick={() => navigate(links.today)} />
          <Stat value={data.horses.length} label="Ngựa phụ trách" icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
          <Stat value={pendingRequests} label="Yêu cầu khám chờ bác sĩ" icon={<Stethoscope size={18} />} onClick={() => navigate(links.requests)} />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <div className="space-y-4 lg:col-span-8">
          {data.today.length === 0 && (
            <Card>
              <p className="text-sm text-gray-500">Hôm nay bạn không có buổi tập nào.</p>
            </Card>
          )}
          {data.today.map((session) => (
            <Card key={session.id} className="p-0 sm:p-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 px-5 py-3.5">
                <span className="text-lg font-semibold tabular-nums text-gray-900">{session.slot.split('–')[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{session.className}</p>
                  <p className="text-xs text-gray-500">
                    {session.subjectName} · {session.zoneName}
                  </p>
                </div>
                <IntensityMeter intensity={session.intensity} />
                {session.status !== 'SCHEDULED' && <SessionPill status={session.status} />}
                <Button size="sm" variant="ghost" onClick={() => navigate(links.session(session.id))}>
                  Mở buổi <ArrowRight size={14} />
                </Button>
              </div>
              <ul className="divide-y divide-gray-100">
                {session.horses.map((horse) => (
                  <li key={horse.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
                    <div className="flex min-w-48 flex-1 items-center gap-3">
                      <Avatar src={horse.avatar} name={horse.name} size={32} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{horse.name}</p>
                        {horse.attendance === 'ABSENT' ? (
                          <p className="text-xs text-amber-700">Vắng buổi này</p>
                        ) : (
                          !horse.ready.allowed && <p className="text-xs text-red-700">{horse.ready.reason}</p>
                        )}
                      </div>
                    </div>
                    {horse.attendance !== 'ABSENT' && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {TASKS.map((task) => {
                          const done = horse.tasks[task];
                          return (
                            <span key={task} className={cn('inline-flex items-center gap-1.5 text-xs', done ? 'text-emerald-700' : 'text-gray-500')}>
                              {done ? <CheckCircle2 size={14} /> : <Circle size={14} className="text-gray-300" />}
                              {groomTaskLabel[task]}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <Panel title="Ngựa bạn phụ trách" to={links.horses} className="lg:col-span-4">
          {data.horses.length === 0 ? (
            <p className="text-sm text-gray-500">Bạn chưa được phân công ngựa nào.</p>
          ) : (
            <div className="-mx-2 space-y-1">
              {data.horses.map((horse) => (
                <Link key={horse.id} to={links.horse(horse.id)} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50">
                  <Avatar src={horse.avatar} name={horse.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{horse.name}</p>
                    <p className="truncate text-xs text-gray-500">{[horse.zoneName, horse.stallCode].filter(Boolean).join(' · ') || 'Chưa xếp ô'}</p>
                  </div>
                  <HealthPill status={horse.healthStatus} />
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} title="Lịch dắt ngựa 7 ngày tới" to={links.schedule} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Yêu cầu khám bạn đã gửi" to={links.requests} flush className="lg:col-span-7">
          {data.myRequests.length === 0 ? (
            <p className="px-5 py-5 text-sm text-gray-500">Chưa gửi yêu cầu nào. Thấy ngựa có dấu hiệu bất thường thì gửi yêu cầu khám ngay.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.myRequests.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    {item.urgency === 'URGENT' && <Dot tone="danger" />}
                    {item.horseName}
                  </span>
                  <span className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400">{formatRelative(item.createdAt, now())}</span>
                    <span className={item.status === 'PENDING' ? 'font-medium text-amber-700' : 'text-gray-500'}>
                      {item.status === 'PENDING' ? 'Chờ bác sĩ' : item.status === 'EXAMINED' ? 'Đã khám' : 'Đã bỏ qua'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <RecentActivity className="lg:col-span-5" />
      </div>
    </Reveal>
  );
}

/* ===== Chủ sở hữu ===== */

function OwnerDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => getOwnerDashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const upcoming = data.week.reduce((sum, day) => sum + day.items.length, 0);
  const treating = data.horses.filter((horse) => horse.openCase).length;

  return (
    <Reveal className="space-y-5">
      <div data-reveal>
        <PageHeader eyebrow={todayLabel()} title={`${greeting()}, ${name}`} />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat value={data.horses.length} label="Ngựa sở hữu" hint={treating ? `${treating} đang điều trị` : undefined} icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
          <Stat value={upcoming} label="Buổi tập 7 ngày tới" icon={<CalendarCheck size={18} />} onClick={() => navigate(links.schedule)} />
          <Stat value={data.notes.length} label="Nhận xét gần đây" icon={<MessageSquareText size={18} />} />
          <Stat value={formatMoney(data.medicalCost)} label="Chi phí y tế đã chốt" icon={<Wallet size={18} />} onClick={() => navigate(links.cases)} />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Ngựa của tôi" to={links.horses} flush className="lg:col-span-7">
          {data.horses.length === 0 ? (
            <p className="px-5 py-5 text-sm text-gray-500">Bạn chưa sở hữu con ngựa nào tại câu lạc bộ.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.horses.map((horse) => (
                <li key={horse.id}>
                  <Link to={links.horse(horse.id)} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 transition hover:bg-gray-50">
                    <div className="flex min-w-52 flex-1 items-center gap-3">
                      <Avatar src={horse.avatar} name={horse.name} size={40} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{horse.name}</p>
                          <LifecyclePill status={horse.lifecycleStatus} />
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          {[horse.zoneName, horse.stallCode].filter(Boolean).join(' · ') || 'Không ở chuồng của câu lạc bộ'}
                          {horse.classes.length > 0 && ` · lớp ${horse.classes.join(', ')}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {horse.healthStatus !== 'ELIGIBLE' && <HealthPill status={horse.healthStatus} />}
                      <div>
                        <EligibilityLine train={horse.train} race={horse.race} lifecycle={horse.lifecycleStatus} />
                      </div>
                      {horse.openCase && <p className="text-xs text-amber-700">Đang điều trị: {horse.openCase}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Nhận xét mới của huấn luyện viên" flush className="lg:col-span-5">
          {data.notes.length === 0 ? (
            <p className="px-5 py-5 text-sm text-gray-500">Chưa có nhận xét nào.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.notes.map((note) => (
                <li key={note.id}>
                  <Link to={links.session(note.sessionId)} className="block px-5 py-3 transition hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {note.horseName} <span className="font-normal text-gray-500">· {note.subjectName} · {formatDate(note.date)}</span>
                      </p>
                      <span className="text-sm font-semibold tabular-nums text-gray-900">
                        {note.score}
                        <span className="font-normal text-gray-400">/10</span>
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{note.notes}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} title="Lịch tập 7 ngày tới" to={links.schedule} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <RecentActivity className="lg:col-span-7" />
        <Panel title="Chi phí y tế đã chốt" to={links.cases} className="lg:col-span-5">
          <p className="text-2xl font-bold tabular-nums text-gray-900">{formatMoney(data.medicalCost)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {data.closedCases.length === 0 ? 'Chưa có bệnh án nào được đóng.' : 'Tổng chi phí các bệnh án đã đóng.'} Bệnh án đang điều trị chưa tính chi phí.
          </p>
          {data.closedCases.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
              {data.closedCases.map((item) => (
                <Link key={item.id} to={links.case(item.id)} className="flex items-center justify-between gap-3 text-sm hover:underline">
                  <span className="text-gray-700">
                    {item.horseName} · {item.title}
                  </span>
                  <span className="tabular-nums text-gray-500">{formatMoney(item.cost)}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </Reveal>
  );
}
