import { createHash, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { getUser, verifyRequestOrigin } from '@netlify/identity';

const STORE_NAME = 'elci-admin-backups-v1';
const json = (data, status = 200) => Response.json(data, { status, headers:{ 'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff' } });
const clean = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
const allowedEmails = () => String(process.env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
const pathHash = path => createHash('sha256').update(String(path)).digest('hex').slice(0, 24);
const validKey = key => /^backup\/[a-f0-9]{24}\/[0-9T:.Z-]+-[0-9a-f-]{36}$/.test(String(key || ''));

async function authorize() {
  const user = await getUser();
  if (!user) return { error:json({ error:'Giriş gerekli' }, 401) };
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const list = allowedEmails();
  const email = String(user.email || '').toLowerCase();
  const allowed = !list.length || list.includes(email) || roles.some(role => ['admin','editor'].includes(role));
  if (!allowed) return { error:json({ error:'Bu hesap içerik yedeklerine erişmeye yetkili değil' }, 403) };
  return { user };
}

export default async request => {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const store = getStore({ name:STORE_NAME, consistency:'strong' });
  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (url.searchParams.get('summary') === '1') {
      const { blobs } = await store.list({ prefix:'backup/' });
      return json({ count:blobs.length });
    }
    const id = url.searchParams.get('id');
    if (id) {
      if (!validKey(id)) return json({ error:'Geçersiz yedek kimliği' }, 400);
      const record = await store.get(id, { type:'json', consistency:'strong' });
      if (!record) return json({ error:'Yedek bulunamadı' }, 404);
      return json(record);
    }
    const path = clean(url.searchParams.get('path'), 600);
    if (!path) return json({ backups:[] });
    const prefix = `backup/${pathHash(path)}/`;
    const { blobs } = await store.list({ prefix });
    const records = (await Promise.all(blobs.map(async ({ key }) => {
      try { const item = await store.get(key, { type:'json', consistency:'strong' }); return item ? { id:key, createdAt:item.createdAt, by:item.by, action:item.action, path:item.path } : null; }
      catch { return null; }
    }))).filter(Boolean).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,30);
    return json({ backups:records });
  }

  if (request.method === 'POST') {
    try { verifyRequestOrigin(request); } catch { return json({ error:'Geçersiz istek kaynağı' }, 403); }
    let body;
    try { body = await request.json(); } catch { return json({ error:'Geçersiz veri' }, 400); }
    const path = clean(body.path, 600);
    if (!path || !body.data || typeof body.data !== 'object') return json({ error:'Yedek verisi eksik' }, 400);
    const createdAt = new Date().toISOString();
    const key = `backup/${pathHash(path)}/${createdAt}-${randomUUID()}`;
    const record = { path, data:body.data, sha:clean(body.sha, 100), action:clean(body.action, 300), createdAt, by:auth.user.email || auth.user.id || 'yetkili' };
    await store.setJSON(key, record, { metadata:{ pathHash:pathHash(path), createdAt, by:record.by } });

    const { blobs } = await store.list({ prefix:`backup/${pathHash(path)}/` });
    const old = blobs.map(x => x.key).sort().reverse().slice(30);
    await Promise.all(old.map(keyToDelete => store.delete(keyToDelete)));
    return json({ saved:true, id:key });
  }

  return json({ error:'Desteklenmeyen yöntem' }, 405);
};

export const config = { path:'/.netlify/functions/admin-backups', rateLimit:{ windowLimit:180, windowSize:60, aggregateBy:['ip','domain'] } };
