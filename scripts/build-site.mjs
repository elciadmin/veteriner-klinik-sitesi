import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const NOW = Date.now();
const SAFE_DEPLOY_SEGMENT = /^[A-Za-z0-9._-]+$/;
const excludedTop = new Set([
  '.git', '.github', '.netlify', 'dist', 'node_modules', '_ELCI_YEDEK',
  'content', 'settings', 'scripts', 'netlify',
  'package.json', 'package-lock.json', 'netlify.toml',
]);

const dataPath = name => path.join(ROOT, 'assets', 'data', name);
const distDataPath = name => path.join(DIST, 'assets', 'data', name);
const text = value => String(value ?? '').trim();
const statusOf = item => text(item?.status || (item?.published === false ? 'draft' : 'published')).toLowerCase();
const futureDate = value => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) && time > NOW;
};
const isPublic = item => {
  const status = statusOf(item);
  if (status === 'published') return true;
  if (status === 'scheduled') return !futureDate(item.scheduledAt || item.date);
  return false;
};
const slugify = value => text(value).toLocaleLowerCase('tr-TR')
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
  .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'icerik';

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (fallback !== null) return fallback;
    throw new Error(`Geçersiz veya okunamayan JSON: ${path.relative(ROOT, file)}\n${error.message}`);
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

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

async function copyTree(source, target, relative = '') {
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (!relative && excludedTop.has(entry.name)) continue;
    if (entry.name.endsWith('.zip')) continue;
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) await copyTree(src, dst, path.join(relative, entry.name));
    else await fs.copyFile(src, dst);
  }
}

function normalizeOrder(items) {
  return [...items]
    .sort((a, b) => (Number(a.order) || 9999) - (Number(b.order) || 9999) || text(a.title).localeCompare(text(b.title), 'tr'))
    .map((item, index) => ({ ...item, order: index + 1 }));
}

function readingMinutes(post) {
  const blockText = Array.isArray(post.blocks)
    ? post.blocks.map(block => block?.html || block?.text || block?.caption || '').join(' ')
    : '';
  const content = `${post.content || ''} ${blockText}`.replace(/<[^>]+>/g, ' ');
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 190));
}

async function buildServices() {
  const raw = await readJson(dataPath('services.json'));
  if (!Array.isArray(raw?.items)) throw new Error('assets/data/services.json içinde items listesi bulunamadı.');
  const seen = new Set();
  const items = normalizeOrder(raw.items.map((source, index) => {
    const id = slugify(source.id || source.title);
    if (seen.has(id)) throw new Error(`Hizmet kimliği yineleniyor: ${id}`);
    seen.add(id);
    const status = statusOf(source);
    return {
      ...source,
      id,
      title: text(source.title) || 'Hizmet',
      summary: text(source.summary),
      detail: text(source.detail || source.summary),
      icon: text(source.icon) || '#i-stethoscope',
      faIcon: text(source.faIcon || source.iconClass),
      href: text(source.href) || `/hizmetler.html#${id}`,
      group: text(source.group) || 'Diğer Hizmetler',
      status,
      published: !['draft', 'archived'].includes(status),
      showOnHome: source.showOnHome === true,
      order: Number(source.order) || index + 1,
    };
  }).filter(item => item.id !== 'egzotik'));
  const result = { ...raw, homeLimit: 6, items };
  await writeJson(distDataPath('services.json'), result);
  return result;
}

async function buildBlog() {
  const raw = await readJson(dataPath('blog.json'));
  if (!Array.isArray(raw?.posts)) throw new Error('assets/data/blog.json içinde posts listesi bulunamadı.');
  const seen = new Set();
  const posts = raw.posts.map(source => {
    const slug = slugify(source.slug || source.id || source.title);
    if (seen.has(slug)) throw new Error(`Blog bağlantı adı yineleniyor: ${slug}`);
    seen.add(slug);
    const status = statusOf(source);
    const date = source.date || source.scheduledAt || new Date().toISOString();
    const category = text(source.category || source.categories?.[0]) || 'Genel Sağlık';
    const categories = Array.isArray(source.categories) && source.categories.length ? source.categories.map(text).filter(Boolean) : [category];
    const blocks = Array.isArray(source.blocks) ? source.blocks.filter(block => block && ['text', 'image', 'quote'].includes(block.type)) : [];
    return {
      ...source,
      id: source.id || slug,
      slug,
      title: text(source.title),
      summary: text(source.summary),
      status,
      contentType: source.contentType === 'announcement' ? 'announcement' : 'blog',
      date,
      scheduledAt: source.scheduledAt || date,
      published: isPublic({ ...source, status, date }),
      category,
      categories,
      tags: Array.isArray(source.tags) ? source.tags.map(text).filter(Boolean) : [],
      author: text(source.author) || 'Elçi Veteriner Kliniği',
      cover: text(source.cover),
      content: text(source.content),
      blocks,
      readingMinutes: readingMinutes({ ...source, blocks }),
      seoTitle: text(source.seoTitle || source.title),
      seoDescription: text(source.seoDescription || source.summary),
      url: `/blog.html#${encodeURIComponent(slug)}`,
      dateLabel: new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }),
      showOnHome: source.showOnHome === true,
      homeOrder: Number(source.homeOrder) || null,
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  await writeJson(distDataPath('blog.json'), { posts });
  await writeJson(distDataPath('home-blog.json'), posts
    .filter(post => post.published && post.contentType === 'blog' && post.showOnHome)
    .sort((a, b) => (a.homeOrder || 999) - (b.homeOrder || 999)).slice(0, 6));
  await writeJson(distDataPath('announcements.json'), posts
    .filter(post => post.published && post.contentType === 'announcement' && post.showOnHome)
    .sort((a, b) => (a.homeOrder || 999) - (b.homeOrder || 999)).slice(0, 3));
  return posts;
}

async function buildFaq() {
  const raw = await readJson(dataPath('faq.json'));
  if (!Array.isArray(raw?.items)) throw new Error('assets/data/faq.json içinde items listesi bulunamadı.');
  const seen = new Set();
  const items = raw.items.map(source => {
    const id = slugify(source.id || source.q);
    if (seen.has(id)) throw new Error(`SSS kimliği yineleniyor: ${id}`);
    seen.add(id);
    const status = statusOf(source);
    return {
      ...source, id, q: text(source.q), a: text(source.a), category: text(source.category) || 'Genel',
      status, published: isPublic(source), showOnHome: source.showOnHome === true,
      homeOrder: Number(source.homeOrder) || null,
    };
  });
  await writeJson(distDataPath('faq.json'), { title: raw.title || 'Sık Sorulan Sorular', items });
  await writeJson(distDataPath('home-faq.json'), items.filter(item => item.published && item.showOnHome)
    .sort((a, b) => (a.homeOrder || 999) - (b.homeOrder || 999)).slice(0, 6));
  return items;
}

async function buildReviews() {
  const raw = await readJson(dataPath('reviews.json'));
  if (!Array.isArray(raw)) throw new Error('assets/data/reviews.json bir liste olmalıdır.');
  const seen = new Set();
  const all = raw.map((source, index) => {
    const id = slugify(source.id || `${source.author}-${index + 1}`);
    if (seen.has(id)) throw new Error(`Yorum kimliği yineleniyor: ${id}`);
    seen.add(id);
    const status = statusOf(source);
    return {
      ...source, id, author: text(source.author) || 'Google kullanıcısı',
      rating: Math.max(1, Math.min(5, Number(source.rating) || 5)), text: text(source.text),
      time: text(source.time), sourceUrl: text(source.sourceUrl), status,
      published: isPublic(source), showOnHome: source.showOnHome === true,
      homeOrder: Number(source.homeOrder) || null,
    };
  });
  await writeJson(distDataPath('reviews.json'), all);
  const home = all.filter(item => item.published && item.showOnHome)
    .sort((a, b) => (a.homeOrder || 999) - (b.homeOrder || 999)).slice(0, 6);
  await writeJson(distDataPath('home-reviews.json'), home);
  return { all, home };
}

async function buildInstagram() {
  const raw = await readJson(dataPath('instagram.json'));
  if (!Array.isArray(raw)) throw new Error('assets/data/instagram.json bir liste olmalıdır.');
  const items = raw.map((source, index) => {
    const id = slugify(source.id || `instagram-${index + 1}`);
    const image = text(source.image || (source.file ? `/assets/img/insta/${source.file}` : ''));
    const status = statusOf(source);
    return { ...source, id, image, status, published: isPublic(source), alt: text(source.alt || source.title || 'Elçi Veteriner Kliniği paylaşımı') };
  });
  await writeJson(distDataPath('instagram.json'), items);
  await writeJson(distDataPath('instagram-manual.json'), items.filter(item => item.published && item.image));
  return items;
}

async function buildStories() {
  const raw = await readJson(dataPath('successStories.json'));
  const stories = Array.isArray(raw?.stories) ? raw.stories.map((source, index) => {
    const status = statusOf(source);
    return { ...source, id: slugify(source.id || source.title || `hikaye-${index + 1}`), status, published: isPublic(source) };
  }) : [];
  await writeJson(distDataPath('successStories.json'), { stories });
  await writeJson(distDataPath('basari_hikayeleri.json'), stories.filter(item => item.published));
  return stories;
}

async function buildPagesAndSettings() {
  const [pages, settings, calendar] = await Promise.all([
    readJson(dataPath('pages.json')),
    readJson(dataPath('site-settings.json')),
    readJson(dataPath('calendar.json'), { events: [] }),
  ]);
  if (!Array.isArray(pages?.items)) throw new Error('assets/data/pages.json içinde items listesi bulunamadı.');
  if (!Array.isArray(calendar?.events)) throw new Error('assets/data/calendar.json içinde events listesi bulunamadı.');
  await writeJson(distDataPath('pages.json'), pages);
  await writeJson(distDataPath('site-settings.json'), settings);
  await writeJson(distDataPath('calendar.json'), calendar);
  return { pages, settings, calendar };
}

function localBranch() {
  if (process.env.BRANCH) return process.env.BRANCH;
  try { return execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'elci-yonetim-v3-test'; }
  catch { return 'elci-yonetim-v3-test'; }
}

async function writeRuntimeConfig() {
  const context = process.env.CONTEXT || 'local';
  const branch = localBranch();
  const production = context === 'production' && branch === 'main';
  const config = {
    context,
    branch,
    production,
    deployPreview: context === 'deploy-preview',
    reviewId: process.env.REVIEW_ID || '',
    commitRef: process.env.COMMIT_REF || process.env.HEAD || '',
  };
  const script = `window.ELCI_RUNTIME_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
  await fs.writeFile(path.join(DIST, 'admin', 'runtime-config.js'), script, 'utf8');
  return config;
}

const invalidSourceNames = await validateDeployableNames(ROOT);
if (invalidSourceNames.length) throw new Error(`Netlify ile uyumsuz dosya adı bulundu:\n${invalidSourceNames.map(name => `- ${name}`).join('\n')}`);

await fs.rm(DIST, { recursive: true, force: true });
await copyTree(ROOT, DIST);

const [services, posts, faq, reviews, instagram, stories, common] = await Promise.all([
  buildServices(), buildBlog(), buildFaq(), buildReviews(), buildInstagram(), buildStories(), buildPagesAndSettings(),
]);
const runtime = await writeRuntimeConfig();

await writeJson(distDataPath('content-manifest.json'), {
  generatedAt: new Date().toISOString(), ok: true, branch: runtime.branch, context: runtime.context,
  serviceCount: services.items.filter(item => item.published).length,
  publishedBlogCount: posts.filter(item => item.published && item.contentType === 'blog').length,
  announcementCount: posts.filter(item => item.published && item.contentType === 'announcement').length,
  faqCount: faq.filter(item => item.published).length,
  reviewCount: reviews.all.filter(item => item.published).length,
  presentedReviewCount: reviews.home.length,
  instagramCount: instagram.filter(item => item.published).length,
  successStoryCount: stories.filter(item => item.published).length,
  pageCount: common.pages.items.length,
});

const invalidDistNames = await validateDeployableNames(DIST);
if (invalidDistNames.length) throw new Error(`Üretilen dist klasöründe Netlify ile uyumsuz dosya adı bulundu:\n${invalidDistNames.map(name => `- ${name}`).join('\n')}`);

const requiredOutputs = [
  'index.html', 'about.html', 'hizmetler.html', 'blog.html', 'sss.html', 'hasta-iliskileri.html',
  'admin/index.html', 'admin/runtime-config.js', 'assets/data/services.json', 'assets/data/blog.json',
  'assets/data/faq.json', 'assets/data/reviews.json', 'assets/data/content-manifest.json',
];
for (const relative of requiredOutputs) {
  if (!await exists(path.join(DIST, relative))) throw new Error(`Zorunlu çıktı üretilemedi: ${relative}`);
}

console.log(`Elçi build tamamlandı: ${runtime.branch} (${runtime.context})`);
console.log(`Hizmet ${services.items.filter(item => item.published).length}, blog/duyuru ${posts.filter(item => item.published).length}, SSS ${faq.filter(item => item.published).length}, yorum ${reviews.all.filter(item => item.published).length}.`);
