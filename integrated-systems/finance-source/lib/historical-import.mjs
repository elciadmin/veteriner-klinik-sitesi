export const HISTORICAL_IMPORT_SOURCE = "historical_excel_import";
export const HISTORICAL_IMPORT_SCHEMA_VERSION = 1;
export const HISTORICAL_IMPORT_MAX_TRANSACTIONS = 5000;
export const HISTORICAL_IMPORT_BATCH_SIZE = 75;

function finiteMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : NaN;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function historicalImportSummary(payload) {
  const transactions = Array.isArray(payload?.transactions)
    ? payload.transactions
    : [];
  const recurringRules = Array.isArray(payload?.recurringRules)
    ? payload.recurringRules
    : [];
  const payments = Array.isArray(payload?.ledgerPackage?.payments)
    ? payload.ledgerPackage.payments
    : [];
  const originalAmount = finiteMoney(
    payload?.ledgerPackage?.record?.originalAmount ?? 0,
  );
  const incomeTotal = transactions.reduce(
    (sum, row) => sum + finiteMoney(row?.amount || 0),
    0,
  );
  const paymentTotal = payments.reduce(
    (sum, row) => sum + finiteMoney(row?.amount || 0),
    0,
  );
  return {
    transactionCount: transactions.length,
    incomeTotal: Math.round(incomeTotal * 100) / 100,
    recurringRuleCount: recurringRules.length,
    debtPaymentCount: payments.length,
    debtOriginalAmount: originalAmount,
    debtPaymentsTotal: Math.round(paymentTotal * 100) / 100,
    debtRemaining:
      Math.round((originalAmount - paymentTotal) * 100) / 100,
  };
}

export function validateHistoricalImportPackage(payload) {
  assert(payload && typeof payload === "object", "Aktarım paketi okunamadı.");
  assert(
    payload.schemaVersion === HISTORICAL_IMPORT_SCHEMA_VERSION,
    "Aktarım paketi sürümü desteklenmiyor.",
  );
  assert(
    /^[A-Za-z0-9._-]{6,100}$/.test(String(payload.importId || "")),
    "Aktarım kimliği geçersiz.",
  );
  assert(Array.isArray(payload.transactions), "Gelir kayıtları bulunamadı.");
  assert(
    payload.transactions.length <= HISTORICAL_IMPORT_MAX_TRANSACTIONS,
    "Aktarım paketi güvenli kayıt sınırını aşıyor.",
  );

  const ids = new Set();
  const sourceIds = new Set();
  for (const row of payload.transactions) {
    assert(row && typeof row === "object", "Geçersiz gelir satırı.");
    assert(
      /^hist-elci-income-\d{4}-\d{2}-\d{2}$/.test(String(row.id || "")),
      "Geçmiş gelir kimliği geçersiz.",
    );
    assert(!ids.has(row.id), `Mükerrer işlem kimliği: ${row.id}`);
    ids.add(row.id);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || "")), "Geçersiz işlem tarihi.");
    assert(row.kind === "income", "Geçmiş günlük ciro yalnız gelir olabilir.");
    assert(finiteMoney(row.amount) > 0, "Geçmiş gelir tutarı sıfırdan büyük olmalıdır.");
    assert(row.paymentMethod === "accrual", "Geçmiş gelir ödeme kanalı sınıflandırılmamış olmalıdır.");
    assert(row.postingMode === "economic_only", "Geçmiş gelir kasa/banka bakiyesini değiştiremez.");
    assert(row.sourceModule === HISTORICAL_IMPORT_SOURCE, "Geçmiş gelir kaynak modülü geçersiz.");
    assert(String(row.sourceRecordId || "").startsWith(`${payload.importId}:gelir:`), "Geçmiş gelir kaynak kaydı geçersiz.");
    assert(!sourceIds.has(row.sourceRecordId), `Mükerrer kaynak kaydı: ${row.sourceRecordId}`);
    sourceIds.add(row.sourceRecordId);
  }

  assert(Array.isArray(payload.recurringRules), "Sabit gider taslakları bulunamadı.");
  for (const rule of payload.recurringRules) {
    assert(rule && typeof rule === "object", "Geçersiz sabit gider taslağı.");
    assert(String(rule.id || "").startsWith("hist-elci-rule-"), "Sabit gider taslak kimliği geçersiz.");
    assert(finiteMoney(rule.amount) > 0, "Sabit gider tutarı sıfırdan büyük olmalıdır.");
    assert(rule.active === false, "Geçmiş sabit giderler güvenlik gereği pasif taslak olmalıdır.");
  }

  const record = payload.ledgerPackage?.record;
  const payments = payload.ledgerPackage?.payments;
  assert(record && typeof record === "object", "Borç kaydı bulunamadı.");
  assert(record.type === "payable", "Geçmiş borç kaydı ödenecek borç olmalıdır.");
  assert(finiteMoney(record.originalAmount) > 0, "Geçmiş borç tutarı geçersiz.");
  assert(Array.isArray(payments), "Geçmiş borç ödemeleri bulunamadı.");
  for (const payment of payments) {
    assert(payment.recordId === record.id, "Borç ödemesi yanlış kayda bağlı.");
    assert(finiteMoney(payment.amount) > 0, "Borç ödeme tutarı geçersiz.");
    assert(/^\d{4}-\d{2}-\d{2}$/.test(String(payment.date || "")), "Borç ödeme tarihi geçersiz.");
  }

  const summary = historicalImportSummary(payload);
  assert(summary.debtRemaining >= 0, "Borç ödemeleri ana borcu aşıyor.");
  if (payload.summary) {
    assert(
      Number(payload.summary.incomeTransactions) === summary.transactionCount,
      "Gelir kayıt adedi özetle eşleşmiyor.",
    );
    assert(
      Math.abs(Number(payload.summary.incomeTotal) - summary.incomeTotal) < 0.01,
      "Gelir toplamı özetle eşleşmiyor.",
    );
    assert(
      Math.abs(Number(payload.summary.debtRemaining) - summary.debtRemaining) < 0.01,
      "Borç bakiyesi özetle eşleşmiyor.",
    );
  }
  return summary;
}

export function chunkHistoricalTransactions(transactions, size = HISTORICAL_IMPORT_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < transactions.length; index += size) {
    chunks.push(transactions.slice(index, index + size));
  }
  return chunks;
}
