(() => {
  'use strict';

  const chips = document.getElementById('faqChips');
  const content = document.getElementById('faqContent');
  const search = document.getElementById('faqSearch');
  const count = document.getElementById('faqCount');
  const updated = document.getElementById('faqUpdated');
  if (!chips || !content) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const slugify = value => String(value || '').toLocaleLowerCase('tr-TR')
    .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
    .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR');
  const isVisible = item => {
    if (!item || item.published === false || item.status === 'draft' || item.status === 'archived') return false;
    if (item.scheduledAt) {
      const date = new Date(item.scheduledAt);
      if (!Number.isNaN(date.getTime()) && date > new Date()) return false;
    }
    return Boolean(item.q && item.a);
  };

  let activeCategory = 'Tümü';
  let items = [];

  function answerHtml(value) {
    return escapeHtml(value).replace(/\n/g, '<br>').replace(
      /0332 322 32 20/g,
      '<a href="tel:03323223220">0332 322 32 20</a>'
    );
  }

  function applyFilters() {
    const query = normalize(search?.value).trim();
    let visibleCount = 0;
    content.querySelectorAll('.faq-group').forEach(group => {
      const categoryMatches = activeCategory === 'Tümü' || group.dataset.cat === activeCategory;
      let groupCount = 0;
      group.querySelectorAll('.faq').forEach(detail => {
        const textMatches = !query || normalize(detail.textContent).includes(query);
        const show = categoryMatches && textMatches;
        detail.hidden = !show;
        if (show) { visibleCount += 1; groupCount += 1; }
      });
      group.hidden = groupCount === 0;
    });
    const noResults = document.getElementById('noResults');
    if (noResults) noResults.classList.toggle('hidden', visibleCount > 0);
    if (count) count.textContent = String(visibleCount);
  }

  function activate(button) {
    activeCategory = button.dataset.cat || 'Tümü';
    chips.querySelectorAll('.faq-chip').forEach(node => {
      const active = node === button;
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', String(active));
    });
    applyFilters();
  }

  function bindInteractions() {
    chips.querySelectorAll('.faq-chip').forEach(button => button.addEventListener('click', () => activate(button)));
    search?.addEventListener('input', applyFilters);
    content.querySelectorAll('.faq').forEach(detail => detail.addEventListener('toggle', () => {
      if (!detail.open) return;
      content.querySelectorAll('.faq[open]').forEach(other => { if (other !== detail) other.open = false; });
    }));
    content.querySelectorAll('.linkcopy').forEach(button => button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      const detail = button.closest('.faq');
      const url = `${location.origin}${location.pathname}#${detail.id}`;
      try {
        await navigator.clipboard.writeText(url);
        button.title = 'Bağlantı kopyalandı';
      } catch {
        location.hash = detail.id;
      }
    }));
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      const target = document.getElementById(hash);
      if (target) {
        target.open = true;
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      }
    }
  }

  function render(data) {
    items = (Array.isArray(data?.items) ? data.items : []).filter(isVisible);
    const categoryMap = new Map();
    items.forEach(item => {
      const category = String(item.category || 'Genel').trim();
      if (!categoryMap.has(category)) categoryMap.set(category, []);
      categoryMap.get(category).push(item);
    });
    const categories = [...categoryMap.keys()];
    chips.innerHTML = [
      '<button class="faq-chip active" type="button" data-cat="Tümü" aria-pressed="true">Tümü</button>',
      ...categories.map(category => `<button class="faq-chip" type="button" data-cat="${escapeHtml(category)}" aria-pressed="false">${escapeHtml(category)}</button>`)
    ].join('');
    content.innerHTML = categories.map(category => `
      <div class="faq-group" data-cat="${escapeHtml(category)}">
        <h2>${escapeHtml(category)}</h2>
        ${categoryMap.get(category).map(item => {
          const id = item.id || slugify(item.q);
          return `<details class="faq" id="${escapeHtml(id)}">
            <summary><span class="q"><span class="dot"></span>${escapeHtml(item.q)}</span></summary>
            <button class="linkcopy" type="button" title="Bu sorunun bağlantısını kopyala" aria-label="Bağlantıyı kopyala"><i class="fa-solid fa-link"></i></button>
            <p>${answerHtml(item.a)}</p>
          </details>`;
        }).join('')}
      </div>`).join('') + `
      <div id="noResults" class="no-results hidden" aria-live="polite">
        Aradığınız yanıtı bulamadınız mı? <a href="/hasta-iliskileri.html#sikayet-oneri">Bize yazın</a> veya <a href="tel:03323223220">0332 322 32 20</a> numarasını arayın.
      </div>
      <p class="faq-footer-note">Sorular yönetim panelinden güncellenmektedir.</p>`;
    if (count) count.textContent = String(items.length);
    if (updated) updated.textContent = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    const schema = {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: items.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } }))
    };
    let schemaNode = [...document.querySelectorAll('script[type="application/ld+json"]')].find(node => node.textContent.includes('FAQPage'));
    if (!schemaNode) { schemaNode = document.createElement('script'); schemaNode.type = 'application/ld+json'; document.head.appendChild(schemaNode); }
    schemaNode.textContent = JSON.stringify(schema);
    bindInteractions();
    applyFilters();
  }

  fetch('/assets/data/faq.json?v=direct-json-v3', { cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error('SSS verisi yüklenemedi.'); return response.json(); })
    .then(render)
    .catch(error => {
      console.error(error);
      content.innerHTML = '<div class="no-results">Sorular şu anda yüklenemedi. Lütfen sayfayı yenileyin.</div>';
    });
})();
