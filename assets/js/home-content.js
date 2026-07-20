(() => {
  'use strict';

  const INSTAGRAM_PROFILE = 'https://www.instagram.com/elciveteriner';
  const VERSION = 'content-v31';

  async function fetchJson(url, fallback) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(url);
      return await response.json();
    } catch {
      return fallback;
    }
  }

  /* ---------------- GOOGLE YORUMLARI ---------------- */

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

  /* ---------------- INSTAGRAM FİLM ŞERİDİ ---------------- */

  function injectInstagramStyles() {
    [
      'elci-instagram-grid-fix-v23',
      'elci-instagram-slider-v24',
      'elci-instagram-slider-v25',
      'elci-instagram-carousel-v26',
      'elci-instagram-film-v28',
      'elci-instagram-film-v29',
      'elci-instagram-film-v30',
      'elci-instagram-film-v31'
    ].forEach(id => document.getElementById(id)?.remove());

    const style = document.createElement('style');
    style.id = 'elci-instagram-film-v28',
      'elci-instagram-film-v29',
      'elci-instagram-film-v30',
      'elci-instagram-film-v31';

    style.textContent = `
      #insta {
        overflow: hidden !important;
        padding: 62px 0 58px !important;
        background: #fff;
      }

      #insta .container {
        width: min(1180px, calc(100% - 32px)) !important;
        max-width: 1180px !important;
        min-width: 0 !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }

      #insta .insta-head {
        display: block !important;
        width: 100% !important;
        margin: 0 0 26px !important;
      }

      #insta .insta-head h2 {
        margin: 0 !important;
      }

      #insta .elci-insta-controls,
      #insta .elci-insta-heading-copy p {
        display: none !important;
      }

      #insta .insta-track-wrap {
        position: relative !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: 326px !important;
        margin: 0 !important;
        padding: 28px 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        border: 1px solid rgba(90,31,168,.10);
        border-radius: 28px;
        background:
          radial-gradient(circle at 8% 15%, rgba(39,212,232,.10), transparent 28%),
          radial-gradient(circle at 92% 84%, rgba(90,31,168,.08), transparent 34%),
          linear-gradient(145deg,#ffffff,#fbf9ff);
        box-shadow: 0 18px 48px rgba(31,42,56,.07);
        isolation: isolate;
      }

      /*
        Kenarlardaki hafif geçiş sabit çerçeveye aittir.
        Hareket eden yalnızca fotoğraf kartlarıdır.
      */
      #insta .insta-track-wrap::before,
      #insta .insta-track-wrap::after {
        content: "";
        position: absolute;
        z-index: 5;
        top: 0;
        bottom: 0;
        width: 48px;
        pointer-events: none;
      }

      #insta .insta-track-wrap::before {
        left: 0;
        background: linear-gradient(90deg,#fff,rgba(255,255,255,0));
      }

      #insta .insta-track-wrap::after {
        right: 0;
        background: linear-gradient(270deg,#fff,rgba(255,255,255,0));
      }

      #instaTrack.insta-track {
        --elci-film-gap: 28px;
        --elci-film-duration: 260s;

        display: flex !important;
        align-items: center !important;
        gap: 0 !important;
        width: max-content !important;
        min-width: max-content !important;
        max-width: none !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        transform: translate3d(0,0,0);
        animation: elciInstagramFilm var(--elci-film-duration) linear infinite;
        animation-delay: -18s;
        will-change: transform;
      }

      #instaTrack .elci-insta-group {
        display: flex;
        align-items: center;
        gap: var(--elci-film-gap);
        padding-right: var(--elci-film-gap);
        box-sizing: border-box;
        flex: 0 0 auto;
        min-width: max-content;
      }

      @keyframes elciInstagramFilm {
        from {
          transform: translate3d(0,0,0);
        }
        to {
          transform: translate3d(-50%,0,0);
        }
      }

      #instaTrack .elci-insta-card {
        position: relative;
        display: block;
        flex: 0 0 208px !important;
        width: 208px !important;
        min-width: 208px !important;
        max-width: 208px !important;
        height: 246px !important;
        margin: 0 !important;
        overflow: hidden;
        box-sizing: border-box !important;
        border: 4px solid #fff;
        border-radius: 22px;
        background: #f1edf7;
        color: #fff;
        text-decoration: none;
        box-shadow: 0 14px 30px rgba(31,42,56,.14);
        transform: translateZ(0);
        transition:
          border-color .24s ease !important;
      }

      /*
        Fare hiçbir kartı büyütmez. JS, ekranda görünen farklı kartları
        sırayla ve rastgele seçerek tek seferlik öne çıkarır.
      */
      #instaTrack .elci-insta-card.is-random-focus {
        z-index: 8;
        animation: elciInstagramRandomFocus 2.45s ease-in-out 1;
        transform-origin: center center;
      }

      @keyframes elciInstagramRandomFocus {
        0%, 100% {
          transform: translate3d(0,0,0) scale(1);
          box-shadow: 0 14px 30px rgba(31,42,56,.14);
        }

        42%, 62% {
          transform: translate3d(0,-2px,0) scale(1.065);
          box-shadow: 0 25px 48px rgba(55,30,95,.25);
        }
      }

      /*
        index.html içindeki eski grup-hover kuralını tamamen etkisizleştirir.
        Böylece fare bir görsele geldiğinde bütün şerit büyümez.
      */
      #insta #instaTrack.insta-track > .elci-insta-group,
      #insta #instaTrack.insta-track > .elci-insta-group:hover,
      #insta #instaTrack.insta-track > .elci-insta-group:focus-within {
        z-index: 1 !important;
        transform: none !important;
        filter: none !important;
        transition: none !important;
        will-change: auto !important;
      }

        78% {
          transform: translate3d(0,-2px,0) scale(1.075);
          box-shadow: 0 24px 46px rgba(55,30,95,.24);
        }

        88% {
          transform: translate3d(0,0,0) scale(1);
          box-shadow: 0 14px 30px rgba(31,42,56,.14);
        }
      }

      #instaTrack .elci-insta-card:focus-visible {
        outline: 3px solid rgba(39,212,232,.55);
        outline-offset: 3px;
      }

      #instaTrack .elci-insta-image {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }

      #instaTrack .elci-insta-overlay {
        position: absolute;
        inset: auto 0 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 48px 16px 15px;
        background: linear-gradient(transparent,rgba(7,11,18,.82));
      }

      #instaTrack .elci-insta-overlay strong {
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        font-size: .94rem;
        line-height: 1.35;
      }

      #instaTrack .elci-insta-overlay small {
        color: #e9fbff;
        font-size: .78rem;
        font-weight: 700;
      }

      #instaTrack .elci-insta-empty {
        width: min(760px,calc(100vw - 64px));
        margin: auto 24px;
        padding: 28px;
        color: var(--muted,#667085);
        text-align: center;
      }

      @media (max-width: 760px) {
        #insta {
          padding: 52px 0 48px !important;
        }

        #insta .container {
          width: min(100% - 24px,1180px) !important;
        }

        #insta .insta-track-wrap {
          height: 314px !important;
          border-radius: 23px;
        }

        #insta .insta-track-wrap::before,
        #insta .insta-track-wrap::after {
          width: 26px;
        }

        #instaTrack.insta-track {
          --elci-film-gap: 22px;
          --elci-film-duration: 220s;
        }

        @keyframes elciInstagramFilm {
          from {
            transform: translate3d(0,0,0);
          }
          to {
            transform: translate3d(-50%,0,0);
          }
        }

        #instaTrack .elci-insta-card {
          flex-basis: 59vw !important;
          width: 59vw !important;
          min-width: 59vw !important;
          max-width: 59vw !important;
          height: 232px !important;
        }

        #instaTrack .elci-insta-card.is-featured {
          flex-basis: 59vw !important;
          width: 59vw !important;
          min-width: 59vw !important;
          max-width: 59vw !important;
          height: 232px !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #instaTrack.insta-track {
          animation-duration: 360s;
        }

        #instaTrack .elci-insta-card.is-random-focus {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function imageCandidates(item) {
    if (item.image) {
      const clean = String(item.image).trim();

      return [
        clean,
        clean.startsWith('/') ? clean : `/${clean}`
      ];
    }

    const file = String(item.file || '').trim();
    if (!file) return [];

    return [
      `/assets/img/insta/${file}`,
      `/assets/img/uploads/instagram/${file}`,
      `/assets/img/instagram/${file}`,
      `/assets/img/uploads/${file}`,
      `/assets/img/${file}`
    ];
  }

  function setImageWithFallback(image, candidates, onAllFailed) {
    const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
    let index = 0;

    const tryNext = () => {
      if (index >= uniqueCandidates.length) {
        onAllFailed?.();
        return;
      }

      image.src = uniqueCandidates[index];
      index += 1;
    };

    image.addEventListener('error', tryNext);
    tryNext();
  }

  function normalizeInstagram(manualItems, fallbackItems) {
    /*
      Panelden eklenen yeni görseller en başta yer alır.
      Mevcut Instagram arşivi kesintisiz şekilde arkasından devam eder.
    */
    const manual = (Array.isArray(manualItems) ? manualItems : [])
      .filter(item => item && item.published !== false && item.image)
      .map(item => ({
        ...item,
        sourceKey: item.image,
        fallback: false
      }));

    const fallback = (Array.isArray(fallbackItems) ? fallbackItems : [])
      .slice()
      .reverse()
      .map(item => ({
        image: '',
        file: item.file || '',
        title: 'Elçi Veteriner Kliniği',
        alt: 'Elçi Veteriner Kliniği Instagram paylaşımı',
        instagramUrl: INSTAGRAM_PROFILE,
        sourceKey: item.file || '',
        fallback: true
      }))
      .filter(item => item.file);

    const seen = new Set();

    return [...manual, ...fallback]
      .filter(item => {
        const key = item.sourceKey;
        if (!key || seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .slice(0, 80);
  }

  function createCard(item, itemIndex, duplicate) {
    const link = document.createElement('a');
    link.className = 'elci-insta-card';
    link.dataset.itemIndex = String(itemIndex);
    link.href = item.instagramUrl || INSTAGRAM_PROFILE;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute(
      'aria-label',
      item.title || item.alt || 'Instagram gönderisini aç'
    );

    if (duplicate) {
      link.setAttribute('aria-hidden', 'true');
      link.tabIndex = -1;
    }


    const image = document.createElement('img');
    image.className = 'elci-insta-image';
    image.alt = duplicate
      ? ''
      : item.alt || item.title || 'Elçi Veteriner Kliniği galeri görseli';
    image.loading = 'lazy';
    image.decoding = 'async';

    const overlay = document.createElement('span');
    overlay.className = 'elci-insta-overlay';

    const caption = document.createElement('strong');
    caption.textContent = item.title || 'Elçi Veteriner Kliniği';

    const label = document.createElement('small');
    label.textContent = item.fallback
      ? 'Instagram paylaşımı'
      : 'Gönderiyi aç';

    overlay.append(caption, label);
    link.append(image, overlay);

    setImageWithFallback(
      image,
      imageCandidates(item),
      () => link.remove()
    );

    return link;
  }

  function buildGroup(items, duplicate) {
    const group = document.createElement('div');
    group.className = 'elci-insta-group';

    if (duplicate) {
      group.setAttribute('aria-hidden', 'true');
    }

    items.forEach((item, index) => {
      group.appendChild(
        createCard(item, index, duplicate)
      );
    });

    return group;
  }


  let randomFocusTimer = 0;
  let lastFocusedIndex = -1;

  function scheduleRandomFocus(track) {
    window.clearTimeout(randomFocusTimer);

    const run = () => {
      const wrapper = track.closest('.insta-track-wrap');

      if (!wrapper || document.hidden) {
        randomFocusTimer = window.setTimeout(run, 3000);
        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const allCards = [...track.querySelectorAll('.elci-insta-card')];

      const visibleCards = allCards.filter(card => {
        const rect = card.getBoundingClientRect();

        return (
          rect.right > wrapperRect.left + 24 &&
          rect.left < wrapperRect.right - 24 &&
          rect.bottom > wrapperRect.top + 18 &&
          rect.top < wrapperRect.bottom - 18
        );
      });

      const differentCards = visibleCards.filter(
        card => Number(card.dataset.itemIndex) !== lastFocusedIndex
      );

      const candidates = differentCards.length ? differentCards : visibleCards;

      if (candidates.length) {
        const selected =
          candidates[Math.floor(Math.random() * candidates.length)];

        const selectedIndex = Number(selected.dataset.itemIndex);
        lastFocusedIndex = Number.isFinite(selectedIndex)
          ? selectedIndex
          : lastFocusedIndex;

        selected.classList.remove('is-random-focus');
        void selected.offsetWidth;
        selected.classList.add('is-random-focus');

        window.setTimeout(() => {
          selected.classList.remove('is-random-focus');
        }, 2550);
      }

      const nextDelay = 3300 + Math.random() * 3600;
      randomFocusTimer = window.setTimeout(run, nextDelay);
    };

    randomFocusTimer = window.setTimeout(
      run,
      1800 + Math.random() * 2200
    );
  }

  function cleanInstagramHeader() {
    const section = document.getElementById('insta');
    const head = section?.querySelector('.insta-head');
    if (!head) return;

    const oldCopy = head.querySelector('.elci-insta-heading-copy');

    if (oldCopy) {
      const heading = oldCopy.querySelector('h2');

      if (heading) {
        head.insertBefore(heading, oldCopy);
      }

      oldCopy.remove();
    }

    head.querySelectorAll('.elci-insta-controls').forEach(control => control.remove());
  }

  function renderInstagram(manualItems, fallbackItems) {
    const track = document.getElementById('instaTrack');
    if (!track) return;

    injectInstagramStyles();
    cleanInstagramHeader();

    const items = normalizeInstagram(manualItems, fallbackItems);

    track.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'elci-insta-empty';
      empty.textContent =
        'Yönetim panelinden eklediğiniz galeri görselleri burada yayınlanacak.';
      track.appendChild(empty);
      track.style.animation = 'none';
      return;
    }

    /*
      Aynı görsel grubu iki kez eklenir.
      İlk grup ekrandan çıkarken ikinci grup arkasından devam eder;
      böylece başlangıç ve bitiş noktası fark edilmez.
    */
    track.append(
      buildGroup(items, false),
      buildGroup(items, true)
    );

    /*
      Görsel sayısına göre hız dengelenir.
      Çok görsel olduğunda şerit gereksiz hızlanmaz.
    */
    const duration = Math.max(340, Math.min(1200, items.length * 13.5));
    track.style.setProperty('--elci-film-duration', `${duration}s`);
    scheduleRandomFocus(track);
  }

  /* ---------------- VERİLERİ YÜKLE ---------------- */

  async function renderAll() {
    const [
      reviews,
      siteSettings,
      manualInstagram,
      fallbackInstagram
    ] = await Promise.all([
      fetchJson(`/assets/data/reviews.json?v=${VERSION}`, []),
      fetchJson(`/assets/data/site-settings.json?v=${VERSION}`, {}),
      fetchJson(`/assets/data/instagram-manual.json?v=${VERSION}`, []),
      fetchJson(`/assets/data/instagram.json?v=${VERSION}`, [])
    ]);

    renderReviews(reviews, siteSettings.totalGoogleReviews);
    renderInstagram(manualInstagram, fallbackInstagram);
  }

  function start() {
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
