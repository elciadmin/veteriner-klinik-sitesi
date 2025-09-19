const https = require('https');
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const data = (body && body.payload && body.payload.data) ? body.payload.data : {};
    const text = `📅 Yeni Randevu
• Ad Soyad: ${data.adsoyad || "-"}
• Telefon: ${data.telefon || "-"}
• Tür: ${data.tur || "-"}
• Tarih: ${data.tarih || "-"}
• Not: ${data.not || "-"}`;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return { statusCode: 500, body: "TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID eksik." };
    const postData = JSON.stringify({ chat_id: chatId, text });
    const options = { hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } };
    const send = () => new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data=''; res.on('data', c=> data+=c); res.on('end', ()=> (res.statusCode>=200&&res.statusCode<300)?resolve(data):reject(new Error(`Telegram ${res.statusCode}: ${data}`)));
      }); req.on('error', reject); req.write(postData); req.end();
    });
    await send(); return { statusCode: 200, body: "OK" };
  } catch (e) { return { statusCode: 500, body: `Hata: ${e.message}` }; }
};
