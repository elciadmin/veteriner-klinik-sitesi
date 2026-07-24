(() => {
  'use strict';
  const chipsHost = document.getElementById('faqChips');
  const content = document.getElementById('faqContent');
  if (!chipsHost || !content) return;

  const search = document.getElementById('faqSearch');
  const count = document.getElementById('faqCount');
  const openAll = document.getElementById('openAll');
  const closeAll = document.getElementById('closeAll');
  const updated = document.getElementById('faqUpdated');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const answerHtml = value => esc(value).replace(/\n/g, '<br>').replace(/0332 322 32 20/g, '<a href="tel:+903323223220">0332 322 32 20</a>');
  let activeCategory = 'Tümü';
  let items = [];

  function render() {
    const categories = [];
    const grouped = new Map();
    items.forEach(item => {
      const category = String(item.category || 'Genel').trim();
      if (!grouped.has(category)) { grouped.set(category, []); categories.push(category); }
      grouped.get(category).push(item);
    });

    chipsHost.innerHTML = ['Tümü', ...categories].map((category, index) =>
      `<button class="faq-chip${index === 0 ? ' active' : ''}" type="button" data-cat="${esc(category)}" aria-pressed="${index === 0}">${esc(category)}</button>`
    ).join('');

    content.innerHTML = categories.map(category =>
      `<section class="faq-group" data-cat="${esc(category)}"><h2>${esc(category)}</h2>${grouped.get(category).map(item =>
        `<details class="faq" id="${esc(item.id)}"><summary><span class="q"><span class="dot" aria-hidden="true"></span>${esc(item.q)}</span></summary><button class="linkcopy" type="button" aria-label="Bu sorunun bağlantısını kopyala" title="Bağlantıyı kopyala"><i class="fa-solid fa-link" aria-hidden="true"></i></button><div class="a"><p>${answerHtml(item.a)}</p></div></details>`
      ).join('')}</section>`
    ).join('') + '<div id="noResults" class="no-results hidden" aria-live="polite">Aradığınız yanıtı bulamadınız mı? <a href="/hasta-iliskileri.html#sikayet-oneri">Bize yazın</a> veya <a href="tel:+903323223220">0332 322 32 20</a> numarasını arayın.</div>';

    chipsHost.querySelectorAll('.faq-chip').forEach(button => button.addEventListener('click', () => {
      activeCategory = button.dataset.cat || 'Tümü';
      chipsHost.querySelectorAll('.faq-chip').forEach(chip => {
        const selected = chip === button;
        chip.classList.toggle('active', selected);
        chip.setAttribute('aria-pressed', String(selected));
      });
      applyFilters(true);
    }));

    content.querySelectorAll('.linkcopy').forEach(button => button.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation();
      const detail = button.closest('details');
      if (!detail?.id) return;
      const url = `${location.origin}${location.pathname}#${detail.id}`;
      try {
        await navigator.clipboard.writeText(url);
        button.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
        history.replaceState(null, '', `#${detail.id}`);
        setTimeout(() => { button.innerHTML = '<i class="fa-solid fa-link" aria-hidden="true"></i>'; }, 1200);
      } catch { location.hash = detail.id; }
    }));

    updateSchema();
    applyFilters(false);
    openFromHash();
  }

  function applyFilters(scroll) {
    const query = normalize(search?.value || '');
    let visible = 0;
    content.querySelectorAll('.faq-group').forEach(group => {
      let groupVisible = false;
      group.querySelectorAll('details.faq').forEach(detail => {
        const matchesCategory = activeCategory === 'Tümü' || group.dataset.cat === activeCategory;
        const matchesText = !query || normalize(detail.textContent).includes(query);
        const show = matchesCategory && matchesText;
        detail.hidden = !show;
        if (show) { visible += 1; groupVisible = true; if (query) detail.open = true; }
      });
      group.hidden = !groupVisible;
    });
    content.querySelector('#noResults')?.classList.toggle('hidden', visible > 0);
    if (count) count.textContent = String(visible);
    if (scroll) content.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const detail = document.getElementById(id);
    if (!detail?.matches('details.faq')) return;
    activeCategory = detail.closest('.faq-group')?.dataset.cat || 'Tümü';
    chipsHost.querySelectorAll('.faq-chip').forEach(chip => {
      const selected = chip.dataset.cat === activeCategory;
      chip.classList.toggle('active', selected);
      chip.setAttribute('aria-pressed', String(selected));
    });
    if (search) search.value = '';
    applyFilters(false);
    detail.hidden = false; detail.open = true;
    setTimeout(() => detail.scrollIntoView({ behavior:'smooth', block:'center' }), 80);
  }

  function updateSchema() {
    const schema = { '@context':'https://schema.org', '@type':'FAQPage', mainEntity:items.map(item => ({ '@type':'Question', name:item.q, acceptedAnswer:{ '@type':'Answer', text:item.a } })) };
    let node = [...document.querySelectorAll('script[type="application/ld+json"]')].find(script => script.textContent.includes('FAQPage'));
    if (!node) { node = document.createElement('script'); node.type = 'application/ld+json'; document.head.appendChild(node); }
    node.textContent = JSON.stringify(schema);
  }

  search?.addEventListener('input', () => applyFilters(false));
  openAll?.addEventListener('click', () => content.querySelectorAll('details.faq:not([hidden])').forEach(detail => { detail.open = true; }));
  closeAll?.addEventListener('click', () => content.querySelectorAll('details.faq').forEach(detail => { detail.open = false; }));
  window.addEventListener('hashchange', openFromHash);
  if (updated) updated.textContent = new Date().toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' });

  fetch('/assets/data/faq.json?v=20260721', { cache:'no-store' })
    .then(response => { if (!response.ok) throw new Error(); return response.json(); })
    .then(data => {
      items = (Array.isArray(data) ? data : data.items || []).filter(item => item && item.published !== false && item.q && item.a);
      render();
    })
    .catch(() => { content.innerHTML = '<div class="no-results">Sorular şu anda yüklenemedi. Lütfen <a href="tel:+903323223220">kliniğimizi arayın</a>.</div>'; });
})();
