// Trạng thái phiên làm việc: người dùng đăng nhập và thông báo.
// Dữ liệu nghiệp vụ không nằm ở đây. Màn hình gọi src/api/* qua hook useService.
import { create } from 'zustand';
import type { User, UserRole } from '../types/domain';
import { exchangeOidcCode, getMe, login as apiLogin, logout as apiLogout, type OidcCallbackQuery } from '../api/auth';
import { setUnauthorizedHandler } from '../api/http';
import { startRealtime } from '../api/realtime';
import { getUnreadNotificationCount, listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { clearTokens, getTokens, onOtherTabTokensChange } from '../api/tokens';
import type { CurrentUser, NotificationItem } from '../api/types';

/** Số thông báo mỗi lần tải. */
const NOTIFICATION_PAGE = 20;

/** Lý do phiên kết thúc mà người dùng không bấm đăng xuất ở tab này. */
export type SessionEnd = 'expired' | 'elsewhere';

interface AppState {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** Đang kiểm tra phiên đã lưu lúc mở trang. */
  booting: boolean;
  /** Phiên vừa kết thúc ngoài ý muốn — màn đăng nhập hiện lời nhắn tương ứng. */
  sessionEnded: SessionEnd | null;
  /** Thông báo mới nhất lên trên: trang đầu tải lúc vào phiên, socket thêm thông báo mới. */
  notifications: NotificationItem[];
  /** Số chưa đọc do máy chủ đếm (gồm cả thông báo chưa tải về). */
  unreadCount: number;
  /** Cursor để tải thêm thông báo cũ hơn, null khi đã hết. */
  notificationCursor: string | null;
  /** Trang đầu đã tải xong (để không bật cảnh báo khẩn cho thông báo cũ). */
  notificationsLoaded: boolean;
  loadMoreNotifications: () => Promise<void>;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  /** Hoàn tất đăng nhập Google: đổi mã Keycloak lấy token rồi vào phiên. */
  loginWithOidc: (provider: 'google', query: OidcCallbackQuery) => Promise<User>;
  logout: () => Promise<void>;
  /** Tải lại thông tin tài khoản (sau khi đổi tên, đổi vai trò…). */
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const ROLE_PRIORITY: UserRole[] = ['CLUB_MANAGER', 'VETERINARIAN', 'HEAD_TRAINER', 'GROOM', 'HORSE_OWNER'];

/** Đổi tài khoản của BE sang kiểu User dùng chung của giao diện. */
function toUser(me: CurrentUser): User {
  const roles = me.roles.filter((role): role is UserRole => (ROLE_PRIORITY as string[]).includes(role));
  const role = me.role && roles.includes(me.role) ? me.role : (ROLE_PRIORITY.find((item) => roles.includes(item)) ?? me.role ?? 'HORSE_OWNER');
  return {
    id: me.userId,
    name: me.fullName,
    email: me.email,
    phone: '',
    role,
    roles,
    avatar: '',
    active: me.status === 'ACTIVE',
    createdAt: '',
    updatedAt: '',
    version: 0,
  };
}

let stopRealtime: (() => void) | undefined;
/** Tăng mỗi lần mở hoặc đóng phiên: phản hồi của phiên cũ đến muộn thì bỏ qua. */
let sessionSeq = 0;
/** Gán khi tạo store, dùng ở trình nghe sự kiện quay lại tab bên dưới. */
let refreshUnreadCount: () => void = () => undefined;

const EMPTY_NOTIFICATIONS = { notifications: [], unreadCount: 0, notificationCursor: null, notificationsLoaded: false };

export const useStore = create<AppState>((set, get) => {
  /** Mở socket rồi tải trang đầu và số chưa đọc từ máy chủ. */
  const startNotifications = () => {
    stopRealtime?.();
    const seq = ++sessionSeq;
    stopRealtime = startRealtime((payload) => {
      if (seq !== sessionSeq) return;
      const state = get();
      if (state.notifications.some((item) => item.id === payload.id)) return;
      set({ notifications: [payload, ...state.notifications], unreadCount: state.unreadCount + (payload.readAt ? 0 : 1) });
    });
    void Promise.all([listNotifications({ limit: NOTIFICATION_PAGE }), getUnreadNotificationCount()])
      .then(([page, unread]) => {
        if (seq !== sessionSeq) return;
        // Giữ thông báo socket vừa đẩy tới trong lúc đang tải trang đầu.
        const loaded = new Set(page.items.map((item) => item.id));
        const fresh = get().notifications.filter((item) => !loaded.has(item.id));
        set({ notifications: [...fresh, ...page.items], unreadCount: unread.count, notificationCursor: page.nextCursor, notificationsLoaded: true });
      })
      .catch(() => {
        if (seq === sessionSeq) set({ notificationsLoaded: true });
      });
  };

  /** Hỏi lại số chưa đọc (khi quay lại tab, hoặc đánh dấu đã đọc thất bại). */
  const refreshUnread = () => {
    const seq = sessionSeq;
    void getUnreadNotificationCount()
      .then((unread) => {
        if (seq === sessionSeq) set({ unreadCount: unread.count });
      })
      .catch(() => undefined);
  };
  refreshUnreadCount = refreshUnread;

  /** Đã có token: lấy tài khoản rồi mở phiên. Tài khoản chưa được cấp / bị khóa thì bỏ token. */
  const enterSession = async () => {
    try {
      const user = toUser(await getMe());
      set({ currentUser: user, isAuthenticated: true, booting: false, sessionEnded: null, ...EMPTY_NOTIFICATIONS });
      startNotifications();
      return user;
    } catch (caught) {
      clearTokens();
      throw caught;
    }
  };

  const clearSession = () => {
    stopRealtime?.();
    stopRealtime = undefined;
    sessionSeq += 1;
    set({ currentUser: null, isAuthenticated: false, ...EMPTY_NOTIFICATIONS });
  };

  return {
    currentUser: null,
    isAuthenticated: false,
    booting: !!getTokens(),
    sessionEnded: null,
    ...EMPTY_NOTIFICATIONS,

    loadMoreNotifications: async () => {
      const cursor = get().notificationCursor;
      if (!cursor) return;
      const seq = sessionSeq;
      const page = await listNotifications({ limit: NOTIFICATION_PAGE, cursor });
      if (seq !== sessionSeq) return;
      const known = new Set(get().notifications.map((item) => item.id));
      set({ notifications: [...get().notifications, ...page.items.filter((item) => !known.has(item.id))], notificationCursor: page.nextCursor });
    },

    bootstrap: async () => {
      if (!getTokens()) {
        set({ booting: false });
        return;
      }
      try {
        const user = toUser(await getMe());
        set({ currentUser: user, isAuthenticated: true, booting: false, sessionEnded: null, ...EMPTY_NOTIFICATIONS });
        startNotifications();
      } catch {
        clearSession();
        set({ booting: false });
      }
    },

    login: async (email, password) => {
      await apiLogin(email.trim(), password);
      return enterSession();
    },

    loginWithOidc: async (provider, query) => {
      await exchangeOidcCode(provider, query);
      return enterSession();
    },

    logout: async () => {
      clearSession();
      set({ sessionEnded: null });
      await apiLogout();
    },

    refresh: async () => {
      if (!getTokens()) return;
      const user = toUser(await getMe());
      set({ currentUser: user });
    },

    // Đánh dấu ngay trên giao diện rồi mới gọi máy chủ. Lỗi thì hỏi lại số chưa đọc cho đúng.
    markRead: (id) => {
      const target = get().notifications.find((item) => item.id === id);
      if (!target || target.readAt) return;
      const at = new Date().toISOString();
      set({
        notifications: get().notifications.map((item) => (item.id === id ? { ...item, readAt: at } : item)),
        unreadCount: Math.max(0, get().unreadCount - 1),
      });
      void markNotificationRead(id).catch(refreshUnread);
    },

    markAllRead: () => {
      const at = new Date().toISOString();
      set({ notifications: get().notifications.map((item) => (item.readAt ? item : { ...item, readAt: at })), unreadCount: 0 });
      void markAllNotificationsRead().catch(refreshUnread);
    },
  };
});

/** Kết thúc phiên ở tab này mà không gọi đăng xuất phía máy chủ. ProtectedRoute sẽ đưa về /login. */
function endSession(reason: SessionEnd) {
  const state = useStore.getState();
  if (!state.isAuthenticated) return;
  stopRealtime?.();
  stopRealtime = undefined;
  sessionSeq += 1;
  useStore.setState({ currentUser: null, isAuthenticated: false, sessionEnded: reason, ...EMPTY_NOTIFICATIONS });
}

// Phiên hết hạn hẳn (không làm mới được token) thì đưa về màn đăng nhập.
setUnauthorizedHandler(() => endSession('expired'));

// Đồng bộ nhiều tab: tab khác đăng xuất thì tab này cũng thoát; tab khác đăng nhập thì tab này vào luôn.
onOtherTabTokensChange((tokens) => {
  const state = useStore.getState();
  if (!tokens && state.isAuthenticated) endSession('elsewhere');
  else if (tokens && !state.isAuthenticated && !state.booting) void state.bootstrap();
});

// Quay lại tab sau một lúc: hỏi máy chủ ngay để biết phiên còn sống, thay vì đợi thao tác kế tiếp mới lỗi.
let lastCheck = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const state = useStore.getState();
    if (!state.isAuthenticated || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    void state.refresh().catch(() => undefined);
    // Thông báo đến lúc tab đang ẩn có thể bị lỡ nếu socket rớt: đếm lại số chưa đọc.
    refreshUnreadCount();
  });
}
