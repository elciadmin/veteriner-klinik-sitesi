(() => {
  'use strict';

  const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
  const pageKey = path === '/' || /\/index\.html$/i.test(path) ? 'home'
    : /about\.html$/i.test(path) ? 'about'
    : /hizmetler\.html$/i.test(path) ? 'services'
    : /blog\.html$/i.test(path) ? 'blog'
    : /sss\.html$/i.test(path) ? 'faq'
    : /hasta-iliskileri\.html$/i.test(path) ? 'patientRelations'
    : '';

  document.documentElement.dataset.elciPage = pageKey;

  const text = value => String(value ?? '').trim();
  const setText = (selector, value) => {
    if (!text(value)) return;
    const node = document.querySelector(selector);
    if (node) node.textContent = text(value);
  };

  function normalizeHeaderMotion() {
    document.querySelectorAll('.nav-intro-ready,.menu-intro-ready').forEach(node => {
      node.classList.remove('nav-intro-ready', 'menu-intro-ready');
    });
    document.querySelectorAll('.header-main nav li,.header-main .brand-lockup,.header-main .brand-mark').forEach(node => {
      node.style.removeProperty('animation');
      node.style.removeProperty('animation-delay');
      node.style.removeProperty('transform');
      node.style.removeProperty('opacity');
    });
  }

  function installRevealMotion() {
    const heroSelectors = [
      '.hero-copy', '.patient-hero-copy', '.about-hero-card', '.service-hero-card',
      '.editorial-hero-card', '.patient-hero-card', '.hero-brand-card'
    ];
    heroSelectors.forEach(selector => document.querySelectorAll(selector).forEach(node => node.classList.add('elci-reveal')));

    const nodes = [...document.querySelectorAll('.reveal,.elci-reveal')];
    if (!nodes.length) return;
    document.body.classList.add('elci-motion-ready');

    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(node => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -7% 0px' });

    nodes.forEach(node => observer.observe(node));
  }

  async function loadJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    const brand = settings.brand || {};
    const contact = settings.contact || {};
    const social = settings.social || {};

    document.querySelectorAll('.brand-copy strong,.logo-text .site-name').forEach(node => {
      if (text(brand.name)) node.textContent = brand.name;
    });
    document.querySelectorAll('.header-signature,.brand-copy .signature-tagline').forEach(node => {
      if (text(brand.tagline)) node.textContent = brand.tagline;
    });
    document.querySelectorAll('.brand-mark img,.brand-lockup img').forEach(image => {
      if (text(brand.logo)) image.src = brand.logo;
    });

    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
      if (!text(contact.phone)) return;
      link.href = `tel:${contact.phone.replace(/\D+/g, '')}`;
      if (link.closest('.header-contact') && text(contact.phoneDisplay)) {
        const icon = link.querySelector('i,svg');
        link.textContent = '';
        if (icon) link.append(icon);
        link.append(document.createTextNode(` ${contact.phoneDisplay}`));
      }
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
      if (!text(contact.email)) return;
      link.href = `mailto:${contact.email}`;
      if (link.closest('.header-contact')) {
        const icon = link.querySelector('i,svg');
        link.textContent = '';
        if (icon) link.append(icon);
        link.append(document.createTextNode(` ${contact.email}`));
      }
    });
    document.querySelectorAll('.header-contact').forEach(group => {
      const locationNode = [...group.querySelectorAll('span')].find(node => /Meram|Konya|Mah\./i.test(node.textContent || ''));
      if (locationNode && text(contact.addressShort)) {
        const icon = locationNode.querySelector('i,svg');
        locationNode.textContent = '';
        if (icon) locationNode.append(icon);
        locationNode.append(document.createTextNode(` ${contact.addressShort}`));
      }
    });

    if (text(contact.workingHours)) {
      document.querySelectorAll('.hero-notice').forEach(node => {
        if (!/saat|09[.:]00|21[.:]00|her gün/i.test(node.textContent || '')) return;
        const icon = node.querySelector('i,svg');
        node.textContent = '';
        if (icon) node.append(icon);
        node.append(document.createTextNode(` ${contact.workingHours}`));
      });
    }
    if (text(social.instagram)) document.querySelectorAll('a[href*="instagram.com"]').forEach(link => { link.href = social.instagram; });
    if (text(social.youtube)) document.querySelectorAll('a[href*="youtube.com"],a[href*="youtu.be"]').forEach(link => { link.href = social.youtube; });
  }

  function applyPageCopy(pages) {
    if (!pageKey || !pages) return;
    const list = Array.isArray(pages) ? pages : Array.isArray(pages.items) ? pages.items : [];
    const item = list.find(entry => entry.id === pageKey && entry.published !== false && entry.status !== 'archived');
    if (!item) return;
    const selectors = {
      home: { title: '.hero h1', subtitle: '.hero .hero-sub,.hero .lead', eyebrow: '.hero .hero-eyebrow' },
      about: { title: '.about-hero h1,.hero h1', subtitle: '.about-hero .hero-sub,.hero .hero-sub', eyebrow: '.about-hero .hero-eyebrow,.hero .hero-eyebrow' },
      services: { title: '.services-hero h1,.hero h1', subtitle: '.services-hero .hero-sub,.hero .hero-sub', eyebrow: '.services-hero .hero-eyebrow,.hero .hero-eyebrow' },
      blog: { title: '.blog-hero h1', subtitle: '.blog-hero .hero-sub', eyebrow: '.blog-hero .hero-eyebrow' },
      faq: { title: '.faq-hero h1,.blog-hero h1,.hero h1', subtitle: '.faq-hero .hero-sub,.blog-hero .hero-sub,.hero .hero-sub', eyebrow: '.faq-hero .hero-eyebrow,.blog-hero .hero-eyebrow,.hero .hero-eyebrow' },
      patientRelations: { title: '.patient-hero h1,.hero h1', subtitle: '.patient-hero .hero-sub,.hero .hero-sub', eyebrow: '.patient-hero .hero-eyebrow,.hero .hero-eyebrow' }
    }[pageKey];
    if (!selectors) return;
    setText(selectors.title, item.title);
    setText(selectors.subtitle, item.subtitle);
    setText(selectors.eyebrow, item.eyebrow);
    if (text(item.seoTitle)) document.title = item.seoTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && text(item.seoDescription)) meta.content = item.seoDescription;
  }

  async function applyManagedContent() {
    const [settings, pages] = await Promise.all([
      loadJson('/assets/data/site-settings.json?v=4').catch(() => null),
      loadJson('/assets/data/pages.json?v=4').catch(() => null)
    ]);
    applySettings(settings);
    applyPageCopy(pages);
  }

  function init() {
    normalizeHeaderMotion();
    installRevealMotion();
    applyManagedContent();
    setTimeout(normalizeHeaderMotion, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
