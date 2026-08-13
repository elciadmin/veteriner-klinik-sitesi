import test from "node:test";
import assert from "node:assert/strict";
import { projectRecurringExpenses, recurringExpenseSummary } from "../lib/recurring.mjs";

const base = {
  id: "r1", name: "Gider", category: "Sabit", counterparty: "", amount: 1000,
  amountMode: "fixed", frequencyMonths: 1, startDate: "2026-08-01", paymentMethod: "transfer",
  documentType: "none", vatRate: 0, active: true, note: "",
};

test("haftalık kural günleri kullanıcı müdahalesi olmadan ilerler", () => {
  const rows = projectRecurringExpenses([{ ...base, recurrenceKind: "weekly", recurrenceInterval: 1, recurrenceDayOfWeek: 1, startDate: "2026-08-12" }], [], "2026-08-12", { monthsAhead: 1, monthsBack: 0 });
  assert.equal(rows[0].dueDate, "2026-08-17");
  assert.equal(rows[1].dueDate, "2026-08-24");
});

test("son iş günü kuralı hafta sonuna denk gelince cuma gününe çekilir", () => {
  const rows = projectRecurringExpenses([{ ...base, startDate: "2026-01-31", recurrenceKind: "monthly", recurrenceInterval: 1, businessDayRule: "last_business_day" }], [], "2026-01-15", { monthsAhead: 2, monthsBack: 0 });
  assert.equal(rows[0].dueDate, "2026-01-30");
  assert.equal(rows[1].dueDate, "2026-02-27");
});

test("ödenmemiş geçmiş plan kaybolmaz, gecikmiş olarak kalır", () => {
  const rows = projectRecurringExpenses([{ ...base, startDate: "2026-07-01" }], [], "2026-08-12", { monthsAhead: 1, monthsBack: 2 });
  const july = rows.find((row) => row.dueDate === "2026-07-01");
  assert.equal(july.overdue, true);
});

test("haftalık gider aylık ortalama plana dönüştürülür", () => {
  const rules = [{ ...base, recurrenceKind: "weekly", recurrenceInterval: 1 }];
  const summary = recurringExpenseSummary(rules, [], "2026-08-12");
  assert.ok(summary.monthlyPlan > 4300 && summary.monthlyPlan < 4400);
});
