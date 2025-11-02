// assets/js/blog.js  (v2)
(function(){
  const PAGE_SIZE = 6;

  // Elemanlar
  const blogSection = document.querySelector('section#blog');
  if(!blogSection) return;

  const src          = blogSection.getAttribute('data-json') || '/assets/data/blog.json';
  const gridEl       = document.getElementById('blogGrid');
  const searchEl     = document.getElementById('blogSearch');
  const paginationEl = document.getElementById('blogPagination');

  // Durum
  let allPosts = [];
  let filtered = [];
  let currentPage = 1;
  let totalPages  = 1;
  let q = '';

  // Yardımcılar
  const isPublished = iso => {
    try { return new Date(iso) <= new Date(); }
    catch { return true; }
  };
  const fmtDate = iso => {
    try { return new Date(iso).toLocaleDateString('tr-TR',{year:'numeric',month:'long',day:'numeric'}); }
    catch { return iso; }
  };

  function postCard(p){
    const cover = p.cover ? `<img src="${p.cover}" alt="${p.title}">` : '';
    return `
    <article class="b-card">
      <a class="b-cover" href="${p.url}">${cover}</a>
      <div class="b-body">
        <h3 class="b-title"><a href="${p.url}">${p.title}</a></h3>
        <div class="b-meta">${fmtDate(p.date)}</div>
        <p class="b-summary">${p.summary ?? ''}</p>
        <div class="b-actions">
          <a class="btn primary" href="${p.url}">Oku</a>
        </div>
      </div>
    </article>`;
  }

  function applyFilters(){
    const term = (q || '').trim().toLowerCase();

    filtered = allPosts.filter(p=>{
      if(!p || !p.title || !p.date || !p.url) return false;
      if(!isPublished(p.date)) return false;
      if(!term) return true;
      const hay = [
        p.title, p.summary, p.content,
        (p.category||''), ...(p.tags||[])
      ].join(' ').toLowerCase();
      return hay.includes(term);
    });

    totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if(currentPage > totalPages) currentPage = totalPages;
  }

  function renderPage(n){
    currentPage = Math.max(1, Math.min(n, totalPages));
    const start = (currentPage - 1) * PAGE_SIZE;
    const end   = start + PAGE_SIZE;
    const slice = filtered.slice(start, end);

    gridEl.innerHTML = slice.length
      ? slice.map(postCard).join('')
      : `<p class="muted">Eşleşen içerik bulunamadı.</p>`;

    buildPagination();
    gridEl.scrollIntoView({behavior:'smooth', block:'start'});

    // URL paramlarını güncelle
    const url = new URL(window.location);
    if(q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    url.searchParams.set('page', String(currentPage));
    window.history.replaceState({}, '', url);
  }

  function buildPagination(){
    if(!paginationEl) return;
    if(totalPages <= 1){ paginationEl.innerHTML=''; return; }

    const parts = [];
    // Prev
    parts.push(`<button class="prev" ${currentPage===1?'aria-disabled="true"':''} data-goto="${currentPage-1}" aria-label="Önceki sayfa">‹</button>`);

    // Akıllı kısaltma: 1 … k-1 k k+1 … N
    const windowSize = 1;
    const pages = [];
    for(let i=1;i<=totalPages;i++){
      if(i===1 || i===totalPages || Math.abs(i-currentPage)<=windowSize){
        pages.push(i);
      }
    }
    let last = 0;
    const pushPage = n => parts.push(
      `<button class="page" ${n===currentPage?'aria-current="page"':''} data-goto="${n}">${n}</button>`
    );

    pages.forEach(p=>{
      if(p - last > 1) parts.push(`<span class="ellipsis">…</span>`);
      pushPage(p);
      last = p;
    });

    // Next
    parts.push(`<button class="next" ${currentPage===totalPages?'aria-disabled="true"':''} data-goto="${currentPage+1}" aria-label="Sonraki sayfa">›</button>`);

    paginationEl.innerHTML = parts.join('');
    paginationEl.querySelectorAll('[data-goto]').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const n = Number(e.currentTarget.dataset.goto);
        if(!Number.isNaN(n)) renderPage(n);
      });
    });
  }

  function readURLParams(){
    const url = new URL(window.location);
    const qp  = url.searchParams.get('page');
    const qq  = url.searchParams.get('q');
    const n   = Number(qp || '1');
    if(qq){ q = qq; if(searchEl) searchEl.value = qq; }
    return (!Number.isNaN(n) && n>=1) ? n : 1;
  }

  // Başlat
  fetch(src, {cache:'no-store'})
    .then(r=>r.json())
    .then(data=>{
      allPosts = (data.posts || [])
        .slice()
        .sort((a,b)=> new Date(b.date) - new Date(a.date));

      currentPage = readURLParams();
      applyFilters();
      renderPage(currentPage);
    })
    .catch(err=>{
      console.error('Blog verisi yüklenemedi:', err);
      if(gridEl) gridEl.innerHTML = `<p class="muted">Blog verileri yüklenemedi.</p>`;
      if(paginationEl) paginationEl.innerHTML = '';
    });

  // Arama
  if(searchEl){
    let t;
    searchEl.addEventListener('input', ()=>{
      clearTimeout(t);
      t = setTimeout(()=>{
        q = searchEl.value || '';
        currentPage = 1;
        applyFilters();
        renderPage(currentPage);
      }, 160);
    });
  }
})();
