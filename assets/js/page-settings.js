(()=>{
  'use strict';

  const PAGE_MAP={about:'about',services:'services',blog:'blog',faq:'faq'};
  const clean=value=>String(value??'').trim();

  function setText(element,value){
    const next=clean(value);
    if(element&&next)element.textContent=next;
  }

  function setEyebrow(element,value){
    const next=clean(value);
    if(!element||!next)return;
    const icon=element.querySelector('i');
    if(!icon){element.textContent=next;return;}
    [...element.childNodes].forEach(node=>{if(node!==icon)node.remove();});
    element.append(document.createTextNode(` ${next}`));
  }

  function updateMeta(name,value){
    const next=clean(value);
    if(!next)return;
    let node=document.head.querySelector(`meta[name="${name}"]`);
    if(!node){node=document.createElement('meta');node.name=name;document.head.appendChild(node);}
    node.content=next;
  }

  async function run(){
    let key=PAGE_MAP[document.body?.dataset?.page];
    if(document.body?.classList.contains('patient-relations-page'))key='patientRelations';
    if(!key)return;

    try{
      const response=await fetch('/assets/data/pages.json?v=stable-1',{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      const list=Array.isArray(data)?data:Array.isArray(data.items)?data.items:[];
      const page=list.find(item=>item.id===key&&item.published!==false&&item.status!=='archived');
      if(!page)return;

      const hero=document.querySelector('.about-hero,.services-hero,.blog-hero,.faq-hero,.patient-hero,.hero');
      if(hero){
        setText(hero.querySelector('h1'),page.title);
        // Kurumsal el yazısı imza sabittir. Yönetilebilir açıklama yalnızca normal metin alanına yazılır.
        setText(hero.querySelector('.hero-sub')||hero.querySelector('.lead:not(.signature-tagline)'),page.subtitle);
        setEyebrow(hero.querySelector('.hero-eyebrow,.eyebrow'),page.eyebrow);
      }

      if(clean(page.seoTitle))document.title=clean(page.seoTitle);
      updateMeta('description',page.seoDescription);
    }catch(error){
      console.warn('Sayfa başlık ayarları yüklenemedi; mevcut metin ve tasarım korundu.',error);
    }
  }

  document.readyState==='loading'
    ?document.addEventListener('DOMContentLoaded',run,{once:true})
    :run();
})();
