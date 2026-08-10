import { receiptQuantityToBase, suggestStandardization } from "./stock-units.mjs";

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("Fiş tutarı geçerli değil.");
  return Math.round(number * 100) / 100;
}

/** Converts OCR/import text into a safe review draft. Nothing is posted here. */
export function prepareReceiptReview({ supplier = "", documentDate = "", documentRef = "", declaredTotal = 0, lines = [] }) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) throw new Error("Fiş 1–50 kalem içermelidir.");
  const reviewedLines = lines.map((raw, index) => {
    const quantity = Number(raw.purchaseQuantity ?? raw.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`${index + 1}. kalemin miktarı geçersiz.`);
    const suggestion = suggestStandardization(raw.name ?? raw.description ?? "");
    const total = money(raw.total ?? (Number(raw.unitPrice ?? 0) * quantity));
    return {
      lineNo: index + 1,
      name: String(raw.name ?? raw.description ?? "").trim(),
      purchaseQuantity: quantity,
      total,
      // A recognised product family is potentially stock even when its
      // measurement is incomplete; that case must stop for review instead
      // of silently becoming an ordinary expense.
      stockTracked: Boolean(raw.stockTracked ?? Boolean(suggestion.productFamily)),
      suggestion,
      baseQuantity: suggestion.requiresConfirmation ? null : receiptQuantityToBase({ purchaseQuantity: quantity, definition: suggestion }),
      status: suggestion.requiresConfirmation ? "needs_confirmation" : "ready",
    };
  });
  return {
    status: reviewedLines.some((line) => line.status !== "ready") ? "needs_review" : "ready_for_confirmation",
    supplier: String(supplier).trim(),
    documentDate: String(documentDate).trim(),
    documentRef: String(documentRef).trim(),
    declaredTotal: money(declaredTotal),
    calculatedTotal: money(reviewedLines.reduce((sum, line) => sum + line.total, 0)),
    lines: reviewedLines,
  };
}

/**
 * Conservative OCR text parser. It only proposes rows that look like a
 * receipt line ending in money; totals, tax lines and low-confidence text are
 * left out. The human review is still the authority.
 */
export function extractReceiptCandidates(extractedText) {
  const ignored = /(?:ara\s*toplam|genel\s*toplam|toplam|kdv|nakit|kart|para\s*üstü|vergi|indirim)/i;
  const moneyAtEnd = /^(.*?)\s+(\d+(?:[.,]\d{2}))\s*(?:tl|try|₺)?\s*$/i;
  // Only peel off an explicit purchasing count. Measurements (1 litre,
  // 100 ml, 10 m) stay in the name because they define stock conversion.
  const quantity = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:adet|paket|kutu|şişe|rulo)?\s*$/i;
  const candidates = [];
  for (const rawLine of String(extractedText ?? "").split(/\r?\n/)) {
    const text = rawLine.replace(/\s+/g, " ").trim();
    if (!text || ignored.test(text)) continue;
    const match = text.match(moneyAtEnd);
    if (!match) continue;
    let name = match[1].trim();
    if (name.length < 2 || name.length > 140) continue;
    const quantityMatch = name.match(quantity);
    const purchaseQuantity = quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : 1;
    if (quantityMatch) name = name.slice(0, quantityMatch.index).trim() || name;
    const total = Number(match[2].replace(",", "."));
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(purchaseQuantity) || purchaseQuantity <= 0) continue;
    candidates.push({ name, purchaseQuantity, total });
    if (candidates.length === 50) break;
  }
  return candidates;
}

/** Confirmation deliberately requires a human-resolved definition for all stock rows. */
export function assertReceiptReadyToPost(review) {
  if (!review || !Array.isArray(review.lines) || !review.lines.length) throw new Error("Onaylanacak fiş satırı yok.");
  const tolerance = 0.01;
  if (Math.abs(Number(review.declaredTotal) - Number(review.calculatedTotal)) > tolerance) {
    throw new Error("Fiş toplamı kalem toplamıyla uyuşmuyor.");
  }
  const pending = review.lines.filter((line) => line.stockTracked && (!line.suggestion || line.suggestion.requiresConfirmation || !line.baseQuantity));
  if (pending.length) throw new Error(`${pending.length} stok kalemi için birim standardı onayı bekleniyor.`);
  return true;
}
