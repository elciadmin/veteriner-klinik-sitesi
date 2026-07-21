export default async () => {
  const hook = process.env.NETLIFY_BUILD_HOOK_URL;
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!hook || !siteUrl) {
    console.warn('Zamanlanmış içerik kontrolü için NETLIFY_BUILD_HOOK_URL ve URL gerekli.');
    return;
  }
  let manifest;
  try {
    const response = await fetch(`${siteUrl.replace(/\/$/, '')}/assets/data/content-manifest.json`, { cache:'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    manifest = await response.json();
  } catch (error) {
    console.warn('İçerik manifesti okunamadı:', error);
    return;
  }
  const transition = Date.parse(manifest?.nextContentTransitionAt || '');
  if (!Number.isFinite(transition) || transition > Date.now()) return;
  const response = await fetch(hook, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ trigger_title:'Elçi zamanlanmış içerik geçişi' }) });
  if (!response.ok) throw new Error(`Build hook başarısız: ${response.status}`);
};
export const config = { schedule:'7 * * * *' };
