(() => {
  'use strict';

  const INSTAGRAM_PROFILE = 'https://www.instagram.com/elciveteriner';

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

  function injectInstagramFixStyles() {
    if (document.getElementById('elci-instagram-grid-fix-v23')) return;

    const style = document.createElement('style');
    style.id = 'elci-instagram-grid-fix-v23';
    style.textContent = `
      #insta{
        overflow:hidden !important;
        padding-top:54px;
        padding-bottom:54px;
      }

      #insta .container{
        overflow:visible !important;
      }

      #insta .insta-track-wrap{
        overflow:visible !important;
        margin:0 !important;
        padding:18px 0 6px !important;
      }

      #instaTrack.insta-track{
        display:grid !important;
        grid-template-columns:repeat(4,minmax(0,1fr)) !important;
        grid-auto-rows:220px;
        gap:16px !important;
        width:100%;
        max-width:100%;
        overflow:visible !important;
        padding:0 !important;
        scroll-snap-type:none !important;
      }

      #instaTrack .elci-insta-card{
        position:relative;
        display:block;
        width:auto !important;
        min-width:0 !important;
        height:auto !important;
        overflow:hidden;
        border-radius:22px;
        background:#f1edf7;
        box-shadow:0 14px 30px rgba(31,42,56,.12);
        text-decoration:none;
        color:#fff;
        transform:none !important;
      }

      #instaTrack .elci-insta-card.is-featured{
        grid-column:span 2;
        grid-row:span 2;
      }

      #instaTrack .elci-insta-card:hover,
      #instaTrack .elci-insta-card:focus-visible{
        transform:translateY(-6px) !important;
        box-shadow:0 22px 38px rgba(31,42,56,.18);
        outline:none;
      }

      #instaTrack .elci-insta-image{
        width:100%;
        height:100%;
        display:block;
        object-fit:cover;
      }

      #instaTrack .elci-insta-overlay{
        position:absolute;
        inset:auto 0 0;
        display:flex;
        flex-direction:column;
        gap:3px;
        padding:42px 16px 16px;
        background:linear-gradient(transparent,rgba(0,0,0,.8));
      }

      #instaTrack .elci-insta-empty{
        grid-column:1/-1;
        margin:0;
        padding:28px;
        border:1px dashed rgba(90,31,168,.22);
        border-radius:18px;
        background:#fbf9ff;
        color:var(--muted,#667085);
        text-align:center;
      }

      @media(max-width:900px){
        #instaTrack.insta-track{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          grid-auto-rows:230px;
        }

        #instaTrack .elci-insta-card.is-featured{
          grid-column:1/-1;
          grid-row:span 1;
          min-height:320px;
        }
      }

      @media(max-width:560px){
        #instaTrack.insta-track{
          grid-template-columns:1fr !important;
          grid-auto-rows:280px;
          gap:14px !important;
        }

        #instaTrack .elci-insta-card.is-featured{
          grid-column:auto;
          min-height:310px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function imageCandidates(item) {
    if (item.image) return [item.image];

    const file = item.file || '';
    if (!file) return [];

    return [
      `/assets/img/instagram/${file}`,
      `/assets/img/uploads/instagram/${file}`,
      `/assets/img/uploads/${file}`,
      `/assets/img/${file}`
    ];
  }

  function setImageWithFallback(image, candidates, onAllFailed) {
    let index = 0;

    const tryNext = () => {
      if (index >= candidates.length) {
        onAllFailed?.();
        return;
      }
      image.src = candidates[index];
      index += 1;
    };

    image.addEventListener('error', tryNext);
    tryNext();
  }

  function showInstagramEmpty(track) {
    if (track.querySelector('.elci-insta-card')) return;
    track.innerHTML = `
      <p class="elci-insta-empty">
        Galeri görselleri yönetim panelinden eklendiğinde burada yayınlanacak.
      </p>
    `;
  }

  function renderInstagram(manualItems, fallbackItems) {
    const track = document.getElementById('instaTrack');
    if (!track) return;

    injectInstagramFixStyles();

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

    /*
      Panelden en az bir gerçek görsel yüklenmişse eski arşivle karıştırma.
      Böylece eksik eski dosyalar logo olarak görünmez.
    */
    const source = normalizedManual.length ? normalizedManual : normalizedFallback;
    const seen = new Set();
    const items = source.filter(item => {
      const key = item.image || item.file;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 7);

    track.innerHTML = '';

    if (!items.length) {
      showInstagramEmpty(track);
      return;
    }

    items.forEach((item, itemIndex) => {
      const link = document.createElement('a');
      link.className = `elci-insta-card${itemIndex === 0 ? ' is-featured' : ''}`;
      link.href = item.instagramUrl || INSTAGRAM_PROFILE;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', item.title || item.alt || 'Instagram gönderisini aç');

      const image = document.createElement('img');
      image.className = 'elci-insta-image';
      image.alt = item.alt || item.title || 'Elçi Veteriner Kliniği galeri görseli';
      image.loading = itemIndex === 0 ? 'eager' : 'lazy';
      image.decoding = 'async';

      const overlay = document.createElement('span');
      overlay.className = 'elci-insta-overlay';

      const caption = document.createElement('strong');
      caption.textContent = item.title || 'Instagram’dan';

      const label = document.createElement('small');
      label.textContent = item.fallback ? 'Instagram paylaşımı' : 'Gönderiyi aç';

      overlay.append(caption, label);
      link.append(image, overlay);
      track.appendChild(link);

      setImageWithFallback(image, imageCandidates(item), () => {
        link.remove();
        showInstagramEmpty(track);
      });
    });
  }

  async function renderAll() {
    const [reviews, siteSettings, manualInstagram, fallbackInstagram] = await Promise.all([
      fetchJson('/assets/data/reviews.json?v=content-v23', []),
      fetchJson('/assets/data/site-settings.json?v=content-v23', {}),
      fetchJson('/assets/data/instagram-manual.json?v=content-v23', []),
      fetchJson('/assets/data/instagram.json?v=content-v23', [])
    ]);

    renderReviews(reviews, siteSettings.totalGoogleReviews);
    renderInstagram(manualInstagram, fallbackInstagram);
  }

  function start() {
    renderAll();
    window.setTimeout(renderAll, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
