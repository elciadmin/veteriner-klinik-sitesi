/* =========================================================================
   Elçi Veteriner — Ana JS (v17)
   - Header: mobil menü + aktif link
   - Services: scroll-in animasyon + sayfalama (gerekirse)
   - Instagram: yavaş şerit + rastgele highlight (json/fn fallback)
   - Google Yorumları: 8’li rotator
   - YouTube: 3’lü şerit, 7 sn’de 2-3-4
   ======================================================================== */
(function () {
  "use strict";

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  async function fetchJSON(url){
    try{
      const res = await fetch(url, {cache:"no-cache"});
      if(!res.ok) throw new Error("HTTP "+res.status);
      return await res.json();
    }catch(e){
      console.warn("fetchJSON fail:", url, e.message);
      return null;
    }
  }

  // ---- YIL
  const yilEl = $("#yil");
  if (yilEl) yilEl.textContent = new Date().getFullYear();

  // ---- HEADER: mobil menü + aktif link
  (function initHeader(){
    const btn = $("#mobileMenuBtn");
    const menu = $("#mainMenu");
    btn && btn.addEventListener("click", ()=> menu.classList.toggle("show"));

    // Mobilde dropdown click ile aç/kapa + aria
    $$("#mainMenu .dropdown > a").forEach(a=>{
      a.addEventListener("click", e=>{
        if(window.innerWidth<=992){
          e.preventDefault();
          const li = a.parentElement;
          const open = li.classList.toggle("active");
          a.setAttribute("aria-expanded", open ? "true":"false");
        }
      });
      // Masaüstü hover aria
      a.parentElement.addEventListener("mouseenter",()=>{ if(window.innerWidth>992) a.setAttribute("aria-expanded","true"); });
      a.parentElement.addEventListener("mouseleave",()=>{ if(window.innerWidth>992) a.setAttribute("aria-expanded","false"); });
    });

    // Aktif link
    const current = (location.pathname.split('/').pop() || "index.html").toLowerCase();
    $$("nav a").forEach(link=>{
      const href = (link.getAttribute("href")||"").split("?")[0].toLowerCase();
      if(href.endsWith(current)) link.classList.add("active");
    });
  })();

  // ---- SERVICES: scroll-in
  (function initServicesIn(){
    const cards = $$("#servicesGrid .s-card");
    if(!cards.length) return;
    if(!("IntersectionObserver" in window)){ cards.forEach(c=>c.classList.add("show")); return; }
    const io = new IntersectionObserver((entries)=>{
      entries.forEach((e,i)=>{
        if(e.isIntersecting){
          setTimeout(()=> e.target.classList.add("show"), (i%3)*80);
          io.unobserve(e.target);
        }
      });
    }, {threshold:.12});
    cards.forEach(c=> io.observe(c));
  })();

  // ---- INSTAGRAM
  (async function initInstagram(){
    const section = $("#insta");
    const track = $("#instaTrack");
    if(!section || !track) return;

    const jsonUrl = section.getAttribute("data-json") || "/assets/data/instagram.json";
    const fnUrl   = section.getAttribute("data-fn")   || null;

    let data = await fetchJSON(jsonUrl);
    if((!data || (Array.isArray(data) && data.length===0)) && fnUrl){
      try{
        const r = await fetch(fnUrl, {cache:"no-cache"});
        if(r.ok) data = await r.json();
      }catch(_){}
    }
    if(!data){ console.warn("Instagram verisi yok"); return; }

    const toSrc = (it)=>{
      if(typeof it === "string") return it;
      if(it && typeof it === "object"){
        if(it.src)  return it.src;
        if(it.file) return it.file;
      }
      return null;
    };
    const toAlt = (it)=> (it && typeof it==="object" && it.alt) ? it.alt : "Instagram görseli";

    const raw = Array.isArray(data) ? data : (data.items || []);
    const items = raw.map(it=>{
      const src = toSrc(it);
      if(!src) return null;
      const absolute = (src.startsWith("/") || src.startsWith("http")) ? src : `/assets/img/insta/${src}`;
      return {src:absolute, alt:toAlt(it)};
    }).filter(Boolean);

    if(!items.length){ console.warn("Instagram listesi boş"); return; }

    const makeItem = (img)=>{
      const d = document.createElement("div"); d.className = "insta-item";
      const im = document.createElement("img"); im.loading="lazy"; im.decoding="async"; im.src=img.src; im.alt=img.alt;
      d.appendChild(im); return d;
    };

    track.innerHTML = "";
    const STRIP_MIN = 18;
    const repeated = [];
    while(repeated.length < STRIP_MIN) repeated.push(...items);
    repeated.slice(0, STRIP_MIN+6).forEach((im)=> track.appendChild(makeItem(im)));

    // yavaş akış
    let pos = 0, playing = true;
    const STEP = 0.25;
    function tick(){
      if(!playing) return;
      pos -= STEP;
      track.style.transform = `translate3d(${pos}px,0,0)`;
      const first = track.firstElementChild;
      if(!first) return;
      const firstW = first.getBoundingClientRect().width + 12;
      if(Math.abs(pos) >= firstW){ track.appendChild(first); pos += firstW; }
    }
    (function loop(){ tick(); requestAnimationFrame(loop); })();
    track.addEventListener("mouseenter",()=> playing=false);
    track.addEventListener("mouseleave",()=> playing=true);

    // highlight
    setInterval(()=>{
      const cards = $$(".insta-item", track);
      if(!cards.length) return;
      const i = Math.floor(Math.random()*Math.min(cards.length,14));
      const el = cards[i];
      el.classList.add("highlight");
      setTimeout(()=> el.classList.remove("highlight"), 1800);
    }, 2800);
  })();

  // ---- GOOGLE YORUMLARI (8’li)
  (async function initReviews8(){
    const section = $("#reviews");
    const grid = $("#reviewGrid");
    if(!section || !grid) return;

    const SRC = section.getAttribute("data-json") || "/assets/data/reviews.json";
    const VISIBLE = 8;
    const INTERVAL = 10000;
    const STAGGER = 50;
    let all = [], idx = 0, timer=null, paused=false;

    function stars(n){
      const v = Math.round(Math.max(0, Math.min(5, Number(n)||5)));
      return '<div class="stars" aria-label="'+v+' yıldız">'+
        Array.from({length:5}).map((_,i)=>'<span class="s" aria-hidden="true">'+(i<v?'★':'☆')+'</span>').join('')+
      '</div>';
    }
    function card(item){
      const text = (item.text || item.review_text || item.comment || "").toString().trim();
      const author = (item.author || item.author_name || item.name || "Ziyaretçi").toString().trim();
      const rating = item.rating || item.stars || 5;
      const when = (item.time || item.relative_time_description || item.date || "").toString().trim();
      return `
        <article class="review-card entering" role="article">
          ${stars(rating)}
          <p class="review-text">${text}</p>
          <div class="review-author">— ${author}</div>
          ${when ? `<div class="review-meta">${when}</div>` : ``}
        </article>`;
    }
    function sliceStart(start){
      if(all.length===0) return [];
      const out=[]; for(let i=0;i<VISIBLE;i++){ out.push(all[(start+i)%all.length]); } return out;
    }
    function swap(startIndex){
      Array.from(grid.children).forEach(el=> el.classList.add("leaving"));
      setTimeout(()=>{
        const items = sliceStart(startIndex);
        grid.innerHTML = items.map(card).join("");
        Array.from(grid.children).forEach((el,i)=>{
          setTimeout(()=>{ el.classList.add("visible"); el.classList.remove("entering"); }, i*STAGGER);
        });
      }, 180);
    }
    function startLoop(){
      if(timer) clearInterval(timer);
      timer = setInterval(()=>{
        if (paused || all.length <= VISIBLE) return;
        idx = (idx + VISIBLE) % all.length;
        swap(idx);
      }, INTERVAL);
    }
    grid.addEventListener("mouseenter",()=> paused=true);
    grid.addEventListener("mouseleave",()=> paused=false);

    const j = await fetchJSON(SRC);
    const arr = Array.isArray(j) ? j : (j?.items || j?.data || []);
    all = Array.isArray(arr) ? arr : [];
    if(!all.length){ grid.innerHTML = '<p class="muted">Henüz yorum eklenmedi.</p>'; return; }

    swap(idx);
    if(all.length > VISIBLE) startLoop();
  })();

  // ---- YOUTUBE
  (async function initYouTube(){
    const section = $("#youtube");
    const strip = $("#ytStrip");
    if(!section || !strip) return;

    async function loadIds(){
      const fn = section.getAttribute("data-fn");
      if(fn){
        try{
          const r = await fetch(fn, {cache:"no-cache"});
          if(r.ok){
            const j = await r.json();
            if(j && Array.isArray(j.youtubeIds) && j.youtubeIds.length) return j.youtubeIds;
          }
        }catch(e){ console.warn("YouTube fn:", e.message); }
      }
      const idx = await fetchJSON("/assets/data/index.json");
      if(idx && Array.isArray(idx.youtubeIds) && idx.youtubeIds.length) return idx.youtubeIds;
      const attr = (section.getAttribute("data-youtube-ids")||"").trim();
      if(attr) return attr.split(",").map(s=>s.trim()).filter(Boolean);
      return [];
    }

    const ids = await loadIds();
    if(!ids.length){
      strip.innerHTML = `<div class="muted">Video bulunamadı. <code>/.netlify/functions/youtube-latest?limit=9</code> veya <code>/assets/data/index.json</code> kontrol edin.</div>`;
      return;
    }

    let start = 0;
    function render(){
      strip.innerHTML = "";
      const view = [0,1,2].map(i => ids[(start+i)%ids.length]);
      view.forEach(id=>{
        const box = document.createElement("div");
        box.className = "yt-box";
        box.innerHTML = `<iframe loading="lazy"
            src="https://www.youtube.com/embed/${encodeURIComponent(id)}"
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen></iframe>`;
        strip.appendChild(box);
      });
    }
    render();
    setInterval(()=>{ start = (start+1)%ids.length; render(); }, 7000);
  })();

})();
