/* =======================
   Elçi Veteriner - main.js
   v27
   ======================= */

/* ---------- YIL ---------- */
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
function safeAttr(s){ return String(s||"").replace(/"/g,"&quot;"); }
function placeholderImg(){
  return "data:image/svg+xml;utf8,"+encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 68" width="120" height="68">'+
    '<rect width="120" height="68" fill="#eef3f4"/>'+
    '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="#99a6a8">Görsel yok</text>'+
    '</svg>'
  );
}

/* ---------- BLOG ---------- */
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
        <a class="blog-card" href="${safeAttr(p.url)}">
          <div class="blog-thumb">
            ${p.image ? `<img loading="lazy" src="${safeAttr(p.image)}" alt="${safeAttr(p.title)}" onerror="this.src='${placeholderImg()}'">` : ""}
          </div>
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

/* ---------- INSTAGRAM ---------- */
(function initInstagram(){
  const sec = document.querySelector("#insta");
  const track = document.getElementById("instaTrack");
  if(!sec || !track) return;
  const jsonSrc = sec.getAttribute("data-json") || "/assets/data/instagram.json";

  (async () => {
    try{
      const r = await fetch(jsonSrc,{cache:"no-cache"});
      if(!r.ok) throw new Error("INSTA JSON "+r.status);
      const arr = await r.json();
      const items = (Array.isArray(arr) ? arr : []).map(x => {
        const file = (x && x.file) ? String(x.file) : "";
        const path = "/assets/img/uploads/" + file;
        return {thumb: path, link: path};
      }).filter(x => x.thumb);

      if (!items.length){ track.innerHTML = `<div class="muted">Instagram içeriği bulunamadı.</div>`; return; }

      track.innerHTML = items.map(it => `
        <a class="insta-item" href="${safeAttr(it.link)}" target="_blank" rel="noopener">
          <img loading="lazy" src="${safeAttr(it.thumb)}" alt="Instagram gönderisi" onerror="this.src='${placeholderImg()}'">
        </a>`).join("");

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

/* ---------- GOOGLE REVIEWS ---------- */
(function initReviewsRotating(){
  const sec = document.querySelector("#reviews");
  const grid = document.getElementById("reviewGrid");
  if (!sec || !grid) return;

  const src = sec.getAttribute("data-json") || "/assets/data/reviews.json";
  const VISIBLE = 8;
  const INTERVAL = 10000;
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
        <div class="stars">${star(rating)}</div>
        <p>${safeAttr(text)}</p>
        <div class="review-author">${safeAttr(name)}</div>
        <small class="muted">${safeAttr(when)}</small>
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

/* ---------- YOUTUBE ---------- */
(function initYouTube(){
  const sec = document.querySelector("#youtube");
  const strip = document.getElementById("ytStrip");
  if (!sec || !strip) return;

  const idsAttr = sec.getAttribute("data-youtube-ids") || "";
  const ids = idsAttr.split(",").map(s=>s.trim()).filter(Boolean);

  function renderThree(arr){
    strip.innerHTML = arr.map(v => `
      <div class="yt-box">
        <iframe loading="lazy"
          src="https://www.youtube-nocookie.com/embed/${safeAttr(v)}"
          title="YouTube video"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen></iframe>
      </div>`).join("");
  }

  if(!ids.length){
    strip.innerHTML = `<div class="muted">YouTube video bulunamadı. data-youtube-ids kontrol edin.</div>`;
    return;
  }

  let p = 0;
  const windowSize = Math.min(3, ids.length);
  renderThree(ids.slice(p, p+windowSize));

  setInterval(()=>{
    if (ids.length <= windowSize) return;
    p = (p + 1) % (ids.length - windowSize + 1);
    renderThree(ids.slice(p, p+windowSize));
  }, 7000);
})();
