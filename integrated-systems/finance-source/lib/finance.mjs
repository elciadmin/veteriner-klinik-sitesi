const MONEY_EPSILON = 0.005;
const DAY_MS = 86_400_000;
const AVERAGE_MONTH_DAYS = 365.25 / 12;

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} sonlu bir sayı olmalıdır.`);
  }
}

function assertNonNegative(value, label) {
  assertFiniteNumber(value, label);
  if (value < 0) {
    throw new RangeError(`${label} negatif olamaz.`);
  }
}

function assertRate(value, label) {
  assertFiniteNumber(value, label);
  if (value < 0 || value >= 1) {
    throw new RangeError(`${label} 0 ile 1 arasında olmalıdır.`);
  }
}

export function roundMoney(value) {
  assertFiniteNumber(value, "Tutar");
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
      ),
    );
  }

  if (typeof value !== "string") {
    throw new TypeError("Tarih YYYY-MM-DD biçiminde olmalıdır.");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new TypeError("Tarih YYYY-MM-DD biçiminde olmalıdır.");
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("Geçersiz tarih.");
  }

  return date;
}

export function daysUntil(dueDate, today) {
  const due = parseDateOnly(dueDate);
  const current = parseDateOnly(today);
  return Math.round((due.getTime() - current.getTime()) / DAY_MS);
}

export function paymentPosition(originalAmount, payments = []) {
  assertNonNegative(originalAmount, "Ana tutar");

  let totalPaid = 0;
  for (const payment of payments) {
    const amount =
      typeof payment === "number" ? payment : Number(payment?.amount ?? 0);
    const isCancelled =
      typeof payment === "object" && payment?.status === "cancelled";
    if (isCancelled) continue;
    assertNonNegative(amount, "Ödeme");
    totalPaid += amount;
  }

  totalPaid = roundMoney(totalPaid);
  const appliedPaid = roundMoney(Math.min(totalPaid, originalAmount));
  const remaining = roundMoney(Math.max(0, originalAmount - totalPaid));
  const overpayment = roundMoney(Math.max(0, totalPaid - originalAmount));

  return {
    originalAmount: roundMoney(originalAmount),
    totalPaid,
    appliedPaid,
    remaining,
    overpayment,
    paymentRate:
      originalAmount > 0 ? appliedPaid / roundMoney(originalAmount) : null,
  };
}

export function ledgerStatus({
  originalAmount,
  payments = [],
  dueDate,
  today,
}) {
  const position = paymentPosition(originalAmount, payments);
  if (position.remaining <= MONEY_EPSILON) {
    return { code: "paid", daysToDue: daysUntil(dueDate, today), ...position };
  }

  const daysToDue = daysUntil(dueDate, today);
  const partial = position.appliedPaid > MONEY_EPSILON;

  let code;
  if (daysToDue < 0) code = partial ? "overdue_partial" : "overdue";
  else if (daysToDue === 0) code = partial ? "due_today_partial" : "due_today";
  else if (daysToDue <= 7) code = partial ? "due_soon_partial" : "due_soon";
  else code = partial ? "partial" : "open";

  return { code, daysToDue, ...position };
}

export function monthlyReserveRequirement({
  remainingAmount,
  existingReserve = 0,
  dueDate,
  today,
}) {
  assertNonNegative(remainingAmount, "Kalan borç");
  assertNonNegative(existingReserve, "Mevcut rezerv");

  const fundingGap = roundMoney(
    Math.max(0, remainingAmount - existingReserve),
  );
  const daysToDue = daysUntil(dueDate, today);

  if (fundingGap <= MONEY_EPSILON) {
    return {
      fundingGap: 0,
      monthsAvailable: 0,
      monthlyReserve: 0,
      daysToDue,
      urgency: "funded",
    };
  }

  const monthsAvailable =
    daysToDue <= 0
      ? 1
      : Math.max(1, Math.ceil(daysToDue / AVERAGE_MONTH_DAYS));

  return {
    fundingGap,
    monthsAvailable,
    monthlyReserve: roundMoney(fundingGap / monthsAvailable),
    daysToDue,
    urgency:
      daysToDue < 0 ? "overdue" : daysToDue === 0 ? "due_today" : "scheduled",
  };
}

export function priceAnalysis({
  grossPrice,
  directAndAllocatedCost,
  vatRate,
  posRate,
}) {
  assertNonNegative(grossPrice, "KDV dâhil fiyat");
  assertNonNegative(directAndAllocatedCost, "Toplam maliyet");
  assertRate(vatRate, "KDV oranı");
  assertRate(posRate, "POS oranı");

  const netSales = grossPrice / (1 + vatRate);
  const outputVat = grossPrice - netSales;
  const posCost = grossPrice * posRate;
  const contribution = netSales - directAndAllocatedCost - posCost;

  return {
    grossPrice: roundMoney(grossPrice),
    netSales: roundMoney(netSales),
    outputVat: roundMoney(outputVat),
    posCost: roundMoney(posCost),
    totalCost: roundMoney(directAndAllocatedCost),
    contribution: roundMoney(contribution),
    marginOnNetSales: netSales > 0 ? contribution / netSales : null,
    marginOnCollection: grossPrice > 0 ? contribution / grossPrice : null,
  };
}

export function grossPriceForTargetMargin({
  directAndAllocatedCost,
  vatRate,
  posRate,
  targetMarginOnNetSales,
}) {
  assertNonNegative(directAndAllocatedCost, "Toplam maliyet");
  assertRate(vatRate, "KDV oranı");
  assertRate(posRate, "POS oranı");
  assertRate(targetMarginOnNetSales, "Hedef kâr marjı");

  const denominator =
    (1 - targetMarginOnNetSales) / (1 + vatRate) - posRate;

  if (denominator <= 0) {
    throw new RangeError(
      "Hedef marj ve POS oranı bu maliyet yapısıyla uygulanabilir değil.",
    );
  }

  const grossPrice = directAndAllocatedCost / denominator;
  return {
    requiredGrossPrice: roundMoney(grossPrice),
    ...priceAnalysis({
      grossPrice,
      directAndAllocatedCost,
      vatRate,
      posRate,
    }),
  };
}

export function vatSettlement({
  outputVat,
  deductibleInputVat,
  priorCarryForward = 0,
  adjustments = 0,
}) {
  assertNonNegative(outputVat, "Hesaplanan KDV");
  assertNonNegative(deductibleInputVat, "İndirilecek KDV");
  assertNonNegative(priorCarryForward, "Devreden KDV");
  assertFiniteNumber(adjustments, "KDV düzeltmesi");

  const net =
    outputVat + adjustments - deductibleInputVat - priorCarryForward;

  return {
    payableVat: roundMoney(Math.max(0, net)),
    nextCarryForward: roundMoney(Math.max(0, -net)),
    netPosition: roundMoney(net),
  };
}

export function targetProgress({
  annualTarget,
  actualToDate,
  seasonalityWeightToDate,
  workingDaysRemaining,
}) {
  assertNonNegative(annualTarget, "Yıllık hedef");
  assertNonNegative(actualToDate, "Gerçekleşen");
  assertFiniteNumber(seasonalityWeightToDate, "Mevsimsellik ağırlığı");
  assertNonNegative(workingDaysRemaining, "Kalan iş günü");

  if (seasonalityWeightToDate <= 0 || seasonalityWeightToDate > 1) {
    throw new RangeError("Mevsimsellik ağırlığı 0'dan büyük ve en fazla 1 olmalıdır.");
  }

  const targetToDate = annualTarget * seasonalityWeightToDate;
  const variance = actualToDate - targetToDate;
  const remainingTarget = Math.max(0, annualTarget - actualToDate);
  const requiredDailyPace =
    remainingTarget === 0
      ? 0
      : workingDaysRemaining > 0
        ? remainingTarget / workingDaysRemaining
        : null;

  return {
    targetToDate: roundMoney(targetToDate),
    variance: roundMoney(variance),
    remainingTarget: roundMoney(remainingTarget),
    requiredDailyPace:
      requiredDailyPace === null ? null : roundMoney(requiredDailyPace),
    attainmentRate: annualTarget > 0 ? actualToDate / annualTarget : null,
    paceRate: targetToDate > 0 ? actualToDate / targetToDate : null,
    simpleYearEndForecast: roundMoney(
      actualToDate / seasonalityWeightToDate,
    ),
    status:
      Math.abs(variance) <= MONEY_EPSILON
        ? "at_target"
        : variance > 0
          ? "ahead"
          : "behind",
  };
}

export function spendableCash({
  cash,
  bank,
  taxReserve = 0,
  debtReserve = 0,
  payrollReserve = 0,
  otherRestrictedReserve = 0,
  obligationsDueWithin30Days = 0,
  posPending = 0,
}) {
  const fields = {
    cash,
    bank,
    taxReserve,
    debtReserve,
    payrollReserve,
    otherRestrictedReserve,
    obligationsDueWithin30Days,
    posPending,
  };
  for (const [label, value] of Object.entries(fields)) {
    assertNonNegative(value, label);
  }

  const liquidFunds = cash + bank;
  const restricted =
    taxReserve +
    debtReserve +
    payrollReserve +
    otherRestrictedReserve +
    obligationsDueWithin30Days;
  const rawSpendable = liquidFunds - restricted;

  return {
    liquidFunds: roundMoney(liquidFunds),
    posPending: roundMoney(posPending),
    restricted: roundMoney(restricted),
    spendable: roundMoney(Math.max(0, rawSpendable)),
    shortfall: roundMoney(Math.max(0, -rawSpendable)),
  };
}

export function loanPrincipalFromMonthlyPayment({
  monthlyPayment,
  monthlyRate,
  termMonths,
}) {
  assertNonNegative(monthlyPayment, "Aylık taksit");
  assertNonNegative(monthlyRate, "Aylık faiz");
  assertNonNegative(termMonths, "Vade");

  if (!Number.isInteger(termMonths) || termMonths === 0) {
    throw new RangeError("Vade pozitif tam ay olmalıdır.");
  }

  if (monthlyRate === 0) {
    return roundMoney(monthlyPayment * termMonths);
  }

  return roundMoney(
    monthlyPayment *
      ((1 - Math.pow(1 + monthlyRate, -termMonths)) / monthlyRate),
  );
}

export function borrowingCapacity({
  baseCashAvailableForDebtService,
  stressedCashAvailableForDebtService,
  existingMonthlyDebtService,
  monthlyRate,
  termMonths,
  minimumBaseDscr = 1.5,
  minimumStressDscr = 1.2,
}) {
  assertNonNegative(
    baseCashAvailableForDebtService,
    "Baz borç ödeme nakdi",
  );
  assertNonNegative(
    stressedCashAvailableForDebtService,
    "Stres borç ödeme nakdi",
  );
  assertNonNegative(existingMonthlyDebtService, "Mevcut aylık borç servisi");
  assertNonNegative(monthlyRate, "Aylık faiz");
  assertFiniteNumber(minimumBaseDscr, "Baz DSCR sınırı");
  assertFiniteNumber(minimumStressDscr, "Stres DSCR sınırı");

  if (minimumBaseDscr <= 1 || minimumStressDscr <= 1) {
    throw new RangeError("DSCR güvenlik sınırları 1'in üzerinde olmalıdır.");
  }

  const baseLimit = baseCashAvailableForDebtService / minimumBaseDscr;
  const stressLimit =
    stressedCashAvailableForDebtService / minimumStressDscr;
  const safeTotalMonthlyDebtService = Math.max(
    0,
    Math.min(baseLimit, stressLimit),
  );
  const additionalMonthlyPayment = Math.max(
    0,
    safeTotalMonthlyDebtService - existingMonthlyDebtService,
  );

  return {
    baseDscr:
      existingMonthlyDebtService > 0
        ? baseCashAvailableForDebtService / existingMonthlyDebtService
        : null,
    stressDscr:
      existingMonthlyDebtService > 0
        ? stressedCashAvailableForDebtService /
          existingMonthlyDebtService
        : null,
    safeTotalMonthlyDebtService: roundMoney(safeTotalMonthlyDebtService),
    additionalMonthlyPayment: roundMoney(additionalMonthlyPayment),
    maximumAdditionalPrincipal: loanPrincipalFromMonthlyPayment({
      monthlyPayment: additionalMonthlyPayment,
      monthlyRate,
      termMonths,
    }),
    signal: additionalMonthlyPayment > MONEY_EPSILON ? "eligible" : "blocked",
  };
}

export function ledgerSummary(records, today) {
  const result = {
    receivable: { original: 0, paid: 0, remaining: 0, overdue: 0 },
    payable: { original: 0, paid: 0, remaining: 0, overdue: 0 },
  };

  for (const record of records) {
    if (record.type !== "receivable" && record.type !== "payable") {
      throw new RangeError("Kayıt türü receivable veya payable olmalıdır.");
    }
    const status = ledgerStatus({ ...record, today });
    const bucket = result[record.type];
    bucket.original += status.originalAmount;
    bucket.paid += status.appliedPaid;
    bucket.remaining += status.remaining;
    if (status.code.startsWith("overdue")) {
      bucket.overdue += status.remaining;
    }
  }

  for (const bucket of Object.values(result)) {
    for (const key of Object.keys(bucket)) {
      bucket[key] = roundMoney(bucket[key]);
    }
  }

  return result;
}

export function calendarEventsFromLedger(records, today) {
  const events = [];

  for (const record of records) {
    const status = ledgerStatus({ ...record, today });
    events.push({
      id: `${record.id}-due`,
      date: record.dueDate,
      type: `${record.type}_due`,
      recordId: record.id,
      title: record.counterparty,
      amount: status.remaining,
      status: status.code,
    });

    for (const [index, payment] of record.payments.entries()) {
      if (payment.status === "cancelled") continue;
      events.push({
        id: `${record.id}-payment-${index}`,
        date: payment.date,
        type:
          record.type === "receivable"
            ? "receivable_collection"
            : "payable_payment",
        recordId: record.id,
        title: record.counterparty,
        amount: roundMoney(payment.amount),
        status: "completed",
      });
    }
  }

  return events.sort(
    (a, b) => parseDateOnly(a.date).getTime() - parseDateOnly(b.date).getTime(),
  );
}
