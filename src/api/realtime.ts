// Thông báo realtime qua Socket.IO (namespace /events). BE chưa có API đọc lại
// thông báo, nên chuông chỉ hiện những gì nhận được từ lúc đăng nhập.
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from './http';
import { getTokens, onTokensChange } from './tokens';
import type { LiveNotificationPayload } from './types';

let socket: Socket | null = null;
let handler: ((payload: LiveNotificationPayload) => void) | undefined;

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
  socket.on('notification.created', (payload: LiveNotificationPayload) => handler?.(payload));
}

function disconnect() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/** Bắt đầu nghe thông báo; tự nối lại khi token được làm mới, tự ngắt khi đăng xuất. */
export function startRealtime(onNotification: (payload: LiveNotificationPayload) => void) {
  handler = onNotification;
  connect();
  const stop = onTokensChange((tokens) => (tokens ? connect() : disconnect()));
  return () => {
    stop();
    disconnect();
  };
}
