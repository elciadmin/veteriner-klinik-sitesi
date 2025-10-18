/* assets/js/main.js
 * Elçi Veteriner – çalışır, defansif, bağımsız sürüm
 * Bölümler: Instagram (yavaş + spotlight), Google Yorumlar (kart + rotasyon), YouTube (3’lü şerit + geçiş)
 */
(function(){
  'use strict';

  /* ----------------- Yardımcılar ----------------- */
  const qs  = (s, el=document)=>el && el.querySelector ? el.querySelector(s) : null;
  const qsa = (s, el=document)=>el && el.querySelectorAll ? Array.from(el.querySelectorAll(s)) : [];
  const log = (...a)=>console.log('[main.js]', ...a);

  async function fetchJSON(url, fallback=[]) {
    try {
      const res = await fetch(url, {cache:'no-store'});
      if (!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    } catch (e) {
      log('fetchJSON fallback:', url, e.message || e);
      return fallback;
    }
  }

  function onVisible(el, cb, options={threshold:0.2}) {
    if (!el) return;
    try {
      const io = new IntersectionObserver((entries)=>{
        entries.forEach(ent=>{
          if (ent.isIntersecting){ cb(); io.unobserve(el); }
        });
      }, options);
      io.observe(el);
    } catch {
      // Bazı eski tarayıcılar için hemen çalıştır
      cb();
    }
  }

  /* ----------------- Instagram ----------------- */
  async function setupInstagram(){
    const section = qs('#instagram');
    const grid = qs('#instaGrid');
    if (!section || !grid) { log('Instagram bölümü bulunamadı, atlanıyor.'); return; }

    const STEP_MS = Number(section.dataset.speed || 6000);     // yavaş akış
    const SPOT_MS = Number(section.dataset.spotlight || 2500); // spotlight süresi

    const instaData = await fetchJSON('assets/data/instagram.json', [
      {src:'assets/img/insta/1.jpg', alt:'Klinik - 1'},
      {src:'assets/img/insta/2.jpg', alt:'Klinik - 2'},
      {src:'assets/img/insta/3.jpg', alt:'Klinik - 3'},
      {src:'assets/img/insta/4.jpg', alt:'Klinik - 4'},
      {src:'assets/img/insta/5.jpg', alt:'Klinik - 5'},
      {src:'assets/img/insta/6.jpg', alt:'Klinik - 6'},
      {src:'assets/img/insta/7.jpg', alt:'Klinik - 7'},
      {src:'assets/img/insta/8.jpg', alt:'Klinik - 8'}
    ]);

    // Render güvenli
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

    // Spotlight (rastgele büyüsün, sonra normale dönsün)
    function spotlightOnce(){
      const items = qsa('.insta-item', grid);
      if (!items.length) return;
      const pick = items[Math.floor(Math.random()*items.length)];
      pick.classList.add('spotlight');
      setTimeout(()=>pick.classList.remove('spotlight'), SPOT_MS);
    }

    // Mobil/ dar ekran: hafif otomatik yatay kaydırma
    let autoScrollTimer = null;
    function startAuto(){
      stopAuto();
      autoScrollTimer = setInterval(()=>{
        try{
          if (grid.scrollWidth > grid.clientWidth) {
            const next = grid.scrollLeft + grid.clientWidth*0.45;
            grid.scrollTo({left: next, behavior:'smooth'});
            if (next + grid.clientWidth >= grid.scrollWidth - 8) {
              setTimeout(()=>grid.scrollTo({left:0, behavior:'smooth'}), 300);
            }
          }
          spotlightOnce();
        }catch(e){ /* sessiz */ }
      }, STEP_MS);
    }
    function stopAuto(){
      if (autoScrollTimer){ clearInterval(autoScrollTimer); autoScrollTimer=null; }
    }

    onVisible(section, startAuto);
    document.addEventListener('visibilitychange', ()=>{ document.hidden ? stopAuto() : startAuto(); });
    log('Instagram hazır (step=', STEP_MS, ', spotlight=', SPOT_MS, ')');
  }

  /* ----------------- Google Yorumları ----------------- */
  async function setupReviews(){
    const section = qs('#google-yorumlari');
    if (!section) { log('Yorum bölümü bulunamadı, atlanıyor.'); return; }

    const grid = qs('#reviewsGrid');
    const summaryBadge = qs('#ratingSummary-badge') || qs('#ratingSummary'); // biri yoksa diğeri
    const ROTATE_MS = Number(section.dataset.rotate || 7000);

    const reviews = await fetchJSON('assets/data/reviews.json', [
      {name:'Merve K.', rating:5, text:'Gece acilde çok ilgilendiler, minnoşumuz şimdi harika!', time:'2 hafta önce'},
      {name:'Seda B.',  rating:5, text:'Diş taşını tertemiz yaptılar, ekip çok ilgili.',      time:'1 ay önce'},
      {name:'Emre D.',  rating:5, text:'USG ve kan tahlilleri hızlıca yapıldı.',               time:'3 hafta önce'},
      {name:'Yasin A.', rating:5, text:'Güler yüzlü ve profesyoneller.',                       time:'4 gün önce'},
      {name:'Hakan Ç.', rating:5, text:'Konaklama alanı çok temiz ve güvenli.',                time:'6 gün önce'},
      {name:'Leyla N.', rating:5, text:'Aşı ve check-up süreçleri düzenli ilerliyor.',         time:'2 ay önce'}
    ]);

    if (summaryBadge) {
      const avg = (reviews.reduce((a,r)=>a+(r.rating||5),0)/reviews.length).toFixed(1);
      // summaryBadge bir span ise direkt yaz, değilse içine span koy
      if (summaryBadge.id === 'ratingSummary-badge') {
        summaryBadge.textContent = `★ ${avg} / 5 — ${reviews.length} yorum`;
      } else {
        summaryBadge.innerHTML = `<span id="ratingSummary-badge">★ ${avg} / 5 — ${reviews.length} yorum</span>`;
      }
    }

    if (!grid) { log('reviewsGrid yok, yine de devam.'); return; }

    let cursor = 0;
    function renderWindow(start){
      grid.innerHTML = '';
      const slice = [];
      for (let i=0;i<3;i++) slice.push(reviews[(start+i)%reviews.length]);
      slice.forEach(r=>{
        const card = document.createElement('article');
        card.className = 'review-card';
        card.innerHTML = `
          <div class="review-ribbon">Doğrulanmış Ziyaretçi</div>
          <div class="review-head">
            <div class="review-avatar">${(r.name||'?').trim().charAt(0)}</div>
            <div>
              <div class="review-name">${r.name||'Ziyaretçi'}</div>
              <div style="font-size:12px;color:#6b7280">${r.time||''}</div>
            </div>
            <div class="review-stars">★★★★★</div>
          </div>
          <div class="review-text">${r.text||''}</div>
        `;
        grid.appendChild(card);
      });
    }
    function step(dir=+1){
      qsa('.review-card',grid).forEach(c=>c.classList.add('fade-out'));
      setTimeout(()=>{
        cursor = (cursor + (dir*3) + reviews.length) % reviews.length;
        renderWindow(cursor);
      }, 500);
    }

    renderWindow(cursor);

    let timer=null;
    function start(){ stop(); timer = setInterval(()=>step(+1), ROTATE_MS); }
    function stop(){ if (timer){ clearInterval(timer); timer=null; } }

    onVisible(section, start);
    document.addEventListener('visibilitychange', ()=>{ document.hidden ? stop() : start(); });

    // Manuel oklar (varsa)
    const bPrev=qs('#revPrev'); const bNext=qs('#revNext');
    if (bPrev) bPrev.addEventListener('click', ()=>{ stop(); step(-1); start(); });
    if (bNext) bNext.addEventListener('click', ()=>{ stop(); step(+1); start(); });

    log('Yorumlar hazır (rotate=', ROTATE_MS, 'ms)');
  }

  /* ----------------- YouTube ----------------- */
  async function setupYouTube(){
    const section = qs('#youtube');
    const wrap = qs('#ytGrid');
    if (!section || !wrap) { log('YouTube bölümü bulunamadı, atlanıyor.'); return; }

    const SHIFT_MS = Number(section.dataset.shift || 7000);

    const videos = await fetchJSON('assets/data/youtube.json', [
      {id:'VIDEOID1', title:'Kedilerde Pyoderma – Belirtiler & Tedavi', channel:'Elçi Veteriner', date:'2025-09-01'},
      {id:'VIDEOID2', title:'Köpeklerde Diş Sağlığı – Ev Bakımı',       channel:'Elçi Veteriner', date:'2025-08-21'},
      {id:'VIDEOID3', title:'Acil Durumda İlk 5 Dakika',                 channel:'Elçi Veteriner', date:'2025-08-10'},
      {id:'VIDEOID4', title:'Kedilerde Parazit Kontrolü 101',            channel:'Elçi Veteriner', date:'2025-07-20'},
      {id:'VIDEOID5', title:'Röntgen & USG ile Doğru Tanı',              channel:'Elçi Veteriner', date:'2025-07-05'}
    ]);

    let start = 0;

    function renderWindow(){
      wrap.innerHTML = '';
      for(let i=0;i<3;i++){
        const v = videos[(start+i)%videos.length];
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
    function step(dir=+1){ start = (start + dir + videos.length) % videos.length; renderWindow(); }

    renderWindow();

    let timer=null;
    function startAuto(){ stopAuto(); timer = setInterval(()=>step(+1), SHIFT_MS); }
    function stopAuto(){ if (timer){ clearInterval(timer); timer=null; } }

    onVisible(section, startAuto);
    document.addEventListener('visibilitychange', ()=>{ document.hidden ? stopAuto() : startAuto(); });

    const bPrev=qs('#ytPrev'); const bNext=qs('#ytNext');
    if (bPrev) bPrev.addEventListener('click', ()=>{ stopAuto(); step(-1); startAuto(); });
    if (bNext) bNext.addEventListener('click', ()=>{ stopAuto(); step(+1); startAuto(); });

    log('YouTube hazır (shift=', SHIFT_MS, 'ms)');
  }

  /* ----------------- About + Menü + Blog (küçük yardımcılar) ----------------- */
  function setupAboutTeasers(){
    const elci = qs('#elciKimdirCard .content');
    const mis  = qs('#misyonVizyonCard .content');
    if (elci && !elci.textContent?.trim()) elci.textContent = 'Kurucumuz ve ekibimizle tanışın: deneyim, eğitim ve yaklaşımımız.';
    if (mis  && !mis.textContent?.trim())  mis.textContent  = 'Hayvan refahı odaklı, şeffaf ve etik hekimlik anlayışımız.';
  }

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

  function setupBlog(){
    const grid = qs('#blogGrid');
    if (!grid) return;
    // basit placeholder (mevcutta varsa dokunmaz)
    if (grid.children.length) return;
    const posts = [
      {title:'Kısırlaştırma Sonrası Bakım Rehberi', img:'assets/img/uploads/og-cover.jpg', text:'Evde bakım, dikiş kontrolü ve beslenme ipuçları.'},
      {title:'Kedilerde Ağız ve Diş Sağlığı',       img:'assets/img/uploads/og-cover.jpg', text:'Diş taşı, periodontitis ve düzenli bakım önerileri.'},
      {title:'Acil Durumda Yapılacaklar',           img:'assets/img/uploads/og-cover.jpg', text:'Zehirlenme, travma ve solunum sıkıntısında ilk adımlar.'}
    ];
    grid.innerHTML = posts.map(p=>`
      <article class="blog-card">
        <div class="thumb"><img loading="lazy" decoding="async" src="${p.img}" alt=""></div>
        <div class="body"><h3>${p.title}</h3><p>${p.text}</p></div>
      </article>
    `).join('');
  }

  /* ----------------- Init ----------------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    setupMenu();
    setupAboutTeasers();
    setupInstagram();
    setupReviews();
    setupYouTube();
    setupBlog();
    log('Tüm modüller başlatıldı.');
  });

})();
