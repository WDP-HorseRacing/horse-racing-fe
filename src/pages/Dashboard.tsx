import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Calendar,
  ClipboardCheck,
  Flag,
  HeartPulse,
  Lock,
  Stethoscope,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { useStore } from '../store/store';
import { useService } from '../hooks/useService';
import { Avatar, Card, PageHeader, Pill, Reveal, SectionTitle, Skeleton, Stat } from '../components/ui';
import { HealthPill, SessionPill } from '../components/ui/status';
import { getProgressBoard, listAwaitingReview, listTodaySessions } from '../services/training.service';
import { getHealthBoard } from '../services/medical.service';
import { listTrainingLocks, listCareSchedules } from '../services/medical.service';
import { listHorses } from '../services/horse.service';
import { listRaces, listRegistrations } from '../services/race.service';
import { listIncidents, listRestockRequests } from '../services/care.service';
import { healthLabel, intensityLabel, workoutLabel } from '../lib/labels';
import { formatDate } from '../lib/format';

function TodayScheduleCard({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { data, loading } = useService(() => listTodaySessions(), []);

  return (
    <Card className={compact ? '' : 'md:col-span-3'}>
      <SectionTitle icon={<Calendar size={16} className="text-emerald-500" />}>Buổi tập hôm nay</SectionTitle>
      {loading && <Skeleton rows={3} />}
      {!loading && (data?.length ?? 0) === 0 && (
        <p className="py-6 text-center text-sm font-light text-gray-400">Hôm nay không có buổi tập nào.</p>
      )}
      <div className="space-y-2">
        {data?.map((session) => (
          <button
            key={session.id}
            onClick={() => navigate('/training/today')}
            className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 ${
              session.status === 'IN_PROGRESS'
                ? 'border border-emerald-100 bg-emerald-50'
                : session.status === 'CANCELLED'
                  ? 'opacity-50'
                  : 'hover:bg-gray-50'
            }`}
          >
            <span className="w-24 shrink-0 font-mono text-xs text-gray-400 tabular-nums">{session.slotLabel}</span>
            <Avatar src={session.horseAvatar} name={session.horseName} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800">{session.horseName}</p>
              <p className="truncate text-xs text-gray-400">
                {workoutLabel[session.workoutType]} · {session.distanceM} m × {session.repetitions} ·{' '}
                {intensityLabel[session.intensity]}
              </p>
            </div>
            <SessionPill status={session.status} />
          </button>
        ))}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const currentUser = useStore((state) => state.currentUser);
  const navigate = useNavigate();

  if (!currentUser) return null;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  })();

  const firstName = currentUser.name.split(' ').pop();

  if (currentUser.role === 'HEAD_TRAINER') return <TrainerDashboard greeting={greeting} name={firstName ?? ''} />;
  if (currentUser.role === 'VETERINARIAN') return <VetDashboard greeting={greeting} name={firstName ?? ''} />;
  if (currentUser.role === 'HORSE_OWNER') return <OwnerDashboard greeting={greeting} name={firstName ?? ''} />;
  if (currentUser.role === 'GROOM') {
    navigate('/care/today', { replace: true });
    return null;
  }
  return <ManagerDashboard greeting={greeting} name={firstName ?? ''} />;
}

/* ===== Huấn luyện viên trưởng ===== */

function TrainerDashboard({ greeting, name }: { greeting: string; name: string }) {
  const navigate = useNavigate();
  const progress = useService(() => getProgressBoard(), []);
  const review = useService(() => listAwaitingReview(), []);
  const zoneId = useStore((state) => state.currentUser?.zoneId);
  const zoneName = zoneId === 'zone_a' ? 'Khu A' : 'Khu B';

  const rows = (progress.data ?? []).filter((row) => row.zoneId === zoneId);
  const needsPlan = rows.filter((row) => row.planTag);
  const alerts = rows.reduce((sum, row) => sum + row.alerts7, 0);

  return (
    <Reveal className="space-y-8 pb-8">
      <div data-reveal>
        <PageHeader
          title={`${greeting}, ${name}`}
          description={`${zoneName} đang có ${rows.length} ngựa hoạt động. ${rows.filter((row) => !row.blocked).length} con đủ điều kiện tập hôm nay.`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <div data-reveal className="md:col-span-3">
          <TodayScheduleCard compact />
        </div>
        <div className="flex flex-col gap-5 md:col-span-2">
          <div data-reveal>
            <Stat
              value={review.data?.length ?? 0}
              label="Buổi chờ đánh giá"
              icon={<ClipboardCheck size={22} />}
              tone="warning"
              onClick={() => navigate('/training/review')}
            />
          </div>
          <div data-reveal>
            <Stat
              value={needsPlan.length}
              label="Ngựa cần giáo án mới"
              icon={<TrendingUp size={22} />}
              onClick={() => navigate('/training/plans')}
            />
          </div>
          <div data-reveal>
            <Stat
              value={alerts}
              label="Cảnh báo trong 7 ngày"
              icon={<AlertTriangle size={22} />}
              tone={alerts > 0 ? 'danger' : 'default'}
              onClick={() => navigate('/training/progress')}
            />
          </div>
        </div>
      </div>

      <div data-reveal>
        <Card>
          <SectionTitle icon={<Users size={16} className="text-emerald-500" />}>Ngựa trong khu</SectionTitle>
          {progress.loading && <Skeleton rows={4} />}
          <div className="space-y-2">
            {rows.map((row) => (
              <button
                key={row.horseId}
                onClick={() => navigate(`/horses/${row.horseId}`)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-gray-50"
              >
                <Avatar src={row.horseAvatar} name={row.horseName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{row.horseName}</p>
                  <p className="truncate text-xs text-gray-400">
                    {row.planName ? `${row.planName} · ${row.phaseLabel}` : 'Chưa có giáo án'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.planTag === 'ENDING_SOON' && <Pill tone="amber">Sắp hết giáo án</Pill>}
                  {row.planTag === 'NO_PLAN' && <Pill tone="gray">Chưa có giáo án</Pill>}
                  {row.locked && <Pill tone="red"><Lock size={11} />Khóa</Pill>}
                  <span className="hidden sm:block">
                    <HealthPill status={row.healthStatus as never} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </Reveal>
  );
}

/* ===== Bác sĩ thú y ===== */

function VetDashboard({ greeting, name }: { greeting: string; name: string }) {
  const navigate = useNavigate();
  const board = useService(() => getHealthBoard(), []);
  const locks = useService(() => listTrainingLocks(), []);
  const care = useService(() => listCareSchedules(), []);
  const incidents = useService(() => listIncidents(), []);

  const activeLocks = (locks.data ?? []).filter((lock) => !lock.liftedAt);
  const dueCare = (care.data ?? []).filter((item) => item.overdue || item.dueSoon);
  const openIncidents = (incidents.data ?? []).filter((item) => item.status !== 'RESOLVED');

  return (
    <Reveal className="space-y-8 pb-8">
      <div data-reveal>
        <PageHeader
          title={`${greeting}, bác sĩ ${name}`}
          description={`${board.data?.tasks.length ?? 0} việc đang chờ xử lý trên toàn câu lạc bộ.`}
        />
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <div data-reveal>
          <Stat
            value={board.data?.counts.INJURED ?? 0}
            label="Đang chấn thương"
            icon={<HeartPulse size={22} />}
            tone="danger"
            onClick={() => navigate('/medical/board')}
          />
        </div>
        <div data-reveal>
          <Stat
            value={board.data?.counts.UNDER_OBSERVATION ?? 0}
            label="Cần theo dõi"
            icon={<Stethoscope size={22} />}
            tone="warning"
            onClick={() => navigate('/medical/board')}
          />
        </div>
        <div data-reveal>
          <Stat
            value={activeLocks.length}
            label="Khóa huấn luyện hiệu lực"
            icon={<Lock size={22} />}
            tone="danger"
            onClick={() => navigate('/medical/locks')}
          />
        </div>
        <div data-reveal>
          <Stat
            value={dueCare.length}
            label="Lịch chăm sóc tới hạn"
            icon={<Calendar size={22} />}
            tone="warning"
            onClick={() => navigate('/medical/care')}
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-5">
        <div data-reveal className="md:col-span-3">
          <Card>
            <SectionTitle icon={<AlertTriangle size={16} className="text-amber-500" />}>Việc cần xử lý</SectionTitle>
            {board.loading && <Skeleton rows={3} />}
            {!board.loading && (board.data?.tasks.length ?? 0) === 0 && (
              <p className="py-6 text-center text-sm font-light text-gray-400">Không có việc nào đang chờ.</p>
            )}
            <div className="space-y-2">
              {board.data?.tasks.slice(0, 6).map((task) => (
                <button
                  key={task.key}
                  onClick={() => navigate('/medical/board')}
                  className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-gray-50"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${task.urgent ? 'bg-red-500' : 'bg-amber-400'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800">
                      {task.horseName} · <span className="font-normal text-gray-500">{task.source}</span>
                    </p>
                    <p className="truncate text-xs text-gray-400">{task.detail}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
        <div data-reveal className="md:col-span-2">
          <Card>
            <SectionTitle icon={<Flag size={16} className="text-emerald-500" />}>Sự cố chưa xử lý</SectionTitle>
            {openIncidents.length === 0 && (
              <p className="py-6 text-center text-sm font-light text-gray-400">Không có sự cố nào.</p>
            )}
            <div className="space-y-3">
              {openIncidents.map((incident) => (
                <div key={incident.id} className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{incident.horseName}</p>
                    {incident.urgent && <Pill tone="red">Khẩn</Pill>}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{incident.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Reveal>
  );
}

/* ===== Chủ sở hữu ngựa ===== */

function OwnerDashboard({ greeting, name }: { greeting: string; name: string }) {
  const navigate = useNavigate();
  const horses = useService(() => listHorses(), []);
  const progress = useService(() => getProgressBoard(), []);
  const registrations = useService(() => listRegistrations(), []);

  const pending = (registrations.data ?? []).filter((item) => item.canDecide);

  return (
    <Reveal className="space-y-8 pb-8">
      <div data-reveal>
        <PageHeader
          title={`${greeting}, ${name}`}
          description={`Bạn đang sở hữu ${horses.data?.length ?? 0} con ngựa tại câu lạc bộ.`}
        />
      </div>

      {pending.length > 0 && (
        <div data-reveal>
          <Card tone="warning">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">
                  {pending.length} đăng ký thi đấu đang chờ bạn duyệt
                </p>
                <p className="mt-0.5 text-sm text-gray-600">
                  {pending.map((item) => `${item.horseName} — ${item.raceName}`).join(', ')}
                </p>
              </div>
              <button
                onClick={() => navigate('/races/approvals')}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Xem và duyệt
              </button>
            </div>
          </Card>
        </div>
      )}

      {horses.loading && <Skeleton rows={3} />}
      <div className="grid gap-5 sm:grid-cols-2">
        {horses.data?.map((horse) => {
          const row = progress.data?.find((item) => item.horseId === horse.id);
          return (
            <div data-reveal key={horse.id}>
              <button onClick={() => navigate(`/horses/${horse.id}`)} className="w-full text-left">
                <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(5,96,69,0.1)]">
                  <div className="flex items-center gap-4">
                    <Avatar src={horse.avatar} name={horse.name} size={56} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-bold text-gray-900">{horse.name}</p>
                      <p className="text-xs text-gray-400">
                        {horse.zoneName ?? 'Chưa xếp chuồng'} · {horse.stallCode ?? '—'}
                      </p>
                    </div>
                    <HealthPill status={horse.healthStatus} />
                  </div>
                  <div className="mt-5 space-y-2 border-t border-gray-50 pt-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-light text-gray-400">Giáo án</span>
                      <span className="text-right font-medium text-gray-700">
                        {row?.planName ? `${row.planName} · ${row.phaseLabel}` : 'Chưa có giáo án'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="font-light text-gray-400">Được đua</span>
                      <span className="text-right font-medium text-gray-700">
                        {horse.raceAllowed ? 'Có' : horse.raceReason}
                      </span>
                    </div>
                  </div>
                </Card>
              </button>
            </div>
          );
        })}
      </div>
    </Reveal>
  );
}

/* ===== Quản lý câu lạc bộ ===== */

function ManagerDashboard({ greeting, name }: { greeting: string; name: string }) {
  const navigate = useNavigate();
  const board = useService(() => getHealthBoard(), []);
  const races = useService(() => listRaces(), []);
  const restock = useService(() => listRestockRequests(), []);
  const progress = useService(() => getProgressBoard(), []);

  const pendingRestock = (restock.data ?? []).filter((item) => item.status === 'PENDING');
  const upcomingRaces = (races.data ?? []).filter((race) => race.status === 'OPEN');
  const alerts7 = (progress.data ?? []).reduce((sum, row) => sum + row.alerts7, 0);

  return (
    <Reveal className="space-y-8 pb-8">
      <div data-reveal>
        <PageHeader
          title={`${greeting}, ${name}`}
          description="Toàn cảnh câu lạc bộ: đàn ngựa, huấn luyện, vận hành và thi đấu."
        />
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {(['ELIGIBLE', 'UNDER_OBSERVATION', 'INJURED', 'QUARANTINED'] as const).map((status, index) => (
          <div data-reveal key={status}>
            <Stat
              value={board.data?.counts[status] ?? 0}
              label={healthLabel[status]}
              icon={index === 0 ? <Users size={22} /> : <HeartPulse size={22} />}
              tone={status === 'INJURED' ? 'danger' : status === 'UNDER_OBSERVATION' ? 'warning' : status === 'ELIGIBLE' ? 'success' : 'default'}
              onClick={() => navigate('/medical/board')}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-5">
        <div data-reveal className="md:col-span-3">
          <TodayScheduleCard compact />
        </div>
        <div className="flex flex-col gap-5 md:col-span-2">
          <div data-reveal>
            <Stat
              value={alerts7}
              label="Cảnh báo huấn luyện 7 ngày"
              icon={<Activity size={22} />}
              tone={alerts7 > 0 ? 'danger' : 'default'}
              onClick={() => navigate('/training/progress')}
            />
          </div>
          <div data-reveal>
            <Stat
              value={pendingRestock.length}
              label="Đề xuất vật tư chờ duyệt"
              icon={<ClipboardCheck size={22} />}
              tone={pendingRestock.length > 0 ? 'warning' : 'default'}
              onClick={() => navigate('/care/supplies')}
            />
          </div>
          <div data-reveal>
            <Card>
              <SectionTitle icon={<Trophy size={16} className="text-amber-500" />}>Giải đua sắp tới</SectionTitle>
              {upcomingRaces.length === 0 && (
                <p className="text-sm font-light text-gray-400">Chưa có giải nào đang mở đăng ký.</p>
              )}
              <div className="space-y-2">
                {upcomingRaces.map((race) => (
                  <button
                    key={race.id}
                    onClick={() => navigate('/races')}
                    className="flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left transition hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">{race.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatDate(race.date)} · {race.distanceM} m
                      </p>
                    </div>
                    <Pill tone="green">{race.registrationCount} ngựa</Pill>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div data-reveal>
        <Card>
          <SectionTitle icon={<TrendingUp size={16} className="text-emerald-500" />}>
            Ngựa cần chú ý
          </SectionTitle>
          {progress.loading && <Skeleton rows={3} />}
          <div className="space-y-2">
            {(progress.data ?? [])
              .filter((row) => row.blocked || row.alerts7 > 0 || row.planTag)
              .slice(0, 6)
              .map((row) => (
                <button
                  key={row.horseId}
                  onClick={() => navigate(`/horses/${row.horseId}`)}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-gray-50"
                >
                  <Avatar src={row.horseAvatar} name={row.horseName} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{row.horseName}</p>
                    <p className="truncate text-xs text-gray-400">
                      {row.blockReason ?? row.zoneName ?? '—'}
                    </p>
                  </div>
                  {row.alerts7 > 0 && <Pill tone="red">{row.alerts7} cảnh báo</Pill>}
                  {row.planTag === 'ENDING_SOON' && <Pill tone="amber">Sắp hết giáo án</Pill>}
                  {row.planTag === 'NO_PLAN' && <Pill tone="gray">Chưa có giáo án</Pill>}
                </button>
              ))}
          </div>
        </Card>
      </div>
    </Reveal>
  );
}
