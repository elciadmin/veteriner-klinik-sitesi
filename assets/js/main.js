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

// ------- BLOG (blog.json varsa oradan, yoksa blog.html'i parse et, o da yoksa fallback)
async function loadBlog() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  let posts = [];
  const data = await safeGetJSON('/assets/data/blog.json');
  if (Array.isArray(data)) posts = data;
  else if (Array.isArray(data?.posts)) posts = data.posts;

  if (!posts.length) {
    try {
      const res = await fetch('blog.html', { cache: 'no-store' });
      if (res.ok) {
        const html = await res.text();
        const dom = new DOMParser().parseFromString(html, 'text/html');
        dom.querySelectorAll('.blog-post').forEach((art, i) => {
          const img = art.querySelector('.blog-image img')?.getAttribute('src') || '/assets/img/uploads/og-cover.jpg';
          const title = art.querySelector('.blog-info h2')?.textContent?.trim() || `Blog Yazısı ${i+1}`;
          const p = art.querySelector('.blog-info p')?.textContent?.trim() || '';
          const url = art.querySelector('.blog-read-more')?.getAttribute('href') || 'blog.html';
          posts.push({ title, image: img, url, excerpt: p });
        });
      }
    } catch (e) {
      console.warn('blog.html okunamadı', e);
    }
  }

  if (!posts.length) {
    posts = [
      {
        title: "Kedilerde Aşı Takvimi: İlk Yılda Neler Yapılır?",
        image: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?q=80&w=800&auto=format&fit=crop",
        url: "blog.html#kedilerde-asi-takvimi",
        excerpt: "Yavru kedilerde temel aşılar, iç/dış parazit ve yıllık hatırlatmalar hakkında kısa rehber."
      },
      {
        title: "Köpeklerde Diş Taşı Temizliği Neden Önemli?",
        image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop",
        url: "blog.html#kopek-dis-sagligi",
        excerpt: "Ağız kokusu, diş taşı ve periodontal hastalıkların önlenmesi için ipuçları."
      },
      {
        title: "Acil Durum Rehberi: Hemen Kliniğe Gelmeniz Gereken 6 Belirti",
        image: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?q=80&w=800&auto=format&fit=crop",
        url: "blog.html#acil-durum-rehberi",
        excerpt: "Zehirlenme, solunum güçlüğü, travma gibi durumlarda ilk adımlar."
      }
    ];
  }

  grid.innerHTML = '';
  posts.slice(0, 3).forEach(p => {
    const title = p.title || 'Blog Yazısı';
    const img = p.image || p.cover || "https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=800&auto=format&fit=crop";
    const url = p.url || (p.slug ? `blog.html#${p.slug}` : 'blog.html');
    const raw = p.excerpt || p.ozet || p.summary || p.content || '';
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
    misyonBox.textContent = 'Misyon ve vizyonumuz hakkında bilgi için tıklayın.';
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
    items.f
