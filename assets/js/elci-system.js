(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // Google Analytics 4 — analitik yalnızca kullanıcı izni sonrasında yüklenir.
  const GA4_MEASUREMENT_ID = 'G-MT2QY17KDJ';
  const ANALYTICS_CONSENT_KEY = 'elci-analytics-consent';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  function getAnalyticsConsent(){
    try { return localStorage.getItem(ANALYTICS_CONSENT_KEY); }
    catch (_) { return null; }
  }

  function setAnalyticsConsent(value){
    try { localStorage.setItem(ANALYTICS_CONSENT_KEY, value); }
    catch (_) {}
  }

  function loadAnalytics(){
    if (window.__elciGa4Loaded) return;
    window.__elciGa4Loaded = true;

    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', GA4_MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  }

  function denyAnalytics(){
    window.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function showAnalyticsConsent(){
    if (document.getElementById('elciAnalyticsConsent')) return;
    const banner = document.createElement('section');
    banner.id = 'elciAnalyticsConsent';
    banner.className = 'elci-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Analitik çerez tercihi');
    banner.innerHTML = `
      <div class="elci-consent-copy">
        <strong>Analitik tercihi</strong>
        <span>Site kullanımını geliştirmek için anonimleştirilmiş Analytics ölçümü kullanmak istiyoruz. Reddetmeniz siteyi kullanmanızı etkilemez.</span>
        <a href="/kvkk.html">KVKK ve gizlilik bilgileri</a>
      </div>
      <div class="elci-consent-actions">
        <button type="button" class="elci-consent-reject">Reddet</button>
        <button type="button" class="elci-consent-accept">Kabul et</button>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('.elci-consent-accept')?.addEventListener('click', () => {
      setAnalyticsConsent('granted');
      loadAnalytics();
      banner.remove();
    });
    banner.querySelector('.elci-consent-reject')?.addEventListener('click', () => {
      setAnalyticsConsent('denied');
      denyAnalytics();
      banner.remove();
    });
  }

  const analyticsConsent = getAnalyticsConsent();
  if (analyticsConsent === 'granted') {
    loadAnalytics();
  } else if (analyticsConsent === 'denied') {
    denyAnalytics();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showAnalyticsConsent, { once:true });
  } else {
    showAnalyticsConsent();
  }

  // Hasta kazanımında önemli olan temel tıklamaları ayrı etkinlik olarak ölç.
  document.addEventListener('click', event => {
    if (getAnalyticsConsent() !== 'granted' || !window.__elciGa4Loaded) return;
    const link = event.target.closest?.('a[href]');
    if (!link || typeof window.gtag !== 'function') return;
    const href = String(link.getAttribute('href') || '');
    let eventName = '';
    if (href.startsWith('tel:')) eventName = 'phone_click';
    else if (/wa\.me|whatsapp\.com/i.test(href)) eventName = 'whatsapp_click';
    else if (/online-randevu/i.test(href)) eventName = 'appointment_click';
    else if (/google\.com\/maps|maps\.google/i.test(href)) eventName = 'directions_click';
    if (!eventName) return;
    window.gtag('event', eventName, {
      link_url: link.href,
      link_text: (link.textContent || '').trim().slice(0, 120),
      page_path: location.pathname + location.search
    });
  }, { capture: true });

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
      if (window.innerWidth > 992) return;
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
  window.addEventListener('resize', () => { if (window.innerWidth > 992) setMenu(false); });

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
