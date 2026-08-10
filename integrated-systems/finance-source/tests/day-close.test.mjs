import test from "node:test";
import assert from "node:assert/strict";

import { assessDayClose, assertDayCloseReady } from "../lib/day-close.mjs";

const date = "2026-08-09";
const transactions = [
  { date, kind: "income", amount: 1000, paymentMethod: "cash", documentType: "receipt" },
  { date, kind: "expense", amount: 100, paymentMethod: "cash", documentType: "none" },
  { date, kind: "income", amount: 500, paymentMethod: "card", posStatus: "pending" },
];

test("gün sonu sahte kasa değeri üretmez; sayım olmadan kapanmaz", () => {
  const assessment = assessDayClose({ date, transactions, openingCash: null, physicalCash: null });
  assert.equal(assessment.expectedCash, null);
  assert.equal(assessment.readyToClose, false);
  assert.throws(() => assertDayCloseReady(assessment), /Açılış kasası/);
});

test("gün sonu yalnız nakit köprüsünü hesaplar, POS ve belge işini görünür uyarı yapar", () => {
  const assessment = assessDayClose({ date, transactions, openingCash: 500, physicalCash: 1400 });
  assert.equal(assessment.expectedCash, 1400);
  assert.equal(assessment.cashDifference, 0);
  assert.equal(assessment.pendingPosCount, 1);
  assert.equal(assessment.missingDocumentCount, 1);
  assert.equal(assertDayCloseReady(assessment), true);
});

test("kasa farkı gerekçesiz kapanmaz", () => {
  const assessment = assessDayClose({ date, transactions, openingCash: 500, physicalCash: 1350 });
  assert.equal(assessment.readyToClose, false);
  const explained = assessDayClose({ date, transactions, openingCash: 500, physicalCash: 1350, varianceReason: "Sayım farkı kontrol altında" });
  assert.equal(explained.readyToClose, true);
});
