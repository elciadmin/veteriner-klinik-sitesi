(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const card = item => `
    <article class="s-card" id="${esc(item.id)}" data-service-id="${esc(item.id)}">
      <span class="s-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="${esc(item.icon || '#i-stethoscope')}"></use></svg></span>
      <h3 class="s-title">${esc(item.title)}</h3>
      <p class="s-text">${esc(item.summary || '')}</p>
      <a class="s-link" href="${esc(item.href || `/hizmetler.html#${item.id}`)}">Detaylı bilgi <span aria-hidden="true">→</span></a>
    </article>`;

  async function renderHomeServices() {
    const featuredHost = document.getElementById('servicesFeatured');
    const trackHost = document.getElementById('servicesTrack');
    if (!featuredHost && !trackHost) return;
    try {
      const [localResponse, runtimeResponse] = await Promise.all([
        fetch('/assets/data/services.json', { cache: 'no-store' }),
        fetch('https://elci-content-api.elcivetklinik.workers.dev/content?type=services', { cache: 'no-store' }).catch(() => null)
      ]);
      if (!localResponse.ok) throw new Error('Hizmet verisi alınamadı');
      const localData = await localResponse.json();
      const runtimeData = runtimeResponse?.ok ? await runtimeResponse.json() : { items: [] };
      const local = Array.isArray(localData.items) ? localData.items : [];
      const runtime = (runtimeData.items || []).map(item => ({ ...item.data, id: item.data?.id || item.slug, published: true }));
      const merged = new Map(local.map(item => [item.id || item.slug || item.title, item]));
      runtime.forEach(item => merged.set(item.id || item.slug || item.title, item));
      const items = [...merged.values()]
        .filter(item => item && item.published !== false)
        .sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999));
      const explicit = items.filter(item => item.featured === true);
      const featured = (explicit.length ? explicit : items).slice(0, 6);
      const ids = new Set(featured.map(item => item.id));
      const other = items.filter(item => !ids.has(item.id));
      if (featuredHost) featuredHost.innerHTML = featured.map(card).join('');
      if (trackHost) trackHost.innerHTML = other.map(card).join('');
      const wrap = document.getElementById('servicesMoreWrap');
      if (wrap) wrap.hidden = other.length === 0;
    } catch (error) {
      console.warn(error);
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', renderHomeServices)
    : renderHomeServices();
})();
