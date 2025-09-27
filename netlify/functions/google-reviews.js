export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  const PLACE_ID = process.env.GOOGLE_PLACE_ID;

  if (!API_KEY || !PLACE_ID) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "API key veya PLACE_ID ayarlı değil." }),
    };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", PLACE_ID);
  url.searchParams.set("fields", "name,rating,user_ratings_total,reviews");
  url.searchParams.set("language", "tr");
  url.searchParams.set("key", API_KEY);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: data.error_message || data.status }),
      };
    }

    const place = data.result || {};
    const reviews = (place.reviews || []).map(r => ({
      author_name: r.author_name,
      profile_photo_url: r.profile_photo_url,
      rating: r.rating,
      relative_time: r.relative_time_description,
      text: r.text,
      time: r.time,
    }));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: place.name,
        rating: place.rating,
        total: place.user_ratings_total,
        reviews,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
