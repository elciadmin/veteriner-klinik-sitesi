// netlify/functions/youtube.js
// YouTube RSS → XML proxy (CORS’suz)
// Kanal: Elçi Veteriner Kliniği
const FEED = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCj2kiAEEF2LyKko9P78RGPQ';

exports.handler = async () => {
  try {
    const r = await fetch(FEED);
    const xml = await r.text();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: xml
    };
  } catch (e) {
    return { statusCode: 500, body: 'error' };
  }
};
