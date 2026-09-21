// Trạng thái phiên làm việc. Dữ liệu nghiệp vụ không nằm ở đây —
// mọi màn hình lấy qua `services/*` bằng hook useService.
import { create } from 'zustand';
import type { AppNotification, User } from '../types/domain';
import { getCurrentUser, setCurrentUser } from '../services/api';
import { login as loginService, logout as logoutService } from '../services/auth.service';
import { readNotificationsSync } from '../services/system.service';
import { subscribe } from '../services/db';

interface AppState {
  currentUser: User | null;
  isAuthenticated: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  login: (email: string, password: string) => Promise<User>;
  switchUser: (userId: string) => void;
  logout: () => void;
  refresh: () => void;
}

export const useStore = create<AppState>((set) => ({
  currentUser: getCurrentUser(),
  isAuthenticated: !!getCurrentUser(),
  notifications: readNotificationsSync(),
  unreadCount: readNotificationsSync().filter((item) => !item.readAt).length,

  login: async (email, password) => {
    const user = await loginService(email, password);
    const notifications = readNotificationsSync();
    set({
      currentUser: user,
      isAuthenticated: true,
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
    });
    return user;
  },

  switchUser: (userId) => {
    setCurrentUser(userId);
    const user = getCurrentUser();
    const notifications = readNotificationsSync();
    set({
      currentUser: user,
      isAuthenticated: !!user,
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
    });
  },

  logout: () => {
    logoutService();
    set({ currentUser: null, isAuthenticated: false, notifications: [], unreadCount: 0 });
  },

  refresh: () => {
    const user = getCurrentUser();
    const notifications = readNotificationsSync();
    set({
      currentUser: user,
      isAuthenticated: !!user,
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
    });
  },
}));

// Kho dữ liệu đổi (kể cả từ tab khác) thì chuông thông báo cập nhật theo.
subscribe(() => useStore.getState().refresh());
