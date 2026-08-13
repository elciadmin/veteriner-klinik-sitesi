import test from "node:test";
import assert from "node:assert/strict";

import {
  agingSummary,
  evaluateGoal,
  forecastFinance,
  healthyGrowthScore,
  monthlyFinanceSeries,
  goalActualValue,
} from "../lib/growth-planner.mjs";

function tx(date, kind, amount) {
  return { id: `${date}-${kind}-${amount}`, date, kind, amount, status: "posted", postingMode: "economic_and_cash" };
}

test("aylık seri tahsilatı ikinci kez ciro saymaz", () => {
  const rows = [
    tx("2026-06-03", "income", 1000),
    { ...tx("2026-06-05", "income", 500), postingMode: "cash_only", operationType: "receivable_collection" },
    tx("2026-06-07", "expense", 300),
  ];
  const series = monthlyFinanceSeries(rows, "2026-06-30", { months: 1 });
  assert.equal(series[0].income, 1000);
  assert.equal(series[0].expense, 300);
  assert.equal(series[0].net, 700);
});

test("hedef ilerlemesi gerçekleşen ile zaman temposunu ayrı hesaplar", () => {
  const result = evaluateGoal({
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    targetValue: 1_000_000,
    baselineValue: 0,
    direction: "up",
  }, 720_000, "2026-08-12");
  assert.equal(result.progressPercent, 72);
  assert.ok(result.timeProgressPercent > 60 && result.timeProgressPercent < 63);
  assert.equal(result.status, "on_track");
});

test("projeksiyon üç senaryoyu ve aynı ay sayısını üretir", () => {
  const rows = [];
  for (let month = 1; month <= 8; month += 1) {
    const m = String(month).padStart(2, "0");
    rows.push(tx(`2026-${m}-05`, "income", 100000 * (1 + month * 0.03)));
    rows.push(tx(`2026-${m}-07`, "expense", 60000 * (1 + month * 0.02)));
  }
  const result = forecastFinance(rows, "2026-08-12", { historyMonths: 8, monthsAhead: 6 });
  assert.equal(result.scenarios.base.length, 6);
  assert.equal(result.scenarios.optimistic.length, 6);
  assert.equal(result.scenarios.pessimistic.length, 6);
  assert.ok(result.scenarios.optimistic.at(-1).income >= result.scenarios.base.at(-1).income);
});

test("alacak yaşlandırması 1-30, 31-60 ve 61+ gün ayırır", () => {
  const base = { type: "receivable", denominationCode: "TRY", payments: [], denominationOpenUnitPrice: 1 };
  const result = agingSummary([
    { ...base, id: "a", dueDate: "2026-08-20", originalAmount: 100, denominationQuantity: 100 },
    { ...base, id: "b", dueDate: "2026-08-01", originalAmount: 200, denominationQuantity: 200 },
    { ...base, id: "c", dueDate: "2026-06-20", originalAmount: 300, denominationQuantity: 300 },
    { ...base, id: "d", dueDate: "2026-05-01", originalAmount: 400, denominationQuantity: 400 },
  ], "2026-08-12");
  assert.equal(result.current.amount, 100);
  assert.equal(result.days1to30.amount, 200);
  assert.equal(result.days31to60.amount, 300);
  assert.equal(result.days61plus.amount, 400);
});

test("sağlıklı büyüme gider ve gecikmiş alacak baskısını puana yansıtır", () => {
  const rows = [];
  for (let month = 3; month <= 8; month += 1) {
    const m = String(month).padStart(2, "0");
    rows.push(tx(`2026-${m}-05`, "income", 100000 + month * 2000));
    rows.push(tx(`2026-${m}-07`, "expense", 50000 + month * 8000));
  }
  const records = [{ type: "receivable", dueDate: "2026-05-01", denominationCode: "TRY", denominationQuantity: 100000, originalAmount: 100000, denominationOpenUnitPrice: 1, payments: [] }];
  const result = healthyGrowthScore({ transactions: rows, records, today: "2026-08-12" });
  assert.ok(result.score < 80);
  assert.ok(result.flags.length > 0);
});


test("14 ayar altın alacağı yaşlandırma ve hedefte güncel saf gram değeriyle hesaplanır", () => {
  const record = {
    type: "receivable", dueDate: "2026-08-01", denominationCode: "XAU_GRAM",
    denominationQuantity: 10, denominationKarat: 14, denominationPurity: 14 / 24,
    denominationOpenUnitPrice: 3000, originalAmount: 17500, payments: [],
  };
  const rates = { XAU_GRAM: 3600 };
  const aging = agingSummary([record], "2026-08-12", rates);
  assert.equal(aging.days1to30.amount, 21000);
  const collected = goalActualValue({ metric: "receivable_reduction", baselineValue: 25000 }, [], [record], "2026-08-12", rates);
  assert.equal(collected, 4000);
});
