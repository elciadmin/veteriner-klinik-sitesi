/**
 * Report calculation is deliberately data-first: every chart/table is a view
 * of the same filtered records and may be exported without changing totals.
 */
function amount(item) {
  return Number(item.amount ?? item.amountCents / 100 ?? 0) || 0;
}

function inRange(date, startDate, endDate) {
  return Boolean(date) && (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function active(item) {
  return item?.status !== "cancelled";
}

function isHistorical(item) {
  return Boolean(item?.importBatchId)
    || item?.sourceModule === "historical_excel_import"
    || item?.sourceModule === "historical_import";
}

function rangeOverlaps(item, startDate, endDate) {
  const start = item.coverageStartDate || "";
  const end = item.coverageEndDate || "";
  return (!endDate || !start || start <= endDate) && (!startDate || !end || end >= startDate);
}

function historicalProvenance({ rows, importBatches, includeHistorical, startDate, endDate }) {
  const historicalRows = rows.filter(isHistorical);
  const selectedBatchIds = new Set(historicalRows.map((item) => item.importBatchId).filter(Boolean));
  const batches = importBatches
    .filter((batch) => batch.status === "applied" || batch.status === "validated")
    .filter((batch) => selectedBatchIds.has(batch.id) || rangeOverlaps(batch, startDate, endDate));
  const weightedDenominator = batches.reduce((sum, batch) => sum + Math.max(1, Number(batch.recordCount || 0)), 0);
  const completenessBps = batches.length === 0
    ? 10000
    : Math.round(batches.reduce((sum, batch) => (
      sum + (Number(batch.completenessBps) || 0) * Math.max(1, Number(batch.recordCount || 0))
    ), 0) / weightedDenominator);
  const warnings = [...new Set(batches.flatMap((batch) => batch.warnings || []))];

  return {
    included: includeHistorical,
    recordCount: historicalRows.length,
    batchCount: batches.length,
    coverageStartDate: batches.map((batch) => batch.coverageStartDate).filter(Boolean).sort()[0] || "",
    coverageEndDate: batches.map((batch) => batch.coverageEndDate).filter(Boolean).sort().at(-1) || "",
    completenessBps,
    completenessPercent: Math.round(completenessBps / 100),
    warnings,
    partial: includeHistorical && (completenessBps < 10000 || warnings.length > 0),
    decisionSafe: !includeHistorical || (completenessBps === 10000 && warnings.length === 0),
  };
}

function groupBy(rows, key, value) {
  const totals = new Map();
  for (const row of rows) {
    const group = String(key(row) || "Belirtilmemiş");
    totals.set(group, (totals.get(group) ?? 0) + value(row));
  }
  return [...totals.entries()]
    .map(([label, total]) => ({ label, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "tr"));
}

export function buildManagementReport({
  transactions = [],
  inventory = [],
  stockMovements = [],
  importBatches = [],
  startDate = "",
  endDate = "",
  includeHistorical = true,
} = {}) {
  const selectedTransactions = includeHistorical ? transactions : transactions.filter((item) => !isHistorical(item));
  const periodTransactions = selectedTransactions.filter((item) => active(item) && inRange(item.date, startDate, endDate));
  const operationalIncome = periodTransactions.filter((item) => item.kind === "income" && item.postingMode !== "cash_only");
  const operatingExpenses = periodTransactions.filter((item) =>
    item.kind === "expense"
    && item.operationType !== "inventory_purchase"
    && item.postingMode !== "cash_only",
  );
  const cashOutflows = periodTransactions.filter((item) => item.kind === "expense" && item.paymentMethod !== "accrual");
  const missingDocuments = periodTransactions.filter((item) =>
    item.kind === "expense" && (item.documentType === "none" || !item.documentRef),
  );
  const selectedMovements = includeHistorical ? stockMovements : stockMovements.filter((item) => !isHistorical(item));
  const movementRows = selectedMovements.filter((item) => inRange(item.date, startDate, endDate));
  const consumed = movementRows.filter((item) => ["usage", "sale", "waste"].includes(item.type));
  const stockValue = inventory.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);

  const income = operationalIncome.reduce((sum, item) => sum + amount(item), 0);
  const expenses = operatingExpenses.reduce((sum, item) => sum + amount(item), 0);
  const cashOut = cashOutflows.reduce((sum, item) => sum + amount(item), 0);
  const netOperatingResult = income - expenses;

  return {
    period: { startDate, endDate },
    provenance: historicalProvenance({
      rows: transactions.filter((item) => active(item) && inRange(item.date, startDate, endDate)),
      importBatches,
      includeHistorical,
      startDate,
      endDate,
    }),
    summary: {
      income: Math.round(income * 100) / 100,
      operatingExpense: Math.round(expenses * 100) / 100,
      netOperatingResult: Math.round(netOperatingResult * 100) / 100,
      cashOutflow: Math.round(cashOut * 100) / 100,
      stockValue: Math.round(stockValue * 100) / 100,
      missingDocumentCount: missingDocuments.length,
      missingDocumentAmount: Math.round(missingDocuments.reduce((sum, item) => sum + amount(item), 0) * 100) / 100,
    },
    incomeByCategory: groupBy(operationalIncome, (item) => item.category, amount),
    expenseByCategory: groupBy(operatingExpenses, (item) => item.category, amount),
    supplierSpend: groupBy(
      periodTransactions.filter((item) => item.kind === "expense"),
      (item) => item.counterparty,
      amount,
    ),
    paymentMix: groupBy(periodTransactions, (item) => item.paymentMethod, amount),
    stockUsage: groupBy(consumed, (item) => item.itemName, (item) => Number(item.quantity) || 0),
    stockValueByCategory: groupBy(inventory, (item) => item.category, (item) => (Number(item.quantity) || 0) * (Number(item.unitCost) || 0)),
    documentsToComplete: missingDocuments.map((item) => ({
      id: item.id,
      date: item.date,
      counterparty: item.counterparty || "Belirtilmemiş",
      description: item.description,
      amount: amount(item),
    })),
  };
}

export function compareManagementReports(current, previous) {
  const rows = [
    ["Gelir", "income"],
    ["Faaliyet gideri", "operatingExpense"],
    ["Faaliyet sonucu", "netOperatingResult"],
    ["Nakit çıkışı", "cashOutflow"],
    ["Stok değeri", "stockValue"],
  ];
  return rows.map(([label, key]) => {
    const currentValue = Number(current.summary[key] || 0);
    const previousValue = Number(previous.summary[key] || 0);
    return {
      label,
      current: currentValue,
      previous: previousValue,
      change: Math.round((currentValue - previousValue) * 100) / 100,
      changeRate: previousValue === 0 ? null : Math.round(((currentValue - previousValue) / Math.abs(previousValue)) * 10_000) / 100,
    };
  });
}

export function reportRowsForExport(report) {
  return [
    ["Rapor dönemi", `${report.period.startDate || "başlangıç"} – ${report.period.endDate || "bugün"}`],
    ["Geçmiş aktarım", report.provenance?.included ? "Dahil" : "Hariç"],
    ["Geçmiş veri tamlığı", report.provenance ? `%${report.provenance.completenessPercent}` : "Belirtilmemiş"],
    ["Geçmiş veri uyarıları", report.provenance?.warnings?.join(" | ") || "Yok"],
    ["Gelir", report.summary.income],
    ["Faaliyet gideri", report.summary.operatingExpense],
    ["Faaliyet sonucu", report.summary.netOperatingResult],
    ["Nakit çıkışı", report.summary.cashOutflow],
    ["Stok değeri", report.summary.stockValue],
    ["Belgesi eksik gider", report.summary.missingDocumentAmount],
  ];
}
