(()=>{
  'use strict';
  const DATA_URL='/assets/data/services.json?v=unified-2';
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const visible=i=>i && i.published!==false && !['draft','archived'].includes(String(i.status||'').toLowerCase());
  const sorted=items=>[...items].filter(visible).sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999)||String(a.title||'').localeCompare(String(b.title||''),'tr'));

  function setCard(card,item){
    if(!card||!item)return;
    card.hidden=false; card.id=item.id; card.dataset.serviceId=item.id; card.dataset.serviceTitle=item.title||'';
    const title=card.querySelector('.s-title,h3,h4'); if(title) title.textContent=item.title||'';
    const summary=card.querySelector('.s-text,[data-cms="summary"]'); if(summary) summary.textContent=item.summary||'';
    const detail=card.querySelector('[data-cms="detail"] p'); if(detail) detail.textContent=item.detail||item.summary||'';
    const link=card.querySelector('.s-link'); if(link) link.href=item.href||`/hizmetler.html#${encodeURIComponent(item.id)}`;
    const use=card.querySelector('.s-icon use'); if(use){const icon=item.icon||'#i-stethoscope';use.setAttribute('href',icon);use.setAttribute('xlink:href',icon)}
    const fa=card.querySelector('.service-icon i'); if(fa && item.faIcon) fa.className=item.faIcon;
  }

  function homeCard(template,item){
    const card=template.cloneNode(true); setCard(card,item); card.classList.add('reveal','visible'); return card;
  }

  function renderHome(data){
    const featured=document.getElementById('servicesFeatured');
    const track=document.getElementById('servicesTrack');
    if(!featured||!track)return;
    const items=sorted(data.items||[]);
    const home=items.filter(i=>i.showOnHome).slice(0,Number(data.homeLimit)||6);
    const selected=home.length?home:items.slice(0,6);
    const selectedIds=new Set(selected.map(i=>i.id));
    const remaining=items.filter(i=>!selectedIds.has(i.id));
    const template=featured.querySelector('.s-card')||track.querySelector('.s-card');
    if(!template)return;
    const f=document.createDocumentFragment(); selected.forEach(i=>f.appendChild(homeCard(template,i)));
    const t=document.createDocumentFragment(); remaining.forEach(i=>t.appendChild(homeCard(template,i)));
    featured.replaceChildren(f); track.replaceChildren(t);
    const more=document.getElementById('servicesMoreWrap'); if(more) more.hidden=!remaining.length;
    const section=document.getElementById('services');
    const h2=section?.querySelector('h2'); if(h2&&data.title) h2.textContent=data.title;
    const intro=section?.querySelector('.local-intro'); if(intro&&data.description) intro.textContent=data.description;
  }

  function genericServiceCard(item){
    const article=document.createElement('article');
    article.className='service-card cms-service reveal visible'; article.id=item.id; article.dataset.serviceId=item.id;
    article.innerHTML=`<div class="service-icon"><i class="${esc(item.faIcon||'fa-solid fa-stethoscope')}"></i></div><h4>${esc(item.title)}</h4><p data-cms="summary">${esc(item.summary)}</p><details><summary>Hizmet kapsamı</summary><div class="detail-body" data-cms="detail"><p>${esc(item.detail||item.summary)}</p><div class="detail-actions"><a class="mini-btn primary" href="/hasta-iliskileri.html#online-randevu">Randevu</a></div></div></details>`;
    return article;
  }

  function groupGrid(name){
    const groups=[...document.querySelectorAll('#diger-hizmetler .service-group')];
    const found=groups.find(g=>g.querySelector('.group-head h3')?.textContent.trim().toLocaleLowerCase('tr-TR')===String(name).trim().toLocaleLowerCase('tr-TR'));
    if(found)return found.querySelector('.service-grid');
    return groups.at(-1)?.querySelector('.service-grid')||document.querySelector('#diger-hizmetler .service-grid');
  }

  function renderServicesPage(data){
    if(document.body.dataset.page!=='services')return;
    const items=sorted(data.items||[]); const map=new Map(items.map(i=>[i.id,i]));
    document.querySelectorAll('[data-service-id]').forEach(card=>{
      const item=map.get(card.dataset.serviceId); card.hidden=!item; if(item)setCard(card,item);
    });
    const existing=new Set([...document.querySelectorAll('[data-service-id]')].map(e=>e.dataset.serviceId));
    items.filter(i=>!existing.has(i.id)).forEach(item=>groupGrid(item.group)?.appendChild(genericServiceCard(item)));
  }

  async function run(){
    try{
      const response=await fetch(DATA_URL,{cache:'no-store'}); if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json(); if(!Array.isArray(data.items))throw new Error('items listesi yok');
      renderHome(data); renderServicesPage(data);
      document.documentElement.dataset.servicesReady='true';
    }catch(error){
      console.error('Hizmet JSON yüklenemedi; mevcut statik kartlar korundu.',error);
      document.documentElement.dataset.servicesReady='false';
    }
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run):run();
})();
