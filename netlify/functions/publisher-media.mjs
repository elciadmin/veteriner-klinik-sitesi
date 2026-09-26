import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";

const STORE_NAME = "elci-publisher-media-v1";
const MAX_IMAGE = 4 * 1024 * 1024;
const TYPES = new Map([
  ["image/jpeg","jpg"],
  ["image/png","png"],
  ["image/webp","webp"]
]);
const json = (data,status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
const allowedEmails = () => String(process.env.ADMIN_EMAILS || "").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);

async function authorize() {
  const user = await getUser();
  if (!user) return {error:json({error:"Giriş gerekli"},401)};
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const allowed = roles.some(role => ["admin","editor","yayin"].includes(role)) || allowedEmails().includes(String(user.email || "").toLowerCase());
  if (!allowed) return {error:json({error:"Bu hesap medya yüklemeye yetkili değil"},403)};
  return {user};
}

function safeId(value) {
  const id = String(value || "");
  return /^[0-9A-Za-z._-]{8,180}$/.test(id) ? id : "";
}

function contentTypeFromId(id) {
  if (/\.png$/i.test(id)) return "image/png";
  if (/\.webp$/i.test(id)) return "image/webp";
  return "image/jpeg";
}

export default async request => {
  const store = getStore({name:STORE_NAME,consistency:"strong"});
  const url = new URL(request.url);

  if (request.method === "GET") {
    const id = safeId(url.searchParams.get("id"));
    if (!id) return new Response("Not found",{status:404});
    const data = await store.get(id,{type:"arrayBuffer",consistency:"strong"});
    if (!data) return new Response("Not found",{status:404});
    return new Response(data,{status:200,headers:{
      "Content-Type":contentTypeFromId(id),
      "Cache-Control":"public, max-age=31536000, immutable",
      "X-Content-Type-Options":"nosniff"
    }});
  }

  if (request.method !== "POST") return json({error:"Desteklenmeyen yöntem"},405);
  const auth = await authorize();
  if (auth.error) return auth.error;
  try { verifyRequestOrigin(request); }
  catch { return json({error:"Geçersiz istek kaynağı"},403); }

  let form;
  try { form = await request.formData(); }
  catch { return json({error:"Dosya okunamadı"},400); }
  const file = form.get("file");
  if (!(file instanceof Blob)) return json({error:"Görsel seçilmedi"},400);
  const ext = TYPES.get(file.type);
  if (!ext) return json({error:"Yalnız JPG, PNG veya WEBP yüklenebilir"},400);
  if (!file.size || file.size > MAX_IMAGE) return json({error:"Görsel en fazla 4 MB olabilir"},400);

  const id = Date.now().toString(36) + "-" + randomUUID() + "." + ext;
  await store.set(id,await file.arrayBuffer(),{metadata:{
    contentType:file.type,
    size:file.size,
    uploadedAt:new Date().toISOString(),
    uploadedBy:auth.user.email || auth.user.id || "yetkili"
  }});
  return json({
    id,
    url:url.origin + "/.netlify/functions/publisher-media?id=" + encodeURIComponent(id),
    size:file.size,
    contentType:file.type
  },201);
};

export const config = {
  path:"/.netlify/functions/publisher-media",
  rateLimit:{windowLimit:20,windowSize:60,aggregateBy:["ip","domain"]}
};
