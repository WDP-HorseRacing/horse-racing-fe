// Tên người từ id. BE chỉ trả id (vetId, requestedBy, assignedTo…), và chỉ Club Manager
// liệt kê được tài khoản. CM: tải danh sách một lần rồi dùng lại; vai trò khác: biết chính mình
// và những người màn hình truyền vào (ví dụ Groom của ngựa), còn lại dùng tên chung trung tính.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAllUsers } from '../../../api/users';
import type { UserAccount } from '../../../api/types';
import { useStore } from '../../../store/store';

type PersonLike = { id: string; fullName: string } | null | undefined;
export type PersonKind = 'vet' | 'staff';

let cache: Promise<UserAccount[]> | null = null;

function loadUsers(): Promise<UserAccount[]> {
  if (!cache) {
    cache = listAllUsers().catch(() => {
      cache = null;
      return [];
    });
  }
  return cache;
}

export interface People {
  /** null/undefined → "Hệ thống". */
  name: (id: string | null | undefined, kind?: PersonKind) => string;
  isMe: (id: string | null | undefined) => boolean;
}

export function usePeople(extra: PersonLike[] = []): People {
  const user = useStore((state) => state.currentUser);
  const isManager = user?.role === 'CLUB_MANAGER';
  const [users, setUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    loadUsers().then((list) => {
      if (!cancelled) setUsers(list);
    });
    return () => {
      cancelled = true;
    };
  }, [isManager]);

  const extraKey = extra.map((person) => (person ? `${person.id}:${person.fullName}` : '')).join('|');
  const map = useMemo(() => {
    const result = new Map<string, string>();
    users.forEach((account) => result.set(account.id, account.fullName));
    extraKey
      .split('|')
      .filter(Boolean)
      .forEach((entry) => {
        const index = entry.indexOf(':');
        result.set(entry.slice(0, index), entry.slice(index + 1));
      });
    if (user) result.set(user.id, user.name);
    return result;
  }, [users, extraKey, user]);

  const name = useCallback(
    (id: string | null | undefined, kind: PersonKind = 'staff') => {
      if (!id) return 'Hệ thống';
      return map.get(id) ?? (kind === 'vet' ? 'Bác sĩ thú y' : 'Nhân viên');
    },
    [map],
  );
  const isMe = useCallback((id: string | null | undefined) => !!id && id === user?.id, [user?.id]);
  return { name, isMe };
}
