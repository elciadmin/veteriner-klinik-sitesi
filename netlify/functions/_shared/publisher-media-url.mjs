// Reject internal addresses and ambiguous host syntax before outbound video fetches.
// DNS rebinding requires a network-level egress policy as a separate safeguard.
export function safeRemoteMediaUrl(raw) {
  let url;
  try { url=new URL(raw); } catch { throw new Error("Geçerli bir video bağlantısı girin"); }
  if (url.protocol!=="https:" || url.username || url.password || (url.port && url.port!=="443")) {
    throw new Error("Video bağlantısı herkese açık HTTPS adresi olmalı");
  }
  const host=url.hostname.toLowerCase().replace(/\.$/,"");
  if (!host || host==="localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".invalid") ||
      host.endsWith(".example") || host.endsWith(".onion") ||
      /^[0-9.]+$/.test(host) || host.includes(":") ||
      host==="metadata.google.internal") {
    throw new Error("Yerel veya özel ağ adreslerinden video alınamaz");
  }
  return url.href;
}
