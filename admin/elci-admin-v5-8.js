(() => {
  'use strict';
  const classify = image => {
    if (!(image instanceof HTMLImageElement)) return;
    const apply = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const portrait = image.naturalHeight / image.naturalWidth > 1.08;
      const flow = image.closest('.admin-preview-flow');
      if (portrait && flow?.classList.contains('fit-cover')) {
        flow.classList.remove('fit-cover');
        flow.classList.add('fit-contain');
      }
    };
    if (image.complete) apply();
    else image.addEventListener('load', apply, {once:true});
  };
  const scan = root => root.querySelectorAll?.('.admin-preview-flow img').forEach(classify);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node instanceof Element) scan(node);
  }))).observe(document.documentElement,{childList:true,subtree:true});
  scan(document);
})();
