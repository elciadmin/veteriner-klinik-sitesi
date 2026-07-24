(() => {
  'use strict';

  // Yönetim ön izlemesinde yüklenemeyen görseller boş kutu bırakmasın.
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;

    const split = image.closest('.admin-preview-split');
    if (split) {
      image.remove();
      split.classList.add('preview-media-missing');
      return;
    }

    const figure = image.closest('.admin-preview-image, .admin-preview-gallery figure');
    if (figure) figure.hidden = true;
  }, true);

  // Marka logosu kapak olarak seçildiyse ön izlemede devleşmesini engelle.
  const markBrandCovers = root => {
    root.querySelectorAll('.health-preview-cover img, .admin-preview-cover').forEach(image => {
      const source = image.getAttribute('src') || '';
      if (/elci[-_]?logo|\/logo\./i.test(source)) {
        image.closest('.health-preview-cover')?.classList.add('is-brand-cover');
      }
    });
  };

  const observer = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node instanceof Element) markBrandCovers(node);
      });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  markBrandCovers(document);
})();
