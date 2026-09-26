import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { loadOAuthSecret } from "./_shared/publisher-oauth-store.mjs";

const RUNTIME_API = "https://elci-content-api.elcivetklinik.workers.dev";
const MAX_REMOTE_MEDIA = 80 * 1024 * 1024;
const PUBLISH_STORE_NAME = "elci-publisher-v1";

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: {
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff"
  }
});

const clean = (value, max = 5000) => String(value ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
  .trim()
  .slice(0, max);

const allowedEmails = () => String(process.env.ADMIN_EMAILS || "")
  .split(",").map(v => v.trim().toLowerCase()).filter(Boolean);

async function authorize() {
  const user = await getUser();
  if (!user) return { error: json({ error: "Giriş gerekli" }, 401) };
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const allowed = roles.some(role => ["admin", "editor", "yayin"].includes(role))
    || allowedEmails().includes(String(user.email || "").toLowerCase());
  if (!allowed) return { error: json({ error: "Bu hesap yayın yapmaya yetkili değil" }, 403) };
  return { user };
}

const envReady = (...names) => names.every(name => Boolean(String(process.env[name] || "").trim()));
const mediaKind = url => {
  const value = String(url || "").toLowerCase().split("?")[0];
  if (/\.(mp4|mov|m4v|webm)$/.test(value)) return "video";
  if (/\.(jpg|jpeg|png|webp)$/.test(value)) return "image";
  return url ? "unknown" : "none";
};

async function connectionSecrets() {
  const [meta,google] = await Promise.all([
    loadOAuthSecret("meta"),
    loadOAuthSecret("google")
  ]);
  return {meta,google};
}

async function channelStatus() {
  const {meta,google}=await connectionSecrets();
  const selectedMeta=meta?.selectedPage||null;
  const facebookReady=Boolean(selectedMeta?.id&&selectedMeta?.pageAccessToken);
  const instagramReady=Boolean(facebookReady&&selectedMeta?.instagramBusinessAccountId);
  const googleReady=Boolean(google?.refreshToken);
  const gbpReady=Boolean(googleReady&&google?.gbp?.ready&&google?.gbp?.selected?.accountId&&google?.gbp?.selected?.locationId);
  return {
    website: {
      ready: envReady("ELCI_RUNTIME_ADMIN_TOKEN"),
      label: "Web sitesi",
      detail: envReady("ELCI_RUNTIME_ADMIN_TOKEN") ? "Runtime CMS bağlı" : "Runtime CMS anahtarı eksik"
    },
    facebook: {
      ready: facebookReady,
      label: "Facebook",
      detail: facebookReady ? "Meta Sayfası OAuth ile bağlı" : "Meta bağlantısı bekleniyor"
    },
    instagram: {
      ready: instagramReady,
      label: "Instagram",
      detail: instagramReady ? "Instagram Professional OAuth ile bağlı" : (facebookReady ? "Bağlı sayfada Instagram Professional hesabı yok" : "Instagram bağlantısı bekleniyor")
    },
    youtube: {
      ready: googleReady,
      label: "YouTube",
      detail: googleReady ? "Google OAuth bağlı" : "YouTube OAuth bağlantısı bekleniyor"
    },
    gmb: {
      ready: gbpReady,
      label: "Google İşletme",
      detail: gbpReady ? "GBP API ve konum bağlı" : (googleReady ? (google?.gbp?.error || "GBP API erişimi/onayı bekleniyor") : "Google OAuth bağlantısı bekleniyor")
    }
  };
}

const slugify = value => String(value || "yayin")
  .toLocaleLowerCase("tr-TR")
  .replace(/ç/g,"c").replace(/ğ/g,"g").replace(/ı/g,"i").replace(/ö/g,"o").replace(/ş/g,"s").replace(/ü/g,"u")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80) || "yayin";

async function runtimeCall(path, body) {
  const token = process.env.ELCI_RUNTIME_ADMIN_TOKEN;
  if (!token) throw new Error("Runtime CMS bağlantısı yok");
  const response = await fetch(RUNTIME_API + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Runtime CMS işlemi başarısız");
  return data;
}

async function publishWebsite(payload) {
  const slug = slugify(payload.title) + "-" + Date.now().toString(36);
  const now = new Date().toISOString();
  const data = {
    title: payload.title,
    message: payload.text,
    publishAt: now,
    unpublishAt: null,
    source: "elci-yayin-merkezi",
    mediaUrl: payload.mediaUrl || ""
  };
  await runtimeCall("/admin/create", { type: "announcements", slug, data });
  await runtimeCall("/admin/publish", { type: "announcements", slug, publish_at: now, unpublish_at: null });
  return { id: slug };
}

const metaBase = () => "https://graph.facebook.com/" + encodeURIComponent(clean(process.env.META_GRAPH_VERSION || "v26.0",20));

async function metaCredentials() {
  const meta=await loadOAuthSecret("meta");
  const selected=meta?.selectedPage||null;
  return {
    pageId:clean(selected?.id || process.env.META_PAGE_ID,120),
    pageAccessToken:clean(selected?.pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN,5000),
    instagramBusinessAccountId:clean(selected?.instagramBusinessAccountId || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,120)
  };
}

async function metaPost(path, params, accessToken) {
  const body = new URLSearchParams({ ...params, access_token: accessToken || "" });
  const response = await fetch(metaBase() + "/" + path, { method:"POST", body, cache:"no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error((data.error && data.error.message) || "Meta API işlemi başarısız");
  return data;
}

async function publishFacebook(payload) {
  const credentials=await metaCredentials();
  const pageId = credentials.pageId;
  if(!pageId||!credentials.pageAccessToken) throw new Error("Facebook bağlantısı yok");
  const kind = mediaKind(payload.mediaUrl);
  if (kind === "image") {
    const data = await metaPost(pageId + "/photos", { url:payload.mediaUrl, caption:payload.text },credentials.pageAccessToken);
    return { id:data.post_id || data.id || "" };
  }
  if (kind === "video") {
    const data = await metaPost(pageId + "/videos", { file_url:payload.mediaUrl, description:payload.text, title:payload.title },credentials.pageAccessToken);
    return { id:data.id || "" };
  }
  const params = { message:payload.text };
  if (payload.mediaUrl) params.link = payload.mediaUrl;
  const data = await metaPost(pageId + "/feed", params,credentials.pageAccessToken);
  return { id:data.id || "" };
}

async function waitInstagramContainer(id,accessToken) {
  for (let i=0;i<12;i++) {
    const url = metaBase() + "/" + encodeURIComponent(id) + "?fields=status_code,status&access_token=" + encodeURIComponent(accessToken || "");
    const response = await fetch(url,{cache:"no-store"});
    const data = await response.json().catch(() => ({}));
    if (data.status_code === "FINISHED") return;
    if (["ERROR","EXPIRED"].includes(data.status_code)) throw new Error(data.status || "Instagram medya işleme hatası");
    await new Promise(resolve => setTimeout(resolve,1500));
  }
  throw new Error("Instagram medya işlemesi zaman aşımına uğradı");
}

async function publishInstagram(payload) {
  const credentials=await metaCredentials();
  const accountId = credentials.instagramBusinessAccountId;
  if(!accountId||!credentials.pageAccessToken) throw new Error("Instagram bağlantısı yok");
  const kind = mediaKind(payload.mediaUrl);
  if (!payload.mediaUrl || !["image","video"].includes(kind)) throw new Error("Instagram için görsel veya video URL'si gerekli");
  const create = kind === "video"
    ? await metaPost(accountId + "/media", { media_type:"REELS", video_url:payload.mediaUrl, caption:payload.text },credentials.pageAccessToken)
    : await metaPost(accountId + "/media", { image_url:payload.mediaUrl, caption:payload.text },credentials.pageAccessToken);
  if (!create.id) throw new Error("Instagram medya kapsayıcısı oluşturulamadı");
  if (kind === "video") await waitInstagramContainer(create.id,credentials.pageAccessToken);
  const published = await metaPost(accountId + "/media_publish",{ creation_id:create.id },credentials.pageAccessToken);
  return { id:published.id || "" };
}

async function googleAccessToken() {
  const google=await loadOAuthSecret("google");
  const refreshToken=clean(google?.refreshToken || process.env.GOOGLE_OAUTH_REFRESH_TOKEN,5000);
  if(!refreshToken) throw new Error("Google hesabı bağlı değil");
  const body = new URLSearchParams({
    client_id:process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    client_secret:process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
    refresh_token:refreshToken,
    grant_type:"refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token",{method:"POST",body,cache:"no-store"});
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Google OAuth yenilenemedi");
  return data.access_token;
}

async function publishGmb(payload) {
  const token = await googleAccessToken();
  const google=await loadOAuthSecret("google");
  const accountId = clean(google?.gbp?.selected?.accountId || process.env.GBP_ACCOUNT_ID,120);
  const locationId = clean(google?.gbp?.selected?.locationId || process.env.GBP_LOCATION_ID,120);
  if(!accountId||!locationId) throw new Error("Google İşletme konumu bağlı değil");
  const body = { languageCode:"tr-TR", summary:payload.text.slice(0,1500), topicType:"STANDARD" };
  if (payload.mediaUrl && mediaKind(payload.mediaUrl) === "image") {
    body.media = [{ mediaFormat:"PHOTO", sourceUrl:payload.mediaUrl }];
  }
  const url = "https://mybusiness.googleapis.com/v4/accounts/" + encodeURIComponent(accountId) + "/locations/" + encodeURIComponent(locationId) + "/localPosts";
  const response = await fetch(url,{
    method:"POST",
    headers:{Authorization:"Bearer " + token,"Content-Type":"application/json",Accept:"application/json"},
    body:JSON.stringify(body),
    cache:"no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data.error && data.error.message) || "Google İşletme yayını başarısız");
  return { id:data.name || data.searchUrl || "" };
}

async function publishYouTube(payload) {
  if (mediaKind(payload.mediaUrl) !== "video") throw new Error("YouTube için video URL'si gerekli");
  const token = await googleAccessToken();
  const media = await fetch(payload.mediaUrl,{cache:"no-store"});
  if (!media.ok || !media.body) throw new Error("Video indirilemedi");
  const mediaType = media.headers.get("content-type") || "video/mp4";
  const length = Number(media.headers.get("content-length") || 0);
  if (length && length > MAX_REMOTE_MEDIA) throw new Error("YouTube doğrudan yükleme için video 80 MB sınırını aşıyor");

  const metadata = {
    snippet:{title:payload.title.slice(0,100),description:payload.text,categoryId:"15"},
    status:{privacyStatus:payload.youtubePrivacy || "public",selfDeclaredMadeForKids:false}
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{
    method:"POST",
    headers:{
      Authorization:"Bearer " + token,
      "Content-Type":"application/json; charset=UTF-8",
      "X-Upload-Content-Type":mediaType,
      ...(length ? {"X-Upload-Content-Length":String(length)} : {})
    },
    body:JSON.stringify(metadata),
    cache:"no-store"
  });
  if (!init.ok) {
    const error = await init.json().catch(() => ({}));
    throw new Error((error.error && error.error.message) || "YouTube yükleme oturumu açılamadı");
  }
  const location = init.headers.get("location");
  if (!location) throw new Error("YouTube yükleme URL'si alınamadı");
  const headers = {"Content-Type":mediaType};
  if (length) headers["Content-Length"] = String(length);
  const upload = await fetch(location,{method:"PUT",headers,body:media.body,duplex:"half"});
  const data = await upload.json().catch(() => ({}));
  if (!upload.ok) throw new Error((data.error && data.error.message) || "YouTube video yükleme başarısız");
  return { id:data.id || "" };
}

const adapters = {
  website:publishWebsite,
  facebook:publishFacebook,
  instagram:publishInstagram,
  youtube:publishYouTube,
  gmb:publishGmb
};

const publicationStore = () => getStore({name:PUBLISH_STORE_NAME,consistency:"strong"});

async function publicationHistory(limit=12) {
  const store = publicationStore();
  const {blobs} = await store.list({prefix:"publication/"});
  const rows = (await Promise.all(blobs.slice(-100).map(async item => {
    try { return await store.get(item.key,{type:"json",consistency:"strong"}); }
    catch { return null; }
  }))).filter(Boolean);
  return rows.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,limit);
}

async function publicationRead(id) {
  if (!/^[0-9a-f-]{20,80}$/i.test(String(id||""))) return null;
  return publicationStore().get("publication/" + id,{type:"json",consistency:"strong"});
}

async function publicationSave(record) {
  await publicationStore().setJSON("publication/" + record.id,record,{
    metadata:{createdAt:record.createdAt,actor:record.actor || "",complete:Boolean(record.complete)}
  });
}

export default async request => {
  const auth = await authorize();
  if (auth.error) return auth.error;

  if (request.method === "GET") return json({
    channels:await channelStatus(),
    mode:"one-click-publisher-v2",
    history:await publicationHistory(12)
  });
  if (request.method !== "POST") return json({error:"Desteklenmeyen yöntem"},405);

  try { verifyRequestOrigin(request); }
  catch { return json({error:"Geçersiz istek kaynağı"},403); }

  let body;
  try { body = await request.json(); }
  catch { return json({error:"Geçersiz veri"},400); }

  const retryOf = clean(body.retryPublicationId,80);
  const previous = retryOf ? await publicationRead(retryOf) : null;
  if (retryOf && !previous) return json({error:"Yeniden denenecek yayın kaydı bulunamadı"},404);

  const payload = previous ? previous.payload : {
    title:clean(body.title,180),
    text:clean(body.text,5000),
    mediaUrl:clean(body.mediaUrl,2000),
    youtubePrivacy:["public","unlisted","private"].includes(body.youtubePrivacy) ? body.youtubePrivacy : "public"
  };
  if (!payload.title || !payload.text) return json({error:"Başlık ve yayın metni gerekli"},400);

  const requested = Array.isArray(body.channels) ? body.channels.filter(x => Object.hasOwn(adapters,x)) : [];
  if (!requested.length) return json({error:"En az bir yayın kanalı seçin"},400);

  const status = await channelStatus();
  const results = await Promise.all(requested.map(async channel => {
    if (!status[channel]?.ready) return {channel,ok:false,skipped:true,error:status[channel]?.detail || "Kanal bağlı değil"};
    try {
      const output = await adapters[channel](payload);
      return {channel,ok:true,...output};
    } catch (error) {
      return {channel,ok:false,error:clean(error?.message || "Yayın başarısız",500)};
    }
  }));

  const createdAt = new Date().toISOString();
  const record = {
    id:randomUUID(),
    retryOf:retryOf || null,
    actor:auth.user.email || auth.user.id || "yetkili",
    payload,
    channels:requested,
    results,
    ok:results.some(x => x.ok),
    complete:results.every(x => x.ok),
    createdAt
  };
  await publicationSave(record);

  return json({
    ok:record.ok,
    complete:record.complete,
    results,
    publicationId:record.id,
    publishedAt:createdAt
  });
};

export const config = {
  path:"/.netlify/functions/publisher",
  rateLimit:{windowLimit:30,windowSize:60,aggregateBy:["ip","domain"]}
};
