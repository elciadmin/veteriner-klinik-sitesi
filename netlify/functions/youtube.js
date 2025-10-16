export default async (req, res) => {
  const CHANNEL_ID = 'UCj2kiAEEF2LyKko9P78RGPQ';
  const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
  try{
    const r = await fetch(FEED_URL);
    const text = await r.text();
    return new Response(text, {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'access-control-allow-origin': '*'
      }
    });
  }catch(e){
    return new Response('error', { status: 500 });
  }
};
