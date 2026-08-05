import {
  borrowingCapacity,
  paymentPosition,
  roundMoney,
  vatSettlement,
} from "./finance.mjs";
import {
  hasCashEffect,
  hasEconomicEffect,
  resolvedPosNet,
} from "./financial-core.mjs";
import {
  isDocumentedOutflow,
  isRecognizedExpense,
} from "./operations.mjs";

const DAY_MS = 86_400_000;
const MONEY_EPSILON = 0.005;
const WEEKS_PER_MONTH = 365.25 / 12 / 7;

export const DEFAULT_DECISION_SETTINGS = Object.freeze({
  cashBalance: null,
  bankBalance: null,
  annualNetSalesTarget: null,
  priorVatCarryForward: 0,
  corporateTaxRate: 0.25,
  minimumCorporateTaxRate: 0.1,
  minimumCorporateTaxApplies: false,
  rentWithholdingRate: 0.2,
  rentContractBasis: "not_applicable",
  rentLandlordType: "unknown",
  taxRuleEffectiveDate: "",
  taxRuleSource: "",
  nonDeductibleExpenseAdjustment: 0,
  lossCarryforward: 0,
  approvedTaxDeductions: 0,
  additionalTaxesPaid: 0,
  otherTaxReserve: 0,
  monthlyHomeNeed: 70_000,
  ownerTransferType: "none",
  approvedCapex: 0,
  emergencyCapexReserve: 0,
  stressRevenueDropRate: 0.2,
  stressCostIncreaseRate: 0.15,
  monthlyDebtServiceOverride: null,
  loanMonthlyRate: null,
  loanTermMonths: 24,
  plannedPurchaseAmount: 0,
  plannedPurchaseMonthlyContribution: 0,
  maxPaybackMonths: 24,
  inflationAssumption: 0.2395,
  realGrowthTarget: 0.05,
  minimumBaseDscr: 1.5,
  minimumStressDscr: 1.25,
});

function finiteOr(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableNonNegative(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function nonNegativeOr(value, fallback) {
  const number = finiteOr(value, fallback);
  return number >= 0 ? number : fallback;
}

function rateOr(value, fallback) {
  const number = finiteOr(value, fallback);
  return number >= 0 && number < 1 ? number : fallback;
}

function positiveIntegerOr(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export function normalizeDecisionSettings(input = {}) {
  const basis = ["not_applicable", "gross", "net"].includes(
    input.rentContractBasis,
  )
    ? input.rentContractBasis
    : DEFAULT_DECISION_SETTINGS.rentContractBasis;
  const transferType = [
    "none",
    "salary",
    "dividend",
    "expense_reimbursement",
  ].includes(input.ownerTransferType)
    ? input.ownerTransferType
    : DEFAULT_DECISION_SETTINGS.ownerTransferType;
  const landlordType = [
    "unknown",
    "individual",
    "company",
    "exempt",
  ].includes(input.rentLandlordType)
    ? input.rentLandlordType
    : DEFAULT_DECISION_SETTINGS.rentLandlordType;

  return {
    cashBalance: nullableNonNegative(input.cashBalance),
    bankBalance: nullableNonNegative(input.bankBalance),
    annualNetSalesTarget: nullableNonNegative(input.annualNetSalesTarget),
    priorVatCarryForward: nonNegativeOr(
      input.priorVatCarryForward,
      DEFAULT_DECISION_SETTINGS.priorVatCarryForward,
    ),
    corporateTaxRate: rateOr(
      input.corporateTaxRate,
      DEFAULT_DECISION_SETTINGS.corporateTaxRate,
    ),
    minimumCorporateTaxRate: rateOr(
      input.minimumCorporateTaxRate,
      DEFAULT_DECISION_SETTINGS.minimumCorporateTaxRate,
    ),
    minimumCorporateTaxApplies: Boolean(input.minimumCorporateTaxApplies),
    rentWithholdingRate: rateOr(
      input.rentWithholdingRate,
      DEFAULT_DECISION_SETTINGS.rentWithholdingRate,
    ),
    rentContractBasis: basis,
    rentLandlordType: landlordType,
    taxRuleEffectiveDate: String(input.taxRuleEffectiveDate ?? "").trim(),
    taxRuleSource: String(input.taxRuleSource ?? "").trim(),
    nonDeductibleExpenseAdjustment: nonNegativeOr(
      input.nonDeductibleExpenseAdjustment,
      DEFAULT_DECISION_SETTINGS.nonDeductibleExpenseAdjustment,
    ),
    lossCarryforward: nonNegativeOr(
      input.lossCarryforward,
      DEFAULT_DECISION_SETTINGS.lossCarryforward,
    ),
    approvedTaxDeductions: nonNegativeOr(
      input.approvedTaxDeductions,
      DEFAULT_DECISION_SETTINGS.approvedTaxDeductions,
    ),
    additionalTaxesPaid: nonNegativeOr(
      input.additionalTaxesPaid,
      DEFAULT_DECISION_SETTINGS.additionalTaxesPaid,
    ),
    otherTaxReserve: nonNegativeOr(
      input.otherTaxReserve,
      DEFAULT_DECISION_SETTINGS.otherTaxReserve,
    ),
    monthlyHomeNeed: nonNegativeOr(
      input.monthlyHomeNeed,
      DEFAULT_DECISION_SETTINGS.monthlyHomeNeed,
    ),
    ownerTransferType: transferType,
    approvedCapex: nonNegativeOr(
      input.approvedCapex,
      DEFAULT_DECISION_SETTINGS.approvedCapex,
    ),
    emergencyCapexReserve: nonNegativeOr(
      input.emergencyCapexReserve,
      DEFAULT_DECISION_SETTINGS.emergencyCapexReserve,
    ),
    stressRevenueDropRate: rateOr(
      input.stressRevenueDropRate,
      DEFAULT_DECISION_SETTINGS.stressRevenueDropRate,
    ),
    stressCostIncreaseRate: rateOr(
      input.stressCostIncreaseRate,
      DEFAULT_DECISION_SETTINGS.stressCostIncreaseRate,
    ),
    monthlyDebtServiceOverride: nullableNonNegative(
      input.monthlyDebtServiceOverride,
    ),
    loanMonthlyRate: nullableNonNegative(input.loanMonthlyRate),
    loanTermMonths: positiveIntegerOr(
      input.loanTermMonths,
      DEFAULT_DECISION_SETTINGS.loanTermMonths,
    ),
    plannedPurchaseAmount: nonNegativeOr(
      input.plannedPurchaseAmount,
      DEFAULT_DECISION_SETTINGS.plannedPurchaseAmount,
    ),
    plannedPurchaseMonthlyContribution: nonNegativeOr(
      input.plannedPurchaseMonthlyContribution,
      DEFAULT_DECISION_SETTINGS.plannedPurchaseMonthlyContribution,
    ),
    maxPaybackMonths: positiveIntegerOr(
      input.maxPaybackMonths,
      DEFAULT_DECISION_SETTINGS.maxPaybackMonths,
    ),
    inflationAssumption: rateOr(
      input.inflationAssumption,
      DEFAULT_DECISION_SETTINGS.inflationAssumption,
    ),
    realGrowthTarget: rateOr(
      input.realGrowthTarget,
      DEFAULT_DECISION_SETTINGS.realGrowthTarget,
    ),
    minimumBaseDscr: Math.max(
      1.01,
      finiteOr(
        input.minimumBaseDscr,
        DEFAULT_DECISION_SETTINGS.minimumBaseDscr,
      ),
    ),
    minimumStressDscr: Math.max(
      1.01,
      finiteOr(
        input.minimumStressDscr,
        DEFAULT_DECISION_SETTINGS.minimumStressDscr,
      ),
    ),
  };
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) throw new TypeError("Tarih YYYY-MM-DD biçiminde olmalıdır.");
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new RangeError("Geçersiz tarih.");
  }
  return date;
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateText(date);
}

function inclusiveDays(startDate, endDate) {
  return (
    Math.round(
      (parseDate(endDate).getTime() - parseDate(startDate).getTime()) / DAY_MS,
    ) + 1
  );
}

function isAutomaticPos(transaction) {
  return Boolean(
    transaction.kind === "expense" &&
      transaction.operationType === "pos_commission" &&
      transaction.isAutomatic &&
      transaction.sourceTransactionId,
  );
}

function validRate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number < 1;
}

function transactionVat(transaction) {
  const amount = nonNegativeOr(transaction.amount, 0);
  const rate = validRate(transaction.vatRate)
    ? Number(transaction.vatRate)
    : 0;
  return amount - amount / (1 + rate);
}

function inRange(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

export function managementPeriod({
  transactions,
  startDate,
  endDate,
}) {
  if (startDate > endDate) {
    throw new RangeError("Başlangıç tarihi bitişten sonra olamaz.");
  }

  const active = transactions.filter(
    (transaction) =>
      transaction.status !== "cancelled" &&
      inRange(transaction.date, startDate, endDate),
  );

  let grossSales = 0;
  let outputVat = 0;
  let recognizedExpenseGross = 0;
  let deductibleInputVat = 0;
  let operatingExpenseGross = 0;
  let operatingExpenseNet = 0;
  let variableOperatingExpenseGross = 0;
  let fixedOperatingExpenseGross = 0;
  let inventoryPurchaseCash = 0;
  let taxCashPayments = 0;
  let undocumentedOutflow = 0;
  let ownerWithdrawals = 0;
  let cardGross = 0;
  let cardSettledGross = 0;
  let posCommission = 0;
  let posPending = 0;
  let rentPaid = 0;
  let directExpenseGross = 0;
  let documentedDirectExpenseGross = 0;
  let collectionCash = 0;
  let liabilityPaymentCash = 0;
  let cashInflow = transactions
    .filter(
      (transaction) =>
        transaction.status !== "cancelled" &&
        transaction.kind === "income" &&
        hasCashEffect(transaction) &&
        transaction.paymentMethod === "card" &&
        transaction.posStatus === "settled" &&
        transaction.settlementDate &&
        inRange(transaction.settlementDate, startDate, endDate),
    )
    .reduce((sum, transaction) => sum + resolvedPosNet(transaction), 0);
  let cashOutflow = 0;
  let operatingCashOutflow = 0;

  for (const transaction of active) {
    const amount = nonNegativeOr(transaction.amount, 0);
    const vat = transactionVat(transaction);
    const economic = hasEconomicEffect(transaction);
    const cash = hasCashEffect(transaction);

    if (transaction.kind === "income") {
      if (economic) {
        grossSales += amount;
        outputVat += vat;
      } else if (cash) {
        collectionCash += amount;
      }
      if (cash) {
        if (
          transaction.paymentMethod === "cash" ||
          transaction.paymentMethod === "transfer"
        ) {
          cashInflow += amount;
        }
      }
      if (transaction.paymentMethod === "card") {
        if (economic) cardGross += amount;
        if (transaction.posStatus === "settled") {
          if (economic) cardSettledGross += amount;
        } else {
          posPending += amount * (1 - nonNegativeOr(transaction.posRate, 0));
        }
      }
      continue;
    }

    if (transaction.kind === "withdrawal") {
      ownerWithdrawals += amount;
      if (cash) cashOutflow += amount;
      continue;
    }

    if (transaction.kind !== "expense") continue;
    if (cash && !isAutomaticPos(transaction)) cashOutflow += amount;
    if (!economic) {
      if (transaction.operationType === "inventory_purchase") {
        if (cash) {
          inventoryPurchaseCash += amount;
          operatingCashOutflow += amount;
        }
        if (isDocumentedOutflow(transaction)) deductibleInputVat += vat;
      } else {
        liabilityPaymentCash += amount;
      }
      continue;
    }

    if (!isAutomaticPos(transaction)) {
      directExpenseGross += amount;
    }

    if (!isRecognizedExpense(transaction)) {
      undocumentedOutflow += amount;
      continue;
    }

    recognizedExpenseGross += amount;
    deductibleInputVat += vat;
    if (!isAutomaticPos(transaction)) {
      documentedDirectExpenseGross += amount;
    }
    if (isAutomaticPos(transaction)) posCommission += amount;
    if (String(transaction.category).toLocaleLowerCase("tr-TR").includes("kira")) {
      rentPaid += amount;
    }

    if (transaction.operationType === "tax") {
      if (cash) taxCashPayments += amount;
      continue;
    }
    if (transaction.operationType === "inventory_purchase") {
      if (cash) {
        inventoryPurchaseCash += amount;
        operatingCashOutflow += amount;
      }
      continue;
    }

    operatingExpenseGross += amount;
    operatingExpenseNet += amount - vat;
    if (transaction.costBehavior === "fixed") {
      fixedOperatingExpenseGross += amount;
    } else {
      variableOperatingExpenseGross += amount;
    }
    if (cash && !isAutomaticPos(transaction)) {
      operatingCashOutflow += amount;
    }
  }

  const netSales = grossSales - outputVat;
  const dateRows = active.map((transaction) => transaction.date).sort();
  const firstDate = dateRows[0] ?? null;
  const lastDate = dateRows.at(-1) ?? null;
  const observedSpanDays =
    firstDate && lastDate ? inclusiveDays(firstDate, lastDate) : 0;

  return {
    startDate,
    endDate,
    transactionCount: active.length,
    firstDate,
    lastDate,
    observedSpanDays,
    activeDayCount: new Set(dateRows).size,
    grossSales: roundMoney(grossSales),
    outputVat: roundMoney(outputVat),
    netSales: roundMoney(netSales),
    recognizedExpenseGross: roundMoney(recognizedExpenseGross),
    deductibleInputVat: roundMoney(deductibleInputVat),
    recognizedExpenseNet: roundMoney(
      recognizedExpenseGross - deductibleInputVat,
    ),
    operatingExpenseGross: roundMoney(operatingExpenseGross),
    operatingExpenseNet: roundMoney(operatingExpenseNet),
    variableOperatingExpenseGross: roundMoney(
      variableOperatingExpenseGross,
    ),
    fixedOperatingExpenseGross: roundMoney(fixedOperatingExpenseGross),
    inventoryPurchaseCash: roundMoney(inventoryPurchaseCash),
    taxCashPayments: roundMoney(taxCashPayments),
    undocumentedOutflow: roundMoney(undocumentedOutflow),
    ownerWithdrawals: roundMoney(ownerWithdrawals),
    collectionCash: roundMoney(collectionCash),
    liabilityPaymentCash: roundMoney(liabilityPaymentCash),
    cashInflow: roundMoney(cashInflow),
    cashOutflow: roundMoney(cashOutflow),
    operatingCashOutflow: roundMoney(operatingCashOutflow),
    operatingProfitProxy: roundMoney(netSales - operatingExpenseNet),
    operatingCashBeforeTaxDebt: roundMoney(
      cashInflow - operatingCashOutflow,
    ),
    totalCashMovement: roundMoney(cashInflow - cashOutflow),
    cardGross: roundMoney(cardGross),
    cardSettledGross: roundMoney(cardSettledGross),
    posCommission: roundMoney(posCommission),
    posPending: roundMoney(posPending),
    rentPaid: roundMoney(rentPaid),
    directExpenseGross: roundMoney(directExpenseGross),
    documentedDirectExpenseGross: roundMoney(documentedDirectExpenseGross),
  };
}

function filled(value) {
  if (typeof value === "number") return Number.isFinite(value);
  return Boolean(String(value ?? "").trim());
}

function rowCompleteness(transaction) {
  const common = [
    filled(transaction.date),
    filled(transaction.time),
    filled(transaction.kind),
    filled(transaction.category),
    filled(transaction.description),
    filled(transaction.counterparty),
    nonNegativeOr(transaction.amount, 0) > 0,
    filled(transaction.paymentMethod),
  ];

  if (transaction.kind === "withdrawal") {
    return common.filter(Boolean).length / common.length;
  }

  const extra = [
    filled(transaction.operationType),
    validRate(transaction.vatRate),
    filled(transaction.documentType),
  ];
  if (transaction.kind === "expense") {
    extra.push(filled(transaction.costBehavior));
    if (transaction.documentType !== "none") {
      extra.push(filled(transaction.documentRef));
    }
  }
  if (
    transaction.kind === "income" &&
    transaction.paymentMethod === "card"
  ) {
    extra.push(validRate(transaction.posRate));
    extra.push(filled(transaction.settlementDate));
  }

  const checks = [...common, ...extra];
  return checks.filter(Boolean).length / checks.length;
}

function recordCompleteness(record) {
  const checks = [
    filled(record.id),
    filled(record.counterparty),
    filled(record.detail),
    filled(record.createdDate),
    filled(record.dueDate),
    nonNegativeOr(record.originalAmount, 0) > 0,
    Array.isArray(record.payments),
  ];
  return checks.filter(Boolean).length / checks.length;
}

export function assessDataQuality({
  transactions,
  records,
  inventory,
  today,
  balancesPresent,
}) {
  const active = transactions.filter(
    (transaction) => transaction.status !== "cancelled",
  );
  const transactionCompleteness =
    active.length > 0
      ? active.reduce((sum, row) => sum + rowCompleteness(row), 0) /
        active.length
      : 0;

  const directExpenses = active.filter(
    (transaction) =>
      transaction.kind === "expense" &&
      hasEconomicEffect(transaction) &&
      !isAutomaticPos(transaction),
  );
  const directExpenseAmount = directExpenses.reduce(
    (sum, row) => sum + nonNegativeOr(row.amount, 0),
    0,
  );
  const documentedExpenseAmount = directExpenses
    .filter(isRecognizedExpense)
    .reduce((sum, row) => sum + nonNegativeOr(row.amount, 0), 0);
  const documentCoverage =
    directExpenseAmount > MONEY_EPSILON
      ? documentedExpenseAmount / directExpenseAmount
      : active.length > 0
        ? 1
        : 0;

  const cardIncome = active.filter(
    (transaction) =>
      transaction.kind === "income" && transaction.paymentMethod === "card",
  );
  const cardGross = cardIncome.reduce(
    (sum, row) => sum + nonNegativeOr(row.amount, 0),
    0,
  );
  const settledCardGross = cardIncome
    .filter((row) => row.posStatus === "settled")
    .reduce((sum, row) => sum + nonNegativeOr(row.amount, 0), 0);
  const reconciliationCoverage =
    cardGross > MONEY_EPSILON ? settledCardGross / cardGross : active.length ? 1 : 0;

  const linkedDirectCostIncomeIds = new Set(
    active
      .filter(
        (transaction) =>
          transaction.kind === "expense" &&
          hasEconomicEffect(transaction) &&
          transaction.operationType !== "pos_commission" &&
          (transaction.relatedIncomeId || transaction.sourceTransactionId),
      )
      .map(
        (transaction) =>
          transaction.relatedIncomeId || transaction.sourceTransactionId,
      ),
  );
  const incomeRows = active.filter(
    (transaction) =>
      transaction.kind === "income" && hasEconomicEffect(transaction),
  );
  const totalIncome = incomeRows.reduce(
    (sum, row) => sum + nonNegativeOr(row.amount, 0),
    0,
  );
  const costLinkedIncome = incomeRows
    .filter((row) => linkedDirectCostIncomeIds.has(row.id))
    .reduce((sum, row) => sum + nonNegativeOr(row.amount, 0), 0);
  const directCostCoverage =
    totalIncome > MONEY_EPSILON ? costLinkedIncome / totalIncome : 0;

  const inventoryRelevant = active.some(
    (row) =>
      row.operationType === "inventory_purchase" ||
      row.operationType === "product_sale",
  );
  const inventoryCostCoverage =
    inventory.length > 0
      ? inventory.filter(
          (item) =>
            nonNegativeOr(item.unitCost, 0) > 0 &&
            nonNegativeOr(item.unitsPerPackage, 1) > 0,
        ).length / inventory.length
      : inventoryRelevant
        ? 0
        : 1;

  const payableRows = records.filter((record) => record.type === "payable");
  const debtCompleteness =
    payableRows.length > 0
      ? payableRows.reduce((sum, row) => sum + recordCompleteness(row), 0) /
        payableRows.length
      : 0;

  const dated = active
    .map((transaction) => transaction.date)
    .filter((date) => date <= today)
    .sort();
  const periodDays =
    dated.length > 0 ? inclusiveDays(dated[0], dated.at(-1)) : 0;
  const periodSufficiency = Math.min(1, periodDays / 180);

  const components = {
    transactionCompleteness,
    documentCoverage,
    reconciliationCoverage,
    directCostCoverage,
    inventoryCostCoverage,
    debtCompleteness,
    periodSufficiency,
  };
  const weights = {
    transactionCompleteness: 0.25,
    documentCoverage: 0.15,
    reconciliationCoverage: 0.1,
    directCostCoverage: 0.2,
    inventoryCostCoverage: 0.1,
    debtCompleteness: 0.1,
    periodSufficiency: 0.1,
  };
  const score = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + components[key] * weight,
    0,
  );

  const blockers = [];
  if (active.length === 0) {
    blockers.push("Gerçek işlem kaydı yok.");
  } else {
    if (transactionCompleteness < 0.85) {
      blockers.push("Zorunlu işlem alanlarının bir bölümü eksik.");
    }
    if (documentCoverage < 0.8) {
      blockers.push("Gider belge kapsaması %80'in altında.");
    }
    if (reconciliationCoverage < 0.8) {
      blockers.push("POS/banka yatışlarının en az %80'i mutabık değil.");
    }
    if (directCostCoverage < 0.7) {
      blockers.push("Hizmet ve ürün gelirlerinin doğrudan maliyetleri bağlı değil.");
    }
    if (periodDays < 180) {
      blockers.push("Güvenilir yıllık tahmin için en az 6 aylık seri yok.");
    }
  }
  if (payableRows.length === 0) {
    blockers.push("Mevcut borç ödeme planı sisteme girilmemiş.");
  }
  if (!balancesPresent) {
    blockers.push("Fiili kasa ve banka bakiyesi girilmemiş.");
  }

  return {
    score: Math.round(score * 100),
    level: score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low",
    components,
    periodDays,
    transactionCount: active.length,
    blockers,
    cashReady:
      balancesPresent &&
      periodDays >= 28 &&
      transactionCompleteness >= 0.8 &&
      documentCoverage >= 0.7,
    taxReady:
      transactionCompleteness >= 0.85 && documentCoverage >= 0.9,
    profitReady:
      documentCoverage >= 0.9 &&
      directCostCoverage >= 0.7 &&
      inventoryCostCoverage >= 0.8,
    forecastReady:
      periodDays >= 180 &&
      transactionCompleteness >= 0.85 &&
      reconciliationCoverage >= 0.8,
    borrowingReady:
      balancesPresent &&
      periodDays >= 90 &&
      transactionCompleteness >= 0.85 &&
      documentCoverage >= 0.85 &&
      directCostCoverage >= 0.7 &&
      debtCompleteness >= 0.9,
  };
}

export function estimateTaxReserve({ period, settings }) {
  const vat = vatSettlement({
    outputVat: period.outputVat,
    deductibleInputVat: period.deductibleInputVat,
    priorCarryForward: settings.priorVatCarryForward,
  });
  const commercialProfitProxy = period.operatingProfitProxy;
  const taxableBase = Math.max(
    0,
    commercialProfitProxy +
      settings.nonDeductibleExpenseAdjustment -
      settings.lossCarryforward -
      settings.approvedTaxDeductions,
  );
  const normalCorporateTax = taxableBase * settings.corporateTaxRate;
  const minimumTaxBase = Math.max(
    0,
    commercialProfitProxy +
      settings.nonDeductibleExpenseAdjustment -
      settings.approvedTaxDeductions,
  );
  const minimumCorporateTax = settings.minimumCorporateTaxApplies
    ? minimumTaxBase * settings.minimumCorporateTaxRate
    : 0;
  const corporateTaxReserve = Math.max(
    normalCorporateTax,
    minimumCorporateTax,
  );

  let rentGrossBase = 0;
  let rentWithholding = 0;
  if (
    period.rentPaid > MONEY_EPSILON &&
    settings.rentContractBasis !== "not_applicable" &&
    settings.rentLandlordType === "individual"
  ) {
    if (settings.rentContractBasis === "net") {
      rentGrossBase =
        period.rentPaid / (1 - settings.rentWithholdingRate);
      rentWithholding = rentGrossBase - period.rentPaid;
    } else {
      rentGrossBase = period.rentPaid;
      rentWithholding = rentGrossBase * settings.rentWithholdingRate;
    }
  }

  const recordedAndAdditionalPaid =
    period.taxCashPayments + settings.additionalTaxesPaid;
  const grossReserve =
    vat.payableVat +
    corporateTaxReserve +
    rentWithholding +
    settings.otherTaxReserve;
  const remainingReserve = Math.max(
    0,
    grossReserve - recordedAndAdditionalPaid,
  );

  const warnings = [
    "Bu tutar yönetim tahminidir; beyanname veya mali müşavir hesabı değildir.",
  ];
  if (settings.rentContractBasis === "not_applicable") {
    warnings.push("Kira stopaj kapsamı seçilmedi; stopaj rezervi sıfır tutuldu.");
  }
  if (settings.rentLandlordType === "unknown") {
    warnings.push(
      "Kiraya veren türü doğrulanmadı; kira stopajı otomatik hesaplanmadı.",
    );
  }
  if (!settings.taxRuleEffectiveDate || !settings.taxRuleSource) {
    warnings.push(
      "Vergi oranlarının yürürlük tarihi ve doğrulama kaynağı eksik; oranlar karar kapısı olarak kabul edilmez.",
    );
  }
  if (settings.nonDeductibleExpenseAdjustment === 0) {
    warnings.push("KKEG düzeltmesi girilmedi.");
  }

  return {
    vat,
    commercialProfitProxy: roundMoney(commercialProfitProxy),
    taxableBase: roundMoney(taxableBase),
    normalCorporateTax: roundMoney(normalCorporateTax),
    minimumTaxBase: roundMoney(minimumTaxBase),
    minimumCorporateTax: roundMoney(minimumCorporateTax),
    corporateTaxReserve: roundMoney(corporateTaxReserve),
    rentGrossBase: roundMoney(rentGrossBase),
    rentWithholding: roundMoney(rentWithholding),
    otherTaxReserve: roundMoney(settings.otherTaxReserve),
    recordedAndAdditionalPaid: roundMoney(recordedAndAdditionalPaid),
    grossReserve: roundMoney(grossReserve),
    remainingReserve: roundMoney(remainingReserve),
    warnings,
  };
}

function remainingRecordAmount(record) {
  return paymentPosition(record.originalAmount, record.payments ?? []).remaining;
}

function payablePosition(records, today, horizonDays) {
  const endDate = addDays(today, horizonDays);
  const rows = records
    .filter(
      (record) =>
        record.type === "payable" &&
        record.dueDate <= endDate &&
        remainingRecordAmount(record) > MONEY_EPSILON,
    )
    .map((record) => {
      const remaining = remainingRecordAmount(record);
      const reserve = Math.min(
        remaining,
        nonNegativeOr(record.reserve, 0),
      );
      return {
        id: record.id,
        counterparty: record.counterparty,
        dueDate: record.dueDate,
        remaining,
        reserve,
        unfunded: roundMoney(Math.max(0, remaining - reserve)),
      };
    });

  return {
    rows,
    remaining: roundMoney(rows.reduce((sum, row) => sum + row.remaining, 0)),
    reserve: roundMoney(rows.reduce((sum, row) => sum + row.reserve, 0)),
    unfunded: roundMoney(rows.reduce((sum, row) => sum + row.unfunded, 0)),
  };
}

function recurringForWeek({
  recurringRules,
  recurringOccurrences,
  startDate,
  endDate,
}) {
  const ruleMap = new Map(recurringRules.map((rule) => [rule.id, rule]));
  return roundMoney(
    recurringOccurrences
      .filter(
        (occurrence) =>
          occurrence.status !== "paid" &&
          inRange(occurrence.dueDate, startDate, endDate),
      )
      .reduce((sum, occurrence) => {
        const rule = ruleMap.get(occurrence.ruleId);
        if (rule && rule.active === false) return sum;
        return sum + nonNegativeOr(occurrence.expectedAmount, 0);
      }, 0),
  );
}

export function buildThirteenWeekForecast({
  transactions,
  records,
  recurringRules,
  recurringOccurrences,
  today,
  settings,
  tax,
}) {
  const trailingStart = addDays(today, -89);
  const trailing = managementPeriod({
    transactions,
    startDate: trailingStart,
    endDate: today,
  });
  const observedWeeks = Math.max(
    1,
    Math.min(13, trailing.observedSpanDays / 7),
  );
  const weeklyIncome = trailing.grossSales / observedWeeks;
  const weeklyVariableOutflow =
    (trailing.variableOperatingExpenseGross +
      trailing.inventoryPurchaseCash +
      trailing.undocumentedOutflow) /
    observedWeeks;
  const weeklyFixedHistory =
    trailing.fixedOperatingExpenseGross / observedWeeks;
  const payable = payablePosition(records, today, 91);
  const liquidity =
    (settings.cashBalance ?? 0) + (settings.bankBalance ?? 0);
  const taxWeekly = tax.remainingReserve / 13;

  let baseBalance = liquidity;
  let stressBalance = liquidity;
  let minimumBaseBalance = liquidity;
  let minimumStressBalance = liquidity;
  let totalScheduledRecurring = 0;
  let totalFixedOutflow = 0;
  const weeks = [];

  for (let index = 0; index < 13; index += 1) {
    const startDate = addDays(today, index * 7);
    const endDate = addDays(startDate, 6);
    const scheduledRecurring = recurringForWeek({
      recurringRules,
      recurringOccurrences,
      startDate,
      endDate,
    });
    totalScheduledRecurring += scheduledRecurring;
    const debtDue = payable.rows
      .filter((row) => inRange(row.dueDate, startDate, endDate))
      .reduce((sum, row) => sum + row.unfunded, 0);
    // A partial recurring-expense plan must never erase the historical fixed-cost baseline.
    // Use the larger of the verified historical run-rate and the explicitly scheduled amount.
    const fixedOutflow = Math.max(scheduledRecurring, weeklyFixedHistory);
    totalFixedOutflow += fixedOutflow;
    const baseOutflow =
      weeklyVariableOutflow + fixedOutflow + taxWeekly + debtDue;
    const stressInflow =
      weeklyIncome * (1 - settings.stressRevenueDropRate);
    const stressOutflow =
      weeklyVariableOutflow * (1 + settings.stressCostIncreaseRate) +
      fixedOutflow +
      taxWeekly +
      debtDue;

    baseBalance += weeklyIncome - baseOutflow;
    stressBalance += stressInflow - stressOutflow;
    minimumBaseBalance = Math.min(minimumBaseBalance, baseBalance);
    minimumStressBalance = Math.min(minimumStressBalance, stressBalance);
    weeks.push({
      week: index + 1,
      startDate,
      endDate,
      baseInflow: roundMoney(weeklyIncome),
      baseOutflow: roundMoney(baseOutflow),
      recurring: roundMoney(scheduledRecurring),
      debtDue: roundMoney(debtDue),
      baseEnding: roundMoney(baseBalance),
      stressEnding: roundMoney(stressBalance),
    });
  }

  const operatingReserve13Weeks =
    weeklyVariableOutflow * 13 + totalFixedOutflow;
  const restrictedCash =
    tax.remainingReserve +
    operatingReserve13Weeks +
    payable.unfunded +
    settings.approvedCapex +
    settings.emergencyCapexReserve;
  const distributableCash = Math.max(0, liquidity - restrictedCash);

  return {
    trailing,
    observedWeeks,
    weeklyIncome: roundMoney(weeklyIncome),
    weeklyVariableOutflow: roundMoney(weeklyVariableOutflow),
    weeklyFixedHistory: roundMoney(weeklyFixedHistory),
    liquidity: roundMoney(liquidity),
    taxReserve: roundMoney(tax.remainingReserve),
    payable,
    operatingReserve13Weeks: roundMoney(operatingReserve13Weeks),
    scheduledRecurring13Weeks: roundMoney(totalScheduledRecurring),
    fixedOutflow13Weeks: roundMoney(totalFixedOutflow),
    approvedCapex: roundMoney(settings.approvedCapex),
    emergencyCapexReserve: roundMoney(settings.emergencyCapexReserve),
    restrictedCash: roundMoney(restrictedCash),
    distributableCash: roundMoney(distributableCash),
    shortfall: roundMoney(Math.max(0, restrictedCash - liquidity)),
    minimumBaseBalance: roundMoney(minimumBaseBalance),
    minimumStressBalance: roundMoney(minimumStressBalance),
    baseEndingBalance: roundMoney(baseBalance),
    stressEndingBalance: roundMoney(stressBalance),
    weeks,
  };
}

export function evaluateBorrowing({
  forecast,
  records,
  settings,
  quality,
  today,
}) {
  const monthlyIncome = forecast.weeklyIncome * WEEKS_PER_MONTH;
  const monthlyOperatingOutflow =
    (forecast.weeklyVariableOutflow + forecast.weeklyFixedHistory) *
    WEEKS_PER_MONTH;
  const monthlyTaxProvision = forecast.taxReserve / 12;
  const baseFcads = Math.max(
    0,
    monthlyIncome -
      monthlyOperatingOutflow -
      monthlyTaxProvision -
      settings.approvedCapex / 12,
  );
  const stressFcads = Math.max(
    0,
    monthlyIncome * (1 - settings.stressRevenueDropRate) -
      monthlyOperatingOutflow * (1 + settings.stressCostIncreaseRate) -
      monthlyTaxProvision -
      settings.approvedCapex / 12,
  );
  // Trade payables are not loan instalments. A DSCR decision is only allowed
  // when the user explicitly enters the verified monthly loan/lease service.
  const debtServiceConfigured = settings.monthlyDebtServiceOverride !== null;
  const existingMonthlyDebtService = debtServiceConfigured
    ? settings.monthlyDebtServiceOverride
    : 0;
  const rateKnown = settings.loanMonthlyRate !== null;
  const capacity = borrowingCapacity({
    baseCashAvailableForDebtService: baseFcads,
    stressedCashAvailableForDebtService: stressFcads,
    existingMonthlyDebtService,
    monthlyRate: settings.loanMonthlyRate ?? 0,
    termMonths: settings.loanTermMonths,
    minimumBaseDscr: settings.minimumBaseDscr,
    minimumStressDscr: settings.minimumStressDscr,
  });

  let status = "red";
  let label = "Yeni borç kapalı";
  let reason = "Gerekli veri kapıları tamamlanmadı.";
  if (!debtServiceConfigured) {
    status = "yellow";
    label = "Mevcut kredi taksiti bekleniyor";
    reason =
      "Ticari borçlar kredi taksiti sayılmaz. Banka/kredi/finansal kiralama için doğrulanmış aylık toplam taksiti girin.";
  } else if (quality.borrowingReady && rateKnown && capacity.signal === "eligible") {
    status = capacity.additionalMonthlyPayment > 0 ? "green" : "red";
    label =
      status === "green" ? "Sınırlı borçlanma mümkün" : "Yeni borç kapalı";
    reason =
      status === "green"
        ? "Baz ve stres DSCR sınırları geçildi."
        : "Stres senaryosunda ek taksit kapasitesi oluşmadı.";
  } else if (quality.borrowingReady && !rateKnown) {
    status = "yellow";
    label = "Faiz ve masraf oranı bekleniyor";
    reason = "Aylık kredi maliyeti girilmeden anapara üst limiti verilmez.";
  }

  return {
    ...capacity,
    baseFcads: roundMoney(baseFcads),
    stressFcads: roundMoney(stressFcads),
    existingMonthlyDebtService: roundMoney(existingMonthlyDebtService),
    derivedDebtService: null,
    debtServiceConfigured,
    usedDebtServiceOverride: debtServiceConfigured,
    rateKnown,
    status,
    label,
    reason,
  };
}

function yearBounds(today) {
  const year = parseDate(today).getUTCFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    year,
  };
}

export function evaluateTarget({
  transactions,
  today,
  settings,
  quality,
}) {
  const bounds = yearBounds(today);
  const ytd = managementPeriod({
    transactions,
    startDate: bounds.startDate,
    endDate: today,
  });
  const elapsedDays = inclusiveDays(bounds.startDate, today);
  const yearDays = inclusiveDays(bounds.startDate, bounds.endDate);
  const elapsedWeight = elapsedDays / yearDays;
  const annualForecast =
    elapsedWeight > 0 ? ytd.netSales / elapsedWeight : 0;
  const annualTarget = settings.annualNetSalesTarget;
  const targetConfigured =
    annualTarget !== null && annualTarget > MONEY_EPSILON;
  const targetToDate = targetConfigured
    ? annualTarget * elapsedWeight
    : null;
  const variance =
    targetToDate === null ? null : ytd.netSales - targetToDate;
  const remainingTarget =
    annualTarget === null ? null : Math.max(0, annualTarget - ytd.netSales);
  const remainingDays = Math.max(0, yearDays - elapsedDays);
  const requiredDailyPace =
    remainingTarget === null
      ? null
      : remainingTarget === 0
        ? 0
        : remainingDays > 0
          ? remainingTarget / remainingDays
          : null;
  const suggestedNextYearTarget =
    quality.forecastReady && annualForecast > MONEY_EPSILON
      ? annualForecast *
        (1 + settings.inflationAssumption) *
        (1 + settings.realGrowthTarget)
      : null;

  let status = "red";
  let label = "Hedef kararı kapalı";
  if (!targetConfigured) {
    label = "Yıllık net satış hedefi girilmedi";
  } else if (!quality.forecastReady) {
    label = "Hedef var; tahmin güveni düşük";
    status = "yellow";
  } else if (variance !== null && variance >= 0) {
    label = "Hedef temposunun önünde";
    status = "green";
  } else {
    label = "Hedef temposunun gerisinde";
    status = "red";
  }

  return {
    year: bounds.year,
    ytdNetSales: ytd.netSales,
    annualTarget,
    targetConfigured,
    elapsedWeight,
    targetToDate:
      targetToDate === null ? null : roundMoney(targetToDate),
    variance: variance === null ? null : roundMoney(variance),
    remainingTarget:
      remainingTarget === null ? null : roundMoney(remainingTarget),
    requiredDailyPace:
      requiredDailyPace === null ? null : roundMoney(requiredDailyPace),
    annualForecast: roundMoney(annualForecast),
    suggestedNextYearTarget:
      suggestedNextYearTarget === null
        ? null
        : roundMoney(suggestedNextYearTarget),
    status,
    label,
  };
}

export function evaluatePurchase({
  settings,
  forecast,
  borrowing,
  quality,
}) {
  const amount = settings.plannedPurchaseAmount;
  if (amount <= MONEY_EPSILON) {
    return {
      configured: false,
      status: "neutral",
      label: "Alım senaryosu girilmedi",
      reason: "Tutar girildiğinde nakit, stres ve geri ödeme kapıları çalışır.",
      paybackMonths: null,
      cashLimit: roundMoney(forecast.distributableCash),
      checks: [],
    };
  }

  const paybackMonths =
    settings.plannedPurchaseMonthlyContribution > MONEY_EPSILON
      ? amount / settings.plannedPurchaseMonthlyContribution
      : null;
  const checks = [
    {
      key: "data",
      label: "Veri güveni",
      pass: quality.cashReady && quality.profitReady,
    },
    {
      key: "cash",
      label: "Rezerv sonrası nakit",
      pass: amount <= forecast.distributableCash + MONEY_EPSILON,
    },
    {
      key: "stress",
      label: "13 haftalık stres nakdi",
      pass: forecast.minimumStressBalance - amount >= -MONEY_EPSILON,
    },
    {
      key: "payback",
      label: "Geri ödeme süresi",
      pass:
        paybackMonths !== null &&
        paybackMonths <= settings.maxPaybackMonths,
    },
    {
      key: "debt",
      label: "Borç servis güvenliği",
      pass:
        borrowing.existingMonthlyDebtService <= MONEY_EPSILON ||
        (borrowing.baseDscr !== null &&
          borrowing.baseDscr >= settings.minimumBaseDscr),
    },
  ];
  const pass = checks.every((check) => check.pass);

  return {
    configured: true,
    status: pass ? "green" : "red",
    label: pass ? "Alım yapılabilir" : "Alım yapılmamalı",
    reason: pass
      ? "Nakit, stres, geri ödeme ve borç kapılarının tamamı geçti."
      : `${checks.filter((check) => !check.pass).length} zorunlu kapı geçilemedi.`,
    paybackMonths:
      paybackMonths === null ? null : Math.round(paybackMonths * 10) / 10,
    cashLimit: roundMoney(forecast.distributableCash),
    checks,
  };
}

export function evaluateOwnerTransfer({
  settings,
  forecast,
  quality,
  period,
}) {
  const legalTypeSelected = settings.ownerTransferType !== "none";
  const afterTaxProfitProxy = Math.max(
    0,
    period.operatingProfitProxy - forecast.taxReserve,
  );
  const maximumByCash = Math.max(0, forecast.distributableCash);
  const safeTransfer = Math.min(
    settings.monthlyHomeNeed,
    maximumByCash,
    afterTaxProfitProxy,
  );
  const canPlan =
    legalTypeSelected &&
    quality.cashReady &&
    quality.profitReady &&
    safeTransfer > MONEY_EPSILON;
  const fullNeedMet =
    canPlan && safeTransfer + MONEY_EPSILON >= settings.monthlyHomeNeed;

  return {
    status: fullNeedMet ? "green" : canPlan ? "yellow" : "red",
    label: fullNeedMet
      ? "Ev bütçesi güvenle planlanabilir"
      : canPlan
        ? "Ev bütçesi kısmen planlanabilir"
        : "Şirketten kişisel transfer kapalı",
    safeTransfer: roundMoney(canPlan ? safeTransfer : 0),
    shortfall: roundMoney(
      Math.max(0, settings.monthlyHomeNeed - (canPlan ? safeTransfer : 0)),
    ),
    legalTypeSelected,
    reason: !legalTypeSelected
      ? "Ücret, temettü veya masraf iadesi türü seçilmedi."
      : !quality.profitReady
        ? "Gerçek kârı doğrulayacak maliyet verisi eksik."
        : !quality.cashReady
          ? "Fiili likidite ve 13 haftalık nakit güveni yetersiz."
          : fullNeedMet
            ? "Vergi, borç ve işletme rezervlerinden sonra ihtiyaç karşılanıyor."
            : "Rezervlerden sonra 70.000 TL'nin tamamı güvenle ayrılamıyor.",
  };
}

function decisionCard(id, status, title, value, why, action) {
  return { id, status, title, value, why, action };
}

export function buildDecisionEngine({
  transactions,
  records,
  inventory,
  recurringRules = [],
  recurringOccurrences = [],
  settings: rawSettings,
  today,
}) {
  const settings = normalizeDecisionSettings(rawSettings);
  const bounds = yearBounds(today);
  const period = managementPeriod({
    transactions,
    startDate: bounds.startDate,
    endDate: today,
  });
  const balancesPresent =
    settings.cashBalance !== null && settings.bankBalance !== null;
  const quality = assessDataQuality({
    transactions,
    records,
    inventory,
    today,
    balancesPresent,
  });
  const taxRuleDocumented = Boolean(
    settings.taxRuleEffectiveDate && settings.taxRuleSource,
  );
  const rentRuleVerified =
    period.rentPaid <= MONEY_EPSILON ||
    settings.rentLandlordType !== "unknown";
  quality.taxReady = quality.taxReady && taxRuleDocumented && rentRuleVerified;
  if (!taxRuleDocumented) {
    quality.blockers.push(
      "Vergi oranı yürürlük tarihi ve mali müşavir teyit notu eksik.",
    );
  }
  if (!rentRuleVerified) {
    quality.blockers.push("Kiraya veren türü doğrulanmadı.");
  }
  const tax = estimateTaxReserve({ period, settings });
  const forecast = buildThirteenWeekForecast({
    transactions,
    records,
    recurringRules,
    recurringOccurrences,
    today,
    settings,
    tax,
  });
  const borrowing = evaluateBorrowing({
    forecast,
    records,
    settings,
    quality,
    today,
  });
  const target = evaluateTarget({
    transactions,
    today,
    settings,
    quality,
  });
  const purchase = evaluatePurchase({
    settings,
    forecast,
    borrowing,
    quality,
  });
  const ownerTransfer = evaluateOwnerTransfer({
    settings,
    forecast,
    quality,
    period,
  });

  const cashStatus = !quality.cashReady
    ? "red"
    : forecast.shortfall > MONEY_EPSILON ||
        forecast.minimumStressBalance < -MONEY_EPSILON
      ? "red"
      : forecast.distributableCash > MONEY_EPSILON
        ? "green"
        : "yellow";
  const taxStatus = quality.taxReady ? "yellow" : "red";
  const cards = [
    decisionCard(
      "cash",
      cashStatus,
      "Likidite ve 13 hafta",
      quality.cashReady
        ? forecast.shortfall > MONEY_EPSILON
          ? `${roundMoney(forecast.shortfall)} TL açık`
          : `${roundMoney(forecast.distributableCash)} TL serbest`
        : "Hesaplanamaz",
      !quality.cashReady
        ? "Bakiye veya en az 28 günlük güvenilir hareket serisi eksik."
        : forecast.shortfall > MONEY_EPSILON
          ? "Vergi, borç ve işletme rezervleri mevcut likiditeyi aşıyor."
          : "Kullanılabilir nakit tüm kısıtlı rezervler düşüldükten sonra hesaplandı.",
      !balancesPresent
        ? "Fiili kasa ve banka bakiyesini gir."
        : quality.periodDays < 28
          ? "En az 28 gün kesintisiz kayıt tamamla."
          : forecast.shortfall > MONEY_EPSILON
            ? "Yeni harcamayı durdur ve rezerv açığını kapat."
            : "Rezerv seviyesini haftalık koru.",
    ),
    decisionCard(
      "tax",
      taxStatus,
      "Vergi rezervi",
      `${tax.remainingReserve} TL`,
      quality.taxReady
        ? "KDV, kurumlar vergisi vekili, kira stopajı ve girilen diğer yükler birlikte tutuldu."
        : "Tutar hesaplanıyor fakat belge/KKEG eksikleri nedeniyle kesin karar sayılmaz.",
      quality.taxReady
        ? "Mali müşavir mutabakatından sonra rezervi kilitle."
        : quality.components.documentCoverage < 0.9
          ? "Gider belge kapsamasını en az %90'a çıkar."
          : "KKEG ve mahsup alanlarını tamamla.",
    ),
    decisionCard(
      "debt",
      borrowing.status,
      "Yeni borçlanma",
      borrowing.status === "green"
        ? `${borrowing.additionalMonthlyPayment} TL/ay üst sınır`
        : "Kapalı",
      borrowing.reason,
      borrowing.status === "green"
        ? "Yalnız bu taksit sınırının altında teklif karşılaştır."
        : !quality.borrowingReady
          ? "Borç planı ve doğrudan maliyetleri tamamla."
          : "Faiz, ücret ve vadeyi gir; stres testini yeniden çalıştır.",
    ),
    decisionCard(
      "purchase",
      purchase.status,
      "Yeni alım",
      purchase.configured
        ? purchase.label
        : `${purchase.cashLimit} TL nakit limiti`,
      purchase.reason,
      purchase.configured
        ? purchase.status === "green"
          ? "Onay öncesi teklif ve nakit akışını kaydet."
          : "Başarısız kapıları düzeltmeden alım yapma."
        : "Alım tutarı ve aylık net katkıyı gir.",
    ),
    decisionCard(
      "owner",
      ownerTransfer.status,
      "Ev bütçesi",
      `${ownerTransfer.safeTransfer} TL/ay güvenli`,
      ownerTransfer.reason,
      ownerTransfer.status === "green"
        ? "Yasal transfer türünü muhasebe kaydıyla uygula."
        : "Şirket kasasından kontrolsüz çekiş yapma.",
    ),
    decisionCard(
      "target",
      target.status,
      `${target.year} hedef temposu`,
      target.label,
      target.targetConfigured
        ? `YTD net satış ${target.ytdNetSales} TL; doğrusal yıllıklandırılmış taslak ${target.annualForecast} TL (mevsimsellik içermez).`
        : "Yıllık hedef tanımlanmadı; sistem kendiliğinden hedef üretmez.",
      !target.targetConfigured
        ? "KDV hariç yıllık satış hedefini kilitle."
        : !quality.forecastReady
          ? "En az 6 aylık kaliteli seri tamamla."
          : target.status === "red"
            ? "Kalan gün başına gerekli net satışı günlük plana çevir."
            : "Mevcut tempoyu koru.",
    ),
  ];

  const priority =
    cards.find((card) => card.status === "red") ??
    cards.find((card) => card.status === "yellow") ??
    cards[0];
  const overallStatus = cards.some((card) => card.status === "red")
    ? "red"
    : cards.some((card) => card.status === "yellow")
      ? "yellow"
      : "green";

  return {
    settings,
    period,
    quality,
    tax,
    forecast,
    borrowing,
    target,
    purchase,
    ownerTransfer,
    cards,
    priority,
    overallStatus,
  };
}
