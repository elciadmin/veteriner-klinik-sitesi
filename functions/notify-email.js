// functions/notify-email.js
export async function handler(event) {
  try {
    const body = JSON.parse(event.body || "{}");
    const payload = body.payload || body; // Netlify Forms payload
    const data = payload.data || {};
    const formName = payload.form_name || "randevu";
    const siteUrl = payload.site_url || "https://veteriner-klinik-sitesi.netlify.app";

    const to = process.env.NOTIFY_EMAIL_TO;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !to) return { statusCode: 500, body: "Missing RESEND_API_KEY or NOTIFY_EMAIL_TO" };

    const subject =
      `Yeni Randevu (${formName})` +
      (data.adsoyad ? ` — ${data.adsoyad}` : "") +
      (data.telefon ? ` — ${data.telefon}` : "");

    const html = `
      <h2>📅 Yeni Randevu</h2>
      <p><b>Ad Soyad:</b> ${data.adsoyad || "-"}</p>
      <p><b>Telefon:</b> ${data.telefon || "-"}</p>
      <p><b>Evcil Türü:</b> ${data.tur || "-"}</p>
      <p><b>Tarih/Saat:</b> ${data.tarih || "-"}</p>
      <p><b>Notlar:</b><br>${(data.not || "").replace(/\n/g, "<br>")}</p>
      <hr><p><a href="${siteUrl}/admin/">Panoya git</a></p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Klinik <onboarding@resend.dev>", // test göndereni
        to: [to],
        subject,
        html
      })
    });

    if (!res.ok) return { statusCode: 500, body: "Resend error: " + await res.text() };
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
