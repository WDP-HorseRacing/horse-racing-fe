// Lưu cặp token đăng nhập. Chỉ module api dùng; màn hình không đọc token trực tiếp.
const KEY = 'hr_tokens';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Thời điểm access token hết hạn (ms). */
  expiresAt: number;
}

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(input: { accessToken: string; refreshToken: string; expiresIn: number }) {
  const tokens: Tokens = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt: Date.now() + input.expiresIn * 1000,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(tokens));
  } catch {
    // Trình duyệt chặn lưu trữ: phiên chỉ sống tới khi tải lại trang.
  }
  listeners.forEach((listener) => listener(tokens));
}

export function clearTokens() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
  listeners.forEach((listener) => listener(null));
}

type Listener = (tokens: Tokens | null) => void;
const listeners = new Set<Listener>();

/** Nghe token đổi (đăng nhập, làm mới, đăng xuất) — dùng để nối lại socket, đồng bộ phiên. */
export function onTokensChange(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const otherTabListeners = new Set<Listener>();

/** Nghe token đổi do TAB KHÁC (đăng nhập, đăng xuất, làm mới) — dùng để đồng bộ phiên giữa các tab. */
export function onOtherTabTokensChange(listener: Listener) {
  otherTabListeners.add(listener);
  return () => otherTabListeners.delete(listener);
}

// Sự kiện storage chỉ bắn ở các tab KHÔNG ghi localStorage.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY && event.key !== null) return;
    const tokens = getTokens();
    listeners.forEach((listener) => listener(tokens));
    otherTabListeners.forEach((listener) => listener(tokens));
  });
}
