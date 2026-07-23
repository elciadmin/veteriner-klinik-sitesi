(() => {
  'use strict';

  const classify = image => {
    if (!(image instanceof HTMLImageElement)) return;
    const apply = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const portrait = image.naturalHeight / image.naturalWidth > 1.12;
      image.classList.toggle('is-portrait-media', portrait);
      image.closest('.admin-preview-split')?.classList.toggle('has-portrait-media', portrait);
    };
    if (image.complete) apply();
    else image.addEventListener('load', apply, { once: true });
  };

  const scan = root => {
    if (!(root instanceof Element || root instanceof Document)) return;
    root.querySelectorAll?.('.admin-preview-split img').forEach(classify);
  };

  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) {
        if (node.matches('.admin-preview-split img')) classify(node);
        scan(node);
      }
    }));
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan(document);
})();
