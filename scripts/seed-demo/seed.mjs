#!/usr/bin/env node
// Tạo dữ liệu mẫu cho môi trường demo qua REST API (không đụng DB trực tiếp).
//   node scripts/seed-demo/seed.mjs check   Kiểm 5 tài khoản có sẵn đăng nhập được, đúng vai trò.
//   node scripts/seed-demo/seed.mjs run     Tạo dữ liệu. Chạy lại không tạo trùng (tìm trước rồi mới tạo).
//   node scripts/seed-demo/seed.mjs daily   Thêm dữ liệu của ngày hôm nay (số đo, tick checklist, một buổi chạy thử xong).
// Tùy chọn: --api <url> (mặc định http://localhost:3000/api/v1, hoặc biến SEED_API).
// Mật khẩu chung của các tài khoản lấy từ biến môi trường SEED_PASSWORD, thiếu thì hỏi trong terminal (không hiện chữ). Không ghi trong file.
// Gọi tuần tự từng request (BE khóa dòng khi ghi, gọi song song dễ bị 409). Gặp lỗi thì dừng và in câu báo của BE.
import readline from 'node:readline';
import * as D from './data.mjs';

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('--')) ?? 'help';
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const API = (flag('api') ?? process.env.SEED_API ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
let PASSWORD = process.env.SEED_PASSWORD;

/** Hỏi mật khẩu trong terminal, chữ gõ vào không hiện ra màn hình. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) process.stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

/* ===== In ra màn hình ===== */
const log = {
  step: (title) => console.log(`\n== ${title}`),
  ok: (text) => console.log(`  + ${text}`),
  skip: (text) => console.log(`  = ${text}`),
  warn: (text) => console.log(`  ! ${text}`),
};

/* ===== Giờ câu lạc bộ (UTC+7) ===== */
const OFFSET = 7 * 3600 * 1000;
const dateKey = (offsetDays = 0) => new Date(Date.now() + OFFSET + offsetDays * 86400000).toISOString().slice(0, 10);
const at = (key, hhmm) => new Date(`${key}T${hhmm}:00+07:00`).toISOString();
const addDays = (key, days) => new Date(Date.parse(`${key}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ===== Gọi API theo tài khoản ===== */
class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const sessions = new Map();

async function rawRequest(method, path, { token, body, query } = {}) {
  const url = new URL(`${API}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const fields = Array.isArray(data?.errors) ? ` (${data.errors.map((item) => `${item.field}: ${item.message}`).join(', ')})` : '';
    throw new ApiError(response.status, `${method} ${path} → ${response.status} ${data?.message ?? text}${fields}`, data);
  }
  return data;
}

async function login(email) {
  const data = await rawRequest('POST', '/auth/login', { body: { email, password: PASSWORD } });
  const session = { access: data.accessToken, refresh: data.refreshToken, expiresAt: Date.now() + (data.expiresIn ?? 300) * 1000 };
  sessions.set(email, session);
  return session;
}

async function tokenOf(email) {
  let session = sessions.get(email);
  if (!session) return (await login(email)).access;
  if (session.expiresAt - Date.now() < 30_000) {
    try {
      const data = await rawRequest('POST', '/auth/refresh', { body: { refreshToken: session.refresh } });
      session = { access: data.accessToken, refresh: data.refreshToken, expiresAt: Date.now() + (data.expiresIn ?? 300) * 1000 };
      sessions.set(email, session);
    } catch {
      session = await login(email);
    }
  }
  return session.access;
}

/** Client gọi API dưới tên một tài khoản. 401 thì đăng nhập lại một lần. */
function as(email) {
  const call = async (method, path, body, query) => {
    try {
      return await rawRequest(method, path, { token: await tokenOf(email), body, query });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await login(email);
        return rawRequest(method, path, { token: await tokenOf(email), body, query });
      }
      throw error;
    }
  };
  return {
    get: (path, query) => call('GET', path, undefined, query),
    post: (path, body) => call('POST', path, body ?? {}),
    patch: (path, body) => call('PATCH', path, body),
    put: (path, body) => call('PUT', path, body),
    all: async (path, query = {}) => {
      const items = [];
      for (let page = 1; page <= 50; page += 1) {
        const result = await call('GET', path, undefined, { ...query, page, limit: 100 });
        items.push(...(result.items ?? []));
        if (!result.meta || page >= result.meta.totalPages) break;
      }
      return items;
    },
  };
}

/* ===== check ===== */
async function check() {
  log.step(`Kiểm 5 tài khoản có sẵn trên ${API}`);
  let ok = true;
  for (const account of D.BASE_ACCOUNTS) {
    try {
      const session = await login(account.email);
      const me = await rawRequest('GET', '/auth/me', { token: session.access });
      const role = me.role ?? me.roles?.[0];
      const good = role === account.role && me.status === 'ACTIVE';
      ok &&= good;
      // BE nối tài khoản Keycloak với dòng users theo keycloak_id, không theo email: email, họ tên trong app có thể khác email đăng nhập.
      ids.users[account.email] = me.userId ?? me.id;
      const shown = me.email && me.email.toLowerCase() !== account.email ? `, trong app là ${me.fullName ?? ''} <${me.email}>` : '';
      (good ? log.ok : log.warn)(`${account.email}: vai trò ${role}, trạng thái ${me.status}${shown}${good ? '' : ` (mong đợi ${account.role}, ACTIVE)`}`);
    } catch (error) {
      ok = false;
      const message = error instanceof ApiError ? error.body?.message ?? error.message : String(error);
      log.warn(`${account.email}: KHÔNG đăng nhập được: ${message}`);
      if (error instanceof ApiError && error.status === 401 && /chưa được cấp/i.test(message)) {
        log.warn('  → Tài khoản có trong Keycloak nhưng chưa có dòng trong bảng users của app. Nhờ nhóm BE chạy:');
        log.warn(`    INSERT INTO users (keycloak_id, full_name, email, role, status, version) VALUES ('<id ở Keycloak Admin → Users>', '<họ tên>', '${account.email}', '${account.role}', 'ACTIVE', 1);`);
      }
    }
  }
  if (sessions.has(D.CM)) {
    try {
      await as(D.CM).get('/users', { limit: 1 });
      log.ok('Quản lý CLB đọc được danh sách tài khoản');
    } catch (error) {
      ok = false;
      log.warn(`Quản lý CLB không đọc được danh sách tài khoản: ${error.message}`);
    }
  }
  console.log(ok ? '\nĐủ điều kiện chạy: node scripts/seed-demo/seed.mjs run' : '\nCòn lỗi ở trên, sửa xong rồi mới chạy run.');
  return ok;
}

/* ===== run ===== */
const ids = { users: {}, barns: {}, stalls: {}, horses: {}, subjects: {}, plans: {}, items: {}, taskTypes: {} };
const horseByName = (name) => {
  const id = ids.horses[name];
  if (!id) throw new Error(`Chưa có ngựa ${name}`);
  return id;
};

async function seedUsers() {
  log.step('Tài khoản');
  const cm = as(D.CM);
  const existing = await cm.all('/users');
  const byEmail = new Map(existing.map((user) => [user.email.toLowerCase(), user]));
  for (const user of D.EXTRA_USERS) {
    if (byEmail.has(user.email)) {
      log.skip(`${user.email} đã có`);
      continue;
    }
    const created = await cm.post('/users', { fullName: user.fullName, email: user.email, role: user.role, password: PASSWORD });
    byEmail.set(user.email, created);
    log.ok(`Tạo ${user.email} (${user.role})`);
  }
  // 5 tài khoản gốc đã lấy id ở bước check (theo /auth/me), không tìm theo email.
  for (const user of D.EXTRA_USERS) ids.users[user.email] = byEmail.get(user.email)?.id;
  for (const email of [...D.BASE_ACCOUNTS.map((item) => item.email), ...D.EXTRA_USERS.map((item) => item.email)]) {
    if (!ids.users[email]) throw new Error(`Không tìm thấy tài khoản ${email} trong danh sách users`);
  }
}

async function seedTaskTypes() {
  log.step('Loại việc hằng ngày');
  const cm = as(D.CM);
  let types = await cm.get('/care-task-types');
  log.skip(`Đang có: ${types.map((type) => type.name).join(', ') || '(chưa có loại nào)'}`);
  for (const rename of D.TASK_TYPE_RENAMES) {
    const from = types.find((type) => type.name === rename.from);
    if (!from) continue;
    if (types.some((type) => type.name === rename.to)) continue;
    try {
      await cm.patch(`/care-task-types/${from.id}`, { name: rename.to });
      log.ok(`Đổi "${rename.from}" thành "${rename.to}"`);
    } catch (error) {
      log.warn(`Không đổi được "${rename.from}": ${error.message}`);
    }
  }
  types = await cm.get('/care-task-types');
  for (const type of D.TASK_TYPES) {
    // "Cho ăn" không đổi tên được (đã có trong checklist) thì không tạo thêm "Cho ăn sáng" trùng việc.
    const unrenamed = D.TASK_TYPE_RENAMES.find((rename) => rename.to === type.name && types.some((item) => item.name === rename.from));
    if (unrenamed) {
      log.skip(`Giữ "${unrenamed.from}", không tạo "${type.name}"`);
      continue;
    }
    if (types.some((item) => item.name === type.name)) {
      log.skip(`"${type.name}" đã có`);
      continue;
    }
    try {
      await cm.post('/care-task-types', type);
      log.ok(`Thêm "${type.name}"`);
    } catch (error) {
      log.warn(`Không thêm được "${type.name}": ${error.message}`);
    }
  }
  for (const type of await cm.get('/care-task-types')) ids.taskTypes[type.name] = type.id;
}

async function seedDailyFee() {
  log.step('Phí nuôi');
  const cm = as(D.CM);
  const fees = await cm.get('/daily-fees');
  if (fees.length) {
    log.skip(`Đã có ${fees.length} mức phí`);
    return;
  }
  await cm.post('/daily-fees', { effectiveFrom: dateKey(), dailyFee: D.DAILY_FEE });
  log.ok(`Phí nuôi ${D.DAILY_FEE.toLocaleString('vi-VN')} đ/ngày từ ${dateKey()}`);
}

async function seedBarns() {
  log.step('Khu và ô chuồng');
  const cm = as(D.CM);
  const barns = await cm.get('/barns');
  for (const barn of D.BARNS) {
    let row = barns.find((item) => item.name === barn.name);
    if (!row) {
      row = await cm.post('/barns', { name: barn.name, description: barn.description, capacity: barn.capacity });
      log.ok(`Tạo ${barn.name}`);
    } else log.skip(`${barn.name} đã có`);
    ids.barns[barn.name] = row.id;
    const trainerId = ids.users[barn.headTrainer];
    const current = await cm.get(`/barns/${row.id}`);
    if (current.headTrainerId !== trainerId && current.headTrainer?.id !== trainerId) {
      await cm.patch(`/barns/${row.id}`, { headTrainerId: trainerId });
      log.ok(`Giao ${barn.name} cho ${barn.headTrainer}`);
    }
    const stalls = await cm.get('/stalls', { barnId: row.id });
    const wanted = [
      ...Array.from({ length: barn.stalls }, (_, index) => ({ code: `${barn.prefix}-${String(index + 1).padStart(2, '0')}`, type: 'STANDARD' })),
      ...(barn.extraStalls ?? []),
    ];
    for (const stall of wanted) {
      let found = stalls.find((item) => item.code === stall.code);
      if (!found) {
        found = await cm.post('/stalls', { barnId: row.id, ...stall });
        log.ok(`Tạo ô ${stall.code}`);
      }
      ids.stalls[stall.code] = found.id;
    }
  }
}

async function seedSupplies() {
  log.step('Vật tư');
  const cm = as(D.CM);
  const items = await cm.all('/supplies/items');
  for (const item of D.SUPPLIES) {
    let found = items.find((row) => row.name.toLowerCase() === item.name.toLowerCase());
    if (!found) {
      found = await cm.post('/supplies/items', item);
      log.ok(`Tạo ${item.name} (${item.quantityOnHand} ${item.unit})`);
    } else log.skip(`${item.name} đã có`);
    ids.items[item.name] = found.id;
  }
}

async function seedSubjects() {
  log.step('Môn học');
  const cm = as(D.CM);
  const subjects = await cm.get('/training-subjects');
  for (const subject of D.SUBJECTS) {
    let found = subjects.find((row) => row.name.toLowerCase() === subject.name.toLowerCase());
    if (!found) {
      found = await cm.post('/training-subjects', subject);
      log.ok(`Tạo môn ${subject.name}`);
    } else log.skip(`Môn ${subject.name} đã có`);
    ids.subjects[subject.name] = found;
  }
}

async function seedHorses() {
  log.step('Ngựa');
  const cm = as(D.CM);
  const horses = await cm.all('/horses', { includeDeleted: true });
  const byChip = new Map(horses.map((horse) => [horse.microchipId, horse]));
  for (const horse of D.HORSES) {
    let found = byChip.get(horse.microchipId);
    if (!found) {
      const body = {
        name: horse.name,
        gender: horse.gender,
        breed: horse.breed,
        color: horse.color,
        dateOfBirth: horse.dateOfBirth,
        microchipId: horse.microchipId,
        ownerId: ids.users[horse.owner],
        ...(horse.sire ? { sireId: horseByName(horse.sire) } : {}),
        ...(horse.dam ? { damId: horseByName(horse.dam) } : {}),
        ...(horse.barn ? { barnId: ids.barns[horse.barn] } : {}),
      };
      found = await cm.post('/horses', body);
      log.ok(`Tạo ${horse.name}${horse.barn ? ` (${horse.barn})` : ''}`);
    } else {
      log.skip(`${horse.name} đã có`);
      await linkParents(cm, horse, found.id);
    }
    ids.horses[horse.name] = found.id;
  }
}

/** Cha mẹ thêm vào data.mjs sau lần chạy đầu: gắn bổ sung cho ngựa đã có. */
async function linkParents(cm, horse, id) {
  const parents = {
    ...(horse.sire ? { sireId: horseByName(horse.sire) } : {}),
    ...(horse.dam ? { damId: horseByName(horse.dam) } : {}),
  };
  if (!Object.keys(parents).length) return;
  const detail = await cm.get(`/horses/${id}`);
  if (Object.entries(parents).every(([key, value]) => detail[key] === value)) return;
  try {
    await cm.patch(`/horses/${id}`, { ...parents, version: detail.version });
    log.ok(`${horse.name}: gắn cha mẹ`);
  } catch (error) {
    log.warn(`${horse.name}: không gắn được cha mẹ (${error.message})`);
  }
}

/** Xếp ô kèm Groom (HLV khu), rồi đặt sở trường. */
async function seedPlacements() {
  log.step('Xếp ô, giao Groom, sở trường');
  for (const horse of D.HORSES.filter((item) => item.stall)) {
    const barn = D.BARNS.find((item) => item.name === horse.barn);
    const ht = as(barn.headTrainer);
    const id = horseByName(horse.name);
    const detail = await ht.get(`/horses/${id}`);
    if (!detail.location?.stall) {
      await ht.put(`/horses/${id}/placement`, { stallId: ids.stalls[horse.stall], groomId: ids.users[horse.groom] });
      log.ok(`${horse.name} vào ô ${horse.stall}, Groom ${horse.groom}`);
    } else log.skip(`${horse.name} đã ở ô ${detail.location.stall.code}`);
    if (horse.raceAptitude && detail.raceAptitude !== horse.raceAptitude) {
      const fresh = await ht.get(`/horses/${id}`);
      await ht.patch(`/horses/${id}`, { raceAptitude: horse.raceAptitude, version: fresh.version });
      log.ok(`${horse.name}: sở trường ${horse.raceAptitude}`);
    }
  }
}

async function seedFeeding() {
  log.step('Khẩu phần');
  for (const barn of D.BARNS) {
    const ht = as(barn.headTrainer);
    for (const horse of D.HORSES.filter((item) => item.barn === barn.name && item.stall)) {
      const id = horseByName(horse.name);
      const plans = await ht.get(`/horses/${id}/feeding-plans`);
      if (plans.some((plan) => plan.status === 'ACTIVE' || plan.status === 'DRAFT')) {
        log.skip(`${horse.name} đã có khẩu phần`);
        continue;
      }
      const items = D.FEEDING.map(([meal, item, quantity]) => ({ meal, supplyItemId: ids.items[item], quantity }));
      const [plan] = await ht.post('/feeding-plans', { horseIds: [id], items, note: `Khẩu phần chuẩn ${barn.name}` });
      await ht.post(`/feeding-plans/${plan.id}/approve`);
      log.ok(`${horse.name}: lập và áp dụng khẩu phần`);
    }
  }
}

async function seedMeasurements() {
  log.step('Số đo cơ thể');
  for (const horse of D.HORSES.filter((item) => item.groom && D.MEASUREMENTS[item.name])) {
    const id = horseByName(horse.name);
    const groom = as(horse.groom);
    // Mỗi dòng của API là một chỉ số; các chỉ số cùng một lần đo có chung measuredAt.
    const existing = await groom.get(`/horses/${id}/measurements`, { limit: 50 });
    const done = new Set((existing.items ?? []).map((item) => item.measuredAt)).size;
    const records = [D.MEASUREMENTS[horse.name]].flat();
    if (done >= records.length) {
      log.skip(`${horse.name} đã có số đo`);
      continue;
    }
    for (const record of records.slice(done)) {
      const values = Object.entries(record).map(([type, value]) => ({ type, value }));
      await groom.post(`/horses/${id}/measurements`, { values, confirmAbnormal: true });
      log.ok(`${horse.name}: ${values.map((item) => `${item.type} ${item.value}`).join(', ')}`);
    }
  }
}

async function hasCase(actor, horseId, status) {
  const result = await as(actor).get(`/horses/${horseId}/medical-cases`, status ? { status } : undefined);
  return (result.items ?? []).length > 0;
}

async function seedMedical() {
  log.step('Y tế');
  const M = D.MEDICAL;

  // Chấn thương: Groom báo khẩn → bác sĩ khám, mở bệnh án, khóa tập, gắn việc riêng.
  {
    const s = M.injured;
    const id = horseByName(s.horse);
    if (await hasCase(s.vet, id)) log.skip(`${s.horse} đã có bệnh án`);
    else {
      const vet = as(s.vet);
      let pending = (await vet.get(`/horses/${id}/exam-requests`)).filter((row) => row.status === 'PENDING');
      if (!pending.length) {
        await as(s.groom).post('/incidents', { horseId: id, description: s.incident, urgent: true });
        log.ok(`${s.groom} báo sự cố khẩn cho ${s.horse}`);
        pending = (await vet.get(`/horses/${id}/exam-requests`)).filter((row) => row.status === 'PENDING');
      }
      const today = dateKey();
      await vet.post(`/horses/${id}/medical-records`, {
        kind: 'REQUEST',
        conclusion: 'ISSUE',
        initialDiagnosis: s.initialDiagnosis,
        requestIds: pending.map((row) => row.id),
        diagnosis: s.diagnosis,
        careInstructions: s.careInstructions,
        healthStatus: 'INJURED',
        healthReason: s.healthReason,
        measurements: [{ type: 'TEMPERATURE', value: 38.2 }],
        prescriptions: [{ medicine: s.prescription.medicine, dosage: s.prescription.dosage, frequency: s.prescription.frequency, startDate: today, endDate: dateKey(s.prescription.days - 1) }],
        newInjuries: [{ ...s.injury, position: POSITION[s.injury.bodyRegion] }],
        cost: s.cost,
      });
      log.ok(`${s.horse}: khám, mở bệnh án "${s.initialDiagnosis}", Chấn thương`);
      await vet.post(`/horses/${id}/training-locks`, { reason: s.lockReason, lockEnd: at(dateKey(s.lockDays), '18:00') });
      log.ok(`${s.horse}: khóa huấn luyện`);
    }
    const vet = as(s.vet);
    const tasks = await vet.get(`/horses/${id}/care-tasks`);
    for (const [task, mode] of [[s.extraTask, 'EXTRA'], [s.exemptTask, 'EXEMPT']]) {
      if (tasks.some((row) => row.taskType?.name === task.type && row.mode === mode)) continue;
      if (!ids.taskTypes[task.type]) {
        log.warn(`${s.horse}: bỏ qua ${mode === 'EXTRA' ? 'gắn' : 'miễn'} "${task.type}" vì chưa có loại việc này`);
        continue;
      }
      await vet.post(`/horses/${id}/care-tasks`, { taskTypeId: ids.taskTypes[task.type], mode, fromDate: dateKey(), toDate: dateKey(task.days - 1), note: task.note });
      log.ok(`${s.horse}: ${mode === 'EXTRA' ? 'gắn' : 'miễn'} "${task.type}" ${task.days} ngày`);
    }
  }

  // Bệnh án đã đóng: mở → tái khám lành → đóng.
  {
    const s = M.closed;
    const id = horseByName(s.horse);
    if (await hasCase(s.vet, id)) log.skip(`${s.horse} đã có bệnh án`);
    else {
      const vet = as(s.vet);
      const record = await vet.post(`/horses/${id}/medical-records`, {
        kind: 'ROUTINE',
        conclusion: 'ISSUE',
        initialDiagnosis: s.initialDiagnosis,
        diagnosis: s.diagnosis,
        newInjuries: [{ ...s.injury, position: POSITION[s.injury.bodyRegion] }],
        cost: s.cost,
      });
      const injuries = await vet.get(`/horses/${id}/injuries`, { unhealedOnly: true });
      await vet.post(`/medical-cases/${record.caseId}/visits`, {
        diagnosis: s.followUp.diagnosis,
        injuryUpdates: injuries.map((injury) => ({ injuryId: injury.id, recoveryStatus: 'HEALED' })),
        cost: s.followUp.cost,
      });
      await vet.post(`/medical-cases/${record.caseId}/close`, { finalConclusion: s.finalConclusion });
      log.ok(`${s.horse}: bệnh án "${s.initialDiagnosis}" đã đóng`);
    }
  }

  // Cần theo dõi: HLV gửi yêu cầu → bác sĩ khám bình thường.
  {
    const s = M.observation;
    const id = horseByName(s.horse);
    const vet = as(s.vet);
    const records = await vet.get(`/horses/${id}/medical-records`);
    if ((records.items ?? records).length) log.skip(`${s.horse} đã có buổi khám`);
    else {
      let pending = (await vet.get(`/horses/${id}/exam-requests`)).filter((row) => row.status === 'PENDING');
      if (!pending.length) {
        await as(s.requestBy).post(`/horses/${id}/exam-requests`, { description: s.request, urgent: false });
        pending = (await vet.get(`/horses/${id}/exam-requests`)).filter((row) => row.status === 'PENDING');
      }
      await vet.post(`/horses/${id}/medical-records`, {
        kind: 'REQUEST',
        conclusion: 'NORMAL',
        requestIds: pending.map((row) => row.id),
        diagnosis: s.diagnosis,
        careInstructions: s.careInstructions,
        healthStatus: 'UNDER_OBSERVATION',
        healthReason: s.healthReason,
        cost: s.cost,
      });
      log.ok(`${s.horse}: khám theo yêu cầu, Cần theo dõi`);
    }
  }

  // Yêu cầu khám đang chờ.
  {
    const s = M.pending;
    const id = horseByName(s.horse);
    const requests = await as(D.VET1).get(`/horses/${id}/exam-requests`);
    if (requests.length) log.skip(`${s.horse} đã có yêu cầu khám`);
    else {
      await as(s.requestBy).post(`/horses/${id}/exam-requests`, { description: s.request, urgent: s.urgent });
      log.ok(`${s.horse}: yêu cầu khám đang chờ`);
    }
  }

  // Khám định kỳ bình thường.
  {
    const s = M.routine;
    const id = horseByName(s.horse);
    const vet = as(s.vet);
    const records = await vet.get(`/horses/${id}/medical-records`);
    if ((records.items ?? records).length) log.skip(`${s.horse} đã có buổi khám`);
    else {
      await vet.post(`/horses/${id}/medical-records`, {
        kind: 'ROUTINE',
        conclusion: 'NORMAL',
        diagnosis: s.diagnosis,
        measurements: [{ type: 'WEIGHT', value: 462 }, { type: 'TEMPERATURE', value: 37.6 }],
        cost: s.cost,
      });
      log.ok(`${s.horse}: khám định kỳ bình thường`);
    }
  }

  // Lịch chăm sóc của bác sĩ.
  for (const [horse, type, days, time, assignee, notes] of D.CARE_SCHEDULES) {
    const id = horseByName(horse);
    const vet = as(D.VET1);
    const schedules = await vet.get(`/horses/${id}/care-schedules`);
    if (schedules.some((row) => row.type === type && row.status === 'SCHEDULED')) {
      log.skip(`${horse}: đã có lịch ${type}`);
      continue;
    }
    await vet.post(`/horses/${id}/care-schedules`, { type, dueAt: at(dateKey(days), time), ...(assignee ? { assignedTo: ids.users[assignee] } : {}), notes });
    log.ok(`${horse}: lịch ${type} sau ${days} ngày`);
  }
  for (const [horse, days, time] of D.CHECKUP_APPOINTMENTS) {
    try {
      await as(D.VET1).put(`/horses/${horseByName(horse)}/checkup-appointment`, { scheduledAt: at(dateKey(days), time) });
      log.ok(`${horse}: hẹn khám định kỳ sau ${days} ngày`);
    } catch (error) {
      // Chạy lại khi đã có hẹn: BE bắt nhập lý do để dời, giữ hẹn cũ.
      if (!/lý do/i.test(error.message)) throw error;
      log.skip(`${horse}: đã có hẹn khám định kỳ`);
    }
  }
}

/** Tọa độ cố định theo vùng (giống src/lib/injury-position.ts của web). */
const POSITION = {
  HEAD: { x: 0.9, y: 0.6, z: 0 },
  NECK: { x: 0.65, y: 0.4, z: 0 },
  BACK: { x: 0, y: 0.35, z: 0 },
  CHEST: { x: 0.5, y: -0.05, z: 0 },
  ABDOMEN: { x: 0, y: -0.2, z: 0 },
  PELVIS: { x: -0.6, y: 0.25, z: 0 },
  LEFT_FRONT_LEG: { x: 0.45, y: -0.7, z: -0.2 },
  RIGHT_FRONT_LEG: { x: 0.45, y: -0.7, z: 0.2 },
  LEFT_HIND_LEG: { x: -0.55, y: -0.7, z: -0.2 },
  RIGHT_HIND_LEG: { x: -0.55, y: -0.7, z: 0.2 },
  OTHER: { x: 0, y: 0, z: 0 },
};

async function seedTraining() {
  log.step('Giáo án và lớp thử');
  const subjectId = (name) => {
    const subject = ids.subjects[name];
    if (!subject) throw new Error(`Chưa có môn ${name}`);
    return subject.id;
  };
  for (const plan of D.PLANS) {
    const ht = as(plan.owner);
    const plans = await ht.get('/training-plans');
    let found = plans.find((row) => row.name === plan.name && row.headTrainerId === ids.users[plan.owner]);
    const body = {
      name: plan.name,
      description: plan.description,
      phases: plan.phases.map((phase) => ({ weeks: phase.weeks, subjects: phase.subjects.map(([name, min]) => ({ subjectId: subjectId(name), minSessionsPerWeek: min })) })),
    };
    // So nội dung để giáo án tạo ở lần chạy trước được cập nhật theo data.mjs.
    const shape = (phases) => JSON.stringify(phases.map((phase) => [phase.weeks, phase.subjects.map((item) => `${item.subjectId}:${item.minSessionsPerWeek}`).sort()]));
    if (!found) {
      found = await ht.post('/training-plans', body);
      log.ok(`Giáo án "${plan.name}" (${plan.owner})`);
    } else {
      const saved = (found.phases ?? []).map((phase) => ({ weeks: phase.weeks, subjects: phase.subjects.map((item) => ({ subjectId: item.subject.id, minSessionsPerWeek: item.minSessionsPerWeek })) }));
      if (shape(saved) !== shape(body.phases) || found.description !== body.description) {
        found = await ht.put(`/training-plans/${found.id}`, body);
        log.ok(`Giáo án "${plan.name}": cập nhật theo data.mjs`);
      } else log.skip(`Giáo án "${plan.name}" đã có`);
    }
    ids.plans[plan.name] = found.id;
  }
  for (const cls of D.CLASSES) {
    const ht = as(cls.owner);
    const classes = await ht.get('/classes');
    let found = classes.find((row) => row.code === cls.code);
    if (!found) {
      found = await ht.post('/classes', { code: cls.code, name: cls.name, planId: ids.plans[cls.plan], startDate: dateKey(), maxHorses: 10 });
      log.ok(`Lớp ${cls.code} (${cls.owner})`);
    } else log.skip(`Lớp ${cls.code} đã có`);
    cls.id = found.id;
    const enrolled = await ht.get(`/classes/${found.id}/enrollments`);
    for (const horse of cls.horses) {
      const id = horseByName(horse);
      if (enrolled.some((row) => row.horseId === id && !row.leftAt)) continue;
      try {
        await ht.post(`/classes/${found.id}/enrollments`, { horseId: id });
        log.ok(`Ghi danh ${horse} vào ${cls.code}`);
      } catch (error) {
        log.warn(`Không ghi danh được ${horse}: ${error.message}`);
      }
    }
    // Ngày tính từ ngày bắt đầu lớp nên chạy lại hôm khác không xếp lệch; chỉ thêm buổi còn thiếu và còn ở tương lai.
    const sessions = await ht.get(`/classes/${found.id}/sessions`);
    const taken = new Set(sessions.map((row) => Date.parse(row.scheduledStartAt)));
    const start = String(found.startDate).slice(0, 10);
    const inputs = cls.later
      .map(([day, time, subject]) => ({ s: ids.subjects[subject], startAt: at(addDays(start, day), time) }))
      .filter(({ startAt }) => Date.parse(startAt) > Date.now() + 3600000 && !taken.has(Date.parse(startAt)))
      .map(({ s, startAt }) => ({
        name: s.name,
        sessionType: s.sessionType,
        subjectId: s.id,
        intensity: s.intensity,
        plannedDistanceM: s.plannedDistanceM,
        scheduledStartAt: startAt,
        scheduledEndAt: new Date(new Date(startAt).getTime() + s.durationMinutes * 60000).toISOString(),
        location: 'Đường đua số 1',
        surface: s.surface ?? undefined,
        ...(s.sessionType === 'TIME_TRIAL' ? { targetTimeMs: s.targetTimeMs } : {}),
      }));
    if (inputs.length) {
      await ht.post(`/classes/${found.id}/sessions/bulk`, { sessions: inputs });
      log.ok(`${cls.code}: xếp ${inputs.length} buổi các ngày tới`);
    } else log.skip(`${cls.code}: đã đủ buổi các ngày tới`);
  }
}

/** Một buổi chạy thử bắt đầu sau 1 phút rồi chạy xong ngay: điểm danh, sẵn sàng, bắt đầu, nhịp tim, hoàn thành, kết quả, đánh giá. */
async function runTrialToday(cls) {
  const ht = as(cls.owner);
  const sessions = await ht.get(`/classes/${cls.id}/sessions`);
  const today = dateKey();
  const clubDay = (iso) => new Date(new Date(iso).getTime() + OFFSET).toISOString().slice(0, 10);
  if (sessions.some((row) => row.sessionType === 'TIME_TRIAL' && row.status !== 'CANCELLED' && clubDay(row.scheduledStartAt) === today)) {
    log.skip(`${cls.code}: hôm nay đã có buổi chạy thử`);
    return;
  }
  const subject = ids.subjects['Chạy thử 1.200 m'];
  const start = new Date(Date.now() + 70_000);
  start.setSeconds(0, 0);
  let session;
  try {
    session = await ht.post(`/classes/${cls.id}/sessions`, {
      name: 'Chạy thử 1.200 m',
      sessionType: 'TIME_TRIAL',
      subjectId: subject.id,
      intensity: 'HEAVY',
      plannedDistanceM: 1200,
      scheduledStartAt: start.toISOString(),
      scheduledEndAt: new Date(start.getTime() + 60 * 60000).toISOString(),
      location: 'Đường đua số 1',
      surface: 'Cỏ',
      targetTimeMs: subject.targetTimeMs,
    });
  } catch (error) {
    log.warn(`${cls.code}: không lên được buổi chạy thử hôm nay (${error.message})`);
    return;
  }
  log.ok(`${cls.code}: buổi chạy thử lúc ${start.toISOString()}`);
  const participants = await ht.get(`/training-sessions/${session.id}/participants`);
  const runnable = participants.filter((row) => row.status === 'PLANNED');
  for (const row of runnable) {
    await ht.post(`/session-participants/${row.id}/check-in`);
    await ht.post(`/session-participants/${row.id}/ready`);
    await ht.post(`/session-participants/${row.id}/start`);
  }
  // Nhịp tim, tốc độ khoảng 20 giây (route không cần đăng nhập, như thiết bị thật; thời điểm đo phải là lúc gửi).
  for (let tick = 0; tick < 10; tick += 1) {
    for (const [index, row] of runnable.entries()) {
      const heartRateBpm = Math.round(150 + tick * 5 + index * 3 + Math.random() * 6);
      const speedMps = Math.round((12 + tick * 0.4 + Math.random()) * 10) / 10;
      await rawRequest('POST', `/session-participants/${row.id}/metrics/batch`, {
        body: { metrics: [{ sourceId: `seed-${row.id.slice(0, 8)}`, recordedAt: new Date().toISOString(), heartRateBpm, speedMps }] },
      }).catch(() => undefined);
    }
    await sleep(2000);
  }
  for (const [index, row] of runnable.entries()) {
    await ht.post(`/session-participants/${row.id}/complete`);
    const elapsedMs = 73500 + index * 900 + Math.round(Math.random() * 1500);
    await ht.post(`/session-participants/${row.id}/trial-results`, { attemptNo: 1, elapsedMs, notes: 'Xuất phát tốt, giữ nhịp đều' });
    await ht.post(`/session-participants/${row.id}/evaluation`, { score: 7 + (index % 3), comment: 'Nhịp chạy ổn định, cần cải thiện đoạn về đích' });
  }
  log.ok(`${cls.code}: ${runnable.length} ngựa chạy xong, có kết quả và đánh giá. ${participants.length - runnable.length} ngựa không đủ điều kiện`);
}

async function seedStableDay() {
  log.step('Checklist hôm nay và sự cố');
  for (const groom of [D.GROOM1, D.GROOM2, D.GROOM3, D.GROOM4]) {
    const today = await as(groom).get('/grooms/me/today');
    let ticked = 0;
    for (const horse of today.horses ?? []) {
      const items = horse.checklist?.items ?? [];
      // Tick khoảng một nửa việc của mỗi ngựa để màn Việc hôm nay có tiến độ dở dang.
      for (const item of items.slice(0, Math.ceil(items.length / 2)).filter((row) => !row.done)) {
        await as(groom).patch(`/checklist-items/${item.id}`, { done: true });
        ticked += 1;
      }
    }
    if (ticked) log.ok(`${groom}: tick ${ticked} việc`);
    else log.skip(`${groom}: checklist hôm nay đã tick`);
  }
  for (const incident of D.INCIDENTS) {
    const id = horseByName(incident.horse);
    const existing = await as(D.CM).all('/incidents', { horseId: id });
    if (existing.some((row) => row.description === incident.description)) {
      log.skip(`${incident.horse}: sự cố đã có`);
      continue;
    }
    const created = await as(incident.by).post('/incidents', { horseId: id, description: incident.description, urgent: incident.urgent });
    log.ok(`${incident.by} báo sự cố ${incident.horse}`);
    if (incident.resolve) {
      await as(incident.resolve.by).post(`/incidents/${created.id}/resolve`, { resolution: incident.resolve.resolution });
      log.ok(`${incident.resolve.by} đóng sự cố ${incident.horse}`);
    }
  }
}

async function seedStock() {
  log.step('Kho: nhập, xuất, đề xuất');
  const cm = as(D.CM);
  for (const receipt of D.RECEIPTS) {
    const lots = await cm.get(`/supplies/items/${ids.items[receipt.item]}/lots`);
    if (lots.length > 1) {
      log.skip(`${receipt.item} đã có lô nhập thêm`);
      continue;
    }
    await cm.post(`/supplies/items/${ids.items[receipt.item]}/receipts`, { quantity: receipt.quantity, unitPrice: receipt.unitPrice, note: receipt.note });
    log.ok(`Nhập ${receipt.quantity} ${receipt.item}`);
  }
  for (const [by, item, quantity, note] of D.USAGES) {
    const movements = await cm.get(`/supplies/items/${ids.items[item]}/movements`, { page: 1, limit: 50 });
    if ((movements.items ?? []).some((row) => row.note === note)) {
      log.skip(`Đã xuất ${item} (${note})`);
      continue;
    }
    await as(by).post(`/supplies/items/${ids.items[item]}/usages`, { quantity, note });
    log.ok(`${by} xuất ${quantity} ${item}`);
  }
  const requests = await cm.all('/supplies/requests');
  for (const request of D.REQUESTS) {
    if (requests.some((row) => row.note === request.note)) {
      log.skip(`Đề xuất "${request.note}" đã có`);
      continue;
    }
    const created = await as(request.by).post('/supplies/requests', { itemId: ids.items[request.item], note: request.note });
    if (request.action === 'FULFILL') {
      await cm.patch(`/supplies/requests/${created.id}/status`, { status: 'APPROVED' });
      await cm.patch(`/supplies/requests/${created.id}/status`, { status: 'FULFILLED', quantity: request.quantity, unitPrice: request.unitPrice });
    } else if (request.action === 'REJECT') {
      await cm.patch(`/supplies/requests/${created.id}/status`, { status: 'REJECTED', reason: request.reason });
    }
    log.ok(`Đề xuất ${request.item} của ${request.by}: ${request.action}`);
  }
}

async function seedBilling() {
  log.step('Phụ phí, chuyển chủ, giải nghệ, bán');
  const cm = as(D.CM);
  for (const surcharge of D.SURCHARGES) {
    const id = horseByName(surcharge.horse);
    const rows = await cm.get(`/horses/${id}/surcharges`);
    if (rows.some((row) => row.description === surcharge.description)) {
      log.skip(`${surcharge.horse}: phụ phí đã có`);
      continue;
    }
    const created = await cm.post(`/horses/${id}/surcharges`, { description: surcharge.description, dailyAmount: surcharge.dailyAmount, startDate: dateKey(), endDate: dateKey(surcharge.days - 1) });
    await as(surcharge.applyBy).post(`/horse-surcharges/${created.id}/apply`);
    log.ok(`${surcharge.horse}: phụ phí ${surcharge.dailyAmount.toLocaleString('vi-VN')} đ/ngày, HLV đã áp dụng`);
  }
  for (const horse of D.HORSES) {
    const id = horseByName(horse.name);
    const detail = await cm.get(`/horses/${id}`);
    if (horse.transferTo && detail.owner?.id !== ids.users[horse.transferTo]) {
      await cm.post(`/horses/${id}/ownership-transfers`, { newOwnerId: ids.users[horse.transferTo], reason: 'Chuyển nhượng nội bộ theo thỏa thuận hai chủ', version: detail.version });
      log.ok(`${horse.name}: chuyển chủ sang ${horse.transferTo}`);
    }
    if (horse.retire && detail.lifecycleStatus === 'ACTIVE') {
      await cm.patch(`/horses/${id}/lifecycle-status`, { lifecycleStatus: 'RETIRED', reason: 'Ngựa giống lớn tuổi, ngừng thi đấu' });
      log.ok(`${horse.name}: giải nghệ`);
    }
    if (horse.sell && detail.lifecycleStatus === 'ACTIVE') {
      await cm.patch(`/horses/${id}/lifecycle-status`, { lifecycleStatus: 'TRANSFERRED', reason: horse.sell });
      log.ok(`${horse.name}: đã bán ra ngoài`);
    }
  }
}

async function run() {
  if (!(await check())) process.exit(1);
  await seedUsers();
  await seedTaskTypes();
  await seedDailyFee();
  await seedBarns();
  await seedSupplies();
  await seedSubjects();
  await seedHorses();
  await seedPlacements();
  await seedFeeding();
  await seedMeasurements();
  await seedMedical();
  await seedTraining();
  log.step('Buổi chạy thử hôm nay (mất khoảng 1 đến 2 phút mỗi lớp)');
  for (const cls of D.CLASSES) await runTrialToday(cls);
  await seedStableDay();
  await seedStock();
  await seedBilling();
  console.log('\nXong. Mở web, đăng nhập từng vai trò để xem.');
}

/** Dữ liệu của ngày hôm nay: số đo nhẹ, tick checklist, một buổi chạy thử xong cho mỗi lớp thử. */
async function daily() {
  await seedUsersLookup();
  log.step('Số đo hôm nay');
  for (const horse of D.HORSES.filter((item) => item.groom && D.MEASUREMENTS[item.name])) {
    const base = D.MEASUREMENTS[horse.name];
    const values = [
      { type: 'WEIGHT', value: Math.round((base.WEIGHT + (Math.random() * 6 - 3)) * 10) / 10 },
      { type: 'TEMPERATURE', value: Math.round((37.5 + Math.random() * 0.6) * 10) / 10 },
    ];
    try {
      await as(horse.groom).post(`/horses/${horseByName(horse.name)}/measurements`, { values });
      log.ok(`${horse.name}: ${values.map((item) => item.value).join(' / ')}`);
    } catch (error) {
      log.warn(`${horse.name}: ${error.message}`);
    }
  }
  await seedStableDay();
  log.step('Buổi chạy thử hôm nay');
  for (const cls of D.CLASSES) {
    const classes = await as(cls.owner).get('/classes');
    const found = classes.find((row) => row.code === cls.code);
    if (!found) continue;
    cls.id = found.id;
    await runTrialToday(cls);
  }
}

/** Nạp id có sẵn (cho lệnh daily, không tạo gì). */
async function seedUsersLookup() {
  const cm = as(D.CM);
  for (const user of await cm.all('/users')) ids.users[user.email.toLowerCase()] = user.id;
  for (const horse of await cm.all('/horses')) ids.horses[horse.name] = horse.id;
  for (const subject of await cm.get('/training-subjects')) ids.subjects[subject.name] = subject;
}

async function main() {
  if (!['check', 'run', 'daily'].includes(command)) {
    console.log('Dùng: node scripts/seed-demo/seed.mjs <check|run|daily> [--api https://api.horse.io.vn/api/v1] (hỏi mật khẩu, hoặc đặt SEED_PASSWORD)');
    process.exit(command === 'help' ? 0 : 1);
  }
  if (!PASSWORD && process.stdin.isTTY) PASSWORD = await askHidden('Mật khẩu chung của các tài khoản @horse.test: ');
  if (!PASSWORD) {
    console.error('Thiếu mật khẩu: đặt biến môi trường SEED_PASSWORD hoặc chạy trong terminal để nhập.');
    process.exit(1);
  }
  console.log(`API: ${API}`);
  if (command === 'check') process.exit((await check()) ? 0 : 1);
  if (command === 'run') await run();
  if (command === 'daily') await daily();
}

main().catch((error) => {
  console.error(`\nDừng vì lỗi: ${error.message}`);
  process.exit(1);
});
