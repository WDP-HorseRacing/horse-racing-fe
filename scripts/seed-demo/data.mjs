// Dữ liệu mẫu cho môi trường demo (horse.io.vn). Sửa tên ở đây, seed.mjs chỉ đọc.
// Quy ước: tài khoản thêm đặt tên vaitro2@horse.test trở đi; mật khẩu lấy từ biến môi trường SEED_PASSWORD.
// Khóa tham chiếu giữa các bảng là chuỗi ngắn (email, tên khu, mã ô, số chip, tên môn, tên vật tư) để chạy lại không tạo trùng.

/** 5 tài khoản Keycloak có sẵn trên prod. Script chỉ kiểm, không tạo. */
export const BASE_ACCOUNTS = [
  { email: 'club.manager@horse.test', role: 'CLUB_MANAGER' },
  { email: 'head.trainer@horse.test', role: 'HEAD_TRAINER' },
  { email: 'horse.owner@horse.test', role: 'HORSE_OWNER' },
  { email: 'groom@horse.test', role: 'GROOM' },
  { email: 'veterinarian@horse.test', role: 'VETERINARIAN' },
];

export const CM = 'club.manager@horse.test';
export const HT1 = 'head.trainer@horse.test';
export const HT2 = 'head.trainer2@horse.test';
export const HT3 = 'head.trainer3@horse.test';
export const VET1 = 'veterinarian@horse.test';
export const VET2 = 'veterinarian2@horse.test';
export const OWNER1 = 'horse.owner@horse.test';
export const OWNER2 = 'horse.owner2@horse.test';
export const OWNER3 = 'horse.owner3@horse.test';
export const GROOM1 = 'groom@horse.test';
export const GROOM2 = 'groom2@horse.test';
export const GROOM3 = 'groom3@horse.test';
export const GROOM4 = 'groom4@horse.test';

/** Tài khoản Quản lý CLB tạo thêm. */
export const EXTRA_USERS = [
  { email: HT2, fullName: 'Trần Quốc Bảo', role: 'HEAD_TRAINER' },
  { email: HT3, fullName: 'Lê Hoàng Nam', role: 'HEAD_TRAINER' },
  { email: GROOM2, fullName: 'Phạm Văn Tài', role: 'GROOM' },
  { email: GROOM3, fullName: 'Đỗ Thị Hạnh', role: 'GROOM' },
  { email: GROOM4, fullName: 'Ngô Minh Khoa', role: 'GROOM' },
  { email: VET2, fullName: 'Võ Thanh Tâm', role: 'VETERINARIAN' },
  { email: OWNER2, fullName: 'Hoàng Gia Huy', role: 'HORSE_OWNER' },
  { email: OWNER3, fullName: 'Bùi Ngọc Lan', role: 'HORSE_OWNER' },
];

/** Loại việc hằng ngày. Đổi tên "Cho ăn" trước khi giao Groom đầu tiên (đã có trong checklist thì BE không cho đổi). */
export const TASK_TYPE_RENAMES = [{ from: 'Cho ăn', to: 'Cho ăn sáng' }];
// DB dựng bằng migration có sẵn Cho ăn, Vệ sinh chuồng, Tắm rửa, Ngâm chân nước đá; prod có thể không có, nên thiếu loại nào thì tạo.
// Thứ tự ở đây là thứ tự trong checklist khi phải tạo mới.
export const TASK_TYPES = [
  { name: 'Cho ăn sáng', appliesToAll: true },
  { name: 'Vệ sinh chuồng', appliesToAll: true },
  { name: 'Tắm rửa', appliesToAll: true },
  { name: 'Ngâm chân nước đá', appliesToAll: false },
  // Bác sĩ gắn cho ngựa demo Bộ 2 (căng cơ đùi) trong kịch bản.
  { name: 'Chườm lạnh', appliesToAll: false },
  { name: 'Cho ăn tối', appliesToAll: true },
  { name: 'Chải lông', appliesToAll: false },
  { name: 'Giữ ngựa cho thợ móng', appliesToAll: false },
];

export const DAILY_FEE = 250000;

/** 4 khu, mỗi khu 6 ô. Ô A-04, A-05, A-06 để trống cho 3 bộ demo. */
export const BARNS = [
  { name: 'Khu A', description: 'Khu nước rút, gần đường đua chính', capacity: 8, headTrainer: HT1, prefix: 'A', stalls: 6 },
  { name: 'Khu B', description: 'Khu hồi phục và ngựa giống', capacity: 8, headTrainer: HT1, prefix: 'B', stalls: 6 },
  { name: 'Khu C', description: 'Khu ngựa bền', capacity: 8, headTrainer: HT2, prefix: 'C', stalls: 6, extraStalls: [{ code: 'C-07', type: 'ISOLATION', description: 'Ô cách ly cuối dãy' }] },
  { name: 'Khu D', description: 'Khu ngựa đường dài', capacity: 8, headTrainer: HT3, prefix: 'D', stalls: 6 },
];

/** Ngày sinh dạng YYYY-MM-DD. Cha mẹ đứng trước con. stall/groom null là chưa xếp. */
export const HORSES = [
  // Cha mẹ của Kim Ô và Tuyết Sơn: ngựa giống đã giải nghệ, không ở khu nào. Có để cây phả hệ 3 đời của ngựa demo (con Kim Ô × Tuyết Sơn) đủ hàng ông bà.
  { name: 'Thần Phong', gender: 'MALE', breed: 'Thuần chủng Anh', color: 'Đen', dateOfBirth: '2003-03-15', microchipId: '704098100000014', owner: OWNER3, retire: true },
  { name: 'Ngọc Lan', gender: 'FEMALE', breed: 'Thuần chủng Anh', color: 'Nâu', dateOfBirth: '2005-05-02', microchipId: '704098100000015', owner: OWNER3, retire: true },
  { name: 'Hải Âu', gender: 'MALE', breed: 'Thuần chủng Anh', color: 'Xám', dateOfBirth: '2004-01-20', microchipId: '704098100000016', owner: OWNER3, retire: true },
  { name: 'Bạch Vân', gender: 'FEMALE', breed: 'Thuần chủng Anh', color: 'Xám bạc', dateOfBirth: '2005-09-11', microchipId: '704098100000017', owner: OWNER3, retire: true },
  { name: 'Kim Ô', gender: 'MALE', breed: 'Thuần chủng Anh', color: 'Đen tuyền', dateOfBirth: '2012-04-10', microchipId: '704098100000001', owner: OWNER1, barn: 'Khu B', stall: 'B-01', groom: GROOM2, raceAptitude: 'STAYER', retire: true, sire: 'Thần Phong', dam: 'Ngọc Lan' },
  { name: 'Tuyết Sơn', gender: 'FEMALE', breed: 'Thuần chủng Anh', color: 'Xám bạc', dateOfBirth: '2013-02-18', microchipId: '704098100000002', owner: OWNER1, barn: 'Khu B', stall: 'B-02', groom: GROOM2, raceAptitude: 'MILER', sire: 'Hải Âu', dam: 'Bạch Vân' },
  { name: 'Hòa Âm', gender: 'FEMALE', breed: 'Ả Rập', color: 'Hạt dẻ', dateOfBirth: '2018-06-05', microchipId: '704098100000003', owner: OWNER1, barn: 'Khu B', stall: 'B-03', groom: GROOM2, raceAptitude: 'MILER', transferTo: OWNER2 },
  { name: 'Xích Thố', gender: 'MALE', breed: 'Thuần chủng Anh', color: 'Hồng mã', dateOfBirth: '2020-03-22', microchipId: '704098100000004', owner: OWNER2, barn: 'Khu A', stall: 'A-01', groom: GROOM1, raceAptitude: 'SPRINTER' },
  { name: 'Bạch Long', gender: 'GELDING', breed: 'Ả Rập', color: 'Trắng xám', dateOfBirth: '2019-09-14', microchipId: '704098100000005', owner: OWNER3, barn: 'Khu A', stall: 'A-02', groom: GROOM1, raceAptitude: 'MILER' },
  { name: 'Phong Vân', gender: 'FEMALE', breed: 'Thuần chủng Anh', color: 'Hạt dẻ', dateOfBirth: '2021-05-30', microchipId: '704098100000006', owner: OWNER1, barn: 'Khu A', stall: 'A-03', groom: GROOM2, raceAptitude: 'SPRINTER', sire: 'Kim Ô', dam: 'Tuyết Sơn' },
  { name: 'Thiên Lý', gender: 'MALE', breed: 'Thuần chủng Anh', color: 'Nâu sẫm', dateOfBirth: '2019-01-12', microchipId: '704098100000007', owner: OWNER2, barn: 'Khu C', stall: 'C-01', groom: GROOM3, raceAptitude: 'STAYER' },
  { name: 'Hắc Phong', gender: 'GELDING', breed: 'Thuần chủng Anh', color: 'Đen', dateOfBirth: '2020-07-08', microchipId: '704098100000008', owner: OWNER3, barn: 'Khu C', stall: 'C-02', groom: GROOM3, raceAptitude: 'STAYER' },
  { name: 'Sao Mai', gender: 'FEMALE', breed: 'Ả Rập', color: 'Xám sáng', dateOfBirth: '2021-03-03', microchipId: '704098100000009', owner: OWNER1, barn: 'Khu C', stall: 'C-03', groom: GROOM3, raceAptitude: 'MILER', sire: 'Kim Ô' },
  { name: 'Đại Bàng', gender: 'MALE', breed: 'Thuần chủng Anh', color: 'Nâu đỏ', dateOfBirth: '2018-11-20', microchipId: '704098100000010', owner: OWNER2, barn: 'Khu D', stall: 'D-01', groom: GROOM4, raceAptitude: 'STAYER' },
  { name: 'Lam Giang', gender: 'FEMALE', breed: 'Thuần chủng Anh', color: 'Hạt dẻ sáng', dateOfBirth: '2020-04-16', microchipId: '704098100000011', owner: OWNER3, barn: 'Khu D', stall: 'D-02', groom: GROOM4, raceAptitude: 'STAYER', dam: 'Tuyết Sơn' },
  { name: 'Công Phá', gender: 'GELDING', breed: 'Ả Rập', color: 'Hồng mã', dateOfBirth: '2021-08-09', microchipId: '704098100000012', owner: OWNER1, barn: 'Khu D', stall: 'D-03', groom: GROOM4, raceAptitude: 'SPRINTER' },
  // Bán ra ngoài: chưa xếp khu, chuyển nhượng ngay để trang "Ngựa đã bán" của chủ ngựa có dữ liệu.
  { name: 'Dâu Tây', gender: 'FEMALE', breed: 'Thuần chủng Anh', color: 'Hồng mã', dateOfBirth: '2019-10-02', microchipId: '704098100000013', owner: OWNER1, sell: 'Bán cho câu lạc bộ ngoài theo hợp đồng mua bán' },
];

/** Môn học (Quản lý CLB). Thời gian mục tiêu tính bằng ms. */
export const SUBJECTS = [
  { name: 'Đi bộ hồi phục', sessionType: 'REGULAR', intensity: 'LIGHT', plannedDistanceM: 3000, durationMinutes: 60, surface: 'Cát', description: 'Đi bộ đều nhịp sau ngày tập nặng' },
  { name: 'Nhảy xào', sessionType: 'REGULAR', intensity: 'LIGHT', plannedDistanceM: 800, durationMinutes: 30, surface: 'Cỏ', description: 'Bài nhảy thấp, giữ nhịp chân' },
  { name: 'Bơi hồi phục', sessionType: 'REGULAR', intensity: 'LIGHT', plannedDistanceM: 0, durationMinutes: 45, surface: 'Hồ bơi', description: 'Giảm tải khớp, giữ thể lực' },
  { name: 'Phi nước kiệu dài', sessionType: 'REGULAR', intensity: 'HEAVY', plannedDistanceM: 4000, durationMinutes: 60, surface: 'Cát', description: 'Kiệu đều quãng dài' },
  { name: 'Phi nước kiệu nền', sessionType: 'REGULAR', intensity: 'HEAVY', plannedDistanceM: 3000, durationMinutes: 60, surface: 'Cỏ', description: 'Kiệu trên nền cỏ, tăng sức bền' },
  { name: 'Phi nước đại', sessionType: 'REGULAR', intensity: 'HEAVY', plannedDistanceM: 2000, durationMinutes: 45, surface: 'Cỏ', description: 'Bứt tốc ngắn, nghỉ giữa hiệp' },
  { name: 'Chạy thử 1.200 m', sessionType: 'TIME_TRIAL', intensity: 'HEAVY', plannedDistanceM: 1200, durationMinutes: 60, surface: 'Cỏ', targetTimeMs: 75000, description: 'Chạy tính giờ 1.200 m' },
];

/** Giáo án: mỗi giai đoạn có số tuần và môn kèm số buổi tối thiểu mỗi tuần. */
export const PLANS = [
  {
    owner: HT1,
    name: 'Tăng tốc nước rút',
    // Giai đoạn 1 phải có chạy thử: lớp mở trong buổi demo bắt đầu hôm nay, và chỉ xếp được môn của giai đoạn chứa ngày đó.
    description: 'Giáo án 6 tuần cho ngựa nước rút, mỗi giai đoạn có một buổi chạy thử tính giờ',
    phases: [
      { weeks: 2, subjects: [['Đi bộ hồi phục', 2], ['Phi nước kiệu dài', 2], ['Nhảy xào', 1], ['Chạy thử 1.200 m', 1]] },
      { weeks: 2, subjects: [['Phi nước đại', 2], ['Chạy thử 1.200 m', 1], ['Đi bộ hồi phục', 2]] },
      { weeks: 2, subjects: [['Phi nước đại', 2], ['Chạy thử 1.200 m', 1], ['Bơi hồi phục', 1]] },
    ],
  },
  {
    owner: HT1,
    name: 'Nền tảng thể lực',
    description: 'Xây nền sức bền cho ngựa mới về',
    phases: [
      { weeks: 3, subjects: [['Đi bộ hồi phục', 3], ['Phi nước kiệu nền', 2]] },
      { weeks: 3, subjects: [['Phi nước kiệu dài', 2], ['Nhảy xào', 2]] },
    ],
  },
  {
    owner: HT1,
    name: 'Hồi phục sau chấn thương',
    description: 'Tải nhẹ, tăng dần sau khi bác sĩ gỡ khóa',
    phases: [
      { weeks: 2, subjects: [['Bơi hồi phục', 3], ['Đi bộ hồi phục', 2]] },
      { weeks: 2, subjects: [['Đi bộ hồi phục', 3], ['Nhảy xào', 1]] },
    ],
  },
  {
    owner: HT2,
    name: 'Bền khu C',
    description: 'Giáo án thử của Khu C',
    phases: [
      { weeks: 2, subjects: [['Chạy thử 1.200 m', 1], ['Đi bộ hồi phục', 2], ['Phi nước kiệu dài', 1]] },
      { weeks: 2, subjects: [['Phi nước đại', 2], ['Nhảy xào', 2]] },
    ],
  },
  {
    owner: HT3,
    name: 'Đường dài khu D',
    description: 'Giáo án thử của Khu D',
    phases: [
      { weeks: 2, subjects: [['Chạy thử 1.200 m', 1], ['Đi bộ hồi phục', 2], ['Phi nước kiệu nền', 1]] },
      { weeks: 2, subjects: [['Phi nước kiệu dài', 2], ['Bơi hồi phục', 1]] },
    ],
  },
];

/**
 * Lớp thử (chỉ HLV Khu C, D, để không trùng lịch với HLV demo). Bắt đầu hôm nay.
 * runToday: lên buổi chạy thử bắt đầu sau 1 phút rồi chạy xong ngay (điểm danh, bắt đầu, nhịp tim, hoàn thành, kết quả, đánh giá).
 * later: buổi các ngày sau [ngày thứ, giờ, môn] (ngày 0 là ngày bắt đầu lớp), đủ số buổi tối thiểu của từng tuần.
 * Chạy lại chỉ thêm buổi còn thiếu và còn ở tương lai.
 */
export const CLASSES = [
  {
    owner: HT2,
    code: 'KC-THU',
    name: 'Lớp thử Khu C',
    plan: 'Bền khu C',
    horses: ['Thiên Lý', 'Hắc Phong', 'Sao Mai'],
    later: [[1, '06:00', 'Đi bộ hồi phục'], [2, '15:00', 'Phi nước kiệu dài'], [4, '06:00', 'Đi bộ hồi phục'], [8, '06:00', 'Đi bộ hồi phục'], [9, '15:00', 'Phi nước kiệu dài'], [10, '15:00', 'Chạy thử 1.200 m'], [11, '06:00', 'Đi bộ hồi phục'], [15, '07:00', 'Phi nước đại'], [16, '07:00', 'Nhảy xào'], [18, '07:00', 'Phi nước đại'], [19, '07:00', 'Nhảy xào'], [22, '07:00', 'Phi nước đại'], [23, '07:00', 'Nhảy xào'], [25, '07:00', 'Phi nước đại'], [26, '07:00', 'Nhảy xào']],
  },
  {
    owner: HT3,
    code: 'KD-THU',
    name: 'Lớp thử Khu D',
    plan: 'Đường dài khu D',
    horses: ['Đại Bàng', 'Lam Giang', 'Công Phá'],
    later: [[1, '07:00', 'Đi bộ hồi phục'], [3, '16:00', 'Phi nước kiệu nền'], [5, '07:00', 'Đi bộ hồi phục'], [8, '07:00', 'Đi bộ hồi phục'], [9, '16:00', 'Chạy thử 1.200 m'], [10, '16:00', 'Phi nước kiệu nền'], [12, '07:00', 'Đi bộ hồi phục'], [15, '08:00', 'Phi nước kiệu dài'], [17, '08:00', 'Bơi hồi phục'], [19, '08:00', 'Phi nước kiệu dài'], [22, '08:00', 'Phi nước kiệu dài'], [24, '08:00', 'Bơi hồi phục'], [26, '08:00', 'Phi nước kiệu dài']],
  },
];

/** Vật tư: tồn và đơn giá ban đầu. Điện giải để dưới ngưỡng cho có nhãn Sắp hết. */
export const SUPPLIES = [
  { name: 'Yến mạch', category: 'FEED', unit: 'kg', reorderThreshold: 50, quantityOnHand: 180, openingUnitPrice: 15000 },
  { name: 'Cỏ khô Timothy', category: 'FEED', unit: 'bao', reorderThreshold: 8, quantityOnHand: 30, openingUnitPrice: 85000 },
  { name: 'Cám hỗn hợp', category: 'FEED', unit: 'kg', reorderThreshold: 40, quantityOnHand: 120, openingUnitPrice: 12000 },
  { name: 'Cà rốt', category: 'FEED', unit: 'kg', reorderThreshold: 15, quantityOnHand: 40, openingUnitPrice: 18000 },
  { name: 'Vitamin E', category: 'SUPPLEMENT', unit: 'lọ', reorderThreshold: 5, quantityOnHand: 20, openingUnitPrice: 120000 },
  { name: 'Điện giải', category: 'SUPPLEMENT', unit: 'gói', reorderThreshold: 10, quantityOnHand: 6, openingUnitPrice: 25000 },
  { name: 'Amoxicillin', category: 'MEDICINE', unit: 'hộp', reorderThreshold: 3, quantityOnHand: 12, openingUnitPrice: 95000 },
  { name: 'Ivermectin', category: 'MEDICINE', unit: 'tuýp', reorderThreshold: 4, quantityOnHand: 15, openingUnitPrice: 60000 },
  { name: 'Băng thun', category: 'EQUIPMENT', unit: 'cuộn', reorderThreshold: 10, quantityOnHand: 25, openingUnitPrice: 30000 },
  { name: 'Bàn chải lông', category: 'EQUIPMENT', unit: 'cái', reorderThreshold: 4, quantityOnHand: 8, openingUnitPrice: 70000 },
];

/** Lô nhập thêm (Quản lý CLB). */
export const RECEIPTS = [{ item: 'Yến mạch', quantity: 100, unitPrice: 16000, note: 'Lô mới của đại lý Minh Phát' }];

/** Xuất dùng: [người, vật tư, số lượng, ghi chú]. */
export const USAGES = [
  [GROOM1, 'Yến mạch', 8, 'Cho ăn sáng Khu A'],
  [GROOM3, 'Cỏ khô Timothy', 2, 'Cho ăn tối Khu C'],
  [GROOM4, 'Cà rốt', 3, 'Thưởng sau buổi tập Khu D'],
  [VET1, 'Amoxicillin', 1, 'Điều trị Hắc Phong'],
];

/** Đề xuất bổ sung: [người gửi, vật tư, nhu cầu, xử lý]. xử lý: PENDING | FULFILL [số, giá] | REJECT lý do. */
export const REQUESTS = [
  { by: GROOM2, item: 'Cỏ khô Timothy', note: 'Cần thêm khoảng 10 bao cho Khu B tuần tới', action: 'PENDING' },
  { by: GROOM4, item: 'Cám hỗn hợp', note: 'Khu D sắp dùng hết cám, cần khoảng 50 kg', action: 'FULFILL', quantity: 50, unitPrice: 12500 },
  { by: GROOM3, item: 'Bàn chải lông', note: 'Xin thêm 2 bàn chải cho Khu C', action: 'REJECT', reason: 'Kho còn đủ 8 cái, dùng chung giữa các khu' },
];

/** Khẩu phần theo khu: [bữa, vật tư, số lượng]. HLV khu lập và áp dụng cho mọi ngựa đang có ô trong khu. */
export const FEEDING = [
  ['EARLY_MORNING', 'Yến mạch', 2.5],
  ['EARLY_MORNING', 'Vitamin E', 0.1],
  ['NOON', 'Cà rốt', 1],
  ['EVENING', 'Cỏ khô Timothy', 0.5],
  ['EVENING', 'Cám hỗn hợp', 2],
];

/** Số đo ban đầu theo ngựa (Groom phụ trách nhập). */
export const MEASUREMENTS = {
  'Kim Ô': { WEIGHT: 520, TEMPERATURE: 37.6, HEIGHT: 165, BODY_CONDITION: 5 },
  'Tuyết Sơn': { WEIGHT: 470, TEMPERATURE: 37.5, HEIGHT: 160, BODY_CONDITION: 5 },
  'Hòa Âm': { WEIGHT: 445, TEMPERATURE: 37.7, HEIGHT: 155, BODY_CONDITION: 6 },
  // Hai lần đo để màn chỉ số cơ thể có dòng "Lần trước".
  'Xích Thố': [{ WEIGHT: 501, TEMPERATURE: 37.6, HEIGHT: 166, BODY_CONDITION: 5 }, { WEIGHT: 505, TEMPERATURE: 37.8, HEIGHT: 166, BODY_CONDITION: 5 }],
  'Bạch Long': { WEIGHT: 460, TEMPERATURE: 37.6, HEIGHT: 157, BODY_CONDITION: 5 },
  'Phong Vân': { WEIGHT: 455, TEMPERATURE: 37.9, HEIGHT: 161, BODY_CONDITION: 5 },
  'Thiên Lý': { WEIGHT: 515, TEMPERATURE: 37.7, HEIGHT: 167, BODY_CONDITION: 5 },
  'Hắc Phong': { WEIGHT: 498, TEMPERATURE: 38.1, HEIGHT: 164, BODY_CONDITION: 4 },
  'Sao Mai': { WEIGHT: 438, TEMPERATURE: 37.9, HEIGHT: 154, BODY_CONDITION: 4 },
  'Đại Bàng': { WEIGHT: 530, TEMPERATURE: 37.6, HEIGHT: 168, BODY_CONDITION: 6 },
  'Lam Giang': { WEIGHT: 462, TEMPERATURE: 37.8, HEIGHT: 159, BODY_CONDITION: 5 },
  'Công Phá': { WEIGHT: 450, TEMPERATURE: 37.7, HEIGHT: 156, BODY_CONDITION: 5 },
};

/** Sự cố tại chuồng do Groom báo (không khẩn). resolve: HLV khu đóng kèm ghi chú. */
export const INCIDENTS = [
  { by: GROOM4, horse: 'Công Phá', description: 'Móng chân trước phải bị xước nhẹ sau khi đá vào vách ô, không chảy máu', urgent: false },
  { by: GROOM1, horse: 'Bạch Long', description: 'Bỏ ăn bữa sáng, uống nước bình thường', urgent: false, resolve: { by: HT1, resolution: 'Đã kiểm tra, ngựa ăn lại bữa trưa. Theo dõi thêm 1 ngày' } },
];

/** Phụ phí riêng từng ngựa (Quản lý CLB tạo, HLV khu xác nhận). */
export const SURCHARGES = [{ horse: 'Hắc Phong', description: 'Thuốc bổ phục hồi khớp', dailyAmount: 50000, days: 14, applyBy: HT2 }];

/** Lịch chăm sóc của bác sĩ: [ngựa, loại, sau mấy ngày, giờ, bác sĩ được giao (null là chưa giao), ghi chú]. */
export const CARE_SCHEDULES = [
  ['Xích Thố', 'VACCINATION', 3, '08:00', VET1, 'Vắc-xin cúm ngựa, mũi nhắc lại'],
  ['Thiên Lý', 'VACCINATION', 5, '08:30', VET2, 'Vắc-xin uốn ván định kỳ'],
  ['Công Phá', 'VACCINATION', 2, '09:00', null, 'Vắc-xin cúm ngựa'],
  ['Hòa Âm', 'DEWORMING', 10, '08:00', VET1, 'Tẩy giun định kỳ 3 tháng'],
  ['Phong Vân', 'FARRIER', 4, '07:30', VET1, 'Hẹn thợ móng sửa và đóng móng trước'],
];

/** Hẹn khám định kỳ: [ngựa, sau mấy ngày, giờ]. */
export const CHECKUP_APPOINTMENTS = [['Tuyết Sơn', 7, '09:00']];

/**
 * Kịch bản y tế. Chạy trước huấn luyện để ngựa chấn thương, cần theo dõi hiện đúng trong lớp thử.
 * - injured: Groom báo sự cố khẩn → bác sĩ khám theo yêu cầu, mở bệnh án, Chấn thương, khóa tập, gắn việc riêng.
 * - closed: mở bệnh án rồi tái khám lành, đóng bệnh án.
 * - observation: HLV gửi yêu cầu → bác sĩ khám bình thường, sức khỏe Cần theo dõi.
 * - pending: HLV gửi yêu cầu khám, để chờ trong hàng đợi.
 * - routine: khám định kỳ bình thường.
 */
export const MEDICAL = {
  injured: {
    horse: 'Hắc Phong',
    groom: GROOM3,
    incident: 'Đi khập khiễng chân sau phải sau buổi kiệu sáng, sờ khớp cổ chân thấy nóng',
    vet: VET1,
    initialDiagnosis: 'Bong gân khớp cổ chân sau phải',
    diagnosis: 'Sưng nóng khớp cổ chân sau phải, đau khi gập. Nghỉ tập, chườm lạnh, kháng viêm 5 ngày.',
    careInstructions: 'Ngâm chân nước đá 15 phút sau mỗi bữa. Không tắm ướt chân sau phải. Báo ngay nếu ngựa bỏ ăn.',
    healthReason: 'Bong gân khớp cổ chân, cần nghỉ tập',
    injury: { bodyRegion: 'RIGHT_HIND_LEG', injuryType: 'SPRAIN', recoveryStatus: 'ACUTE', notes: 'Sưng nóng, đau khi gập khớp' },
    prescription: { medicine: 'Phenylbutazone', dosage: '2 g', frequency: '2 lần/ngày', days: 5 },
    cost: 800000,
    lockReason: 'Bong gân khớp cổ chân sau phải, nghỉ tập tới khi tái khám',
    lockDays: 10,
    extraTask: { type: 'Ngâm chân nước đá', days: 7, note: '15 phút sau mỗi bữa' },
    exemptTask: { type: 'Tắm rửa', days: 7, note: 'Vết bong gân chưa được để ướt' },
  },
  closed: {
    horse: 'Lam Giang',
    vet: VET2,
    initialDiagnosis: 'Viêm da vùng bụng do côn trùng đốt',
    diagnosis: 'Nhiều nốt sưng đỏ vùng bụng, ngứa. Bôi thuốc, vệ sinh ô chuồng.',
    injury: { bodyRegion: 'ABDOMEN', injuryType: 'INFLAMMATION', recoveryStatus: 'RECOVERING', notes: 'Nốt sưng đỏ rải rác' },
    cost: 600000,
    followUp: { diagnosis: 'Các nốt viêm đã khô, hết ngứa.', cost: 500000 },
    finalConclusion: 'Viêm da đã khỏi, tiếp tục tập bình thường',
  },
  observation: {
    horse: 'Sao Mai',
    requestBy: HT2,
    request: 'Ăn ít hai ngày nay, đi lại hơi chậm',
    vet: VET1,
    diagnosis: 'Nhiệt độ bình thường, răng và miệng không có vấn đề. Có thể mệt sau đợt tập dồn.',
    healthReason: 'Theo dõi ăn uống thêm 1 tuần, chỉ tập buổi Nhẹ',
    careInstructions: 'Ghi lại lượng ăn mỗi bữa. Cho thêm cà rốt buổi trưa.',
    cost: 300000,
  },
  pending: { horse: 'Đại Bàng', requestBy: HT3, request: 'Ho khan vào buổi sáng, chảy nước mũi trong', urgent: false },
  routine: { horse: 'Bạch Long', vet: VET2, diagnosis: 'Khám định kỳ: tim phổi bình thường, móng tốt.', cost: 200000 },
};
