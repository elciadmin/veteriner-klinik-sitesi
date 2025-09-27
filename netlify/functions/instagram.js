// netlify/functions/instagram.js
export async function handler(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  try {
    const { INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID } = process.env;
    if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: "Env eksik: INSTAGRAM_ACCESS_TOKEN ve INSTAGRAM_USER_ID gerekli." })
      };
    }

    const url = `https://graph.instagram.com/${INSTAGRAM_USER_ID}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: data.error }) };
    }

    const items = (data.data || []).map(item => ({
      id: item.id,
      type: item.media_type,
      image: item.media_type === "VIDEO" ? (item.thumbnail_url || item.media_url) : item.media_url,
      url: item.permalink,
      caption: item.caption,
      timestamp: item.timestamp
    })).slice(0, 8);

    return { statusCode: 200, headers: cors, body: JSON.stringify({ items }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
}
