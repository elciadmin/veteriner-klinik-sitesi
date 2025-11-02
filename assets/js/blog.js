/* Elçi Veteriner - Blog motoru (blog.json → kartlar)
   - Desteklediği şemalar:
     Minimal: {title, date, summary, cover, content, url}
     Pro: {title, slug, date, scheduledAt, published, summary, cover, youtubeId, categories, tags, author, readingMinutes, seoTitle, seoDescription, url, content}
   - Nerede çalışır:
     1) /blog.html → #blogGrid  (opsiyonel: #blogFilters, #blogSearch)
     2) /index.html → #blogGrid (son 3 yazı)
   - Kaynak JSON yolu:
     <section id="blog" data-json="/assets/data/blog.json"> ... 
*/

(function () {
  const tz = 'Europe/Istanbul';

  // === Yardımcılar ===
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const parseDate = (iso) => {
    try { return iso ? new Date(iso) : null; } catch { return null; }
  };

  const fmtDate = (iso) => {
    const d = parseDate(iso);
    if (!d) return '';
    // Türkçe kısa biçim
    return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: tz });
  };

  const now = () => new Date(); // sunucu/istemci saati

  // İçerik uzunluğundan okuma süresi tahmini (yoksa)
  const calcReadingMin = (html) => {
    if (!html) return 3;
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text.split(' ').filter(Boolean).length;
    return Math.max(2, Math.round(words / 200)); // ~200 wpm
  };

  // Pro veya Minimal kaydı normalize et
  const norm = (p) => {
    const published = (typeof p.published === 'boolean') ? p.published : true;
    const scheduledAt = p.scheduledAt || p.date;
    return {
      title: p.title || 'Başlıksız',
      slug: p.slug || (p.url ? String(p.url).split('#').pop() : ''),
      date: p.date,
      scheduledAt,
      published,
      summary: p.summary || '',
      cover: p.cover || '',
      youtubeId: p.youtubeId || '',
      categories: p.categories || [],
      tags: p.tags || [],
      author: p.author || 'Elçi Veteriner',
      readingMinutes: p.readingMinutes || calcReadingMin(p.content || ''),
      url: p.url || (p.slug ? `/blog.html#${p.slug}` : '#'),
      content: p.content || ''
    };
  };

  // Yayın filtresi: published = true ve scheduledAt <= now
  const isLive = (post) => {
    if (!post.published) return false;
    const s = parseDate(post.scheduledAt || post.date);
    return s ? (s.getTime() <= now().getTime()) : true;
    // date bile yoksa göster
  };

  // JSON yükleyici (section[data-json] varsa orayı kullanır)
  async function loadJSONFromSection(sectionId = 'blog', fallbackPath = '/assets/data/blog.json') {
    const sec = document.getElementById(sectionId);
    const path = sec?.getAttribute('data-json') || fallbackPath;
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`blog.json yüklenemedi (${res.status})`);
    const data = await res.json();
    if (!data || !Array.isArray(data.posts)) throw new Error('Geçersiz blog.json');
    return data.posts.map(norm);
  }

  // Kart HTML’i
  function cardHTML(p) {
    const hasCover = !!p.cover;
    const hasVideo = !!p.youtubeId;
    const cats = p.categories.length ? `<div class="b-cats">${p.categories.map(c => `<span class="b-chip">${c}</span>`).join('')}</div>` : '';
    const badgeVideo = hasVideo ? `<span class="b-badge b-badge-video" title="Video içerik">▶</span>` : '';
    const cover = hasCover
      ? `<div class="b-cover">
           <img src="${p.cover}" alt="${p.title}" loading="lazy" decoding="async">
           ${badgeVideo}
         </div>`
      : (hasVideo
         ? `<div class="b-cover b-cover-video">
              <div class="b-cover-video-ph">${badgeVideo}</div>
            </div>`
         : '');

    return `
      <article class="b-card">
        ${cover}
        <div class="b-body">
          ${cats}
          <h3 class="b-title"><a href="${p.url}">${p.title}</a></h3>
          <div class="b-meta">
            <time datetime="${p.date}">${fmtDate(p.date)}</time>
            <span aria-hidden="true">•</span>
            <span>${p.readingMinutes} dk</span>
          </div>
          <p class="b-summary">${p.summary}</p>
          <div class="b-actions">
            <a class="btn ghost" href="${p.url}">Oku</a>
            ${hasVideo ? `<a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${p.youtubeId}">Videoyu Aç</a>` : ``}
          </div>
        </div>
      </article>
    `;
  }

  // Grid’e bas
  function renderGrid(posts, rootEl) {
    rootEl.innerHTML = posts.map(cardHTML).join('');
  }

  // Filtre kurulumu (/blog.html)
  function setupFilters(allPosts) {
    const filtWrap = document.getElementById('blogFilters');
    const grid = document.getElementById('blogGrid');
    const search = document.getElementById('blogSearch');

    if (!grid) return;

    // Kategori seti
    const cats = Array.from(
      new Set(allPosts.flatMap(p => p.categories || []))
    ).sort();

    // Filtre çipleri (Hepsi + kategoriler)
    if (filtWrap && cats.length) {
      filtWrap.innerHTML = [
        `<button class="b-chip b-chip-active" data-cat="*">Hepsi</button>`,
        ...cats.map(c => `<button class="b-chip" data-cat="${encodeURIComponent(c)}">${c}</button>`)
      ].join('');

      filtWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cat]');
        if (!btn) return;
        $$('.b-chip', filtWrap).forEach(b => b.classList.remove('b-chip-active'));
        btn.classList.add('b-chip-active');

        const cat = decodeURIComponent(btn.getAttribute('data-cat'));
        const q = (search?.value || '').toLowerCase();

        const filtered = allPosts.filter(p => {
          const inCat = cat === '*' || (p.categories || []).includes(cat);
          const inSearch = !q || (
            p.title.toLowerCase().includes(q) ||
            p.summary.toLowerCase().includes(q) ||
            (p.tags || []).some(t => t.toLowerCase().includes(q))
          );
          return inCat && inSearch;
        });

        renderGrid(filtered, grid);
      });
    }

    // Arama
    if (search) {
      let t;
      search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          const activeBtn = $('.b-chip-active', filtWrap) || $('[data-cat="*"]', filtWrap);
          activeBtn?.click();
          if (!filtWrap) {
            const q = search.value.toLowerCase();
            const filtered = allPosts.filter(p =>
              p.title.toLowerCase().includes(q) ||
              p.summary.toLowerCase().includes(q) ||
              (p.tags || []).some(t => t.toLowerCase().includes(q))
            );
            renderGrid(filtered, grid);
          }
        }, 150);
      });
    }
  }

  // Ana giriş noktaları
  async function setupBlog() {
    const blogSec = document.getElementById('blog');
    if (!blogSec) return; // sayfada blog bölümü yoksa çık

    const grid = document.getElementById('blogGrid');
    if (!grid) return;

    try {
      const all = await loadJSONFromSection('blog');
      const live = all.filter(isLive).sort((a, b) => (parseDate(b.date) - parseDate(a.date)));

      // blog.html mi, ana sayfa mı? (varsayım: blog.html’de filtre/arama alanları bulunur)
      const isBlogPage = !!document.getElementById('blogFilters') || location.pathname.endsWith('/blog.html');

      if (isBlogPage) {
        renderGrid(live, grid);
        setupFilters(live);
      } else {
        // Ana sayfa: son 3 yazı
        renderGrid(live.slice(0, 3), grid);
      }
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<p class="muted">Blog şu an yüklenemedi. Lütfen daha sonra tekrar deneyin.</p>`;
    }
  }

  // Başlat
  window.addEventListener('DOMContentLoaded', setupBlog);
})();
