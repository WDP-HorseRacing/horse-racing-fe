// Quản lý tài khoản — chỉ Club Manager gọi được.
import { fetchAll, http } from './http';
import type { Page, Role, UserAccount, UserStatus } from './types';

export const listUsers = (query: { role?: Role; status?: UserStatus; search?: string; page?: number; limit?: number } = {}) =>
  http.get<Page<UserAccount>>('/users', query);
export const listAllUsers = (query: { role?: Role; status?: UserStatus } = {}) => fetchAll<UserAccount>('/users', query);
export const createUser = (input: { fullName: string; email: string; role: Role; password: string }) =>
  http.post<UserAccount>('/users', input);
export const updateUser = (id: string, input: { fullName?: string; role?: Role }) => http.patch<UserAccount>(`/users/${id}`, input);
export const setUserStatus = (id: string, status: UserStatus) => http.patch<UserAccount>(`/users/${id}/status`, { status });
