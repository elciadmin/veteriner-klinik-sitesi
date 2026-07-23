(() => {
  'use strict';
  const classify = image => {
    if (!(image instanceof HTMLImageElement)) return;
    const apply = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const portrait = image.naturalHeight / image.naturalWidth > 1.08;
      const flow = image.closest('.editorial-flow');
      flow?.classList.toggle('has-portrait-media', portrait);
      if (portrait && flow?.classList.contains('fit-cover')) {
        flow.classList.remove('fit-cover');
        flow.classList.add('fit-contain');
      }
    };
    if (image.complete) apply();
    else image.addEventListener('load', apply, {once:true});
  };
  document.querySelectorAll('.blog-article-content .editorial-flow-media img').forEach(classify);
})();
