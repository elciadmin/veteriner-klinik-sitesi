(()=>{
  'use strict';
  if(document.body.dataset.page!=='blog')return;
  const DATA='/assets/data/blog.json?v=final-1',FALLBACK='/assets/img/uploads/elci-logo.png',PAGE_SIZE=6;
  const grid=document.getElementById('blogGrid'),filters=document.getElementById('blogFilters'),search=document.getElementById('blogSearch'),pagination=document.getElementById('blogPagination'),recent=document.getElementById('sidebarRecent');
  const modal=document.getElementById('blogReaderModal'),titleEl=document.getElementById('blogReaderTitle'),metaEl=document.getElementById('blogReaderMeta'),bodyEl=document.getElementById('blogReaderBody'),topCover=document.getElementById('blogReaderCover');
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const date=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'})};
  let posts=[],category='Tümü',query='',page=1;
  const categories=p=>Array.isArray(p.categories)&&p.categories.length?p.categories:[p.category||'Genel Sağlık'];
  const published=p=>p&&p.published!==false&&!['draft','archived'].includes(String(p.status||'').toLowerCase());
  const findPost=slug=>posts.find(p=>String(p.slug)===decodeURIComponent(String(slug||'').replace(/^#/,'')));

  function card(p){
    const cats=categories(p).slice(0,3);const type=p.contentType==='announcement'?'Duyuru':'Blog';
    return `<article class="b-card reveal visible" data-slug="${esc(p.slug)}"><a class="b-cover" href="#${encodeURIComponent(p.slug)}" data-open-post="${esc(p.slug)}"><img src="${esc(p.cover||FALLBACK)}" alt="${esc(p.title)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}';this.classList.add('is-cover-fallback')"><span class="b-badge">${type}</span></a><div class="b-body"><div class="blog-categories">${cats.map(c=>`<button type="button" class="blog-category" data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="b-meta"><span>${esc(date(p.date))}</span><span>${Number(p.readingMinutes)||1} dk okuma</span></div><h2 class="b-title"><a href="#${encodeURIComponent(p.slug)}" data-open-post="${esc(p.slug)}">${esc(p.title)}</a></h2><p class="b-summary">${esc(p.summary)}</p><a class="b-read" href="#${encodeURIComponent(p.slug)}" data-open-post="${esc(p.slug)}">Yazıyı Oku <i class="fa-solid fa-arrow-right"></i></a></div></article>`;
  }

  function filtered(){const q=query.toLocaleLowerCase('tr-TR').trim();return posts.filter(p=>published(p)&&(category==='Tümü'||categories(p).includes(category))&&(!q||[p.title,p.summary,p.content,...categories(p),...(p.tags||[])].join(' ').toLocaleLowerCase('tr-TR').includes(q)))}
  function render(){const all=filtered(),pages=Math.max(1,Math.ceil(all.length/PAGE_SIZE));page=Math.min(page,pages);const slice=all.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);grid.classList.toggle('blog-grid-featured',slice.length>=3);grid.classList.toggle('blog-grid-standard',slice.length<3);grid.innerHTML=slice.length?slice.map(card).join(''):'<p class="blog-empty-state">Eşleşen içerik bulunamadı.</p>';renderPagination(pages);}
  function renderFilters(){const counts=new Map();posts.filter(published).forEach(p=>categories(p).forEach(c=>counts.set(c,(counts.get(c)||0)+1)));const list=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr'));filters.innerHTML=[`<button class="b-chip ${category==='Tümü'?'b-chip-active':''}" data-category="Tümü">Tümü</button>`,...list.map(([c,n])=>`<button class="b-chip ${category===c?'b-chip-active':''}" data-category="${esc(c)}">${esc(c)} (${n})</button>`)].join('');}
  function renderPagination(total){if(!pagination)return;if(total<=1){pagination.innerHTML='';return}pagination.innerHTML=`<button ${page===1?'disabled':''} data-page="${page-1}" aria-label="Önceki">‹</button>${Array.from({length:total},(_,i)=>i+1).map(i=>`<button class="page" ${i===page?'aria-current="page"':''} data-page="${i}">${i}</button>`).join('')}<button ${page===total?'disabled':''} data-page="${page+1}" aria-label="Sonraki">›</button>`}
  function renderRecent(){if(!recent)return;recent.innerHTML=posts.filter(published).slice(0,5).map(p=>`<a href="#${encodeURIComponent(p.slug)}" data-open-post="${esc(p.slug)}"><i class="fa-regular fa-file-lines"></i><span>${esc(p.title)}</span></a>`).join('')}

  function inlineCover(p){const figure=document.createElement('figure');figure.className='blog-inline-cover';const img=document.createElement('img');img.src=p.cover||FALLBACK;img.alt=p.title||'Blog görseli';img.onerror=()=>{img.onerror=null;img.src=FALLBACK;img.classList.add('is-fallback')};const cap=document.createElement('figcaption');cap.textContent=`${p.title} — Elçi Veteriner Kliniği`;figure.append(img,cap);return figure}
  function openReader(p,{push=true}={}){
    if(!p||!modal)return;titleEl.textContent=p.title;metaEl.innerHTML=`<span><i class="fa-regular fa-calendar"></i> ${esc(date(p.date))}</span><span><i class="fa-regular fa-clock"></i> ${Number(p.readingMinutes)||1} dk</span>${categories(p).map(c=>`<span>${esc(c)}</span>`).join('')}`;
    bodyEl.innerHTML=p.content||'<div class="blog-reader-notice">Bu yazının içeriği henüz eklenmemiş.</div>';
    const figure=inlineCover(p);const firstP=bodyEl.querySelector('p');if(firstP)firstP.insertAdjacentElement('afterend',figure);else bodyEl.prepend(figure);
    if(p.youtubeId){const frame=document.createElement('iframe');frame.className='blog-reader-frame';frame.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(p.youtubeId)}`;frame.title=p.title;frame.loading='lazy';frame.allowFullscreen=true;bodyEl.append(frame)}
    if(topCover)topCover.hidden=true;modal.showModal();document.body.classList.add('blog-reader-open');if(push)history.replaceState({},'',`#${encodeURIComponent(p.slug)}`);
  }
  function closeReader(){if(modal?.open)modal.close();document.body.classList.remove('blog-reader-open');if(location.hash)history.replaceState({},'',location.pathname+location.search)}

  document.addEventListener('click',e=>{
    const cat=e.target.closest('[data-category]');if(cat){e.preventDefault();category=cat.dataset.category;page=1;renderFilters();render();return}
    const link=e.target.closest('[data-open-post]');if(link){e.preventDefault();openReader(findPost(link.dataset.openPost));return}
    const pg=e.target.closest('[data-page]');if(pg&&!pg.disabled){page=Number(pg.dataset.page)||1;render();document.getElementById('blog')?.scrollIntoView({behavior:'smooth'});}
  },true);
  document.getElementById('blogReaderClose')?.addEventListener('click',closeReader);document.getElementById('blogReaderCloseBottom')?.addEventListener('click',closeReader);modal?.addEventListener('click',e=>{if(e.target===modal)closeReader()});
  search?.addEventListener('input',()=>{query=search.value;page=1;render()});

  fetch(DATA,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(data=>{posts=(Array.isArray(data)?data:data.posts||[]).filter(published).sort((a,b)=>new Date(b.date)-new Date(a.date));renderFilters();renderRecent();render();if(location.hash){const p=findPost(location.hash);if(p)setTimeout(()=>openReader(p,{push:false}),0)}}).catch(error=>{console.error('Blog JSON yüklenemedi',error);grid.innerHTML='<p class="blog-empty-state">Blog verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.</p>'});
})();
