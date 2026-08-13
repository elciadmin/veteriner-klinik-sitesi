const paymentKeywords = [
  ["cash", ["nakit", "elden", "kasa"]],
  ["card", ["kart", "pos", "kredi karti", "kredi kartı"]],
  ["transfer", ["havale", "eft", "banka", "iban", "transfer"]],
];

const WEEKDAYS = {
  pazartesi: 1,
  sali: 2,
  carsamba: 3,
  persembe: 4,
  cuma: 5,
  cumartesi: 6,
  pazar: 0,
};

const METAL_CODES = {
  altin: "XAU_GRAM",
  gumus: "XAG_GRAM",
  platin: "XPT_GRAM",
  paladyum: "XPD_GRAM",
};

const COIN_CODES = {
  ceyrek: "XAU_QUARTER",
  yarim: "XAU_HALF",
  tam: "XAU_FULL",
  cumhuriyet: "XAU_REPUBLIC",
};

export function normalizeFinanceText(value = "") {
  return String(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ı", "i")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9ğüşıöç.,₺\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTurkishMoney(raw) {
  const text = String(raw ?? "").trim().replace(/\s/g, "");
  if (!text) return null;
  let cleaned = text.replace(/[₺]|try|tl/gi, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    const decimals = cleaned.length - lastDot - 1;
    if (decimals === 3 && /^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, "");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else {
    cleaned = cleaned.replace(/,/g, ".");
  }
  const number = Number(cleaned);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
}

export function extractFinanceAmount(text) {
  const source = String(text ?? "");
  const withCurrency = source.match(/(?:^|\s)(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:₺|tl|try)\b/i);
  const generic = withCurrency ?? source.match(/(?:^|\s)(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s|$)/);
  if (!generic) return { amount: null, raw: "" };
  return { amount: parseTurkishMoney(generic[1]), raw: generic[0].trim() };
}

function numberFromToken(value) {
  return parseTurkishMoney(String(value ?? ""));
}

export function extractIndexedDenomination(input) {
  const text = normalizeFinanceText(input);

  const coin = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(ceyrek|yarim|tam|cumhuriyet)\s*altin\b/);
  if (coin) {
    return {
      code: COIN_CODES[coin[2]],
      quantity: numberFromToken(coin[1]),
      unit: "adet",
      assetClass: "metal",
      purity: null,
      karat: null,
      millesimal: null,
      raw: coin[0].trim(),
    };
  }

  const metal = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram)\s*(?:(24|22|18|14|8|999|958|925|900|835|800)\s*(?:ayar|saflik)?\s*)?(altin|gumus|platin|paladyum)\b/);
  if (metal) {
    const quantity = numberFromToken(metal[1]);
    const purityToken = metal[2] ? Number(metal[2]) : null;
    const metalName = metal[3];
    const code = METAL_CODES[metalName];
    const karat = metalName === "altin" && purityToken && purityToken <= 24 ? purityToken : null;
    const millesimal = purityToken && purityToken > 24 ? purityToken : null;
    const purity = karat ? karat / 24 : millesimal ? millesimal / 1000 : 1;
    return {
      code,
      quantity,
      unit: "gram",
      assetClass: "metal",
      purity,
      karat,
      millesimal,
      raw: metal[0].trim(),
    };
  }

  const currency = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(usd|dolar|eur|euro|gbp|sterlin)\b/);
  if (currency) {
    const token = currency[2];
    const code = token === "usd" || token === "dolar" ? "USD" : token === "eur" || token === "euro" ? "EUR" : "GBP";
    return {
      code,
      quantity: numberFromToken(currency[1]),
      unit: code,
      assetClass: "currency",
      purity: 1,
      karat: null,
      millesimal: null,
      raw: currency[0].trim(),
    };
  }
  return null;
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function detectPaymentMethod(text) {
  for (const [method, keywords] of paymentKeywords) {
    if (hasAny(text, keywords)) return method;
  }
  return "cash";
}

export function extractRecurrence(input) {
  const text = normalizeFinanceText(input);
  if (!/\bher\b|\bayda bir\b|\bhaftada bir\b|\byilda bir\b/.test(text)) return null;

  const monthlyDay = text.match(/her ay(?:in)?\s*(\d{1,2})/);
  if (monthlyDay) {
    const day = Number(monthlyDay[1]);
    if (day >= 1 && day <= 31) return { kind: "monthly", interval: 1, dayOfMonth: day, businessDayRule: "none" };
  }
  if (text.includes("her ay son is gunu") || text.includes("her ayin son is gunu")) {
    return { kind: "monthly", interval: 1, dayOfMonth: 31, businessDayRule: "last_business_day" };
  }
  const multiMonth = text.match(/(\d{1,2})\s*ayda bir/);
  if (multiMonth) return { kind: "monthly", interval: Math.max(1, Number(multiMonth[1])), dayOfMonth: null, businessDayRule: "none" };
  for (const [name, day] of Object.entries(WEEKDAYS)) {
    if (text.includes(`her ${name}`)) return { kind: "weekly", interval: 1, dayOfWeek: day, businessDayRule: "none" };
  }
  if (text.includes("her hafta") || text.includes("haftada bir")) return { kind: "weekly", interval: 1, dayOfWeek: null, businessDayRule: "none" };
  if (text.includes("her yil") || text.includes("yilda bir")) return { kind: "yearly", interval: 1, dayOfMonth: null, businessDayRule: "none" };
  if (text.includes("her ay")) return { kind: "monthly", interval: 1, dayOfMonth: null, businessDayRule: "none" };
  return null;
}

function detectInstallments(text) {
  const match = text.match(/\b(\d{1,2})\s*taksit\b/);
  return match ? Math.max(1, Number(match[1])) : 1;
}

function classifyBusiness(text, direction) {
  if (direction === "income") {
    if (hasAny(text, ["mama", "urun", "ilac", "vitamin", "aksesuar", "satis"])) return "product";
    if (hasAny(text, ["muayene", "asi", "ameliyat", "laboratuvar", "test", "hizmet", "danismanlik"])) return "service";
    return "other_income";
  }
  if (hasAny(text, ["cihaz", "ultrason", "rontgen", "yatirim", "tadilat", "sube", "demirbas", "makine", "mobilya", "arac"])) return "investment";
  if (hasAny(text, ["kira", "maas", "muhasebe", "internet", "abonelik", "sigorta", "yazilim"])) return "fixed";
  return "variable";
}

function stripKnownTokens(text, amountRaw, indexedRaw = "") {
  let cleaned = ` ${normalizeFinanceText(text)} `;
  for (const raw of [amountRaw, indexedRaw]) {
    if (raw) cleaned = cleaned.replace(` ${normalizeFinanceText(raw)} `, " ");
  }
  cleaned = cleaned
    .replace(/\b(?:tl|try|usd|dolar|eur|euro|gbp|sterlin|nakit|elden|kasa|kart|pos|havale|eft|banka|iban|transfer)\b/g, " ")
    .replace(/\b(?:gram|gr|ayar|saflik|altin|gumus|platin|paladyum|ceyrek|yarim|tam|cumhuriyet)\b/g, " ")
    .replace(/\b(?:gelir|gider|masraf|tahsilat|odeme|odendi|odedim|odeme yaptim|aldim|alindi|satis|sattim|fatura|fis|kira)\b/g, " ")
    .replace(/\b(?:borcuna|borcunu|borclandi|borclandik|borcumuz|borcu|borclu|borcluyuz|alacagim|alacak|borc|var)\b/g, " ")
    .replace(/\b(?:icin|olarak|bugun|simdi|kaydet|ekle|her|ay|ayin|hafta|yil|gunu|is|taksit|ayda|yilda|haftada|bir)\b/g, " ")
    .replace(/\b(?:pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)\b/g, " ")
    .replace(/\b\d{1,2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function partyVariants(value) {
  const raw = normalizeFinanceText(value);
  const variants = new Set([raw]);
  const words = raw.split(" ").filter(Boolean);
  if (words.length) {
    const last = words.at(-1);
    for (const suffix of ["dan", "den", "tan", "ten"]) {
      if (last.length > suffix.length + 2 && last.endsWith(suffix)) {
        variants.add([...words.slice(0, -1), last.slice(0, -suffix.length)].join(" "));
      }
    }
    for (const suffix of ["a", "e", "ya", "ye"]) {
      if (last.length > suffix.length + 2 && last.endsWith(suffix)) {
        variants.add([...words.slice(0, -1), last.slice(0, -suffix.length)].join(" "));
      }
    }
  }
  return [...variants].filter(Boolean);
}

export function counterpartyMatchScore(query, candidate) {
  const candidateNorm = normalizeFinanceText(candidate);
  if (!candidateNorm) return 0;
  let best = 0;
  for (const variant of partyVariants(query)) {
    if (!variant) continue;
    if (variant === candidateNorm) best = Math.max(best, 100);
    else if (candidateNorm.includes(variant) || variant.includes(candidateNorm)) best = Math.max(best, 84);
    else {
      const qWords = new Set(variant.split(" ").filter((word) => word.length > 1));
      const cWords = new Set(candidateNorm.split(" ").filter((word) => word.length > 1));
      const common = [...qWords].filter((word) => cWords.has(word)).length;
      if (common) best = Math.max(best, Math.round((common / Math.max(qWords.size, cWords.size)) * 70));
    }
  }
  return best;
}

export function findCounterpartyMatches(query, records, type) {
  return (records ?? [])
    .filter((record) => !type || record.type === type)
    .map((record) => ({ record, score: counterpartyMatchScore(query, record.counterparty) }))
    .filter((item) => item.score >= 40)
    .sort((left, right) => right.score - left.score || left.record.counterparty.localeCompare(right.record.counterparty, "tr"));
}

export function parseFinanceCommand(input) {
  const text = normalizeFinanceText(input);
  const indexed = extractIndexedDenomination(input);
  const money = indexed ? { amount: null, raw: "" } : extractFinanceAmount(input);
  const paymentMethod = detectPaymentMethod(text);
  const recurrence = extractRecurrence(input);
  const installmentCount = detectInstallments(text);

  let intent = "smart_inflow";
  if (recurrence && hasAny(text, ["kira", "gider", "masraf", "fatura", "maas", "muhasebe", "internet", "abonelik", "odeme"])) intent = "recurring_expense";
  else if (hasAny(text, ["borclandi", "borclu", "alacagim var", "alacak yaz", "alacak ekle"])) intent = "new_receivable";
  else if (hasAny(text, ["borclandik", "borcumuz", "borcluyuz", "borc yaz", "borc ekle"])) intent = installmentCount > 1 ? "installment_payable" : "new_payable";
  else if (hasAny(text, ["tahsilat", "tahsil ettim", "odeme aldim", "odemeyi aldim"])) intent = "receivable_payment";
  else if (hasAny(text, ["borcunu odedim", "borc odedim", "borcuna", "tedarikciye odedim"])) intent = "payable_payment";
  else if (hasAny(text, ["gider", "masraf", "fatura", "kira", "odedim", "odeme yaptim", "satin aldim", "aldim"])) intent = "smart_outflow";
  else if (hasAny(text, ["gelir", "satis", "sattim", "tahsil"])) intent = "smart_inflow";

  const counterpartyQuery = stripKnownTokens(input, money.raw, indexed?.raw || "");
  const quantity = indexed?.quantity ?? null;
  const amount = money.amount;
  const hasValue = Boolean((amount && amount > 0) || (quantity && quantity > 0));
  const confidence = hasValue && counterpartyQuery ? "high" : hasValue ? "medium" : "low";
  const direction = ["smart_outflow", "new_payable", "installment_payable", "payable_payment", "recurring_expense"].includes(intent) ? "expense" : "income";

  return {
    raw: String(input ?? ""),
    normalized: text,
    intent,
    amount,
    paymentMethod,
    counterpartyQuery,
    confidence,
    recurrence,
    installmentCount,
    businessClass: classifyBusiness(text, direction),
    denominationCode: indexed?.code ?? "TRY",
    denominationQuantity: quantity,
    denominationUnit: indexed?.unit ?? "TRY",
    denominationAssetClass: indexed?.assetClass ?? "currency",
    denominationPurity: indexed?.purity ?? 1,
    denominationKarat: indexed?.karat ?? null,
    denominationMillesimal: indexed?.millesimal ?? null,
    isIndexed: Boolean(indexed),
  };
}

export function resolveFinanceCommand(parsed, records) {
  const receivableMatches = findCounterpartyMatches(parsed.counterpartyQuery, records, "receivable");
  const payableMatches = findCounterpartyMatches(parsed.counterpartyQuery, records, "payable");
  let resolvedIntent = parsed.intent;
  let matches = [];

  if (parsed.intent === "smart_inflow") {
    if (receivableMatches.length) {
      resolvedIntent = "receivable_payment";
      matches = receivableMatches;
    } else resolvedIntent = "income";
  } else if (parsed.intent === "smart_outflow") {
    if (payableMatches.length) {
      resolvedIntent = "payable_payment";
      matches = payableMatches;
    } else resolvedIntent = "expense";
  } else if (parsed.intent === "receivable_payment") matches = receivableMatches;
  else if (parsed.intent === "payable_payment") matches = payableMatches;

  return { ...parsed, resolvedIntent, matches };
}
