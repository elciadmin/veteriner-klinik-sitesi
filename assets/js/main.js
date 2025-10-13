/* /assets/js/main.js */
(() => {
  const log = (...args) => console.log('[main]', ...args);

  // Kısayollar
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const text = (v, fb = '') => (v ?? fb).toString();

  // Güvenli dizi çözücü (reviews / instagram için)
  const safeArr = (data) => {
    if (Array.isArray(data)) return data;
    if (data?.items && Array.isArray(data.items)) return data.items;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.reviews && Array.isArray(data.reviews)) return data.reviews;
    return [];
  };

  // Instagram yardımcıları
  const shortcodeFromPermalink = (url) => {
    try {
      const u = new URL(url);
      // /p/XXXX/ ya da /reel/XXXX/
      const parts = u.pathname.split('/').filter(Boolean);
      const i = parts.findIndex((p) => p === 'p' || p === 'reel');
      if (i >= 0 && parts[i + 1]) return parts[i + 1];
    } catch (_) {}
    return null;
  };

  const localThumb = (item, idx) => {
    // instagram.json içinde "thumb" verilmişse onu kullan
    if (item.thumb) return item.thumb;

    // Yoksa permalinkten kısa kodu alıp /assets/img/uploads/insta-thumbs/{short}.webp dene
    const sc = shortcodeFromPermalink(item.permalink || item.link || '');
    if (sc) return `/assets/img/uploads/insta-thumbs/${sc}.webp`;

    // Son çare örnek görsel
    return '/assets/img/uploads/sample1.webp';
  };

  // Mobil menü
  const initMobileMenu = () => {
    const btn = qs('#mobileMenuBtn');
    const menu = qs('#mainMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('show');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Dokununca dropdown aç/kapa (mobile)
    qsa('.dropdown > a').forEach(a => {
      a.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
          e.preventDefault();
          a.parentElement.classList.toggle('active');
        }
      });
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    log('ready');
    initMobileMenu();

    // YouTube iframe kontrol
    log('youtube iframe var:', !!qs('#youtube iframe[src*="youtube.com"]'));

    // ---- BLOG (dummy 3 kart) ----
    try {
      const blogWrap = qs('#blogGrid');
      if (blogWrap) {
        const posts = [
          { t: 'Kedi Aşı Takvimi 2025', d: 'Yavru ve yetişkin kediler için önerilen aşı planı.' },
          { t: 'Köpeklerde Diş Bakımı',   d: 'Ağız kokusu ve diş taşına karşı günlük bakım.' },
          { t: 'Kısırlaştırma Sonrası',   d: 'Operasyon sonrası beslenme ve yara bakımı.' },
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
    } catch (err) {
      console.error('[main] blog error:', err);
    }

    // ---- ABOUT özet (about.html varsa) ----
    try {
      const res = await fetch('/about.html', { method: 'GET' });
      if (res.ok) {
        const html = await res.text();
        const dom = new DOMParser().parseFromString(html, 'text/html');

        const elci = qs('#elci-kimdir, h2#elci-kimdir', dom) || qs('[id*="elci"]', dom);
        const mis  = qs('#misyon-vizyon, h2#misyon-vizyon', dom) || qs('[id*="misyon"]', dom);

        const elciBox = qs('#elciKimdirCard .content');
        const misBox  = qs('#misyonVizyonCard .content');

        if (elci && elciBox) {
          const p = elci.nextElementSibling;
          elciBox.textContent = p && /^P$/i.test(p.tagName) ? p.textContent.trim() : 'Hakkımızda içeriği yakında.';
        }
        if (mis && misBox) {
          const p = mis.nextElementSibling;
          misBox.textContent = p && /^P$/i.test(p.tagName) ? p.textContent.trim() : 'Misyon & vizyon içeriği yakında.';
        }

        log('about snippets ok (about.html varsa)');
      }
    } catch (err) {
      console.warn('[main] about fetch uyarı:', err);
    }

    // ---- GOOGLE REVIEWS ----
    try {
      const revWrap = qs('#reviewsGrid');
      const sumWrap = qs('#ratingSummary');
      const r = await fetch('/assets/data/reviews.json');
      const j = await r.json().catch(() => ({}));
      const arr = safeArr(j);

      if (sumWrap) {
        const nums = arr.map(it => Number(it.rating || it.stars)).filter(n => Number.isFinite(n) && n > 0);
        const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : null;
        sumWrap.innerHTML = `
          <strong style="font-size:20px">${avg ? avg.toFixed(1) : '5.0'}</strong>
          <span> / 5 · ${arr.length || '10+'} yorum</span>
        `;
      }

      if (revWrap) {
        const list = (arr.length ? arr : [
          { author: 'Hasta Sahibi', text: 'Çok ilgili ve güler yüzlü bir ekip. Tavsiye ederim.', rating: 5 },
          { author: 'Ayşe K.', text: 'Acil durumda hızlı müdahale ettiler, teşekkürler.', rating: 5 },
          { author: 'Mehmet D.', text: 'Temiz klinik, şeffaf bilgilendirme.', rating: 4.8 },
        ]).slice(0, 6);

        revWrap.innerHTML = list.map(it => {
          const name = text(it.author || it.user || 'Ziyaretçi');
          const msg  = text(it.text || it.comment || '');
          const star = Number(it.rating || it.stars || 5);
          return `
            <article class="about-card review-card">
              <h3 style="margin-bottom:6px">${name}</h3>
              <div style="color:#f59e0b;margin-bottom:8px">★ ${(Number.isFinite(star) ? star : 5).toFixed(1)}</div>
              <p>${msg || 'Detaylı yorum bırakılmadı.'}</p>
            </article>
          `;
        }).join('');
      }

      log('reviews loaded:', arr.length || '(dummy)');
    } catch (err) {
      console.error('[main] reviews error:', err);
    }

    // ---- INSTAGRAM (yerel thumb + otomatik dönüşüm) ----
    try {
      const igWrap = qs('#instaGrid');
      if (igWrap) {
        const r = await fetch('/assets/data/instagram.json');
        const j = await r.json().catch(() => ({}));
        const arr = safeArr(j)
          // Sadece linki olanları al
          .map((it, idx) => ({
            permalink: it.permalink || it.link || '',
            thumb: it.thumb || it.media_url || null,
            _idx: idx
          }))
          .filter(it => it.permalink);

        // Fallback: hiç veri yoksa 6 dummy kutu
        const source = arr.length ? arr : new Array(6).fill(0).map((_, i) => ({
          permalink: 'https://www.instagram.com/elcivetklinigi/',
          thumb: '/assets/img/uploads/sample1.webp',
          _idx: i
        }));

        // Ekrana aynı anda gösterilecek kutu sayısı
        const PAGE = 6;
        let page = 0;

        const render = () => {
          const start = (page * PAGE) % source.length;
          const slice = [];
          for (let i = 0; i < PAGE; i++) {
            slice.push(source[(start + i) % source.length]);
          }
          igWrap.innerHTML = slice.map((it, i) => {
            const src = it.thumb || localThumb(it, it._idx ?? i);
            const href = it.permalink;
            const alt = `Instagram gönderisi ${i + 1}`;
            return `
              <a href="${href}" target="_blank" rel="noopener"
                 style="display:block;aspect-ratio:1/1;border-radius:10px;overflow:hidden">
                <img src="${src}" alt="${alt}" loading="lazy"
                     style="width:100%;height:100%;object-fit:cover"/>
              </a>
            `;
          }).join('');
        };

        render();
        // 8 sn’de bir sıradaki 6’lıya geç
        if (source.length > PAGE) {
          setInterval(() => { page = (page + 1) % Math.ceil(source.length / PAGE); render(); }, 8000);
        }

        log('instagram loaded:', arr.length || '(dummy)');
      }
    } catch (err) {
      console.error('[main] instagram error:', err);
    }
  });
})();
