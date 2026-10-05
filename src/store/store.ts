// Trạng thái phiên làm việc: người dùng đăng nhập và thông báo realtime.
// Dữ liệu nghiệp vụ không nằm ở đây — màn hình gọi src/api/* qua hook useService.
import { create } from 'zustand';
import type { AppNotification, User, UserRole } from '../types/domain';
import { exchangeOidcCode, getMe, login as apiLogin, logout as apiLogout, type OidcCallbackQuery } from '../api/auth';
import { setUnauthorizedHandler } from '../api/http';
import { startRealtime } from '../api/realtime';
import { clearTokens, getTokens, onOtherTabTokensChange } from '../api/tokens';
import type { CurrentUser, LiveNotificationPayload } from '../api/types';

/** Lý do phiên kết thúc mà người dùng không bấm đăng xuất ở tab này. */
export type SessionEnd = 'expired' | 'elsewhere';

interface AppState {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** Đang kiểm tra phiên đã lưu lúc mở trang. */
  booting: boolean;
  /** Phiên vừa kết thúc ngoài ý muốn — màn đăng nhập hiện lời nhắn tương ứng. */
  sessionEnded: SessionEnd | null;
  notifications: AppNotification[];
  unreadCount: number;
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

function toNotification(payload: LiveNotificationPayload, userId: string): AppNotification {
  return {
    id: payload.id,
    userId,
    level: payload.priority,
    title: payload.title,
    body: payload.message,
    link: payload.link,
    createdAt: payload.createdAt,
    updatedAt: payload.createdAt,
    version: 1,
  };
}

let stopRealtime: (() => void) | undefined;

export const useStore = create<AppState>((set, get) => {
  const startNotifications = (userId: string) => {
    stopRealtime?.();
    stopRealtime = startRealtime((payload) => {
      const notifications = [toNotification(payload, userId), ...get().notifications.filter((item) => item.id !== payload.id)].slice(0, 50);
      set({ notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
    });
  };

  /** Đã có token: lấy tài khoản rồi mở phiên. Tài khoản chưa được cấp / bị khóa thì bỏ token. */
  const enterSession = async () => {
    try {
      const user = toUser(await getMe());
      set({ currentUser: user, isAuthenticated: true, booting: false, sessionEnded: null, notifications: [], unreadCount: 0 });
      startNotifications(user.id);
      return user;
    } catch (caught) {
      clearTokens();
      throw caught;
    }
  };

  const clearSession = () => {
    stopRealtime?.();
    stopRealtime = undefined;
    set({ currentUser: null, isAuthenticated: false, notifications: [], unreadCount: 0 });
  };

  return {
    currentUser: null,
    isAuthenticated: false,
    booting: !!getTokens(),
    sessionEnded: null,
    notifications: [],
    unreadCount: 0,

    bootstrap: async () => {
      if (!getTokens()) {
        set({ booting: false });
        return;
      }
      try {
        const user = toUser(await getMe());
        set({ currentUser: user, isAuthenticated: true, booting: false, sessionEnded: null });
        startNotifications(user.id);
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

    markRead: (id) => {
      const notifications = get().notifications.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item));
      set({ notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
    },

    markAllRead: () => {
      const at = new Date().toISOString();
      const notifications = get().notifications.map((item) => (item.readAt ? item : { ...item, readAt: at }));
      set({ notifications, unreadCount: 0 });
    },
  };
});

/** Kết thúc phiên ở tab này mà không gọi đăng xuất phía máy chủ. ProtectedRoute sẽ đưa về /login. */
function endSession(reason: SessionEnd) {
  const state = useStore.getState();
  if (!state.isAuthenticated) return;
  stopRealtime?.();
  stopRealtime = undefined;
  useStore.setState({ currentUser: null, isAuthenticated: false, sessionEnded: reason, notifications: [], unreadCount: 0 });
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
  });
}
