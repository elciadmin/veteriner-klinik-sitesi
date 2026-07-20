import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const NOW = Date.now();

const paths = {
  blog: path.join(ROOT, 'content', 'blog'),
  faq: path.join(ROOT, 'content', 'faq'),
  reviews: path.join(ROOT, 'content', 'reviews'),
  instagram: path.join(ROOT, 'content', 'instagram'),
  services: path.join(ROOT, 'assets', 'data', 'services.json'),
  legacyInstagram: path.join(ROOT, 'assets', 'data', 'instagram.json'),
  homeBlog: path.join(ROOT, 'settings', 'home-blog.json'),
  homeAnnouncements: path.join(ROOT, 'settings', 'home-announcements.json'),
  homeFaq: path.join(ROOT, 'settings', 'home-faq.json'),
  homeReviews: path.join(ROOT, 'settings', 'home-reviews.json'),
  site: path.join(ROOT, 'settings', 'site.json'),
  pages: path.join(ROOT, 'settings', 'pages.json'),
  successStories: path.join(ROOT, 'settings', 'success-stories.json'),
};

const excludedTop = new Set([
  '.git', '.github', '.netlify', 'dist', 'node_modules', '_ELCI_YEDEK',
  'content', 'settings', 'scripts', 'netlify',
  'package.json', 'package-lock.json', 'netlify.toml',
]);


const SAFE_DEPLOY_SEGMENT = /^[A-Za-z0-9._-]+$/;

async function validateDeployableNames(source, relative = '') {
  const entries = await fs.readdir(source, { withFileTypes: true });
  const invalid = [];
  for (const entry of entries) {
    if (!relative && excludedTop.has(entry.name)) continue;
    if (entry.name.endsWith('.zip')) continue;
    const rel = path.join(relative, entry.name);
    if (!SAFE_DEPLOY_SEGMENT.test(entry.name)) invalid.push(rel);
    if (entry.isDirectory()) invalid.push(...await validateDeployableNames(path.join(source, entry.name), rel));
  }
  return invalid;
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

const slugify = value => String(value || '')
  .toLocaleLowerCase('tr-TR')
  .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
  .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'icerik';

function uniqueStrings(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [values])
    .flatMap(value => String(value ?? '').split(','))
    .map(value => value.trim())
    .filter(value => value && !seen.has(value.toLocaleLowerCase('tr-TR')) && seen.add(value.toLocaleLowerCase('tr-TR')));
}

function localPublicPath(value) {
  const raw = String(value || '').trim();
  if (!raw || /^(https?:|data:|blob:)/i.test(raw)) return raw;
  return raw.startsWith('/') ? raw : `/${raw}`;
}

async function existingPublicAsset(value) {
  const publicPath = localPublicPath(value);
  if (!publicPath || /^(https?:|data:|blob:)/i.test(publicPath)) return publicPath;
  const candidate = path.join(ROOT, publicPath.replace(/^\/+/, ''));
  try {
    const stat = await fs.stat(candidate);
    return stat.isFile() ? publicPath : '';
  } catch {
    return '';
  }
}

function normalizeOrder(items) {
  return [...items]
    .sort((a,b) => (Number(a.order)||9999) - (Number(b.order)||9999) || String(a.title||'').localeCompare(String(b.title||''),'tr'))
    .map((item,index) => ({ ...item, order:index+1 }));
}

function inlineMarkup(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function renderRichText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/<(p|h2|h3|h4|ul|ol|li|strong|em|blockquote|img|a)\b/i.test(raw)) return raw;
  return raw.replace(/\r/g, '').split(/\n{2,}/).map(block => {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) return '';
    if (lines.every(line => line.startsWith('- '))) {
      return `<ul>${lines.map(line => `<li>${inlineMarkup(line.slice(2))}</li>`).join('')}</ul>`;
    }
    if (lines[0].startsWith('### ')) return `<h3>${inlineMarkup(lines.join(' ').slice(4))}</h3>`;
    if (lines[0].startsWith('## ')) return `<h2>${inlineMarkup(lines.join(' ').slice(3))}</h2>`;
    return `<p>${inlineMarkup(lines.join(' '))}</p>`;
  }).join('');
}

async function readJson(file, fallback, required = false) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (required) throw new Error(`Geçersiz veya okunamayan JSON: ${path.relative(ROOT, file)}\n${error.message}`);
    return fallback;
  }
}

async function readJsonFolder(folder) {
  await fs.mkdir(folder, { recursive: true });
  const names = (await fs.readdir(folder)).filter(name => name.endsWith('.json')).sort();
  const entries = [];
  for (const name of names) {
    const file = path.join(folder, name);
    const data = await readJson(file, null, true);
    entries.push({ slug: name.replace(/\.json$/i, ''), file: name, data });
  }
  return entries;
}

async function copyTree(source, target, relative = '') {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (!relative && excludedTop.has(entry.name)) continue;
    if (entry.name.endsWith('.zip')) continue;
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) await copyTree(src, dst, path.join(relative, entry.name));
    else await fs.copyFile(src, dst);
  }
}

async function writeDistJson(relative, data) {
  const target = path.join(DIST, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2), 'utf8');
}

function selectedSlugs(settings, key) {
  const items = Array.isArray(settings?.items) ? settings.items : [];
  const seen = new Set();
  return items.map(item => typeof item === 'string' ? item : item?.[key])
    .filter(slug => slug && !seen.has(slug) && seen.add(slug));
}

function isPublic(status, date) {
  const normalized = String(status || 'published').toLowerCase();
  if (!['published', 'scheduled'].includes(normalized)) return false;
  const time = date ? new Date(date).getTime() : 0;
  return !Number.isFinite(time) || !time || time <= NOW;
}

async function buildServices() {
  const raw = await readJson(paths.services, null, true);
  if (!Array.isArray(raw?.items)) throw new Error('assets/data/services.json içinde items listesi bulunamadı.');
  const mapped = raw.items.map((item, index) => {
    const id = slugify(item.id || item.title);
    const status = String(item.status || (item.published === false ? 'archived' : 'published')).toLowerCase();
    return {
      id,
      title: String(item.title || 'Hizmet'),
      summary: String(item.summary || ''),
      detail: String(item.detail || item.summary || ''),
      icon: String(item.icon || '#i-stethoscope'),
      faIcon: String(item.faIcon || ''),
      href: String(item.href || `/hizmetler.html#${id}`),
      group: String(item.group || 'Diğer Hizmetler'),
      status,
      published: item.published !== false && !['draft','archived'].includes(status),
      showOnHome: item.showOnHome === true,
      order: Number(item.order) || index + 1,
    };
  }).filter(item => item.id !== 'egzotik');
  const duplicateIds = mapped.map(item=>item.id).filter((id,index,list)=>list.indexOf(id)!==index);
  if (duplicateIds.length) throw new Error(`Hizmetlerde yinelenen kimlik bulundu: ${[...new Set(duplicateIds)].join(', ')}`);
  const items = normalizeOrder(mapped);
  const result = { ...raw, homeLimit: 6, items };
  await writeDistJson('assets/data/services.json', result);
  return result;
}

async function buildBlog() {
  const [entries, homeBlog, homeAnnouncements] = await Promise.all([
    readJsonFolder(paths.blog),
    readJson(paths.homeBlog, { items: [] }, true),
    readJson(paths.homeAnnouncements, { items: [] }, true),
  ]);
  const selectedBlog = selectedSlugs(homeBlog, 'blog').slice(0, 6);
  const selectedAnnouncements = selectedSlugs(homeAnnouncements, 'announcement').slice(0, 3);
  const blogOrder = new Map(selectedBlog.map((slug, i) => [slug, i + 1]));
  const announcementOrder = new Map(selectedAnnouncements.map((slug, i) => [slug, i + 1]));

  const posts = await Promise.all(entries.map(async ({ slug: entrySlug, file, data }) => {
    const advanced = data.advanced || {};
    const slug = String(advanced.slug || data.slug || '').trim() || slugify(data.title);
    const date = data.date || data.scheduledAt || new Date().toISOString();
    const categories = uniqueStrings([
      ...(Array.isArray(data.categories) ? data.categories : []),
      ...(Array.isArray(data.customCategories) ? data.customCategories : []),
      data.category || '',
    ]);
    const status = data.status || (data.published === false ? 'draft' : 'published');
    const contentType = data.contentType === 'announcement' ? 'announcement' : 'blog';
    const content = renderRichText(data.content || '');
    const words = String(content.replace(/<[^>]+>/g, ' ')).trim().split(/\s+/).filter(Boolean).length;
    return {
      title: data.title || '', slug, date, scheduledAt: date, status, contentType,
      published: isPublic(status, date), summary: data.summary || '', cover: await existingPublicAsset(data.cover),
      youtubeId: advanced.youtubeId || data.youtubeId || '',
      category: categories[0] || 'Genel Sağlık', categories: categories.length ? categories : ['Genel Sağlık'],
      species: data.species || 'Genel', tags: uniqueStrings(data.tags || []),
      author: data.author || advanced.author || 'Elçi Veteriner Kliniği',
      readingMinutes: Math.max(1, Math.ceil(words / 190)),
      seoTitle: advanced.seoTitle || data.seoTitle || data.title || '',
      seoDescription: advanced.seoDescription || data.seoDescription || data.summary || '',
      url: `/blog.html#${encodeURIComponent(slug)}`, content,
      cmsEntry: entrySlug, sourceFile: file,
      showOnHome: contentType === 'blog' ? blogOrder.has(entrySlug) : announcementOrder.has(entrySlug),
      homeOrder: contentType === 'blog' ? (blogOrder.get(entrySlug) || null) : (announcementOrder.get(entrySlug) || null),
      dateLabel: new Date(date).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' }),
    };
  }));
  posts.sort((a,b) => new Date(b.date) - new Date(a.date));

  await writeDistJson('assets/data/blog.json', { posts });
  await writeDistJson('assets/data/home-blog.json', posts.filter(p => p.published && p.contentType === 'blog' && p.showOnHome).sort((a,b) => a.homeOrder - b.homeOrder).slice(0,6));
  await writeDistJson('assets/data/announcements.json', posts.filter(p => p.published && p.contentType === 'announcement' && p.showOnHome).sort((a,b) => a.homeOrder - b.homeOrder).slice(0,3));
  return posts;
}

async function buildFaq() {
  const [entries, home] = await Promise.all([
    readJsonFolder(paths.faq),
    readJson(paths.homeFaq, { items: [] }, true),
  ]);
  const selected = selectedSlugs(home, 'faq').slice(0,6);
  const homeOrder = new Map(selected.map((slug,i) => [slug,i+1]));
  const categoryOrder = ['Randevu ve Acil','Ücret ve Ödeme','Muayene ve Laboratuvar','Aşı ve Koruyucu Sağlık','Operasyonlar ve Anestezi','Ağız ve Diş Sağlığı','Bakım ve Beslenme','Konaklama ve Klinik Süreç'];
  const categoryRank = new Map(categoryOrder.map((name,index)=>[name,index]));
  const items = entries.map(({slug,data}) => {
    const status = data.status || (data.published === false ? 'draft' : 'published');
    return {
      id: slug, q: data.title || data.q || '', a: data.answer || data.a || '',
      category: data.category || 'Muayene ve Laboratuvar', status,
      published: status === 'published', showOnHome: homeOrder.has(slug),
      homeOrder: homeOrder.get(slug) || null, cmsEntry: slug,
    };
  }).sort((a,b) => (categoryRank.get(a.category) ?? 999) - (categoryRank.get(b.category) ?? 999) || a.q.localeCompare(b.q,'tr'));
  await writeDistJson('assets/data/faq.json', { title:'Sık Sorulan Sorular', items });
  await writeDistJson('assets/data/home-faq.json', items.filter(i => i.published && i.showOnHome).sort((a,b)=>a.homeOrder-b.homeOrder).slice(0,6));
  return items;
}

async function buildReviews() {
  const [entries, settings] = await Promise.all([
    readJsonFolder(paths.reviews),
    readJson(paths.homeReviews, { totalCount:0, items:[] }, true),
  ]);
  const selected = selectedSlugs(settings,'review').slice(0,6);
  const homeOrder = new Map(selected.map((slug,i)=>[slug,i+1]));
  const all = entries.map(({slug,data}) => {
    const status = data.status || (data.published === false ? 'draft' : 'published');
    return {
      id:slug, title:data.title || '', author:data.author || 'Google kullanıcısı',
      rating:Math.max(1,Math.min(5,Number(data.rating)||5)), time:data.time || '',
      text:data.text || '', sourceUrl:data.sourceUrl || '', status,
      published:status === 'published', showOnHome:homeOrder.has(slug),
      homeOrder:homeOrder.get(slug)||null, cmsEntry:slug,
    };
  });
  const home = all.filter(r=>r.published && r.showOnHome).sort((a,b)=>a.homeOrder-b.homeOrder).slice(0,6);
  await writeDistJson('assets/data/reviews.json', all.filter(r=>r.published));
  await writeDistJson('assets/data/home-reviews.json', home);
  return { all, home, totalCount:Math.max(0,Number(settings.totalCount)||0) };
}

async function buildInstagram() {
  const entries = await readJsonFolder(paths.instagram);
  const manual = entries.map(({slug,data}) => ({
    id:slug, title:data.title || '', date:data.date || '', image:data.image || '',
    alt:data.alt || data.title || 'Elçi Veteriner Kliniği galeri görseli',
    instagramUrl:data.instagramUrl || '', status:data.status || 'published',
    published:(data.status || 'published') === 'published',
  })).filter(i=>i.published && i.image).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const legacy = await readJson(paths.legacyInstagram, []);
  const fallback = Array.isArray(legacy) ? legacy.map((item,index)=>({
    id:`legacy-${index+1}`, title:'Elçi Veteriner Kliniği', date:'',
    image:`/assets/img/insta/${item.file}`, alt:'Elçi Veteriner Kliniği Instagram paylaşımı',
    instagramUrl:'https://www.instagram.com/elcivetklinik/', published:true,
  })) : [];
  const output = manual.length ? manual : fallback;
  await writeDistJson('assets/data/instagram-manual.json', output);
  return output;
}

async function buildSuccessStories(){
  const data=await readJson(paths.successStories,{stories:[]},true);
  const stories=Array.isArray(data?.stories)?data.stories:[];
  await writeDistJson('assets/data/basari_hikayeleri.json',stories);
  return stories;
}

async function buildSettings(reviewResult) {
  const [site,pages] = await Promise.all([
    readJson(paths.site, null, true), readJson(paths.pages, {}, true),
  ]);
  const merged = { ...site, googleReviewsTotal: reviewResult.totalCount };
  await writeDistJson('assets/data/site-settings.json', merged);
  await writeDistJson('assets/data/pages.json', pages);
  return merged;
}

const invalidDeployNames = await validateDeployableNames(ROOT);
if (invalidDeployNames.length) {
  throw new Error(`Netlify ile uyumsuz dosya adı bulundu:
${invalidDeployNames.map(name => `- ${name}`).join('\n')}
Dosya adlarında yalnızca İngilizce harf, rakam, nokta, tire ve alt çizgi kullanın.`);
}

await fs.rm(DIST, { recursive:true, force:true });
await copyTree(ROOT, DIST);
const [services, posts, faq, reviews, instagram, successStories] = await Promise.all([
  buildServices(), buildBlog(), buildFaq(), buildReviews(), buildInstagram(), buildSuccessStories(),
]);
const site = await buildSettings(reviews);
await writeDistJson('assets/data/content-manifest.json', {
  generatedAt:new Date().toISOString(), ok:true,
  serviceCount:services.items.filter(i=>i.published).length,
  publishedBlogCount:posts.filter(i=>i.published && i.contentType==='blog').length,
  announcementCount:posts.filter(i=>i.published && i.contentType==='announcement').length,
  faqCount:faq.filter(i=>i.published).length,
  reviewCount:reviews.all.filter(i=>i.published).length,
  presentedReviewCount:reviews.home.length,
  instagramCount:instagram.length,
  successStoryCount:successStories.length,
  clinicName:site.clinicName,
});

const invalidDistNames = await validateDeployableNames(DIST);
if (invalidDistNames.length) {
  throw new Error(`Üretilen dist klasöründe Netlify ile uyumsuz dosya adı bulundu:
${invalidDistNames.map(name=>`- ${name}`).join('\n')}`);
}

const requiredOutputs = [
  'index.html','about.html','hizmetler.html','blog.html','sss.html','hasta-iliskileri.html',
  'admin/index.html','admin/cms.html','assets/data/services.json','assets/data/blog.json',
  'assets/data/faq.json','assets/data/reviews.json','assets/data/content-manifest.json'
];
for (const relative of requiredOutputs) {
  try { await fs.access(path.join(DIST,relative)); }
  catch { throw new Error(`Zorunlu çıktı üretilemedi: ${relative}`); }
}

console.log('Elçi Yönetim Merkezi: JSON kaynakları, dosya adları ve zorunlu çıktılar doğrulandı.');
