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

  /* === YouTube: son 4–5 videoyu otomatik çek === */
(async function initYouTube(){
  const grid = document.getElementById('ytGrid');
  if (!grid) return;

  const CHANNEL_ID = 'UCj2kiAEEF2LyKko9P78RGPQ'; // Elçi Veteriner Kliniği
  const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  // 1) RSS'ten çekmeyi dene (API KEY gereksiz)
  let videos = [];
  try {
    const res = await fetch(FEED_URL, { cache: 'no-store' });
    const text = await res.text();
    // Bazı tarayıcılarda CORS olabilir — try/catch ile koruduk
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const entries = Array.from(doc.getElementsByTagName('entry'));
    videos = entries.map(e => {
      const titleEl = e.getElementsByTagName('title')[0];
      const idEl    = e.getElementsByTagName('yt:videoId')[0] || e.getElementsByTagName('videoId')[0];
      return {
        id: idEl ? idEl.textContent : '',
        title: titleEl ? titleEl.textContent : 'Video'
      };
    }).filter(v => v.id);
  } catch (err) {
    // sessiz geç → json yedeğe düşeceğiz
  }

  // 2) Eğer RSS başarısızsa, yerel JSON yedeğini dene
  if (!Array.isArray(videos) || videos.length === 0) {
    try{
      const res = await fetch('assets/data/youtube.json', { cache: 'no-store' });
      if (res.ok) {
        const fallback = await res.json();
        videos = Array.isArray(fallback) ? fallback : [];
      }
    }catch{}
  }

  // 3) Hâlâ yoksa örneklerle doldur (tamamen görsel amaçlı)
  if (!Array.isArray(videos) || videos.length === 0){
    videos = [
      { id: 'dQw4w9WgXcQ', title: 'Örnek Video 1' },
      { id: 'oHg5SJYRHA0', title: 'Örnek Video 2' },
      { id: '9bZkp7q19f0', title: 'Örnek Video 3' },
      { id: '3JZ_D3ELwOQ', title: 'Örnek Video 4' },
      { id: 'kXYiU_JCYtU', title: 'Örnek Video 5' }
    ];
  }

  const limit = 5; // 4–5 göster
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

