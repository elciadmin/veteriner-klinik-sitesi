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

  /* === Hakkımızda özet (varsa) === */
  (function initAboutTeasers(){
    const elci = document.querySelector('#elciKimdirCard .content');
    const mis  = document.querySelector('#misyonVizyonCard .content');
    if (elci) elci.textContent = 'Elçi Veteriner, etik ve şeffaf yaklaşımıyla Meram/Konya’da 7/24 güvenilir klinik hizmeti sunar.';
    if (mis)  mis.textContent  = 'Misyonumuz; doğru tanı, hızlı tedavi ve sevgi dolu bir bakım. Vizyonumuz; bölgenin referans kliniği olmak.';
  })();

  /* === INSTAGRAM: yavaş akan şerit + spotlight === */
  (async function initInstagram(){
    const wrap = document.getElementById('instaGrid');
    if (!wrap) return;

    const base = '/assets/img/insta/';
    let items = [];
    try{
      const res = await fetch('/assets/data/instagram.json', { cache: 'no-store' });
      if (res.ok) items = await res.json();
    }catch{}
    if (!Array.isArray(items) || items.length === 0) return;

    // track HTML
    const track = document.createElement('div');
    track.className = 'insta-track';
    // iki kez çoğalt (sonsuz akış)
    const all = [...items, ...items].map(name => `
      <a class="insta-item" href="https://www.instagram.com/elcivetklinigi/" target="_blank" rel="noopener">
        <img loading="lazy" src="${base}${name}" alt="Instagram görseli">
      </a>
    `).join('');
    track.innerHTML = all;
    wrap.innerHTML = '';
    wrap.appendChild(track);

    // akış: hız yarıya indirildi
    const PX_PER_SEC = 25; // önceki ~50 ise yarı hız
    let x = 0;
    let lastTs = performance.now();
    const trackWidth = () => track.scrollWidth / 2; // tek kopya genişliği
    function tick(ts){
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      x -= PX_PER_SEC * dt;
      const width = trackWidth();
      if (Math.abs(x) > width) x += width; // loop
      track.style.transform = `translateX(${x}px)`;
      raf = requestAnimationFrame(tick);
    }
    let raf = requestAnimationFrame(tick);

    // 2 sn'lik minik duraksamalar (her 12 sn'de bir)
    setInterval(()=>{
      cancelAnimationFrame(raf);
      setTimeout(()=>{ lastTs = performance.now(); raf = requestAnimationFrame(tick); }, 2000);
    }, 12000);

    // 30 sn’de bir 10 sn spotlight
    function runSpotlight(){
      const cards = track.querySelectorAll('.insta-item');
      if (!cards.length) return;
      // ekranda orta bölgeye yakın kartlardan seç (daha görünür)
      const idx = Math.floor(Math.random() * Math.min(cards.length, 8));
      const c = cards[idx];
      c.classList.add('insta-spot');
      setTimeout(()=> c.classList.remove('insta-spot'), 10000);
    }
    runSpotlight();
    setInterval(runSpotlight, 30000);
  })();

  /* === YouTube: otomatik çek + büyük kart + yavaş slider (4 görünür) === */
  (async function initYouTube(){
    const track = document.getElementById('ytTrack');
    if (!track) return;

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
        if (res.ok) videos = await res.json();
      }catch{}
    }

    if (!Array.isArray(videos) || videos.length === 0){
      videos = [
        { id: 'GVHnMUg_GeU', title: 'Kedi Sağlığında A Vitamini' },
        { id: 'HBgzBBuwCeY', title: 'Soğukta Donan Dostlarımız' },
        { id: 'Y3pWObjTFAw', title: 'Pyoderma Nedir?' },
        { id: 'VNVp534lGYw', title: 'Kedim Hamile Mi?' },
        { id: 'X4DYXSzqewU', title: 'Cushing Sendromu' }
      ];
    }

    // render
    track.innerHTML = videos.map(v => {
      const thumb = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
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

    // yavaş slider: 4 görünür, her 6 sn’de bir 1 adım
    let start = 0;
    const step = 1;
    const view = 4;
    function applySlide(){
      const card = track.querySelector('.yt-card');
      if (!card) return;
      const gap = 14; // CSS ile aynı
      const cardW = card.getBoundingClientRect().width;
      const shift = start * (cardW + gap);
      track.style.transform = `translateX(${-shift}px)`;
    }
    applySlide();
    setInterval(()=>{
      if (videos.length <= view) return;
      start = (start + step) % (videos.length - view + 1);
      applySlide();
    }, 6000);
  })();

  /* === Google Reviews: büyük kart + sayfa sayfa fade === */
  (async function initReviews(){
    const sumEl = document.getElementById('ratingSummary');
    const grid  = document.getElementById('reviewsGrid');
    if (!sumEl || !grid) return;

    let data = [];
    try{
      const res = await fetch('/assets/data/reviews.json', { cache: 'no-store' });
      if (res.ok) data = await res.json();
    }catch{}
    if (!Array.isArray(data) || data.length === 0) return;

    // Özet: sadece yıldız ve puan (toplam sayıyı kaldırdık)
    sumEl.innerHTML = `
      <span class="stars" aria-hidden="true">★★★★★</span>
      <span class="score">5.0 / 5</span>
    `;

    // Kartları 3'lü sayfalar halinde göster
    const pageSize = 3;
    let page = 0;

    function renderPage(){
      const start = page * pageSize;
      const slice = data.slice(start, start + pageSize);
      if (slice.length < pageSize && start !== 0) {
        // sona yaklaştıysak baştan tamamla
        slice.push(...data.slice(0, pageSize - slice.length));
      }
      grid.innerHTML = slice.map(r => `
        <article class="review-card">
          <div class="review-author">${r.author||''}</div>
          <div class="review-meta"><span class="stars" aria-hidden="true">★★★★★</span> · ${r.time||''}</div>
          <div class="review-text">${r.text||''}</div>
        </article>
      `).join('');
      requestAnimationFrame(()=>{
        grid.querySelectorAll('.review-card').forEach(c => c.classList.add('show'));
      });
    }

    renderPage();
    setInterval(()=>{
      // yumuşak çıkış
      grid.querySelectorAll('.review-card').forEach(c => c.classList.remove('show'));
      setTimeout(()=>{
        page = (page + 1) % Math.ceil(data.length / pageSize);
        renderPage();
      }, 500); // fade-out süresi
    }, 15000);
  })();

});
