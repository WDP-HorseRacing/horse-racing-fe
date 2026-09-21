import type { User } from '../types/domain';
import { AppError, getDb } from './db';
import { delay, getCurrentUser, setCurrentUser } from './api';

export const SHARED_PASSWORD = '123456';

export function listAccounts(): User[] {
  return getDb().users.filter((user) => user.active);
}

export async function login(email: string, password: string): Promise<User> {
  await delay(null);
  const user = getDb().users.find(
    (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!user) throw new AppError('Email không tồn tại trong hệ thống', 'email');
  if (!user.active) throw new AppError('Tài khoản đã bị khóa', 'email');
  if (password !== SHARED_PASSWORD) throw new AppError('Mật khẩu không đúng', 'password');
  setCurrentUser(user.id);
  return user;
}

export function logout() {
  setCurrentUser(null);
}

export { getCurrentUser };
