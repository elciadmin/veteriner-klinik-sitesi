(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // Mobil menü ve dokunmatik açılır menüler: sayfaların farklı eski kodlarını tek davranışta toplar.
  const menuButton = $('#mobileMenuBtn');
  const menu = $('#mainMenu');
  const setMenu = open => {
    if (!menu || !menuButton) return;
    menu.classList.toggle('show', open);
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.innerHTML = `<i class="fa-solid ${open ? 'fa-xmark' : 'fa-bars'}"></i>`;
  };

  menuButton?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    setMenu(!menu.classList.contains('show'));
  }, { capture:true });

  $$('.dropdown > a').forEach(link => {
    link.addEventListener('click', event => {
      if (window.innerWidth > 900) return;
      event.stopImmediatePropagation();
      const item = link.closest('.dropdown');
      if (!item) return;
      if (!item.classList.contains('active')) {
        event.preventDefault();
        $$('.dropdown.active', menu || document).forEach(other => {
          if (other !== item) other.classList.remove('active');
        });
        item.classList.add('active');
        link.setAttribute('aria-expanded', 'true');
      }
    }, { capture:true });
  });

  $$('a', menu || document).forEach(link => {
    if (!link.closest('.dropdown-content')) link.addEventListener('click', () => setMenu(false));
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setMenu(false); });

  // Dialog açıldığında arka sayfanın kaymasını engelle.
  const watchDialog = dialog => {
    if (!(dialog instanceof HTMLDialogElement)) return;
    const update = () => document.body.classList.toggle('dialog-open', $$('dialog[open]').length > 0);
    dialog.addEventListener('close', update);
    dialog.addEventListener('cancel', update);
    new MutationObserver(update).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  };
  $$('dialog').forEach(watchDialog);

  // Duyurular: ileri tarihli yayına girer, bitiş tarihinde otomatik kaybolur.
  async function loadAnnouncement() {
    const host = $('#siteAnnouncement');
    if (!host) return;
    try {
      const response = await fetch('/assets/data/announcements.json', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      const now = Date.now();
      const items = (Array.isArray(payload) ? payload : payload.items || [])
        .filter(item => item && item.published !== false && item.showOnHome !== false)
        .filter(item => !item.publishAt || new Date(item.publishAt).getTime() <= now)
        .filter(item => !item.unpublishAt || new Date(item.unpublishAt).getTime() > now)
        .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
      const item = items[0];
      if (!item) return;
      const dismissKey = `elci-announcement:${item.id || item.title || item.publishAt}`;
      if (item.dismissible !== false && sessionStorage.getItem(dismissKey) === '1') return;
      host.dataset.level = item.level || 'info';
      const message = document.createElement('span');
      if (item.title) {
        const strong = document.createElement('strong');
        strong.textContent = `${item.title}: `;
        message.appendChild(strong);
      }
      message.append(document.createTextNode(item.message || ''));
      const container = document.createElement('div');
      container.className = 'container';
      container.appendChild(message);
      if (item.linkUrl && item.linkLabel) {
        const link = document.createElement('a');
        link.href = item.linkUrl;
        link.textContent = item.linkLabel;
        container.appendChild(link);
      }
      host.replaceChildren(container);
      if (item.dismissible !== false) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'site-announcement-close';
        close.setAttribute('aria-label', 'Duyuruyu kapat');
        close.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        close.addEventListener('click', () => {
          sessionStorage.setItem(dismissKey, '1');
          host.hidden = true;
        });
        host.appendChild(close);
      }
      host.hidden = false;
    } catch (error) {
      console.warn('Duyuru yüklenemedi.', error);
    }
  }

  loadAnnouncement();

  // Yıl alanları.
  $$('#yil').forEach(node => { node.textContent = String(new Date().getFullYear()); });
})();
