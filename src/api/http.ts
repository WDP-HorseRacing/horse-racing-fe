// Gọi REST API của backend: gắn token, tự làm mới token một lần khi hết hạn,
// đổi lỗi của BE ({ code, message, details, errors }) thành ApiError có câu tiếng Việt.
import { ApiError, humanizeMessage } from '../lib/errors';
import { clearTokens, getTokens, setTokens } from './tokens';
import type { Page } from './types';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'http://localhost:3000/events';

type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** false cho đăng nhập / làm mới token. */
  auth?: boolean;
}

let onUnauthorized: (() => void) | undefined;

/** Store đăng ký hàm đăng xuất khi phiên hết hạn hẳn (không làm mới được). */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_URL}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        if (!response.ok) return false;
        setTokens(await response.json());
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** Câu dự phòng khi BE không trả message (lỗi mạng, proxy…). */
function fallbackMessage(status: number) {
  if (status === 0) return 'Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.';
  if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này';
  if (status === 404) return 'Không tìm thấy dữ liệu';
  if (status === 409) return 'Dữ liệu vừa thay đổi, vui lòng tải lại';
  if (status === 429) return 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút';
  if (status === 501) return 'Chức năng này backend chưa làm';
  if (status >= 500) return 'Máy chủ gặp lỗi, vui lòng thử lại sau';
  return 'Yêu cầu không hợp lệ';
}

async function send(method: string, path: string, options: RequestOptions, retried = false): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const tokens = options.auth === false ? null : getTokens();
  if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, fallbackMessage(0));
  }

  if (response.status === 401 && options.auth !== false && !retried) {
    if (await refreshTokens()) return send(method, path, options, true);
    clearTokens();
    onUnauthorized?.();
  }
  return response;
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(method, path, options);
  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    // Bị giới hạn tần suất: câu của máy chủ thường là tiếng Anh, dùng câu tiếng Việt thống nhất.
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after'));
      throw new ApiError(429, wait > 0 ? `Bạn thao tác quá nhanh, vui lòng thử lại sau ${Math.ceil(wait)} giây` : fallbackMessage(429));
    }
    const body = (data && typeof data === 'object' ? data : {}) as {
      message?: string | string[];
      details?: string[] | null;
      errors?: { field?: string; message?: string }[];
    };
    let message = Array.isArray(body.message) ? body.message.join('. ') : body.message;
    const details = body.details ?? null;
    if (message === 'Validation failed') {
      message = details?.length ? `Dữ liệu chưa hợp lệ: ${details.join('. ')}` : 'Dữ liệu chưa hợp lệ';
    }
    // Lỗi 400 có thể kèm `errors` theo từng ô: màn hình gắn câu lỗi ngay dưới ô đó.
    const fieldErrors: Record<string, string> = {};
    for (const item of body.errors ?? []) {
      if (item.field && item.message && !fieldErrors[item.field]) fieldErrors[item.field] = humanizeMessage(item.message);
    }
    // 422 chỉ dùng cho số đo ngoài khoảng bình thường chưa xác nhận: màn hình hỏi lại người dùng.
    const field = response.status === 422 ? 'confirmAbnormal' : Object.keys(fieldErrors)[0];
    throw new ApiError(response.status, humanizeMessage(message || fallbackMessage(response.status)), details, field, fieldErrors);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>('POST', path, { body: body ?? {}, query }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
};

/** Lấy hết mọi trang của một danh sách phân trang (BE giới hạn 100 bản ghi mỗi trang). */
export async function fetchAll<T>(path: string, query: Query = {}, maxPages = 20): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await http.get<Page<T>>(path, { ...query, page, limit: 100 });
    items.push(...result.items);
    if (page >= result.meta.totalPages) break;
  }
  return items;
}
