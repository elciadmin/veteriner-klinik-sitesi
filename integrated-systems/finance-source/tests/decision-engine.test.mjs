import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DECISION_SETTINGS,
  assessDataQuality,
  buildDecisionEngine,
  buildThirteenWeekForecast,
  estimateTaxReserve,
  evaluateBorrowing,
  evaluateOwnerTransfer,
  evaluatePurchase,
  evaluateTarget,
  managementPeriod,
  normalizeDecisionSettings,
} from "../lib/decision-engine.mjs";

const TODAY = "2026-07-25";

function income(overrides = {}) {
  return {
    id: `income-${Math.random()}`,
    date: "2026-07-20",
    time: "12:00",
    kind: "income",
    category: "Muayene",
    description: "Muayene",
    counterparty: "Hasta sahibi",
    operationType: "service",
    costBehavior: "non_expense",
    amount: 1_200,
    paymentMethod: "cash",
    documentType: "receipt",
    documentRef: "F-1",
    vatRate: 0.2,
    ...overrides,
  };
}

function expense(overrides = {}) {
  return {
    id: `expense-${Math.random()}`,
    date: "2026-07-20",
    time: "13:00",
    kind: "expense",
    category: "Muhasebe",
    description: "Aylık muhasebe",
    counterparty: "Mali müşavir",
    operationType: "overhead",
    costBehavior: "fixed",
    amount: 1_200,
    paymentMethod: "transfer",
    documentType: "invoice",
    documentRef: "G-1",
    vatRate: 0.2,
    ...overrides,
  };
}

function payable(overrides = {}) {
  return {
    id: `payable-${Math.random()}`,
    type: "payable",
    counterparty: "Hasvet",
    detail: "Tedarik borcu",
    createdDate: "2026-01-01",
    dueDate: "2026-08-15",
    originalAmount: 120_000,
    reserve: 20_000,
    payments: [],
    ...overrides,
  };
}

function highQualityRows() {
  const rows = [];
  for (let month = 1; month <= 7; month += 1) {
    const date = `2026-${String(month).padStart(2, "0")}-15`;
    const revenue = income({
      id: `rev-${month}`,
      date,
      paymentMethod: month % 2 ? "cash" : "card",
      posRate: month % 2 ? 0 : 0.02,
      posStatus: month % 2 ? undefined : "settled",
      settlementDate: month % 2 ? undefined : date,
      amount: 120_000,
    });
    rows.push(revenue);
    rows.push(
      expense({
        id: `cost-${month}`,
        date,
        amount: 30_000,
        category: "İlaç ve sarf",
        costBehavior: "variable",
        relatedIncomeId: revenue.id,
      }),
    );
  }
  return rows;
}

test("karar ayarları eksik bakiyeyi sıfıra çevirmeden null tutar", () => {
  const settings = normalizeDecisionSettings({});
  assert.equal(settings.cashBalance, null);
  assert.equal(settings.bankBalance, null);
});

test("geçersiz oranlar güvenli varsayılana döner", () => {
  const settings = normalizeDecisionSettings({
    corporateTaxRate: 5,
    stressRevenueDropRate: -1,
  });
  assert.equal(
    settings.corporateTaxRate,
    DEFAULT_DECISION_SETTINGS.corporateTaxRate,
  );
  assert.equal(
    settings.stressRevenueDropRate,
    DEFAULT_DECISION_SETTINGS.stressRevenueDropRate,
  );
});

test("negatif nakit bakiyesi kabul edilmez", () => {
  const settings = normalizeDecisionSettings({ cashBalance: -1 });
  assert.equal(settings.cashBalance, null);
});

test("KDV dahil gelir net satış ve KDV olarak ayrılır", () => {
  const result = managementPeriod({
    transactions: [income()],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  assert.equal(result.grossSales, 1_200);
  assert.equal(result.outputVat, 200);
  assert.equal(result.netSales, 1_000);
});

test("belgeli gider net gider ve indirilecek KDV üretir", () => {
  const result = managementPeriod({
    transactions: [expense()],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  assert.equal(result.recognizedExpenseGross, 1_200);
  assert.equal(result.deductibleInputVat, 200);
  assert.equal(result.operatingExpenseNet, 1_000);
});

test("belgesiz gider kâr gideri değil nakit riski olarak tutulur", () => {
  const result = managementPeriod({
    transactions: [
      income(),
      expense({ documentType: "none", documentRef: "" }),
    ],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  assert.equal(result.recognizedExpenseGross, 0);
  assert.equal(result.undocumentedOutflow, 1_200);
  assert.equal(result.operatingProfitProxy, 1_000);
  assert.equal(result.totalCashMovement, 0);
});

test("stok alımı kâr giderine değil nakit çıkışına ayrılır", () => {
  const result = managementPeriod({
    transactions: [
      expense({
        operationType: "inventory_purchase",
        category: "Mama / stok alımı",
      }),
    ],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  assert.equal(result.inventoryPurchaseCash, 1_200);
  assert.equal(result.operatingExpenseNet, 0);
  assert.equal(result.operatingCashOutflow, 1_200);
});

test("vergi ödemesi faaliyet giderine karıştırılmaz", () => {
  const result = managementPeriod({
    transactions: [expense({ operationType: "tax", vatRate: 0 })],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  assert.equal(result.taxCashPayments, 1_200);
  assert.equal(result.operatingExpenseNet, 0);
});

test("işletme sahibi çekimi kâra değil nakit hareketine yansır", () => {
  const result = managementPeriod({
    transactions: [
      {
        ...expense(),
        kind: "withdrawal",
        operationType: "owner_withdrawal",
        paymentMethod: "cash",
        documentType: "none",
        documentRef: "",
      },
    ],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  assert.equal(result.ownerWithdrawals, 1_200);
  assert.equal(result.operatingExpenseNet, 0);
  assert.equal(result.totalCashMovement, -1_200);
});

test("POS bekleyen tutar komisyon düşülerek bulunur", () => {
  const result = managementPeriod({
    transactions: [
      income({
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "pending",
      }),
    ],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  assert.equal(result.posPending, 1_176);
});

test("ödendi olarak işaretli POS mutabakat kapsamına girer", () => {
  const quality = assessDataQuality({
    transactions: [
      income({
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "settled",
        settlementDate: "2026-07-22",
      }),
    ],
    records: [payable()],
    inventory: [],
    today: TODAY,
    balancesPresent: true,
  });
  assert.equal(quality.components.reconciliationCoverage, 1);
});

test("bekleyen POS mutabakat güvenini sıfıra indirir", () => {
  const quality = assessDataQuality({
    transactions: [
      income({
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "pending",
        settlementDate: "2026-07-22",
      }),
    ],
    records: [payable()],
    inventory: [],
    today: TODAY,
    balancesPresent: true,
  });
  assert.equal(quality.components.reconciliationCoverage, 0);
});

test("bağlı doğrudan maliyet maliyet kapsamasını yükseltir", () => {
  const revenue = income({ id: "rev-1" });
  const quality = assessDataQuality({
    transactions: [
      revenue,
      expense({
        relatedIncomeId: revenue.id,
        costBehavior: "variable",
      }),
    ],
    records: [payable()],
    inventory: [],
    today: TODAY,
    balancesPresent: true,
  });
  assert.equal(quality.components.directCostCoverage, 1);
});

test("bakiyeler yoksa nakit kararı hazır sayılmaz", () => {
  const quality = assessDataQuality({
    transactions: highQualityRows(),
    records: [payable()],
    inventory: [],
    today: TODAY,
    balancesPresent: false,
  });
  assert.equal(quality.cashReady, false);
  assert.ok(quality.blockers.some((item) => item.includes("banka")));
});

test("ödenecek KDV vergi rezervine girer", () => {
  const period = managementPeriod({
    transactions: [income(), expense({ amount: 600 })],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  const tax = estimateTaxReserve({
    period,
    settings: normalizeDecisionSettings({
      corporateTaxRate: 0.25,
      rentContractBasis: "not_applicable",
    }),
  });
  assert.equal(tax.vat.payableVat, 100);
});

test("kurumlar vergisi zarar halinde negatif olmaz", () => {
  const period = managementPeriod({
    transactions: [income({ amount: 1_200 }), expense({ amount: 2_400 })],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  const tax = estimateTaxReserve({
    period,
    settings: normalizeDecisionSettings({ corporateTaxRate: 0.25 }),
  });
  assert.equal(tax.corporateTaxReserve, 0);
});

test("asgari kurumlar vergisi yalnız seçildiğinde devreye girer", () => {
  const period = managementPeriod({
    transactions: [income({ amount: 12_000 })],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  const off = estimateTaxReserve({
    period,
    settings: normalizeDecisionSettings({
      minimumCorporateTaxApplies: false,
    }),
  });
  const on = estimateTaxReserve({
    period,
    settings: normalizeDecisionSettings({
      minimumCorporateTaxApplies: true,
      corporateTaxRate: 0.05,
      minimumCorporateTaxRate: 0.1,
    }),
  });
  assert.equal(off.minimumCorporateTax, 0);
  assert.ok(on.minimumCorporateTax > 0);
  assert.equal(on.corporateTaxReserve, on.minimumCorporateTax);
});

test("net kira stopajı brütleştirme ile hesaplanır", () => {
  const period = managementPeriod({
    transactions: [
      expense({
        category: "Kira",
        amount: 80_000,
        vatRate: 0,
      }),
    ],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  const tax = estimateTaxReserve({
    period,
    settings: normalizeDecisionSettings({
      rentContractBasis: "net",
      rentLandlordType: "individual",
      rentWithholdingRate: 0.2,
    }),
  });
  assert.equal(tax.rentGrossBase, 100_000);
  assert.equal(tax.rentWithholding, 20_000);
});

test("kiraya veren türü doğrulanmadan stopaj tahmini üretilmez", () => {
  const period = managementPeriod({
    transactions: [
      expense({
        category: "Kira",
        amount: 80_000,
        vatRate: 0,
      }),
    ],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  const tax = estimateTaxReserve({
    period,
    settings: normalizeDecisionSettings({
      rentContractBasis: "net",
      rentLandlordType: "unknown",
      rentWithholdingRate: 0.2,
    }),
  });
  assert.equal(tax.rentWithholding, 0);
  assert.match(tax.warnings.join(" "), /Kiraya veren türü/);
});

test("ödenmiş vergi kalan rezervden düşülür", () => {
  const period = managementPeriod({
    transactions: [
      income({ amount: 12_000 }),
      expense({ operationType: "tax", amount: 1_000, vatRate: 0 }),
    ],
    startDate: "2026-07-01",
    endDate: TODAY,
  });
  const tax = estimateTaxReserve({
    period,
    settings: normalizeDecisionSettings({
      additionalTaxesPaid: 500,
    }),
  });
  assert.equal(tax.recordedAndAdditionalPaid, 1_500);
  assert.equal(
    tax.remainingReserve,
    Math.max(0, tax.grossReserve - 1_500),
  );
});

test("13 haftalık tahmin POS bekleyen tutarı likiditeye eklemez", () => {
  const settings = normalizeDecisionSettings({
    cashBalance: 10_000,
    bankBalance: 20_000,
  });
  const forecast = buildThirteenWeekForecast({
    transactions: [
      income({
        date: TODAY,
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "pending",
      }),
    ],
    records: [],
    recurringRules: [],
    recurringOccurrences: [],
    today: TODAY,
    settings,
    tax: { remainingReserve: 0 },
  });
  assert.equal(forecast.liquidity, 30_000);
});

test("13 hafta içindeki borç fon açığı kısıtlı nakde girer", () => {
  const settings = normalizeDecisionSettings({
    cashBalance: 200_000,
    bankBalance: 0,
  });
  const forecast = buildThirteenWeekForecast({
    transactions: [],
    records: [payable()],
    recurringRules: [],
    recurringOccurrences: [],
    today: TODAY,
    settings,
    tax: { remainingReserve: 0 },
  });
  assert.equal(forecast.payable.unfunded, 100_000);
  assert.ok(forecast.restrictedCash >= 100_000);
});

test("planlı sabit gider ilgili haftaya bir kez eklenir", () => {
  const settings = normalizeDecisionSettings({
    cashBalance: 100_000,
    bankBalance: 0,
  });
  const forecast = buildThirteenWeekForecast({
    transactions: [],
    records: [],
    recurringRules: [{ id: "rent", active: true }],
    recurringOccurrences: [
      {
        id: "rent-1",
        ruleId: "rent",
        dueDate: "2026-08-01",
        expectedAmount: 20_000,
        status: "planned",
      },
    ],
    today: TODAY,
    settings,
    tax: { remainingReserve: 0 },
  });
  assert.equal(
    forecast.weeks.reduce((sum, week) => sum + week.recurring, 0),
    20_000,
  );
});

test("eksik sabit gider planı geçmiş sabit gider bazını sıfırlamaz", () => {
  const settings = normalizeDecisionSettings({
    cashBalance: 300_000,
    bankBalance: 0,
  });
  const transactions = [
    expense({ id: "fixed-1", date: "2026-05-05", amount: 13_000 }),
    expense({ id: "fixed-2", date: "2026-06-05", amount: 13_000 }),
    expense({ id: "fixed-3", date: "2026-07-05", amount: 13_000 }),
  ];
  const forecast = buildThirteenWeekForecast({
    transactions,
    records: [],
    recurringRules: [{ id: "internet", active: true }],
    recurringOccurrences: [
      {
        id: "internet-1",
        ruleId: "internet",
        dueDate: "2026-08-01",
        expectedAmount: 500,
        status: "planned",
      },
    ],
    today: TODAY,
    settings,
    tax: { remainingReserve: 0 },
  });
  assert.ok(forecast.weeklyFixedHistory > 500);
  assert.ok(forecast.fixedOutflow13Weeks >= forecast.weeklyFixedHistory * 13 - 0.05);
  assert.equal(forecast.scheduledRecurring13Weeks, 500);
});

test("doğrulanmış aylık kredi taksiti olmadan borçlanma yeşil olmaz", () => {
  const result = evaluateBorrowing({
    forecast: {
      weeklyIncome: 100_000,
      weeklyVariableOutflow: 10_000,
      weeklyFixedHistory: 10_000,
      taxReserve: 0,
    },
    records: [payable({ originalAmount: 12_000 })],
    settings: normalizeDecisionSettings({
      loanMonthlyRate: 0.02,
      monthlyDebtServiceOverride: null,
    }),
    quality: { borrowingReady: true },
    today: TODAY,
  });
  assert.equal(result.status, "yellow");
  assert.equal(result.debtServiceConfigured, false);
  assert.equal(result.derivedDebtService, null);
});

test("stres tahmini gelir düşüşünü ve maliyet artışını uygular", () => {
  const rows = highQualityRows();
  const settings = normalizeDecisionSettings({
    cashBalance: 100_000,
    bankBalance: 0,
    stressRevenueDropRate: 0.2,
    stressCostIncreaseRate: 0.2,
  });
  const forecast = buildThirteenWeekForecast({
    transactions: rows,
    records: [],
    recurringRules: [],
    recurringOccurrences: [],
    today: TODAY,
    settings,
    tax: { remainingReserve: 0 },
  });
  assert.ok(forecast.stressEndingBalance < forecast.baseEndingBalance);
});

test("yıllık hedef girilmemişse sistem otomatik hedef üretmez", () => {
  const target = evaluateTarget({
    transactions: highQualityRows(),
    today: TODAY,
    settings: normalizeDecisionSettings({
      annualNetSalesTarget: null,
    }),
    quality: { forecastReady: true },
  });
  assert.equal(target.targetConfigured, false);
  assert.equal(target.annualTarget, null);
});

test("hedef temposu gerideyse kırmızı kalır", () => {
  const target = evaluateTarget({
    transactions: [income({ date: "2026-01-15", amount: 120_000 })],
    today: TODAY,
    settings: normalizeDecisionSettings({
      annualNetSalesTarget: 3_000_000,
    }),
    quality: { forecastReady: true },
  });
  assert.equal(target.status, "red");
  assert.ok(target.requiredDailyPace > 0);
});

test("2027 taslak hedefi enflasyon ve reel büyümeyi ayrı uygular", () => {
  const target = evaluateTarget({
    transactions: highQualityRows(),
    today: TODAY,
    settings: normalizeDecisionSettings({
      inflationAssumption: 0.2,
      realGrowthTarget: 0.1,
    }),
    quality: { forecastReady: true },
  });
  assert.ok(
    Math.abs(
      target.suggestedNextYearTarget -
        Math.round(target.annualForecast * 1.2 * 1.1 * 100) / 100,
    ) <= 0.02,
  );
});

test("faiz oranı bilinmeden borç anaparası için yeşil sinyal verilmez", () => {
  const forecast = {
    weeklyIncome: 100_000,
    weeklyVariableOutflow: 20_000,
    weeklyFixedHistory: 10_000,
    taxReserve: 0,
  };
  const result = evaluateBorrowing({
    forecast,
    records: [payable()],
    settings: normalizeDecisionSettings({
      loanMonthlyRate: null,
      monthlyDebtServiceOverride: 10_000,
    }),
    quality: { borrowingReady: true },
    today: TODAY,
  });
  assert.equal(result.status, "yellow");
  assert.equal(result.rateKnown, false);
});

test("stres FCADS yetersizse yeni borç kapalıdır", () => {
  const forecast = {
    weeklyIncome: 20_000,
    weeklyVariableOutflow: 18_000,
    weeklyFixedHistory: 5_000,
    taxReserve: 0,
  };
  const result = evaluateBorrowing({
    forecast,
    records: [payable()],
    settings: normalizeDecisionSettings({
      loanMonthlyRate: 0.03,
      monthlyDebtServiceOverride: 10_000,
      stressRevenueDropRate: 0.2,
      stressCostIncreaseRate: 0.2,
    }),
    quality: { borrowingReady: true },
    today: TODAY,
  });
  assert.equal(result.status, "red");
  assert.equal(result.additionalMonthlyPayment, 0);
});

test("borç verisi eksikse matematik kapasite üretse de yeşil olmaz", () => {
  const result = evaluateBorrowing({
    forecast: {
      weeklyIncome: 100_000,
      weeklyVariableOutflow: 10_000,
      weeklyFixedHistory: 10_000,
      taxReserve: 0,
    },
    records: [],
    settings: normalizeDecisionSettings({
      loanMonthlyRate: 0.02,
      monthlyDebtServiceOverride: 0,
    }),
    quality: { borrowingReady: false },
    today: TODAY,
  });
  assert.equal(result.status, "red");
});

test("alım tutarı girilmeden satın alma onayı üretilmez", () => {
  const purchase = evaluatePurchase({
    settings: normalizeDecisionSettings({ plannedPurchaseAmount: 0 }),
    forecast: {
      distributableCash: 1_000_000,
      minimumStressBalance: 1_000_000,
    },
    borrowing: { existingMonthlyDebtService: 0, baseDscr: null },
    quality: { cashReady: true, profitReady: true },
  });
  assert.equal(purchase.configured, false);
  assert.equal(purchase.status, "neutral");
});

test("nakit sınırını aşan alım reddedilir", () => {
  const purchase = evaluatePurchase({
    settings: normalizeDecisionSettings({
      plannedPurchaseAmount: 200_000,
      plannedPurchaseMonthlyContribution: 20_000,
      maxPaybackMonths: 24,
    }),
    forecast: {
      distributableCash: 100_000,
      minimumStressBalance: 500_000,
    },
    borrowing: { existingMonthlyDebtService: 0, baseDscr: null },
    quality: { cashReady: true, profitReady: true },
  });
  assert.equal(purchase.status, "red");
  assert.equal(
    purchase.checks.find((check) => check.key === "cash").pass,
    false,
  );
});

test("tüm kapıları geçen alım yapılabilir olur", () => {
  const purchase = evaluatePurchase({
    settings: normalizeDecisionSettings({
      plannedPurchaseAmount: 100_000,
      plannedPurchaseMonthlyContribution: 10_000,
      maxPaybackMonths: 24,
    }),
    forecast: {
      distributableCash: 250_000,
      minimumStressBalance: 300_000,
    },
    borrowing: { existingMonthlyDebtService: 0, baseDscr: null },
    quality: { cashReady: true, profitReady: true },
  });
  assert.equal(purchase.status, "green");
  assert.equal(purchase.paybackMonths, 10);
});

test("yasal transfer türü seçilmeden ev bütçesi kapalıdır", () => {
  const transfer = evaluateOwnerTransfer({
    settings: normalizeDecisionSettings({
      ownerTransferType: "none",
      monthlyHomeNeed: 70_000,
    }),
    forecast: { distributableCash: 1_000_000, taxReserve: 0 },
    quality: { cashReady: true, profitReady: true },
    period: { operatingProfitProxy: 1_000_000 },
  });
  assert.equal(transfer.status, "red");
  assert.equal(transfer.safeTransfer, 0);
});

test("rezerv sonrası nakit 70 binden azsa yalnız kısmi transfer planlanır", () => {
  const transfer = evaluateOwnerTransfer({
    settings: normalizeDecisionSettings({
      ownerTransferType: "salary",
      monthlyHomeNeed: 70_000,
    }),
    forecast: { distributableCash: 40_000, taxReserve: 0 },
    quality: { cashReady: true, profitReady: true },
    period: { operatingProfitProxy: 100_000 },
  });
  assert.equal(transfer.status, "yellow");
  assert.equal(transfer.safeTransfer, 40_000);
  assert.equal(transfer.shortfall, 30_000);
});

test("karar motoru ilk kırmızı bulguyu tek öncelik olarak seçer", () => {
  const engine = buildDecisionEngine({
    transactions: [],
    records: [],
    inventory: [],
    recurringRules: [],
    recurringOccurrences: [],
    settings: {},
    today: TODAY,
  });
  assert.equal(engine.overallStatus, "red");
  assert.equal(engine.priority.status, "red");
  assert.ok(engine.priority.action.length > 0);
});

test("karar motoru kabul edilen referansı hedefe kendiliğinden yazmaz", () => {
  const engine = buildDecisionEngine({
    transactions: highQualityRows(),
    records: [payable()],
    inventory: [],
    recurringRules: [],
    recurringOccurrences: [],
    settings: {
      cashBalance: 100_000,
      bankBalance: 100_000,
    },
    today: TODAY,
  });
  assert.equal(engine.target.annualTarget, null);
  assert.equal(engine.target.targetConfigured, false);
});
