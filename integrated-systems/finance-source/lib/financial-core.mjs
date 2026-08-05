import { roundMoney } from "./finance.mjs";

const POSTING_MODES = new Set([
  "economic_and_cash",
  "cash_only",
  "economic_only",
]);

export function postingModeOf(transaction) {
  const mode = transaction?.postingMode || "economic_and_cash";
  if (!POSTING_MODES.has(mode)) {
    throw new RangeError("Geçersiz muhasebe etkisi.");
  }
  return mode;
}

export function hasEconomicEffect(transaction) {
  return postingModeOf(transaction) !== "cash_only";
}

export function hasCashEffect(transaction) {
  return postingModeOf(transaction) !== "economic_only";
}

export function expectedPosNet(transaction) {
  const amount = Number(transaction?.amount ?? 0);
  const rate = Number(transaction?.posRate ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("POS işlem tutarı negatif veya geçersiz olamaz.");
  }
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new RangeError("POS oranı 0 ile 1 arasında olmalıdır.");
  }
  return roundMoney(amount * (1 - rate));
}

export function resolvedPosNet(transaction) {
  const actual = transaction?.settledAmount;
  if (
    transaction?.posStatus === "settled" &&
    actual !== null &&
    actual !== undefined &&
    actual !== ""
  ) {
    const amount = Number(actual);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError("Gerçek POS yatışı negatif veya geçersiz olamaz.");
    }
    return roundMoney(amount);
  }
  return expectedPosNet(transaction);
}

export function datePlusDays(value, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    throw new TypeError("Tarih YYYY-MM-DD biçiminde olmalıdır.");
  }
  const normalizedDays = Number(days);
  if (!Number.isInteger(normalizedDays)) {
    throw new TypeError("Gün farkı tam sayı olmalıdır.");
  }
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Geçersiz tarih.");
  }
  date.setUTCDate(date.getUTCDate() + normalizedDays);
  return date.toISOString().slice(0, 10);
}

export function datePlusBusinessDays(value, days) {
  if (!Number.isInteger(Number(days)) || Number(days) < 0) {
    throw new TypeError("İş günü farkı negatif olmayan tam sayı olmalıdır.");
  }
  let result = String(value);
  let remaining = Number(days);
  while (remaining > 0) {
    result = datePlusDays(result, 1);
    const day = new Date(`${result}T12:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

export function normalizeLedgerPaymentMethod(method, recordType) {
  const value = String(method ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const aliases = {
    cash: "cash",
    nakit: "cash",
    transfer: "transfer",
    havale: "transfer",
    eft: "transfer",
    "havale / eft": "transfer",
    card: "card",
    kart: "card",
    "kart / pos": "card",
    "kredi kartı": "card",
  };
  const channel = aliases[value];
  if (!channel) {
    throw new RangeError(
      "Ödeme yöntemi Nakit, Havale / EFT veya Kart / POS olmalıdır.",
    );
  }
  if (recordType === "payable" && channel === "card") {
    throw new RangeError(
      "Borç ödemesinde kredi kartı yeni bir kart borcu doğurur. Önce kart hesabı tanımlanmadan bu kanal kullanılamaz.",
    );
  }
  return channel;
}
