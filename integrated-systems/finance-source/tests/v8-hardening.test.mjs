import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/clinic-data/route.ts", import.meta.url), "utf8");
const eventRoute = readFileSync(new URL("../app/api/finance-events/route.ts", import.meta.url), "utf8");

test("V8 günlük yazıları idempotency ve jurnal köprüsü ile korur", () => {
  assert.match(route, /idempotency-key/);
  assert.match(route, /idempotencyCommands/);
  assert.match(route, /legacyJournalEvent/);
  assert.match(route, /financialJournalLines/);
});

test("V8 ters kayıt özgün jurnal satırlarının tam karşılığını ister", () => {
  assert.match(eventRoute, /reversalOfId/);
  assert.match(eventRoute, /reversalJournal\(originalLines\)/);
  assert.match(eventRoute, /Ters jurnal, özgün olayın tam karşılığı olmalıdır/);
});

test("V8 geçmiş aktarım geri almasında kaynak satırları fiziksel olarak silmez", () => {
  const rollbackStart = route.indexOf('} else if (payload.action === "rollbackHistoricalImport")');
  const rollbackEnd = route.indexOf('} else if (payload.action === "saveTransactions")', rollbackStart);
  const rollback = route.slice(rollbackStart, rollbackEnd);
  assert.doesNotMatch(rollback, /db\.delete\(/);
  assert.match(rollback, /status: "cancelled"/);
  assert.match(rollback, /stage: "archived"/);
});
