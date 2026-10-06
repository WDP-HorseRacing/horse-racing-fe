// Thông báo realtime qua Socket.IO (namespace /events). Lịch sử thông báo tải qua REST (notifications.ts),
// socket chỉ đẩy thông báo mới, cùng một dạng với REST.
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from './http';
import { getTokens, onTokensChange } from './tokens';
import type { NotificationItem } from './types';

let socket: Socket | null = null;
let handler: ((payload: NotificationItem) => void) | undefined;

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
}

function disconnect() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/** Bắt đầu nghe thông báo; tự nối lại khi token được làm mới, tự ngắt khi đăng xuất. */
export function startRealtime(onNotification: (payload: NotificationItem) => void) {
  handler = onNotification;
  connect();
  const stop = onTokensChange((tokens) => (tokens ? connect() : disconnect()));
  return () => {
    stop();
    disconnect();
  };
}
