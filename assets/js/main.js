// /js/main.js
console.log("[main] ready");

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

// ------- Güvenli JSON fetch
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

// ------- BLOG (opsiyonel, varsa doldurur)
async function loadBlog() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  const data = await safeGetJSON('/assets/data/blog.json');
  let posts = Array.isArray(data) ? data : (Array.isArray(data?.posts) ? data.posts : []);

  if (!posts.length) {
    posts = [
      {
        title: "Kedilerde Aşı Takvimi: İlk Yılda Neler Yapılır?",
        image: "/assets/img/uploads/sample1.webp",
        url: "blog.html#kedilerde-asi-takvimi",
        excerpt: "Yavru kedilerde temel aşılar, iç/dış parazit ve yıllık hatırlatmalar hakkında kısa rehber."
      },
      {
        title: "Köpeklerde Diş Taşı Temizliği Neden Önemli?",
        image: "/assets/img/uploads/sample1.webp",
        url: "blog.html#kopek-dis-sagligi",
        excerpt: "Ağız kokusu, diş taşı ve periodontal hastalıkların önlenmesi için ipuçları."
      },
      {
        title: "Acil Durum Rehberi: Hemen Kliniğe Gelmeniz Gereken 6 Belirti",
        image: "/assets/img/uploads/sample1.webp",
        url: "blog.html#acil-durum-rehberi",
        excerpt: "Zehirlenme, solunum güçlüğü, travma gibi durumlarda ilk adımlar."
      }
    ];
  }

  grid.innerHTML = '';
  posts.slice(0, 3).forEach(p => {
    const title = p.title || 'Blog Yazısı';
    const img = p.image || p.cover || '/assets/img/uploads/sample1.webp';
    const url = p.url || (p.slug ? `blog.html#${p.slug}` : 'blog.html');
    const raw = p.excerpt || p.ozet || p.summary || p.content || 'Detaylar için yazıyı okuyun.';
    const text = (raw || '').toString().replace(/<[^>]+>/g, '');
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
  console.log("[main] blog loaded:", posts.length);
}
loadBlog();

// ------- About özetleri
async function loadAboutSnippets() {
  const elciBox = document.querySelector('#elciKimdirCard .content');
  const misyonBox = document.querySelector('#misyonVizyonCard .content');
  if (!elciBox || !misyonBox) return;

  try {
    const res = await fetch('about.html', { cache: 'no-store' });
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
    console.log("[main] about snippets ok");
  } catch (e) {
    elciBox.textContent = 'Kliniğimizin kurucusu ve değerleri hakkında bilgi için tıklayın.';
    misyonBox.textContent = 'Misyon ve vizyonumuz hakkında detaylar için tıklayın.';
    console.warn("[main] about snippets fallback");
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
    <span aria-label="5 üzerinden ${rating} yıldız">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5-Math.round(rating))}</span>
    <span>(${count} yorum)</span>
  `;

  grid.innerHTML = '';
  const items = (data.items || []).slice(0, 6);
  if (!items.length) {
    grid.insertAdjacentHTML('beforeend','<p>Henüz yorum eklenmemiş.</p>');
  } else {
    items.forEach(r => {
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
  }

  // SEO JSON-LD
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

  console.log("[main] reviews loaded:", items.length);
}
loadReviews();

// ------- Instagram
async function loadInstagram() {
  const grid = document.getElementById('instaGrid');
  if (!grid) return;

  const items = await safeGetJSON('/assets/data/instagram.json');

  grid.innerHTML = '';
  let list = Array.isArray(items) ? items.slice(0, 12) : [];

  // Fallback: eğer boşsa sample görselle doldur
  if (!list.length) {
    list = Array.from({ length: 6 }).map((_, i) => ({
      image: "/assets/img/uploads/sample1.webp",
      url: "https://www.instagram.com/elcivetklinigi/",
      alt: `Klinikten bir kare ${i+1}`
    }));
  }

  list.forEach(it => {
    const img = it.image || '/assets/img/uploads/sample1.webp';
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

  console.log("[main] instagram loaded:", list.length);
}
loadInstagram();

// ------- YouTube küçük kontrol (iframe var mı?)
(function checkYouTube(){
  const ifr = document.querySelector('#youtube iframe');
  if (!ifr) {
    console.warn("[main] youtube iframe bulunamadı");
  } else {
    console.log("[main] youtube iframe var:", ifr.src);
  }
})();
