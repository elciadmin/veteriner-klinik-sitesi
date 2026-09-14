const SITE_ORIGINS = new Set([
  'https://xn--eliveterinerklinii-8ub94i.com',
  'https://veteriner-klinik-sitesi.netlify.app'
]);

const IDENTITY_USER_URL = 'https://xn--eliveterinerklinii-8ub94i.com/.netlify/identity/user';

function corsHeaders(request, isPublic = false) {
  const origin = request.headers.get('origin') || '';
  const allowed = SITE_ORIGINS.has(origin) ? origin : (isPublic ? '*' : '');
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'vary': 'Origin'
  };
  if (allowed) headers['access-control-allow-origin'] = allowed;
  return headers;
}

function json(request, data, status = 200, isPublic = false) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(request, isPublic) });
}

const nowIso = () => new Date().toISOString();

function safeJson(value, fallback = {}) {
  try { return JSON.parse(value || '{}'); } catch { return fallback; }
}

function isActive(row) {
  if (!row || !Number(row.published) || Number(row.trashed) || Number(row.archived)) return false;
  const now = Date.now();
  const start = row.publish_at ? Date.parse(row.publish_at) : NaN;
  const end = row.unpublish_at ? Date.parse(row.unpublish_at) : NaN;
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end <= now) return false;
  return true;
}

function publicRow(row) {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    status: row.status,
    published: Boolean(row.published),
    archived: Boolean(row.archived),
    trashed: Boolean(row.trashed),
    publish_at: row.publish_at,
    unpublish_at: row.unpublish_at,
    version: Number(row.version || 1),
    data: safeJson(row.payload_json)
  };
}

async function authenticate(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  if (env.CONTENT_ADMIN_TOKEN && token === env.CONTENT_ADMIN_TOKEN) {
    return { actor: 'service-token', mode: 'service' };
  }

  try {
    const response = await fetch(IDENTITY_USER_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!response.ok) return null;
    const user = await response.json();
    if (!user?.email) return null;
    return { actor: user.email, mode: 'netlify-identity', user };
  } catch {
    return null;
  }
}

async function getRow(env, type, slug) {
  return await env.DB.prepare(
    'SELECT * FROM content WHERE type = ?1 AND slug = ?2 LIMIT 1'
  ).bind(type, slug).first();
}

async function backup(env, row, action) {
  if (!row) return;
  await env.DB.prepare(
    `INSERT INTO revisions
     (content_id, version, payload_json, action, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(row.id, Number(row.version || 1), row.payload_json, action, nowIso()).run();
}

async function audit(env, actor, action, row, result, detail = '') {
  await env.DB.prepare(
    `INSERT INTO audit_log
     (actor, action, content_id, content_type, result, detail, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(actor || 'unknown', action, row?.id || null, row?.type || null, result, detail, nowIso()).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('origin') || '';
      if (origin && !SITE_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request, false) });
    }

    try {
      if (request.method === 'GET' && path === '/health') {
        const dbCheck = await env.DB.prepare('SELECT 1 AS ok').first();
        return json(request, { ok: true, service: 'elci-content-api', database: dbCheck?.ok === 1 }, 200, true);
      }

      if (request.method === 'GET' && path === '/content') {
        const type = url.searchParams.get('type');
        const query = type
          ? env.DB.prepare('SELECT * FROM content WHERE type = ?1 ORDER BY updated_at DESC').bind(type)
          : env.DB.prepare('SELECT * FROM content ORDER BY updated_at DESC');
        const result = await query.all();
        return json(request, { items: (result.results || []).filter(isActive).map(publicRow) }, 200, true);
      }

      if (request.method === 'GET' && path.startsWith('/content/')) {
        const [, , type, slug] = path.split('/');
        if (!type || !slug) return json(request, { error: 'type and slug required' }, 400, true);
        const row = await getRow(env, type, decodeURIComponent(slug));
        if (!row || !isActive(row)) return json(request, { error: 'Not found' }, 404, true);
        return json(request, publicRow(row), 200, true);
      }

      if (path.startsWith('/admin/')) {
        const identity = await authenticate(request, env);
        if (!identity) return json(request, { error: 'Unauthorized' }, 401);

        if (request.method === 'GET' && path === '/admin/content') {
          const type = url.searchParams.get('type');
          const query = type
            ? env.DB.prepare('SELECT * FROM content WHERE type = ?1 ORDER BY updated_at DESC').bind(type)
            : env.DB.prepare('SELECT * FROM content ORDER BY updated_at DESC');
          const result = await query.all();
          return json(request, { items: (result.results || []).map(publicRow) });
        }

        if (request.method === 'GET' && path.startsWith('/admin/content/')) {
          const parts = path.split('/').filter(Boolean);
          const type = parts[2], slug = decodeURIComponent(parts[3] || '');
          if (!type || !slug) return json(request, { error: 'type and slug required' }, 400);
          const row = await getRow(env, type, slug);
          if (!row) return json(request, { error: 'Not found' }, 404);
          return json(request, publicRow(row));
        }

        if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);

        const body = await request.json().catch(() => null);
        if (!body) return json(request, { error: 'Invalid JSON' }, 400);

        const action = path.split('/').filter(Boolean)[1];
        const type = String(body.type || '').trim();
        const slug = String(body.slug || '').trim();
        const id = body.id || `${type}:${slug}`;
        const payload = body.data || {};

        if (!type || !slug) return json(request, { error: 'type and slug are required' }, 400);

        let row = await getRow(env, type, slug);

        if (action === 'create') {
          if (row) return json(request, { error: 'Already exists' }, 409);
          const created = nowIso();
          await env.DB.prepare(
            `INSERT INTO content
             (id, type, slug, status, published, publish_at, unpublish_at,
              trashed, archived, version, payload_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'draft', 0, NULL, NULL, 0, 0, 1, ?4, ?5, ?5)`
          ).bind(id, type, slug, JSON.stringify(payload), created).run();
          row = await getRow(env, type, slug);
          await audit(env, identity.actor, action, row, 'success');
          return json(request, { ok: true, item: publicRow(row) }, 201);
        }

        if (!row) return json(request, { error: 'Not found' }, 404);
        await backup(env, row, action);

        const nextVersion = Number(row.version || 1) + 1;
        const updated = nowIso();

        if (action === 'update') {
          await env.DB.prepare(
            'UPDATE content SET payload_json = ?1, version = ?2, updated_at = ?3 WHERE id = ?4'
          ).bind(JSON.stringify(payload), nextVersion, updated, row.id).run();
        } else if (action === 'publish') {
          await env.DB.prepare(
            `UPDATE content SET status='published', published=1, trashed=0, archived=0,
             publish_at=COALESCE(?1,publish_at,?2), unpublish_at=?3, version=?4, updated_at=?2
             WHERE id=?5`
          ).bind(body.publish_at || null, updated, body.unpublish_at || null, nextVersion, row.id).run();
        } else if (action === 'schedule') {
          if (!body.publish_at || !Number.isFinite(Date.parse(body.publish_at))) {
            return json(request, { error: 'Valid publish_at required' }, 400);
          }
          await env.DB.prepare(
            `UPDATE content SET status='scheduled', published=1, publish_at=?1, unpublish_at=?2,
             trashed=0, archived=0, version=?3, updated_at=?4 WHERE id=?5`
          ).bind(body.publish_at, body.unpublish_at || null, nextVersion, updated, row.id).run();
        } else if (action === 'unpublish') {
          await env.DB.prepare(
            `UPDATE content SET status='draft', published=0, version=?1, updated_at=?2 WHERE id=?3`
          ).bind(nextVersion, updated, row.id).run();
        } else if (action === 'archive') {
          await env.DB.prepare(
            `UPDATE content SET status='archived', published=0, archived=1, trashed=0,
             version=?1, updated_at=?2 WHERE id=?3`
          ).bind(nextVersion, updated, row.id).run();
        } else if (action === 'unarchive') {
          await env.DB.prepare(
            `UPDATE content SET status='draft', published=0, archived=0,
             version=?1, updated_at=?2 WHERE id=?3`
          ).bind(nextVersion, updated, row.id).run();
        } else if (action === 'trash') {
          await env.DB.prepare(
            `UPDATE content SET status='trashed', published=0, trashed=1, archived=0,
             version=?1, updated_at=?2 WHERE id=?3`
          ).bind(nextVersion, updated, row.id).run();
        } else if (action === 'restore') {
          await env.DB.prepare(
            `UPDATE content SET status='draft', published=0, trashed=0, archived=0,
             version=?1, updated_at=?2 WHERE id=?3`
          ).bind(nextVersion, updated, row.id).run();
        } else {
          return json(request, { error: 'Unknown admin action' }, 400);
        }

        row = await getRow(env, type, slug);
        await audit(env, identity.actor, action, row, 'success');
        return json(request, { ok: true, item: publicRow(row) });
      }

      return json(request, { error: 'Not found' }, 404, true);
    } catch (error) {
      return json(request, { error: 'Internal error', detail: String(error?.message || error) }, 500);
    }
  }
};
