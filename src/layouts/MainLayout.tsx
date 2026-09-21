import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Calendar,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Flag,
  HeartPulse,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPinned,
  Play,
  Camera,
  ScrollText,
  Settings,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TrendingUp,
  Trophy,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import Lenis from 'lenis';
import { useStore } from '../store/store';
import { Avatar, ToastHost, useToast } from '../components/ui';
import { roleLabel } from '../lib/labels';
import { markAllNotificationsRead, markNotificationRead } from '../services/system.service';
import { syncRunningSessions } from '../services/training.service';
import { formatRelative } from '../lib/format';
import { now } from '../lib/clock';
import { playAlertBeep } from '../lib/sound';

interface NavItem {
  name: string;
  path: string;
  icon: typeof Flag;
}

function menuFor(role: string | undefined, zoneName: string): { group?: string; items: NavItem[] }[] {
  switch (role) {
    case 'CLUB_MANAGER':
      return [
        { items: [{ name: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard }] },
        {
          group: 'Đàn ngựa',
          items: [
            { name: 'Ngựa', path: '/horses', icon: Users },
            { name: 'Sơ đồ chuồng', path: '/stable', icon: MapPinned },
          ],
        },
        {
          group: 'Huấn luyện',
          items: [
            { name: 'Tiến độ', path: '/training/progress', icon: TrendingUp },
            { name: 'Lịch tập', path: '/training/schedule', icon: Calendar },
            { name: 'Theo dõi trực tiếp', path: '/training/live', icon: Activity },
          ],
        },
        {
          group: 'Y tế',
          items: [
            { name: 'Sơ đồ sức khỏe', path: '/medical/board', icon: HeartPulse },
            { name: 'Hồ sơ khám', path: '/medical/records', icon: Stethoscope },
            { name: 'Lịch chăm sóc', path: '/medical/care', icon: Syringe },
          ],
        },
        {
          group: 'Vận hành',
          items: [
            { name: 'Vật tư', path: '/care/supplies', icon: Boxes },
            { name: 'Giải đua', path: '/races', icon: Trophy },
            { name: 'Kết quả', path: '/races/results', icon: Flag },
            { name: 'Báo cáo', path: '/reports', icon: BarChart3 },
          ],
        },
        {
          group: 'Quản trị',
          items: [
            { name: 'Nhân sự', path: '/admin/users', icon: Users },
            { name: 'Phân quyền', path: '/admin/permissions', icon: ShieldCheck },
            { name: 'Khu và ô chuồng', path: '/admin/zones', icon: MapPinned },
            { name: 'Nhật ký thao tác', path: '/admin/audit', icon: ScrollText },
            { name: 'Công cụ hệ thống', path: '/admin/system', icon: Settings },
          ],
        },
      ];
    case 'HEAD_TRAINER':
      return [
        { items: [{ name: `Tổng quan ${zoneName}`, path: '/dashboard', icon: LayoutDashboard }] },
        {
          group: 'Đàn ngựa',
          items: [
            { name: 'Ngựa', path: '/horses', icon: Users },
            { name: 'Sơ đồ chuồng', path: '/stable', icon: MapPinned },
          ],
        },
        {
          group: 'Huấn luyện',
          items: [
            { name: 'Giáo án', path: '/training/plans', icon: ClipboardList },
            { name: 'Lịch tập', path: '/training/schedule', icon: Calendar },
            { name: 'Buổi tập hôm nay', path: '/training/today', icon: CalendarCheck },
            { name: 'Theo dõi trực tiếp', path: '/training/live', icon: Activity },
            { name: 'Chờ đánh giá', path: '/training/review', icon: ClipboardCheck },
            { name: 'Tiến độ', path: '/training/progress', icon: TrendingUp },
          ],
        },
        {
          group: 'Khác',
          items: [
            { name: 'Đăng ký thi đấu', path: '/races', icon: Trophy },
            { name: 'Khẩu phần', path: '/care/diet', icon: UtensilsCrossed },
          ],
        },
      ];
    case 'VETERINARIAN':
      return [
        { items: [{ name: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard }] },
        {
          group: 'Y tế',
          items: [
            { name: 'Sơ đồ sức khỏe', path: '/medical/board', icon: HeartPulse },
            { name: 'Hồ sơ khám', path: '/medical/records', icon: Stethoscope },
            { name: 'Khóa huấn luyện', path: '/medical/locks', icon: Lock },
            { name: 'Lịch chăm sóc định kỳ', path: '/medical/care', icon: Syringe },
            { name: 'Sự cố', path: '/care/incidents', icon: Camera },
          ],
        },
        {
          group: 'Theo dõi',
          items: [
            { name: 'Ngựa', path: '/horses', icon: Users },
            { name: 'Nhịp tim tối đa', path: '/medical/heart-rate', icon: Activity },
            { name: 'Theo dõi trực tiếp', path: '/training/live', icon: Activity },
            { name: 'Duyệt khẩu phần', path: '/care/diet', icon: UtensilsCrossed },
          ],
        },
      ];
    case 'GROOM':
      return [
        {
          items: [
            { name: 'Hôm nay', path: '/care/today', icon: CalendarCheck },
            { name: 'Buổi tập hôm nay', path: '/training/today', icon: Play },
            { name: 'Việc chăm sóc của tôi', path: '/care/instructions', icon: ClipboardCheck },
            { name: 'Sơ đồ chuồng', path: '/stable', icon: MapPinned },
            { name: 'Ngựa', path: '/horses', icon: Users },
            { name: 'Khẩu phần', path: '/care/diet', icon: UtensilsCrossed },
            { name: 'Báo sự cố', path: '/care/incidents/new', icon: Camera },
            { name: 'Vật tư', path: '/care/supplies', icon: Boxes },
          ],
        },
      ];
    case 'HORSE_OWNER':
      return [
        {
          items: [
            { name: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard },
            { name: 'Ngựa của tôi', path: '/horses', icon: Users },
            { name: 'Duyệt đăng ký thi đấu', path: '/races/approvals', icon: Trophy },
            { name: 'Báo cáo chi phí', path: '/reports', icon: BarChart3 },
          ],
        },
      ];
    default:
      return [{ items: [{ name: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard }] }];
  }
}

function NotificationBell() {
  const notifications = useStore((state) => state.notifications);
  const unread = useStore((state) => state.unreadCount);
  const refresh = useStore((state) => state.refresh);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  // Cảnh báo khẩn hiện thông báo nổi kèm tiếng bíp ngắn.
  useEffect(() => {
    const urgent = notifications.filter((item) => item.level === 'URGENT' && !item.readAt);
    if (!primed.current) {
      urgent.forEach((item) => seen.current.add(item.id));
      primed.current = true;
      return;
    }
    const fresh = urgent.filter((item) => !seen.current.has(item.id));
    fresh.forEach((item) => {
      seen.current.add(item.id);
      toast.push(`${item.title} — ${item.body}`, 'error');
    });
    if (fresh.length > 0) playAlertBeep();
  }, [notifications, toast]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Thông báo"
        className="relative rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-12 z-50 w-96 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_16px_48px_rgba(5,96,69,0.14)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">Thông báo</span>
              {unread > 0 && (
                <button
                  onClick={async () => {
                    await markAllNotificationsRead();
                    refresh();
                  }}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Đánh dấu đã đọc hết
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 && (
                <p className="px-4 py-10 text-center text-sm font-light text-gray-400">Chưa có thông báo nào</p>
              )}
              {notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={async () => {
                    await markNotificationRead(item.id);
                    refresh();
                    setOpen(false);
                    if (item.link) navigate(item.link);
                  }}
                  className={`flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition last:border-0 hover:bg-gray-50 ${
                    item.readAt ? 'opacity-55' : ''
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.level === 'URGENT' ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-800">{item.title}</span>
                    <span className="mt-0.5 block text-xs font-light text-gray-500">{item.body}</span>
                    <span className="mt-1 block text-[11px] text-gray-400">
                      {formatRelative(item.createdAt, now())}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Chạy nền: sinh mẫu cho buổi đang diễn ra, ghi cảnh báo, tự kết thúc khi quá giờ. */
function useSessionTicker() {
  useEffect(() => {
    const tick = () => {
      syncRunningSessions().catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => window.clearInterval(timer);
  }, []);
}

function Shell() {
  const { currentUser, logout } = useStore();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  useSessionTicker();

  useEffect(() => {
    const container = document.getElementById('main-scroll');
    if (!container) return;
    const lenis = new Lenis({
      wrapper: container,
      content: container.firstElementChild as HTMLElement,
      smoothWheel: true,
      lerp: 0.08,
    });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  const zoneName = currentUser?.zoneId === 'zone_a' ? 'Khu A' : currentUser?.zoneId === 'zone_b' ? 'Khu B' : 'khu';
  const groups = useMemo(() => menuFor(currentUser?.role, zoneName), [currentUser?.role, zoneName]);

  const scope = (() => {
    if (!currentUser) return '';
    if (currentUser.role === 'HEAD_TRAINER') return zoneName;
    if (currentUser.role === 'GROOM') return 'Ngựa được giao';
    if (currentUser.role === 'HORSE_OWNER') return 'Ngựa sở hữu';
    return 'Toàn câu lạc bộ';
  })();

  return (
    <div className="flex h-screen bg-[#f8faf8] font-sans">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-100 bg-white p-5 lg:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-sm shadow-emerald-600/20">
            <Flag size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">HorseRacing</span>
        </Link>

        <nav className="flex-1 space-y-5 overflow-y-auto custom-scrollbar pr-1">
          {groups.map((group, index) => (
            <div key={group.group ?? index} className="space-y-0.5">
              {group.group && (
                <p className="mb-1.5 px-4 text-[11px] font-semibold tracking-wide text-gray-300">{group.group}</p>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'ml-[-3px] border-l-[3px] border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }`
                  }
                >
                  <item.icon size={17} className="shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex items-center gap-3">
            <Avatar name={currentUser?.name ?? '?'} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{currentUser?.name}</p>
              <p className="truncate text-xs text-gray-400">
                {currentUser ? roleLabel[currentUser.role] : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-gray-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 active:scale-[0.98]"
          >
            <LogOut size={15} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-white/80 px-5 backdrop-blur-md sm:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-gray-900">
              {currentUser ? roleLabel[currentUser.role] : 'HorseRacing'}
            </h1>
            <p className="truncate text-xs text-gray-400">
              {currentUser?.name} · Phạm vi: {scope}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setAccountOpen((value) => !value)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:bg-gray-50"
              >
                <Avatar name={currentUser?.name ?? '?'} size={26} />
                <span className="hidden text-xs font-semibold text-gray-700 sm:inline">Tài khoản</span>
              </button>
              {accountOpen && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" onClick={() => setAccountOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1.5 shadow-[0_16px_48px_rgba(5,96,69,0.14)]">
                    <Link
                      to="/profile"
                      onClick={() => setAccountOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50"
                    >
                      Hồ sơ cá nhân
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setAccountOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-600 transition hover:bg-gray-50"
                    >
                      Đổi tài khoản
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        navigate('/');
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-red-500 transition hover:bg-red-50"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div id="main-scroll" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-5 pb-16 sm:p-8">
            <Outlet />
          </div>
        </div>

        {/* Thanh điều hướng dưới cho màn hình nhỏ — ưu tiên cho nhân viên chăm sóc */}
        <nav className="flex shrink-0 items-center justify-around border-t border-gray-100 bg-white px-2 py-1.5 lg:hidden">
          {groups
            .flatMap((group) => group.items)
            .slice(0, 5)
            .map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition ${
                    isActive ? 'text-emerald-700' : 'text-gray-400'
                  }`
                }
              >
                <item.icon size={18} />
                <span className="w-full truncate text-center">{item.name}</span>
              </NavLink>
            ))}
        </nav>
      </main>
    </div>
  );
}

export default function MainLayout() {
  return (
    <ToastHost>
      <Shell />
    </ToastHost>
  );
}
