// ------- Mobil menü + dropdown (ARIA)
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mainMenu = document.getElementById('mainMenu');
if (mobileMenuBtn && mainMenu) {
  mobileMenuBtn.addEventListener('click', () => {
    const shown = mainMenu.classList.toggle('show');
    mobileMenuBtn.setAttribute('aria-expanded', shown ? 'true' : 'false');
  });
  document.querySelectorAll('#mainMenu .dropdown > a').forEach(a => {
    a.addEventListener('click', e => {
      if (window.innerWidth <= 992) { e.preventDefault(); a.parentElement.classList.toggle('active'); }
    });
  });
}

// ------- Dokunmatik flip
function enableTouchFlip() {
  if (window.innerWidth <= 992) {
    document.querySelectorAll('.flip-card').forEach(card => {
      card.addEventListener('click', () =>
        card.querySelector('.flip-card-inner')?.classList.toggle('is-flipped')
      );
    });
  }
}
enableTouchFlip();
window.addEventListener('resize', enableTouchFlip);

// ------- Yardımcı: güvenli fetch (CORS & JSON hata yakalama)
async function safeGetJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('JSON yüklenemedi:', url, e);
    return null;
  }
}

// ======= BLOG (blog.html içinden çek) =======
async function loadBlog() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  try {
    const res = await fetch('/blog.html', { cache: 'no-store' });
    if (!res.ok) throw new Error('blog.html bulunamadı');
    const html = await res.text();
    const dom = new DOMParser().parseFromString(html, 'text/html');

    // Esnek seçiciler: blog.html'deki olası yapıları dener
    let items = Array.from(dom.querySelectorAll(
      '#blog-list article, #blog-list li,' +
      '.blog-list article, .blog-list li,' +
      '.posts article, .posts li,' +
      '.blog-grid article, article'
    )).filter(el => el.querySelector('h2 a, h3 a, h2, h3'));

    // Tekrarlı öğeleri linke göre ayıkla
    const seen = new Set();
    items = items.filter(el => {
      const a = el.querySelector('h2 a, h3 a, a[href*="blog"]');
      const href = a?.getAttribute('href') || '';
      const key = href || el.textContent.trim().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // İlk 3 yazıyı çıkar
    const posts = items.slice(0, 3).map(el => {
      const a = el.querySelector('h2 a, h3 a, a[href*="blog"]');
      const titleEl = el.querySelector('h2, h3, .title');
      const imgEl = el.querySelector('img');
      const pEl = el.querySelector('p, .excerpt, .summary');

      const title = (a?.textContent || titleEl?.textContent || 'Blog Yazısı').trim();

      // Bağlantıyı kökten ver (/) — göreliyse köke çevir
      let url = (a?.getAttribute('href') || '/blog.html').trim();
      if (url && !/^https?:\/\//.test(url) && !url.startsWith('/')) {
        url = '/' + url.replace(/^\.?\//, '');
      }

      // Görsel: varsa kullan; yoksa fallback
      let image = imgEl?.getAttribute('src') || '/img/uploads/data/sample1.webp';
      if (image && !/^https?:\/\//.test(image) && !image.startsWith('/')) {
        image = '/' + image.replace(/^\.?\//, '');
      }

      const raw = (pEl?.textContent || '').trim();
      const excerpt = raw ? (raw.length > 160 ? raw.slice(0, 160) + '…' : raw) : 'Detaylar için yazıyı okuyun.';

      return { title, url, image, excerpt };
    });

    // Hiç post bulunamazsa fallback
    const finalPosts = posts.length ? posts : [
      {
        title: 'Blog Yazıları',
        image: '/img/uploads/data/sample1.webp',
        url: '/blog.html',
        excerpt: 'Güncel yazılarımızı blog sayfamızda okuyabilirsiniz.'
      }
    ];

    grid.innerHTML = '';
    finalPosts.forEach(p => {
      grid.insertAdjacentHTML('beforeend', `
        <article class="blog-card">
          <div class="thumb"><img src="${p.image}" alt="${p.title}" loading="lazy" decoding="async"></div>
          <div class="body">
            <h3>${p.title}</h3>
            <p>${p.excerpt}</p>
            <p style="margin-top:8px"><a class="link" href="${p.url}">Devamını oku <i class="fa-solid fa-arrow-right"></i></a></p>
          </div>
        </article>
      `);
    });

  } catch (e) {
    console.warn('Blog özetleri alınamadı:', e);
    grid.innerHTML = `
      <article class="blog-card">
        <div class="thumb"><img src="/img/uploads/data/sample1.webp" alt="Blog" loading="lazy" decoding="async"></div>
        <div class="body">
          <h3>Blog Yazıları</h3>
          <p>Güncel yazılarımızı blog sayfamızda okuyabilirsiniz.</p>
          <p style="margin-top:8px"><a class="link" href="/blog.html">Bloga git <i class="fa-solid fa-arrow-right"></i></a></p>
        </div>
      </article>
    `;
  }
}
loadBlog();

// ------- About özetleri (about.html içinden çek)
async function loadAboutSnippets() {
  const elciBox = document.querySelector('#elciKimdirCard .content');
  const misyonBox = document.querySelector('#misyonVizyonCard .content');
  if (!elciBox || !misyonBox) return;

  try {
    const res = await fetch('/about.html', { cache: 'no-store' });
    if (!res.ok) throw new Error('404');
    const html = await res.text();
    const dom = new DOMParser().parseFromString(html, 'text/html');

    const pick = (sel, fallback) => {
      const n = dom.querySelector(sel);
      if (!n) return fallback;
      const text = n.textContent.trim().replace(/\s+/g, ' ');
      const words = text.split(' ');
      return words.slice(0, 90).join(' ') + (words.length > 90 ? '…' : '');
    };

    elciBox.textContent = pick('#elci-kimdir', 'Kliniğimizin kurucusu ve değerleri hakkında bilgi için tıklayın.');
    misyonBox.textContent = pick('#misyon-vizyon', 'Misyon ve vizyonumuz hakkında detaylar için tıklayın.');
  } catch (e) {
    elciBox.textContent = 'Kliniğimizin kurucusu ve değerleri hakkında bilgi için tıklayın.';
    misyonBox.textContent = 'Misyon ve vizyonumuz hakkında detaylar için tıklayın.';
  }
}
loadAboutSnippets();

// ------- Google Reviews
async function loadReviews() {
  const grid = document.getElementById('reviewsGrid');
  const summary = document.getElementById('ratingSummary');
  if (!grid || !summary) return;

  const data = await safeGetJSON('/assets/data/reviews.json');
  if (!data) {
    grid.insertAdjacentHTML('beforeend', '<p>Yorumlar yüklenemedi.</p>');
    return;
  }

  const rating = Number(data.aggregate?.ratingValue || 5);
  const count = Number(data.aggregate?.reviewCount || (data.items?.length || 0));
  summary.innerHTML = `
    <strong style="font-size:20px">${rating.toFixed(1)}</strong>
    <span aria-label="5 üzerinden ${rating} yıldız">${'★'.repeat(5)}</span>
    <span>(${count} yorum)</span>
  `;

  grid.innerHTML = '';
  (data.items || []).slice(0, 6).forEach(r => {
    const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
    grid.insertAdjacentHTML('beforeend', `
      <article class="about-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong>${r.author || 'Anonim'}</strong>
          <span aria-label="${r.rating || 5} yıldız">${stars}</span>
        </div>
        <p style="color:#4b5563">${(r.text || '').toString()}</p>
        <small style="opacity:.7">${r.date || ''}</small>
        ${r.url ? `<div style="margin-top:8px"><a class="link" href="${r.url}" target="_blank" rel="noopener">Google’da gör →</a></div>` : ''}
      </article>
    `);
  });

  // SEO: AggregateRating JSON-LD
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Elçi Veteriner Kliniği",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": rating,
      "reviewCount": count
    }
  });
  document.body.appendChild(ld);
}
loadReviews();

// ------- Instagram
async function loadInstagram() {
  const grid = document.getElementById('instaGrid');
  if (!grid) return;

  const items = await safeGetJSON('/assets/data/instagram.json');
  if (!Array.isArray(items) || !items.length) {
    grid.insertAdjacentHTML('beforeend', '<p>Instagram akışı yüklenemedi.</p>');
    return;
  }

  grid.innerHTML = '';
  items.slice(0, 12).forEach(it => {
    let img = it.image || '/img/uploads/data/sample1.webp';
    let url = it.url || '#';
    const alt = it.alt || '';

    if (img && !/^https?:\/\//.test(img) && !img.startsWith('/')) {
      img = '/' + img.replace(/^\.?\//, '');
    }
    if (url && !/^https?:\/\//.test(url) && !url.startsWith('/')) {
      url = '/' + url.replace(/^\.?\//, '');
    }

    grid.insertAdjacentHTML('beforeend', `
      <a href="${url}" target="_blank" rel="noopener"
         style="display:block;aspect-ratio:1/1;border-radius:10px;overflow:hidden;border:1px solid #e6eef7">
        <img src="${img}" alt="${alt}"
             style="width:100%;height:100%;object-fit:cover" loading="lazy" decoding="async">
      </a>
    `);
  });
}
loadInstagram();
