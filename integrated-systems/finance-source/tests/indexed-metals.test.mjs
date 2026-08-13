import test from "node:test";
import assert from "node:assert/strict";
import {
  denominationDescriptor,
  indexedAmountValue,
  indexedLedgerValue,
  pureMetalEquivalent,
  remainingDenomination,
} from "../lib/indexed-ledger.mjs";

test("14 ayar altın borcu gramı korur, TL değerini saflıkla hesaplar", () => {
  const record = {
    denominationCode: "XAU_GRAM",
    denominationQuantity: 15,
    denominationKarat: 14,
    denominationPurity: 14 / 24,
    denominationOpenUnitPrice: 3000,
    originalAmount: 26250,
    payments: [],
  };
  assert.equal(remainingDenomination(record), 15);
  assert.equal(pureMetalEquivalent(record), 8.75);
  assert.equal(indexedLedgerValue(record, 4000).currentValue, 35000);
  assert.equal(denominationDescriptor(record).purityLabel, "14 ayar");
});

test("925 gümüş değerlemesi saf gram fiyatını saflık katsayısıyla uygular", () => {
  const record = {
    denominationCode: "XAG_GRAM",
    denominationQuantity: 250,
    denominationPurity: 0.925,
    denominationMillesimal: 925,
    denominationOpenUnitPrice: 40,
    originalAmount: 9250,
    payments: [{ denominationQuantity: 50, denominationUnitPrice: 42, amount: 1942.5 }],
  };
  assert.equal(remainingDenomination(record), 200);
  assert.equal(pureMetalEquivalent(record), 185);
  assert.equal(indexedAmountValue(record, 200, 50), 9250);
});

test("adet bazlı çeyrek altın fiyatında ayar katsayısı ayrıca uygulanmaz", () => {
  const record = {
    denominationCode: "XAU_QUARTER",
    denominationQuantity: 2,
    denominationPurity: 0.916,
    denominationOpenUnitPrice: 7000,
    originalAmount: 14000,
    payments: [],
  };
  assert.equal(indexedLedgerValue(record, 8000).currentValue, 16000);
});
