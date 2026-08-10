import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNTS,
  assertBalanced,
  consumeStockJournal,
  posSettlementJournal,
  purchaseJournal,
  reversalJournal,
  saleJournal,
  settlePayableJournal,
  settleReceivableJournal,
} from "../lib/journal-core.mjs";

test("vadeli tedarik faturası stok, KDV ve ticari borcu aynı olayda dengeler", () => {
  const lines = purchaseJournal({ netCents: 100_000, inputVatCents: 20_000, paymentMethod: "accrual", trackedInInventory: true, itemId: "stock-1" });
  assert.deepEqual(assertBalanced(lines), { debitCents: 120_000, creditCents: 120_000 });
  assert.equal(lines.find((item) => item.accountCode === ACCOUNTS.inventory)?.debitCents, 100_000);
  assert.equal(lines.find((item) => item.accountCode === ACCOUNTS.inputVat)?.debitCents, 20_000);
  assert.equal(lines.find((item) => item.accountCode === ACCOUNTS.tradePayable)?.creditCents, 120_000);
});

test("kısmi borç ödemesi gideri ikinci kez yazmaz", () => {
  const lines = settlePayableJournal({ amountCents: 30_000, paymentMethod: "transfer", counterparty: "Tedarikçi" });
  assert.equal(lines.some((item) => item.accountCode === ACCOUNTS.operatingExpense), false);
  assert.deepEqual(assertBalanced(lines), { debitCents: 30_000, creditCents: 30_000 });
});

test("vadeli satış, tahsilat ve kartlı satış birbirinden ayrılır", () => {
  const sale = saleJournal({ netCents: 50_000, outputVatCents: 10_000, paymentMethod: "accrual" });
  const collection = settleReceivableJournal({ amountCents: 20_000, paymentMethod: "transfer" });
  const card = saleJournal({ netCents: 20_000, outputVatCents: 4_000, paymentMethod: "card" });
  assert.equal(sale.find((item) => item.accountCode === ACCOUNTS.receivable)?.debitCents, 60_000);
  assert.equal(collection.some((item) => item.accountCode === ACCOUNTS.revenue), false);
  assert.equal(card.find((item) => item.accountCode === ACCOUNTS.posPending)?.debitCents, 24_000);
});

test("kart gideri bankayı anında azaltmaz, kart borcu yaratır", () => {
  const lines = purchaseJournal({ netCents: 10_000, inputVatCents: 2_000, paymentMethod: "card", trackedInInventory: false });
  assert.equal(lines.some((item) => item.accountCode === ACCOUNTS.bank), false);
  assert.equal(lines.find((item) => item.accountCode === ACCOUNTS.cardPayable)?.creditCents, 12_000);
});

test("bir POS yatışı çok satıştan gelen brüt/net/komisyonu dengeler", () => {
  const lines = posSettlementJournal({ grossCents: 100_000, commissionCents: 2_000, netCents: 98_000 });
  assert.deepEqual(assertBalanced(lines), { debitCents: 100_000, creditCents: 100_000 });
});

test("stok kullanımı kasa değil stok ve maliyet hesabını etkiler; ters kayıt görünür kalır", () => {
  const original = consumeStockJournal({ costCents: 4_500, itemId: "gauze" });
  const reverse = reversalJournal(original);
  assert.equal(original.some((item) => item.accountCode === ACCOUNTS.cash), false);
  assert.equal(reverse.find((item) => item.accountCode === ACCOUNTS.inventory)?.debitCents, 4_500);
});
