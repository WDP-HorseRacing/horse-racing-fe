// Bộ mô phỏng thiết bị đeo. Khi thiết bị thật được gắn, chỉ cần thay nguồn mẫu ở đây —
// phần tiếp nhận mẫu, tính chỉ số và đối chiếu quy tắc cảnh báo giữ nguyên.
//
// Bộ sinh là hàm thuần: cùng bài tập, cùng kịch bản và cùng hạt giống thì luôn ra cùng chuỗi số liệu.
import type { AlertRule, SimScenario, TrainingIntensity, WorkoutType } from '../types/domain';
import { fastThreshold } from './rules';

export interface SimConfig {
  sessionId: string;
  workoutType: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  scenario: Exclude<SimScenario, 'RANDOM'>;
  seed: number;
  maxHeartRate: number;
}

export type SimPhase = 'WARMUP_WALK' | 'WARMUP_TROT' | 'RUN' | 'RECOVERY_WALK' | 'COOLDOWN' | 'IDLE';

export const phaseLabel: Record<SimPhase, string> = {
  WARMUP_WALK: 'Khởi động đi bộ',
  WARMUP_TROT: 'Khởi động nước kiệu',
  RUN: 'Lần chạy chính',
  RECOVERY_WALK: 'Đi bộ hồi sức',
  COOLDOWN: 'Thả lỏng',
  IDLE: 'Đi bộ chờ',
};

export interface SimSample {
  t: number;
  heartRate: number;
  speedMps: number;
  phase: SimPhase;
  runIndex: number;
  lost: boolean;
}

export interface SimAlert {
  rule: AlertRule;
  atSecond: number;
  value: number;
}

export interface SimResult {
  samples: SimSample[];
  alerts: SimAlert[];
  finished: boolean;
  metrics: {
    avgHeartRate: number;
    maxHeartRate: number;
    avgSpeedMps: number;
    maxSpeedMps: number;
    distanceM: number;
    durationSec: number;
    fastDistanceM: number;
    volumeRatio: number;
    mainAvgSpeedMps: number;
    mainAvgHeartRate: number;
    suggestedTrialSeconds?: number;
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RUN_TARGET: Record<WorkoutType, { speed: number; heartRate: number }> = {
  WALK: { speed: 1.8, heartRate: 85 },
  TROT: { speed: 4.2, heartRate: 120 },
  CANTER: { speed: 10.5, heartRate: 170 },
  BREEZE: { speed: 16.2, heartRate: 213 },
  TIME_TRIAL: { speed: 16.8, heartRate: 220 },
};

const WARMUP_WALK_SEC = 40;
const WARMUP_TROT_SEC = 30;
const RECOVERY_WALK_SEC = 60;
const COOLDOWN_SEC = 150;

export function resolveScenario(scenario: SimScenario, seed: number): Exclude<SimScenario, 'RANDOM'> {
  if (scenario !== 'RANDOM') return scenario;
  const random = mulberry32(seed);
  const roll = random();
  if (roll >= 0.1) return 'NORMAL';
  const pick = Math.floor(random() * 3);
  return (['HEART_OVER', 'INJURY_RISK', 'SIGNAL_LOST'] as const)[pick];
}

function runTargets(config: SimConfig) {
  const reference = RUN_TARGET[config.workoutType];
  if (config.workoutType === 'CANTER' && config.intensity === 'LIGHT') {
    return { speed: 9.5, heartRate: 145 };
  }
  return reference;
}

/**
 * Chạy máy trạng thái từ giây 0 tới `untilSecond`.
 * Tính dần chỉ số trong bộ nhớ, chỉ lưu lại 1 mẫu mỗi 5 giây để xem lại sau buổi.
 */
export function simulate(config: SimConfig, untilSecond: number): SimResult {
  const random = mulberry32(config.seed);
  const target = runTargets(config);
  const threshold = fastThreshold(config.workoutType);
  const plannedVolume = config.distanceM * config.repetitions;

  const hasWarmupWalk = config.workoutType !== 'WALK';
  const hasWarmupTrot = ['CANTER', 'BREEZE', 'TIME_TRIAL'].includes(config.workoutType);
  const targetRun = config.repetitions >= 2 ? 2 : 1;

  let speed = 0;
  let heartRate = 72;
  let phase: SimPhase = hasWarmupWalk ? 'WARMUP_WALK' : 'RUN';
  let phaseStart = 0;
  let runIndex = hasWarmupWalk ? 0 : 1;
  let runDistance = 0;
  let injuryDropUntil = -1;
  let abortRemaining = false;

  const samples: SimSample[] = [];
  const alerts: SimAlert[] = [];
  const lastAlertAt: Partial<Record<AlertRule, number>> = {};

  let sumHeartRate = 0;
  let sumSpeed = 0;
  let count = 0;
  let maxHeartRate = 0;
  let maxSpeedMps = 0;
  let distanceM = 0;
  let fastDistanceM = 0;
  let mainSumSpeed = 0;
  let mainSumHeartRate = 0;
  let mainCount = 0;
  let trialSeconds: number | undefined;
  let overThresholdStreak = 0;
  let lostStreak = 0;
  const recentSpeeds: number[] = [];
  let finished = false;

  const cap = Math.max(0, Math.min(untilSecond, 3600));

  for (let t = 0; t <= cap; t += 1) {
    // Hai số ngẫu nhiên mỗi giây, đúng thứ tự: nhiễu nhịp tim rồi nhiễu tốc độ.
    const heartNoise = (random() - 0.5) * 4;
    const speedNoise = (random() - 0.5) * 0.4;

    let speedTarget: number;
    let heartTarget: number;

    switch (phase) {
      case 'WARMUP_WALK':
        speedTarget = 1.8;
        heartTarget = 78;
        break;
      case 'WARMUP_TROT':
        speedTarget = 4.2;
        heartTarget = 118;
        break;
      case 'RUN':
        speedTarget = target.speed;
        heartTarget =
          config.scenario === 'HEART_OVER' && runIndex === targetRun
            ? config.maxHeartRate + 11
            : target.heartRate;
        break;
      case 'RECOVERY_WALK':
        speedTarget = config.workoutType === 'WALK' ? 0.5 : 1.8;
        heartTarget = 118;
        break;
      case 'COOLDOWN':
        speedTarget = config.workoutType === 'WALK' ? 0.5 : 1.7;
        heartTarget = 105;
        break;
      default:
        speedTarget = 1.4;
        heartTarget = 90;
    }

    const injuryDropping = t <= injuryDropUntil;
    if (injuryDropping) speedTarget = 1.5;

    const speedK = injuryDropping ? 0.7 : speedTarget > speed ? 0.35 : 0.12;
    const heartK = heartTarget > heartRate ? 0.12 : 0.04;
    speed += (speedTarget - speed) * speedK;
    heartRate += (heartTarget - heartRate) * heartK;

    const outSpeed = Math.max(0, Math.round((speed + speedNoise) * 100) / 100);
    const outHeartRate = Math.max(30, Math.round(heartRate + heartNoise));

    // Kịch bản mất tín hiệu: 15 giây đầu của pha đi bộ hồi sức đầu tiên.
    const lost =
      config.scenario === 'SIGNAL_LOST' &&
      phase === 'RECOVERY_WALK' &&
      runIndex === 1 &&
      t - phaseStart >= 20 &&
      t - phaseStart <= 35;

    if (!lost) {
      count += 1;
      sumHeartRate += outHeartRate;
      sumSpeed += outSpeed;
      maxHeartRate = Math.max(maxHeartRate, outHeartRate);
      maxSpeedMps = Math.max(maxSpeedMps, outSpeed);
      distanceM += outSpeed;
      if (outSpeed >= threshold) fastDistanceM += outSpeed;
      if (phase === 'RUN') {
        mainSumSpeed += outSpeed;
        mainSumHeartRate += outHeartRate;
        mainCount += 1;
      }
      lostStreak = 0;
    } else {
      lostStreak += 1;
    }

    if (t % 5 === 0 || lost) {
      samples.push({ t, heartRate: outHeartRate, speedMps: outSpeed, phase, runIndex, lost });
    }

    /* --- Quy tắc cảnh báo --- */
    const canFire = (rule: AlertRule) => (lastAlertAt[rule] ?? -999) <= t - 60;

    if (!lost && outHeartRate > config.maxHeartRate) {
      overThresholdStreak += 1;
      if (overThresholdStreak >= 5 && canFire('R1')) {
        alerts.push({ rule: 'R1', atSecond: t, value: outHeartRate });
        lastAlertAt.R1 = t;
      }
    } else if (!lost) {
      overThresholdStreak = 0;
    }

    if (!lost) {
      recentSpeeds.push(outSpeed);
      if (recentSpeeds.length > 4) recentSpeeds.shift();
      const peak = Math.max(...recentSpeeds);
      if (peak >= threshold && outSpeed < peak * 0.6 && recentSpeeds.length === 4 && canFire('R3')) {
        alerts.push({ rule: 'R3', atSecond: t, value: outSpeed });
        lastAlertAt.R3 = t;
      }
    }

    if (lostStreak > 10 && canFire('R6')) {
      alerts.push({ rule: 'R6', atSecond: t, value: 0 });
      lastAlertAt.R6 = t;
    }

    /* --- Chuyển pha --- */
    if (phase === 'RUN' && !lost) {
      runDistance += outSpeed;

      if (
        config.scenario === 'INJURY_RISK' &&
        runIndex === targetRun &&
        injuryDropUntil < 0 &&
        runDistance >= config.distanceM * 0.5
      ) {
        injuryDropUntil = t + 4;
      }
      if (injuryDropUntil > 0 && t === injuryDropUntil) {
        phase = 'COOLDOWN';
        phaseStart = t;
        abortRemaining = true;
        runDistance = 0;
        continue;
      }

      if (runDistance >= config.distanceM) {
        if (config.workoutType === 'TIME_TRIAL' && trialSeconds === undefined) {
          trialSeconds = Math.round((t - phaseStart) * 100) / 100;
        }
        runDistance = 0;
        if (runIndex >= config.repetitions || abortRemaining) {
          phase = 'COOLDOWN';
        } else {
          phase = 'RECOVERY_WALK';
        }
        phaseStart = t;
      }
    } else if (phase === 'WARMUP_WALK' && t - phaseStart >= WARMUP_WALK_SEC) {
      phase = hasWarmupTrot ? 'WARMUP_TROT' : 'RUN';
      if (phase === 'RUN') runIndex = 1;
      phaseStart = t;
    } else if (phase === 'WARMUP_TROT' && t - phaseStart >= WARMUP_TROT_SEC) {
      phase = 'RUN';
      runIndex = 1;
      phaseStart = t;
    } else if (phase === 'RECOVERY_WALK' && t - phaseStart >= RECOVERY_WALK_SEC) {
      phase = 'RUN';
      runIndex += 1;
      phaseStart = t;
    } else if (phase === 'COOLDOWN' && t - phaseStart >= COOLDOWN_SEC) {
      phase = 'IDLE';
      phaseStart = t;
      finished = true;
    }
  }

  const volumeRatio = plannedVolume > 0 ? Math.min(1, fastDistanceM / plannedVolume) : 0;

  return {
    samples,
    alerts,
    finished,
    metrics: {
      avgHeartRate: count ? Math.round(sumHeartRate / count) : 0,
      maxHeartRate,
      avgSpeedMps: count ? Math.round((sumSpeed / count) * 100) / 100 : 0,
      maxSpeedMps,
      distanceM: Math.round(distanceM),
      durationSec: cap,
      fastDistanceM: Math.round(fastDistanceM),
      volumeRatio: Math.round(volumeRatio * 1000) / 1000,
      mainAvgSpeedMps: mainCount ? Math.round((mainSumSpeed / mainCount) * 100) / 100 : 0,
      mainAvgHeartRate: mainCount ? Math.round(mainSumHeartRate / mainCount) : 0,
      suggestedTrialSeconds: trialSeconds,
    },
  };
}

/** Giây mô phỏng hiện tại của một buổi đang diễn ra. */
export function currentSecond(startedAtIso: string, nowDate: Date, speed: number): number {
  const elapsed = (nowDate.getTime() - new Date(startedAtIso).getTime()) / 1000;
  return Math.max(0, Math.floor(elapsed * speed));
}
