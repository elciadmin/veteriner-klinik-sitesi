(() => {
  'use strict';
  const wrap = document.getElementById('homeFaqList');
  if (!wrap) return;
  const MAX_ITEMS = 6;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const slugify = value => String(value || '').toLocaleLowerCase('tr-TR')
    .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
    .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const answerHtml = value => escapeHtml(value).replace(/\n/g, '<br>').replace(
    /0332 322 32 20/g,
    '<a href="tel:03323223220">0332 322 32 20</a>'
  );
  const isVisible = item => {
    if (!item || item.published === false || item.status === 'draft' || item.status === 'archived') return false;
    if (item.scheduledAt) {
      const date = new Date(item.scheduledAt);
      if (!Number.isNaN(date.getTime()) && date > new Date()) return false;
    }
    return Boolean(item.q && item.a);
  };
  const itemHtml = item => {
    const id = item.id || slugify(item.q);
    return `<details class="home-faq-item">
      <summary class="home-faq-summary">
        <span class="home-faq-question"><span class="home-faq-dot" aria-hidden="true"></span><span>${escapeHtml(item.q)}</span></span>
        <i class="fa-solid fa-chevron-down home-faq-chevron" aria-hidden="true"></i>
      </summary>
      <div class="home-faq-answer"><p>${answerHtml(item.a)}</p><a href="/sss.html#${encodeURIComponent(id)}">SSS sayfasında aç</a></div>
    </details>`;
  };

  fetch('/assets/data/faq.json?v=direct-json-v3', { cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error('SSS verisi yüklenemedi.'); return response.json(); })
    .then(data => {
      const all = (Array.isArray(data?.items) ? data.items : []).filter(isVisible);
      const selected = all.filter(item => item.showOnHome === true)
        .sort((a, b) => (Number(a.homeOrder) || 999) - (Number(b.homeOrder) || 999));
      const items = (selected.length ? selected : all).slice(0, MAX_ITEMS);
      wrap.innerHTML = items.length ? items.map(itemHtml).join('') : '<p class="home-faq-status">Henüz yayımlanmış soru bulunmuyor.</p>';
      wrap.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', () => {
        if (!detail.open) return;
        wrap.querySelectorAll('details[open]').forEach(other => { if (other !== detail) other.open = false; });
      }));
      const schema = {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: items.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } }))
      };
      let node = document.getElementById('homeFaqSchema');
      if (!node) { node = document.createElement('script'); node.id = 'homeFaqSchema'; node.type = 'application/ld+json'; document.head.appendChild(node); }
      node.textContent = JSON.stringify(schema);
    })
    .catch(error => {
      console.error(error);
      wrap.innerHTML = '<p class="home-faq-status">Sorular yüklenemedi. <a href="/sss.html">SSS sayfasını açın.</a></p>';
    });
})();
