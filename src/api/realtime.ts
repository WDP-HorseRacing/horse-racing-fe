// Realtime qua Socket.IO (namespace /events). Lịch sử thông báo tải qua REST (notifications.ts),
// socket đẩy thông báo mới (cùng một dạng với REST) và điểm đo nhịp tim của lượt tập (performance.metrics).
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL, checkSession } from './http';
import { getTokens, onTokensChange } from './tokens';
import type { NotificationItem } from './types';

let socket: Socket | null = null;
let handler: ((payload: NotificationItem) => void) | undefined;
/** Phiên bị máy chủ chấm dứt (tài khoản bị khóa): store đưa về màn đăng nhập. */
let onEnded: (() => void) | undefined;
/** Các trang đang nghe sự kiện: gắn lại mỗi khi socket được tạo mới (đổi token, nối lại). */
const listeners = new Map<string, Set<(payload: unknown) => void>>();
/** Hàm đã gắn vào socket cho từng sự kiện, để gỡ đúng hàm đó (không gỡ hàm thông báo chung của notification.created). */
const bound = new Map<string, (payload: unknown) => void>();

function bind(target: Socket, event: string, set: Set<(payload: unknown) => void>) {
  const relay = (payload: unknown) => set.forEach((listener) => listener(payload));
  bound.set(event, relay);
  target.on(event, relay);
}

function connect() {
  disconnect();
  const tokens = getTokens();
  if (!tokens) return;
  socket = io(SOCKET_URL, {
    auth: { token: tokens.accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
  });
  socket.on('notification.created', (payload: NotificationItem) => handler?.(payload));
  // BE chủ động ngắt (khóa tài khoản) thì socket.io không tự nối lại: hỏi lại phiên.
  // Phiên đã bị thu hồi thì kết thúc; còn sống (vd BE khởi động lại) thì nối lại, token mới tự nối qua onTokensChange.
  socket.on('disconnect', (reason) => {
    if (reason !== 'io server disconnect') return;
    void checkSession().then((result) => {
      if (result === 'expired') onEnded?.();
      else if (result === 'error') setTimeout(connect, 5000);
    });
  });
  listeners.forEach((set, event) => bind(socket!, event, set));
}

function disconnect() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/** Bắt đầu nghe thông báo; tự nối lại khi token được làm mới, tự ngắt khi đăng xuất. `onSessionEnded`: máy chủ thu hồi phiên. */
export function startRealtime(onNotification: (payload: NotificationItem) => void, onSessionEnded?: () => void) {
  handler = onNotification;
  onEnded = onSessionEnded;
  connect();
  const stop = onTokensChange((tokens) => (tokens ? connect() : disconnect()));
  return () => {
    stop();
    disconnect();
  };
}

/** Nghe một sự kiện socket bất kỳ. Trả hàm hủy. Vẫn giữ khi socket được tạo lại. */
export function onRealtime<T>(event: string, listener: (payload: T) => void): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
    if (socket) bind(socket, event, set);
  }
  const wrapped = listener as (payload: unknown) => void;
  set.add(wrapped);
  return () => {
    const current = listeners.get(event);
    current?.delete(wrapped);
    if (current && current.size === 0) {
      listeners.delete(event);
      const relay = bound.get(event);
      bound.delete(event);
      if (relay) socket?.off(event, relay);
    }
  };
}

/** Socket đang mở (để trang hiện "Đang nhận trực tiếp"). */
export const isRealtimeConnected = () => !!socket?.connected;
