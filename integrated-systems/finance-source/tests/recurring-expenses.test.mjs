import assert from "node:assert/strict";
import test from "node:test";

import {
  addMonthsAnchored,
  projectRecurringExpenses,
  recurringCalendarEvents,
  recurringExpenseSummary,
  recurringOccurrenceId,
} from "../lib/recurring.mjs";
import { dailyOperationsSummary } from "../lib/operations.mjs";

function rule(overrides = {}) {
  return {
    id: "rent",
    name: "Kira",
    category: "Kira",
    counterparty: "Mülk sahibi",
    amount: 20_000,
    amountMode: "fixed",
    frequencyMonths: 1,
    startDate: "2026-01-31",
    nextReviewDate: "2027-01-31",
    paymentMethod: "transfer",
    documentType: "none",
    vatRate: 0,
    active: true,
    note: "",
    ...overrides,
  };
}

test("ayın 31'indeki sabit gider kısa aylarda son güne sabitlenir", () => {
  assert.equal(addMonthsAnchored("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsAnchored("2026-01-31", 2), "2026-03-31");
});

test("aylık plan her ay yalnız bir kez oluşur", () => {
  const rows = projectRecurringExpenses(
    [rule()],
    [],
    "2026-01-25",
    { monthsAhead: 3, monthsBack: 0 },
  );
  assert.deepEqual(
    rows.map((row) => row.dueDate),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"],
  );
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
});

test("üç aylık ödeme aylık kayda dönüşmez", () => {
  const rows = projectRecurringExpenses(
    [rule({ frequencyMonths: 3 })],
    [],
    "2026-01-25",
    { monthsAhead: 9, monthsBack: 0 },
  );
  assert.deepEqual(
    rows.map((row) => row.dueDate),
    ["2026-01-31", "2026-04-30", "2026-07-31", "2026-10-31"],
  );
});

test("ödenmiş dönem aynı kimlikle planın üzerine yazılır", () => {
  const id = recurringOccurrenceId("rent", "2026-01-31");
  const rows = projectRecurringExpenses(
    [rule()],
    [
      {
        id,
        ruleId: "rent",
        dueDate: "2026-01-31",
        expectedAmount: 20_000,
        actualAmount: 20_500,
        status: "paid",
        paidDate: "2026-01-30",
      },
    ],
    "2026-01-25",
    { monthsAhead: 1, monthsBack: 0 },
  );
  assert.equal(rows[0].status, "paid");
  assert.equal(rows[0].actualAmount, 20_500);
});

test("değişken fatura gerçek tutar kontrolü ister", () => {
  const rows = projectRecurringExpenses(
    [rule({ amountMode: "estimated", name: "İnternet" })],
    [],
    "2026-01-25",
    { monthsAhead: 0, monthsBack: 0 },
  );
  assert.equal(rows[0].needsAmount, true);
});

test("artış tarihi gelince sistem oran uydurmak yerine kontrol ister", () => {
  const rows = projectRecurringExpenses(
    [rule({ nextReviewDate: "2026-03-01" })],
    [],
    "2026-02-01",
    { monthsAhead: 2, monthsBack: 0 },
  );
  assert.equal(rows.find((row) => row.dueDate === "2026-02-28").needsReview, false);
  assert.equal(rows.find((row) => row.dueDate === "2026-03-31").needsReview, true);
});

test("ödenen sabit gider takvimde ödeme, planlanan ise plan olarak ayrılır", () => {
  const paidId = recurringOccurrenceId("rent", "2026-01-31");
  const saved = [
    {
      id: paidId,
      ruleId: "rent",
      dueDate: "2026-01-31",
      expectedAmount: 20_000,
      actualAmount: 20_000,
      status: "paid",
      paidDate: "2026-01-30",
    },
  ];
  const events = recurringCalendarEvents([rule()], saved, "2026-01-25");
  assert.equal(events.find((event) => event.id === paidId).type, "recurring_payment");
  assert.ok(events.some((event) => event.type === "recurring_expense"));

  const schedule = projectRecurringExpenses(
    [rule(), rule({ id: "annual", amount: 12_000, frequencyMonths: 12 })],
    saved,
    "2026-01-25",
    { monthsAhead: 1, monthsBack: 0 },
  );
  const summary = recurringExpenseSummary(
    [rule(), rule({ id: "annual", amount: 12_000, frequencyMonths: 12 })],
    schedule,
    "2026-01-25",
  );
  assert.equal(summary.monthlyPlan, 21_000);
  assert.equal(summary.thisMonthPaid, 20_000);
});

test("belgesi bekleyen dönemsel ödeme POS gideri veya belgeli gider sayılmaz", () => {
  const summary = dailyOperationsSummary({
    date: "2026-07-25",
    transactions: [
      {
        id: "tx-recurring",
        date: "2026-07-25",
        time: "10:00",
        kind: "expense",
        category: "Kira",
        description: "Kira · 2026-07 dönemi",
        operationType: "overhead",
        costBehavior: "fixed",
        amount: 20_000,
        paymentMethod: "transfer",
        documentType: "none",
        documentRef: "",
        vatRate: 0,
        isAutomatic: true,
        sourceTransactionId: "recurring-rule-rent",
      },
    ],
  });
  assert.equal(summary.expense, 0);
  assert.equal(summary.undocumentedOutflow, 20_000);
  assert.equal(summary.automaticPosExpense, 0);
});

test("durdurulan kural yeni plan üretmez ama geçmiş ödemeyi saklar", () => {
  const id = recurringOccurrenceId("rent", "2026-01-31");
  const rows = projectRecurringExpenses(
    [rule({ active: false })],
    [
      {
        id,
        ruleId: "rent",
        dueDate: "2026-01-31",
        expectedAmount: 20_000,
        actualAmount: 20_000,
        status: "paid",
        paidDate: "2026-01-30",
      },
    ],
    "2026-01-25",
    { monthsAhead: 3, monthsBack: 0 },
  );
  assert.deepEqual(rows.map((row) => row.id), [id]);
});
