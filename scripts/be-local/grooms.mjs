// Chia ngựa cho các Groom mới (HT của khu thao tác).
import { login, client } from './api.mjs';

const cm = client(await login('nhatruong5012@gmail.com'));
const users = (await cm.get('/users?limit=100')).items;
const id = (email) => users.find((u) => u.email === email)?.id;
const mai = id('mai.ho@horseracing.vn');
const luc = id('luc.le@horseracing.vn');

const htQuan = client(await login('nhatruong5020@gmail.com'));
const htNam = client(await login('nam.le@horseracing.vn'));
const plan = [
  [htNam, 'a0000000-0000-4000-8000-000000000005', mai],
  [htNam, 'a0000000-0000-4000-8000-000000000011', mai],
  [htNam, 'a0000000-0000-4000-8000-000000000009', mai],
  [htNam, 'a0000000-0000-4000-8000-000000000008', mai],
  [htQuan, 'a0000000-0000-4000-8000-000000000006', luc],
  [htQuan, 'a0000000-0000-4000-8000-000000000015', luc],
];
for (const [api, horseId, groomId] of plan) {
  try {
    await api.put(`/horses/${horseId}/groom`, { groomId });
    console.log('OK ', horseId.slice(-2));
  } catch (e) {
    console.log('ERR', horseId.slice(-2), e.message);
  }
}
