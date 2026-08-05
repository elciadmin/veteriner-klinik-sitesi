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
  blogDesign: path.join(ROOT, "settings", "blog-design.json"),
};

const excludedTop = new Set([
  ".git", ".github", ".netlify", "dist", "node_modules",
  "content", "settings", "scripts", "netlify", "database", "integrated-systems",
  "package.json", "package-lock.json", "netlify.toml", "README-YAYIN-SURUMU.md",
]);

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));

const escapeAttr = escapeHtml;

const BLOG_FONT_STACKS = {
  manrope:'"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  lora:'"Lora",Georgia,serif',
  sourceSerif:'"Source Serif 4",Georgia,serif',
  merriweather:'"Merriweather",Georgia,serif',
  cormorant:'"Cormorant Garamond",Georgia,serif',
  playfair:'"Playfair Display",Georgia,serif',
  georgia:'Georgia,"Times New Roman",serif',
};
const DEFAULT_BLOG_DESIGN = {titleFont:"manrope",bodyFont:"manrope",cardTitleFont:"manrope",cardBodyFont:"manrope"};
const safeFontKey = value => Object.hasOwn(BLOG_FONT_STACKS,String(value || "")) ? String(value) : "manrope";
const normalizeBlogDesign = value => ({
  titleFont:safeFontKey(value?.titleFont || DEFAULT_BLOG_DESIGN.titleFont),
  bodyFont:safeFontKey(value?.bodyFont || DEFAULT_BLOG_DESIGN.bodyFont),
  cardTitleFont:safeFontKey(value?.cardTitleFont || DEFAULT_BLOG_DESIGN.cardTitleFont),
  cardBodyFont:safeFontKey(value?.cardBodyFont || DEFAULT_BLOG_DESIGN.cardBodyFont),
});
const resolveBlogDesign = (postDesign, defaults) => {
  const base=normalizeBlogDesign(defaults);
  const pick=(value,fallback)=>value && value!=="default" ? safeFontKey(value) : fallback;
  return {
    titleFont:pick(postDesign?.titleFont,base.titleFont),
    bodyFont:pick(postDesign?.bodyFont,base.bodyFont),
    cardTitleFont:pick(postDesign?.cardTitleFont,base.cardTitleFont),
    cardBodyFont:pick(postDesign?.cardBodyFont,base.cardBodyFont),
  };
};

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


function renderEditorialSections(sections, design = DEFAULT_BLOG_DESIGN) {
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
      const side = block.imageSide === "left" ? " image-left" : " image-right";
      const fit = block.fit === "contain" ? " fit-contain" : " fit-cover";
      const heading = block.heading ? `<h2 class="editorial-section-title">${escapeHtml(block.heading)}</h2>` : "";
      const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
      return `<section class="editorial-section editorial-flow${side}${fit}"><figure class="editorial-flow-figure"><img src="${escapeAttr(block.image)}" alt="${escapeAttr(block.alt || block.heading || "Blog görseli")}" loading="lazy" decoding="async" onerror="const figure=this.closest('.editorial-flow-figure');const section=this.closest('.editorial-flow');figure?.remove();section?.classList.add('media-missing')">${caption}</figure><div class="editorial-flow-copy">${heading}${renderRichText(block.body || "")}</div></section>`;
    }
    if (type === "gallery") {
      const images = (Array.isArray(block.images) ? block.images : []).filter(item => item?.image).slice(0,4);
      if (images.length < 2) return images.length === 1 ? figureHtml(images[0].image, images[0].alt, images[0].caption, ` is-compact ${block.fit === "contain" ? "fit-contain" : "fit-cover"}`) : "";
      const layout = ["two","feature"].includes(block.layout) ? ` layout-${block.layout}` : " layout-auto";
      const fit = block.fit === "contain" ? " fit-contain" : " fit-cover";
      return `<section class="editorial-section editorial-gallery count-${images.length}${layout}${fit}">${images.map(item => `<figure><img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.alt || "Blog galerisi görseli")}" loading="lazy" decoding="async" onerror="this.closest('figure').hidden=true">${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}</figure>`).join("")}</section>`;
    }

    if (type === "cards") {
      const iconMap = {
        shield:"fa-shield-halved", syringe:"fa-syringe", leaf:"fa-leaf", home:"fa-house",
        heart:"fa-heart-pulse", paw:"fa-paw", bowl:"fa-bowl-food", star:"fa-star"
      };
      const sizes=new Set(["small","medium","large","full"]);
      const positions=new Set(["auto","left","center","right","full"]);
      const textSizes=new Set(["small","normal","large"]);
      const items = (Array.isArray(block.items) ? block.items : []).map(item => ({
        title:String(item?.title || "").trim(),
        body:String(item?.body || "").trim(),
        image:String(item?.image || "").trim(),
        alt:String(item?.alt || "").trim(),
        icon:iconMap[item?.icon] ? item.icon : "paw",
        size:sizes.has(item?.size) ? item.size : "medium",
        position:positions.has(item?.position) ? item.position : "auto",
        textSize:textSizes.has(item?.textSize) ? item.textSize : "normal",
      })).filter(item => item.title || item.body || item.image).slice(0,3);
      if (!items.length) return "";
      const titleKey=block.titleFont && block.titleFont!=="default" ? safeFontKey(block.titleFont) : design.cardTitleFont;
      const bodyKey=block.bodyFont && block.bodyFont!=="default" ? safeFontKey(block.bodyFont) : design.cardBodyFont;
      const style=`--blog-card-title-font:${BLOG_FONT_STACKS[titleKey]};--blog-card-body-font:${BLOG_FONT_STACKS[bodyKey]}`;
      return `<section class="editorial-section editorial-card-list count-${items.length}" style="${escapeAttr(style)}">${items.map(item => {
        const media = item.image ? `<figure class="editorial-info-card-media"><img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.alt || item.title || "Blog görseli")}" loading="lazy" decoding="async" onerror="this.closest('figure')?.remove();this.closest('.editorial-info-card')?.classList.remove('has-media')"></figure>` : "";
        const classes=`card-size-${item.size} card-position-${item.position} card-text-${item.textSize}`;
        return `<article class="editorial-info-card ${classes}${item.image ? " has-media" : ""}"><div class="editorial-info-card-copy"><span class="editorial-info-card-icon"><i class="fa-solid ${iconMap[item.icon]}"></i></span><div class="editorial-info-card-text">${item.title ? `<h3>${escapeHtml(item.title)}</h3>` : ""}${item.body ? renderRichText(item.body) : ""}</div></div>${media}</article>`;
      }).join("")}</section>`;
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


function editorialHasMedia(sections) {
  return Array.isArray(sections) && sections.some(block => {
    if (!block || typeof block !== "object") return false;
    if (["image","split"].includes(block.type)) return !!block.image;
    if (block.type === "gallery") return Array.isArray(block.images) && block.images.some(item => item?.image);
    if (block.type === "cards") return Array.isArray(block.items) && block.items.some(item => item?.image);
    return false;
  });
}

function editorialPlainText(sections) {
  if (!Array.isArray(sections)) return "";
  return sections.flatMap(block => {
    if (!block || typeof block !== "object") return [];
    if (["text","split","callout"].includes(block.type)) return [block.heading, block.body];
    if (block.type === "steps") return [block.heading, ...(Array.isArray(block.items) ? block.items.map(item => typeof item === "string" ? item : item?.item) : [])];
    if (block.type === "cards") return (Array.isArray(block.items) ? block.items : []).flatMap(item => [item?.title, item?.body]);
    return [];
  }).filter(Boolean).join(" ");
}

function readingMinutes(value) {
  const clean = stripHtml(value).replace(/\s+/g, " ").trim();
  if (!clean) return 1;
  const words = clean.split(" ").filter(Boolean).length;
  const characterEquivalent = Math.ceil(clean.length / 6);
  return Math.max(1, Math.ceil(Math.max(words, characterEquivalent) / 190));
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
  const activeAttr = key => key === active ? ' class="active" aria-current="page"' : "";
  return `<header>
    <div class="header-top"><div class="container"><div class="header-contact"><span><i class="fa-solid fa-location-dot"></i> Havzan Mah. Yeni Meram Cad. 17/1 Meram/Konya</span></div><div class="header-contact"><a href="tel:+903323223220"><i class="fa-solid fa-phone"></i> 0332 322 32 20</a><a href="mailto:elcivetklinik@gmail.com"><i class="fa-solid fa-envelope"></i> elcivetklinik@gmail.com</a></div></div></div>
    <div class="header-main"><div class="container"><div class="logo-text"><a class="brand-lockup" href="/" aria-label="Elçi Veteriner Kliniği ana sayfa"><span aria-hidden="true" class="brand-mark"><img src="/assets/img/uploads/elci-logo.png?v=3" alt="" width="54" height="54" loading="eager" decoding="async"></span><span class="brand-copy"><strong>Elçi Veteriner Kliniği</strong><span class="signature-tagline header-signature">Sağlığın Elçi’leriyiz</span></span></a></div><nav aria-label="Birincil" class="main-nav"><button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Menüyü aç/kapat" aria-expanded="false" aria-controls="mainMenu"><i class="fa-solid fa-bars"></i></button><ul id="mainMenu">
      <li><a href="/"${activeAttr("home")}>Ana Sayfa</a></li>
      <li class="dropdown"><a href="/about" aria-expanded="false" aria-haspopup="true"${activeAttr("about")}>Hakkımızda</a><div class="dropdown-content" role="menu"><a href="/about#elci-kimdir" role="menuitem">Elçi Kimdir?</a><a href="/about#ekibimiz" role="menuitem">Ekibimiz</a><a href="/about#klinik" role="menuitem">Kliniğimiz</a><a href="/about#misyon-vizyon" role="menuitem">Misyon &amp; Vizyon</a><a href="/about#degerler" role="menuitem">Değerlerimiz</a></div></li>
      <li class="dropdown"><a href="/hizmetler.html" aria-expanded="false" aria-haspopup="true"${activeAttr("services")}>Hizmetlerimiz</a><div class="dropdown-content" role="menu"><a href="/hizmetler.html#acil" role="menuitem">Acil Veteriner</a><a href="/hizmetler.html#koruyucu" role="menuitem">Koruyucu Hekimlik</a><a href="/hizmetler.html#cerrahi" role="menuitem">Cerrahi Operasyonlar</a><a href="/hizmetler.html#agiz-dis" role="menuitem">Ağız ve Diş Sağlığı</a><a href="/hizmetler.html#ic-hastaliklari" role="menuitem">İç Hastalıkları</a><a href="/hizmetler.html#fizik-tedavi" role="menuitem">Fizik Tedavi</a><a href="/hizmetler.html#konaklama" role="menuitem">Konaklama</a></div></li>
      <li><a href="/blog.html"${activeAttr("blog")}>Blog</a></li>
      <li class="dropdown"><a href="/sss.html" aria-expanded="false" aria-haspopup="true"${activeAttr("faq")}>SSS</a><div class="dropdown-content" role="menu"><a href="/sss.html#fiyat" role="menuitem">Fiyat &amp; Ödeme</a><a href="/sss.html#surec" role="menuitem">Hizmet Süreçleri</a><a href="/sss.html#acil" role="menuitem">Acil Durumlar</a></div></li>
      <li class="dropdown"><a href="/hasta-iliskileri.html" aria-expanded="false" aria-haspopup="true"${activeAttr("patient")}>Hasta İlişkileri</a><div class="dropdown-content" role="menu"><a href="/hasta-iliskileri.html#online-randevu" role="menuitem">Online Randevu</a><a href="/hasta-iliskileri.html#memnuniyet-anketi" role="menuitem">Memnuniyet Anketi</a><a href="/hasta-iliskileri.html#basari-hikayeleri" role="menuitem">Başarı Hikâyeleri</a><a href="/hasta-iliskileri.html#sikayet-oneri" role="menuitem">Şikâyet &amp; Öneri</a></div></li>
    </ul></nav></div></div>
  </header>`;
}

function commonFooter() {
  return `<footer class="footer-new"><div class="container footer-container"><div class="footer-col"><h3>Elçi Veteriner Kliniği</h3><p>Meram/Konya'da kedi ve köpekler için anlaşılır bilgilendirme, planlı klinik süreç ve düzenli takip.</p></div><div class="footer-col"><h3>Hızlı bağlantılar</h3><ul class="footer-links"><li><a href="/hizmetler.html">Hizmetlerimiz</a></li><li><a href="/blog.html">Blog</a></li><li><a href="/sss.html">Sık Sorulan Sorular</a></li><li><a href="/hasta-iliskileri.html#online-randevu">Online Randevu</a></li></ul></div><div class="footer-col"><h3>İletişim</h3><ul class="footer-contact"><li><a href="tel:+903323223220">0332 322 32 20</a></li><li><a href="mailto:elcivetklinik@gmail.com">elcivetklinik@gmail.com</a></li><li>Her gün 09.00–21.00</li></ul></div></div><div class="footer-bottom"><div class="container">© <span id="yil"></span> Elçi Veteriner Kliniği · <a href="/kvkk.html">KVKK Aydınlatma Metni</a></div></div></footer>`;
}

const BLOG_HEADER_CRITICAL = `<style>
body{margin:0}body>header:first-of-type{min-height:144px;background:linear-gradient(104deg,#5a1fa8 0%,#44127f 48%,#260943 100%)}
body .header-top{min-height:36px}body .header-main{min-height:108px}body .header-main>.container{min-height:108px;display:flex;align-items:center;justify-content:space-between}
body .header-main nav>ul{display:flex;align-items:center;gap:25px;margin:0;padding:0;list-style:none}body .header-main nav>ul>li>a{color:#fff;text-decoration:none}
</style>`;

function blogPage(post) {
  const active = isActive(post);
  const robots = active ? "index,follow,max-image-preview:large" : "noindex,nofollow,noarchive";
  const socialImage = post.cover || "/assets/img/uploads/elci-logo.png";
  const showCover = !!post.cover && (post.contentMode !== "visual" || !post.hasEditorialMedia);
  const content = post.content || (post.contentMode === "visual" ? "" : `<p>${escapeHtml(post.summary)}</p>`);
  const canonicalUrl = `${SITE_URL}${post.url}`;
  const encodedUrl = encodeURIComponent(canonicalUrl);
  const encodedShare = encodeURIComponent(`${post.title} — ${canonicalUrl}`);
  const schema = active ? `<script type="application/ld+json">${JSON.stringify({
    "@context":"https://schema.org", "@type":"BlogPosting", headline:post.title,
    description:post.seoDescription || post.summary, image:`${SITE_URL}${socialImage}`,
    datePublished:post.date, dateModified:post.updatedAt || post.date,
    author:{"@type":"Organization",name:post.author || "Elçi Veteriner Kliniği"},
    publisher:{"@type":"Organization",name:"Elçi Veteriner Kliniği",logo:{"@type":"ImageObject",url:`${SITE_URL}/assets/img/uploads/elci-logo.png`}},
    mainEntityOfPage:canonicalUrl
  }).replace(/</g, "\\u003c")}</script>` : "";

  return `<!doctype html><html lang="tr"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(post.seoTitle || `${post.title} | Elçi Veteriner Kliniği`)}</title>
    <meta name="description" content="${escapeAttr(post.seoDescription || post.summary)}"><meta name="robots" content="${robots}"><meta name="theme-color" content="#5a1fa8">
    <link rel="canonical" href="${canonicalUrl}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeAttr(post.title)}"><meta property="og:description" content="${escapeAttr(post.summary)}"><meta property="og:image" content="${SITE_URL}${escapeAttr(socialImage)}">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Great+Vibes&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@400;500;600;700;800&family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"><link rel="stylesheet" href="/assets/css/tokens.css"><link rel="stylesheet" href="/assets/css/styles.css"><link rel="stylesheet" href="/assets/css/elci-system.css?v=20260721-2"><link rel="stylesheet" href="/assets/css/elci-shell-v32.css?v=20260721-1"><link rel="stylesheet" href="/assets/css/elci-fixes-v33.css?v=20260721-1"><link rel="stylesheet" href="/assets/css/elci-fixes-v34.css?v=20260721-1"><link rel="stylesheet" href="/assets/css/elci-final-v35.css?v=20260723-54"><link rel="stylesheet" href="/assets/css/elci-blog-v59.css?v=20260726-510">
    ${BLOG_HEADER_CRITICAL}${schema}
  </head><body class="blog-article-page theme-elciKonya" data-page="blog" data-content-mode="${escapeAttr(post.contentMode || "standard")}" data-runtime-active="${active}" data-publish-at="${escapeAttr(post.date)}" data-unpublish-at="${escapeAttr(post.unpublishAt || "")}">
    ${commonHeader("blog")}<div id="siteAnnouncement" class="site-announcement" hidden></div>
    <main class="blog-article-shell" id="ana-icerik">
      <div class="blog-not-active" id="blogInactive"><h1>Bu yazı şu anda yayında değil.</h1><p>Yazı henüz yayınlanmamış veya yayın süresi sona ermiş olabilir.</p><a class="btn primary" href="/blog.html">Bloga dön</a></div>
      <article class="blog-article" id="blogArticle" style="--blog-title-font:${escapeAttr(BLOG_FONT_STACKS[post.design.titleFont])};--blog-body-font:${escapeAttr(BLOG_FONT_STACKS[post.design.bodyFont])};--blog-card-title-font:${escapeAttr(BLOG_FONT_STACKS[post.design.cardTitleFont])};--blog-card-body-font:${escapeAttr(BLOG_FONT_STACKS[post.design.cardBodyFont])}">
        <nav class="blog-breadcrumb" aria-label="Sayfa yolu"><a href="/">Ana Sayfa</a><i class="fa-solid fa-chevron-right"></i><a href="/blog.html">Blog</a><i class="fa-solid fa-chevron-right"></i><span>${escapeHtml(post.title)}</span></nav>
        <header class="blog-article-header">
          <div class="blog-article-topline"><div class="blog-article-meta"><span><i class="fa-regular fa-bookmark"></i> ${escapeHtml(post.category)}</span><span><i class="fa-regular fa-calendar"></i> ${escapeHtml(post.dateLabel)}</span><span><i class="fa-regular fa-user"></i> ${escapeHtml(post.author)}</span></div><span class="blog-reading-time"><i class="fa-regular fa-clock"></i> ${post.readingMinutes} dk okuma</span></div>
          <h1>${escapeHtml(post.title)}</h1><div class="blog-title-divider" aria-hidden="true"><span></span><i class="fa-solid fa-paw"></i><span></span></div>${post.summary ? `<p class="blog-article-summary">${escapeHtml(post.summary)}</p>` : ""}
        </header>
        ${showCover ? `<figure class="blog-article-cover"><img src="${escapeAttr(post.cover)}" alt="${escapeAttr(post.title)}" loading="eager" decoding="async" onerror="this.closest('figure')?.remove()">${post.coverCaption ? `<figcaption>${escapeHtml(post.coverCaption)}</figcaption>` : ""}</figure>` : ""}
        <div class="blog-article-content">${content}${post.editorialHtml || ""}<aside class="blog-article-note"><span class="blog-note-icon"><i class="fa-solid fa-leaf"></i></span><div><strong>Unutmayın</strong><p>Her patinin ihtiyacı farklıdır. Bu içerik genel bilgi amaçlıdır; muayene, tanı ve hastaya özel tedavi planının yerini tutmaz.</p></div></aside></div>
        <footer class="blog-article-actions"><div class="blog-share"><span>Bu yazıyı paylaş:</span><a class="blog-share-button" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener" aria-label="Facebook'ta paylaş"><i class="fa-brands fa-facebook-f"></i></a><a class="blog-share-button" href="https://wa.me/?text=${encodedShare}" target="_blank" rel="noopener" aria-label="WhatsApp'ta paylaş"><i class="fa-brands fa-whatsapp"></i></a><button class="blog-share-button" type="button" data-copy-blog-link="${escapeAttr(canonicalUrl)}" aria-label="Yazı bağlantısını kopyala"><i class="fa-solid fa-link"></i></button></div><div class="blog-action-links"><a class="btn" href="/blog.html"><i class="fa-solid fa-arrow-left"></i> Bloga geri dön</a><a class="btn primary" href="/hasta-iliskileri.html#online-randevu"><i class="fa-solid fa-calendar-check"></i> Randevu talebi</a></div></footer>
      </article>
    </main>${commonFooter()}<script src="/assets/js/elci-system.js" defer></script>
    <script>(()=>{const body=document.body,article=document.getElementById('blogArticle'),inactive=document.getElementById('blogInactive');function update(){const now=Date.now(),start=Date.parse(body.dataset.publishAt||''),end=Date.parse(body.dataset.unpublishAt||''),live=(!Number.isFinite(start)||start<=now)&&(!Number.isFinite(end)||end>now);body.dataset.runtimeActive=String(live);article.hidden=!live;inactive.hidden=live;const next=[start,end].filter(value=>Number.isFinite(value)&&value>now).sort((a,b)=>a-b)[0];if(next)setTimeout(update,Math.min(next-now+250,2147483647));}update();document.addEventListener('click',async event=>{const button=event.target.closest('[data-copy-blog-link]');if(!button)return;try{await navigator.clipboard.writeText(button.dataset.copyBlogLink);button.classList.add('copied');button.setAttribute('aria-label','Bağlantı kopyalandı');setTimeout(()=>button.classList.remove('copied'),1400);}catch{}});})();</script>
  </body></html>`;
}

async function buildBlog() {
  const [entries, rawBlogDesign] = await Promise.all([readJsonFolder(SOURCES.blog),readJson(SOURCES.blogDesign,DEFAULT_BLOG_DESIGN)]);
  const blogDesign=normalizeBlogDesign(rawBlogDesign);
  const posts = entries.map(({ slug:entrySlug, file, data }) => {
    const advanced = data.advanced || {};
    const slug = String(advanced.slug || "").trim() || slugify(data.title);
    const date = data.date || new Date().toISOString();
    const rawContent = data.content || "";
    const contentMode = ["standard","visual"].includes(data.contentMode)
      ? data.contentMode
      : (Array.isArray(data.editorialSections) && data.editorialSections.length && !String(rawContent).trim() ? "visual" : "standard");
    const design=resolveBlogDesign(data.design,blogDesign);
    return {
      title:data.title || "", slug, date, scheduledAt:date, unpublishAt:data.unpublishAt || "", design,
      published:data.published !== false, active:isActive({ published:data.published !== false, date, unpublishAt:data.unpublishAt || "" }), featured:data.featured === true, summary:data.summary || "", cover:data.cover || "", coverCaption:data.coverCaption || "",
      youtubeId:advanced.youtubeId || "", category:data.category || "Klinik Duyuruları", categories:[data.category || "Klinik Duyuruları"],
      species:data.species || "Genel", tags:Array.isArray(data.tags) ? data.tags : [], relatedService:data.relatedService || "",
      author:advanced.author || "Elçi Veteriner Kliniği",
      seoTitle:advanced.seoTitle || data.title || "", seoDescription:advanced.seoDescription || data.summary || "",
      url:`/blog/${encodeURIComponent(slug)}.html`, contentMode, content:contentMode === "visual" ? "" : renderRichText(rawContent), editorialHtml:contentMode === "visual" ? renderEditorialSections(data.editorialSections,design) : "", hasEditorialMedia:editorialHasMedia(data.editorialSections), cmsEntry:entrySlug, sourceFile:file,
      dateLabel:dateLabel(date), readingMinutes:readingMinutes([data.title,data.summary,rawContent,editorialPlainText(data.editorialSections)].filter(Boolean).join(" ")), updatedAt:data.updatedAt || date,
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
