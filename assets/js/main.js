// -------------------------------------------------------------
// Elçi Veteriner - Ana JS (v11)
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initDropdownTouch();
  initBlog();
  initInstagramStrip(); // Akan şerit + spotlight
  initYouTubeCompact(); // Öneriler benzeri kompakt grid
  initGoogleReviews();  // Yerel JSON
});

// -------------------------------------------------------------
// Mobil Menü
// -------------------------------------------------------------
function initMobileMenu(){
  const btn  = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mainMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const show = menu.classList.toggle('show');
    btn.setAttribute('aria-expanded', show ? 'true' : 'false');
    menu.querySelectorAll('.dropdown > a').forEach(a => {
      a.addEventListener('click', (ev) => {
        if (window.innerWidth < 992) {
          ev.preventDefault();
          a.parentElement.classList.toggle('active');
        }
      });
    });
  });
}
function initDropdownTouch(){
  document.querySelectorAll('.dropdown').forEach(d => {
    d.addEventListener('touchstart', () => d.classList.add('active'), {passive:true});
    d.addEventListener('touchend',   () => d.classList.remove('active'), {passive:true});
  });
}

// -------------------------------------------------------------
// Blog
// -------------------------------------------------------------
async function initBlog(){
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  try{
    const res = await fetch('assets/data/blog.json', { cache: 'no-store' });
    if (!res.ok) return;
    const posts = await res.json();
    if (!Array.isArray(posts)) return;
    grid.innerHTML = posts.slice(0,3).map(p => `
      <article class="blog-card">
        <div class="thumb">${p.image ? `<img src="${p.image}" alt="${(p.title||'')}" loading="lazy">` : ''}</div>
        <div class="body">
          <h3>${p.title||''}</h3>
          <p>${p.excerpt||''}</p>
        </div>
      </article>
    `).join('');
  }catch{}
}

// -------------------------------------------------------------
// Instagram – AKAN ŞERİT + Spotlight
//  - JSON: assets/data/instagram.json  → ["a.webp", {file:"b.jpg"}, ...]
//  - Görsel kök: assets/img/insta/
//  - Sonsuz kaydırma için içerik iki kez klonlanır
//  - Rastgele 1 görsel 2.5sn "spotlight" büyür, sonra eski haline döner
// -------------------------------------------------------------
async function initInstagramStrip(){
  const mount = document.getElementById('instaGrid');
  if (!mount) return;

  let list = [];
  try{
    const res = await fetch('assets/data/instagram.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    list = (Array.isArray(data) ? data : []).map(x => typeof x === 'string' ? x : String(x.file)).filter(Boolean);
  }catch{ return; }
  if (!list.length) return;

  const base = 'assets/img/insta/';
  // Stil ekle
  if (!document.getElementById('instaStripStyles')){
    const css = `
      .insta-strip-wrap{ overflow:hidden; position:relative; }
      .insta-strip{ display:flex; gap:10px; will-change:transform; }
      .insta-tile{
        flex:0 0 auto; width:170px; height:170px; border-radius:14px; overflow:hidden;
        border:1px solid #e6eef7; background:#f7faff; position:relative; transition:transform .35s;
      }
      .insta-tile img{ width:100%; height:100%; object-fit:cover; display:block; }
      @media (max-width:1200px){ .insta-tile{ width:150px; height:150px; } }
      @media (max-width:768px){  .insta-tile{ width:130px; height:130px; } }
      /* Spotlight efekti */
      .insta-spot{ z-index:2; transform:scale(1.15); box-shadow:0 12px 30px rgba(0,0,0,.18) }
    `.trim();
    const s = document.createElement('style');
    s.id = 'instaStripStyles'; s.textContent = css;
    document.head.appendChild(s);
  }

  // DOM kur
  mount.innerHTML = '';
  mount.classList.add('insta-strip-wrap');
  const track = document.createElement('div');
  track.className = 'insta-strip';
  mount.appendChild(track);

  // Bir seti oluştur
  const makeSet = () => list.map(file => {
    const a = document.createElement('a');
    a.href = `${base}${file}`; a.target = '_blank'; a.rel = 'noopener';
    a.className = 'insta-tile';
    a.innerHTML = `<img src="${base}${file}" alt="Instagram" loading="lazy">`;
    return a;
  });

  // Akış için iki kez ekle (sonsuz)
  const set1 = makeSet(); set1.forEach(el => track.appendChild(el));
  const set2 = makeSet(); set2.forEach(el => track.appendChild(el));

  // Animasyon
  let x = 0;
  let speed = 0.35; // px/frame
  let last = performance.now();
  function loop(t){
    const dt = Math.min(40, t - last); // zıplamayı azalt
    last = t;
    x -= speed * dt;
    const trackWidth = track.scrollWidth / 2; // bir set uzunluğu
    if (-x >= trackWidth) x += trackWidth;    // başa sar
    track.style.transform = `translateX(${x}px)`;
    req = requestAnimationFrame(loop);
  }
  let req = requestAnimationFrame(loop);

  // Hover olunca dur / devam et
  mount.addEventListener('mouseenter', ()=>{ speed = 0; });
  mount.addEventListener('mouseleave', ()=>{ speed = 0.35; });

  // Rastgele spotlight
  const allTiles = Array.from(track.children);
  setInterval(() => {
    // Mevcut spotlight'ı temizle
    allTiles.forEach(t => t.classList.remove('insta-spot'));
    // Görünür aralıktan birini seç (orta civarı daha hoş)
    const startIdx = Math.max(0, Math.floor(allTiles.length/2) - 6);
    const endIdx   = Math.min(allTiles.length-1, startIdx + 12);
    const pickIdx  = Math.floor(Math.random() * (endIdx - startIdx + 1)) + startIdx;
    const el = allTiles[pickIdx];
    if (!el) return;
    el.classList.add('insta-spot');
    setTimeout(() => el.classList.remove('insta-spot'), 2500);
  }, 3000);
}

// -------------------------------------------------------------
// YouTube – "öneriler" tarzı kompakt grid
//  - Function: /.netlify/functions/youtube (Atom XML)
//  - Fallback: assets/data/youtube.json
//  - LIMIT_YT ile sayıyı kontrol et
// -------------------------------------------------------------
async function initYouTubeCompact(){
  const grid = document.getElementById('ytGrid');
  if (!grid) return;

  // Stil (tek sefer)
  if (!document.getElementById('ytCompactStyles')){
    const css = `
      .yt-grid{ display:grid; gap:12px; grid-template-columns:repeat(6, minmax(0,1fr)); }
      @media (max-width:1400px){ .yt-grid{ grid-template-columns:repeat(5, minmax(0,1fr)); } }
      @media (max-width:1200px){ .yt-grid{ grid-template-columns:repeat(4, minmax(0,1fr)); } }
      @media (max-width:992px){  .yt-grid{ grid-template-columns:repeat(3, minmax(0,1fr)); } }
      @media (max-width:640px){  .yt-grid{ grid-template-columns:repeat(2, minmax(0,1fr)); } }

      .yt-card{ display:block; color:#0f172a; text-decoration:none; }
      .yt-thumb{ position:relative; aspect-ratio:16/9; background:#eef4ff; border-radius:10px; overflow:hidden; }
      .yt-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
      .yt-title{ margin-top:8px; font-weight:700; font-size:13.5px; line-height:1.35;
                 display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      .yt-meta{ margin-top:4px; font-size:12px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    `.trim();
    const s = document.createElement('style');
    s.id = 'ytCompactStyles'; s.textContent = css;
    document.head.appendChild(s);
  }
  grid.classList.add('yt-grid');

  const FEED_URL = '/.netlify/functions/youtube';
  const ATOM_NS  = 'http://www.w3.org/2005/Atom';
  const YT_NS    = 'http://www.youtube.com/xml/schemas/2015';
  const MEDIA_NS = 'http://search.yahoo.com/mrss/';
  const LIMIT_YT = 8; // <<< İstersen 6/10 yapabilirsin

  const relTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diff = Math.max(0, (Date.now() - d.getTime())/1000);
    const t = [
      {s:31536000, n:'yıl'},
      {s:2592000,  n:'ay'},
      {s:604800,   n:'hafta'},
      {s:86400,    n:'gün'},
      {s:3600,     n:'saat'},
      {s:60,       n:'dk'}
    ];
    for (const u of t){
      const v = Math.floor(diff / u.s);
      if (v >= 1) return `${v} ${u.n} önce`;
    }
    return 'az önce';
  };
  const fmtViews = (v) => {
    const n = Number(v||0);
    if (n >= 1_000_000) return (n/1_000_000).toFixed(n%1_000_000?1:0)+' Mn görüntüleme';
    if (n >= 1_000)     return (n/1_000).toFixed(n%1_000?1:0)+' B görüntüleme';
    return n ? `${n} görüntüleme` : '';
  };

  let videos = [];
  try {
    const res  = await fetch(FEED_URL, { cache: 'no-store' });
    const text = await res.text();
    const doc  = new DOMParser().parseFromString(text, 'application/xml');

    const entries = Array.from(doc.getElementsByTagNameNS(ATOM_NS, 'entry'));
    videos = entries.map(e => {
      const idEl     = e.getElementsByTagNameNS(YT_NS,   'videoId')[0];
      const titleEl  = e.getElementsByTagNameNS(ATOM_NS, 'title')[0];
      const pubEl    = e.getElementsByTagNameNS(ATOM_NS, 'published')[0];
      let views = '';
      const community = e.getElementsByTagNameNS(MEDIA_NS, 'community')[0];
      if (community){
        const stat = community.getElementsByTagNameNS(MEDIA_NS, 'statistics')[0];
        if (stat && stat.getAttribute('views')) views = stat.getAttribute('views');
      }
      return {
        id:    idEl    ? idEl.textContent    : '',
        title: titleEl ? titleEl.textContent : 'Video',
        time:  pubEl   ? pubEl.textContent   : '',
        views
      };
    }).filter(v => v.id);
  } catch {
    try{
      const res = await fetch('assets/data/youtube.json', { cache: 'no-store' });
      if (res.ok) {
        const fallback = await res.json();
        videos = (Array.isArray(fallback) ? fallback : []).map(x => ({
          id: x.id, title: x.title||'Video', time: '', views: ''
        }));
      }
    }catch{}
  }

  if (!videos.length){
    videos = [
      { id:'GVHnMUg_GeU', title:'Kedi Sağlığında A Vitamini Sırrı', time:'', views:'' },
      { id:'HBgzBBuwCeY', title:'Soğukta Donan Dostlarımız!',      time:'', views:'' },
      { id:'Y3pWObjTFAw', title:'Pyoderma Nedir?',                  time:'', views:'' },
      { id:'VNVp534lGYw', title:'Kedim Hamile Mi?',                 time:'', views:'' },
      { id:'X4DYXSzqewU', title:'Kedimde Cushing Var mı?',          time:'', views:'' }
    ];
  }

  const pick = videos.slice(0, LIMIT_YT);

  grid.innerHTML = pick.map(v => {
    // CSP uyumlu domain: i.ytimg.com
    const thumb = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
    const url   = `https://www.youtube.com/watch?v=${v.id}`;
    const meta  = [
      'Elçi Veteriner Kliniği',
      fmtViews(v.views),
      v.time ? relTime(v.time) : ''
    ].filter(Boolean).join(' • ');

    return `
      <a class="yt-card" href="${url}" target="_blank" rel="noopener" aria-label="${v.title||'YouTube'}">
        <div class="yt-thumb">
          <img src="${thumb}" alt="${v.title||'YouTube'}" loading="lazy">
        </div>
        <div class="yt-title">${v.title || 'Video'}</div>
        <div class="yt-meta">${meta}</div>
      </a>
    `;
  }).join('');
}

// -------------------------------------------------------------
// Google Yorumları – assets/data/reviews.json
// -------------------------------------------------------------
async function initGoogleReviews(){
  const summaryEl = document.getElementById('ratingSummary');
  const gridEl    = document.getElementById('reviewsGrid');
  if (!summaryEl || !gridEl) return;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const esc = (s='') => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const fmtDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (!isNaN(d)) {
      return d.toLocaleDateString('tr-TR', { year:'numeric', month:'short', day:'2-digit' });
    }
    return ''; // ISO değilse boş; kartta raw metni göstereceğiz
  };

  const makeStars = (rating) => {
    const r = clamp(Number(rating)||0, 0, 5);
    const full = Math.floor(r);
    const half = r - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return [
      ...Array(full).fill('<i class="fa-solid fa-star" aria-hidden="true"></i>'),
      ...Array(half).fill('<i class="fa-solid fa-star-half-stroke" aria-hidden="true"></i>'),
      ...Array(empty).fill('<i class="fa-regular fa-star" aria-hidden="true"></i>')
    ].join('');
  };

  let payload;
  try{
    const res = await fetch('assets/data/reviews.json', { cache:'no-store' });
    if (!res.ok) throw new Error('reviews.json not found');
    payload = await res.json();
  }catch(err){
    summaryEl.style.display = 'none';
    gridEl.style.display = 'none';
    return;
  }

  let reviews = Array.isArray(payload) ? payload : (payload.reviews || []);
  let avg = Array.isArray(payload) ? null : (payload.rating ?? null);
  let total = Array.isArray(payload) ? reviews.length : (payload.count ?? reviews.length);

  if (avg == null) {
    const n = reviews.length || 0;
    avg = n ? (reviews.reduce((a,r)=>a + (Number(r.rating)||0), 0) / n) : 0;
  }
  avg = Math.round(avg * 10) / 10;

  summaryEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-weight:800;font-size:22px">${avg.toFixed(1)} / 5</div>
      <div style="display:flex;gap:3px;font-size:18px;color:#f59e0b" aria-label="${avg} yıldız">
        ${makeStars(avg)}
      </div>
      <div style="color:#6b7280">(${total} yorum)</div>
    </div>
  `;

  const LIMIT = 6;
  const cardHTML = (r) => {
    const stars = makeStars(r.rating);
    const name  = esc(r.author || r.authorName || r.user || 'Ziyaretçi');
    const txt   = esc(r.text || r.comment || r.reviewText || '');
    const rawWhen = r.time || r.date || r.createTime;
    const pretty  = fmtDate(rawWhen);
    const when    = pretty || esc(String(rawWhen || ''));

    const href  = r.link || r.url || '';
    return `
      <article class="review-card" style="background:#fff;border:1px solid #e6eef7;border-radius:12px;padding:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
          <strong style="font-size:15px;color:#0f172a">${name}</strong>
          <span style="color:#6b7280;font-size:12px">${when}</span>
        </div>
        <div style="color:#f59e0b;font-size:16px;margin-bottom:8px">${stars}</div>
        <p style="color:#374151;font-size:15px;line-height:1.5;max-height:6.6em;overflow:hidden">${txt}</p>
        ${href ? `<p style="margin-top:10px"><a class="btn" style="background:#10b3d1;color:#fff;border-radius:10px;padding:8px 12px;font-weight:600;display:inline-block" href="${esc(href)}" target="_blank" rel="noopener">Yorumu Gör</a></p>` : ``}
      </article>
    `;
  };

  gridEl.style.display = 'grid';
  gridEl.style.gridTemplateColumns = 'repeat(3, minmax(0,1fr))';
  gridEl.style.gap = '16px';

  const first = reviews.slice(0, LIMIT);
  gridEl.innerHTML = first.map(cardHTML).join('');

  if (reviews.length > LIMIT) {
    const moreBtn = document.createElement('button');
    moreBtn.textContent = 'Daha Fazla Yorum Göster';
    moreBtn.className = 'btn';
    moreBtn.style.cssText = 'margin-top:16px;background:#6a0ea1;color:#fff;border-radius:10px;padding:10px 14px;font-weight:700';
    moreBtn.addEventListener('click', () => {
      const rest = reviews.slice(LIMIT);
      gridEl.insertAdjacentHTML('beforeend', rest.map(cardHTML).join(''));
      moreBtn.remove();
    });
    gridEl.parentElement.appendChild(moreBtn);
  }
}
