// assets/js/blog.js — Elçi Veteriner Kliniği (v3)
(function () {
  'use strict';

  const PAGE_SIZE = 5;
  const FALLBACK_COVER = '/assets/img/uploads/elci-logo.png?v=3';

  const blogSection = document.querySelector('section#blog');
  if (!blogSection) return;

  const src = blogSection.getAttribute('data-json') || '/assets/data/blog.json';
  const gridEl = document.getElementById('blogGrid');
  const searchEl = document.getElementById('blogSearch');
  const filtersEl = document.getElementById('blogFilters');
  const paginationEl = document.getElementById('blogPagination');
  const recentEl = document.getElementById('sidebarRecent');

  if (!gridEl) return;

  let allPosts = [];
  let filtered = [];
  let currentPage = 1;
  let totalPages = 1;
  let query = '';
  let selectedCategory = 'Tümü';
  let firstRender = true;

  injectLayoutFixes();

  function localeValue(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      if (typeof value.tr === 'string') return value.tr;
      for (const key of Object.keys(value)) {
        if (typeof value[key] === 'string') return value[key];
      }
    }
    return String(value);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function slugify(value) {
    return localeValue(value)
      .trim()
      .toLocaleLowerCase('tr-TR')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'blog-yazisi';
  }

  function normalizeList(value) {
    if (Array.isArray(value)) {
      return value.map(localeValue).map(item => item.trim()).filter(Boolean);
    }
    const single = localeValue(value).trim();
    return single ? [single] : [];
  }

  function normalizePost(raw, index) {
    const title = localeValue(raw?.title || raw?.baslik).trim();
    const slug = localeValue(raw?.slug).trim() || slugify(title) + '-' + (index + 1);
    const date = raw?.scheduledAt || raw?.date || raw?.tarih || '';
    const categories = normalizeList(raw?.categories || raw?.category || raw?.kategori);
    const tags = normalizeList(raw?.tags || raw?.etiketler);
    const suppliedUrl = localeValue(raw?.url).trim();

    return {
      ...raw,
      title,
      slug,
      date,
      summary: localeValue(raw?.summary || raw?.excerpt || raw?.ozet || raw?.description),
      content: localeValue(raw?.content || raw?.body || raw?.icerik || raw?.metin),
      cover: localeValue(
        raw?.cover || raw?.image || raw?.thumbnail || raw?.featuredImage ||
        raw?.gorsel || raw?.resim
      ).trim(),
      categories,
      tags,
      published: raw?.published !== false,
      url: suppliedUrl || ('/blog.html#' + encodeURIComponent(slug))
    };
  }

  function validDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isPublished(post) {
    if (!post || post.published === false || !post.title) return false;
    const date = validDate(post.date);
    return !date || date <= new Date();
  }

  function formatDate(value) {
    const date = validDate(value);
    if (!date) return escapeHtml(value || '');
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function primaryCategory(post) {
    return post.categories[0] || 'Genel';
  }

  function cardHtml(post, index) {
    const title = escapeHtml(post.title);
    const summary = escapeHtml(post.summary);
    const category = escapeHtml(primaryCategory(post));
    const href = escapeHtml(post.url);
    const cover = escapeHtml(post.cover || FALLBACK_COVER);
    const isFallback = !post.cover;
    const loading = index === 0 && currentPage === 1 ? 'eager' : 'lazy';

    return `
      <article class="b-card" data-blog-slug="${escapeHtml(post.slug)}">
        <a class="b-cover" href="${href}" aria-label="${title} yazısını oku">
          <img
            src="${cover}"
            alt="${isFallback ? 'Elçi Veteriner Kliniği' : title}"
            loading="${loading}"
            decoding="async"
            class="${isFallback ? 'is-cover-fallback' : ''}">
          <span class="b-badge">${category}</span>
        </a>
        <div class="b-body">
          <h3 class="b-title"><a href="${href}">${title}</a></h3>
          <div class="b-meta">${formatDate(post.date)}</div>
          <p class="b-summary">${summary}</p>
          <div class="b-actions">
            <a class="btn primary" href="${href}">Oku</a>
          </div>
        </div>
      </article>`;
  }

  function applyImageFallbacks() {
    gridEl.querySelectorAll('.b-cover img').forEach(image => {
      const applyFallback = () => {
        if (image.dataset.fallbackApplied === '1') return;
        image.dataset.fallbackApplied = '1';
        image.classList.add('is-cover-fallback');
        image.src = FALLBACK_COVER;
        image.alt = 'Elçi Veteriner Kliniği';
      };

      image.addEventListener('error', applyFallback, { once: true });
      if (image.complete && image.naturalWidth === 0) applyFallback();
    });
  }

  function matchesCategory(post) {
    if (selectedCategory === 'Tümü') return true;
    return post.categories.some(category =>
      category.toLocaleLowerCase('tr-TR') === selectedCategory.toLocaleLowerCase('tr-TR')
    );
  }

  function applyFilters() {
    const term = query.trim().toLocaleLowerCase('tr-TR');

    filtered = allPosts.filter(post => {
      if (!isPublished(post) || !matchesCategory(post)) return false;
      if (!term) return true;

      const searchable = [
        post.title,
        post.summary,
        post.content,
        ...post.categories,
        ...post.tags
      ].join(' ').toLocaleLowerCase('tr-TR');

      return searchable.includes(term);
    });

    totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
  }

  function setGridMode(items) {
    const featured = currentPage === 1 && items.length > 1 && !query && selectedCategory === 'Tümü';
    gridEl.classList.toggle('blog-grid-featured', featured);
    gridEl.classList.toggle('blog-grid-standard', !featured);
  }

  function renderPage(page, options = {}) {
    currentPage = Math.max(1, Math.min(Number(page) || 1, totalPages));

    const start = (currentPage - 1) * PAGE_SIZE;
    const items = filtered.slice(start, start + PAGE_SIZE);

    setGridMode(items);

    gridEl.innerHTML = items.length
      ? items.map(cardHtml).join('')
      : `<p class="blog-empty-state">
           Eşleşen içerik bulunamadı.
         </p>`;

    applyImageFallbacks();
    buildPagination();
    updateUrl();

    if (options.scroll && !firstRender) {
      blogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    firstRender = false;
  }

  function buildPagination() {
    if (!paginationEl) return;

    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    const parts = [];
    parts.push(`
      <button class="prev"
        ${currentPage === 1 ? 'disabled aria-disabled="true"' : ''}
        data-goto="${currentPage - 1}"
        aria-label="Önceki sayfa">‹</button>`);

    const pages = [];
    for (let page = 1; page <= totalPages; page += 1) {
      if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
        pages.push(page);
      }
    }

    let previous = 0;
    pages.forEach(page => {
      if (page - previous > 1) parts.push('<span class="ellipsis">…</span>');
      parts.push(`
        <button class="page"
          ${page === currentPage ? 'aria-current="page"' : ''}
          data-goto="${page}">${page}</button>`);
      previous = page;
    });

    parts.push(`
      <button class="next"
        ${currentPage === totalPages ? 'disabled aria-disabled="true"' : ''}
        data-goto="${currentPage + 1}"
        aria-label="Sonraki sayfa">›</button>`);

    paginationEl.innerHTML = parts.join('');
    paginationEl.querySelectorAll('[data-goto]:not([disabled])').forEach(button => {
      button.addEventListener('click', event => {
        renderPage(Number(event.currentTarget.dataset.goto), { scroll: true });
      });
    });
  }

  function categoryCounts() {
    const counts = new Map();
    allPosts.filter(isPublished).forEach(post => {
      post.categories.forEach(category => {
        counts.set(category, (counts.get(category) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'));
  }

  function renderCategoryFilters() {
    if (!filtersEl) return;

    const entries = categoryCounts();
    const buttons = [
      `<button type="button" class="b-chip ${selectedCategory === 'Tümü' ? 'b-chip-active' : ''}" data-category="Tümü">Tümü</button>`,
      ...entries.map(([category, count]) => `
        <button type="button"
          class="b-chip ${selectedCategory === category ? 'b-chip-active' : ''}"
          data-category="${escapeHtml(category)}">
          ${escapeHtml(category)} (${count})
        </button>`)
    ];

    filtersEl.innerHTML = buttons.join('');
    filtersEl.querySelectorAll('[data-category]').forEach(button => {
      button.addEventListener('click', () => {
        selectedCategory = button.dataset.category || 'Tümü';
        currentPage = 1;
        renderCategoryFilters();
        applyFilters();
        renderPage(1, { scroll: true });
      });
    });
  }

  function renderRecentPosts() {
    if (!recentEl) return;

    const recent = allPosts.filter(isPublished).slice(0, 5);
    recentEl.innerHTML = recent.length
      ? recent.map(post => `
          <a href="${escapeHtml(post.url)}">
            <i class="fa-regular fa-file-lines" aria-hidden="true"></i>
            <span>${escapeHtml(post.title)}</span>
          </a>`).join('')
      : '<span class="muted">Henüz yazı bulunmuyor.</span>';
  }

  function patchRecentLinks() {
    if (!recentEl) return;

    recentEl.querySelectorAll('a').forEach(link => {
      const title = link.querySelector('span')?.textContent?.trim() || link.textContent.trim();
      const post = allPosts.find(item =>
        item.title.toLocaleLowerCase('tr-TR') === title.toLocaleLowerCase('tr-TR')
      );
      if (post) link.href = post.url;
    });
  }

  function observeRecentBox() {
    if (!recentEl || !('MutationObserver' in window)) return;
    const observer = new MutationObserver(patchRecentLinks);
    observer.observe(recentEl, { childList: true, subtree: true });
  }

  function readUrl() {
    const url = new URL(window.location.href);
    const page = Number(url.searchParams.get('page') || '1');
    const q = url.searchParams.get('q') || '';
    const category = url.searchParams.get('cat') || 'Tümü';

    query = q;
    selectedCategory = category;
    if (searchEl) searchEl.value = q;

    return Number.isFinite(page) && page >= 1 ? page : 1;
  }

  function updateUrl() {
    const url = new URL(window.location.href);

    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');

    if (selectedCategory && selectedCategory !== 'Tümü') {
      url.searchParams.set('cat', selectedCategory);
    } else {
      url.searchParams.delete('cat');
    }

    if (currentPage > 1) url.searchParams.set('page', String(currentPage));
    else url.searchParams.delete('page');

    window.history.replaceState({}, '', url);
  }

  function injectLayoutFixes() {
    if (document.getElementById('elci-blog-v3-fixes')) return;

    const style = document.createElement('style');
    style.id = 'elci-blog-v3-fixes';
    style.textContent = `
      .blog-main,
      .blog-main #blog,
      #blogGrid{min-width:0;width:100%}

      #blogGrid .b-cover img.is-cover-fallback{
        object-fit:contain!important;
        padding:34px!important;
        box-sizing:border-box;
        background:
          radial-gradient(circle at 50% 30%,rgba(39,212,232,.15),transparent 55%),
          linear-gradient(145deg,#f8f4ff,#eefcff)!important;
      }

      #blogGrid.blog-grid-standard .b-card:first-child{
        grid-column:auto!important;
        display:flex!important;
        grid-template-columns:none!important;
        min-height:0!important;
        border-radius:24px!important;
        box-shadow:var(--shadow-sm)!important;
      }
      #blogGrid.blog-grid-standard .b-card:first-child .b-cover{
        height:auto!important;
        min-height:0!important;
        aspect-ratio:16/9!important;
      }
      #blogGrid.blog-grid-standard .b-card:first-child .b-body{
        justify-content:flex-start!important;
        padding:20px!important;
      }
      #blogGrid.blog-grid-standard .b-card:first-child .b-title{
        font-size:1.25rem!important;
        line-height:1.28!important;
      }
      #blogGrid.blog-grid-standard .b-card:first-child .b-summary{
        font-size:.9rem!important;
        line-height:1.62!important;
      }

      #blogGrid.blog-grid-standard .b-card:last-child:nth-child(odd),
      #blogGrid.blog-grid-featured .b-card:last-child:nth-child(even){
        grid-column:1/-1;
        display:grid;
        grid-template-columns:minmax(220px,.7fr) minmax(0,1.3fr);
      }
      #blogGrid.blog-grid-standard .b-card:last-child:nth-child(odd) .b-cover,
      #blogGrid.blog-grid-featured .b-card:last-child:nth-child(even) .b-cover{
        height:100%;
        min-height:230px;
        aspect-ratio:auto;
      }

      #blogGrid .blog-empty-state{
        grid-column:1/-1;
        margin:0;
        padding:24px;
        border:1px dashed rgba(90,31,168,.25);
        border-radius:18px;
        background:#fff;
        color:var(--muted);
      }

      @media(max-width:760px){
        #blogGrid.blog-grid-standard .b-card:last-child:nth-child(odd),
        #blogGrid.blog-grid-featured .b-card:last-child:nth-child(even){
          grid-column:auto;
          display:flex;
          grid-template-columns:none;
        }
        #blogGrid.blog-grid-standard .b-card:last-child:nth-child(odd) .b-cover,
        #blogGrid.blog-grid-featured .b-card:last-child:nth-child(even) .b-cover{
          height:auto;
          min-height:0;
          aspect-ratio:16/9;
        }
      }
    `;
    document.head.appendChild(style);
  }

  observeRecentBox();

  fetch(src + (src.includes('?') ? '&' : '?') + 'v=20260715-blog-v3', {
    cache: 'no-store'
  })
    .then(response => {
      if (!response.ok) throw new Error('Blog verisi yüklenemedi');
      return response.json();
    })
    .then(data => {
      const rawPosts = Array.isArray(data) ? data : (Array.isArray(data.posts) ? data.posts : []);

      allPosts = rawPosts
        .map(normalizePost)
        .filter(isPublished)
        .sort((a, b) => {
          const dateA = validDate(a.date)?.getTime() || 0;
          const dateB = validDate(b.date)?.getTime() || 0;
          return dateB - dateA;
        });

      currentPage = readUrl();
      renderCategoryFilters();
      renderRecentPosts();
      applyFilters();
      renderPage(currentPage);
    })
    .catch(error => {
      console.error('Blog verisi yüklenemedi:', error);
      gridEl.innerHTML = `
        <p class="blog-empty-state">
          Blog verileri şu anda yüklenemedi.
        </p>`;
      if (paginationEl) paginationEl.innerHTML = '';
    });

  if (searchEl) {
    let timer;
    searchEl.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        query = searchEl.value || '';
        currentPage = 1;
        applyFilters();
        renderPage(1, { scroll: true });
      }, 180);
    });
  }
})();
