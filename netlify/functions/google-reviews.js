// netlify/functions/google-reviews.js
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
    const { GOOGLE_PLACES_API_KEY, GOOGLE_PLACE_ID } = process.env;
    if (!GOOGLE_PLACES_API_KEY || !GOOGLE_PLACE_ID) {
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: "Env eksik: GOOGLE_PLACES_API_KEY ve GOOGLE_PLACE_ID gerekli." })
      };
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      GOOGLE_PLACE_ID
    )}&fields=name,rating,user_ratings_total,reviews&language=tr&key=${GOOGLE_PLACES_API_KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== "OK") {
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({ error: "Google Places hatası", detail: json })
      };
    }

    const result = json.result || {};
    const reviews = (result.reviews || []).map(r => ({
      author_name: r.author_name,
      rating: r.rating,
      text: r.text,
      time: r.relative_time_description,
      profile_photo_url: r.profile_photo_url
    })).slice(0, 6);

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        place_name: result.name,
        rating: result.rating,
        total: result.user_ratings_total,
        reviews
      })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
}
