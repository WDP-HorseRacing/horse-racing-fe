// Đăng nhập Google qua Keycloak (BE: GET /auth/oidc/google → Keycloak → về FE /auth/callback?code&state).
// Trang đích sau đăng nhập (`next`) không đi qua URL được (DTO callback của BE từ chối tham số lạ),
// nên giữ trong sessionStorage. Lỗi ở trang callback cũng chuyển về trang đăng nhập qua sessionStorage.
import { ApiError } from './errors';
import { safeInternalPath } from './links';

const PENDING_KEY = 'hr_oidc_pending';
const ERROR_KEY = 'hr_oidc_error';

export type OidcProvider = 'google';

interface Pending {
  provider: OidcProvider;
  next: string;
  startedAt: number;
}

function read<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Trình duyệt chặn lưu trữ: chỉ mất trang đích, vẫn đăng nhập được.
  }
}

/** Trang quay lại sau khi đăng nhập: chỉ đường dẫn nội bộ, không phải trang đăng nhập hay trang callback. */
export function safeNextPath(value: string | null | undefined) {
  const path = safeInternalPath(value);
  return path && !path.startsWith('/login') && !path.startsWith('/auth/') ? path : '/dashboard';
}

export function rememberOidc(provider: OidcProvider, next: string) {
  write(PENDING_KEY, { provider, next: safeNextPath(next), startedAt: Date.now() } satisfies Pending);
}

export const peekPendingOidc = () => read<Pending>(PENDING_KEY);
export const clearPendingOidc = () => write(PENDING_KEY, undefined);

export function setOidcError(message: string) {
  write(ERROR_KEY, message);
}

/** Lấy lời báo lỗi đăng nhập Google (một lần) để hiện trên trang đăng nhập. */
export function takeOidcError(): string | undefined {
  const message = read<string>(ERROR_KEY);
  if (message) write(ERROR_KEY, undefined);
  return message;
}

/** Câu tiếng Việt cho lỗi của Keycloak (?error=) hoặc của BE khi đổi mã lấy token. */
export function oidcErrorMessage(caught?: unknown, keycloakError?: string | null): string {
  if (keycloakError === 'access_denied') return 'Bạn đã hủy đăng nhập bằng Google.';
  if (keycloakError) return 'Google hoặc máy chủ xác thực từ chối đăng nhập. Vui lòng thử lại.';
  if (caught instanceof ApiError) {
    const text = caught.message;
    if (caught.status === 401 && /state/i.test(text)) return 'Phiên đăng nhập Google đã quá 10 phút hoặc đã được dùng. Vui lòng bấm đăng nhập lại.';
    if (caught.status === 401) return text || 'Tài khoản Google này chưa được cấp quyền vào hệ thống. Liên hệ Quản lý câu lạc bộ.';
    if (caught.status === 503) return 'Máy chủ chưa cấu hình đăng nhập Google. Dùng email và mật khẩu, hoặc báo nhóm backend.';
    if (caught.status === 400) return 'Liên kết đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.';
    if (caught.status === 0) return text;
    return text || 'Không đăng nhập được bằng Google. Vui lòng thử lại.';
  }
  return caught instanceof Error ? caught.message : 'Không đăng nhập được bằng Google. Vui lòng thử lại.';
}
