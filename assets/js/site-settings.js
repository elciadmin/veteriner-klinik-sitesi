(()=>{
  'use strict';
  const clean=value=>String(value??'').trim();
  const setText=(selector,value)=>{if(!clean(value))return;document.querySelectorAll(selector).forEach(el=>{el.textContent=clean(value)});};
  async function run(){
    try{
      const response=await fetch('/assets/data/site-settings.json?v=unified-2',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const raw=await response.json(),brand=raw.brand||{},contact=raw.contact||{};
      const clinicName=brand.name||raw.clinicName,tagline=brand.tagline||raw.tagline;
      const address=contact.addressShort||contact.address||raw.address;
      const phone=contact.phone||raw.phoneHref||raw.phone,phoneDisplay=contact.phoneDisplay||raw.phoneDisplay;
      const email=contact.email||raw.email,hours=contact.workingHours||raw.hours;
      setText('.brand-copy strong',clinicName);setText('.header-signature',tagline);setText('[data-site-hours]',hours);
      document.querySelectorAll('.header-contact').forEach(group=>{
        const loc=group.querySelector('.fa-location-dot')?.parentElement;if(loc&&clean(address)){const icon=loc.querySelector('i,svg');loc.textContent='';if(icon)loc.append(icon);loc.append(document.createTextNode(` ${address}`));}
        const phoneLink=group.querySelector('a[href^="tel:"]');if(phoneLink&&clean(phone)){phoneLink.href=`tel:${String(phone).replace(/\D+/g,'')}`;if(clean(phoneDisplay)){const icon=phoneLink.querySelector('i,svg');phoneLink.textContent='';if(icon)phoneLink.append(icon);phoneLink.append(document.createTextNode(` ${phoneDisplay}`));}}
        const emailLink=group.querySelector('a[href^="mailto:"]');if(emailLink&&clean(email)){emailLink.href=`mailto:${email}`;}
      });
    }catch(error){console.warn('Site ayarları yüklenemedi; sayfadaki mevcut bilgiler korundu.',error);}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run,{once:true}):run();
})();
