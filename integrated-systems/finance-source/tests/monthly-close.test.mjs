import assert from "node:assert/strict";
import test from "node:test";

import {
  assessMonthlyClose,
  calculateMonthlyClose,
  channelReconciliation,
  isPeriodLocked,
  periodBounds,
  previousPeriod,
  reconciliationTolerance,
  resolveOpeningBalances,
} from "../lib/monthly-close.mjs";

function transaction(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    date: "2026-07-10",
    time: "12:00",
    kind: "income",
    category: "Muayene",
    description: "İşlem",
    amount: 1_000,
    paymentMethod: "cash",
    documentType: "receipt",
    documentRef: "F-1",
    vatRate: 0.2,
    posRate: 0,
    ...overrides,
  };
}

test("dönem sınırları artık yıl dahil doğru hesaplanır", () => {
  assert.deepEqual(periodBounds("2028-02"), {
    start: "2028-02-01",
    end: "2028-02-29",
  });
  assert.equal(previousPeriod("2026-01"), "2025-12");
});

test("geçersiz dönem reddedilir", () => {
  assert.throws(() => periodBounds("2026-13"), /Geçersiz dönem/);
});

test("önceki kapanış fiili bakiyeleri yeni aya otomatik taşınır", () => {
  assert.deepEqual(
    resolveOpeningBalances({
      period: "2026-08",
      closings: [
        {
          period: "2026-07",
          status: "closed",
          actualCash: 12_500,
          actualBank: 83_000,
        },
      ],
      openingCash: 1,
      openingBank: 2,
    }),
    {
      openingCash: 12_500,
      openingBank: 83_000,
      source: "previous_close",
      sourcePeriod: "2026-07",
    },
  );
});

test("önceki ay kapanmamışsa ilk açılış bakiyeleri kullanıcıdan gelir", () => {
  const result = resolveOpeningBalances({
    period: "2026-08",
    closings: [{ period: "2026-07", status: "open" }],
    openingCash: 5_000,
    openingBank: 20_000,
  });
  assert.equal(result.source, "manual");
  assert.equal(result.openingCash, 5_000);
  assert.equal(result.openingBank, 20_000);
});

test("iptal edilen işlemler aylık hesaplara girmez", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 100,
    openingBank: 200,
    transactions: [
      transaction({ status: "cancelled", amount: 99_000 }),
    ],
  });
  assert.equal(result.expectedCash, 100);
  assert.equal(result.income, 0);
});

test("nakit köprüsü gelir, belgeli gider, belgesiz çıkış ve çekimi ayırır", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 1_000,
    openingBank: 0,
    transactions: [
      transaction({ amount: 5_000 }),
      transaction({
        kind: "expense",
        amount: 1_200,
        paymentMethod: "cash",
      }),
      transaction({
        kind: "expense",
        amount: 300,
        paymentMethod: "cash",
        documentType: "none",
        documentRef: "",
      }),
      transaction({
        kind: "withdrawal",
        amount: 500,
        paymentMethod: "cash",
        documentType: "none",
        documentRef: "",
      }),
    ],
  });
  assert.equal(result.expectedCash, 4_000);
  assert.equal(result.recognizedExpense, 1_200);
  assert.equal(result.undocumentedOutflow, 300);
  assert.equal(result.withdrawals, 500);
});

test("havale gelir ve banka gideri beklenen bankayı oluşturur", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 10_000,
    transactions: [
      transaction({ amount: 7_000, paymentMethod: "transfer" }),
      transaction({
        kind: "expense",
        amount: 2_500,
        paymentMethod: "transfer",
      }),
    ],
  });
  assert.equal(result.expectedBank, 14_500);
});

test("bekleyen POS banka hesabına erken yazılmaz", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 10_000,
    transactions: [
      transaction({
        amount: 5_000,
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "pending",
        settlementDate: "2026-07-12",
      }),
    ],
  });
  assert.equal(result.expectedBank, 10_000);
  assert.equal(result.expectedPosPending, 4_900);
});

test("yatan POS komisyon sonrası net tutarla bankaya eklenir", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 10_000,
    transactions: [
      transaction({
        amount: 5_000,
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "settled",
        settlementDate: "2026-07-12",
      }),
    ],
  });
  assert.equal(result.posSettlements, 4_900);
  assert.equal(result.expectedBank, 14_900);
  assert.equal(result.expectedPosPending, 0);
});

test("POS mutabakatında tahmin yerine ekstredeki gerçek net yatış kullanılır", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 10_000,
    transactions: [
      transaction({
        amount: 5_000,
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "settled",
        settlementDate: "2026-07-12",
        settledAmount: 4_875.5,
      }),
    ],
  });
  assert.equal(result.posSettlements, 4_875.5);
  assert.equal(result.expectedBank, 14_875.5);
});

test("otomatik POS gideri net yatışla ikinci kez bankadan düşmez", () => {
  const sale = transaction({
    id: "sale-1",
    amount: 5_000,
    paymentMethod: "card",
    posRate: 0.02,
    posStatus: "settled",
    settlementDate: "2026-07-12",
  });
  const fee = transaction({
    id: "fee-1",
    kind: "expense",
    amount: 100,
    paymentMethod: "transfer",
    operationType: "pos_commission",
    isAutomatic: true,
    sourceTransactionId: "sale-1",
    documentType: "pos_statement",
    documentRef: "POS-sale-1",
  });
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 10_000,
    transactions: [sale, fee],
  });
  assert.equal(result.expectedBank, 14_900);
  assert.equal(result.recognizedExpense, 100);
});

test("önceki ay satılan fakat bu ay yatan POS bu ay bankaya girer", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 10_000,
    transactions: [
      transaction({
        date: "2026-06-30",
        amount: 2_000,
        paymentMethod: "card",
        posRate: 0.025,
        posStatus: "settled",
        settlementDate: "2026-07-02",
      }),
    ],
  });
  assert.equal(result.income, 0);
  assert.equal(result.posSettlements, 1_950);
  assert.equal(result.expectedBank, 11_950);
});

test("ay sonundan sonra yatacak POS kapanışta bekleyen sayılır", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 0,
    transactions: [
      transaction({
        amount: 3_000,
        paymentMethod: "card",
        posRate: 0.02,
        posStatus: "settled",
        settlementDate: "2026-08-01",
      }),
    ],
  });
  assert.equal(result.expectedPosPending, 2_940);
  assert.equal(result.expectedBank, 0);
});

test("yatış tarihi olmayan kapandı işaretli POS veri uyarısı üretir", () => {
  const result = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 0,
    transactions: [
      transaction({
        paymentMethod: "card",
        posStatus: "settled",
        settlementDate: "",
      }),
    ],
  });
  assert.deepEqual(result.dataQualityFlags, [
    "settled_pos_missing_date",
  ]);
  assert.equal(result.expectedPosPending, 1_000);
});

test("mutabakat toleransı en az 10 TL ve bakiyenin binde biridir", () => {
  assert.equal(reconciliationTolerance(5_000), 10);
  assert.equal(reconciliationTolerance(50_000), 50);
});

test("kanal farkı dengeli, dikkat ve önemli olarak sınıflanır", () => {
  assert.equal(channelReconciliation(10_000, 10_008).status, "balanced");
  assert.equal(channelReconciliation(10_000, 10_050).status, "attention");
  assert.equal(channelReconciliation(10_000, 10_150).status, "material");
});

test("ay bitmeden kapanışa izin verilmez", () => {
  const summary = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 0,
    openingBank: 0,
    transactions: [],
  });
  const decision = assessMonthlyClose({
    summary,
    actualCash: 0,
    actualBank: 0,
    actualPosPending: 0,
    today: "2026-07-26",
  });
  assert.equal(decision.canClose, false);
  assert.ok(decision.blockers.includes("period_not_finished"));
});

test("tam eşleşen ay açıklamasız temiz kapanır", () => {
  const summary = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 1_000,
    openingBank: 2_000,
    transactions: [],
  });
  const decision = assessMonthlyClose({
    summary,
    actualCash: 1_000,
    actualBank: 2_000,
    actualPosPending: 0,
    today: "2026-07-31",
  });
  assert.equal(decision.canClose, true);
  assert.equal(decision.status, "closed");
});

test("farklı kapanışta gerekçe zorunludur ve gerekçeyle kapanır", () => {
  const summary = calculateMonthlyClose({
    period: "2026-07",
    openingCash: 1_000,
    openingBank: 2_000,
    transactions: [],
  });
  const missingNote = assessMonthlyClose({
    summary,
    actualCash: 800,
    actualBank: 2_000,
    actualPosPending: 0,
    today: "2026-07-31",
  });
  assert.equal(missingNote.canClose, false);
  assert.ok(missingNote.blockers.includes("variance_note_required"));

  const explained = assessMonthlyClose({
    summary,
    actualCash: 800,
    actualBank: 2_000,
    actualPosPending: 0,
    today: "2026-07-31",
    varianceNote: "Fiş kontrolü yapılacak.",
  });
  assert.equal(explained.canClose, true);
  assert.equal(explained.status, "closed_with_variance");
});

test("kapanmış dönem kilitli, yeniden açılmış dönem serbesttir", () => {
  assert.equal(
    isPeriodLocked("2026-07-15", [
      { period: "2026-07", status: "closed_with_variance" },
    ]),
    true,
  );
  assert.equal(
    isPeriodLocked("2026-07-15", [
      { period: "2026-07", status: "open" },
    ]),
    false,
  );
});
