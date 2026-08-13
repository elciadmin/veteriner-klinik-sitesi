import test from "node:test";
import assert from "node:assert/strict";
import {
  counterpartyMatchScore,
  parseFinanceCommand,
  parseTurkishMoney,
  resolveFinanceCommand,
} from "../lib/finance-command.mjs";

test("Türkçe para biçimleri güvenli çözülür", () => {
  assert.equal(parseTurkishMoney("1.250,50 TL"), 1250.5);
  assert.equal(parseTurkishMoney("1250"), 1250);
  assert.equal(parseTurkishMoney("1.250"), 1250);
});

test("doğal gelir komutu tutar, kişi ve ödeme kanalını ayırır", () => {
  const parsed = parseFinanceCommand("1250 TL Elif Tuğba Bilimden nakit");
  assert.equal(parsed.amount, 1250);
  assert.equal(parsed.paymentMethod, "cash");
  assert.equal(parsed.counterpartyQuery, "elif tugba bilimden");
  assert.equal(parsed.intent, "smart_inflow");
});

test("Ayşe Hanımdan ifadesi açık alacakla eşleşir", () => {
  const parsed = parseFinanceCommand("Ayşe Hanımdan 5000 TL nakit");
  const result = resolveFinanceCommand(parsed, [
    { id: "r1", type: "receivable", counterparty: "Ayşe Hanım" },
  ]);
  assert.equal(result.resolvedIntent, "receivable_payment");
  assert.equal(result.matches[0].record.id, "r1");
});

test("borç ödemesi tedarikçi kaydına yönlenir", () => {
  const parsed = parseFinanceCommand("Hasvet'e 3000 TL havale ödedim");
  const result = resolveFinanceCommand(parsed, [
    { id: "p1", type: "payable", counterparty: "Hasvet" },
  ]);
  assert.equal(result.resolvedIntent, "payable_payment");
  assert.equal(result.matches[0].record.id, "p1");
  assert.equal(result.paymentMethod, "transfer");
});

test("harcama cümlesi güvenle gider olarak yorumlanır", () => {
  const parsed = parseFinanceCommand("Sigara ve soda için kasadan 185 TL harcadım");
  assert.equal(parsed.intent, "smart_outflow");
  assert.equal(parsed.amount, 185);
  assert.equal(parsed.paymentMethod, "cash");
});

test("eşleşen cari yoksa gelen para normal gelir olur", () => {
  const parsed = parseFinanceCommand("2000 TL yeni müşteri kart");
  const result = resolveFinanceCommand(parsed, []);
  assert.equal(result.resolvedIntent, "income");
});

test("cari eşleştirme tam adı öne çıkarır", () => {
  assert.ok(counterpartyMatchScore("Ayşe Hanımdan", "Ayşe Hanım") >= 80);
  assert.equal(counterpartyMatchScore("Elif Tuğba Bilimden", "Elif Tuğba Bilimden"), 100);
});
