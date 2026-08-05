import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  chunkHistoricalTransactions,
  historicalImportSummary,
  validateHistoricalImportPackage,
} from "../lib/historical-import.mjs";

const payload = JSON.parse(
  readFileSync(resolve("data/imports/elci-20260805.json"), "utf8"),
);

test("prepared workbook package validates", () => {
  const summary = validateHistoricalImportPackage(payload);
  assert.equal(summary.transactionCount, 1034);
  assert.equal(summary.incomeTotal, 6_160_202);
  assert.equal(summary.recurringRuleCount, 27);
  assert.equal(summary.debtPaymentCount, 17);
  assert.equal(summary.debtOriginalAmount, 756_225.59);
  assert.equal(summary.debtPaymentsTotal, 401_225.59);
  assert.equal(summary.debtRemaining, 355_000);
});

test("daily income import is deterministic and cash-neutral", () => {
  const ids = new Set(payload.transactions.map((row) => row.id));
  const sources = new Set(payload.transactions.map((row) => row.sourceRecordId));
  assert.equal(ids.size, payload.transactions.length);
  assert.equal(sources.size, payload.transactions.length);
  assert.ok(payload.transactions.every((row) => row.kind === "income"));
  assert.ok(payload.transactions.every((row) => row.paymentMethod === "accrual"));
  assert.ok(payload.transactions.every((row) => row.postingMode === "economic_only"));
  assert.ok(payload.transactions.every((row) => row.sourceModule === "historical_excel_import"));
  assert.equal(payload.transactions[0].date, "2023-05-26");
  assert.equal(payload.transactions.at(-1).date, "2026-07-09");
});

test("zero income days are skipped but recorded in diagnostics", () => {
  assert.equal(payload.summary.dailyRows, 1141);
  assert.equal(payload.summary.zeroIncomeDaysSkipped, 107);
  assert.equal(payload.sourceDiagnostics.zeroIncomeDays.length, 107);
  assert.equal(
    payload.summary.incomeTransactions + payload.summary.zeroIncomeDaysSkipped,
    payload.summary.dailyRows,
  );
});

test("recurring expenses import as inactive drafts", () => {
  assert.equal(payload.recurringRules.length, 27);
  assert.ok(payload.recurringRules.every((rule) => rule.active === false));
  assert.ok(payload.recurringRules.every((rule) => rule.amount > 0));
  assert.ok(payload.recurringRules.every((rule) => rule.note.includes("Excel taslağı")));
});

test("debt package preserves the workbook ending balance", () => {
  const summary = historicalImportSummary(payload);
  assert.equal(
    Math.round((summary.debtOriginalAmount - summary.debtPaymentsTotal) * 100) / 100,
    355_000,
  );
  assert.equal(payload.ledgerPackage.record.counterparty, "Yasin Abim");
  assert.ok(payload.ledgerPackage.payments.every((row) => row.amount > 0));
});

test("transaction batches remain below the D1 batch target", () => {
  const chunks = chunkHistoricalTransactions(payload.transactions);
  assert.equal(chunks.length, 14);
  assert.ok(chunks.every((chunk) => chunk.length <= 75));
  assert.equal(chunks.flat().length, payload.transactions.length);
});

test("tampered package is rejected", () => {
  const copy = structuredClone(payload);
  copy.transactions[0].postingMode = "economic_and_cash";
  assert.throws(
    () => validateHistoricalImportPackage(copy),
    /kasa\/banka bakiyesini değiştiremez/,
  );
});
