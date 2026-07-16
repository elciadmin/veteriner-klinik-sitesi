(() => {
  'use strict';

  const gate = document.getElementById('authGate');
  const dashboard = document.getElementById('dashboard');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmail = document.getElementById('userEmail');
  const blogSearch = document.getElementById('blogSearch');
  const blogResults = document.getElementById('blogResults');

  let currentUser = null;
  let blogPosts = [];

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR');

  async function authHeader() {
    if (!currentUser?.jwt) return {};
    try {
      const token = await currentUser.jwt();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }

  function showDashboard(user) {
    currentUser = user;
    userEmail.textContent = user?.email || '';
    gate.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadStats();
    loadAppointments();
  }

  function showLogin() {
    currentUser = null;
    dashboard.classList.add('hidden');
    gate.classList.remove('hidden');
  }

  async function fetchJson(url, fallback) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(url);
      return await response.json();
    } catch {
      return fallback;
    }
  }

  async function loadStats() {
    const [blog, faq, reviews, gallery] = await Promise.all([
      fetchJson('/assets/data/blog.json?v=admin-v22', { posts: [] }),
      fetchJson('/assets/data/faq.json?v=admin-v22', { items: [] }),
      fetchJson('/assets/data/reviews.json?v=admin-v22', []),
      fetchJson('/assets/data/instagram-manual.json?v=admin-v22', [])
    ]);

    blogPosts = Array.isArray(blog.posts) ? blog.posts : [];
    document.getElementById('blogCount').textContent =
      blogPosts.filter(item => item.published !== false).length;
    document.getElementById('faqCount').textContent =
      (Array.isArray(faq.items) ? faq.items : []).filter(item => item.published !== false).length;
    document.getElementById('reviewCount').textContent =
      Array.isArray(reviews) ? reviews.length : 0;
    document.getElementById('galleryCount').textContent =
      Array.isArray(gallery) ? gallery.length : 0;

    renderBlogResults('');
  }

  async function loadAppointments() {
    const el = document.getElementById('appointmentCount');
    try {
      const response = await fetch('/.netlify/functions/appointments', {
        headers: await authHeader(),
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      const items = Array.isArray(data.appointments) ? data.appointments : [];
      el.textContent = items.filter(item => item.status === 'new').length;
    } catch {
      el.textContent = '—';
    }
  }

  function renderBlogResults(term) {
    const query = normalize(term).trim();
    const matches = blogPosts
      .filter(item => !query || normalize([
        item.title, item.summary, item.category, ...(item.tags || [])
      ].join(' ')).includes(query))
      .slice(0, 8);

    blogResults.innerHTML = matches.length ? matches.map(item => `
      <div class="result">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.dateLabel || '')} • ${item.published === false ? 'Taslak' : 'Yayında'} • ${escapeHtml(item.category || '')}</small>
        </div>
        <a class="btn" href="/admin/cms.html#/collections/blog/entries/${encodeURIComponent(item.cmsEntry || item.slug || '')}">Düzenle</a>
      </div>
    `).join('') : '<div class="empty">Eşleşen blog yazısı bulunamadı.</div>';
  }

  blogSearch?.addEventListener('input', () => renderBlogResults(blogSearch.value));
  loginBtn?.addEventListener('click', () => window.netlifyIdentity?.open('login'));
  logoutBtn?.addEventListener('click', () => window.netlifyIdentity?.logout());

  if (window.netlifyIdentity) {
    window.netlifyIdentity.on('init', user => user ? showDashboard(user) : showLogin());
    window.netlifyIdentity.on('login', user => {
      showDashboard(user);
      window.netlifyIdentity.close();
    });
    window.netlifyIdentity.on('logout', showLogin);
    window.netlifyIdentity.init();
  } else {
    showLogin();
  }
})();
