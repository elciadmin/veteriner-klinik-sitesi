import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const SITE_URL = "https://elciveteriner.com";
const NOW = new Date();

const SOURCES = {
  blog: path.join(ROOT, "content", "blog"),
  faq: path.join(ROOT, "content", "faq"),
  reviews: path.join(ROOT, "content", "reviews"),
  instagram: path.join(ROOT, "content", "instagram"),
  announcements: path.join(ROOT, "content", "announcements"),
  homeFaq: path.join(ROOT, "settings", "home-faq.json"),
  homeReviews: path.join(ROOT, "settings", "home-reviews.json"),
};

const excludedTop = new Set([
  ".git", ".github", ".netlify", "dist", "node_modules",
  "content", "settings", "scripts", "netlify",
  "package.json", "package-lock.json", "netlify.toml",
]);

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));

const escapeAttr = escapeHtml;

const slugify = value => String(value || "")
  .toLocaleLowerCase("tr-TR")
  .replace(/ç/g,"c").replace(/ğ/g,"g").replace(/ı/g,"i")
  .replace(/ö/g,"o").replace(/ş/g,"s").replace(/ü/g,"u")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "icerik";

const stripHtml = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function sanitizeTrustedHtml(value) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function inlineMarkup(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderRichText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/<(p|h2|h3|h4|ul|ol|li|strong|em|blockquote|a)\b/i.test(raw)) {
    return sanitizeTrustedHtml(raw);
  }
  return raw.replace(/\r/g, "").split(/\n{2,}/).map(block => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    if (!lines.length) return "";
    if (lines.every(line => /^[-*] /.test(line))) {
      return `<ul>${lines.map(line => `<li>${inlineMarkup(line.slice(2))}</li>`).join("")}</ul>`;
    }
    if (lines.every(line => /^\d+[.)] /.test(line))) {
      return `<ol>${lines.map(line => `<li>${inlineMarkup(line.replace(/^\d+[.)] /, ""))}</li>`).join("")}</ol>`;
    }
    if (lines[0].startsWith("### ")) return `<h3>${inlineMarkup(lines.join(" ").slice(4))}</h3>`;
    if (lines[0].startsWith("## ")) return `<h2>${inlineMarkup(lines.join(" ").slice(3))}</h2>`;
    if (lines[0].startsWith("> ")) return `<blockquote>${inlineMarkup(lines.join(" ").slice(2))}</blockquote>`;
    return `<p>${inlineMarkup(lines.join(" "))}</p>`;
  }).join("");
}


function renderEditorialSections(sections) {
  if (!Array.isArray(sections) || !sections.length) return "";
  const figureHtml = (image, alt, caption = "", classes = "") => {
    if (!image) return "";
    const cap = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
    return `<figure class="editorial-section editorial-figure${classes}"><img src="${escapeAttr(image)}" alt="${escapeAttr(alt || "Blog görseli")}" loading="lazy" decoding="async" onerror="this.closest('figure').hidden=true">${cap}</figure>`;
  };
  const blocks = sections.map(block => {
    if (!block || typeof block !== "object") return "";
    const type = String(block.type || "").trim();
    if (type === "text" && (block.heading || block.body)) {
      const heading = block.heading ? `<h2 class="editorial-section-title">${escapeHtml(block.heading)}</h2>` : "";
      return `<section class="editorial-section editorial-text">${heading}${renderRichText(block.body || "")}</section>`;
    }
    if (type === "image" && block.image) {
      const compact = block.size === "compact" ? " is-compact" : "";
      const fit = block.fit === "cover" ? " fit-cover" : " fit-contain";
      return figureHtml(block.image, block.alt, block.caption, `${compact}${fit}`);
    }
    if (type === "split") {
      const hasImage = !!block.image;
      const hasCopy = !!String(block.heading || block.body || "").trim();
      if (!hasImage && !hasCopy) return "";
      if (!hasImage) {
        const heading = block.heading ? `<h2 class="editorial-section-title">${escapeHtml(block.heading)}</h2>` : "";
        return `<section class="editorial-section editorial-text">${heading}${renderRichText(block.body || "")}</section>`;
      }
      if (!hasCopy) return figureHtml(block.image, block.alt, "", ` is-compact ${block.fit === "contain" ? "fit-contain" : "fit-cover"}`);
      const side = block.imageSide === "left" ? " image-left" : "";
      const fit = block.fit === "contain" ? " fit-contain" : " fit-cover";
      const heading = block.heading ? `<h2 class="editorial-section-title">${escapeHtml(block.heading)}</h2>` : "";
      return `<section class="editorial-section editorial-split${side}${fit}"><div class="editorial-split-copy">${heading}${renderRichText(block.body || "")}</div><div class="editorial-split-media"><img src="${escapeAttr(block.image)}" alt="${escapeAttr(block.alt || block.heading || "Blog görseli")}" loading="lazy" decoding="async" onerror="this.closest('.editorial-split-media').hidden=true"></div></section>`;
    }
    if (type === "gallery") {
      const images = (Array.isArray(block.images) ? block.images : []).filter(item => item?.image).slice(0,4);
      if (images.length < 2) return images.length === 1 ? figureHtml(images[0].image, images[0].alt, images[0].caption, ` is-compact ${block.fit === "contain" ? "fit-contain" : "fit-cover"}`) : "";
      const layout = ["two","feature"].includes(block.layout) ? ` layout-${block.layout}` : " layout-auto";
      const fit = block.fit === "contain" ? " fit-contain" : " fit-cover";
      return `<section class="editorial-section editorial-gallery count-${images.length}${layout}${fit}">${images.map(item => `<figure><img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.alt || "Blog galerisi görseli")}" loading="lazy" decoding="async" onerror="this.closest('figure').hidden=true">${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}</figure>`).join("")}</section>`;
    }
    if (type === "callout" && (block.heading || block.body)) {
      const tone = ["warning","success"].includes(block.tone) ? ` ${block.tone}` : "";
      const heading = block.heading ? `<h3>${escapeHtml(block.heading)}</h3>` : "";
      return `<aside class="editorial-section editorial-callout${tone}">${heading}${renderRichText(block.body || "")}</aside>`;
    }
    if (type === "steps" && Array.isArray(block.items)) {
      const cleanItems = block.items.map(item => typeof item === "string" ? item : item?.item || "").map(String).map(item => item.trim()).filter(Boolean);
      if (!cleanItems.length) return "";
      const heading = block.heading ? `<h2>${escapeHtml(block.heading)}</h2>` : "";
      const items = cleanItems.map(item => `<li>${escapeHtml(item)}</li>`).join("");
      return `<section class="editorial-section editorial-steps">${heading}<ol>${items}</ol></section>`;
    }
    return "";
  }).filter(Boolean).join("");
  return blocks ? `<div class="editorial-sections">${blocks}</div>` : "";
}

const validDate = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

function isActive(item, at = NOW) {
  if (!item || item.published === false) return false;
  const start = validDate(item.date || item.publishAt || item.scheduledAt);
  const end = validDate(item.unpublishAt);
  if (start && start > at) return false;
  if (end && end <= at) return false;
  return true;
}

function dateLabel(value) {
  const date = validDate(value);
  return date ? date.toLocaleDateString("tr-TR", { day:"2-digit", month:"long", year:"numeric", timeZone:"Europe/Istanbul" }) : "";
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch { return fallback; }
}

async function readJsonFolder(folder) {
  try {
    const names = (await fs.readdir(folder)).filter(name => name.endsWith(".json")).sort();
    const entries = [];
    for (const name of names) {
      entries.push({ slug:name.replace(/\.json$/i, ""), file:name, data:await readJson(path.join(folder, name), {}) });
    }
    return entries;
  } catch { return []; }
}

async function copyTree(source, target, relative = "") {
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (!relative && excludedTop.has(entry.name)) continue;
    if (entry.name.endsWith(".zip")) continue;
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) await copyTree(src, dst, path.join(relative, entry.name));
    else await fs.copyFile(src, dst);
  }
}

async function writeFile(relative, content) {
  const target = path.join(DIST, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

async function writeJson(relative, data) {
  await writeFile(relative, JSON.stringify(data, null, 2));
}

function commonHeader(active = "blog") {
  const nav = [
    ["home", "/", "Ana Sayfa"],
    ["about", "/about", "Hakkımızda"],
    ["services", "/hizmetler.html", "Hizmetlerimiz"],
    ["blog", "/blog.html", "Blog"],
    ["faq", "/sss.html", "SSS"],
    ["patient", "/hasta-iliskileri.html", "Hasta İlişkileri"],
  ].map(([key, href, label]) => `<li><a href="${href}"${key === active ? ' class="active" aria-current="page"' : ""}>${label}</a></li>`).join("");
  return `<header>
    <div class="header-top"><div class="container"><div class="header-contact"><span><i class="fa-solid fa-location-dot"></i> Havzan Mah. Yeni Meram Cad. 17/1 Meram/Konya</span></div><div class="header-contact"><a href="tel:+903323223220"><i class="fa-solid fa-phone"></i> 0332 322 32 20</a><a href="mailto:elcivetklinik@gmail.com"><i class="fa-solid fa-envelope"></i> elcivetklinik@gmail.com</a></div></div></div>
    <div class="header-main"><div class="container"><div class="logo-text"><a class="brand-lockup" href="/" aria-label="Elçi Veteriner Kliniği ana sayfa"><span class="brand-mark"><img src="/assets/img/uploads/elci-logo.png" alt="" width="54" height="54"></span><span class="brand-copy"><strong>Elçi Veteriner Kliniği</strong><span class="signature-tagline header-signature">Sağlığın Elçi’leriyiz</span></span></a></div><nav aria-label="Birincil"><button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Menüyü aç veya kapat" aria-expanded="false" aria-controls="mainMenu"><i class="fa-solid fa-bars"></i></button><ul id="mainMenu">${nav}</ul></nav></div></div>
  </header>`;
}

function commonFooter() {
  return `<footer class="footer-new"><div class="container footer-container"><div class="footer-col"><h3>Elçi Veteriner Kliniği</h3><p>Meram/Konya'da kedi ve köpekler için anlaşılır bilgilendirme, planlı klinik süreç ve düzenli takip.</p></div><div class="footer-col"><h3>Hızlı bağlantılar</h3><ul class="footer-links"><li><a href="/hizmetler.html">Hizmetlerimiz</a></li><li><a href="/blog.html">Blog</a></li><li><a href="/sss.html">Sık Sorulan Sorular</a></li><li><a href="/hasta-iliskileri.html#online-randevu">Online Randevu</a></li></ul></div><div class="footer-col"><h3>İletişim</h3><ul class="footer-contact"><li><a href="tel:+903323223220">0332 322 32 20</a></li><li><a href="mailto:elcivetklinik@gmail.com">elcivetklinik@gmail.com</a></li><li>Her gün 09.00–21.00</li></ul></div></div><div class="footer-bottom"><div class="container">© <span id="yil"></span> Elçi Veteriner Kliniği · <a href="/kvkk.html">KVKK Aydınlatma Metni</a></div></div></footer>`;
}

function blogPage(post) {
  const active = isActive(post);
  const robots = active ? "index,follow,max-image-preview:large" : "noindex,nofollow,noarchive";
  const cover = post.cover || "/assets/img/uploads/elci-logo.png";
  const content = post.content || (post.contentMode === "visual" ? "" : `<p>${escapeHtml(post.summary)}</p>`);
  const schema = active ? `<script type="application/ld+json">${JSON.stringify({
    "@context":"https://schema.org", "@type":"BlogPosting", headline:post.title,
    description:post.seoDescription || post.summary, image:`${SITE_URL}${cover}`,
    datePublished:post.date, dateModified:post.updatedAt || post.date,
    author:{"@type":"Organization",name:post.author || "Elçi Veteriner Kliniği"},
    publisher:{"@type":"Organization",name:"Elçi Veteriner Kliniği",logo:{"@type":"ImageObject",url:`${SITE_URL}/assets/img/uploads/elci-logo.png`}},
    mainEntityOfPage:`${SITE_URL}${post.url}`
  }).replace(/</g, "\\u003c")}</script>` : "";

  return `<!doctype html><html lang="tr"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(post.seoTitle || `${post.title} | Elçi Veteriner Kliniği`)}</title>
    <meta name="description" content="${escapeAttr(post.seoDescription || post.summary)}"><meta name="robots" content="${robots}">
    <link rel="canonical" href="${SITE_URL}${post.url}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeAttr(post.title)}"><meta property="og:description" content="${escapeAttr(post.summary)}"><meta property="og:image" content="${SITE_URL}${escapeAttr(cover)}">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"><link rel="stylesheet" href="/assets/css/tokens.css"><link rel="stylesheet" href="/assets/css/styles.css"><link rel="stylesheet" href="/assets/css/elci-system.css?v=20260721-2"><link rel="stylesheet" href="/assets/css/elci-fixes-v33.css?v=20260721-1"><link rel="stylesheet" href="/assets/css/elci-fixes-v34.css?v=20260721-1"><link rel="stylesheet" href="/assets/css/elci-final-v35.css?v=20260723-54">
    ${schema}
  </head><body class="blog-article-page" data-content-mode="${escapeAttr(post.contentMode || "standard")}" data-runtime-active="${active}" data-publish-at="${escapeAttr(post.date)}" data-unpublish-at="${escapeAttr(post.unpublishAt || "")}">
    ${commonHeader("blog")}<div id="siteAnnouncement" class="site-announcement" hidden></div>
    <main class="blog-article-shell">
      <div class="blog-not-active" id="blogInactive"><h1>Bu yazı şu anda yayında değil.</h1><p>Yazı henüz yayınlanmamış veya yayın süresi sona ermiş olabilir.</p><a class="btn primary" href="/blog.html">Bloga dön</a></div>
      <article class="blog-article" id="blogArticle">
        <header class="blog-article-header"><span class="blog-article-kicker"><i class="fa-regular fa-file-lines"></i> Elçi sağlık notları</span><h1>${escapeHtml(post.title)}</h1><div class="blog-article-meta"><span><i class="fa-solid fa-layer-group"></i> ${escapeHtml(post.category)}</span><span><i class="fa-regular fa-calendar"></i> ${escapeHtml(post.dateLabel)}</span><span><i class="fa-regular fa-user"></i> ${escapeHtml(post.author)}</span></div></header><div class="blog-article-cover"><img src="${escapeAttr(cover)}" alt="${escapeAttr(post.title)}" onerror="this.src='/assets/img/uploads/elci-logo.png'"></div>
        <div class="blog-article-content">${content}${post.editorialHtml || ""}<div class="blog-article-note"><strong>Bilgilendirme:</strong> Bu içerik genel bilgi amaçlıdır; muayene, tanı ve hastaya özel tedavi planının yerini tutmaz. Acil bir durumda form beklemeden kliniğimizi arayın.</div></div>
        <footer class="blog-article-actions"><a class="btn" href="/blog.html"><i class="fa-solid fa-arrow-left"></i> Tüm yazılar</a><a class="btn primary" href="/hasta-iliskileri.html#online-randevu"><i class="fa-solid fa-calendar-check"></i> Randevu talebi</a></footer>
      </article>
    </main>${commonFooter()}<script src="/assets/js/elci-system.js" defer></script>
    <script>(()=>{const body=document.body,article=document.getElementById('blogArticle'),inactive=document.getElementById('blogInactive');function update(){const now=Date.now(),start=Date.parse(body.dataset.publishAt||''),end=Date.parse(body.dataset.unpublishAt||''),live=(!Number.isFinite(start)||start<=now)&&(!Number.isFinite(end)||end>now);body.dataset.runtimeActive=String(live);article.hidden=!live;inactive.hidden=live;const next=[start,end].filter(value=>Number.isFinite(value)&&value>now).sort((a,b)=>a-b)[0];if(next)setTimeout(update,Math.min(next-now+250,2147483647));}update();})();</script>
  </body></html>`;
}

async function buildBlog() {
  const entries = await readJsonFolder(SOURCES.blog);
  const posts = entries.map(({ slug:entrySlug, file, data }) => {
    const advanced = data.advanced || {};
    const slug = String(advanced.slug || "").trim() || slugify(data.title);
    const date = data.date || new Date().toISOString();
    const rawContent = data.content || "";
    const contentMode = ["standard","visual"].includes(data.contentMode)
      ? data.contentMode
      : (Array.isArray(data.editorialSections) && data.editorialSections.length && !String(rawContent).trim() ? "visual" : "standard");
    return {
      title:data.title || "", slug, date, scheduledAt:date, unpublishAt:data.unpublishAt || "",
      published:data.published !== false, active:isActive({ published:data.published !== false, date, unpublishAt:data.unpublishAt || "" }), featured:data.featured === true, summary:data.summary || "", cover:data.cover || "",
      youtubeId:advanced.youtubeId || "", category:data.category || "Klinik Duyuruları", categories:[data.category || "Klinik Duyuruları"],
      species:data.species || "Genel", tags:Array.isArray(data.tags) ? data.tags : [], relatedService:data.relatedService || "",
      author:advanced.author || "Elçi Veteriner Kliniği",
      seoTitle:advanced.seoTitle || data.title || "", seoDescription:advanced.seoDescription || data.summary || "",
      url:`/blog/${encodeURIComponent(slug)}.html`, contentMode, content:contentMode === "visual" ? "" : renderRichText(rawContent), editorialHtml:contentMode === "visual" ? renderEditorialSections(data.editorialSections) : "", cmsEntry:entrySlug, sourceFile:file,
      dateLabel:dateLabel(date), updatedAt:data.updatedAt || date,
    };
  }).sort((a,b) => new Date(b.date) - new Date(a.date));
  await writeJson("assets/data/blog.json", { posts });
  for (const post of posts.filter(post => post.published !== false)) await writeFile(`blog/${post.slug}.html`, blogPage(post));
  return posts;
}

async function buildFaq() {
  const entries = await readJsonFolder(SOURCES.faq);
  const home = await readJson(SOURCES.homeFaq, { items:[] });
  const selected = (home?.items || []).map(item => typeof item === "string" ? item : item?.faq).filter(Boolean).slice(0, 6);
  const order = new Map(selected.map((slug,index) => [slug,index+1]));
  const items = entries.map(({slug,data}) => ({
    id:slug, q:data.title || "", a:data.answer || "", category:data.category || "Muayene ve Laboratuvar",
    published:data.published !== false, showOnHome:order.has(slug), homeOrder:order.get(slug) || null, cmsEntry:slug,
  })).sort((a,b) => a.category === b.category ? a.q.localeCompare(b.q,"tr") : a.category.localeCompare(b.category,"tr"));
  await writeJson("assets/data/faq.json", { title:"Sık Sorulan Sorular", items });
  return items;
}

async function buildReviews() {
  const entries = await readJsonFolder(SOURCES.reviews);
  const legacy = await readJson(path.join(ROOT,"assets","data","reviews.json"), []);
  const settings = await readJson(SOURCES.homeReviews, { totalCount:194, items:[] });
  const map = new Map(entries.map(entry => [entry.slug, entry.data]));
  let selected = (settings?.items || []).map(item => typeof item === "string" ? item : item?.review).filter(Boolean);
  let reviews = selected.map(slug => ({ slug, data:map.get(slug) })).filter(item => item.data && item.data.published !== false).map(({slug,data}) => ({
    author:data.author || "Google kullanıcısı", rating:Math.max(1,Math.min(5,Number(data.rating)||5)), time:data.time || "", text:data.text || "", sourceUrl:data.sourceUrl || "", cmsEntry:slug,
  }));
  if (!reviews.length) reviews = (Array.isArray(legacy) ? legacy : []).slice(0, 12);
  await writeJson("assets/data/reviews.json", reviews);
  await writeJson("assets/data/site-settings.json", { totalGoogleReviews:Math.max(0,Number(settings?.totalCount)||0) });
  return reviews;
}

async function buildInstagram() {
  const entries = await readJsonFolder(SOURCES.instagram);
  const allItems = entries.map(({slug,data}) => ({
    id:slug, published:data.published !== false, title:data.title || "", date:data.date || "", unpublishAt:data.unpublishAt || "",
    image:data.image || "", alt:data.alt || data.title || "Elçi Veteriner Kliniği galeri görseli", instagramUrl:data.instagramUrl || "", cmsEntry:slug,
  }));
  const visibleItems = allItems.filter(item => item.image && isActive(item)).sort((a,b) => new Date(b.date||0)-new Date(a.date||0));
  await writeJson("assets/data/instagram-manual.json", visibleItems);
  return allItems;
}

async function buildAnnouncements() {
  const entries = await readJsonFolder(SOURCES.announcements);
  const items = entries.map(({slug,data}) => ({
    id:slug, published:data.published !== false, showOnHome:data.showOnHome !== false, title:data.title || "", message:data.message || "",
    level:data.level || "info", linkLabel:data.linkLabel || "", linkUrl:data.linkUrl || "", publishAt:data.publishAt || "", unpublishAt:data.unpublishAt || "",
    priority:Number(data.priority || 0), dismissible:data.dismissible !== false, cmsEntry:slug,
  }));
  await writeJson("assets/data/announcements.json", { items });
  return items;
}

async function buildSitemap(posts) {
  const staticPaths = ["/", "/about", "/hizmetler.html", "/blog.html", "/sss.html", "/hasta-iliskileri.html", "/kvkk.html"];
  const urls = [...staticPaths, ...posts.filter(post => isActive(post)).map(post => post.url)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${SITE_URL}${url}</loc><lastmod>${NOW.toISOString().slice(0,10)}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  await writeFile("sitemap.xml", xml);
}

await fs.rm(DIST, { recursive:true, force:true });
await copyTree(ROOT, DIST);
const [posts, faq, reviews, instagram, announcements] = await Promise.all([
  buildBlog(), buildFaq(), buildReviews(), buildInstagram(), buildAnnouncements()
]);
await buildSitemap(posts);
const transitions = [
  ...posts.flatMap(post => [post.published !== false ? validDate(post.date) : null, post.published !== false ? validDate(post.unpublishAt) : null]),
  ...announcements.flatMap(item => [item.published !== false ? validDate(item.publishAt) : null, item.published !== false ? validDate(item.unpublishAt) : null]),
  ...instagram.flatMap(item => [item.published !== false ? validDate(item.date) : null, item.published !== false ? validDate(item.unpublishAt) : null]),
].filter(date => date && date > NOW).sort((a,b) => a-b);
await writeJson("assets/data/content-manifest.json", {
  generatedAt:new Date().toISOString(), activeBlogCount:posts.filter(post => isActive(post)).length,
  scheduledBlogCount:posts.filter(post => post.published !== false && validDate(post.date) > NOW).length,
  faqCount:faq.filter(item => item.published).length, presentedReviewCount:reviews.length,
  manualInstagramCount:instagram.filter(item => item.image && isActive(item)).length, activeAnnouncementCount:announcements.filter(item => isActive({...item,date:item.publishAt})).length,
  nextContentTransitionAt:transitions[0]?.toISOString() || "",
});
console.log("Elçi site içeriği, blog sayfaları ve yayın takvimi hazırlandı.");
