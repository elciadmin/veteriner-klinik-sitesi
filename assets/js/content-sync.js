(() => {
  'use strict';

  /*
    Tek hizmet kaynağı: /assets/data/services.json
    - Ana sayfa ve Hizmetler sayfası aynı kayıtları kullanır.
    - Mevcut kart DOM'u klonlanır/güncellenir; tasarım sınıfları ve HTML yapısı korunur.
    - JSON dosyası bu pakette yer almaz; paneldeki test kayıtları üzerine yazılmaz.
  */
  const DATA_URL = '/assets/data/services.json?v=6';
  const text = value => String(value ?? '').trim();
  const lower = value => text(value).toLocaleLowerCase('tr-TR');
  const normalizeId = value => lower(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const isVisible = item => item && item.published !== false && !['archived', 'draft'].includes(lower(item.status));
  const sorted = items => [...items].sort((a, b) =>
    (Number(a.order) || 9999) - (Number(b.order) || 9999) ||
    text(a.title).localeCompare(text(b.title), 'tr')
  );
  const normalizeItems = data => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.services)) return data.services;
    return [];
  };

  function setSvgIcon(card, item) {
    const use = card.querySelector('.s-icon use');
    if (!use) return;
    const symbol = text(item.icon) || '#i-stethoscope';
    use.setAttribute('href', symbol);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', symbol);
  }

  function updateHomeCard(card, item) {
    card.hidden = false;
    card.id = text(item.id) || normalizeId(item.title);
    card.dataset.elciCard = '1';
    card.dataset.serviceId = card.id;
    setSvgIcon(card, item);
    const title = card.querySelector('.s-title');
    const summary = card.querySelector('.s-text');
    const link = card.querySelector('.s-link');
    if (title) title.textContent = text(item.title);
    if (summary) summary.textContent = text(item.summary || item.detail);
    if (link) {
      link.href = text(item.href) || `/hizmetler.html#${encodeURIComponent(card.id)}`;
      if (!text(link.textContent)) link.textContent = 'Detaylı Bilgi';
    }
    return card;
  }

  function cloneHomeCard(template, item) {
    if (!template) return null;
    const card = template.cloneNode(true);
    card.removeAttribute('style');
    card.classList.remove('is-hidden');
    return updateHomeCard(card, item);
  }

  function renderHome(items) {
    const featured = document.getElementById('servicesFeatured');
    const track = document.getElementById('servicesTrack');
    if (!featured || !track) return false;

    const visible = sorted(items.filter(isVisible));
    if (!visible.length) throw new Error('services.json içinde yayındaki hizmet bulunamadı');

    const allExisting = [...featured.querySelectorAll('.s-card'), ...track.querySelectorAll('.s-card')];
    const existingById = new Map(allExisting.map(card => [normalizeId(card.dataset.serviceId || card.id), card]));
    const featuredTemplate = featured.querySelector('.s-card')?.cloneNode(true) || track.querySelector('.s-card')?.cloneNode(true);
    const trackTemplate = track.querySelector('.s-card')?.cloneNode(true) || featuredTemplate?.cloneNode(true);

    let featuredItems = visible.filter(item => item.homeFeatured === true);
    if (!featuredItems.length) featuredItems = visible;
    featuredItems = featuredItems.slice(0, 6);
    const featuredIds = new Set(featuredItems.map(item => normalizeId(item.id || item.title)));
    const otherItems = visible.filter(item => !featuredIds.has(normalizeId(item.id || item.title)));

    const used = new Set();
    const cardFor = (item, template) => {
      const id = normalizeId(item.id || item.title);
      let card = existingById.get(id);
      if (card && used.has(card)) card = null;
      if (!card) card = cloneHomeCard(template, item);
      if (!card) return null;
      used.add(card);
      return updateHomeCard(card, item);
    };

    const featuredCards = featuredItems.map(item => cardFor(item, featuredTemplate)).filter(Boolean);
    const otherCards = otherItems.map(item => cardFor(item, trackTemplate)).filter(Boolean);

    /* Var olan kartlar yeniden yaratılmak yerine aynı DOM yapısıyla taşınır. */
    featured.replaceChildren(...featuredCards);
    track.replaceChildren(...otherCards);
    featured.dataset.servicesReady = 'json';
    track.dataset.servicesReady = 'json';

    const more = document.getElementById('servicesMoreWrap');
    if (more) more.hidden = otherCards.length === 0;
    return true;
  }

  const GROUP_ALIASES = new Map([
    ['dahili-branslar', 'Dahili branşlar'],
    ['cerrahi-hareket-ve-ureme', 'Cerrahi, hareket ve üreme sağlığı'],
    ['cerrahi-hareket-ve-ureme-sagligi', 'Cerrahi, hareket ve üreme sağlığı'],
    ['destek-ve-ozel-surecler', 'Destek ve özel süreçler'],
    ['diger-hizmetler', 'Diğer hizmetler']
  ]);

  function canonicalGroup(value) {
    const raw = text(value) || 'Diğer hizmetler';
    return GROUP_ALIASES.get(normalizeId(raw)) || raw;
  }

  function groupTitle(group) {
    return text(group.querySelector('.group-head h3, :scope > h2, :scope > h3'));
  }

  function findGroupRoot(name) {
    const root = document.querySelector('.service-groups');
    if (!root) return null;
    const wanted = canonicalGroup(name);
    let group = [...root.querySelectorAll(':scope > .service-group')]
      .find(node => canonicalGroup(groupTitle(node)) === wanted);
    if (group) return group;

    const source = root.querySelector(':scope > .service-group');
    if (!source) return null;
    group = source.cloneNode(true);
    group.querySelectorAll('.service-card').forEach(node => node.remove());
    const heading = group.querySelector('.group-head h3, :scope > h2, :scope > h3');
    if (heading) heading.textContent = wanted;
    const description = group.querySelector('.group-head p');
    if (description) description.textContent = 'Yönetim panelinden eklenen ve aynı hizmet verisinden yayınlanan hizmetler.';
    group.classList.add('is-visible');
    root.appendChild(group);
    return group;
  }

  function updateFontAwesomeIcon(card, item, isNew = false) {
    const icon = card.querySelector('.service-icon i');
    if (!icon) return;
    const wanted = text(item.iconClass);
    if (wanted) icon.className = wanted;
    else if (isNew) icon.className = 'fa-solid fa-stethoscope';
  }

  function updateServicePageCard(card, item, isNew = false) {
    card.hidden = !isVisible(item);
    if (card.hidden) return card;
    const id = text(item.id) || normalizeId(item.title);
    card.id = id;
    card.dataset.serviceId = id;
    card.dataset.serviceTitle = text(item.title);

    /* Kart türü ne olursa olsun mevcut sınıflar ve iç tasarım korunur. */
    const title = card.querySelector('h3, h4');
    const summary = card.querySelector('[data-cms="summary"], .s-text');
    const detailBox = card.querySelector('[data-cms="detail"]');
    if (title) title.textContent = text(item.title);
    if (summary) summary.textContent = text(item.summary || item.detail);
    if (detailBox) {
      let paragraph = detailBox.querySelector('p');
      if (!paragraph) {
        paragraph = document.createElement('p');
        detailBox.prepend(paragraph);
      }
      paragraph.textContent = text(item.detail || item.summary);
    }
    updateFontAwesomeIcon(card, item, isNew);
    if (isNew) card.classList.add('is-visible');
    return card;
  }

  function createSimpleServiceCard(template, item) {
    if (!template) return null;
    const card = template.cloneNode(true);
    card.classList.remove('reverse');
    card.removeAttribute('style');
    return updateServicePageCard(card, item, true);
  }

  function renderServicePage(items) {
    const root = document.querySelector('.service-groups');
    const featuredStack = document.querySelector('.featured-stack');
    if (!root && !featuredStack) return false;

    const visible = sorted(items.filter(isVisible));
    if (!visible.length) throw new Error('services.json içinde yayındaki hizmet bulunamadı');
    const byId = new Map(visible.map(item => [normalizeId(item.id || item.title), item]));

    const featuredNodes = [...document.querySelectorAll('.featured-stack .cms-service[data-service-id]')];
    featuredNodes.forEach(card => {
      const item = byId.get(normalizeId(card.dataset.serviceId || card.id));
      card.hidden = !item;
      if (item) updateServicePageCard(card, item);
    });

    const simpleExisting = [...root?.querySelectorAll('.service-card.cms-service[data-service-id]') || []];
    const simpleById = new Map(simpleExisting.map(card => [normalizeId(card.dataset.serviceId || card.id), card]));
    const template = simpleExisting[0]?.cloneNode(true) || null;
    const featuredIds = new Set(featuredNodes.map(card => normalizeId(card.dataset.serviceId || card.id)));

    /* JSON'da bulunmayan eski statik kartlar görünmez; JSON tek kaynak olur. */
    simpleExisting.forEach(card => {
      if (!byId.has(normalizeId(card.dataset.serviceId || card.id))) card.hidden = true;
    });

    const groupsUsed = new Set();
    visible.forEach(item => {
      const id = normalizeId(item.id || item.title);
      if (featuredIds.has(id)) return;
      const group = findGroupRoot(item.group);
      const grid = group?.querySelector('.service-grid');
      if (!grid) return;
      groupsUsed.add(group);
      let card = simpleById.get(id);
      if (!card) card = createSimpleServiceCard(template, item);
      if (!card) return;
      updateServicePageCard(card, item, !simpleById.has(id));
      grid.appendChild(card); // JSON sırasına göre mevcut kartı güvenle taşır.
    });

    [...root.querySelectorAll(':scope > .service-group')].forEach(group => {
      const hasVisibleCard = [...group.querySelectorAll('.service-card')].some(card => !card.hidden);
      group.hidden = !hasVisibleCard;
    });
    root.dataset.servicesReady = 'json';
    return true;
  }

  function report(status, detail = {}) {
    document.documentElement.dataset.servicesStatus = status;
    document.dispatchEvent(new CustomEvent('elci:services-rendered', { detail: { status, ...detail } }));
  }

  async function sync() {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Hizmet verisi alınamadı (${response.status})`);
      const data = await response.json();
      const items = normalizeItems(data);
      if (!items.length) throw new Error('Hizmet JSON biçimi geçersiz veya liste boş');
      const homeRendered = renderHome(items);
      const pageRendered = renderServicePage(items);
      report('ready', { count: items.filter(isVisible).length, homeRendered, pageRendered });
    } catch (error) {
      console.error('[Elçi Hizmet Senkronizasyonu]', error);
      document.getElementById('servicesFeatured')?.setAttribute('data-services-ready', 'error');
      document.querySelector('.service-groups')?.setAttribute('data-services-ready', 'error');
      report('error', { message: error.message });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();
