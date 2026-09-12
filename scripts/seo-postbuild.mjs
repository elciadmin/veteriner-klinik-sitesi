import { promises as fs } from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");
const OLD_ORIGIN = "https://elciveteriner.com";
const PRIMARY_ORIGIN = "https://xn--eliveterinerklinii-8ub94i.com";
const TEXT_EXTENSIONS = new Set([".html", ".xml", ".txt", ".json", ".js", ".css", ".webmanifest"]);

const HOME_TITLE_OLD = "Konya Meram Veteriner Kliniği | Elçi Veteriner Kliniği";
const HOME_TITLE_PREVIOUS = "Elçi Veteriner Kliniği | Meram, Konya";
const HOME_TITLE_NEW = "Elçi Veteriner Kliniği | Konya Meram Veteriner Hizmetleri";
const HOME_DESCRIPTION_OLD = "Elçi Veteriner Kliniği, Meram Konya'da kedi ve köpekler için muayene, laboratuvar, aşı, kısırlaştırma, cerrahi ve ağız-diş sağlığı hizmetleri sunar.";
const HOME_DESCRIPTION_NEW = "Elçi Veteriner Kliniği, Konya Meram'da kedi ve köpekler için muayene, laboratuvar, aşı, kısırlaştırma, cerrahi ve ağız-diş sağlığı hizmetleri sunar.";

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function normalizeSeo(relativePath, source) {
  let output = source
    .split(OLD_ORIGIN).join(PRIMARY_ORIGIN)
    .split(HOME_TITLE_OLD).join(HOME_TITLE_NEW)
    .split(HOME_TITLE_PREVIOUS).join(HOME_TITLE_NEW);

  if (relativePath === "index.html") {
    output = output
      .split(HOME_DESCRIPTION_OLD).join(HOME_DESCRIPTION_NEW)
      .split("Meram'da kedi ve köpekler için muayene, laboratuvar, aşı, kısırlaştırma, cerrahi ve koruyucu sağlık hizmetleri.")
      .join("Konya Meram'da kedi ve köpekler için muayene, laboratuvar, aşı, kısırlaştırma, cerrahi ve koruyucu sağlık hizmetleri.")
      .split("Meram'da kedi ve köpekler için muayene, laboratuvar, aşı, kısırlaştırma ve cerrahi hizmetleri.")
      .join("Konya Meram'da kedi ve köpekler için muayene, laboratuvar, aşı, kısırlaştırma ve cerrahi hizmetleri.");
  }

  if (relativePath === "sss.html") {
    output = output
      .replace(
        '<meta content="Veteriner Blogu | Elçi Veteriner Kliniği" property="og:title"/>',
        '<meta content="Sık Sorulan Sorular | Elçi Veteriner Kliniği" property="og:title"/>'
      )
      .replace(
        '<meta content="Kedi ve köpek sağlığı hakkında anlaşılır, güncel ve klinik deneyime dayalı veteriner hekim bilgilendirmeleri." property="og:description"/>',
        '<meta content="Randevu, ücret, aşılar, kısırlaştırma, ameliyat hazırlığı, laboratuvar ve acil durumlarla ilgili sık sorulan sorular." property="og:description"/>'
      );
  }

  if (relativePath.startsWith("blog/") && relativePath.endsWith(".html")) {
    // The inactive-state heading is hidden on published posts. Keeping it as H2 prevents
    // crawlers from counting two H1 elements without changing any runtime behavior.
    output = output
      .replace(
        '<div class="blog-not-active" id="blogInactive"><h1>Bu yazı şu anda yayında değil.</h1>',
        '<div class="blog-not-active" id="blogInactive"><h2>Bu yazı şu anda yayında değil.</h2>'
      )
      .replace(
        /"author":\{"@type":"Organization","name":"([^"]+)"\},"publisher"/g,
        `"author":{"@type":"Organization","name":"$1","logo":{"@type":"ImageObject","url":"${PRIMARY_ORIGIN}/assets/img/uploads/elci-logo.png"}},"publisher"`
      );
  }

  return output;
}

async function main() {
  const files = await collectFiles(DIST);
  let changed = 0;

  for (const filePath of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue;
    const relativePath = path.relative(DIST, filePath).split(path.sep).join("/");
    const source = await fs.readFile(filePath, "utf8");
    const output = normalizeSeo(relativePath, source);
    if (output !== source) {
      await fs.writeFile(filePath, output, "utf8");
      changed += 1;
    }
  }

  console.log(`[seo-postbuild] Primary origin: ${PRIMARY_ORIGIN}; updated ${changed} generated file(s).`);
}

await main();
