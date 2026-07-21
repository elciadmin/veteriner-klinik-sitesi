(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const gate = $('authGate');
  const dashboard = $('dashboard');
  const loginBtn = $('loginBtn');
  const logoutBtn = $('logoutBtn');
  const userEmail = $('userEmail');
  const blogSearch = $('blogSearch');
  const blogResults = $('blogResults');
  let currentUser = null;
  let posts = [];

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR');
  const validDate = value => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; };

  async function authHeaders() {
    if (!currentUser?.jwt) return {};
    try { const token = await currentUser.jwt(); return token ? { Authorization:`Bearer ${token}` } : {}; }
    catch { return {}; }
  }

  async function fetchJson(url, fallback) {
    try { const response = await fetch(url, { cache:'no-store' }); if (!response.ok) throw new Error(url); return await response.json(); }
    catch { return fallback; }
  }

  async function loadDashboard() {
    const [blogData, announcementData] = await Promise.all([
      fetchJson('/assets/data/blog.json?v=20260721', { posts:[] }),
      fetchJson('/assets/data/announcements.json?v=20260721', { items:[] })
    ]);
    posts = Array.isArray(blogData.posts) ? blogData.posts : [];
    const now = new Date();
    const scheduled = posts.filter(post => post.published !== false && validDate(post.date) > now).length;
    const drafts = posts.filter(post => post.published === false).length;
    const announcements = (announcementData.items || []).filter(item => item.published !== false).length;
    $('scheduledCount').textContent = String(scheduled);
    $('draftCount').textContent = String(drafts);
    $('announcementCount').textContent = String(announcements);
    renderBlogResults('');
    await loadAppointments();
  }

  async function loadAppointments() {
    try {
      const response = await fetch('/.netlify/functions/appointments', { headers:await authHeaders(), cache:'no-store', credentials:'same-origin' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      const items = Array.isArray(data.appointments) ? data.appointments : [];
      const count = items.filter(item => ['new','callback'].includes(item.status)).length;
      $('newAppointmentCount').textContent = String(count);
      $('appointmentBadge').textContent = String(count);
    } catch {
      $('newAppointmentCount').textContent = '—';
      $('appointmentBadge').textContent = '—';
    }
  }

  function renderBlogResults(term) {
    const query = normalize(term).trim();
    const matches = posts.filter(item => !query || normalize([item.title,item.summary,item.category,...(item.tags || [])].join(' ')).includes(query)).slice(0, 8);
    blogResults.innerHTML = matches.length ? matches.map(item => {
      const date = validDate(item.date);
      const state = item.published === false ? 'Yayından kaldırıldı' : date && date > new Date() ? 'Planlandı' : 'Yayında';
      return `<div class="result"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.dateLabel || '')} · ${state} · ${escapeHtml(item.category || '')}</small></div><a class="btn" href="/admin/cms.html#/collections/blog/entries/${encodeURIComponent(item.cmsEntry || item.slug || '')}">Düzenle</a></div>`;
    }).join('') : '<div class="empty">Eşleşen yazı bulunamadı.</div>';
  }

  function showDashboard(user) {
    currentUser = user;
    userEmail.textContent = user?.email || '';
    gate.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadDashboard();
  }
  function showLogin() {
    currentUser = null;
    dashboard.classList.add('hidden');
    gate.classList.remove('hidden');
  }

  blogSearch?.addEventListener('input', () => renderBlogResults(blogSearch.value));
  loginBtn?.addEventListener('click', () => window.netlifyIdentity?.open('login'));
  logoutBtn?.addEventListener('click', () => window.netlifyIdentity?.logout());

  if (window.netlifyIdentity) {
    window.netlifyIdentity.on('init', user => user ? showDashboard(user) : showLogin());
    window.netlifyIdentity.on('login', user => { showDashboard(user); window.netlifyIdentity.close(); });
    window.netlifyIdentity.on('logout', showLogin);
    window.netlifyIdentity.init();
  } else showLogin();
})();
