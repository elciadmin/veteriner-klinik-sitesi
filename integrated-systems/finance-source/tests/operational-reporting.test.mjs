import test from "node:test";
import assert from "node:assert/strict";

import { buildManagementReport, compareManagementReports } from "../lib/operational-reporting.mjs";

const transactions = [
  { id: "sale", date: "2026-08-01", kind: "income", category: "Muayene", amount: 1200, paymentMethod: "card", postingMode: "economic_and_cash" },
  { id: "collection", date: "2026-08-02", kind: "income", category: "Tahsilat", amount: 500, paymentMethod: "transfer", postingMode: "cash_only" },
  { id: "rent", date: "2026-08-03", kind: "expense", category: "Kira", amount: 400, paymentMethod: "transfer", documentType: "invoice", documentRef: "A-1", postingMode: "economic_and_cash", counterparty: "Ev sahibi" },
  { id: "cleaning", date: "2026-08-04", kind: "expense", category: "Temizlik", amount: 100, paymentMethod: "cash", documentType: "none", documentRef: "", postingMode: "economic_and_cash", counterparty: "Market" },
  { id: "stock", date: "2026-08-04", kind: "expense", category: "Sarf", amount: 600, paymentMethod: "transfer", operationType: "inventory_purchase", documentType: "invoice", documentRef: "B-1", postingMode: "cash_only", counterparty: "Tedarikçi" },
  { id: "cancelled", date: "2026-08-05", kind: "income", category: "Muayene", amount: 999, status: "cancelled", postingMode: "economic_and_cash" },
];

test("yönetim raporu tahsilatı satışa, stok alımını doğrudan gidere ikinci kez katmaz", () => {
  const report = buildManagementReport({
    transactions,
    inventory: [{ category: "Sarf", quantity: 32, unitCost: 3.75 }],
    stockMovements: [{ date: "2026-08-04", type: "usage", itemName: "Tuvalet kâğıdı", quantity: 2 }],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });
  assert.equal(report.summary.income, 1200);
  assert.equal(report.summary.operatingExpense, 500);
  assert.equal(report.summary.netOperatingResult, 700);
  assert.equal(report.summary.stockValue, 120);
  assert.equal(report.summary.missingDocumentCount, 1);
  assert.equal(report.stockUsage[0].total, 2);
});

test("dönem karşılaştırması yüzdeyi yalnız anlamlı önceki değer varsa verir", () => {
  const current = buildManagementReport({ transactions });
  const previous = buildManagementReport({ transactions: [] });
  const rows = compareManagementReports(current, previous);
  assert.equal(rows.find((row) => row.label === "Gelir")?.change, 1200);
  assert.equal(rows.find((row) => row.label === "Gelir")?.changeRate, null);
});

test("geçmiş kayıtlar rapora dahil edilir ama eksikliği karar riskinden saklanmaz", () => {
  const report = buildManagementReport({
    transactions: [
      ...transactions,
      { id: "old-sale", date: "2024-01-05", kind: "income", category: "Geçmiş hizmet", amount: 800, postingMode: "economic_only", sourceModule: "historical_excel_import", importBatchId: "import-2024" },
    ],
    importBatches: [{
      id: "import-2024",
      status: "applied",
      coverageStartDate: "2024-01-01",
      coverageEndDate: "2024-12-31",
      completenessBps: 6500,
      recordCount: 12,
      warnings: ["Eski gider fişleri tam değildir"],
    }],
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  });

  assert.equal(report.summary.income, 800);
  assert.equal(report.provenance.included, true);
  assert.equal(report.provenance.completenessPercent, 65);
  assert.equal(report.provenance.partial, true);
  assert.equal(report.provenance.decisionSafe, false);
});

test("geçmiş kayıtlar istenirse yalnız canlı-denetlenmiş rapordan çıkarılır", () => {
  const report = buildManagementReport({
    transactions: [
      { id: "live", date: "2026-01-03", kind: "income", category: "Muayene", amount: 300, postingMode: "economic_and_cash" },
      { id: "old", date: "2026-01-04", kind: "income", category: "Geçmiş", amount: 900, postingMode: "economic_only", importBatchId: "legacy" },
    ],
    includeHistorical: false,
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  });

  assert.equal(report.summary.income, 300);
  assert.equal(report.provenance.included, false);
  assert.equal(report.provenance.decisionSafe, true);
});
