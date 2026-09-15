const API_BASE = 'https://elci-content-api.elcivetklinik.workers.dev';
const ALLOWED_PATH = /^\/admin\/(?:content(?:\?(?:type=[a-z]+)?)?|create|update|publish|schedule|unpublish|trash|restore|archive|unarchive|permanent-delete)$/;
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff' } });

async function identityUser(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const origin = new URL(request.url).origin;
  const response = await fetch(origin + '/.netlify/identity/user', { headers: { Authorization: authorization, Accept:'application/json' }, cache:'no-store' });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.email ? user : null;
}

export default async request => {
  if (!['GET','POST'].includes(request.method)) return json({error:'Method not allowed'},405);
  const user = await identityUser(request).catch(() => null);
  if (!user) return json({error:'Unauthorized'},401);

  const token = process.env.ELCI_RUNTIME_ADMIN_TOKEN;
  if (!token) return json({error:'Runtime CMS proxy is not configured'},503);

  const url = new URL(request.url);
  const path = url.searchParams.get('path') || '';
  if (!ALLOWED_PATH.test(path) || path.includes('..')) return json({error:'Invalid Runtime CMS path'},400);

  const body = request.method === 'POST' ? await request.text() : undefined;
  if (body && body.length > 100000) return json({error:'Payload too large'},413);

  const response = await fetch(API_BASE + path, {
    method: request.method,
    headers: { Authorization:'Bearer ' + token, Accept:'application/json', ...(body ? {'Content-Type':'application/json'} : {}) },
    body,
    cache:'no-store'
  });
  const text = await response.text();
  return new Response(text, { status: response.status, headers: { 'Content-Type':response.headers.get('content-type') || 'application/json; charset=utf-8', 'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff' } });
};

export const config = { path:'/.netlify/functions/admin-runtime-content' };
