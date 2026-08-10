const NUMBER = "(?:\\d+(?:[.,]\\d+)?)";

export const BASE_UNITS = Object.freeze({
  piece: { label: "adet", family: "count" },
  roll: { label: "rulo", family: "count" },
  tablet: { label: "tablet", family: "count" },
  ml: { label: "ml", family: "volume" },
  gram: { label: "gram", family: "mass" },
  cm: { label: "cm", family: "length" },
});

function numeric(value) {
  return Number(String(value).replace(",", "."));
}

function rounded(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function assertUnitDefinition(definition) {
  const multiplier = Number(definition.baseUnitsPerPurchaseUnit);
  if (!definition.baseUnit || !BASE_UNITS[definition.baseUnit]) {
    throw new Error("Geçerli bir temel stok birimi seçilmelidir.");
  }
  if (!definition.purchaseUnit?.trim()) {
    throw new Error("Satın alma birimi boş olamaz.");
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("Bir satın alma biriminin temel karşılığı sıfırdan büyük olmalıdır.");
  }
  return {
    ...definition,
    baseUnitsPerPurchaseUnit: rounded(multiplier),
    attributes: definition.attributes ?? {},
    aliases: Array.from(new Set((definition.aliases ?? []).map((item) => item.trim()).filter(Boolean))),
  };
}

export function receiptQuantityToBase({ purchaseQuantity, definition }) {
  const valid = assertUnitDefinition(definition);
  const quantity = Number(purchaseQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Fişteki satın alma miktarı sıfırdan büyük olmalıdır.");
  }
  return rounded(quantity * valid.baseUnitsPerPurchaseUnit);
}

export function unitCostFromReceipt({ totalNetAmount, purchaseQuantity, definition }) {
  const amount = Number(totalNetAmount);
  const baseQuantity = receiptQuantityToBase({ purchaseQuantity, definition });
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Net alış tutarı geçerli olmalıdır.");
  }
  return rounded(amount / baseQuantity);
}

export function weightedAverageCost({ currentQuantity, currentUnitCost, incomingQuantity, incomingUnitCost }) {
  const existingQuantity = Number(currentQuantity);
  const existingCost = Number(currentUnitCost);
  const addedQuantity = Number(incomingQuantity);
  const addedCost = Number(incomingUnitCost);
  if (![existingQuantity, existingCost, addedQuantity, addedCost].every(Number.isFinite) || existingQuantity < 0 || existingCost < 0 || addedQuantity <= 0 || addedCost < 0) {
    throw new Error("Ağırlıklı maliyet için miktar ve maliyetler geçerli olmalıdır.");
  }
  const totalQuantity = existingQuantity + addedQuantity;
  return totalQuantity === 0 ? 0 : rounded(((existingQuantity * existingCost) + (addedQuantity * addedCost)) / totalQuantity);
}

export function describeUnitDefinition(definition) {
  const valid = assertUnitDefinition(definition);
  return `1 ${valid.purchaseUnit} = ${valid.baseUnitsPerPurchaseUnit} ${BASE_UNITS[valid.baseUnit].label}`;
}

/**
 * Extracts safe suggestions from a receipt line. Ambiguous values deliberately
 * return requiresConfirmation instead of inventing a unit conversion.
 */
export function suggestStandardization(rawLine) {
  const text = String(rawLine ?? "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
  if (!text) return { requiresConfirmation: true, reason: "Kalem adı boş." };

  const toilet = text.match(new RegExp(String.raw`tuvalet\s*k[aâ]ğıd[ıi].*?(${NUMBER})\s*(?:li|lı|'lı|'li)`, "i"));
  if (toilet) {
    const count = numeric(toilet[1]);
    return {
      requiresConfirmation: false,
      productFamily: "toilet-paper",
      suggestedName: "Tuvalet kâğıdı",
      baseUnit: "roll",
      purchaseUnit: "paket",
      baseUnitsPerPurchaseUnit: count,
      // Paket içi adet, aynı ürünün satın alma biçimidir; ürün kimliği değildir.
      // 16'lı ve 32'li paket bu nedenle aynı rulo stoğuna eklenir.
      attributes: {},
    };
  }

  const alcohol = text.match(new RegExp(String.raw`(?:alkol|dezenfektan).*?(${NUMBER})\s*(ml|l|lt|litre)(?:\s|$)`, "i"));
  if (alcohol) {
    const amount = numeric(alcohol[1]);
    const multiplier = /^(l|lt|litre)$/i.test(alcohol[2]) ? amount * 1000 : amount;
    return {
      requiresConfirmation: false,
      productFamily: "alcohol",
      suggestedName: "Alkol / dezenfektan",
      baseUnit: "ml",
      purchaseUnit: "şişe",
      baseUnitsPerPurchaseUnit: multiplier,
      attributes: { concentration: text.match(/%(\d+(?:[.,]\d+)?)/)?.[1] ?? "" },
    };
  }

  const bandage = text.match(new RegExp(String.raw`(?:sarg[ıi]\s*bezi|bandaj).*?(${NUMBER})\s*cm\s*[x×*]\s*(${NUMBER})\s*(m|metre)(?:\s|$)`, "i"));
  if (bandage) {
    const widthCm = numeric(bandage[1]);
    const lengthMetre = numeric(bandage[2]);
    return {
      requiresConfirmation: false,
      productFamily: "bandage",
      suggestedName: "Sargı bezi",
      baseUnit: "cm",
      purchaseUnit: "rulo",
      baseUnitsPerPurchaseUnit: lengthMetre * 100,
      // Rulo uzunluğu satın alma miktarıdır; genişlik ise klinik kullanımda
      // ayırt edilmesi gereken varyanttır.
      attributes: { widthCm },
    };
  }

  if (/(?:sarg[ıi]\s*bezi|bandaj).*?\d+\s*cm\s*[x×*]\s*\d+/.test(text)) {
    return {
      requiresConfirmation: true,
      productFamily: "bandage",
      reason: "Sargı bezinin ikinci ölçüsünün metre mi, adet mi olduğu belirsiz.",
    };
  }

  return { requiresConfirmation: true, reason: "Standart ürün eşleşmesi bulunamadı." };
}

export function canMergeStockDefinitions(left, right) {
  const a = assertUnitDefinition(left);
  const b = assertUnitDefinition(right);
  if (a.productFamily !== b.productFamily || a.baseUnit !== b.baseUnit) return false;
  const compared = ["widthCm", "concentration", "material", "strength", "form"];
  return compared.every((key) => String(a.attributes[key] ?? "") === String(b.attributes[key] ?? ""));
}
