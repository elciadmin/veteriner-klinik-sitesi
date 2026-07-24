(() => {
  'use strict';

  const classify = image => {
    if (!(image instanceof HTMLImageElement)) return;
    const apply = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const portrait = image.naturalHeight / image.naturalWidth > 1.12;
      image.classList.toggle('is-portrait-media', portrait);
      image.closest('.editorial-split')?.classList.toggle('has-portrait-media', portrait);
    };
    if (image.complete) apply();
    else image.addEventListener('load', apply, { once: true });
  };

  document.querySelectorAll('.blog-article-content .editorial-split-media img').forEach(classify);
})();
