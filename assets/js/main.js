/* =========================================================================
   Elçi Veteriner — Ana JS
   - Instagram şeridi (yavaş akış + rastgele büyütme)
   - Google yorum kartları (otomatik döngü)
   - YouTube 3'lü şerit (7 sn’de kaydırma)
   - Güvenli JSON yükleme + graceful fallback
   ======================================================================== */

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* -------------------- Küçük yardımcılar -------------------- */

  async function fetchJSON(url) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn("fetchJSON fail:", url, e.message);
      return null;
    }
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Yıl bas
  const yilEl = $("#yil");
  if (yilEl) yilEl.textContent = new Date().getFullYear();

  /* -------------------- INSTAGRAM ŞERİDİ -------------------- */

  (async function initInstagram() {
    const section = $("#insta");
    const track = $("#instaTrack");
    if (!section || !track) return;

    // Veri kaynağı
    const jsonUrl = section.getAttribute("data-json") || "/assets/data/instagram.json";
    let data = await fetchJSON(jsonUrl);

    // JSON yoksa bir şey yapma (hata vermeden geç)
    if (!data || !Array.isArray(data)) {
      console.warn("instagram.json bulunamadı veya format yanlış.");
      return;
    }

    // Beklenen format:
    // ["file1.webp","file2.webp"] veya [{src:"/assets/img/insta/x.webp", alt:"..."}]
    const toSrc = (it) =>
      typeof it === "string" ? it : (it && it.src ? it.src : null);
    const toAlt = (it) =>
      typeof it === "object" && it && it.alt ? it.alt : "Instagram görseli";

    // Yollar: Eğer çıplak dosya adı geldiyse /assets/img/insta/ altından al
    const items = data
      .map((it) => {
        const src = toSrc(it);
        if (!src) return null;
        const absolute =
          src.startsWith("/") || src.startsWith("http")
            ? src
            : `/assets/img/insta/${src}`;
        return { src: absolute, alt: toAlt(it) };
      })
      .filter(Boolean);

    // DOM’a bas
    const makeItem = (img) => {
      const d = document.createElement("div");
      d.className = "insta-item";
      const im = document.createElement("img");
      im.loading = "lazy";
      im.decoding = "async";
      im.src = img.src;
      im.alt = img.alt;
      d.appendChild(im);
      return d;
    };

    // Akıcı kayış etkisi için, uçtan uca kopyalar ekleyelim
    const renderStrip = () => {
      track.innerHTML = "";
      const STRIP_MIN = 18; // mobilde bile dolgun olsun
      const repeated = [];
      while (repeated.length < STRIP_MIN) repeated.push(...items);
      repeated.slice(0, STRIP_MIN).forEach((img) => track.appendChild(makeItem(img)));
      // Sorunsuz döngü için bir tur daha ekle (wrap)
      repeated.slice(0, 6).forEach((img) => track.appendChild(makeItem(img)));
    };

    renderStrip();

    // YAVAŞ AKIŞ — hız düşürüldü (kullanıcı isteği)
    let pos = 0;
    const STEP = 0.25; // px/frame — düşük = yavaş
    let playing = true;

    function tick() {
      if (!playing) return;
      pos -= STEP;
      track.style.transform = `translate3d(${pos}px,0,0)`;
      // Sona gelince başa sar
      const first = track.firstElementChild;
      if (!first) return;
      const firstWidth = first.getBoundingClientRect().width + 12; // gap
      if (Math.abs(pos) >= firstWidth) {
        track.appendChild(first);
        pos += firstWidth;
      }
    }

    let rafId;
    function loop() {
      tick();
      rafId = requestAnimationFrame(loop);
    }
    loop();

    // Hover’da durdur / devam
    track.addEventListener("mouseenter", () => (playing = false));
    track.addEventListener("mouseleave", () => (playing = true));

    // RASTGELE ÖNE ÇIKMA (büyütüp geri dönsün)
    setInterval(() => {
      const cards = $$(".insta-item", track);
      if (cards.length === 0) return;
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
    const fnUrl = section.getAttribute("data-fn") || "/.netlify/functions/google-reviews";

    // 1) Yerel JSON’u dene
    let reviews = await fetchJSON(localJson);

    // 2) Yoksa Netlify Function
    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      const remote = await fetchJSON(fnUrl);
      if (remote && Array.isArray(remote.reviews)) {
        reviews = remote.reviews;
      }
    }

    if (!reviews || reviews.length === 0) {
      grid.innerHTML = `<div class="muted">Şimdilik yorum bulunamadı.</div>`;
      return;
    }

    // Normalize
    const norm = reviews.map((r) => ({
      author: r.author || r.author_name || "Ziyaretçi",
      rating: r.rating || r.stars || 5,
      text: r.text || r.review_text || "",
      time: r.time || r.relative_time_description || ""
    }));

    // Kartları 6’lı gruplar halinde döndür
    const pages = chunk(norm, 6);
    let page = 0;

    function starLine(n) {
      const full = Math.round(Math.max(0, Math.min(5, Number(n) || 5)));
      return "★".repeat(full) + "☆".repeat(5 - full);
    }

    function renderPage(p) {
      grid.innerHTML = "";
      p.forEach((rv) => {
        const card = document.createElement("div");
        card.className = "review-card";
        card.innerHTML = `
          <div class="stars" aria-label="${rv.rating} yıldız">${starLine(rv.rating)}</div>
          <div style="margin-top:8px">${rv.text || ""}</div>
          <div class="review-author">${rv.author}</div>
          <div class="muted" style="font-size:12px">${rv.time || ""}</div>
        `;
        grid.appendChild(card);
        requestAnimationFrame(() => card.classList.add("visible"));
      });
    }

    renderPage(pages[page]);

    setInterval(() => {
      page = (page + 1) % pages.length;
      renderPage(pages[page]);
    }, 6500); // yavaş, akıcı geçiş
  })();

  /* -------------------- YOUTUBE ŞERİDİ -------------------- */

  (async function initYouTube() {
    const section = $("#youtube");
    const strip = $("#ytStrip");
    if (!section || !strip) return;

    async function loadIds() {
      // index.json’da youtubeIds dizisi varsa onu kullan
      const idx = await fetchJSON("/assets/data/index.json");
      if (idx && Array.isArray(idx.youtubeIds) && idx.youtubeIds.length) return idx.youtubeIds;

      // değilse section attribute’tan çek
      const attr = (section.getAttribute("data-youtube-ids") || "").trim();
      if (attr) return attr.split(",").map((s) => s.trim()).filter(Boolean);

      // yine yoksa boş
      return [];
    }

    const ids = await loadIds();
    if (!ids.length) {
      strip.innerHTML = `<div class="muted">Video bulunamadı.</div>`;
      return;
    }

    let start = 0;

    function renderWindow() {
      strip.innerHTML = "";
      const view = [];
      for (let i = 0; i < 3; i++) {
        view.push(ids[(start + i) % ids.length]);
      }
      view.forEach((id) => {
        const box = document.createElement("div");
        box.className = "yt-box";
        box.innerHTML = `
          <iframe loading="lazy"
                  src="https://www.youtube.com/embed/${encodeURIComponent(id)}"
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerpolicy="strict-origin-when-cross-origin"
                  allowfullscreen></iframe>
        `;
        strip.appendChild(box);
      });
    }

    renderWindow();

    // İstek: 1-2-3 görüldükten 7 sn sonra 2-3-4…
    setInterval(() => {
      start = (start + 1) % ids.length;
      renderWindow();
    }, 7000);
  })();
})();
