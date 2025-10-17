/* ------- Yardımcılar ------- */
const qs  = (s, el=document)=>el.querySelector(s);
const qsa = (s, el=document)=>[...el.querySelectorAll(s)];
async function fetchJSON(url, fb=[]) {
  try{ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw 0; return await r.json(); }
  catch{ return fb; }
}
function onVisible(el, cb, options={threshold:.2}) {
  const io=new IntersectionObserver(ents=>{
    ents.forEach(e=>{ if(e.isIntersecting){ cb(); io.unobserve(el); }});
  }, options);
  io.observe(el);
}

/* ================== INSTAGRAM ================== */
async function setupInstagramSlowSpotlight(){
  const section = qs('#instagram'); const grid = qs('#instaGrid');
  if(!section || !grid) return;
  const STEP_MS = Number(section.dataset.speed || 6000);    // yavaş
  const SPOT_MS = Number(section.dataset.spotlight || 2500);

  const data = await fetchJSON('assets/data/instagram.json', [
    {src:'assets/img/insta/1.jpg',alt:'Klinik 1'},
    {src:'assets/img/insta/2.jpg',alt:'Klinik 2'},
    {src:'assets/img/insta/3.jpg',alt:'Klinik 3'},
    {src:'assets/img/insta/4.jpg',alt:'Klinik 4'},
    {src:'assets/img/insta/5.jpg',alt:'Klinik 5'},
    {src:'assets/img/insta/6.jpg',alt:'Klinik 6'}
  ]);

  grid.innerHTML='';
  data.slice(0,15).forEach(i=>{
    const d=document.createElement('div'); d.className='insta-item';
    d.innerHTML=`<img loading="lazy" decoding="async" src="${i.src}" alt="${i.alt||'Instagram'}">`;
    grid.appendChild(d);
  });

  function spotlight(){
    const items=qsa('.insta-item',grid); if(!items.length) return;
    const pick=items[Math.floor(Math.random()*items.length)];
    pick.classList.add('spotlight');
    setTimeout(()=>pick.classList.remove('spotlight'), SPOT_MS);
  }

  // mobilde yumuşak otomatik yatay kaydırma
  let timer=null;
  function start(){
    stop();
    timer=setInterval(()=>{
      if(grid.scrollWidth>grid.clientWidth){
        const next=grid.scrollLeft + grid.clientWidth*0.45;
        grid.scrollTo({left:next, behavior:'smooth'});
        if(next + grid.clientWidth >= grid.scrollWidth-8){
          setTimeout(()=>grid.scrollTo({left:0,behavior:'smooth'}),300);
        }
      }
      spotlight();
    }, STEP_MS);
  }
  function stop(){ if(timer){clearInterval(timer); timer=null;} }

  onVisible(section,start);
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
}

/* ================== GOOGLE YORUMLAR (0'dan) ================== */
async function setupReviewsNew(){
  const section=qs('#google-yorumlari'); if(!section) return;
  const grid=qs('#reviewsGrid'); const summary=qs('#ratingSummary');
  const ROTATE_MS = Number(section.dataset.rotate || 7000);

  const reviews = await fetchJSON('assets/data/reviews.json', [
    {"name":"Merve K.","rating":5,"text":"Gece acilde çok ilgilendiler, minnoşumuz şimdi harika!","time":"2 hafta önce"},
    {"name":"Seda B.","rating":5,"text":"Diş taşını tertemiz yaptılar, ekip çok ilgili.","time":"1 ay önce"},
    {"name":"Emre D.","rating":5,"text":"USG ve kan tahlilleri hızlıca yapıldı.","time":"3 hafta önce"},
    {"name":"Yasin A.","rating":5,"text":"Güler yüzlü ve profesyoneller.","time":"4 gün önce"},
    {"name":"Hakan Ç.","rating":5,"text":"Konaklama alanı çok temiz ve güvenli.","time":"6 gün önce"},
    {"name":"Leyla N.","rating":5,"text":"Aşı ve check-up süreçleri düzenli ilerliyor.","time":"2 ay önce"}
  ]);

  const avg=(reviews.reduce((a,r)=>a+(r.rating||5),0)/reviews.length).toFixed(1);
  summary.innerHTML = `<span id="ratingSummary-badge">★ ${avg} / 5 — ${reviews.length} yorum</span>`;

  let cursor=0;
  function render(start){
    grid.innerHTML='';
    const slice=[0,1,2].map(i=>reviews[(start+i)%reviews.length]);
    slice.forEach(r=>{
      const card=document.createElement('article');
      card.className='review-card';
      card.innerHTML=`
        <div class="review-ribbon">Doğrulanmış Ziyaretçi</div>
        <div class="review-head">
          <div class="review-avatar">${(r.name||'?').charAt(0)}</div>
          <div>
            <div class="review-name">${r.name||'Ziyaretçi'}</div>
            <div style="font-size:12px;color:#6b7280">${r.time||''}</div>
          </div>
          <div class="review-stars"><span>★★★★★</span></div>
        </div>
        <div class="review-text">${r.text||''}</div>
      `;
      grid.appendChild(card);
    });
  }
  render(cursor);

  function next(){ animateStep(+1); }
  function prev(){ animateStep(-1); }
  function animateStep(step){
    qsa('.review-card',grid).forEach(c=>c.classList.add('fade-out'));
    setTimeout(()=>{
      cursor = (cursor + (step*3) + reviews.length) % reviews.length;
      render(cursor);
    }, 500);
  }

  let t=null;
  function start(){ stop(); t=setInterval(next, ROTATE_MS); }
  function stop(){ if(t){clearInterval(t); t=null;} }

  onVisible(section,start);
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());

  // butonlar
  const bPrev=qs('#revPrev'); const bNext=qs('#revNext');
  if(bPrev) bPrev.addEventListener('click',()=>{ stop(); prev(); start(); });
  if(bNext) bNext.addEventListener('click',()=>{ stop(); next(); start(); });
}

/* ================== YOUTUBE — şerit + geçişler ================== */
async function setupYouTubeStrip(){
  const section=qs('#youtube'); const wrap=qs('#ytGrid');
  if(!section||!wrap) return;
  const SHIFT_MS = Number(section.dataset.shift || 7000);

  const videos = await fetchJSON('assets/data/youtube.json', [
    {id:'VIDEOID1', title:'Kedilerde Pyoderma – Belirtiler & Tedavi', channel:'Elçi Veteriner', date:'2025-09-01'},
    {id:'VIDEOID2', title:'Köpeklerde Diş Sağlığı – Ev Bakımı', channel:'Elçi Veteriner', date:'2025-08-21'},
    {id:'VIDEOID3', title:'Acil Durumda İlk 5 Dakika', channel:'Elçi Veteriner', date:'2025-08-10'},
    {id:'VIDEOID4', title:'Kedilerde Parazit Kontrolü 101', channel:'Elçi Veteriner', date:'2025-07-20'},
    {id:'VIDEOID5', title:'Röntgen & USG ile Doğru Tanı', channel:'Elçi Veteriner', date:'2025-07-05'}
  ]);

  let start=0;
  function renderWindow(){
    wrap.innerHTML='';
    for(let i=0;i<3;i++){
      const v=videos[(start+i)%videos.length];
      const a=document.createElement('a');
      a.className='yt-card';
      a.href=`https://www.youtube.com/watch?v=${v.id}`; a.target='_blank'; a.rel='noopener';
      a.innerHTML=`
        <div class="yt-thumb">
          <img loading="lazy" decoding="async" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="${v.title}" style="width:100%;height:100%;object-fit:cover;display:block">
        </div>
        <div class="yt-body">
          <div class="yt-title">${v.title}</div>
          <div class="yt-meta">${v.channel} · ${v.date||''}</div>
        </div>
      `;
      wrap.appendChild(a);
    }
  }
  renderWindow();

  function step(dir=+1){ start=(start+dir+videos.length)%videos.length; renderWindow(); }

  let timer=null;
  function startAuto(){ stopAuto(); timer=setInterval(()=>step(+1), SHIFT_MS); }
  function stopAuto(){ if(timer){clearInterval(timer); timer=null;} }
  onVisible(section,startAuto);
  document.addEventListener('visibilitychange',()=>document.hidden?stopAuto():startAuto());

  const bPrev=qs('#ytPrev'); const bNext=qs('#ytNext');
  if(bPrev) bPrev.addEventListener('click',()=>{ stopAuto(); step(-1); startAuto(); });
  if(bNext) bNext.addEventListener('click',()=>{ stopAuto(); step(+1); startAuto(); });
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  setupInstagramSlowSpotlight();
  setupReviewsNew();
  setupYouTubeStrip();
});
