(() => {
  'use strict';
  const host = document.getElementById('homeFaqList');
  if (!host) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const answer = value => esc(value).replace(/\n/g, '<br>').replace(/0332 322 32 20/g, '<a href="tel:+903323223220">0332 322 32 20</a>');

  fetch('/assets/data/faq.json?v=20260721', { cache:'no-store' })
    .then(response => { if (!response.ok) throw new Error(); return response.json(); })
    .then(data => {
      const all = (Array.isArray(data) ? data : data.items || []).filter(item => item && item.published !== false && item.q && item.a);
      const chosen = all.filter(item => item.showOnHome === true).sort((a,b) => Number(a.homeOrder || 999) - Number(b.homeOrder || 999));
      const items = (chosen.length ? chosen : all).slice(0, 6);
      host.innerHTML = items.length ? items.map(item =>
        `<details class="home-faq-item"><summary class="home-faq-summary"><span class="home-faq-question"><span class="home-faq-dot" aria-hidden="true"></span><span>${esc(item.q)}</span></span><i class="fa-solid fa-chevron-down home-faq-chevron" aria-hidden="true"></i></summary><div class="home-faq-answer"><p>${answer(item.a)}</p><a href="/sss.html#${encodeURIComponent(item.id || '')}">Tüm yanıtı aç</a></div></details>`
      ).join('') : '<p class="home-faq-status">Henüz yayımlanmış soru bulunmuyor.</p>';

      let schema = document.getElementById('homeFaqSchema');
      if (!schema) { schema = document.createElement('script'); schema.id = 'homeFaqSchema'; schema.type = 'application/ld+json'; document.head.appendChild(schema); }
      schema.textContent = JSON.stringify({ '@context':'https://schema.org', '@type':'FAQPage', mainEntity:items.map(item => ({ '@type':'Question', name:item.q, acceptedAnswer:{ '@type':'Answer', text:item.a } })) });
    })
    .catch(() => { host.innerHTML = '<p class="home-faq-status">Sorular şu anda yüklenemedi. <a href="/sss.html">SSS sayfasını açın.</a></p>'; });
})();
