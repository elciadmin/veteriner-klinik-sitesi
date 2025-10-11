// netlify/functions/insta-thumb.js
// IG post HTML'inden og:image yakalar, JSON döner.
// Not: IG bazen bot koruması uygulayabilir. Hata olursa placeholder döndürür.

export default async (req, context) => {
  try {
    const { searchParams } = new URL(req.url);
    const postUrl = searchParams.get('url');
    if (!postUrl) {
      return new Response(JSON.stringify({ error: 'Missing url param' }), {
        status: 400, headers: { 'content-type': 'application/json' }
      });
    }

    // Basit bellek içi cache (aynı cold start içinde tekrar çağrılınca hızlanır)
    globalThis.__IG_CACHE__ = globalThis.__IG_CACHE__ || new Map();
    if (globalThis.__IG_CACHE__.has(postUrl)) {
      return new Response(JSON.stringify(globalThis.__IG_CACHE__.get(postUrl)), {
        status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' }
      });
    }

    // IG sayfasını çek
    const r = await fetch(postUrl, {
      headers: {
        // Basit bir UA, çoğu durumda yeterli
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept': 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });

    if (!r.ok) {
      // IG engelledi / hata: placeholder dön
      const fallback = { url: postUrl, img: '/assets/img/instagram/placeholder.jpg', caption: '' };
      return new Response(JSON.stringify(fallback), {
        status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' }
      });
    }

    const html = await r.text();

    // og:image ve og:title metalarını ayıkla
    const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);

    const img = imgMatch ? imgMatch[1] : '/assets/img/instagram/placeholder.jpg';
    const caption = titleMatch ? titleMatch[1] : '';

    const data = { url: postUrl, img, caption };

    // Cache’e koy
    globalThis.__IG_CACHE__.set(postUrl, data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        // Tarayıcı tarafında da 5 dk cache; çok sık istek atılmasın
        'cache-control': 'public, max-age=300'
      }
    });
  } catch (err) {
    const fallback = { url: null, img: '/assets/img/instagram/placeholder.jpg', caption: '' };
    return new Response(JSON.stringify(fallback), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  }
};
