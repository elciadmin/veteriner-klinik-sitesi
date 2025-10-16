document.addEventListener('DOMContentLoaded', async () => {
  // Mobil menü (varsa)
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mainMenu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const show = menu.classList.toggle('show');
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
    });
  }

  // Instagram grid
  try {
    const res = await fetch('assets/data/instagram.json', { cache: 'no-store' });
    const items = await res.json();
    const grid = document.getElementById('instaGrid');
    if (grid && Array.isArray(items)) {
      const base = 'assets/img/insta/';
      // En fazla 18–24 görsel göster; istersen sayıyı artır.
      const slice = items.slice(0, 24);
      grid.innerHTML = slice.map(({file, alt}) => `
        <a href="https://www.instagram.com/elcivetklinigi/" target="_blank" rel="noopener"
           style="display:block;border-radius:12px;overflow:hidden;border:1px solid #e6eef7">
          <img src="${base}${file}" alt="${alt||'Elçi Veteriner'}" loading="lazy"
               onerror="this.remove()">
        </a>
      `).join('');
    }
  } catch (e) {
    // sessiz geç
  }

  // Blog kartları (blog.json varsa)
  try {
    const res = await fetch('assets/data/blog.json', { cache: 'no-store' });
    if (res.ok) {
      const posts = await res.json();
      const grid = document.getElementById('blogGrid');
      if (grid && Array.isArray(posts)) {
        grid.innerHTML = posts.slice(0,3).map(p => `
          <article class="blog-card">
            <div class="thumb">${p.image ? `<img src="${p.image}" alt="${p.title||''}" loading="lazy">` : ''}</div>
            <div class="body">
              <h3>${p.title||''}</h3>
              <p>${p.excerpt||''}</p>
            </div>
          </article>
        `).join('');
      }
    }
  } catch {}
});
