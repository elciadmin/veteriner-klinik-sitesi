/* =======================
   Elçi Veteriner - main.js
   v26
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

/* ---------- INSTAGRAM: json veya function, highlight döngüsü ---------- */
(function initInstagram(){
  const sec = document.querySelector("#insta");
  const track = document.getElementById("instaTrack");
  if(!sec || !track) return;

  const jsonSrc = sec.getAttribute("data-json");
  const fnSrc   = sec.getAttribute("data-fn");

  const fileToUrl = (file) => {
    if (!file) return "";
    // absolute (zaten / ile başlıyorsa) dokunma, değilse uploads klasörünü kullan
    return file.startsWith("/") ? file : "/assets/img/uploads/" + file;
  };

  async function loadLocal(){
    const r = await fetch(jsonSrc,{cache:"no-cache"});
    if(!r.ok) throw new Error("INSTA JSON "+r.status);
    const arr = await r.json(); // [{file:"xxx.webp"}]
    return arr.map(x => {
      const url = fileToUrl(x.file);
      return { thumb: url, link: url };
    });
  }
  async function loadFn(){
    const r = await fetch(fnSrc,{cache:"no-cache"});
    if(!r.ok) throw new Error("INSTA FN "+r.status);
    const data = await r.json(); // beklenen: [{thumbnail,url}] benzeri
    return (Array.isArray(data)?data:(data.items||[])).map(x => ({
      thumb: x.thumbnail || x.media_url || x.url,
      link:  x.permalink || x.link || x.url || "#"
    }));
  }

  (async () => {
    try{
      let items = [];
      if (fnSrc) {
        try { items = await loadFn(); } catch(_) { /* düşerse json'a geç */ }
      }
      if (!items.length && jsonSrc) items = await loadLocal();

      if (!items.length){ track.innerHTML = `<div class="muted">Instagram içeriği bulunamadı.</div>`; return; }

      track.innerHTML = items.map(it => `
        <a class="insta-item" href="${it.link}" target="_blank" rel="noopener">
          <img loading="lazy" src="${it.thumb}" alt="Instagram gönderisi">
        </a>`).join("");

      // Highlight döngüsü (tüm kart)
      let idx = -1;
      setInterval(()=>{
        const els = [...track.querySelectorAll(".insta-item")];
        if(!els.length) return;
        if(idx>=0 && els[idx]) els[idx].classList.remove("highlight");
        idx = Math.floor(Math.random()*els.length);
        els[idx].classList.add("highlight");
      }, 5000);
    }catch(e){
      console.warn(e);
      track.innerHTML = `<div class="muted">Instagram yüklenemedi.</div>`;
    }
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
  let data = [], ptr = 0;

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

/* ---------- YOUTUBE: SADECE data-youtube-ids (modest branding + rel=0) ---------- */
(function initYouTube(){
  const sec = document.querySelector("#youtube");
  const strip = document.getElementById("ytStrip");
  if (!sec || !strip) return;

  const idsAttr = (sec.getAttribute("data-youtube-ids") || "").trim();

  function embedURL(id){
    // rel=0 -> aynı kanaldan öneriler; modestbranding: YouTube logosu minimal
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&iv_load_policy=3&color=white&playsinline=1`;
  }

  function render(ids){
    if(!ids.length){
      strip.innerHTML = `<div class="muted">YouTube video bulunamadı.</div>`;
      return;
    }
    const tpl = (arr)=> arr.map(v => `
      <div class="yt-box">
        <iframe loading="lazy"
          src="${embedURL(v)}"
          title="YouTube video"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>`).join("");

    strip.innerHTML = tpl(ids.slice(0,3));

    let p = 0;
    setInterval(()=>{
      p = (p+1) % Math.max(ids.length-2,1);
      strip.innerHTML = tpl(ids.slice(p, p+3));
    }, 7000);
  }

  try{
    const ids = idsAttr ? idsAttr.split(",").map(s=>s.trim()).filter(Boolean) : [];
    render(ids);
  }catch(e){
    console.warn(e);
    render([]);
  }
})();
