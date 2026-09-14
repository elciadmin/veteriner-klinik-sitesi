import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const REPO = String(process.env.WORK_ADMIN_REPOSITORY || 'elciadmin/veteriner-klinik-sitesi');
const BRANCH = String(process.env.WORK_ADMIN_BRANCH || 'main');
const API = 'https://api.github.com/repos/' + REPO + '/contents/';
const STORE = 'elci-work-admin-v1';
const MAX_JSON = 180000;
const MAX_MEDIA = 5 * 1024 * 1024;
const COLLECTIONS = {
  blog:'content/blog', announcements:'content/announcements', faq:'content/faq',
  reviews:'content/reviews', instagram:'content/instagram'
};
const DOCUMENTS = {
  services:'assets/data/services.json', stories:'assets/data/successStories.json',
  homeSelections:'settings/home-faq.json', homeReviews:'settings/home-reviews.json',
  blogDesign:'settings/blog-design.json'
};
const PERMISSIONS = new Set(['content:read','content:create','content:update','content:publish','content:schedule','content:unpublish','content:trash','content:restore','content:permanent-delete','media:read','media:create','deployment:read','audit:read']);
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const clean=(v,max=2000)=>String(v??'').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,max);
const hash=v=>createHash('sha256').update(String(v)).digest('hex');
const idOk=v=>/^[a-z0-9][a-z0-9-]{0,150}$/i.test(String(v||''));
const pathOk=v=>/^(content\/(blog|announcements|faq|reviews|instagram)\/[a-z0-9][a-z0-9-]{0,150}\.json|assets\/img\/uploads\/[a-z0-9/_-]{1,180}\.(png|jpe?g|webp|gif)|settings\/(home-faq|home-reviews|blog-design)\.json|assets\/data\/(services|successStories)\.json)$/i.test(String(v||''));
const b64=v=>Buffer.from(String(v),'utf8').toString('base64');
const unb64=v=>Buffer.from(String(v),'base64').toString('utf8');
const now=()=>new Date().toISOString();

function tokens() {
  try {
    const rows=JSON.parse(process.env.WORK_ADMIN_TOKENS_JSON || '[]');
    return Array.isArray(rows)?rows.filter(x=>x&&typeof x.tokenHash==='string'&&Array.isArray(x.permissions)):[];
  } catch { return []; }
}
function auth(request) {
  const value=request.headers.get('authorization')||'';
  const token=value.startsWith('Bearer ')?value.slice(7):'';
  if(!token) return null;
  const candidate=Buffer.from(hash(token),'hex');
  for(const row of tokens()) {
    const known=Buffer.from(String(row.tokenHash),'hex');
    if(known.length===candidate.length&&timingSafeEqual(known,candidate)) return {id:clean(row.id||'work',80),permissions:new Set(row.permissions.filter(p=>PERMISSIONS.has(p))),tokenHash:hash(token)};
  }
  return null;
}
function originOk(request) {
  const origin=request.headers.get('origin');
  if(!origin) return true; // machine-to-machine requests have no browser Origin
  const allowed=String(process.env.WORK_ADMIN_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  return allowed.includes(origin);
}
function need(actor, permission) {
  return actor&&actor.permissions.has(permission);
}
async function gh(path, init={}) {
  const token=process.env.WORK_ADMIN_GITHUB_TOKEN;
  if(!token) throw Object.assign(new Error('Work GitHub credential is not configured'),{status:503});
  const [pathname, query=''] = String(path).split('?');
  const target=API+pathname.split('/').map(encodeURIComponent).join('/')+(query?'?'+query:'');
  const response=await fetch(target,{...init,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(init.headers||{})}});
  const text=await response.text(); let data={}; try{data=JSON.parse(text)}catch{}
  if(!response.ok) throw Object.assign(new Error(data.message||'GitHub content operation failed'),{status:response.status,data});
  return data;
}
async function readFile(path) {
  if(!pathOk(path)) throw Object.assign(new Error('Invalid content path'),{status:400});
  const row=await gh(path+'?ref='+encodeURIComponent(BRANCH));
  return {path,sha:row.sha,data:JSON.parse(unb64(row.content||''))};
}
async function listDir(folder) {
  const rows=await gh(folder+'?ref='+encodeURIComponent(BRANCH));
  return (Array.isArray(rows)?rows:[]).filter(x=>x.type==='file'&&x.name.endsWith('.json')&&!x.name.startsWith('.')).map(x=>({id:x.name.slice(0,-5),path:x.path,sha:x.sha}));
}
async function writeFile(path,data,sha,message) {
  if(!pathOk(path)) throw Object.assign(new Error('Invalid content path'),{status:400});
  const body={message,content:b64(JSON.stringify(data,null,2)+'\n'),branch:BRANCH};
  if(sha) body.sha=sha;
  const result=await gh(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {sha:result.content?.sha||'',commitSha:result.commit?.sha||''};
}
async function removeFile(path,sha,message) {
  return gh(path,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,sha,branch:BRANCH})});
}
function validate(type,data) {
  if(!data||typeof data!=='object'||Array.isArray(data)) throw Object.assign(new Error('Invalid schema'),{status:400});
  if(type==='blog'&&(!clean(data.title,180)||!clean(data.summary,600))) throw Object.assign(new Error('Blog title and summary are required'),{status:400});
  if(type==='announcements'&&(!clean(data.title,180)||!clean(data.message,900))) throw Object.assign(new Error('Announcement title and message are required'),{status:400});
  if(type==='faq'&&(!clean(data.question,240)||!clean(data.answer,2500))) throw Object.assign(new Error('FAQ question and answer are required'),{status:400});
  if(['reviews','instagram'].includes(type)&&!clean(data.title||data.text||data.caption,500)) throw Object.assign(new Error('Content title/text is required'),{status:400});
  if(JSON.stringify(data).length>MAX_JSON) throw Object.assign(new Error('Content too large'),{status:400});
}
function filename(type,id,data) {
  const safe=String(id||data.slug||data.title||'content').toLocaleLowerCase('tr-TR').replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!idOk(safe)) throw Object.assign(new Error('Invalid content id'),{status:400});
  return COLLECTIONS[type]+'/'+safe+'.json';
}
async function audit(store,entry) {
  const key='audit/'+now().replace(/[:.]/g,'-')+'-'+randomBytes(6).toString('hex');
  await store.setJSON(key,{at:now(),...entry},{metadata:{action:entry.action,type:entry.type||'',actor:entry.actor||''}});
}
async function backup(store,item,actor,action) {
  const key='backup/'+hash(item.path).slice(0,24)+'/'+now().replace(/[:.]/g,'-')+'-'+randomBytes(5).toString('hex');
  await store.setJSON(key,{path:item.path,sha:item.sha,data:item.data,at:now(),actor:actor.id,action},{metadata:{pathHash:hash(item.path).slice(0,24),action}});
  return key;
}
async function rate(store,actor) {
  const bucket='rate/'+actor.tokenHash.slice(0,24)+'/'+Math.floor(Date.now()/60000);
  const state=await store.get(bucket,{type:'json',consistency:'strong'})||{count:0};
  if(state.count>=Number(process.env.WORK_ADMIN_RATE_LIMIT||60)) throw Object.assign(new Error('Rate limit exceeded'),{status:429});
  await store.setJSON(bucket,{count:state.count+1},{metadata:{expiresAt:Date.now()+120000}});
}
function actionPermission(action) {
  return ({list:'content:read',get:'content:read',create:'content:create',update:'content:update',publish:'content:publish',schedule:'content:schedule',unpublish:'content:unpublish',trash:'content:trash',restore:'content:restore',permanentDelete:'content:permanent-delete',permanentDeleteChallenge:'content:permanent-delete',audit:'audit:read',verify:'deployment:read',mediaList:'media:read',mediaCreate:'media:create'})[action]||'';
}
async function verify(data) {
  const site=String(process.env.URL||process.env.DEPLOY_PRIME_URL||'').replace(/\/$/,'');
  if(!site) return {verified:false,reason:'Site URL is unavailable'};
  const res=await fetch(site+'/assets/data/content-manifest.json',{cache:'no-store'});
  if(!res.ok) return {verified:false,reason:'Content manifest unavailable',status:res.status};
  const manifest=await res.json(); const id=clean(data.id,180);
  const found=JSON.stringify(manifest).includes(id);
  return {verified:found,site,manifestUpdatedAt:manifest.generatedAt||null};
}

export default async request => {
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{Allow:'GET, POST, OPTIONS'}});
  if(!['GET','POST'].includes(request.method)) return json({error:'Method not allowed'},405);
  if(!originOk(request)) return json({error:'Untrusted origin'},403);
  const actor=auth(request); if(!actor) return json({error:'Unauthorized'},401);
  const store=getStore({name:STORE,consistency:'strong'});
  try {
    await rate(store,actor);
    const url=new URL(request.url); const body=request.method==='POST'?await request.json().catch(()=>null):{};
    if(request.method==='POST'&&!body) return json({error:'Invalid JSON'},400);
    const action=clean(body?.action||url.searchParams.get('action'),80);
    const permission=actionPermission(action); if(!permission) return json({error:'Unknown action'},400);
    if(!need(actor,permission)) return json({error:'Forbidden'},403);
    const type=clean(body?.type||url.searchParams.get('type'),60);
    if(action==='audit') {
      const {blobs}=await store.list({prefix:'audit/'});
      const rows=(await Promise.all(blobs.slice(-Math.min(Number(url.searchParams.get('limit')||50),100)).map(x=>store.get(x.key,{type:'json',consistency:'strong'})))).filter(Boolean).reverse();
      return json({audit:rows});
    }
    if(action==='verify') return json(await verify(body||{}));
    if(action==='mediaList') {
      const rows=await gh('assets/img/uploads?ref='+encodeURIComponent(BRANCH));
      return json({media:(Array.isArray(rows)?rows:[]).filter(x=>/\.(png|jpe?g|webp|gif)$/i.test(x.name)).map(x=>({path:x.path,size:x.size,sha:x.sha}))});
    }
    if(action==='mediaCreate') {
      const name=clean(body.name,120).toLowerCase().replace(/[^a-z0-9._-]/g,'-');
      const ext=(name.match(/\.(png|jpe?g|webp|gif)$/)||[])[1]; const bytes=Buffer.from(String(body.base64||''),'base64');
      if(!ext||!bytes.length||bytes.length>MAX_MEDIA) return json({error:'Invalid media file'},400);
      const path='assets/img/uploads/work/'+name;
      await gh(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Work API: media upload',content:bytes.toString('base64'),branch:BRANCH})});
      await audit(store,{action,type:'media',path,actor:actor.id,result:'success'}); return json({path},201);
    }
    if(!Object.hasOwn(COLLECTIONS,type)&&!Object.hasOwn(DOCUMENTS,type)) return json({error:'Invalid content type'},400);
    if(action==='list') {
      if(DOCUMENTS[type]) { const item=await readFile(DOCUMENTS[type]); return json({items:[{id:type,path:item.path,sha:item.sha,data:item.data}]}); }
      const rows=await listDir(COLLECTIONS[type]); const q=clean(url.searchParams.get('q'),120).toLocaleLowerCase('tr-TR'); const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||30),1),100);
      const hydrated=await Promise.all(rows.map(async r=>{const x=await readFile(r.path);return {id:r.id,path:r.path,sha:x.sha,data:x.data};}));
      const filtered=hydrated.filter(x=>!q||JSON.stringify(x.data).toLocaleLowerCase('tr-TR').includes(q)).slice(0,limit);
      return json({items:filtered,nextCursor:filtered.length===limit?filtered[filtered.length-1].id:null});
    }
    let item;
    if(DOCUMENTS[type]) item=await readFile(DOCUMENTS[type]); else {
      const id=clean(body?.id||url.searchParams.get('id'),180);
      if(action==='create') item={path:filename(type,id,body.data),sha:'',data:null}; else item=await readFile(filename(type,id,{}));
    }
    if(action==='get') return json({id:clean(body?.id||url.searchParams.get('id')||type),...item,published:item.data?.published===true,trashed:item.data?.trashed===true});
    if(action==='create') {
      validate(type,body.data); try { await readFile(item.path); return json({error:'Content id already exists'},409); } catch(e) { if(e.status!==404) throw e; }
      const data={...body.data,published:false,trashed:false,archived:false,createdAt:now(),updatedAt:now()};
      const out=await writeFile(item.path,data,'','Work API: create '+type);
      await audit(store,{action,type,path:item.path,actor:actor.id,nextSha:out.sha,commitSha:out.commitSha,result:'success'});
      return json({id:clean(body.id),path:item.path,sha:out.sha,commitSha:out.commitSha,data},201);
    }
    if(['update','publish','schedule','unpublish','trash','restore','permanentDeleteChallenge','permanentDelete'].includes(action)) {
      if(body.sha&&body.sha!==item.sha) return json({error:'Stale write conflict',currentSha:item.sha},409);
      if(action==='permanentDeleteChallenge') {
        if(!item.data?.trashed) return json({error:'Only trashed content can be permanently deleted'},400);
        const secret=randomBytes(24).toString('base64url'),challengeId=randomBytes(16).toString('hex');
        await store.setJSON('challenge/'+challengeId,{path:item.path,sha:item.sha,secretHash:hash(secret),expiresAt:Date.now()+300000,actor:actor.id},{metadata:{expiresAt:Date.now()+300000}});
        return json({challengeId,confirmation:'PERMANENT DELETE '+clean(body.id||type),confirmationToken:secret,expiresInSeconds:300});
      }
      if(action==='permanentDelete') {
        const c=await store.get('challenge/'+clean(body.challengeId,80),{type:'json',consistency:'strong'});
        if(!c||c.expiresAt<Date.now()||c.path!==item.path||c.sha!==item.sha||c.actor!==actor.id||c.secretHash!==hash(body.confirmationToken)||clean(body.confirmation,200)!=='PERMANENT DELETE '+clean(body.id||type)) return json({error:'Invalid permanent delete confirmation'},403);
        const backupId=await backup(store,item,actor,action); const out=await removeFile(item.path,item.sha,'Work API: permanent delete '+type);
        await store.delete('challenge/'+clean(body.challengeId,80)); await audit(store,{action,type,path:item.path,actor:actor.id,previousSha:item.sha,commitSha:out.commit?.sha||'',backupId,result:'success'});
        return json({deleted:true,backupId});
      }
      const data=structuredClone(item.data); const previousSha=item.sha; const backupId=await backup(store,item,actor,action);
      if(action==='update') { validate(type,body.data); Object.assign(data,body.data,{updatedAt:now()}); }
      if(action==='publish') { data.published=true;data.trashed=false;data.archived=false;data.date=data.date||now(); }
      if(action==='schedule') { const at=clean(body.publishAt||body.scheduledAt,40); if(!Number.isFinite(Date.parse(at))) return json({error:'Invalid schedule time; use ISO-8601 Europe/Istanbul time'},400); data.published=true;data.publishAt=at;data.scheduledAt=at; }
      if(action==='unpublish') data.published=false;
      if(action==='trash') {data.published=false;data.trashed=true;}
      if(action==='restore') {data.published=false;data.trashed=false;data.archived=false;}
      const out=await writeFile(item.path,data,item.sha,'Work API: '+action+' '+type);
      await audit(store,{action,type,path:item.path,actor:actor.id,previousSha,nextSha:out.sha,commitSha:out.commitSha,backupId,result:'success'});
      return json({id:clean(body.id||type),path:item.path,sha:out.sha,commitSha:out.commitSha,backupId,data});
    }
    return json({error:'Unsupported action'},400);
  } catch(error) {
    const status=Number(error.status)||500; try{await audit(store,{action:'error',actor:actor.id,result:'error',error:clean(error.message,300)})}catch{}
    return json({error:clean(error.message,400)},status);
  }
};
export const config={path:'/.netlify/functions/work-admin',rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip','domain']}};
