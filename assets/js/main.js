// -------------------------------------------------------------
// Elçi Veteriner - Ana JS
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initDropdownTouch();
  initBlog();
  initInstagram();
  initYouTube();
  initGoogleReviews();
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
    // Dropdownları da mobilde tıklayınca aç
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
  // iOS/Android dokunuşta :hover yerine class ver
  const drops = document.querySelectorAll('.dropdown');
  drops.forEach(d => {
    d.addEventListener('touchstart', () => d.classList.add('active'), {passive:true});
    d.addEventListener('touchend',   () => d.classList.remove('active'), {passive:true});
  });
}

// -------------------------------------------------------------
// Blog (assets/data/blog.json)
// -------------------------------------------------------------
async function initBlog(){
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  try{
    const res = await fetch('/assets/data/blog.json', { cache: 'no-store' });
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
  }catch(e){
    // sessiz geç
  }
}

// -------------------------------------------------------------
// Instagram – akış: JSON + dönen ızgara
//  - JSON: /assets/data/instagram.json  → [{file:"..."}]
//  - Görsel yolu: /assets/img/insta/<dosya>
//  - 2 satır x 5 kolon göster, her 3 saniyede bir görseli değiştir (akış efekti)
// -------------------------------------------------------------
async function initInstagram(){
  const grid = document.getElementById('instaGrid');
  if (!grid) return;

  // Grid düzenini güvenceye almak için (eğer CSS'te yoksa)
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(5, 1fr)'; // 5 kolon
  grid.style.gap = '10px';

  let list = [];
  try{
    const res = await fetch('/assets/data/instagram.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;
    list = data.map(x => String(x.file)).filter(Boolean);
  }catch(e){ return; }

  if (list.length === 0) return;

  const base = '/assets/img/insta/'; // Eğer uploads/insta ise: '/assets/img/uploads/insta/'

  // İlk çizim: 10 görsel (2 satır x 5 kolon)
  const SLOT_COUNT = Math.min(10, list.length);
  let idx = 0;
  const next = () => { const i = idx % list.length; idx++; return list[i]; };

  const slots = [];
  for (let i=0; i<SLOT_COUNT; i++){
    const file = next();
    const el = document.createElement('a');
    el.href = `${base}${file}`;
    el.target = '_blank';
    el.rel = 'noopener';
    el.className = 'insta-item';
    el.style.cssText = `
      position:relative;display:block;border-radius:10px;overflow:hidden;
      aspect-ratio: 1 / 1; background:#eef4ff; border:1px solid #e6eef7
    `;
    el.innerHTML = `<img src="${base}${file}" alt="Instagram" loading="lazy"
      style="width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s">`;
    el.addEventListener('mouseenter', ()=>{ el.firstElementChild.style.transform='scale(1.04)'; });
    el.addEventListener('mouseleave', ()=>{ el.firstElementChild.style.transform='scale(1)'; });
    grid.appendChild(el);
    slots.push(el);
  }

  // Akış efekti: her 3s'de bir slotu yeni görselle değiştir
  let rot = 0;
  setInterval(() => {
    if (list.length <= SLOT_COUNT) return; // yeterli çeşit yoksa dönme
    const target = slots[rot % SLOT_COUNT];
    const file = next();
    const img = target.querySelector('img');
    img.src = `${base}${file}`;
    rot++;
  }, 3000);
}

// -------------------------------------------------------------
// YouTube – son 4–5 video (Netlify Function proxy)
//  - Function: /.netlify/functions/youtube  → XML Atom feed
//  - Kartlar: #ytGrid içine
// -------------------------------------------------------------
async function initYouTube(){
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

    // Namespace'li Atom feed
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
    // RSS okunamadı → JSON yedeğine düş
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

  // Basit kart stili (gerekirse CSS'e taşıyabilirsin)
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(5, minmax(0,1fr))';
  grid.style.gap = '12px';

  grid.innerHTML = pick.map(v => {
    const thumb = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
    const url   = `https://www.youtube.com/watch?v=${v.id}`;
    return `
      <article class="yt-card" style="background:#fff;border:1px solid #e6eef7;border-radius:12px;overflow:hidden;box-shadow:0 6px 16px rgba(15,23,42,.06)">
        <a class="yt-thumb" href="${url}" target="_blank" rel="noopener" aria-label="${v.title||'YouTube'}" style="display:block;aspect-ratio:16/9;background:#eef4ff">
          <img src="${thumb}" alt="${v.title||'YouTube'}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">
        </a>
        <div class="yt-body" style="padding:10px">
          <div class="yt-title" style="font-weight:700;color:#0f172a;font-size:14px;line-height:1.3">${v.title || 'Video'}</div>
        </div>
      </article>
    `;
  }).join('');
}

// -------------------------------------------------------------
// Google Yorumları – yerel JSON (veteriner-klinik-sitesi/assets/data/reviews.json)
//  - Bölüm: #ratingSummary ve #reviewsGrid
// -------------------------------------------------------------
async function initGoogleReviews(){
  const summaryEl = document.getElementById('ratingSummary');
  const gridEl    = document.getElementById('reviewsGrid');
  if (!summaryEl || !gridEl) return;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const esc = (s='') => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const fmtDate = (isoOrTs) => {
    if (!isoOrTs) return '';
    const d = new Date(isoOrTs);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('tr-TR', { year:'numeric', month:'short', day:'2-digit' });
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

  // JSON yolu (senin verdiğin)
  let payload;
  try{
    const res = await fetch('/assets/data/reviews.json', { cache:'no-store' });
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
    const when  = fmtDate(r.time || r.date || r.createTime);
    const href  = r.link || r.url || '';
    return `
      <article class="review-card" style="background:#fff;border:1px solid #e6eef7;border-radius:12px;padding:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
          <strong style="font-size:15px;color:#0f172a">${name}</strong>
          <span style="color:#6b7280;font-size:12px">${when||''}</span>
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
