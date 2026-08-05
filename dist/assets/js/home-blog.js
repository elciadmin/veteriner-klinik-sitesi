(() => {
  'use strict';

  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const isVisible = post => {
    if (!post || post.published === false) return false;
    const now = Date.now();
    const start = post.date ? new Date(post.date).getTime() : 0;
    const end = post.unpublishAt ? new Date(post.unpublishAt).getTime() : 0;
    return (!start || start <= now) && (!end || end > now);
  };

  function card(post) {
    const cover = post.cover || '/assets/img/uploads/elci-logo.png';
    return `<article class="elci-blog-card home-blog-card">
      <a class="elci-blog-cover" href="${esc(post.url || '/blog.html')}" aria-label="${esc(post.title)} yazısını oku">
        <img src="${esc(cover)}" alt="" loading="lazy" decoding="async" onerror="this.src='/assets/img/uploads/elci-logo.png'">
      </a>
      <div class="elci-blog-body">
        <div class="elci-blog-meta"><span>${esc(post.category || 'Sağlık Rehberi')}</span><span>${esc(post.dateLabel || '')}</span></div>
        <h3><a href="${esc(post.url || '/blog.html')}">${esc(post.title)}</a></h3>
        <p>${esc(post.summary || '')}</p>
        <a class="elci-blog-read" href="${esc(post.url || '/blog.html')}">Yazıyı oku <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </div>
    </article>`;
  }

  fetch('/assets/data/blog.json?v=20260721', { cache:'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Blog verisi yüklenemedi');
      return response.json();
    })
    .then(data => {
      const posts = (Array.isArray(data) ? data : data.posts || [])
        .filter(isVisible)
        .sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 3);
      grid.innerHTML = posts.length
        ? posts.map(card).join('')
        : '<div class="home-blog-empty"><strong>Yeni sağlık notlarımız hazırlanıyor.</strong><span>Yakında burada yayınlanacak.</span></div>';
    })
    .catch(() => {
      grid.innerHTML = '<div class="home-blog-empty"><strong>Yazılar şu anda yüklenemedi.</strong><a href="/blog.html">Blog sayfasını açın</a></div>';
    });
})();
