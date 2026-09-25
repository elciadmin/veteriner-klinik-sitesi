import { getUser, verifyRequestOrigin } from "@netlify/identity";

const RUNTIME_API = "https://elci-content-api.elcivetklinik.workers.dev";
const MAX_REMOTE_MEDIA = 80 * 1024 * 1024;

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

function channelStatus() {
  return {
    website: {
      ready: envReady("ELCI_RUNTIME_ADMIN_TOKEN"),
      label: "Web sitesi",
      detail: envReady("ELCI_RUNTIME_ADMIN_TOKEN") ? "Runtime CMS bağlı" : "Runtime CMS anahtarı eksik"
    },
    facebook: {
      ready: envReady("META_PAGE_ID", "META_PAGE_ACCESS_TOKEN", "META_GRAPH_VERSION"),
      label: "Facebook",
      detail: envReady("META_PAGE_ID", "META_PAGE_ACCESS_TOKEN", "META_GRAPH_VERSION") ? "Meta Page bağlı" : "Meta bağlantısı bekleniyor"
    },
    instagram: {
      ready: envReady("INSTAGRAM_BUSINESS_ACCOUNT_ID", "META_PAGE_ACCESS_TOKEN", "META_GRAPH_VERSION"),
      label: "Instagram",
      detail: envReady("INSTAGRAM_BUSINESS_ACCOUNT_ID", "META_PAGE_ACCESS_TOKEN", "META_GRAPH_VERSION") ? "Instagram Professional bağlı" : "Instagram bağlantısı bekleniyor"
    },
    youtube: {
      ready: envReady("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN"),
      label: "YouTube",
      detail: envReady("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN") ? "Google OAuth bağlı" : "YouTube OAuth bağlantısı bekleniyor"
    },
    gmb: {
      ready: envReady("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN", "GBP_ACCOUNT_ID", "GBP_LOCATION_ID"),
      label: "Google İşletme",
      detail: envReady("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN", "GBP_ACCOUNT_ID", "GBP_LOCATION_ID") ? "GBP API bağlı" : "GBP API erişimi/onayı bekleniyor"
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

const metaBase = () => "https://graph.facebook.com/" + encodeURIComponent(clean(process.env.META_GRAPH_VERSION,20));

async function metaPost(path, params) {
  const body = new URLSearchParams({ ...params, access_token: process.env.META_PAGE_ACCESS_TOKEN || "" });
  const response = await fetch(metaBase() + "/" + path, { method:"POST", body, cache:"no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error((data.error && data.error.message) || "Meta API işlemi başarısız");
  return data;
}

async function publishFacebook(payload) {
  const pageId = clean(process.env.META_PAGE_ID,120);
  const kind = mediaKind(payload.mediaUrl);
  if (kind === "image") {
    const data = await metaPost(pageId + "/photos", { url:payload.mediaUrl, caption:payload.text });
    return { id:data.post_id || data.id || "" };
  }
  if (kind === "video") {
    const data = await metaPost(pageId + "/videos", { file_url:payload.mediaUrl, description:payload.text, title:payload.title });
    return { id:data.id || "" };
  }
  const params = { message:payload.text };
  if (payload.mediaUrl) params.link = payload.mediaUrl;
  const data = await metaPost(pageId + "/feed", params);
  return { id:data.id || "" };
}

async function waitInstagramContainer(id) {
  for (let i=0;i<12;i++) {
    const url = metaBase() + "/" + encodeURIComponent(id) + "?fields=status_code,status&access_token=" + encodeURIComponent(process.env.META_PAGE_ACCESS_TOKEN || "");
    const response = await fetch(url,{cache:"no-store"});
    const data = await response.json().catch(() => ({}));
    if (data.status_code === "FINISHED") return;
    if (["ERROR","EXPIRED"].includes(data.status_code)) throw new Error(data.status || "Instagram medya işleme hatası");
    await new Promise(resolve => setTimeout(resolve,1500));
  }
  throw new Error("Instagram medya işlemesi zaman aşımına uğradı");
}

async function publishInstagram(payload) {
  const accountId = clean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,120);
  const kind = mediaKind(payload.mediaUrl);
  if (!payload.mediaUrl || !["image","video"].includes(kind)) throw new Error("Instagram için görsel veya video URL'si gerekli");
  const create = kind === "video"
    ? await metaPost(accountId + "/media", { media_type:"REELS", video_url:payload.mediaUrl, caption:payload.text })
    : await metaPost(accountId + "/media", { image_url:payload.mediaUrl, caption:payload.text });
  if (!create.id) throw new Error("Instagram medya kapsayıcısı oluşturulamadı");
  if (kind === "video") await waitInstagramContainer(create.id);
  const published = await metaPost(accountId + "/media_publish",{ creation_id:create.id });
  return { id:published.id || "" };
}

async function googleAccessToken() {
  const body = new URLSearchParams({
    client_id:process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    client_secret:process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
    refresh_token:process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "",
    grant_type:"refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token",{method:"POST",body,cache:"no-store"});
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Google OAuth yenilenemedi");
  return data.access_token;
}

async function publishGmb(payload) {
  const token = await googleAccessToken();
  const accountId = clean(process.env.GBP_ACCOUNT_ID,120);
  const locationId = clean(process.env.GBP_LOCATION_ID,120);
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

export default async request => {
  const auth = await authorize();
  if (auth.error) return auth.error;

  if (request.method === "GET") return json({channels:channelStatus(),mode:"one-click-publisher-v1"});
  if (request.method !== "POST") return json({error:"Desteklenmeyen yöntem"},405);

  try { verifyRequestOrigin(request); }
  catch { return json({error:"Geçersiz istek kaynağı"},403); }

  let body;
  try { body = await request.json(); }
  catch { return json({error:"Geçersiz veri"},400); }

  const payload = {
    title:clean(body.title,180),
    text:clean(body.text,5000),
    mediaUrl:clean(body.mediaUrl,2000),
    youtubePrivacy:["public","unlisted","private"].includes(body.youtubePrivacy) ? body.youtubePrivacy : "public"
  };
  if (!payload.title || !payload.text) return json({error:"Başlık ve yayın metni gerekli"},400);

  const requested = Array.isArray(body.channels) ? body.channels.filter(x => Object.hasOwn(adapters,x)) : [];
  if (!requested.length) return json({error:"En az bir yayın kanalı seçin"},400);

  const status = channelStatus();
  const results = await Promise.all(requested.map(async channel => {
    if (!status[channel]?.ready) return {channel,ok:false,skipped:true,error:status[channel]?.detail || "Kanal bağlı değil"};
    try {
      const output = await adapters[channel](payload);
      return {channel,ok:true,...output};
    } catch (error) {
      return {channel,ok:false,error:clean(error?.message || "Yayın başarısız",500)};
    }
  }));

  return json({
    ok:results.some(x => x.ok),
    complete:results.every(x => x.ok),
    results,
    publishedAt:new Date().toISOString()
  });
};

export const config = {
  path:"/.netlify/functions/publisher",
  rateLimit:{windowLimit:30,windowSize:60,aggregateBy:["ip","domain"]}
};
