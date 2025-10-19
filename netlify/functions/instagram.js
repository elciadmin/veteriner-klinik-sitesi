// netlify/functions/instagram.js
exports.handler = async (event) => {
  try {
    const origin = process.env.DEPLOY_PRIME_URL || process.env.URL;
    if (!origin) {
      // Yerel JSON'a doğrudan güvenelim; origin olmadan index fallback yapmayalım
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    // 1) /assets/data/instagram.json varsa onu kullan
    try {
      const r = await fetch(`${origin.replace(/\/$/,"")}/assets/data/instagram.json`, { cache: "no-cache" });
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j) && j.length) {
          return { statusCode: 200, body: JSON.stringify(j) };
        }
        if (j && Array.isArray(j.items) && j.items.length) {
          return { statusCode: 200, body: JSON.stringify(j.items) };
        }
      }
    } catch {}

    // 2) Başka fallback yok; boş dön
    return { statusCode: 200, body: JSON.stringify([]) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify([]) };
  }
};
