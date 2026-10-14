// Cảm biến giả lập chạy ngay trong trình duyệt: mỗi giây sinh một điểm nhịp tim và tốc độ cho lượt đang chạy rồi gửi lên BE.
// Thay cho lệnh `pnpm sim` của BE khi demo (dự án chưa có thiết bị đo thật). Mẫu số đo giống scripts/simulate-metrics.mjs của BE:
// 60 giây khởi động nhịp tim 90 lên 180, tốc độ 2 lên 12 m/s, sau đó dao động quanh mức đó.
// Sống ở mức module nên chuyển trang trong ứng dụng vẫn chạy tiếp. Tải lại trang hoặc đăng xuất thì dừng.
import { useSyncExternalStore } from 'react';
import { ingestMetrics, type MetricInput } from '../api/performance';
import { onTokensChange } from '../api/tokens';
import { isApiError } from './errors';

/** Điểm chưa gửi được giữ tối đa 15 phút, BE khởi động lại xong thì gửi bù. */
const MAX_PENDING = 900;
/** BE nhận tối đa 500 điểm mỗi lô. */
const BATCH = 500;
const SPIKE_SECONDS = 5;

export interface SensorSim {
  participantId: string;
  horseName: string;
  /** Lúc bật (ms), là giây 0 của bài khởi động. */
  startedAt: number;
  /** Số điểm BE đã nhận. */
  sent: number;
  /** Số điểm BE bỏ vì vô lý (thường do đồng hồ máy chạy nhanh hơn máy chủ). */
  rejected: number;
  /** Số điểm đang chờ gửi. */
  pending: number;
  /** Nhịp tim của điểm vừa sinh. */
  heartRateBpm?: number;
  /** Đang trong 5 giây vọt nhịp tim. */
  spiking: boolean;
  /** Lần gửi gần nhất không tới được máy chủ. */
  offline: boolean;
}

interface Runner {
  state: SensorSim;
  sourceId: string;
  queue: MetricInput[];
  /** Giây kế tiếp cần sinh điểm, tính từ lúc bật. */
  nextSecond: number;
  spike?: { from: number; heartRateBpm: number };
  sending: boolean;
}

const runners = new Map<string, Runner>();
const listeners = new Set<() => void>();
let snapshot: Readonly<Record<string, SensorSim>> = {};
let timer: number | undefined;

function emit() {
  snapshot = Object.fromEntries([...runners].map(([id, runner]) => [id, runner.state]));
  listeners.forEach((listener) => listener());
}

function patch(runner: Runner, next: Partial<SensorSim>) {
  if (runners.get(runner.state.participantId) !== runner) return;
  runner.state = { ...runner.state, ...next };
  emit();
}

const jitter = (amount: number) => (Math.random() * 2 - 1) * amount;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function sample(runner: Runner, second: number): MetricInput {
  const spike = runner.spike;
  const spiking = !!spike && second >= spike.from && second < spike.from + SPIKE_SECONDS;
  const warmup = Math.min(1, second / 60);
  const heartRateBpm = spiking ? spike.heartRateBpm : Math.round(clamp(90 + 90 * warmup + jitter(6), 60, 300));
  const speedMps = spiking ? 16 + jitter(1) : clamp(2 + 10 * warmup + jitter(0.8), 0, 30);
  return {
    sourceId: runner.sourceId,
    recordedAt: new Date(runner.state.startedAt + second * 1000).toISOString(),
    heartRateBpm,
    speedMps: Number(speedMps.toFixed(3)),
  };
}

async function flush(runner: Runner) {
  if (runner.sending || !runner.queue.length) return;
  runner.sending = true;
  const batch = runner.queue.slice(0, BATCH);
  try {
    const result = await ingestMetrics(runner.state.participantId, batch);
    runner.queue.splice(0, batch.length);
    patch(runner, {
      sent: runner.state.sent + result.accepted,
      rejected: runner.state.rejected + (result.skippedInvalid ?? 0),
      pending: runner.queue.length,
      offline: false,
    });
  } catch (error) {
    if (isApiError(error, 404) || isApiError(error, 409)) {
      // Lượt đã xong, bị hủy hoặc không còn: thiết bị thật cũng ngừng gửi.
      stopSim(runner.state.participantId);
    } else if (!isApiError(error) || error.status === 0 || error.status === 429 || error.status >= 500) {
      // Máy chủ chưa nghe máy (đang khởi động lại, mất mạng): giữ điểm lại, giây sau gửi bù.
      patch(runner, { offline: true });
    } else {
      // Lô bị từ chối vì dữ liệu: bỏ lô đó để không kẹt mãi.
      runner.queue.splice(0, batch.length);
      patch(runner, { pending: runner.queue.length });
    }
  } finally {
    runner.sending = false;
  }
}

/** Sinh điểm cho mọi giây đã trôi qua (tab bị trình duyệt làm chậm vẫn không hụt giây) rồi gửi. */
function tick() {
  const now = Date.now();
  for (const runner of runners.values()) {
    const due = Math.floor((now - runner.state.startedAt) / 1000);
    let last: MetricInput | undefined;
    while (runner.nextSecond <= due) {
      last = sample(runner, runner.nextSecond);
      runner.queue.push(last);
      runner.nextSecond += 1;
    }
    if (runner.queue.length > MAX_PENDING) runner.queue.splice(0, runner.queue.length - MAX_PENDING);
    if (last) {
      const spiking = !!runner.spike && runner.nextSecond - 1 < runner.spike.from + SPIKE_SECONDS;
      runner.state = { ...runner.state, heartRateBpm: last.heartRateBpm, pending: runner.queue.length, spiking };
    }
    void flush(runner);
  }
  emit();
}

function syncTimer() {
  if (runners.size && timer === undefined) timer = window.setInterval(tick, 1000);
  if (!runners.size && timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
  }
}

export function startSim(participantId: string, horseName: string) {
  if (runners.has(participantId)) return;
  runners.set(participantId, {
    state: { participantId, horseName, startedAt: Date.now(), sent: 0, rejected: 0, pending: 0, spiking: false, offline: false },
    sourceId: `fe-sim-${participantId.slice(0, 8)}`,
    queue: [],
    nextSecond: 0,
    sending: false,
  });
  syncTimer();
  tick();
}

export function stopSim(participantId: string) {
  if (!runners.delete(participantId)) return;
  syncTimer();
  emit();
}

export function stopAllSims() {
  if (!runners.size) return;
  runners.clear();
  syncTimer();
  emit();
}

/** Cho nhịp tim vọt lên 5 giây, vượt ngưỡng nguy hiểm của ngựa, để xem cảnh báo khẩn. */
export function spikeSim(participantId: string, criticalBpm: number) {
  const runner = runners.get(participantId);
  if (!runner) return;
  const from = runner.nextSecond;
  runner.spike = { from, heartRateBpm: Math.min(300, Math.max(245, criticalBpm + 5)) };
  patch(runner, { spiking: true });
}

export function subscribeSims(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getSims = () => snapshot;

/** Các cảm biến giả lập đang chạy, theo mã lượt tập. */
export const useSensorSims = () => useSyncExternalStore(subscribeSims, getSims);

// Đăng xuất thì ngừng mọi cảm biến giả lập.
onTokensChange((tokens) => {
  if (!tokens) stopAllSims();
});
