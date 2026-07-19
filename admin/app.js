(() => {
  'use strict';

  const RUNTIME = window.ELCI_RUNTIME_CONFIG || {};
  const GIT_GATEWAY = '/.netlify/git/github';
  const BRANCH = RUNTIME.branch || 'main';
  const APPOINTMENTS_API = '/.netlify/functions/appointments';
  const PREVIEW_MODE = document.documentElement.dataset.preview === 'true' || location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  const RESOURCES = ['blog', 'faq', 'reviews', 'instagram', 'services', 'stories', 'calendar', 'pages', 'settings'];
  const ROUTES = new Set(['dashboard', 'appointments', 'calendar', 'blog', 'faq', 'reviews', 'instagram', 'services', 'stories', 'pages', 'settings', 'archive']);
  const LABELS = {
    blog: 'Blog', faq: 'SSS', reviews: 'Google Yorumları', instagram: 'Instagram Galerisi',
    services: 'Hizmetler', stories: 'Başarı Hikâyeleri', calendar: 'Paylaşım Takvimi',
    pages: 'Sayfa Başlıkları', settings: 'Site Ayarları'
  };

  const state = {
    user: null,
    data: {},
    appointments: [],
    loaded: false,
    editor: null,
    calendarDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    uploadTarget: null,
    dirty: false,
    appointmentPoll: 0,
    gatewayReady: PREVIEW_MODE,
    readFallbacks: []
  };

  const $ = selector => document.querySelector(selector);
  const main = $('#mainContent');
  const gate = $('#authGate');
  const appShell = $('#appShell');
  const modalBackdrop = $('#modalBackdrop');
  const editorBody = $('#editorBody');
  const editorTitle = $('#editorTitle');
  const editorEyebrow = $('#editorEyebrow');
  const fileInput = $('#hiddenFileInput');

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const safeAttr = escapeHtml;
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const clean = value => String(value ?? '').trim();
  const normalize = value => clean(value).toLocaleLowerCase('tr-TR');
  const splitList = value => clean(value).split(',').map(item => item.trim()).filter(Boolean);
  const slugify = value => normalize(value)
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'icerik';
  const nowIso = () => new Date().toISOString();
  const localDateTimeValue = value => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const toIsoWithTurkeyOffset = value => {
    if (!value) return '';
    const raw = String(value).slice(0, 16);
    return `${raw}:00+03:00`;
  };
  const formatDate = (value, withTime = false) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('tr-TR', withTime
      ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const isFuture = value => {
    const date = value ? new Date(value) : null;
    return Boolean(date && !Number.isNaN(date.getTime()) && date > new Date());
  };

  function toast(title, message = '', type = '') {
    const node = document.createElement('div');
    node.className = `toast ${type}`.trim();
    node.innerHTML = `<strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ''}`;
    $('#toastStack').appendChild(node);
    setTimeout(() => node.remove(), type === 'error' ? 6500 : 4300);
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  async function authHeaders() {
    if (PREVIEW_MODE) return {};
    try {
      const token = await state.user?.jwt?.();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }

  async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}), ...(await authHeaders()) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options, headers });
    let payload = null;
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) throw new Error(payload?.error || payload?.message || `İşlem tamamlanamadı (${response.status}).`);
    return payload;
  }

  function staticPath(resource) {
    return {
      blog: '/assets/data/blog.json', faq: '/assets/data/faq.json', reviews: '/assets/data/reviews.json',
      instagram: '/assets/data/instagram.json', services: '/assets/data/services.json',
      stories: '/assets/data/successStories.json', calendar: '/assets/data/calendar.json',
      pages: '/assets/data/pages.json', settings: '/assets/data/site-settings.json'
    }[resource];
  }

  function repositoryPath(resource) {
    return staticPath(resource).replace(/^\//, '');
  }

  function encodeUtf8Base64(value) {
    const bytes = new TextEncoder().encode(String(value));
    let binary = '';
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  }

  function decodeUtf8Base64(value) {
    const binary = atob(String(value || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function gatewayUrl(path, includeRef = false) {
    const cleanPath = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return `${GIT_GATEWAY}/contents/${cleanPath}${includeRef ? `?ref=${encodeURIComponent(BRANCH)}` : ''}`;
  }

  async function readRepositoryFile(path) {
    const payload = await apiFetch(gatewayUrl(path, true), {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!payload?.content) throw new Error(`${path} okunamadı.`);
    return { content: decodeUtf8Base64(payload.content), sha: payload.sha || '' };
  }

  async function writeRepositoryFile(path, content, message, existingSha = '', alreadyBase64 = false) {
    let sha = existingSha;
    if (!sha) {
      try { sha = (await readRepositoryFile(path)).sha; }
      catch (error) {
        if (!/404|not found|bulunamad|okunamad/i.test(error.message)) throw error;
      }
    }
    const body = {
      message,
      content: alreadyBase64 ? content : encodeUtf8Base64(content),
      branch: BRANCH
    };
    if (sha) body.sha = sha;
    return apiFetch(gatewayUrl(path), {
      method: 'PUT',
      headers: { Accept: 'application/vnd.github+json' },
      body: JSON.stringify(body)
    });
  }

  async function loadStaticResource(resource) {
    const response = await fetch(`${staticPath(resource)}?admin-v=4`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${LABELS[resource] || resource} verisi bulunamadı (${response.status}).`);
    return response.json();
  }

  async function loadResource(resource) {
    const stored = PREVIEW_MODE ? localStorage.getItem(`elci-preview-${resource}`) : '';
    if (stored) return JSON.parse(stored);

    // Önce o anda açık olan deploy'un JSON verisini oku. Böylece test dalı,
    // main dalında henüz olmayan dosyalar nedeniyle tamamen kilitlenmez.
    const staticData = await loadStaticResource(resource);
    if (PREVIEW_MODE) return staticData;

    try {
      const file = await readRepositoryFile(repositoryPath(resource));
      state.gatewayReady = true;
      return JSON.parse(file.content);
    } catch (error) {
      state.readFallbacks.push({ resource, message: error.message });
      return staticData;
    }
  }

  async function saveResource(resource, message) {
    if (PREVIEW_MODE) {
      localStorage.setItem(`elci-preview-${resource}`, JSON.stringify(state.data[resource]));
      toast('Önizleme kaydedildi', 'Yerel test verisi güncellendi.', 'success');
      return;
    }
    const content = `${JSON.stringify(state.data[resource], null, 2)}\n`;
    await writeRepositoryFile(repositoryPath(resource), content, message);
    state.gatewayReady = true;
    state.dirty = false;
    toast('Değişiklik kaydedildi', `${BRANCH} dalına işlendi; Netlify yeni sürümü hazırlayacak.`, 'success');
  }

  function imageFolder(resource) {
    return {
      blog: 'blog', instagram: 'instagram', stories: 'basari-hikayeleri', services: 'hizmetler'
    }[resource] || resource || 'genel';
  }

  async function uploadImage(resource, file) {
    if (!file) return '';
    if (file.size > 4 * 1024 * 1024) throw new Error('Görsel 4 MB’tan küçük olmalıdır.');
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) throw new Error('JPG, PNG, WEBP veya GIF yükleyin.');
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (PREVIEW_MODE) return `data:${file.type};base64,${base64}`;
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const baseName = slugify(file.name.replace(/\.[^.]+$/, ''));
    const filename = `${Date.now()}-${baseName}.${extension}`;
    const path = `assets/img/uploads/${imageFolder(resource)}/${filename}`;
    await writeRepositoryFile(path, base64, `Panel: görsel yüklendi — ${filename}`, '', true);
    return `/${path}`;
  }

  function resourceItems(resource) {
    const data = state.data[resource];
    if (resource === 'blog') return data?.posts || [];
    if (resource === 'faq') return data?.items || [];
    if (resource === 'services') return data?.items || [];
    if (resource === 'stories') return data?.stories || [];
    if (resource === 'calendar') return data?.events || [];
    if (resource === 'pages') return data?.items || [];
    return Array.isArray(data) ? data : [];
  }

  function replaceItems(resource, items) {
    if (resource === 'blog') state.data.blog.posts = items;
    else if (resource === 'faq') state.data.faq.items = items;
    else if (resource === 'services') state.data.services.items = items;
    else if (resource === 'stories') state.data.stories.stories = items;
    else if (resource === 'calendar') state.data.calendar.events = items;
    else if (resource === 'pages') state.data.pages.items = items;
    else state.data[resource] = items;
    state.dirty = true;
  }

  function effectiveStatus(item) {
    if (item?.status === 'archived' || item?.archivedAt) return 'archived';
    if (item?.published === false || item?.status === 'draft') return 'draft';
    const planned = item?.scheduledAt || item?.date;
    if (item?.status === 'scheduled' && isFuture(planned)) return 'scheduled';
    if (item?.status === 'scheduled' && !isFuture(planned)) return 'published';
    return item?.status || 'published';
  }

  function statusLabel(status) {
    return {
      published: 'Yayında', scheduled: 'Planlandı', draft: 'Taslak', archived: 'Arşivde',
      new: 'Yeni', contacted: 'Arandı', confirmed: 'Onaylandı', completed: 'Tamamlandı',
      cancelled: 'İptal', idea: 'Fikir'
    }[status] || status;
  }

  function statusChip(itemOrStatus) {
    const status = typeof itemOrStatus === 'string' ? itemOrStatus : effectiveStatus(itemOrStatus);
    return `<span class="status-chip ${safeAttr(status)}">${escapeHtml(statusLabel(status))}</span>`;
  }

  function itemId(item) { return item?.id || item?.slug || ''; }
  function findItem(resource, id) { return resourceItems(resource).find(item => itemId(item) === id); }

  function defaultItem(resource) {
    const base = { id: uid(resource), status: 'draft', published: false, createdAt: nowIso(), updatedAt: nowIso(), scheduledAt: '' };
    if (resource === 'blog') return { ...base, slug: '', title: '', summary: '', content: '', cover: '', category: 'Klinik Duyuruları', categories: ['Klinik Duyuruları'], species: 'Genel', tags: [], author: 'Elçi Veteriner Kliniği', seoTitle: '', seoDescription: '', youtubeId: '', date: '' };
    if (resource === 'faq') return { ...base, q: '', a: '', category: 'Muayene ve Laboratuvar', showOnHome: false, homeOrder: null };
    if (resource === 'reviews') return { ...base, author: '', rating: 5, time: '', text: '', sourceUrl: '', showOnHome: false, homeOrder: null };
    if (resource === 'instagram') return { ...base, image: '', file: '', title: 'Elçi Veteriner Kliniği', caption: '', alt: '', instagramUrl: 'https://www.instagram.com/elciveteriner' };
    if (resource === 'services') return { ...base, title: '', summary: '', detail: '', icon: '#i-stethoscope', iconClass: '', href: '', group: 'Diğer hizmetler', order: 99, homeFeatured: false };
    if (resource === 'stories') return { ...base, title: '', petName: '', species: 'Kedi', tagline: '', summary: '', full: '', image: '', icon: '#i-paw' };
    if (resource === 'calendar') return { ...base, title: '', type: 'blog', date: '', time: '19:00', channels: ['Site'], notes: '', status: 'planned', linkedId: '' };
    if (resource === 'pages') return { ...base, id: '', label: '', eyebrow: '', title: '', subtitle: '', seoTitle: '', seoDescription: '', status: 'published', published: true };
    return base;
  }

  function sectionHead(title, description, actionLabel, actionResource) {
    return `<header class="page-head"><div><span class="eyebrow">ELÇİ YÖNETİM MERKEZİ</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${actionLabel ? `<div class="head-actions"><button class="button primary" data-new="${safeAttr(actionResource)}">＋ ${escapeHtml(actionLabel)}</button></div>` : ''}</header>`;
  }

  function setActiveNav(route) {
    document.querySelectorAll('[data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === route));
    $('#sidebar').classList.remove('open');
  }

  async function loadAppointments({ silent = false } = {}) {
    const previousNewCount = state.appointments.filter(item => item.status === 'new').length;
    if (PREVIEW_MODE) {
      state.appointments = JSON.parse(localStorage.getItem('elci-preview-appointments') || '[]');
      updateAppointmentBadges();
      return;
    }
    try {
      const payload = await apiFetch(APPOINTMENTS_API);
      state.appointments = Array.isArray(payload.appointments) ? payload.appointments : [];
      const currentNewCount = state.appointments.filter(item => item.status === 'new').length;
      if (silent && state.loaded && currentNewCount > previousNewCount) {
        toast('Yeni randevu talebi', `${currentNewCount - previousNewCount} yeni talep panele düştü.`, 'success');
      }
    } catch (error) {
      if (!silent) {
        state.appointments = [];
        toast('Randevular alınamadı', error.message, 'error');
      }
    }
    updateAppointmentBadges();
  }

  function startAppointmentPolling() {
    window.clearInterval(state.appointmentPoll);
    if (PREVIEW_MODE) return;
    state.appointmentPoll = window.setInterval(async () => {
      if (document.hidden || !state.user) return;
      await loadAppointments({ silent: true });
      const route = location.hash.replace(/^#/, '').split('/')[0] || 'dashboard';
      if (['dashboard', 'appointments'].includes(route)) renderRoute();
    }, 60000);
  }

  function updateAppointmentBadges() {
    const count = state.appointments.filter(item => item.status === 'new').length;
    $('#notificationCount').textContent = count;
    $('#appointmentNavBadge').textContent = count;
  }

  async function loadAll() {
    main.innerHTML = '<div class="page-loading"><span class="spinner"></span><p>İçerikler yükleniyor…</p></div>';
    try {
      const values = await Promise.all(RESOURCES.map(resource => loadResource(resource)));
      RESOURCES.forEach((resource, index) => { state.data[resource] = values[index]; });
      await loadAppointments();
      state.loaded = true;
      await checkApiStatus();
      renderRoute();
    } catch (error) {
      main.innerHTML = `<div class="empty-state"><strong>Yönetim verileri yüklenemedi</strong><p>${escapeHtml(error.message)}</p><button class="button primary" id="retryLoad">Tekrar Dene</button></div>`;
      $('#retryLoad')?.addEventListener('click', loadAll);
    }
  }

  async function checkApiStatus() {
    const el = $('#apiStatus');
    if (PREVIEW_MODE) {
      el.className = 'status-dot ok';
      el.textContent = 'Yerel önizleme modu';
      return;
    }
    try {
      await readRepositoryFile(repositoryPath('settings'));
      state.gatewayReady = true;
      el.className = 'status-dot ok';
      el.textContent = `${BRANCH} dalına bağlı`;
    } catch (error) {
      state.gatewayReady = false;
      el.className = 'status-dot error';
      el.textContent = 'Site verisi açık; yayın bağlantısı kontrol edilmeli';
    }
  }

  function dashboardWarnings() {
    const events = combinedCalendarEvents();
    const today = new Date();
    const inSeven = new Date(today.getTime() + 7 * 86400000);
    const upcoming = events.filter(event => {
      const date = new Date(`${event.date || ''}T${event.time || '12:00'}:00`);
      return date >= today && date <= inSeven && !['published', 'archived'].includes(event.status);
    });
    const blogPosts = resourceItems('blog').filter(item => effectiveStatus(item) !== 'archived');
    const latestBlog = blogPosts.filter(item => effectiveStatus(item) === 'published').sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
    const daysSince = latestBlog?.date ? Math.floor((Date.now() - new Date(latestBlog.date).getTime()) / 86400000) : null;
    const notices = [];
    if (!upcoming.length) notices.push('<div class="notice">Önümüzdeki 7 gün için planlanmış paylaşım yok. Paylaşım takvimine yeni içerik ekleyin.</div>');
    else notices.push(`<div class="notice success">Önümüzdeki 7 gün için ${upcoming.length} içerik planlanmış.</div>`);
    if (daysSince != null && daysSince > 14) notices.push(`<div class="notice">Son blog paylaşımının üzerinden ${daysSince} gün geçti.</div>`);
    return notices.join('');
  }

  function renderDashboard() {
    const blog = resourceItems('blog');
    const faq = resourceItems('faq');
    const reviews = resourceItems('reviews');
    const instagram = resourceItems('instagram');
    const newAppointments = state.appointments.filter(item => item.status === 'new').length;
    const upcoming = combinedCalendarEvents().filter(event => {
      const date = new Date(`${event.date || ''}T${event.time || '12:00'}:00`);
      return date >= new Date() && event.status !== 'published';
    }).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 5);

    main.innerHTML = `
      ${sectionHead('Bugün ne yapacağız?', 'İçerik, paylaşım planı ve randevular tek merkezde. Tasarımı değiştirmeden yalnızca gerçek veriyi yönetirsiniz.')}
      <section class="stats-grid">
        <article class="stat-card"><span>Yayındaki blog</span><strong>${blog.filter(item => effectiveStatus(item) === 'published').length}</strong><small>${blog.filter(item => effectiveStatus(item) === 'scheduled').length} planlandı</small></article>
        <article class="stat-card"><span>Yayındaki SSS</span><strong>${faq.filter(item => effectiveStatus(item) === 'published').length}</strong><small>${faq.filter(item => item.showOnHome && effectiveStatus(item) === 'published').length} ana sayfada</small></article>
        <article class="stat-card"><span>Ana sayfa yorumu</span><strong>${reviews.filter(item => item.showOnHome && effectiveStatus(item) === 'published').length}</strong><small>${reviews.length} kayıt</small></article>
        <article class="stat-card"><span>Galeri görseli</span><strong>${instagram.filter(item => effectiveStatus(item) === 'published').length}</strong><small>Film şeridinde</small></article>
        <article class="stat-card"><span>Yeni randevu</span><strong>${newAppointments}</strong><small>${state.appointments.length} toplam talep</small></article>
      </section>
      <section class="dashboard-grid">
        <div class="panel">
          <h2>Hızlı işlemler</h2><p class="panel-sub">En çok kullanılan işlemlere doğrudan ulaşın.</p>
          <div class="quick-grid">
            <a class="quick-card" href="#blog" data-quick-new="blog"><strong>Yeni blog yazısı</strong><span>Taslak oluşturun, şimdi yayınlayın veya tarih belirleyin.</span></a>
            <a class="quick-card" href="#calendar"><strong>Paylaşım planla</strong><span>Blog, Instagram, Google veya SSS için takvime kayıt ekleyin.</span></a>
            <a class="quick-card" href="#instagram" data-quick-new="instagram"><strong>Galeri görseli ekle</strong><span>Fotoğrafı yükleyip film şeridine katın.</span></a>
            <a class="quick-card" href="#appointments"><strong>Randevuları kontrol et</strong><span>Yeni talepleri arandı, onaylandı veya tamamlandı olarak işaretleyin.</span></a>
          </div>
        </div>
        <div class="panel">
          <h2>Site aktivitesi</h2><p class="panel-sub">Boş haftaları önceden görün.</p>
          ${dashboardWarnings()}
        </div>
        <div class="panel">
          <h2>Yaklaşan paylaşımlar</h2><p class="panel-sub">Takvimdeki ilk beş içerik.</p>
          <div class="upcoming-list">${upcoming.length ? upcoming.map(event => `<div class="upcoming-item"><strong>${escapeHtml(event.title)}</strong><small>${formatDate(`${event.date}T${event.time || '12:00'}`, true)} • ${escapeHtml(event.typeLabel || statusLabel(event.type))}</small></div>`).join('') : '<div class="empty-state"><strong>Planlanmış içerik yok</strong><span>Paylaşım takviminden ekleyin.</span></div>'}</div>
        </div>
        <div class="panel">
          <h2>Yeni randevular</h2><p class="panel-sub">En son gelen talepler.</p>
          <div class="upcoming-list">${state.appointments.filter(item => item.status === 'new').slice(0, 5).map(item => `<button class="upcoming-item" style="text-align:left;cursor:pointer" data-appointment="${safeAttr(item.id)}"><strong>${escapeHtml(item.ownerName)} — ${escapeHtml(item.petName)}</strong><small>${escapeHtml(item.phone)} • ${formatDate(item.createdAt, true)}</small></button>`).join('') || '<div class="empty-state"><strong>Yeni randevu yok</strong><span>Yeni talepler burada görünecek.</span></div>'}</div>
        </div>
      </section>`;

    main.querySelectorAll('[data-quick-new]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault(); openEditor(link.dataset.quickNew);
    }));
    main.querySelectorAll('[data-appointment]').forEach(button => button.addEventListener('click', () => openAppointment(button.dataset.appointment)));
  }

  function listConfig(resource) {
    return {
      blog: { title: 'Blog Yazıları', description: 'Eski ve yeni yazıları arayın, düzenleyin, taslak kaydedin veya ileri tarihe planlayın.', newLabel: 'Yeni Yazı' },
      faq: { title: 'Sık Sorulan Sorular', description: 'Soru, cevap, yayın durumu ve ana sayfa seçimi aynı kayıtta yönetilir.', newLabel: 'Yeni Soru' },
      reviews: { title: 'Google Yorumları', description: 'Gerçek yorumları ekleyin; ana sayfada gösterilecekleri tek kutucukla seçin.', newLabel: 'Yeni Yorum' },
      instagram: { title: 'Instagram Galerisi', description: 'Yeni görselleri yükleyin, film şeridinde yayınlayın veya arşive alın.', newLabel: 'Yeni Görsel' },
      services: { title: 'Hizmetler', description: 'Başlık, kısa açıklama, ayrıntı, sıra, kategori ve ana sayfa görünürlüğü buradan yönetilir.', newLabel: 'Yeni Hizmet' },
      stories: { title: 'Başarı Hikâyeleri', description: 'Eski hikâyeleri düzenleyin veya yeni bir vaka hikâyesi ekleyin.', newLabel: 'Yeni Hikâye' },
      pages: { title: 'Sayfa Başlıkları', description: 'Ana sayfa, Hakkımızda, Hizmetler, Blog, SSS ve Hasta İlişkileri başlıklarını ve SEO metinlerini düzenleyin.', newLabel: '' }
    }[resource];
  }

  function searchableText(resource, item) {
    if (resource === 'blog') return [item.title, item.summary, item.category, ...(item.tags || [])].join(' ');
    if (resource === 'faq') return [item.q, item.a, item.category].join(' ');
    if (resource === 'reviews') return [item.author, item.text, item.time].join(' ');
    if (resource === 'instagram') return [item.title, item.caption, item.alt].join(' ');
    if (resource === 'services') return [item.title, item.summary, item.detail, item.group].join(' ');
    if (resource === 'stories') return [item.title, item.petName, item.species, item.summary].join(' ');
    if (resource === 'pages') return [item.label, item.eyebrow, item.title, item.subtitle, item.seoTitle, item.seoDescription].join(' ');
    return JSON.stringify(item);
  }

  function itemTitle(resource, item) {
    if (resource === 'faq') return item.q;
    if (resource === 'reviews') return item.author;
    if (resource === 'pages') return item.label || item.title || 'Sayfa';
    return item.title || item.petName || 'İçerik';
  }

  function itemSubtitle(resource, item) {
    if (resource === 'blog') return `${item.category || 'Genel'} • ${formatDate(item.date || item.scheduledAt)}`;
    if (resource === 'faq') return `${item.category || 'Genel'}${item.showOnHome ? ' • Ana sayfada' : ''}`;
    if (resource === 'reviews') return `${'★'.repeat(Number(item.rating) || 5)}${item.showOnHome ? ' • Ana sayfada' : ''}`;
    if (resource === 'instagram') return item.caption || item.alt || 'Instagram görseli';
    if (resource === 'services') return `${item.group || 'Diğer hizmetler'}${item.homeFeatured ? ' • Ana sayfada' : ''} • Sıra ${Number(item.order) || '—'}`;
    if (resource === 'stories') return `${item.petName || ''} • ${item.species || ''}`;
    if (resource === 'pages') return item.title || '';
    return '';
  }

  function itemImage(resource, item) {
    if (resource === 'blog') return item.cover;
    if (resource === 'instagram' || resource === 'stories') return item.image || (item.file ? `/assets/img/insta/${item.file}` : '');
    return '';
  }

  function renderContentList(resource) {
    const config = listConfig(resource);
    const active = resourceItems(resource).filter(item => effectiveStatus(item) !== 'archived');
    const categories = [...new Set(active.map(item => item.category || item.species || item.group || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    main.innerHTML = `
      ${connectionBanner()}
      ${sectionHead(config.title, config.description, config.newLabel, resource)}
      <section class="panel">
        <div class="toolbar">
          <div class="search-box"><input type="search" id="listSearch" placeholder="Ara…"></div>
          <select id="statusFilter" style="width:auto"><option value="all">Tüm durumlar</option><option value="published">Yayında</option><option value="scheduled">Planlandı</option><option value="draft">Taslak</option></select>
          ${categories.length ? `<select id="categoryFilter" style="width:auto"><option value="all">Tüm kategoriler</option>${categories.map(value => `<option value="${safeAttr(value)}">${escapeHtml(value)}</option>`).join('')}</select>` : ''}
        </div>
        <div id="listContainer"></div>
      </section>`;

    const search = $('#listSearch');
    const status = $('#statusFilter');
    const category = $('#categoryFilter');
    const draw = () => {
      const query = normalize(search.value);
      const wantedStatus = status.value;
      const wantedCategory = category?.value || 'all';
      const items = active.filter(item => {
        if (wantedStatus !== 'all' && effectiveStatus(item) !== wantedStatus) return false;
        if (wantedCategory !== 'all' && ![item.category, item.species, item.group].includes(wantedCategory)) return false;
        return !query || normalize(searchableText(resource, item)).includes(query);
      }).sort((a, b) => resource === 'services' ? (Number(a.order) || 9999) - (Number(b.order) || 9999) : 0);
      $('#listContainer').innerHTML = items.length ? `
        <table class="content-table"><thead><tr><th>İçerik</th><th>Durum</th><th>Güncelleme</th><th></th></tr></thead><tbody>
        ${items.map(item => {
          const image = itemImage(resource, item);
          return `<tr>
            <td data-label="İçerik"><div class="item-title">${image ? `<img class="item-thumb" src="${safeAttr(image)}" alt="">` : ''}<div><strong>${escapeHtml(itemTitle(resource, item))}</strong><small>${escapeHtml(itemSubtitle(resource, item))}</small></div></div></td>
            <td data-label="Durum">${statusChip(item)}</td>
            <td data-label="Güncelleme">${formatDate(item.updatedAt || item.date || item.createdAt)}</td>
            <td><div class="row-actions"><button class="button compact" data-edit="${safeAttr(itemId(item))}">Düzenle</button>${resource !== 'pages' ? `<button class="button compact danger" data-archive="${safeAttr(itemId(item))}">Arşivle</button>` : ''}</div></td>
          </tr>`;
        }).join('')}</tbody></table>` : '<div class="empty-state"><strong>Kayıt bulunamadı</strong><span>Aramayı değiştirin veya yeni içerik ekleyin.</span></div>';
      $('#listContainer').querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openEditor(resource, button.dataset.edit)));
      $('#listContainer').querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => archiveItem(resource, button.dataset.archive)));
    };
    [search, status, category].filter(Boolean).forEach(element => element.addEventListener('input', draw));
    draw();
  }

  function combinedCalendarEvents() {
    const manual = resourceItems('calendar').filter(item => item.status !== 'archived').map(item => ({ ...item, source: 'calendar', typeLabel: typeLabel(item.type) }));
    const generated = [];
    ['blog', 'faq', 'reviews', 'instagram'].forEach(resource => {
      resourceItems(resource).forEach(item => {
        if (effectiveStatus(item) !== 'scheduled') return;
        const value = item.scheduledAt || item.date;
        const date = value ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) return;
        generated.push({
          id: `generated-${resource}-${itemId(item)}`, source: resource, linkedId: itemId(item),
          title: itemTitle(resource, item), type: resource === 'reviews' ? 'google' : resource,
          typeLabel: typeLabel(resource === 'reviews' ? 'google' : resource),
          date: date.toISOString().slice(0, 10), time: date.toTimeString().slice(0, 5), status: 'planned'
        });
      });
    });
    return [...manual, ...generated];
  }

  function typeLabel(type) {
    return { blog: 'Blog', instagram: 'Instagram', google: 'Google', faq: 'SSS', sss: 'SSS', announcement: 'Duyuru', story: 'Başarı Hikâyesi' }[type] || 'İçerik';
  }

  function renderCalendar() {
    const viewDate = state.calendarDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    const events = combinedCalendarEvents();
    const days = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(gridStart); day.setDate(gridStart.getDate() + index);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const dayEvents = events.filter(event => event.date === key).slice(0, 4);
      const today = new Date();
      const isToday = day.toDateString() === today.toDateString();
      days.push(`<div class="calendar-day ${day.getMonth() !== month ? 'outside' : ''} ${isToday ? 'today' : ''}" data-day="${key}"><span class="day-number">${day.getDate()}</span>${dayEvents.map(event => `<button class="calendar-event ${safeAttr(event.type)}" data-event-source="${safeAttr(event.source)}" data-event-id="${safeAttr(event.linkedId || event.id)}" title="${safeAttr(event.title)}">${escapeHtml(event.time || '')} ${escapeHtml(event.title)}</button>`).join('')}</div>`);
    }
    const upcoming = events.filter(event => new Date(`${event.date}T${event.time || '12:00'}`) >= new Date()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 8);
    main.innerHTML = `
      ${sectionHead('Paylaşım Takvimi', 'Blog, Instagram, Google, SSS ve duyuruları aylık görünümde planlayın.', 'Yeni Plan', 'calendar')}
      <section class="calendar-layout">
        <div class="panel">
          <div class="calendar-head"><div class="month-nav"><button class="icon-button" id="prevMonth">‹</button><h2>${viewDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</h2><button class="icon-button" id="nextMonth">›</button></div><button class="button compact" id="todayMonth">Bugün</button></div>
          <div class="calendar-grid">${['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(day => `<div class="calendar-weekday">${day}</div>`).join('')}${days.join('')}</div>
        </div>
        <aside class="panel"><h2>Yaklaşanlar</h2><p class="panel-sub">Planlanan ilk sekiz içerik.</p><div class="upcoming-list">${upcoming.length ? upcoming.map(event => `<button class="upcoming-item" style="text-align:left;cursor:pointer" data-upcoming-source="${safeAttr(event.source)}" data-upcoming-id="${safeAttr(event.linkedId || event.id)}"><strong>${escapeHtml(event.title)}</strong><small>${formatDate(`${event.date}T${event.time || '12:00'}`, true)} • ${escapeHtml(event.typeLabel)}</small></button>`).join('') : '<div class="empty-state"><strong>Takvim boş</strong><span>Yeni plan ekleyin.</span></div>'}</div></aside>
      </section>`;
    $('#prevMonth').addEventListener('click', () => { state.calendarDate = new Date(year, month - 1, 1); renderCalendar(); });
    $('#nextMonth').addEventListener('click', () => { state.calendarDate = new Date(year, month + 1, 1); renderCalendar(); });
    $('#todayMonth').addEventListener('click', () => { state.calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCalendar(); });
    main.querySelectorAll('.calendar-day').forEach(day => day.addEventListener('click', () => openEditor('calendar', null, { date: day.dataset.day })));
    main.querySelectorAll('[data-event-source],[data-upcoming-source]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const source = button.dataset.eventSource || button.dataset.upcomingSource;
      const id = button.dataset.eventId || button.dataset.upcomingId;
      if (source === 'calendar') openEditor('calendar', id); else openEditor(source, id);
    }));
  }

  function renderAppointments() {
    main.innerHTML = `
      ${sectionHead('Randevular', 'Formdan gelen talepleri görün, not ekleyin ve durumlarını takip edin.')}
      <section class="panel">
        <div class="toolbar"><div class="search-box"><input type="search" id="appointmentSearch" placeholder="İsim, telefon, hayvan adı…"></div><select id="appointmentStatus" style="width:auto"><option value="all">Tüm durumlar</option><option value="new">Yeni</option><option value="contacted">Arandı</option><option value="confirmed">Onaylandı</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option><option value="archived">Arşiv</option></select><button class="button compact" id="refreshAppointments">Yenile</button></div>
        <div class="appointment-list" id="appointmentList"></div>
      </section>`;
    const draw = () => {
      const query = normalize($('#appointmentSearch').value);
      const wanted = $('#appointmentStatus').value;
      const records = state.appointments.filter(item => (wanted === 'all' || item.status === wanted) && (!query || normalize([item.ownerName,item.phone,item.email,item.petName,item.species,item.breed].join(' ')).includes(query)));
      $('#appointmentList').innerHTML = records.length ? records.map(item => `<article class="appointment-card ${item.status === 'new' ? 'unread' : ''}"><div><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><strong>${escapeHtml(item.ownerName)} — ${escapeHtml(item.petName)}</strong>${statusChip(item.status)}</div><div class="appointment-meta"><span>☎ ${escapeHtml(item.phone)}</span><span>✉ ${escapeHtml(item.email || '—')}</span><span>🐾 ${escapeHtml([item.species,item.breed,item.petAge].filter(Boolean).join(' • '))}</span><span>🗓 ${escapeHtml(item.requestedDate || '—')} ${escapeHtml(item.requestedTime || '')}</span></div></div><div class="appointment-actions"><button class="button compact" data-open-appointment="${safeAttr(item.id)}">Aç</button></div></article>`).join('') : '<div class="empty-state"><strong>Randevu bulunamadı</strong><span>Filtreyi değiştirin.</span></div>';
      $('#appointmentList').querySelectorAll('[data-open-appointment]').forEach(button => button.addEventListener('click', () => openAppointment(button.dataset.openAppointment)));
    };
    $('#appointmentSearch').addEventListener('input', draw); $('#appointmentStatus').addEventListener('input', draw);
    $('#refreshAppointments').addEventListener('click', async () => { await loadAppointments(); draw(); toast('Randevular yenilendi'); });
    draw();
  }

  function renderArchive() {
    const archived = ['blog','faq','reviews','instagram','services','stories'].flatMap(resource => resourceItems(resource).filter(item => effectiveStatus(item) === 'archived').map(item => ({ resource, item })));
    main.innerHTML = `${sectionHead('Arşiv', 'Yayından kaldırılan kayıtları geri getirin veya kalıcı olarak silin.')}<section class="panel">${archived.length ? `<table class="content-table"><thead><tr><th>İçerik</th><th>Tür</th><th>Arşiv tarihi</th><th></th></tr></thead><tbody>${archived.map(({resource,item}) => `<tr><td data-label="İçerik"><strong>${escapeHtml(itemTitle(resource,item))}</strong></td><td data-label="Tür">${escapeHtml(LABELS[resource])}</td><td data-label="Arşiv tarihi">${formatDate(item.archivedAt || item.updatedAt)}</td><td><div class="row-actions"><button class="button compact" data-restore-resource="${resource}" data-restore-id="${safeAttr(itemId(item))}">Geri Getir</button><button class="button compact danger" data-delete-resource="${resource}" data-delete-id="${safeAttr(itemId(item))}">Kalıcı Sil</button></div></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state"><strong>Arşiv boş</strong><span>Arşivlenen kayıtlar burada görünür.</span></div>'}</section>`;
    main.querySelectorAll('[data-restore-resource]').forEach(button => button.addEventListener('click', () => restoreItem(button.dataset.restoreResource, button.dataset.restoreId)));
    main.querySelectorAll('[data-delete-resource]').forEach(button => button.addEventListener('click', () => permanentlyDelete(button.dataset.deleteResource, button.dataset.deleteId)));
  }

  function connectionBanner() {
    if (PREVIEW_MODE) return '<div class="read-mode-banner success"><strong>Yerel önizleme:</strong> Değişiklikler yalnızca bu tarayıcıda saklanır.</div>';
    if (state.gatewayReady) return `<div class="read-mode-banner success"><strong>${escapeHtml(BRANCH)} dalı bağlı:</strong> Kaydettiğiniz değişiklikler test dalına işlenir.</div>`;
    return `<div class="read-mode-banner"><strong>Görüntüleme hazır:</strong> Site verileri açıldı; kaydetme bağlantısı kurulamazsa Git Gateway/Identity ayarı kontrol edilmelidir.</div>`;
  }

  function renderSettings() {
    const data = state.data.settings || {};
    const brand = data.brand || {};
    const contact = data.contact || {};
    const social = data.social || {};
    main.innerHTML = `
      ${connectionBanner()}
      ${sectionHead('Site Ayarları', 'Logo, klinik adı, slogan, telefon, e-posta, adres, çalışma saatleri ve sosyal bağlantıları tek yerden yönetin.')}
      <form id="settingsForm" class="panel settings-form">
        <div class="settings-grid">
          <section><h2>Marka</h2><div class="form-grid"><div class="form-group full"><label>Klinik adı</label><input name="brandName" required value="${safeAttr(brand.name || '')}"></div><div class="form-group full"><label>Slogan</label><input name="tagline" value="${safeAttr(brand.tagline || '')}"></div><div class="form-group full"><label>Logo yolu</label><input name="logo" value="${safeAttr(brand.logo || '')}"></div></div></section>
          <section><h2>İletişim</h2><div class="form-grid"><div class="form-group"><label>Telefon (görünen)</label><input name="phoneDisplay" value="${safeAttr(contact.phoneDisplay || '')}"></div><div class="form-group"><label>Telefon (bağlantı)</label><input name="phone" value="${safeAttr(contact.phone || '')}"></div><div class="form-group full"><label>E-posta</label><input type="email" name="email" value="${safeAttr(contact.email || '')}"></div><div class="form-group full"><label>Kısa adres</label><input name="addressShort" value="${safeAttr(contact.addressShort || '')}"></div><div class="form-group full"><label>Çalışma saatleri</label><input name="workingHours" value="${safeAttr(contact.workingHours || '')}"></div></div></section>
          <section><h2>Sosyal medya ve sayaçlar</h2><div class="form-grid"><div class="form-group full"><label>Instagram bağlantısı</label><input type="url" name="instagram" value="${safeAttr(social.instagram || '')}"></div><div class="form-group full"><label>YouTube bağlantısı</label><input type="url" name="youtube" value="${safeAttr(social.youtube || '')}"></div><div class="form-group"><label>Toplam Google yorumu</label><input type="number" min="0" name="totalGoogleReviews" value="${safeAttr(data.totalGoogleReviews || 0)}"></div></div></section>
        </div>
        <div class="settings-actions"><span>Bu bilgiler ortak üst alan ve ilgili iletişim bölümlerinde kullanılır.</span><button class="button primary" type="submit">Site Ayarlarını Kaydet</button></div>
      </form>`;
    $('#settingsForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true; submit.textContent = 'Kaydediliyor…';
      try {
        state.data.settings = {
          ...data,
          brand: { ...brand, name: clean(formValue(form, 'brandName')), tagline: clean(formValue(form, 'tagline')), logo: clean(formValue(form, 'logo')) },
          contact: { ...contact, phone: clean(formValue(form, 'phone')).replace(/\D+/g, ''), phoneDisplay: clean(formValue(form, 'phoneDisplay')), email: clean(formValue(form, 'email')), addressShort: clean(formValue(form, 'addressShort')), workingHours: clean(formValue(form, 'workingHours')) },
          social: { ...social, instagram: clean(formValue(form, 'instagram')), youtube: clean(formValue(form, 'youtube')) },
          totalGoogleReviews: Number(formValue(form, 'totalGoogleReviews')) || 0,
          updatedAt: nowIso()
        };
        await saveResource('settings', 'Panel: site ayarları güncellendi');
        renderSettings();
      } catch (error) { toast('Site ayarları kaydedilemedi', error.message, 'error'); }
      finally { submit.disabled = false; submit.textContent = 'Site Ayarlarını Kaydet'; }
    });
  }

  function renderRoute() {
    if (!state.loaded) return;
    const route = location.hash.replace(/^#/, '').split('/')[0] || 'dashboard';
    const safeRoute = ROUTES.has(route) ? route : 'dashboard';
    setActiveNav(safeRoute);
    if (safeRoute === 'dashboard') renderDashboard();
    else if (safeRoute === 'calendar') renderCalendar();
    else if (safeRoute === 'appointments') renderAppointments();
    else if (safeRoute === 'archive') renderArchive();
    else if (safeRoute === 'settings') renderSettings();
    else renderContentList(safeRoute);
    main.focus({ preventScroll: true });
  }

  function editorStatusOptions(item, resource) {
    const current = effectiveStatus(item);
    const allowSchedule = ['blog','faq','reviews','instagram'].includes(resource);
    return `<select name="status" id="editorStatus"><option value="draft" ${current === 'draft' ? 'selected' : ''}>Taslak olarak kaydet</option><option value="published" ${current === 'published' ? 'selected' : ''}>Şimdi yayınla</option>${allowSchedule ? `<option value="scheduled" ${current === 'scheduled' ? 'selected' : ''}>İleri tarihte yayınla</option>` : ''}</select>`;
  }

  function imageEditor(resource, item, field = 'image') {
    const value = item[field] || '';
    return `<div class="form-group full"><label>Görsel</label><div class="image-field"><img class="image-preview" id="editorImagePreview" src="${safeAttr(value || '/assets/img/uploads/elci-logo.png')}" alt="Görsel önizleme"><div><div class="upload-row"><input name="${field}" id="editorImagePath" value="${safeAttr(value)}" placeholder="/assets/img/uploads/…"><button type="button" class="button" data-upload="${resource}">Görsel Yükle</button></div><p class="form-help">JPG, PNG veya WEBP; en fazla 4 MB.</p></div></div></div>`;
  }

  function editorHtml(resource, item, isNew) {
    const footer = (extra = '', allowArchive = resource !== 'pages') => `<div class="editor-footer"><div>${extra}</div><div class="footer-actions"><button type="button" class="button" data-close-modal>Vazgeç</button>${!isNew && allowArchive ? '<button type="button" class="button danger" data-editor-archive>Arşive Kaldır</button>' : ''}<button type="submit" class="button primary">${!isNew && effectiveStatus(item) === 'published' ? 'Değişiklikleri Kaydet' : 'Kaydet'}</button></div></div>`;
    const statusFields = (resourceName = resource) => `<div class="form-group"><label>Yayın durumu</label>${editorStatusOptions(item, resourceName)}</div><div class="form-group" id="scheduleGroup"><label>Yayın tarihi ve saati</label><input type="datetime-local" name="scheduledAt" value="${safeAttr(localDateTimeValue(item.scheduledAt || item.date))}"><span class="form-help">Yalnızca “İleri tarihte yayınla” seçildiğinde kullanılır.</span></div>`;

    if (resource === 'blog') return `<form id="editorForm" class="form-grid"><div class="form-group full"><label>Başlık *</label><input name="title" required value="${safeAttr(item.title)}" placeholder="Yazı başlığı"></div>${statusFields()}<div class="form-group"><label>Kategori *</label><input name="category" required value="${safeAttr(item.category || item.categories?.[0] || '')}" list="blogCategories"><datalist id="blogCategories"><option>Koruyucu Sağlık</option><option>Cerrahi ve Operasyonlar</option><option>Acil Durumlar</option><option>Ağız ve Diş Sağlığı</option><option>Mevsimsel Sağlık</option><option>Klinik Duyuruları</option></datalist></div><div class="form-group"><label>Hayvan türü</label><select name="species"><option ${item.species === 'Genel' ? 'selected' : ''}>Genel</option><option ${item.species === 'Kedi' ? 'selected' : ''}>Kedi</option><option ${item.species === 'Köpek' ? 'selected' : ''}>Köpek</option><option ${item.species === 'Kedi ve Köpek' ? 'selected' : ''}>Kedi ve Köpek</option></select></div><div class="form-group full"><label>Kısa özet *</label><textarea name="summary" required rows="3">${escapeHtml(item.summary)}</textarea></div>${imageEditor('blog', item, 'cover')}<div class="form-group full"><label>Yazı içeriği *</label><div class="rich-toolbar"><button type="button" data-insert="<strong>|</strong>">B</button><button type="button" data-insert="<h2>|</h2>">H2</button><button type="button" data-insert="<ul><li>|</li></ul>">• Liste</button><button type="button" data-insert="<p>|</p>">¶</button></div><textarea name="content" id="contentEditor" required rows="12">${escapeHtml(item.content)}</textarea><span class="form-help">Düz metin yazabilirsiniz. Paragraflar otomatik okunur; araç çubuğu temel biçimlendirme ekler.</span></div><div class="form-group"><label>Etiketler <small>(virgülle)</small></label><input name="tags" value="${safeAttr((item.tags || []).join(', '))}"></div><div class="form-group"><label>Yazar</label><input name="author" value="${safeAttr(item.author || 'Elçi Veteriner Kliniği')}"></div><details class="form-group full"><summary><strong>SEO ve gelişmiş ayarlar</strong></summary><div class="form-grid" style="margin-top:12px"><div class="form-group"><label>Bağlantı adı</label><input name="slug" value="${safeAttr(item.slug)}" placeholder="otomatik-olusturulur"></div><div class="form-group"><label>YouTube video kimliği</label><input name="youtubeId" value="${safeAttr(item.youtubeId)}"></div><div class="form-group full"><label>SEO başlığı</label><input name="seoTitle" value="${safeAttr(item.seoTitle)}"></div><div class="form-group full"><label>SEO açıklaması</label><textarea name="seoDescription" rows="3">${escapeHtml(item.seoDescription)}</textarea></div></div></details>${footer()}</form>`;

    if (resource === 'faq') return `<form id="editorForm" class="form-grid"><div class="form-group full"><label>Soru *</label><input name="q" required value="${safeAttr(item.q)}"></div>${statusFields()}<div class="form-group full"><label>Cevap *</label><textarea name="a" required rows="7">${escapeHtml(item.a)}</textarea></div><div class="form-group"><label>Kategori *</label><input name="category" required value="${safeAttr(item.category)}" list="faqCategories"><datalist id="faqCategories"><option>Randevu & İletişim</option><option>Muayene ve Laboratuvar</option><option>Ameliyat & Anestezi</option><option>Bakım & Beslenme</option><option>Koruyucu Sağlık</option></datalist></div><div class="form-group"><label>Ana sayfa sırası</label><input type="number" min="1" max="6" name="homeOrder" value="${safeAttr(item.homeOrder || '')}" placeholder="1–6"></div><div class="form-group full"><label class="check-row"><input type="checkbox" name="showOnHome" ${item.showOnHome ? 'checked' : ''}><span>Ana sayfada göster <small>(en fazla 6 soru)</small></span></label></div>${footer()}</form>`;

    if (resource === 'reviews') return `<form id="editorForm" class="form-grid"><div class="form-group"><label>Yorum sahibi *</label><input name="author" required value="${safeAttr(item.author)}"></div>${statusFields()}<div class="form-group"><label>Yıldız</label><select name="rating">${[5,4,3,2,1].map(value => `<option value="${value}" ${Number(item.rating) === value ? 'selected' : ''}>${value} yıldız</option>`).join('')}</select></div><div class="form-group full"><label>Yorum metni *</label><textarea name="text" required rows="6">${escapeHtml(item.text)}</textarea></div><div class="form-group"><label>Tarih açıklaması</label><input name="time" value="${safeAttr(item.time)}" placeholder="2 hafta önce"></div><div class="form-group"><label>Google yorum bağlantısı</label><input type="url" name="sourceUrl" value="${safeAttr(item.sourceUrl)}"></div><div class="form-group"><label>Ana sayfa sırası</label><input type="number" min="1" max="6" name="homeOrder" value="${safeAttr(item.homeOrder || '')}"></div><div class="form-group"><label class="check-row"><input type="checkbox" name="showOnHome" ${item.showOnHome ? 'checked' : ''}><span>Ana sayfada göster</span></label></div>${footer()}</form>`;

    if (resource === 'instagram') return `<form id="editorForm" class="form-grid">${imageEditor('instagram', item)}${statusFields()}<div class="form-group"><label>Kısa başlık</label><input name="title" value="${safeAttr(item.title)}"></div><div class="form-group"><label>Instagram gönderi bağlantısı</label><input type="url" name="instagramUrl" value="${safeAttr(item.instagramUrl)}"></div><div class="form-group full"><label>Açıklama</label><textarea name="caption" rows="4">${escapeHtml(item.caption)}</textarea></div><div class="form-group full"><label>Görsel açıklaması <small>(erişilebilirlik)</small></label><input name="alt" value="${safeAttr(item.alt)}"></div>${footer()}</form>`;

    if (resource === 'services') return `<form id="editorForm" class="form-grid">${statusFields()}<div class="form-group"><label>Hizmet başlığı *</label><input name="title" required value="${safeAttr(item.title)}"></div><div class="form-group"><label>Sayfa bağlantısı</label><input name="href" value="${safeAttr(item.href)}" placeholder="/hizmetler.html#hizmet-adi"></div><div class="form-group"><label>Hizmet grubu</label><input name="group" value="${safeAttr(item.group || 'Diğer hizmetler')}" list="serviceGroups"><datalist id="serviceGroups"><option>Dahili branşlar</option><option>Cerrahi, hareket ve üreme</option><option>Destek ve özel süreçler</option><option>Diğer hizmetler</option></datalist></div><div class="form-group"><label>Sıralama</label><input type="number" min="1" name="order" value="${safeAttr(item.order || 99)}"></div><div class="form-group full"><label>Kısa açıklama *</label><textarea name="summary" required rows="4">${escapeHtml(item.summary)}</textarea></div><div class="form-group full"><label>Detaylı açıklama</label><textarea name="detail" rows="7">${escapeHtml(item.detail)}</textarea></div><div class="form-group"><label>İkon kodu</label><input name="icon" value="${safeAttr(item.icon)}" placeholder="#i-stethoscope"></div><div class="form-group"><label>Font Awesome sınıfı <small>(isteğe bağlı)</small></label><input name="iconClass" value="${safeAttr(item.iconClass || '')}" placeholder="fa-solid fa-stethoscope"></div><div class="form-group full"><label class="check-row"><input type="checkbox" name="homeFeatured" ${item.homeFeatured ? 'checked' : ''}><span>Ana sayfadaki ilk 6 hizmet içinde göster</span></label></div>${footer()}</form>`;

    if (resource === 'stories') return `<form id="editorForm" class="form-grid">${statusFields()}<div class="form-group full"><label>Hikâye başlığı *</label><input name="title" required value="${safeAttr(item.title)}"></div><div class="form-group"><label>Hayvanın adı</label><input name="petName" value="${safeAttr(item.petName)}"></div><div class="form-group"><label>Tür</label><select name="species"><option ${item.species === 'Kedi' ? 'selected' : ''}>Kedi</option><option ${item.species === 'Köpek' ? 'selected' : ''}>Köpek</option></select></div>${imageEditor('stories', item)}<div class="form-group full"><label>Kısa vurgu</label><input name="tagline" value="${safeAttr(item.tagline)}"></div><div class="form-group full"><label>Özet *</label><textarea name="summary" required rows="4">${escapeHtml(item.summary)}</textarea></div><div class="form-group full"><label>Tam hikâye</label><textarea name="full" rows="9">${escapeHtml(item.full)}</textarea></div>${footer()}</form>`;

    if (resource === 'pages') return `<form id="editorForm" class="form-grid"><div class="form-group"><label>Sayfa</label><input name="label" value="${safeAttr(item.label)}" readonly></div><div class="form-group"><label>Teknik kimlik</label><input name="pageId" value="${safeAttr(item.id)}" readonly></div><div class="form-group full"><label>Üst küçük başlık</label><input name="eyebrow" value="${safeAttr(item.eyebrow)}"></div><div class="form-group full"><label>Ana başlık *</label><input name="title" required value="${safeAttr(item.title)}"></div><div class="form-group full"><label>Alt açıklama</label><textarea name="subtitle" rows="4">${escapeHtml(item.subtitle)}</textarea></div><div class="form-group full"><label>SEO başlığı</label><input name="seoTitle" value="${safeAttr(item.seoTitle)}"></div><div class="form-group full"><label>SEO açıklaması</label><textarea name="seoDescription" rows="4">${escapeHtml(item.seoDescription)}</textarea></div>${footer('', false)}</form>`;

    if (resource === 'calendar') return `<form id="editorForm" class="form-grid"><div class="form-group full"><label>İçerik başlığı *</label><input name="title" required value="${safeAttr(item.title)}"></div><div class="form-group"><label>İçerik türü</label><select name="type"><option value="blog" ${item.type === 'blog' ? 'selected' : ''}>Blog</option><option value="instagram" ${item.type === 'instagram' ? 'selected' : ''}>Instagram</option><option value="google" ${item.type === 'google' ? 'selected' : ''}>Google gönderisi</option><option value="sss" ${['sss','faq'].includes(item.type) ? 'selected' : ''}>SSS</option><option value="announcement" ${item.type === 'announcement' ? 'selected' : ''}>Duyuru</option><option value="story" ${item.type === 'story' ? 'selected' : ''}>Başarı hikâyesi</option></select></div><div class="form-group"><label>Durum</label><select name="calendarStatus"><option value="idea" ${item.status === 'idea' ? 'selected' : ''}>Fikir</option><option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Taslak</option><option value="planned" ${item.status === 'planned' ? 'selected' : ''}>Planlandı</option><option value="published" ${item.status === 'published' ? 'selected' : ''}>Yayınlandı</option></select></div><div class="form-group"><label>Tarih *</label><input type="date" name="date" required value="${safeAttr(item.date)}"></div><div class="form-group"><label>Saat</label><input type="time" name="time" value="${safeAttr(item.time || '19:00')}"></div><div class="form-group full"><label>Kanallar <small>(virgülle)</small></label><input name="channels" value="${safeAttr((item.channels || []).join(', '))}" placeholder="Site, Instagram, Google"></div><div class="form-group full"><label>Notlar</label><textarea name="notes" rows="5">${escapeHtml(item.notes)}</textarea></div>${footer()}</form>`;
    return '';
  }

  function openEditor(resource, id = null, preset = {}) {
    const original = id ? findItem(resource, id) : null;
    const item = { ...(original ? JSON.parse(JSON.stringify(original)) : defaultItem(resource)), ...preset };
    state.editor = { resource, id, item, isNew: !original };
    editorEyebrow.textContent = LABELS[resource] || 'İÇERİK';
    editorTitle.textContent = original ? itemTitle(resource, original) : `Yeni ${LABELS[resource] || 'İçerik'}`;
    editorBody.innerHTML = editorHtml(resource, item, !original);
    modalBackdrop.classList.remove('is-hidden');
    modalBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    bindEditorEvents();
    updateScheduleVisibility();
  }

  function closeEditor(force = false) {
    if (!force && state.dirty && !confirmAction('Kaydedilmemiş değişiklikler var. Kapatılsın mı?')) return;
    state.editor = null; state.dirty = false;
    modalBackdrop.classList.add('is-hidden'); modalBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function updateScheduleVisibility() {
    const status = $('#editorStatus')?.value;
    const group = $('#scheduleGroup');
    if (group) group.style.display = status === 'scheduled' ? 'grid' : 'none';
  }

  function bindEditorEvents() {
    const form = $('#editorForm');
    form?.addEventListener('input', () => { state.dirty = true; });
    form?.addEventListener('submit', saveEditor);
    $('#editorStatus')?.addEventListener('change', updateScheduleVisibility);
    editorBody.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeEditor()));
    editorBody.querySelector('[data-editor-archive]')?.addEventListener('click', () => archiveItem(state.editor.resource, state.editor.id, true));
    editorBody.querySelectorAll('[data-insert]').forEach(button => button.addEventListener('click', () => {
      const textarea = $('#contentEditor'); if (!textarea) return;
      const template = button.dataset.insert; const [before, after = ''] = template.split('|');
      const start = textarea.selectionStart; const end = textarea.selectionEnd; const selected = textarea.value.slice(start, end) || 'metin';
      textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end'); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.focus();
    }));
    editorBody.querySelector('[data-upload]')?.addEventListener('click', button => {
      state.uploadTarget = { resource: button.currentTarget.dataset.upload, input: $('#editorImagePath'), preview: $('#editorImagePreview') };
      fileInput.value = ''; fileInput.click();
    });
  }

  function formValue(form, name) { return form.elements[name]?.value ?? ''; }
  function formChecked(form, name) { return Boolean(form.elements[name]?.checked); }

  async function saveEditor(event) {
    event.preventDefault();
    const { resource, id, item, isNew } = state.editor;
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Kaydediliyor…';
    try {
      const updated = { ...item, updatedAt: nowIso() };
      if (resource === 'calendar') {
        updated.title = clean(formValue(form, 'title')); updated.type = formValue(form, 'type'); updated.status = formValue(form, 'calendarStatus');
        updated.date = formValue(form, 'date'); updated.time = formValue(form, 'time'); updated.channels = splitList(formValue(form, 'channels')); updated.notes = clean(formValue(form, 'notes'));
      } else if (resource === 'pages') {
        updated.id = clean(formValue(form, 'pageId')) || updated.id;
        updated.label = clean(formValue(form, 'label')) || updated.label;
        updated.eyebrow = clean(formValue(form, 'eyebrow'));
        updated.title = clean(formValue(form, 'title'));
        updated.subtitle = clean(formValue(form, 'subtitle'));
        updated.seoTitle = clean(formValue(form, 'seoTitle')) || updated.title;
        updated.seoDescription = clean(formValue(form, 'seoDescription')) || updated.subtitle;
        updated.status = 'published'; updated.published = true;
      } else {
        const status = formValue(form, 'status') || 'draft';
        updated.status = status; updated.published = status === 'published' || status === 'scheduled';
        if (status === 'scheduled') {
          const scheduled = formValue(form, 'scheduledAt'); if (!scheduled) throw new Error('İleri tarihli yayın için tarih ve saat seçin.');
          updated.scheduledAt = toIsoWithTurkeyOffset(scheduled);
        } else if (status === 'published') {
          updated.scheduledAt = updated.scheduledAt && !isFuture(updated.scheduledAt) ? updated.scheduledAt : nowIso();
        }
        if (resource === 'blog') {
          updated.title = clean(formValue(form, 'title')); updated.slug = clean(formValue(form, 'slug')) || slugify(updated.title); updated.id = updated.id || updated.slug;
          updated.summary = clean(formValue(form, 'summary')); updated.content = formValue(form, 'content').trim(); updated.cover = clean(formValue(form, 'cover'));
          updated.category = clean(formValue(form, 'category')); updated.categories = [updated.category]; updated.species = formValue(form, 'species'); updated.tags = splitList(formValue(form, 'tags'));
          updated.author = clean(formValue(form, 'author')); updated.youtubeId = clean(formValue(form, 'youtubeId')); updated.seoTitle = clean(formValue(form, 'seoTitle')) || updated.title; updated.seoDescription = clean(formValue(form, 'seoDescription')) || updated.summary;
          updated.date = updated.status === 'scheduled' ? updated.scheduledAt : (updated.date || updated.scheduledAt || nowIso()); updated.url = `/blog.html#${updated.slug}`;
        }
        if (resource === 'faq') {
          updated.q = clean(formValue(form, 'q')); updated.a = clean(formValue(form, 'a')); updated.category = clean(formValue(form, 'category'));
          updated.showOnHome = formChecked(form, 'showOnHome'); updated.homeOrder = Number(formValue(form, 'homeOrder')) || null;
          if (updated.showOnHome) enforceHomeLimit('faq', updated.id, 6);
        }
        if (resource === 'reviews') {
          updated.author = clean(formValue(form, 'author')); updated.rating = Number(formValue(form, 'rating')) || 5; updated.text = clean(formValue(form, 'text')); updated.time = clean(formValue(form, 'time')); updated.sourceUrl = clean(formValue(form, 'sourceUrl'));
          updated.showOnHome = formChecked(form, 'showOnHome'); updated.homeOrder = Number(formValue(form, 'homeOrder')) || null;
          if (updated.showOnHome) enforceHomeLimit('reviews', updated.id, 6);
        }
        if (resource === 'instagram') {
          updated.image = clean(formValue(form, 'image')); updated.file = updated.image.split('/').pop() || ''; updated.title = clean(formValue(form, 'title')); updated.caption = clean(formValue(form, 'caption')); updated.alt = clean(formValue(form, 'alt')) || updated.title; updated.instagramUrl = clean(formValue(form, 'instagramUrl'));
          if (!updated.image) throw new Error('Instagram galerisi için görsel yükleyin.');
        }
        if (resource === 'services') {
          updated.title = clean(formValue(form, 'title')); updated.summary = clean(formValue(form, 'summary')); updated.detail = clean(formValue(form, 'detail'));
          updated.icon = clean(formValue(form, 'icon')); updated.iconClass = clean(formValue(form, 'iconClass')); updated.href = clean(formValue(form, 'href'));
          updated.group = clean(formValue(form, 'group')) || 'Diğer hizmetler'; updated.order = Number(formValue(form, 'order')) || 99; updated.homeFeatured = formChecked(form, 'homeFeatured');
          updated.id = updated.id || slugify(updated.title); updated.href = updated.href || `/hizmetler.html#${updated.id}`;
          if (updated.homeFeatured) {
            const others = resourceItems('services').filter(entry => itemId(entry) !== updated.id && entry.homeFeatured && effectiveStatus(entry) !== 'archived');
            if (others.length >= 6) throw new Error('Ana sayfada en fazla 6 hizmet öne çıkarılabilir. Önce başka bir hizmetin seçimini kaldırın.');
          }
        }
        if (resource === 'stories') {
          updated.title = clean(formValue(form, 'title')); updated.petName = clean(formValue(form, 'petName')); updated.species = formValue(form, 'species'); updated.tagline = clean(formValue(form, 'tagline')); updated.summary = clean(formValue(form, 'summary')); updated.full = clean(formValue(form, 'full')); updated.image = clean(formValue(form, 'image')); updated.id = updated.id || slugify(updated.title);
        }
      }
      const list = resourceItems(resource).slice();
      const index = list.findIndex(entry => itemId(entry) === id);
      if (index >= 0) list[index] = updated; else list.unshift(updated);
      replaceItems(resource, list);
      await saveResource(resource, `Panel: ${LABELS[resource] || 'İçerik'} — ${isNew ? 'yeni kayıt' : 'kayıt güncellendi'} — ${itemTitle(resource, updated)}`);
      closeEditor(true); renderRoute();
    } catch (error) {
      toast('Kayıt tamamlanamadı', error.message, 'error');
    } finally {
      submit.disabled = false; submit.textContent = 'Kaydet';
    }
  }

  function enforceHomeLimit(resource, currentId, max) {
    const selected = resourceItems(resource).filter(item => item.showOnHome && itemId(item) !== currentId && effectiveStatus(item) !== 'archived');
    if (selected.length >= max) throw new Error(`Ana sayfada en fazla ${max} kayıt gösterilebilir. Önce başka bir kaydın seçimini kaldırın.`);
  }

  async function archiveItem(resource, id, fromEditor = false) {
    const item = findItem(resource, id); if (!item) return;
    if (!confirmAction(`“${itemTitle(resource, item)}” arşive kaldırılsın mı? Siteden kalkar, daha sonra geri getirilebilir.`)) return;
    const list = resourceItems(resource).map(entry => itemId(entry) === id ? { ...entry, status: 'archived', published: false, archivedAt: nowIso(), updatedAt: nowIso() } : entry);
    replaceItems(resource, list);
    try {
      await saveResource(resource, `Panel: ${itemTitle(resource, item)} arşive kaldırıldı`);
      if (fromEditor) closeEditor(true); renderRoute();
    } catch (error) { toast('Arşivleme başarısız', error.message, 'error'); }
  }

  async function restoreItem(resource, id) {
    const item = findItem(resource, id); if (!item) return;
    const list = resourceItems(resource).map(entry => itemId(entry) === id ? { ...entry, status: 'draft', published: false, archivedAt: '', updatedAt: nowIso() } : entry);
    replaceItems(resource, list);
    try { await saveResource(resource, `Panel: ${itemTitle(resource, item)} arşivden geri getirildi`); renderArchive(); }
    catch (error) { toast('Geri getirme başarısız', error.message, 'error'); }
  }

  async function permanentlyDelete(resource, id) {
    const item = findItem(resource, id); if (!item) return;
    if (!confirmAction(`“${itemTitle(resource, item)}” kalıcı olarak silinsin mi? Bu işlem yalnızca GitHub geçmişinden geri alınabilir.`)) return;
    replaceItems(resource, resourceItems(resource).filter(entry => itemId(entry) !== id));
    try { await saveResource(resource, `Panel: ${itemTitle(resource, item)} kalıcı silindi`); renderArchive(); }
    catch (error) { toast('Silme başarısız', error.message, 'error'); }
  }

  function openAppointment(id) {
    const item = state.appointments.find(entry => entry.id === id); if (!item) return;
    editorEyebrow.textContent = 'RANDEVU TALEBİ'; editorTitle.textContent = `${item.ownerName} — ${item.petName}`;
    editorBody.innerHTML = `<form id="appointmentEditor" class="form-grid"><div class="form-group full"><div class="detail-grid"><div class="detail-box"><span>Hasta sahibi</span><strong>${escapeHtml(item.ownerName)}</strong></div><div class="detail-box"><span>Telefon</span><strong><a href="tel:${safeAttr(item.phone)}">${escapeHtml(item.phone)}</a></strong></div><div class="detail-box"><span>E-posta</span><strong><a href="mailto:${safeAttr(item.email || '')}">${escapeHtml(item.email || '—')}</a></strong></div><div class="detail-box"><span>Hayvan</span><strong>${escapeHtml([item.petName,item.species,item.breed,item.petAge].filter(Boolean).join(' • '))}</strong></div><div class="detail-box"><span>Talep edilen tarih</span><strong>${escapeHtml(item.requestedDate || '—')} ${escapeHtml(item.requestedTime || '')}</strong></div><div class="detail-box"><span>Talep zamanı</span><strong>${formatDate(item.createdAt, true)}</strong></div></div></div><div class="form-group"><label>Durum</label><select name="status"><option value="new" ${item.status === 'new' ? 'selected' : ''}>Yeni</option><option value="contacted" ${item.status === 'contacted' ? 'selected' : ''}>Arandı</option><option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>Onaylandı</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Tamamlandı</option><option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>İptal edildi</option><option value="archived" ${item.status === 'archived' ? 'selected' : ''}>Arşiv</option></select></div><div class="form-group"><label>Hizmet</label><input value="${safeAttr(item.service || 'Belirtilmedi')}" disabled></div><div class="form-group full"><label>Hasta sahibinin notu</label><textarea disabled>${escapeHtml(item.note || '')}</textarea></div><div class="form-group full"><label>Klinik içi not</label><textarea name="internalNote" rows="5">${escapeHtml(item.internalNote || '')}</textarea></div><div class="editor-footer"><div></div><div class="footer-actions"><button type="button" class="button" data-close-modal>Kapat</button><button type="submit" class="button primary">Randevuyu Güncelle</button></div></div></form>`;
    modalBackdrop.classList.remove('is-hidden'); modalBackdrop.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    editorBody.querySelector('[data-close-modal]').addEventListener('click', () => closeEditor(true));
    $('#appointmentEditor').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type=submit]'); button.disabled = true;
      try {
        const body = { id, status: form.elements.status.value, internalNote: form.elements.internalNote.value };
        if (PREVIEW_MODE) {
          Object.assign(item, body, { updatedAt: nowIso() }); localStorage.setItem('elci-preview-appointments', JSON.stringify(state.appointments));
        } else {
          const payload = await apiFetch(APPOINTMENTS_API, { method:'PATCH', body:JSON.stringify(body) }); Object.assign(item, payload.appointment);
        }
        updateAppointmentBadges(); toast('Randevu güncellendi', '', 'success'); closeEditor(true); renderRoute();
      } catch(error) { toast('Randevu güncellenemedi', error.message, 'error'); }
      finally { button.disabled = false; }
    });
  }

  fileInput.addEventListener('change', async () => {
    const target = state.uploadTarget; const file = fileInput.files?.[0]; if (!target || !file) return;
    try {
      toast('Görsel yükleniyor', file.name);
      const path = await uploadImage(target.resource, file);
      target.input.value = path; target.preview.src = path; target.input.dispatchEvent(new Event('input', { bubbles:true }));
      toast('Görsel hazır', 'Kaydet düğmesine basınca içerikle ilişkilendirilecek.', 'success');
    } catch(error) { toast('Görsel yüklenemedi', error.message, 'error'); }
  });

  document.addEventListener('click', event => {
    const newButton = event.target.closest('[data-new]'); if (newButton) openEditor(newButton.dataset.new);
  });
  $('#modalClose').addEventListener('click', () => closeEditor());
  modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeEditor(); });
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !modalBackdrop.classList.contains('is-hidden')) closeEditor(); });
  $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#notificationButton').addEventListener('click', () => { location.hash = '#appointments'; });
  $('#logoutBtn').addEventListener('click', () => window.netlifyIdentity?.logout());
  $('#loginBtn').addEventListener('click', () => {
    if (window.netlifyIdentity) window.netlifyIdentity.open('login');
    else toast('Giriş sistemi yüklenemedi', 'Sayfayı yenileyin; sorun sürerse Netlify Identity ayarını kontrol edin.', 'error');
  });
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });

  function showApp(user = { email: 'Önizleme Modu' }) {
    state.user = user;
    $('#userEmail').textContent = user.email || '';
    const badge = $('#branchBadge');
    const live = Boolean(RUNTIME.production && BRANCH === 'main');
    badge.textContent = live ? 'CANLI · MAIN' : `TEST · ${BRANCH}`;
    badge.className = `branch-badge ${live ? 'live' : 'test'}`;
    modalBackdrop.classList.add('is-hidden'); modalBackdrop.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    gate.classList.add('is-hidden'); appShell.classList.remove('is-hidden');
    loadAll();
    startAppointmentPolling();
  }

  function showLogin() {
    state.user = null; state.editor = null; state.dirty = false;
    modalBackdrop.classList.add('is-hidden'); modalBackdrop.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    appShell.classList.add('is-hidden'); gate.classList.remove('is-hidden');
  }

  if (PREVIEW_MODE) {
    showApp();
  } else if (window.netlifyIdentity) {
    window.netlifyIdentity.on('init', user => user ? showApp(user) : showLogin());
    window.netlifyIdentity.on('login', user => { window.netlifyIdentity.close(); showApp(user); });
    window.netlifyIdentity.on('logout', () => { showLogin(); location.reload(); });
    window.netlifyIdentity.init();
  } else {
    showLogin();
    toast('Giriş sistemi yüklenemedi', 'Sayfayı yenileyin.', 'error');
  }
})();
