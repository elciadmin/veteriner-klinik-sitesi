export default async function handler(req, res) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ items: [] });

  const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&access_token=${token}&limit=12`;
  try {
    const r = await fetch(url);
    const json = await r.json();
    const items = (json.data || [])
      .filter(m => ['IMAGE','CAROUSEL_ALBUM','VIDEO'].includes(m.media_type))
      .map(m => ({
        id: m.id,
        caption: m.caption,
        media_type: m.media_type,
        media_url: m.media_url,
        thumbnail_url: m.thumbnail_url,
        permalink: m.permalink,
        timestamp: m.timestamp
      }));
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(200).json({ items: [] });
  }
}
