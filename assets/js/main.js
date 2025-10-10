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

// ------- Yardımcı: güvenli fetch
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
async function safeGetHTML(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    console.warn('HTML yüklenemedi:', url, e);
    return null;
  }
}

// ------- BLOG (blog.html içinden son 3 yazıyı çek)
async function loadBlog() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  const html = await safeGetHTML('/blog.html');
  let posts = [];
  if (html) {
    const dom = new DOMParser().parseFromString(html, 'text/html');
    // blog.html yapına göre: her yazı .blog-post içinde, başlık <h2>, özet ilk <p>, görsel .blog-image img
    const items = Array.from(dom.querySelectorAll('.blog-content .blog-post')).slice(0, 3);
    posts = items.map(el => {
      const titleEl = el.querySelector('.blog-info h2');
      const pEl = el.querySelector('.blog-info p');
      const imgEl = el.querySelector('.blog-image img');
      const urlEl = el.querySelector('.blog-info .blog-read-more');

      return {
        title: titleEl?.textContent?.trim() || 'Blog Yazısı',
        image: imgEl?.getAttribute('src') || '/img/uploads/data/sample1.webp',
        url: urlEl?.getAttribute('href') || 'blog.html',
        excerpt: (pEl?.textContent || 'Detaylar için yazıyı okuyun.').trim()
      };
    });
  }

  // Eğer blog.html okunamazsa yedek içerik
  if (!posts.length) {
    posts = [
      {
        title: "Kedilerde Aşı Takvimi: İlk Yılda Neler Yapılır?",
        image: "/img/uploads/data/sample1.webp",
        url: "blog.html#kedilerde-asi-takvimi",
        excerpt: "Yavru kedilerde temel aşılar, iç/dış parazit ve yıllık hatırlatmalar hakkında kısa rehber."
      },
      {
        title: "Köpeklerde Diş Taşı Temizliği Neden Önemli?",
        image: "/img/uploads/data/sample1.webp",
        url: "blog.html#kopek-dis-sagligi",
        excerpt: "Ağız kokusu, diş taşı ve periodontal hastalıkların önlenmesi için ipuçları."
      },
      {
        title: "Acil Durum Rehberi: Hemen Kliniğe Gelmeniz Gereken 6 Belirti",
        image: "/img/uploads/data/sample1.webp",
        url: "blog.html#acil-durum-rehberi",
        excerpt: "Zehirlenme, solunum güçlüğü, travma gibi durumlarda ilk adımlar."
      }
    ];
  }

  grid.innerHTML = '';
  posts.forEach(p => {
    const title = p.title || 'Blog Yazısı';
    const img = p.image || p.cover || '/img/uploads/data/sample1.webp';
    const url = p.url || 'blog.html';
    const text = (p.excerpt || '').toString().replace(/<[^>]+>/g, '');
    const excerpt = text.length > 160 ? text.slice(0, 160) + '…' : text;

    grid.insertAdjacentHTML('beforeend', `
      <article class="blog-card">
        <div class="thumb"><img src="${img}" alt="${title}" loading="lazy" decoding="async"></div>
        <div class="body">
          <h3>${title}</h3>
          <p>${excerpt}</p>
          <p style="margin-top:8px"><a class="link" href="${url}">Devamını oku <i class="fa-solid fa-arrow-right"></i></a></p>
        </div>
      </article>
    `);
  });
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

// ------- Google Reviews (statik JSON)
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

// ------- Instagram (statik JSON)
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
    const img = it.image || '/img/uploads/data/sample1.webp';
    const url = it.url || 'https://www.instagram.com/elcivetklinigi/';
    const alt = it.alt || '';
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
