// netlify/functions/youtube-latest.js
const CHANNEL_ID = "UCj2kiAEEF2LyKko9P78RGPQ"; // Elçi Veteriner Kliniği

exports.handler = async (event) => {
  try {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
    const r = await fetch(url);
    if (!r.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: `Feed HTTP ${r.status}` }) };
    }
    const xml = await r.text();
    const ids = Array.from(xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)).map(m => m[1]);

    const params = new URLSearchParams(event.rawQuery || "");
    const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || 9));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ youtubeIds: ids.slice(0, limit) })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "unknown error" }) };
  }
};
