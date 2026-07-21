import { getStore } from "@netlify/blobs";
import { getUser, verifyRequestOrigin } from "@netlify/identity";

const STORE_NAME = "elci-appointments-v1";
const STATUSES = new Set(["new","callback","contacted","confirmed","arrived","completed","cancelled","archived"]);
const json = (data, status = 200) => Response.json(data, { status, headers:{ "Cache-Control":"no-store, private", "X-Content-Type-Options":"nosniff" } });
const clean = (value, max = 1500) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const allowedEmails = () => String(process.env.ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
const validId = id => /^[0-9A-Za-z-]{10,140}$/.test(String(id || ""));

async function authorize() {
  const user = await getUser();
  if (!user) return { error:json({ error:"Giriş gerekli" }, 401) };
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const roleAllowed = roles.some(role => ["admin","randevu"].includes(role));
  const emailAllowed = allowedEmails().includes(String(user.email || "").toLowerCase());
  if (!roleAllowed && !emailAllowed) return { error:json({ error:"Bu hesap randevu kayıtlarına erişmeye yetkili değil" }, 403) };
  return { user };
}

function appendHistory(record, user, type, detail = "") {
  record.history = Array.isArray(record.history) ? record.history.slice(-49) : [];
  record.history.push({ at:new Date().toISOString(), by:user.email || user.id || "yetkili", type, detail:clean(detail, 300) });
}

export default async request => {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const store = getStore({ name:STORE_NAME, consistency:"strong" });

  if (request.method === "GET") {
    const { blobs } = await store.list({ prefix:"appointment/" });
    const records = (await Promise.all(blobs.map(async ({ key }) => {
      try { return await store.get(key, { type:"json", consistency:"strong" }); }
      catch { return null; }
    }))).filter(Boolean).sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return json({ appointments:records });
  }

  if (request.method === "PATCH") {
    try { verifyRequestOrigin(request); } catch { return json({ error:"Geçersiz istek kaynağı" }, 403); }
    let body;
    try { body = await request.json(); } catch { return json({ error:"Geçersiz veri" }, 400); }
    if (!validId(body.id)) return json({ error:"Geçersiz kayıt kimliği" }, 400);
    const key = `appointment/${body.id}`;
    const record = await store.get(key, { type:"json", consistency:"strong" });
    if (!record) return json({ error:"Randevu bulunamadı" }, 404);

    if (body.status != null) {
      if (!STATUSES.has(body.status)) return json({ error:"Geçersiz durum" }, 400);
      if (record.status !== body.status) {
        const previous = record.status || "new";
        record.status = body.status;
        appendHistory(record, auth.user, "status", `${previous} → ${body.status}`);
      }
    }
    if (body.internalNote != null) {
      record.internalNote = clean(body.internalNote, 2000);
      appendHistory(record, auth.user, "note", "Klinik içi not güncellendi");
    }
    if (body.confirmedDate != null) record.confirmedDate = clean(body.confirmedDate, 20);
    if (body.confirmedTime != null) record.confirmedTime = clean(body.confirmedTime, 40);
    record.updatedAt = new Date().toISOString();
    record.updatedBy = auth.user.email || auth.user.id;
    await store.setJSON(key, record, { metadata:{ createdAt:record.createdAt, status:record.status } });
    return json({ appointment:record });
  }

  if (request.method === "DELETE") {
    try { verifyRequestOrigin(request); } catch { return json({ error:"Geçersiz istek kaynağı" }, 403); }
    let body;
    try { body = await request.json(); } catch { return json({ error:"Geçersiz veri" }, 400); }
    if (!validId(body.id)) return json({ error:"Geçersiz kayıt kimliği" }, 400);
    await store.delete(`appointment/${body.id}`);
    return json({ deleted:true });
  }

  return json({ error:"Desteklenmeyen yöntem" }, 405);
};

export const config = { path:"/.netlify/functions/appointments", rateLimit:{ windowLimit:120, windowSize:60, aggregateBy:["ip","domain"] } };
