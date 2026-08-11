import test from "node:test";
import assert from "node:assert/strict";
import { validateHistoricalImportPackage } from "../lib/historical-import.mjs";

test("yalnız gelir içeren geçmiş aktarım paketi doğrulanır", () => {
  const payload = {
    schemaVersion: 1,
    importId: "income-only-test",
    transactions: [{
      id: "hist-elci-income-2026-08-01",
      date: "2026-08-01",
      time: "12:00",
      kind: "income",
      category: "Geçmiş günlük klinik geliri",
      description: "Test",
      amount: 100,
      paymentMethod: "accrual",
      postingMode: "economic_only",
      sourceModule: "historical_excel_import",
      sourceRecordId: "income-only-test:gelir:0001",
    }],
    recurringRules: [],
    ledgerPackage: { record: null, payments: [] },
    summary: { incomeTransactions: 1, incomeTotal: 100, debtRemaining: 0 },
  };
  const summary = validateHistoricalImportPackage(payload);
  assert.equal(summary.transactionCount, 1);
  assert.equal(summary.debtRemaining, 0);
});
