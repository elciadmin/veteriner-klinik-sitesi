/* ====== NAV ====== */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mainMenu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const show = menu.classList.toggle('show');
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
    });
  }
});

/* ====== INSTAGRAM: yavaş akan şerit + periyodik duraksama + spotlight ====== */
(async function initInstagram(){
  const wrap = document.getElementById('instaGrid');
  if (!wrap) return;

  let files = [];
  try{
    const res = await fetch('/assets/data/instagram.json', { cache: 'no-store' });
    if (res.ok) files = await res.json();
  }catch(e){ console.warn('instagram.json okunamadı', e); }

  if (!Array.isArray(files) || files.length === 0){
    wrap.remove(); // veri yoksa bölümü gizle
    return;
  }

  const track = document.createElement('div');
  track.className = 'insta-track';

  const mk = (name) => `
    <a class="insta-item" href="https://www.instagram.com/elcivetklinigi/" target="_blank" rel="noopener">
      <img loading="lazy"
           src="/assets/img/insta/${name}"
           alt="Instagram görseli"
           onerror="this.onerror=null;this.src='/assets/img/${name}'">
    </a>
  `;

  // Kesintisiz akış: iki kat
  track.innerHTML = [...files, ...files].map(mk).join('');
  wrap.innerHTML = '';
  wrap.appendChild(track);

  // Hız (önceki hızlıydı → yarıya düşürdük)
  const PX_PER_SEC = 6; // düşük hız
  let x = 0;
  let last = performance.now();
  let raf;

  const widthHalf = () => track.scrollWidth / 2;

  function loop(ts){
    const dt = (ts - last) / 1000;
    last = ts;
    x -= PX_PER_SEC * dt;
    const half = widthHalf();
    if (Math.abs(x) > half) x += half;
    track.style.transform = `translateX(${x}px)`;
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  // 20sn'de bir 3sn duraksama
  setInterval(()=>{
    cancelAnimationFrame(raf);
    setTimeout(()=>{ last = performance.now(); raf = requestAnimationFrame(loop); }, 3000);
  }, 20000);

  // 30sn’de bir 10sn spotlight (öne büyüt)
  function spotlight(){
    const cards = track.querySelectorAll('.insta-item');
    if (!cards.length) return;
    const idx = Math.floor(Math.random() * Math.min(10, cards.length));
    const el = cards[idx];
    el.classList.add('insta-spot');
    setTimeout(()=> el.classList.remove('insta-spot'), 10000);
  }
  spotlight();
  setInterval(spotlight, 30000);
})();

/* ====== GOOGLE REVIEWS: 3'erli büyük kart; 15sn'de sayfa çevir ====== */
(async function initReviews(){
  const sumEl = document.getElementById('ratingSummary');
  const grid  = document.getElementById('reviewsGrid');
  if (!sumEl || !grid) return;

  let data = [];
  try{
    const res = await fetch('/assets/data/reviews.json', { cache: 'no-store' });
    if (res.ok) data = await res.json();
  }catch(e){ console.warn('reviews.json okunamadı', e); }

  if (!Array.isArray(data) || data.length === 0){
    document.getElementById('google-yorumlari')?.remove();
    return;
  }

  // Üst özet – yıldızlar beyaz, yorum sayısını kaldırdık
  sumEl.innerHTML = `<span class="stars" aria-hidden="true">★★★★★</span> <span class="score">5.0 / 5</span>`;

  const pageSize = 3;
  let page = 0;

  const card = (r) => `
    <article class="review-card">
      <div class="review-author">${r.author||''}</div>
      <div class="review-meta"><span class="stars">★★★★★</span> · ${r.time||''}</div>
      <div class="review-text">${r.text||''}</div>
    </article>
  `;

  function render(){
    const start = page * pageSize;
    let slice = data.slice(start, start + pageSize);
    if (slice.length < pageSize) slice = slice.concat(data.slice(0, pageSize - slice.length));
    grid.innerHTML = slice.map(card).join('');
    requestAnimationFrame(()=> grid.querySelectorAll('.review-card').forEach(c => c.classList.add('show')));
  }

  render();
  setInterval(()=>{
    grid.querySelectorAll('.review-card').forEach(c => c.classList.remove('show'));
    setTimeout(()=>{
      page = (page + 1) % Math.ceil(data.length / pageSize);
      render();
    }, 450);
  }, 15000);
})();

/* ====== YOUTUBE: kanal feed → öneri grid (5 video) ====== */
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
      return { id: idEl ? idEl.textContent : '', title: titleEl ? titleEl.textContent : 'Video' };
    }).filter(v => v.id);
  } catch {
    try{
      const res = await fetch('/assets/data/youtube.json', { cache: 'no-store' });
      if (res.ok) videos = await res.json();
    }catch{}
  }

  if (!videos.length){
    videos = [
      { id: 'GVHnMUg_GeU', title: 'Kedi Sağlığında A Vitamini Sırrı' },
      { id: 'HBgzBBuwCeY', title: 'Soğukta Donan Dostlarımız!' },
      { id: 'Y3pWObjTFAw', title: 'Pyoderma Nedir?' },
      { id: 'VNVp534lGYw', title: 'Kedim Hamile Mi?' },
      { id: 'X4DYXSzqewU', title: 'Kedimde Cushing Var mı?' }
    ];
  }

  const pick = videos.slice(0, 5);
  grid.innerHTML = pick.map(v => {
    const thumb = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
    const url   = `https://www.youtube.com/watch?v=${v.id}`;
    return `
      <article class="yt-card">
        <a class="yt-thumb" href="${url}" target="_blank" rel="noopener" aria-label="${v.title||'YouTube'}">
          <img src="${thumb}" alt="${v.title||'YouTube'}" loading="lazy">
        </a>
        <div class="yt-body"><div class="yt-title">${v.title || 'Video'}</div></div>
      </article>
    `;
  }).join('');
})();
