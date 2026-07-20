(()=>{
  'use strict';
  function run(){
    const nodes=[...document.querySelectorAll('.reveal,.fade-up,.animate-in')];
    if(!nodes.length)return;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const show=node=>node.classList.add('visible','is-visible');
    if(reduced||!('IntersectionObserver' in window)){nodes.forEach(show);return;}
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting){show(entry.target);observer.unobserve(entry.target);}});
    },{threshold:.08,rootMargin:'0px 0px -6% 0px'});
    nodes.forEach(node=>observer.observe(node));
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run,{once:true}):run();
})();
