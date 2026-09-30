// Tạo 5 user Keycloak khớp keycloak_id trong scripts/seed/init-data.sql (partial import giữ id).
const KC = 'http://localhost:8088';
const PASSWORD = process.env.DEMO_PASSWORD || 'Horse@2026';
const users = [
  ['b4c48b7a-f2ee-4352-9a9c-37cd81ef3297', 'nhatruong5012@gmail.com', 'Nguyễn Nhật Trường', 'CLUB_MANAGER'],
  ['816cb58c-65e2-4e89-8d6a-401b8d0bae16', 'nhatruong5020@gmail.com', 'Nguyễn Văn A', 'HEAD_TRAINER'],
  ['810c144f-3a62-49cf-bc7e-6216f26b1878', 'nhattruong.nguyen0512@gmail.com', 'Nguyen Van B', 'HORSE_OWNER'],
  ['9d06deae-0a99-4da8-a526-56960343cbf0', 'tnhdarkrai1457@gmail.com', 'Nguyen Van C', 'GROOM'],
  ['91fab7dc-721c-4d94-85f1-dcb279b24629', 'minhff.net@gmail.com', 'Nguyen Van C', 'VETERINARIAN'],
];
const tok = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'racehorse-admin-keycloak', password: 'Keycloak@#_Racehorse_WDP301_FPT_FA26' }),
}).then((r) => r.json());
const H = { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' };
const body = {
  ifResourceExists: 'SKIP',
  users: users.map(([id, email, name, role]) => {
    const [first, ...rest] = name.split(' ');
    return {
      id, username: email, email, emailVerified: true, enabled: true,
      firstName: first, lastName: rest.join(' ') || first,
      credentials: [{ type: 'password', value: PASSWORD, temporary: false }],
      realmRoles: [role],
    };
  }),
};
const res = await fetch(`${KC}/admin/realms/racehorse/partialImport`, { method: 'POST', headers: H, body: JSON.stringify(body) });
console.log(res.status, JSON.stringify(await res.json()).slice(0, 600));
