/* /js/main.js */
(() => {
  const log = (...args) => console.log('[main]', ...args);

  // Basit yardımcılar
  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const safeArr = (data) => {
    if (Array.isArray(data)) return data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.reviews && Array.isArray(data.reviews)) return data.reviews;
    if (data?.edges && Array.isArray(data.edges)) return data.edges;
    return [];
  };

  const text = (v, fallback='') => (v ?? fallback).toString();

  document.addEventListener('DOMContentLoaded', async () => {
    log('ready');

    // --- YouTube iFrame kontrolü
    const hasYT = !!qs('#youtube iframe[src*="youtube.com"]');
    log('youtube iframe var:', hasYT);

    // --- BLOG (dummy üç kart – istersen sonra JSON bağlarız)
    try {
      const blogWrap = qs('#blogGrid');
      if (blogWrap) {
        const posts = [
          { t: 'Kedi Aşı Takvimi 2025', d: 'Yavru ve yetişkin kediler için önerilen aşı planı.' },
          { t: 'Köpeklerde Diş Bakımı', d: 'Ağız kokusu ve diş taşı için günlük bakım rehberi.' },
          { t: 'Kısırlaştırma Sonrası Bakım', d: 'Operasyon sonrası beslenme ve yara bakımı.' },
        ];
        blogWrap.innerHTML = posts.map(p => `
          <article class="blog-card">
            <div class="thumb"></div>
            <div class="body">
              <h3>${p.t}</h3>
              <p>${p.d}</p>
            </div>
          </article>
        `).join('');
        log('blog loaded:', posts.length);
      }
    } catch (e) {
      console.error('[main] blog error:', e);
    }

    // --- ABOUT özet (about.html varsa başlıklardan küçük bir parça çekmeyi dener)
    try {
      const res = await fetch('/about.html', { method: 'GET' });
      if (res.ok) {
        const html = await res.text();
        const dom  = new DOMParser().parseFromString(html, 'text/html');

        const elci = qs('#elci-kimdir, h2#elci-kimdir', dom) || qs('[id*="elci"]', dom);
        const mis  = qs('#misyon-vizyon, h2#misyon-vizyon', dom) || qs('[id*="misyon"]', dom);

        const elciBox = qs('#elciKimdirCard .content');
        const misBox  = qs('#misyonVizyonCard .content');

        if (elci && elciBox) {
          // Başlıktan sonraki ilk paragrafı bul
          const para = elci.nextElementSibling && elci.nextElementSibling.tagName.startsWith('P')
            ? elci.nextElementSibling.textContent.trim()
            : '';
          elciBox.textContent = para || 'Hakkımızda içeriği yakında.';
        }
        if (mis && misBox) {
          const para = mis.nextElementSibling && mis.nextElementSibling.tagName.startsWith('P')
            ? mis.nextElementSibling.textContent.trim()
            : '';
          misBox.textContent = para || 'Misyon & vizyon içeriği yakında.';
        }

        log('about snippets ok (about.html varsa)');
      } else {
        log('about bulunamadı, özet atlandı');
      }
    } catch (e) {
      console.warn('[main] about fetch hatası (normal olabilir):', e);
    }

    // --- GOOGLE REVIEWS
    try {
      const revWrap = qs('#reviewsGrid');
      const sumWrap = qs('#ratingSummary');
      const r = await fetch('/assets/data/reviews.json');
      const j = await r.json().catch(() => ({}));
      const arr = safeArr(j);

      if (sumWrap) {
        // Ortalama hesapla (varsa)
        const ratings = arr.map(it => Number(it.rating || it.stars || it.score)).filter(n => !Number.isNaN(n) && n>0);
        const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : null;
        sumWrap.innerHTML = `
          <strong style="font-size:20px">${avg ? avg.toFixed(1) : '5.0'}</strong>
          <span> / 5 · ${arr.length || '10+'} yorum</span>
        `;
      }

      if (revWrap) {
        revWrap.innerHTML = (arr.length ? arr : [
          { author: 'Hasta Sahibi', text: 'Çok ilgili ve güler yüzlü bir ekip. Tavsiye ederim.', rating: 5 },
          { author: 'Ayşe K.', text: 'Acil durumda hızlı müdahale ettiler, teşekkür ederim.', rating: 5 },
          { author: 'Mehmet D.', text: 'Temiz klinik, şeffaf bilgilendirme.', rating: 4.8 },
        ]).slice(0, 6).map(it => {
          const name = text(it.author || it.user || it.profileName || 'Ziyaretçi');
          const msg  = text(it.text || it.comment || it.content || '');
          const star = Number(it.rating || it.stars || 5);
          return `
            <article class="about-card review-card">
              <h3 style="margin-bottom:6px">${name}</h3>
              <div style="color:#f59e0b;margin-bottom:8px">★ ${isFinite(star) ? star.toFixed(1) : '5.0'}</div>
              <p>${msg || 'Detaylı yorum bırakılmadı.'}</p>
            </article>
          `;
        }).join('');
      }

      log('reviews loaded:', arr.length || '(dummy)');
    } catch (e) {
      console.error('[main] reviews error:', e);
    }

    // --- INSTAGRAM
    try {
      const igWrap = qs('#instaGrid');
      const r = await fetch('/assets/data/instagram.json');
      const j = await r.json().catch(() => ({}));
      const arr = safeArr(j);

      if (igWrap) {
        const items = (arr.length ? arr : [
          { permalink: 'https://www.instagram.com/elcivetklinigi/', media_url: '/assets/img/uploads/og-cover.jpg' },
          { permalink: 'https://www.instagram.com/elcivetklinigi/', media_url: '/assets/img/uploads/og-cover.jpg' },
          { permalink: 'https://www.instagram.com/elcivetklinigi/', media_url: '/assets/img/uploads/og-cover.jpg' },
          { permalink: 'https://www.instagram.com/elcivetklinigi/', media_url: '/assets/img/uploads/og-cover.jpg' },
          { permalink: 'https://www.instagram.com/elcivetklinigi/', media_url: '/assets/img/uploads/og-cover.jpg' },
          { permalink: 'https://www.instagram.com/elcivetklinigi/', media_url: '/assets/img/uploads/og-cover.jpg' },
        ]).slice(0, 12);

        igWrap.innerHTML = items.map(it => {
          const href = it.permalink || it.link || 'https://www.instagram.com/elcivetklinigi/';
          const src  = it.media_url || it.thumbnail_url || it.url || '/assets/img/uploads/og-cover.jpg';
          const alt  = text(it.caption || 'Instagram görseli');
          return `
            <a href="${href}" target="_blank" rel="noopener" style="display:block;aspect-ratio:1/1;border-radius:10px;overflow:hidden">
              <img src="${src}" alt="${alt}" loading="lazy" style="width:100%;height:100%;object-fit:cover"/>
            </a>
          `;
        }).join('');
      }

      log('instagram loaded:', (Array.isArray(arr) && arr.length) ? arr.length : '(dummy)');
    } catch (e) {
      console.error('[main] instagram error:', e);
    }
  });
})();
