(() => {
  'use strict';

  const INSTAGRAM_PROFILE = 'https://www.instagram.com/elciveteriner';
  const VERSION = 'content-v25';

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

  /* ---------------- INSTAGRAM GALERİSİ ---------------- */

  function injectInstagramStyles() {
    const oldStyle = document.getElementById('elci-instagram-slider-v24');
    if (oldStyle) oldStyle.remove();

    if (document.getElementById('elci-instagram-slider-v25')) return;

    const style = document.createElement('style');
    style.id = 'elci-instagram-slider-v25';

    style.textContent = `
      #insta {
        overflow: hidden !important;
        padding: 64px 0 58px !important;
        background: #fff;
      }

      #insta .container {
        width: 100% !important;
        max-width: 1180px !important;
        min-width: 0 !important;
        margin: 0 auto !important;
        padding: 0 16px !important;
        overflow: visible !important;
        box-sizing: border-box !important;
      }

      #insta .insta-head {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 20px !important;
        width: 100% !important;
        min-width: 0 !important;
        margin: 0 0 28px !important;
      }

      #insta .insta-head h2 {
        margin: 0 !important;
      }

      #insta .elci-insta-controls {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 0 0 auto;
      }

      #insta .elci-insta-arrow {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid rgba(90,31,168,.18);
        border-radius: 50%;
        background: #fff;
        color: var(--brand,#5a1fa8);
        font-size: 1.05rem;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 9px 22px rgba(31,42,56,.08);
        transition:
          transform .2s ease,
          border-color .2s ease,
          box-shadow .2s ease,
          background .2s ease;
      }

      #insta .elci-insta-arrow:hover,
      #insta .elci-insta-arrow:focus-visible {
        transform: translateY(-2px);
        border-color: rgba(90,31,168,.34);
        background: #faf7ff;
        box-shadow: 0 13px 28px rgba(31,42,56,.12);
        outline: none;
      }

      /*
        Dış alan daima sayfa genişliğinde sabit kalır.
        Yalnızca içindeki fotoğraf kartları sağa-sola kayar.
      */
      #insta .insta-track-wrap {
        position: relative !important;
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: 386px !important;
        margin: 0 !important;
        padding: 18px 16px 12px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        border: 1px solid rgba(90,31,168,.10);
        border-radius: 28px;
        background:
          radial-gradient(circle at 10% 15%, rgba(39,212,232,.11), transparent 30%),
          radial-gradient(circle at 90% 85%, rgba(90,31,168,.09), transparent 34%),
          linear-gradient(145deg,#ffffff,#fbf9ff);
        box-shadow: 0 18px 48px rgba(31,42,56,.07);
        isolation: isolate;
        contain: layout paint;
      }

      #instaTrack.insta-track {
        display: flex !important;
        align-items: flex-end !important;
        gap: 16px !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 10px 5px 16px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        box-sizing: border-box !important;
        scroll-snap-type: x proximity;
        scroll-padding-inline: 5px;
        scrollbar-gutter: stable;
        scrollbar-width: thin;
        scrollbar-color: rgba(90,31,168,.30) transparent;
        overscroll-behavior-inline: contain;
        -webkit-overflow-scrolling: touch;
      }

      #instaTrack.insta-track::-webkit-scrollbar {
        height: 7px;
      }

      #instaTrack.insta-track::-webkit-scrollbar-track {
        background: transparent;
      }

      #instaTrack.insta-track::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          rgba(90,31,168,.34),
          rgba(39,212,232,.52)
        );
      }

      #instaTrack .elci-insta-card {
        position: relative;
        display: block;
        flex: 0 0 226px !important;
        width: 226px !important;
        min-width: 226px !important;
        max-width: 226px !important;
        height: 284px !important;
        margin: 0 !important;
        overflow: hidden;
        box-sizing: border-box !important;
        border: 4px solid #fff;
        border-radius: 22px;
        background: #f1edf7;
        color: #fff;
        text-decoration: none;
        scroll-snap-align: start;
        box-shadow: 0 14px 30px rgba(31,42,56,.14);
        transform: none !important;
        transition:
          transform .24s ease,
          box-shadow .24s ease,
          border-color .24s ease !important;
      }

      /*
        Her açılışta aralıklı birkaç kart rastgele öne çıkar.
        Büyük kartlar birbirine yığılmadığı için düzen dengeli kalır.
      */
      #instaTrack .elci-insta-card.is-featured {
        flex-basis: 304px !important;
        width: 304px !important;
        min-width: 304px !important;
        max-width: 304px !important;
        height: 334px !important;
        border-color: rgba(255,255,255,.98);
        box-shadow: 0 20px 40px rgba(55,30,95,.20);
      }

      #instaTrack .elci-insta-card:hover,
      #instaTrack .elci-insta-card:focus-visible {
        z-index: 3;
        transform: translateY(-6px) !important;
        border-color: #fff;
        box-shadow: 0 22px 42px rgba(31,42,56,.21);
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
        width: 100%;
        align-self: center;
        margin: 0;
        padding: 28px;
        color: var(--muted,#667085);
        text-align: center;
      }

      @media (max-width: 760px) {
        #insta {
          padding: 52px 0 48px !important;
        }

        #insta .container {
          padding: 0 14px !important;
        }

        #insta .insta-head {
          margin-bottom: 22px !important;
        }

        #insta .elci-insta-arrow {
          width: 39px;
          height: 39px;
        }

        #insta .insta-track-wrap {
          height: 360px !important;
          padding: 14px 10px 9px !important;
          border-radius: 23px;
        }

        #instaTrack.insta-track {
          gap: 13px !important;
          padding: 8px 3px 14px !important;
        }

        #instaTrack .elci-insta-card {
          flex-basis: 68vw !important;
          width: 68vw !important;
          min-width: 68vw !important;
          max-width: 68vw !important;
          height: 278px !important;
        }

        #instaTrack .elci-insta-card.is-featured {
          flex-basis: 82vw !important;
          width: 82vw !important;
          min-width: 82vw !important;
          max-width: 82vw !important;
          height: 318px !important;
        }
      }

      @media (max-width: 430px) {
        #insta .insta-track-wrap {
          height: 342px !important;
        }

        #instaTrack .elci-insta-card {
          flex-basis: 72vw !important;
          width: 72vw !important;
          min-width: 72vw !important;
          max-width: 72vw !important;
          height: 264px !important;
        }

        #instaTrack .elci-insta-card.is-featured {
          flex-basis: 84vw !important;
          width: 84vw !important;
          min-width: 84vw !important;
          max-width: 84vw !important;
          height: 302px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function randomOffset() {
    const key = 'elci-instagram-feature-offset-v25';
    const saved = Number(sessionStorage.getItem(key));

    if (Number.isInteger(saved) && saved >= 0 && saved <= 4) {
      return saved;
    }

    const offset = Math.floor(Math.random() * 5);
    sessionStorage.setItem(key, String(offset));
    return offset;
  }

  function featuredIndexes(length) {
    const selected = new Set();

    if (length <= 0) return selected;

    if (length < 5) {
      selected.add(Math.floor(Math.random() * length));
      return selected;
    }

    const offset = randomOffset();

    for (let index = offset; index < length; index += 5) {
      selected.add(index);
    }

    return selected;
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
      Yönetim panelinden eklenen görseller her zaman en başta görünür.
      Eski arşiv görselleri arkadan devam eder.
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
      .slice(0, 30);
  }

  function prepareHeader(track) {
    const section = document.getElementById('insta');
    const head = section?.querySelector('.insta-head');
    if (!head) return;

    /*
      Önceki sürümde eklenen yardımcı yazıyı kaldırır.
      Başlık tekrar sitenin diğer bölüm başlıklarıyla aynı görünür.
    */
    const oldCopy = head.querySelector('.elci-insta-heading-copy');

    if (oldCopy) {
      const heading = oldCopy.querySelector('h2');

      if (heading) {
        head.insertBefore(heading, oldCopy);
      }

      oldCopy.remove();
    }

    head.querySelectorAll('.elci-insta-controls').forEach(control => control.remove());

    const controls = document.createElement('div');
    controls.className = 'elci-insta-controls';

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'elci-insta-arrow';
    previous.setAttribute('aria-label', 'Önceki Instagram görselleri');
    previous.textContent = '←';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'elci-insta-arrow';
    next.setAttribute('aria-label', 'Sonraki Instagram görselleri');
    next.textContent = '→';

    previous.addEventListener('click', () => scrollSlider(track, -1));
    next.addEventListener('click', () => scrollSlider(track, 1));

    controls.append(previous, next);
    head.appendChild(controls);
  }

  function scrollSlider(track, direction) {
    const firstCard = track.querySelector('.elci-insta-card');

    const amount = firstCard
      ? firstCard.getBoundingClientRect().width + 16
      : Math.max(260, Math.round(track.clientWidth * .72));

    track.scrollBy({
      left: direction * amount,
      behavior: 'smooth'
    });
  }

  function enableKeyboard(track) {
    track.tabIndex = 0;
    track.setAttribute(
      'aria-label',
      'Instagram görselleri. Sağ ve sol ok tuşlarıyla gezebilirsiniz.'
    );

    track.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollSlider(track, -1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollSlider(track, 1);
      }
    });
  }

  function showInstagramEmpty(track) {
    if (track.querySelector('.elci-insta-card')) return;

    track.innerHTML = `
      <p class="elci-insta-empty">
        Yönetim panelinden eklediğiniz galeri görselleri burada yayınlanacak.
      </p>
    `;
  }

  function renderInstagram(manualItems, fallbackItems) {
    const track = document.getElementById('instaTrack');
    if (!track) return;

    injectInstagramStyles();
    prepareHeader(track);

    const items = normalizeInstagram(manualItems, fallbackItems);
    const featured = featuredIndexes(items.length);

    track.innerHTML = '';
    track.scrollLeft = 0;

    if (!items.length) {
      showInstagramEmpty(track);
      return;
    }

    items.forEach((item, itemIndex) => {
      const link = document.createElement('a');
      link.className = `elci-insta-card${featured.has(itemIndex) ? ' is-featured' : ''}`;
      link.href = item.instagramUrl || INSTAGRAM_PROFILE;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute(
        'aria-label',
        item.title || item.alt || 'Instagram gönderisini aç'
      );

      const image = document.createElement('img');
      image.className = 'elci-insta-image';
      image.alt =
        item.alt ||
        item.title ||
        'Elçi Veteriner Kliniği galeri görseli';
      image.loading = itemIndex < 4 ? 'eager' : 'lazy';
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
      track.appendChild(link);

      setImageWithFallback(
        image,
        imageCandidates(item),
        () => {
          link.remove();
          window.setTimeout(() => showInstagramEmpty(track), 40);
        }
      );
    });

    enableKeyboard(track);
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
    /*
      Yalnızca bir kez oluşturulur.
      Önceki sürümdeki tekrar tekrar çizim, genişlik değişimi ve titreme kaldırıldı.
    */
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
