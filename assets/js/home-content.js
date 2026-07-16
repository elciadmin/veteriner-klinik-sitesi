(() => {
  'use strict';

  const INSTAGRAM_PROFILE = 'https://www.instagram.com/elciveteriner';
  const VERSION = 'content-v24';
  let autoplayTimer = null;

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

  function injectInstagramStyles() {
    if (document.getElementById('elci-instagram-slider-v24')) return;

    const style = document.createElement('style');
    style.id = 'elci-instagram-slider-v24';
    style.textContent = `
      html,body{max-width:100%;overflow-x:hidden}

      #insta{
        overflow:hidden!important;
        padding-top:54px!important;
        padding-bottom:48px!important;
      }

      #insta .container{
        overflow:hidden!important;
      }

      #insta .insta-head{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        margin-bottom:4px;
      }

      #insta .elci-insta-heading-copy small{
        display:block!important;
        margin-top:8px;
        color:var(--muted,#667085);
        font-size:.92rem;
      }

      #insta .elci-insta-controls{
        display:flex;
        gap:10px;
        flex:0 0 auto;
      }

      #insta .elci-insta-arrow{
        width:44px;
        height:44px;
        display:grid;
        place-items:center;
        border:1px solid rgba(90,31,168,.18);
        border-radius:50%;
        background:#fff;
        color:var(--brand,#5a1fa8);
        font-size:1.15rem;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 10px 22px rgba(31,42,56,.09);
        transition:transform .2s ease,box-shadow .2s ease,background .2s ease;
      }

      #insta .elci-insta-arrow:hover,
      #insta .elci-insta-arrow:focus-visible{
        transform:translateY(-2px);
        background:#f8f3ff;
        box-shadow:0 14px 28px rgba(31,42,56,.14);
        outline:none;
      }

      #insta .insta-track-wrap{
        position:relative;
        width:100%;
        max-width:100%;
        overflow:hidden!important;
        margin:0!important;
        padding:24px 0 24px!important;
      }

      #instaTrack.insta-track{
        display:flex!important;
        align-items:flex-end!important;
        gap:18px!important;
        width:100%;
        max-width:100%;
        height:365px;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        padding:12px 6px 18px!important;
        scroll-padding-inline:6px;
        scroll-snap-type:x proximity;
        overscroll-behavior-inline:contain;
        scrollbar-width:thin;
        scrollbar-color:rgba(90,31,168,.35) transparent;
        -webkit-overflow-scrolling:touch;
      }

      #instaTrack.insta-track::-webkit-scrollbar{height:8px}
      #instaTrack.insta-track::-webkit-scrollbar-track{background:transparent}
      #instaTrack.insta-track::-webkit-scrollbar-thumb{
        background:linear-gradient(90deg,rgba(90,31,168,.34),rgba(39,212,232,.5));
        border-radius:999px;
      }

      #instaTrack .elci-insta-card{
        position:relative;
        display:block;
        flex:0 0 245px!important;
        width:245px!important;
        min-width:245px!important;
        height:292px!important;
        overflow:hidden;
        border:4px solid #fff;
        border-radius:24px;
        background:#f1edf7;
        box-shadow:0 15px 32px rgba(31,42,56,.15);
        text-decoration:none;
        color:#fff;
        scroll-snap-align:start;
        transform:none!important;
        transition:transform .25s ease,box-shadow .25s ease!important;
      }

      #instaTrack .elci-insta-card.is-featured{
        flex-basis:355px!important;
        width:355px!important;
        min-width:355px!important;
        height:342px!important;
        border-color:rgba(255,255,255,.98);
        box-shadow:0 22px 44px rgba(55,30,95,.23);
      }

      #instaTrack .elci-insta-card:hover,
      #instaTrack .elci-insta-card:focus-visible{
        z-index:5;
        transform:translateY(-7px)!important;
        box-shadow:0 24px 46px rgba(31,42,56,.23);
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
        padding:52px 17px 16px;
        background:linear-gradient(transparent,rgba(8,11,18,.82));
      }

      #instaTrack .elci-insta-overlay strong{
        overflow:hidden;
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:2;
        font-size:.96rem;
        line-height:1.35;
      }

      #instaTrack .elci-insta-overlay small{
        color:#e9fbff;
        font-weight:700;
      }

      #instaTrack .elci-insta-empty{
        width:100%;
        margin:auto 0;
        padding:24px;
        border:1px dashed rgba(90,31,168,.2);
        border-radius:18px;
        background:#fbf9ff;
        color:var(--muted,#667085);
        text-align:center;
      }

      @media(max-width:760px){
        #insta .insta-head{align-items:center}
        #insta .elci-insta-heading-copy small{font-size:.82rem}
        #insta .elci-insta-arrow{width:40px;height:40px}
        #instaTrack.insta-track{height:352px;gap:14px!important}
        #instaTrack .elci-insta-card{
          flex-basis:72vw!important;
          width:72vw!important;
          min-width:72vw!important;
          height:290px!important;
        }
        #instaTrack .elci-insta-card.is-featured{
          flex-basis:86vw!important;
          width:86vw!important;
          min-width:86vw!important;
          height:330px!important;
        }
      }

      @media(max-width:430px){
        #insta .elci-insta-heading-copy small{display:none!important}
        #instaTrack.insta-track{height:335px}
        #instaTrack .elci-insta-card{
          flex-basis:76vw!important;
          width:76vw!important;
          min-width:76vw!important;
          height:278px!important;
        }
        #instaTrack .elci-insta-card.is-featured{
          flex-basis:88vw!important;
          width:88vw!important;
          min-width:88vw!important;
          height:316px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getSessionSeed() {
    const key = 'elci-instagram-feature-seed';
    let value = Number(sessionStorage.getItem(key));
    if (!Number.isFinite(value) || value <= 0) {
      value = Math.floor(Math.random() * 2147483646) + 1;
      sessionStorage.setItem(key, String(value));
    }
    return value;
  }

  function seededShuffle(values, seed) {
    const result = [...values];
    let state = seed % 2147483647;
    if (state <= 0) state += 2147483646;

    const random = () => {
      state = state * 16807 % 2147483647;
      return (state - 1) / 2147483646;
    };

    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function featuredIndexes(length) {
    if (length <= 0) return new Set();
    const count = Math.min(3, Math.max(1, Math.round(length / 5)));
    const choices = seededShuffle(Array.from({ length }, (_, index) => index), getSessionSeed());
    return new Set(choices.slice(0, count));
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
    const unique = [...new Set(candidates.filter(Boolean))];
    let index = 0;

    const tryNext = () => {
      if (index >= unique.length) {
        onAllFailed?.();
        return;
      }
      image.src = unique[index];
      index += 1;
    };

    image.addEventListener('error', tryNext);
    tryNext();
  }

  function normalizeInstagram(manualItems, fallbackItems) {
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
    return [...manual, ...fallback].filter(item => {
      const key = item.sourceKey;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 24);
  }

  function ensureSliderControls(track) {
    const section = document.getElementById('insta');
    const head = section?.querySelector('.insta-head');
    if (!head) return;

    let headingCopy = head.querySelector('.elci-insta-heading-copy');
    if (!headingCopy) {
      const heading = head.querySelector('h2');
      headingCopy = document.createElement('div');
      headingCopy.className = 'elci-insta-heading-copy';
      if (heading) headingCopy.appendChild(heading);

      const hint = document.createElement('small');
      hint.textContent = 'Fotoğrafları sürükleyin veya oklarla kaydırın';
      headingCopy.appendChild(hint);
      head.prepend(headingCopy);
    }

    let controls = head.querySelector('.elci-insta-controls');
    if (!controls) {
      controls = document.createElement('div');
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
  }

  function scrollSlider(track, direction = 1) {
    const amount = Math.max(280, Math.round(track.clientWidth * .72));
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  function startAutoplay(track) {
    window.clearInterval(autoplayTimer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (track.children.length < 4) return;

    const resume = () => {
      window.clearInterval(autoplayTimer);
      autoplayTimer = window.setInterval(() => {
        const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 30;
        if (atEnd) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollSlider(track, 1);
        }
      }, 4800);
    };

    const pause = () => window.clearInterval(autoplayTimer);

    if (!track.dataset.autoplayBound) {
      track.dataset.autoplayBound = 'true';
      track.addEventListener('mouseenter', pause);
      track.addEventListener('mouseleave', resume);
      track.addEventListener('focusin', pause);
      track.addEventListener('focusout', resume);
      track.addEventListener('touchstart', pause, { passive: true });
      track.addEventListener('touchend', resume, { passive: true });
    }

    resume();
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
    ensureSliderControls(track);

    const items = normalizeInstagram(manualItems, fallbackItems);
    const featured = featuredIndexes(items.length);
    track.innerHTML = '';

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
      link.setAttribute('aria-label', item.title || item.alt || 'Instagram gönderisini aç');

      const image = document.createElement('img');
      image.className = 'elci-insta-image';
      image.alt = item.alt || item.title || 'Elçi Veteriner Kliniği galeri görseli';
      image.loading = itemIndex < 4 ? 'eager' : 'lazy';
      image.decoding = 'async';

      const overlay = document.createElement('span');
      overlay.className = 'elci-insta-overlay';

      const caption = document.createElement('strong');
      caption.textContent = item.title || 'Elçi Veteriner Kliniği';

      const label = document.createElement('small');
      label.textContent = item.fallback ? 'Instagram paylaşımı' : 'Gönderiyi aç';

      overlay.append(caption, label);
      link.append(image, overlay);
      track.appendChild(link);

      setImageWithFallback(image, imageCandidates(item), () => {
        link.remove();
        window.setTimeout(() => showInstagramEmpty(track), 50);
      });
    });

    window.setTimeout(() => startAutoplay(track), 250);
  }

  async function renderAll() {
    const [reviews, siteSettings, manualInstagram, fallbackInstagram] = await Promise.all([
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
    window.setTimeout(renderAll, 800);
    window.setTimeout(renderAll, 1700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
