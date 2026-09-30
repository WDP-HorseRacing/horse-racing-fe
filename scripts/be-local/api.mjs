// Tiện ích gọi API BE cho các script dựng dữ liệu.
export const BASE = 'http://localhost:3000/api/v1';
export const PASSWORD = 'Horse@2026';
export async function login(email, password = PASSWORD) {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`login ${email}: ${JSON.stringify(j)}`);
  return j.accessToken;
}
export function client(token) {
  const call = async (method, path, body) => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) { const e = new Error(`${method} ${path} -> ${r.status}: ${data?.message} ${JSON.stringify(data?.details ?? '')}`); e.status = r.status; e.data = data; throw e; }
    return data;
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b ?? {}), patch: (p, b) => call('PATCH', p, b), put: (p, b) => call('PUT', p, b), del: (p, b) => call('DELETE', p, b) };
}
