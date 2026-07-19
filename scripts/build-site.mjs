import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const directory of ['admin', 'assets']) {
  const source = join(root, directory);
  if (existsSync(source)) cpSync(source, join(dist, directory), { recursive: true });
}
for (const name of readdirSync(root)) {
  if (['.html', '.txt', '.xml'].includes(extname(name)) || name === 'site.webmanifest' || name === 'robots.txt') {
    cpSync(join(root, name), join(dist, name));
  }
}

const context = process.env.CONTEXT || 'local';
const branch = (context === 'deploy-preview' ? process.env.HEAD : process.env.BRANCH) || process.env.HEAD || 'main';
const runtime = {
  context,
  branch,
  production: context === 'production',
  deployPreview: context === 'deploy-preview',
  reviewId: process.env.REVIEW_ID || '',
  commitRef: process.env.COMMIT_REF || ''
};
writeFileSync(join(dist, 'admin', 'runtime-config.js'), `window.ELCI_RUNTIME_CONFIG=${JSON.stringify(runtime)};\n`, 'utf8');
console.log(`[Elçi] ${context} bağlamı, ${branch} dalı için dist hazırlandı.`);
