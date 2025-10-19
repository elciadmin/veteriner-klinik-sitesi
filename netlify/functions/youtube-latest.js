// netlify/functions/youtube-latest.js
export default async (req, res) => {
  try {
    const channelId = "UCj2kiAEEF2LyKko9P78RGPQ"; // Elçi Veteriner Kliniği
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const feed = await fetch(url);
    if (!feed.ok) return res.status(502).json({ error: `Feed HTTP ${feed.status}` });

    const xml = await feed.text();
    const ids = Array.from(xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)).map(m => m[1]);

    const u = new URL(req.url, "http://localhost");
    const limit = Math.min(50, Math.max(1, Number(u.searchParams.get("limit")) || 9));

    return res.status(200).json({ youtubeIds: ids.slice(0, limit) });
  } catch (e) {
    return res.status(500).json({ error: e.message || "unknown error" });
  }
};
