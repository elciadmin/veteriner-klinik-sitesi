document.addEventListener('DOMContentLoaded', () => {
  /* === Mobil Menü === */
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mainMenu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const show = menu.classList.toggle('show');
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
    });
  }
});

/* === Blog kartları (varsa) === */
(async function initBlog(){
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  try{
    const res = await fetch('/assets/data/blog.json', { cache: 'no-store' });
    if (!res.ok) return;
    const posts = await res.json();
    if (!Array.isArray(posts)) return;
    grid.innerHTML = posts.slice(0,3).map(p => `
      <article class="blog-card">
        <div class="thumb">${p.image ? `<img src="${p.image}" alt="${p.title||''}" loading="lazy">` : ''}</div>
        <div class="body">
          <h3>${p.title||''}</h3>
          <p>${p.excerpt||''}</p>
        </div>
      </article>
    `).join('');
  }catch{}
})();

/* === INSTAGRAM: sağlam/fallback'lı yavaş akan şerit + düzenli duraksama + spotlight === */
(async function initInstagram(){
  const wrap = document.getElementById('instaGrid');
  if (!wrap) return;

  let items = [];
  try{
    const res = await fetch('/assets/data/instagram.json', { cache: 'no-store' });
    if (res.ok) items = await res.json();
  }catch(e){
    console.warn('instagram.json okunamadı', e);
  }
  if (!Array.isArray(items) || items.length === 0){
    wrap.innerHTML = '';
    return;
  }

  const track = document.createElement('div');
  track.className = 'insta-track';

  // >>> İSTENEN KLASÖR: /assets/img/insta/  (404 olursa /assets/img/ köküne düşer)
  const mkItem = (name) => `
    <a class="insta-item" href="https://www.instagram.com/elcivetklinigi/" target="_blank" rel="noopener">
      <img loading="lazy"
           src="/assets/img/insta/${name}"
           alt="Instagram görseli"
           onerror="this.onerror=null;this.src='/assets/img/${name}'">
    </a>
  `;

  track.innerHTML = [...items, ...items].map(mkItem).join('');
  wrap.innerHTML = '';
  wrap.appendChild(track);

  // Daha yavaş akış
  const PX_PER_SEC = 10;   // düşük hız
  let x = 0;
  let lastTs = performance.now();
  const singleWidth = () => track.scrollWidth / 2;

  let raf;
  function tick(ts){
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    x -= PX_PER_SEC * dt;
    const width = singleWidth();
    if (Math.abs(x) > width) x += width;
    track.style.transform = `translateX(${x}px)`;
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  // 15 sn'de bir 3 sn duraksama
  setInterval(()=>{
    cancelAnimationFrame(raf);
    setTimeout(()=>{ lastTs = performance.now(); raf = requestAnimationFrame(tick); }, 3000);
  }, 15000);

  // 30 sn’de bir 10 sn spotlight
  function runSpotlight(){
    const cards = track.querySelectorAll('.insta-item');
    if (!cards.length) return;
    const max = Math.min(8, cards.length);
    const idx = Math.floor(Math.random() * max);
    const c = cards[idx];
    c.classList.add('insta-spot');
    setTimeout(()=> c.classList.remove('insta-spot'), 10000);
  }
  runSpotlight();
  setInterval(runSpotlight, 30000);
})();

/* === Google Reviews: büyük kart + 15sn’de sayfalama (3’erli) === */
(async function initReviews(){
  const sumEl = document.getElementById('ratingSummary');
  const grid  = document.getElementById('reviewsGrid');
  if (!sumEl || !grid) return;

  let data = [];
  try{
    const res = await fetch('/assets/data/reviews.json', { cache: 'no-store' });
    if (res.ok) {
      data = await res.json();
    } else {
      console.warn('reviews.json HTTP hatası', res.status);
    }
  }catch(e){
    console.warn('reviews.json okunamadı', e);
  }

  if (!Array.isArray(data) || data.length === 0){
    document.getElementById('google-yorumlari')?.remove();
    return;
  }

  // Özet — toplam yorum sayısını göstermiyoruz (senin isteğine göre)
  sumEl.innerHTML = `
    <span class="stars" aria-hidden="true" title="5 yıldız">★★★★★</span>
    <span class="score">5.0 / 5</span>
  `;

  const pageSize = 3;
  let page = 0;

  function tpl(r){
    return `
      <article class="review-card">
        <div class="review-author">${r.author||''}</div>
        <div class="review-meta"><span class="stars" aria-hidden="true">★★★★★</span> · ${r.time||''}</div>
        <div class="review-text">${r.text||''}</div>
      </article>
    `;
  }

  function renderPage(){
    const start = page * pageSize;
    let slice = data.slice(start, start + pageSize);
    if (slice.length < pageSize){
      slice = slice.concat(data.slice(0, pageSize - slice.length));
    }
    grid.innerHTML = slice.map(tpl).join('');
    requestAnimationFrame(()=>{
      grid.querySelectorAll('.review-card').forEach(c => c.classList.add('show'));
    });
  }

  renderPage();
  setInterval(()=>{
    grid.querySelectorAll('.review-card').forEach(c => c.classList.remove('show'));
    setTimeout(()=>{
      page = (page + 1) % Math.ceil(data.length / pageSize);
      renderPage();
    }, 500);
  }, 15000);
})();

/* === YouTube: son 5 videoyu kanal feed'inden otomatik çek === */
(async function initYouTube(){
  const grid = document.getElementById('ytGrid');
  if (!grid) return;

  const FEED_URL = '/.netlify/functions/youtube';
  const ATOM_NS = 'http://www.w3.org/2005/Atom';
  const YT_NS   = 'http://www.youtube.com/xml/schemas/2015';

  let videos = [];
  try {
    const res  = await fetch(FEED_URL, { cache: 'no-store' });
    const text = await res.text();
    const doc  = new DOMParser().parseFromString(text, 'application/xml');

    const entries = Array.from(doc.getElementsByTagNameNS(ATOM_NS, 'entry'));
    videos = entries.map(e => {
      const idEl    = e.getElementsByTagNameNS(YT_NS, 'videoId')[0];
      const titleEl = e.getElementsByTagNameNS(ATOM_NS, 'title')[0];
      return {
        id: idEl ? idEl.textContent : '',
        title: titleEl ? titleEl.textContent : 'Video'
      };
    }).filter(v => v.id);
  } catch (err) {
    try{
      const res = await fetch('/assets/data/youtube.json', { cache: 'no-store' });
      if (res.ok) {
        const fallback = await res.json();
        videos = Array.isArray(fallback) ? fallback : [];
      }
    }catch{}
  }

  if (!Array.isArray(videos) || videos.length === 0){
    videos = [
      { id: 'GVHnMUg_GeU', title: 'Kedi Sağlığında A Vitamini Sırrı' },
      { id: 'HBgzBBuwCeY', title: 'Soğukta Donan Dostlarımız!' },
      { id: 'Y3pWObjTFAw', title: 'Pyoderma Nedir?' },
      { id: 'VNVp534lGYw', title: 'Kedim Hamile Mi?' },
      { id: 'X4DYXSzqewU', title: 'Kedimde Cushing Var mı?' }
    ];
  }

  const limit = 5;
  const pick = videos.slice(0, limit);

  grid.innerHTML = pick.map(v => {
    const thumb = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
    const url   = `https://www.youtube.com/watch?v=${v.id}`;
    return `
      <article class="yt-card">
        <a class="yt-thumb" href="${url}" target="_blank" rel="noopener" aria-label="${v.title||'YouTube'}">
          <img src="${thumb}" alt="${v.title||'YouTube'}" loading="lazy">
        </a>
        <div class="yt-body">
          <div class="yt-title">${v.title || 'Video'}</div>
        </div>
      </article>
    `;
  }).join('');
})();
