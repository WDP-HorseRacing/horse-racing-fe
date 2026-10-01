// Phạm vi khu của người đang đăng nhập, dùng chung cho thanh bên, Hồ sơ cá nhân, Bệnh án.
// Chỉ HT cần tải (barns + stalls); kết quả nhớ ở mức module 60 giây, các trang đã tải barns/stalls
// thì nạp sẵn bằng primeZoneScope để thanh bên cập nhật ngay sau khi CM đổi HT.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { listBarns, listStalls } from '../api/stable';
import type { BarnListItem, Stall } from '../api/types';
import { onTokensChange } from '../api/tokens';
import { computeZoneScope, type ZoneScope } from '../lib/zone-scope';
import { useStore } from '../store/store';

const TTL = 60_000;

interface Entry {
  userId: string;
  at: number;
  data?: { barns: BarnListItem[]; stalls: Stall[] };
  error?: string;
  promise?: Promise<void>;
}

let entry: Entry | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function fetchScope(userId: string, force = false) {
  const fresh = entry && entry.userId === userId && Date.now() - entry.at < TTL;
  if (!force && entry?.userId === userId && (entry.promise || (fresh && (entry.data || entry.error)))) return;
  const promise = Promise.all([listBarns(), listStalls()])
    .then(([barns, stalls]) => {
      if (entry?.promise !== promise) return;
      entry = { userId, at: Date.now(), data: { barns, stalls } };
      emit();
    })
    .catch((error: unknown) => {
      if (entry?.promise !== promise) return;
      entry = { userId, at: Date.now(), data: entry?.data, error: error instanceof Error ? error.message : 'Không tải được phạm vi khu' };
      emit();
    });
  entry = { userId, at: entry?.userId === userId ? entry.at : 0, data: entry?.userId === userId ? entry.data : undefined, promise };
  emit();
}

/** Trang nào đã tải barns + stalls thì đưa vào đây để các nơi khác dùng lại ngay. */
export function primeZoneScope(userId: string, barns: BarnListItem[], stalls: Stall[]) {
  entry = { userId, at: Date.now(), data: { barns, stalls } };
  emit();
}

export function invalidateZoneScope() {
  entry = null;
  emit();
}

onTokensChange((tokens) => {
  if (!tokens) invalidateZoneScope();
});

export function useMyScope(): { scope?: ZoneScope; loading: boolean; error?: string; reload: () => void } {
  const user = useStore((state) => state.currentUser);
  const trainer = user?.role === 'HEAD_TRAINER';
  const snapshot = useSyncExternalStore(subscribe, () => entry);

  useEffect(() => {
    if (trainer && user) fetchScope(user.id);
  }, [trainer, user, snapshot]);

  const mine = snapshot && user && snapshot.userId === user.id ? snapshot : null;
  const data = mine?.data;
  const scope = useMemo(() => {
    if (!user) return undefined;
    if (!trainer) return computeZoneScope(user, [], []);
    return data ? computeZoneScope(user, data.barns, data.stalls) : undefined;
  }, [user, trainer, data]);

  const reload = useCallback(() => {
    if (trainer && user) fetchScope(user.id, true);
  }, [trainer, user]);

  return { scope, loading: trainer && !data && !mine?.error, error: data ? undefined : mine?.error, reload };
}
