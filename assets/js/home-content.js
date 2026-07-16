(() => {
  'use strict';

  const INSTAGRAM_PROFILE = 'https://www.instagram.com/elciveteriner';
  const LOGO = '/assets/img/uploads/elci-logo.png';

  async function fetchJson(url, fallback) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(url);
      return await response.json();
    } catch {
      return fallback;
    }
  }

  function makeStars(value) {
    const stars = document.createElement('div');
    stars.className = 'elci-review-stars';
    const rating = Math.max(1, Math.min(5, Number(value) || 5));
    stars.setAttribute('aria-label', `${rating} yıldız`);
    stars.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    return stars;
  }

  function renderReviews(items, totalCount) {
    const grid = document.getElementById('reviewGrid');
    if (!grid) return;

    const heading = document.querySelector('#reviews h2');
    if (heading && Number.isFinite(Number(totalCount))) {
      heading.textContent = `Google'da ${Number(totalCount)} Değerlendirme`;
    }

    grid.innerHTML = '';

    if (!Array.isArray(items) || !items.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Henüz site için yorum seçilmedi.';
      grid.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const article = document.createElement('article');
      article.className = 'review-card elci-review-card';

      article.appendChild(makeStars(item.rating));

      const quote = document.createElement('p');
      quote.className = 'review-text';
      quote.textContent = item.text || '';
      article.appendChild(quote);

      const author = document.createElement('div');
      author.className = 'review-author';
      author.textContent = `— ${item.author || 'Google kullanıcısı'}`;
      article.appendChild(author);

      if (item.time) {
        const time = document.createElement('div');
        time.className = 'review-meta';
        time.textContent = item.time;
        article.appendChild(time);
      }

      if (item.sourceUrl) {
        const link = document.createElement('a');
        link.className = 'elci-review-link';
        link.href = item.sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Google yorumunu aç';
        article.appendChild(link);
      }

      grid.appendChild(article);
    });
  }

  function imageCandidates(item) {
    if (item.image) return [item.image];
    const file = item.file || '';
    if (!file) return [LOGO];
    return [
      `/assets/img/instagram/${file}`,
      `/assets/img/uploads/instagram/${file}`,
      `/assets/img/uploads/${file}`,
      `/assets/img/${file}`,
      LOGO
    ];
  }

  function setImageWithFallback(image, candidates) {
    let index = 0;
    image.src = candidates[index];
    image.addEventListener('error', () => {
      index += 1;
      if (index < candidates.length) image.src = candidates[index];
    });
  }

  function renderInstagram(manualItems, fallbackItems) {
    const track = document.getElementById('instaTrack');
    if (!track) return;

    const normalizedManual = (Array.isArray(manualItems) ? manualItems : [])
      .filter(item => item && item.published !== false && item.image);

    const normalizedFallback = (Array.isArray(fallbackItems) ? fallbackItems : [])
      .map(item => ({
        image: '',
        file: item.file || '',
        title: 'Elçi Veteriner Kliniği',
        alt: 'Elçi Veteriner Kliniği Instagram paylaşımı',
        instagramUrl: INSTAGRAM_PROFILE,
        fallback: true
      }))
      .filter(item => item.file);

    const seen = new Set();
    const combined = [...normalizedManual, ...normalizedFallback].filter(item => {
      const key = item.image || item.file;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);

    track.innerHTML = '';

    if (!combined.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Henüz galeri görseli eklenmedi.';
      track.appendChild(empty);
      return;
    }

    combined.forEach(item => {
      const link = document.createElement('a');
      link.className = 'elci-insta-card';
      link.href = item.instagramUrl || INSTAGRAM_PROFILE;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', item.title || item.alt || 'Instagram gönderisini aç');

      const image = document.createElement('img');
      image.className = 'elci-insta-image';
      image.alt = item.alt || item.title || 'Elçi Veteriner Kliniği galeri görseli';
      image.loading = 'lazy';
      image.decoding = 'async';
      setImageWithFallback(image, imageCandidates(item));

      const overlay = document.createElement('span');
      overlay.className = 'elci-insta-overlay';

      const caption = document.createElement('strong');
      caption.textContent = item.title || 'Instagram’dan';

      const label = document.createElement('small');
      label.textContent = item.fallback ? 'Instagram paylaşımı' : 'Gönderiyi aç';

      overlay.append(caption, label);
      link.append(image, overlay);
      track.appendChild(link);
    });
  }

  async function renderAll() {
    const [reviews, siteSettings, manualInstagram, fallbackInstagram] = await Promise.all([
      fetchJson('/assets/data/reviews.json?v=content-v22', []),
      fetchJson('/assets/data/site-settings.json?v=content-v22', {}),
      fetchJson('/assets/data/instagram-manual.json?v=content-v22', []),
      fetchJson('/assets/data/instagram.json?v=content-v22', [])
    ]);

    renderReviews(reviews, siteSettings.totalGoogleReviews);
    renderInstagram(manualInstagram, fallbackInstagram);
  }

  function start() {
    renderAll();
    // Eski ana scriptin geç yüklenen içeriğinin üzerine son kez güvenli biçimde yaz.
    window.setTimeout(renderAll, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
