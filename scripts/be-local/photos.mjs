// Gắn ảnh mẫu (ảnh ngựa trong public/) cho các ngựa chưa có ảnh, để trang Danh sách ngựa / Hồ sơ ngựa
// có ảnh thật khi trình chiếu. Đăng nhập bằng Quản lý câu lạc bộ (chỉ CM được tải ảnh ngựa).
// Chạy trong thư mục scripts/be-local: node photos.mjs   (thêm --dry để chỉ xem sẽ gắn ảnh nào)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { login, client } from './api.mjs';

const dry = process.argv.includes('--dry');
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../../public');
const PHOTOS = [
  'winx.jpg',
  'sunday-silence.jpg',
  'golden-sash.jpg',
  'al-akbar.jpg',
  'MACHIAVELLIAN.jpg',
  'Mejiro-McQueen.jpg',
  'point-flag.jpg',
  'vegas-showgirl.jpg',
  'helen-street.jpg',
  'street-cry.jpg',
  'stay-gold.jpg',
  'vegas-magic.jpg',
  'gold-ship.png',
].filter((name) => fs.existsSync(path.join(publicDir, name)));

const cm = client(await login('nhatruong5012@gmail.com'));
const horses = (await cm.get('/horses?limit=100')).items.filter((horse) => !horse.mediaId && !horse.isDeleted);
console.log(`${horses.length} ngựa chưa có ảnh, ${PHOTOS.length} ảnh mẫu`);

for (const [index, horse] of horses.entries()) {
  const name = PHOTOS[index % PHOTOS.length];
  const file = fs.readFileSync(path.join(publicDir, name));
  const mimeType = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
  console.log(`${dry ? '(thử) ' : ''}${horse.name} ← ${name}`);
  if (dry) continue;
  try {
    const upload = await cm.post('/media/upload-requests', { purpose: 'HORSE_PHOTO', fileName: name, mimeType, byteSize: file.length });
    const put = await fetch(upload.uploadUrl, { method: upload.method ?? 'PUT', headers: upload.headers, body: file });
    if (!put.ok) throw new Error(`tải lên ${put.status}`);
    await cm.post(`/media/${upload.assetId}/complete`);
    const fresh = await cm.get(`/horses/${horse.id}`);
    await cm.patch(`/horses/${horse.id}`, { version: fresh.version, mediaId: upload.assetId });
    console.log('  OK');
  } catch (error) {
    console.log('  ERR', error.message);
  }
}
