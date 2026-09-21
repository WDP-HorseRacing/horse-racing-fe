// Dữ liệu khởi tạo. Mọi mốc thời gian tính tương đối so với hôm nay nên mở lúc nào
// dữ liệu cũng đang ở hiện tại. Dùng bộ số ngẫu nhiên có hạt giống cố định để lần nào cũng ra như nhau.
import type {
  BodyMeasurement,
  CareSchedule,
  Database,
  DietPlan,
  Expense,
  Horse,
  MedicalRecord,
  PhaseWorkout,
  StallAssignment,
  TrackSurface,
  TrainingIntensity,
  TrainingPhase,
  TrainingPlan,
  TrainingSession,
  User,
  WorkoutType,
} from '../types/domain';
import { addDays, isoDayOfWeek, startOfWeek, toDateKey } from '../lib/format';

/* ===== tiện ích ===== */

let seq = 0;
const id = (prefix: string) => `${prefix}_${(seq += 1).toString(36).padStart(3, '0')}`;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20250921);
const jitter = (base: number, spread: number) => Math.round((base + (rand() - 0.5) * spread) * 10) / 10;

function base(createdAt: string) {
  return { createdAt, updatedAt: createdAt, version: 1 };
}

const SLOTS = [
  { id: 'slot_1', code: 'S1', startTime: '05:30', endTime: '06:30' },
  { id: 'slot_2', code: 'S2', startTime: '06:30', endTime: '07:30' },
  { id: 'slot_3', code: 'S3', startTime: '07:30', endTime: '08:30' },
  { id: 'slot_4', code: 'S4', startTime: '08:30', endTime: '09:30' },
  { id: 'slot_5', code: 'S5', startTime: '15:30', endTime: '16:30' },
  { id: 'slot_6', code: 'S6', startTime: '16:30', endTime: '17:30' },
];

interface WorkoutSpec {
  day: number;
  slot?: string;
  type: WorkoutType;
  distanceM: number;
  repetitions: number;
  intensity: TrainingIntensity;
  surface: TrackSurface;
}

/* ===== seed ===== */

export function buildSeed(today: Date, schema: number): Database {
  seq = 0;
  const T = new Date(today);
  T.setHours(12, 0, 0, 0);
  const iso = (offsetDays: number, hour = 9) => {
    const date = addDays(T, offsetDays);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  const key = (offsetDays: number) => toDateKey(addDays(T, offsetDays));
  const W0 = startOfWeek(T);
  const weekKey = (weekOffset: number, dayOfWeek: number) =>
    toDateKey(addDays(W0, weekOffset * 7 + (dayOfWeek - 1)));

  const createdAt = iso(-90);

  /* --- Người dùng --- */
  const zoneA = { id: 'zone_a', code: 'A', name: 'Khu A', headTrainerId: 'u_ht_a', ...base(createdAt) };
  const zoneB = { id: 'zone_b', code: 'B', name: 'Khu B', headTrainerId: 'u_ht_b', ...base(createdAt) };
  const zoneC = { id: 'zone_c', code: 'C', name: 'Khu C — Cách ly và phục hồi', ...base(createdAt) };

  const users: User[] = [
    { id: 'u_cm', name: 'Nguyễn Thị Lan', email: 'lan.nguyen@horseracing.vn', phone: '0903 118 245', role: 'CLUB_MANAGER', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_ht_a', name: 'Trần Minh Quân', email: 'quan.tran@horseracing.vn', phone: '0912 470 318', role: 'HEAD_TRAINER', zoneId: 'zone_a', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_ht_b', name: 'Lê Hoàng Nam', email: 'nam.le@horseracing.vn', phone: '0938 205 764', role: 'HEAD_TRAINER', zoneId: 'zone_b', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_vet_1', name: 'Phạm Thu Hà', email: 'ha.pham@horseracing.vn', phone: '0977 634 190', role: 'VETERINARIAN', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_vet_2', name: 'Đỗ Văn Khoa', email: 'khoa.do@horseracing.vn', phone: '0964 812 507', role: 'VETERINARIAN', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_gr_1', name: 'Võ Văn Tài', email: 'tai.vo@horseracing.vn', phone: '0355 902 148', role: 'GROOM', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_gr_2', name: 'Nguyễn Văn Bình', email: 'binh.nguyen@horseracing.vn', phone: '0386 471 025', role: 'GROOM', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_gr_3', name: 'Hồ Thị Mai', email: 'mai.ho@horseracing.vn', phone: '0327 658 913', role: 'GROOM', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_ow_1', name: 'Lý Quốc Thịnh', email: 'thinh.ly@horseracing.vn', phone: '0908 341 772', role: 'HORSE_OWNER', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_ow_2', name: 'Châu Ngọc Anh', email: 'anh.chau@horseracing.vn', phone: '0945 217 690', role: 'HORSE_OWNER', avatar: '', active: true, ...base(createdAt) },
    { id: 'u_ow_3', name: 'Trương Gia Huy', email: 'huy.truong@horseracing.vn', phone: '0989 503 471', role: 'HORSE_OWNER', avatar: '', active: true, ...base(createdAt) },
  ];

  /* --- Ô chuồng --- */
  const stalls = [
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `stall_a${index + 1}`,
      code: `A-${String(index + 1).padStart(2, '0')}`,
      zoneId: 'zone_a',
      type: 'STANDARD' as const,
      ...base(createdAt),
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `stall_b${index + 1}`,
      code: `B-${String(index + 1).padStart(2, '0')}`,
      zoneId: 'zone_b',
      type: 'STANDARD' as const,
      ...base(createdAt),
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `stall_c${index + 1}`,
      code: `C-${String(index + 1).padStart(2, '0')}`,
      zoneId: 'zone_c',
      type: 'ISOLATION' as const,
      ...base(createdAt),
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      id: `stall_c${index + 4}`,
      code: `C-${String(index + 4).padStart(2, '0')}`,
      zoneId: 'zone_c',
      type: 'RECOVERY' as const,
      ...base(createdAt),
    })),
  ];

  /* --- Ngựa --- */
  const birth = (age: number) => toDateKey(addDays(T, -age * 365 - 40));
  const horse = (
    hid: string,
    name: string,
    sex: Horse['sex'],
    age: number | undefined,
    pref: Horse['distancePreference'] | undefined,
    health: Horse['healthStatus'],
    lifecycle: Horse['lifecycleStatus'],
    avatar: string,
    extra: Partial<Horse> = {},
  ): Horse => ({
    id: hid,
    name,
    sex,
    breed: extra.breed ?? 'Thoroughbred',
    color: extra.color ?? 'Nâu hạt dẻ',
    birthDate: age ? birth(age) : undefined,
    chipNumber: extra.chipNumber,
    distancePreference: pref,
    healthStatus: health,
    lifecycleStatus: lifecycle,
    isReference: extra.isReference ?? false,
    sireId: extra.sireId,
    damId: extra.damId,
    avatar,
    // Bo trong nghia la dung muc mac dinh cua cau lac bo.
    dailyRate: extra.dailyRate,
    deletedAt: extra.deletedAt,
    deleteReason: extra.deleteReason,
    ...base(createdAt),
  });

  const chip = (n: number) => `7040981000000${String(n).padStart(2, '0')}`;

  const horses: Horse[] = [
    horse('h_sao_mai', 'Sao Mai', 'FEMALE', 4, 'MILER', 'ELIGIBLE', 'ACTIVE', '/winx.jpg', {
      chipNumber: chip(1), sireId: 'h_northern_star', damId: 'h_queen_lily', dailyRate: 1_500_000, color: 'Nâu sáng',
    }),
    horse('h_gio_bac', 'Gió Bấc', 'MALE', 9, 'STAYER', 'ELIGIBLE', 'ACTIVE', '/gold-ship.png', { chipNumber: chip(2), color: 'Xám tro' }),
    horse('h_bach_long', 'Bạch Long', 'GELDING', 5, 'SPRINTER', 'UNDER_OBSERVATION', 'ACTIVE', '/stay-gold.jpg', { chipNumber: chip(3), color: 'Trắng ngà' }),
    horse('h_hac_phong', 'Hắc Phong', 'MALE', 6, 'MILER', 'INJURED', 'ACTIVE', '/point-flag.jpg', { chipNumber: chip(4), color: 'Đen tuyền' }),
    horse('h_hoang_kim', 'Hoàng Kim', 'FEMALE', 3, 'SPRINTER', 'QUARANTINED', 'ACTIVE', '/vegas-showgirl.jpg', { chipNumber: chip(5), color: 'Vàng kim' }),
    horse('h_thien_ma', 'Thiên Mã', 'MALE', 4, 'STAYER', 'ELIGIBLE', 'ACTIVE', '/sunday-silence.jpg', { chipNumber: chip(6), color: 'Nâu sẫm' }),
    horse('h_lua_rung', 'Lửa Rừng', 'FEMALE', 5, 'SPRINTER', 'ELIGIBLE', 'ACTIVE', '/golden-sash.jpg', { chipNumber: chip(7), color: 'Hung đỏ' }),
    horse('h_may_trang', 'Mây Trắng', 'GELDING', 7, 'STAYER', 'ELIGIBLE', 'ACTIVE', '/Mejiro-McQueen.jpg', { chipNumber: chip(8), breed: 'Arabian', color: 'Xám bạc' }),
    horse('h_anh_duong', 'Ánh Dương', 'FEMALE', 12, 'MILER', 'ELIGIBLE', 'RETIRED', '/helen-street.jpg', { chipNumber: chip(9), color: 'Nâu đỏ' }),
    horse('h_phong_vu', 'Phong Vũ', 'MALE', 8, 'MILER', 'ELIGIBLE', 'TRANSFERRED', '/street-cry.jpg', { chipNumber: chip(10), color: 'Nâu hạt dẻ' }),
    horse('h_northern_star', 'Northern Star', 'MALE', 14, undefined, 'ELIGIBLE', 'ACTIVE', '/machiavellian.jpg', {
      isReference: true, sireId: 'h_polaris', damId: 'h_dawn_rose',
    }),
    horse('h_queen_lily', 'Queen Lily', 'FEMALE', 13, undefined, 'ELIGIBLE', 'ACTIVE', '/vegas-magic.jpg', { isReference: true }),
    horse('h_polaris', 'Polaris', 'MALE', 19, undefined, 'ELIGIBLE', 'ACTIVE', '/al-akbar.jpg', { isReference: true }),
    horse('h_dawn_rose', 'Dawn Rose', 'FEMALE', 18, undefined, 'ELIGIBLE', 'ACTIVE', '/helen-street.jpg', { isReference: true }),
    horse('h_nhap_nham', 'Ngựa nhập nhầm', 'MALE', 5, undefined, 'ELIGIBLE', 'ACTIVE', '', {
      chipNumber: chip(11), deletedAt: iso(-2), deleteReason: 'Tạo trùng hồ sơ',
    }),
  ];

  /* --- Xếp chuồng --- */
  const assign = (horseId: string, stallId: string, groomId: string, days: number) => ({
    id: id('sa'),
    horseId,
    stallId,
    groomId,
    startAt: iso(-days),
    ...base(iso(-days)),
  });

  const stallAssignments: StallAssignment[] = [
    assign('h_sao_mai', 'stall_a1', 'u_gr_1', 80),
    assign('h_gio_bac', 'stall_a2', 'u_gr_1', 80),
    assign('h_bach_long', 'stall_a3', 'u_gr_2', 80),
    assign('h_hac_phong', 'stall_b1', 'u_gr_3', 80),
    assign('h_hoang_kim', 'stall_c1', 'u_gr_2', 3),
    assign('h_thien_ma', 'stall_b2', 'u_gr_3', 80),
    assign('h_lua_rung', 'stall_b3', 'u_gr_2', 3),
    assign('h_may_trang', 'stall_b4', 'u_gr_3', 80),
    assign('h_anh_duong', 'stall_a4', 'u_gr_1', 80),
  ];
  // Lửa Rừng trước đó ở khu A, chuyển sang khu B ngày T−3.
  stallAssignments.push({
    id: id('sa'),
    horseId: 'h_lua_rung',
    stallId: 'stall_a5',
    groomId: 'u_gr_1',
    startAt: iso(-80),
    endAt: iso(-3),
    ...base(iso(-80)),
  });
  // Hoàng Kim trước đó ở ô thường.
  stallAssignments.push({
    id: id('sa'),
    horseId: 'h_hoang_kim',
    stallId: 'stall_b5',
    groomId: 'u_gr_2',
    startAt: iso(-80),
    endAt: iso(-3),
    ...base(iso(-80)),
  });

  /* --- Sở hữu --- */
  const own = (horseId: string, ownerId: string, percent: number, rep: boolean, endDate?: string) => ({
    id: id('ow'),
    horseId,
    ownerId,
    percent,
    isRepresentative: rep,
    startDate: key(-300),
    endDate,
    ...base(createdAt),
  });

  const ownerships = [
    own('h_sao_mai', 'u_ow_1', 60, true),
    own('h_sao_mai', 'u_ow_2', 40, false),
    own('h_gio_bac', 'u_ow_1', 100, true),
    own('h_bach_long', 'u_ow_3', 100, true),
    own('h_hac_phong', 'u_ow_2', 50, true),
    own('h_hac_phong', 'u_ow_3', 50, false),
    own('h_hoang_kim', 'u_ow_3', 100, true),
    own('h_thien_ma', 'u_ow_2', 100, true),
    own('h_lua_rung', 'u_ow_1', 100, true),
    own('h_anh_duong', 'u_ow_2', 100, true),
    own('h_phong_vu', 'u_ow_1', 100, true, key(-60)),
  ];

  /* --- Chỉ số cơ thể --- */
  const bodyMeasurements: BodyMeasurement[] = [];
  const measure = (horseId: string, type: BodyMeasurement['type'], value: number, offsetDays: number, by: string) => {
    bodyMeasurements.push({
      id: id('bm'),
      horseId,
      type,
      value,
      measuredAt: iso(offsetDays, 7),
      recordedBy: by,
      ...base(iso(offsetDays, 7)),
    });
  };

  const activeHorses = ['h_sao_mai', 'h_gio_bac', 'h_bach_long', 'h_hac_phong', 'h_hoang_kim', 'h_thien_ma', 'h_lua_rung', 'h_may_trang', 'h_anh_duong'];
  activeHorses.forEach((horseId, index) => {
    const baseWeight = 470 + index * 6;
    for (let week = 11; week >= 0; week -= 1) {
      if (horseId === 'h_gio_bac') continue;
      measure(horseId, 'WEIGHT', jitter(baseWeight, 6), -week * 7, 'u_gr_1');
    }
    for (let month = 2; month >= 0; month -= 1) {
      measure(horseId, 'HEIGHT', jitter(160 + index, 1), -month * 30, 'u_vet_1');
      measure(horseId, 'BODY_CONDITION', jitter(5, 0.8), -month * 30, 'u_vet_1');
    }
    for (let i = 3; i >= 0; i -= 1) {
      if (horseId === 'h_bach_long' && i === 0) continue;
      measure(horseId, 'TEMPERATURE', jitter(37.8, 0.5), -i * 9, 'u_gr_2');
    }
  });

  // Gió Bấc: giảm cân quá 5% trong 14 ngày.
  [[14, 505], [11, 499], [8, 492], [5, 486], [1, 478]].forEach(([offset, value]) => {
    measure('h_gio_bac', 'WEIGHT', value, -offset, 'u_gr_1');
  });
  for (let week = 11; week >= 3; week -= 1) measure('h_gio_bac', 'WEIGHT', jitter(507, 4), -week * 7, 'u_gr_1');

  // Bạch Long: sốt 38,8 °C hôm qua.
  measure('h_bach_long', 'TEMPERATURE', 38.8, -1, 'u_gr_2');

  /* --- Nhịp tim tối đa --- */
  const maxHeartRates = [
    {
      id: id('mhr'),
      horseId: 'h_gio_bac',
      value: 220,
      reason: 'Ngựa 9 tuổi, hạ ngưỡng an toàn theo tuổi',
      createdBy: 'u_vet_1',
      active: true,
      ...base(iso(-30)),
    },
  ];

  /* --- Giáo án --- */
  const plans: TrainingPlan[] = [];
  const phases: TrainingPhase[] = [];
  const phaseWorkouts: PhaseWorkout[] = [];
  const sessions: TrainingSession[] = [];

  function addPlan(
    planId: string,
    horseId: string,
    name: string,
    goal: string,
    startKey: string,
    createdBy: string,
    phaseSpecs: { name: string; goal: string; weeks: number; template: WorkoutSpec[] }[],
    extra: Partial<TrainingPlan> = {},
  ) {
    let cursor = new Date(startKey);
    let endKey = startKey;
    phaseSpecs.forEach((spec, index) => {
      const phaseStart = toDateKey(cursor);
      const phaseEnd = toDateKey(addDays(cursor, spec.weeks * 7 - 1));
      endKey = phaseEnd;
      const phaseId = `${planId}_p${index + 1}`;
      phases.push({
        id: phaseId,
        planId,
        orderNo: index + 1,
        name: spec.name,
        goal: spec.goal,
        weeks: spec.weeks,
        startDate: phaseStart,
        endDate: phaseEnd,
        ...base(createdAt),
      });
      spec.template.forEach((workout) => {
        phaseWorkouts.push({
          id: id('pw'),
          phaseId,
          dayOfWeek: workout.day,
          slotId: workout.slot ?? 'slot_2',
          workoutType: workout.type,
          distanceM: workout.distanceM,
          repetitions: workout.repetitions,
          intensity: workout.intensity,
          surface: workout.surface,
          ...base(createdAt),
        });
      });
      cursor = addDays(cursor, spec.weeks * 7);
    });

    plans.push({
      id: planId,
      horseId,
      name,
      goal,
      startDate: startKey,
      endDate: endKey,
      createdBy,
      needsReview: false,
      ...base(createdAt),
      ...extra,
    });
  }

  const dirt: TrackSurface = 'DIRT';
  const turf: TrackSurface = 'TURF';

  /* P1 — Sao Mai */
  addPlan(
    'plan_sao_mai',
    'h_sao_mai',
    'Chuẩn bị Cúp Mùa Thu',
    'Đạt phong độ đỉnh cho cự ly 1600 m trên mặt cỏ',
    weekKey(-5, 1),
    'u_ht_a',
    [
      {
        name: 'Xây nền',
        goal: 'Xây nền sức bền và làm quen khối lượng',
        weeks: 4,
        template: [
          { day: 1, type: 'CANTER', distanceM: 2000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 2, type: 'TROT', distanceM: 3000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 3, type: 'CANTER', distanceM: 1600, repetitions: 1, intensity: 'MODERATE', surface: dirt },
          { day: 4, type: 'WALK', distanceM: 2000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 5, type: 'CANTER', distanceM: 2000, repetitions: 1, intensity: 'MODERATE', surface: dirt },
          { day: 6, type: 'BREEZE', distanceM: 400, repetitions: 2, intensity: 'HEAVY', surface: turf },
        ],
      },
      {
        name: 'Tăng cường',
        goal: 'Nâng cường độ và tốc độ phần chạy nhanh',
        weeks: 4,
        template: [
          { day: 1, type: 'CANTER', distanceM: 2000, repetitions: 1, intensity: 'MODERATE', surface: dirt },
          { day: 2, type: 'TROT', distanceM: 3000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 3, type: 'BREEZE', distanceM: 400, repetitions: 3, intensity: 'HEAVY', surface: turf },
          { day: 3, slot: 'slot_5', type: 'WALK', distanceM: 1500, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 4, type: 'CANTER', distanceM: 1600, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 5, type: 'CANTER', distanceM: 2000, repetitions: 1, intensity: 'MODERATE', surface: dirt },
          { day: 6, type: 'BREEZE', distanceM: 600, repetitions: 2, intensity: 'HEAVY', surface: turf },
        ],
      },
      {
        name: 'Đỉnh',
        goal: 'Giữ tốc độ, giảm khối lượng trước ngày đua',
        weeks: 2,
        template: [
          { day: 1, type: 'CANTER', distanceM: 1600, repetitions: 1, intensity: 'MODERATE', surface: dirt },
          { day: 3, type: 'BREEZE', distanceM: 400, repetitions: 2, intensity: 'HEAVY', surface: turf },
          { day: 5, type: 'CANTER', distanceM: 1200, repetitions: 1, intensity: 'LIGHT', surface: dirt },
        ],
      },
    ],
  );

  /* P2 — Gió Bấc: kết thúc T+5 */
  addPlan(
    'plan_gio_bac',
    'h_gio_bac',
    'Duy trì sau Giải Mùa Hè',
    'Giữ nền thể lực sau giải, chưa đặt mục tiêu mới',
    key(-15),
    'u_ht_a',
    [
      {
        name: 'Duy trì',
        goal: 'Giữ nền, ưu tiên hồi phục',
        weeks: 3,
        template: [
          { day: 1, slot: 'slot_6', type: 'CANTER', distanceM: 2000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 3, slot: 'slot_6', type: 'TROT', distanceM: 3000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 5, slot: 'slot_6', type: 'CANTER', distanceM: 1600, repetitions: 1, intensity: 'MODERATE', surface: dirt },
        ],
      },
    ],
  );

  /* P3 — Bạch Long */
  addPlan(
    'plan_bach_long',
    'h_bach_long',
    'Phục hồi thể lực',
    'Đưa ngựa trở lại khối lượng bình thường sau đợt theo dõi',
    key(-10),
    'u_ht_a',
    [
      {
        name: 'Hồi phục nhẹ',
        goal: 'Chỉ bài Nhẹ và Trung bình theo chỉ dẫn của bác sĩ',
        weeks: 4,
        template: [
          { day: 1, slot: 'slot_3', type: 'WALK', distanceM: 2000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 2, slot: 'slot_3', type: 'TROT', distanceM: 3000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 4, slot: 'slot_3', type: 'CANTER', distanceM: 1600, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 6, slot: 'slot_3', type: 'TROT', distanceM: 2500, repetitions: 1, intensity: 'LIGHT', surface: dirt },
        ],
      },
    ],
  );

  /* P4 — Hắc Phong */
  addPlan(
    'plan_hac_phong',
    'h_hac_phong',
    'Chuẩn bị giải cuối năm',
    'Nâng dần khối lượng hướng tới cự ly 1600 m',
    key(-20),
    'u_ht_b',
    [
      {
        name: 'Xây nền',
        goal: 'Tăng nền sức bền',
        weeks: 3,
        template: [
          { day: 1, type: 'CANTER', distanceM: 1800, repetitions: 1, intensity: 'MODERATE', surface: dirt },
          { day: 3, type: 'TROT', distanceM: 3000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 5, type: 'BREEZE', distanceM: 400, repetitions: 2, intensity: 'HEAVY', surface: turf },
        ],
      },
      {
        name: 'Tăng cường',
        goal: 'Tăng tốc độ phần chạy nhanh',
        weeks: 4,
        template: [
          { day: 1, type: 'CANTER', distanceM: 2000, repetitions: 1, intensity: 'MODERATE', surface: dirt },
          { day: 3, type: 'BREEZE', distanceM: 500, repetitions: 2, intensity: 'HEAVY', surface: turf },
          { day: 5, type: 'CANTER', distanceM: 1600, repetitions: 1, intensity: 'LIGHT', surface: dirt },
        ],
      },
    ],
  );

  /* P5 — Lửa Rừng: cần xem lại */
  addPlan(
    'plan_lua_rung',
    'h_lua_rung',
    'Chuẩn bị Giải Sprint Tháng 11',
    'Đạt tốc độ tối đa ở cự ly 1200 m',
    key(-18),
    'u_ht_a',
    [
      {
        name: 'Nền tốc độ',
        goal: 'Xây nền cho các bài nước rút',
        weeks: 3,
        template: [
          { day: 1, slot: 'slot_5', type: 'CANTER', distanceM: 1000, repetitions: 2, intensity: 'MODERATE', surface: dirt },
          { day: 3, slot: 'slot_5', type: 'TROT', distanceM: 2500, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 5, slot: 'slot_5', type: 'BREEZE', distanceM: 400, repetitions: 2, intensity: 'HEAVY', surface: turf },
        ],
      },
      {
        name: 'Nước rút',
        goal: 'Tăng số lần lặp nước rút',
        weeks: 4,
        template: [
          { day: 1, slot: 'slot_5', type: 'CANTER', distanceM: 1000, repetitions: 2, intensity: 'MODERATE', surface: dirt },
          { day: 3, slot: 'slot_5', type: 'BREEZE', distanceM: 400, repetitions: 3, intensity: 'HEAVY', surface: turf },
          { day: 5, slot: 'slot_5', type: 'CANTER', distanceM: 1200, repetitions: 1, intensity: 'LIGHT', surface: dirt },
        ],
      },
    ],
    { needsReview: true, needsReviewReason: `Ngựa chuyển từ Khu A sang Khu B ngày ${toDateKey(addDays(T, -3))}` },
  );

  /* P6 — Mây Trắng */
  addPlan(
    'plan_may_trang',
    'h_may_trang',
    'Nền sức bền',
    'Chuẩn bị cho cự ly dài trên 2000 m',
    key(-24),
    'u_ht_b',
    [
      {
        name: 'Nền dài',
        goal: 'Tăng dần quãng đường mỗi buổi',
        weeks: 6,
        template: [
          { day: 1, slot: 'slot_4', type: 'CANTER', distanceM: 1000, repetitions: 2, intensity: 'MODERATE', surface: dirt },
          { day: 3, slot: 'slot_4', type: 'TROT', distanceM: 3000, repetitions: 1, intensity: 'LIGHT', surface: dirt },
          { day: 5, slot: 'slot_4', type: 'CANTER', distanceM: 2000, repetitions: 1, intensity: 'MODERATE', surface: dirt },
        ],
      },
    ],
  );

  /* P7 — Ánh Dương: đã hủy khi giải nghệ */
  addPlan(
    'plan_anh_duong',
    'h_anh_duong',
    'Chuẩn bị Giải Mùa Thu',
    'Giữ phong độ cho mùa giải cuối',
    key(-45),
    'u_ht_a',
    [
      {
        name: 'Duy trì',
        goal: 'Giữ nền thể lực',
        weeks: 6,
        template: [{ day: 1, type: 'CANTER', distanceM: 1600, repetitions: 1, intensity: 'LIGHT', surface: dirt }],
      },
    ],
    {
      cancelledAt: iso(-12),
      cancelledBy: 'u_cm',
      closeReason: 'LIFECYCLE',
      closeNote: 'Hủy do đổi vòng đời — ngựa giải nghệ',
    },
  );

  /* --- Sinh buổi tập từ tuần mẫu --- */
  const groomOf: Record<string, string> = {
    h_sao_mai: 'u_gr_1',
    h_gio_bac: 'u_gr_1',
    h_bach_long: 'u_gr_2',
    h_hac_phong: 'u_gr_3',
    h_thien_ma: 'u_gr_3',
    h_lua_rung: 'u_gr_2',
    h_may_trang: 'u_gr_3',
  };

  const todayKey = toDateKey(T);

  plans.forEach((plan) => {
    if (plan.cancelledAt) return;
    const planPhases = phases.filter((phase) => phase.planId === plan.id);
    planPhases.forEach((phase) => {
      // Giáo án Sao Mai chưa sinh buổi cho giai đoạn 3 (để diễn "Áp dụng cho các tuần còn lại").
      if (phase.id === 'plan_sao_mai_p3') return;
      const templates = phaseWorkouts.filter((workout) => workout.phaseId === phase.id);
      const start = new Date(phase.startDate);
      const end = new Date(phase.endDate);
      for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
        const dayOfWeek = isoDayOfWeek(cursor);
        const dateKey = toDateKey(cursor);
        templates
          .filter((template) => template.dayOfWeek === dayOfWeek)
          .forEach((template) => {
            sessions.push({
              id: id('ses'),
              horseId: plan.horseId,
              planId: plan.id,
              phaseId: phase.id,
              phaseWorkoutId: template.id,
              sessionDate: dateKey,
              slotId: template.slotId,
              groomId: groomOf[plan.horseId],
              workoutType: template.workoutType,
              distanceM: template.distanceM,
              repetitions: template.repetitions,
              intensity: template.intensity,
              surface: template.surface,
              status: dateKey < todayKey ? 'COMPLETED' : 'SCHEDULED',
              ...base(createdAt),
            });
          });
      }
    });
  });

  /* --- Chốt chỉ số và đánh giá cho buổi đã qua --- */
  const trainerOf: Record<string, string> = {
    h_sao_mai: 'u_ht_a',
    h_gio_bac: 'u_ht_a',
    h_bach_long: 'u_ht_a',
    h_hac_phong: 'u_ht_b',
    h_lua_rung: 'u_ht_a',
    h_may_trang: 'u_ht_b',
  };

  const pace: Record<WorkoutType, { speed: number; hr: number }> = {
    WALK: { speed: 1.8, hr: 85 },
    TROT: { speed: 4.2, hr: 120 },
    CANTER: { speed: 10, hr: 160 },
    BREEZE: { speed: 16.2, hr: 205 },
    TIME_TRIAL: { speed: 16.8, hr: 214 },
  };

  function finish(session: TrainingSession, volumeRatio: number, score: number, dayIndex: number) {
    const reference = pace[session.workoutType];
    const planned = session.distanceM * session.repetitions;
    const fast = Math.round(planned * volumeRatio);
    const improvement = Math.min(dayIndex * 0.35, 16);
    session.status = 'COMPLETED';
    session.startedAt = `${session.sessionDate}T06:35:00.000Z`;
    session.startedBy = session.groomId;
    session.endedAt = `${session.sessionDate}T07:20:00.000Z`;
    session.endedBy = session.groomId;
    session.endReason = volumeRatio >= 0.9 ? 'NORMAL' : 'STOPPED_BY_USER';
    session.maxHeartRateUsed = session.horseId === 'h_gio_bac' ? 220 : 230;
    session.summary = {
      avgHeartRate: Math.round(reference.hr * 0.72 + 30 - improvement * 0.4),
      maxHeartRate: Math.round(reference.hr + 8 - improvement * 0.2),
      avgSpeedMps: Math.round(reference.speed * 0.55 * 10) / 10,
      maxSpeedMps: Math.round((reference.speed + 0.6) * 10) / 10,
      distanceM: Math.round(planned * 1.6),
      durationSec: 2100,
      fastDistanceM: fast,
      volumeRatio,
      alertCountRed: 0,
      mainAvgSpeedMps: Math.round((reference.speed + improvement * 0.02) * 10) / 10,
      mainAvgHeartRate: Math.round(reference.hr - improvement * 0.55),
      suggestedTrialSeconds:
        session.workoutType === 'TIME_TRIAL'
          ? Math.round((session.distanceM / (reference.speed + improvement * 0.02)) * 100) / 100
          : undefined,
    };
    session.evaluation = {
      performanceScore: score,
      completionLevel: volumeRatio >= 0.9 ? (score >= 8 ? 'EXCEEDED' : 'MET') : 'BELOW',
      ownerComment:
        volumeRatio >= 0.9
          ? 'Ngựa vào bài đều, nhịp tim hồi phục tốt sau phần chạy nhanh. Giữ nguyên khối lượng cho tuần tới.'
          : 'Buổi tập kết thúc sớm, khối lượng chưa đạt. Sẽ theo dõi thêm ở buổi kế tiếp.',
      internalNote: volumeRatio >= 0.9 ? undefined : 'Theo dõi sải chân sau bên trái ở buổi tới.',
      evaluatedAt: `${session.sessionDate}T12:00:00.000Z`,
      evaluatedBy: trainerOf[session.horseId] ?? 'u_ht_a',
    };
  }

  // Điểm phong độ nhích dần lên theo thời gian của TỪNG con ngựa, kèm dao động nhỏ.
  // Tính theo từng con chứ không theo cả đàn, nếu không biểu đồ của mỗi ngựa sẽ phẳng.
  const completedByHorse = new Map<string, TrainingSession[]>();
  sessions
    .filter((session) => session.status === 'COMPLETED')
    .forEach((session) => {
      completedByHorse.set(session.horseId, [...(completedByHorse.get(session.horseId) ?? []), session]);
    });

  completedByHorse.forEach((list) => {
    list
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
      .forEach((session, index) => {
        const progress = list.length > 1 ? index / (list.length - 1) : 1;
        const score = Math.min(9, Math.max(5, Math.round(5.6 + progress * 2.9 + (rand() - 0.5) * 0.9)));
        finish(session, 1, score, index);
      });
  });

  /* Sao Mai: hai buổi chạy thử ở giai đoạn 1 */
  const trialWeeks = [-4, -2];
  trialWeeks.forEach((weekOffset, index) => {
    const dateKey = weekKey(weekOffset, 6);
    const session = sessions.find((item) => item.horseId === 'h_sao_mai' && item.sessionDate === dateKey);
    if (!session) return;
    session.workoutType = 'TIME_TRIAL';
    session.distanceM = 1200;
    session.repetitions = 1;
    session.intensity = 'MAXIMUM';
    session.surface = turf;
    session.edited = true;
    if (session.summary) {
      session.summary.suggestedTrialSeconds = index === 0 ? 76.4 : 74.8;
      session.summary.fastDistanceM = 1200;
      session.summary.volumeRatio = 1;
    }
    if (session.evaluation) {
      session.evaluation.trialTimeSeconds = index === 0 ? 76.4 : 74.8;
      session.evaluation.ownerComment =
        index === 0
          ? 'Lần chạy thử đầu tiên của giai đoạn, ngựa còn dè chừng ở 400 m cuối.'
          : 'Cải thiện 1,6 giây so với lần trước, ngựa bám sát tốc độ mục tiêu tới vạch đích.';
      if (index === 1) session.evaluation.videoThumbnail = '/winx.jpg';
    }
  });

  /* Sao Mai: hai buổi bị hủy */
  const cancelSession = (horseId: string, dateKey: string, category: TrainingSession['cancelCategory'], reason: string, by?: string) => {
    const session = sessions.find((item) => item.horseId === horseId && item.sessionDate === dateKey);
    if (!session) return;
    session.status = 'CANCELLED';
    session.cancelCategory = category;
    session.cancelReason = reason;
    session.cancelledAt = `${dateKey}T05:00:00.000Z`;
    session.cancelledBy = by;
    session.summary = undefined;
    session.evaluation = undefined;
  };

  cancelSession('h_sao_mai', weekKey(-4, 2), 'TRAINER_CHANGED', 'Đổi kế hoạch tuần, dồn khối lượng sang thứ 4', 'u_ht_a');
  cancelSession('h_sao_mai', weekKey(-3, 4), 'GROOM_REPORTED', 'Mưa lớn, sân cỏ không sử dụng được', 'u_gr_1');

  /* Sao Mai: buổi kết thúc sớm 67% ở giai đoạn 2 tuần 1 */
  const earlyKey = weekKey(-1, 3);
  const early = sessions.find(
    (item) => item.horseId === 'h_sao_mai' && item.sessionDate === earlyKey && item.workoutType === 'BREEZE',
  );
  if (early) {
    finish(early, 0.67, 4, 30);
    early.earlyEndReason = 'HORSE_UNWELL';
    early.earlyEndNote = 'Ngựa giảm sải rõ ở lần chạy thứ ba, cho đi bộ về chuồng';
    early.endReason = 'STOPPED_BY_USER';
  }
  // Buổi lẻ bù khối lượng ngày hôm sau
  const makeUp: TrainingSession = {
    id: id('ses'),
    horseId: 'h_sao_mai',
    planId: 'plan_sao_mai',
    phaseId: 'plan_sao_mai_p2',
    sessionDate: weekKey(-1, 4),
    slotId: 'slot_4',
    groomId: 'u_gr_1',
    workoutType: 'BREEZE',
    distanceM: 400,
    repetitions: 1,
    intensity: 'HEAVY',
    surface: turf,
    trainerNote: 'Buổi lẻ bù khối lượng cho buổi kết thúc sớm hôm trước',
    status: 'SCHEDULED',
    ...base(createdAt),
  };
  finish(makeUp, 1, 7, 31);
  sessions.push(makeUp);

  /* Hắc Phong: mọi buổi từ T−10 bị hủy vì khóa huấn luyện */
  sessions
    .filter((session) => session.horseId === 'h_hac_phong' && session.sessionDate >= key(-10))
    .forEach((session) => {
      session.status = 'CANCELLED';
      session.cancelCategory = 'MEDICAL_BLOCK';
      session.cancelReason = 'Ngựa đang có khóa huấn luyện';
      session.cancelledAt = iso(-10);
      session.summary = undefined;
      session.evaluation = undefined;
    });

  /* Mây Trắng: buổi hôm qua đang Chờ đánh giá, kết thúc sớm 62% */
  const yesterday = key(-1);
  let mayTrang = sessions.find((session) => session.horseId === 'h_may_trang' && session.sessionDate === yesterday);
  if (!mayTrang) {
    mayTrang = {
      id: id('ses'),
      horseId: 'h_may_trang',
      planId: 'plan_may_trang',
      phaseId: 'plan_may_trang_p1',
      sessionDate: yesterday,
      slotId: 'slot_4',
      groomId: 'u_gr_3',
      workoutType: 'CANTER',
      distanceM: 1000,
      repetitions: 2,
      intensity: 'MODERATE',
      surface: dirt,
      status: 'SCHEDULED',
      ...base(createdAt),
    };
    sessions.push(mayTrang);
  }
  finish(mayTrang, 0.62, 5, 20);
  mayTrang.workoutType = 'CANTER';
  mayTrang.distanceM = 1000;
  mayTrang.repetitions = 2;
  mayTrang.status = 'AWAITING_REVIEW';
  mayTrang.earlyEndReason = 'TRAINER_ORDER';
  mayTrang.earlyEndNote = 'Huấn luyện viên cho dừng sau lần chạy thứ nhất để giữ sức';
  mayTrang.evaluation = undefined;

  /* Buổi tập hôm nay — luôn tồn tại */
  const todaysPlan: { horseId: string; slotId: string; type: WorkoutType; distanceM: number; repetitions: number; intensity: TrainingIntensity; surface: TrackSurface; groomId: string; planId: string; phaseId: string }[] = [
    { horseId: 'h_sao_mai', slotId: 'slot_2', type: 'BREEZE', distanceM: 400, repetitions: 3, intensity: 'HEAVY', surface: turf, groomId: 'u_gr_1', planId: 'plan_sao_mai', phaseId: 'plan_sao_mai_p2' },
    { horseId: 'h_bach_long', slotId: 'slot_3', type: 'TROT', distanceM: 3000, repetitions: 1, intensity: 'LIGHT', surface: dirt, groomId: 'u_gr_2', planId: 'plan_bach_long', phaseId: 'plan_bach_long_p1' },
    { horseId: 'h_lua_rung', slotId: 'slot_5', type: 'CANTER', distanceM: 1000, repetitions: 2, intensity: 'MODERATE', surface: dirt, groomId: 'u_gr_2', planId: 'plan_lua_rung', phaseId: 'plan_lua_rung_p2' },
    { horseId: 'h_gio_bac', slotId: 'slot_6', type: 'CANTER', distanceM: 2000, repetitions: 1, intensity: 'LIGHT', surface: dirt, groomId: 'u_gr_1', planId: 'plan_gio_bac', phaseId: 'plan_gio_bac_p1' },
  ];

  todaysPlan.forEach((spec) => {
    const note =
      spec.horseId === 'h_sao_mai'
        ? 'Giữ nhịp ở hai lần đầu, lần ba mới ép tốc độ. Báo ngay nếu ngựa đổi sải.'
        : undefined;
    const content = {
      slotId: spec.slotId,
      groomId: spec.groomId,
      workoutType: spec.type,
      distanceM: spec.distanceM,
      repetitions: spec.repetitions,
      intensity: spec.intensity,
      surface: spec.surface,
      trainerNote: note,
      status: 'SCHEDULED' as const,
    };

    const sameDay = sessions.filter(
      (session) => session.horseId === spec.horseId && session.sessionDate === todayKey,
    );

    if (sameDay.length > 0) {
      // Tuần mẫu đã có buổi hôm nay: sửa chính buổi ấy thành nội dung cần cho hôm nay,
      // không tạo thêm buổi mới để tránh hai buổi trùng khung giờ.
      Object.assign(sameDay[0], content, { edited: true, summary: undefined, evaluation: undefined });
      // Buổi thừa còn lại trong ngày thì hủy để không vi phạm giới hạn trong ngày.
      sameDay.slice(1).forEach((session) => {
        session.status = 'CANCELLED';
        session.cancelCategory = 'TRAINER_CHANGED';
        session.cancelReason = 'Dồn khối lượng vào buổi chính trong ngày';
        session.cancelledAt = iso(-1);
        session.cancelledBy = trainerOf[spec.horseId];
        session.summary = undefined;
        session.evaluation = undefined;
      });
      return;
    }

    sessions.push({
      id: id('ses'),
      horseId: spec.horseId,
      planId: spec.planId,
      phaseId: spec.phaseId,
      sessionDate: todayKey,
      ...content,
      ...base(iso(-1)),
    });
  });

  /* --- Y tế --- */
  const medicalRecords: MedicalRecord[] = [
    {
      id: 'mr_hac_phong',
      horseId: 'h_hac_phong',
      examDate: key(-10),
      reason: 'INCIDENT',
      symptoms: 'Đi khập khiễng chân trước trái sau buổi nước rút, vùng cẳng sưng và ấm.',
      diagnosis: 'Viêm gân gấp chân trước trái',
      severity: 'SEVERE',
      treatmentPlan: 'Phác đồ 6 tuần: chườm lạnh 3 lần mỗi ngày, băng ép cố định, nghỉ tập hoàn toàn 4 tuần đầu.',
      prescriptions: [{ drug: 'Phenylbutazone', dosage: '2 g uống, 2 lần mỗi ngày', days: 5 }],
      careInstruction: 'Chườm lạnh 20 phút sáng và chiều. Không dắt ra sân. Báo ngay nếu ngựa bỏ ăn.',
      recheckDate: key(4),
      noRaceUntil: key(45),
      cost: 18_000_000,
      status: 'IN_TREATMENT',
      createdBy: 'u_vet_1',
      ...base(iso(-10)),
    },
    {
      id: 'mr_bach_long',
      horseId: 'h_bach_long',
      examDate: key(-1),
      reason: 'INCIDENT',
      symptoms: 'Bỏ một phần bữa sáng, thân nhiệt 38,8 °C, thở nhanh hơn bình thường.',
      diagnosis: 'Nghi nhiễm khuẩn đường hô hấp nhẹ',
      severity: 'MODERATE',
      treatmentPlan: 'Theo dõi thân nhiệt 2 lần mỗi ngày, giữ ấm chuồng, chỉ vận động nhẹ.',
      prescriptions: [{ drug: 'Trimethoprim-sulfa', dosage: '30 mg/kg uống, 2 lần mỗi ngày', days: 7 }],
      careInstruction: 'Đo thân nhiệt sáng và chiều, ghi lại số đo. Cho uống thuốc sau bữa ăn.',
      recheckDate: key(2),
      cost: 1_500_000,
      status: 'IN_TREATMENT',
      sourceType: 'INCIDENT',
      sourceId: 'inc_bach_long',
      createdBy: 'u_vet_1',
      ...base(iso(-1)),
    },
    {
      id: 'mr_hoang_kim',
      horseId: 'h_hoang_kim',
      examDate: key(-3),
      reason: 'INCIDENT',
      symptoms: 'Sốt, ho khan, chảy dịch mũi trong.',
      diagnosis: 'Nghi cúm ngựa — cách ly theo dõi',
      severity: 'MODERATE',
      treatmentPlan: 'Cách ly 14 ngày, hạ sốt khi thân nhiệt trên 39 °C, theo dõi đàn cùng khu.',
      prescriptions: [{ drug: 'Flunixin meglumine', dosage: '1,1 mg/kg tiêm tĩnh mạch', days: 3 }],
      careInstruction: 'Chỉ một nhân viên chăm sóc ra vào ô cách ly. Sát trùng dụng cụ sau mỗi lần dùng.',
      recheckDate: key(1),
      cost: 2_000_000,
      status: 'IN_TREATMENT',
      createdBy: 'u_vet_2',
      ...base(iso(-3)),
    },
  ];

  const medicalFollowUps = [
    {
      id: id('mf'),
      recordId: 'mr_hac_phong',
      date: key(-3),
      note: 'Sưng giảm rõ, vùng cẳng còn ấm nhẹ. Tiếp tục chườm lạnh, bắt đầu dắt bộ 10 phút mỗi ngày.',
      cost: 800_000,
      createdBy: 'u_vet_1',
      ...base(iso(-3)),
    },
  ];

  const healthStatusLogs = [
    { id: id('hs'), horseId: 'h_hac_phong', fromStatus: 'ELIGIBLE' as const, toStatus: 'INJURED' as const, reason: 'Viêm gân gấp chân trước trái', recordId: 'mr_hac_phong', changedBy: 'u_vet_1', changedAt: iso(-10), ...base(iso(-10)) },
    { id: id('hs'), horseId: 'h_bach_long', fromStatus: 'ELIGIBLE' as const, toStatus: 'UNDER_OBSERVATION' as const, reason: 'Sốt 38,8 °C, nghi nhiễm khuẩn hô hấp', recordId: 'mr_bach_long', changedBy: 'u_vet_1', changedAt: iso(-1), ...base(iso(-1)) },
    { id: id('hs'), horseId: 'h_hoang_kim', fromStatus: 'ELIGIBLE' as const, toStatus: 'QUARANTINED' as const, reason: 'Nghi cúm ngựa, chuyển ô cách ly C-01', recordId: 'mr_hoang_kim', changedBy: 'u_vet_2', changedAt: iso(-3), ...base(iso(-3)) },
  ];

  const injuryMarks = [
    {
      id: 'im_hac_phong',
      horseId: 'h_hac_phong',
      region: 'FORE_CANNON' as const,
      side: 'LEFT' as const,
      description: 'Viêm gân gấp, sưng rõ mặt sau cẳng chân',
      severity: 'MODERATE' as const,
      detectedAt: key(-10),
      recordId: 'mr_hac_phong',
      ...base(iso(-10)),
    },
  ];

  const injuryUpdates = [
    { id: id('iu'), markId: 'im_hac_phong', date: key(-10), severity: 'SEVERE' as const, note: 'Sưng nóng rõ, ngựa không chịu tải chân trái.', createdBy: 'u_vet_1', ...base(iso(-10)) },
    { id: id('iu'), markId: 'im_hac_phong', date: key(-3), severity: 'MODERATE' as const, note: 'Sưng giảm, còn ấm nhẹ khi sờ.', createdBy: 'u_vet_1', ...base(iso(-3)) },
  ];

  const trainingLocks = [
    {
      id: 'lock_hac_phong',
      horseId: 'h_hac_phong',
      reason: 'Viêm gân chân trước trái — cấm tập mọi cường độ',
      expectedLiftDate: key(25),
      placedBy: 'u_vet_1',
      placedAt: iso(-10),
      ...base(iso(-10)),
    },
  ];

  const careSchedules: CareSchedule[] = [
    { id: id('cs'), horseId: 'h_sao_mai', type: 'VACCINE', name: 'Vắc-xin cúm ngựa', dueDate: key(3), intervalDays: 180, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_sao_mai', type: 'FARRIER', dueDate: key(20), intervalDays: 42, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_thien_ma', type: 'DEWORMING', dueDate: key(-2), intervalDays: 90, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_thien_ma', type: 'VACCINE', name: 'Vắc-xin uốn ván', dueDate: key(48), intervalDays: 180, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_gio_bac', type: 'FARRIER', dueDate: key(10), intervalDays: 42, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_gio_bac', type: 'DEWORMING', dueDate: key(35), intervalDays: 90, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_bach_long', type: 'VACCINE', name: 'Vắc-xin cúm ngựa', dueDate: key(62), intervalDays: 180, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_bach_long', type: 'FARRIER', dueDate: key(15), intervalDays: 42, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_hac_phong', type: 'FARRIER', dueDate: key(6), intervalDays: 42, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_lua_rung', type: 'DEWORMING', dueDate: key(28), intervalDays: 90, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_may_trang', type: 'VACCINE', name: 'Vắc-xin cúm ngựa', dueDate: key(75), intervalDays: 180, ...base(createdAt) },
    { id: id('cs'), horseId: 'h_hoang_kim', type: 'FARRIER', dueDate: key(31), intervalDays: 42, ...base(createdAt) },
  ];

  /* --- Flow 4 --- */
  const dietPlans: DietPlan[] = activeHorses
    .filter((horseId) => horseId !== 'h_anh_duong')
    .map((horseId) => ({
      id: id('dp'),
      horseId,
      revision: 1,
      status: 'APPROVED' as const,
      meals: [
        { meal: 'MORNING' as const, items: [{ kind: 'GRAIN' as const, name: 'Yến mạch cán', amount: 2.5, unit: 'kg' }, { kind: 'HAY' as const, name: 'Cỏ khô Timothy', amount: 4, unit: 'kg' }] },
        { meal: 'NOON' as const, items: [{ kind: 'HAY' as const, name: 'Cỏ khô Timothy', amount: 3, unit: 'kg' }] },
        { meal: 'AFTERNOON' as const, items: [{ kind: 'GRAIN' as const, name: 'Cám hỗn hợp', amount: 2, unit: 'kg' }, { kind: 'VITAMIN' as const, name: 'Vitamin E', amount: 1, unit: 'liều' }] },
        { meal: 'EVENING' as const, items: [{ kind: 'HAY' as const, name: 'Cỏ khô Timothy', amount: 4, unit: 'kg' }] },
      ],
      proposedBy: 'u_ht_a',
      approvedBy: 'u_vet_1',
      ...base(iso(-40)),
    }));

  dietPlans.push({
    id: id('dp'),
    horseId: 'h_lua_rung',
    revision: 2,
    status: 'PENDING',
    meals: [
      { meal: 'MORNING', items: [{ kind: 'GRAIN', name: 'Yến mạch cán', amount: 3, unit: 'kg' }, { kind: 'HAY', name: 'Cỏ khô Timothy', amount: 4, unit: 'kg' }] },
      { meal: 'NOON', items: [{ kind: 'HAY', name: 'Cỏ khô Timothy', amount: 3, unit: 'kg' }] },
      { meal: 'AFTERNOON', items: [{ kind: 'GRAIN', name: 'Cám hỗn hợp', amount: 2.5, unit: 'kg' }, { kind: 'VITAMIN', name: 'Điện giải', amount: 1, unit: 'liều' }] },
      { meal: 'EVENING', items: [{ kind: 'HAY', name: 'Cỏ khô Timothy', amount: 4, unit: 'kg' }] },
    ],
    proposedBy: 'u_ht_b',
    ...base(iso(-2)),
  });

  const incidents = [
    {
      id: 'inc_bach_long',
      horseId: 'h_bach_long',
      type: 'NOT_EATING' as const,
      description: 'Bỏ một phần bữa sáng, đứng tách góc chuồng, sờ tai thấy nóng.',
      photos: ['/stay-gold.jpg'],
      urgent: true,
      status: 'IN_PROGRESS' as const,
      reportedBy: 'u_gr_2',
      handledBy: 'u_vet_1',
      ...base(iso(-1, 7)),
    },
  ];

  const supplyItems = [
    { id: 'sup_oat', name: 'Yến mạch cán', group: 'FEED' as const, unit: 'kg', ...base(createdAt) },
    { id: 'sup_hay', name: 'Cỏ khô Timothy', group: 'FEED' as const, unit: 'kg', ...base(createdAt) },
    { id: 'sup_vite', name: 'Vitamin E', group: 'MEDICINE' as const, unit: 'liều', ...base(createdAt) },
    { id: 'sup_elec', name: 'Điện giải', group: 'MEDICINE' as const, unit: 'liều', ...base(createdAt) },
    { id: 'sup_bandage', name: 'Băng quấn chân', group: 'TOOL' as const, unit: 'cuộn', ...base(createdAt) },
    { id: 'sup_disinf', name: 'Thuốc sát trùng', group: 'MEDICINE' as const, unit: 'chai', ...base(createdAt) },
  ];

  const zoneStocks = [
    { id: id('zs'), zoneId: 'zone_a', itemId: 'sup_oat', quantity: 420, minQuantity: 150, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_a', itemId: 'sup_hay', quantity: 860, minQuantity: 300, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_a', itemId: 'sup_vite', quantity: 64, minQuantity: 30, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_a', itemId: 'sup_bandage', quantity: 28, minQuantity: 12, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_b', itemId: 'sup_oat', quantity: 380, minQuantity: 150, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_b', itemId: 'sup_hay', quantity: 720, minQuantity: 300, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_b', itemId: 'sup_vite', quantity: 11, minQuantity: 30, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_b', itemId: 'sup_elec', quantity: 45, minQuantity: 20, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_c', itemId: 'sup_disinf', quantity: 18, minQuantity: 8, ...base(createdAt) },
    { id: id('zs'), zoneId: 'zone_c', itemId: 'sup_bandage', quantity: 9, minQuantity: 12, ...base(createdAt) },
  ];

  const restockRequests = [
    {
      id: id('rr'),
      zoneId: 'zone_b',
      itemId: 'sup_vite',
      quantity: 60,
      reason: 'Tồn kho khu B còn 11 liều, dưới ngưỡng tối thiểu 30.',
      status: 'PENDING' as const,
      requestedBy: 'u_gr_3',
      ...base(iso(-1, 14)),
    },
  ];

  /* --- Flow 5 --- */
  const races = [
    { id: 'race_summer', name: 'Giải Mùa Hè', date: key(-40), venue: 'Trường đua Đại Nam', distanceM: 1800, surface: turf, fee: 12_000_000, purse: 500_000_000, registrationDeadline: key(-55), status: 'FINISHED' as const, minAge: 3, ...base(iso(-90)) },
    { id: 'race_autumn', name: 'Cúp Mùa Thu', date: key(30), venue: 'Trường đua Phú Thọ', distanceM: 1600, surface: turf, fee: 15_000_000, purse: 800_000_000, registrationDeadline: key(14), status: 'OPEN' as const, minAge: 3, ...base(iso(-20)) },
    { id: 'race_sprint', name: 'Giải Sprint Tháng 11', date: key(45), venue: 'Trường đua Đại Nam', distanceM: 1200, surface: dirt, fee: 9_000_000, purse: 350_000_000, registrationDeadline: key(28), status: 'OPEN' as const, minAge: 3, ...base(iso(-15)) },
  ];

  const raceRegistrations = [
    { id: id('rg'), raceId: 'race_summer', horseId: 'h_gio_bac', status: 'REGISTERED' as const, createdBy: 'u_ht_a', ownerDecisionBy: 'u_ow_1', ...base(iso(-56)) },
    { id: id('rg'), raceId: 'race_summer', horseId: 'h_may_trang', status: 'REGISTERED' as const, createdBy: 'u_ht_b', ownerDecisionBy: 'u_ow_1', ...base(iso(-56)) },
    { id: id('rg'), raceId: 'race_autumn', horseId: 'h_sao_mai', status: 'PENDING_OWNER' as const, createdBy: 'u_ht_a', ...base(iso(-4)) },
    { id: id('rg'), raceId: 'race_autumn', horseId: 'h_hac_phong', status: 'CANCELLED' as const, createdBy: 'u_ht_b', cancelReason: 'Đang có khóa huấn luyện', ...base(iso(-12)) },
    { id: id('rg'), raceId: 'race_sprint', horseId: 'h_lua_rung', status: 'REGISTERED' as const, createdBy: 'u_ht_a', ownerDecisionBy: 'u_ow_1', ...base(iso(-8)) },
  ];

  const raceResults = [
    { id: id('rres'), raceId: 'race_summer', horseId: 'h_gio_bac', rank: 2, timeSeconds: 112.35, prize: 150_000_000, ...base(iso(-40)) },
    { id: id('rres'), raceId: 'race_summer', horseId: 'h_may_trang', rank: 5, timeSeconds: 114.82, prize: 0, ...base(iso(-40)) },
  ];

  /* --- Chi phí --- */
  const expenses: Expense[] = [];
  for (let month = 2; month >= 0; month -= 1) {
    const date = key(-month * 30 - 2);
    ['zone_a', 'zone_b'].forEach((zoneId) => {
      expenses.push({ id: id('ex'), zoneId, category: 'OPERATION' as const, amount: 40_000_000, date, note: 'Chi phí vận hành chuồng trại theo tháng', ...base(iso(-month * 30 - 2)) });
    });
    activeHorses.forEach((horseId) => {
      expenses.push({ id: id('ex'), horseId, category: 'OTHER' as const, amount: 5_000_000, date, note: 'Chi phí chăm sóc hằng tháng', ...base(iso(-month * 30 - 2)) });
    });
  }
  medicalRecords.forEach((record) => {
    if (!record.cost) return;
    expenses.push({ id: id('ex'), horseId: record.horseId, category: 'MEDICAL' as const, amount: record.cost, date: record.examDate, sourceType: 'MEDICAL_RECORD', sourceId: record.id, note: record.diagnosis, ...base(iso(-10)) });
  });
  medicalFollowUps.forEach((followUp) => {
    if (!followUp.cost) return;
    const record = medicalRecords.find((item) => item.id === followUp.recordId);
    expenses.push({ id: id('ex'), horseId: record?.horseId, category: 'MEDICAL' as const, amount: followUp.cost, date: followUp.date, sourceType: 'MEDICAL_FOLLOWUP', sourceId: followUp.id, note: 'Ghi chú theo dõi', ...base(iso(-3)) });
  });
  raceRegistrations
    .filter((registration) => registration.status === 'REGISTERED')
    .forEach((registration) => {
      const race = races.find((item) => item.id === registration.raceId);
      if (!race) return;
      expenses.push({ id: id('ex'), horseId: registration.horseId, category: 'RACE_FEE' as const, amount: race.fee, date: race.registrationDeadline, sourceType: 'RACE_REGISTRATION', sourceId: registration.id, note: `Phí đăng ký ${race.name}`, ...base(createdAt) });
    });

  /* --- Thông báo --- */
  const notify = (userId: string, level: 'NORMAL' | 'URGENT', title: string, body: string, link: string, offsetDays: number) => ({
    id: id('nt'),
    userId,
    level,
    title,
    body,
    link,
    ...base(iso(offsetDays, 8)),
  });

  const notifications = [
    notify('u_ht_a', 'NORMAL', 'Gió Bấc giảm cân bất thường', 'Cân nặng giảm hơn 5% trong 14 ngày (505 kg → 478 kg).', '/horses/h_gio_bac', -1),
    notify('u_ht_b', 'NORMAL', 'Giáo án của Lửa Rừng cần xem lại', 'Ngựa vừa chuyển từ Khu A sang Khu B, giáo án đang áp dụng được gắn cờ.', '/plans/plan_lua_rung', -3),
    notify('u_ht_b', 'NORMAL', 'Mây Trắng có buổi chờ đánh giá', 'Buổi hôm qua kết thúc sớm ở 62% khối lượng.', '/training/review', -1),
    notify('u_vet_1', 'URGENT', 'Thân nhiệt Bạch Long 38,8 °C', 'Vượt ngưỡng 38,6 °C, cần kiểm tra ngay.', '/medical/board', -1),
    notify('u_vet_1', 'NORMAL', 'Thiên Mã quá hạn tẩy giun', 'Mục lịch tẩy giun đã quá hạn 2 ngày.', '/medical/care', -1),
    notify('u_ow_1', 'NORMAL', 'Có nhận xét mới cho Sao Mai', 'Huấn luyện viên vừa hoàn tất đánh giá buổi tập.', '/horses/h_sao_mai', -1),
    notify('u_ow_1', 'NORMAL', 'Cúp Mùa Thu chờ bạn duyệt', 'Đăng ký của Sao Mai đang chờ chủ đại diện quyết định.', '/races/approvals', -4),
    notify('u_gr_1', 'NORMAL', 'Lịch tập tuần này', 'Bạn được phân công 12 buổi tập trong tuần.', '/training/today', -2),
  ];

  /* --- Nhật ký thao tác --- */
  const log = (userId: string, role: string, action: string, entityType: string, entityId: string, offsetDays: number, reason?: string) => ({
    id: id('al'),
    at: iso(offsetDays, 10),
    userId,
    userName: users.find((user) => user.id === userId)?.name ?? 'Hệ thống',
    role: role as never,
    action,
    entityType,
    entityId,
    reason,
    ...base(iso(offsetDays, 10)),
  });

  const auditLogs = [
    log('u_cm', 'CLUB_MANAGER', 'Tạo hồ sơ ngựa', 'Horse', 'h_sao_mai', -80),
    log('u_cm', 'CLUB_MANAGER', 'Xếp ô chuồng', 'StallAssignment', 'h_sao_mai', -80),
    log('u_cm', 'CLUB_MANAGER', 'Gán quyền sở hữu', 'Ownership', 'h_sao_mai', -80),
    log('u_ht_a', 'HEAD_TRAINER', 'Lập giáo án', 'TrainingPlan', 'plan_sao_mai', -35),
    log('u_ht_a', 'HEAD_TRAINER', 'Sinh lịch tập', 'TrainingSession', 'plan_sao_mai', -35),
    log('u_vet_1', 'VETERINARIAN', 'Ghi hồ sơ khám', 'MedicalRecord', 'mr_hac_phong', -10),
    log('u_vet_1', 'VETERINARIAN', 'Đổi trạng thái sức khỏe', 'Horse', 'h_hac_phong', -10, 'Viêm gân gấp chân trước trái'),
    log('u_vet_1', 'VETERINARIAN', 'Đặt khóa huấn luyện', 'TrainingLock', 'lock_hac_phong', -10, 'Viêm gân chân trước trái — cấm tập'),
    log('u_vet_2', 'VETERINARIAN', 'Đổi trạng thái sức khỏe', 'Horse', 'h_hoang_kim', -3, 'Nghi cúm ngựa'),
    log('u_cm', 'CLUB_MANAGER', 'Chuyển ô chuồng', 'StallAssignment', 'h_lua_rung', -3, 'Cân đối sức chứa giữa hai khu'),
    log('u_gr_2', 'GROOM', 'Gửi báo cáo sự cố', 'Incident', 'inc_bach_long', -1),
    log('u_vet_1', 'VETERINARIAN', 'Ghi hồ sơ khám', 'MedicalRecord', 'mr_bach_long', -1),
    log('u_ht_b', 'HEAD_TRAINER', 'Đánh giá buổi tập', 'TrainingSession', 'plan_may_trang', -1),
    log('u_cm', 'CLUB_MANAGER', 'Đổi vòng đời ngựa', 'Horse', 'h_anh_duong', -12, 'Ngựa 12 tuổi, kết thúc sự nghiệp thi đấu'),
    log('u_cm', 'CLUB_MANAGER', 'Xóa hồ sơ ngựa', 'Horse', 'h_nhap_nham', -2, 'Tạo trùng hồ sơ'),
  ];

  const lifecycleEvents = [
    { id: id('le'), horseId: 'h_anh_duong', from: 'ACTIVE' as const, to: 'RETIRED' as const, reason: 'Ngựa 12 tuổi, kết thúc sự nghiệp thi đấu', by: 'u_cm', at: iso(-12), ...base(iso(-12)) },
    { id: id('le'), horseId: 'h_phong_vu', from: 'ACTIVE' as const, to: 'TRANSFERRED' as const, reason: 'Chủ ngựa bán cho câu lạc bộ khác', by: 'u_cm', at: iso(-60), ...base(iso(-60)) },
  ];

  const horsePhotos = horses
    .filter((item) => item.avatar)
    .map((item) => ({
      id: id('hp'),
      horseId: item.id,
      src: item.avatar!,
      caption: 'Ảnh hồ sơ',
      uploadedBy: 'u_cm',
      isAvatar: true,
      ...base(createdAt),
    }));

  return {
    meta: { seededAt: T.toISOString(), schema },
    settings: {
      clockMode: 'REAL',
      clockOffsetMs: 0,
      simSpeed: 5,
      defaultDailyRate: 1_200_000,
      defaultMaxHeartRate: 230,
    },
    users,
    zones: [zoneA, zoneB, zoneC],
    stalls,
    slots: SLOTS,
    horses,
    stallAssignments,
    ownerships,
    bodyMeasurements,
    horsePhotos,
    lifecycleEvents,
    plans,
    phases,
    phaseWorkouts,
    sessions,
    alerts: [],
    maxHeartRates,
    medicalRecords,
    medicalFollowUps,
    healthStatusLogs,
    injuryMarks,
    injuryUpdates,
    trainingLocks,
    careSchedules,
    dietPlans,
    dailyTasks: [],
    incidents,
    supplyItems,
    zoneStocks,
    restockRequests,
    races,
    raceRegistrations,
    raceResults,
    expenses,
    notifications,
    auditLogs,
    taskDismissals: [],
  };
}
