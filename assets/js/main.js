document.addEventListener('DOMContentLoaded', () => {
  /* ==== Mobil Menü ==== */
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mainMenu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const show = menu.classList.toggle('show');
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
    });
    // mobilde dropdown aç/kapa
    document.querySelectorAll('nav .dropdown > a').forEach(a=>{
      a.addEventListener('click', (e)=>{
        if (window.innerWidth <= 992) {
          e.preventDefault();
          a.parentElement.classList.toggle('active');
        }
      });
    });
  }

  /* ==== Blog Kartları (varsa) ==== */
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

  /* ==== About Teaser (varsa) ==== */
  (async function initAboutTeasers(){
    const elciBox = document.querySelector('#elciKimdirCard .content');
    const misyonBox = document.querySelector('#misyonVizyonCard .content');
    if (!elciBox && !misyonBox) return;
    try{
      const res = await fetch('/assets/data/about_teaser.json', { cache:'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (elciBox && data.elci) elciBox.textContent = data.elci;
      if (misyonBox && data.misyon) misyonBox.textContent = data.misyon;
    }catch{}
  })();

  /* ==== Instagram: yavaş akan şerit + duraksama + spotlight ==== */
  (async function initInstagram(){
    const wrap = document.getElementById('instaGrid');
    if (!wrap) return;

    // veri oku
    let files = [];
    try{
      const res = await fetch('/assets/data/instagram.json', { cache: 'no-store' });
      if (res.ok) files = await res.json();
    }catch{}
    if (!Array.isArray(files) || files.length === 0) return;

    // DOM kur
    const track = document.createElement('div');
    track.className = 'insta-track';
    wrap.appendChild(track);

    // Base path (senin yapın)
    const base = '/assets/img/insta/';

    // Her görsel için kart
    files.forEach(name => {
      const item = document.createElement('a');
      item.className = 'insta-item';
      item.href = 'https://www.instagram.com/elcivetklinigi/';
      item.target = '_blank';
      item.rel = 'noopener';
      item.innerHTML = `<img src="${base}${name}" loading="lazy" alt="Instagram">`;
      track.appendChild(item);
    });

    // Akış parametreleri ————————————————
    const SPEED = 0.1;       // px/ms (öncekine göre ~10'da 1 hız)
    const PAUSE_EVERY = 5000; // her 5 sn’de kısa dur
    const PAUSE_MS = 1000;    // 1 sn duraksama
    let lastTime = performance.now();
    let pausedUntil = 0;
    let sincePause = 0;
    let offset = 0;

    // track genişliği (sonsuz akış için kopya)
    const items = Array.from(track.children);
    // Sonsuz akış için bir kez daha kopyala
    items.forEach(el => track.appendChild(el.cloneNode(true)));

    function tick(now){
      const dt = now - lastTime;
      lastTime = now;

      // duraksama yönetimi
      sincePause += dt;
      if (sincePause >= PAUSE_EVERY && now >= pausedUntil){
        pausedUntil = now + PAUSE_MS;
        sincePause = 0;
      }
      const isPaused = now < pausedUntil;

      if (!isPaused){
        offset -= SPEED * dt;
        // bir kartın genişliği kadar sola gittiğinde en sona taşı
        const first = track.firstElementChild;
        if (first){
          const w = first.getBoundingClientRect().width + 10; // gap ~10px
          if (Math.abs(offset) >= w){
            track.appendChild(first);
            offset += w;
          }
        }
        track.style.transform = `translate3d(${offset}px,0,0)`;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Spotlight: her 30 sn’de 10 sn boyunca bir görseli öne çıkar
    function spotlightOnce(){
      const cards = track.querySelectorAll('.insta-item');
      if (cards.length === 0) return;
      const pick = cards[Math.floor(Math.random() * cards.length)];
      pick.classList.add('insta-spot');
      setTimeout(()=>pick.classList.remove('insta-spot'), 10000); // 10 sn
    }
    spotlightOnce();
    setInterval(spotlightOnce, 30000); // 30 sn’de bir tekrar
  })();

  /* ==== YouTube: son videolar (RSS) → 5 görünür, 1’er kay ==== */
  (async function initYouTube(){
    const track = document.getElementById('ytTrack');
    if (!track) return;

    const FEED_URL = '/.netlify/functions/youtube';
    const ATOM_NS = 'http://www.w3.org/2005/Atom';
    const YT_NS   = 'http://www.youtube.com/xml/schemas/2015';

    /** feed → {id,title}[] */
    async function getVideos(){
      try{
        const res  = await fetch(FEED_URL, { cache:'no-store' });
        const text = await res.text();
        const doc  = new DOMParser().parseFromString(text, 'application/xml');
        const entries = Array.from(doc.getElementsByTagNameNS(ATOM_NS, 'entry'));
        let vids = entries.map(e => {
          const idEl    = e.getElementsByTagNameNS(YT_NS, 'videoId')[0];
          const titleEl = e.getElementsByTagNameNS(ATOM_NS, 'title')[0];
          return { id: idEl ? idEl.textContent : '', title: titleEl ? titleEl.textContent : 'Video' };
        }).filter(v => v.id);
        return vids;
      }catch(e){
        // fallback json
        try{
          const r = await fetch('/assets/data/youtube.json', { cache:'no-store' });
          if (r.ok){
            const f = await r.json();
            if (Array.isArray(f)) return f;
          }
        }catch{}
        return [];
      }
    }

    let videos = await getVideos();
    if (!videos.length){
      videos = [
        { id: 'GVHnMUg_GeU', title: 'Kedi Sağlığında A Vitamini Sırrı' },
        { id: 'HBgzBBuwCeY', title: 'Soğukta Donan Dostlarımız!' },
        { id: 'Y3pWObjTFAw', title: 'Pyoderma Nedir?' },
        { id: 'VNVp534lGYw', title: 'Kedim Hamile Mi?' },
        { id: 'X4DYXSzqewU', title: 'Cushing Belirtileri' },
        { id: '5slMn5demTM', title: 'Kedim Üşüyor mu?' }
      ];
    }

    // Kartları üret
    track.innerHTML = videos.map(v=>{
      const thumb = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`; // CSP uyumlu alan adı
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

    // Kaydırma mantığı: 5 görünür, her 6 sn’de 1 ileri (yavaş & sakin)
    const STEP_MS = 6000;
    let startIndex = 0;

    function advance(){
      startIndex = (startIndex + 1) % videos.length;
      const card = track.querySelector('.yt-card');
      if (!card) return;
      const w = card.getBoundingClientRect().width + 12; // gap
      track.style.transform = `translate3d(${-startIndex * w}px,0,0)`;
      // sonsuz akış için: en öndeki kart görünüm dışına çıkınca sona taşı
      // (transform ile yeterli; DOM taşımanıza gerek yok)
    }
    setInterval(advance, STEP_MS);
  })();

  /* ==== Google Reviews: 3’lü kart, 15 sn’de flip ederek yenile ==== */
  (async function initReviews(){
    const grid = document.getElementById('reviewsGrid');
    const summary = document.getElementById('ratingSummary');
    if (!grid || !summary) return;

    // veriyi oku
    let reviews = [];
    try{
      const res = await fetch('/assets/data/reviews.json', { cache:'no-store' });
      if (res.ok) reviews = await res.json();
    }catch{}
    if (!Array.isArray(reviews) || reviews.length === 0) return;

    // ortalama ve toplam
    const avg = (reviews.reduce((a,r)=>a+(Number(r.rating)||0),0) / reviews.length) || 0;
    const avgTxt = avg.toFixed(1);
    summary.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:28px;color:#f59e0b">★</span>
        <strong style="font-size:18px">${avgTxt}</strong>
        <span style="color:#6b7280">/ 5 — ${reviews.length} yorum</span>
      </div>
    `;

    // grid ayarları
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(3,1fr)';
    grid.style.gap = '16px';

    // bir yorumdan kart HTML
    const cardHTML = (r) => `
      <div class="review-card">
        <div class="review-author">${r.author||'Kullanıcı'}</div>
        <div class="review-meta">${'★'.repeat(r.rating||5)} <span style="color:#6b7280">• ${r.time||''}</span></div>
        <div class="review-text">${r.text||''}</div>
      </div>
    `;

    // başlangıç: ilk 3
    let start = 0;
    function render3(from){
      const slice = [];
      for (let i=0;i<3;i++){
        slice.push(reviews[(from + i) % reviews.length]);
      }
      grid.innerHTML = slice.map(cardHTML).join('');
    }
    render3(start);

    // 15 sn’de bir flip animasyonla yenile
    setInterval(()=>{
      // flip out
      grid.querySelectorAll('.review-card').forEach(c=>{
        c.classList.remove('flip-in');
        c.classList.add('flip-out');
      });
      setTimeout(()=>{
        start = (start + 3) % reviews.length;
        render3(start);
        // flip in
        grid.querySelectorAll('.review-card').forEach(c=>{
          c.classList.remove('flip-out');
          c.classList.add('flip-in');
        });
      }, 600); // animasyon süresi ile uyumlu
    }, 15000);
  })();
});
