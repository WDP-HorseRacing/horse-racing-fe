import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Bell,
  BookOpenCheck,
  CalendarRange,
  Flag,
  Layers,
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
import { roleLabel, roleShortLabel } from '../lib/labels';
import { DEFAULT_FAVICON, faviconHref, roleCssVars, roleTheme } from '../lib/role-theme';
import { links } from '../lib/links';
import { notificationTarget } from '../lib/notification-target';
import { useMyScope } from '../hooks/useMyScope';
import { formatRelative } from '../lib/format';
import { now } from '../lib/clock';
import { playAlertBeep } from '../lib/sound';
import type { UserRole } from '../types/domain';
import { FEATURES } from '../config/features';
import { prefersReducedMotion } from '../lib/motion';

interface NavItem {
  name: string;
  path: string;
  icon: typeof Bell;
}

interface NavGroup {
  group?: string;
  items: NavItem[];
}

// Menu theo vai trò. Nhóm Huấn luyện (Flow 2) đọc cờ trong config/features.ts.
function menuFor(role: UserRole | undefined): NavGroup[] {
  return menuGroups(role).filter((group) => group.items.length > 0);
}

function menuGroups(role: UserRole | undefined): NavGroup[] {
  const medical = (items: NavItem[]): NavGroup => ({ group: 'Y tế', items });
  const training = (items: NavItem[]): NavGroup => ({ group: 'Huấn luyện', items: FEATURES.training ? items : [] });
  const classesItem: NavItem = { name: 'Lớp huấn luyện', path: links.classes, icon: Layers };
  const plansItem: NavItem = { name: 'Giáo án', path: links.plans, icon: CalendarRange };
  const subjectsItem: NavItem = { name: 'Môn học', path: links.subjects, icon: BookOpenCheck };
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
        training([classesItem, plansItem, subjectsItem]),
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
        training([{ name: 'Hôm nay trên sân', path: links.today, icon: Flag }, classesItem, plansItem, subjectsItem]),
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
        training([classesItem]),
      ];
    case 'GROOM':
      return [
        {
          items: [
            { name: 'Việc hôm nay', path: links.dashboard, icon: LayoutDashboard },
            ...(FEATURES.training ? [{ name: 'Dắt ngựa tập', path: links.today, icon: Flag }] : []),
          ],
        },
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
  const loaded = useStore((state) => state.notificationsLoaded);
  const cursor = useStore((state) => state.notificationCursor);
  const loadMore = useStore((state) => state.loadMoreNotifications);
  const markRead = useStore((state) => state.markRead);
  const markAllRead = useStore((state) => state.markAllRead);
  const role = useStore((state) => state.currentUser?.role);
  const [open, setOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  // Cảnh báo khẩn mới đến hiện thông báo nổi kèm tiếng bíp ngắn. Thông báo cũ tải lúc vào phiên thì không.
  useEffect(() => {
    if (!loaded) return;
    const urgent = notifications.filter((item) => item.priority === 'URGENT' && !item.readAt);
    if (!primed.current) {
      urgent.forEach((item) => seen.current.add(item.id));
      primed.current = true;
      return;
    }
    const fresh = urgent.filter((item) => !seen.current.has(item.id));
    fresh.forEach((item) => {
      seen.current.add(item.id);
      toast.push(`${item.title}. ${item.message}`, 'error');
    });
    if (fresh.length > 0) playAlertBeep();
  }, [notifications, loaded, toast]);

  const more = async () => {
    setLoadingMore(true);
    try {
      await loadMore();
    } catch {
      toast.push('Không tải được thông báo cũ hơn', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

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
              {unread > 99 ? '99+' : unread}
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
              <p className="px-4 py-10 text-center text-sm font-light text-gray-400">{loaded ? 'Chưa có thông báo nào.' : 'Đang tải thông báo…'}</p>
            )}
            {notifications.map((item) => {
              const target = notificationTarget(item, role);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    markRead(item.id);
                    if (!target) return;
                    setOpen(false);
                    navigate(target);
                  }}
                  className={cn(
                    'flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition last:border-0 hover:bg-gray-50',
                    item.readAt && 'opacity-55',
                    !target && 'cursor-default',
                  )}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', notificationTone[item.priority].dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block text-sm font-semibold text-gray-800">{item.title}</span>
                      {item.priority !== 'NORMAL' && (
                        <span
                          className={cn(
                            'rounded-md px-1.5 text-[10px] font-semibold',
                            item.priority === 'URGENT' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700',
                          )}
                        >
                          {notificationTone[item.priority].label}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs font-light text-gray-500">{item.message}</span>
                    <span className="mt-1 block text-[11px] text-gray-400">{formatRelative(item.createdAt, now())}</span>
                  </span>
                </button>
              );
            })}
            {cursor && (
              <button
                type="button"
                onClick={more}
                disabled={loadingMore}
                className="w-full px-4 py-2.5 text-center text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
              >
                {loadingMore ? 'Đang tải…' : 'Xem thông báo cũ hơn'}
              </button>
            )}
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
              <p className="mb-1 px-3 text-xs font-medium text-gray-400">{group.group}</p>
            ))}
          {group.items.map((item) => {
            // className phải là chuỗi: Tooltip.Trigger (asChild) ghép class bằng nối chuỗi nên làm hỏng className dạng hàm.
            // Mục đang mở nhận aria-current="page" từ NavLink, tô màu bằng biến thể aria-[current=page].
            // Mục đang chọn mang màu vai trò (biến --role đặt ở khung ngoài): nền nhạt, vạch trái, icon cùng màu.
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
                  'group flex items-center gap-3 rounded-lg text-sm font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900',
                  'aria-[current=page]:bg-(--role-soft) aria-[current=page]:font-semibold aria-[current=page]:text-gray-900 aria-[current=page]:shadow-[inset_3px_0_0_0_var(--role)]',
                  collapsed ? 'mx-auto h-10 w-10 justify-center' : 'px-3 py-2',
                )}
              >
                <item.icon size={17} className="shrink-0 group-aria-[current=page]:text-(--role)" />
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

/** Logo trong ứng dụng mang màu vai trò đang đăng nhập. */
function Brand({ collapsed, role }: { collapsed: boolean; role?: UserRole }) {
  const theme = role ? roleTheme[role] : undefined;
  return (
    <Link to={links.dashboard} className={cn('flex items-center gap-2.5', collapsed ? 'justify-center' : 'px-1')}>
      <Logo size={36} withText={!collapsed} color={theme?.color} shadow={theme?.shadow} />
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

  // Favicon đổi màu theo vai trò: mở nhiều tab khi demo, nhìn icon tab là biết tab của vai trò nào.
  const role = currentUser?.role;
  useEffect(() => {
    if (!role) return;
    const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!icon) return;
    icon.href = faviconHref(roleTheme[role].color);
    return () => {
      icon.href = DEFAULT_FAVICON;
    };
  }, [role]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Trình duyệt chặn lưu trữ: chỉ mất ghi nhớ trạng thái thu gọn.
    }
  }, [collapsed]);

  useEffect(() => {
    const container = document.getElementById('main-scroll');
    // Người dùng bật giảm chuyển động: cuộn thường, không cuộn mượt.
    if (!container || prefersReducedMotion()) return;
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
    <div className="flex h-dvh bg-canvas font-sans" style={role ? roleCssVars(role) : undefined}>
      <TopProgress />
      {/* Sidebar máy tính — thu gọn được thành rail icon */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col bg-white border-r border-gray-200/80 py-5 transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[72px] px-2' : 'w-60 px-3',
        )}
      >
        <div className="mb-6">
          <Brand collapsed={collapsed} role={role} />
        </div>
        <NavList groups={groups} collapsed={collapsed} />
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          {!collapsed && (
            <div className="flex items-center gap-3 px-1">
              <Avatar name={currentUser?.name ?? '?'} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{currentUser?.name}</p>
                <p className="truncate text-xs font-medium text-(--role)">{currentUser ? roleLabel[currentUser.role] : ''}</p>
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
              <Brand collapsed={false} role={role} />
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
            <Breadcrumbs groups={groups} titlePrefix={role ? roleShortLabel[role] : undefined} />
          </div>
          <div className="flex items-center gap-2.5">
            {role && (
              <span className="hidden h-8 items-center gap-1.5 rounded-lg bg-(--role-soft) px-2.5 text-xs font-semibold text-(--role) ring-1 ring-(--role-ring) sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-(--role)" aria-hidden />
                {roleLabel[role]}
              </span>
            )}
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
                  <div className="px-3 pb-2 pt-1.5">
                    <p className="truncate text-sm font-semibold text-gray-900">{currentUser?.name}</p>
                    <p className="truncate text-xs font-medium text-(--role)">{role ? roleLabel[role] : ''}</p>
                  </div>
                  <Dropdown.Separator className="mb-1 h-px bg-gray-100" />
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
