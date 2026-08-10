import test from "node:test";
import assert from "node:assert/strict";

import { buildCurrentAccountBook, currentAccountBookCsv } from "../lib/current-account-book.mjs";

const records = [{
  id: "supplier-1", type: "payable", counterparty: "Veteriner Tedarik", createdDate: "2026-01-10", documentRef: "F-10", detail: "Sarf alımı", originalAmount: 1000,
  payments: [{ id: "p-1", date: "2026-01-20", amount: 400, note: "Kısmi ödeme" }],
}, {
  id: "old-client", type: "receivable", counterparty: "Eski müşteri", createdDate: "2025-12-25", detail: "Geçmiş alacak", originalAmount: 500, importBatchId: "import-1",
  payments: [],
}];

test("cari defter dönem başı devrini, borç doğumunu ve kısmi ödemeyi ayrı satırda gösterir", () => {
  const book = buildCurrentAccountBook({ records, startDate: "2026-01-01", endDate: "2026-01-31", type: "payable" });
  assert.equal(book.openingBalance, 0);
  assert.equal(book.increaseTotal, 1000);
  assert.equal(book.decreaseTotal, 400);
  assert.equal(book.closingBalance, 600);
  assert.deepEqual(book.rows.map((row) => [row.entry, row.balance]), [["Borç doğumu", 1000], ["Ödeme", 600]]);
});

test("geçmiş cari hareketler dahil edilir; istenirse güncel defterden ayrılır", () => {
  const all = buildCurrentAccountBook({ records, startDate: "2026-01-01", endDate: "2026-01-31" });
  const live = buildCurrentAccountBook({ records, startDate: "2026-01-01", endDate: "2026-01-31", includeHistorical: false });
  assert.equal(all.openingBalance, 500);
  assert.equal(live.openingBalance, 0);
});

test("hesap dökümü aynı cari için gün gün hareket ve satır bakiyesi olarak dışa aktarılır", () => {
  const book = buildCurrentAccountBook({ records, startDate: "2026-01-01", endDate: "2026-01-31", counterparty: "Veteriner Tedarik" });
  const csv = currentAccountBookCsv(book);
  assert.match(csv, /Veteriner Tedarik/);
  assert.match(csv, /"Borç doğumu"/);
  assert.match(csv, /"Ödeme"/);
  assert.match(csv, /"600"/);
});
