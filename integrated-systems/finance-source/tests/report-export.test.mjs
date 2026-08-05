import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCsv,
  buildExportFilename,
  buildReportExport,
  buildXlsx,
} from "../lib/report-export.mjs";

function transaction(overrides = {}) {
  return {
    id: "tx-1",
    date: "2026-07-10",
    time: "10:00",
    kind: "income",
    category: "Muayene",
    description: "Genel muayene",
    counterparty: "Ayşe",
    operationType: "service",
    amount: 1_200,
    paymentMethod: "cash",
    documentType: "receipt",
    documentRef: "FIS-1",
    vatRate: 0.2,
    ...overrides,
  };
}

function exportData(transactions, overrides = {}) {
  return buildReportExport({
    transactions,
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    scope: "all",
    ...overrides,
  });
}

function unzipStored(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    assert.equal(method, 0);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    files.set(
      name,
      decoder.decode(bytes.subarray(contentStart, contentStart + size)),
    );
    offset = contentStart + size;
  }
  return files;
}

test("dışa aktarım tarih aralığını uygular, iptali dışlar ve kronolojik sıralar", () => {
  const result = exportData([
    transaction({ id: "late", date: "2026-07-20", time: "17:00" }),
    transaction({ id: "old", date: "2026-06-30" }),
    transaction({ id: "cancelled", status: "cancelled" }),
    transaction({ id: "early", date: "2026-07-02", time: "09:00" }),
  ]);

  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["early", "late"],
  );
  assert.deepEqual(
    result.rows.map((row) => row.sequence),
    [1, 2],
  );
});

test("gelir ve çıkış kapsamları birbirine karışmaz", () => {
  const rows = [
    transaction({ id: "income" }),
    transaction({ id: "expense", kind: "expense" }),
    transaction({ id: "withdrawal", kind: "withdrawal" }),
  ];

  assert.deepEqual(
    exportData(rows, { scope: "income" }).rows.map((row) => row.id),
    ["income"],
  );
  assert.deepEqual(
    exportData(rows, { scope: "outflows" }).rows.map((row) => row.id),
    ["expense", "withdrawal"],
  );
});

test("KDV dahil tutar net ve KDV olarak doğru ayrılır", () => {
  const result = exportData([
    transaction({ amount: 1_200, vatRate: 0.2 }),
  ]);

  assert.equal(result.rows[0].netAmount, 1_000);
  assert.equal(result.rows[0].vatAmount, 200);
});

test("özet belgeli gideri, belgesiz çıkışı ve kasa çekimini ayırır", () => {
  const result = exportData([
    transaction({ id: "income", amount: 5_000 }),
    transaction({
      id: "documented",
      kind: "expense",
      amount: 1_000,
      documentType: "invoice",
      documentRef: "F-1",
    }),
    transaction({
      id: "undocumented",
      kind: "expense",
      amount: 300,
      documentType: "none",
      documentRef: "",
    }),
    transaction({
      id: "withdrawal",
      kind: "withdrawal",
      amount: 200,
      documentType: "none",
      documentRef: "",
    }),
  ]);

  assert.equal(result.summary.income, 5_000);
  assert.equal(result.summary.documentedExpense, 1_000);
  assert.equal(result.summary.undocumentedOutflow, 300);
  assert.equal(result.summary.withdrawals, 200);
  assert.equal(result.summary.cashMovement, 3_500);
});

test("indirilen gelir listesi tahsilatı gösterir ama satışa tekrar eklemez", () => {
  const result = exportData([
    transaction({ id: "sale", amount: 5_000 }),
    transaction({
      id: "collection",
      amount: 2_000,
      operationType: "receivable_collection",
      postingMode: "cash_only",
      documentType: "bank_statement",
      documentRef: "LDP-1",
      paymentMethod: "transfer",
    }),
  ]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.summary.income, 5_000);
  assert.equal(result.summary.collectionCash, 2_000);
  assert.match(
    result.rows.find((row) => row.id === "collection").accountingStatus,
    /Yalnız para hareketi/,
  );
});

test("otomatik POS komisyonu belgeli gider statüsünde tek satır kalır", () => {
  const result = exportData([
    transaction({
      id: "sale",
      paymentMethod: "card",
      posRate: 0.025,
      posStatus: "pending",
    }),
    transaction({
      id: "sale-pos-fee",
      kind: "expense",
      operationType: "pos_commission",
      amount: 30,
      paymentMethod: "transfer",
      documentType: "pos_statement",
      documentRef: "POS-sale",
      vatRate: 0,
      isAutomatic: true,
      sourceTransactionId: "sale",
    }),
  ]);

  assert.equal(result.rows.length, 2);
  assert.equal(result.summary.documentedExpense, 30);
  assert.match(result.rows[1].accountingStatus, /otomatik POS/);
});

test("CSV Türkçe karakteri, başlığı ve Excel uyumlu ayırıcıyı korur", () => {
  const csv = buildCsv(
    exportData([
      transaction({ counterparty: 'Şule "Hanım"', amount: 1_234.5 }),
    ]),
  );

  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Kimden \/ Kime";"İşlem Türü"/);
  assert.match(csv, /"Şule ""Hanım"""/);
  assert.match(csv, /"1234,50"/);
});

test("CSV metinlerinde formül enjeksiyonu çalıştırılmaz", () => {
  const csv = buildCsv(
    exportData([
      transaction({
        counterparty: "=HYPERLINK(\"https://example.test\")",
        description: "+SUM(1;1)",
      }),
    ]),
  );

  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'\+SUM/);
});

test("Excel çıktısı gerçek XLSX paketi ve ayrılmış sayfalar üretir", () => {
  const bytes = buildXlsx(
    exportData([
      transaction({ counterparty: "Güneş & Pati" }),
      transaction({
        id: "expense",
        kind: "expense",
        amount: 250,
        documentType: "invoice",
        documentRef: "F-2",
      }),
    ]),
  );
  const files = unzipStored(bytes);

  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.ok(files.has("[Content_Types].xml"));
  assert.ok(files.has("xl/workbook.xml"));
  assert.ok(files.has("xl/worksheets/sheet1.xml"));
  assert.ok(files.has("xl/worksheets/sheet4.xml"));
  assert.match(files.get("xl/workbook.xml"), /Tüm Hareketler/);
  assert.match(files.get("xl/workbook.xml"), /Gelirler/);
  assert.match(files.get("xl/workbook.xml"), /Giderler/);
  assert.match(files.get("xl/worksheets/sheet2.xml"), /Güneş &amp; Pati/);
});

test("dosya adı kapsamı ve seçilen dönemi açıkça taşır", () => {
  const data = exportData([], { scope: "income" });
  assert.equal(
    buildExportFilename(data, "xlsx"),
    "elci-klinik-gelirler-2026-07-01-2026-07-31.xlsx",
  );
});

test("geçersiz veya ters tarih aralığı dosya üretmez", () => {
  assert.throws(
    () =>
      buildReportExport({
        transactions: [],
        startDate: "01.07.2026",
        endDate: "2026-07-31",
      }),
    /geçerli bir tarih/,
  );
  assert.throws(
    () =>
      buildReportExport({
        transactions: [],
        startDate: "2026-08-01",
        endDate: "2026-07-31",
      }),
    /sonra olamaz/,
  );
});
