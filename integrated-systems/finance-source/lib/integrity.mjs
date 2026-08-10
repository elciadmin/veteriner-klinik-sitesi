/**
 * Read-only integrity checks used by the clinic workspace.
 * They never repair or delete data automatically: a financial mismatch must
 * remain visible until a person resolves it through an audited correction.
 */
export function assessFinanceIntegrity({ transactions = [], inventory = [], records = [] } = {}) {
  const findings = [];
  const byId = new Set();
  for (const transaction of transactions) {
    if (byId.has(transaction.id)) {
      findings.push({ code: "duplicate_transaction", severity: "critical", message: `Yinelenen işlem kimliği: ${transaction.id}` });
    }
    byId.add(transaction.id);
    if (!Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) <= 0) {
      findings.push({ code: "invalid_amount", severity: "critical", message: `Geçersiz işlem tutarı: ${transaction.description || transaction.id}` });
    }
    if (transaction.reversalOfId && !transactions.some((candidate) => candidate.id === transaction.reversalOfId)) {
      findings.push({ code: "orphan_reversal", severity: "warning", message: `Asıl kaydı bulunamayan ters kayıt: ${transaction.id}` });
    }
  }

  for (const item of inventory) {
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 0) {
      findings.push({ code: "negative_stock", severity: "critical", message: `Negatif veya geçersiz stok: ${item.name}` });
    }
  }

  for (const record of records) {
    const paid = (record.payments ?? [])
      .filter((payment) => payment.status !== "cancelled")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (!Number.isFinite(Number(record.originalAmount)) || Number(record.originalAmount) < 0) {
      findings.push({ code: "invalid_ledger_amount", severity: "critical", message: `Geçersiz cari tutar: ${record.counterparty || record.id}` });
    } else if (paid > Number(record.originalAmount) + 0.005) {
      findings.push({ code: "overpaid_ledger", severity: "critical", message: `Fazla ödeme riski: ${record.counterparty || record.id}` });
    }
  }

  const critical = findings.filter((finding) => finding.severity === "critical").length;
  const warning = findings.length - critical;
  return {
    ok: findings.length === 0,
    critical,
    warning,
    findings,
    checkedAt: new Date().toISOString(),
  };
}
