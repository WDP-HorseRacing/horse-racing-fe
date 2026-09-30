// Tạo dữ liệu demo qua API (chạy lại được: bước nào lỗi thì log và đi tiếp).
import { login, client, PASSWORD } from './api.mjs';

const step = async (label, fn) => {
  try {
    const r = await fn();
    console.log('OK ', label);
    return r;
  } catch (e) {
    console.log('ERR', label, '-', e.message);
    return undefined;
  }
};
const iso = (daysFromNow, hour = 8) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const day = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const cm = client(await login('nhatruong5012@gmail.com'));
const U = {
  cm: '4d2f2949-9d29-4a64-81c0-807c481188f1',
  ht: '91315bf7-3eef-4d8c-a403-c20245b6cb36',
  owner: '0831b413-cf10-445e-96eb-97f354ef517d',
  groom: '793a2d08-28af-4652-9988-037be0d111de',
  vet: 'd5a2188a-ab75-4537-b370-ddfc7c31e8ae',
};
const H = {
  saoMai: 'a0000000-0000-4000-8000-000000000001',
  gioBac: 'a0000000-0000-4000-8000-000000000002',
  hoaLong: 'a0000000-0000-4000-8000-000000000003',
  bachVan: 'a0000000-0000-4000-8000-000000000004',
  thienLy: 'a0000000-0000-4000-8000-000000000005',
  ngocLan: 'a0000000-0000-4000-8000-000000000007',
  kimO: 'a0000000-0000-4000-8000-000000000008',
  lamGiang: 'a0000000-0000-4000-8000-000000000011',
  daiBang: 'a0000000-0000-4000-8000-000000000012',
  xichTho: 'a0000000-0000-4000-8000-000000000013',
};
const B = {
  a: 'b0000000-0000-4000-8000-000000000001',
  b: 'b0000000-0000-4000-8000-000000000002',
  iso: 'b0000000-0000-4000-8000-000000000003',
  c: 'b0000000-0000-4000-8000-000000000004',
};

// 1. Tên người dùng và khu dễ đọc
for (const [id, fullName] of [
  [U.ht, 'Trần Minh Quân'],
  [U.owner, 'Lý Quốc Thịnh'],
  [U.groom, 'Nguyễn Văn Bình'],
  [U.vet, 'Phạm Thu Hà'],
]) {
  await step(`doi ten ${fullName}`, () => cm.patch(`/users/${id}`, { fullName }));
}
for (const [id, name] of [
  [B.a, 'Khu A'],
  [B.b, 'Khu B'],
  [B.c, 'Khu C'],
  [B.iso, 'Khu cách ly'],
]) {
  await step(`doi ten ${name}`, () => cm.patch(`/barns/${id}`, { name }));
}

// 2. Thêm người dùng
const users = await cm.get('/users?limit=100');
const byEmail = Object.fromEntries(users.items.map((u) => [u.email, u.id]));
for (const [fullName, email, role] of [
  ['Lê Hoàng Nam', 'nam.le@horseracing.vn', 'HEAD_TRAINER'],
  ['Đỗ Văn Khoa', 'khoa.do@horseracing.vn', 'VETERINARIAN'],
  ['Hồ Thị Mai', 'mai.ho@horseracing.vn', 'GROOM'],
  ['Lê Văn Lực', 'luc.le@horseracing.vn', 'GROOM'],
  ['Châu Ngọc Anh', 'anh.chau@horseracing.vn', 'HORSE_OWNER'],
]) {
  if (byEmail[email]) continue;
  const u = await step(`tao ${fullName}`, () => cm.post('/users', { fullName, email, role, password: PASSWORD }));
  if (u) byEmail[email] = u.id;
}
const ht2 = byEmail['nam.le@horseracing.vn'];

// 3. Khu B và Khu C cho HT thứ hai; thêm ô cho Khu C
await step('Khu B -> Le Hoang Nam', () => cm.patch(`/barns/${B.b}`, { headTrainerId: ht2 }));
await step('Khu C -> Le Hoang Nam', () =>
  cm.patch(`/barns/${B.c}`, { headTrainerId: ht2, description: 'Khu mới mở, gần sân tập phụ' }),
);
for (const code of ['SD-C01', 'SD-C02', 'SD-C03']) {
  await step(`tao o ${code}`, () => cm.post('/stalls', { barnId: B.c, code }));
}
await step('Ngoc Lan chu Chau Ngoc Anh', async () => {
  const h = await cm.get(`/horses/${H.ngocLan}`);
  return cm.patch(`/horses/${H.ngocLan}`, { version: h.version, ownerId: byEmail['anh.chau@horseracing.vn'] });
});

// 4. Y tế (bác sĩ Phạm Thu Hà)
const vet = client(await login('minhff.net@gmail.com'));
for (const [hid, back] of [
  [H.saoMai, 3],
  [H.gioBac, 5],
  [H.hoaLong, 6],
  [H.daiBang, 2],
  [H.kimO, 4],
]) {
  await step(`kham dinh ky ${hid.slice(-2)}`, () =>
    vet.post(`/horses/${hid}/medical-records`, {
      kind: 'ROUTINE',
      conclusion: 'NORMAL',
      examDate: iso(-back, 9),
      diagnosis: 'Thể trạng tốt, tim phổi bình thường, móng khỏe.',
      measurements: [
        { type: 'WEIGHT', value: 480 + back * 3 },
        { type: 'TEMPERATURE', value: 37.8 },
      ],
    }),
  );
}

// Thiên Lý: mở bệnh án chấn thương, có đơn thuốc, chấn thương, ghi chú chăm sóc, hẹn tái khám, rồi tái khám
const open = await step('Thien Ly mo benh an', () =>
  vet.post(`/horses/${H.thienLy}/medical-records`, {
    kind: 'ROUTINE',
    conclusion: 'ISSUE',
    examDate: iso(-5, 10),
    initialDiagnosis: 'Viêm gân gấp chân trước trái',
    diagnosis: 'Sưng nóng mặt sau cẳng chân trước trái, đau khi ấn. Siêu âm thấy tổn thương gân gấp nông mức độ nhẹ.',
    careInstructions: 'Chườm lạnh chân trước trái 2 lần/ngày, mỗi lần 20 phút. Chỉ dắt bộ nhẹ 10 phút.',
    nextVisitAt: iso(2, 9),
    measurements: [{ type: 'TEMPERATURE', value: 38.1 }],
    prescriptions: [{ medicine: 'Phenylbutazone', dosage: '2 g', frequency: '1 lần/ngày', startDate: day(-5), endDate: day(2) }],
    injuries: [{ bodyRegion: 'LEFT_FRONT_LEG', injuryType: 'INFLAMMATION', recoveryStatus: 'ACUTE', notes: 'Gân gấp nông, 1/3 giữa cẳng' }],
  }),
);
if (open?.caseId) {
  await step('Thien Ly tai kham', () =>
    vet.post(`/medical-cases/${open.caseId}/visits`, {
      examDate: iso(-1, 9),
      diagnosis: 'Giảm sưng, còn đau nhẹ khi ấn.',
      careInstructions: 'Tiếp tục chườm lạnh 2 lần/ngày. Tăng dắt bộ lên 15 phút.',
      nextVisitAt: iso(3, 9),
      injuries: [{ bodyRegion: 'LEFT_FRONT_LEG', injuryType: 'INFLAMMATION', recoveryStatus: 'RECOVERING' }],
    }),
  );
}

// Lam Giang: mở rồi đóng bệnh án (chủ thấy chi phí)
const lg = await step('Lam Giang mo benh an', () =>
  vet.post(`/horses/${H.lamGiang}/medical-records`, {
    kind: 'ROUTINE',
    conclusion: 'ISSUE',
    examDate: iso(-6, 14),
    initialDiagnosis: 'Vết rách da đùi sau phải',
    diagnosis: 'Vết rách 6 cm, không tổn thương cơ. Khâu 5 mũi.',
    careInstructions: 'Giữ vết thương khô, thay băng mỗi sáng.',
    injuries: [{ bodyRegion: 'RIGHT_HIND_LEG', injuryType: 'LACERATION', recoveryStatus: 'ACUTE' }],
    prescriptions: [{ medicine: 'Amoxicillin', dosage: '10 mg/kg', frequency: '2 lần/ngày', startDate: day(-6), endDate: day(-1) }],
  }),
);
if (lg?.caseId) {
  await step('Lam Giang tai kham', () =>
    vet.post(`/medical-cases/${lg.caseId}/visits`, {
      examDate: iso(-1, 10),
      diagnosis: 'Vết thương lành tốt, đã cắt chỉ.',
      healthStatus: 'UNDER_OBSERVATION',
      healthReason: 'Vết thương đã lành, theo dõi thêm trước khi tập nặng',
      injuries: [{ bodyRegion: 'RIGHT_HIND_LEG', injuryType: 'LACERATION', recoveryStatus: 'HEALED' }],
    }),
  );
  const prev = await step('Lam Giang xem truoc dong', () => vet.get(`/medical-cases/${lg.caseId}/close-preview`));
  const body = { finalConclusion: 'Vết rách đã lành hoàn toàn, không để lại di chứng.', totalCost: 3500000 };
  if (prev?.activeLock) body.lockDecision = 'RELEASE';
  await step('Lam Giang dong benh an', () => vet.post(`/medical-cases/${lg.caseId}/close`, body));
}

// Khóa huấn luyện cho Thiên Lý (tự gắn vào bệnh án mở), hẹn khám định kỳ
await step('khoa Thien Ly', () =>
  vet.post(`/horses/${H.thienLy}/training-locks`, { reason: 'Viêm gân gấp, cấm vận động mạnh', lockEnd: iso(14, 0) }),
);
await step('hen kham Xich Tho', () => vet.put(`/horses/${H.xichTho}/checkup-appointment`, { scheduledAt: iso(1, 8) }));

// 5. Yêu cầu khám và số đo
const groom = client(await login('tnhdarkrai1457@gmail.com'));
const myHorses = await groom.get('/horses?myHorses=true&limit=100');
console.log('Groom Binh phu trach:', myHorses.items.map((h) => h.name).join(', '));
const gh = myHorses.items.find((h) => h.lifecycleStatus === 'ACTIVE' && h.healthStatus === 'ELIGIBLE');
if (gh) {
  await step(`Groom bao ${gh.name}`, () =>
    groom.post(`/horses/${gh.id}/exam-requests`, { description: 'Ăn ít hơn bình thường từ tối qua, phân hơi lỏng.' }),
  );
}
const ht = client(await login('nhatruong5020@gmail.com'));
await step('HT yeu cau khan Xich Tho', () =>
  ht.post(`/horses/${H.xichTho}/exam-requests`, { description: 'Đi khập khiễng chân sau phải sau buổi tập sáng.', urgent: true }),
);
await step('HT ghi sot Bach Van', () =>
  ht.post(`/horses/${H.bachVan}/measurements`, { values: [{ type: 'TEMPERATURE', value: 39.1 }], confirmAbnormal: true }),
);
await step('HT ghi can Gio Bac', () =>
  ht.post(`/horses/${H.gioBac}/measurements`, { values: [{ type: 'WEIGHT', value: 502 }, { type: 'BODY_CONDITION', value: 5 }] }),
);

// 6. Lịch chăm sóc
await step('tiem phong Sao Mai', () =>
  vet.post(`/horses/${H.saoMai}/care-schedules`, { type: 'VACCINATION', dueAt: iso(2, 8), notes: 'Cúm ngựa mũi nhắc lại' }),
);
await step('tay giun Gio Bac', () =>
  vet.post(`/horses/${H.gioBac}/care-schedules`, { type: 'DEWORMING', dueAt: iso(0, 23), notes: 'Ivermectin đường uống' }),
);
await step('kiem tra mong Hoa Long', () => vet.post(`/horses/${H.hoaLong}/care-schedules`, { type: 'FARRIER', dueAt: iso(5, 8) }));
if (gh) {
  await step(`tay giun ${gh.name} giao Groom`, () =>
    vet.post(`/horses/${gh.id}/care-schedules`, {
      type: 'DEWORMING',
      dueAt: iso(1, 8),
      assignedTo: U.groom,
      notes: 'Groom cho uống thuốc sau bữa sáng',
    }),
  );
}
console.log('xong');
