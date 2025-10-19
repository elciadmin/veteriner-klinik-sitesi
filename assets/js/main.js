/* =========================================================================
   Elçi Veteriner — Ana JS (v16)
   - Instagram: ["ad.jpg"] | [{src}] | [{file}] hepsi desteklenir.
   - Google Yorumları: Tüm yorumları tek sayfada basar.
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

  /* -------------------- INSTAGRAM -------------------- */
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
        if (it.file) return it.file;  // *** Senin JSON’unu destekliyoruz ***
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

  /* -------------------- GOOGLE YORUMLAR -------------------- */
  (async function initReviews() {
    const section = $("#reviews");
    const grid = $("#reviewGrid");
    if (!section || !grid) return;

    const localJson = section.getAttribute("data-json") || "/assets/data/reviews.json";

    let reviews = await fetchJSON(localJson);
    if (!reviews || !Array.isArray(reviews) || !reviews.length) {
      grid.innerHTML = `<div class="muted">Yorum verisi bulunamadı. <code>${localJson}</code> dosyasını kontrol edin.</div>`;
      console.warn("reviews.json okunamadı/boş:", localJson, reviews);
      return;
    }

    // Hepsini tek sayfada gösterelim
    const norm = reviews.map((r) => ({
      author: r.author || r.author_name || "Ziyaretçi",
      rating: r.rating || r.stars || 5,
      text: r.text || r.review_text || "",
      time: r.time || r.relative_time_description || ""
    }));

    function starLine(n) {
      const v = Math.round(Math.max(0, Math.min(5, Number(n) || 5)));
      return "★".repeat(v) + "☆".repeat(5 - v);
    }

    grid.innerHTML = "";
    norm.forEach((rv) => {
      const card = document.createElement("div");
      card.className = "review-card";
      card.innerHTML =
        `<div class="stars">${starLine(rv.rating)}</div>` +
        `<div style="margin-top:8px">${rv.text || ""}</div>` +
        `<div class="review-author">${rv.author}</div>` +
        `<div class="muted" style="font-size:12px">${rv.time || ""}</div>`;
      grid.appendChild(card);
      requestAnimationFrame(() => card.classList.add("visible"));
    });
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

})(); // v16 SONU
