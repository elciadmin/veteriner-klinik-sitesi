(()=>{
  'use strict';
  const map={about:'about',services:'services',blog:'blog',faq:'faq'};
  const text=value=>String(value??'').trim();
  async function run(){
    let key=map[document.body.dataset.page];
    if(document.body.classList.contains('patient-relations-page'))key='patientRelations';
    if(!key)return;
    try{
      const response=await fetch('/assets/data/pages.json?v=unified-2',{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      const list=Array.isArray(data)?data:Array.isArray(data.items)?data.items:[];
      const page=list.find(item=>item.id===key&&item.published!==false&&item.status!=='archived');
      if(!page)return;
      const hero=document.querySelector('.about-hero,.services-hero,.blog-hero,.faq-hero,.patient-hero,.hero');
      const heading=hero?.querySelector('h1'); if(heading&&text(page.title))heading.textContent=text(page.title);
      const subtitle=hero?.querySelector('.hero-sub,.lead,.signature-tagline'); if(subtitle&&text(page.subtitle))subtitle.textContent=text(page.subtitle);
      const eyebrow=hero?.querySelector('.hero-eyebrow,.eyebrow'); if(eyebrow&&text(page.eyebrow))eyebrow.textContent=text(page.eyebrow);
    }catch(error){console.warn('Sayfa başlık ayarları yüklenemedi; mevcut metin korundu.',error);}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run,{once:true}):run();
})();
