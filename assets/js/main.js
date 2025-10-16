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

// ESKİ: const res = await fetch('assets/data/instagram.json', { cache: 'no-store' });
const res = await fetch('/assets/data/instagram.json', { cache: 'no-store' });

// ESKİ: const base = 'assets/img/insta/';
const base = '/assets/img/insta/';


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
