import { randomBytes } from "node:crypto";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import {
  consumeOAuthState,
  deleteOAuthSecret,
  loadOAuthSecret,
  saveOAuthSecret,
  saveOAuthState
} from "./_shared/publisher-oauth-store.mjs";

const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
const allowedEmails=()=>String(process.env.ADMIN_EMAILS||"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
const clean=(v,max=2000)=>String(v??"").replace(/[\u0000-\u001F\u007F]/g,"").trim().slice(0,max);
const graphVersion=()=>clean(process.env.META_GRAPH_VERSION||"v26.0",20);
const normalize=value=>String(value||"").toLocaleLowerCase("tr-TR").replace(/ç/g,"c").replace(/ğ/g,"g").replace(/ı/g,"i").replace(/ö/g,"o").replace(/ş/g,"s").replace(/ü/g,"u");

async function authorize(){
  const user=await getUser();
  if(!user) return {error:json({error:"Giriş gerekli"},401)};
  const roles=Array.isArray(user.roles)?user.roles:[];
  const allowed=roles.some(role=>["admin","editor","yayin"].includes(role))||allowedEmails().includes(String(user.email||"").toLowerCase());
  if(!allowed) return {error:json({error:"Bu hesap bağlantı yönetmeye yetkili değil"},403)};
  return {user};
}

function callbackUrl(request){
  return new URL("/.netlify/functions/publisher-oauth?action=callback",request.url).toString();
}
function adminUrl(request,params={}){
  const u=new URL("/admin/yayin.html",request.url);
  for(const [k,v] of Object.entries(params)) if(v!=null) u.searchParams.set(k,String(v));
  return u.toString();
}
function redirect(url){ return new Response(null,{status:302,headers:{Location:url,"Cache-Control":"no-store"}}); }

async function googleStart(request,user){
  const clientId=clean(process.env.GOOGLE_OAUTH_CLIENT_ID,500);
  const clientSecret=clean(process.env.GOOGLE_OAUTH_CLIENT_SECRET,500);
  if(!clientId||!clientSecret) return json({error:"Google OAuth uygulama bilgileri henüz yapılandırılmamış",code:"GOOGLE_APP_MISSING"},409);
  const state=randomBytes(24).toString("base64url");
  await saveOAuthState(state,{provider:"google",actor:user.email||user.id||"yetkili",createdAt:Date.now()});
  const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id",clientId);
  u.searchParams.set("redirect_uri",callbackUrl(request));
  u.searchParams.set("response_type","code");
  u.searchParams.set("access_type","offline");
  u.searchParams.set("prompt","consent");
  u.searchParams.set("include_granted_scopes","true");
  u.searchParams.set("scope",[
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/business.manage"
  ].join(" "));
  u.searchParams.set("state",state);
  return json({url:u.toString()});
}

async function metaStart(request,user){
  const appId=clean(process.env.META_APP_ID,500);
  const appSecret=clean(process.env.META_APP_SECRET,500);
  if(!appId||!appSecret) return json({error:"Meta uygulama bilgileri henüz yapılandırılmamış",code:"META_APP_MISSING"},409);
  const state=randomBytes(24).toString("base64url");
  await saveOAuthState(state,{provider:"meta",actor:user.email||user.id||"yetkili",createdAt:Date.now()});
  const u=new URL("https://www.facebook.com/"+graphVersion()+"/dialog/oauth");
  u.searchParams.set("client_id",appId);
  u.searchParams.set("redirect_uri",callbackUrl(request));
  u.searchParams.set("response_type","code");
  u.searchParams.set("state",state);
  u.searchParams.set("scope",[
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish"
  ].join(","));
  return json({url:u.toString()});
}

async function googleToken(code,request){
  const body=new URLSearchParams({
    code,
    client_id:process.env.GOOGLE_OAUTH_CLIENT_ID||"",
    client_secret:process.env.GOOGLE_OAUTH_CLIENT_SECRET||"",
    redirect_uri:callbackUrl(request),
    grant_type:"authorization_code"
  });
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.access_token) throw new Error(data.error_description||data.error||"Google yetkilendirmesi tamamlanamadı");
  return data;
}

async function discoverGbp(accessToken){
  const headers={Authorization:"Bearer "+accessToken,Accept:"application/json","X-GOOG-API-FORMAT-VERSION":"2"};
  const accountsRes=await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts",{headers,cache:"no-store"});
  const accountsData=await accountsRes.json().catch(()=>({}));
  if(!accountsRes.ok) return {ready:false,error:(accountsData.error&&accountsData.error.message)||"GBP hesapları alınamadı"};
  const accounts=Array.isArray(accountsData.accounts)?accountsData.accounts:[];
  const candidates=[];
  for(const account of accounts.slice(0,20)){
    const accountName=clean(account.name,200);
    if(!accountName) continue;
    const url="https://mybusinessbusinessinformation.googleapis.com/v1/"+accountName+"/locations?readMask=name,title,websiteUri&location="+Date.now();
    const response=await fetch(url,{headers,cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) continue;
    for(const location of (Array.isArray(data.locations)?data.locations:[])){
      candidates.push({
        accountName,
        accountId:accountName.replace(/^accounts\//,""),
        locationName:clean(location.name,200),
        locationId:clean(location.name,200).replace(/^locations\//,""),
        title:clean(location.title,300),
        websiteUri:clean(location.websiteUri,1000)
      });
    }
  }
  let selected=candidates.find(x=>normalize(x.title)==="elci veteriner klinigi");
  if(!selected&&candidates.length===1) selected=candidates[0];
  return selected?{ready:true,selected,candidates}:{ready:false,candidates,error:candidates.length?"GBP konumu seçilmeli":"GBP konumu bulunamadı"};
}

async function metaExchange(code,request){
  const base="https://graph.facebook.com/"+graphVersion();
  const first=new URL(base+"/oauth/access_token");
  first.searchParams.set("client_id",process.env.META_APP_ID||"");
  first.searchParams.set("client_secret",process.env.META_APP_SECRET||"");
  first.searchParams.set("redirect_uri",callbackUrl(request));
  first.searchParams.set("code",code);
  const firstRes=await fetch(first,{cache:"no-store"});
  const short=await firstRes.json().catch(()=>({}));
  if(!firstRes.ok||!short.access_token) throw new Error((short.error&&short.error.message)||"Meta yetkilendirmesi tamamlanamadı");

  const longUrl=new URL(base+"/oauth/access_token");
  longUrl.searchParams.set("grant_type","fb_exchange_token");
  longUrl.searchParams.set("client_id",process.env.META_APP_ID||"");
  longUrl.searchParams.set("client_secret",process.env.META_APP_SECRET||"");
  longUrl.searchParams.set("fb_exchange_token",short.access_token);
  const longRes=await fetch(longUrl,{cache:"no-store"});
  const longData=await longRes.json().catch(()=>({}));
  const userToken=longData.access_token||short.access_token;

  const pagesUrl=new URL(base+"/me/accounts");
  pagesUrl.searchParams.set("fields","id,name,access_token,instagram_business_account{id,username}");
  pagesUrl.searchParams.set("limit","100");
  pagesUrl.searchParams.set("access_token",userToken);
  const pagesRes=await fetch(pagesUrl,{cache:"no-store"});
  const pagesData=await pagesRes.json().catch(()=>({}));
  if(!pagesRes.ok) throw new Error((pagesData.error&&pagesData.error.message)||"Facebook sayfaları alınamadı");

  const pages=(Array.isArray(pagesData.data)?pagesData.data:[]).map(page=>({
    id:clean(page.id,120),
    name:clean(page.name,300),
    pageAccessToken:clean(page.access_token,5000),
    instagramBusinessAccountId:clean(page.instagram_business_account&&page.instagram_business_account.id,120),
    instagramUsername:clean(page.instagram_business_account&&page.instagram_business_account.username,300)
  })).filter(page=>page.id&&page.pageAccessToken);
  const exact=pages.filter(page=>normalize(page.name).includes("elci veteriner"));
  const selected=exact.length===1?exact[0]:(pages.length===1?pages[0]:null);
  return {userToken,pages,selected};
}

async function callback(request){
  const url=new URL(request.url);
  const state=clean(url.searchParams.get("state"),200);
  const code=clean(url.searchParams.get("code"),5000);
  const oauthError=clean(url.searchParams.get("error"),500);
  const stateData=await consumeOAuthState(state);
  if(!stateData) return redirect(adminUrl(request,{oauth:"error",reason:"state"}));
  if(oauthError||!code) return redirect(adminUrl(request,{oauth:"cancelled",provider:stateData.provider}));

  try{
    if(stateData.provider==="google"){
      const token=await googleToken(code,request);
      const existing=await loadOAuthSecret("google");
      const refreshToken=token.refresh_token||(existing&&existing.refreshToken)||"";
      if(!refreshToken) throw new Error("Google refresh token vermedi; bağlantıyı yeniden onaylamak gerekiyor");
      const gbp=await discoverGbp(token.access_token);
      await saveOAuthSecret("google",{
        refreshToken,
        scope:clean(token.scope,5000),
        connectedAt:new Date().toISOString(),
        actor:stateData.actor,
        gbp
      },{provider:"google"});
      return redirect(adminUrl(request,{oauth:"ok",provider:"google"}));
    }
    if(stateData.provider==="meta"){
      const meta=await metaExchange(code,request);
      await saveOAuthSecret("meta",{
        userToken:meta.userToken,
        pages:meta.pages,
        selectedPage:meta.selected,
        connectedAt:new Date().toISOString(),
        actor:stateData.actor
      },{provider:"meta"});
      return redirect(adminUrl(request,{oauth:"ok",provider:"meta",select:meta.selected?"0":"1"}));
    }
    return redirect(adminUrl(request,{oauth:"error",reason:"provider"}));
  }catch(error){
    await saveOAuthSecret("last-error",{provider:stateData.provider,message:clean(error?.message||"OAuth hatası",1000),at:new Date().toISOString()});
    return redirect(adminUrl(request,{oauth:"error",provider:stateData.provider}));
  }
}

async function status(){
  const [google,meta,lastError]=await Promise.all([
    loadOAuthSecret("google"),
    loadOAuthSecret("meta"),
    loadOAuthSecret("last-error")
  ]);
  return {
    google:{
      connected:Boolean(google?.refreshToken),
      connectedAt:google?.connectedAt||null,
      scopes:clean(google?.scope,5000),
      gbpReady:Boolean(google?.gbp?.ready&&google?.gbp?.selected),
      gbp:google?.gbp?.selected?{
        title:google.gbp.selected.title,
        websiteUri:google.gbp.selected.websiteUri,
        accountId:google.gbp.selected.accountId,
        locationId:google.gbp.selected.locationId
      }:null,
      gbpError:google?.gbp?.ready?null:(google?.gbp?.error||null)
    },
    meta:{
      connected:Boolean(meta?.userToken),
      connectedAt:meta?.connectedAt||null,
      selectedPage:meta?.selectedPage?{
        id:meta.selectedPage.id,
        name:meta.selectedPage.name,
        instagramBusinessAccountId:meta.selectedPage.instagramBusinessAccountId,
        instagramUsername:meta.selectedPage.instagramUsername
      }:null,
      pages:(meta?.pages||[]).map(page=>({
        id:page.id,
        name:page.name,
        instagramBusinessAccountId:page.instagramBusinessAccountId,
        instagramUsername:page.instagramUsername
      }))
    },
    lastError:lastError?.message?{provider:lastError.provider,message:lastError.message,at:lastError.at}:null,
    appSetup:{
      google:Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET),
      meta:Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET),
      encryption:Boolean(process.env.PUBLISHER_TOKEN_ENCRYPTION_KEY)
    }
  };
}

async function selectMeta(body){
  const meta=await loadOAuthSecret("meta");
  if(!meta?.userToken) return json({error:"Meta hesabı bağlı değil"},409);
  const id=clean(body.pageId,120);
  const selected=(meta.pages||[]).find(page=>page.id===id);
  if(!selected) return json({error:"Seçilen Facebook sayfası bulunamadı"},404);
  meta.selectedPage=selected;
  meta.selectedAt=new Date().toISOString();
  await saveOAuthSecret("meta",meta,{provider:"meta"});
  return json({ok:true,page:{id:selected.id,name:selected.name,instagramUsername:selected.instagramUsername||""}});
}

async function disconnect(provider){
  if(provider==="google") await deleteOAuthSecret("google");
  else if(provider==="meta") await deleteOAuthSecret("meta");
  else return json({error:"Geçersiz sağlayıcı"},400);
  return json({ok:true});
}

export default async request=>{
  const url=new URL(request.url);
  const action=clean(url.searchParams.get("action"),80);
  if(action==="callback") return callback(request);

  const auth=await authorize();
  if(auth.error) return auth.error;

  if(request.method==="GET"&&action==="status") return json(await status());
  if(request.method==="POST"){
    try{verifyRequestOrigin(request)}catch{return json({error:"Geçersiz istek kaynağı"},403)}
    const body=await request.json().catch(()=>({}));
    if(action==="start"){
      if(body.provider==="google") return googleStart(request,auth.user);
      if(body.provider==="meta") return metaStart(request,auth.user);
      return json({error:"Geçersiz sağlayıcı"},400);
    }
    if(action==="select-meta") return selectMeta(body);
    if(action==="disconnect") return disconnect(clean(body.provider,40));
  }
  return json({error:"Desteklenmeyen işlem"},405);
};

export const config={
  path:"/.netlify/functions/publisher-oauth",
  rateLimit:{windowLimit:60,windowSize:60,aggregateBy:["ip","domain"]}
};
