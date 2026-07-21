(() => {
  'use strict';

  const INSTAGRAM_URL = 'https://www.instagram.com/elciveteriner';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  async function getJson(url, fallback) {
    try {
      const response = await fetch(url, { cache:'no-store' });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.json();
    } catch (error) {
      console.warn('İçerik yüklenemedi:', url, error);
      return fallback;
    }
  }

  function renderReviews(reviews, settings = {}) {
    const grid = document.getElementById('reviewGrid');
    if (!grid) return;

    const total = Math.max(0, Number(settings?.totalGoogleReviews || 194));
    const heading = document.querySelector('#reviews h2');
    if (heading) heading.textContent = `Google'da ${total} Değerlendirme`;

    const items = (Array.isArray(reviews) ? reviews : [])
      .filter(item => item && item.published !== false && (item.text || item.author))
      .slice(0, 6);

    /* JSON geçici olarak yüklenemezse HTML içindeki güvenli yedek yorumlar kalır. */
    if (!items.length) {
      if (!grid.children.length) {
        grid.innerHTML = '<p class="reviews-status">Seçilmiş Google yorumları yükleniyor.</p>';
      }
      return;
    }

    grid.innerHTML = items.map(item => {
      const rating = Math.max(1, Math.min(5, Number(item.rating) || 5));
      const source = item.sourceUrl
        ? `<a class="elci-review-link" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener">Google'da görüntüle</a>`
        : '';
      return `<article class="review-card elci-review-card">
        <div class="elci-review-stars" aria-label="${rating} yıldız">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</div>
        <p class="review-text">${esc(item.text || '')}</p>
        <div class="review-author">— ${esc(item.author || 'Google kullanıcısı')}</div>
        ${item.time ? `<div class="review-meta">${esc(item.time)}</div>` : ''}
        ${source}
      </article>`;
    }).join('');
  }

  function imagePath(value, base = '') {
    const file = String(value || '').trim();
    if (!file) return '';
    if (/^(https?:)?\/\//i.test(file) || file.startsWith('/')) return file;
    return `${base}${file}`;
  }

  function normalizeInstagram(manual, archive) {
    const items = [];

    (Array.isArray(manual) ? manual : []).forEach(item => {
      if (!item || item.published === false) return;
      const src = imagePath(item.image);
      if (!src) return;
      items.push({
        src,
        alt:item.alt || item.title || 'Elçi Veteriner Kliniği',
        url:item.instagramUrl || INSTAGRAM_URL
      });
    });

    (Array.isArray(archive) ? archive : []).slice().reverse().forEach(item => {
      const file = typeof item === 'string' ? item : item?.file;
      const src = imagePath(file, '/assets/img/insta/');
      if (!src) return;
      items.push({
        src,
        alt:'Elçi Veteriner Kliniği Instagram paylaşımı',
        url:INSTAGRAM_URL
      });
    });

    const seen = new Set();
    return items.filter(item => {
      if (!item.src || seen.has(item.src)) return false;
      seen.add(item.src);
      return true;
    }).slice(0, 24);
  }

  function bindInstagramControls(track) {
    const prev = document.getElementById('instaPrev');
    const next = document.getElementById('instaNext');
    if (!prev || !next || prev.dataset.bound === 'true') return;

    const step = () => {
      const card = track.querySelector('.elci-insta-card');
      if (!card) return Math.max(280, track.clientWidth * .8);
      const style = getComputedStyle(track);
      const gap = parseFloat(style.columnGap || style.gap || '18') || 18;
      return card.getBoundingClientRect().width + gap;
    };

    prev.addEventListener('click', () => track.scrollBy({ left:-step(), behavior:'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left:step(), behavior:'smooth' }));
    prev.dataset.bound = 'true';
    next.dataset.bound = 'true';
  }

  function renderInstagram(manual, archive) {
    const track = document.getElementById('instaTrack');
    if (!track) return;

    const items = normalizeInstagram(manual, archive);
    if (!items.length) {
      track.innerHTML = '<p class="muted elci-insta-empty">Galeri içerikleri yönetim panelinden eklenecek.</p>';
      return;
    }

    track.innerHTML = `<div class="elci-insta-group">${items.map(item =>
      `<a class="elci-insta-card" href="${esc(item.url)}" target="_blank" rel="noopener">
        <img src="${esc(item.src)}" alt="${esc(item.alt)}" loading="lazy" decoding="async">
        <span><i class="fa-brands fa-instagram" aria-hidden="true"></i> Gönderiyi aç</span>
      </a>`
    ).join('')}</div>`;

    bindInstagramControls(track);
  }

  async function initReviews() {
    const [reviews, settings] = await Promise.all([
      getJson('/assets/data/reviews.json?v=20260721-3', []),
      getJson('/assets/data/site-settings.json?v=20260721-3', { totalGoogleReviews:194 })
    ]);
    renderReviews(reviews, settings);
  }

  async function initInstagram() {
    const [manual, archive] = await Promise.all([
      getJson('/assets/data/instagram-manual.json?v=20260721-3', []),
      getJson('/assets/data/instagram.json?v=20260721-3', [])
    ]);
    renderInstagram(manual, archive);
  }

  const start = () => {
    initReviews();
    initInstagram();
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', start, { once:true })
    : start();
})();
