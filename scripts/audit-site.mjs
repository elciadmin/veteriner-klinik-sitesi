import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const errors = [];
const notes = [];
const SAFE_SEGMENT = /^[^\u0000-\u001F/\\]+$/;
const TEST_BRANCH = 'elci-yonetim-v3-test';

const rel = (file, base = ROOT) => path.relative(base, file).split(path.sep).join('/');
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function walk(dir) {
  if (!await exists(dir)) return [];
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else files.push(file);
  }
  return files;
}
async function read(file) { return fs.readFile(file, 'utf8'); }
async function json(file) {
  try { return JSON.parse(await read(file)); }
  catch (error) { errors.push(`JSON hatası: ${rel(file)} — ${error.message}`); return null; }
}
function unique(values) { return new Set(values).size === values.length; }
function publicItem(item) { return item?.published !== false && !['draft', 'archived'].includes(String(item?.status || '').toLowerCase()); }
function fail(condition, message) { if (condition) errors.push(message); }

// Build output and Netlify-safe names.
fail(!await exists(DIST), 'dist klasörü yok; önce npm run build çalıştırılmalı.');
for (const base of [ROOT, DIST]) {
  if (!await exists(base)) continue;
  for (const file of await walk(base)) {
    const relative = rel(file, base);
    if (base === ROOT && /^(?:dist|node_modules|\.git|_ELCI_YEDEK)\//.test(relative)) continue;
    if (relative.split('/').some(segment => !SAFE_SEGMENT.test(segment))) errors.push(`Netlify uyumsuz dosya adı: ${relative}`);
  }
}

// All canonical JSON must parse in source and dist.
for (const base of [path.join(ROOT, 'assets/data'), path.join(DIST, 'assets/data')]) {
  for (const file of (await walk(base)).filter(file => file.endsWith('.json'))) await json(file);
}

// JavaScript syntax checks for source code that ships or runs during build.
const syntaxRoots = [path.join(ROOT, 'admin'), path.join(ROOT, 'assets/js'), path.join(ROOT, 'scripts'), path.join(ROOT, 'netlify')];
for (const file of (await Promise.all(syntaxRoots.map(walk))).flat().filter(file => /\.(?:js|mjs)$/.test(file))) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
  catch (error) { errors.push(`JavaScript söz dizimi hatası: ${rel(file)} — ${String(error.stderr || error.message).trim()}`); }
}

// Canonical services source and both consumers.
const services = await json(path.join(ROOT, 'assets/data/services.json'));
if (services) {
  const items = Array.isArray(services.items) ? services.items : [];
  const ids = items.map(item => String(item.id || ''));
  const orders = items.map(item => Number(item.order)).filter(Number.isFinite);
  fail(!items.length, 'services.json içinde hizmet yok.');
  fail(ids.some(id => !id), 'Boş hizmet kimliği var.');
  fail(!unique(ids), 'Hizmet kimlikleri benzersiz değil.');
  fail(!unique(orders), 'Hizmet sıra numaraları benzersiz değil.');
  fail(items.some(item => Object.hasOwn(item, 'homeFeatured')), 'Eski homeFeatured alanı services.json içinde kalmış.');
  const active = items.filter(publicItem);
  const home = active.filter(item => item.showOnHome);
  fail(active.length < 6, 'Yayındaki hizmet sayısı 6’dan az.');
  fail(home.length < 1 || home.length > 6, 'Ana sayfa hizmet seçimi 1–6 arasında olmalı.');
  notes.push(`Hizmet: ${active.length} yayında, ${home.length} ana sayfada.`);
}
for (const page of ['index.html', 'hizmetler.html']) {
  const source = await read(path.join(ROOT, page));
  fail(!source.includes('/assets/js/services-sync.js'), `${page}: ortak services-sync.js bağlantısı yok.`);
}
const servicesSync = await read(path.join(ROOT, 'assets/js/services-sync.js'));
fail((servicesSync.match(/assets\/data\/services\.json/g) || []).length !== 1, 'services-sync.js tek bir services.json kaynağı kullanmalı.');
fail(!servicesSync.includes('renderHome(data)') || !servicesSync.includes('renderServicesPage(data)'), 'services-sync.js hem ana sayfayı hem Hizmetler sayfasını güncellemiyor.');

// Blog + announcement data and editorial blocks.
const blog = await json(path.join(ROOT, 'assets/data/blog.json'));
if (blog) {
  const posts = Array.isArray(blog.posts) ? blog.posts : [];
  const slugs = posts.map(post => String(post.slug || ''));
  fail(!posts.length, 'blog.json içinde içerik yok.');
  fail(slugs.some(slug => !slug) || !unique(slugs), 'Blog bağlantı adları boş veya yineleniyor.');
  fail(posts.some(post => !['blog', 'announcement'].includes(post.contentType)), 'Blog içeriğinde geçersiz contentType var.');
  const published = posts.filter(publicItem);
  fail(!published.some(post => post.contentType === 'blog'), 'Yayında blog yazısı yok.');
  fail(!published.some(post => post.contentType === 'announcement'), 'Yayında duyuru yok.');
  fail(published.some(post => !Array.isArray(post.blocks) || !post.blocks.length), 'Yayındaki her blog/duyuru en az bir editoryal blok içermeli.');
  fail(posts.some(post => (post.blocks || []).some(block => !['text', 'image', 'quote'].includes(block.type))), 'Geçersiz blog blok türü var.');
  const homeBlog = published.filter(post => post.contentType === 'blog' && post.showOnHome);
  const homeAnnouncements = published.filter(post => post.contentType === 'announcement' && post.showOnHome);
  fail(homeBlog.length > 6, 'Ana sayfada 6’dan fazla blog seçilmiş.');
  fail(homeAnnouncements.length > 3, 'Ana sayfada 3’ten fazla duyuru seçilmiş.');
  notes.push(`Blog/duyuru: ${published.length} yayında; ${homeBlog.length} blog ve ${homeAnnouncements.length} duyuru ana sayfada.`);
}
const blogJs = await read(path.join(ROOT, 'assets/js/blog.js'));
fail(!blogJs.includes('renderEditorialBlocks'), 'Blog detaylarında editoryal blok rendererı eksik.');
fail(!blogJs.includes("block.type==='image'") || !blogJs.includes("block.type==='quote'"), 'Blog detay rendererı metin–görsel–alıntı bloklarını kapsamıyor.');

// Remaining managed datasets.
const faq = await json(path.join(ROOT, 'assets/data/faq.json'));
fail(!Array.isArray(faq?.items), 'faq.json items listesi eksik.');
const reviews = await json(path.join(ROOT, 'assets/data/reviews.json'));
fail(!Array.isArray(reviews), 'reviews.json liste değil.');
const instagram = await json(path.join(ROOT, 'assets/data/instagram.json'));
fail(!Array.isArray(instagram), 'instagram.json liste değil.');
const stories = await json(path.join(ROOT, 'assets/data/successStories.json'));
fail(!Array.isArray(stories?.stories), 'successStories.json stories listesi eksik.');
const calendar = await json(path.join(ROOT, 'assets/data/calendar.json'));
fail(!Array.isArray(calendar?.events), 'calendar.json events listesi eksik.');
const pages = await json(path.join(ROOT, 'assets/data/pages.json'));
fail(!Array.isArray(pages?.items), 'pages.json items listesi eksik.');
const settings = await json(path.join(ROOT, 'assets/data/site-settings.json'));
fail(!settings?.brand || !settings?.contact, 'site-settings.json brand/contact yapısı eksik.');

// Unified admin only, safe test branch, all requested modules.
const adminIndex = await read(path.join(ROOT, 'admin/index.html'));
const adminApp = await read(path.join(ROOT, 'admin/app.js'));
fail(!adminIndex.includes('Elçi Yönetim Merkezi') || !adminIndex.includes('/admin/app.js'), 'Birleşik mor Elçi Yönetim Merkezi yüklenmiyor.');
for (const legacy of ['decap-cms', 'dashboard.js', 'appointments.js']) fail(adminIndex.toLowerCase().includes(legacy), `admin/index.html eski arayüz bağımlılığı içeriyor: ${legacy}`);
for (const route of ['appointments','calendar','blog','faq','reviews','instagram','services','pages','settings','stories','archive']) fail(!adminIndex.includes(`data-route="${route}"`), `Yönetim menüsünde ${route} bölümü eksik.`);
for (const token of ['blogBlocksEditor', "calendarView: 'month'", 'data-calendar-view="week"', 'showOnHome', 'APPOINTMENTS_API']) fail(!adminApp.includes(token), `Yönetim işlevi eksik: ${token}`);
fail(adminApp.includes('homeFeatured') || adminApp.includes('iconClass'), 'Yönetim uygulamasında eski hizmet alanları kalmış.');
fail(!adminApp.includes(`RUNTIME.branch || '${TEST_BRANCH}'`), 'Yönetim panelinin güvenli test dalı varsayılanı eksik.');
const runtimeSource = await read(path.join(ROOT, 'admin/runtime-config.js'));
fail(!runtimeSource.includes(`branch: '${TEST_BRANCH}'`), 'Kaynak runtime-config test dalına kilitli değil.');
for (const [file, target] of [['cms.html','#blog'],['calendar.html','#calendar'],['randevular.html','#appointments']]) {
  const source = await read(path.join(ROOT, 'admin', file));
  fail(!source.includes(`/admin/${target}`), `${file} birleşik panele yönlenmiyor.`);
}

// Common visual standard on every public top-level page.
for (const file of (await fs.readdir(ROOT)).filter(name => name.endsWith('.html') && !['contact.html','test-form.html'].includes(name))) {
  const source = await read(path.join(ROOT, file));
  fail(!source.includes('/assets/css/site-standard.css'), `${file}: ortak renk/ölçü/yazı/hero standardı CSS’i eksik.`);
  fail(!source.includes('/assets/js/site-standard.js'), `${file}: ortak animasyon ve yönetilen içerik betiği eksik.`);
}
const standardCss = await read(path.join(ROOT, 'assets/css/site-standard.css'));
for (const token of ['--elci-motion-duration:', '--elci-hero-line-width:', 'editorial-image-wide']) fail(!standardCss.includes(token), `Ortak CSS standardı eksik: ${token}`);
fail(/\.s-card[^\n{]*\{[^}]*\b(?:width|height|min-height|max-height)\s*:/s.test(standardCss), 'Ortak CSS hizmet kartı geometrisini değiştirmemeli.');

// Local links/assets in the built output.
if (await exists(DIST)) {
  const redirects = new Set();
  const redirectsFile = path.join(DIST, '_redirects');
  if (await exists(redirectsFile)) {
    for (const line of (await read(redirectsFile)).split(/\r?\n/)) {
      const route = line.trim().split(/\s+/)[0]; if (route?.startsWith('/')) redirects.add(route);
    }
  }
  const htmlFiles = (await walk(DIST)).filter(file => file.endsWith('.html'));
  const attr = /\b(?:href|src|action)=(["'])(.*?)\1/gi;
  for (const file of htmlFiles) {
    const source = await read(file); let match;
    while ((match = attr.exec(source))) {
      const raw = match[2].trim();
      if (!raw || raw.includes('${') || /^(?:#|https?:|\/\/|mailto:|tel:|javascript:|data:|blob:)/i.test(raw)) continue;
      const cleanRaw = raw.split('#')[0].split('?')[0]; if (!cleanRaw) continue;
      let target;
      try {
        target = cleanRaw.startsWith('/') ? path.join(DIST, decodeURIComponent(cleanRaw.replace(/^\/+/, ''))) : path.resolve(path.dirname(file), decodeURIComponent(cleanRaw));
      } catch { target = cleanRaw.startsWith('/') ? path.join(DIST, cleanRaw.replace(/^\/+/, '')) : path.resolve(path.dirname(file), cleanRaw); }
      const candidates = [target];
      if (cleanRaw.endsWith('/')) candidates.push(path.join(target, 'index.html'));
      if (!path.extname(target)) candidates.push(`${target}.html`, path.join(target, 'index.html'));
      const route = cleanRaw.startsWith('/') ? cleanRaw : '';
      if (route && redirects.has(route)) continue;
      if (!(await Promise.all(candidates.map(exists))).some(Boolean)) errors.push(`Kırık yerel bağlantı: ${rel(file, DIST)} -> ${raw}`);
    }
  }

  const runtime = await read(path.join(DIST, 'admin/runtime-config.js'));
  fail(!runtime.includes(`"branch": "${TEST_BRANCH}"`), 'Build çıktısındaki yönetim runtime dalı test dalı değil.');
  const manifest = await json(path.join(DIST, 'assets/data/content-manifest.json'));
  fail(manifest?.ok !== true, 'Build içerik manifesti başarılı değil.');
  notes.push(`Build manifesti: ${manifest?.serviceCount ?? 0} hizmet, ${manifest?.publishedBlogCount ?? 0} blog, ${manifest?.announcementCount ?? 0} duyuru.`);
}

// Netlify build contract and dependencies.
const netlifyToml = await read(path.join(ROOT, 'netlify.toml'));
for (const token of ['command = "npm run build"', 'publish = "dist"', 'functions = "netlify/functions"', 'node_bundler = "esbuild"']) fail(!netlifyToml.includes(token), `netlify.toml eksik: ${token}`);
const pkg = await json(path.join(ROOT, 'package.json'));
for (const dependency of ['@netlify/blobs', '@netlify/identity']) fail(!pkg?.dependencies?.[dependency], `Eksik bağımlılık: ${dependency}`);
fail(!await exists(path.join(ROOT, 'package-lock.json')), 'Tekrarlanabilir kurulum için package-lock.json eksik.');

if (errors.length) {
  console.error(`\nAUDIT BAŞARISIZ (${errors.length})\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exit(1);
}
console.log('AUDIT BAŞARILI');
for (const note of notes) console.log(`- ${note}`);
