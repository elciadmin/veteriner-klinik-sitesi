function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function affectsCash(transaction) {
  const mode = transaction.postingMode || "economic_and_cash";
  return mode !== "economic_only" && transaction.paymentMethod === "cash" && transaction.status !== "cancelled";
}

/** Computes a transparent cash bridge; it never invents an opening or count. */
export function assessDayClose({ date, transactions = [], openingCash, physicalCash, varianceReason = "" }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error("Gün sonu tarihi geçersiz.");
  const opening = openingCash === null || openingCash === undefined || openingCash === "" ? null : Number(openingCash);
  const count = physicalCash === null || physicalCash === undefined || physicalCash === "" ? null : Number(physicalCash);
  if (opening !== null && (!Number.isFinite(opening) || opening < 0)) throw new Error("Açılış kasası geçersiz.");
  if (count !== null && (!Number.isFinite(count) || count < 0)) throw new Error("Fizikî kasa sayımı geçersiz.");
  const dayTransactions = transactions.filter((item) => item.date === date && affectsCash(item));
  const cashDelta = dayTransactions.reduce((sum, item) => {
    const value = Number(item.amount || 0);
    if (!Number.isFinite(value)) return sum;
    return item.kind === "income" ? sum + value : sum - value;
  }, 0);
  const expectedCash = opening === null ? null : round(opening + cashDelta);
  const cashDifference = expectedCash === null || count === null ? null : round(count - expectedCash);
  const missingDocuments = transactions.filter((item) => item.date === date && item.kind === "expense" && item.status !== "cancelled" && (item.documentType === "none" || !item.documentRef));
  const pendingPos = transactions.filter((item) => item.date === date && item.kind === "income" && item.paymentMethod === "card" && item.status !== "cancelled" && item.posStatus !== "settled");
  const blockers = [];
  if (opening === null) blockers.push("Açılış kasası doğrulanmadı.");
  if (count === null) blockers.push("Fizikî kasa sayımı girilmedi.");
  if (cashDifference !== null && Math.abs(cashDifference) > 0.005 && !String(varianceReason).trim()) blockers.push("Kasa farkı için gerekçe zorunlu.");
  return {
    date,
    openingCash: opening,
    expectedCash,
    physicalCash: count,
    cashDifference,
    cashMovementCount: dayTransactions.length,
    pendingPosCount: pendingPos.length,
    missingDocumentCount: missingDocuments.length,
    blockers,
    readyToClose: blockers.length === 0,
  };
}

export function assertDayCloseReady(assessment) {
  if (!assessment?.readyToClose) throw new Error((assessment?.blockers ?? ["Gün sonu kontrolü tamamlanmadı."]).join(" "));
  return true;
}
