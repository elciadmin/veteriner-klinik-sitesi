import { safeRemoteMediaUrl } from "./_shared/publisher-media-url.mjs";
import { randomUUID } from "node:crypto";
import { listSchedules, cancelSchedule } from "./_shared/publisher-schedule.mjs";
import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { loadOAuthSecret } from "./_shared/publisher-oauth-store.mjs";
import { PUBLISHER_RULES, effectiveChannelPayload, validatePublisherPayload } from "./_shared/publisher-rules.mjs";

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
  if (!url) return "none";
  let value = String(url).toLowerCase().split("?")[0];
  // The internal uploader uses ?id=<uuid>.mp4; its pathname has no extension.
  // Respect that ID only for our own media endpoint, not for arbitrary URLs.
  try {
    const parsed = new URL(String(url));
    if (parsed.pathname === "/.netlify/functions/publisher-media") {
      const uploadedId = parsed.searchParams.get("id") || "";
      if (/^[0-9a-z._-]{8,180}$/i.test(uploadedId)) value = uploadedId.toLowerCase();
    }
  } catch { /* Keep the pathname-only fallback for malformed URLs. */ }
  if (/\.(mp4|mov|m4v|webm)$/.test(value)) return "video";
  if (/\.(jpg|jpeg|png|webp)$/.test(value)) return "image";
  return "unknown";
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
      label: "Web sitesi (Blog)",
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
  const slug = slugify(payload.title) + "-" + randomUUID();
  const now = new Date().toISOString();
  const kind = mediaKind(payload.mediaUrl);
  const mediaUrl = payload.mediaUrl ? safeRemoteMediaUrl(payload.mediaUrl) : "";
  const compact = payload.text.replace(/\s+/g, " ").trim();
  const chars = Array.from(compact);
  const summary = chars.length > 180 ? chars.slice(0, 177).join("").trimEnd() + "…" : compact;
  const data = {
    title: payload.title,
    summary,
    content: payload.text,
    category: "Genel",
    species: "Genel",
    tags: [],
    featured: false,
    date: now,
    publishAt: now,
    unpublishAt: null,
    cover: kind === "image" ? mediaUrl : "",
    videoUrl: kind === "video" ? mediaUrl : "",
    source: "elci-yayin-merkezi"
  };
  await runtimeCall("/admin/create", { type: "blog", slug, data });
  await runtimeCall("/admin/publish", { type: "blog", slug, publish_at: now, unpublish_at: null });
  // Confirm that the public blog reader can actually retrieve the new post.
  const response = await fetch(RUNTIME_API + "/content/blog/" + encodeURIComponent(slug), { cache: "no-store" });
  if (!response.ok) throw new Error("Blog yayın isteği gönderildi ancak görünürlük doğrulanamadı; tekrar göndermeden blogu kontrol edin.");
  const item = await response.json().catch(() => null);
  if (item?.slug !== slug || item?.type !== "blog" || item?.published !== true) {
    throw new Error("Blog yayın sonucu doğrulanamadı; tekrar göndermeden blogu kontrol edin.");
  }
  return { id: slug, url: "/blog-post.html?slug=" + encodeURIComponent(slug) };
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
  // Image containers are asynchronous too; publishing before FINISHED can
  // produce Meta error "Media ID is not available".
  await waitInstagramContainer(create.id,credentials.pageAccessToken);
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

// Restrict server-side media fetches to public HTTPS hosts.
// DNS-level private-address protection still requires an egress proxy.

async function publishYouTube(payload) {
  if (mediaKind(payload.mediaUrl) !== "video") throw new Error("YouTube için video URL'si gerekli");
  const token = await googleAccessToken();
  const media = await fetch(safeRemoteMediaUrl(payload.mediaUrl),{cache:"no-store",redirect:"error"});
  if (!media.ok || !media.body) throw new Error("Video indirilemedi");
  const mediaType = media.headers.get("content-type") || "video/mp4";
  if (!/^video\/(mp4|webm|quicktime|x-m4v)(?:\s*;|$)/i.test(mediaType)) throw new Error("Video bağlantısı geçerli bir video dosyası döndürmüyor");
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

export const adapters = {
  website:publishWebsite,
  facebook:publishFacebook,
  instagram:publishInstagram,
  youtube:publishYouTube,
  gmb:publishGmb
};

export async function dispatchPublisher(payload,channels) {
  const status=await channelStatus();
  return Promise.all(channels.map(async channel => {
    if (!status[channel]?.ready) return {channel,ok:false,skipped:true,error:status[channel]?.detail || "Kanal bağlı değil"};
    try {return {channel,ok:true,...await adapters[channel](effectiveChannelPayload(payload,channel))};}
    catch(error){return {channel,ok:false,error:clean(error?.message || "Yayın başarısız",500)};}
  }));
}

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

async function publicationSave(record) {
  await publicationStore().setJSON("publication/" + record.id,record,{
    metadata:{createdAt:record.createdAt,actor:record.actor || "",complete:Boolean(record.complete)}
  });
}

export default async request => {
  const auth = await authorize();
  if (auth.error) return auth.error;

  if (request.method === "GET") {
    let history = [];
    let historyNotice = null;
    try { history = await publicationHistory(12); }
    catch (error) {
      console.error("Publisher history unavailable",String(error?.message || error));
      historyNotice = "Yayın geçmişi şu anda yüklenemiyor. Tekrar yayınlamadan önce platformdaki gönderileri kontrol edin.";
    }
    return json({
      channels:await channelStatus(),
      rules:PUBLISHER_RULES,
      mode:"one-click-publisher-v3-rules",
      history,
      historyNotice,
      scheduled:[],
      schedulerEnabled:false,
      schedulerNotice:"Otomatik gönderim güvenlik doğrulaması tamamlanana kadar devre dışı."
    });
  }
  if (request.method !== "POST") return json({error:"Desteklenmeyen yöntem"},405);

  try { verifyRequestOrigin(request); }
  catch { return json({error:"Geçersiz istek kaynağı"},403); }

  let body;
  try { body = await request.json(); }
  catch { return json({error:"Geçersiz veri"},400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({error:"Yayın verisi bir JSON nesnesi olmalı"},400);

  if (body.cancelScheduleId) {
    const cancelled=await cancelSchedule(clean(body.cancelScheduleId,80));
    return json({ok:cancelled},cancelled?200:409);
  }

  // Retrying an external publish is unsafe without an atomic per-channel claim.
  // A timeout may mean the remote platform accepted the post even if no result was saved.
  if (body.retryPublicationId) return json({
    error:"Yeniden yayınlama güvenli tekrar önleme altyapısı tamamlanana kadar kapalı. Önce platformdaki gönderileri ve yayın geçmişini kontrol edin."
  },409);
  const payload = {
    // Do not silently truncate a veterinary explanation: validate first.
    title:clean(body.title,1000),
    text:clean(body.text,50000),
    mediaUrl:clean(body.mediaUrl,2000),
    youtubePrivacy:["public","unlisted","private"].includes(body.youtubePrivacy) ? body.youtubePrivacy : "public",
    channelTexts:Object.fromEntries(Object.entries(body.channelTexts && typeof body.channelTexts === "object" ? body.channelTexts : {})
      .filter(([key]) => Object.hasOwn(PUBLISHER_RULES,key))
      .map(([key,value]) => [key,clean(value,50000)])),
    channelTitles:Object.fromEntries(Object.entries(body.channelTitles && typeof body.channelTitles === "object" ? body.channelTitles : {})
      .filter(([key]) => Object.hasOwn(PUBLISHER_RULES,key))
      .map(([key,value]) => [key,clean(value,1000)])),
    channelMediaUrls:Object.fromEntries(Object.entries(body.channelMediaUrls && typeof body.channelMediaUrls === "object" ? body.channelMediaUrls : {})
      .filter(([key]) => Object.hasOwn(PUBLISHER_RULES,key))
      .map(([key,value]) => [key,clean(value,2000)]))
  };
  if (!payload.title || !payload.text) return json({error:"Başlık ve yayın metni gerekli"},400);

  const validChannels = Array.isArray(body.channels)
    ? [...new Set(body.channels.filter(x => typeof x === "string" && Object.hasOwn(adapters,x)))]
    : [];
  // A retry may only target channels that actually failed in the original record.
  // Never let a crafted retry request republish an already successful channel.
  const requested = validChannels;
  if (!requested.length) return json({error:"En az bir yayın kanalı seçin"},400);

  const validationErrors = validatePublisherPayload(payload,requested,mediaKind);
  if (validationErrors.length) return json({
    error:"Yayın koşulları karşılanmıyor: "+validationErrors[0].message,
    validationErrors
  },400);

  if (body.publishAt) {
    // No schedule can be accepted while execution is deliberately disabled.
    return json({error:"Otomatik yayın planlaması güvenlik doğrulaması tamamlanana kadar kapalı. Şimdi yayınla seçeneğini kullanabilirsiniz."},503);
  }
  // Persist the publication intent before contacting external platforms.
  // If a worker terminates mid-request, the history retains an unresolved
  // record for manual reconciliation rather than silently losing the attempt.
  const createdAt = new Date().toISOString();
  const record = {
    id:randomUUID(),
    actor:auth.user.email || auth.user.id || "yetkili",
    payload,
    channels:requested,
    results:requested.map(channel => ({channel,ok:false,pending:true,error:"Yayın sonucu henüz doğrulanmadı"})),
    ok:false,
    complete:false,
    pending:true,
    createdAt
  };
  try {
    await publicationSave(record);
  } catch (error) {
    console.error("Publisher intent persistence failed",String(error?.message || error));
    return json({error:"Yayın girişimi kaydedilemedi; güvenliğiniz için hiçbir platforma gönderim yapılmadı."},503);
  }

  const results=await dispatchPublisher(payload,requested);
  record.results=results;
  record.ok=results.some(x => x.ok);
  record.complete=results.every(x => x.ok);
  record.pending=false;
  // External platforms may already have accepted the post. A history-store
  // failure must not turn a completed dispatch into an HTTP 500 that encourages
  // the operator to submit the same post again.
  let historySaved = true;
  try {
    await publicationSave(record);
  } catch (error) {
    historySaved = false;
    console.error("Publisher history persistence failed", {
      publicationId:record.id,
      message:String(error?.message || error)
    });
  }

  return json({
    ok:record.ok,
    complete:record.complete,
    results,
    publicationId:record.id,
    publishedAt:createdAt,
    historySaved,
    warning:historySaved ? null : "Yayın sonuçları alındı ancak geçmiş kaydı saklanamadı. Tekrar göndermeden önce platformları kontrol edin."
  });
};

export const config = {
  path:"/.netlify/functions/publisher",
  rateLimit:{windowLimit:30,windowSize:60,aggregateBy:["ip","domain"]}
};
