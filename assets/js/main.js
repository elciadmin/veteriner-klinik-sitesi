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

  /* === Instagram: akan şerit, kare görüntü === */
  (async function initInstaMarquee() {
    const grid = document.getElementById('instaGrid');
    if (!grid) return;

    let items = [];
    try {
      const res = await fetch('assets/data/instagram.json', { cache: 'no-store' });
      if (res.ok) items = await res.json();
    } catch (e) {}

    if (!Array.isArray(items) || items.length === 0) return;

    const base = 'assets/img/insta/';
    const slice = items.slice(0, 24); // bir anda çok yüklenmesin

    const track = document.createElement('div');
    track.className = 'insta-track';
    const render = (arr) => arr.map(({file, alt}, i) => `
      <a class="insta-item" href="https://www.instagram.com/elcivetklinigi/" target="_blank" rel="noopener"
         aria-label="Instagram fotoğrafı ${i+1}">
        <img src="${base}${file}" alt="${alt || 'Elçi Veteriner'}" loading="lazy" onerror="this.remove()">
      </a>
    `).join('');

    track.innerHTML = render(slice) + render(slice); // kesintisiz döngü için iki kopya
    grid.innerHTML = '';
    grid.appendChild(track);

    // Akış animasyonu
    let pos = 0;
    let speed = 0.6; // akış hızı (0.4–0.8 arası ideal)
    let singleWidth = track.scrollWidth / 2;

    const step = () => {
      pos -= speed;
      if (-pos >= singleWidth) pos = 0;
      track.style.transform = `translateX(${pos}px)`;
      requestAnimationFrame(step);
    };

    const ro = new ResizeObserver(() => { singleWidth = track.scrollWidth / 2; });
    ro.observe(track);
    requestAnimationFrame(step);
  })();

  /* === Blog kartları (varsa) === */
  (async function initBlog(){
    const grid = document.getElementById('blogGrid');
    if (!grid) return;
    try{
      const res = await fetch('assets/data/blog.json', { cache: 'no-store' });
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
/* === YouTube: son 4–5 videoyu otomatik çek (Netlify proxy ile CORS yok) === */
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

    // Namespace'li Atom feed: entry ve yt:videoId doğru namespace ile okunmalı
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
