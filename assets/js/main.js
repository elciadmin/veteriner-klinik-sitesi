// Elçi Veteriner - Ana JS (SAFE v12.2)
// Hedef: Hemen çalışsın. Harici JSON/Netlify yok. Sonra veri kaynaklarına bağlayabiliriz.

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initDropdownTouch();
  initBlog_SAFE();
  initInstagramStrip_SAFE();
  initYouTubeCompact_SAFE();
  initGoogleReviews_SAFE();
});

// Kısayollar
const $ = (s,el=document)=>el.querySelector(s);

// -------------------------------------------------------------
// Mobil Menü
// -------------------------------------------------------------
function initMobileMenu(){
  const btn  = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mainMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const show = menu.classList.toggle('show');
    btn.setAttribute('aria-expanded', show ? 'true' : 'false');
  });

  // Mobil alt menü dokunuşu
  menu.querySelectorAll('.dropdown > a').forEach(a => {
    a.addEventListener('click', (ev) => {
      if (window.innerWidth < 992) {
        ev.preventDefault();
        a.parentElement.classList.toggle('active');
      }
    });
  });
}

function initDropdownTouch(){
  document.querySelectorAll('.dropdown').forEach(d => {
    d.addEventListener('touchstart', () => d.classList.add('active'), {passive:true});
    d.addEventListener('touchend',   () => d.classList.remove('active'), {passive:true});
  });
}

// -------------------------------------------------------------
// BLOG (SAFE) — örnek kartlar
// -------------------------------------------------------------
function initBlog_SAFE(){
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  const posts = [
    {title:'Kısırlaştırma Sonrası Bakım Rehberi', image:'https://picsum.photos/seed/og1/800/450', excerpt:'Evde bakım, dikiş kontrolü ve beslenme ipuçları.'},
    {title:'Kedilerde Ağız ve Diş Sağlığı',       image:'https://picsum.photos/seed/og2/800/450', excerpt:'Diş taşı, periodontitis ve düzenli bakım önerileri.'},
    {title:'Acil Durumda Yapılacaklar',           image:'https://picsum.photos/seed/og3/800/450', excerpt:'Zehirlenme, travma ve solunum sıkıntısında ilk adımlar.'}
  ];
  grid.innerHTML = posts.map(p => `
    <article class="blog-card">
      <div class="thumb"><img src="${p.image}" alt="${p.title}" loading="lazy" onerror="this.style.display='none'"></div>
      <div class="body"><h3>${p.title}</h3><p>${p.excerpt}</p></div>
    </article>
  `).join('');
}

// -------------------------------------------------------------
// INSTAGRAM (SAFE) — sade grid (placeholder görseller)
// -------------------------------------------------------------
function initInstagramStrip_SAFE(){
  const mount = document.getElementById('instaGrid');
  if (!mount) return;

  const urls = Array.from({length:10}, (_,i)=>`https://picsum.photos/seed/insta${i}/300/300`);
  mount.innerHTML = urls.map(u => `
    <div class="insta-item" style="border-radius:14px;overflow:hidden">
      <img src="${u}" alt="Instagram" loading="lazy" onerror="this.style.display='none'">
    </div>
  `).join('');
}

// -------------------------------------------------------------
// YOUTUBE (SAFE) — 6’lı kompakt grid
// -------------------------------------------------------------
function initYouTubeCompact_SAFE(){
  const grid = document.getElementById('ytGrid');
  if (!grid) return;

  grid.classList.add('yt-grid');
  const vids = [
    'GVHnMUg_GeU','HBgzBBuwCeY','Y3pWObjTFAw','VNVp534lGYw','X4DYXSzqewU','3FZNRo3T8i8','Hk1h3dKkqNw'
  ];
  let start = 0;
  const PAGE = 6;
  const STEP = 3;

  function render(){
    const slice = [];
    for (let i=0;i<PAGE;i++) slice.push(vids[(start+i)%vids.length]);
    grid.innerHTML = slice.map(id => `
      <a class="yt-card" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener" aria-label="Video">
        <div class="yt-thumb"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"></div>
        <div class="yt-title">Elçi Veteriner | Bilgilendirici Video</div>
        <div class="yt-meta">Elçi Veteriner Kliniği</div>
      </a>`).join('');
  }
  const prevBtn = document.getElementById('ytPrev');
  const nextBtn = document.getElementById('ytNext');
  const step = dir => { start = (start + dir*STEP + vids.length)%vids.length; render(); };

  prevBtn?.addEventListener('click', ()=>{ stop(); step(-1); startAuto(); });
  nextBtn?.addEventListener('click', ()=>{ stop(); step(+1); startAuto(); });

  render();
  let t=null;
  function startAuto(){ stop(); t=setInterval(()=>step(+1), 7000); }
  function stop(){ if(t){ clearInterval(t); t=null; } }
  startAuto();
  document.addEventListener('visibilitychange',()=>document.hidden?stop():startAuto());
}

// -------------------------------------------------------------
// GOOGLE YORUMLARI (SAFE) — 3’lü gösterim + özet
// -------------------------------------------------------------
function initGoogleReviews_SAFE(){
  const summaryEl = document.getElementById('ratingSummary');
  const gridEl    = document.getElementById('reviewsGrid');
  if (!summaryEl || !gridEl) return;

  const reviews = [
    {name:'Merve K.',rating:5,text:'Gece acilde çok ilgilendiler, minnoşumuz şimdi harika!',date:'2025-10-01'},
    {name:'Seda B.', rating:5,text:'Diş taşını tertemiz yaptılar, ekip çok ilgili.',       date:'2025-09-10'},
    {name:'Emre D.', rating:5,text:'USG ve kan tahlilleri hızlıca yapıldı.',               date:'2025-09-22'},
    {name:'Yasin A.',rating:5,text:'Güler yüzlü ve profesyoneller.',                       date:'2025-10-12'},
    {name:'Hakan Ç.',rating:5,text:'Konaklama alanı çok temiz ve güvenli.',                date:'2025-10-10'},
    {name:'Leyla N.',rating:5,text:'Aşı ve check-up süreçleri düzenli ilerliyor.',         date:'2025-08-01'}
  ];

  const avg = (reviews.reduce((a,r)=>a+(r.rating||5),0)/reviews.length).toFixed(1);
  const stars = '<i class="fa-solid fa-star" aria-hidden="true"></i>'.repeat(5);
  summaryEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-weight:800;font-size:22px">${avg} / 5</div>
      <div style="display:flex;gap:3px;font-size:18px;color:#f59e0b">${stars}</div>
      <div style="color:#6b7280">(${reviews.length} yorum)</div>
    </div>`;

  const PAGE = 3;
  let cursor = 0;
  const fmtDate = v => { const d=new Date(v); return isNaN(d)? '' : d.toLocaleDateString('tr-TR',{year:'numeric',month:'short',day:'2-digit'}); };
  const card = r => `
    <article class="review-card" style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
        <strong style="font-size:15px;color:#0f172a">${r.name||'Ziyaretçi'}</strong>
        <span style="color:#6b7280;font-size:12px">${fmtDate(r.date)||''}</span>
      </div>
      <div style="color:#f59e0b;font-size:16px;margin-bottom:8px">${stars}</div>
      <p style="color:#374151;font-size:15px;line-height:1.5">${r.text||''}</p>
    </article>
  `;
  function render(){
    gridEl.innerHTML = Array.from({length:PAGE}, (_,i)=>reviews[(cursor+i)%reviews.length]).map(card).join('');
  }
  function step(dir=+1){ cursor=(cursor + dir*PAGE + reviews.length)%reviews.length; render(); }
  document.getElementById('revPrev')?.addEventListener('click', ()=>{ stop(); step(-1); start(); });
  document.getElementById('revNext')?.addEventListener('click', ()=>{ stop(); step(+1); start(); });
  render();
  let t=null; function start(){ stop(); t=setInterval(()=>step(+1),7000); }
  function stop(){ if(t){ clearInterval(t); t=null; } }
  start();
}
