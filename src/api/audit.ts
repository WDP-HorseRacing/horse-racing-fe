// Nhật ký thao tác (chỉ Quản lý CLB): ai làm gì, lúc nào, với đối tượng nào. Mới nhất trước.
// Ngày lọc from, to là 'YYYY-MM-DD' theo lịch CLB, lấy trọn ngày. from sau to thì BE trả 400.
import { http } from './http';
import type { UserRole } from '../types/domain';
import type { Page } from './types';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'RESTORE';

export interface AuditLog {
  id: string;
  createdAt: string;
  /** null khi hệ thống tự làm. */
  actor: { id: string; fullName: string; role: UserRole | null } | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  reason: string | null;
  /** Tên chức năng (vd MED_HEALTH), null với dòng cũ không ghi. */
  feature: string | null;
}

export interface AuditLogDetail extends AuditLog {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export type AuditQuery = {
  page?: number;
  limit?: number;
  actorId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
};

export const listAuditLogs = (query: AuditQuery) => http.get<Page<AuditLog>>('/audit-logs', query);
export const getAuditLog = (id: string) => http.get<AuditLogDetail>(`/audit-logs/${id}`);
