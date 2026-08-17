export const DENOMINATION_META = Object.freeze({
  TRY: { label: "Türk lirası", assetClass: "currency", unit: "TRY", valueMode: "unit", autoRate: true },
  USD: { label: "ABD doları", assetClass: "currency", unit: "USD", valueMode: "unit", autoRate: true },
  EUR: { label: "Euro", assetClass: "currency", unit: "EUR", valueMode: "unit", autoRate: true },
  GBP: { label: "İngiliz sterlini", assetClass: "currency", unit: "GBP", valueMode: "unit", autoRate: true },
  XAU_GRAM: { label: "Altın · gram", assetClass: "metal", metal: "gold", unit: "gram", valueMode: "pure_gram", autoRate: false },
  XAG_GRAM: { label: "Gümüş · gram", assetClass: "metal", metal: "silver", unit: "gram", valueMode: "pure_gram", autoRate: false },
  XPT_GRAM: { label: "Platin · gram", assetClass: "metal", metal: "platinum", unit: "gram", valueMode: "pure_gram", autoRate: false },
  XPD_GRAM: { label: "Paladyum · gram", assetClass: "metal", metal: "palladium", unit: "gram", valueMode: "pure_gram", autoRate: false },
  XAU_QUARTER: { label: "Çeyrek altın · adet", assetClass: "metal", metal: "gold", unit: "adet", valueMode: "piece", autoRate: false },
  XAU_HALF: { label: "Yarım altın · adet", assetClass: "metal", metal: "gold", unit: "adet", valueMode: "piece", autoRate: false },
  XAU_FULL: { label: "Tam altın · adet", assetClass: "metal", metal: "gold", unit: "adet", valueMode: "piece", autoRate: false },
  XAU_REPUBLIC: { label: "Cumhuriyet altını · adet", assetClass: "metal", metal: "gold", unit: "adet", valueMode: "piece", autoRate: false },
});

export const DENOMINATION_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(DENOMINATION_META).map(([code, meta]) => [code, meta.label])),
);

export const GOLD_KARATS = Object.freeze([24, 22, 18, 14, 8]);
export const SILVER_FINENESS = Object.freeze([999, 958, 925, 900, 835, 800]);

export function normalizeDenomination(value) {
  const code = String(value ?? "TRY").trim().toUpperCase();
  return Object.hasOwn(DENOMINATION_META, code) ? code : "TRY";
}

export function denominationMeta(value) {
  return DENOMINATION_META[normalizeDenomination(value)];
}

export function purityFactor(record) {
  const meta = denominationMeta(record?.denominationCode);
  if (meta.valueMode !== "pure_gram") return 1;

  const explicit = Number(record?.denominationPurity ?? 0);
  if (Number.isFinite(explicit) && explicit > 0 && explicit <= 1) return explicit;

  const karat = Number(record?.denominationKarat ?? 0);
  if (meta.metal === "gold" && Number.isFinite(karat) && karat > 0 && karat <= 24) {
    return karat / 24;
  }

  const millesimal = Number(record?.denominationMillesimal ?? 0);
  if (Number.isFinite(millesimal) && millesimal > 0 && millesimal <= 1000) {
    return millesimal / 1000;
  }

  return 1;
}

export function denominationDescriptor(record) {
  const code = normalizeDenomination(record?.denominationCode);
  const meta = denominationMeta(code);
  const purity = purityFactor(record);
  let purityLabel = "";
  if (meta.metal === "gold" && Number(record?.denominationKarat || 0) > 0) {
    purityLabel = `${Number(record.denominationKarat)} ayar`;
  } else if (meta.metal && purity < 1) {
    purityLabel = `${Math.round(purity * 1000)} saflık`;
  }
  return {
    code,
    ...meta,
    purity,
    purityLabel,
    display: [meta.label, purityLabel].filter(Boolean).join(" · "),
  };
}

export function openingQuantity(record) {
  const code = normalizeDenomination(record?.denominationCode);
  const explicit = Number(record?.denominationQuantity ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (code === "TRY") return Math.max(0, Number(record?.originalAmount ?? 0));
  const rate = Number(record?.denominationOpenUnitPrice ?? 0);
  const factor = purityFactor(record);
  return rate > 0 && factor > 0
    ? Math.max(0, Number(record?.originalAmount ?? 0) / rate / factor)
    : 0;
}

export function paymentQuantity(payment, record) {
  if (payment?.status === "cancelled") return 0;
  const code = normalizeDenomination(record?.denominationCode);
  const explicit = Number(payment?.denominationQuantity ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (code === "TRY") return Math.max(0, Number(payment?.amount ?? 0));
  const rate = Number(payment?.denominationUnitPrice ?? 0);
  const factor = purityFactor(record);
  return rate > 0 && factor > 0
    ? Math.max(0, Number(payment?.amount ?? 0) / rate / factor)
    : 0;
}

export function remainingDenomination(record) {
  const original = openingQuantity(record);
  const paid = (record?.payments ?? []).reduce(
    (sum, payment) => sum + paymentQuantity(payment, record),
    0,
  );
  return Math.max(0, Math.round((original - paid) * 1e8) / 1e8);
}

export function pureMetalEquivalent(record) {
  const meta = denominationMeta(record?.denominationCode);
  if (meta.valueMode !== "pure_gram") return null;
  return Math.round(remainingDenomination(record) * purityFactor(record) * 1e8) / 1e8;
}

export function indexedAmountValue(record, quantity, unitPrice) {
  const code = normalizeDenomination(record?.denominationCode);
  if (code === "TRY") return Math.max(0, Number(quantity || 0));
  const price = Number(unitPrice || 0);
  const qty = Math.max(0, Number(quantity || 0));
  if (!Number.isFinite(price) || price <= 0) return null;
  const meta = denominationMeta(code);
  const factor = meta.valueMode === "pure_gram" ? purityFactor(record) : 1;
  return Math.round(qty * factor * price * 100) / 100;
}

/** Converts a TL payment into the native quantity of an indexed debt. */
export function indexedQuantityForAmount(record, amount, unitPrice) {
  const value = Math.max(0, Number(amount || 0));
  if (!Number.isFinite(value) || value <= 0) return null;
  const code = normalizeDenomination(record?.denominationCode);
  if (code === "TRY") return Math.round(value * 1e8) / 1e8;
  const oneUnitValue = indexedAmountValue(record, 1, unitPrice);
  if (!Number.isFinite(oneUnitValue) || oneUnitValue <= 0) return null;
  return Math.round((value / oneUnitValue) * 1e8) / 1e8;
}

export function indexedLedgerValue(record, currentUnitPrice) {
  const code = normalizeDenomination(record?.denominationCode);
  const remainingQuantity = remainingDenomination(record);
  const openRate = code === "TRY" ? 1 : Number(record?.denominationOpenUnitPrice ?? 0);
  const currentRate = code === "TRY" ? 1 : Number(currentUnitPrice ?? openRate);
  const factor = purityFactor(record);
  const currentValue = Number.isFinite(currentRate) && currentRate > 0
    ? indexedAmountValue(record, remainingQuantity, currentRate)
    : null;
  const openingValue = indexedAmountValue(record, openingQuantity(record), openRate) ?? 0;
  const openRemainingValue = indexedAmountValue(record, remainingQuantity, openRate) ?? 0;
  return {
    code,
    remainingQuantity,
    pureQuantity: denominationMeta(code).valueMode === "pure_gram"
      ? Math.round(remainingQuantity * factor * 1e8) / 1e8
      : null,
    purity: factor,
    openingUnitPrice: openRate,
    currentUnitPrice: Number.isFinite(currentRate) && currentRate > 0 ? currentRate : null,
    openingValue,
    currentValue,
    valuationDifference: currentValue === null ? null : currentValue - openRemainingValue,
  };
}
