(()=>{
  'use strict';
  const text=(selector,value)=>document.querySelectorAll(selector).forEach(el=>{if(value)el.textContent=value});
  async function run(){
    try{
      const r=await fetch('/assets/data/site-settings.json?v=final-1',{cache:'no-store'}); if(!r.ok)throw new Error();
      const s=await r.json();
      text('.brand-copy strong',s.clinicName); text('.header-signature',s.tagline);
      document.querySelectorAll('.header-contact').forEach(group=>{
        const loc=group.querySelector('.fa-location-dot')?.parentElement;if(loc&&s.address)loc.lastChild.textContent=' '+s.address;
        const phone=group.querySelector('a[href^="tel:"]');if(phone){phone.href=s.phoneHref||phone.href;if(s.phoneDisplay)phone.lastChild.textContent=' '+s.phoneDisplay}
        const email=group.querySelector('a[href^="mailto:"]');if(email&&s.email){email.href=`mailto:${s.email}`;email.lastChild.textContent=' '+s.email}
      });
      text('[data-site-hours]',s.hours);
    }catch(e){console.warn('Site ayarları yüklenemedi; sayfadaki mevcut bilgiler korundu.');}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run):run();
})();
