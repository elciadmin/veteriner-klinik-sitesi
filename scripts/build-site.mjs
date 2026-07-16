import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

const SOURCES = {
  blog: path.join(ROOT, "content", "blog"),
  faq: path.join(ROOT, "content", "faq"),
  reviews: path.join(ROOT, "content", "reviews"),
  instagram: path.join(ROOT, "content", "instagram"),
  homeFaq: path.join(ROOT, "settings", "home-faq.json"),
  homeReviews: path.join(ROOT, "settings", "home-reviews.json"),
};

const excludedTop = new Set([
  ".git", ".github", ".netlify", "dist", "node_modules",
  "content", "settings", "scripts", "netlify",
  "package.json", "package-lock.json", "netlify.toml",
]);

const escapeHtml = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));

const slugify = value =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g,"c").replace(/ğ/g,"g").replace(/ı/g,"i")
    .replace(/ö/g,"o").replace(/ş/g,"s").replace(/ü/g,"u")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "icerik";

function inlineMarkup(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderRichText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Decap richtext alanı HTML üretmişse güvenli temel etiketleri olduğu gibi kullan.
  if (/<(p|h2|h3|ul|ol|li|strong|em|blockquote)\b/i.test(raw)) return raw;

  return raw.replace(/\r/g, "").split(/\n{2,}/).map(block => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    if (!lines.length) return "";
    if (lines.every(line => line.startsWith("- "))) {
      return `<ul>${lines.map(line => `<li>${inlineMarkup(line.slice(2))}</li>`).join("")}</ul>`;
    }
    if (lines[0].startsWith("### ")) return `<h3>${inlineMarkup(lines.join(" ").slice(4))}</h3>`;
    if (lines[0].startsWith("## ")) return `<h2>${inlineMarkup(lines.join(" ").slice(3))}</h2>`;
    return `<p>${inlineMarkup(lines.join(" "))}</p>`;
  }).join("");
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJsonFolder(folder) {
  try {
    const names = (await fs.readdir(folder))
      .filter(name => name.endsWith(".json"))
      .sort();
    const entries = [];
    for (const name of names) {
      const data = await readJson(path.join(folder, name), {});
      entries.push({
        slug: name.replace(/\.json$/i, ""),
        file: name,
        data,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

async function copyTree(source, target, relative = "") {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (!relative && excludedTop.has(entry.name)) continue;
    if (entry.name.endsWith(".zip")) continue;

    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyTree(src, dst, path.join(relative, entry.name));
    } else {
      await fs.copyFile(src, dst);
    }
  }
}

async function writeDistJson(relative, data) {
  const target = path.join(DIST, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2), "utf8");
}

async function buildBlog() {
  const entries = await readJsonFolder(SOURCES.blog);
  const posts = entries.map(({ slug: entrySlug, file, data }) => {
    const advanced = data.advanced || {};
    const slug = String(advanced.slug || "").trim() || slugify(data.title);
    const date = data.date || new Date().toISOString();
    const words = String(data.content || "").trim().split(/\s+/).filter(Boolean).length;

    return {
      title: data.title || "",
      slug,
      date,
      scheduledAt: date,
      published: data.published !== false,
      summary: data.summary || "",
      cover: data.cover || "",
      youtubeId: advanced.youtubeId || "",
      category: data.category || "Klinik Duyuruları",
      categories: [data.category || "Klinik Duyuruları"],
      species: data.species || "Genel",
      tags: Array.isArray(data.tags) ? data.tags : [],
      author: advanced.author || "Elçi Veteriner Kliniği",
      readingMinutes: Math.max(1, Math.ceil(words / 190)),
      seoTitle: advanced.seoTitle || data.title || "",
      seoDescription: advanced.seoDescription || data.summary || "",
      url: `/blog.html#${encodeURIComponent(slug)}`,
      content: renderRichText(data.content || ""),
      cmsEntry: entrySlug,
      sourceFile: file,
      dateLabel: new Date(date).toLocaleDateString("tr-TR", {
        day:"2-digit", month:"2-digit", year:"numeric"
      }),
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  await writeDistJson("assets/data/blog.json", { posts });
  return posts;
}

async function buildFaq() {
  const entries = await readJsonFolder(SOURCES.faq);
  const home = await readJson(SOURCES.homeFaq, { items: [] });
  const selected = (home?.items || [])
    .map(item => typeof item === "string" ? item : item?.faq)
    .filter(Boolean)
    .slice(0, 6);
  const homeOrder = new Map(selected.map((slug, index) => [slug, index + 1]));

  const items = entries.map(({ slug, data }) => ({
    id: slug,
    q: data.title || "",
    a: data.answer || "",
    category: data.category || "Muayene ve Laboratuvar",
    published: data.published !== false,
    showOnHome: homeOrder.has(slug),
    homeOrder: homeOrder.get(slug) || null,
    cmsEntry: slug,
  })).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category, "tr");
    return a.q.localeCompare(b.q, "tr");
  });

  await writeDistJson("assets/data/faq.json", {
    title: "Sık Sorulan Sorular",
    items,
  });

  return items;
}

async function buildReviews() {
  const entries = await readJsonFolder(SOURCES.reviews);
  const settings = await readJson(SOURCES.homeReviews, {
    totalCount: 194,
    items: [],
  });

  const map = new Map(entries.map(entry => [entry.slug, entry.data]));
  let selected = (settings?.items || [])
    .map(item => typeof item === "string" ? item : item?.review)
    .filter(Boolean);

  if (!selected.length) {
    selected = entries
      .filter(entry => entry.data.published !== false)
      .slice(0, 6)
      .map(entry => entry.slug);
  }

  const reviews = selected.map(slug => {
    const data = map.get(slug);
    if (!data || data.published === false) return null;
    return {
      author: data.author || "Google kullanıcısı",
      rating: Math.max(1, Math.min(5, Number(data.rating) || 5)),
      time: data.time || "",
      text: data.text || "",
      sourceUrl: data.sourceUrl || "",
      cmsEntry: slug,
    };
  }).filter(Boolean);

  await writeDistJson("assets/data/reviews.json", reviews);
  await writeDistJson("assets/data/site-settings.json", {
    totalGoogleReviews: Math.max(0, Number(settings?.totalCount) || 0),
  });

  return reviews;
}

async function buildInstagram() {
  const entries = await readJsonFolder(SOURCES.instagram);
  const items = entries
    .map(({ slug, data }) => ({
      id: slug,
      published: data.published !== false,
      title: data.title || "",
      date: data.date || "",
      image: data.image || "",
      alt: data.alt || data.title || "Elçi Veteriner Kliniği galeri görseli",
      instagramUrl: data.instagramUrl || "",
      cmsEntry: slug,
    }))
    .filter(item => item.published && item.image)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  await writeDistJson("assets/data/instagram-manual.json", items);
  return items;
}

await fs.rm(DIST, { recursive: true, force: true });
await copyTree(ROOT, DIST);

const [posts, faq, reviews, instagram] = await Promise.all([
  buildBlog(),
  buildFaq(),
  buildReviews(),
  buildInstagram(),
]);

await writeDistJson("assets/data/content-manifest.json", {
  generatedAt: new Date().toISOString(),
  publishedBlogCount: posts.filter(item => item.published).length,
  faqCount: faq.filter(item => item.published).length,
  presentedReviewCount: reviews.length,
  manualInstagramCount: instagram.length,
});

console.log("Elçi Yönetim V2.2 içerikleri hazırlandı.");
