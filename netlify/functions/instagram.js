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

  const IG_TOKEN = process.env.IG_ACCESS_TOKEN;
  const limit = 12;

  if (!IG_TOKEN) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "IG_ACCESS_TOKEN ayarlı değil." }),
    };
  }

  const url = new URL("https://graph.instagram.com/me/media");
  url.searchParams.set(
    "fields",
    "id,caption,media_url,permalink,media_type,thumbnail_url,timestamp"
  );
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", IG_TOKEN);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.error) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: data.error.message }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data.data || []),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
