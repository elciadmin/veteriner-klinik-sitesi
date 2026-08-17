import test from "node:test";
import assert from "node:assert/strict";
import { indexedAmountValue, indexedLedgerValue, indexedQuantityForAmount, remainingDenomination } from "../lib/indexed-ledger.mjs";

test("1000 USD borç 200 USD ödeme sonrası 800 USD kalır", () => {
  const record = {
    denominationCode: "USD",
    denominationQuantity: 1000,
    denominationOpenUnitPrice: 40,
    originalAmount: 40000,
    payments: [{ amount: 8400, denominationQuantity: 200, denominationUnitPrice: 42 }],
  };
  assert.equal(remainingDenomination(record), 800);
  const value = indexedLedgerValue(record, 45);
  assert.equal(value.currentValue, 36000);
  assert.equal(value.valuationDifference, 4000);
});

test("TRY eski kayıtlar miktarı doğrudan TL tutarından türetir", () => {
  const record = { originalAmount: 5000, payments: [{ amount: 1250 }] };
  assert.equal(remainingDenomination(record), 3750);
  assert.equal(indexedLedgerValue(record, 99).currentValue, 3750);
});

test("TL ödeme 14 ayar altın borcunu ödeme günündeki değerden gram olarak azaltır", () => {
  const record = { denominationCode: "XAU_GRAM", denominationKarat: 14, denominationPurity: 14 / 24 };
  const quantity = indexedQuantityForAmount(record, 20_000, 6_000);
  assert.equal(quantity, 5.71428571);
  assert.equal(indexedAmountValue(record, quantity, 6_000), 20_000);
});
