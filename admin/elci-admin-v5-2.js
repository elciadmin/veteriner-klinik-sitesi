(() => {
  'use strict';

  const ADMIN_UI_VERSION = '5.1';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const main = $('#mainContent');
  const loginScreen = $('#loginScreen');
  const adminApp = $('#adminApp');
  const toastStack = $('#toastStack');
  const modalBackdrop = $('#modalBackdrop');
  const hiddenFileInput = $('#hiddenFileInput');

  const BLOG_CATEGORIES = ['Koruyucu Sağlık','Kedi Sağlığı','Köpek Sağlığı','Cerrahi ve Operasyonlar','Ağız ve Diş Sağlığı','İç Hastalıkları','Acil Durumlar','Beslenme ve Günlük Bakım','Davranış','Mevsimsel Sağlık','Yavru ve Yaşlı Bakımı','Klinik Duyuruları'];
  const SPECIES = ['Genel','Kedi','Köpek','Kedi ve Köpek'];
  const BLOG_TAGS = ['Aşı','Karma Aşı','Kuduz Aşısı','Lösemi Aşısı','Bronşin Aşısı','Aşı Takvimi','Hatırlatma Dozu','İç Parazit','Dış Parazit','Kene','Pire','Mikroçip','Pasaport','Check-up','Kan Tahlili','Hemogram','Biyokimya','İdrar Analizi','Hormon Testi','Hızlı Test','Sitoloji','Diyabet','Tiroid','Cushing','Addison','Böbrek Sağlığı','Karaciğer Sağlığı','İdrar Yolu','Kalp Sağlığı','Solunum','Sindirim','Kusma','İshal','İştahsızlık','Ateş','Ağrı','Acil Belirti','İlk Yardım','Zehirlenme','Travma','Sıcak Çarpması','Hipotermi','Kısırlaştırma','Anestezi','Ameliyat Öncesi','Ameliyat Sonrası','Yara Bakımı','Dikiş Bakımı','Ortopedi','Kırık','Çıkık','Fizik Tedavi','Rehabilitasyon','Diş Taşı','Ağız Kokusu','Diş Eti','Diş Çekimi','Göz Sağlığı','Kornea','Deri Sağlığı','Alerji','Mantar','Kulak Sağlığı','Doğum','Gebelik','Jinekoloji','Yavru Kedi','Yavru Köpek','Yavru Bakımı','Yaşlı Kedi','Yaşlı Köpek','Yaşlı Hayvan Bakımı','Kilo Kontrolü','Obezite','Beslenme','Mama Geçişi','Su Tüketimi','Davranış','Stres','Kedi Taşıma','Köpek Gezdirme','Tüy Bakımı','Tırnak Bakımı','Mevsim Geçişi','Yaz Bakımı','Kış Bakımı','Seyahat','Konaklama','Randevu','Muayene','Tedavi Takibi','Kontrol Muayenesi','Laboratuvar','Görüntüleme','Röntgen','Ultrason','Kedi','Köpek','Kedi ve Köpek','Klinik Duyurusu'];
  const RELATED_SERVICES = ['Muayene ve Koruyucu Sağlık','İç Hastalıkları','Kısırlaştırma ve Cerrahi','Ağız ve Diş Sağlığı','Laboratuvar','Acil Ön Değerlendirme','Doğum ve Jinekoloji','Ortopedi','Dermatoloji','Göz Sağlığı','Fizik Tedavi','Konaklama'];
  const FAQ_CATEGORIES = ['Randevu ve Acil','Ücret ve Ödeme','Muayene ve Laboratuvar','Aşı ve Koruyucu Sağlık','Operasyonlar','Ağız ve Diş Sağlığı','Konaklama ve Klinik Süreç'];

  const COLLECTIONS = {
    blog: { label:'Blog yazıları', singular:'Blog yazısı', folder:'content/blog', icon:'fa-pen-to-square', dateField:'date', categoryField:'category', mediaFolder:'assets/img/uploads/blog' },
    announcements: { label:'Duyurular', singular:'Duyuru', folder:'content/announcements', icon:'fa-bullhorn', dateField:'publishAt' },
    faq: { label:'Sık sorulan sorular', singular:'Soru', folder:'content/faq', icon:'fa-circle-question', categoryField:'category' },
    reviews: { label:'Google yorumları', singular:'Google yorumu', folder:'content/reviews', icon:'fa-star' },
    instagram: { label:'Instagram galerisi', singular:'Galeri görseli', folder:'content/instagram', icon:'fa-instagram', dateField:'date', mediaFolder:'assets/img/uploads/instagram' },
  };

  const state = {
    user:null, branch:'main', context:'production', gatewayReady:false,
    cache:new Map(), route:'dashboard', edit:null, calendarDate:new Date(),
    pendingImage:null, appointments:[], appointmentFilters:{}, dirty:false,
    collectionFilters:{}, calendarIdeaOffset:0, saving:false,
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const attr = esc;
  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR');
  const clone = value => JSON.parse(JSON.stringify(value ?? null));
  const nowIso = () => new Date().toISOString();
  const dateValue = value => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  };
  const toInputDateTime = value => {
    const date = dateValue(value);
    if (!date) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,16);
  };
  const fromInputDateTime = value => value ? new Date(value).toISOString() : '';
  const formatDate = (value, withTime = false) => {
    const date = dateValue(value);
    if (!date) return '—';
    return date.toLocaleString('tr-TR', withTime ? {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'} : {day:'2-digit',month:'short',year:'numeric'});
  };
  const slugify = value => String(value || '').toLocaleLowerCase('tr-TR')
    .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'icerik';
  const truncate = (value, length = 110) => String(value || '').length > length ? `${String(value).slice(0,length-1)}…` : String(value || '');
  const unique = values => [...new Set(values.filter(Boolean))];
  const stripOuterQuotes = value => String(value || '').trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g,'').trim();
  function consumeBlogIdea() {
    try {
      const raw=sessionStorage.getItem('elci-admin-blog-idea');
      if(!raw)return null;
      sessionStorage.removeItem('elci-admin-blog-idea');
      const idea=JSON.parse(raw);
      return idea&&typeof idea==='object'?idea:null;
    } catch { return null; }
  }

  function toast(title, message = '', type = 'success') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `<strong>${esc(title)}</strong>${message ? `<span>${esc(message)}</span>` : ''}`;
    toastStack.appendChild(node);
    setTimeout(() => node.remove(), type === 'error' ? 6500 : 4200);
  }

  function setSaveState(text = '') { $('#saveState').textContent = text; }
  function showLoading(text = 'Hazırlanıyor…') { main.innerHTML = `<div class="page-loading"><i class="fa-solid fa-circle-notch fa-spin"></i><span>${esc(text)}</span></div>`; }
  function emptyState(icon, title, text, action = '') { return `<div class="empty-state"><i class="fa-solid ${icon}"></i><h3>${esc(title)}</h3><p>${esc(text)}</p>${action ? `<div class="button-row" style="justify-content:center;margin-top:15px">${action}</div>` : ''}</div>`; }

  function openModal({title, kicker = '', body = '', footer = ''}) {
    $('#modalTitle').textContent = title;
    $('#modalKicker').textContent = kicker;
    $('#modalBody').innerHTML = body;
    $('#modalFooter').innerHTML = footer;
    modalBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { modalBackdrop.classList.add('hidden'); document.body.style.overflow = ''; }
  $('#modalClose').addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) closeModal(); });

  function encodeUtf8Base64(value) {
    const bytes = new TextEncoder().encode(String(value));
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(binary);
  }
  function decodeUtf8Base64(value) {
    const binary = atob(String(value || '').replace(/\s/g,''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer); let binary = ''; const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(binary);
  }
  const gatewayPath = path => path.split('/').filter(Boolean).map(encodeURIComponent).join('/');

  async function authHeaders(json = true) {
    const token = await state.user?.jwt?.();
    return { ...(json ? {'Content-Type':'application/json'} : {}), ...(token ? {Authorization:`Bearer ${token}`} : {}), Accept:'application/vnd.github+json' };
  }

  async function gateway(endpoint, options = {}) {
    const response = await fetch(`/.netlify/git/github${endpoint}`, {cache:'no-store',credentials:'same-origin',...options,headers:{...(await authHeaders(options.body != null)),...(options.headers || {})}});
    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    try { payload = contentType.includes('json') ? await response.json() : await response.text(); } catch { payload = {}; }
    if (!response.ok) {
      const message = payload?.message || payload?.error || `İşlem tamamlanamadı (${response.status})`;
      throw new Error(message);
    }
    return payload;
  }

  async function loadRuntime() {
    try {
      const response = await fetch('/.netlify/functions/admin-runtime', {cache:'no-store'});
      if (response.ok) {
        const data = await response.json();
        state.branch = data.branch || 'main'; state.context = data.context || 'production';
      }
    } catch { state.branch = 'main'; }
    const pill = $('#branchPill');
    const production = state.branch === 'main';
    pill.className = `branch-pill ${production ? 'production' : 'test'}`;
    pill.innerHTML = `<i class="fa-solid fa-code-branch"></i> ${production ? 'Canlı içerik' : `Test: ${esc(state.branch)}`}`;
  }

  async function listDirectory(path) {
    return gateway(`/contents/${gatewayPath(path)}?ref=${encodeURIComponent(state.branch)}`);
  }
  async function readRaw(path, ref = state.branch) {
    const item = await gateway(`/contents/${gatewayPath(path)}?ref=${encodeURIComponent(ref)}`);
    return { path, sha:item.sha, content:decodeUtf8Base64(item.content), item };
  }
  async function readJson(path, fallback = null, force = false) {
    const key = `file:${state.branch}:${path}`;
    if (!force && state.cache.has(key)) return clone(state.cache.get(key));
    try {
      const raw = await readRaw(path); const data = JSON.parse(raw.content);
      const result = {data, sha:raw.sha, path}; state.cache.set(key,result); return clone(result);
    } catch (error) {
      if (fallback !== null) return {data:clone(fallback),sha:null,path};
      throw error;
    }
  }
  async function writeRaw(path, content, message, sha = null) {
    setSaveState('Kaydediliyor…');
    const body = {message,content:encodeUtf8Base64(content),branch:state.branch};
    if (sha) body.sha = sha;
    const result = await gateway(`/contents/${gatewayPath(path)}`, {method:'PUT',body:JSON.stringify(body)});
    state.cache.delete(`file:${state.branch}:${path}`);
    setSaveState('Kaydedildi'); setTimeout(() => setSaveState(''), 2500);
    return result;
  }
  async function deleteRaw(path, message, sha) {
    setSaveState('Siliniyor…');
    const result = await gateway(`/contents/${gatewayPath(path)}`, {method:'DELETE',body:JSON.stringify({message,sha,branch:state.branch})});
    state.cache.delete(`file:${state.branch}:${path}`); setSaveState('Silindi'); setTimeout(() => setSaveState(''),2200); return result;
  }
  async function writeJson(path, data, message, sha = null, createBackup = true) {
    if (createBackup && sha) {
      try {
        const previous = await readJson(path, null, true);
        if (previous?.data) await backupSave(path, previous.data, previous.sha || sha, message);
      } catch (error) { console.warn('Yedek kaydı oluşturulamadı', error); }
    }
    return writeRaw(path, `${JSON.stringify(data,null,2)}\n`, message, sha);
  }

  async function listCollection(name, force = false) {
    const config = COLLECTIONS[name]; if (!config) throw new Error('Bilinmeyen içerik bölümü');
    const key = `collection:${state.branch}:${name}`;
    if (!force && state.cache.has(key)) return clone(state.cache.get(key));
    let files = [];
    try { files = await listDirectory(config.folder); } catch (error) { if (/not found/i.test(error.message)) return []; throw error; }
    const jsonFiles = files.filter(file => file.type === 'file' && file.name.endsWith('.json'));
    const rows = await Promise.all(jsonFiles.map(async file => {
      try { const raw = await readRaw(file.path); return {...JSON.parse(raw.content),_path:file.path,_sha:raw.sha,_slug:file.name.replace(/\.json$/i,'')}; }
      catch { return null; }
    }));
    const result = rows.filter(Boolean);
    state.cache.set(key,result); return clone(result);
  }
  function clearCollection(name) { state.cache.delete(`collection:${state.branch}:${name}`); }

  async function backupSave(path, currentData, sha, action) {
    const token = await state.user?.jwt?.();
    if (!token) return;
    const response = await fetch('/.netlify/functions/admin-backups', {method:'POST',credentials:'same-origin',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({path,data:currentData,sha,action})});
    if (!response.ok) throw new Error('Yedek alınamadı');
  }
  async function backupList(path) {
    const token = await state.user?.jwt?.();
    const response = await fetch(`/.netlify/functions/admin-backups?path=${encodeURIComponent(path)}`, {headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store'});
    if (!response.ok) return [];
    const data = await response.json(); return data.backups || [];
  }
  async function backupRead(id) {
    const token = await state.user?.jwt?.();
    const response = await fetch(`/.netlify/functions/admin-backups?id=${encodeURIComponent(id)}`, {headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store'});
    if (!response.ok) throw new Error('Yedek okunamadı'); return response.json();
  }

  function contentStatus(item, config = {}) {
    if (item.trashed) return {key:'trash',label:'Çöp kutusunda'};
    if (item.archived) return {key:'archived',label:'Arşivde'};
    if (item.published === false) return {key:'draft',label:'Yayında değil'};
    const start = dateValue(item[config.dateField || 'date']);
    const end = dateValue(item.unpublishAt);
    if (end && end <= new Date()) return {key:'draft',label:'Süresi bitti'};
    if (start && start > new Date()) return {key:'scheduled',label:'Planlandı'};
    return {key:'published',label:'Yayında'};
  }

  function collectionTitle(name, item) {
    if (name === 'reviews') return item.author || item.title || 'Google yorumu';
    if (name === 'announcements') return item.title || truncate(item.message,60) || 'Duyuru';
    return item.title || item.petName || 'Başlıksız içerik';
  }
  function collectionDescription(name, item) {
    if (name === 'blog') return item.summary || '';
    if (name === 'announcements') return item.message || '';
    if (name === 'faq') return item.answer || '';
    if (name === 'reviews') return item.text || '';
    if (name === 'instagram') return item.alt || item.title || '';
    return '';
  }

  function updateNav(route) {
    $$('.admin-sidebar a[data-route]').forEach(link => link.classList.toggle('active', route === link.dataset.route || route.startsWith(`${link.dataset.route}/`)));
    $('#sidebar').classList.remove('open');
  }

  function routeParts() { return location.hash.replace(/^#/,'').split('/').filter(Boolean); }
  async function router() {
    const parts = routeParts(); if (!parts.length) { location.hash = '#dashboard'; return; }
    state.route = parts.join('/'); updateNav(state.route); showLoading(); main.focus({preventScroll:true});
    try {
      if (parts[0] === 'dashboard') await renderDashboard();
      else if (parts[0] === 'collection') await renderCollection(parts[1] || 'blog');
      else if (parts[0] === 'edit') await renderEditor(parts[1], parts.slice(2).join('/') || 'new');
      else if (parts[0] === 'calendar') await renderCalendar();
      else if (parts[0] === 'appointments') await renderAppointments();
      else if (parts[0] === 'home' && !parts[1]) await renderHomeOverview();
      else if (parts[0] === 'home' && parts[1] === 'faq') await renderHomeFaq();
      else if (parts[0] === 'home' && parts[1] === 'reviews') await renderHomeReviews();
      else if (parts[0] === 'services') await renderServices();
      else if (parts[0] === 'stories') await renderStories();
      else if (parts[0] === 'media') await renderMedia();
      else if (parts[0] === 'archive') await renderArchive();
      else if (parts[0] === 'settings') await renderSettings();
      else await renderDashboard();
    } catch (error) {
      console.error(error);
      main.innerHTML = emptyState('fa-triangle-exclamation','Bölüm açılamadı',error.message,`<button class="button primary" onclick="location.reload()">Tekrar dene</button>`);
      toast('İşlem tamamlanamadı', error.message, 'error');
    }
  }

  async function fetchAppointments() {
    try {
      const token = await state.user?.jwt?.();
      const response = await fetch('/.netlify/functions/appointments',{headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store',credentials:'same-origin'});
      if (!response.ok) throw new Error('Randevular alınamadı');
      const data = await response.json(); state.appointments = Array.isArray(data.appointments) ? data.appointments : [];
      const newCount = state.appointments.filter(item => item.status === 'new').length;
      $('#appointmentNavCount').textContent = newCount; return state.appointments;
    } catch { $('#appointmentNavCount').textContent = '—'; return []; }
  }

  async function renderDashboard() {
    const [blog, announcements, faq, reviews, instagram, appointments] = await Promise.all([
      listCollection('blog'), listCollection('announcements'), listCollection('faq'), listCollection('reviews'), listCollection('instagram'), fetchAppointments()
    ]);
    const newAppointments = appointments.filter(item => item.status === 'new').length;
    const scheduled = blog.filter(item => contentStatus(item,COLLECTIONS.blog).key === 'scheduled').length;
    const drafts = blog.filter(item => contentStatus(item,COLLECTIONS.blog).key === 'draft').length;
    const activeAnnouncements = announcements.filter(item => ['published','scheduled'].includes(contentStatus(item,COLLECTIONS.announcements).key)).length;
    const recent = [...blog].sort((a,b) => String(b.date||'').localeCompare(String(a.date||''))).slice(0,5);
    main.innerHTML = `
      <section class="dashboard-hero">
        <div><span class="kicker">BUGÜNÜN KONTROL MERKEZİ</span><h1>Kliniği yönetirken siteyi saniyeler içinde güncelleyin.</h1><p>Başlığı yazın, metni yapıştırın, görseli seçin ve yayınlayın. Teknik terim veya dosya bilgisi gerekmez.</p></div>
        <div class="button-row"><a class="button primary large" href="#edit/blog/new"><i class="fa-solid fa-plus"></i> Blog yayınla</a><a class="button large" href="#edit/announcements/new"><i class="fa-solid fa-bullhorn"></i> Duyuru yayınla</a></div>
      </section>
      <section class="metric-grid">
        <article class="metric-card"><span class="metric-icon"><i class="fa-solid fa-phone"></i></span><div><strong>${newAppointments}</strong><span>aranmayı bekleyen yeni randevu</span></div></article>
        <article class="metric-card"><span class="metric-icon"><i class="fa-regular fa-clock"></i></span><div><strong>${scheduled}</strong><span>ileri tarihli blog yazısı</span></div></article>
        <article class="metric-card"><span class="metric-icon"><i class="fa-regular fa-file"></i></span><div><strong>${drafts}</strong><span>yayında olmayan blog yazısı</span></div></article>
        <article class="metric-card"><span class="metric-icon"><i class="fa-solid fa-bullhorn"></i></span><div><strong>${activeAnnouncements}</strong><span>aktif veya planlı duyuru</span></div></article>
      </section>
      <section class="dashboard-grid">
        <div class="panel"><div class="panel-head"><div><h2>Hızlı işlemler</h2><p>Gün içinde en sık kullanacağınız alanlar</p></div></div><div class="quick-list">
          ${quickItem('fa-pen-to-square','Yeni blog yazısı','Hazır metni yapıştırıp hemen veya ileri tarihte yayınlayın','#edit/blog/new')}
          ${quickItem('fa-calendar-check','Randevuları aç','Yeni talepleri arayın, durum ve klinik notu ekleyin','#appointments')}
          ${quickItem('fa-bullhorn','Yeni duyuru','Ana sayfada başlangıç ve bitiş zamanı olan duyuru yayınlayın','#edit/announcements/new')}
          ${quickItem('fa-calendar-days','İçerik takvimi','Planlanan blog, duyuru ve Instagram kayıtlarını görün','#calendar')}
          ${quickItem('fa-circle-question','Ana sayfa SSS','Ana sayfada gösterilecek altı soruyu seçin','#home/faq')}
        </div></div>
        <div class="panel"><div class="panel-head"><div><h2>Son blog yazıları</h2><p>Yayındaki ve planlanan son kayıtlar</p></div><a class="button" href="#collection/blog">Tümünü aç</a></div><div class="quick-list">
          ${recent.length ? recent.map(item => { const status=contentStatus(item,COLLECTIONS.blog); return `<a class="quick-item" href="#edit/blog/${encodeURIComponent(item._slug)}"><i class="fa-solid fa-file-lines"></i><span><strong>${esc(item.title)}</strong><small>${esc(formatDate(item.date,true))} · ${esc(status.label)}</small></span><em>Düzenle</em></a>`; }).join('') : `<div style="padding:20px">${emptyState('fa-file-circle-plus','Henüz blog yazısı yok','İlk yazınızı birkaç adımda oluşturabilirsiniz.')}</div>`}
        </div></div>
      </section>
      <section class="panel padded" style="margin-top:16px"><div class="panel-head" style="padding:0 0 16px;border:0"><div><h2>İçerik durumu</h2><p>Site içeriklerinin güncel sayıları</p></div></div><div class="metric-grid" style="margin:0">
        <article class="metric-card"><span class="metric-icon"><i class="fa-solid fa-circle-question"></i></span><div><strong>${faq.filter(x=>x.published!==false).length}</strong><span>yayındaki SSS</span></div></article>
        <article class="metric-card"><span class="metric-icon"><i class="fa-solid fa-star"></i></span><div><strong>${reviews.filter(x=>x.published!==false).length}</strong><span>kayıtlı Google yorumu</span></div></article>
        <article class="metric-card"><span class="metric-icon"><i class="fa-brands fa-instagram"></i></span><div><strong>${instagram.filter(x=>x.published!==false).length}</strong><span>galeri görseli</span></div></article>
        <article class="metric-card"><span class="metric-icon"><i class="fa-solid fa-shield-halved"></i></span><div><strong>${state.branch==='main'?'Canlı':'Test'}</strong><span>içerik dalı</span></div></article>
      </div></section>`;
  }
  function quickItem(icon,title,text,href) { return `<a class="quick-item" href="${href}"><i class="fa-solid ${icon}"></i><span><strong>${esc(title)}</strong><small>${esc(text)}</small></span><em>Aç</em></a>`; }

  async function renderCollection(name) {
    const config = COLLECTIONS[name]; if (!config) throw new Error('İçerik bölümü bulunamadı');
    const items = await listCollection(name);
    const counts={all:items.length,published:0,scheduled:0,draft:0,archived:0,trash:0};
    items.forEach(item=>{const key=contentStatus(item,config).key;if(counts[key]!=null)counts[key]++;});
    const selected=state.collectionFilters[name]||'all';
    main.innerHTML = `
      <header class="page-head"><div><span class="kicker">İÇERİK YÖNETİMİ</span><h1>${esc(config.label)}</h1><p>${collectionHelp(name)}</p></div><div class="page-actions"><a class="button primary large" href="#edit/${name}/new"><i class="fa-solid fa-plus"></i> Yeni ${esc(config.singular.toLocaleLowerCase('tr-TR'))}</a></div></header>
      <div class="status-tabs" role="tablist" aria-label="İçerik durumu">
        ${[['all','Tümü'],['published','Yayında'],['scheduled','Planlı'],['draft','Taslak'],['archived','Arşiv'],['trash','Çöp']].map(([key,label])=>`<button type="button" class="status-tab ${selected===key?'active':''}" data-status-tab="${key}">${label}<b>${counts[key]||0}</b></button>`).join('')}
      </div>
      <div class="toolbar compact-toolbar">
        <div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="collectionSearch" type="search" placeholder="Başlık veya içerikte ara…"></div>
        <input id="collectionStatus" type="hidden" value="${attr(selected)}">
        ${config.categoryField ? `<select id="collectionCategory"><option value="">Tüm kategoriler</option>${unique(items.map(item=>item[config.categoryField])).sort((a,b)=>a.localeCompare(b,'tr')).map(value=>`<option>${esc(value)}</option>`).join('')}</select>` : ''}
        <select id="collectionSort"><option value="newest">En yeni önce</option><option value="oldest">En eski önce</option><option value="az">A–Z</option></select>
      </div>
      <div class="content-list" id="collectionList"></div>`;
    const render = () => renderCollectionList(name, items);
    ['collectionSearch','collectionCategory','collectionSort'].forEach(id => $(`#${id}`)?.addEventListener('input',render));
    $$('[data-status-tab]').forEach(button=>button.addEventListener('click',()=>{
      state.collectionFilters[name]=button.dataset.statusTab;
      $('#collectionStatus').value=button.dataset.statusTab;
      $$('[data-status-tab]').forEach(x=>x.classList.toggle('active',x===button));
      render();
    }));
    render();
  }
  function collectionHelp(name) {
    return {
      blog:'Hazır metni yapıştırın; kapak, kategori ve etiket seçip hemen veya ileri tarihte yayınlayın.',
      announcements:'Menünün altında görünen ince duyuru bandını yönetin. Başlangıç ve bitiş zamanını seçebilir, yayından kaldırabilirsiniz.',
      faq:'Soruları ekleyin, yanıtları güncelleyin ve gerektiğinde yayından kaldırın.',
      reviews:'Google’daki gerçek yorumları ortak havuzda tutun. Sitede gösterilecek yorumları ayrı ekrandan seçin.',
      instagram:'Galeri görsellerini yükleyin; tarih sırasına göre otomatik akışta gösterilsin.'
    }[name] || '';
  }
  function renderCollectionList(name, originalItems) {
    const config = COLLECTIONS[name];
    const query = normalize($('#collectionSearch')?.value).trim();
    const statusFilter = $('#collectionStatus')?.value || 'all';
    const category = $('#collectionCategory')?.value || '';
    const sort = $('#collectionSort')?.value || 'newest';
    let items = originalItems.filter(item => {
      const status = contentStatus(item,config).key;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (category && item[config.categoryField] !== category) return false;
      if (query && !normalize([collectionTitle(name,item),collectionDescription(name,item),item.category,item.author,item.petName].join(' ')).includes(query)) return false;
      return true;
    });
    items.sort((a,b) => {
      if (sort === 'az') return collectionTitle(name,a).localeCompare(collectionTitle(name,b),'tr');
      const av = dateValue(a[config.dateField])?.getTime() || 0, bv = dateValue(b[config.dateField])?.getTime() || 0;
      return sort === 'oldest' ? av-bv : bv-av;
    });
    const list = $('#collectionList');
    if (!items.length) { list.innerHTML = emptyState('fa-magnifying-glass','Kayıt bulunamadı','Arama veya durum seçiminizi değiştirin.'); return; }
    list.innerHTML = items.map(item => collectionCard(name,item)).join('');
    $$('[data-quick-action]',list).forEach(button => button.addEventListener('click',() => quickContentAction(name,button.dataset.slug,button.dataset.quickAction)));
  }
  function collectionCard(name,item) {
    const config = COLLECTIONS[name], status = contentStatus(item,config);
    const date = config.dateField ? formatDate(item[config.dateField],true) : '';
    const category = item[config.categoryField] || (name==='reviews'?`${item.rating||5} yıldız`:'');
    const secondaryAction = status.key === 'published' || status.key === 'scheduled' ? `<button class="button" data-quick-action="unpublish" data-slug="${attr(item._slug)}">Yayından kaldır</button>` : `<button class="button success" data-quick-action="publish" data-slug="${attr(item._slug)}">Yayınla</button>`;
    const publicLink=name==='blog'?`<a class="button" href="/blog/${encodeURIComponent(slugify(item.advanced?.slug||item._slug))}.html" target="_blank" rel="noopener"><i class="fa-regular fa-eye"></i> Görüntüle</a>`:'';
    return `<article class="content-card"><div><h3>${esc(collectionTitle(name,item))}</h3><p>${esc(truncate(collectionDescription(name,item),150))}</p><div class="content-meta"><span class="status-badge ${status.key}">${esc(status.label)}</span>${date?`<span class="tag"><i class="fa-regular fa-calendar"></i>${esc(date)}</span>`:''}${category?`<span class="tag">${esc(category)}</span>`:''}</div></div><div class="card-actions"><a class="button primary" href="#edit/${name}/${encodeURIComponent(item._slug)}"><i class="fa-solid fa-pen"></i> Düzenle</a>${publicLink}${secondaryAction}<button class="button" data-quick-action="archive" data-slug="${attr(item._slug)}">${item.archived?'Arşivden çıkar':'Arşivle'}</button><button class="button danger" data-quick-action="trash" data-slug="${attr(item._slug)}">${item.trashed?'Geri al':'Çöpe taşı'}</button></div></article>`;
  }

  async function quickContentAction(name,slug,action) {
    const items = await listCollection(name); const item = items.find(row=>row._slug===slug); if (!item) return;
    if(action==='trash'&&!item.trashed&&!confirm(`“${collectionTitle(name,item)}” çöp kutusuna taşınsın mı?`))return;
    const data = clone(item); delete data._path; delete data._sha; delete data._slug;
    if (action === 'publish') {
      data.published=true; data.archived=false; data.trashed=false;
      const field=COLLECTIONS[name].dateField;if(field && (!data[field] || dateValue(data[field])>new Date()))data[field]=nowIso();
      const end=dateValue(data.unpublishAt);if(end&&end<=new Date())data.unpublishAt='';
    }
    if (action === 'unpublish') data.published=false;
    if (action === 'archive') { data.archived=!item.archived; data.trashed=false; if(data.archived)data.published=false; }
    if (action === 'trash') { data.trashed=!item.trashed; if(data.trashed){data.published=false;data.archived=false;data.trashedAt=nowIso();}else data.trashedAt=''; }
    try {
      await writeJson(item._path,data,`Panel: ${collectionTitle(name,item)} — ${action}`,item._sha);
      clearCollection(name); toast('İçerik güncellendi','Netlify yeni sürümü hazırlıyor.'); await renderCollection(name);
    } catch(error) { toast('İşlem yapılamadı',error.message,'error'); }
  }

  async function renderEditor(name, slug) {
    const config = COLLECTIONS[name]; if (!config) throw new Error('Düzenleyici bulunamadı');
    let item = null;
    if (slug !== 'new') item = (await listCollection(name)).find(row => row._slug === decodeURIComponent(slug));
    if (slug !== 'new' && !item) throw new Error('İçerik bulunamadı');
    const data = item ? clone(item) : defaultItem(name);
    state.edit = {name,slug,item,data};
    main.innerHTML = editorShell(name,data,item);
    bindEditor(name);
  }

  function defaultItem(name) {
    if (name==='blog') {
      const idea=consumeBlogIdea();
      return {published:true,featured:false,title:idea?.title||'',date:nowIso(),unpublishAt:'',category:idea?.category||BLOG_CATEGORIES[0],species:idea?.species||'Genel',tags:Array.isArray(idea?.tags)?idea.tags.slice(0,8):[],relatedService:idea?.relatedService||'',summary:idea?.summary||'',cover:'',contentMode:'standard',content:idea?.content||'',editorialSections:[],advanced:{slug:'',seoTitle:'',seoDescription:'',youtubeId:'',author:'Elçi Veteriner Kliniği'}};
    }
    if (name==='announcements') return {published:true,showOnHome:true,title:'',message:'',publishAt:nowIso(),unpublishAt:'',level:'info',priority:10,linkLabel:'',linkUrl:'',dismissible:true};
    if (name==='faq') return {published:true,title:'',category:FAQ_CATEGORIES[0],answer:''};
    if (name==='reviews') return {published:true,title:'',author:'',rating:5,time:'',text:'',sourceUrl:''};
    if (name==='instagram') return {published:true,title:'',date:nowIso(),unpublishAt:'',image:'',alt:'',instagramUrl:''};
    return {};
  }

  function editorShell(name,data,item) {
    const config=COLLECTIONS[name];
    return `<header class="page-head"><div><span class="kicker">${item?'İÇERİĞİ DÜZENLE':'YENİ İÇERİK'}</span><h1>${item?esc(collectionTitle(name,data)):`Yeni ${esc(config.singular.toLocaleLowerCase('tr-TR'))}`}</h1><p>${collectionHelp(name)}</p></div><div class="page-actions"><a class="button" href="#collection/${name}"><i class="fa-solid fa-arrow-left"></i> Listeye dön</a></div></header>
      <form id="contentForm" class="editor-layout" novalidate>
        <div class="editor-main">${name==='blog'?blogForm(data):genericForm(name,data)}</div>
        <aside class="editor-side"><div class="form-card sticky-actions">
          <button type="button" class="button primary large" data-save="publish"><i class="fa-solid fa-paper-plane"></i> Şimdi yayınla</button>
          ${['blog','announcements','instagram'].includes(name)?`<button type="button" class="button warning" data-save="schedule"><i class="fa-regular fa-clock"></i> Tarihe planla</button>`:''}
          <button type="button" class="button" data-save="draft"><i class="fa-regular fa-floppy-disk"></i> Taslak kaydet</button>
          ${item?`<button type="button" class="button" data-action="preview"><i class="fa-regular fa-eye"></i> Ön izleme</button>${name==='blog'?`<a class="button" href="/blog/${encodeURIComponent(slugify(data.advanced?.slug||item._slug))}.html" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Sitede görüntüle</a>`:''}<button type="button" class="button" data-save="unpublish"><i class="fa-solid fa-eye-slash"></i> Yayından kaldır</button><button type="button" class="button" data-save="archive"><i class="fa-solid fa-box-archive"></i> Arşivle</button><button type="button" class="button danger" data-save="trash"><i class="fa-regular fa-trash-can"></i> Çöp kutusuna taşı</button><button type="button" class="button" data-action="history"><i class="fa-solid fa-clock-rotate-left"></i> Önceki sürümler</button>`:''}
          <div class="editor-note"><strong>Güvenli yayın:</strong> Değişiklik önce içerik dalına kaydedilir. Netlify yeni sürümü hazırladıktan sonra sitede görünür.</div>
        </div></aside>
      </form>`;
  }

  function switchField(name,label,checked,hint='') { return `<div class="switch-field"><div class="switch-copy"><strong>${esc(label)}</strong>${hint?`<small>${esc(hint)}</small>`:''}</div><label class="switch"><input type="checkbox" name="${attr(name)}" ${checked?'checked':''}><span></span></label></div>`; }
  function inputField(name,label,value='',type='text',hint='',full=false,attrs='') { return `<div class="field ${full?'full':''}"><label for="f-${attr(name)}">${esc(label)}</label><input id="f-${attr(name)}" name="${attr(name)}" type="${attr(type)}" value="${attr(value)}" ${attrs}>${hint?`<small>${esc(hint)}</small>`:''}</div>`; }
  function textField(name,label,value='',hint='',full=true,rows=5) { return `<div class="field ${full?'full':''}"><label for="f-${attr(name)}">${esc(label)}</label><textarea id="f-${attr(name)}" name="${attr(name)}" rows="${rows}">${esc(value)}</textarea>${hint?`<small>${esc(hint)}</small>`:''}</div>`; }
  function selectField(name,label,value,options,hint='',full=false) { return `<div class="field ${full?'full':''}"><label for="f-${attr(name)}">${esc(label)}</label><select id="f-${attr(name)}" name="${attr(name)}">${options.map(option=>{const v=typeof option==='string'?option:option.value,l=typeof option==='string'?option:option.label;return `<option value="${attr(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`}).join('')}</select>${hint?`<small>${esc(hint)}</small>`:''}</div>`; }
  function imageField(name,label,value,folder,hint='') { return `<div class="field full"><label>${esc(label)}</label><div class="image-picker"><div class="image-preview" data-image-preview="${attr(name)}">${value?`<img src="${attr(value)}" alt="">`:'<i class="fa-regular fa-image"></i>'}</div><div><input type="hidden" name="${attr(name)}" value="${attr(value||'')}"><div class="button-row"><button type="button" class="button" data-pick-image="${attr(name)}" data-folder="${attr(folder)}"><i class="fa-solid fa-upload"></i> Görsel yükle</button>${value?`<button type="button" class="button danger" data-clear-image="${attr(name)}">Kaldır</button>`:''}</div>${hint?`<small>${esc(hint)}</small>`:''}</div></div></div>`; }

  function dateTimeField(name,label,value='',hint='',options={}) {
    const actions=[];
    if(options.now)actions.push(`<button type="button" class="mini-action" data-date-now="${attr(name)}"><i class="fa-regular fa-clock"></i> Şimdi</button>`);
    if(options.clear)actions.push(`<button type="button" class="mini-action" data-date-clear="${attr(name)}"><i class="fa-solid fa-xmark"></i> Temizle</button>`);
    return `<div class="field"><div class="field-label-row"><label for="f-${attr(name)}">${esc(label)}</label>${actions.length?`<span class="field-actions">${actions.join('')}</span>`:''}</div><input id="f-${attr(name)}" name="${attr(name)}" type="datetime-local" value="${attr(value)}">${hint?`<small>${esc(hint)}</small>`:''}</div>`;
  }
  function tagSelector(selected=[]) {
    return `<section class="form-card tag-card"><div class="item-card-head"><div><h2 style="margin:0">Etiketler</h2><small>Arama kutusuyla bulun; en fazla 8 etiket seçin.</small></div><strong class="tag-count" id="tagCount">${selected.length}/8</strong></div><div class="tag-tools"><label class="tag-search-label" for="tagSearch">Etiket ara</label><div class="search-box tag-search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="tagSearch" type="search" autocomplete="off" placeholder="Örn. aşı, diyabet, cerrahi, kedi…"></div><button type="button" class="button" id="clearTags">Seçimi temizle</button></div><div class="selected-tags" id="selectedTags"></div><div class="multi-select" id="tagOptions">${BLOG_TAGS.map(tag=>`<label class="choice" data-tag-label="${attr(normalize(tag))}"><input type="checkbox" name="tags" value="${attr(tag)}" ${selected.includes(tag)?'checked':''}><span>${esc(tag)}</span></label>`).join('')}</div><p class="tag-empty hidden" id="tagEmpty">Aramanızla eşleşen hazır etiket bulunamadı.</p></section>`;
  }

  function blogContentMode(data) {
    if (['standard','visual'].includes(data?.contentMode)) return data.contentMode;
    const hasBlocks=Array.isArray(data?.editorialSections)&&data.editorialSections.length>0;
    return hasBlocks&&!String(data?.content||'').trim()?'visual':'standard';
  }
  function contentModeSelector(mode) {
    return `<section class="form-card content-mode-card" id="contentModeCard"><div class="section-heading"><span class="section-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></span><div><h2>Önce yazı biçimini seçin</h2><p>Seçiminize göre yalnızca gerekli alanlar açılır. Sonradan değiştirebilirsiniz; yazdıklarınız silinmez.</p></div></div><div class="content-mode-grid"><label class="content-mode-option ${mode==='standard'?'selected':''}"><input type="radio" name="contentMode" value="standard" ${mode==='standard'?'checked':''}><span class="mode-icon"><i class="fa-solid fa-align-left"></i></span><span><strong>Sadece metin</strong><small>Hazır metni tek kutuya yapıştırın. En hızlı ve sade seçenek.</small></span><i class="fa-solid fa-circle-check mode-check"></i></label><label class="content-mode-option ${mode==='visual'?'selected':''}"><input type="radio" name="contentMode" value="visual" ${mode==='visual'?'checked':''}><span class="mode-icon"><i class="fa-regular fa-images"></i></span><span><strong>Görselli ve bölümlü yazı</strong><small>Metin, görsel, görsel+metin, bilgi kutusu ve adımları istediğiniz sırayla ekleyin.</small></span><i class="fa-solid fa-circle-check mode-check"></i></label></div></section>`;
  }
  function standardContentSection(data) {
    return `<section class="form-card"><div class="section-heading"><span class="section-icon"><i class="fa-solid fa-align-left"></i></span><div><h2>Yazının metni</h2><p>Bu biçimde ana metin gereklidir. Hazır metni yapıştırın; kısa paragraflar ve alt başlıklar kullanın.</p></div></div><div class="field full"><label for="f-content">Metin</label><div class="rich-toolbar"><button type="button" data-format="h2">Büyük başlık</button><button type="button" data-format="h3">Alt başlık</button><button type="button" data-format="bold">Kalın</button><button type="button" data-format="list">Madde</button><button type="button" data-format="number">Numara</button><button type="button" data-format="quote">Bilgi notu</button></div><textarea class="rich-text" id="f-content" name="content" placeholder="Hazır metni buraya yapıştırın…">${esc(data.content||'')}</textarea><small>Görsel kullanmak istiyorsanız yukarıdan “Görselli ve bölümlü yazı” seçeneğine geçin.</small></div></section>`;
  }
  function visualContentSection(data) {
    return `<section class="form-card editorial-card"><div class="item-card-head"><div><h2 style="margin:0">Görselli yazı bölümleri</h2><small style="color:var(--muted)">Önce bölüm türünü seçin, sonra o bölüme ait metin veya görsel alanlarını doldurun.</small></div></div><div class="editorial-help"><strong>Nasıl kullanılır?</strong><span>Aşağıdaki düğmelerden bir bölüm ekleyin. Bölümler sitede burada gördüğünüz sırayla yayımlanır. Ana metin kutusu bu biçimde zorunlu değildir.</span><div class="editorial-help-grid"><span><i class="fa-solid fa-align-left"></i><b>Sadece metin</b> Yeni bir başlık ve metin bölümü.</span><span><i class="fa-regular fa-image"></i><b>Tek görsel</b> Geniş veya girintili fotoğraf.</span><span><i class="fa-solid fa-table-columns"></i><b>Görsel + metin</b> Fotoğraf sağda ya da solda.</span><span><i class="fa-solid fa-circle-info"></i><b>Bilgi kutusu</b> Bilgi, dikkat veya öneri vurgusu.</span></div></div><div class="block-builder" id="editorialBuilder"><div class="block-toolbar"><button type="button" class="button" data-add-block="text"><i class="fa-solid fa-align-left"></i> Sadece metin ekle</button><button type="button" class="button" data-add-block="image"><i class="fa-regular fa-image"></i> Tek görsel ekle</button><button type="button" class="button" data-add-block="split"><i class="fa-solid fa-table-columns"></i> Görsel + metin ekle</button><button type="button" class="button" data-add-block="callout"><i class="fa-solid fa-circle-info"></i> Bilgi kutusu ekle</button><button type="button" class="button" data-add-block="steps"><i class="fa-solid fa-list-ol"></i> Adımlar ekle</button></div><div id="editorialBlocks">${(data.editorialSections||[]).map((block,index)=>renderEditorialBlock(block,index)).join('')}</div><p class="editorial-empty ${(data.editorialSections||[]).length?'hidden':''}" id="editorialEmpty"><i class="fa-regular fa-square-plus"></i> İlk bölümünüzü yukarıdaki düğmelerden seçin.</p></div></section>`;
  }

  function blogForm(data) {
    const adv=data.advanced||{};
    const mode=blogContentMode(data);
    return `<section class="form-card"><div class="section-heading"><span class="section-icon"><i class="fa-solid fa-paper-plane"></i></span><div><h2>Yayın ayarları</h2><p>Şimdi yayınlayabilir, ileri tarihe planlayabilir veya taslak bırakabilirsiniz.</p></div></div><div class="form-grid">${switchField('published','Yayında',data.published!==false,'Kapattığınızda yazı panelde kalır, siteden kaldırılır.')}${switchField('featured','Ana sayfada öne çıkar',!!data.featured,'Ana sayfada en fazla üç yazı gösterilir.')}${dateTimeField('date','Yayınlama zamanı',toInputDateTime(data.date),'Şimdi yayınla düğmesi bu alanı otomatik olarak günceller.',{now:true})}${dateTimeField('unpublishAt','Otomatik yayından kalkma',toInputDateTime(data.unpublishAt),'Süresiz kalacaksa boş bırakın. Bitiş zamanı yayın zamanından sonra olmalıdır.',{clear:true})}</div></section>
      <section class="form-card"><div class="section-heading"><span class="section-icon"><i class="fa-solid fa-file-pen"></i></span><div><h2>Yazının temel bilgileri</h2><p>Okuyucunun kartta ve Google’da ilk göreceği bilgiler.</p></div></div><div class="form-grid">${inputField('title','Başlık',data.title,'text','Okuyucunun aradığı konuyu açıkça anlatan başlık.',true,'required')}${selectField('category','Ana kategori',data.category,BLOG_CATEGORIES)}${selectField('species','Hayvan türü',data.species||'Genel',SPECIES)}${selectField('relatedService','Yazı sonunda önerilecek hizmet (isteğe bağlı)',data.relatedService||'',[{label:'Hizmet önerme',value:''},...RELATED_SERVICES],'Bu seçim yazıyı Hizmetler sayfasına taşımaz. Yalnızca yazının sonunda ilgili hizmete geçiş için saklanır.',true)}${textField('summary','Kartta görünen kısa açıklama',data.summary,'1–3 kısa cümle. Okuyucunun yazıyı açma kararını kolaylaştırır.',true,3)}${imageField('cover','Kapak görseli',data.cover,'assets/img/uploads/blog','Yatay görsel önerilir. Büyük dosyalar otomatik küçültülür.')}</div></section>
      ${tagSelector(data.tags||[])}
      ${contentModeSelector(mode)}
      ${mode==='visual'?visualContentSection(data):standardContentSection(data)}
      <details class="advanced"><summary>SEO ve gelişmiş ayarlar</summary><div class="advanced-body"><div class="form-grid">${inputField('advanced.slug','Özel bağlantı adı',adv.slug||'','text','Boş bırakırsanız başlıktan otomatik oluşturulur.',true)}${inputField('advanced.seoTitle','Google başlığı',adv.seoTitle||'','text','Boşsa yazı başlığı kullanılır.',true)}${textField('advanced.seoDescription','Google açıklaması',adv.seoDescription||'','Boşsa kısa açıklama kullanılır.',true,3)}${inputField('advanced.youtubeId','YouTube video kimliği',adv.youtubeId||'','text','İsteğe bağlı.')}${inputField('advanced.author','Yazar',adv.author||'Elçi Veteriner Kliniği')}</div></div></details>`;
  }

  function renderEditorialBlock(block,index) {
    const type=block.type||'text'; const typeLabel={text:'Sadece metin',image:'Tek görsel',split:'Görsel + metin',callout:'Bilgi kutusu',steps:'Numaralı adımlar'}[type]||'Yazı bölümü';
    let fields='';
    if(type==='text') fields=`${inputField(`block.${index}.heading`,'Bölüm başlığı (isteğe bağlı)',block.heading||'','text','',true)}${textField(`block.${index}.body`,'Metin',block.body||'','Bu bölümde yalnızca metin görünür.',true,7)}`;
    if(type==='image') fields=`${blockImageField(index,block.image||'','Görsel')}${inputField(`block.${index}.alt`,'Görsel açıklaması',block.alt||'')}${inputField(`block.${index}.caption`,'Alt yazı',block.caption||'')}${selectField(`block.${index}.size`,'Sunum biçimi',block.size||'wide',[{label:'Geniş',value:'wide'},{label:'Girintili / ortalı',value:'compact'}])}`;
    if(type==='split') fields=`${inputField(`block.${index}.heading`,'Bölüm başlığı (isteğe bağlı)',block.heading||'','text','',true)}${textField(`block.${index}.body`,'Metin (isteğe bağlı)',block.body||'','Görselle birlikte gösterilecek metin.',true,6)}${blockImageField(index,block.image||'','Görsel')}${inputField(`block.${index}.alt`,'Görsel açıklaması',block.alt||'')}${selectField(`block.${index}.imageSide`,'Görsel konumu',block.imageSide||'right',[{label:'Sağda',value:'right'},{label:'Solda',value:'left'}])}`;
    if(type==='callout') fields=`${selectField(`block.${index}.tone`,'Kutu türü',block.tone||'info',[{label:'Bilgi',value:'info'},{label:'Dikkat',value:'warning'},{label:'Olumlu öneri',value:'success'}])}${inputField(`block.${index}.heading`,'Başlık',block.heading||'','text','',true)}${textField(`block.${index}.body`,'Metin',block.body||'','',true,4)}`;
    if(type==='steps') fields=`${inputField(`block.${index}.heading`,'Bölüm başlığı',block.heading||'','text','',true)}${textField(`block.${index}.items`,'Adımlar',Array.isArray(block.items)?block.items.map(x=>typeof x==='string'?x:x.item).join('\n'):'','Her satıra bir adım yazın.',true,6)}`;
    return `<article class="editorial-block" data-block-index="${index}" data-block-type="${attr(type)}"><header><strong>${esc(typeLabel)}</strong><button type="button" class="icon-button remove-block" data-remove-block="${index}" aria-label="Bölümü kaldır"><i class="fa-solid fa-trash"></i></button></header><div class="form-grid">${fields}</div></article>`;
  }
  function blockImageField(index,value,label) { const key=`block-image-${index}`; return `<div class="field full"><label>${esc(label)}</label><div class="image-picker"><div class="image-preview" data-image-preview="${key}">${value?`<img src="${attr(value)}" alt="">`:'<i class="fa-regular fa-image"></i>'}</div><div><input type="hidden" name="${key}" value="${attr(value)}"><button type="button" class="button" data-pick-image="${key}" data-folder="assets/img/uploads/blog"><i class="fa-solid fa-upload"></i> Görsel yükle</button></div></div></div>`; }

  function genericForm(name,data) {
    if(name==='announcements') return `<section class="form-card"><div class="section-heading"><span class="section-icon"><i class="fa-solid fa-bullhorn"></i></span><div><h2>Duyuru bandı</h2><p>Duyuru, ziyaretçi sayfalarında menünün hemen altında ince bir bant olarak görünür.</p></div></div><div class="announcement-location"><i class="fa-solid fa-location-dot"></i><div><strong>Gösterim yeri</strong><span>Üst menünün altında, hero alanının üstünde. Aynı anda yalnızca önceliği en yüksek aktif duyuru gösterilir.</span></div></div><div class="form-grid">${switchField('published','Yayında',data.published!==false,'Kapattığınızda duyuru panelde kalır ama sitede görünmez.')}${switchField('showOnHome','Site duyuru bandında göster',data.showOnHome!==false,'Bu seçenek kapalıysa yayın durumu açık olsa bile bantta gösterilmez.')}${inputField('title','Kısa vurgu (isteğe bağlı)',data.title,'text','Örn. Bayram çalışma saatleri. Tırnak işareti yazmayın; sistem vurguyu otomatik biçimlendirir.',true)}${textField('message','Duyuru metni',data.message,'Kısa, doğrudan ve tek cümle olması önerilir.',true,4)}${dateTimeField('publishAt','Başlangıç zamanı',toInputDateTime(data.publishAt),'Şimdi yayınla düğmesi bu alanı otomatik günceller.',{now:true})}${dateTimeField('unpublishAt','Bitiş zamanı',toInputDateTime(data.unpublishAt),'Süresiz kalacaksa boş bırakın.',{clear:true})}${selectField('level','Duyuru rengi',data.level||'info',[{label:'Bilgi — açık ve sakin',value:'info'},{label:'Önemli — dikkat çekici',value:'urgent'},{label:'Standart — kurumsal',value:'standard'}])}${selectField('priority','Öncelik',String(data.priority||10),[{label:'Normal',value:'10'},{label:'Önemli',value:'50'},{label:'En üstte göster',value:'100'}],'Birden fazla aktif duyuru varsa yüksek öncelikli olan görünür.')}${inputField('linkLabel','Bağlantı düğmesi yazısı (isteğe bağlı)',data.linkLabel||'','text','Örn. Detayları gör')}${inputField('linkUrl','Bağlantı adresi (isteğe bağlı)',data.linkUrl||'','url','Site içi bağlantı için /hasta-iliskileri.html gibi yazabilirsiniz.')}${switchField('dismissible','Ziyaretçi kapatabilsin',data.dismissible!==false,'Kapatılan duyuru aynı tarayıcı oturumunda tekrar gösterilmez.')}</div></section><section class="form-card"><h2>Canlı ön izleme</h2><p class="form-intro">Bu alan yalnızca panel ön izlemesidir; site tasarım dosyalarına dokunmaz.</p><div class="announcement-preview" id="announcementPreview" data-level="${attr(data.level||'info')}"><span><strong>${esc(data.title?`${stripOuterQuotes(data.title)}: `:'')}</strong>${esc(stripOuterQuotes(data.message)||'Duyuru metniniz burada görünecek.')}</span>${data.linkLabel&&data.linkUrl?`<a href="#">${esc(data.linkLabel)}</a>`:''}<i class="fa-solid fa-xmark"></i></div></section>`;
    if(name==='faq') return `<section class="form-card"><h2>Soru ve yanıt</h2><div class="form-grid">${switchField('published','Yayında',data.published!==false)}${inputField('title','Soru',data.title,'text','',true,'required')}${selectField('category','Kategori',data.category||FAQ_CATEGORIES[0],FAQ_CATEGORIES,'',true)}${textField('answer','Kısa ve net yanıt',data.answer,'',true,7)}</div></section>`;
    if(name==='reviews') return `<section class="form-card"><h2>Google yorumu</h2><div class="form-grid">${switchField('published','Sitede kullanılabilir',data.published!==false)}${inputField('title','Panel kayıt başlığı',data.title||'','text','Örn. Ayşe K. — Temmuz 2026',true)}${inputField('author','Yorum sahibinin adı',data.author||'','text','',false,'required')}${inputField('rating','Yıldız',data.rating||5,'number','',false,'min="1" max="5"')}${inputField('time','Google’da görünen tarih',data.time||'')}${inputField('sourceUrl','Google yorum bağlantısı',data.sourceUrl||'','url')}${textField('text','Yorum metni',data.text||'','',true,7)}</div></section>`;
    if(name==='instagram') return `<section class="form-card"><h2>Galeri kaydı</h2><div class="form-grid">${switchField('published','Sitede göster',data.published!==false)}${inputField('title','Kısa açıklama',data.title||'','text','',true,'required')}${inputField('date','Yayın tarihi',toInputDateTime(data.date),'datetime-local')}${inputField('unpublishAt','Otomatik yayından kalkma',toInputDateTime(data.unpublishAt),'datetime-local','Süresizse boş bırakın.')}${inputField('instagramUrl','Instagram gönderi bağlantısı',data.instagramUrl||'','url')}${imageField('image','Görsel',data.image||'','assets/img/uploads/instagram','Hasta sahibinin kişisel verisini veya onaysız hasta fotoğrafını yüklemeyin.')}${inputField('alt','Görsel açıklaması',data.alt||'','text','Erişilebilirlik ve Google için görseli kısa anlatın.',true)}</div></section>`;
    return '';
  }

  function bindEditor(name) {
    state.dirty=false;
    $('#contentForm')?.addEventListener('input',()=>{state.dirty=true;});
    $('#contentForm')?.addEventListener('change',()=>{state.dirty=true;});
    $$('[data-save]').forEach(button => button.addEventListener('click',() => saveEditor(button.dataset.save)));
    $('[data-action="preview"]')?.addEventListener('click',previewEditor);
    $('[data-action="history"]')?.addEventListener('click',showHistory);
    $$('[data-format]').forEach(button => button.addEventListener('click',() => applyTextFormat(button.dataset.format)));
    $$('[data-pick-image]').forEach(bindImageButton);
    $$('[data-clear-image]').forEach(button => button.addEventListener('click',()=>clearImageField(button.dataset.clearImage)));
    $$('[data-add-block]').forEach(button => button.addEventListener('click',()=>addEditorialBlock(button.dataset.addBlock)));
    $$('[data-remove-block]').forEach(button => button.addEventListener('click',()=>removeEditorialBlock(Number(button.dataset.removeBlock))));
    bindDateHelpers();
    if(name==='blog'){bindTagSelector();bindContentModeSelector();}
    if(name==='announcements')bindAnnouncementPreview();
  }
  function bindContentModeSelector(){
    $$('input[name="contentMode"]').forEach(radio=>radio.addEventListener('change',()=>{
      const current=collectCurrentForm();
      current.contentMode=radio.value;
      state.edit.data=current;
      main.innerHTML=editorShell(state.edit.name,state.edit.data,state.edit.item);
      bindEditor(state.edit.name);
      requestAnimationFrame(()=>$('#contentModeCard')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }));
  }
  function bindDateHelpers(){
    $$('[data-date-now]').forEach(button=>button.addEventListener('click',()=>{const input=$(`[name="${CSS.escape(button.dataset.dateNow)}"]`);if(input){input.value=toInputDateTime(nowIso());input.dispatchEvent(new Event('input',{bubbles:true}));}}));
    $$('[data-date-clear]').forEach(button=>button.addEventListener('click',()=>{const input=$(`[name="${CSS.escape(button.dataset.dateClear)}"]`);if(input){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));}}));
  }
  function bindTagSelector(){
    const search=$('#tagSearch'),options=$('#tagOptions'),count=$('#tagCount'),selected=$('#selectedTags'),empty=$('#tagEmpty');if(!options)return;
    const boxes=()=>$$('input[name="tags"]',options);
    const update=()=>{
      const checked=boxes().filter(box=>box.checked);
      count.textContent=`${checked.length}/8`;
      selected.innerHTML=checked.length?checked.map(box=>`<button type="button" class="selected-tag" data-remove-tag="${attr(box.value)}">${esc(box.value)} <i class="fa-solid fa-xmark"></i></button>`).join(''):'<span>Henüz etiket seçilmedi.</span>';
      $$('[data-remove-tag]',selected).forEach(button=>button.addEventListener('click',()=>{const box=boxes().find(x=>x.value===button.dataset.removeTag);if(box){box.checked=false;box.dispatchEvent(new Event('change',{bubbles:true}));}}));
    };
    boxes().forEach(box=>box.addEventListener('change',()=>{if(box.checked&&boxes().filter(x=>x.checked).length>8){box.checked=false;toast('En fazla 8 etiket','Daha önce seçtiğiniz bir etiketi kaldırın.','warning');}update();}));
    search?.addEventListener('input',()=>{const q=normalize(search.value);let visible=0;$$('.choice',options).forEach(label=>{const show=!q||label.dataset.tagLabel.includes(q);label.hidden=!show;if(show)visible++;});empty.classList.toggle('hidden',visible>0);});
    $('#clearTags')?.addEventListener('click',()=>{boxes().forEach(x=>x.checked=false);update();});update();
  }
  function bindAnnouncementPreview(){
    const form=$('#contentForm'),preview=$('#announcementPreview');if(!form||!preview)return;
    const update=()=>{const title=stripOuterQuotes(form.elements.title?.value),message=stripOuterQuotes(form.elements.message?.value),label=form.elements.linkLabel?.value.trim(),url=form.elements.linkUrl?.value.trim();preview.dataset.level=form.elements.level?.value||'info';preview.innerHTML=`<span>${title?`<strong>${esc(title)}: </strong>`:''}${esc(message||'Duyuru metniniz burada görünecek.')}</span>${label&&url?`<a href="#" tabindex="-1">${esc(label)}</a>`:''}<i class="fa-solid fa-xmark"></i>`;};form.addEventListener('input',update);form.addEventListener('change',update);update();
  }
  function bindImageButton(button) {
    button.addEventListener('click',()=>{state.pendingImage={field:button.dataset.pickImage,folder:button.dataset.folder||'assets/img/uploads/genel'};hiddenFileInput.value='';hiddenFileInput.click();});
  }
  function clearImageField(name) {
    const input=$(`[name="${CSS.escape(name)}"]`); if(input) input.value='';
    const preview=$(`[data-image-preview="${CSS.escape(name)}"]`); if(preview) preview.innerHTML='<i class="fa-regular fa-image"></i>';
  }
  hiddenFileInput.addEventListener('change',async()=>{
    const file=hiddenFileInput.files?.[0], pending=state.pendingImage; if(!file||!pending)return;
    try {
      setSaveState('Görsel yükleniyor…');
      const optimized=await optimizeImage(file); const ext=optimized.type==='image/webp'?'webp':optimized.type==='image/png'?'png':'jpg';
      const base=slugify(file.name.replace(/\.[^.]+$/,'')); const path=`${pending.folder}/${Date.now()}-${base}.${ext}`;
      const content=arrayBufferToBase64(await optimized.arrayBuffer());
      await gateway(`/contents/${gatewayPath(path)}`,{method:'PUT',body:JSON.stringify({message:`Panel: görsel yüklendi — ${path}`,content,branch:state.branch})});
      const publicPath=`/${path}`; const input=$(`[name="${CSS.escape(pending.field)}"]`); if(input)input.value=publicPath;
      const preview=$(`[data-image-preview="${CSS.escape(pending.field)}"]`); if(preview)preview.innerHTML=`<img src="${attr(publicPath)}" alt="">`;
      state.cache.delete(`media:${state.branch}`); setSaveState('Görsel yüklendi'); toast('Görsel hazır', pending.field === '__general' ? 'Görsel arşive eklendi.' : 'Kaydı yayınladığınızda sitede kullanılacak.');
      if (pending.field === '__general' && state.route === 'media') await renderMedia();
    } catch(error){toast('Görsel yüklenemedi',error.message,'error');setSaveState('');}
  });
  async function optimizeImage(file) {
    if(!file.type.startsWith('image/'))throw new Error('Lütfen bir görsel dosyası seçin.');
    if(file.size>8_000_000)throw new Error('Görsel 8 MB’dan küçük olmalıdır.');
    if(file.type==='image/gif'||file.type==='image/svg+xml')return file;
    const bitmap=await createImageBitmap(file); const max=1800; const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    if(scale===1&&file.size<1_700_000)return file;
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const type=file.type==='image/png'?'image/png':'image/webp';
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,type,type==='image/png'?undefined:.84)); return blob||file;
  }

  function applyTextFormat(type) {
    const area=$('#f-content'); if(!area)return; const start=area.selectionStart,end=area.selectionEnd,selected=area.value.slice(start,end);
    const map={h2:[`## ${selected||'Bölüm başlığı'}`,''],h3:[`### ${selected||'Alt başlık'}`,''],bold:[`**${selected||'vurgulu metin'}**`,''],list:[selected?selected.split('\n').map(x=>`- ${x.replace(/^[-*] /,'')}`).join('\n'):'- Madde',''],number:[selected?selected.split('\n').map((x,i)=>`${i+1}. ${x.replace(/^\d+[.)] /,'')}`).join('\n'):'1. İlk adım',''],quote:[`> ${selected||'Bilgi notu'}`,'']};
    const [insert]=map[type]||['']; area.setRangeText(insert,start,end,'end'); area.focus();
  }
  function syncBlocksToState() {
    if(!state.edit||state.edit.name!=='blog')return;
    const nodes=$$('.editorial-block');
    if(!nodes.length&&blogContentMode(state.edit.data)!=='visual')return;
    state.edit.data.editorialSections=nodes.map(block=>{
      const index=Number(block.dataset.blockIndex),type=block.dataset.blockType; const get=n=>block.querySelector(`[name="${CSS.escape(`block.${index}.${n}`)}"]`)?.value||'';
      if(type==='text')return{type,heading:get('heading'),body:get('body')};
      if(type==='image')return{type,image:block.querySelector(`[name="block-image-${index}"]`)?.value||'',alt:get('alt'),caption:get('caption'),size:get('size')||'wide'};
      if(type==='split')return{type,heading:get('heading'),body:get('body'),image:block.querySelector(`[name="block-image-${index}"]`)?.value||'',alt:get('alt'),imageSide:get('imageSide')||'right'};
      if(type==='callout')return{type,tone:get('tone')||'info',heading:get('heading'),body:get('body')};
      if(type==='steps')return{type,heading:get('heading'),items:get('items').split('\n').map(x=>x.trim()).filter(Boolean).map(item=>({item}))};
      return{type};
    });
  }
  function collectCurrentForm() {
    const form=$('#contentForm');if(!form)return clone(state.edit?.data||{});syncBlocksToState(); const fd=new FormData(form); const name=state.edit.name; const data=clone(state.edit.data||{});
    const boolNames={blog:['published','featured'],announcements:['published','showOnHome','dismissible'],faq:['published'],reviews:['published'],instagram:['published']}[name]||[];
    boolNames.forEach(key=>data[key]=!!form.elements[key]?.checked);
    const set=(key,value)=>{if(key.includes('.')){const[a,b]=key.split('.');data[a]=data[a]||{};data[a][b]=value;}else data[key]=value;};
    [...fd.entries()].forEach(([key,value])=>{if(boolNames.includes(key)||key==='tags'||key.startsWith('block.')||key.startsWith('block-image-'))return;set(key,value);});
    if(name==='blog'){
      data.tags=fd.getAll('tags').slice(0,8);data.date=fromInputDateTime(fd.get('date'));data.unpublishAt=fromInputDateTime(fd.get('unpublishAt'));
      data.contentMode=fd.get('contentMode')||blogContentMode(data);
      data.editorialSections=clone(state.edit.data.editorialSections||[]);
    }
    if(name==='announcements'){data.title=stripOuterQuotes(data.title);data.message=stripOuterQuotes(data.message);data.publishAt=fromInputDateTime(fd.get('publishAt'));data.unpublishAt=fromInputDateTime(fd.get('unpublishAt'));data.priority=Number(fd.get('priority')||10);}
    if(name==='reviews')data.rating=Math.max(1,Math.min(5,Number(fd.get('rating')||5)));
    if(name==='instagram'){data.date=fromInputDateTime(fd.get('date'));data.unpublishAt=fromInputDateTime(fd.get('unpublishAt'));}
    data.archived=!!data.archived;data.trashed=!!data.trashed;return data;
  }
  function addEditorialBlock(type) {
    const current=collectCurrentForm(); const defaults={text:{type:'text',heading:'',body:''},image:{type:'image',image:'',alt:'',caption:'',size:'wide'},split:{type:'split',heading:'',body:'',image:'',alt:'',imageSide:'right'},callout:{type:'callout',tone:'info',heading:'',body:''},steps:{type:'steps',heading:'',items:[]}};
    current.editorialSections=[...(current.editorialSections||[]),clone(defaults[type])]; state.edit.data=current; rerenderEditorPreserving();
  }
  function removeEditorialBlock(index) { const current=collectCurrentForm();current.editorialSections=(current.editorialSections||[]).filter((_,i)=>i!==index);state.edit.data=current;rerenderEditorPreserving(); }
  function rerenderEditorPreserving(){main.innerHTML=editorShell(state.edit.name,state.edit.data,state.edit.item);bindEditor(state.edit.name);window.scrollTo({top:0,behavior:'smooth'});}

  function validateEditor(name,data,action) {
    const isDraft=action==='draft';
    if(name!=='announcements'&&!String(data.title||'').trim())return'Başlık alanını doldurun.';
    if(name==='announcements'&&!isDraft&&!String(data.message||'').trim())return'Duyuru metnini yazın.';
    if(name==='blog'&&!isDraft&&!String(data.summary||'').trim())return'Kısa açıklamayı yazın.';
    if(name==='blog'&&!isDraft){
      const mode=blogContentMode(data);
      if(mode==='standard'&&!String(data.content||'').trim())return'Sadece metin biçiminde yazının metnini ekleyin.';
      if(mode==='visual'){
        const meaningful=(data.editorialSections||[]).some(block=>{
          if(block.type==='text')return String(block.body||'').trim();
          if(block.type==='image')return !!block.image;
          if(block.type==='split')return !!block.image||String(block.body||'').trim();
          if(block.type==='callout')return String(block.body||'').trim();
          if(block.type==='steps')return Array.isArray(block.items)&&block.items.some(item=>String(typeof item==='string'?item:item?.item||'').trim());
          return false;
        });
        if(!meaningful)return'Görselli yazı biçiminde en az bir dolu bölüm ekleyin.';
      }
    }
    if(name==='faq'&&!isDraft&&!String(data.answer||'').trim())return'Yanıtı yazın.';
    if(name==='reviews'&&!isDraft&&(!data.author||!data.text))return'Yorum sahibi ve yorum metni gereklidir.';
    if(name==='instagram'&&!isDraft&&!data.image)return'Instagram galerisi için görsel yükleyin.';
    const config=COLLECTIONS[name],date=config.dateField?dateValue(data[config.dateField]):null,end=dateValue(data.unpublishAt);
    if(action==='schedule'&&(!date||date<=new Date()))return'İleri tarihli yayın için gelecekte bir gün ve saat seçin.';
    if(end&&date&&end<=date)return'Otomatik yayından kalkma zamanı, yayınlama zamanından sonra olmalıdır.';
    return'';
  }

  function newPath(name,data) {
    const config=COLLECTIONS[name],date=dateValue(data[config.dateField])||new Date(),prefix=['blog','announcements','instagram'].includes(name)?`${date.toISOString().slice(0,10)}-`:'';
    const base=slugify(data.advanced?.slug||data.title||data.message||data.author||`taslak-${Date.now()}`);return`${config.folder}/${prefix}${base}.json`;
  }
  async function saveEditor(action) {
    if(state.saving)return;
    const data=collectCurrentForm(),name=state.edit.name,item=state.edit.item,config=COLLECTIONS[name];
    if(action==='publish'){
      data.published=true;data.archived=false;data.trashed=false;if(config.dateField)data[config.dateField]=nowIso();
      const end=dateValue(data.unpublishAt);if(end&&end<=new Date())data.unpublishAt='';
    }
    if(action==='schedule'){data.published=true;data.archived=false;data.trashed=false;}
    if(action==='draft'||action==='unpublish'){data.published=false;data.archived=false;data.trashed=false;}
    if(action==='archive'){data.published=false;data.archived=true;data.trashed=false;}
    if(action==='trash'){if(!confirm('Bu içerik çöp kutusuna taşınsın mı?'))return;data.published=false;data.archived=false;data.trashed=true;data.trashedAt=nowIso();}
    const validation=validateEditor(name,data,action);if(validation){toast('Eksik veya hatalı bilgi',validation,'warning');return;}
    let path=item?item._path:newPath(name,data);
    if(!item){const existing=await listCollection(name);if(existing.some(row=>row._path===path))path=path.replace(/\.json$/i,`-${Date.now()}.json`);}
    const message=`Panel: ${collectionTitle(name,data)} — ${actionLabel(action)}`;
    try{
      state.saving=true;$$('[data-save]').forEach(button=>button.disabled=true);
      await writeJson(path,data,message,item?item._sha:null,item!=null);clearCollection(name);
      state.dirty=false;toast('İçerik kaydedildi',`${actionLabel(action)}. Netlify yeni sürümü hazırlıyor.`);location.hash=`#collection/${name}`;
    }catch(error){if(/sha|conflict|does not match/i.test(error.message))toast('Başka bir değişiklik bulundu','Listeyi yenileyip tekrar deneyin.','error');else toast('Kaydedilemedi',error.message,'error');}
    finally{state.saving=false;$$('[data-save]').forEach(button=>button.disabled=false);}
  }

  function actionLabel(action){return{publish:'Şimdi yayınlandı',schedule:'İleri tarihe planlandı',draft:'Taslak kaydedildi',unpublish:'Yayından kaldırıldı',archive:'Arşivlendi',trash:'Çöp kutusuna taşındı'}[action]||'Güncellendi';}
  function previewEditor(){const data=collectCurrentForm(),name=state.edit.name;let body='';if(name==='blog')body=`${data.cover?`<img src="${attr(data.cover)}" style="width:100%;max-height:280px;object-fit:cover;border-radius:18px;margin-bottom:16px">`:''}<h1>${esc(data.title||'Başlıksız')}</h1><p style="color:#667085">${esc(data.summary||'')}</p><div style="line-height:1.75">${simpleRichPreview(data.content||'')}</div>`;else body=`<h2>${esc(collectionTitle(name,data))}</h2><p style="line-height:1.7">${esc(collectionDescription(name,data))}</p>`;openModal({title:'Ön izleme',kicker:'YAYIN ÖNCESİ',body,footer:'<button class="button primary" id="previewClose">Kapat</button>'});$('#previewClose').addEventListener('click',closeModal);}
  function simpleRichPreview(value){return esc(value).replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>').replace(/^[-*] (.+)$/gm,'<li>$1</li>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').split(/\n{2,}/).map(x=>/^<(h|li|block)/.test(x)?x:`<p>${x.replace(/\n/g,'<br>')}</p>`).join('');}
  async function showHistory(){const item=state.edit.item;if(!item)return;openModal({title:'Önceki sürümler',kicker:'GERİ ALMA',body:'<div class="page-loading" style="min-height:200px"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Yedekler hazırlanıyor…</span></div>'});const backups=await backupList(item._path);$('#modalBody').innerHTML=backups.length?`<div class="content-list">${backups.map(b=>`<article class="content-card"><div><h3>${esc(formatDate(b.createdAt,true))}</h3><p>${esc(b.action||'Panel değişikliği')} · ${esc(b.by||'yetkili')}</p></div><button class="button" data-restore-backup="${attr(b.id)}">Bu sürüme dön</button></article>`).join('')}</div>`:emptyState('fa-clock-rotate-left','Henüz yedek yok','Bu içerik bir sonraki değişiklikten itibaren otomatik yedeklenecek.');$$('[data-restore-backup]').forEach(btn=>btn.addEventListener('click',()=>restoreBackup(btn.dataset.restoreBackup)));}
  async function restoreBackup(id){if(!confirm('Seçilen eski sürüm mevcut içeriğin yerine kaydedilsin mi?'))return;try{const backup=await backupRead(id);const item=state.edit.item;await writeJson(item._path,backup.data,`Panel: eski sürüm geri yüklendi — ${collectionTitle(state.edit.name,backup.data)}`,item._sha,true);clearCollection(state.edit.name);closeModal();toast('Eski sürüm geri yüklendi');location.hash=`#collection/${state.edit.name}`;}catch(error){toast('Geri yüklenemedi',error.message,'error');}}


  async function renderHomeOverview(){
    const [blog,announcements,services,homeFaq,homeReviews]=await Promise.all([
      listCollection('blog'),listCollection('announcements'),readJson('assets/data/services.json',{items:[]}),readJson('settings/home-faq.json',{items:[]}),readJson('settings/home-reviews.json',{items:[],totalCount:194})
    ]);
    const featuredBlog=blog.filter(x=>x.featured&&contentStatus(x,COLLECTIONS.blog).key==='published').length;
    const featuredServices=(services.data.items||[]).filter(x=>x.featured&&x.published!==false).length;
    const activeAnnouncements=announcements.filter(x=>x.showOnHome!==false&&['published','scheduled'].includes(contentStatus(x,COLLECTIONS.announcements).key)).length;
    main.innerHTML=`<header class="page-head"><div><span class="kicker">ANA SAYFA KONTROLÜ</span><h1>Ana sayfa vitrini</h1><p>Ana sayfanın tasarımına dokunmadan, ziyaretçiye gösterilecek duyuru, blog, hizmet, soru ve yorum seçimlerini yönetin.</p></div><div class="page-actions"><a class="button primary" href="/" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ana sayfayı aç</a></div></header>
    <section class="dashboard-grid"><div class="panel"><div class="panel-head"><div><h2>Vitrin içerikleri</h2><p>Her alan kendi güvenli sınırında gösterilir; içerik ekledikçe sayfa yığılmaz.</p></div></div><div class="quick-list">
      ${quickItem('fa-bullhorn','Duyuru alanı',`${activeAnnouncements} aktif veya planlı duyuru`,'#collection/announcements')}
      ${quickItem('fa-file-lines','Öne çıkan bloglar',`${featuredBlog} yazı seçili · ana sayfada en fazla 3`,'#collection/blog')}
      ${quickItem('fa-stethoscope','Öne çıkan hizmetler',`${featuredServices} hizmet seçili`,'#services')}
      ${quickItem('fa-circle-question','Ana sayfa SSS',`${(homeFaq.data.items||[]).length} / 6 soru seçili`,'#home/faq')}
      ${quickItem('fa-star','Google yorumları',`${(homeReviews.data.items||[]).length} yorum seçili · toplam ${homeReviews.data.totalCount||0}`,'#home/reviews')}
    </div></div><div class="panel padded"><h2>Korunan tasarım düzeni</h2><div class="security-list" style="margin-top:14px">
      ${securityRow('fa-layer-group','İçerik sınırları','Aktif','Blog, yorum, SSS ve duyuru sayıları kontrollü gösterilir')}
      ${securityRow('fa-palette','Görsel tasarım','Donduruldu','Header, hero, animasyonlar ve sayfa hizaları panelden değişmez')}
      ${securityRow('fa-link','Tek kaynak','Aktif','Hizmetler ve SSS ilgili sayfalarda aynı kayıttan güncellenir')}
      ${securityRow('fa-shield-halved','Güvenli yayın','Aktif','Panel yalnızca onaylı içerik dosyalarını değiştirir')}
    </div></div></section>`;
  }

  async function renderHomeFaq(){
    const [faqs,settings]=await Promise.all([listCollection('faq'),readJson('settings/home-faq.json',{title:'Ana Sayfa SSS',items:[]})]);
    const selected=(settings.data.items||[]).map(x=>typeof x==='string'?x:x.faq).filter(Boolean).slice(0,6);
    main.innerHTML=`<header class="page-head"><div><span class="kicker">ANA SAYFA SEÇİMİ</span><h1>Ana sayfa SSS</h1><p>Ana sayfada gösterilecek en fazla altı soruyu seçin ve sıralayın. SSS sayfasındaki tüm sorular bu işlemden etkilenmez.</p></div><div class="page-actions"><button class="button primary large" id="saveHomeFaq"><i class="fa-regular fa-floppy-disk"></i> Seçimi kaydet</button></div></header>
      <section class="dashboard-grid"><div class="panel"><div class="panel-head"><div><h2>Ana sayfada görünenler</h2><p>Ok düğmeleriyle sıralayın.</p></div><span class="tag" id="faqSelectedCount">${selected.length}/6</span></div><div class="sortable-list" id="selectedFaqList" style="padding:13px">${selected.map(slug=>relationRow('faq',slug,faqs.find(x=>x._slug===slug)?.title||slug)).join('')}</div></div><div class="panel"><div class="panel-head"><div><h2>Soru ekle</h2><p>Yayındaki sorulardan seçim yapın.</p></div></div><div style="padding:13px"><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="faqRelationSearch" placeholder="Sorularda ara…"></div><div class="content-list" id="availableFaqList" style="margin-top:10px"></div></div></div></section>`;
    const renderAvailable=()=>{const chosen=getRelationOrder('#selectedFaqList');const q=normalize($('#faqRelationSearch').value);const rows=faqs.filter(x=>x.published!==false&&!chosen.includes(x._slug)&&(!q||normalize([x.title,x.category]).includes(q)));$('#availableFaqList').innerHTML=rows.map(x=>`<article class="content-card"><div><h3>${esc(x.title)}</h3><p>${esc(x.category||'')}</p></div><button class="button" data-add-relation="${attr(x._slug)}">Ekle</button></article>`).join('')||emptyState('fa-check','Seçilecek soru kalmadı','Başka bir arama deneyin.');$$('[data-add-relation]').forEach(btn=>btn.addEventListener('click',()=>{if(getRelationOrder('#selectedFaqList').length>=6){toast('En fazla 6 soru','Önce bir soruyu kaldırın.','warning');return;}$('#selectedFaqList').insertAdjacentHTML('beforeend',relationRow('faq',btn.dataset.addRelation,faqs.find(x=>x._slug===btn.dataset.addRelation)?.title||''));bindRelationButtons('#selectedFaqList',renderAvailable);updateRelationCount('#selectedFaqList','#faqSelectedCount',6);renderAvailable();}));};
    bindRelationButtons('#selectedFaqList',renderAvailable);$('#faqRelationSearch').addEventListener('input',renderAvailable);renderAvailable();$('#saveHomeFaq').addEventListener('click',async()=>{try{const data={title:'Ana Sayfa SSS',items:getRelationOrder('#selectedFaqList').map(faq=>({faq}))};await writeJson('settings/home-faq.json',data,'Panel: ana sayfa SSS seçimi güncellendi',settings.sha);state.cache.delete(`file:${state.branch}:settings/home-faq.json`);toast('Ana sayfa SSS güncellendi');}catch(error){toast('Kaydedilemedi',error.message,'error');}});
  }
  function relationRow(type,slug,title){return`<div class="sortable-item" data-relation-slug="${attr(slug)}"><span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span><div><strong>${esc(title)}</strong><small>${type==='faq'?'Sık sorulan soru':'Google yorumu'}</small></div><div class="button-row"><button class="icon-button" data-move="up" title="Yukarı"><i class="fa-solid fa-arrow-up"></i></button><button class="icon-button" data-move="down" title="Aşağı"><i class="fa-solid fa-arrow-down"></i></button><button class="icon-button" data-remove-relation title="Kaldır"><i class="fa-solid fa-xmark"></i></button></div></div>`;}
  function getRelationOrder(selector){return $$('[data-relation-slug]',$(selector)).map(x=>x.dataset.relationSlug);}
  function updateRelationCount(list,count,max){$(count).textContent=`${getRelationOrder(list).length}/${max}`;}
  function bindRelationButtons(selector,onChange){const root=$(selector);$$('[data-move]',root).forEach(btn=>{if(btn.dataset.bound)return;btn.dataset.bound='1';btn.addEventListener('click',()=>{const row=btn.closest('[data-relation-slug]');if(btn.dataset.move==='up'&&row.previousElementSibling)root.insertBefore(row,row.previousElementSibling);if(btn.dataset.move==='down'&&row.nextElementSibling)root.insertBefore(row.nextElementSibling,row);onChange?.();});});$$('[data-remove-relation]',root).forEach(btn=>{if(btn.dataset.bound)return;btn.dataset.bound='1';btn.addEventListener('click',()=>{btn.closest('[data-relation-slug]').remove();onChange?.();});});}

  async function renderHomeReviews(){
    const [reviews,settings]=await Promise.all([listCollection('reviews'),readJson('settings/home-reviews.json',{title:'Ana Sayfa Google Yorumları',totalCount:194,items:[]})]);
    const selected=(settings.data.items||[]).map(x=>typeof x==='string'?x:x.review).filter(Boolean).slice(0,12);
    main.innerHTML=`<header class="page-head"><div><span class="kicker">ORTAK YORUM SUNUMU</span><h1>Sitedeki Google yorumları</h1><p>Ana sayfa ve Hakkımızda sayfası aynı seçilmiş yorum listesini kullanır. Yorumu yalnızca bir kez eklemeniz yeterlidir.</p></div><div class="page-actions"><button class="button primary large" id="saveHomeReviews"><i class="fa-regular fa-floppy-disk"></i> Seçimi kaydet</button></div></header>
      <section class="form-card" style="margin-bottom:14px"><div class="form-grid">${inputField('totalCount','Google’daki toplam değerlendirme sayısı',settings.data.totalCount||194,'number','Hero kartındaki toplam sayı.',false,'min="0"')}</div></section>
      <section class="dashboard-grid"><div class="panel"><div class="panel-head"><div><h2>Sitede görünen yorumlar</h2><p>Ana sayfa ve Hakkımızda ortak sıralama</p></div><span class="tag" id="reviewSelectedCount">${selected.length}/12</span></div><div class="sortable-list" id="selectedReviewList" style="padding:13px">${selected.map(slug=>relationRow('review',slug,reviews.find(x=>x._slug===slug)?.author||slug)).join('')}</div></div><div class="panel"><div class="panel-head"><div><h2>Yorum ekle</h2><p>Ortak yorum havuzundan seçim yapın.</p></div></div><div style="padding:13px"><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="reviewRelationSearch" placeholder="İsim veya yorumda ara…"></div><div class="content-list" id="availableReviewList" style="margin-top:10px"></div></div></div></section>`;
    const renderAvailable=()=>{const chosen=getRelationOrder('#selectedReviewList'),q=normalize($('#reviewRelationSearch').value);const rows=reviews.filter(x=>x.published!==false&&!chosen.includes(x._slug)&&(!q||normalize([x.author,x.text]).includes(q)));$('#availableReviewList').innerHTML=rows.map(x=>`<article class="content-card"><div><h3>${esc(x.author)}</h3><p>${esc(truncate(x.text,100))}</p></div><button class="button" data-add-review="${attr(x._slug)}">Ekle</button></article>`).join('')||emptyState('fa-check','Seçilecek yorum kalmadı','Başka bir arama deneyin.');$$('[data-add-review]').forEach(btn=>btn.addEventListener('click',()=>{if(getRelationOrder('#selectedReviewList').length>=12){toast('En fazla 12 yorum','Önce bir yorumu kaldırın.','warning');return;}$('#selectedReviewList').insertAdjacentHTML('beforeend',relationRow('review',btn.dataset.addReview,reviews.find(x=>x._slug===btn.dataset.addReview)?.author||''));bindRelationButtons('#selectedReviewList',renderAvailable);updateRelationCount('#selectedReviewList','#reviewSelectedCount',12);renderAvailable();}));};
    bindRelationButtons('#selectedReviewList',renderAvailable);$('#reviewRelationSearch').addEventListener('input',renderAvailable);renderAvailable();$('#saveHomeReviews').addEventListener('click',async()=>{try{const data={title:'Ana Sayfa Google Yorumları',totalCount:Number($('#f-totalCount').value||0),items:getRelationOrder('#selectedReviewList').map(review=>({review}))};await writeJson('settings/home-reviews.json',data,'Panel: sitedeki Google yorumları güncellendi',settings.sha);state.cache.delete(`file:${state.branch}:settings/home-reviews.json`);toast('Sitedeki yorumlar güncellendi');}catch(error){toast('Kaydedilemedi',error.message,'error');}});
  }

  async function renderServices(){const file=await readJson('assets/data/services.json',{title:'Hizmetlerimiz',items:[]});state.edit={type:'services',file,data:clone(file.data)};main.innerHTML=`<header class="page-head"><div><span class="kicker">TEK KAYNAK</span><h1>Hizmetler</h1><p>Ana sayfa ve Hizmetler sayfası aynı kayıtları kullanır. Sıra, kısa açıklama ve görünürlüğü buradan yönetin.</p></div><div class="page-actions"><button class="button" id="addService"><i class="fa-solid fa-plus"></i> Hizmet ekle</button><button class="button primary large" id="saveServices"><i class="fa-regular fa-floppy-disk"></i> Hizmetleri kaydet</button></div></header><section class="form-card"><div class="form-grid">${inputField('servicesTitle','Bölüm başlığı',file.data.title||'Hizmetlerimiz','text','',true)}</div></section><div id="serviceItems" style="margin-top:14px">${(file.data.items||[]).map((item,index)=>serviceEditorCard(item,index)).join('')}</div>`;bindServices();}
  function serviceEditorCard(item,index){return`<article class="service-card" data-service-index="${index}"><div class="item-card-head"><strong>${esc(item.title||`Hizmet ${index+1}`)}</strong><div class="button-row"><button class="icon-button" data-service-move="up"><i class="fa-solid fa-arrow-up"></i></button><button class="icon-button" data-service-move="down"><i class="fa-solid fa-arrow-down"></i></button><button class="icon-button" data-service-remove><i class="fa-solid fa-trash"></i></button></div></div><div class="form-grid">${switchField(`service.${index}.published`,'Yayında',item.published!==false)}${switchField(`service.${index}.featured`,'Ana sayfada öne çıkar',!!item.featured)}${inputField(`service.${index}.title`,'Hizmet adı',item.title||'','text','',true)}${textField(`service.${index}.summary`,'Kısa açıklama',item.summary||'','Ana sayfa kartında kullanılır.',true,3)}${textField(`service.${index}.detail`,'Detaylı açıklama',item.detail||'','Hizmetler sayfasında kullanılır.',true,4)}${inputField(`service.${index}.id`,'Kimlik',item.id||slugify(item.title||''),'text','Bağlantılar için kısa ve benzersiz ad.')}${inputField(`service.${index}.icon`,'İkon sınıfı',item.icon||'')}${inputField(`service.${index}.href`,'Bağlantı',item.href||'')}</div></article>`;}
  function collectServices(){return $$('.service-card').map(card=>{const i=card.dataset.serviceIndex,get=n=>card.querySelector(`[name="service.${i}.${n}"]`);return{published:!!get('published')?.checked,featured:!!get('featured')?.checked,order:$$('.service-card').indexOf(card)+1,title:get('title')?.value.trim()||'',summary:get('summary')?.value.trim()||'',detail:get('detail')?.value.trim()||'',id:get('id')?.value.trim()||slugify(get('title')?.value),icon:get('icon')?.value.trim()||'',href:get('href')?.value.trim()||''};});}
  function bindServices(){const rerender=items=>{state.edit.data.items=items;$('#serviceItems').innerHTML=items.map(serviceEditorCard).join('');bindServices();};$$('[data-service-move]').forEach(btn=>btn.addEventListener('click',()=>{const items=collectServices(),i=Number(btn.closest('.service-card').dataset.serviceIndex),j=btn.dataset.serviceMove==='up'?i-1:i+1;if(j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];rerender(items);}));$$('[data-service-remove]').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('Bu hizmet kaydı kaldırılsın mı?'))rerender(collectServices().filter((_,i)=>i!==Number(btn.closest('.service-card').dataset.serviceIndex)));}));const add=$('#addService');if(add&&!add.dataset.bound){add.dataset.bound='1';add.addEventListener('click',()=>rerender([...collectServices(),{published:true,featured:false,title:'Yeni hizmet',summary:'',detail:'',id:`hizmet-${Date.now()}`,icon:'fa-solid fa-stethoscope',href:'/hizmetler.html'}]));}const save=$('#saveServices');if(save&&!save.dataset.bound){save.dataset.bound='1';save.addEventListener('click',async()=>{try{const data={title:$('#f-servicesTitle').value.trim()||'Hizmetlerimiz',items:collectServices()};await writeJson('assets/data/services.json',data,'Panel: hizmetler güncellendi',state.edit.file.sha);state.cache.delete(`file:${state.branch}:assets/data/services.json`);toast('Hizmetler kaydedildi');await renderServices();}catch(error){toast('Kaydedilemedi',error.message,'error');}});}}

  async function renderStories(){const file=await readJson('assets/data/successStories.json',{stories:[]});state.edit={type:'stories',file,data:clone(file.data)};main.innerHTML=`<header class="page-head"><div><span class="kicker">HASTA HİKÂYELERİ</span><h1>Başarı hikâyeleri</h1><p>Görsel, kısa özet ve detaylı hikâyeyi ekleyin. Hasta sahibinin açık onayı olmayan fotoğraf veya kişisel bilgi kullanmayın.</p></div><div class="page-actions"><button class="button" id="addStory"><i class="fa-solid fa-plus"></i> Hikâye ekle</button><button class="button primary large" id="saveStories"><i class="fa-regular fa-floppy-disk"></i> Hikâyeleri kaydet</button></div></header><div id="storyItems">${(file.data.stories||[]).map((item,index)=>storyEditorCard(item,index)).join('')}</div>`;bindStories();}
  function storyEditorCard(item,index){return`<article class="story-card" data-story-index="${index}"><div class="item-card-head"><strong>${esc(item.title||`Hikâye ${index+1}`)}</strong><div class="button-row"><button class="icon-button" data-story-move="up"><i class="fa-solid fa-arrow-up"></i></button><button class="icon-button" data-story-move="down"><i class="fa-solid fa-arrow-down"></i></button><button class="icon-button" data-story-remove><i class="fa-solid fa-trash"></i></button></div></div><div class="form-grid">${switchField(`story.${index}.published`,'Yayında',item.published!==false)}${switchField(`story.${index}.featured`,'Öne çıkan hikâye',!!item.featured)}${inputField(`story.${index}.title`,'Başlık',item.title||'','text','',true)}${inputField(`story.${index}.petName`,'Hayvanın adı',item.petName||'')}${selectField(`story.${index}.species`,'Tür',item.species||'Kedi',['Kedi','Köpek','Diğer'])}${inputField(`story.${index}.tagline`,'Kısa vurgu',item.tagline||'','text','',true)}${textField(`story.${index}.summary`,'Kısa özet',item.summary||'','',true,3)}${textField(`story.${index}.body`,'Detaylı hikâye',item.body||'','',true,6)}${storyImageField(index,item.image||'')}${inputField(`story.${index}.id`,'Kimlik',item.id||slugify(item.title||''))}${inputField(`story.${index}.icon`,'İkon',item.icon||'fa-solid fa-paw')}</div></article>`;}
  function storyImageField(index,value){const key=`story.${index}.image`;return`<div class="field full"><label>Görsel</label><div class="image-picker"><div class="image-preview" data-image-preview="${attr(key)}">${value?`<img src="${attr(value)}" alt="">`:'<i class="fa-solid fa-paw"></i>'}</div><div><input type="hidden" name="${attr(key)}" value="${attr(value)}"><button type="button" class="button" data-pick-image="${attr(key)}" data-folder="assets/img/uploads/basari-hikayeleri"><i class="fa-solid fa-upload"></i> Görsel yükle</button></div></div></div>`;}
  function collectStories(){return $$('.story-card').map(card=>{const i=card.dataset.storyIndex,get=n=>card.querySelector(`[name="story.${i}.${n}"]`);return{published:!!get('published')?.checked,featured:!!get('featured')?.checked,title:get('title')?.value.trim()||'',petName:get('petName')?.value.trim()||'',species:get('species')?.value||'Kedi',tagline:get('tagline')?.value.trim()||'',summary:get('summary')?.value.trim()||'',body:get('body')?.value.trim()||'',image:get('image')?.value||'',id:get('id')?.value.trim()||slugify(get('title')?.value),icon:get('icon')?.value.trim()||'fa-solid fa-paw'};});}
  function bindStories(){const rerender=items=>{state.edit.data.stories=items;$('#storyItems').innerHTML=items.map(storyEditorCard).join('');bindStories();};$$('[data-pick-image]').forEach(bindImageButton);$$('[data-story-move]').forEach(btn=>btn.addEventListener('click',()=>{const items=collectStories(),i=Number(btn.closest('.story-card').dataset.storyIndex),j=btn.dataset.storyMove==='up'?i-1:i+1;if(j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];rerender(items);}));$$('[data-story-remove]').forEach(btn=>btn.addEventListener('click',()=>{if(confirm('Bu hikâye kaldırılsın mı?'))rerender(collectStories().filter((_,i)=>i!==Number(btn.closest('.story-card').dataset.storyIndex)));}));const add=$('#addStory');if(add&&!add.dataset.bound){add.dataset.bound='1';add.addEventListener('click',()=>rerender([{published:true,featured:false,title:'Yeni başarı hikâyesi',petName:'',species:'Kedi',tagline:'',summary:'',body:'',image:'',id:`hikaye-${Date.now()}`,icon:'fa-solid fa-paw'},...collectStories()]));}const save=$('#saveStories');if(save&&!save.dataset.bound){save.dataset.bound='1';save.addEventListener('click',async()=>{try{await writeJson('assets/data/successStories.json',{stories:collectStories()},'Panel: başarı hikâyeleri güncellendi',state.edit.file.sha);state.cache.delete(`file:${state.branch}:assets/data/successStories.json`);toast('Başarı hikâyeleri kaydedildi');await renderStories();}catch(error){toast('Kaydedilemedi',error.message,'error');}});}}

  async function renderCalendar(){
    const [blog,announcements,instagram]=await Promise.all([listCollection('blog'),listCollection('announcements'),listCollection('instagram')]);
    const events=[
      ...blog.filter(x=>!x.trashed&&!x.archived).map(x=>({type:'blog',date:x.date,title:x.title,href:`#edit/blog/${encodeURIComponent(x._slug)}`,status:contentStatus(x,COLLECTIONS.blog).key})),
      ...announcements.filter(x=>!x.trashed&&!x.archived).map(x=>({type:'announcement',date:x.publishAt,title:collectionTitle('announcements',x),href:`#edit/announcements/${encodeURIComponent(x._slug)}`,status:contentStatus(x,COLLECTIONS.announcements).key})),
      ...instagram.filter(x=>!x.trashed&&!x.archived).map(x=>({type:'instagram',date:x.date,title:x.title,href:`#edit/instagram/${encodeURIComponent(x._slug)}`,status:contentStatus(x,COLLECTIONS.instagram).key})),
    ].filter(x=>dateValue(x.date));
    const current=state.calendarDate,year=current.getFullYear(),month=current.getMonth();
    const existingTitles=blog.map(x=>normalize(x.title));
    const ideas=calendarIdeas(month).filter(idea=>!existingTitles.some(title=>title.includes(normalize(idea.title))||normalize(idea.title).includes(title))).slice(0,8);
    main.innerHTML=`<header class="page-head"><div><span class="kicker">PAYLAŞIM PLANI</span><h1>İçerik takvimi</h1><p>Blog, duyuru ve Instagram galerisi kayıtlarını aynı takvimde görün. Boş günler için hazır fikirlerden yararlanın.</p></div><div class="page-actions"><a class="button primary" href="#edit/blog/new"><i class="fa-solid fa-plus"></i> Blog planla</a><a class="button" href="#edit/announcements/new">Duyuru planla</a></div></header>
      <section class="calendar-shell"><div class="panel calendar-panel"><div class="calendar-head"><button class="icon-button" id="calPrev"><i class="fa-solid fa-chevron-left"></i></button><h2>${esc(current.toLocaleDateString('tr-TR',{month:'long',year:'numeric'}))}</h2><div class="button-row"><button class="button" id="calToday">Bugün</button><button class="icon-button" id="calNext"><i class="fa-solid fa-chevron-right"></i></button></div></div>${calendarGrid(year,month,events)}</div><aside class="panel calendar-sidebar"><div class="item-card-head"><div><h2>Bu ay için içerik fikirleri</h2><p>Öneriler taslak oluşturur; siz onaylamadan yayınlanmaz.</p></div><button class="icon-button" id="shuffleIdeas" title="Başka fikirler"><i class="fa-solid fa-shuffle"></i></button></div><div class="idea-list" id="ideaList"></div></aside></section>`;
    const renderIdeas=()=>{const list=ideas.length?ideas:calendarIdeas(month);const offset=state.calendarIdeaOffset%list.length;const shown=[...list.slice(offset),...list.slice(0,offset)].slice(0,4);$('#ideaList').innerHTML=shown.map((idea,index)=>`<article class="idea-item"><span class="idea-category">${esc(idea.category)}</span><strong>${esc(idea.title)}</strong><p>${esc(idea.summary)}</p><button type="button" class="button" data-use-idea="${index}"><i class="fa-solid fa-wand-magic-sparkles"></i> Taslağa dönüştür</button></article>`).join('');$$('[data-use-idea]').forEach((button,i)=>button.addEventListener('click',()=>{sessionStorage.setItem('elci-admin-blog-idea',JSON.stringify(shown[i]));location.hash='#edit/blog/new';}));};
    renderIdeas();
    $('#shuffleIdeas').addEventListener('click',()=>{state.calendarIdeaOffset=(state.calendarIdeaOffset+4)%(ideas.length||calendarIdeas(month).length);renderIdeas();});
    $('#calPrev').addEventListener('click',()=>{state.calendarDate=new Date(year,month-1,1);state.calendarIdeaOffset=0;renderCalendar();});$('#calNext').addEventListener('click',()=>{state.calendarDate=new Date(year,month+1,1);state.calendarIdeaOffset=0;renderCalendar();});$('#calToday').addEventListener('click',()=>{state.calendarDate=new Date();state.calendarIdeaOffset=0;renderCalendar();});
  }
  function calendarGrid(year,month,events){const first=new Date(year,month,1),start=new Date(year,month,1-((first.getDay()+6)%7)),today=new Date();let cells='';for(let i=0;i<42;i++){const date=new Date(start);date.setDate(start.getDate()+i);const dayEvents=events.filter(e=>{const d=dateValue(e.date);return d&&d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()&&d.getDate()===date.getDate();});const isToday=date.toDateString()===today.toDateString();cells+=`<div class="calendar-day ${date.getMonth()!==month?'outside':''} ${isToday?'today':''}"><span class="calendar-date">${date.getDate()}</span><div class="calendar-events">${dayEvents.slice(0,4).map(e=>`<a class="calendar-event ${e.type}" href="${e.href}" title="${attr(e.title)}">${esc(e.title)}</a>`).join('')}${dayEvents.length>4?`<span class="calendar-event">+${dayEvents.length-4} içerik</span>`:''}</div></div>`;}return`<div class="calendar-grid">${['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(x=>`<div class="calendar-day-name">${x}</div>`).join('')}${cells}</div>`;}
  function calendarIdeas(month){
    const all={
      0:[['Yeni yıl check-up rehberi','Yıllık kontrolün hangi hastalıkları erken yakalayabileceğini anlatın.','Koruyucu Sağlık',['Check-up','Kan Tahlili','Muayene']],['Kışın su tüketimi','Kedi ve köpeklerin kışın yeterli su içmesini sağlayacak pratik öneriler.','Beslenme ve Günlük Bakım',['Su Tüketimi','Kış Bakımı']],['Soğukta pati bakımı','Tuz, buz ve soğuk zeminin pati sağlığına etkisi.','Mevsimsel Sağlık',['Kış Bakımı','Tüy Bakımı']],['Yaşlı dostlarda kış','Senior hayvanlarda eklem, kilo ve sıcaklık yönetimi.','Yavru ve Yaşlı Bakımı',['Yaşlı Hayvan Bakımı','Ağrı']]],
      1:[['Ağız kokusu ne anlatır?','Ağız kokusunun yalnızca kozmetik bir sorun olmadığını açıklayın.','Ağız ve Diş Sağlığı',['Ağız Kokusu','Diş Taşı','Diş Eti']],['Evde diş bakımına başlangıç','Diş fırçalama ve uygun ürün seçimini sade adımlarla anlatın.','Ağız ve Diş Sağlığı',['Diş Taşı','Ağız Kokusu']],['Kış yürüyüşü güvenliği','Soğuk havada süre, kıyafet ve pati kontrolü.','Mevsimsel Sağlık',['Köpek Gezdirme','Kış Bakımı']],['Kedilerde stres belirtileri','Ev değişikliği ve rutin bozulmasında dikkat edilecek işaretler.','Davranış',['Stres','Davranış']]],
      2:[['İlkbahar parazit planı','İç-dış parazit uygulamalarının neden düzenli olması gerektiği.','Koruyucu Sağlık',['İç Parazit','Dış Parazit','Kene']],['Mevsimsel tüy dökülmesi','Normal tüy dökülmesi ile deri hastalığını ayıran işaretler.','Mevsimsel Sağlık',['Tüy Bakımı','Deri Sağlığı']],['Mikroçip neden önemli?','Kimliklendirme, kayıp hayvan ve seyahat süreçlerini anlatın.','Koruyucu Sağlık',['Mikroçip','Pasaport','Seyahat']],['Bahar alerjileri','Kaşıntı ve deri belirtilerinde ne zaman muayene gerektiği.','İç Hastalıkları',['Alerji','Deri Sağlığı']]],
      3:[['Yavru kedi ilk ziyaret','İlk muayene, aşı ve parazit planını tek rehberde toplayın.','Yavru ve Yaşlı Bakımı',['Yavru Kedi','Aşı Takvimi','İç Parazit']],['Yavru köpek ilk ziyaret','Beslenme, aşılama ve sosyalizasyonun ilk adımları.','Yavru ve Yaşlı Bakımı',['Yavru Köpek','Aşı Takvimi']],['Seyahat öncesi pasaport','Mikroçip, kuduz aşısı ve belge sürecini açıklayın.','Koruyucu Sağlık',['Pasaport','Kuduz Aşısı','Seyahat']],['Kene çıkarırken hatalar','Evde müdahale risklerini ve doğru başvuru yolunu anlatın.','Acil Durumlar',['Kene','İlk Yardım']]],
      4:[['Sıcak çarpmasına hazırlık','Yaz başlamadan risk grupları ve erken önlemler.','Mevsimsel Sağlık',['Sıcak Çarpması','Yaz Bakımı','Acil Belirti']],['Kene korumasında hatalar','Ürün seçimi ve düzenli uygulamanın önemini anlatın.','Koruyucu Sağlık',['Kene','Dış Parazit']],['Yaz seyahati kontrol listesi','Araç içi güvenlik, su ve mola planı.','Beslenme ve Günlük Bakım',['Seyahat','Su Tüketimi']],['Kulak enfeksiyonunda işaretler','Baş sallama, koku ve akıntının önemini anlatın.','İç Hastalıkları',['Kulak Sağlığı','Ağrı']]],
      5:[['Evcil hayvanla güvenli yolculuk','Taşıma çantası, mola ve sıcaklık yönetimi.','Beslenme ve Günlük Bakım',['Seyahat','Kedi Taşıma']],['Yazın su tüketimi','Susuzluk belirtileri ve su tüketimini artırma yolları.','Beslenme ve Günlük Bakım',['Su Tüketimi','Yaz Bakımı']],['Sıcak zeminde pati yanığı','Asfalt sıcaklığını kontrol etme ve ilk adımlar.','Acil Durumlar',['Sıcak Çarpması','İlk Yardım']],['Tatil öncesi sağlık kontrolü','Aşı, parazit ve ilaç planının gözden geçirilmesi.','Koruyucu Sağlık',['Check-up','Seyahat']]],
      6:[['Sıcak çarpması acil rehberi','Belirtiler, ilk yardım ve kliniğe ulaşana kadar yapılacaklar.','Acil Durumlar',['Sıcak Çarpması','İlk Yardım','Acil Belirti']],['Yaz iştahsızlığı','Hangi durumda normal, hangi durumda hastalık belirtisi olabilir?','İç Hastalıkları',['İştahsızlık','Yaz Bakımı']],['Kedilerde serinleme','Ev içinde güvenli serin alanlar ve su tüketimi.','Beslenme ve Günlük Bakım',['Kedi','Su Tüketimi','Yaz Bakımı']],['Köpeklerde sıcak yürüyüş riski','Yürüyüş saatleri ve nefes darlığı belirtileri.','Mevsimsel Sağlık',['Köpek Gezdirme','Solunum','Sıcak Çarpması']]],
      7:[['Yavru ve yetişkin aşıları','Yaşa göre aşılama ve hatırlatma dozlarını sadeleştirin.','Koruyucu Sağlık',['Aşı Takvimi','Hatırlatma Dozu']],['Yazın kulak sorunları','Nem, yüzme ve kulak enfeksiyonu ilişkisi.','İç Hastalıkları',['Kulak Sağlığı','Yaz Bakımı']],['Deri ve mantar belirtileri','Tüy dökülmesi, kızarıklık ve kaşıntıda başvuru zamanı.','İç Hastalıkları',['Deri Sağlığı','Mantar','Alerji']],['Konaklama öncesi hazırlık','Aşı, mama ve rutin bilgilerinin hazırlanması.','Beslenme ve Günlük Bakım',['Konaklama','Aşı']]],
      8:[['Sonbahar check-up','Mevsim geçişinde kilo, deri ve genel sağlık kontrolü.','Koruyucu Sağlık',['Check-up','Mevsim Geçişi']],['Kış öncesi kilo kontrolü','Obezite riskini ve ideal kilo takibini anlatın.','Beslenme ve Günlük Bakım',['Kilo Kontrolü','Obezite']],['Tüy dökülmesi mi hastalık mı?','Mevsimsel değişim ile deri hastalığını ayıran belirtiler.','Mevsimsel Sağlık',['Tüy Bakımı','Deri Sağlığı']],['Yaşlı dostlarda eklem sağlığı','Hareket azalması ve ağrı belirtileri.','Yavru ve Yaşlı Bakımı',['Yaşlı Hayvan Bakımı','Fizik Tedavi','Ağrı']]],
      9:[['Sorumlu hayvan sahipliği','Koruyucu hekimlik, kimliklendirme ve düzenli takip.','Koruyucu Sağlık',['Mikroçip','Aşı','Kontrol Muayenesi']],['Evde ağız bakımına başlangıç','Kedi ve köpeklerde doğru diş bakım rutini.','Ağız ve Diş Sağlığı',['Diş Taşı','Ağız Kokusu']],['Kısırlaştırma öncesi hazırlık','Açlık, tahlil ve randevu sürecini açıklayın.','Cerrahi ve Operasyonlar',['Kısırlaştırma','Ameliyat Öncesi','Anestezi']],['Sonbaharda parazit riski','Havalar serinlerken korumanın neden bitmediği.','Koruyucu Sağlık',['Dış Parazit','Kene']]],
      10:[['Diyabet belirtileri','Su içme, idrar ve kilo değişiminde dikkat edilecekler.','İç Hastalıkları',['Diyabet','Kan Tahlili']],['Yaşlı hayvan kontrol planı','Senior dostlarda muayene ve tahlil sıklığı.','Yavru ve Yaşlı Bakımı',['Yaşlı Hayvan Bakımı','Check-up']],['Kışa girerken deri bakımı','Kuruluk, kepek ve kaşıntı yönetimi.','Mevsimsel Sağlık',['Deri Sağlığı','Kış Bakımı']],['İdrar yolu belirtileri','Sık idrar, zorlanma ve acil başvuru işaretleri.','İç Hastalıkları',['İdrar Yolu','İdrar Analizi','Acil Belirti']]],
      11:[['Yılbaşı ev güvenliği','Süsler, yiyecekler ve gürültünün oluşturduğu riskler.','Mevsimsel Sağlık',['Zehirlenme','Stres','Kış Bakımı']],['Soğuk havada yaşlı dostlar','Eklem ağrısı ve sıcak alan düzenlemesi.','Yavru ve Yaşlı Bakımı',['Yaşlı Hayvan Bakımı','Ağrı']],['Çikolata zehirlenmesi','Belirtiler ve acil başvurunun önemini anlatın.','Acil Durumlar',['Zehirlenme','Acil Belirti']],['Yeni yıl sağlık planı','Aşı, parazit ve kontrol tarihlerini planlama önerisi.','Koruyucu Sağlık',['Aşı Takvimi','Kontrol Muayenesi']]]
    };
    return (all[month]||[]).map(([title,summary,category,tags])=>({title,summary,category,tags,species:'Kedi ve Köpek',content:`## ${title}\n\n${summary}\n\n## Nelere dikkat edilmeli?\n\n- Belirtileri ve günlük değişiklikleri takip edin.\n- İnternetten ilaç uygulamak yerine veteriner hekime danışın.\n- Acil belirtilerde beklemeden kliniğe ulaşın.\n\n> Bu içerik genel bilgilendirme amaçlıdır; muayene ve tanının yerini tutmaz.`}));
  }

  const APPOINTMENT_STATUS={new:['Yeni','status-new'],callback:['Aranacak','status-callback'],contacted:['Görüşüldü','status-contacted'],confirmed:['Randevu oluşturuldu','status-confirmed'],arrived:['Kliniğe geldi','status-arrived'],completed:['Tamamlandı','status-completed'],cancelled:['İptal','status-cancelled'],archived:['Arşiv','status-archived']};
  async function appointmentApi(method='GET',body){const token=await state.user?.jwt?.();const response=await fetch('/.netlify/functions/appointments',{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:body?JSON.stringify(body):undefined});let data={};try{data=await response.json();}catch{}if(!response.ok)throw new Error(data.error||'Randevu işlemi tamamlanamadı');return data;}
  async function renderAppointments(){await fetchAppointments();main.innerHTML=`<header class="page-head"><div><span class="kicker">GÜVENLİ KLİNİK VERİSİ</span><h1>Randevular</h1><p>Web sitesinden gelen talepleri arayın, durumunu güncelleyin ve klinik içi not ekleyin. Randevu bilgileri GitHub’a yazılmaz.</p></div><div class="page-actions"><button class="button" id="exportAppointments"><i class="fa-solid fa-file-csv"></i> CSV dışa aktar</button></div></header>
      <section class="appointment-stats">${appointmentMetric('countNew','Yeni talepler')}${appointmentMetric('countCallback','Aranacak')}${appointmentMetric('countConfirmed','Randevu oluşturuldu')}${appointmentMetric('countToday','Bugün talep edilen')}${appointmentMetric('countTotal','Toplam kayıt')}</section>
      <div class="toolbar"><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="appointmentSearch" placeholder="İsim, telefon, hayvan veya hizmet ara…"></div><select id="appointmentStatus"><option value="">Tüm durumlar</option>${Object.entries(APPOINTMENT_STATUS).map(([v,[l]])=>`<option value="${v}">${l}</option>`).join('')}</select><input id="appointmentDate" type="date" style="height:44px;border:1px solid var(--line);border-radius:14px;padding:0 12px"><select id="appointmentService"><option value="">Tüm hizmetler</option></select></div><div class="appointment-list" id="appointmentList"></div>`;buildAppointmentServiceFilter();['appointmentSearch','appointmentStatus','appointmentDate','appointmentService'].forEach(id=>$(`#${id}`).addEventListener('input',renderAppointmentList));$('#exportAppointments').addEventListener('click',exportAppointments);renderAppointmentList();}
  function appointmentMetric(id,label){return`<article class="metric-card"><span class="metric-icon"><i class="fa-solid fa-calendar-check"></i></span><div><strong id="${id}">0</strong><span>${label}</span></div></article>`;}
  function buildAppointmentServiceFilter(){const select=$('#appointmentService');unique(state.appointments.map(x=>x.service)).sort((a,b)=>a.localeCompare(b,'tr')).forEach(v=>select.insertAdjacentHTML('beforeend',`<option value="${attr(v)}">${esc(v)}</option>`));}
  function filteredAppointments(){const q=normalize($('#appointmentSearch')?.value),status=$('#appointmentStatus')?.value,date=$('#appointmentDate')?.value,service=$('#appointmentService')?.value;return state.appointments.filter(x=>(!status||x.status===status)&&(!date||x.requestedDate===date)&&(!service||x.service===service)&&(!q||normalize([x.ownerName,x.phone,x.email,x.petName,x.species,x.breed,x.service,x.note].join(' ')).includes(q)));}
  function renderAppointmentList(){const today=new Date().toISOString().slice(0,10);$('#countNew').textContent=state.appointments.filter(x=>x.status==='new').length;$('#countCallback').textContent=state.appointments.filter(x=>x.status==='callback').length;$('#countConfirmed').textContent=state.appointments.filter(x=>x.status==='confirmed').length;$('#countToday').textContent=state.appointments.filter(x=>x.requestedDate===today).length;$('#countTotal').textContent=state.appointments.length;const rows=filteredAppointments();$('#appointmentList').innerHTML=rows.length?rows.map(appointmentCard).join(''):emptyState('fa-calendar-xmark','Randevu bulunamadı','Arama veya filtre seçiminizi değiştirin.');$$('.appointment-card').forEach(card=>{const id=card.dataset.id;card.querySelector('[data-toggle-appointment]').addEventListener('click',()=>card.classList.toggle('open'));card.querySelector('[data-appointment-status]').addEventListener('change',e=>updateAppointment(id,{status:e.target.value}));card.querySelector('[data-save-note]').addEventListener('click',()=>updateAppointment(id,{internalNote:card.querySelector('textarea').value}));card.querySelector('[data-archive-appointment]').addEventListener('click',()=>updateAppointment(id,{status:'archived'}));});}
  function appointmentCard(item){const [label,cls]=APPOINTMENT_STATUS[item.status]||APPOINTMENT_STATUS.new;return`<article class="appointment-card ${item.status==='new'?'is-new':''}" data-id="${attr(item.id)}"><div class="appointment-summary"><div><h3>${esc(item.petName||'İsimsiz')} — ${esc(item.ownerName||'Hasta sahibi')}</h3><p>${esc(item.species||'Tür belirtilmedi')} · ${esc(item.service||'Hizmet belirtilmedi')}</p></div><div><span class="appointment-label">Talep tarihi</span><span class="appointment-value">${esc(formatDate(item.requestedDate))}</span></div><div><span class="appointment-label">Saat</span><span class="appointment-value">${esc(item.requestedTime||'—')}</span></div><div><span class="status ${cls}">${esc(label)}</span><br><button type="button" class="button" data-toggle-appointment>Detayları aç</button></div></div><div class="appointment-details"><div class="details-grid"><div class="detail-box"><span class="appointment-label">Telefon</span><a class="appointment-value" href="tel:${attr(item.phone||'')}">${esc(item.phone||'—')}</a></div><div class="detail-box"><span class="appointment-label">E-posta</span><span class="appointment-value">${esc(item.email||'—')}</span></div><div class="detail-box"><span class="appointment-label">Hayvan</span><span class="appointment-value">${esc([item.species,item.age,item.breed].filter(Boolean).join(' · ')||'—')}</span></div><div class="detail-box"><span class="appointment-label">Başvuru zamanı</span><span class="appointment-value">${esc(formatDate(item.createdAt,true))}</span></div>${item.note?`<div class="detail-box wide"><span class="appointment-label">Hasta sahibi notu</span><span class="appointment-value">${esc(item.note)}</span></div>`:''}</div><div class="field note-wrap"><label>Klinik içi not</label><textarea rows="3">${esc(item.internalNote||'')}</textarea></div><div class="appointment-actions"><a class="button primary" href="tel:${attr(item.phone||'')}"><i class="fa-solid fa-phone"></i> Ara</a><select data-appointment-status>${Object.entries(APPOINTMENT_STATUS).map(([v,[l]])=>`<option value="${v}" ${item.status===v?'selected':''}>${esc(l)}</option>`).join('')}</select><button class="button" data-save-note>Notu kaydet</button><button class="button" data-archive-appointment>Arşivle</button></div></div></article>`;}
  async function updateAppointment(id,changes){try{const data=await appointmentApi('PATCH',{id,...changes});const i=state.appointments.findIndex(x=>x.id===id);if(i>=0)state.appointments[i]=data.appointment;renderAppointmentList();toast('Randevu güncellendi');}catch(error){toast('Randevu güncellenemedi',error.message,'error');}}
  function exportAppointments(){const rows=filteredAppointments();if(!rows.length){toast('Kayıt yok','Dışa aktarılacak randevu bulunamadı.','warning');return;}const cols=[['createdAt','Başvuru zamanı'],['status','Durum'],['ownerName','Hasta sahibi'],['phone','Telefon'],['email','E-posta'],['petName','Hayvan adı'],['species','Tür'],['service','Hizmet'],['requestedDate','Tarih'],['requestedTime','Saat'],['internalNote','Klinik notu']],quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;const csv='\ufeff'+[cols.map(([,l])=>quote(l)).join(';'),...rows.map(r=>cols.map(([k])=>quote(r[k])).join(';'))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`elci-randevular-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);}

  async function listMediaRecursive(path='assets/img/uploads',depth=0){let rows=[];try{const items=await listDirectory(path);for(const item of items){if(item.type==='file'&&/\.(png|jpe?g|webp|gif|svg)$/i.test(item.name))rows.push(item);else if(item.type==='dir'&&depth<2)rows.push(...await listMediaRecursive(item.path,depth+1));}}catch{}return rows;}
  async function renderMedia(){const key=`media:${state.branch}`;let files=state.cache.get(key);if(!files){files=await listMediaRecursive();state.cache.set(key,files);}main.innerHTML=`<header class="page-head"><div><span class="kicker">GÖRSEL ARŞİVİ</span><h1>Görseller</h1><p>Blog, Instagram ve başarı hikâyelerinde kullanılan görselleri görün. Yeni görselleri ilgili içerik düzenleme ekranından yüklemek en hızlı yöntemdir.</p></div><div class="page-actions"><button class="button primary" id="generalUpload"><i class="fa-solid fa-upload"></i> Genel görsel yükle</button></div></header><div class="toolbar"><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="mediaSearch" placeholder="Dosya adında ara…"></div></div><div class="media-grid" id="mediaGrid"></div>`;const render=()=>{const q=normalize($('#mediaSearch').value),rows=files.filter(x=>!q||normalize(x.name).includes(q));$('#mediaGrid').innerHTML=rows.length?rows.map(file=>`<article class="media-card"><img src="/${attr(file.path)}" alt="" loading="lazy"><div><strong title="${attr(file.name)}">${esc(file.name)}</strong><small>${Math.round((file.size||0)/1024)} KB</small><div class="button-row" style="margin-top:7px"><button class="button" data-copy-media="/${attr(file.path)}">Yolu kopyala</button></div></div></article>`).join(''):emptyState('fa-image','Görsel bulunamadı','Arama metnini değiştirin.');$$('[data-copy-media]').forEach(btn=>btn.addEventListener('click',async()=>{await navigator.clipboard.writeText(btn.dataset.copyMedia);toast('Görsel yolu kopyalandı');}));};$('#mediaSearch').addEventListener('input',render);render();$('#generalUpload').addEventListener('click',()=>{state.pendingImage={field:'__general',folder:'assets/img/uploads/genel'};hiddenFileInput.value='';hiddenFileInput.click();});}

  async function renderArchive(){const names=Object.keys(COLLECTIONS),groups=await Promise.all(names.map(async name=>({name,items:await listCollection(name)})));const rows=groups.flatMap(group=>group.items.filter(x=>x.archived||x.trashed).map(item=>({name:group.name,item})));main.innerHTML=`<header class="page-head"><div><span class="kicker">GERİ ALINABİLİR İŞLEMLER</span><h1>Arşiv ve çöp kutusu</h1><p>Arşivlenen içerikler panelde korunur. Çöp kutusundaki kayıtlar geri alınabilir veya bilinçli olarak kalıcı silinebilir.</p></div></header><div class="toolbar"><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="archiveSearch" placeholder="Arşivde ara…"></div><select id="archiveType"><option value="">Tüm bölümler</option>${names.map(n=>`<option value="${n}">${esc(COLLECTIONS[n].label)}</option>`).join('')}</select><select id="archiveStatus"><option value="">Arşiv ve çöp</option><option value="archived">Yalnızca arşiv</option><option value="trash">Yalnızca çöp kutusu</option></select></div><div class="content-list" id="archiveList"></div>`;const render=()=>{const q=normalize($('#archiveSearch').value),type=$('#archiveType').value,status=$('#archiveStatus').value;const filtered=rows.filter(r=>(!type||r.name===type)&&(!status||(status==='archived'&&r.item.archived)||(status==='trash'&&r.item.trashed))&&(!q||normalize([collectionTitle(r.name,r.item),collectionDescription(r.name,r.item)]).includes(q)));$('#archiveList').innerHTML=filtered.length?filtered.map(({name,item})=>`<article class="content-card"><div><h3>${esc(collectionTitle(name,item))}</h3><p>${esc(COLLECTIONS[name].label)} · ${item.trashed?'Çöp kutusunda':'Arşivde'}</p></div><div class="card-actions"><button class="button success" data-archive-restore="${attr(name)}|${attr(item._slug)}">Geri yükle</button><a class="button" href="#edit/${name}/${encodeURIComponent(item._slug)}">İncele</a>${item.trashed?`<button class="button danger" data-permanent-delete="${attr(name)}|${attr(item._slug)}">Kalıcı sil</button>`:''}</div></article>`).join(''):emptyState('fa-box-open','Arşiv boş','Arşivlenen veya çöp kutusuna taşınan içerik burada görünür.');$$('[data-archive-restore]').forEach(btn=>btn.addEventListener('click',()=>archiveRestore(...btn.dataset.archiveRestore.split('|'))));$$('[data-permanent-delete]').forEach(btn=>btn.addEventListener('click',()=>permanentDelete(...btn.dataset.permanentDelete.split('|'))));};['archiveSearch','archiveType','archiveStatus'].forEach(id=>$(`#${id}`).addEventListener('input',render));render();}
  async function archiveRestore(name,slug){const item=(await listCollection(name)).find(x=>x._slug===slug);if(!item)return;const data=clone(item);['_path','_sha','_slug'].forEach(k=>delete data[k]);data.archived=false;data.trashed=false;data.published=false;try{await writeJson(item._path,data,`Panel: arşivden geri alındı — ${collectionTitle(name,item)}`,item._sha);clearCollection(name);toast('İçerik geri alındı','Yayında değil durumunda listeye taşındı.');await renderArchive();}catch(error){toast('Geri alınamadı',error.message,'error');}}
  async function permanentDelete(name,slug){const item=(await listCollection(name)).find(x=>x._slug===slug);if(!item||!item.trashed)return;if(!confirm(`“${collectionTitle(name,item)}” kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`))return;try{await backupSave(item._path,item,item._sha,'Kalıcı silme öncesi son yedek');await deleteRaw(item._path,`Panel: kalıcı silindi — ${collectionTitle(name,item)}`,item._sha);clearCollection(name);toast('İçerik kalıcı olarak silindi');await renderArchive();}catch(error){toast('Silinemedi',error.message,'error');}}

  async function renderSettings(){let backupCount='—';try{const token=await state.user?.jwt?.();const r=await fetch('/.netlify/functions/admin-backups?summary=1',{headers:token?{Authorization:`Bearer ${token}`}:{},cache:'no-store'});if(r.ok)backupCount=(await r.json()).count;}catch{}main.innerHTML=`<header class="page-head"><div><span class="kicker">SİSTEM KONTROLÜ</span><h1>Ayarlar ve güvenlik</h1><p>Ziyaretçi sitesinin tasarımı donduruldu. Bu merkez yalnızca içerik, randevu ve güvenli yönetim katmanını günceller.</p></div></header><section class="dashboard-grid"><div class="panel padded"><h2>Yayın ortamı</h2><div class="security-list" style="margin-top:14px">${securityRow('fa-code-branch','İçerik dalı',state.branch,state.branch==='main'?'Canlı içerik dalı':'Test dalı; canlı site içeriğine yazmaz')}${securityRow('fa-user-shield','Yetkili hesap',state.user?.email||'—','Netlify Identity ile doğrulandı')}${securityRow('fa-clock-rotate-left','Otomatik içerik yedekleri',String(backupCount),'Değişiklik öncesi sürümler özel yedek deposunda saklanır')}${securityRow('fa-database','Randevu deposu','Netlify Blobs','Kişisel veriler GitHub ve açık JSON dosyalarına yazılmaz')}</div></div><div class="panel padded"><h2>Kurulum kontrol listesi</h2><div class="security-list" style="margin-top:14px">${securityRow('fa-lock','Identity kayıt ayarı','Invite only','Yalnızca davet edilen kullanıcılar')}${securityRow('fa-user-tag','Yetkilendirme','ADMIN_EMAILS','Netlify ortam değişkenine yetkili e-posta yazılmalı')}${securityRow('fa-envelope','Randevu bildirimi','E-posta sağlayıcısı','Kurulum belgesindeki değişkenler girilmeli')}${securityRow('fa-shield-halved','KVKK uygulaması','Teknik temel hazır','Saklama ve imha süreleri hukukçu ile doğrulanmalı')}</div></div></section><section class="panel padded" style="margin-top:16px"><h2>Panel çalışma sınırı</h2><p style="color:var(--muted);font-size:.72rem;line-height:1.7">Ziyaretçi sitesinin tasarım dosyaları bu panelden değiştirilmez. Panel yalnızca onaylanmış içerik kaynaklarını, yayın planını ve güvenli randevu kayıtlarını yönetir. Böylece günlük içerik işlemleri sitenin görünümünü bozmaz.</p></section>`;}
  function securityRow(icon,title,value,text){return`<div class="security-row"><i class="fa-solid ${icon}"></i><div><strong>${esc(title)}</strong><small>${esc(text)}</small></div><span class="tag">${esc(value)}</span></div>`;}


  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');
    if(!link||!state.dirty)return;
    if(!confirm('Kaydedilmemiş değişiklikler var. Bu sayfadan ayrılmak istiyor musunuz?'))event.preventDefault();
    else state.dirty=false;
  });
  window.addEventListener('beforeunload',event=>{if(!state.dirty)return;event.preventDefault();event.returnValue='';});

  $('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#loginButton').addEventListener('click',()=>window.netlifyIdentity?.open('login'));
  $('#logoutButton').addEventListener('click',()=>window.netlifyIdentity?.logout());
  window.addEventListener('hashchange',()=>state.user&&router());

  async function showApp(user){state.user=user;$('#userEmail').textContent=user?.email||'';loginScreen.classList.add('hidden');adminApp.classList.remove('hidden');await loadRuntime();state.gatewayReady=true;if(!location.hash)location.hash='#dashboard';else router();}
  function showLogin(){state.user=null;adminApp.classList.add('hidden');loginScreen.classList.remove('hidden');}
  if(window.netlifyIdentity){window.netlifyIdentity.on('init',user=>user?showApp(user):showLogin());window.netlifyIdentity.on('login',user=>{window.netlifyIdentity.close();showApp(user);});window.netlifyIdentity.on('logout',showLogin);window.netlifyIdentity.init();}else{showLogin();toast('Giriş sistemi yüklenemedi','Netlify Identity ayarlarını kontrol edin.','error');}
})();
