(()=>{
  'use strict';
  if(document.body.dataset.page!=='faq')return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const slug=v=>String(v||'').toLocaleLowerCase('tr-TR').replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  let items=[],active='Tümü',query='';
  const content=document.getElementById('faqContent'),chips=document.getElementById('faqChips'),search=document.getElementById('faqSearch'),count=document.getElementById('faqCount');
  function categories(){return [...new Set(items.map(i=>i.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'))}
  function renderChips(){if(!chips)return;chips.innerHTML=['Tümü',...categories()].map(c=>`<button class="faq-chip ${c===active?'active':''}" type="button" data-cat="${esc(c)}" aria-pressed="${c===active}">${esc(c)}</button>`).join('');chips.querySelectorAll('button').forEach(b=>b.onclick=()=>{active=b.dataset.cat;renderChips();render()})}
  function render(){if(!content)return;const q=query.toLocaleLowerCase('tr-TR').trim();const filtered=items.filter(i=>(active==='Tümü'||i.category===active)&&(!q||`${i.q} ${i.a} ${i.category}`.toLocaleLowerCase('tr-TR').includes(q)));if(count)count.textContent=String(filtered.length);const groups=new Map();filtered.forEach(i=>{if(!groups.has(i.category))groups.set(i.category,[]);groups.get(i.category).push(i)});content.innerHTML=groups.size?[...groups].map(([cat,list])=>`<section class="faq-group" data-cat="${esc(cat)}" id="${slug(cat)}"><div class="faq-group-title"><h2>${esc(cat)}</h2><span class="faq-group-count">${list.length} yanıt</span></div>${list.map(i=>`<details class="faq" id="${esc(i.id)}"><summary><span class="q"><span class="dot"></span>${esc(i.q)}</span></summary><p>${esc(i.a).replace(/\n/g,'<br>')}</p></details>`).join('')}</section>`).join(''):'<p class="elci-data-message">Aramanızla eşleşen soru bulunamadı.</p>'}
  fetch('/assets/data/faq.json?v=final-1',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{items=(Array.isArray(data.items)?data.items:[]).filter(i=>i.published!==false);renderChips();render()}).catch(e=>console.error('SSS JSON yüklenemedi',e));
  search?.addEventListener('input',()=>{query=search.value||'';render()});
})();
