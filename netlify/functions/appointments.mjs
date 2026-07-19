import { getStore } from '@netlify/blobs';
import { getUser, verifyRequestOrigin } from '@netlify/identity';

const STORE_NAME = 'elci-appointments-v1';
const ALLOWED_STATUSES = new Set(['new', 'contacted', 'confirmed', 'completed', 'cancelled', 'archived']);
const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' }
});
const allowedEmails = () => String(process.env.ADMIN_EMAILS || 'elcivetklinik@gmail.com')
  .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);

async function authorize() {
  const user = await getUser();
  if (!user) return { error: json({ error: 'Giriş gerekli.' }, 401) };
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const allowed = roles.some(role => ['admin', 'randevu'].includes(role)) || allowedEmails().includes(String(user.email || '').toLowerCase());
  if (!allowed) return { error: json({ error: 'Bu hesap yetkili değil.' }, 403) };
  return { user };
}

const validId = id => /^[0-9A-Za-z-]{10,120}$/.test(String(id || ''));
const cleanNote = value => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 1800);

export default async request => {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (request.method === 'GET') {
    const { blobs } = await store.list({ prefix: 'appointment/' });
    const records = (await Promise.all(blobs.map(async ({ key }) => {
      try { return await store.get(key, { type: 'json', consistency: 'strong' }); }
      catch { return null; }
    }))).filter(Boolean).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return json({ appointments: records });
  }

  if (request.method === 'PATCH') {
    try { verifyRequestOrigin(request); }
    catch { return json({ error: 'Geçersiz istek kaynağı.' }, 403); }
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Geçersiz veri.' }, 400); }
    if (!validId(body.id)) return json({ error: 'Geçersiz kayıt kimliği.' }, 400);
    const key = `appointment/${body.id}`;
    const record = await store.get(key, { type: 'json', consistency: 'strong' });
    if (!record) return json({ error: 'Randevu bulunamadı.' }, 404);
    if (body.status != null) {
      if (!ALLOWED_STATUSES.has(body.status)) return json({ error: 'Geçersiz durum.' }, 400);
      record.status = body.status;
    }
    if (body.internalNote != null) record.internalNote = cleanNote(body.internalNote);
    record.updatedAt = new Date().toISOString();
    record.updatedBy = auth.user.email || auth.user.id;
    await store.setJSON(key, record, { metadata: { createdAt: record.createdAt, status: record.status } });
    return json({ appointment: record });
  }

  return json({ error: 'Desteklenmeyen yöntem.' }, 405);
};

export const config = {
  path: '/.netlify/functions/appointments',
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
