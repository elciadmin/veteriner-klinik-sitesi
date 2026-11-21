// Rules applied by the Elçi publisher. Platform rules may change; verify upstream API docs.
export const PUBLISHER_RULES = Object.freeze({
  website: { label:"Web sitesi", maxTextChars:5000, media:["none","image","video"], source:"Uygulama sınırı" },
  facebook: { label:"Facebook", maxTextChars:5000, media:["none","image","video"], source:"Uygulama sınırı" },
  instagram: { label:"Instagram", maxTextChars:2200, media:["image","video"], source:"Instagram yayın API'si" },
  youtube: { label:"YouTube", maxTitleChars:100, maxTextBytes:5000, media:["video"], source:"YouTube Data API" },
  gmb: { label:"Google İşletme", maxTextChars:1500, media:["none","image"], source:"Mevcut gönderi adaptörü" }
});

export const effectiveChannelPayload = (payload, channel) => ({
  ...payload,
  title:payload.channelTitles?.[channel] ?? payload.title,
  text:payload.channelTexts?.[channel] ?? payload.text,
  mediaUrl:payload.channelMediaUrls?.[channel] ?? payload.mediaUrl
});

export function validatePublisherPayload(payload, channels, mediaKind = "none") {
  const errors = [];
  if (!payload.title?.trim() || !payload.text?.trim()) {
    errors.push({field:"base",message:"Başlık ve ana yayın metni gerekli"});
    return errors;
  }
  if (Array.from(payload.title).length > 180) errors.push({field:"title",message:"Ana başlık 180 karakteri aşamaz"});
  if (Array.from(payload.text).length > 5000) errors.push({field:"text",message:"Ana metin 5000 karakteri aşamaz"});
  for (const channel of channels) {
    const rule = PUBLISHER_RULES[channel];
    if (!rule) {
      errors.push({channel,field:"channel",message:"Desteklenmeyen kanal"});
      continue;
    }
    const local = effectiveChannelPayload(payload,channel);
    const channelMedia=local.mediaUrl ? (typeof mediaKind==="function" ? mediaKind(local.mediaUrl) : mediaKind) : "none";
    if (!local.text?.trim()) errors.push({channel,field:"text",message:rule.label+" için metin boş olamaz"});
    if (!local.title?.trim()) errors.push({channel,field:"title",message:rule.label+" için başlık boş olamaz"});
    if (rule.maxTextChars && Array.from(local.text || "").length > rule.maxTextChars)
      errors.push({channel,field:"text",message:rule.label+" metni en fazla "+rule.maxTextChars+" karakter olabilir"});
    if (rule.maxTextBytes && Buffer.byteLength(local.text || "","utf8") > rule.maxTextBytes)
      errors.push({channel,field:"text",message:rule.label+" açıklaması en fazla "+rule.maxTextBytes+" UTF-8 bayt olabilir"});
    if (rule.maxTitleChars && Array.from(local.title || "").length > rule.maxTitleChars)
      errors.push({channel,field:"title",message:rule.label+" başlığı en fazla "+rule.maxTitleChars+" karakter olabilir"});
    if (!rule.media.includes(channelMedia))
      errors.push({channel,field:"media",message:rule.label+" seçilen medya türünü desteklemiyor ("+channelMedia+")"});
  }
  return errors;
}
