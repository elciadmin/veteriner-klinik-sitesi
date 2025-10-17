/* Elçi Veteriner – Ana JS
 * İstekler:
 * - Instagram akışı daha yavaş + rastgele spotlight büyütme
 * - Google yorumları kart ve periyodik fade ile döndürme
 * - YouTube şeridi: 3’lü pencere, 7 sn’de bir 1-2-3 → 2-3-4 → 3-4-5 …
 * - Veriler assets/data/*.json'dan; yoksa fallback içerikler
 */

(function(){
  const qs  = (s, el=document)=>el.querySelector(s);
  const qsa = (s, el=document)=>[...el.querySelectorAll(s)];

  /** Basit güvenli JSON fetch (yoksa fallback döner) */
  async function fetchJSON(url, fallback=[]) {
    try {
      const res = await fetch(url, {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    } catch (e) {
      return fallback;
    }
  }

  /** Görünürlük tespiti için IntersectionObserver */
  function onVisible(element, cb, options={threshold:0.2}) {
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(ent=>{
        if (ent.isIntersecting){ cb(); io.unobserve(element); }
      });
    }, options);
    io.observe(element);
  }

  /** ---------- Instagram Bölümü ---------- */
  async function setupInstagram(){
    const section = qs('#instagram');
    const grid = qs('#instaGrid');
    if (!section || !grid) return;

    // hız ve spotlight süreleri dataset ile kontrol edilebilir
    const STEP_MS = Number(section.dataset.speed || 5000);      // kaydırma/ilerleme aralığı (yavaş)
    const SPOT_MS = Number(section.dataset.spotlight || 2500);  // büyüme süresi

    // JSON dosyası yoksa yedek
    const instaData = await fetchJSON('assets/data/instagram.json', [
      // fallback görseller (sizin uploads içine eklediğiniz 5-10 kareyi referanslayın)
      {src:'assets/img/insta/1.jpg', alt:'Klinik - 1'},
      {src:'assets/img/insta/2.jpg', alt:'Klinik - 2'},
      {src:'assets/img/insta/3.jpg', alt:'Klinik - 3'},
      {src:'assets/img/insta/4.jpg', alt:'Klinik - 4'},
      {src:'assets/img/insta/5.jpg', alt:'Klinik - 5'},
      {src:'assets/img/insta/6.jpg', alt:'Klinik - 6'},
      {src:'assets/img/insta/7.jpg', alt:'Klinik - 7'},
      {src:'assets/img/insta/8.jpg', alt:'Klinik - 8'}
    ]);

    // Render
    grid.innerHTML = '';
    instaData.slice(0, 15).forEach(item=>{
      const div = document.createElement('div');
      div.className = 'insta-item';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = item.src;
      img.alt = item.alt || 'Instagram';
      div.appendChild(img);
      grid.appendChild(div);
    });

    // Spotlight efekti: rastgele bir öğe büyüsün sonra normale dönsün
    function spotlightOnce(){
      const items = qsa('.insta-item', grid);
      if (!items.length) return;
      const pick = items[Math.floor(Math.random()*items.length)];
      pick.classList.add('spotlight');
      setTimeout(()=>pick.classList.remove('spotlight'), SPOT_MS);
    }

    // Mobilde hafif otomatik kaydırma (yatay)
    let autoScrollTimer = null;
    function startAuto(){
      stopAuto();
      autoScrollTimer = setInterval(()=>{
        if (grid.scrollWidth > grid.clientWidth) {
          const next = grid.scrollLeft + grid.clientWidth*0.48;
          grid.scrollTo({left: next, behavior:'smooth'});
          if (next + grid.clientWidth >= grid.scrollWidth - 10) {
            // sona gelince başa dön
            setTimeout(()=>grid.scrollTo({left:0, behavior:'smooth'}), 400);
          }
        }
        spotlightOnce();
      }, STEP_MS);
    }
    function stopAuto(){
      if (autoScrollTimer){ clearInterval(autoScrollTimer); autoScrollTimer=null; }
    }

    // Görününce başlat
    onVisible(section, startAuto);
    // Sekme odağı değişince dur/başlat (performans)
    document.addEventListener('visibilitychange', ()=>{ document.hidden ? stopAuto() : startAuto(); });
  }

  /** ---------- Google Yorumları ---------- */
  async function setupReviews(){
    const section = qs('#google-yorumlari');
    if (!section) return;

    const grid = qs('#reviewsGrid');
    const summary = qs('#ratingSummary');

    const ROTATE_MS = Number(section.dataset.rotate || 7000);

    // JSON şeması: [{name, rating, text, time, avatar}]
    const reviews = await fetchJSON('assets/data/reviews.json', [
      {name:'M**** K****', rating:5, text:'Hızlı ve nazik müdahale. Kedimiz şimdi çok iyi.', time:'2 hafta önce'},
      {name:'S**** B****', rating:5, text:'Gece acilde çok yardımcı oldular. Teşekkürler.', time:'1 ay önce'},
      {name:'E**** D****', rating:5, text:'Diş taşını anestezi ile çok güzel temizlediler.', time:'3 hafta önce'},
      {name:'Y**** A****', rating:5, text:'İlgi alaka üst düzey. Gönül rahatlığıyla öneririm.', time:'4 gün önce'},
      {name:'H**** Ç****', rating:5, text:'Konaklama alanları temiz ve güvenli.', time:'6 gün önce'},
      {name:'L**** N****', rating:5, text:'Aşı ve check-up süreçleri çok düzenli ilerliyor.', time:'2 ay önce'},
      {name:'B**** T****', rating:5, text:'Röntgen ve USG ile hızlı tanı koydular.', time:'1 hafta önce'}
    ]);

    // Ortalama ve adet özet (yıldızlar beyaz görünüm)
    const avg = (reviews.reduce((a,r)=>a+(r.rating||5),0)/reviews.length).toFixed(1);
    summary.innerHTML = `
      <span class="review-stars">★ ${avg} / 5</span>
      <span style="color:#374151">— ${reviews.length} yorum</span>
    `;

    // İlk 3 kartı bas
    let cursor = 0;
    function renderWindow(start){
      grid.innerHTML = '';
      const slice = [];
      for (let i=0;i<3;i++){
        slice.push(reviews[(start+i)%reviews.length]);
      }
      slice.forEach(r=>{
        const card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = `
          <div class="review-head">
            <div class="review-avatar">${(r.name||'?').charAt(0)}</div>
            <div>
              <div class="review-name">${r.name||'Ziyaretçi'}</div>
              <div style="font-size:12px;color:#6b7280">${r.time||''}</div>
            </div>
            <div style="margin-left:auto" class="review-stars">★★★★★</div>
          </div>
          <div class="review-text">${r.text||''}</div>
        `;
        grid.appendChild(card);
      });
    }
    renderWindow(cursor);

    let timer=null;
    function rotate(){
      const cards = qsa('.review-card', grid);
      cards.forEach(c=>c.classList.add('fade-out'));
      setTimeout(()=>{
        cursor = (cursor+3) % reviews.length;
        renderWindow(cursor);
      }, 600);
    }

    onVisible(section, ()=>{
      timer = setInterval(rotate, ROTATE_MS);
    });
    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden && timer){ clearInterval(timer); timer=null; }
      else if (!document.hidden && !timer){ timer = setInterval(rotate, ROTATE_MS); }
    });
  }

  /** ---------- YouTube Şeridi ---------- */
  async function setupYouTube(){
    const section = qs('#youtube');
    const wrap = qs('#ytGrid');
    if (!section || !wrap) return;

    const SHIFT_MS = Number(section.dataset.shift || 7000);

    // JSON şeması: [{id,title,channel,date}]
    const videos = await fetchJSON('assets/data/youtube.json', [
      {id:'dQw4w9WgXcQ', title:'Kedilerde Pyoderma – Belirtiler & Tedavi', channel:'Elçi Veteriner', date:'2025-08-10'},
      {id:'kXYiU_JCYtU', title:'Köpeklerde Diş Sağlığı – Ev Bakımı', channel:'Elçi Veteriner', date:'2025-07-30'},
      {id:'3JZ_D3ELwOQ', title:'Acil Durumda İlk 5 Dakika', channel:'Elçi Veteriner', date:'2025-07-12'},
      {id:'Zi_XLOBDo_Y', title:'Kedilerde Parazit Kontrolü 101', channel:'Elçi Veteriner', date:'2025-06-28'},
      {id:'fJ9rUzIMcZQ', title:'Röntgen & USG ile Doğru Tanı', channel:'Elçi Veteriner', date:'2025-06-15'}
    ]);

    function renderWindow(start){
      wrap.innerHTML = '';
      for(let i=0; i<3; i++){
        const v = videos[(start+i) % videos.length];
        const card = document.createElement('a');
        card.className = 'yt-card';
        card.href = `https://www.youtube.com/watch?v=${v.id}`;
        card.target = '_blank';
        card.rel = 'noopener';
        card.innerHTML = `
          <div class="yt-thumb">
            <img loading="lazy" decoding="async" alt="${v.title}"
                 src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg"
                 style="width:100%;height:100%;object-fit:cover;display:block">
          </div>
          <div class="yt-body">
            <div class="yt-title">${v.title}</div>
            <div class="yt-meta">${v.channel} · ${v.date||''}</div>
          </div>
        `;
        wrap.appendChild(card);
      }
    }

    let start = 0;
    renderWindow(start);

    let timer=null;
    onVisible(section, ()=>{
      timer = setInterval(()=>{
        start = (start+1) % videos.length; // 1-2-3 → 2-3-4 → 3-4-5 …
        renderWindow(start);
      }, SHIFT_MS);
    });
    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden && timer){ clearInterval(timer); timer=null; }
      else if (!document.hidden && !timer){
        timer = setInterval(()=>{
          start = (start+1) % videos.length;
          renderWindow(start);
        }, SHIFT_MS);
      }
    });
  }

  /** ---------- About teaser doldurma (mevcut yapıyla uyumlu basit örnek) ---------- */
  function setupAboutTeasers(){
    const elci = qs('#elciKimdirCard .content');
    const mis  = qs('#misyonVizyonCard .content');
    if (elci) elci.textContent = 'Kurucumuz ve ekibimizle tanışın: deneyim, eğitim ve yaklaşımımız.';
    if (mis)  mis.textContent  = 'Hayvan refahı odaklı, şeffaf ve etik hekimlik anlayışımız.';
  }

  /** ---------- Menü (mobil) ---------- */
  function setupMenu(){
    const btn = qs('#mobileMenuBtn');
    const ul  = qs('#mainMenu');
    if (!btn || !ul) return;
    btn.addEventListener('click', ()=>{
      const open = ul.getAttribute('data-open') === '1';
      ul.style.display = open ? '' : 'flex';
      ul.style.flexDirection = open ? '' : 'column';
      ul.style.gap = open ? '' : '12px';
      ul.setAttribute('data-open', open ? '0' : '1');
      btn.setAttribute('aria-expanded', (!open).toString());
    });
  }

  /** ---------- Blog dummy (varsa kendi fetch’inizi bağlayın) ---------- */
  function setupBlog(){
    const grid = qs('#blogGrid');
    if (!grid) return;
    const posts = [
      {title:'Kısırlaştırma Sonrası Bakım Rehberi', img:'assets/img/uploads/og-cover.jpg', text:'Evde bakım, dikiş kontrolü ve beslenme ipuçları.'},
      {title:'Kedilerde Ağız ve Diş Sağlığı', img:'assets/img/uploads/og-cover.jpg', text:'Diş taşı, periodontitis ve düzenli bakım önerileri.'},
      {title:'Acil Durumda Yapılacaklar', img:'assets/img/uploads/og-cover.jpg', text:'Zehirlenme, travma ve solunum sıkıntısında ilk adımlar.'}
    ];
    grid.innerHTML = posts.map(p=>`
      <article class="blog-card">
        <div class="thumb"><img loading="lazy" decoding="async" src="${p.img}" alt=""></div>
        <div class="body">
          <h3>${p.title}</h3>
          <p>${p.text}</p>
        </div>
      </article>
    `).join('');
  }

  // Init
  document.addEventListener('DOMContentLoaded', ()=>{
    setupMenu();
    setupAboutTeasers();
    setupInstagram();
    setupReviews();
    setupYouTube();
    setupBlog();
  });

})();
