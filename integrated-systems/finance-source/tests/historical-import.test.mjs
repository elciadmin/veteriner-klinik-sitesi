import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chunkHistoricalTransactions, historicalImportQuality, historicalImportSummary, validateHistoricalImportPackage } from "../lib/historical-import.mjs";

const payload = JSON.parse(readFileSync(resolve("tests/fixtures/historical-import-sample.json"), "utf8"));

test("anonim aktarım paketi temiz kurulumda doğrulanır", () => {
  const summary = validateHistoricalImportPackage(payload);
  assert.equal(summary.transactionCount, 2);
  assert.equal(summary.incomeTotal, 3500);
  assert.equal(summary.recurringRuleCount, 1);
  assert.equal(summary.debtRemaining, 600);
});

test("geçmiş gelirler kasa/bankayı doğrudan değiştirmez", () => {
  assert.ok(payload.transactions.every((row) => row.kind === "income" && row.paymentMethod === "accrual" && row.postingMode === "economic_only"));
  assert.equal(chunkHistoricalTransactions(payload.transactions).flat().length, 2);
});

test("değiştirilmiş aktarım paketi reddedilir", () => {
  const copy = structuredClone(payload);
  copy.transactions[0].postingMode = "economic_and_cash";
  assert.throws(() => validateHistoricalImportPackage(copy), /kasa\/banka bakiyesini değiştiremez/);
});

test("eksik geçmiş veri rapora girebilir ama tammış gibi etiketlenmez", () => {
  const quality = historicalImportQuality(payload);
  assert.equal(quality.coverageStartDate, "2026-01-02");
  assert.ok(quality.completenessBps > 0 && quality.completenessBps < 10000);
  assert.ok(quality.warnings.some((warning) => warning.includes("gider")));
  assert.ok(quality.warnings.some((warning) => warning.includes("kasa/banka")));
});
