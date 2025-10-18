// SAFE JS — dış JSON yok; CSP'ye uygun; tüm görseller ya data: ya da izinli domainlerden.
// YT thumbs: https://i.ytimg.com izinli (CSP'de eklendi). Hata alırsa kart gizlenir.

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initDropdownTouch();
  renderBlog();
  renderInstagram();       // data URI placeholder — CSP sorun çıkarmaz
  renderYouTube();         // i.ytimg.com — CSP'de izin var
  renderReviews();
});

// helpers
const $ = (s,el=document)=>el.querySelector(s);

// ----- Mobil Menü -----
function initMobileMenu(){
  const btn  = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mainMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const show = menu.classList.toggle('show');
    btn.setAttribute('aria-expanded', show ? 'true' : 'false');
  });
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

// ----- Blog (placeholder) -----
function renderBlog(){
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  const posts = [
    {title:'Kısırlaştırma Sonrası Bakım Rehberi', img:svgRect('#e9d5ff','#6a0ea1'), text:'Evde bakım, dikiş kontrolü ve beslenme ipuçları.'},
    {title:'Kedilerde Ağız ve Diş Sağlığı',       img:svgRect('#cffafe','#0ea5b7'), text:'Diş taşı, periodontitis ve düzenli bakım önerileri.'},
    {title:'Acil Durumda Yapılacaklar',           img:svgRect('#fde68a','#ca8a04'), text:'Zehirlenme, travma ve solunum sıkıntısında ilk adımlar.'}
  ];
  grid.innerHTML = posts.map(p => `
    <article class="blog-card">
      <div class="thumb"><img src="${p.img}" alt="${p.title}" loading="lazy"></div>
      <div class="body"><h3>${p.title}</h3><p>${p.text}</p></div>
    </article>
  `).join('');
}

// ----- Instagram (data URI placeholder) -----
function renderInstagram(){
  const grid = document.getElementById('instaGrid');
  if (!grid) return;
  const colors = ['#fca5a5','#fde68a','#86efac','#93c5fd','#c4b5fd','#a5f3fc','#f9a8d4','#fcd34d','#34d399','#60a5fa'];
  grid.innerHTML = colors.map((c,i)=>`
    <div style="border-radius:14px;overflow:hidden">
      <img src="${svgRect(c,'#111')}" alt="Instagram görseli ${i+1}" loading="lazy">
    </div>
  `).join('');
}

// ----- YouTube (izinli domain + onerror gizleme) -----
function renderYouTube(){
  const grid = document.getElementById('ytGrid'); if (!grid) return;
  grid.classList.add('yt-grid');

  // Çok bilinen video ID'leri (thumb 404 riski düşük)
  const vids = ['dQw4w9WgXcQ','M7FIvfx5J10','kXYiU_JCYtU','9bZkp7q19f0','eVTXPUF4Oz4','hTWKbfoikeg'];

  function card(id){
    const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return `
      <a class="yt-card" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener" aria-label="Video">
        <div class="yt-thumb">
          <img src="${thumb}" alt="" loading="lazy" onerror="this.closest('.yt-card').style.display='none'">
        </div>
        <div class="yt-title">Elçi Veteriner | Bilgilendirici Video</div>
        <div class="yt-meta">Elçi Veteriner Kliniği</div>
      </a>`;
  }

  let start = 0;
  const PAGE = 6, STEP = 3;

  function render(){
    const slice = [];
    for (let i=0;i<PAGE;i++) slice.push(vids[(start+i)%vids.length]);
    grid.innerHTML = slice.map(card).join('');
  }

  function step(dir){ start = (start + dir*STEP + vids.length) % vids.length; render(); }
  document.getElementById('ytPrev')?.addEventListener('click',()=>step(-1));
  document.getElementById('ytNext')?.addEventListener('click',()=>step(+1));
  render();
}

// ----- Google Reviews (placeholder, data harici yok) -----
function renderReviews(){
  const sum = document.getElementById('ratingSummary');
  const grid = document.getElementById('reviewsGrid');
  if (!sum || !grid) return;

  const stars = '<i class="fa-solid fa-star"></i>'.repeat(5);
  const reviews = [
    {name:'Merve K.', text:'Gece acilde çok ilgilendiler, minnoşumuz şimdi harika!', date:'2025-10-01'},
    {name:'Seda B.',  text:'Diş taşını tertemiz yaptılar, ekip çok ilgili.',        date:'2025-09-10'},
    {name:'Emre D.',  text:'USG ve kan tahlilleri hızlıca yapıldı.',                date:'2025-09-22'}
  ];

  sum.innerHTML = `<div style="display:flex;gap:10px;align-items:center">
    <div style="font-weight:800;font-size:22px">5.0 / 5</div>
    <div style="color:#f59e0b">${stars}</div>
    <div style="color:#6b7280">(${reviews.length} yorum)</div>
  </div>`;

  const f=v=>new Date(v).toLocaleDateString('tr-TR',{year:'numeric',month:'short',day:'2-digit'});
  grid.innerHTML = reviews.map(r => `
    <article class="review-card" style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px">
      <div style="display:flex;justify-content:space-between"><strong>${r.name}</strong><span style="color:#6b7280;font-size:12px">${f(r.date)}</span></div>
      <div style="color:#f59e0b;margin:6px 0">${stars}</div>
      <p>${r.text}</p>
    </article>
  `).join('');
}

// ----- küçük yardımcı: SVG data URI kare görsel -----
function svgRect(bg='#eee', fg='#555', w=800, h=450){
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${bg}'/>
        <stop offset='100%' stop-color='${fg}' stop-opacity='0.3'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' rx='24' fill='url(#g)'/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
