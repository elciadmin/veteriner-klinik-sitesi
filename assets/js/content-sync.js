(() => {
  'use strict';

  const DATA_URL = '/assets/data/services.json?v=4';
  const text = value => String(value ?? '').trim();
  const isVisible = item => item && item.published !== false && !['archived', 'draft'].includes(item.status);
  const sorted = items => [...items].sort((a, b) => (Number(a.order) || 9999) - (Number(b.order) || 9999) || text(a.title).localeCompare(text(b.title), 'tr'));
  const iconMap = {
    '#i-shield-cross': 'fa-solid fa-truck-medical', '#i-stethoscope': 'fa-solid fa-stethoscope',
    '#i-clipboard': 'fa-solid fa-clipboard-check', '#i-scissors': 'fa-solid fa-scissors',
    '#i-tooth-clean': 'fa-solid fa-tooth', '#i-xray': 'fa-solid fa-vial-circle-check',
    '#i-ecg': 'fa-solid fa-heart-pulse', '#i-repro': 'fa-solid fa-venus-mars',
    '#i-endo': 'fa-solid fa-droplet', '#i-uro': 'fa-solid fa-flask-vial',
    '#i-ortho': 'fa-solid fa-bone', '#i-eye': 'fa-solid fa-eye',
    '#i-derm': 'fa-solid fa-allergies', '#i-pt': 'fa-solid fa-person-walking',
    '#i-boarding': 'fa-solid fa-house-chimney'
  };

  function homeCard(item) {
    const article = document.createElement('article');
    article.className = 's-card';
    article.id = item.id;
    article.dataset.elciCard = '1';
    article.dataset.serviceId = item.id;

    const icon = document.createElement('span');
    icon.className = 's-icon';
    icon.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    const symbol = text(item.icon) || '#i-stethoscope';
    use.setAttribute('href', symbol);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', symbol);
    svg.appendChild(use); icon.appendChild(svg);

    const title = document.createElement('h3'); title.className = 's-title'; title.textContent = text(item.title);
    const summary = document.createElement('p'); summary.className = 's-text'; summary.textContent = text(item.summary);
    const link = document.createElement('a'); link.className = 's-link'; link.href = text(item.href) || `/hizmetler.html#${encodeURIComponent(item.id)}`; link.textContent = 'Detaylı Bilgi';
    article.append(icon, title, summary, link);
    return article;
  }

  function renderHome(items) {
    const featured = document.getElementById('servicesFeatured');
    const track = document.getElementById('servicesTrack');
    if (!featured || !track) return false;
    const visible = sorted(items.filter(isVisible));
    let featuredItems = visible.filter(item => item.homeFeatured).slice(0, 6);
    if (!featuredItems.length) featuredItems = visible.slice(0, 6);
    const featuredIds = new Set(featuredItems.map(item => item.id));
    const otherItems = visible.filter(item => !featuredIds.has(item.id));
    featured.replaceChildren(...featuredItems.map(homeCard));
    track.replaceChildren(...otherItems.map(homeCard));
    const more = document.getElementById('servicesMoreWrap');
    if (more) more.hidden = !otherItems.length;
    return true;
  }

  function findOrCreateGroup(groupName) {
    const groupsRoot = document.querySelector('.service-groups');
    if (!groupsRoot) return null;
    const name = text(groupName) || 'Diğer hizmetler';
    const existing = [...groupsRoot.querySelectorAll('.service-group')].find(group => text(group.querySelector('.group-head h3')?.textContent) === name);
    if (existing) return existing.querySelector('.service-grid');

    const group = document.createElement('div'); group.className = 'service-group';
    const head = document.createElement('div'); head.className = 'group-head reveal is-visible';
    const h3 = document.createElement('h3'); h3.textContent = name;
    const p = document.createElement('p'); p.textContent = 'Yönetim panelinden eklenen ve güncellenen hizmetler.';
    head.append(h3, p);
    const grid = document.createElement('div'); grid.className = 'service-grid';
    group.append(head, grid); groupsRoot.appendChild(group);
    return grid;
  }

  function servicePageCard(item) {
    const article = document.createElement('article');
    article.className = 'service-card cms-service reveal is-visible';
    article.id = item.id;
    article.dataset.serviceId = item.id;
    article.dataset.serviceTitle = text(item.title);

    const icon = document.createElement('div'); icon.className = 'service-icon';
    const i = document.createElement('i'); i.className = text(item.iconClass) || iconMap[text(item.icon)] || 'fa-solid fa-paw'; icon.appendChild(i);
    const title = document.createElement('h4'); title.textContent = text(item.title);
    const summary = document.createElement('p'); summary.dataset.cms = 'summary'; summary.textContent = text(item.summary);
    const details = document.createElement('details');
    const detailsTitle = document.createElement('summary'); detailsTitle.textContent = 'Hizmet kapsamı';
    const body = document.createElement('div'); body.className = 'detail-body'; body.dataset.cms = 'detail';
    const detail = document.createElement('p'); detail.textContent = text(item.detail) || text(item.summary);
    const actions = document.createElement('div'); actions.className = 'detail-actions';
    const appointment = document.createElement('a'); appointment.className = 'mini-btn primary'; appointment.href = '/hasta-iliskileri.html#online-randevu'; appointment.textContent = 'Randevu';
    actions.appendChild(appointment); body.append(detail, actions); details.append(detailsTitle, body);
    article.append(icon, title, summary, details);
    return article;
  }

  function updateExistingNode(node, item) {
    node.hidden = !isVisible(item);
    if (node.hidden) return;
    const title = node.querySelector('.s-title,h3,h4'); if (title && text(item.title)) title.textContent = text(item.title);
    const summary = node.querySelector('.s-text,[data-cms="summary"]'); if (summary) summary.textContent = text(item.summary);
    const detailBox = node.querySelector('[data-cms="detail"]');
    if (detailBox) {
      let p = detailBox.querySelector('p');
      if (!p) { p = document.createElement('p'); detailBox.prepend(p); }
      p.textContent = text(item.detail) || text(item.summary);
    }
    const link = node.querySelector('.s-link'); if (link) link.href = text(item.href) || `/hizmetler.html#${encodeURIComponent(item.id)}`;
    node.dataset.serviceTitle = text(item.title);
  }

  function renderServicePage(items) {
    const existingNodes = [...document.querySelectorAll('.cms-service[data-service-id], [data-service-id].feature-service')];
    const byId = new Map(items.map(item => [text(item.id), item]));
    const existingIds = new Set();

    existingNodes.forEach(node => {
      const id = text(node.dataset.serviceId || node.id);
      existingIds.add(id);
      const item = byId.get(id);
      if (!item) { node.hidden = true; return; }
      updateExistingNode(node, item);
    });

    sorted(items.filter(isVisible)).forEach(item => {
      if (existingIds.has(item.id)) return;
      const grid = findOrCreateGroup(item.group);
      if (grid) grid.appendChild(servicePageCard(item));
    });

    document.querySelectorAll('.service-grid').forEach(grid => {
      const cards = [...grid.querySelectorAll('[data-service-id]')];
      cards.sort((a, b) => {
        const ai = byId.get(text(a.dataset.serviceId));
        const bi = byId.get(text(b.dataset.serviceId));
        return (Number(ai?.order) || 9999) - (Number(bi?.order) || 9999);
      }).forEach(card => grid.appendChild(card));
    });
    return existingNodes.length > 0 || Boolean(document.querySelector('.service-groups'));
  }

  async function sync() {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Hizmet verisi alınamadı (${response.status})`);
      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      renderHome(items);
      renderServicePage(items);
      document.dispatchEvent(new CustomEvent('elci:services-rendered', { detail: { count: items.filter(isVisible).length } }));
    } catch (error) {
      console.error('Hizmet içerikleri eşitlenemedi:', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();
