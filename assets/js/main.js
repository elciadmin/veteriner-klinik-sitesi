/* =========================================================================
   Elçi Veteriner — Ana JS (v17)
   - Instagram: ["ad.jpg"] | [{src}] | [{file}] hepsi desteklenir.
   - Google Yorumları: 8 kart göster + animasyonla döndür (rotator).
   - Hizmetler: Stabil sayfalama (deck) + yumuşak giriş animasyonu.
   - YouTube: Önce data-fn (RSS Function) → sonra /assets/data/index.json → sonra data-attr.
   ======================================================================== */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  async function fetchJSON(url) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("fetchJSON fail:", url, e.message);
      return null;
    }
  }

  // Yıl
  const yilEl = $("#yil");
  if (yilEl) yilEl.textContent = new Date().getFullYear();

  /* -------------------- INSTAGRAM (mevcut davranış korunur) -------------------- */
  (async function initInstagram() {
    const section = $("#insta");
    const track = $("#instaTrack");
    if (!section || !track) return;

    const jsonUrl = section.getAttribute("data-json") || "/assets/data/instagram.json";
    const fnUrl = section.getAttribute("data-fn") || null;

    // 1) Yerel JSON
    let data = await fetchJSON(jsonUrl);

    // 2) (opsiyonel) Function fallback
    if ((!data || (Array.isArray(data) && data.length === 0)) && fnUrl) {
      try {
        const r = await fetch(fnUrl, { cache: "no-cache" });
        if (r.ok) data = await r.json();
      } catch (_) {}
    }

    if (!data) {
      console.warn("Instagram verisi bulunamadı / okunamadı:", jsonUrl, fnUrl || "");
      return;
    }

    // Kabul edilen formatlar:
    // ["a.webp","b.jpg"]  VEYA  [{src:"a.webp", alt:"..."},{file:"b.jpg"}]
    const toSrc = (it) => {
      if (typeof it === "string") return it;
      if (it && typeof it === "object") {
        if (it.src) return it.src;
        if (it.file) return it.file;  // *** Senin JSON’unu da destekler ***
      }
      return null;
    };
    const toAlt = (it) => (it && typeof it === "object" && it.alt) ? it.alt : "Instagram görseli";

    const raw = Array.isArray(data) ? data : (data.items || []);
    const items = raw.map(it => {
      const src = toSrc(it);
      if (!src) return null;
      // Sadece dosya adıysa /assets/img/insta/ altına oturt
      const absolute = (src.startsWith("/") || src.startsWith("http")) ? src : `/assets/img/insta/${src}`;
      return { src: absolute, alt: toAlt(it) };
    }).filter(Boolean);

    if (!items.length) {
      console.warn("Instagram listesi boş görünüyor. instagram.json içeriğini kontrol et.");
      return;
    }

    // DOM’a bas
    const makeItem = (img) => {
      const d = document.createElement("div");
      d.className = "insta-item";
      const im = document.createElement("img");
      im.loading = "lazy"; im.decoding = "async";
      im.src = img.src; im.alt = img.alt;
      d.appendChild(im);
      return d;
    };

    track.innerHTML = "";
    const STRIP_MIN = 18;
    const repeated = [];
    while (repeated.length < STRIP_MIN) repeated.push(...items);
    repeated.slice(0, STRIP_MIN + 6).forEach((im) => track.appendChild(makeItem(im)));

    // Yavaş akış
    let pos = 0;
    const STEP = 0.25; // yavaş
    let playing = true;
    function tick() {
      if (!playing) return;
      pos -= STEP;
      track.style.transform = `translate3d(${pos}px,0,0)`;
      const first = track.firstElementChild;
      if (!first) return;
      const firstW = first.getBoundingClientRect().width + 12;
      if (Math.abs(pos) >= firstW) { track.appendChild(first); pos += firstW; }
    }
    (function loop(){ tick(); requestAnimationFrame(loop); })();

    track.addEventListener("mouseenter", () => { playing = false; });
    track.addEventListener("mouseleave", () => { playing = true; });

    // Rastgele öne çıkarma
    setInterval(() => {
      const cards = $$(".insta-item", track);
      if (!cards.length) return;
      const i = Math.floor(Math.random() * Math.min(cards.length, 14));
      const el = cards[i];
      el.classList.add("highlight");
      setTimeout(() => el.classList.remove("highlight"), 1800);
    }, 2800);
  })();

  /* -------------------- GOOGLE YORUMLAR (8'li rotator) -------------------- */
  (async function initReviews8() {
    const section = $("#reviews");
    const grid = $("#reviewGrid");
    if (!section || !grid) return;

    const SRC = section.getAttribute("data-json") || "/assets/data/reviews.json";
    const VISIBLE_COUNT = 8;      // Aynı anda 8 kart
    const INTERVAL_MS = 10000;    // 10 sn'de bir değiştir
    const STAGGER = 50;           // Kart girişlerinde küçük gecikme

    function renderStars(n){
      const v = Math.round(Math.max(0, Math.min(5, Number(n) || 5)));
      // CSS içindeki .stars .s rengi uygular
      return '<div class="stars" aria-label="'+v+' yıldız">'+
             Array.from({length:5}).map((_,i)=>'<span class="s" aria-hidden="true">'+(i<v?'★':'☆')+'</span>').join('')+
             '</div>';
    }

    function cardHTML(item){
      const text = (item.text || item.review_text || "").toString().trim();
      const author = (item.author || item.author_name || "Ziyaretçi").toString().trim();
      const rating = item.rating || item.stars || 5;
      const when = (item.time || item.relative_time_description || "").toString().trim();

      return `
        <article class="review-card entering" role="article">
          ${renderStars(rating)}
          <p class="review-text">${text}</p>
          <div class="review-author">— ${author}</div>
          ${when ? `<div class="review-meta">${when}</div>` : ``}
        </article>
      `;
    }

    function sliceData(array, start){
      if(array.length === 0) return [];
      const out = [];
      for(let i=0;i<VISIBLE_COUNT;i++){
        out.push(array[(start + i) % array.length]);
      }
      return out;
    }

    let all = [];
    let idx = 0;
    let timer = null;
    let paused = false;

    function swapTo(startIndex){
      // Çıkış animasyonu
      const currentCards = Array.from(grid.children);
      currentCards.forEach(el => el.classList.add('leaving'));

      setTimeout(()=>{
        const items = sliceData(all, startIndex);
        grid.innerHTML = items.map(cardHTML).join('');
        const newCards = Array.from(grid.children);
        newCards.forEach((el, i)=>{
          setTimeout(()=>{ el.classList.add('visible'); el.classList.remove('entering'); }, i*STAGGER);
        });
      }, 180);
    }

    function startLoop(){
      if(timer) clearInterval(timer);
      timer = setInterval(()=>{
        if (paused || all.length <= VISIBLE_COUNT) return;
        idx = (idx + VISIBLE_COUNT) % all.length;
        swapTo(idx);
      }, INTERVAL_MS);
    }

    // Hover ile durdur/başlat
    grid.addEventListener('mouseenter', ()=>{ paused = true; });
    grid.addEventListener('mouseleave', ()=>{ paused = false; });

    try{
      const json = await fetchJSON(SRC);
      const arr = Array.isArray(json) ? json : (json?.items || json?.data || []);
      all = Array.isArray(arr) ? arr : [];
    }catch(e){
      console.warn("Yorumlar alınamadı:", e.message);
      all = [];
    }

    if(!all.length){
      grid.innerHTML = '<p class="muted">Henüz yorum eklenmedi.</p>';
      return;
    }

    // İlk render
    swapTo(idx);
    // Yeterince yorum varsa döngü başlasın
    if(all.length > VISIBLE_COUNT) startLoop();
  })();

  /* -------------------- HİZMETLER (sayfalama / deck) -------------------- */
  (function initServicesDeck(){
    const grid = $("#servicesGrid");
    if(!grid) return;

    const cards = $$(".s-card", grid);
    if(cards.length === 0) return;

    // Kontroller var mı? Yoksa oluştur.
    let controls = grid.previousElementSibling;
    if (!controls || !controls.classList || !controls.classList.contains("svc-controls")) {
      controls = document.createElement("div");
      controls.className = "svc-controls";
      controls.innerHTML = `
        <button class="btn" data-prev>&laquo; Önceki</button>
        <button class="btn" data-next>Sonraki &raquo;</button>
      `;
      // Grid'in hemen üstüne ekle
      grid.parentElement.insertBefore(controls, grid);
    }

    const prevBtn = controls.querySelector("[data-prev]");
    const nextBtn = controls.querySelector("[data-next]");

    function perPageByWidth(){
      const w = window.innerWidth;
      if (w > 1100) return 6; // 3x2 görünüm hissi
      if (w > 640)  return 4; // 2x2
      return 3;               // 1x3
    }

    let perPage = perPageByWidth();
    let page = 0;
    const total = cards.length;
    const totalPages = () => Math.max(1, Math.ceil(total / perPage));

    function applyPage(p){
      perPage = perPageByWidth();
      const tp = totalPages();
      page = Math.min(Math.max(0, p), tp - 1);

      // Hepsini gizle
      cards.forEach(c => { c.style.display = "none"; c.classList.remove("show"); });

      // Bu sayfayı göster
      const start = page * perPage;
      const end = Math.min(total, start + perPage);
      const visible = cards.slice(start, end);

      visible.forEach((c, i) => {
        c.style.display = "";
        // yumuşak giriş animasyonu (.show CSS’te var)
        setTimeout(()=> c.classList.add("show"), i * 80);
      });

      // Buton durumları
      if (prevBtn) prevBtn.disabled = (page === 0);
      if (nextBtn) nextBtn.disabled = (page >= tp - 1);
    }

    // İlk uygulama
    applyPage(0);

    // Clickler
    prevBtn && prevBtn.addEventListener("click", ()=> applyPage(page - 1));
    nextBtn && nextBtn.addEventListener("click", ()=> applyPage(page + 1));

    // Resize’da perPage değişebilir → sayfayı yeniden uygula
    let rAF = null;
    window.addEventListener("resize", ()=>{
      if (rAF) cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(()=> applyPage(page));
    }, { passive:true });
  })();

  /* -------------------- YOUTUBE -------------------- */
  (async function initYouTube() {
    const section = $("#youtube");
    const strip = $("#ytStrip");
    if (!section || !strip) return;

    async function loadIds() {
      // 1) Netlify function (varsa en güncel)
      const fn = section.getAttribute("data-fn");
      if (fn) {
        try {
          const r = await fetch(fn, { cache: "no-cache" });
          if (r.ok) {
            const j = await r.json();
            if (j && Array.isArray(j.youtubeIds) && j.youtubeIds.length) return j.youtubeIds;
          } else {
            console.warn("YouTube function HTTP", r.status);
          }
        } catch (e) {
          console.warn("YouTube function hatası:", e.message);
        }
      }
      // 2) /assets/data/index.json
      const idx = await fetchJSON("/assets/data/index.json");
      if (idx && Array.isArray(idx.youtubeIds) && idx.youtubeIds.length) return idx.youtubeIds;
      // 3) data-youtube-ids attribute
      const attr = (section.getAttribute("data-youtube-ids") || "").trim();
      if (attr) return attr.split(",").map((s) => s.trim()).filter(Boolean);
      return [];
    }

    const ids = await loadIds();
    if (!ids.length) {
      strip.innerHTML = `<div class="muted">Video bulunamadı. <code>/.netlify/functions/youtube-latest?limit=9</code> veya <code>/assets/data/index.json</code> kontrol edin.</div>`;
      console.warn("YouTube ID listesi boş.");
      return;
    }

    let start = 0;
    function render() {
      strip.innerHTML = "";
      const view = [0, 1, 2].map((i) => ids[(start + i) % ids.length]);
      view.forEach((id) => {
        const box = document.createElement("div");
        box.className = "yt-box";
        box.innerHTML =
          `<iframe loading="lazy"
              src="https://www.youtube.com/embed/${encodeURIComponent(id)}"
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen></iframe>`;
        strip.appendChild(box);
      });
    }
    render();
    setInterval(() => {
      start = (start + 1) % ids.length; // 1-2-3 -> 2-3-4
      render();
    }, 7000);
  })();

})(); // v17 SONU
