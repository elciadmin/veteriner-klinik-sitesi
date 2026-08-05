const json = (data, status = 200) => Response.json(data, { status, headers:{ 'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff' } });

export default async request => {
  const host = String(request.headers.get('host') || new URL(request.url).host || '').toLowerCase();
  let branch = String(process.env.ADMIN_CONTENT_BRANCH || process.env.BRANCH || '').trim();
  if (!branch && host.endsWith('.netlify.app') && host.includes('--')) branch = host.split('--')[0];
  if (!branch) branch = 'main';
  const context = String(process.env.CONTEXT || (branch === 'main' ? 'production' : 'branch-deploy'));
  return json({ branch, context, host });
};

export const config = { path:'/.netlify/functions/admin-runtime' };
