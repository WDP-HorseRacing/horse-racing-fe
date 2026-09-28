import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  HeartPulse,
  Layers,
  Lock,
  MapPinned,
  Stethoscope,
  Syringe,
  Users,
  Warehouse,
} from 'lucide-react';
import { useStore } from '../../store/store';
import { useService } from '../../hooks/useService';
import {
  getGroomDashboard,
  getManagerDashboard,
  getOwnerDashboard,
  getTrainerDashboard,
  getVetDashboard,
  type HorseBrief,
  type SessionBrief,
} from '../../services/dashboard.service';
import { Avatar, Button, Card, EmptyState, ErrorBox, Meter, PageHeader, Pill, Reveal, SectionTitle, Skeleton, Stat, cn } from '../../components/ui';
import {
  ClassPill,
  EligibilityBadge,
  HealthPill,
  IntensityPill,
  LifecyclePill,
  RequestPill,
  SessionPill,
  UrgencyPill,
  healthTone,
} from '../../components/ui/status';
import { examRequestSourceLabel, groomTaskLabel, healthLabel } from '../../lib/labels';
import { links } from '../../lib/links';
import { formatDate, formatDateShort, formatMoney, formatRelative } from '../../lib/format';
import { now } from '../../lib/clock';
import type { GroomTaskKind, HealthStatus } from '../../types/domain';

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

function Panel({
  title,
  icon,
  to,
  toLabel = 'Xem tất cả',
  children,
  className = '',
  variant = 'raised',
  tone,
}: {
  title: ReactNode;
  icon?: ReactNode;
  to?: string;
  toLabel?: string;
  children: ReactNode;
  className?: string;
  variant?: 'raised' | 'flat' | 'outline';
  tone?: 'default' | 'danger' | 'warning' | 'success' | 'muted';
}) {
  return (
    <Card variant={variant} tone={tone} className={className}>
      <SectionTitle
        icon={icon}
        action={
          to ? (
            <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline">
              {toLabel}
              <ArrowRight size={14} />
            </Link>
          ) : undefined
        }
      >
        {title}
      </SectionTitle>
      {children}
    </Card>
  );
}

const healthBar: Record<HealthStatus, string> = {
  ELIGIBLE: 'bg-emerald-500',
  UNDER_OBSERVATION: 'bg-amber-400',
  INJURED: 'bg-red-500',
  QUARANTINED: 'bg-fuchsia-500',
};

/** Thanh phân bố trạng thái sức khỏe của đàn ngựa. */
function HealthDistribution({ health }: { health: { status: HealthStatus; count: number }[] }) {
  const total = health.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-emerald-950/[0.05]">
        {health.map((item) =>
          item.count > 0 ? (
            <div key={item.status} className={healthBar[item.status]} style={{ width: `${(item.count / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {health.map((item) => (
          <div key={item.status}>
            <p className="text-3xl font-bold tabular-nums text-gray-900">{item.count}</p>
            <div className="mt-1">
              <Pill tone={healthTone[item.status]}>{healthLabel[item.status]}</Pill>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionList({ sessions, empty }: { sessions: SessionBrief[]; empty: string }) {
  const navigate = useNavigate();
  if (sessions.length === 0) return <EmptyState title={empty} className="py-8" />;
  return (
    <div className="divide-y divide-gray-50">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => navigate(links.session(session.id))}
          className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 py-3 text-left transition hover:bg-emerald-50/40 sm:flex-nowrap"
        >
          <span className="w-24 shrink-0 font-mono text-sm font-semibold text-gray-800">{session.slot}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {session.className} <span className="font-normal text-gray-400">· {session.zoneName}</span>
            </p>
            <p className="truncate text-xs text-gray-500">
              {session.subjectName} · {session.horseCount} ngựa
              {session.blocked.length > 0 && (
                <span className="text-orange-600">
                  {' '}
                  · {session.blocked.length} không tập được ({session.blocked.map((item) => item.name).join(', ')})
                </span>
              )}
            </p>
          </div>
          <IntensityPill intensity={session.intensity} />
          <SessionPill status={session.status} />
          {session.derived && <Pill tone="amber">{session.derived}</Pill>}
        </button>
      ))}
    </div>
  );
}

function HorseRow({ horse, extra }: { horse: HorseBrief; extra?: ReactNode }) {
  return (
    <Link to={links.horse(horse.id)} className="flex items-center gap-3 py-2.5 transition hover:bg-emerald-50/40">
      <Avatar src={horse.avatar} name={horse.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{horse.name}</p>
        <p className="truncate text-xs text-gray-400">
          {[horse.zoneName, horse.stallCode].filter(Boolean).join(' · ') || 'Chưa xếp khu'}
        </p>
      </div>
      {extra ?? <HealthPill status={horse.healthStatus} />}
    </Link>
  );
}

function RequestList({ requests }: { requests: { id: string; horseName: string; urgency: 'NORMAL' | 'URGENT'; source: keyof typeof examRequestSourceLabel; description: string; createdAt: string }[] }) {
  if (requests.length === 0) return <EmptyState title="Không có yêu cầu khám nào đang chờ" className="py-8" />;
  return (
    <div className="space-y-2">
      {requests.slice(0, 6).map((item) => (
        <Link
          key={item.id}
          to={links.requests}
          className={cn(
            'block rounded-xl p-3 transition hover:-translate-y-0.5',
            item.urgency === 'URGENT' ? 'bg-red-50/80 ring-1 ring-red-100' : 'bg-gray-50/80 ring-1 ring-gray-100',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{item.horseName}</p>
            <UrgencyPill urgency={item.urgency} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{item.description}</p>
          <p className="mt-1 text-[11px] text-gray-400">
            {examRequestSourceLabel[item.source]} · {formatRelative(item.createdAt, now())}
          </p>
        </Link>
      ))}
    </div>
  );
}

function PeriodicList({ items }: { items: { id: string; name: string; dueDate: string; overdueDays: number; state: string }[] }) {
  if (items.length === 0) return <p className="text-sm font-light text-gray-400">Mọi ngựa đều đúng hạn khám định kỳ.</p>;
  return (
    <div className="divide-y divide-gray-50">
      {items.slice(0, 6).map((item) => (
        <Link key={item.id} to={links.horse(item.id, 'medical')} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-emerald-50/40">
          <span className="font-medium text-gray-800">{item.name}</span>
          <span className="flex items-center gap-2 text-xs text-gray-500">
            hạn {formatDateShort(item.dueDate)}
            {item.overdueDays > 0 ? (
              <Pill tone={item.state === 'OVERDUE_ALERT' ? 'red' : 'amber'}>quá {item.overdueDays} ngày</Pill>
            ) : (
              <Pill tone="slate">còn {-item.overdueDays} ngày</Pill>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton rows={1} className="max-w-md" />
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
  const urgent = data.requests.filter((item) => item.urgency === 'URGENT').length;
  const overdueAlert = data.periodic.filter((item) => item.state === 'OVERDUE_ALERT').length;

  return (
    <Reveal className="space-y-6">
      <div data-reveal>
        <PageHeader
          eyebrow={todayLabel()}
          title={`${greeting()}, ${name}`}
          description="Tình hình toàn câu lạc bộ: sức khỏe đàn ngựa, xếp chỗ, lớp huấn luyện hôm nay và các việc y tế cần chú ý."
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.stable)}>
                <MapPinned size={16} /> Sơ đồ chuồng
              </Button>
              <Button onClick={() => navigate(links.horseNew)}>Thêm ngựa mới</Button>
            </>
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Sức khỏe đàn ngựa" icon={<HeartPulse size={16} />} to={links.horses} className="lg:col-span-7">
          <p className="mb-4 text-sm text-gray-500">
            {data.total} ngựa đang ở câu lạc bộ · {data.active} đang hoạt động · {data.retired} đã giải nghệ
          </p>
          <HealthDistribution health={data.health} />
        </Panel>
        <div className="grid grid-cols-2 gap-4 lg:col-span-5">
          <Stat value={data.waitingZone.length} label="Chờ xếp khu" icon={<Warehouse size={18} />} tone={data.waitingZone.length ? 'warning' : 'default'} onClick={() => navigate(links.stable)} />
          <Stat value={data.waitingStall + data.waitingGroom} label="Chờ xếp ô / Groom" hint="việc của HT phụ trách khu" icon={<MapPinned size={18} />} onClick={() => navigate(links.stable)} />
          <Stat value={urgent} label="Yêu cầu khám khẩn" hint={`${data.requests.length} yêu cầu đang chờ`} icon={<AlertOctagon size={18} />} tone={urgent ? 'danger' : 'default'} onClick={() => navigate(links.requests)} />
          <Stat value={overdueAlert} label="Quá hạn khám > 7 ngày" icon={<Syringe size={18} />} tone={overdueAlert ? 'warning' : 'default'} onClick={() => navigate(links.periodic)} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Buổi tập hôm nay" icon={<CalendarCheck size={16} />} to={links.schedule} toLabel="Lịch tập" className="lg:col-span-8">
          <SessionList sessions={data.today} empty="Hôm nay không có buổi tập nào" />
        </Panel>
        <Panel title="Công suất khu chuồng" icon={<Warehouse size={16} />} to={links.zones} toLabel="Danh mục khu" variant="flat" className="lg:col-span-4">
          <div className="space-y-4">
            {data.zones.map((zone) => {
              const usable = zone.capacity.total - zone.capacity.maintenance;
              const used = zone.capacity.occupied + zone.capacity.waitingForStall;
              return (
                <div key={zone.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">
                      {zone.name} <span className="font-light text-gray-400">· {zone.trainer ?? 'chưa có HT'}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {zone.status !== 'ACTIVE' ? 'đang bảo trì' : `còn ${zone.capacity.free} chỗ`}
                    </span>
                  </div>
                  <Meter value={used} max={usable || 1} tone={zone.capacity.free <= 0 ? 'amber' : 'green'} />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Lớp đang chạy và sắp tới" icon={<Layers size={16} />} to={links.classes} className="lg:col-span-5">
          <div className="space-y-3">
            {data.classes.length === 0 && <p className="text-sm font-light text-gray-400">Chưa có lớp nào đang mở.</p>}
            {data.classes.map((cls) => (
              <Link key={cls.id} to={links.class(cls.id)} className="block rounded-xl p-2 transition hover:bg-emerald-50/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{cls.name}</p>
                  <ClassPill status={cls.status} />
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {cls.zoneName} · {cls.slot} · {cls.enrolled}/{cls.capacity} ngựa
                </p>
                <Meter value={cls.done} max={cls.total} className="mt-2" />
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Bệnh án đang mở" icon={<Stethoscope size={16} />} to={links.cases} className="lg:col-span-4">
          {data.cases.length === 0 ? (
            <p className="text-sm font-light text-gray-400">Không có bệnh án nào đang mở.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.cases.map((item) => (
                <Link key={item.id} to={links.case(item.id)} className="block py-2.5 hover:bg-emerald-50/40">
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
        <Panel title="Khóa huấn luyện" icon={<Lock size={16} />} to={links.locks} variant="flat" tone="warning" className="lg:col-span-3">
          {data.locks.length === 0 ? (
            <p className="text-sm font-light text-gray-500">Không có khóa nào.</p>
          ) : (
            <div className="space-y-2.5">
              {data.locks.map((lock) => (
                <Link key={lock.id} to={links.horse(lock.horseId, 'medical')} className="block">
                  <p className="text-sm font-semibold text-gray-900">{lock.horseName}</p>
                  <p className="line-clamp-2 text-xs text-gray-600">{lock.reason}</p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {data.waitingZone.length > 0 && (
        <Panel title="Ngựa đang chờ xếp khu" icon={<Warehouse size={16} />} to={links.stable} toLabel="Xếp khu" variant="outline" tone="warning">
          <div className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-4">
            {data.waitingZone.map((horse) => (
              <HorseRow key={horse.id} horse={horse} extra={<LifecyclePill status={horse.lifecycleStatus} />} />
            ))}
          </div>
        </Panel>
      )}
    </Reveal>
  );
}

/* ===== Huấn luyện viên trưởng ===== */

function TrainerDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => getTrainerDashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;
  const waiting = data.waitingStall.length + data.waitingGroom.length;

  return (
    <Reveal className="space-y-6">
      <div data-reveal>
        <PageHeader
          eyebrow={`${todayLabel()} · ${data.zones.map((zone) => zone.name).join(', ') || 'chưa được giao khu'}`}
          title={`${greeting()}, ${name}`}
          description="Buổi tập hôm nay, lớp đang chạy, việc xếp ô và các ngựa cần theo dõi trong khu bạn phụ trách."
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.classNew)}>
                <Layers size={16} /> Mở lớp
              </Button>
              <Button onClick={() => navigate(links.today)}>
                <CalendarCheck size={16} /> Buổi tập hôm nay
              </Button>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-12" data-reveal>
        <Stat className="lg:col-span-3" value={data.horseCount} label="Ngựa trong khu" icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
        <Stat className="lg:col-span-3" value={data.today.length} label="Buổi tập hôm nay" icon={<CalendarCheck size={18} />} tone="success" onClick={() => navigate(links.today)} />
        <Stat className="lg:col-span-2" value={data.review.length} label="Chờ đánh giá" icon={<ClipboardCheck size={18} />} tone={data.review.length ? 'warning' : 'default'} onClick={() => navigate(links.review)} />
        <Stat className="lg:col-span-2" value={waiting} label="Chờ xếp ô / Groom" icon={<MapPinned size={18} />} tone={waiting ? 'warning' : 'default'} onClick={() => navigate(links.stable)} />
        <Stat className="lg:col-span-2" value={data.alerts7} label="Cảnh báo đỏ 7 ngày" icon={<Activity size={18} />} tone={data.alerts7 ? 'danger' : 'default'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Buổi tập hôm nay" icon={<CalendarCheck size={16} />} to={links.today} toLabel="Điều hành buổi tập" className="lg:col-span-7">
          <SessionList sessions={data.today} empty="Hôm nay khu của bạn không có buổi tập nào" />
        </Panel>
        <Panel title="Ngựa cần theo dõi" icon={<HeartPulse size={16} />} variant="flat" tone="warning" className="lg:col-span-5">
          {data.watch.length === 0 ? (
            <p className="text-sm font-light text-gray-500">Mọi ngựa trong khu đều đủ điều kiện tập.</p>
          ) : (
            <div className="divide-y divide-amber-100/70">
              {data.watch.map((horse) => (
                <div key={horse.id} className="py-1">
                  <HorseRow horse={horse} />
                  <div className="pb-2 pl-12">
                    <EligibilityBadge allowed={horse.train.allowed} reason={horse.train.reason} label="Được tập" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Lớp của khu bạn" icon={<Layers size={16} />} to={links.classes} className="lg:col-span-5">
          <div className="space-y-3">
            {data.classes.length === 0 && <EmptyState title="Chưa có lớp nào đang mở" className="py-8" />}
            {data.classes.map((cls) => (
              <Link key={cls.id} to={links.class(cls.id)} className="block rounded-xl p-2 transition hover:bg-emerald-50/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{cls.name}</p>
                  <ClassPill status={cls.status} />
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {cls.zoneName} · {cls.slot} · {cls.enrolled}/{cls.capacity} ngựa · {cls.done}/{cls.total} buổi
                </p>
                <Meter value={cls.done} max={cls.total} className="mt-2" />
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Chờ đánh giá" icon={<ClipboardCheck size={16} />} to={links.review} className="lg:col-span-4">
          {data.review.length === 0 ? (
            <p className="text-sm font-light text-gray-400">Không có buổi nào chờ chấm điểm.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.review.map((item) => (
                <Link key={item.id} to={links.session(item.id)} className="flex items-center justify-between gap-3 py-2.5 hover:bg-emerald-50/40">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.className}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(item.date)} · {item.subjectName}
                    </p>
                  </div>
                  <Pill tone="amber">
                    đã chấm {item.scored}/{item.present}
                  </Pill>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Chờ xếp chỗ" icon={<MapPinned size={16} />} to={links.stable} toLabel="Sơ đồ chuồng" variant="outline" className="lg:col-span-3">
          {waiting === 0 ? (
            <p className="text-sm font-light text-gray-400">Không có ngựa nào chờ xếp ô hay Groom.</p>
          ) : (
            <div className="space-y-1">
              {data.waitingStall.map((horse) => (
                <HorseRow key={horse.id} horse={horse} extra={<Pill tone="amber">chờ ô</Pill>} />
              ))}
              {data.waitingGroom.map((horse) => (
                <HorseRow key={horse.id} horse={horse} extra={<Pill tone="amber">chờ Groom</Pill>} />
              ))}
            </div>
          )}
        </Panel>
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
  const urgent = data.requests.filter((item) => item.urgency === 'URGENT').length;

  return (
    <Reveal className="space-y-6">
      <div data-reveal>
        <PageHeader
          eyebrow={todayLabel()}
          title={`${greeting()}, bác sĩ ${name}`}
          description="Yêu cầu khám đang chờ, lịch khám định kỳ, bệnh án đang điều trị và buổi tập đang diễn ra."
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.medicalBoard)}>
                <HeartPulse size={16} /> Bảng điều khiển y tế
              </Button>
              <Button onClick={() => navigate(links.requests)}>
                <Stethoscope size={16} /> Xử lý yêu cầu khám
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <Panel title={`Yêu cầu khám đang chờ${urgent ? ` · ${urgent} khẩn` : ''}`} icon={<AlertOctagon size={16} />} to={links.requests} className="lg:col-span-7" tone={urgent ? 'danger' : 'default'}>
          <RequestList requests={data.requests} />
        </Panel>
        <div className="space-y-5 lg:col-span-5">
          <Panel title="Sức khỏe đàn ngựa" icon={<HeartPulse size={16} />} to={links.medicalBoard} variant="flat">
            <HealthDistribution health={data.health} />
          </Panel>
          <Panel title="Khám định kỳ cần chú ý" icon={<Syringe size={16} />} to={links.periodic}>
            <PeriodicList items={data.periodic} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Bệnh án đang điều trị" icon={<Stethoscope size={16} />} to={links.cases} className="lg:col-span-5">
          {data.cases.length === 0 ? (
            <p className="text-sm font-light text-gray-400">Không có bệnh án nào đang mở.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.cases.map((item) => (
                <Link key={item.id} to={links.case(item.id)} className="block py-2.5 hover:bg-emerald-50/40">
                  <p className="text-sm font-semibold text-gray-900">{item.horseName}</p>
                  <p className="text-xs text-gray-500">
                    {item.title} · {item.examCount} buổi khám
                    {item.nextAppointment ? ` · hẹn khám ${formatDateShort(item.nextAppointment)}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Khóa huấn luyện đang hiệu lực" icon={<Lock size={16} />} to={links.locks} variant="flat" tone="warning" className="lg:col-span-4">
          {data.locks.length === 0 ? (
            <p className="text-sm font-light text-gray-500">Không có khóa nào.</p>
          ) : (
            <div className="space-y-3">
              {data.locks.map((lock) => (
                <Link key={lock.id} to={links.horse(lock.horseId, 'medical')} className="block">
                  <p className="text-sm font-semibold text-gray-900">{lock.horseName}</p>
                  <p className="text-xs text-gray-600">
                    {lock.reason}
                    {lock.expectedLiftDate ? ` · dự kiến gỡ ${formatDateShort(lock.expectedLiftDate)}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Buổi tập đang diễn ra" icon={<Activity size={16} />} to={links.live} className="lg:col-span-3">
          {data.live.length === 0 ? (
            <p className="text-sm font-light text-gray-400">Không có buổi nào đang chạy.</p>
          ) : (
            <div className="space-y-2">
              {data.live.map((session) => (
                <Link key={session.id} to={links.session(session.id)} className="block rounded-xl bg-sky-50/60 p-3">
                  <p className="text-sm font-semibold text-gray-900">{session.className}</p>
                  <p className="text-xs text-gray-500">
                    {session.subjectName} · {session.horseCount} ngựa
                  </p>
                  {session.redAlerts > 0 && <Pill tone="red" className="mt-1.5">{session.redAlerts} cảnh báo đỏ</Pill>}
                </Link>
              ))}
            </div>
          )}
          {data.missingMaxHr.length > 0 && (
            <Link to={links.heartRate} className="mt-4 block rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
              {data.missingMaxHr.length} ngựa chưa có ngưỡng nhịp tim tối đa ({data.missingMaxHr.map((item) => item.name).join(', ')}) — quy
              tắc R1 không chạy với các ngựa này.
            </Link>
          )}
        </Panel>
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

  return (
    <Reveal className="space-y-6">
      <div data-reveal>
        <PageHeader
          eyebrow={todayLabel()}
          title={`${greeting()}, ${name}`}
          description="Việc hôm nay theo từng buổi tập và từng con ngựa bạn dắt. Thấy ngựa có dấu hiệu bất thường thì gửi yêu cầu khám ngay."
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.requests)}>
                <Stethoscope size={16} /> Gửi yêu cầu khám
              </Button>
              <Button onClick={() => navigate(links.today)}>
                <CheckCircle2 size={16} /> Đánh dấu việc
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <div className="space-y-4 lg:col-span-8">
          {data.today.length === 0 && <EmptyState title="Hôm nay bạn không có buổi tập nào" hint="Việc chăm sóc hằng ngày vẫn theo lịch của khu." />}
          {data.today.map((session) => (
            <Card key={session.id}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="rounded-xl bg-emerald-600 px-3 py-1.5 font-mono text-sm font-semibold text-white">{session.slot}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{session.className}</p>
                  <p className="text-xs text-gray-500">
                    {session.subjectName} · {session.zoneName}
                  </p>
                </div>
                <IntensityPill intensity={session.intensity} />
                <SessionPill status={session.status} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {session.horses.map((horse) => (
                  <div key={horse.id} className="rounded-xl bg-emerald-50/40 p-3 ring-1 ring-emerald-900/5">
                    <div className="mb-2 flex items-center gap-3">
                      <Avatar src={horse.avatar} name={horse.name} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{horse.name}</p>
                        {horse.attendance === 'ABSENT' ? (
                          <p className="text-xs text-orange-600">Vắng buổi này</p>
                        ) : (
                          <EligibilityBadge allowed={horse.ready.allowed} reason={horse.ready.reason} label={horse.ready.allowed ? 'Sẵn sàng' : 'Không tập được'} compact />
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {TASKS.map((task) => {
                        const done = horse.tasks[task];
                        return (
                          <span key={task} className={cn('inline-flex items-center gap-1.5 text-xs', done ? 'text-emerald-700' : 'text-gray-400')}>
                            {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                            {groomTaskLabel[task]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="soft" onClick={() => navigate(links.session(session.id))}>
                  Mở buổi tập <ArrowRight size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-5 lg:sticky lg:top-6 lg:col-span-4 lg:self-start">
          <Panel title="Ngựa bạn phụ trách" icon={<Users size={16} />} to={links.horses} variant="flat">
            {data.horses.length === 0 ? (
              <p className="text-sm font-light text-gray-400">Bạn chưa được phân công ngựa nào.</p>
            ) : (
              <div className="divide-y divide-emerald-900/5">
                {data.horses.map((horse) => (
                  <HorseRow key={horse.id} horse={horse} />
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Yêu cầu khám bạn đã gửi" icon={<Stethoscope size={16} />} to={links.requests}>
            {data.myRequests.length === 0 ? (
              <p className="text-sm font-light text-gray-400">Chưa gửi yêu cầu nào.</p>
            ) : (
              <div className="space-y-2">
                {data.myRequests.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-gray-800">{item.horseName}</span>
                    <span className="flex items-center gap-1.5">
                      <UrgencyPill urgency={item.urgency} />
                      <RequestPill status={item.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Reveal>
  );
}

/* ===== Chủ sở hữu ===== */

function OwnerDashboard({ name }: { name: string }) {
  const { data, loading, error } = useService(() => getOwnerDashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  return (
    <Reveal className="space-y-6">
      <div data-reveal>
        <PageHeader
          eyebrow={todayLabel()}
          title={`${greeting()}, ${name}`}
          description="Tình trạng từng con ngựa của bạn, lịch tập sắp tới, nhận xét mới của huấn luyện viên và chi phí y tế đã chốt."
        />
      </div>

      {data.horses.length === 0 ? (
        <EmptyState title="Bạn chưa sở hữu con ngựa nào tại câu lạc bộ" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" data-reveal>
          {data.horses.map((horse, index) => (
            <Link
              key={horse.id}
              to={links.horse(horse.id)}
              className={cn(
                'group flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-emerald-950/5 transition hover:-translate-y-0.5 hover:shadow-grass-lift',
                index === 0 && 'md:col-span-2 2xl:col-span-1',
              )}
            >
              <Avatar src={horse.avatar} name={horse.name} size={index === 0 ? 88 : 64} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold text-gray-900">{horse.name}</p>
                  <HealthPill status={horse.healthStatus} />
                  {horse.lifecycleStatus !== 'ACTIVE' && <LifecyclePill status={horse.lifecycleStatus} />}
                </div>
                <p className="text-xs text-gray-400">
                  {[horse.zoneName, horse.stallCode].filter(Boolean).join(' · ') || 'Không ở chuồng của câu lạc bộ'}
                  {horse.classes.length > 0 && ` · lớp ${horse.classes.join(', ')}`}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <EligibilityBadge allowed={horse.train.allowed} reason={horse.train.reason} label="Được tập" compact />
                  <EligibilityBadge allowed={horse.race.allowed} reason={horse.race.reason} label="Được đua" compact />
                </div>
                {horse.openCase && <p className="text-xs text-amber-700">Đang điều trị: {horse.openCase}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Nhận xét mới của huấn luyện viên" icon={<ClipboardCheck size={16} />} className="lg:col-span-7">
          {data.notes.length === 0 ? (
            <p className="text-sm font-light text-gray-400">Chưa có nhận xét nào.</p>
          ) : (
            <div className="space-y-3">
              {data.notes.map((note) => (
                <Link key={note.id} to={links.session(note.sessionId)} className="block rounded-xl bg-gray-50/80 p-3 transition hover:bg-emerald-50/60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {note.horseName} <span className="font-normal text-gray-400">· {note.subjectName} · {formatDate(note.date)}</span>
                    </p>
                    <span className="rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white tabular-nums">{note.score}/10</span>
                  </div>
                  <p className="mt-1 text-sm font-light text-gray-600">{note.notes}</p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <div className="space-y-5 lg:col-span-5">
          <Panel title="Lịch tập sắp tới" icon={<CalendarCheck size={16} />} to={links.schedule}>
            {data.upcoming.length === 0 ? (
              <p className="text-sm font-light text-gray-400">Không có buổi tập nào sắp tới.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.upcoming.map((item) => (
                  <div key={`${item.sessionId}-${item.horseName}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-medium text-gray-800">{item.horseName}</span>
                      <span className="text-gray-400"> · {item.subjectName}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDateShort(item.date)} · {item.slot}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Chi phí y tế đã chốt" icon={<Stethoscope size={16} />} to={links.cases} variant="flat">
            <p className="text-3xl font-bold tabular-nums text-gray-900">{formatMoney(data.medicalCost)}</p>
            <p className="mt-1 text-xs font-light text-gray-500">Tổng chi phí các bệnh án đã đóng. Bệnh án đang điều trị chưa có chi phí.</p>
            <div className="mt-3 space-y-1.5">
              {data.closedCases.map((item) => (
                <Link key={item.id} to={links.case(item.id)} className="flex items-center justify-between gap-3 text-sm hover:underline">
                  <span className="text-gray-700">
                    {item.horseName} · {item.title}
                  </span>
                  <span className="text-gray-500 tabular-nums">{formatMoney(item.cost)}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Reveal>
  );
}
