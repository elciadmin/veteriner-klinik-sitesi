/* =======================
   Elçi Veteriner - main.js
   v24
   ======================= */

(function initYear(){
  const y = document.getElementById("yil");
  if (y) y.textContent = new Date().getFullYear();
})();

/* ---------- UTIL ---------- */
function htmlToText(h){
  const d = document.createElement("div");
  d.innerHTML = h || "";
  return d.textContent || d.innerText || "";
}
function fmtTR(d){
  const dt = new Date(d);
  return isNaN(dt) ? "" : dt.toLocaleDateString("tr-TR",{year:"numeric",month:"long",day:"numeric"});
}

/* ---------- BLOG: son 3 yazı ---------- */
(function initBlog(){
  const sec = document.querySelector("#blog");
  const grid = document.getElementById("blogGrid");
  if(!sec || !grid) return;

  const src = sec.getAttribute("data-json") || "/assets/data/blog.json";

  (async () => {
    try{
      const r = await fetch(src,{cache:"no-cache"});
      if(!r.ok) throw new Error("BLOG "+r.status);
      const raw = await r.json();
      const items = Array.isArray(raw) ? raw : (Array.isArray(raw.posts) ? raw.posts : []);
      if(!items.length){ grid.innerHTML = `<div class="muted">Blog içeriği yok.</div>`; return; }

      const posts = items.map(p => ({
        title: p.title || "Başlık Yok",
        date:  p.date  || "",
        excerpt: p.excerpt ?? p.summary ?? (p.content ? htmlToText(p.content).slice(0,160) : ""),
        image: p.image || p.cover || "",
        url:   p.url   || "/blog.html"
      }))
      .sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))
      .slice(0,3);

      grid.innerHTML = posts.map(p => `
        <a class="blog-card" href="${p.url}">
          <div class="blog-thumb">${p.image ? `<img src="${p.image}" alt="${p.title.replace(/"/g,"&quot;")}">` : ""}</div>
          <div class="blog-body">
            <div class="blog-meta">${fmtTR(p.date)}</div>
            <h3 class="blog-title">${p.title}</h3>
            <p class="blog-excerpt">${p.excerpt}</p>
          </div>
        </a>`).join("");
    }catch(e){
      console.warn(e);
      grid.innerHTML = `<div class="muted">Blog verisi yüklenemedi.</div>`;
    }
  })();
})();

/* ---------- INSTAGRAM: sürekli kayma + highlight, function→json fallback ---------- */
(function initInstagram(){
  const sec = document.querySelector("#insta");
  const wrap = document.querySelector(".insta-track-wrap");
  const track = document.getElementById("instaTrack");
  if(!sec || !wrap || !track) return;

  const jsonSrc = sec.getAttribute("data-json");         // /assets/data/instagram.json
  const fnSrc   = sec.getAttribute("data-fn");           // /.netlify/functions/instagram

  const baseDir = "/assets/img/insta/";
  const fallbackImg = baseDir + "sample1.webp";

  const toUrl = (val) => {
    if (!val) return "";
    if (/^https?:\/\//i.test(val) || val.startsWith("/")) return val; // tam URL/absolute path
    return baseDir + val.split("/").pop();                             // sadece dosya adı
  };

  async function loadFn(){
    if (!fnSrc) return [];
    const r = await fetch(fnSrc,{cache:"no-cache"});
    if(!r.ok) return [];
    const data = await r.json();
    const arr = Array.isArray(data) ? data : (data.items || data.data || []);
    return arr.map(x => ({
      thumb: toUrl(x.thumbnail || x.media_url || x.url || x.permalink),
      link : x.permalink || x.link || x.url || "#"
    })).filter(i => i.thumb);
  }

  async function loadJson(){
    if (!jsonSrc) return [];
    const r = await fetch(jsonSrc,{cache:"no-cache"});
    if(!r.ok) return [];
    const arr = await r.json(); // [{file:"xxx.webp"}] veya [{url:"/assets/..."}]
    return arr.map(x => {
      const u = toUrl(x.file || x.url);
      return { thumb: u, link: u };
    }).filter(i => i.thumb);
  }

  function buildItems(items){
    track.innerHTML = items.map(it => `
      <a class="insta-item" href="${it.link}" target="_blank" rel="noopener">
        <img loading="lazy" src="${it.thumb}" alt="Instagram gönderisi"
             onerror="this.onerror=null; this.src='${fallbackImg}'">
      </a>`).join("");
  }

  function enableMarquee(){
    // içerikleri iki kez kopyala -> kesintisiz döngü
    track.innerHTML = track.innerHTML + track.innerHTML;
    let x = 0;
    let speed = 0.3; // px/frame
    let running = true;

    const animate = () => {
      if (!running) return requestAnimationFrame(animate);
      x -= speed;
      const w = track.scrollWidth / 2; // tek set genişliği
      if (-x >= w) x = 0;              // başa sar
      track.style.transform = `translateX(${x}px)`;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    // hover’da durdur / başlat
    wrap.addEventListener("mouseenter", ()=> running = false);
    wrap.addEventListener("mouseleave", ()=> { running = true; requestAnimationFrame(()=>{}); });
  }

  function enableHighlight(){
    let idx = -1;
    setInterval(()=>{
      const els = [...track.querySelectorAll(".insta-item")];
      if(!els.length) return;
      if(idx>=0 && els[idx]) els[idx].classList.remove("highlight");
      idx = Math.floor(Math.random()*Math.min(els.length/2, 50)); // kopyalı setin ilk yarısından seç
      els[idx].classList.add("highlight");
    }, 5000);
  }

  (async () => {
    let items = [];
    try { items = await loadFn(); } catch(_) {}
    if (!items.length) { try { items = await loadJson(); } catch(_) {} }

    if (!items.length){
      track.innerHTML = `<div class="muted">Instagram içeriği bulunamadı.</div>`;
      return;
    }

    // En az 8 görsel yoksa tekrar ederek doldur
    while (items.length < 8) items = items.concat(items);
    items = items.slice(0, 12); // çok uzamasın

    buildItems(items);
    enableMarquee();
    enableHighlight();
  })();
})();

/* ---------- GOOGLE REVIEWS: 8'li, 10sn döngü ---------- */
(function initReviewsRotating(){
  const sec = document.querySelector("#reviews");
  const grid = document.getElementById("reviewGrid");
  if (!sec || !grid) return;

  const src = sec.getAttribute("data-json") || "/assets/data/reviews.json";
  const VISIBLE = 8;          // aynı anda kaç kart
  const INTERVAL = 10000;     // 10 sn
  const ANIM_MS = 500;

  const star = (n=5)=>"★".repeat(Math.round(n)) + "☆".repeat(5-Math.round(n));
  let data = [], ptr = 0, timer = null;

  function cardHTML(r){
    const rating = r.rating ?? r.stars ?? 5;
    const name = r.author_name || r.author || "Ziyaretçi";
    const text = r.text || r.review || "";
    const when = r.relative_time || r.time || "";
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
    for (let i=0;i<Math.min(VISIBLE, data.length);i++){
      slice.push(data[(ptr+i) % data.length]);
    }
    grid.innerHTML = slice.map(cardHTML).join("");
    requestAnimationFrame(()=>{ [...grid.children].forEach(el => el.classList.add("visible")); });
    ptr = (ptr + Math.min(VISIBLE, data.length)) % data.length;
  }

  (async () => {
    try{
      const r = await fetch(src,{cache:"no-cache"});
      if(!r.ok) throw new Error("REVIEWS "+r.status);
      const raw = await r.json();
      data = Array.isArray(raw) ? raw : (raw.reviews || raw.results || []);
      if(!data.length) throw new Error("Boş review listesi");

      renderSlice();
      setInterval(()=>{
        [...grid.children].forEach(el => {
          el.classList.remove("visible");
          el.style.transition = `opacity ${ANIM_MS}ms, transform ${ANIM_MS}ms`;
        });
        setTimeout(renderSlice, ANIM_MS+60);
      }, INTERVAL);
    }catch(e){
      console.warn(e);
      grid.innerHTML = `<div class="muted">Yorumlar yüklenemedi.</div>`;
    }
  })();
})();

/* ---------- YOUTUBE: function -> data-youtube-ids -> local fallback ---------- */
(function initYouTube(){
  const sec = document.querySelector("#youtube");
  const strip = document.getElementById("ytStrip");
  if (!sec || !strip) return;

  const fn = sec.getAttribute("data-fn");
  const idsAttr = (sec.getAttribute("data-youtube-ids") || "").trim();
  const localFallback = "/assets/data/youtube.json"; // opsiyonel: { "videoIds":[... ] }

  async function tryFn(){
    if(!fn) return [];
    const r = await fetch(fn,{cache:"no-cache"});
    if(!r.ok) return [];
    const j = await r.json();
    if (Array.isArray(j)) return j.filter(Boolean);
    if (Array.isArray(j.videoIds)) return j.videoIds.filter(Boolean);
    if (Array.isArray(j.items)) return j.items.map(x=>x.id || x.videoId).filter(Boolean);
    return [];
  }

  async function tryLocal(){
    try{
      const r = await fetch(localFallback,{cache:"no-cache"});
      if(!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j?.videoIds) ? j.videoIds.filter(Boolean) : [];
    }catch{ return []; }
  }

  function render(ids){
    if(!ids.length){
      strip.innerHTML = `<div class="muted">YouTube video bulunamadı.</div>`;
      return;
    }
    const frame = id => `
      <div class="yt-box">
        <iframe loading="lazy"
          src="https://www.youtube-nocookie.com/embed/${id}"
          title="YouTube video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>`;

    let start = 0;
    const paint = () => {
      const view = ids.slice(start, start+3);
      while (view.length < 3 && ids.length > 0) view.push(ids[(view.length+start)%ids.length]);
      strip.innerHTML = view.map(frame).join("");
      start = (start+1) % Math.max(ids.length-2, 1);
    };
    paint();
    setInterval(paint, 7000);
  }

  (async () => {
    let ids = [];
    try { ids = await tryFn(); } catch(_) {}
    if(!ids.length && idsAttr) ids = idsAttr.split(",").map(s=>s.trim()).filter(Boolean);
    if(!ids.length) ids = await tryLocal();
    render(ids);
  })();
})();
