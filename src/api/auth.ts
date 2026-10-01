import { API_URL, http, request } from './http';
import { clearTokens, getTokens, setTokens } from './tokens';
import type { AuthTokens, CurrentUser } from './types';

export async function login(email: string, password: string) {
  const tokens = await request<AuthTokens>('POST', '/auth/login', { body: { email, password }, auth: false });
  setTokens(tokens);
  return tokens;
}

/** Địa chỉ bắt đầu đăng nhập Google: trình duyệt chuyển hẳn sang đây (BE trả 302 sang Keycloak). */
export const oidcStartUrl = (provider: 'google') => `${API_URL}/auth/oidc/${provider}`;

export interface OidcCallbackQuery {
  code: string;
  state: string;
  session_state?: string;
  iss?: string;
}

/** Đổi mã Keycloak trả về lấy cặp token (cùng dạng /auth/login). Chỉ gửi đúng các tham số BE nhận. */
export async function exchangeOidcCode(provider: 'google', query: OidcCallbackQuery) {
  const tokens = await request<AuthTokens>('GET', `/auth/oidc/${provider}/callback`, { query: { ...query }, auth: false });
  setTokens(tokens);
  return tokens;
}

export const getMe = () => http.get<CurrentUser>('/auth/me');

export async function logout() {
  const tokens = getTokens();
  clearTokens();
  if (!tokens?.refreshToken) return;
  // Thu hồi phiên phía Keycloak; lỗi ở đây không chặn việc đăng xuất trên máy.
  await request('POST', '/auth/logout', { body: { refreshToken: tokens.refreshToken }, auth: false }).catch(() => undefined);
}

export const changePassword = (currentPassword: string, newPassword: string) =>
  http.post<void>('/auth/change-password', { currentPassword, newPassword });
