function historical(item) {
  return Boolean(item?.importBatchId) || item?.sourceModule === "historical_excel_import";
}

function inPeriod(date, startDate, endDate) {
  return Boolean(date) && (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function beforePeriod(date, startDate) {
  return Boolean(startDate && date && date < startDate);
}

/** A readable, traditional current-account ledger derived from immutable events. */
export function buildCurrentAccountBook({
  records = [],
  startDate = "",
  endDate = "",
  counterparty = "",
  type = "all",
  includeHistorical = true,
} = {}) {
  const rows = [];
  for (const record of records) {
    if (counterparty && record.counterparty !== counterparty) continue;
    if (type !== "all" && record.type !== type) continue;
    const recordHistorical = historical(record);
    if (!includeHistorical && recordHistorical) continue;
    rows.push({
      id: `record-${record.id}`,
      recordId: record.id,
      date: record.createdDate || record.documentDate || "",
      type: record.type,
      counterparty: record.counterparty || "Belirtilmemiş",
      documentRef: record.documentRef || "",
      detail: record.detail || "Cari kayıt",
      increase: Number(record.originalAmount || 0),
      decrease: 0,
      entry: record.type === "receivable" ? "Alacak doğumu" : "Borç doğumu",
      historical: recordHistorical,
    });
    for (const payment of record.payments ?? []) {
      if (payment.status === "cancelled") continue;
      const paymentHistorical = recordHistorical || historical(payment);
      if (!includeHistorical && paymentHistorical) continue;
      rows.push({
        id: `payment-${payment.id || `${record.id}-${payment.date}-${payment.amount}`}`,
        recordId: record.id,
        date: payment.date || "",
        type: record.type,
        counterparty: record.counterparty || "Belirtilmemiş",
        documentRef: record.documentRef || "",
        detail: payment.note || (record.type === "receivable" ? "Tahsilat" : "Ödeme"),
        increase: 0,
        decrease: Number(payment.amount || 0),
        entry: record.type === "receivable" ? "Tahsilat" : "Ödeme",
        historical: paymentHistorical,
      });
    }
  }
  const allRows = rows.sort((left, right) => (
    left.counterparty.localeCompare(right.counterparty, "tr")
    || left.type.localeCompare(right.type)
    || left.date.localeCompare(right.date)
    || left.id.localeCompare(right.id)
  ));
  const openingByAccount = new Map();
  for (const row of allRows.filter((row) => beforePeriod(row.date, startDate))) {
    const key = `${row.type}:${row.counterparty}`;
    openingByAccount.set(key, (openingByAccount.get(key) || 0) + row.increase - row.decrease);
  }
  const balanceByAccount = new Map(openingByAccount);
  const periodRows = allRows.filter((row) => inPeriod(row.date, startDate, endDate)).map((row) => {
    const key = `${row.type}:${row.counterparty}`;
    const previousBalance = balanceByAccount.get(key) || 0;
    const balance = previousBalance + row.increase - row.decrease;
    balanceByAccount.set(key, balance);
    return { ...row, openingBalance: previousBalance, balance };
  });
  const openingBalance = [...openingByAccount.values()].reduce((sum, value) => sum + value, 0);
  return {
    period: { startDate, endDate, counterparty, type, includeHistorical },
    openingBalance,
    increaseTotal: periodRows.reduce((sum, row) => sum + row.increase, 0),
    decreaseTotal: periodRows.reduce((sum, row) => sum + row.decrease, 0),
    closingBalance: [...balanceByAccount.values()].reduce((sum, value) => sum + value, 0),
    rows: periodRows,
  };
}

/** Spreadsheet-ready, human-readable current-account statement. */
export function currentAccountBookCsv(book) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [
    ["Cari hesap dökümü"],
    ["Başlangıç", book.period?.startDate || "Tüm geçmiş"],
    ["Bitiş", book.period?.endDate || "Bugün"],
    ["Cari", book.period?.counterparty || "Tümü"],
    ["Dönem başı devir", book.openingBalance],
    ["Dönem borç/alacak", book.increaseTotal],
    ["Dönem tahsilat/ödeme", book.decreaseTotal],
    ["Dönem sonu bakiye", book.closingBalance],
    [],
    ["Tarih", "Cari", "Tür", "İşlem", "Belge", "Açıklama", "Borç/Alacak", "Tahsilat/Ödeme", "Kalan bakiye", "Kaynak"],
    ...(book.rows ?? []).map((row) => [
      row.date,
      row.counterparty,
      row.type === "receivable" ? "Alacak" : "Borç",
      row.entry,
      row.documentRef,
      row.detail,
      row.increase || "",
      row.decrease || "",
      row.balance,
      row.historical ? "Geçmiş aktarım" : "Canlı kayıt",
    ]),
  ];
  return `\uFEFF${lines.map((line) => line.map(escape).join(";")).join("\n")}\n`;
}
