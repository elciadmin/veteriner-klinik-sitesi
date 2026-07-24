(() => {
  'use strict';

  const root = document.getElementById('blog');
  const grid = document.getElementById('blogGrid');
  if (!root || !grid) return;

  const filters = document.getElementById('blogFilters');
  const search = document.getElementById('blogSearch');
  const pagination = document.getElementById('blogPagination');
  const recent = document.getElementById('sidebarRecent');
  const cats = document.getElementById('sidebarCats');
  const tagsHost = document.getElementById('sidebarTags');
  const pageSize = 6;
  let posts = [];
  let activeCategory = 'Tümü';
  let activePage = 1;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR');
  const now = () => Date.now();
  const isActive = post => {
    if (!post || post.published === false) return false;
    if (post.date && new Date(post.date).getTime() > now()) return false;
    if (post.unpublishAt && new Date(post.unpublishAt).getTime() <= now()) return false;
    return true;
  };
  const image = post => post.cover || '/assets/img/uploads/elci-logo.png';
  const url = post => post.url || `/blog/${encodeURIComponent(post.slug)}.html`;

  function filtered() {
    const term = normalize(search?.value).trim();
    return posts.filter(post => {
      if (activeCategory !== 'Tümü' && post.category !== activeCategory) return false;
      if (!term) return true;
      return normalize([post.title, post.summary, post.category, post.species, ...(post.tags || [])].join(' ')).includes(term);
    });
  }

  function card(post) {
    return `<article class="elci-blog-card">
      <a class="elci-blog-cover" href="${esc(url(post))}" aria-label="${esc(post.title)} yazısını oku">
        <img src="${esc(image(post))}" alt="${esc(post.title)}" loading="lazy" decoding="async" onerror="this.src='/assets/img/uploads/elci-logo.png'">
      </a>
      <div class="elci-blog-body">
        <div class="elci-blog-meta">
          <span class="elci-blog-category">${esc(post.category || 'Genel')}</span>
          <span>${esc(post.dateLabel || '')}</span>
        </div>
        <h3><a href="${esc(url(post))}">${esc(post.title)}</a></h3>
        <p>${esc(post.summary || '')}</p>
        <a class="elci-blog-link" href="${esc(url(post))}">Yazıyı oku <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </article>`;
  }

  function renderFilters() {
    if (!filters) return;
    const values = ['Tümü', ...new Set(posts.map(post => post.category).filter(Boolean))];
    filters.innerHTML = values.map(value => `<button type="button" class="blog-filter${value === activeCategory ? ' active' : ''}" data-category="${esc(value)}" aria-pressed="${value === activeCategory}">${esc(value)}</button>`).join('');
    filters.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      activeCategory = button.dataset.category || 'Tümü';
      activePage = 1;
      renderFilters();
      render();
    }));
  }

  function renderPagination(total) {
    if (!pagination) return;
    const pages = Math.ceil(total / pageSize);
    if (pages <= 1) { pagination.innerHTML = ''; return; }
    pagination.innerHTML = Array.from({ length: pages }, (_, index) => {
      const page = index + 1;
      return `<button type="button" class="${page === activePage ? 'active' : ''}" data-page="${page}" aria-label="${page}. sayfa">${page}</button>`;
    }).join('');
    pagination.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      activePage = Number(button.dataset.page) || 1;
      render();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function renderSidebar() {
    if (recent) recent.innerHTML = posts.slice(0, 5).map(post => `<a href="${esc(url(post))}">${esc(post.title)}</a>`).join('') || '<span class="muted">Henüz yazı yok.</span>';
    if (cats) {
      const counts = new Map();
      posts.forEach(post => counts.set(post.category || 'Genel', (counts.get(post.category || 'Genel') || 0) + 1));
      cats.innerHTML = [...counts.entries()].sort((a,b) => b[1]-a[1]).map(([name,count]) => `<button type="button" class="sidebar-pill" data-category="${esc(name)}">${esc(name)} (${count})</button>`).join('');
      cats.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        activeCategory = button.dataset.category || 'Tümü'; activePage = 1; renderFilters(); render(); root.scrollIntoView({behavior:'smooth'});
      }));
    }
    if (tagsHost) {
      const counts = new Map();
      posts.flatMap(post => post.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
      tagsHost.innerHTML = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 14).map(([tag,count]) => `<button type="button" class="sidebar-pill" data-tag="${esc(tag)}">${esc(tag)} (${count})</button>`).join('');
      tagsHost.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        if (search) search.value = button.dataset.tag || '';
        activeCategory = 'Tümü'; activePage = 1; renderFilters(); render(); root.scrollIntoView({behavior:'smooth'});
      }));
    }
  }

  function render() {
    const items = filtered();
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    if (activePage > pages) activePage = pages;
    const start = (activePage - 1) * pageSize;
    const visible = items.slice(start, start + pageSize);
    grid.innerHTML = visible.length ? visible.map(card).join('') : '<div class="blog-empty"><strong>Bu aramayla eşleşen yazı bulunamadı.</strong><br>Başka bir kelime veya kategori deneyin.</div>';
    renderPagination(items.length);
  }

  search?.addEventListener('input', () => { activePage = 1; render(); });

  fetch(root.dataset.json || '/assets/data/blog.json', { cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error(); return response.json(); })
    .then(data => {
      posts = (Array.isArray(data) ? data : data.posts || []).filter(isActive).sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
      renderFilters(); renderSidebar(); render();
    })
    .catch(() => { grid.innerHTML = '<div class="blog-empty">Yazılar şu anda yüklenemedi. Lütfen kısa süre sonra yeniden deneyin.</div>'; });
})();
