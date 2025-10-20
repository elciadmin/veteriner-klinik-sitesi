/* =======================
   Elçi Veteriner - main.js
   v19 (index ile uyumlu)
   ======================= */

/* ---------- Yıl ---------- */
(function initYear(){
  const y = document.getElementById("yil");
  if (y) y.textContent = new Date().getFullYear();
})();

/* ---------- Küçük yardımcılar ---------- */
function htmlToText(h){
  const d = document.createElement("div");
  d.innerHTML = h || "";
  return d.textContent || d.innerText || "";
}
function fmtTR(dateLike){
  const dt = new Date(dateLike);
  return isNaN(dt) ? "" : dt.toLocaleDateString("tr-TR",{year:"numeric",month:"long",day:"numeric"});
}

/* ========================================
   BLOG (Ana sayfa “Blogdan” kutusu)
   Not: index’te ayrıca bir “fallback” var.
   ======================================== */
(function initBlog(){
  const sec  = document.querySelector("#blog");
  const grid = document.getElementById("blogGrid");
  if (!sec || !grid) return;                     // sayfada yoksa atla
  if (grid.dataset.filled === "1") return;       // index fallback zaten yazmışsa

  const src = sec.getAttribute("data-json") || "/assets/data/blog.json";

  (async () => {
    try{
      const r = await fetch(src,{cache:"no-cache"});
      if (!r.ok) throw new Error("BLOG "+r.status);
      const raw = await r.json();
      const items = Array.isArray(raw) ? raw : (Array.isArray(raw.posts) ? raw.posts : []);
      if (!items.length) { grid.innerHTML = `<div class="muted">Blog içeriği yok.</div>`; return; }

      const posts = items.map(p => ({
        title:   p.title || "Başlık Yok",
        date:    p.date  || "",
        excerpt: p.excerpt ?? p.summary ?? (p.content ? htmlToText(p.content).slice(0,160) : ""),
        image:   p.image || p.cover || "",
        url:     p.url   || "/blog.html"
      }))
      .sort((a,b)=> new Date(b.date||0) - new Date(a.date||0))
      .slice(0,3);

      grid.innerHTML = posts.map(p => `
        <a class="blog-card" href="${p.url}">
          <div class="blog-thumb">${p.image ? `<img src="${p.image}" alt="${p.title.replace(/"/g,"&quot;")}">` : ""}</div>
          <div class="blog-body">
            <div class="blog-meta">${fmtTR(p.date)}</div>
            <h3 class="blog-title">${p.title}</h3>
            <p class="blog-excerpt">${p.excerpt}</p>
          </div>
        </a>
      `).join("");

      grid.dataset.filled = "1";
    }catch(e){
      // Sessiz kal; index’teki fallback devreye girer.
      console.warn("[BLOG] Yüklenemedi:", e.message);
    }
  })();
})();

/* ========================================
   INSTAGRAM (json veya function)
   - Önce function (data-fn), düşerse data-json
   - Öne çıkarma etkisi: tüm kart (.insta-item)
   ======================================== */
(function initInstagram(){
  const sec   = document.querySelector("#insta");
  const track = document.getElementById("instaTrack");
  if (!sec || !track) return;

  const jsonSrc = sec.getAttribute("data-json"); // /assets/data/instagram.json
  const fnSrc   = sec.getAttribute("data-fn");   // /.netlify/functions/instagram

  async function loadFromFn(){
    const r = await fetch(fnSrc, {cache:"no-cache"});
    if (!r.ok) throw new Error("INSTA_FN "+r.status);
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data.items || []);
    // Beklenen alanlar: thumbnail/media_url/permalink/url
    return arr.map(x => ({
      thumb: x.thumbnail || x.media_url || x.url,
      link:  x.permalink || x.link || x.url || "#"
    })).filter(x => x.thumb);
  }

  async function loadFromJson(){
    const r = await fetch(jsonSrc, {cache:"no-cache"});
    if (!r.ok) throw new Error("INSTA_JSON "+r.status);
    const data = await r.json(); // [{file:"xxx.webp"}]
    return (Array.isArray(data) ? data : []).map(x => ({
      thumb: "/assets/img/insta/" + x.file,
      link:  "/assets/img/insta/" + x.file
    }));
  }

  (async () => {
    try{
      let items = [];
      if (fnSrc) {
        try { items = await loadFromFn(); } catch(e){ console.warn(e.message); }
      }
      if ((!items || !items.length) && jsonSrc) {
        items = await loadFromJson();
      }

      if (!items.length){
        track.innerHTML = `<div class="muted">Instagram içeriği bulunamadı.</div>`;
        return;
      }

      // Kartları bas
      track.innerHTML = items.map(it => `
        <a class="insta-item" href="${it.link}" target="_blank" rel="noopener">
          <img loading="lazy" src="${it.thumb}" alt="Instagram gönderisi">
        </a>
      `).join("");

      // Rastgele “highlight” döngüsü (tüm kart büyür)
      let idx = -1;
      setInterval(()=>{
        const els = track.querySelectorAll(".insta-item");
        if (!els.length) return;
        if (idx >= 0 && els[idx]) els[idx].classList.remove("highlight");
        idx = Math.floor(Math.random()*els.length);
        els[idx].classList.add("highlight");
      }, 5000);
    }catch(e){
      console.warn("[INSTA] Yüklenemedi:", e.message);
      track.innerHTML = `<div class="muted">Instagram yüklenemedi.</div>`;
    }
  })();
})();

/* ========================================
   GOOGLE REVIEWS (8’li, 10 sn’de bir yenile)
   Kaynak: section#reviews data-json="/assets/data/reviews.json"
   ======================================== */
(function initReviewsRotating(){
  const sec  = document.querySelector("#reviews");
  const grid = document.getElementById("reviewGrid");
  if (!sec || !grid) return;

  const src      = sec.getAttribute("data-json") || "/assets/data/reviews.json";
  const VISIBLE  = 8;
  const INTERVAL = 10000; // 10 sn
  const ANIM_MS  = 500;

  const star = (n=5)=>"★".repeat(Math.round(n)) + "☆".repeat(5-Math.round(n));
  let data = [], ptr = 0, timer = null;

  function cardHTML(r){
    const rating = r.rating ?? r.stars ?? 5;
    const name   = r.author_name || r.author || "Ziyaretçi";
    const text   = r.text || r.review || "";
    const when   = r.relative_time || r.time || "";
    return `
      <div class="review-card">
        <div class="stars" aria-hidden="true">${star(rating)}</div>
        <p>${text}</p>
        <div class="review-author">${name}</div>
        <small class="muted">${when}</small>
      </div>`;
  }

  function renderSlice(){
    const slice = [];
    const count = Math.min(VISIBLE, data.length);
    for (let i=0;i<count;i++){
      slice.push(data[(ptr+i) % data.length]);
    }
    grid.innerHTML = slice.map(cardHTML).join("");
    requestAnimationFrame(()=>{ [...grid.children].forEach(el => el.classList.add("visible")); });
    ptr = (ptr + count) % data.length;
  }

  (async () => {
    try{
      const r = await fetch(src,{cache:"no-cache"});
      if (!r.ok) throw new Error("REVIEWS "+r.status);
      const raw = await r.json();
      data = Array.isArray(raw) ? raw : (raw.reviews || raw.results || []);
      if (!data.length) throw new Error("Boş review listesi");

      // İlk render
      renderSlice();

      // Döngü
      timer = setInterval(()=>{
        [...grid.children].forEach(el => {
          el.classList.remove("visible");
          el.style.transition = `opacity ${ANIM_MS}ms, transform ${ANIM_MS}ms`;
        });
        setTimeout(renderSlice, ANIM_MS+60);
      }, INTERVAL);
    }catch(e){
      console.warn("[REVIEWS] Yüklenemedi:", e.message);
      grid.innerHTML = `<div class="muted">Yorumlar yüklenemedi.</div>`;
    }
  })();
})();

/* ========================================
   YOUTUBE
   - Sadece function’dan (data-fn) doldurur.
   - Function başarısızsa RASTGELE veya başka kanal doldurmaz.
   ======================================== */
(function initYouTube(){
  const sec   = document.querySelector("#youtube");
  const strip = document.getElementById("ytStrip");
  if (!sec || !strip) return;

  const fn = sec.getAttribute("data-fn"); // /.netlify/functions/youtube-latest?limit=9
  if (!fn){
    strip.innerHTML = `<div class="muted">YouTube yapılandırması eksik.</div>`;
    return;
  }

  async function loadFn(){
    const r = await fetch(fn,{cache:"no-cache"});
    if (!r.ok) throw new Error("YTFN "+r.status);
    const j = await r.json();
    // Beklenen formatlar:
    // - { videoIds: ["abc","def",...] }
    // - [{id:"abc"}, {videoId:"def"}]
    // - { items: [{id:"abc"},{videoId:"def"}] }
    if (Array.isArray(j)) {
      return j.map(x => x.id || x.videoId).filter(Boolean);
    } else if (j && Array.isArray(j.videoIds)) {
      return j.videoIds.filter(Boolean);
    } else if (j && Array.isArray(j.items)) {
      return j.items.map(x => x.id || x.videoId).filter(Boolean);
    }
    return [];
  }

  function paint(ids){
    if (!ids.length){
      strip.innerHTML = `<div class="muted">YouTube video bulunamadı. Function’ı kontrol edin.</div>`;
      return;
    }
    // İlk 3’ü bas
    const render3 = arr => arr.slice(0,3).map(v => `
      <div class="yt-box">
        <iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${v}"
          title="YouTube video"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen></iframe>
      </div>`).join("");

    strip.innerHTML = render3(ids);

    // 7 sn’de bir kaydır (2-3-4…)
    let p = 0;
    const maxShift = Math.max(ids.length - 2, 1);
    setInterval(()=>{
      p = (p + 1) % maxShift;
      const next3 = ids.slice(p, p+3);
      strip.innerHTML = render3(next3);
    }, 7000);
  }

  (async () => {
    try{
      const ids = await loadFn();
      // Sadece function’dan gelenleri kullan; boşsa sessizce mesaj ver.
      paint(ids);
    }catch(e){
      console.warn("[YOUTUBE] Function hatası:", e.message);
      strip.innerHTML = `<div class="muted">YouTube videosu yüklenemedi.</div>`;
    }
  })();
})();
