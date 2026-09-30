// Tổng quan theo vai trò — cùng một khung 4 tầng:
//   1. Lời chào + 4 ô số liệu (trung tính, chỉ tô màu khi có vấn đề).
//   2. "Cần xử lý" (việc có hành động, xếp đỏ → hổ phách → thường) · khối việc chính của vai trò.
//   3. Lịch y tế 7 ngày tới (hạn khám, ngày hẹn, tái khám, lịch chăm sóc).
//   4. Bảng riêng theo vai trò · Hoạt động gần đây (thông báo realtime).
// Phần huấn luyện (Flow 2) tạm ẩn cho tới khi có API thật.
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  Lock,
  MapPinned,
  Plus,
  Stethoscope,
  Syringe,
  Users,
  Wallet,
} from 'lucide-react';
import { useStore } from '../../store/store';
import { useService } from '../../hooks/useService';
import type { HorseListItem } from '../../api/types';
import { Avatar, Button, Card, Dot, ErrorBox, Meter, PageHeader, Reveal, SectionTitle, Skeleton, Stat, cn } from '../../components/ui';
import { CaseStatusPill, HealthPill, LifecyclePill, PlacementStatusPill, notificationTone } from '../../components/ui/status';
import WeekStrip from '../../components/WeekStrip';
import { careTypeLabel, requestSourceLabel } from '../../lib/api-labels';
import { links } from '../../lib/links';
import { formatDate, formatDateShort, formatMoney, formatRelative, toDateKey, addDays } from '../../lib/format';
import { now } from '../../lib/clock';
import { cannotTrain, isLocked, loadGroom, loadManager, loadOwner, loadTrainer, loadVet, todayKey } from './data';

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

/** Hoạt động gần đây = thông báo nhận được trong phiên đăng nhập này (realtime). */
function RecentActivity({ className = '' }: { className?: string }) {
  const notifications = useStore((state) => state.notifications);
  const items = notifications.slice(0, 6);
  return (
    <Panel title="Hoạt động gần đây" flush className={className}>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-sm text-gray-500">Chưa có thông báo mới trong phiên này. Thông báo đến sẽ hiện ở đây ngay khi xảy ra.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 px-5 py-3">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', notificationTone[item.level].dot)} />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm', item.readAt ? 'text-gray-600' : 'font-medium text-gray-900')}>{item.title}</span>
                <span className="block truncate text-xs text-gray-500">{item.body}</span>
              </span>
              <span className="shrink-0 text-xs text-gray-400">{formatRelative(item.createdAt, now())}</span>
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

/** Danh sách ngựa gọn: ảnh, tên, chỗ ở, sức khỏe. */
function HorseRows({ horses, empty, note }: { horses: HorseListItem[]; empty: string; note?: (horse: HorseListItem) => ReactNode }) {
  if (horses.length === 0) return <p className="px-5 py-5 text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {horses.map((horse) => (
        <li key={horse.id}>
          <Link to={links.horse(horse.id)} className="grid grid-cols-12 items-center gap-3 px-5 py-2.5 transition hover:bg-gray-50">
            <span className="col-span-5 flex min-w-0 items-center gap-2.5">
              <Avatar src={horse.photoUrl ?? undefined} name={horse.name} size={30} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900">{horse.name}</span>
                <span className="block truncate text-xs text-gray-500">
                  {horse.location.barn ? `${horse.location.barn.name}${horse.location.stall ? ` · ${horse.location.stall.code}` : ''}` : 'Chưa xếp khu'}
                </span>
              </span>
            </span>
            <span className="col-span-4 flex flex-wrap items-center gap-1.5">
              {horse.lifecycleStatus === 'ACTIVE' ? <HealthPill status={horse.healthStatus} /> : <LifecyclePill status={horse.lifecycleStatus} />}
              {isLocked(horse) && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                  <Lock size={11} /> Khóa
                </span>
              )}
            </span>
            <span className="col-span-3 text-right text-xs">
              {note ? note(horse) : horse.location.placementStatus === 'PLACED' ? null : <PlacementStatusPill status={horse.location.placementStatus} />}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Thứ tự ưu tiên hiển thị: không tập được → cần theo dõi → chờ xếp chỗ → còn lại. */
function priority(horse: HorseListItem) {
  if (cannotTrain(horse)) return 0;
  if (horse.healthStatus === 'UNDER_OBSERVATION' && horse.lifecycleStatus === 'ACTIVE') return 1;
  if (horse.location.placementStatus === 'PENDING_BARN' || horse.location.placementStatus === 'PENDING_STALL') return 2;
  return 3;
}
const byPriority = (a: HorseListItem, b: HorseListItem) => priority(a) - priority(b) || a.name.localeCompare(b.name, 'vi');

/* ===== Trang ===== */

export default function Dashboard() {
  const user = useStore((state) => state.currentUser);
  if (!user) return null;
  const name = user.name.split(' ').pop() ?? '';
  if (user.role === 'HEAD_TRAINER') return <TrainerDashboard name={name} userId={user.id} />;
  if (user.role === 'VETERINARIAN') return <VetDashboard name={name} />;
  if (user.role === 'GROOM') return <GroomDashboard name={name} />;
  if (user.role === 'HORSE_OWNER') return <OwnerDashboard name={name} />;
  return <ManagerDashboard name={name} />;
}

/* ===== Quản lý câu lạc bộ ===== */

function ManagerDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => loadManager(), []);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const { horses, barns, medical } = data;
  const pendingBarn = horses.filter((horse) => horse.location.placementStatus === 'PENDING_BARN');
  const pendingStall = horses.filter((horse) => horse.location.placementStatus === 'PENDING_STALL');
  const urgent = medical.pendingRequests.filter((item) => item.urgent);
  const overdueAlert = medical.checkups.filter((item) => item.daysLeft < -7);
  const blocked = horses.filter(cannotTrain);

  const attention: Attention[] = [
    ...urgent.map((item) => ({
      key: `req-${item.id}`,
      level: 'danger' as const,
      title: `Yêu cầu khám khẩn: ${item.horseName}`,
      detail: item.description,
      to: links.requests,
      cta: 'Theo dõi',
    })),
    ...pendingBarn.map((horse) => ({
      key: `barn-${horse.id}`,
      level: 'warn' as const,
      title: `${horse.name} chờ xếp khu`,
      detail: 'Ngựa chưa thuộc khu nào — chỉ Quản lý xử lý',
      to: links.stable,
      cta: 'Xếp khu',
    })),
    ...overdueAlert.map((item) => ({
      key: `due-${item.horseId}`,
      level: 'warn' as const,
      title: `${item.horseName} quá hạn khám định kỳ ${-item.daysLeft} ngày`,
      detail: `Hạn ${formatDate(item.dueDate)}`,
      to: links.periodic,
      cta: 'Xem',
    })),
    ...barns
      .filter((barn) => barn.status === 'ACTIVE' && barn.hasActiveHeadTrainer && barn.availableStallCount <= 0)
      .map((barn) => ({
        key: `full-${barn.id}`,
        level: 'info' as const,
        title: `${barn.name} đã hết chỗ nhận ngựa`,
        detail: barn.pendingStallHorseCount ? `${barn.pendingStallHorseCount} ngựa đang chờ xếp ô` : 'Không còn ô trống',
        to: links.zones,
        cta: 'Danh mục khu',
      })),
    ...barns
      .filter((barn) => barn.status === 'ACTIVE' && !barn.hasActiveHeadTrainer)
      .map((barn) => ({
        key: `nohT-${barn.id}`,
        level: 'info' as const,
        title: `${barn.name} chưa có HT phụ trách đang hoạt động`,
        detail: 'Khu chưa có HT thì không nhận ngựa',
        to: links.zones,
        cta: 'Gán HT',
      })),
    ...(pendingStall.length > 0
      ? [
          {
            key: 'pending-stall',
            level: 'info' as const,
            title: `${pendingStall.length} ngựa chờ HT xếp ô và phân công Groom`,
            detail: pendingStall.map((horse) => horse.name).join(', '),
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
              <Button onClick={() => navigate(links.horseNew)}>
                <Plus size={15} /> Thêm ngựa mới
              </Button>
            </>
          }
        />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat value={horses.length} label="Ngựa ở câu lạc bộ" hint={`${blocked.length} không tập được`} icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
          <Stat value={pendingBarn.length + pendingStall.length} label="Chờ xếp chỗ" hint="chờ xếp khu hoặc chờ xếp ô" icon={<MapPinned size={18} />} tone="warning" onClick={() => navigate(links.stable)} />
          <Stat value={urgent.length} label="Yêu cầu khám khẩn" hint={`${medical.pendingRequests.length} yêu cầu đang chờ`} icon={<AlertOctagon size={18} />} tone="danger" onClick={() => navigate(links.requests)} />
          <Stat value={overdueAlert.length} label="Quá hạn khám > 7 ngày" icon={<Syringe size={18} />} tone="warning" onClick={() => navigate(links.periodic)} />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <AttentionList items={attention} className="lg:col-span-7" />
        <Panel title="Bệnh án đang điều trị" to={links.cases} className="lg:col-span-5">
          {medical.openCases.length === 0 ? (
            <p className="text-sm text-gray-500">Không có bệnh án nào đang mở.</p>
          ) : (
            <div className="-mx-2 space-y-1">
              {medical.openCases.slice(0, 6).map((item) => (
                <Link key={item.caseId} to={links.case(item.caseId)} className="block rounded-xl px-2 py-2 transition hover:bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">{item.horseName}</p>
                  <p className="text-xs text-gray-500">
                    {item.initialDiagnosis} · mở {formatDateShort(item.openedAt)}
                    {item.nextVisitAt ? ` · hẹn ${formatDateShort(item.nextVisitAt)}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} title="Lịch y tế 7 ngày tới" to={links.periodic} toLabel="Khám định kỳ" empty="Không có lịch" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Khu chuồng" to={links.zones} toLabel="Danh mục khu" flush className="lg:col-span-7">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-5 py-2 font-medium">Khu</th>
                <th className="px-3 py-2 font-medium">HT phụ trách</th>
                <th className="px-3 py-2 text-right font-medium">Ngựa</th>
                <th className="px-3 py-2 text-right font-medium">Chờ ô</th>
                <th className="w-40 px-5 py-2 font-medium">Còn nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 border-t border-gray-100">
              {barns.map((barn) => {
                const count = horses.filter((horse) => horse.location.barn?.id === barn.id).length;
                return (
                  <tr key={barn.id}>
                    <td className="px-5 py-2.5 font-medium text-gray-900">{barn.name}</td>
                    <td className="px-3 py-2.5 text-gray-600">{barn.headTrainerFullName ?? <span className="text-gray-400">Chưa có HT</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{count}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{barn.pendingStallHorseCount || '—'}</td>
                    <td className="px-5 py-2.5">
                      {barn.status !== 'ACTIVE' ? (
                        <span className="text-xs text-gray-500">Khu không hoạt động</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Meter value={count} max={count + barn.availableStallCount || 1} className="flex-1" />
                          <span className={cn('w-14 text-right text-xs tabular-nums', barn.availableStallCount <= 0 ? 'font-medium text-amber-700' : 'text-gray-500')}>
                            {barn.availableStallCount <= 0 ? 'hết chỗ' : `còn ${barn.availableStallCount}`}
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
        <RecentActivity className="lg:col-span-5" />
      </div>
    </Reveal>
  );
}

/* ===== Huấn luyện viên trưởng ===== */

function TrainerDashboard({ name, userId }: { name: string; userId: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => loadTrainer(userId), [userId]);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const { horses, barns, medical, ids } = data;
  const pendingStall = horses.filter((horse) => horse.location.placementStatus === 'PENDING_STALL');
  const requests = medical.pendingRequests.filter((item) => ids.has(item.horseId));
  const blocked = horses.filter(cannotTrain);
  const watch = horses.filter((horse) => horse.lifecycleStatus === 'ACTIVE' && horse.healthStatus === 'UNDER_OBSERVATION');
  const openCases = medical.openCases.filter((item) => ids.has(item.horseId));

  const attention: Attention[] = [
    ...requests
      .filter((item) => item.urgent)
      .map((item) => ({
        key: `req-${item.id}`,
        level: 'danger' as const,
        title: `Đang chờ bác sĩ khám khẩn: ${item.horseName}`,
        detail: item.description,
        to: links.requests,
        cta: 'Theo dõi',
      })),
    ...pendingStall.map((horse) => ({
      key: `stall-${horse.id}`,
      level: 'warn' as const,
      title: `${horse.name} chờ xếp ô và phân công Groom`,
      detail: horse.location.barn?.name,
      to: links.stable,
      cta: 'Xếp ô',
    })),
    ...blocked.map((horse) => ({
      key: `blk-${horse.id}`,
      level: 'info' as const,
      title: `${horse.name} không tập được`,
      detail: isLocked(horse) ? 'Đang có lệnh khóa huấn luyện' : horse.healthStatus === 'INJURED' ? 'Đang chấn thương' : 'Đang cách ly',
      to: links.horse(horse.id),
      cta: 'Hồ sơ',
    })),
    ...watch.map((horse) => ({
      key: `watch-${horse.id}`,
      level: 'info' as const,
      title: `${horse.name} cần theo dõi`,
      detail: 'Vẫn được tập, không được đăng ký đua',
      to: links.horse(horse.id),
      cta: 'Hồ sơ',
    })),
  ];

  return (
    <Reveal className="space-y-5">
      <div data-reveal>
        <PageHeader
          eyebrow={`${todayLabel()} · ${barns.map((barn) => barn.name).join(', ') || 'chưa được giao khu'}`}
          title={`${greeting()}, ${name}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate(links.requests)}>
                <Stethoscope size={15} /> Gửi yêu cầu khám
              </Button>
              <Button onClick={() => navigate(links.stable)}>
                <MapPinned size={15} /> Sơ đồ chuồng
              </Button>
            </>
          }
        />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat value={horses.length} label="Ngựa trong khu" hint={`${watch.length} cần theo dõi`} icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
          <Stat value={pendingStall.length} label="Chờ xếp ô" icon={<MapPinned size={18} />} tone="warning" onClick={() => navigate(links.stable)} />
          <Stat value={requests.length} label="Yêu cầu khám đang chờ" hint={`${requests.filter((item) => item.urgent).length} khẩn`} icon={<ClipboardCheck size={18} />} tone="warning" onClick={() => navigate(links.requests)} />
          <Stat value={blocked.length} label="Ngựa không tập được" icon={<AlertOctagon size={18} />} tone="danger" />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <AttentionList items={attention} className="lg:col-span-7" />
        <Panel title="Bệnh án của ngựa trong khu" to={links.cases} className="lg:col-span-5">
          {openCases.length === 0 ? (
            <p className="text-sm text-gray-500">Không có ngựa nào trong khu đang điều trị.</p>
          ) : (
            <div className="-mx-2 space-y-1">
              {openCases.map((item) => (
                <Link key={item.caseId} to={links.case(item.caseId)} className="block rounded-xl px-2 py-2 transition hover:bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">{item.horseName}</p>
                  <p className="text-xs text-gray-500">
                    {item.initialDiagnosis}
                    {item.nextVisitAt ? ` · tái khám ${formatDateShort(item.nextVisitAt)}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} title="Lịch y tế 7 ngày tới của khu" empty="Không có lịch" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Ngựa trong khu" to={links.horses} toLabel="Danh sách ngựa" flush className="lg:col-span-7">
          <HorseRows horses={[...horses].sort(byPriority)} empty="Khu của bạn chưa có ngựa." />
        </Panel>
        <RecentActivity className="lg:col-span-5" />
      </div>
    </Reveal>
  );
}

/* ===== Bác sĩ thú y ===== */

function VetDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => loadVet(), []);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const { medical } = data;
  const today = todayKey();
  const tomorrow = toDateKey(addDays(now(), 1));
  const overdue = medical.checkups.filter((item) => item.daysLeft < 0);
  const urgentCount = medical.pendingRequests.filter((item) => item.urgent).length;
  const careDue = medical.careSchedules.filter((item) => item.dueDate <= today);

  const attention: Attention[] = [
    ...medical.pendingRequests.map((item) => ({
      key: `req-${item.id}`,
      level: item.urgent ? ('danger' as const) : ('warn' as const),
      title: `${item.urgent ? 'Khám khẩn' : 'Yêu cầu khám'}: ${item.horseName}`,
      detail: `${requestSourceLabel[item.source]} · ${item.description} · ${formatRelative(item.createdAt, now())}`,
      to: links.requests,
      cta: 'Khám',
    })),
    ...overdue.map((item) => ({
      key: `due-${item.horseId}`,
      level: 'warn' as const,
      title: `${item.horseName} quá hạn khám định kỳ ${-item.daysLeft} ngày`,
      detail: `Hạn ${formatDate(item.dueDate)}${item.appointment ? ` · đã hẹn ${formatDateShort(item.appointment.scheduledAt)}` : ''}`,
      to: links.periodic,
      cta: 'Ghi buổi khám',
    })),
    ...medical.openCases
      .filter((item) => item.nextVisitAt && toDateKey(item.nextVisitAt) <= tomorrow)
      .map((item) => ({
        key: `case-${item.caseId}`,
        level: 'warn' as const,
        title: `Hẹn tái khám ${item.horseName}`,
        detail: `${item.initialDiagnosis} · ${toDateKey(item.nextVisitAt!) < today ? 'đã qua hẹn' : toDateKey(item.nextVisitAt!) === today ? 'hôm nay' : 'ngày mai'}`,
        to: links.case(item.caseId),
        cta: 'Mở bệnh án',
      })),
    ...careDue.map((item) => ({
      key: `care-${item.scheduleId}`,
      level: 'info' as const,
      title: `${careTypeLabel[item.type]} cho ${item.horseName}`,
      detail: item.dueDate < today ? `Quá hạn từ ${formatDate(item.dueDate)}` : 'Đến hạn hôm nay',
      to: links.horseMedical(item.horseId),
      cta: 'Mở',
    })),
  ];

  const herdAbnormal = medical.herd.horses.filter((horse) => horse.healthStatus !== 'ELIGIBLE');

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
            value={medical.pendingRequests.length}
            label="Yêu cầu khám đang chờ"
            hint={`${urgentCount} khẩn`}
            icon={<Stethoscope size={18} />}
            tone={urgentCount > 0 ? 'danger' : 'warning'}
            onClick={() => navigate(links.requests)}
          />
          <Stat value={overdue.length} label="Quá hạn khám định kỳ" icon={<Syringe size={18} />} tone="warning" onClick={() => navigate(links.periodic)} />
          <Stat value={medical.openCases.length} label="Bệnh án đang điều trị" icon={<ClipboardCheck size={18} />} onClick={() => navigate(links.cases)} />
          <Stat value={careDue.length} label="Lịch chăm sóc đến hạn" icon={<CalendarClock size={18} />} tone="warning" onClick={() => navigate(links.careSchedules)} />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <AttentionList items={attention} empty="Không có yêu cầu khám hay lịch khám nào cần xử lý" className="lg:col-span-7" />
        <Panel title="Bệnh án đang điều trị" to={links.cases} className="lg:col-span-5">
          {medical.openCases.length === 0 ? (
            <p className="text-sm text-gray-500">Không có bệnh án nào đang mở.</p>
          ) : (
            <div className="-mx-2 space-y-1">
              {medical.openCases.map((item) => (
                <Link key={item.caseId} to={links.case(item.caseId)} className="block rounded-xl px-2 py-2 transition hover:bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">{item.horseName}</p>
                  <p className="text-xs text-gray-500">
                    {item.initialDiagnosis}
                    {item.lastVisitAt ? ` · khám gần nhất ${formatDateShort(item.lastVisitAt)}` : ''}
                    {item.nextVisitAt ? ` · hẹn ${formatDateShort(item.nextVisitAt)}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} title="Lịch y tế 7 ngày tới" to={links.periodic} toLabel="Khám định kỳ" empty="Không có lịch" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Ngựa có vấn đề sức khỏe" to={links.medicalBoard} toLabel="Sơ đồ đàn" flush className="lg:col-span-7">
          {herdAbnormal.length === 0 ? (
            <p className="px-5 py-5 text-sm text-gray-500">Cả đàn đang đủ điều kiện.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {herdAbnormal.map((horse) => (
                <li key={horse.horseId}>
                  <Link to={links.horseMedical(horse.horseId)} className="flex items-center justify-between gap-3 px-5 py-2.5 transition hover:bg-gray-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">{horse.horseName}</span>
                      <span className="block text-xs text-gray-500">{horse.stallCode ? `Ô ${horse.stallCode}` : 'Chưa xếp ô'}</span>
                    </span>
                    <HealthPill status={horse.healthStatus} />
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

function GroomDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => loadGroom(), []);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const today = todayKey();
  const due = data.schedules.filter((item) => toDateKey(item.schedule.dueAt) <= today);
  const attention: Attention[] = [
    ...due.map(({ schedule, horseName }) => ({
      key: `care-${schedule.id}`,
      level: toDateKey(schedule.dueAt) < today ? ('danger' as const) : ('warn' as const),
      title: `${careTypeLabel[schedule.type]} cho ${horseName}`,
      detail: `${toDateKey(schedule.dueAt) < today ? `Quá hạn từ ${formatDate(schedule.dueAt)}` : 'Đến hạn hôm nay'}${schedule.notes ? ` · ${schedule.notes}` : ''}`,
      to: links.horseMedical(schedule.horseId),
      cta: 'Hoàn tất',
    })),
    ...data.horses
      .filter((horse) => horse.lifecycleStatus === 'ACTIVE' && horse.healthStatus !== 'ELIGIBLE')
      .map((horse) => ({
        key: `h-${horse.id}`,
        level: 'info' as const,
        title: `${horse.name} đang ${horse.healthStatus === 'UNDER_OBSERVATION' ? 'cần theo dõi' : horse.healthStatus === 'INJURED' ? 'chấn thương' : 'cách ly'}`,
        detail: 'Xem dặn dò của bác sĩ trong hồ sơ ngựa',
        to: links.horse(horse.id),
        cta: 'Hồ sơ',
      })),
  ];

  return (
    <Reveal className="space-y-5">
      <div data-reveal>
        <PageHeader
          eyebrow={todayLabel()}
          title={`${greeting()}, ${name}`}
          actions={
            <Button onClick={() => navigate(links.requests)}>
              <Stethoscope size={15} /> Gửi yêu cầu khám
            </Button>
          }
        />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat value={data.horses.length} label="Ngựa phụ trách" icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
          <Stat value={due.length} label="Việc chăm sóc đến hạn" hint="tiêm phòng, tẩy giun, kiểm tra móng" icon={<CalendarClock size={18} />} tone="warning" />
          <Stat value={data.notes.length} label="Ngựa có dặn dò của bác sĩ" icon={<ClipboardCheck size={18} />} />
          <Stat value={data.requests.length} label="Yêu cầu khám chờ bác sĩ" icon={<Stethoscope size={18} />} onClick={() => navigate(links.requests)} />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <AttentionList items={attention} empty="Hôm nay không có việc chăm sóc nào đến hạn" className="lg:col-span-7" />
        <Panel title="Bác sĩ dặn" className="lg:col-span-5">
          {data.notes.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có ghi chú chăm sóc nào cho các ngựa bạn phụ trách.</p>
          ) : (
            <div className="space-y-3">
              {data.notes.map(({ horse, current }) => (
                <Link key={horse.id} to={links.horse(horse.id)} className="-mx-2 block rounded-xl px-2 py-2 transition hover:bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">
                    {horse.name} <span className="font-normal text-gray-500">· {formatDateShort(current!.examDate)}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-gray-700">{current!.careInstructions}</p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} title="Việc chăm sóc 7 ngày tới" empty="Không có việc" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Ngựa bạn phụ trách" to={links.horses} flush className="lg:col-span-7">
          <HorseRows horses={[...data.horses].sort(byPriority)} empty="Bạn chưa được phân công ngựa nào." />
        </Panel>
        <RecentActivity className="lg:col-span-5" />
      </div>
    </Reveal>
  );
}

/* ===== Chủ ngựa ===== */

function OwnerDashboard({ name }: { name: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useService(() => loadOwner(), []);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tải được dữ liệu'} />;

  const weekCount = data.week.reduce((sum, day) => sum + day.items.length, 0);

  return (
    <Reveal className="space-y-5">
      <div data-reveal>
        <PageHeader eyebrow={todayLabel()} title={`${greeting()}, ${name}`} />
      </div>

      <div data-reveal>
        <StatRow>
          <Stat value={data.active.length} label="Ngựa đang ở câu lạc bộ" hint={data.horses.length > data.active.length ? `${data.horses.length - data.active.length} đã chuyển nhượng` : undefined} icon={<Users size={18} />} onClick={() => navigate(links.horses)} />
          <Stat value={data.openCases.length} label="Đang điều trị" icon={<Stethoscope size={18} />} tone="warning" onClick={() => navigate(links.cases)} />
          <Stat value={weekCount} label="Việc chăm sóc 7 ngày tới" icon={<CalendarClock size={18} />} />
          <Stat value={formatMoney(data.medicalCost)} label="Chi phí y tế đã chốt" icon={<Wallet size={18} />} onClick={() => navigate(links.cases)} />
        </StatRow>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Ngựa của tôi" to={links.horses} flush className="lg:col-span-7">
          <HorseRows
            horses={[...data.horses].sort(byPriority)}
            empty="Bạn chưa sở hữu con ngựa nào tại câu lạc bộ."
            note={(horse) =>
              horse.lifecycleStatus !== 'ACTIVE' ? null : cannotTrain(horse) ? (
                <span className="font-medium text-red-700">Không tập</span>
              ) : !horse.canRegisterRace && horse.lifecycleStatus === 'ACTIVE' ? (
                <span className="font-medium text-amber-800">Không được đua</span>
              ) : null
            }
          />
        </Panel>
        <Panel title="Đang điều trị" to={links.cases} toLabel="Bệnh án" className="lg:col-span-5">
          {data.openCases.length === 0 ? (
            <p className="text-sm text-gray-500">Không có ngựa nào đang điều trị.</p>
          ) : (
            <div className="-mx-2 space-y-1">
              {data.openCases.map((item) => (
                <Link key={item.id} to={links.case(item.id)} className="block rounded-xl px-2 py-2 transition hover:bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">{item.horseName}</p>
                  <p className="text-xs text-gray-500">
                    {item.initialDiagnosis} · từ {formatDate(item.openedAt)}
                  </p>
                </Link>
              ))}
            </div>
          )}
          <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">Chi phí chỉ hiện khi bác sĩ đã đóng bệnh án.</p>
        </Panel>
      </div>

      <div data-reveal>
        <WeekStrip days={data.week} title="Việc chăm sóc 7 ngày tới" empty="Không có việc" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-12" data-reveal>
        <Panel title="Chi phí y tế đã chốt" flush className="lg:col-span-7">
          <div className="px-5 py-4">
            <p className="text-2xl font-bold tabular-nums text-gray-900">{formatMoney(data.medicalCost)}</p>
            <p className="mt-1 text-xs text-gray-500">Tổng chi phí các bệnh án đã đóng.</p>
          </div>
          {data.closedCases.length > 0 && (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {data.closedCases.map((item) => (
                <li key={item.id}>
                  <Link to={links.case(item.id)} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm transition hover:bg-gray-50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">
                        {item.horseName} · {item.initialDiagnosis}
                      </span>
                      <span className="block text-xs text-gray-500">Đóng {formatDate(item.closedAt)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <CaseStatusPill status={item.status} />
                      <span className="tabular-nums text-gray-700">{formatMoney(item.totalCost ?? 0)}</span>
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
