(() => {
  'use strict';

  const INSTAGRAM_PROFILE = 'https://www.instagram.com/elciveteriner';
  const VERSION = 'content-v28';

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
      'elci-instagram-film-v28'
    ].forEach(id => document.getElementById(id)?.remove());

    const style = document.createElement('style');
    style.id = 'elci-instagram-film-v28';

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
        padding: 8px 0 !important;
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
        --elci-film-gap: 16px;
        --elci-film-duration: 120s;

        display: flex !important;
        align-items: center !important;
        gap: var(--elci-film-gap) !important;
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
        animation-delay: -7s;
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

      #insta .insta-track-wrap:hover #instaTrack,
      #insta .insta-track-wrap:focus-within #instaTrack {
        animation-play-state: paused;
      }

      #instaTrack .elci-insta-card {
        position: relative;
        display: block;
        flex: 0 0 248px !important;
        width: 248px !important;
        min-width: 248px !important;
        max-width: 248px !important;
        height: 298px !important;
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
          transform .24s ease,
          box-shadow .24s ease,
          border-color .24s ease !important;
      }

      #instaTrack .elci-insta-card.is-featured {
        flex-basis: 322px !important;
        width: 322px !important;
        min-width: 322px !important;
        max-width: 322px !important;
        height: 324px !important;
        box-shadow: 0 20px 40px rgba(55,30,95,.19);
      }

      #instaTrack .elci-insta-card:hover,
      #instaTrack .elci-insta-card:focus-visible {
        z-index: 4;
        transform: translateY(-5px) !important;
        border-color: #fff;
        box-shadow: 0 23px 44px rgba(31,42,56,.22);
        outline: none;
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
          height: 342px !important;
          border-radius: 23px;
        }

        #insta .insta-track-wrap::before,
        #insta .insta-track-wrap::after {
          width: 26px;
        }

        #instaTrack.insta-track {
          --elci-film-gap: 13px;
          --elci-film-duration: 92s;
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
          flex-basis: 70vw !important;
          width: 70vw !important;
          min-width: 70vw !important;
          max-width: 70vw !important;
          height: 274px !important;
        }

        #instaTrack .elci-insta-card.is-featured {
          flex-basis: 84vw !important;
          width: 84vw !important;
          min-width: 84vw !important;
          max-width: 84vw !important;
          height: 306px !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #instaTrack.insta-track {
          animation-duration: 180s;
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

  function featuredIndexes(length) {
    const selected = new Set();
    if (!length) return selected;

    /*
      Aynı oturumda düzen sabit kalır; sayfa yeniden açıldığında
      öne çıkan görseller farklılaşabilir.
    */
    const storageKey = 'elci-instagram-feature-seed-v28';
    let seed = Number(sessionStorage.getItem(storageKey));

    if (!Number.isInteger(seed) || seed < 0 || seed > 5) {
      seed = Math.floor(Math.random() * 6);
      sessionStorage.setItem(storageKey, String(seed));
    }

    for (let index = seed; index < length; index += 6) {
      selected.add(index);
    }

    return selected;
  }

  function createCard(item, isFeatured, duplicate) {
    const link = document.createElement('a');
    link.className = `elci-insta-card${isFeatured ? ' is-featured' : ''}`;
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

  function buildGroup(items, featured, duplicate) {
    const group = document.createElement('div');
    group.className = 'elci-insta-group';

    if (duplicate) {
      group.setAttribute('aria-hidden', 'true');
    }

    items.forEach((item, index) => {
      group.appendChild(
        createCard(item, featured.has(index), duplicate)
      );
    });

    return group;
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
    const featured = featuredIndexes(items.length);

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
      buildGroup(items, featured, false),
      buildGroup(items, featured, true)
    );

    /*
      Görsel sayısına göre hız dengelenir.
      Çok görsel olduğunda şerit gereksiz hızlanmaz.
    */
    const duration = Math.max(90, Math.min(260, items.length * 3.15));
    track.style.setProperty('--elci-film-duration', `${duration}s`);
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
