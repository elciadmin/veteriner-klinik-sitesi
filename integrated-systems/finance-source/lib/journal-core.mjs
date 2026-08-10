/**
 * A small, deterministic double-entry engine. It has no database dependency
 * so every event can be tested before the D1 adapter writes it.
 */
export const ACCOUNTS = Object.freeze({
  cash: "100-CASH",
  bank: "102-BANK",
  posPending: "108-POS-PENDING",
  receivable: "120-TRADE-RECEIVABLE",
  inventory: "153-INVENTORY",
  inputVat: "191-INPUT-VAT",
  cardPayable: "320-CREDIT-CARD-PAYABLE",
  tradePayable: "320-TRADE-PAYABLE",
  outputVat: "391-OUTPUT-VAT",
  revenue: "600-REVENUE",
  costOfSales: "621-COST-OF-SALES",
  operatingExpense: "770-OPERATING-EXPENSE",
  posCommission: "780-POS-COMMISSION",
  ownerDraw: "331-OWNER-DRAW",
});

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} sıfırdan büyük tam kuruş olmalıdır.`);
  return parsed;
}

function line(accountCode, debitCents = 0, creditCents = 0, extra = {}) {
  if ((debitCents > 0) === (creditCents > 0)) throw new Error("Her jurnal satırı yalnız borç veya alacak içermelidir.");
  return { accountCode, debitCents, creditCents, ...extra };
}

export function assertBalanced(lines) {
  const debit = lines.reduce((sum, item) => sum + item.debitCents, 0);
  const credit = lines.reduce((sum, item) => sum + item.creditCents, 0);
  if (debit !== credit) throw new Error(`Jurnal dengede değil: borç ${debit}, alacak ${credit}.`);
  return { debitCents: debit, creditCents: credit };
}

function paymentAccount(method) {
  if (method === "cash") return ACCOUNTS.cash;
  if (method === "transfer") return ACCOUNTS.bank;
  if (method === "card") return ACCOUNTS.posPending;
  if (method === "accrual") return ACCOUNTS.receivable;
  throw new Error("Bilinmeyen tahsilat yöntemi.");
}

/** Sale: income and output VAT are never re-created at collection time. */
export function saleJournal({ netCents, outputVatCents = 0, paymentMethod, counterparty = "" }) {
  const net = positiveInteger(netCents, "Net satış");
  const vat = Number(outputVatCents);
  if (!Number.isInteger(vat) || vat < 0) throw new Error("Hesaplanan KDV geçersiz.");
  const total = net + vat;
  const lines = [
    line(paymentAccount(paymentMethod), total, 0, { counterparty }),
    line(ACCOUNTS.revenue, 0, net),
  ];
  if (vat) lines.push(line(ACCOUNTS.outputVat, 0, vat));
  assertBalanced(lines);
  return lines;
}

/** Purchase can be a stock asset or an immediate operating cost. */
export function purchaseJournal({ netCents, inputVatCents = 0, paymentMethod, trackedInInventory, counterparty = "", itemId }) {
  const net = positiveInteger(netCents, "Net alış");
  const vat = Number(inputVatCents);
  if (!Number.isInteger(vat) || vat < 0) throw new Error("İndirilecek KDV geçersiz.");
  const total = net + vat;
  const creditAccount = paymentMethod === "cash" ? ACCOUNTS.cash
    : paymentMethod === "transfer" ? ACCOUNTS.bank
    : paymentMethod === "card" ? ACCOUNTS.cardPayable
    : paymentMethod === "accrual" ? ACCOUNTS.tradePayable
    : null;
  if (!creditAccount) throw new Error("Bilinmeyen ödeme yöntemi.");
  const lines = [
    line(trackedInInventory ? ACCOUNTS.inventory : ACCOUNTS.operatingExpense, net, 0, { counterparty, itemId }),
    line(creditAccount, 0, total, { counterparty }),
  ];
  if (vat) lines.splice(1, 0, line(ACCOUNTS.inputVat, vat, 0));
  assertBalanced(lines);
  return lines;
}

export function settleReceivableJournal({ amountCents, paymentMethod, counterparty = "" }) {
  const amount = positiveInteger(amountCents, "Tahsilat");
  const account = paymentMethod === "cash" ? ACCOUNTS.cash : paymentMethod === "transfer" ? ACCOUNTS.bank : paymentMethod === "card" ? ACCOUNTS.posPending : null;
  if (!account) throw new Error("Tahsilat yöntemi geçersiz.");
  const lines = [line(account, amount, 0, { counterparty }), line(ACCOUNTS.receivable, 0, amount, { counterparty })];
  assertBalanced(lines);
  return lines;
}

export function settlePayableJournal({ amountCents, paymentMethod, counterparty = "" }) {
  const amount = positiveInteger(amountCents, "Ödeme");
  const account = paymentMethod === "cash" ? ACCOUNTS.cash : paymentMethod === "transfer" ? ACCOUNTS.bank : paymentMethod === "card" ? ACCOUNTS.cardPayable : null;
  if (!account) throw new Error("Ödeme yöntemi geçersiz.");
  const lines = [line(ACCOUNTS.tradePayable, amount, 0, { counterparty }), line(account, 0, amount, { counterparty })];
  assertBalanced(lines);
  return lines;
}

export function posSettlementJournal({ grossCents, commissionCents, netCents }) {
  const gross = positiveInteger(grossCents, "POS brüt yatışı");
  const commission = Number(commissionCents);
  const net = positiveInteger(netCents, "POS net yatışı");
  if (!Number.isInteger(commission) || commission < 0 || gross !== commission + net) throw new Error("POS batch brüt, komisyon ve net toplamı uyuşmuyor.");
  const lines = [line(ACCOUNTS.bank, net, 0), line(ACCOUNTS.posPending, 0, gross)];
  if (commission) lines.splice(1, 0, line(ACCOUNTS.posCommission, commission, 0));
  assertBalanced(lines);
  return lines;
}

export function consumeStockJournal({ costCents, itemId }) {
  const cost = positiveInteger(costCents, "Stok maliyeti");
  const lines = [line(ACCOUNTS.costOfSales, cost, 0, { itemId }), line(ACCOUNTS.inventory, 0, cost, { itemId })];
  assertBalanced(lines);
  return lines;
}

export function reversalJournal(originalLines) {
  if (!Array.isArray(originalLines) || !originalLines.length) throw new Error("Terslenecek jurnal satırı yok.");
  const lines = originalLines.map((item) => line(item.accountCode, item.creditCents, item.debitCents, { counterparty: item.counterparty, itemId: item.itemId }));
  assertBalanced(lines);
  return lines;
}
