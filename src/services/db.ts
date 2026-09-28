// Kho dữ liệu duy nhất của ứng dụng.
// Hiện lưu ở localStorage; khi nối BE chỉ cần thay phần ruột của các service, không đụng tới component.
import type { BaseEntity, Database } from '../types/domain';
import { buildSeed } from './seed';

const STORAGE_KEY = 'horseracing_db_v1';
const SCHEMA = 3;

type Listener = () => void;

let cache: Database | null = null;
const listeners = new Set<Listener>();

function read(): Database | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Database;
    if (!parsed?.meta || parsed.meta.schema !== SCHEMA) return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(db: Database) {
  cache = db;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Hết dung lượng: vẫn giữ bản trong bộ nhớ để phiên làm việc không gãy.
  }
}

export function getDb(): Database {
  if (cache) return cache;
  const stored = read();
  if (stored) {
    cache = stored;
    return stored;
  }
  const fresh = buildSeed(new Date(), SCHEMA);
  write(fresh);
  return fresh;
}

/** Đọc lại từ localStorage (dùng khi tab khác vừa ghi). */
export function refreshFromStorage() {
  const stored = read();
  if (stored) {
    cache = stored;
    listeners.forEach((listener) => listener());
  }
}

export function mutate<T>(fn: (db: Database) => T): T {
  const db = getDb();
  const result = fn(db);
  write(db);
  listeners.forEach((listener) => listener());
  return result;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyChanged() {
  listeners.forEach((listener) => listener());
}

export function resetDatabase(now: Date) {
  write(buildSeed(now, SCHEMA));
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) refreshFromStorage();
  });
}

/* ===== Tiện ích bản ghi ===== */

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function stamp(now: Date): Pick<BaseEntity, 'createdAt' | 'updatedAt' | 'version'> {
  const iso = now.toISOString();
  return { createdAt: iso, updatedAt: iso, version: 1 };
}

export function touch<T extends BaseEntity>(entity: T, now: Date): T {
  entity.updatedAt = now.toISOString();
  entity.version += 1;
  return entity;
}

/** Lỗi nghiệp vụ có thông báo tiếng Việt, hiển thị thẳng cho người dùng. */
export class AppError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'AppError';
    this.field = field;
  }
}

export const ERR_FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này';
export const ERR_NOT_FOUND = 'Không tìm thấy dữ liệu';
export const ERR_CONFLICT = 'Dữ liệu vừa được người khác thay đổi, vui lòng tải lại';
