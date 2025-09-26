export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return res.status(200).json({ reviews: [] });

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,user_ratings_total,reviews&reviews_sort=newest&key=${key}`;

  try {
    const r = await fetch(url);
    const json = await r.json();
    const reviews = (json.result?.reviews || []).map(v => ({
      author_name: v.author_name,
      profile_photo_url: v.profile_photo_url,
      rating: v.rating,
      relative_time_description: v.relative_time_description,
      text: v.text
    }));
    return res.status(200).json({ reviews });
  } catch (e) {
    return res.status(200).json({ reviews: [] });
  }
}
