import assert from "node:assert/strict";
import test from "node:test";

import {
  borrowingCapacity,
  calendarEventsFromLedger,
  daysUntil,
  grossPriceForTargetMargin,
  ledgerStatus,
  ledgerSummary,
  loanPrincipalFromMonthlyPayment,
  monthlyReserveRequirement,
  paymentPosition,
  priceAnalysis,
  spendableCash,
  targetProgress,
  vatSettlement,
} from "../lib/finance.mjs";
import {
  applyStockMovement,
  buildActionItems,
  consumableUsageStatistics,
  createPosCommissionExpense,
  dailyOperationsSummary,
  inventoryItemPosition,
  inventorySummary,
  isRecognizedExpense,
  operationsStatistics,
  operationalCalendarEvents,
} from "../lib/operations.mjs";

function approximately(actual, expected, tolerance = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual}, ${expected} değerinden ${tolerance} toleransla farklı.`,
  );
}

test("kısmi ödemeler kalan bakiyeyi doğru azaltır", () => {
  assert.deepEqual(paymentPosition(1_000, [200, 300]), {
    originalAmount: 1_000,
    totalPaid: 500,
    appliedPaid: 500,
    remaining: 500,
    overpayment: 0,
    paymentRate: 0.5,
  });
});

test("iptal edilmiş ödeme bakiyeye yansımaz", () => {
  const result = paymentPosition(1_000, [
    { amount: 200 },
    { amount: 500, status: "cancelled" },
  ]);
  assert.equal(result.totalPaid, 200);
  assert.equal(result.remaining, 800);
});

test("fazla ödeme kalan bakiyeyi negatife düşürmez", () => {
  const result = paymentPosition(1_000, [1_250]);
  assert.equal(result.remaining, 0);
  assert.equal(result.appliedPaid, 1_000);
  assert.equal(result.overpayment, 250);
});

test("negatif ödeme reddedilir", () => {
  assert.throws(() => paymentPosition(1_000, [-1]), /negatif olamaz/);
});

test("tarih farkı gün sınırlarında doğru hesaplanır", () => {
  assert.equal(daysUntil("2027-07-12", "2026-07-23"), 354);
  assert.equal(daysUntil("2026-07-23", "2026-07-23"), 0);
  assert.equal(daysUntil("2026-07-22", "2026-07-23"), -1);
});

test("geçersiz takvim tarihi reddedilir", () => {
  assert.throws(
    () => daysUntil("2026-02-30", "2026-01-01"),
    /Geçersiz tarih/,
  );
});

test("açık alacak doğru sınıflanır", () => {
  const status = ledgerStatus({
    originalAmount: 10_000,
    payments: [],
    dueDate: "2026-09-01",
    today: "2026-07-23",
  });
  assert.equal(status.code, "open");
});

test("kısmi ödenmiş kayıt doğru sınıflanır", () => {
  const status = ledgerStatus({
    originalAmount: 10_000,
    payments: [{ amount: 4_000 }],
    dueDate: "2026-09-01",
    today: "2026-07-23",
  });
  assert.equal(status.code, "partial");
  assert.equal(status.remaining, 6_000);
});

test("yedi gün içindeki vade yakın olarak sınıflanır", () => {
  const status = ledgerStatus({
    originalAmount: 10_000,
    payments: [],
    dueDate: "2026-07-30",
    today: "2026-07-23",
  });
  assert.equal(status.code, "due_soon");
});

test("vadesi bugün olan kısmi kayıt ayrı sınıflanır", () => {
  const status = ledgerStatus({
    originalAmount: 10_000,
    payments: [{ amount: 1_000 }],
    dueDate: "2026-07-23",
    today: "2026-07-23",
  });
  assert.equal(status.code, "due_today_partial");
});

test("gecikmiş kısmi kayıt gecikmiş kalır", () => {
  const status = ledgerStatus({
    originalAmount: 10_000,
    payments: [{ amount: 9_000 }],
    dueDate: "2026-07-01",
    today: "2026-07-23",
  });
  assert.equal(status.code, "overdue_partial");
  assert.equal(status.remaining, 1_000);
});

test("tam ödeme vade geçmiş olsa da ödenmiş sınıflanır", () => {
  const status = ledgerStatus({
    originalAmount: 10_000,
    payments: [{ amount: 10_000 }],
    dueDate: "2026-07-01",
    today: "2026-07-23",
  });
  assert.equal(status.code, "paid");
});

test("Hasvet örneğinde aylık rezerv 12 aya doğru dağılır", () => {
  const reserve = monthlyReserveRequirement({
    remainingAmount: 300_000,
    existingReserve: 0,
    dueDate: "2027-07-12",
    today: "2026-07-23",
  });
  assert.equal(reserve.monthsAvailable, 12);
  assert.equal(reserve.monthlyReserve, 25_000);
});

test("gecikmiş borcun finansman açığı bugün tam ayrılır", () => {
  const reserve = monthlyReserveRequirement({
    remainingAmount: 80_000,
    existingReserve: 20_000,
    dueDate: "2026-07-01",
    today: "2026-07-23",
  });
  assert.equal(reserve.monthsAvailable, 1);
  assert.equal(reserve.monthlyReserve, 60_000);
  assert.equal(reserve.urgency, "overdue");
});

test("tam fonlanmış borç için ek rezerv sıfırdır", () => {
  const reserve = monthlyReserveRequirement({
    remainingAmount: 50_000,
    existingReserve: 60_000,
    dueDate: "2026-12-01",
    today: "2026-07-23",
  });
  assert.equal(reserve.fundingGap, 0);
  assert.equal(reserve.monthlyReserve, 0);
});

test("KDV dâhil hedef fiyat istenen net satış marjını üretir", () => {
  const result = grossPriceForTargetMargin({
    directAndAllocatedCost: 1_000,
    vatRate: 0.2,
    posRate: 0.02,
    targetMarginOnNetSales: 0.3,
  });
  approximately(result.marginOnNetSales, 0.3, 0.000001);
  assert.equal(result.requiredGrossPrice, 1_775.15);
});

test("fiyat analizi KDV, POS ve maliyeti ayrı tutar", () => {
  const result = priceAnalysis({
    grossPrice: 1_200,
    directAndAllocatedCost: 700,
    vatRate: 0.2,
    posRate: 0.02,
  });
  assert.equal(result.netSales, 1_000);
  assert.equal(result.outputVat, 200);
  assert.equal(result.posCost, 24);
  assert.equal(result.contribution, 276);
  approximately(result.marginOnNetSales, 0.276);
});

test("matematiksel olarak olanaksız hedef marj reddedilir", () => {
  assert.throws(
    () =>
      grossPriceForTargetMargin({
        directAndAllocatedCost: 1_000,
        vatRate: 0.2,
        posRate: 0.3,
        targetMarginOnNetSales: 0.7,
      }),
    /uygulanabilir değil/,
  );
});

test("ödenecek KDV doğru netleştirilir", () => {
  assert.deepEqual(
    vatSettlement({
      outputVat: 100_000,
      deductibleInputVat: 60_000,
      priorCarryForward: 10_000,
      adjustments: 2_000,
    }),
    { payableVat: 32_000, nextCarryForward: 0, netPosition: 32_000 },
  );
});

test("negatif KDV pozisyonu ödeme değil devreden KDV üretir", () => {
  assert.deepEqual(
    vatSettlement({
      outputVat: 20_000,
      deductibleInputVat: 35_000,
    }),
    { payableVat: 0, nextCarryForward: 15_000, netPosition: -15_000 },
  );
});

test("hedef gerisindeki gerçekleşme iyimser etiketlenmez", () => {
  const result = targetProgress({
    annualTarget: 3_000_000,
    actualToDate: 1_400_000,
    seasonalityWeightToDate: 0.5,
    workingDaysRemaining: 130,
  });
  assert.equal(result.status, "behind");
  assert.equal(result.variance, -100_000);
  assert.equal(result.remainingTarget, 1_600_000);
  assert.equal(result.requiredDailyPace, 12_307.69);
  assert.equal(result.simpleYearEndForecast, 2_800_000);
});

test("hedef üstündeki gerçekleşme matematiksel olarak önde sınıflanır", () => {
  const result = targetProgress({
    annualTarget: 3_000_000,
    actualToDate: 1_600_000,
    seasonalityWeightToDate: 0.5,
    workingDaysRemaining: 130,
  });
  assert.equal(result.status, "ahead");
  assert.equal(result.variance, 100_000);
});

test("yıl bittiğinde açık hedef için gerekli günlük tempo hesaplanamaz", () => {
  const result = targetProgress({
    annualTarget: 3_000_000,
    actualToDate: 2_900_000,
    seasonalityWeightToDate: 1,
    workingDaysRemaining: 0,
  });
  assert.equal(result.status, "behind");
  assert.equal(result.requiredDailyPace, null);
});

test("harcanabilir nakit POS bekleyen tutarı nakit saymaz", () => {
  const result = spendableCash({
    cash: 20_000,
    bank: 180_000,
    taxReserve: 50_000,
    debtReserve: 40_000,
    payrollReserve: 10_000,
    obligationsDueWithin30Days: 70_000,
    posPending: 90_000,
  });
  assert.equal(result.liquidFunds, 200_000);
  assert.equal(result.posPending, 90_000);
  assert.equal(result.spendable, 30_000);
});

test("rezervler likit fonu aşıyorsa harcanabilir nakit sıfırdır", () => {
  const result = spendableCash({
    cash: 10_000,
    bank: 20_000,
    taxReserve: 40_000,
  });
  assert.equal(result.spendable, 0);
  assert.equal(result.shortfall, 10_000);
});

test("faizsiz kredi anaparası taksit çarpı vadedir", () => {
  assert.equal(
    loanPrincipalFromMonthlyPayment({
      monthlyPayment: 10_000,
      monthlyRate: 0,
      termMonths: 12,
    }),
    120_000,
  );
});

test("borçlanma kapasitesinde stres senaryosu daha düşük sınırı belirler", () => {
  const result = borrowingCapacity({
    baseCashAvailableForDebtService: 150_000,
    stressedCashAvailableForDebtService: 72_000,
    existingMonthlyDebtService: 20_000,
    monthlyRate: 0.03,
    termMonths: 24,
  });
  assert.equal(result.safeTotalMonthlyDebtService, 60_000);
  assert.equal(result.additionalMonthlyPayment, 40_000);
  assert.equal(result.signal, "eligible");
});

test("mevcut borç servisi güvenli sınırı doldurmuşsa yeni borç engellenir", () => {
  const result = borrowingCapacity({
    baseCashAvailableForDebtService: 90_000,
    stressedCashAvailableForDebtService: 48_000,
    existingMonthlyDebtService: 40_000,
    monthlyRate: 0.03,
    termMonths: 24,
  });
  assert.equal(result.safeTotalMonthlyDebtService, 40_000);
  assert.equal(result.additionalMonthlyPayment, 0);
  assert.equal(result.maximumAdditionalPrincipal, 0);
  assert.equal(result.signal, "blocked");
});

const sampleRecords = [
  {
    id: "a1",
    type: "receivable",
    counterparty: "Örnek müşteri",
    originalAmount: 20_000,
    dueDate: "2026-07-20",
    payments: [{ amount: 5_000, date: "2026-07-10" }],
  },
  {
    id: "b1",
    type: "payable",
    counterparty: "Örnek tedarikçi",
    originalAmount: 30_000,
    dueDate: "2026-08-20",
    payments: [{ amount: 30_000, date: "2026-07-15" }],
  },
];

test("alacak ve borç özetleri birbirine karıştırılmaz", () => {
  const result = ledgerSummary(sampleRecords, "2026-07-23");
  assert.deepEqual(result.receivable, {
    original: 20_000,
    paid: 5_000,
    remaining: 15_000,
    overdue: 15_000,
  });
  assert.deepEqual(result.payable, {
    original: 30_000,
    paid: 30_000,
    remaining: 0,
    overdue: 0,
  });
});

test("liste kayıtları vade ve ödeme olaylarını otomatik takvime üretir", () => {
  const events = calendarEventsFromLedger(sampleRecords, "2026-07-23");
  assert.equal(events.length, 4);
  assert.deepEqual(
    events.map((event) => event.type),
    [
      "receivable_collection",
      "payable_payment",
      "receivable_due",
      "payable_due",
    ],
  );
});

test("günlük gelir, işletme gideri ve kasa çekimi birbirine karıştırılmaz", () => {
  const summary = dailyOperationsSummary({
    date: "2026-07-23",
    transactions: [
      {
        kind: "income",
        date: "2026-07-23",
        amount: 10_000,
        paymentMethod: "cash",
      },
      {
        kind: "expense",
        date: "2026-07-23",
        amount: 3_000,
        paymentMethod: "cash",
        documentType: "receipt",
        documentRef: "F-1",
      },
      {
        kind: "withdrawal",
        date: "2026-07-23",
        amount: 2_000,
        paymentMethod: "cash",
      },
    ],
  });

  assert.equal(summary.income, 10_000);
  assert.equal(summary.expense, 3_000);
  assert.equal(summary.withdrawals, 2_000);
  assert.equal(summary.operatingBalance, 7_000);
});

test("fiziksel kasa yalnızca nakit hareketlerle hesaplanır", () => {
  const summary = dailyOperationsSummary({
    date: "2026-07-23",
    openingCash: 5_000,
    countedCash: 8_900,
    transactions: [
      {
        kind: "income",
        date: "2026-07-23",
        amount: 4_000,
        paymentMethod: "cash",
      },
      {
        kind: "income",
        date: "2026-07-23",
        amount: 9_000,
        paymentMethod: "card",
        posRate: 0.02,
      },
      {
        kind: "expense",
        date: "2026-07-23",
        amount: 100,
        paymentMethod: "cash",
        documentType: "receipt",
        documentRef: "F-2",
      },
    ],
  });

  assert.equal(summary.expectedCash, 8_900);
  assert.equal(summary.cashDifference, 0);
});

test("fiş veya faturası olan gider muhasebe gideri olarak tanınır", () => {
  assert.equal(
    isRecognizedExpense({
      kind: "expense",
      amount: 500,
      documentType: "invoice",
      documentRef: "FAT-101",
    }),
    true,
  );
});

test("belge türü seçilip referansı girilmeyen gider tanınmaz", () => {
  assert.equal(
    isRecognizedExpense({
      kind: "expense",
      amount: 500,
      documentType: "invoice",
      documentRef: " ",
    }),
    false,
  );
});

test("kart satışı tam oranla otomatik bağlı POS gideri üretir", () => {
  const expense = createPosCommissionExpense({
    id: "sale-1",
    date: "2026-07-23",
    time: "12:30",
    kind: "income",
    description: "Muayene",
    amount: 10_000,
    paymentMethod: "card",
    documentRef: "FIS-1",
    posRate: 0.0239,
  });

  assert.equal(expense.amount, 239);
  assert.equal(expense.sourceTransactionId, "sale-1");
  assert.equal(expense.isAutomatic, true);
  assert.equal(expense.documentType, "pos_statement");
});

test("nakit satış POS komisyon gideri üretmez", () => {
  assert.equal(
    createPosCommissionExpense({
      id: "sale-2",
      kind: "income",
      amount: 10_000,
      paymentMethod: "cash",
      posRate: 0.0239,
    }),
    null,
  );
});

test("belgesiz çıkış işletme gideri ve faaliyet sonucundan çıkarılır", () => {
  const summary = dailyOperationsSummary({
    date: "2026-07-23",
    transactions: [
      {
        kind: "income",
        date: "2026-07-23",
        amount: 1_000,
        paymentMethod: "cash",
      },
      {
        kind: "expense",
        date: "2026-07-23",
        amount: 300,
        paymentMethod: "cash",
        documentType: "none",
        documentRef: "",
      },
    ],
  });

  assert.equal(summary.expense, 0);
  assert.equal(summary.undocumentedOutflow, 300);
  assert.equal(summary.operatingBalance, 1_000);
});

test("belgesiz nakit çıkışı fiziksel kasa beklentisini yine azaltır", () => {
  const summary = dailyOperationsSummary({
    date: "2026-07-23",
    openingCash: 1_000,
    countedCash: 750,
    transactions: [
      {
        kind: "expense",
        date: "2026-07-23",
        amount: 250,
        paymentMethod: "cash",
        documentType: "none",
        documentRef: "",
      },
    ],
  });

  assert.equal(summary.expectedCash, 750);
  assert.equal(summary.cashDifference, 0);
  assert.equal(summary.undocumentedByChannel.cash, 250);
});

test("dönem istatistiği belge kapsamasını ve yalnız belgeli KDV'yi hesaplar", () => {
  const statistics = operationsStatistics({
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    transactions: [
      {
        kind: "income",
        date: "2026-07-10",
        category: "Muayene",
        amount: 1_200,
        paymentMethod: "cash",
        vatRate: 0.2,
      },
      {
        kind: "expense",
        date: "2026-07-10",
        category: "Sarf",
        amount: 600,
        paymentMethod: "cash",
        vatRate: 0.2,
        documentType: "invoice",
        documentRef: "FAT-1",
      },
      {
        kind: "expense",
        date: "2026-07-10",
        category: "Temizlik",
        amount: 100,
        paymentMethod: "cash",
        vatRate: 0.2,
        documentType: "none",
        documentRef: "",
      },
      {
        kind: "withdrawal",
        date: "2026-07-10",
        amount: 50,
        paymentMethod: "cash",
      },
    ],
  });

  assert.equal(statistics.income, 1_200);
  assert.equal(statistics.documentedExpense, 600);
  assert.equal(statistics.undocumentedOutflow, 100);
  assert.equal(statistics.cashMovement, 450);
  assert.equal(statistics.documentCoverage, 0.5);
  assert.equal(statistics.outputVat, 200);
  assert.equal(statistics.deductibleInputVat, 100);
  assert.equal(statistics.preliminaryVatPosition, 100);
});

test("POS istatistiği bağlı komisyon giderini yalnız bir kez sayar", () => {
  const sale = {
    id: "sale-3",
    date: "2026-07-10",
    time: "10:00",
    kind: "income",
    category: "Muayene",
    operationType: "service",
    description: "Kartlı muayene",
    amount: 10_000,
    paymentMethod: "card",
    documentRef: "FIS-3",
    posRate: 0.025,
    vatRate: 0.2,
  };
  const fee = createPosCommissionExpense(sale);
  const statistics = operationsStatistics({
    transactions: [sale, fee],
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  });

  assert.equal(statistics.cardIncome, 10_000);
  assert.equal(statistics.posCommission, 250);
  assert.equal(statistics.documentedExpense, 250);
  assert.equal(statistics.effectivePosRate, 0.025);
  assert.equal(statistics.revenueDrivers[0].category, "Muayene");
  assert.equal(statistics.revenueDrivers[0].directCost, 250);
  assert.equal(statistics.revenueDrivers[0].contribution, 9_750);
  assert.equal(statistics.revenueDrivers[0].contributionRate, 0.975);
});

test("paketli sarf istatistiği paket, birim, kullanım, fire ve maliyeti ayırır", () => {
  const [row] = consumableUsageStatistics({
    items: [
      {
        id: "tp",
        name: "Tuvalet kâğıdı 16'lı",
        unit: "rulo",
        purchaseUnit: "paket",
        unitsPerPackage: 16,
        quantity: 22,
      },
    ],
    movements: [
      {
        itemId: "tp",
        date: "2026-01-10",
        type: "purchase",
        quantity: 128,
        packageCount: 8,
        unitsPerPackage: 16,
        totalCost: 1_680,
      },
      { itemId: "tp", date: "2026-07-10", type: "usage", quantity: 104 },
      { itemId: "tp", date: "2026-07-11", type: "waste", quantity: 2 },
    ],
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });

  assert.equal(row.purchasedPackages, 8);
  assert.equal(row.purchasedUnits, 128);
  assert.equal(row.usedUnits, 104);
  assert.equal(row.wastedUnits, 2);
  assert.equal(row.remainingUnits, 22);
  assert.equal(row.spent, 1_680);
  assert.equal(row.averageUnitCost, 13.13);
});

test("sarf istatistiği seçilen tarih aralığı dışındaki alımları dışlar", () => {
  const [row] = consumableUsageStatistics({
    items: [
      {
        id: "tp",
        name: "Tuvalet kâğıdı",
        unit: "rulo",
        purchaseUnit: "paket",
        unitsPerPackage: 16,
        quantity: 10,
      },
    ],
    movements: [
      {
        itemId: "tp",
        date: "2025-12-31",
        type: "purchase",
        quantity: 32,
        packageCount: 2,
        totalCost: 300,
      },
      {
        itemId: "tp",
        date: "2026-01-01",
        type: "purchase",
        quantity: 16,
        packageCount: 1,
        totalCost: 200,
      },
    ],
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });

  assert.equal(row.purchasedPackages, 1);
  assert.equal(row.purchasedUnits, 16);
  assert.equal(row.spent, 200);
});

test("aksiyon merkezi belge, POS, kasa ve stok risklerini birlikte üretir", () => {
  const actions = buildActionItems({
    statistics: {
      undocumentedOutflow: 100,
      effectivePosRate: 0.03,
    },
    inventory: { outCount: 1, lowCount: 2 },
    cashDifference: -50,
    targetPosRate: 0.02,
  });
  const titles = actions.map((action) => action.title);

  assert.equal(actions.length, 5);
  assert.ok(titles.includes("Belgesiz para çıkışı var"));
  assert.ok(titles.includes("POS maliyeti hedefin üzerinde"));
  assert.ok(titles.includes("Kasa sayımı eşleşmiyor"));
  assert.ok(titles.includes("Tükenen stok var"));
  assert.ok(titles.includes("Minimum stok altında ürün var"));
});

test("POS komisyonu ve bekleyen net yatış ayrı hesaplanır", () => {
  const summary = dailyOperationsSummary({
    date: "2026-07-23",
    transactions: [
      {
        kind: "income",
        date: "2026-07-23",
        amount: 10_000,
        paymentMethod: "card",
        posRate: 0.025,
        posStatus: "pending",
      },
    ],
  });

  assert.equal(summary.posGross, 10_000);
  assert.equal(summary.posFees, 250);
  assert.equal(summary.posNet, 9_750);
  assert.equal(summary.posPending, 9_750);
});

test("yatmış POS ve iptal kayıtları bekleyen tutara eklenmez", () => {
  const summary = dailyOperationsSummary({
    date: "2026-07-23",
    transactions: [
      {
        kind: "income",
        date: "2026-07-23",
        amount: 10_000,
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "settled",
      },
      {
        kind: "income",
        date: "2026-07-23",
        amount: 50_000,
        paymentMethod: "card",
        posRate: 0.02,
        status: "cancelled",
      },
    ],
  });

  assert.equal(summary.posGross, 10_000);
  assert.equal(summary.posPending, 0);
  assert.equal(summary.transactionCount, 1);
});

test("nakit dışı kasa çekimi reddedilir", () => {
  assert.throws(
    () =>
      dailyOperationsSummary({
        date: "2026-07-23",
        transactions: [
          {
            kind: "withdrawal",
            date: "2026-07-23",
            amount: 1_000,
            paymentMethod: "transfer",
          },
        ],
      }),
    /yalnızca nakit/,
  );
});

test("asgari seviyedeki ve yaklaşan son kullanımlı stok doğru işaretlenir", () => {
  const position = inventoryItemPosition(
    {
      quantity: 10,
      minimumQuantity: 10,
      unitCost: 100,
      expiryDate: "2026-08-10",
    },
    "2026-07-23",
  );

  assert.equal(position.code, "low");
  assert.equal(position.isLow, true);
  assert.equal(position.isExpiring, true);
});

test("sıfır stok tükenmiş olarak işaretlenir", () => {
  const position = inventoryItemPosition(
    {
      quantity: 0,
      minimumQuantity: 5,
      unitCost: 100,
      expiryDate: "",
    },
    "2026-07-23",
  );

  assert.equal(position.code, "out");
  assert.equal(position.reorderQuantity, 5);
});

test("stok özeti değer ve kritik kayıt sayılarını doğru toplar", () => {
  const summary = inventorySummary(
    [
      {
        quantity: 2,
        minimumQuantity: 5,
        unitCost: 100,
        expiryDate: "",
      },
      {
        quantity: 4,
        minimumQuantity: 2,
        unitCost: 50,
        expiryDate: "2026-08-01",
      },
    ],
    "2026-07-23",
  );

  assert.equal(summary.stockValue, 400);
  assert.equal(summary.alertCount, 2);
  assert.equal(summary.lowCount, 1);
  assert.equal(summary.expiringCount, 1);
});

test("stok girişi hareketli ağırlıklı ortalama maliyet üretir", () => {
  const result = applyStockMovement(
    { quantity: 10, unitCost: 100, lot: "A", expiryDate: "" },
    {
      type: "purchase",
      quantity: 10,
      unitCost: 200,
      lot: "B",
      expiryDate: "2027-01-01",
    },
  );

  assert.equal(result.quantity, 20);
  assert.equal(result.unitCost, 150);
  assert.equal(result.lot, "B");
});

test("stok çıkışı mevcut miktarı doğru azaltır", () => {
  const result = applyStockMovement(
    { quantity: 10, unitCost: 100 },
    { type: "usage", quantity: 3 },
  );
  assert.equal(result.quantity, 7);
  assert.equal(result.unitCost, 100);
});

test("mevcut stoktan fazla çıkış reddedilir", () => {
  assert.throws(
    () =>
      applyStockMovement(
        { quantity: 2, unitCost: 100 },
        { type: "waste", quantity: 3 },
      ),
    /mevcut stoku aşamaz/,
  );
});

test("POS yatışı ve stok uyarıları finans takvimine otomatik üretilir", () => {
  const events = operationalCalendarEvents(
    [
      {
        id: "tx-1",
        kind: "income",
        date: "2026-07-23",
        description: "Muayene",
        amount: 1_000,
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "pending",
        settlementDate: "2026-07-25",
      },
    ],
    [
      {
        id: "stock-1",
        name: "Aşı",
        quantity: 1,
        minimumQuantity: 2,
        unitCost: 500,
        expiryDate: "2026-08-15",
      },
    ],
    "2026-07-23",
  );

  assert.deepEqual(
    events.map((event) => event.type),
    ["pos_settlement", "stock_alert", "stock_expiry"],
  );
  assert.equal(events[0].amount, 980);
});
