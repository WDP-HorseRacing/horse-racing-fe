// Hook dữ liệu dùng chung cho các trang huấn luyện.
// BE chưa trả tên ngựa, tên Groom kèm lượt tập và ghi danh, nên FE ghép từ danh sách ngựa và danh sách Groom (nhớ 60 giây).
import { useEffect, useMemo, useRef, useState } from 'react';
import { listAllHorses } from '../../api/horses';
import { listGroomWorkload } from '../../api/stable';
import { listAllUsers } from '../../api/users';
import { listMetrics, toMetricPoint } from '../../api/performance';
import { listClasses, listParticipants, listSessions } from '../../api/training';
import { onRealtime } from '../../api/realtime';
import { onTokensChange } from '../../api/tokens';
import type {
  GroomWorkload,
  HorseListItem,
  MetricAlertLevel,
  MetricPoint,
  MetricsSocketPayload,
  Participant,
  TrainingClass,
  TrainingSession,
  UserAccount,
} from '../../api/types';
import { useService } from '../../hooks/useService';
import { clubDateKey } from '../../lib/club-time';

/* ===== Bộ nhớ đệm nhỏ theo khóa ===== */

const TTL = 60_000;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();
onTokensChange((tokens) => {
  if (!tokens) cache.clear();
});

function cached<T>(key: string, load: () => Promise<T>, force = false): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.promise as Promise<T>;
  const promise = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** Xóa bộ nhớ đệm sau khi ghi dữ liệu làm đổi danh sách ngựa (hiếm khi cần). */
export const invalidateTrainingCache = (key?: string) => (key ? cache.delete(key) : cache.clear());

/** Mọi ngựa người xem thấy được, theo id. */
export function useHorseIndex() {
  const result = useService(() => cached('horses', () => listAllHorses()), [], { silent: true });
  const index = useMemo(() => new Map((result.data ?? []).map((horse) => [horse.id, horse])), [result.data]);
  return { index, horses: result.data ?? [], loading: result.loading, error: result.error };
}

/** Groom đang hoạt động (chỉ CM, HLV gọi được), theo id. Vai trò khác nhận Map rỗng. */
export function useGroomIndex(enabled: boolean) {
  const result = useService(
    () => (enabled ? cached('grooms', () => listGroomWorkload()) : Promise.resolve([] as GroomWorkload[])),
    [enabled],
    { silent: true },
  );
  const index = useMemo(() => new Map((result.data ?? []).map((groom) => [groom.groomId, groom])), [result.data]);
  return { index, grooms: result.data ?? [] };
}

export const horseName = (index: Map<string, HorseListItem>, id: string) => index.get(id)?.name ?? 'Ngựa';

/** Tên nhân sự theo id (chỉ Club Manager gọi được danh sách tài khoản). Vai trò khác nhận Map rỗng. */
export function useUserNames(enabled: boolean) {
  const result = useService(
    () => (enabled ? cached('users', () => listAllUsers()) : Promise.resolve([] as UserAccount[])),
    [enabled],
    { silent: true },
  );
  return useMemo(() => new Map((result.data ?? []).map((user) => [user.id, user])), [result.data]);
}

/* ===== Buổi tập trong ngày (Groom, bản Hôm nay của HLV) ===== */

export interface DayBoardItem {
  trainingClass: TrainingClass;
  session: TrainingSession;
  participants: Participant[];
}

/**
 * Các buổi đã công bố trong một ngày lịch CLB, kèm lượt tập người xem thấy được.
 * BE chưa có API "lượt của tôi theo ngày": gọi lớp, rồi buổi của từng lớp đang chạy, rồi lượt của buổi trong ngày (song song).
 */
export async function loadDayBoard(dateKey: string): Promise<DayBoardItem[]> {
  const classes = (await listClasses()).filter((item) => item.status === 'ACTIVE');
  const perClass = await Promise.all(
    classes.map(async (trainingClass) => {
      const sessions = (await listSessions(trainingClass.id)).filter(
        (session) => session.status !== 'DRAFT' && clubDateKey(session.scheduledStartAt) === dateKey,
      );
      return Promise.all(
        sessions.map(async (session) => ({ trainingClass, session, participants: await listParticipants(session.id) })),
      );
    }),
  );
  return perClass.flat().sort((a, b) => a.session.scheduledStartAt.localeCompare(b.session.scheduledStartAt));
}

/** Các buổi đã công bố trong khoảng ngày (để vẽ dải tuần cho Groom và HLV), không tải lượt. */
export async function loadSessionsBetween(from: string, to: string): Promise<{ trainingClass: TrainingClass; session: TrainingSession }[]> {
  const classes = (await listClasses()).filter((item) => item.status === 'ACTIVE');
  const perClass = await Promise.all(
    classes.map(async (trainingClass) =>
      (await listSessions(trainingClass.id))
        .filter((session) => {
          const day = clubDateKey(session.scheduledStartAt);
          return session.status !== 'DRAFT' && day >= from && day <= to;
        })
        .map((session) => ({ trainingClass, session })),
    ),
  );
  return perClass.flat();
}

/* ===== Nhịp tim, tốc độ realtime ===== */

/** Giữ tối đa chừng này điểm mỗi lượt trong bộ nhớ (15 phút với 1 điểm mỗi giây). */
const BUFFER = 900;
const RANK: Record<MetricAlertLevel, number> = { NORMAL: 0, WARNING: 1, CRITICAL: 2 };

export interface LiveSeries {
  points: MetricPoint[];
  latest?: MetricPoint;
  /** Mức cao nhất trong 10 giây gần nhất (để thẻ đổi màu rồi tự hết khi nhịp tim hạ). */
  level: MetricAlertLevel;
  /** Đã từng có điểm nguy hiểm trong lượt (để hiện băng cảnh báo cho tới khi bấm Đã xem). */
  hadCritical: boolean;
  /** Thời điểm điểm mới nhất về tới máy (để biết cảm biến còn gửi không). */
  receivedAt?: number;
}

function merge(existing: MetricPoint[], incoming: MetricPoint[]): MetricPoint[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((point) => point.recordedAt));
  const fresh = incoming.filter((point) => !seen.has(point.recordedAt));
  if (fresh.length === 0) return existing;
  const all = [...existing, ...fresh].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return all.length > BUFFER ? all.slice(all.length - BUFFER) : all;
}

function describe(points: MetricPoint[], receivedAt?: number): LiveSeries {
  const latest = points[points.length - 1];
  const cutoff = latest ? new Date(latest.recordedAt).getTime() - 10_000 : 0;
  let level: MetricAlertLevel = 'NORMAL';
  let hadCritical = false;
  for (const point of points) {
    if (point.alertLevel === 'CRITICAL') hadCritical = true;
    if (new Date(point.recordedAt).getTime() >= cutoff && RANK[point.alertLevel] > RANK[level]) level = point.alertLevel;
  }
  return { points, latest, level, hadCritical, receivedAt };
}

/**
 * Điểm đo của các lượt đang chạy trong một buổi.
 * - `socket`: HLV của lớp nhận `performance.metrics` qua socket, kèm gọi lại mỗi 15 giây phòng khi rớt kết nối.
 * - Vai trò khác (bác sĩ, CM, Groom): gọi lại `GET /metrics` mỗi 3 giây khi còn lượt đang chạy, ngừng khi tab ẩn.
 * Lượt vừa hoàn thành vẫn giữ dữ liệu đã có để thẻ hiện số cuối.
 */
export function useLiveMetrics({ sessionId, participantIds, socket, enabled = true }: { sessionId?: string; participantIds: string[]; socket: boolean; enabled?: boolean }) {
  const [store, setStore] = useState<Record<string, { points: MetricPoint[]; receivedAt?: number }>>({});
  const idsKey = participantIds.slice().sort().join(',');
  const idsRef = useRef<string[]>(participantIds);
  idsRef.current = participantIds;

  const apply = (participantId: string, incoming: MetricPoint[]) =>
    setStore((current) => {
      const before = current[participantId]?.points ?? [];
      const points = merge(before, incoming);
      if (points === before) return current;
      return { ...current, [participantId]: { points, receivedAt: Date.now() } };
    });

  // Nạp lại theo chu kỳ (và nạp đầu tiên) cho các lượt đang chạy.
  useEffect(() => {
    if (!enabled || !idsKey) return;
    let cancelled = false;
    // Lần nạp đầu luôn chạy (kể cả tab đang ẩn) để có đủ lịch sử điểm đo, các lần sau bỏ qua khi tab ẩn.
    let first = true;
    const load = async () => {
      if (document.hidden && !first) return;
      first = false;
      await Promise.all(
        idsRef.current.map(async (id) => {
          try {
            const points = await listMetrics(id);
            if (!cancelled) apply(id, points);
          } catch {
            // Không có quyền xem điểm đo (chủ ngựa) hoặc lỗi mạng: thẻ chỉ hiện trạng thái.
          }
        }),
      );
    };
    void load();
    const timer = window.setInterval(load, socket ? 15_000 : 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [idsKey, socket, enabled]);

  // HLV của lớp: nhận điểm đo trực tiếp.
  useEffect(() => {
    if (!enabled || !socket || !sessionId) return;
    return onRealtime<MetricsSocketPayload>('performance.metrics', (payload) => {
      if (payload.sessionId !== sessionId) return;
      apply(payload.sessionParticipantId, payload.points.map(toMetricPoint));
    });
  }, [sessionId, socket, enabled]);

  return useMemo(() => {
    const result: Record<string, LiveSeries> = {};
    Object.entries(store).forEach(([id, value]) => {
      result[id] = describe(value.points, value.receivedAt);
    });
    return result;
  }, [store]);
}
