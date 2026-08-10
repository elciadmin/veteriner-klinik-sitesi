import test from "node:test";
import assert from "node:assert/strict";

import {
  canMergeStockDefinitions,
  receiptQuantityToBase,
  suggestStandardization,
  unitCostFromReceipt,
  weightedAverageCost,
} from "../lib/stock-units.mjs";

test("16'lı ve 32'li tuvalet kağıdı rulo bazına dönüşür", () => {
  const sixteen = suggestStandardization("Tuvalet kağıdı 16'lı");
  const thirtyTwo = suggestStandardization("Tuvalet kağıdı 32'li");
  assert.equal(receiptQuantityToBase({ purchaseQuantity: 2, definition: sixteen }), 32);
  assert.equal(receiptQuantityToBase({ purchaseQuantity: 1, definition: thirtyTwo }), 32);
  assert.equal(unitCostFromReceipt({ totalNetAmount: 120, purchaseQuantity: 2, definition: sixteen }), 3.75);
});

test("alkol litre veya mililitre ile aynı temel stoğa dönüşür", () => {
  const litre = suggestStandardization("Etil alkol %70 1 litre");
  const smallBottle = suggestStandardization("Etil alkol %70 100 ml");
  assert.equal(receiptQuantityToBase({ purchaseQuantity: 1, definition: litre }), 1000);
  assert.equal(receiptQuantityToBase({ purchaseQuantity: 1, definition: smallBottle }), 100);
  assert.equal(canMergeStockDefinitions(litre, smallBottle), true);
});

test("sargı bezinde genişlik varyantı korunur, uzunluk temel stoğa dönüşür", () => {
  const tenMetre = suggestStandardization("Sargı bezi 5 cm x 10 m");
  const hundredMetre = suggestStandardization("Sargı bezi 5 cm x 100 metre");
  const wideBandage = suggestStandardization("Sargı bezi 10 cm x 10 m");
  assert.equal(receiptQuantityToBase({ purchaseQuantity: 1, definition: tenMetre }), 1000);
  assert.equal(receiptQuantityToBase({ purchaseQuantity: 1, definition: hundredMetre }), 10000);
  assert.equal(canMergeStockDefinitions(tenMetre, hundredMetre), true);
  assert.equal(canMergeStockDefinitions(tenMetre, wideBandage), false);
});

test("sargı bezindeki belirsiz ikinci ölçü onay ister", () => {
  const result = suggestStandardization("Sargı bezi 5 cm x 100");
  assert.equal(result.requiresConfirmation, true);
});

test("hareketli ağırlıklı maliyet paket değil temel birim maliyetiyle çalışır", () => {
  assert.equal(weightedAverageCost({ currentQuantity: 32, currentUnitCost: 3.75, incomingQuantity: 32, incomingUnitCost: 3.4375 }), 3.59375);
});
