import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DIST=path.join(ROOT,'dist');
const safe=/^[A-Za-z0-9._-]+$/;
const errors=[];
const notes=[];

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
function rel(p,base=ROOT){return path.relative(base,p).split(path.sep).join('/')}
async function exists(p){try{await fs.access(p);return true}catch{return false}}


// Kaynak ağacındaki dosya adları da Netlify ile uyumlu olmalıdır.
for(const file of await walk(ROOT)){
  const r=rel(file);
  if(r.startsWith('dist/')||r.startsWith('node_modules/')||r.startsWith('.git/')||r.startsWith('_ELCI_YEDEK/'))continue;
  if(r.split('/').some(seg=>!safe.test(seg)))errors.push(`Netlify uyumsuz kaynak adı: ${r}`);
}

for(const folder of ['assets/data','content/blog','content/faq','content/reviews','settings']){
  const dir=path.join(ROOT,folder);if(!await exists(dir)){errors.push(`Eksik klasör: ${folder}`);continue}
  for(const file of (await walk(dir)).filter(f=>f.endsWith('.json'))){
    try{JSON.parse(await fs.readFile(file,'utf8'))}catch(e){errors.push(`JSON hatası: ${rel(file)} — ${e.message}`)}
  }
}

if(await exists(DIST)){
  for(const file of await walk(DIST)){
    const r=rel(file,DIST);
    if(r.split('/').some(seg=>!safe.test(seg))) errors.push(`Netlify uyumsuz çıktı adı: ${r}`);
  }
  const htmlFiles=(await walk(DIST)).filter(f=>f.endsWith('.html'));
  const localRef=/(?:src|href)=["'](\/(?!\/|#|mailto:|tel:)[^"'?]+)(?:\?[^"']*)?["']/g;
  for(const file of htmlFiles){
    const text=await fs.readFile(file,'utf8');let m;
    while((m=localRef.exec(text))){
      let target=m[1];
      if(target==='/'||target.endsWith('/')) target+=target==='/'?'index.html':'index.html';
      const clean=target.replace(/^\//,'').split('#')[0];
      const redirects=new Set(['/about','/services','/contact','/team','/gallery','/admin']);
      if(redirects.has(m[1])) continue;
      if(!await exists(path.join(DIST,clean))) errors.push(`Kırık yerel bağlantı: ${rel(file,DIST)} -> ${m[1]}`);
    }
  }
  const services=JSON.parse(await fs.readFile(path.join(DIST,'assets/data/services.json'),'utf8'));
  const active=(services.items||[]).filter(i=>i.published);
  const home=active.filter(i=>i.showOnHome).slice(0,6);
  if(active.length<6)errors.push('Yayındaki hizmet sayısı 6’dan az.');
  if(home.length<1)errors.push('Ana sayfada gösterilecek hizmet seçilmemiş.');
  notes.push(`Yayındaki hizmet: ${active.length}; ana sayfa hizmeti: ${home.length}`);
  const blog=JSON.parse(await fs.readFile(path.join(DIST,'assets/data/blog.json'),'utf8'));
  notes.push(`Yayındaki blog/duyuru: ${(blog.posts||[]).filter(p=>p.published).length}`);
  const faq=JSON.parse(await fs.readFile(path.join(DIST,'assets/data/faq.json'),'utf8'));
  notes.push(`Yayındaki SSS: ${(faq.items||[]).filter(i=>i.published).length}`);
}


const servicesSource=JSON.parse(await fs.readFile(path.join(ROOT,'assets/data/services.json'),'utf8'));
const serviceIds=(servicesSource.items||[]).map(i=>String(i.id||''));
if(new Set(serviceIds).size!==serviceIds.length)errors.push('Hizmet kimlikleri benzersiz değil.');
const orders=(servicesSource.items||[]).map(i=>Number(i.order)).filter(Number.isFinite);
if(new Set(orders).size!==orders.length)errors.push('Hizmet sıra numaraları benzersiz değil.');
const configText=await fs.readFile(path.join(ROOT,'admin/config.yml'),'utf8');
for(const collection of ['blog','faq','reviews','instagram_posts']){
  const start=configText.indexOf(`  - name: "${collection}"`);
  const end=configText.indexOf('\n  - name:',start+5);
  const block=configText.slice(start,end<0?undefined:end);
  if(!block.includes('    delete: false'))errors.push(`${collection} koleksiyonunda kalıcı silme kapalı değil.`);
}
const cmsText=await fs.readFile(path.join(ROOT,'admin/cms.html'),'utf8');
if(!cmsText.includes("isTest?'elci-yonetim-v3-test':'main'"))errors.push('CMS test/canlı dal seçimi eksik.');
for(const page of ['index.html','about.html','hizmetler.html','blog.html','sss.html','hasta-iliskileri.html']){
  const text=await fs.readFile(path.join(ROOT,page),'utf8');
  if(!text.includes('/assets/js/main.js'))errors.push(`${page}: ortak mobil menü betiği eksik.`);
  if(!text.includes('/assets/css/site-standard.css'))errors.push(`${page}: ortak sayfa standardı CSS’i eksik.`);
}

const pkg=JSON.parse(await fs.readFile(path.join(ROOT,'package.json'),'utf8'));
for(const dep of ['@netlify/blobs','@netlify/identity'])if(!pkg.dependencies?.[dep])errors.push(`Eksik fonksiyon bağımlılığı: ${dep}`);
if(pkg.dependencies?.['@supabase/supabase-js'])errors.push('Kullanılmayan Supabase bağımlılığı kaldırılmalı.');
if(await exists(path.join(ROOT,'package-lock.json')))errors.push('package-lock.json pakette bulunmamalı; ortam-özel registry adresi taşıyabilir.');
if(!(await fs.readFile(path.join(ROOT,'admin/config.yml'),'utf8')).includes('slug:\n  encoding: "ascii"'))errors.push('CMS ASCII dosya adı ayarı eksik.');

if(errors.length){console.error('\nAUDIT BAŞARISIZ\n'+errors.map(e=>`- ${e}`).join('\n'));process.exit(1)}
console.log('AUDIT BAŞARILI');
for(const note of notes)console.log(`- ${note}`);
