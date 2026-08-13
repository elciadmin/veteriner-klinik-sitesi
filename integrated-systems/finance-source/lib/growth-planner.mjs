import { hasEconomicEffect } from "./financial-core.mjs";
import { indexedLedgerValue, remainingDenomination } from "./indexed-ledger.mjs";

const DAY_MS = 86_400_000;

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) throw new RangeError("Tarih YYYY-MM-DD biçiminde olmalıdır.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new RangeError("Geçersiz tarih.");
  return date;
}

function monthKey(date) {
  return String(date).slice(0, 7);
}

function monthIndex(value) {
  const [year, month] = String(value).split("-").map(Number);
  return year * 12 + month - 1;
}

function monthFromIndex(index) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(month, offset) {
  return monthFromIndex(monthIndex(month) + Number(offset || 0));
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function deviation(values, center) {
  const usable = values.filter(Number.isFinite);
  if (usable.length < 2) return 0;
  const meanSquare = usable.reduce((sum, value) => sum + (value - center) ** 2, 0) / usable.length;
  return Math.sqrt(meanSquare);
}

function economicRows(transactions) {
  return (transactions ?? []).filter(
    (row) => row?.status !== "cancelled" && hasEconomicEffect(row),
  );
}

export function monthlyFinanceSeries(transactions, today, { months = 12 } = {}) {
  const currentMonth = monthKey(today);
  const startMonth = addMonths(currentMonth, -(Math.max(1, Number(months || 12)) - 1));
  const buckets = new Map();
  for (let i = 0; i < months; i += 1) {
    const month = addMonths(startMonth, i);
    buckets.set(month, { month, income: 0, expense: 0, net: 0 });
  }

  for (const row of economicRows(transactions)) {
    const key = monthKey(row.date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amount = Math.max(0, Number(row.amount || 0));
    if (row.kind === "income") bucket.income += amount;
    else if (row.kind === "expense") bucket.expense += amount;
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    income: roundMoney(bucket.income),
    expense: roundMoney(bucket.expense),
    net: roundMoney(bucket.income - bucket.expense),
  }));
}

function growthRates(values) {
  const rates = [];
  for (let i = 1; i < values.length; i += 1) {
    const prior = Number(values[i - 1] || 0);
    const current = Number(values[i] || 0);
    if (prior <= 0 || current < 0) continue;
    const rate = current / prior - 1;
    // Extreme one-off spikes are not allowed to dominate forward planning.
    if (Number.isFinite(rate)) rates.push(clamp(rate, -0.6, 0.8));
  }
  return rates;
}

export function trendAssumptions(series) {
  const incomeRates = growthRates(series.map((item) => item.income));
  const expenseRates = growthRates(series.map((item) => item.expense));
  const incomeBase = median(incomeRates);
  const expenseBase = median(expenseRates);
  const incomeVolatility = deviation(incomeRates, incomeBase);
  const expenseVolatility = deviation(expenseRates, expenseBase);

  return {
    income: {
      base: clamp(incomeBase, -0.25, 0.35),
      optimistic: clamp(incomeBase + incomeVolatility * 0.5, -0.2, 0.45),
      pessimistic: clamp(incomeBase - incomeVolatility * 0.75, -0.4, 0.25),
      volatility: incomeVolatility,
      observations: incomeRates.length,
    },
    expense: {
      base: clamp(expenseBase, -0.2, 0.35),
      optimistic: clamp(expenseBase - expenseVolatility * 0.5, -0.3, 0.3),
      pessimistic: clamp(expenseBase + expenseVolatility * 0.75, -0.1, 0.5),
      volatility: expenseVolatility,
      observations: expenseRates.length,
    },
  };
}

function lastPositive(series, key) {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = Number(series[i]?.[key] || 0);
    if (value > 0) return value;
  }
  return 0;
}

function scenarioRows(lastMonth, incomeStart, expenseStart, incomeRate, expenseRate, monthsAhead, scenario) {
  const rows = [];
  let income = incomeStart;
  let expense = expenseStart;
  for (let i = 1; i <= monthsAhead; i += 1) {
    income = Math.max(0, income * (1 + incomeRate));
    expense = Math.max(0, expense * (1 + expenseRate));
    rows.push({
      month: addMonths(lastMonth, i),
      scenario,
      income: roundMoney(income),
      expense: roundMoney(expense),
      net: roundMoney(income - expense),
    });
  }
  return rows;
}

export function forecastFinance(transactions, today, { historyMonths = 12, monthsAhead = 12 } = {}) {
  // Aylık trend hesabında içinde bulunulan eksik ayı tam ay gibi değerlendirmek,
  // ayın ilk günlerinde sahte bir gelir düşüşü üretir. Bu nedenle projeksiyon
  // yalnız tamamlanmış aylardan öğrenir; ilk tahmin ayı içinde bulunulan aydır.
  const completedMonth = addMonths(monthKey(today), -1);
  const history = monthlyFinanceSeries(transactions, `${completedMonth}-01`, { months: historyMonths });
  const assumptions = trendAssumptions(history);
  const lastMonth = history.at(-1)?.month ?? completedMonth;
  const incomeStart = lastPositive(history, "income");
  const expenseStart = lastPositive(history, "expense");
  const confidence = Math.min(
    assumptions.income.observations,
    assumptions.expense.observations,
  ) >= 5 ? "medium" : "low";

  return {
    history,
    assumptions,
    confidence,
    scenarios: {
      base: scenarioRows(lastMonth, incomeStart, expenseStart, assumptions.income.base, assumptions.expense.base, monthsAhead, "base"),
      optimistic: scenarioRows(lastMonth, incomeStart, expenseStart, assumptions.income.optimistic, assumptions.expense.optimistic, monthsAhead, "optimistic"),
      pessimistic: scenarioRows(lastMonth, incomeStart, expenseStart, assumptions.income.pessimistic, assumptions.expense.pessimistic, monthsAhead, "pessimistic"),
    },
  };
}

function monthsBetween(start, end) {
  return Math.max(0, monthIndex(monthKey(end)) - monthIndex(monthKey(start)));
}

export function goalActualValue(goal, transactions, records = [], today, marketRates = {}) {
  const start = String(goal.startDate || `${today.slice(0, 4)}-01-01`);
  const end = today < String(goal.endDate || today) ? today : String(goal.endDate || today);
  const active = economicRows(transactions).filter((row) => row.date >= start && row.date <= end);
  const metric = String(goal.metric || "revenue");

  if (metric === "revenue") {
    return roundMoney(active.filter((row) => row.kind === "income").reduce((sum, row) => sum + Number(row.amount || 0), 0));
  }
  if (metric === "expense") {
    return roundMoney(active.filter((row) => row.kind === "expense").reduce((sum, row) => sum + Number(row.amount || 0), 0));
  }
  if (metric === "net_profit") {
    const income = active.filter((row) => row.kind === "income").reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expense = active.filter((row) => row.kind === "expense").reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return roundMoney(income - expense);
  }
  if (metric === "receivable_reduction") {
    const remaining = records.filter((row) => row.type === "receivable").reduce((sum, row) => {
      const code = String(row.denominationCode || "TRY");
      const rate = code === "TRY" ? 1 : Number(marketRates[code] ?? row.denominationOpenUnitPrice ?? 0);
      const current = rate > 0 ? indexedLedgerValue(row, rate).currentValue : 0;
      return sum + Number(current || 0);
    }, 0);
    return roundMoney(Math.max(0, Number(goal.baselineValue || 0) - remaining));
  }
  if (metric === "debt_reduction") {
    const remaining = records.filter((row) => row.type === "payable").reduce((sum, row) => {
      const code = String(row.denominationCode || "TRY");
      const rate = code === "TRY" ? 1 : Number(marketRates[code] ?? row.denominationOpenUnitPrice ?? 0);
      const current = rate > 0 ? indexedLedgerValue(row, rate).currentValue : 0;
      return sum + Number(current || 0);
    }, 0);
    return roundMoney(Math.max(0, Number(goal.baselineValue || 0) - remaining));
  }
  if (metric === "cash_reserve") {
    return roundMoney(Number(goal.currentOverride || 0));
  }
  return roundMoney(Number(goal.currentOverride || 0));
}

export function evaluateGoal(goal, actualValue, today) {
  const target = Math.max(0, Number(goal.targetValue || 0));
  const baseline = Number(goal.baselineValue || 0);
  const current = Number(actualValue || 0);
  const start = dateOnly(goal.startDate);
  const end = dateOnly(goal.endDate);
  const now = dateOnly(today);
  const totalDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  const elapsedDays = clamp(Math.round((now - start) / DAY_MS) + 1, 0, totalDays);
  const timeProgress = elapsedDays / totalDays;
  const direction = goal.direction === "down" ? "down" : "up";
  const span = Math.max(0.000001, direction === "down" ? baseline - target : target - baseline);
  const moved = direction === "down" ? baseline - current : current - baseline;
  const progress = clamp(moved / span, 0, 1);
  const paceGap = progress - timeProgress;
  const remainingMonths = Math.max(0, monthsBetween(today, goal.endDate));
  let requiredMonthlyGrowth = null;
  if (direction === "up" && current > 0 && target > current && remainingMonths > 0) {
    requiredMonthlyGrowth = Math.pow(target / current, 1 / remainingMonths) - 1;
  }

  let status = "on_track";
  if (today > goal.endDate && progress < 1) status = "missed";
  else if (progress >= 1) status = "achieved";
  else if (paceGap < -0.12) status = "behind";
  else if (paceGap > 0.12) status = "ahead";

  return {
    target: roundMoney(target),
    baseline: roundMoney(baseline),
    actual: roundMoney(current),
    progress,
    progressPercent: Math.round(progress * 1000) / 10,
    timeProgress,
    timeProgressPercent: Math.round(timeProgress * 1000) / 10,
    paceGap,
    remaining: roundMoney(direction === "down" ? Math.max(0, current - target) : Math.max(0, target - current)),
    remainingMonths,
    requiredMonthlyGrowth,
    status,
  };
}

function remainingTl(record, marketRates = {}) {
  const code = String(record.denominationCode || "TRY");
  const rate = code === "TRY" ? 1 : Number(marketRates[code] ?? record.denominationOpenUnitPrice ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Number(indexedLedgerValue(record, rate).currentValue || 0);
}

export function agingSummary(records, today, marketRates = {}) {
  const buckets = {
    current: { count: 0, amount: 0 },
    days1to30: { count: 0, amount: 0 },
    days31to60: { count: 0, amount: 0 },
    days61plus: { count: 0, amount: 0 },
  };
  const todayDate = dateOnly(today);
  for (const record of records ?? []) {
    const amount = remainingTl(record, marketRates);
    if (amount <= 0 || !record.dueDate) continue;
    const daysLate = Math.floor((todayDate - dateOnly(record.dueDate)) / DAY_MS);
    const bucket = daysLate <= 0 ? buckets.current : daysLate <= 30 ? buckets.days1to30 : daysLate <= 60 ? buckets.days31to60 : buckets.days61plus;
    bucket.count += 1;
    bucket.amount += amount;
  }
  for (const bucket of Object.values(buckets)) bucket.amount = roundMoney(bucket.amount);
  return buckets;
}

export function healthyGrowthScore({ transactions, records = [], today, marketRates = {} }) {
  const forecast = forecastFinance(transactions, today, { historyMonths: 6, monthsAhead: 3 });
  const history = forecast.history;
  const last3 = history.slice(-3);
  const first3 = history.slice(-6, -3);
  const avg = (rows, key) => rows.length ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length : 0;
  const recentIncome = avg(last3, "income");
  const priorIncome = avg(first3, "income");
  const recentExpense = avg(last3, "expense");
  const priorExpense = avg(first3, "expense");
  const revenueGrowth = priorIncome > 0 ? recentIncome / priorIncome - 1 : 0;
  const expenseGrowth = priorExpense > 0 ? recentExpense / priorExpense - 1 : 0;
  const margin = recentIncome > 0 ? (recentIncome - recentExpense) / recentIncome : 0;
  const receivableAging = agingSummary(records.filter((row) => row.type === "receivable"), today, marketRates);
  const overdue = receivableAging.days1to30.amount + receivableAging.days31to60.amount + receivableAging.days61plus.amount;
  const allReceivable = overdue + receivableAging.current.amount;
  const overdueRatio = allReceivable > 0 ? overdue / allReceivable : 0;

  let score = 70;
  score += clamp(revenueGrowth * 80, -20, 18);
  score -= clamp((expenseGrowth - revenueGrowth) * 70, -8, 20);
  score += clamp((margin - 0.1) * 50, -12, 12);
  score -= clamp(overdueRatio * 25, 0, 25);
  score = Math.round(clamp(score, 0, 100));

  const flags = [];
  if (expenseGrowth > revenueGrowth + 0.03) flags.push("Gider büyümesi gelir büyümesinden hızlı.");
  if (overdueRatio > 0.3) flags.push("Alacakların önemli bölümü vadesini geçmiş.");
  if (margin < 0.05 && recentIncome > 0) flags.push("Net faaliyet marjı düşük.");
  if (!flags.length) flags.push("Gelir, gider ve alacak kalitesi birlikte dengeli görünüyor.");

  return {
    score,
    revenueGrowth,
    expenseGrowth,
    margin,
    overdueRatio,
    flags,
  };
}
