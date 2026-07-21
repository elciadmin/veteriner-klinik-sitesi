(() => {
  'use strict';
  const INSTAGRAM_URL = 'https://www.instagram.com/elciveteriner';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  async function getJson(url, fallback) {
    try { const response = await fetch(url, { cache:'no-store' }); if (!response.ok) throw new Error(); return await response.json(); }
    catch { return fallback; }
  }

  function renderReviews(reviews, settings) {
    const grid = document.getElementById('reviewGrid');
    if (!grid) return;
    const total = Number(settings?.totalGoogleReviews || 0);
    const heading = document.querySelector('#reviews h2');
    if (heading && total) heading.textContent = `Google'da ${total} Değerlendirme`;
    const items = (Array.isArray(reviews) ? reviews : []).slice(0, 6);
    grid.innerHTML = items.length ? items.map(item => {
      const rating = Math.max(1, Math.min(5, Number(item.rating) || 5));
      return `<article class="review-card elci-review-card">
        <div class="elci-review-stars" aria-label="${rating} yıldız">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</div>
        <p class="review-text">${esc(item.text || '')}</p>
        <div class="review-author">— ${esc(item.author || 'Google kullanıcısı')}</div>
        ${item.time ? `<div class="review-meta">${esc(item.time)}</div>` : ''}
      </article>`;
    }).join('') : '<p class="muted">Seçilmiş yorumlar yakında burada yer alacak.</p>';
  }

  function normalizeInstagram(manual, archive) {
    const items = [];
    (Array.isArray(manual) ? manual : []).forEach(item => {
      if (item?.published === false || !item?.image) return;
      items.push({ src:item.image.startsWith('/') ? item.image : `/${item.image}`, alt:item.alt || item.title || 'Elçi Veteriner Kliniği', url:item.instagramUrl || INSTAGRAM_URL });
    });
    (Array.isArray(archive) ? archive : []).slice().reverse().forEach(item => {
      const file = typeof item === 'string' ? item : item?.file;
      if (!file) return;
      items.push({ src:file.startsWith('/') ? file : `/assets/img/insta/${file}`, alt:'Elçi Veteriner Kliniği Instagram paylaşımı', url:INSTAGRAM_URL });
    });
    const seen = new Set();
    return items.filter(item => item.src && !seen.has(item.src) && seen.add(item.src)).slice(0, 24);
  }

  function renderInstagram(manual, archive) {
    const track = document.getElementById('instaTrack');
    if (!track) return;
    const items = normalizeInstagram(manual, archive);
    if (!items.length) { track.innerHTML = '<p class="muted elci-insta-empty">Galeri içerikleri yönetim panelinden eklenecek.</p>'; return; }
    const group = duplicate => `<div class="elci-insta-group"${duplicate ? ' aria-hidden="true"' : ''}>${items.map(item =>
      `<a class="elci-insta-card" href="${esc(item.url)}" target="_blank" rel="noopener"${duplicate ? ' tabindex="-1"' : ''}><img src="${esc(item.src)}" alt="${duplicate ? '' : esc(item.alt)}" loading="lazy" decoding="async"><span><i class="fa-brands fa-instagram" aria-hidden="true"></i> Gönderiyi aç</span></a>`
    ).join('')}</div>`;
    track.innerHTML = group(false) + group(true);
    track.style.setProperty('--elci-insta-duration', `${Math.max(150, items.length * 9)}s`);
  }

  Promise.all([
    getJson('/assets/data/reviews.json?v=20260721', []),
    getJson('/assets/data/site-settings.json?v=20260721', {}),
    getJson('/assets/data/instagram-manual.json?v=20260721', []),
    getJson('/assets/data/instagram.json?v=20260721', [])
  ]).then(([reviews, settings, manual, archive]) => {
    renderReviews(reviews, settings);
    renderInstagram(manual, archive);
  });
})();
