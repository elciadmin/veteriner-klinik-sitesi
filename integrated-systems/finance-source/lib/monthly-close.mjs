import { roundMoney } from "./finance.mjs";
import {
  hasCashEffect,
  hasEconomicEffect,
  resolvedPosNet,
} from "./financial-core.mjs";
import { isRecognizedExpense } from "./operations.mjs";

const CHANNELS = ["cash", "bank", "posPending"];
const CLOSED_STATUSES = new Set(["closed", "closed_with_variance"]);

/** @param {unknown} value @param {string} label */
function assertAmountOrNull(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new TypeError(`${label} sonlu bir sayı olmalıdır.`);
  }
  if (amount < 0) {
    throw new RangeError(`${label} negatif olamaz.`);
  }
  return roundMoney(amount);
}

/** @param {unknown} period */
function assertPeriod(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period ?? ""));
  if (!match) {
    throw new TypeError("Dönem YYYY-MM biçiminde olmalıdır.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new RangeError("Geçersiz dönem.");
  }
  return { year, month };
}

/** @param {any} transaction */
function isAutomaticPosExpense(transaction) {
  return Boolean(
    transaction.kind === "expense" &&
      transaction.operationType === "pos_commission" &&
      transaction.isAutomatic &&
      transaction.sourceTransactionId,
  );
}

/** @param {any} transaction */
function transactionAmount(transaction) {
  const amount = Number(transaction.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("İşlem tutarı negatif veya geçersiz olamaz.");
  }
  return amount;
}

/** @param {any} transaction */
function posNet(transaction) {
  transactionAmount(transaction);
  return resolvedPosNet(transaction);
}

/** @param {string} period */
export function periodBounds(period) {
  const { year, month } = assertPeriod(period);
  const lastDay = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: lastDay,
  };
}

/** @param {string} period */
export function previousPeriod(period) {
  const { year, month } = assertPeriod(period);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(
    previous.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

/** @param {any} input */
export function resolveOpeningBalances({
  period,
  closings = [],
  openingCash = null,
  openingBank = null,
}) {
  assertPeriod(period);
  const priorPeriod = previousPeriod(period);
  const priorClose = closings.find(
    (closing) =>
      closing.period === priorPeriod && CLOSED_STATUSES.has(closing.status),
  );

  if (priorClose) {
    return {
      openingCash: assertAmountOrNull(
        priorClose.actualCash,
        "Önceki ay fiili kasası",
      ),
      openingBank: assertAmountOrNull(
        priorClose.actualBank,
        "Önceki ay fiili banka bakiyesi",
      ),
      source: "previous_close",
      sourcePeriod: priorPeriod,
    };
  }

  return {
    openingCash: assertAmountOrNull(openingCash, "Açılış kasası"),
    openingBank: assertAmountOrNull(openingBank, "Açılış banka bakiyesi"),
    source: "manual",
    sourcePeriod: null,
  };
}

/** @param {any} input */
export function calculateMonthlyClose({
  transactions = [],
  period,
  openingCash = null,
  openingBank = null,
}) {
  const { start, end } = periodBounds(period);
  const normalizedOpeningCash = assertAmountOrNull(
    openingCash,
    "Açılış kasası",
  );
  const normalizedOpeningBank = assertAmountOrNull(
    openingBank,
    "Açılış banka bakiyesi",
  );

  let income = 0;
  let recognizedExpense = 0;
  let undocumentedOutflow = 0;
  let withdrawals = 0;
  let cashIncome = 0;
  let cashRecognizedExpense = 0;
  let cashUndocumentedOutflow = 0;
  let cashWithdrawals = 0;
  let bankIncome = 0;
  let bankOutflow = 0;
  let posSettlements = 0;
  let posPending = 0;
  let posPendingGross = 0;
  let cardExpenseAssumedBank = 0;
  let collectionCash = 0;
  let liabilityPaymentCash = 0;
  let assetPurchaseCash = 0;
  const dataQualityFlags = new Set();

  for (const transaction of transactions) {
    if (transaction.status === "cancelled") continue;

    const amount = transactionAmount(transaction);
    const inPeriod = transaction.date >= start && transaction.date <= end;
    const paymentMethod = transaction.paymentMethod;
    const economic = hasEconomicEffect(transaction);
    const cash = hasCashEffect(transaction);

    if (
      transaction.kind === "income" &&
      cash &&
      paymentMethod === "card" &&
      transaction.date <= end
    ) {
      const net = posNet(transaction);
      const isSettledByEnd =
        transaction.posStatus === "settled" &&
        Boolean(transaction.settlementDate) &&
        transaction.settlementDate <= end;

      if (isSettledByEnd) {
        if (transaction.settlementDate >= start) {
          posSettlements += net;
        }
      } else {
        posPending += net;
        posPendingGross += amount;
        if (
          transaction.posStatus === "settled" &&
          !transaction.settlementDate
        ) {
          dataQualityFlags.add("settled_pos_missing_date");
        }
      }
    }

    if (!inPeriod) continue;

    if (transaction.kind === "income") {
      if (economic) income += amount;
      else if (cash) collectionCash += amount;
      if (cash && paymentMethod === "cash") cashIncome += amount;
      if (cash && paymentMethod === "transfer") bankIncome += amount;
      continue;
    }

    if (transaction.kind === "expense") {
      const automaticPosFee = isAutomaticPosExpense(transaction);
      const recognized = economic && isRecognizedExpense(transaction);

      if (economic) {
        if (recognized) recognizedExpense += amount;
        else undocumentedOutflow += amount;
      } else if (cash) {
        if (transaction.operationType === "inventory_purchase") {
          assetPurchaseCash += amount;
        } else {
          liabilityPaymentCash += amount;
        }
      }

      if (automaticPosFee || !cash) continue;

      if (paymentMethod === "cash") {
        if (economic && recognized) cashRecognizedExpense += amount;
        else if (economic) cashUndocumentedOutflow += amount;
        else cashRecognizedExpense += amount;
      } else {
        bankOutflow += amount;
        if (paymentMethod === "card") {
          cardExpenseAssumedBank += amount;
          dataQualityFlags.add("card_expense_assumed_bank");
        }
      }
      continue;
    }

    if (transaction.kind === "withdrawal") {
      withdrawals += amount;
      if (cash && paymentMethod === "cash") cashWithdrawals += amount;
      else if (cash) bankOutflow += amount;
      continue;
    }

    throw new RangeError("Geçersiz işlem türü.");
  }

  const expectedCash =
    normalizedOpeningCash === null
      ? null
      : roundMoney(
          normalizedOpeningCash +
            cashIncome -
            cashRecognizedExpense -
            cashUndocumentedOutflow -
            cashWithdrawals,
        );
  const expectedBank =
    normalizedOpeningBank === null
      ? null
      : roundMoney(
          normalizedOpeningBank + bankIncome + posSettlements - bankOutflow,
        );

  return {
    period,
    periodStart: start,
    periodEnd: end,
    openingCash: normalizedOpeningCash,
    openingBank: normalizedOpeningBank,
    expectedCash,
    expectedBank,
    expectedPosPending: roundMoney(posPending),
    income: roundMoney(income),
    recognizedExpense: roundMoney(recognizedExpense),
    undocumentedOutflow: roundMoney(undocumentedOutflow),
    withdrawals: roundMoney(withdrawals),
    collectionCash: roundMoney(collectionCash),
    liabilityPaymentCash: roundMoney(liabilityPaymentCash),
    assetPurchaseCash: roundMoney(assetPurchaseCash),
    cashIncome: roundMoney(cashIncome),
    cashRecognizedExpense: roundMoney(cashRecognizedExpense),
    cashUndocumentedOutflow: roundMoney(cashUndocumentedOutflow),
    cashWithdrawals: roundMoney(cashWithdrawals),
    bankIncome: roundMoney(bankIncome),
    bankOutflow: roundMoney(bankOutflow),
    posSettlements: roundMoney(posSettlements),
    posPendingGross: roundMoney(posPendingGross),
    cardExpenseAssumedBank: roundMoney(cardExpenseAssumedBank),
    dataQualityFlags: [...dataQualityFlags],
  };
}

/** @param {unknown} expected */
export function reconciliationTolerance(expected) {
  const amount = assertAmountOrNull(expected, "Beklenen bakiye");
  if (amount === null) return null;
  return roundMoney(Math.max(10, Math.abs(amount) * 0.001));
}

/** @param {unknown} expected @param {unknown} actual */
export function channelReconciliation(expected, actual) {
  const normalizedExpected = assertAmountOrNull(expected, "Beklenen bakiye");
  const normalizedActual = assertAmountOrNull(actual, "Fiili bakiye");
  if (normalizedExpected === null || normalizedActual === null) {
    return {
      expected: normalizedExpected,
      actual: normalizedActual,
      difference: null,
      tolerance: reconciliationTolerance(normalizedExpected),
      materialThreshold:
        normalizedExpected === null
          ? null
          : roundMoney(Math.max(100, Math.abs(normalizedExpected) * 0.005)),
      status: "missing",
    };
  }

  const difference = roundMoney(normalizedActual - normalizedExpected);
  const tolerance = reconciliationTolerance(normalizedExpected);
  const materialThreshold = roundMoney(
    Math.max(100, Math.abs(normalizedExpected) * 0.005),
  );
  const absoluteDifference = Math.abs(difference);

  return {
    expected: normalizedExpected,
    actual: normalizedActual,
    difference,
    tolerance,
    materialThreshold,
    status:
      absoluteDifference <= tolerance
        ? "balanced"
        : absoluteDifference >= materialThreshold
          ? "material"
          : "attention",
  };
}

/** @param {any} input */
export function assessMonthlyClose({
  summary,
  actualCash = null,
  actualBank = null,
  actualPosPending = null,
  today,
  varianceNote = "",
}) {
  const channels = {
    cash: channelReconciliation(summary.expectedCash, actualCash),
    bank: channelReconciliation(summary.expectedBank, actualBank),
    posPending: channelReconciliation(
      summary.expectedPosPending,
      actualPosPending,
    ),
  };
  const blockers = [];

  if (summary.periodEnd > today) {
    blockers.push("period_not_finished");
  }
  if (summary.openingCash === null) blockers.push("opening_cash_missing");
  if (summary.openingBank === null) blockers.push("opening_bank_missing");
  for (const channel of CHANNELS) {
    if (channels[channel].actual === null) {
      blockers.push(`actual_${channel}_missing`);
    }
  }

  const hasDifference = CHANNELS.some(
    (channel) =>
      channels[channel].status === "attention" ||
      channels[channel].status === "material",
  );
  const requiresVarianceNote =
    hasDifference || summary.dataQualityFlags.length > 0;
  const hasVarianceNote = String(varianceNote ?? "").trim().length >= 5;
  if (requiresVarianceNote && !hasVarianceNote) {
    blockers.push("variance_note_required");
  }

  const canClose = blockers.length === 0;
  return {
    channels,
    blockers,
    hasDifference,
    requiresVarianceNote,
    canClose,
    status: canClose
      ? requiresVarianceNote
        ? "closed_with_variance"
        : "closed"
      : "open",
  };
}

/** @param {unknown} date @param {any[]} closings */
export function isPeriodLocked(date, closings = []) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(date ?? ""));
  if (!match) return false;
  const period = `${match[1]}-${match[2]}`;
  return closings.some(
    (closing) =>
      closing.period === period && CLOSED_STATUSES.has(closing.status),
  );
}
