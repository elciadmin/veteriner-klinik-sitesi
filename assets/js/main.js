/* =========================================================================
   Elçi Veteriner — Ana JS (v17→v17.2)
   - Header: mobil menü + aktif link
   - Services: 6'lı sayfa kaydırma + scroll-in animasyon
   - Instagram: yavaş şerit + rastgele highlight (json/fn fallback)
   - Google Yorumları: 8’li rotator
   - YouTube: 3’lü şerit, 7 sn’de 2-3-4
   - JSON Mini Loader: FAQ & About hydrate (Decap CMS JSON'ları)
   ========================================================================= */
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

  // ---- SERVICES: 6'lı sayfa kaydırma
  (function initServicesPager(){
    // Hem id, hem class ile uyumlu olsun
    const grid = document.getElementById("servicesGrid") || $("#services .services-grid");
    if(!grid) return;

    const cards = Array.from(grid.children);
    const perPage = 6;
    const pages = Math.ceil(cards.length / perPage);
    if(pages <= 1) return; // 6 veya daha az kart varsa sayfalama yapma

    // Yeni yapı
    const viewport = document.createElement('div');
    viewport.className = 'services-viewport';

    const rail = document.createElement('div');
    rail.className = 'services-rail';

    for(let p=0; p<pages; p++){
      const page = document.createElement('div');
      page.className = 'services-page';
      cards.slice(p*perPage, (p+1)*perPage).forEach(el => page.appendChild(el));
      rail.appendChild(page);
    }

    viewport.appendChild(rail);
    grid.replaceWith(viewport);

    // Navigasyon butonları
    const prev = document.createElement('button');
    prev.className = 'svc-nav svc-prev';
    prev.setAttribute('aria-label','Önceki hizmetler');
    prev.innerHTML = '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>';

    const next = document.createElement('button');
    next.className = 'svc-nav svc-next';
    next.setAttribute('aria-label','Sonraki hizmetler');
    next.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';

    viewport.appendChild(prev);
    viewport.appendChild(next);

    let index = 0;
    const update = () => {
      rail.style.transform = `translateX(-${index*100}%)`;
      prev.disabled = index === 0;
      next.disabled = index === pages - 1;
    };

    prev.addEventListener('click', () => { if(index>0){ index--; update(); }});
    next.addEventListener('click', () => { if(index<pages-1){ index++; update(); }});

    // Dokunmatik/masaüstü sürükle-kaydır
    let startX = 0, dragging = false, pid = null;
    viewport.addEventListener('pointerdown', (e)=>{
      dragging=true; startX=e.clientX; pid=e.pointerId; viewport.setPointerCapture(pid);
    });
    viewport.addEventListener('pointerup', (e)=>{
      if(!dragging) return;
      dragging=false;
      const dx = e.clientX - startX;
      if(Math.abs(dx) > 50){
        if(dx < 0 && index < pages-1) index++;
        if(dx > 0 && index > 0) index--;
        update();
      }
      try{ viewport.releasePointerCapture(pid); }catch(_){}
    });

    update();
  })();

  // ---- SERVICES: scroll-in (yeni yapıya uyumlu)
  (function initServicesIn(){
    const cards = $$("#services .s-card");
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

/* ===== JSON Mini Loader (FAQ + About) — ayrı IIFE ===== */
(function(){
  const isFAQ   = document.body?.dataset?.page === 'faq';
  const onAbout = /about\.html$/.test(location.pathname) || document.getElementById('basarilar');

  async function jget(path){
    try{
      const r = await fetch(path, {cache:'no-cache'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    }catch(e){ console.warn('JSON load fail', path, e); return null; }
  }

  // ---- FAQ hydrate
  async function hydrateFAQ(){
    if(!isFAQ) return;
    const data = await jget('/assets/data/faq.json'); if(!data) return;
    const root = document.getElementById('faqContent'); if(!root) return;

    const mkDetails = (it)=>`
      <details class="faq" id="${it.id}">
        <summary><span class="q"><span class="dot"></span>${it.q}</span></summary>
        <button class="linkcopy" title="Bağlantıyı kopyala" aria-label="Bağlantıyı kopyala"><i class="fa-solid fa-link"></i></button>
        <div class="a">${it.a}</div>
      </details>`;

    const groupsHtml = (data.groups||[]).map(g=>{
      const gid = (g.category || 'Grup').toLowerCase().replace(/\s+/g,'-');
      const items = (g.items||[]).map(mkDetails).join('');
      return `<div class="faq-group" data-cat="${g.category}" id="${gid}">
        <h2>${g.category}</h2>${items}</div>`;
    }).join('');

    // noResults ve footer note korunacaksa ekle
    const noRes = document.getElementById('noResults')?.outerHTML || '';
    const foot  = root.querySelector('.faq-footer-note')?.outerHTML || '';
    root.innerHTML = groupsHtml + noRes + foot;

    // chipleri doldur
    const chips = document.getElementById('faqChips');
    if(chips){
      const uniq = ['Tümü', ...(data.groups||[]).map(g=>g.category)];
      chips.innerHTML = uniq.map((c,i)=>`<button class="faq-chip ${i===0?'active':''}" data-cat="${c}" aria-pressed="${i===0?'true':'false'}">${c}</button>`).join('');
    }

    // sayaç ve tarih
    const updated = document.getElementById('faqUpdated');
    if(updated){ const fmt=new Date().toLocaleDateString('tr-TR',{year:'numeric',month:'long',day:'2-digit'}); updated.textContent=fmt; }

    // mevcut sayfa scriptindeki event’leri tekrar bağlamak için:
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }

  // ---- About hydrate (opsiyonel; DOM elemanları varsa işler)
  async function hydrateAbout(){
    if(!onAbout) return;
    const data = await jget('/assets/data/about.json'); if(!data) return;

    const hs = document.querySelector('.hero .hero-sub'); if(hs && data.hero_sub) hs.textContent = data.hero_sub;
    const h1 = document.querySelector('.hero h1');      if(h1 && data.hero_title) h1.textContent = data.hero_title;

    const aboutWrap = document.querySelector('#elci-kimdir .about-wrap');
    if(aboutWrap && data.founder){
      const fig = aboutWrap.querySelector('.about-img img');
      if(fig && data.founder.photo) fig.src = data.founder.photo;
      const nameEl = aboutWrap.querySelector('.about-content h3');
      if(nameEl && data.founder.name) nameEl.textContent = data.founder.name;
      const p = aboutWrap.querySelector('.about-content p'); if(p && data.founder.bio) p.textContent = data.founder.bio;
    }

    const grid = document.getElementById('metricsGrid');
    if(grid && Array.isArray(data.metrics)){
      grid.innerHTML = data.metrics.map(m=>{
        if(m.kind==='donut') return `
          <article class="m-card" data-kind="donut" data-value="${m.value||0}">
            <div class="m-head"><div class="m-title">${m.title}</div><span class="m-ico" aria-hidden="true"><i class="fa-solid fa-syringe"></i></span></div>
            <div class="m-donut">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <defs><linearGradient id="m-grad" x1="0" x2="1" y1="0" y2="1"><stop offset="0%"/><stop offset="100%"/></linearGradient></defs>
                <circle class="m-bg" cx="60" cy="60" r="48" fill="none" stroke="#e6f0f1" stroke-width="12"/>
                <circle class="m-fg" cx="60" cy="60" r="48" fill="none" stroke="url(#m-grad)" stroke-width="12" stroke-dasharray="301.59" stroke-dashoffset="301.59" stroke-linecap="round"/>
                <text x="60" y="66" text-anchor="middle" font-weight="800" font-size="22" fill="var(--brand)">0%</text>
              </svg>
            </div>
          </article>`;
        if(m.kind==='gauge') return `
          <article class="m-card" data-kind="gauge" data-value="${m.value||0}" data-max="${m.max||5}">
            <div class="m-head"><div class="m-title">${m.title}</div><span class="m-ico" aria-hidden="true"><i class="fa-regular fa-face-smile"></i></span></div>
            <div class="m-gauge">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <defs><linearGradient id="m-grad2" x1="0" x2="1" y1="0" y2="1"><stop offset="0%"/><stop offset="100%"/></linearGradient></defs>
                <circle class="m-bg" cx="60" cy="60" r="48" fill="none" stroke="#e6f0f1" stroke-width="12" stroke-dasharray="226.19" transform="rotate(135 60 60)"/>
                <circle class="m-fg" cx="60" cy="60" r="48" fill="none" stroke="url(#m-grad2)" stroke-width="12" stroke-dasharray="226.19" stroke-dashoffset="226.19" transform="rotate(135 60 60)" stroke-linecap="round"/>
                <text x="60" y="66" text-anchor="middle" font-weight="800" font-size="20" fill="var(--brand)">0/5</text>
              </svg>
            </div>
          </article>`;
        return `
          <article class="m-card" data-kind="kpi" data-suffix="${m.suffix||''}" data-progress="${m.progress||0}" data-value="${m.value||0}">
            <div class="m-head"><div class="m-title">${m.title}</div><span class="m-ico" aria-hidden="true"><i class="fa-solid fa-clipboard-check"></i></span></div>
            <div><span class="m-num">0</span><span class="m-unit">${m.suffix||''}</span></div>
            <div class="m-progress"><div class="m-bar"></div></div>
          </article>`;
      }).join('');
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }
  }

  hydrateFAQ();
  hydrateAbout();
})();
// ---- Netlify Identity (site geneli) ----
(function addNetlifyIdentity(){
  // Widget scriptini dinamik ekle (CSP: identity.netlify.com izinli olmalı)
  var s = document.createElement('script');
  s.src = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
  s.defer = true;
  s.onload = function(){
    if (!window.netlifyIdentity) return;
    // Giriş olunca admin'e yönlendir
    window.netlifyIdentity.on('init', function(user){
      if(!user){
        window.netlifyIdentity.on('login', function(){
          location.assign('/admin/');
        });
      }
    });
    // Davet / onay / şifre sıfırlama token’ı geldiyse widget’ı aç
    var h = location.hash || '';
    if (
      h.startsWith('#invite_token=') ||
      h.startsWith('#recovery_token=') ||
      h.startsWith('#confirmation_token=')
    ){
      window.netlifyIdentity.open();
    }
  };
  document.head.appendChild(s);
})();
