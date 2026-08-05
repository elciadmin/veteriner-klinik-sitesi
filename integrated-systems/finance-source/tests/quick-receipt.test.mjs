import assert from "node:assert/strict";
import test from "node:test";

import { activeReceiptLines, quickReceiptTotal, receiptTotalsMatch, validReceiptLineCount } from "../lib/quick-receipt.mjs";

test("çok kalemli fiş kuruş hassasiyetinde toplanır", () => {
  assert.equal(quickReceiptTotal([{ amount: "10.10" }, { amount: 20.25 }, { amount: "0" }]), 30.35);
});

test("boş satırlar aktif fiş satırı sayılmaz", () => {
  assert.equal(activeReceiptLines([{ itemName: "", amount: "" }, { itemName: "Kağıt havlu", amount: "45" }]).length, 1);
});

test("yazılan fiş toplamı satır toplamıyla karşılaştırılır", () => {
  const lines = [{ amount: 25.5 }, { amount: 74.5 }];
  assert.equal(receiptTotalsMatch(lines, 100), true);
  assert.equal(receiptTotalsMatch(lines, 99.5), false);
});

test("fiş 1 ile 50 dolu satır arasında kabul edilir", () => {
  assert.equal(validReceiptLineCount([{ itemName: "A", amount: 1 }]), true);
  assert.equal(validReceiptLineCount([]), false);
  assert.equal(validReceiptLineCount(Array.from({ length: 51 }, (_, i) => ({ itemName: `K${i}`, amount: 1 }))), false);
});
