(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fallback='/assets/img/uploads/elci-logo.png';
  const date=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('tr-TR',{day:'2-digit',month:'short',year:'numeric'})};
  async function json(url,fallbackValue){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url}: ${r.status}`);const d=await r.json();return d??fallbackValue}

  function blogCard(post){
    const cats=(post.categories||[post.category]).filter(Boolean).slice(0,3);
    return `<article class="blog-card reveal visible"><a href="${esc(post.url||`/blog.html#${post.slug}`)}" aria-label="${esc(post.title)}"><div class="blog-thumb"><img src="${esc(post.cover||fallback)}" alt="${esc(post.title)}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}';this.classList.add('is-fallback')"></div><div class="blog-body"><div class="blog-categories">${cats.map(c=>`<span class="blog-category">${esc(c)}</span>`).join('')}</div><div class="blog-meta">${esc(date(post.date))} · ${Number(post.readingMinutes)||1} dk</div><h3 class="blog-title">${esc(post.title)}</h3><p class="blog-excerpt">${esc(post.summary)}</p></div></a></article>`;
  }

  function renderBlog(items){
    const grid=document.getElementById('blogGrid');if(!grid)return;
    grid.innerHTML=items.length?items.slice(0,6).map(blogCard).join(''):'<p class="elci-data-message">Ana sayfa için henüz blog yazısı seçilmedi.</p>';
  }

  function renderAnnouncements(items){
    document.getElementById('announcements')?.remove();
    if(!items.length)return;
    const blog=document.getElementById('blog');if(!blog)return;
    const section=document.createElement('section');section.id='announcements';
    section.innerHTML=`<div class="container"><div class="section-head"><span class="section-kicker"><i class="fa-solid fa-bullhorn"></i> Güncel duyurular</span><h2>Klinikten kısa bilgilendirmeler</h2></div><div class="announcement-grid">${items.slice(0,3).map(item=>`<article class="announcement-card reveal visible"><span class="announcement-date">${esc(date(item.date))}</span><h3><a href="${esc(item.url||`/blog.html#${item.slug}`)}">${esc(item.title)}</a></h3><p>${esc(item.summary)}</p></article>`).join('')}</div></div>`;
    blog.parentNode.insertBefore(section,blog);
  }

  function renderFaq(items){
    const wrap=document.getElementById('homeFaqList');if(!wrap)return;
    const answer=value=>esc(value).replace(/\n/g,'<br>').replace(/0332 322 32 20/g,'<a href="tel:03323223220">0332 322 32 20</a>');
    wrap.innerHTML=items.length?items.slice(0,6).map(item=>`<details class="home-faq-item" id="${esc(item.id)}"><summary class="home-faq-summary"><span class="home-faq-question"><span class="home-faq-dot" aria-hidden="true"></span><span>${esc(item.q)}</span></span><i class="fa-solid fa-chevron-down home-faq-chevron" aria-hidden="true"></i></summary><div class="home-faq-answer"><p>${answer(item.a)}</p><a href="/sss.html#${encodeURIComponent(item.id||'')}">SSS sayfasında aç</a></div></details>`).join(''):'<p class="home-faq-status">Ana sayfa için henüz soru seçilmedi.</p>';
    wrap.querySelectorAll('details').forEach(detail=>detail.addEventListener('toggle',()=>{if(!detail.open)return;wrap.querySelectorAll('details[open]').forEach(other=>{if(other!==detail)other.open=false})}));
  }

  function stars(rating){return `<div class="stars" aria-label="${rating} yıldız">${Array.from({length:5},(_,i)=>`<span class="s" aria-hidden="true">${i<rating?'★':'☆'}</span>`).join('')}</div>`}
  function renderReviews(items){
    const grid=document.getElementById('reviewGrid');if(!grid)return;
    grid.innerHTML=items.length?items.slice(0,6).map(item=>`<article class="review-card visible">${stars(Number(item.rating)||5)}<p class="review-text">${esc(item.text)}</p><div class="review-author">— ${esc(item.author)}</div>${item.time?`<div class="review-meta">${esc(item.time)}</div>`:''}</article>`).join(''):'<p class="elci-data-message">Ana sayfa için henüz yorum seçilmedi.</p>';
  }

  async function run(){
    if(document.body.dataset.page!=='home')return;
    try{
      const [blog,ann,faq,reviews]=await Promise.all([
        json('/assets/data/home-blog.json?v=final-1',[]),json('/assets/data/announcements.json?v=final-1',[]),
        json('/assets/data/home-faq.json?v=final-1',[]),json('/assets/data/home-reviews.json?v=final-1',[])
      ]);
      renderBlog(Array.isArray(blog)?blog:[]);renderAnnouncements(Array.isArray(ann)?ann:[]);renderFaq(Array.isArray(faq)?faq:[]);renderReviews(Array.isArray(reviews)?reviews:[]);
    }catch(error){console.error('Ana sayfa yönetilen içerikleri yüklenemedi:',error)}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run):run();
})();
