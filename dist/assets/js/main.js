/* Elçi Veteriner Kliniği — ortak yardımcılar
   Sayfa menüsü, duyurular ve yıl alanları elci-system.js tarafından yönetilir.
   Bu dosya yalnızca YouTube alanını ve Netlify Identity bağlantılarını başlatır. */
(() => {
  'use strict';

  async function fetchJson(url, fallback = null) {
    try {
      const response = await fetch(url, { cache:'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      return await response.json();
    } catch {
      return fallback;
    }
  }

  async function initYouTube() {
    const section = document.getElementById('youtube');
    const strip = document.getElementById('ytStrip');
    if (!section || !strip) return;

    let ids = [];
    const endpoint = section.dataset.fn;
    if (endpoint) {
      const payload = await fetchJson(endpoint, {});
      ids = Array.isArray(payload?.youtubeIds) ? payload.youtubeIds : [];
    }
    if (!ids.length) {
      const fallback = await fetchJson('/assets/data/index.json', {});
      ids = Array.isArray(fallback?.youtubeIds) ? fallback.youtubeIds : [];
    }
    if (!ids.length && section.dataset.youtubeIds) {
      ids = section.dataset.youtubeIds.split(',').map(value => value.trim()).filter(Boolean);
    }

    if (!ids.length) {
      section.hidden = true;
      return;
    }

    let start = 0;
    const render = () => {
      strip.replaceChildren();
      const visible = ids.slice(start, start + 3);
      if (visible.length < Math.min(3, ids.length)) visible.push(...ids.slice(0, Math.min(3, ids.length) - visible.length));
      visible.forEach(id => {
        const box = document.createElement('div');
        box.className = 'yt-box';
        const frame = document.createElement('iframe');
        frame.loading = 'lazy';
        frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
        frame.title = 'Elçi Veteriner Kliniği videosu';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.allowFullscreen = true;
        box.appendChild(frame);
        strip.appendChild(box);
      });
    };
    render();
    if (ids.length > 3 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.setInterval(() => { start = (start + 1) % ids.length; render(); }, 9000);
    }
  }

  function initIdentityLinks() {
    const hash = location.hash || '';
    const needsWidget = ['#invite_token=','#recovery_token=','#confirmation_token='].some(prefix => hash.startsWith(prefix));
    if (!needsWidget || document.querySelector('script[src*="netlify-identity-widget"]')) return;
    const script = document.createElement('script');
    script.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
    script.defer = true;
    script.addEventListener('load', () => window.netlifyIdentity?.open());
    document.head.appendChild(script);
  }

  const start = () => { initYouTube(); initIdentityLinks(); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start, { once:true }) : start();
})();
