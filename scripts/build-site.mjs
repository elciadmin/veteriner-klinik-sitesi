import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const EXCLUDED = new Set([
  '.git', '.github', '.netlify', 'dist', 'node_modules',
  'netlify', 'scripts', 'content', 'settings', 'package.json', 'package-lock.json', 'netlify.toml',
  'README.md', 'KURULUM-TEK-SEFER.txt', 'PANEL-KULLANIMI.txt', 'DEGISIKLIK-OZETI.txt', 'TEST-RAPORU.txt', 'NETLIFY-SON-AYARLAR.txt'
]);

async function copyTree(source, target, level = 0) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (level === 0 && EXCLUDED.has(entry.name)) continue;
    if (entry.name.endsWith('.zip')) continue;
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) await copyTree(src, dst, level + 1);
    else await fs.copyFile(src, dst);
  }
}

await fs.rm(DIST, { recursive: true, force: true });
await copyTree(ROOT, DIST);

const required = [
  'assets/data/blog.json',
  'assets/data/faq.json',
  'assets/data/reviews.json',
  'assets/data/instagram.json',
  'assets/data/services.json',
  'assets/data/successStories.json',
  'assets/data/calendar.json',
  'admin/index.html',
  'admin/app.js',
  'admin/admin.css'
];

for (const relative of required) {
  await fs.access(path.join(DIST, relative));
}

console.log('Elçi Yönetim Merkezi: doğrudan JSON altyapısı hazırlandı.');
