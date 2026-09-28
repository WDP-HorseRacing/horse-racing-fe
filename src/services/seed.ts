// Dữ liệu khởi tạo cho buổi demo. Mọi mốc thời gian tính tương đối so với hôm nay (T) nên mở lúc nào
// dữ liệu cũng đang ở hiện tại. Bộ số ngẫu nhiên có hạt giống cố định để lần nào cũng ra như nhau.
//
// Kịch bản được phủ:
// - Khu A và Khu C cùng một HT (Quân); Khu B của HT Nam; Khu D đang bảo trì, chưa có HT; HT Long chưa có khu.
// - Ngựa ở mọi trạng thái: chờ xếp khu, chờ xếp ô, chờ Groom, giải nghệ, chuyển nhượng, đã xóa, 4 trạng thái sức khỏe.
// - Lớp ở đủ 4 trạng thái; buổi hôm nay của lớp C1 là buổi Nặng (Bạch Long sẽ bị chặn y tế khi bắt đầu).
// - Lớp C2 có buổi hôm qua đang chờ đánh giá, buổi hôm nay mức Trung bình, một ngựa vào lớp giữa chừng.
// - Y tế: yêu cầu khám khẩn đang chờ, bệnh án mở có khóa, bệnh án đã đóng có chi phí, quá hạn khám định kỳ.
import type {
  AppNotification,
  AuditLog,
  BodyMeasurement,
  ClassEnrollment,
  ClassSession,
  Database,
  Evaluation,
  ExamRequest,
  Examination,
  HealthStatusLog,
  Horse,
  HorseMaxHeartRate,
  LifecycleEvent,
  MedicalCase,
  NotificationLevel,
  SessionAttendance,
  SessionSummary,
  Stall,
  TrainingAlert,
  TrainingClass,
  TrainingLock,
  TrainingProgram,
  TrainingSubject,
  User,
  UserRole,
  WorkoutType,
  Zone,
} from '../types/domain';
import { addDays, toDateKey } from '../lib/format';
import { classEndDate, generateSessionPlan, programTotalWeeks, type PlannedSession } from '../lib/class-schedule';
import { links } from '../lib/links';

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

const PACE: Record<WorkoutType, { speed: number; hr: number }> = {
  WALK: { speed: 1.8, hr: 85 },
  TROT: { speed: 4.2, hr: 120 },
  CANTER: { speed: 10, hr: 160 },
  BREEZE: { speed: 16.2, hr: 205 },
  TIME_TRIAL: { speed: 16.8, hr: 214 },
};

const NOTES_GOOD = [
  'Ngựa vào bài đều, nhịp tim hồi phục tốt sau phần chạy nhanh. Giữ nguyên khối lượng cho tuần tới.',
  'Sải chân dài và ổn định, phản xạ tốt với hiệu lệnh. Có thể tăng nhẹ cự ly ở giai đoạn sau.',
  'Hoàn thành đủ khối lượng, thở đều ở cuối bài. Tinh thần tốt, ăn uống bình thường sau tập.',
  'Tốc độ phần chính nhích lên so với tuần trước, nhịp tim cao nhất vẫn trong ngưỡng an toàn.',
];
const NOTES_OK = [
  'Khởi động hơi chậm nhưng bắt nhịp tốt ở nửa sau. Cần chú ý phần khởi động kỹ hơn.',
  'Đạt khối lượng nhưng hồi phục chậm hơn thường lệ. Theo dõi thêm ở buổi kế tiếp.',
];

/* ===== seed ===== */

export function buildSeed(today: Date, schema: number): Database {
  seq = 0;
  const rand = mulberry32(20260928);
  const jitter = (value: number, spread: number) => Math.round((value + (rand() - 0.5) * spread) * 10) / 10;

  const T = new Date(today);
  T.setHours(12, 0, 0, 0);
  const iso = (offsetDays: number, hour = 9, minute = 0) => {
    const date = addDays(T, offsetDays);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const key = (offsetDays: number) => toDateKey(addDays(T, offsetDays));
  const at = (dateKey: string, time: string) => new Date(`${dateKey}T${time}:00`).toISOString();
  const TODAY = key(0);
  const createdAt = iso(-150);

  /* --- Người dùng --- */
  const user = (uid: string, name: string, email: string, phone: string, role: UserRole, active = true): User => ({
    id: uid,
    name,
    email,
    phone,
    role,
    avatar: '',
    active,
    ...base(createdAt),
  });

  const users: User[] = [
    user('u_cm', 'Nguyễn Thị Lan', 'lan.nguyen@horseracing.vn', '0903 118 245', 'CLUB_MANAGER'),
    user('u_ht_a', 'Trần Minh Quân', 'quan.tran@horseracing.vn', '0912 470 318', 'HEAD_TRAINER'),
    user('u_ht_b', 'Lê Hoàng Nam', 'nam.le@horseracing.vn', '0938 205 764', 'HEAD_TRAINER'),
    user('u_ht_c', 'Phan Đức Long', 'long.phan@horseracing.vn', '0917 336 829', 'HEAD_TRAINER'),
    user('u_vet_1', 'Phạm Thu Hà', 'ha.pham@horseracing.vn', '0977 634 190', 'VETERINARIAN'),
    user('u_vet_2', 'Đỗ Văn Khoa', 'khoa.do@horseracing.vn', '0964 812 507', 'VETERINARIAN'),
    user('u_gr_1', 'Võ Văn Tài', 'tai.vo@horseracing.vn', '0355 902 148', 'GROOM'),
    user('u_gr_2', 'Nguyễn Văn Bình', 'binh.nguyen@horseracing.vn', '0386 471 025', 'GROOM'),
    user('u_gr_3', 'Hồ Thị Mai', 'mai.ho@horseracing.vn', '0327 658 913', 'GROOM'),
    user('u_gr_4', 'Lê Văn Lực', 'luc.le@horseracing.vn', '0368 240 517', 'GROOM'),
    user('u_ow_1', 'Lý Quốc Thịnh', 'thinh.ly@horseracing.vn', '0908 341 772', 'HORSE_OWNER'),
    user('u_ow_2', 'Châu Ngọc Anh', 'anh.chau@horseracing.vn', '0945 217 690', 'HORSE_OWNER'),
    user('u_ow_3', 'Trương Gia Huy', 'huy.truong@horseracing.vn', '0989 503 471', 'HORSE_OWNER'),
    user('u_ow_4', 'Đặng Minh Phúc', 'phuc.dang@horseracing.vn', '0932 715 406', 'HORSE_OWNER', false),
  ];

  /* --- Khu và ô chuồng --- */
  const zones: Zone[] = [
    { id: 'zone_a', code: 'A', name: 'Khu A', headTrainerId: 'u_ht_a', status: 'ACTIVE', ...base(createdAt) },
    { id: 'zone_b', code: 'B', name: 'Khu B', headTrainerId: 'u_ht_b', status: 'ACTIVE', ...base(createdAt) },
    { id: 'zone_c', code: 'C', name: 'Khu C', headTrainerId: 'u_ht_a', status: 'ACTIVE', ...base(createdAt) },
    { id: 'zone_d', code: 'D', name: 'Khu D', status: 'MAINTENANCE', statusReason: 'Thay mái che và hệ thống thoát nước', ...base(createdAt) },
  ];

  const stalls: Stall[] = [];
  const addStalls = (zoneId: string, prefix: string, count: number) => {
    for (let index = 1; index <= count; index += 1) {
      stalls.push({
        id: `stall_${prefix.toLowerCase()}${index}`,
        code: `${prefix}-${String(index).padStart(2, '0')}`,
        zoneId,
        status: 'AVAILABLE',
        ...base(createdAt),
      });
    }
  };
  addStalls('zone_a', 'A', 8);
  addStalls('zone_b', 'B', 6);
  addStalls('zone_c', 'C', 4);
  addStalls('zone_d', 'D', 4);
  const a8 = stalls.find((stall) => stall.id === 'stall_a8')!;
  a8.status = 'MAINTENANCE';
  a8.maintenanceNote = 'Thay sàn cao su';

  /* --- Ngựa --- */
  const birth = (age: number) => toDateKey(addDays(T, -age * 365 - 40));
  const chip = (n: number) => `7040981000000${String(n).padStart(2, '0')}`;
  const horse = (
    hid: string,
    name: string,
    sex: Horse['sex'],
    age: number,
    extra: Partial<Horse> = {},
  ): Horse => ({
    id: hid,
    name,
    sex,
    breed: 'Thoroughbred',
    color: 'Nâu hạt dẻ',
    birthDate: birth(age),
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'ACTIVE',
    ...base(iso(-120)),
    ...extra,
  });

  const horses: Horse[] = [
    horse('h_sao_mai', 'Sao Mai', 'FEMALE', 4, {
      chipNumber: chip(1), distancePreference: 'MILER', color: 'Nâu sáng', avatar: '/winx.jpg',
      sireId: 'h_gio_bac', damId: 'h_anh_duong', ownerId: 'u_ow_1', zoneId: 'zone_a', stallId: 'stall_a1', groomId: 'u_gr_1',
    }),
    horse('h_gio_bac', 'Gió Bấc', 'MALE', 9, {
      chipNumber: chip(2), distancePreference: 'STAYER', color: 'Xám tro', avatar: '/gold-ship.png',
      sireId: 'h_polaris', damId: 'h_dawn_rose', ownerId: 'u_ow_1', zoneId: 'zone_a', stallId: 'stall_a2', groomId: 'u_gr_1',
    }),
    horse('h_bach_long', 'Bạch Long', 'GELDING', 5, {
      chipNumber: chip(3), distancePreference: 'SPRINTER', color: 'Trắng ngà', avatar: '/stay-gold.jpg',
      healthStatus: 'UNDER_OBSERVATION', ownerId: 'u_ow_3', zoneId: 'zone_a', stallId: 'stall_a3', groomId: 'u_gr_2',
    }),
    horse('h_hac_phong', 'Hắc Phong', 'MALE', 6, {
      chipNumber: chip(4), distancePreference: 'MILER', color: 'Đen tuyền', avatar: '/point-flag.jpg',
      healthStatus: 'INJURED', ownerId: 'u_ow_2', zoneId: 'zone_b', stallId: 'stall_b1', groomId: 'u_gr_3',
    }),
    horse('h_hoang_kim', 'Hoàng Kim', 'FEMALE', 3, {
      chipNumber: chip(5), distancePreference: 'SPRINTER', color: 'Vàng kim', avatar: '/vegas-showgirl.jpg',
      healthStatus: 'QUARANTINED', ownerId: 'u_ow_3', zoneId: 'zone_c', stallId: 'stall_c1', groomId: 'u_gr_4',
    }),
    horse('h_thien_ma', 'Thiên Mã', 'MALE', 4, {
      chipNumber: chip(6), distancePreference: 'STAYER', color: 'Nâu sẫm', avatar: '/sunday-silence.jpg',
      sireId: 'h_gio_bac', ownerId: 'u_ow_2', zoneId: 'zone_b', stallId: 'stall_b2', groomId: 'u_gr_3',
    }),
    horse('h_lua_rung', 'Lửa Rừng', 'FEMALE', 5, {
      chipNumber: chip(7), distancePreference: 'SPRINTER', color: 'Hung đỏ', avatar: '/golden-sash.jpg',
      ownerId: 'u_ow_1', zoneId: 'zone_b', groomId: 'u_gr_2',
    }),
    horse('h_may_trang', 'Mây Trắng', 'GELDING', 7, {
      chipNumber: chip(8), distancePreference: 'STAYER', breed: 'Arabian', color: 'Xám bạc', avatar: '/Mejiro-McQueen.jpg',
      ownerId: 'u_ow_1', zoneId: 'zone_b', stallId: 'stall_b3', groomId: 'u_gr_3',
    }),
    horse('h_ngoc_tuyet', 'Ngọc Tuyết', 'FEMALE', 4, {
      chipNumber: chip(9), distancePreference: 'MILER', color: 'Xám trắng', avatar: '/vegas-magic.jpg',
      ownerId: 'u_ow_2', zoneId: 'zone_b', stallId: 'stall_b4',
    }),
    horse('h_anh_duong', 'Ánh Dương', 'FEMALE', 12, {
      chipNumber: chip(10), distancePreference: 'MILER', color: 'Nâu đỏ', avatar: '/helen-street.jpg',
      lifecycleStatus: 'RETIRED', ownerId: 'u_ow_2', zoneId: 'zone_a', stallId: 'stall_a4', groomId: 'u_gr_1',
    }),
    horse('h_phong_vu', 'Phong Vũ', 'MALE', 8, {
      chipNumber: chip(11), distancePreference: 'MILER', avatar: '/street-cry.jpg',
      lifecycleStatus: 'TRANSFERRED', ownerId: 'u_ow_3',
    }),
    horse('h_polaris', 'Polaris', 'MALE', 19, {
      chipNumber: chip(12), color: 'Nâu sẫm', avatar: '/al-akbar.jpg',
      lifecycleStatus: 'RETIRED', ownerId: 'u_ow_1', zoneId: 'zone_c', stallId: 'stall_c2', groomId: 'u_gr_4',
    }),
    horse('h_dawn_rose', 'Dawn Rose', 'FEMALE', 18, {
      chipNumber: chip(13), color: 'Hạt dẻ sáng', avatar: '/MACHIAVELLIAN.jpg',
      lifecycleStatus: 'RETIRED', ownerId: 'u_ow_1', zoneId: 'zone_c', stallId: 'stall_c3', groomId: 'u_gr_4',
    }),
    horse('h_tia_chop', 'Tia Chớp', 'MALE', 3, {
      chipNumber: chip(14), distancePreference: 'SPRINTER', color: 'Đen ánh nâu', avatar: '/mike-kotsch-aZ4HBJf8Gmc-unsplash.jpg',
      ownerId: 'u_ow_3', ...base(iso(-2, 10)),
    }),
    horse('h_nhap_nham', 'Ngựa nhập nhầm', 'MALE', 5, {
      chipNumber: chip(15), ownerId: 'u_ow_4', ...base(iso(-3, 10)),
      deletedAt: iso(-2, 15), deletedBy: 'u_cm', deleteReason: 'Tạo trùng hồ sơ với Tia Chớp',
    }),
  ];
  const H = (hid: string) => horses.find((item) => item.id === hid)!;
  horses.forEach((item) => {
    if (!item.stallId) return;
    const stall = stalls.find((entry) => entry.id === item.stallId);
    if (stall) stall.status = 'OCCUPIED';
  });

  /* --- Nhịp tim tối đa (do bác sĩ đặt) — Mây Trắng cố ý chưa có --- */
  const maxHr: Record<string, number> = {
    h_sao_mai: 228,
    h_gio_bac: 220,
    h_bach_long: 232,
    h_hac_phong: 230,
    h_hoang_kim: 233,
    h_thien_ma: 226,
    h_lua_rung: 229,
    h_ngoc_tuyet: 230,
    h_phong_vu: 225,
    h_anh_duong: 218,
  };
  const maxHeartRates: HorseMaxHeartRate[] = Object.entries(maxHr).map(([horseId, value]) => ({
    id: id('mhr'),
    horseId,
    value,
    reason: horseId === 'h_gio_bac' ? 'Ngựa 9 tuổi, hạ ngưỡng an toàn theo tuổi' : 'Đặt theo kết quả khám tim mạch đầu mùa',
    createdBy: 'u_vet_1',
    active: true,
    ...base(iso(-100)),
  }));

  /* --- Chỉ số cơ thể (nhập tay) --- */
  const bodyMeasurements: BodyMeasurement[] = [];
  const measure = (
    horseId: string,
    type: BodyMeasurement['type'],
    value: number,
    measuredAt: string,
    by: string,
    extra: Partial<BodyMeasurement> = {},
  ) => {
    const normal = { WEIGHT: [400, 600], HEIGHT: [150, 175], BODY_CONDITION: [4, 6], TEMPERATURE: [37.2, 38.3] }[type];
    bodyMeasurements.push({
      id: id('bm'),
      horseId,
      type,
      value,
      measuredAt,
      recordedBy: by,
      abnormal: value < normal[0] || value > normal[1],
      ...base(measuredAt),
      ...extra,
    });
  };

  const inClub = ['h_sao_mai', 'h_gio_bac', 'h_bach_long', 'h_hac_phong', 'h_hoang_kim', 'h_thien_ma', 'h_lua_rung', 'h_may_trang', 'h_ngoc_tuyet', 'h_anh_duong', 'h_polaris', 'h_dawn_rose'];
  inClub.forEach((horseId, index) => {
    const groom = H(horseId).groomId ?? 'u_gr_3';
    const baseWeight = 468 + index * 5;
    for (let week = 11; week >= 0; week -= 1) {
      if (horseId === 'h_gio_bac' && week <= 2) continue;
      measure(horseId, 'WEIGHT', jitter(baseWeight, 6), iso(-week * 7 - 1, 7), groom);
    }
    for (let month = 3; month >= 1; month -= 1) {
      measure(horseId, 'HEIGHT', jitter(158 + (index % 6) * 2, 1), iso(-month * 30, 8), 'u_vet_1');
      measure(horseId, 'BODY_CONDITION', Math.round(jitter(5, 1.2)), iso(-month * 30, 8), 'u_vet_1');
    }
    for (let step = 4; step >= 1; step -= 1) {
      measure(horseId, 'TEMPERATURE', jitter(37.8, 0.5), iso(-step * 9, 6, 30), groom);
    }
  });
  // Gió Bấc: sụt cân hơn 5% trong 14 ngày (505 → 478 kg).
  [[14, 505], [10, 498], [6, 490], [1, 478]].forEach(([offset, value]) => {
    measure('h_gio_bac', 'WEIGHT', value, iso(-offset, 7), 'u_gr_1');
  });
  // Bạch Long: sốt 38,8 °C hôm qua — sinh yêu cầu khám khẩn.
  const blTempId = `bm_bl_temp`;
  bodyMeasurements.push({
    id: blTempId,
    horseId: 'h_bach_long',
    type: 'TEMPERATURE',
    value: 38.8,
    measuredAt: iso(-1, 6, 20),
    recordedBy: 'u_gr_2',
    abnormal: true,
    note: 'Ngựa uể oải, ăn ít buổi sáng',
    ...base(iso(-1, 6, 20)),
  });
  // Mây Trắng: nhập nhầm 612 kg, bác sĩ đã xóa kèm lý do.
  measure('h_may_trang', 'WEIGHT', 612, iso(-5, 7), 'u_gr_3', {
    deletedAt: iso(-5, 10),
    deletedBy: 'u_vet_2',
    deleteReason: 'Nhập nhầm số, cân lại được 512 kg',
  });
  measure('h_may_trang', 'WEIGHT', 512, iso(-5, 10, 5), 'u_vet_2');

  /* --- Môn học --- */
  const subject = (
    sid: string,
    name: string,
    workoutType: TrainingSubject['workoutType'],
    distanceM: number,
    repetitions: number,
    intensity: TrainingSubject['intensity'],
    surface: TrainingSubject['surface'],
    description: string,
    by = 'u_ht_a',
  ): TrainingSubject => ({ id: sid, name, workoutType, distanceM, repetitions, intensity, surface, description, createdBy: by, ...base(iso(-110)) });

  const subjects: TrainingSubject[] = [
    subject('sub_walk', 'Đi bộ thả lỏng', 'WALK', 2000, 1, 'LIGHT', 'TURF', 'Đi bộ trên đường cỏ, giữ nhịp tim dưới 90.'),
    subject('sub_trot', 'Kiệu nền', 'TROT', 3000, 1, 'LIGHT', 'DIRT', 'Nước kiệu đều trên sân cát, làm nóng cơ và khớp.'),
    subject('sub_canter_base', 'Canter nền', 'CANTER', 2000, 1, 'MEDIUM', 'TURF', 'Canter tốc độ vừa, xây nền sức bền.'),
    subject('sub_canter_light', 'Canter nhẹ', 'CANTER', 1600, 1, 'LIGHT', 'SYNTHETIC', 'Canter chậm trên sân tổng hợp, dùng cho ngày hồi phục.'),
    subject('sub_breeze_400', 'Nước rút 400 m', 'BREEZE', 400, 3, 'HEAVY', 'TURF', 'Ba lần nước rút 400 m, đi bộ hồi sức 60 giây giữa các lần.'),
    subject('sub_breeze_600', 'Nước rút 600 m', 'BREEZE', 600, 2, 'HEAVY', 'DIRT', 'Hai lần nước rút 600 m trên sân cát.', 'u_ht_b'),
    subject('sub_trial_1200', 'Chạy thử 1200 m', 'TIME_TRIAL', 1200, 1, 'MAX', 'TURF', 'Chạy tính giờ 1200 m, ghi thời gian và video.'),
    subject('sub_canter_long', 'Canter dài', 'CANTER', 1000, 2, 'MEDIUM', 'SYNTHETIC', 'Hai lần canter 1000 m, tập sức bền cho ngựa đường dài.', 'u_ht_b'),
    subject('sub_trot_hill', 'Kiệu dốc', 'TROT', 1500, 2, 'LIGHT', 'DIRT', 'Kiệu lên dốc thoải, tăng sức cơ chân sau. Chưa dùng trong giáo án nào.', 'u_ht_b'),
  ];

  /* --- Giáo án --- */
  const programs: TrainingProgram[] = [
    {
      id: 'prog_speed',
      name: 'Tăng tốc 1600 m',
      description: 'Giáo án 5 tuần cho ngựa cự ly trung bình: xây nền, tăng tốc bằng nước rút, kết thúc bằng buổi chạy thử.',
      phases: [
        { name: 'Nền tảng', weeks: 2, items: [{ subjectId: 'sub_canter_base', sessionsPerWeek: 2 }, { subjectId: 'sub_trot', sessionsPerWeek: 1 }, { subjectId: 'sub_walk', sessionsPerWeek: 1 }] },
        { name: 'Tăng tốc', weeks: 2, items: [{ subjectId: 'sub_breeze_400', sessionsPerWeek: 2 }, { subjectId: 'sub_canter_light', sessionsPerWeek: 1 }, { subjectId: 'sub_walk', sessionsPerWeek: 1 }] },
        { name: 'Chạy thử', weeks: 1, items: [{ subjectId: 'sub_trial_1200', sessionsPerWeek: 1 }, { subjectId: 'sub_canter_light', sessionsPerWeek: 1 }, { subjectId: 'sub_walk', sessionsPerWeek: 1 }] },
      ],
      createdBy: 'u_ht_a',
      ...base(iso(-105)),
    },
    {
      id: 'prog_endurance',
      name: 'Nền sức bền',
      description: 'Giáo án 4 tuần cho ngựa đường dài, chỉ dùng cường độ tới Trung bình.',
      phases: [
        { name: 'Sức bền nền', weeks: 2, items: [{ subjectId: 'sub_canter_long', sessionsPerWeek: 2 }, { subjectId: 'sub_trot', sessionsPerWeek: 1 }, { subjectId: 'sub_walk', sessionsPerWeek: 1 }] },
        { name: 'Sức bền tăng', weeks: 2, items: [{ subjectId: 'sub_canter_base', sessionsPerWeek: 2 }, { subjectId: 'sub_canter_long', sessionsPerWeek: 1 }, { subjectId: 'sub_trot', sessionsPerWeek: 1 }, { subjectId: 'sub_walk', sessionsPerWeek: 1 }] },
      ],
      createdBy: 'u_ht_b',
      ...base(iso(-100)),
    },
    {
      id: 'prog_recovery',
      name: 'Phục hồi nhẹ',
      description: 'Giáo án 2 tuần cho ngựa vừa khỏi bệnh hoặc cần theo dõi — chỉ bài Nhẹ.',
      phases: [
        { name: 'Phục hồi', weeks: 2, items: [{ subjectId: 'sub_walk', sessionsPerWeek: 2 }, { subjectId: 'sub_trot', sessionsPerWeek: 1 }, { subjectId: 'sub_canter_light', sessionsPerWeek: 1 }] },
      ],
      createdBy: 'u_ht_a',
      ...base(iso(-60)),
    },
  ];
  const P = (pid: string) => programs.find((item) => item.id === pid)!;

  /* --- Chọn ngày mở lớp để buổi hôm nay đúng như kịch bản --- */
  const planFor = (pid: string, start: string) => generateSessionPlan(P(pid), subjects, start);
  const pickStart = (pid: string, candidates: number[], accept: (plan: PlannedSession[]) => boolean) => {
    for (const offset of candidates) {
      const start = key(-offset);
      if (accept(planFor(pid, start))) return start;
    }
    return key(-candidates[0]);
  };

  const c1Start = pickStart('prog_speed', [17, 24, 14, 21, 18, 15, 16, 19, 20, 22, 23], (plan) =>
    plan.some((item) => item.date === TODAY && item.intensity === 'HEAVY'),
  );
  const c2Start =
    [16, 23, 13, 14, 15, 17, 18, 19, 20, 21, 22]
      .map((offset) => key(-offset))
      .find((start) => {
        const plan = planFor('prog_endurance', start);
        return plan.some((item) => item.date === key(-1)) && plan.some((item) => item.date === TODAY && item.intensity === 'MEDIUM');
      }) ??
    pickStart('prog_endurance', [16, 13, 20], (plan) => plan.some((item) => item.date === key(-1)) && plan.some((item) => item.date === TODAY));

  /* --- Lớp học --- */
  const classes: TrainingClass[] = [];
  const sessions: ClassSession[] = [];
  const enrollments: ClassEnrollment[] = [];
  const attendances: SessionAttendance[] = [];
  const alerts: TrainingAlert[] = [];

  const openClass = (cid: string, name: string, pid: string, zoneId: string, slotId: string, startDate: string, createdBy: string, extra: Partial<TrainingClass> = {}) => {
    const cls: TrainingClass = {
      id: cid,
      name,
      programId: pid,
      zoneId,
      slotId,
      startDate,
      endDate: classEndDate(startDate, programTotalWeeks(P(pid))),
      capacity: 8,
      createdBy,
      ...base(at(toDateKey(addDays(startDate, -5)), '10:00')),
      ...extra,
    };
    classes.push(cls);
    planFor(pid, startDate).forEach((item, index) => {
      sessions.push({
        id: `${cid}_s${String(index + 1).padStart(2, '0')}`,
        classId: cid,
        date: item.date,
        slotId,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        workoutType: item.workoutType,
        distanceM: item.distanceM,
        repetitions: item.repetitions,
        intensity: item.intensity,
        surface: item.surface,
        phaseNo: item.phaseNo,
        phaseName: item.phaseName,
        weekNo: item.weekNo,
        isExtra: false,
        status: 'SCHEDULED',
        ...base(cls.createdAt),
      });
    });
    return cls;
  };

  const enroll = (cid: string, horseId: string, joinedAt: string, by: string, withdraw?: { at: string; reason: ClassEnrollment['withdrawReason']; note: string; by: string }) => {
    enrollments.push({
      id: `enr_${cid}_${horseId.replace('h_', '')}`,
      classId: cid,
      horseId,
      joinedAt,
      joinedBy: by,
      withdrawnAt: withdraw?.at,
      withdrawnBy: withdraw?.by,
      withdrawReason: withdraw?.reason,
      withdrawNote: withdraw?.note,
      ...base(joinedAt),
    });
  };

  const c3Start = key(-70);
  openClass('cls_a0', 'Tăng tốc A0', 'prog_speed', 'zone_a', 'slot_3', c3Start, 'u_ht_a');
  const c1 = openClass('cls_a1', 'Tăng tốc A1', 'prog_speed', 'zone_a', 'slot_2', c1Start, 'u_ht_a');
  const c2 = openClass('cls_b1', 'Sức bền B1', 'prog_endurance', 'zone_b', 'slot_5', c2Start, 'u_ht_b', { capacity: 6 });
  openClass('cls_a2', 'Phục hồi A2', 'prog_recovery', 'zone_a', 'slot_4', key(2), 'u_ht_a', { capacity: 4 });
  openClass('cls_b0', 'Nước rút B0', 'prog_speed', 'zone_b', 'slot_6', key(3), 'u_ht_b', {
    cancelledAt: iso(-5, 16), cancelledBy: 'u_ht_b', cancelReason: 'Sân cỏ bảo dưỡng định kỳ, dời sang tháng sau',
  });

  const c1Join = at(toDateKey(addDays(c1Start, -2)), '10:00');
  const c2Join = at(toDateKey(addDays(c2Start, -2)), '10:00');

  enroll('cls_a0', 'h_sao_mai', at(toDateKey(addDays(c3Start, -2)), '10:00'), 'u_ht_a');
  enroll('cls_a0', 'h_gio_bac', at(toDateKey(addDays(c3Start, -2)), '10:00'), 'u_ht_a');
  enroll('cls_a0', 'h_phong_vu', at(toDateKey(addDays(c3Start, -2)), '10:00'), 'u_ht_a', {
    at: iso(-60, 14), reason: 'LIFECYCLE', note: 'Chuyển nhượng', by: 'u_cm',
  });

  enroll('cls_a1', 'h_sao_mai', c1Join, 'u_ht_a');
  enroll('cls_a1', 'h_gio_bac', c1Join, 'u_ht_a');
  enroll('cls_a1', 'h_bach_long', c1Join, 'u_ht_a');
  enroll('cls_a1', 'h_lua_rung', c1Join, 'u_ht_a', { at: iso(-1, 9), reason: 'ZONE_CHANGE', note: 'Đổi khu A → B', by: 'u_cm' });
  enroll('cls_a1', 'h_anh_duong', c1Join, 'u_ht_a', { at: iso(-12, 11), reason: 'LIFECYCLE', note: 'Giải nghệ', by: 'u_cm' });

  enroll('cls_b1', 'h_hac_phong', c2Join, 'u_ht_b');
  enroll('cls_b1', 'h_thien_ma', c2Join, 'u_ht_b');
  enroll('cls_b1', 'h_may_trang', c2Join, 'u_ht_b');
  enroll('cls_b1', 'h_ngoc_tuyet', iso(-10, 10), 'u_ht_b');

  enroll('cls_a2', 'h_bach_long', iso(-3, 15), 'u_ht_a');

  /* --- Sự kiện đặc biệt trong buổi tập --- */
  const c1Past = sessions.filter((item) => item.classId === 'cls_a1' && item.date < TODAY);
  const c2Past = sessions.filter((item) => item.classId === 'cls_b1' && item.date < TODAY);
  const nearestOnOrBefore = (list: ClassSession[], dateKey: string, filter: (item: ClassSession) => boolean = () => true) =>
    [...list].filter((item) => item.date <= dateKey && filter(item)).sort((a, b) => b.date.localeCompare(a.date))[0];

  const r1Session = nearestOnOrBefore(c1Past, key(-8), (item) => item.intensity !== 'LIGHT') ?? c1Past[0];
  const blAbsentSession = nearestOnOrBefore(c1Past, key(-9), (item) => item.id !== r1Session?.id);
  const hpSession = nearestOnOrBefore(c2Past, key(-12), (item) => item.intensity !== 'LIGHT') ?? c2Past[0];
  const hpDay = hpSession?.date ?? key(-12);
  const hpExamDay = toDateKey(addDays(hpDay, 1));
  const c2Yesterday = sessions.find((item) => item.classId === 'cls_b1' && item.date === key(-1));

  /* --- Hoàn tất các buổi đã qua --- */
  const slotStart = (slotId: string) => SLOTS.find((slot) => slot.id === slotId)!.startTime;
  const addMinutes = (isoValue: string, minutes: number) => new Date(new Date(isoValue).getTime() + minutes * 60_000).toISOString();

  const summaryFor = (session: ClassSession, progress: number, extra: Partial<SessionSummary> = {}): SessionSummary => {
    const reference = PACE[session.workoutType];
    const planned = session.distanceM * session.repetitions;
    const improvement = progress * 6;
    return {
      avgHeartRate: Math.round(reference.hr * 0.72 + 30 - improvement * 0.4 + (rand() - 0.5) * 4),
      maxHeartRate: Math.round(reference.hr + 8 - improvement * 0.3 + (rand() - 0.5) * 4),
      avgSpeedMps: Math.round(reference.speed * 0.55 * 10) / 10,
      maxSpeedMps: Math.round((reference.speed + 0.6 + progress * 0.4) * 10) / 10,
      distanceM: Math.round(planned * 1.6),
      durationSec: 2100,
      fastDistanceM: planned,
      volumeRatio: 1,
      alertCountRed: 0,
      mainAvgSpeedMps: Math.round((reference.speed + improvement * 0.05) * 10) / 10,
      mainAvgHeartRate: Math.round(reference.hr - improvement * 0.8),
      suggestedTrialSeconds:
        session.workoutType === 'TIME_TRIAL'
          ? Math.round((session.distanceM / (reference.speed + improvement * 0.05)) * 100) / 100
          : undefined,
      ...extra,
    };
  };

  const rosterAt = (session: ClassSession) =>
    enrollments.filter(
      (item) =>
        item.classId === session.classId &&
        toDateKey(item.joinedAt) <= session.date &&
        (!item.withdrawnAt || toDateKey(item.withdrawnAt) > session.date),
    );

  const trainerByZone: Record<string, string> = { zone_a: 'u_ht_a', zone_b: 'u_ht_b', zone_c: 'u_ht_a' };
  const presentCount = new Map<string, number>();
  const totalPresent = new Map<string, number>();

  const pastSessions = sessions
    .filter((item) => item.date < TODAY && !['cls_b0', 'cls_a2'].includes(item.classId))
    .sort((a, b) => a.date.localeCompare(b.date));
  pastSessions.forEach((session) => {
    rosterAt(session).forEach((item) => {
      if (!(item.horseId === 'h_hac_phong' && session.date > hpDay)) {
        totalPresent.set(item.horseId, (totalPresent.get(item.horseId) ?? 0) + 1);
      }
    });
  });

  pastSessions.forEach((session) => {
    const cls = classes.find((item) => item.id === session.classId)!;
    const trainer = trainerByZone[cls.zoneId];
    const startedAt = at(session.date, slotStart(session.slotId).replace(':30', ':35'));
    const endedAt = addMinutes(startedAt, 42);
    const awaiting = c2Yesterday && session.id === c2Yesterday.id;
    session.status = awaiting ? 'AWAITING_REVIEW' : 'COMPLETED';
    session.startedAt = startedAt;
    session.endedAt = endedAt;
    session.endReason = 'NORMAL';
    session.simScenario = 'NORMAL';
    session.simSeed = Math.floor(rand() * 1e9);
    session.simSpeed = 1;
    if (!awaiting) session.completedAt = at(session.date, '11:30');

    const roster = rosterAt(session);
    session.startedBy = H(roster[0]?.horseId ?? 'h_sao_mai').groomId ?? trainer;
    session.endedBy = session.startedBy;

    roster.forEach((enrollment) => {
      const hid = enrollment.horseId;
      const groom = H(hid).groomId ?? 'u_gr_3';
      const row: SessionAttendance = {
        id: id('att'),
        sessionId: session.id,
        horseId: hid,
        enrollmentId: enrollment.id,
        status: 'PRESENT',
        groomId: groom,
        tasks: {
          PREPARE: { at: addMinutes(startedAt, -35), by: groom },
          TO_TRACK: { at: addMinutes(startedAt, -8), by: groom },
          COOL_DOWN: { at: addMinutes(endedAt, 10), by: groom },
        },
        simScenario: 'NORMAL',
        simSeed: Math.floor(rand() * 1e9),
        maxHeartRateUsed: maxHr[hid],
        ...base(startedAt),
      };

      const blockedHp = hid === 'h_hac_phong' && session.date > hpDay;
      const blAbsent = hid === 'h_bach_long' && blAbsentSession && session.id === blAbsentSession.id;
      if (blockedHp || blAbsent) {
        row.status = 'ABSENT';
        row.absenceReason = blockedHp ? 'MEDICAL_BLOCK' : 'GROOM_REPORTED';
        row.absenceNote = blockedHp
          ? 'Đang có khóa huấn luyện, trạng thái Chấn thương'
          : 'Ngựa bỏ ăn sáng, groom đề nghị nghỉ buổi này';
        row.markedBy = blockedHp ? 'SYSTEM' : groom;
        row.markedAt = blockedHp ? startedAt : addMinutes(startedAt, -40);
        row.tasks = {};
        row.simScenario = undefined;
        row.simSeed = undefined;
        attendances.push(row);
        return;
      }

      const index = presentCount.get(hid) ?? 0;
      presentCount.set(hid, index + 1);
      const total = totalPresent.get(hid) ?? 1;
      const progress = total > 1 ? index / (total - 1) : 1;
      row.summary = summaryFor(session, progress);

      // Cảnh báo R1 của Sao Mai (đã xác nhận "tiếp tục theo dõi").
      if (r1Session && session.id === r1Session.id && hid === 'h_sao_mai') {
        row.summary.maxHeartRate = 236;
        row.summary.alertCountRed = 1;
        alerts.push({
          id: `${session.id}-${hid}-R1-312`,
          sessionId: session.id,
          horseId: hid,
          rule: 'R1',
          level: 'RED',
          atSecond: 312,
          at: addMinutes(startedAt, 5),
          value: 236,
          acknowledgedBy: 'u_ht_a',
          acknowledgedAt: addMinutes(startedAt, 6),
          ackAction: 'CONTINUE',
          ...base(addMinutes(startedAt, 5)),
        });
      }
      // Cảnh báo R3 của Hắc Phong: dừng ngựa, sinh yêu cầu khám khẩn.
      if (hpSession && session.id === hpSession.id && hid === 'h_hac_phong') {
        row.summary = summaryFor(session, progress, { volumeRatio: 0.55, fastDistanceM: Math.round(session.distanceM * session.repetitions * 0.55), alertCountRed: 1 });
        row.stoppedAtSecond = 405;
        row.stoppedAt = addMinutes(startedAt, 7);
        row.stoppedBy = 'u_ht_b';
        row.stopReason = 'Tốc độ tụt đột ngột, nghi chấn thương chân trước';
        row.simScenario = 'INJURY_RISK';
        alerts.push({
          id: `${session.id}-${hid}-R3-402`,
          sessionId: session.id,
          horseId: hid,
          rule: 'R3',
          level: 'RED',
          atSecond: 402,
          at: addMinutes(startedAt, 7),
          value: 4.1,
          acknowledgedBy: 'u_ht_b',
          acknowledgedAt: addMinutes(startedAt, 7),
          ackAction: 'STOP_HORSE',
          examRequestId: 'req_hp_alert',
          ...base(addMinutes(startedAt, 7)),
        });
      }
      // Chạy thử của lớp A0.
      if (session.workoutType === 'TIME_TRIAL') {
        const time = hid === 'h_sao_mai' ? 76.4 : hid === 'h_gio_bac' ? 77.9 : 78.6;
        row.summary.suggestedTrialSeconds = time;
      }

      const scoreNoise = (rand() - 0.5) * 0.9;
      const score = Math.min(9, Math.max(5, Math.round(5.6 + progress * 2.9 + scoreNoise)));
      const lastOfAwaiting = awaiting && hid !== 'h_thien_ma';
      if (!lastOfAwaiting) {
        const evaluation: Evaluation = {
          score: hid === 'h_hac_phong' && session.id === hpSession?.id ? 5 : score,
          notes:
            hid === 'h_hac_phong' && session.id === hpSession?.id
              ? 'Dừng giữa lần chạy thứ hai do tốc độ tụt đột ngột. Đã chuyển bác sĩ khám chân trước trái.'
              : score >= 7
                ? NOTES_GOOD[Math.floor(rand() * NOTES_GOOD.length)]
                : NOTES_OK[Math.floor(rand() * NOTES_OK.length)],
          evaluatedAt: at(session.date, '11:00'),
          evaluatedBy: trainer,
        };
        if (session.workoutType === 'TIME_TRIAL') {
          evaluation.trialTimeSeconds = row.summary.suggestedTrialSeconds;
          if (hid === 'h_sao_mai') evaluation.videoSrc = '/12509081_1920_1080_60fps.mp4';
        }
        row.evaluation = evaluation;
      }
      attendances.push(row);
    });
  });

  // Hôm nay: Tài đã chuẩn bị Sao Mai cho buổi 06:30 của lớp A1.
  const c1Today = sessions.find((item) => item.classId === 'cls_a1' && item.date === TODAY);
  if (c1Today) {
    attendances.push({
      id: id('att'),
      sessionId: c1Today.id,
      horseId: 'h_sao_mai',
      enrollmentId: 'enr_cls_a1_sao_mai',
      status: 'EXPECTED',
      tasks: { PREPARE: { at: at(TODAY, '05:10'), by: 'u_gr_1' } },
      ...base(at(TODAY, '05:10')),
    });
  }

  // Lớp B0 bị hủy trước khi bắt đầu: mọi buổi đều hủy cho cả lớp.
  sessions
    .filter((item) => item.classId === 'cls_b0')
    .forEach((item) => {
      item.status = 'CANCELLED';
      item.cancelledAt = iso(-5, 16);
      item.cancelledBy = 'u_ht_b';
      item.cancelReason = 'Sân cỏ bảo dưỡng định kỳ, dời sang tháng sau';
      item.cancelKind = 'CLASS_CANCELLED';
    });

  /* --- Y tế --- */
  const examinations: Examination[] = [];
  const medicalCases: MedicalCase[] = [];
  const examRequests: ExamRequest[] = [];
  const healthStatusLogs: HealthStatusLog[] = [];
  const trainingLocks: TrainingLock[] = [];

  const exam = (
    eid: string,
    horseId: string,
    kind: Examination['kind'],
    examinedAt: string,
    vetId: string,
    text: string,
    before: Examination['healthStatusBefore'],
    after: Examination['healthStatusAfter'],
    extra: Partial<Examination> = {},
    metrics: { weight?: number; temp?: number } = {},
  ) => {
    examinations.push({
      id: eid,
      horseId,
      kind,
      examinedAt,
      vetId,
      diagnosisAndTreatment: text,
      healthStatusBefore: before,
      healthStatusAfter: after,
      linkedRequestIds: [],
      corrections: [],
      ...base(examinedAt),
      ...extra,
    });
    const weight = metrics.weight ?? jitter(480, 30);
    const temp = metrics.temp ?? jitter(37.7, 0.4);
    measure(horseId, 'WEIGHT', weight, examinedAt, vetId, { examinationId: eid });
    measure(horseId, 'TEMPERATURE', temp, examinedAt, vetId, { examinationId: eid });
  };

  const normalText = 'Khám tổng quát: tim phổi bình thường, niêm mạc hồng, móng và khớp không có dấu hiệu bất thường. Tiếp tục chế độ tập hiện tại.';
  exam('ex_sm_p', 'h_sao_mai', 'PERIODIC', iso(-12, 9), 'u_vet_1', normalText, 'ELIGIBLE', 'ELIGIBLE');
  exam('ex_gb_p', 'h_gio_bac', 'PERIODIC', iso(-20, 9), 'u_vet_1', normalText, 'ELIGIBLE', 'ELIGIBLE', {}, { weight: 506 });
  exam('ex_bl_p', 'h_bach_long', 'PERIODIC', iso(-18, 9), 'u_vet_2', normalText, 'ELIGIBLE', 'ELIGIBLE');
  exam('ex_hk_p', 'h_hoang_kim', 'PERIODIC', iso(-25, 9), 'u_vet_2', normalText, 'ELIGIBLE', 'ELIGIBLE');
  exam('ex_tm_p', 'h_thien_ma', 'PERIODIC', iso(-40, 9), 'u_vet_1', normalText, 'ELIGIBLE', 'ELIGIBLE');
  exam('ex_lr_p', 'h_lua_rung', 'PERIODIC', iso(-15, 9), 'u_vet_1', normalText, 'ELIGIBLE', 'ELIGIBLE');
  exam('ex_mt_p', 'h_may_trang', 'PERIODIC', iso(-27, 9), 'u_vet_2', normalText, 'ELIGIBLE', 'ELIGIBLE', {}, { weight: 510 });
  exam('ex_nt_p', 'h_ngoc_tuyet', 'PERIODIC', iso(-10, 9), 'u_vet_2', normalText, 'ELIGIBLE', 'ELIGIBLE');
  exam('ex_po_p', 'h_polaris', 'PERIODIC', iso(-22, 9), 'u_vet_1', 'Ngựa giải nghệ, sức khỏe ổn định theo tuổi. Răng mòn nhẹ, đã mài răng.', 'ELIGIBLE', 'ELIGIBLE');
  exam('ex_dr_p', 'h_dawn_rose', 'PERIODIC', iso(-33, 9), 'u_vet_1', 'Ngựa giải nghệ, sức khỏe ổn định. Khớp gối sau hơi cứng buổi sáng — theo dõi.', 'ELIGIBLE', 'ELIGIBLE');
  exam('ex_ad_p', 'h_anh_duong', 'PERIODIC', iso(-6, 9), 'u_vet_2', 'Sau giải nghệ: lưng đã mềm, đi lại bình thường. Duy trì vận động nhẹ hằng ngày.', 'ELIGIBLE', 'ELIGIBLE');

  // Bệnh án đã đóng — Ánh Dương: mở ngay tại buổi khám định kỳ phát hiện vấn đề.
  medicalCases.push({
    id: 'case_ad',
    horseId: 'h_anh_duong',
    title: 'Co cứng cơ lưng',
    status: 'CLOSED',
    openedBy: 'u_vet_1',
    openedAt: iso(-50, 9),
    closedBy: 'u_vet_1',
    closedAt: iso(-35, 10),
    cost: 12_500_000,
    closeNote: 'Hồi phục hoàn toàn sau 2 tuần vật lý trị liệu và giảm tải.',
    ...base(iso(-50, 9)),
  });
  exam('ex_ad_1', 'h_anh_duong', 'PERIODIC', iso(-50, 9), 'u_vet_1',
    'Khám định kỳ phát hiện co cứng cơ lưng vùng yên ngựa, đau khi ấn. Chườm nóng 2 lần/ngày, xoa bóp, thuốc giãn cơ 5 ngày. Tạm ngừng bài nặng.',
    'ELIGIBLE', 'UNDER_OBSERVATION', { caseId: 'case_ad', nextAppointment: key(-36) });
  exam('ex_ad_2', 'h_anh_duong', 'CASE', iso(-35, 9), 'u_vet_1',
    'Tái khám: hết đau khi ấn, vận động lưng linh hoạt. Cho tập lại bình thường.',
    'UNDER_OBSERVATION', 'ELIGIBLE', { caseId: 'case_ad' });
  trainingLocks.push({
    id: 'lock_ad',
    horseId: 'h_anh_duong',
    reason: 'Co cứng cơ lưng — tạm dừng tập',
    placedAt: iso(-50, 9, 30),
    placedBy: 'u_vet_1',
    expectedLiftDate: key(-36),
    caseId: 'case_ad',
    liftedAt: iso(-35, 10),
    liftedBy: 'u_vet_1',
    liftReason: 'Đã hồi phục khi đóng bệnh án',
    liftKind: 'CASE_CLOSED',
    ...base(iso(-50, 9, 30)),
  });
  healthStatusLogs.push(
    { id: id('hsl'), horseId: 'h_anh_duong', fromStatus: 'ELIGIBLE', toStatus: 'UNDER_OBSERVATION', reason: 'Co cứng cơ lưng', examinationId: 'ex_ad_1', changedBy: 'u_vet_1', changedAt: iso(-50, 9), ...base(iso(-50, 9)) },
    { id: id('hsl'), horseId: 'h_anh_duong', fromStatus: 'UNDER_OBSERVATION', toStatus: 'ELIGIBLE', reason: 'Đã hồi phục', examinationId: 'ex_ad_2', changedBy: 'u_vet_1', changedAt: iso(-35, 9), ...base(iso(-35, 9)) },
  );

  // Bệnh án đang mở — Hắc Phong: từ cảnh báo R3 và báo cáo của Groom.
  const hpAlertAt = hpSession?.startedAt ? addMinutes(hpSession.startedAt, 7) : iso(-12, 15, 45);
  examRequests.push(
    {
      id: 'req_hp_alert',
      horseId: 'h_hac_phong',
      source: 'TRAINING_ALERT',
      urgency: 'URGENT',
      description: 'Cảnh báo R3: tốc độ tụt đột ngột từ 15,8 xuống 4,1 m/s ở lần chạy thứ hai, nghi chấn thương.',
      createdBy: 'SYSTEM',
      refType: 'ALERT',
      refId: hpSession ? `${hpSession.id}-h_hac_phong-R3-402` : undefined,
      status: 'EXAMINED',
      examinationId: 'ex_hp_1',
      resolvedAt: at(hpExamDay, '08:30'),
      ...base(hpAlertAt),
    },
    {
      id: 'req_hp_groom',
      horseId: 'h_hac_phong',
      source: 'GROOM_REPORT',
      urgency: 'NORMAL',
      description: 'Sau buổi tập ngựa đi hơi khập khiễng chân trước trái, cổ chân hơi nóng.',
      createdBy: 'u_gr_3',
      status: 'EXAMINED',
      examinationId: 'ex_hp_1',
      resolvedAt: at(hpExamDay, '08:30'),
      ...base(addMinutes(hpAlertAt, 50)),
    },
  );
  medicalCases.push({
    id: 'case_hp',
    horseId: 'h_hac_phong',
    title: 'Viêm gân gấp chân trước trái',
    status: 'OPEN',
    openedBy: 'u_vet_1',
    openedAt: at(hpExamDay, '08:30'),
    ...base(at(hpExamDay, '08:30')),
  });
  exam('ex_hp_1', 'h_hac_phong', 'CASE', at(hpExamDay, '08:30'), 'u_vet_1',
    'Sưng nóng mặt sau cẳng chân trước trái, đau khi ấn gân gấp nông. Chẩn đoán viêm gân gấp độ 1. Chườm lạnh 3 lần/ngày, băng ép, kháng viêm 7 ngày. Cấm vận động mạnh, chỉ dắt bộ 15 phút/ngày.',
    'ELIGIBLE', 'INJURED',
    { caseId: 'case_hp', linkedRequestIds: ['req_hp_alert', 'req_hp_groom'], nextAppointment: toDateKey(addDays(hpExamDay, 8)), corrections: [{ note: 'Bổ sung: siêu âm xác nhận tổn thương gân gấp nông độ 1, không rách.', by: 'u_vet_1', at: at(hpExamDay, '15:00') }] },
    { weight: 498, temp: 38.1 });
  exam('ex_hp_2', 'h_hac_phong', 'CASE', iso(-4, 9), 'u_vet_1',
    'Tái khám: giảm sưng rõ, còn đau nhẹ khi ấn. Tiếp tục chườm lạnh, bắt đầu dắt bộ 25 phút/ngày. Chưa cho tập.',
    'INJURED', 'INJURED', { caseId: 'case_hp', nextAppointment: key(3) }, { weight: 494, temp: 37.9 });
  trainingLocks.push({
    id: 'lock_hp',
    horseId: 'h_hac_phong',
    reason: 'Viêm gân gấp — cấm vận động mạnh',
    placedAt: at(hpExamDay, '09:00'),
    placedBy: 'u_vet_1',
    expectedLiftDate: key(25),
    caseId: 'case_hp',
    ...base(at(hpExamDay, '09:00')),
  });
  healthStatusLogs.push({
    id: id('hsl'), horseId: 'h_hac_phong', fromStatus: 'ELIGIBLE', toStatus: 'INJURED', reason: 'Viêm gân gấp chân trước trái', examinationId: 'ex_hp_1', changedBy: 'u_vet_1', changedAt: at(hpExamDay, '08:30'), ...base(at(hpExamDay, '08:30')),
  });

  // Hoàng Kim: bác sĩ đổi trực tiếp sang Cách ly (không cần buổi khám).
  healthStatusLogs.push({
    id: id('hsl'), horseId: 'h_hoang_kim', fromStatus: 'ELIGIBLE', toStatus: 'QUARANTINED', reason: 'Nghi cúm ngựa lây từ lô ngựa mới nhập, cách ly theo dõi 14 ngày', changedBy: 'u_vet_2', changedAt: iso(-3, 10), ...base(iso(-3, 10)),
  });
  // Bạch Long: sốt, bác sĩ chuyển Cần theo dõi.
  healthStatusLogs.push({
    id: id('hsl'), horseId: 'h_bach_long', fromStatus: 'ELIGIBLE', toStatus: 'UNDER_OBSERVATION', reason: 'Sốt 38,8 °C, theo dõi 48 giờ trước khi khám', changedBy: 'u_vet_1', changedAt: iso(-1, 8), ...base(iso(-1, 8)),
  });

  // Phong Vũ: khóa cũ được tự gỡ khi chuyển nhượng.
  trainingLocks.push({
    id: 'lock_pv',
    horseId: 'h_phong_vu',
    reason: 'Viêm móng nhẹ',
    placedAt: iso(-66, 9),
    placedBy: 'u_vet_2',
    liftedAt: iso(-60, 14),
    liftedBy: 'u_cm',
    liftReason: 'Gỡ do chuyển nhượng',
    liftKind: 'TRANSFER',
    ...base(iso(-66, 9)),
  });

  // Yêu cầu khám đang chờ.
  examRequests.push(
    {
      id: 'req_bl_temp',
      horseId: 'h_bach_long',
      source: 'BODY_METRIC_ALERT',
      urgency: 'URGENT',
      description: 'Thân nhiệt 38,8 °C vượt ngưỡng 38,6 °C.',
      createdBy: 'SYSTEM',
      refType: 'MEASUREMENT',
      refId: blTempId,
      status: 'PENDING',
      ...base(iso(-1, 6, 21)),
    },
    {
      id: 'req_gb_weight',
      horseId: 'h_gio_bac',
      source: 'BODY_METRIC_ALERT',
      urgency: 'NORMAL',
      description: 'Cân nặng giảm 5,3% trong 14 ngày (505 → 478 kg).',
      createdBy: 'SYSTEM',
      refType: 'MEASUREMENT',
      status: 'PENDING',
      ...base(iso(-1, 7, 5)),
    },
    {
      id: 'req_mt_groom',
      horseId: 'h_may_trang',
      source: 'GROOM_REPORT',
      urgency: 'NORMAL',
      description: 'Ăn ít hơn bình thường từ tối qua, phân hơi lỏng.',
      createdBy: 'u_gr_3',
      status: 'PENDING',
      ...base(at(TODAY, '06:10')),
    },
    {
      id: 'req_sm_manual',
      horseId: 'h_sao_mai',
      source: 'MANUAL',
      urgency: 'NORMAL',
      description: 'Móng trước phải có vết nứt nhỏ, nhờ bác sĩ kiểm tra.',
      createdBy: 'u_ht_a',
      status: 'DISMISSED',
      dismissedBy: 'u_vet_1',
      dismissReason: 'Đã kiểm tra tại chuồng: chỉ là vết xước bề mặt, không ảnh hưởng. Groom bôi dầu móng.',
      resolvedAt: iso(-6, 14),
      ...base(iso(-6, 9)),
    },
  );

  /* --- Vòng đời --- */
  const lifecycleEvents: LifecycleEvent[] = [
    { id: id('lc'), horseId: 'h_polaris', from: 'ACTIVE', to: 'RETIRED', reason: 'Giải nghệ, giữ lại làm ngựa giống', by: 'u_cm', at: iso(-400, 10), consequences: { enrollmentsClosed: 0 }, ...base(iso(-400, 10)) },
    { id: id('lc'), horseId: 'h_dawn_rose', from: 'ACTIVE', to: 'RETIRED', reason: 'Giải nghệ, giữ lại làm ngựa giống', by: 'u_cm', at: iso(-380, 10), consequences: { enrollmentsClosed: 0 }, ...base(iso(-380, 10)) },
    { id: id('lc'), horseId: 'h_phong_vu', from: 'ACTIVE', to: 'TRANSFERRED', reason: 'Bán cho câu lạc bộ Phú Thọ', by: 'u_cm', at: iso(-60, 14), consequences: { enrollmentsClosed: 1, stallFreed: 'A-05', zoneCleared: 'Khu A', groomEnded: 'u_gr_1', lockLifted: true }, ...base(iso(-60, 14)) },
    { id: id('lc'), horseId: 'h_anh_duong', from: 'ACTIVE', to: 'RETIRED', reason: 'Giải nghệ sau mùa giải, chuyển sang làm ngựa giống', by: 'u_cm', at: iso(-12, 11), consequences: { enrollmentsClosed: 1 }, ...base(iso(-12, 11)) },
    { id: id('lc'), horseId: 'h_nhap_nham', from: 'ACTIVE', to: 'DELETED', reason: 'Tạo trùng hồ sơ với Tia Chớp', by: 'u_cm', at: iso(-2, 15), consequences: { enrollmentsClosed: 0 }, ...base(iso(-2, 15)) },
  ];

  /* --- Thông báo --- */
  const notifications: AppNotification[] = [];
  const notify = (userId: string, level: NotificationLevel, title: string, body: string, link: string, createdIso: string, read = false) => {
    notifications.push({
      id: id('nt'),
      userId,
      level,
      title,
      body,
      link,
      readAt: read ? addMinutes(createdIso, 30) : undefined,
      ...base(createdIso),
    });
  };
  const c1Name = c1.name;
  const c2Name = c2.name;

  notify('u_cm', 'HIGH', 'Quá hạn khám định kỳ: Thiên Mã', 'Hạn khám đã quá 10 ngày.', links.periodic, iso(0, 7));
  notify('u_cm', 'HIGH', 'Hoàng Kim: Cách ly', 'Nghi cúm ngựa, cách ly theo dõi 14 ngày. Gợi ý: cân nhắc chuyển ngựa sang ô trống để tách đàn.', links.horse('h_hoang_kim', 'medical'), iso(-3, 10));
  notify('u_cm', 'HIGH', 'Khóa huấn luyện: Hắc Phong', 'Viêm gân gấp — cấm vận động mạnh.', links.horse('h_hac_phong', 'medical'), at(hpExamDay, '09:00'), true);
  notify('u_cm', 'NORMAL', 'Mở bệnh án: Hắc Phong', 'Viêm gân gấp chân trước trái.', links.case('case_hp'), at(hpExamDay, '08:30'), true);
  notify('u_cm', 'NORMAL', 'Đóng bệnh án: Ánh Dương', 'Co cứng cơ lưng — chi phí 12.500.000 đ.', links.case('case_ad'), iso(-35, 10), true);

  notify('u_ht_a', 'URGENT', 'Thân nhiệt cao: Bạch Long', '38,8 °C (ngưỡng 38,6 °C). Đã gửi yêu cầu khám khẩn.', links.horse('h_bach_long', 'body'), iso(-1, 6, 21));
  notify('u_ht_a', 'HIGH', 'Cân nặng giảm: Gió Bấc', 'Giảm 5,3% trong 14 ngày (505 → 478 kg).', links.horse('h_gio_bac', 'body'), iso(-1, 7, 5));
  notify('u_ht_a', 'NORMAL', 'Bạch Long: Đủ điều kiện → Cần theo dõi', 'Chỉ được tập Nhẹ và Trung bình cho tới khi bác sĩ đổi trạng thái.', links.horse('h_bach_long', 'medical'), iso(-1, 8));
  notify('u_ht_a', 'HIGH', 'Hoàng Kim: Cách ly', 'Nghi cúm ngựa. Gợi ý: cân nhắc chuyển ngựa sang ô trống để tách đàn.', links.horse('h_hoang_kim', 'medical'), iso(-3, 10));
  notify('u_ht_a', 'NORMAL', `Lửa Rừng rời lớp ${c1Name}`, 'Ngựa được đổi sang Khu B nên tự động rút khỏi lớp của khu cũ.', links.class('cls_a1', 'horses'), iso(-1, 9), true);

  notify('u_ht_b', 'NORMAL', 'Xếp khu: Lửa Rừng vào Khu B', 'Ngựa đang chờ xếp ô. Groom Nguyễn Văn Bình được giữ nguyên.', links.stable, iso(-1, 9));
  notify('u_ht_b', 'HIGH', 'Khóa huấn luyện: Hắc Phong', 'Viêm gân gấp — cấm vận động mạnh.', links.horse('h_hac_phong', 'medical'), at(hpExamDay, '09:00'), true);
  notify('u_ht_b', 'HIGH', 'Hắc Phong: Chấn thương', 'Viêm gân gấp chân trước trái. Ngựa không được tập và đua.', links.horse('h_hac_phong', 'medical'), at(hpExamDay, '08:30'), true);
  if (c2Yesterday) notify('u_ht_b', 'NORMAL', `Buổi ${c2Name} chờ đánh giá`, 'Còn 2 ngựa chưa được chấm điểm.', links.session(c2Yesterday.id), iso(-1, 16, 20));

  ['u_vet_1', 'u_vet_2'].forEach((vet) => {
    notify(vet, 'URGENT', 'Yêu cầu khám khẩn: Bạch Long', 'Thân nhiệt 38,8 °C vượt ngưỡng 38,6 °C.', links.requests, iso(-1, 6, 21));
    notify(vet, 'NORMAL', 'Yêu cầu khám: Gió Bấc', 'Cân nặng giảm 5,3% trong 14 ngày.', links.requests, iso(-1, 7, 5));
    notify(vet, 'NORMAL', 'Yêu cầu khám: Mây Trắng', 'Groom báo: ăn ít hơn bình thường, phân hơi lỏng.', links.requests, at(TODAY, '06:10'));
    notify(vet, 'HIGH', 'Quá hạn khám định kỳ: Thiên Mã', 'Hạn khám đã quá 10 ngày.', links.periodic, iso(0, 7));
  });

  notify('u_gr_1', 'NORMAL', `Sao Mai được đăng ký vào lớp ${c1Name}`, 'Lịch tập của ngựa đã được cập nhật.', links.today, c1Join, true);
  notify('u_gr_2', 'NORMAL', 'Lửa Rừng đổi sang Khu B', 'Bạn vẫn là Groom phụ trách. Ngựa đang chờ HT Khu B xếp ô.', links.horse('h_lua_rung'), iso(-1, 9));
  notify('u_gr_3', 'URGENT', 'Dừng ngựa ngay: Hắc Phong', 'Cảnh báo nghi chấn thương trong buổi tập.', hpSession ? links.session(hpSession.id) : links.today, hpAlertAt, true);
  notify('u_gr_4', 'NORMAL', 'Phân công Groom: Hoàng Kim', 'Bạn được giao chăm sóc Hoàng Kim tại ô C-01.', links.horse('h_hoang_kim'), iso(-80, 9), true);

  notify('u_ow_1', 'NORMAL', 'Sao Mai có nhận xét mới', 'Huấn luyện viên đã chấm điểm buổi tập gần nhất.', links.horse('h_sao_mai', 'training'), iso(-1, 11));
  notify('u_ow_2', 'NORMAL', 'Mở bệnh án: Hắc Phong', 'Bác sĩ đã mở bệnh án viêm gân gấp chân trước trái.', links.horse('h_hac_phong', 'medical'), at(hpExamDay, '08:30'), true);
  notify('u_ow_2', 'NORMAL', 'Đóng bệnh án: Ánh Dương', 'Chi phí điều trị 12.500.000 đ.', links.horse('h_anh_duong', 'medical'), iso(-35, 10), true);
  notify('u_ow_2', 'NORMAL', `Ngọc Tuyết được đăng ký vào lớp ${c2Name}`, 'Ngựa vào lớp giữa chừng, tập các buổi từ hôm nay trở đi.', links.horse('h_ngoc_tuyet', 'training'), iso(-10, 10));
  notify('u_ow_3', 'NORMAL', 'Hồ sơ Tia Chớp đã được tạo', 'Ngựa đang chờ xếp khu chuồng.', links.horse('h_tia_chop'), iso(-2, 10));

  /* --- Nhật ký thao tác --- */
  const auditLogs: AuditLog[] = [];
  const names: Record<string, [string, UserRole]> = Object.fromEntries(users.map((item) => [item.id, [item.name, item.role]]));
  const audit = (userId: string, action: string, entityType: string, entityId: string, whenIso: string, extra: Partial<AuditLog> = {}) => {
    auditLogs.push({
      id: id('al'),
      at: whenIso,
      userId,
      userName: names[userId]?.[0] ?? 'Hệ thống',
      role: names[userId]?.[1] ?? 'SYSTEM',
      action,
      entityType,
      entityId,
      ...base(whenIso),
      ...extra,
    });
  };
  audit('u_cm', 'Tạo hồ sơ ngựa', 'Horse', 'h_tia_chop', iso(-2, 10), { horseId: 'h_tia_chop', after: { name: 'Tia Chớp', sex: 'MALE', ownerId: 'u_ow_3' } });
  audit('u_cm', 'Xóa hồ sơ ngựa', 'Horse', 'h_nhap_nham', iso(-2, 15), { horseId: 'h_nhap_nham', reason: 'Tạo trùng hồ sơ với Tia Chớp' });
  audit('u_cm', 'Xếp khu chuồng', 'Horse', 'h_lua_rung', iso(-1, 9), { horseId: 'h_lua_rung', before: { zone: 'Khu A', stall: 'A-05' }, after: { zone: 'Khu B', stall: null }, reason: 'Cân đối số ngựa giữa hai khu', });
  audit('u_cm', 'Rút ngựa khỏi lớp', 'ClassEnrollment', 'enr_cls_a1_lua_rung', iso(-1, 9), { horseId: 'h_lua_rung', after: { reason: 'ZONE_CHANGE' } });
  audit('u_cm', 'Đổi vòng đời', 'Horse', 'h_anh_duong', iso(-12, 11), { horseId: 'h_anh_duong', before: { lifecycleStatus: 'ACTIVE' }, after: { lifecycleStatus: 'RETIRED', enrollmentsClosed: 1 }, reason: 'Giải nghệ sau mùa giải' });
  audit('u_cm', 'Đổi vòng đời', 'Horse', 'h_phong_vu', iso(-60, 14), { horseId: 'h_phong_vu', before: { lifecycleStatus: 'ACTIVE' }, after: { lifecycleStatus: 'TRANSFERRED', stallFreed: 'A-05', groomEnded: 'Võ Văn Tài', lockLifted: true, enrollmentsClosed: 1 }, reason: 'Bán cho câu lạc bộ Phú Thọ' });
  audit('u_vet_1', 'Mở bệnh án', 'MedicalCase', 'case_hp', at(hpExamDay, '08:30'), { horseId: 'h_hac_phong', after: { title: 'Viêm gân gấp chân trước trái' } });
  audit('u_vet_1', 'Đặt khóa huấn luyện', 'TrainingLock', 'lock_hp', at(hpExamDay, '09:00'), { horseId: 'h_hac_phong', after: { reason: 'Viêm gân gấp — cấm vận động mạnh' } });
  audit('u_vet_2', 'Đổi trạng thái sức khỏe', 'Horse', 'h_hoang_kim', iso(-3, 10), { horseId: 'h_hoang_kim', before: { healthStatus: 'ELIGIBLE' }, after: { healthStatus: 'QUARANTINED' }, reason: 'Nghi cúm ngựa' });
  audit('u_vet_1', 'Đổi trạng thái sức khỏe', 'Horse', 'h_bach_long', iso(-1, 8), { horseId: 'h_bach_long', before: { healthStatus: 'ELIGIBLE' }, after: { healthStatus: 'UNDER_OBSERVATION' }, reason: 'Sốt 38,8 °C' });
  audit('u_vet_2', 'Xóa bản ghi chỉ số', 'BodyMeasurement', 'bm_may_trang', iso(-5, 10), { horseId: 'h_may_trang', before: { type: 'WEIGHT', value: 612 }, reason: 'Nhập nhầm số' });
  audit('u_ht_a', 'Mở lớp', 'TrainingClass', 'cls_a1', c1.createdAt, { after: { name: c1Name, program: 'Tăng tốc 1600 m' } });
  audit('u_ht_b', 'Hủy lớp', 'TrainingClass', 'cls_b0', iso(-5, 16), { reason: 'Sân cỏ bảo dưỡng định kỳ' });
  audit('u_ht_b', 'Đăng ký ngựa vào lớp', 'ClassEnrollment', 'enr_cls_b1_ngoc_tuyet', iso(-10, 10), { horseId: 'h_ngoc_tuyet', after: { class: c2Name } });
  audit('u_vet_1', 'Bỏ qua yêu cầu khám', 'ExamRequest', 'req_sm_manual', iso(-6, 14), { horseId: 'h_sao_mai', reason: 'Vết xước bề mặt, không ảnh hưởng' });
  auditLogs.sort((a, b) => b.at.localeCompare(a.at));

  // Thiên Mã quá hạn trên 7 ngày: đã gửi cảnh báo cho hạn hiện tại.
  const thienMa = H('h_thien_ma');
  thienMa.periodicOverdueNotifiedFor = toDateKey(addDays(iso(-40, 9), 30));

  return {
    meta: { seededAt: today.toISOString(), schema },
    settings: {
      clockMode: 'REAL',
      clockOffsetMs: 0,
      simSpeed: 1,
      examCycleDays: 30,
      defaultMaxHeartRate: 230,
    },
    users,
    zones,
    stalls,
    slots: SLOTS,
    horses,
    bodyMeasurements,
    lifecycleEvents,
    subjects,
    programs,
    classes,
    sessions,
    enrollments,
    attendances,
    alerts,
    maxHeartRates,
    examRequests,
    medicalCases,
    examinations,
    healthStatusLogs,
    trainingLocks,
    notifications: notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    auditLogs,
  };
}
