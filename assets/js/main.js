/* =========================================================================
   Elçi Veteriner — Ana JS (v14, sade ve hatasız)
   - Instagram şeridi: yavaş akış + rastgele büyütme
   - Google yorumları: 6'lı sayfalar halinde döngü
   - YouTube şeridi: 3'lü, 7 sn'de bir kaydır
   ======================================================================== */
(function () {
  "use strict";

  // Kısa yardımcılar
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  async function fetchJSON(url) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("fetchJSON:", url, e.message);
      return null;
    }
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Yıl
  const yilEl = $("#yil");
  if (yilEl) yilEl.textContent = new Date().getFullYear();

  /* -------------------- INSTAGRAM -------------------- */
  (function initInstagram() {
    const section = $("#insta");
    const track = $("#instaTrack");
    if (!section || !track) return;

    const jsonUrl = section.getAttribute("data-json") || "/assets/data/instagram.json";

    fetchJSON(jsonUrl).then((data) => {
      if (!data || !Array.isArray(data)) return;

      // "dosya.webp" ya da {src, alt}
      const items = data
        .map((it) => {
          const src = typeof it === "string" ? it : (it && it.src) ? it.src : null;
          if (!src) return null;
          const full = src.startsWith("/") || src.startsWith("http") ? src : "/assets/img/insta/" + src;
          const alt = typeof it === "object" && it && it.alt ? it.alt : "Instagram görseli";
          return { src: full, alt: alt };
        })
        .filter(Boolean);

      // DOM
      function make(img) {
        const d = document.createElement("div");
        d.className = "insta-item";
        const im = document.createElement("img");
        im.loading = "lazy";
        im.decoding = "async";
        im.src = img.src;
        im.alt = img.alt;
        d.appendChild(im);
        return d;
      }

      track.innerHTML = "";
      const STRIP_MIN = 18;
      const repeated = [];
      while (repeated.length < STRIP_MIN) repeated.push(...items);
      repeated.slice(0, STRIP_MIN + 6).forEach((im) => track.appendChild(make(im)));

      // Yavaş akış
      let pos = 0;
      const STEP = 0.25; // yavaş
      let playing = true;

      function tick() {
        if (!playing) return;
        pos -= STEP;
        track.style.transform = "translate3d(" + pos + "px,0,0)";
        const first = track.firstElementChild;
        if (!first) return;
        const firstW = first.getBoundingClientRect().width + 12;
        if (Math.abs(pos) >= firstW) {
          track.appendChild(first);
          pos += firstW;
        }
      }

      function loop() {
        tick();
        requestAnimationFrame(loop);
      }
      loop();

      track.addEventListener("mouseenter", () => { playing = false; });
      track.addEventListener("mouseleave", () => { playing = true; });

      // Rastgele büyütme
      setInterval(() => {
        const cards = $$(".insta-item", track);
        if (!cards.length) return;
        const i = Math.floor(Math.random() * Math.min(cards.length, 14));
        const el = cards[i];
        el.classList.add("highlight");
        setTimeout(() => el.classList.remove("highlight"), 1800);
      }, 2800);
    });
  })();

  /* -------------------- GOOGLE YORUMLAR -------------------- */
  (function initReviews() {
    const section = $("#reviews");
    const grid = $("#reviewGrid");
    if (!section || !grid) return;

    const localJson = section.getAttribute("data-json") || "/assets/data/reviews.json";
    const fnUrl = section.getAttribute("data-fn") || "/.netlify/functions/google-reviews";

    function starLine(n) {
      const v = Math.round(Math.max(0, Math.min(5, Number(n) || 5)));
      return "★".repeat(v) + "☆".repeat(5 - v);
    }

    function renderPage(list) {
      grid.innerHTML = "";
      list.forEach((rv) => {
        const card = document.createElement("div");
        card.className = "review-card";
        card.innerHTML =
          '<div class="stars">' + starLine(rv.rating) + "</div>" +
          '<div style="margin-top:8px">' + (rv.text || "") + "</div>" +
          '<div class="review-author">' + (rv.author || "Ziyaretçi") + "</div>" +
          '<div class="muted" style="font-size:12px">' + (rv.time || "") + "</div>";
        grid.appendChild(card);
        requestAnimationFrame(() => card.classList.add("visible"));
      });
    }

    function normalize(arr) {
      return arr.map((r) => ({
        author: r.author || r.author_name || "Ziyaretçi",
        rating: r.rating || r.stars || 5,
        text: r.text || r.review_text || "",
        time: r.time || r.relative_time_description || ""
      }));
    }

    (async function loadReviews() {
      let reviews = await fetchJSON(localJson);
      if (!reviews || !Array.isArray(reviews) || !reviews.length) {
        const remote = await fetchJSON(fnUrl);
        if (remote && Array.isArray(remote.reviews)) reviews = remote.reviews;
      }
      if (!reviews || !reviews.length) {
        grid.innerHTML = '<div class="muted">Şimdilik yorum bulunamadı.</div>';
        return;
      }
      const pages = chunk(normalize(reviews), 6);
      let page = 0;
      renderPage(pages[page]);
      setInterval(() => {
        page = (page + 1) % pages.length;
        renderPage(pages[page]);
      }, 6500);
    })();
  })();

  /* -------------------- YOUTUBE -------------------- */
  (function initYouTube() {
    const section = $("#youtube");
    const strip = $("#ytStrip");
    if (!section || !strip) return;

    async function loadIds() {
      const idx = await fetchJSON("/assets/data/index.json");
      if (idx && Array.isArray(idx.youtubeIds) && idx.youtubeIds.length) return idx.youtubeIds;
      const attr = (section.getAttribute("data-youtube-ids") || "").trim();
      if (attr) return attr.split(",").map((s) => s.trim()).filter(Boolean);
      return [];
    }

    (async function run() {
      const ids = await loadIds();
      if (!ids.length) {
        strip.innerHTML = '<div class="muted">Video bulunamadı.</div>';
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
            '<iframe loading="lazy" src="https://www.youtube.com/embed/' + encodeURIComponent(id) + '" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
          strip.appendChild(box);
        });
      }

      render();
      setInterval(() => {
        start = (start + 1) % ids.length; // 1-2-3 -> 2-3-4
        render();
      }, 7000);
    })();
  })();

})(); // IIFE SONU
