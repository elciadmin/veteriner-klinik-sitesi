import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const STORE_NAME = "elci-appointments-v1";
const clean = (value, max = 500) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const first = (data, ...keys) => { for (const key of keys) if (data?.[key] != null && String(data[key]).trim() !== "") return data[key]; return ""; };
const html = value => clean(value, 2000).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

async function sendEmail(record) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.APPOINTMENT_EMAIL_TO || "elcivetklinik@gmail.com";
  if (!apiKey || !to) return;
  const from = process.env.APPOINTMENT_EMAIL_FROM || "Elçi Randevu <randevu@elciveteriner.com>";
  const siteUrl = String(process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
  const panelUrl = siteUrl ? `${siteUrl}/admin/randevular.html` : "";
  const subject = `Yeni randevu talebi — ${record.requestedDate || "tarih bekleniyor"}`;
  const body = `<h2>Yeni randevu talebi alındı</h2><p><strong>Talep edilen zaman:</strong> ${html(record.requestedDate)} · ${html(record.requestedTime)}</p><p><strong>Hizmet:</strong> ${html(record.service || "Belirtilmedi")}</p><p><strong>Hayvan türü:</strong> ${html(record.species || "Belirtilmedi")}</p><p>Kişisel iletişim bilgileri ve klinik notlar güvenli yönetim panelinde tutulur.${panelUrl ? ` <a href="${html(panelUrl)}">Randevuyu panelde açın</a>.` : ""}</p>`;
  const response = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ Authorization:`Bearer ${apiKey}`, "Content-Type":"application/json" }, body:JSON.stringify({ from, to:[to], subject, html:body }) });
  if (!response.ok) console.error("Randevu e-postası gönderilemedi:", response.status, await response.text());
}

export default {
  async formSubmitted(event) {
    const data = event?.data || {};
    const formName = clean(first(data,"form-name","form_name","formName"),80);
    const looksLikeAppointment = Boolean(first(data,"pet")) && Boolean(first(data,"tercih_edilen_zaman_araligi","randevu_saati"));
    if (formName && formName !== "online-randevu") return;
    if (!formName && !looksLikeAppointment) return;

    const createdAt = new Date().toISOString();
    const id = `${createdAt.replace(/[^0-9]/g,"").slice(0,14)}-${randomUUID()}`;
    const record = {
      id, createdAt, updatedAt:createdAt, status:"new",
      ownerName:clean(first(data,"ad","name"),120), phone:clean(first(data,"tel","phone"),40), email:clean(first(data,"email"),160),
      petName:clean(first(data,"pet"),100), species:clean(first(data,"hayvan_turu_diger") || first(data,"hayvan_turu"),80),
      age:clean(first(data,"hayvan_yasi"),60), breed:clean(first(data,"irk_cins"),100),
      requestedDate:clean(first(data,"tarih_iso","tarih"),20), requestedTime:clean(first(data,"tercih_edilen_zaman_araligi","randevu_saati"),40),
      service:clean(first(data,"hizmet"),120), note:clean(first(data,"not","message"),1500), internalNote:"",
      source:"netlify-form", termsAccepted:clean(first(data,"randevu_kosullari_kabul"),20)==="evet",
      privacyNoticeVersion:clean(first(data,"kvkk_aydinlatma_surumu"),40), termsVersion:clean(first(data,"randevu_kosullari_surumu"),40),
      requestTimestamp:clean(first(data,"talep_zamani"),60),
      history:[{ at:createdAt, by:"system", type:"created", detail:"Randevu talebi oluşturuldu" }]
    };
    if (!record.ownerName || !record.phone || !record.petName || !record.requestedDate || !record.termsAccepted) {
      console.warn("Eksik veya onaysız randevu kaydı özel depoya aktarılmadı.");
      return;
    }
    const store = getStore({ name:STORE_NAME, consistency:"strong" });
    await store.setJSON(`appointment/${id}`, record, { metadata:{ createdAt, status:"new" }, onlyIfNew:true });
    try { await sendEmail(record); } catch (error) { console.error("Randevu e-postası hatası:", error); }
  }
};
