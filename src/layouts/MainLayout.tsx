import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Bell,
  CalendarClock,
  ClipboardCheck,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Stethoscope,
  Syringe,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import Lenis from 'lenis';
import { useStore } from '../store/store';
import { Avatar, ToastHost, Tip, cn, useToast } from '../components/ui';
import { Logo } from '../components/Logo';
import { TopProgress } from '../components/TopProgress';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary';
import { PageSkeleton } from '../components/skeletons';
import { preloadRoute } from '../routes/pages';
import { Breadcrumbs } from '../components/Breadcrumb';
import { notificationTone } from '../components/ui/status';
import { roleLabel } from '../lib/labels';
import { links } from '../lib/links';
import { useMyScope } from '../hooks/useMyScope';
import { formatRelative } from '../lib/format';
import { now } from '../lib/clock';
import { playAlertBeep } from '../lib/sound';
import type { UserRole } from '../types/domain';

interface NavItem {
  name: string;
  path: string;
  icon: typeof Bell;
}

interface NavGroup {
  group?: string;
  items: NavItem[];
}

// Menu theo vai trò. Flow 2 (huấn luyện) đang tạm ẩn cho tới khi có API thật (config/features.ts).
function menuFor(role: UserRole | undefined): NavGroup[] {
  const medical = (items: NavItem[]): NavGroup => ({ group: 'Y tế', items });
  switch (role) {
    case 'CLUB_MANAGER':
      return [
        { items: [{ name: 'Tổng quan', path: links.dashboard, icon: LayoutDashboard }] },
        {
          group: 'Đàn ngựa',
          items: [
            { name: 'Ngựa', path: links.horses, icon: Users },
            { name: 'Sơ đồ chuồng', path: links.stable, icon: MapPinned },
          ],
        },
        medical([
          { name: 'Bảng điều khiển', path: links.medicalBoard, icon: HeartPulse },
          { name: 'Yêu cầu khám', path: links.requests, icon: ClipboardCheck },
          { name: 'Bệnh án', path: links.cases, icon: Stethoscope },
          { name: 'Khám định kỳ', path: links.periodic, icon: Syringe },
          { name: 'Lịch chăm sóc', path: links.careSchedules, icon: CalendarClock },
          { name: 'Báo cáo chi phí', path: links.costReport, icon: ReceiptText },
        ]),
        {
          group: 'Quản trị',
          items: [
            { name: 'Nhân sự', path: links.adminUsers, icon: UserCog },
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
        medical([
          { name: 'Bảng điều khiển', path: links.medicalBoard, icon: HeartPulse },
          { name: 'Yêu cầu khám', path: links.requests, icon: ClipboardCheck },
          { name: 'Bệnh án', path: links.cases, icon: Stethoscope },
          { name: 'Lịch chăm sóc', path: links.careSchedules, icon: CalendarClock },
        ]),
      ];
    case 'VETERINARIAN':
      return [
        { items: [{ name: 'Tổng quan', path: links.dashboard, icon: LayoutDashboard }] },
        medical([
          { name: 'Bảng điều khiển', path: links.medicalBoard, icon: HeartPulse },
          { name: 'Yêu cầu khám', path: links.requests, icon: ClipboardCheck },
          { name: 'Bệnh án', path: links.cases, icon: Stethoscope },
          { name: 'Khám định kỳ', path: links.periodic, icon: Syringe },
          { name: 'Lịch chăm sóc', path: links.careSchedules, icon: CalendarClock },
        ]),
        { group: 'Đàn ngựa', items: [{ name: 'Ngựa', path: links.horses, icon: Users }] },
      ];
    case 'GROOM':
      return [
        { items: [{ name: 'Việc hôm nay', path: links.dashboard, icon: LayoutDashboard }] },
        {
          group: 'Ngựa được giao',
          items: [
            { name: 'Ngựa', path: links.horses, icon: Users },
            { name: 'Sơ đồ chuồng', path: links.stable, icon: MapPinned },
            { name: 'Yêu cầu khám', path: links.requests, icon: Stethoscope },
          ],
        },
      ];
    case 'HORSE_OWNER':
      return [
        {
          items: [
            { name: 'Tổng quan', path: links.dashboard, icon: LayoutDashboard },
            { name: 'Ngựa của tôi', path: links.horses, icon: Users },
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
  const markRead = useStore((state) => state.markRead);
  const markAllRead = useStore((state) => state.markAllRead);
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
          className="anim-pop z-50 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-float ring-1 ring-gray-200"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Thông báo</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          <div className="max-h-[26rem] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 && (
              <p className="px-4 py-10 text-center text-sm font-light text-gray-400">
                Chưa có thông báo mới. Thông báo đến trong lúc bạn đang đăng nhập sẽ hiện ở đây.
              </p>
            )}
            {notifications.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  markRead(item.id);
                  setOpen(false);
                  if (item.link) navigate(item.link);
                }}
                className={cn(
                  'flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition last:border-0 hover:bg-gray-50',
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
              <div className="mx-auto my-2 h-px w-6 bg-gray-200" />
            ) : (
              <p className="mb-1 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{group.group}</p>
            ))}
          {group.items.map((item) => {
            // className phải là chuỗi: Tooltip.Trigger (asChild) ghép class bằng nối chuỗi nên làm hỏng className dạng hàm.
            // Mục đang mở nhận aria-current="page" từ NavLink, tô màu bằng biến thể aria-[current=page].
            const link = (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === links.dashboard}
                onClick={onNavigate}
                // Rê chuột / focus vào menu thì tải trước mã trang.
                onMouseEnter={() => preloadRoute(item.path)}
                onFocus={() => preloadRoute(item.path)}
                className={cn(
                  'group flex items-center gap-3 rounded-lg text-sm font-medium text-gray-600 transition-colors duration-150 hover:bg-emerald-50 hover:text-emerald-700',
                  'aria-[current=page]:bg-emerald-50 aria-[current=page]:font-semibold aria-[current=page]:text-emerald-800',
                  collapsed ? 'mx-auto h-10 w-10 justify-center' : 'px-3 py-2',
                )}
              >
                <item.icon size={17} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </NavLink>
            );
            return collapsed ? (
              <Tip key={item.path} content={item.name} side="right">
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
      <Logo size={36} withText={!collapsed} />
    </Link>
  );
}

function Shell() {
  const { currentUser, logout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isTrainer = currentUser?.role === 'HEAD_TRAINER';
  const myScope = useMyScope();

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
    if (isTrainer) {
      if (!myScope.scope) return '…';
      const names = myScope.scope.myBarns.map((barn) => barn.name);
      return names.length ? names.join(', ') : 'Chưa được giao khu';
    }
    if (currentUser.role === 'GROOM') return 'Ngựa được giao';
    if (currentUser.role === 'HORSE_OWNER') return 'Ngựa sở hữu';
    return 'Toàn câu lạc bộ';
  })();

  const signOut = async (to = '/') => {
    await logout();
    navigate(to);
  };

  return (
    <div className="flex h-dvh bg-canvas font-sans">
      <TopProgress />
      {/* Sidebar máy tính — thu gọn được thành rail icon */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col bg-white border-r border-gray-200/80 py-5 transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[72px] px-2' : 'w-60 px-3',
        )}
      >
        <div className="mb-6">
          <Brand collapsed={collapsed} />
        </div>
        <NavList groups={groups} collapsed={collapsed} />
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          {!collapsed && (
            <div className="flex items-center gap-3 px-1">
              <Avatar name={currentUser?.name ?? '?'} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{currentUser?.name}</p>
                <p className="truncate text-xs text-gray-500">{currentUser ? roleLabel[currentUser.role] : ''}</p>
                {currentUser?.role !== 'CLUB_MANAGER' && currentUser?.role !== 'VETERINARIAN' && (
                  <p className="truncate text-xs text-gray-400" title={scope}>
                    Phạm vi: {scope}
                  </p>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              'flex items-center gap-2 rounded-xl text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700',
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
              onClick={() => signOut()}
              className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-gray-200/80 bg-white/70 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 lg:hidden"
              aria-label="Mở menu"
            >
              <Menu size={18} />
            </button>
            <Breadcrumbs groups={groups} />
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
                  className="anim-pop z-50 w-56 rounded-2xl bg-white p-1.5 shadow-float ring-1 ring-gray-200"
                >
                  <Dropdown.Item
                    onSelect={() => navigate(links.profile)}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-700 outline-none data-[highlighted]:bg-gray-100"
                  >
                    Hồ sơ cá nhân
                  </Dropdown.Item>
                  <Dropdown.Item
                    onSelect={() => signOut('/login')}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-700 outline-none data-[highlighted]:bg-gray-100"
                  >
                    Đổi tài khoản
                  </Dropdown.Item>
                  <Dropdown.Separator className="my-1 h-px bg-gray-100" />
                  <Dropdown.Item
                    onSelect={() => signOut()}
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
            {/* Lỗi một trang không làm trắng cả ứng dụng; trang chưa tải xong thì hiện khung chờ. */}
            <RouteErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
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
