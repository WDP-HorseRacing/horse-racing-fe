import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Activity,
  BookOpen,
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Flag,
  HeartPulse,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPinned,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TrendingUp,
  UserCog,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import Lenis from 'lenis';
import { useStore } from '../store/store';
import { Avatar, ToastHost, Tip, cn, useToast } from '../components/ui';
import { notificationTone } from '../components/ui/status';
import { roleLabel } from '../lib/labels';
import { links } from '../lib/links';
import { markAllNotificationsRead, markNotificationRead, runBackgroundChecks } from '../services/system.service';
import { syncRunningSessions } from '../services/session.service';
import { getDb } from '../services/db';
import { managedZoneIds } from '../services/selectors';
import { formatRelative } from '../lib/format';
import { now } from '../lib/clock';
import { playAlertBeep } from '../lib/sound';
import type { UserRole } from '../types/domain';

interface NavItem {
  name: string;
  path: string;
  icon: typeof Flag;
}

interface NavGroup {
  group?: string;
  items: NavItem[];
}

function menuFor(role: UserRole | undefined): NavGroup[] {
  switch (role) {
    case 'CLUB_MANAGER':
      return [
        { items: [{ name: 'Tổng quan', path: links.dashboard, icon: LayoutDashboard }] },
        {
          group: 'Đàn ngựa',
          items: [
            { name: 'Ngựa', path: links.horses, icon: Users },
            { name: 'Sơ đồ chuồng', path: links.stable, icon: MapPinned },
            { name: 'Khu và ô chuồng', path: links.zones, icon: Warehouse },
          ],
        },
        {
          group: 'Huấn luyện',
          items: [
            { name: 'Lớp học', path: links.classes, icon: Layers },
            { name: 'Giáo án', path: links.programs, icon: ClipboardList },
            { name: 'Môn học', path: links.subjects, icon: BookOpen },
            { name: 'Lịch tập', path: links.schedule, icon: CalendarDays },
            { name: 'Tiến độ', path: links.progress, icon: TrendingUp },
            { name: 'Theo dõi trực tiếp', path: links.live, icon: Activity },
          ],
        },
        {
          group: 'Y tế',
          items: [
            { name: 'Bảng điều khiển', path: links.medicalBoard, icon: HeartPulse },
            { name: 'Yêu cầu khám', path: links.requests, icon: ClipboardCheck },
            { name: 'Bệnh án', path: links.cases, icon: Stethoscope },
            { name: 'Khám định kỳ', path: links.periodic, icon: Syringe },
            { name: 'Khóa huấn luyện', path: links.locks, icon: Lock },
          ],
        },
        {
          group: 'Quản trị',
          items: [
            { name: 'Nhân sự', path: links.adminUsers, icon: UserCog },
            { name: 'Phân quyền', path: links.adminPermissions, icon: ShieldCheck },
            { name: 'Nhật ký thao tác', path: links.adminAudit, icon: ScrollText },
            { name: 'Công cụ hệ thống', path: links.adminSystem, icon: Settings },
          ],
        },
      ];
    case 'HEAD_TRAINER':
      return [
        { items: [{ name: 'Tổng quan', path: links.dashboard, icon: LayoutDashboard }] },
        {
          group: 'Đàn ngựa',
          items: [
            { name: 'Ngựa', path: links.horses, icon: Users },
            { name: 'Sơ đồ chuồng', path: links.stable, icon: MapPinned },
          ],
        },
        {
          group: 'Huấn luyện',
          items: [
            { name: 'Buổi tập hôm nay', path: links.today, icon: CalendarCheck },
            { name: 'Lớp học', path: links.classes, icon: Layers },
            { name: 'Giáo án', path: links.programs, icon: ClipboardList },
            { name: 'Môn học', path: links.subjects, icon: BookOpen },
            { name: 'Lịch tập', path: links.schedule, icon: CalendarDays },
            { name: 'Chờ đánh giá', path: links.review, icon: ClipboardCheck },
            { name: 'Theo dõi trực tiếp', path: links.live, icon: Activity },
            { name: 'Tiến độ', path: links.progress, icon: TrendingUp },
          ],
        },
        {
          group: 'Y tế',
          items: [
            { name: 'Yêu cầu khám', path: links.requests, icon: ClipboardCheck },
            { name: 'Bệnh án', path: links.cases, icon: Stethoscope },
            { name: 'Khóa huấn luyện', path: links.locks, icon: Lock },
          ],
        },
      ];
    case 'VETERINARIAN':
      return [
        { items: [{ name: 'Tổng quan', path: links.dashboard, icon: LayoutDashboard }] },
        {
          group: 'Y tế',
          items: [
            { name: 'Bảng điều khiển', path: links.medicalBoard, icon: HeartPulse },
            { name: 'Yêu cầu khám', path: links.requests, icon: ClipboardCheck },
            { name: 'Bệnh án', path: links.cases, icon: Stethoscope },
            { name: 'Khám định kỳ', path: links.periodic, icon: Syringe },
            { name: 'Khóa huấn luyện', path: links.locks, icon: Lock },
          ],
        },
        {
          group: 'Huấn luyện',
          items: [
            { name: 'Nhịp tim tối đa', path: links.heartRate, icon: Activity },
            { name: 'Theo dõi trực tiếp', path: links.live, icon: Activity },
            { name: 'Lớp học', path: links.classes, icon: Layers },
          ],
        },
        { group: 'Đàn ngựa', items: [{ name: 'Ngựa', path: links.horses, icon: Users }] },
      ];
    case 'GROOM':
      return [
        { items: [{ name: 'Việc hôm nay', path: links.dashboard, icon: CalendarCheck }] },
        {
          group: 'Ngựa được giao',
          items: [
            { name: 'Ngựa', path: links.horses, icon: Users },
            { name: 'Sơ đồ chuồng', path: links.stable, icon: MapPinned },
            { name: 'Lịch tập', path: links.schedule, icon: CalendarDays },
            { name: 'Gửi yêu cầu khám', path: links.requests, icon: Stethoscope },
          ],
        },
      ];
    case 'HORSE_OWNER':
      return [
        {
          items: [
            { name: 'Tổng quan', path: links.dashboard, icon: LayoutDashboard },
            { name: 'Ngựa của tôi', path: links.horses, icon: Users },
            { name: 'Lịch tập', path: links.schedule, icon: CalendarDays },
            { name: 'Tiến độ', path: links.progress, icon: TrendingUp },
            { name: 'Bệnh án', path: links.cases, icon: Stethoscope },
          ],
        },
      ];
    default:
      return [{ items: [{ name: 'Tổng quan', path: links.dashboard, icon: LayoutDashboard }] }];
  }
}

/* ===== Chuông thông báo ===== */

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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-label="Thông báo"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition hover:text-emerald-700 hover:ring-emerald-200"
        >
          <Bell size={17} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums">
              {unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="anim-pop z-50 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-float ring-1 ring-emerald-950/5"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Thông báo</span>
            {unread > 0 && (
              <button
                onClick={async () => {
                  await markAllNotificationsRead();
                  refresh();
                }}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          <div className="max-h-[26rem] overflow-y-auto custom-scrollbar">
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
                className={cn(
                  'flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition last:border-0 hover:bg-emerald-50/40',
                  item.readAt && 'opacity-55',
                )}
              >
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', notificationTone[item.level].dot)} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="block text-sm font-semibold text-gray-800">{item.title}</span>
                    {item.level !== 'NORMAL' && (
                      <span
                        className={cn(
                          'rounded-md px-1.5 text-[10px] font-semibold',
                          item.level === 'URGENT' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        {notificationTone[item.level].label}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs font-light text-gray-500">{item.body}</span>
                  <span className="mt-1 block text-[11px] text-gray-400">{formatRelative(item.createdAt, now())}</span>
                </span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Chạy nền: sinh mẫu cho buổi đang diễn ra, ghi cảnh báo, tự kết thúc khi quá giờ. */
function useSessionTicker() {
  useEffect(() => {
    try {
      runBackgroundChecks();
    } catch {
      // Kiểm tra nền không được làm hỏng giao diện.
    }
    const tick = () => {
      syncRunningSessions().catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => window.clearInterval(timer);
  }, []);
}

const COLLAPSE_KEY = 'horseracing_sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function NavList({ groups, collapsed, onNavigate }: { groups: NavGroup[]; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
      {groups.map((group, index) => (
        <div key={group.group ?? index} className="space-y-0.5">
          {group.group &&
            (collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-emerald-950/10" />
            ) : (
              <p className="mb-1 px-3 text-xs font-medium text-emerald-900/40">{group.group}</p>
            ))}
          {group.items.map((item) => {
            const link = (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === links.dashboard || item.path === links.stable}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                    collapsed ? 'mx-auto h-10 w-10 justify-center' : 'px-3 py-2',
                    isActive
                      ? 'bg-emerald-600 text-white shadow-[0_8px_20px_-12px_rgba(5,150,105,0.9)]'
                      : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-800',
                  )
                }
              >
                <item.icon size={17} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </NavLink>
            );
            return collapsed ? (
              <Tip key={item.path} content={item.name}>
                {link}
              </Tip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link to={links.dashboard} className={cn('flex items-center gap-2.5', collapsed ? 'justify-center' : 'px-1')}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-[0_8px_20px_-10px_rgba(5,150,105,0.9)]">
        <Flag size={17} className="text-white" />
      </div>
      {!collapsed && <span className="text-lg font-bold tracking-tight text-gray-900">HorseRacing</span>}
    </Link>
  );
}

function Shell() {
  const { currentUser, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useSessionTicker();

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Trình duyệt chặn lưu trữ: chỉ mất ghi nhớ trạng thái thu gọn.
    }
  }, [collapsed]);

  useEffect(() => {
    const container = document.getElementById('main-scroll');
    if (!container) return;
    const lenis = new Lenis({
      wrapper: container,
      content: container.firstElementChild as HTMLElement,
      smoothWheel: true,
      lerp: 0.1,
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

  // Đổi trang thì cuộn về đầu.
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const groups = useMemo(() => menuFor(currentUser?.role), [currentUser?.role]);

  const scope = (() => {
    if (!currentUser) return '';
    if (currentUser.role === 'HEAD_TRAINER') {
      const db = getDb();
      const names = managedZoneIds(db, currentUser.id).map((id) => db.zones.find((zone) => zone.id === id)?.name);
      return names.length ? names.join(', ') : 'Chưa được giao khu';
    }
    if (currentUser.role === 'GROOM') return 'Ngựa được giao';
    if (currentUser.role === 'HORSE_OWNER') return 'Ngựa sở hữu';
    return 'Toàn câu lạc bộ';
  })();

  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-dvh bg-canvas font-sans">
      {/* Sidebar máy tính — thu gọn được thành rail icon */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-emerald-950/[0.06] bg-white/80 py-5 backdrop-blur transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[72px] px-2' : 'w-60 px-3',
        )}
      >
        <div className="mb-6">
          <Brand collapsed={collapsed} />
        </div>
        <NavList groups={groups} collapsed={collapsed} />
        <div className="mt-4 space-y-2 border-t border-emerald-950/[0.06] pt-4">
          {!collapsed && (
            <div className="flex items-center gap-3 px-1">
              <Avatar name={currentUser?.name ?? '?'} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{currentUser?.name}</p>
                <p className="truncate text-xs text-gray-400">{currentUser ? roleLabel[currentUser.role] : ''}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              'flex items-center gap-2 rounded-xl text-sm font-medium text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-800',
              collapsed ? 'mx-auto h-10 w-10 justify-center' : 'w-full px-3 py-2',
            )}
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!collapsed && 'Thu gọn menu'}
          </button>
        </div>
      </aside>

      {/* Drawer cho màn hình nhỏ */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-emerald-950/25 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="anim-drawer fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white px-3 py-5 shadow-float lg:hidden"
          >
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <div className="mb-6 flex items-center justify-between">
              <Brand collapsed={false} />
              <Dialog.Close className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </Dialog.Close>
            </div>
            <NavList groups={groups} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
            <button
              onClick={signOut}
              className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-emerald-950/[0.06] bg-white/70 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 lg:hidden"
              aria-label="Mở menu"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {currentUser ? roleLabel[currentUser.role] : 'HorseRacing'}
              </p>
              <p className="truncate text-xs text-gray-400">
                {currentUser?.name} · Phạm vi: {scope}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <Dropdown.Root modal={false}>
              <Dropdown.Trigger asChild>
                <button className="flex h-10 items-center gap-2 rounded-xl bg-white py-1 pl-1 pr-3 ring-1 ring-gray-200 transition hover:ring-emerald-200">
                  <Avatar name={currentUser?.name ?? '?'} size={30} />
                  <span className="hidden text-xs font-semibold text-gray-700 sm:inline">Tài khoản</span>
                </button>
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content
                  align="end"
                  sideOffset={8}
                  className="anim-pop z-50 w-56 rounded-2xl bg-white p-1.5 shadow-float ring-1 ring-emerald-950/5"
                >
                  <Dropdown.Item
                    onSelect={() => navigate(links.profile)}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-700 outline-none data-[highlighted]:bg-emerald-50"
                  >
                    Hồ sơ cá nhân
                  </Dropdown.Item>
                  <Dropdown.Item
                    onSelect={() => navigate('/login')}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-700 outline-none data-[highlighted]:bg-emerald-50"
                  >
                    Đổi tài khoản
                  </Dropdown.Item>
                  <Dropdown.Separator className="my-1 h-px bg-gray-100" />
                  <Dropdown.Item
                    onSelect={signOut}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50"
                  >
                    Đăng xuất
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </header>

        <div id="main-scroll" className="flex-1 overflow-y-auto">
          {/* Nội dung giãn toàn bộ bề ngang — không còn cột hẹp căn giữa */}
          <div className="w-full px-4 pb-16 pt-6 sm:px-6 lg:px-8 2xl:px-10">
            <Outlet />
          </div>
        </div>
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
