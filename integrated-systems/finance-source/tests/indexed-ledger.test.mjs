import test from "node:test";
import assert from "node:assert/strict";
import { indexedLedgerValue, remainingDenomination } from "../lib/indexed-ledger.mjs";

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
