import test from "node:test";
import assert from "node:assert/strict";

import {
  datePlusDays,
  datePlusBusinessDays,
  expectedPosNet,
  hasCashEffect,
  hasEconomicEffect,
  normalizeLedgerPaymentMethod,
  resolvedPosNet,
} from "../lib/financial-core.mjs";
import {
  dailyOperationsSummary,
  operationsStatistics,
} from "../lib/operations.mjs";
import { calculateMonthlyClose } from "../lib/monthly-close.mjs";

function transaction(overrides = {}) {
  return {
    id: "tx-1",
    date: "2026-07-10",
    time: "10:00",
    kind: "income",
    category: "Muayene",
    description: "İşlem",
    counterparty: "Test",
    amount: 1_000,
    paymentMethod: "cash",
    documentType: "receipt",
    documentRef: "R-1",
    vatRate: 0.2,
    posRate: 0,
    ...overrides,
  };
}

test("varsayılan kayıt hem ekonomik hem para etkisi taşır", () => {
  const row = transaction();
  assert.equal(hasEconomicEffect(row), true);
  assert.equal(hasCashEffect(row), true);
});

test("tahsilat yalnız para hareketi olarak satışa tekrar eklenmez", () => {
  const row = transaction({
    operationType: "receivable_collection",
    postingMode: "cash_only",
  });
  const summary = dailyOperationsSummary({
    transactions: [row],
    date: row.date,
    openingCash: 500,
  });
  assert.equal(summary.income, 0);
  assert.equal(summary.collectionCash, 1_000);
  assert.equal(summary.expectedCash, 1_500);
  assert.equal(summary.outputVat, 0);
});

test("borç ödemesi gideri tekrar büyütmeden bankayı azaltır", () => {
  const row = transaction({
    kind: "expense",
    operationType: "payable_payment",
    postingMode: "cash_only",
    paymentMethod: "transfer",
    vatRate: 0,
  });
  const summary = calculateMonthlyClose({
    transactions: [row],
    period: "2026-07",
    openingCash: 0,
    openingBank: 2_000,
  });
  assert.equal(summary.recognizedExpense, 0);
  assert.equal(summary.liabilityPaymentCash, 1_000);
  assert.equal(summary.expectedBank, 1_000);
});

test("stok tüketim maliyeti kârı etkiler ama kasa ve bankayı azaltmaz", () => {
  const row = transaction({
    kind: "expense",
    operationType: "inventory_usage",
    postingMode: "economic_only",
    paymentMethod: "accrual",
    documentType: "stock_record",
    documentRef: "SM-1",
    vatRate: 0,
  });
  const summary = calculateMonthlyClose({
    transactions: [row],
    period: "2026-07",
    openingCash: 500,
    openingBank: 2_000,
  });
  assert.equal(summary.recognizedExpense, 1_000);
  assert.equal(summary.expectedCash, 500);
  assert.equal(summary.expectedBank, 2_000);
});

test("stok alımı nakdi ve indirilecek KDVyi etkiler, dönem giderini etkilemez", () => {
  const row = transaction({
    kind: "expense",
    operationType: "inventory_purchase",
    postingMode: "cash_only",
  });
  const summary = operationsStatistics({
    transactions: [row],
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  });
  assert.equal(summary.documentedExpense, 0);
  assert.equal(summary.assetPurchaseCash, 1_000);
  assert.equal(summary.deductibleInputVat, 166.67);
  assert.equal(summary.cashMovement, -1_000);
});

test("POS beklenen neti oranla, gerçekleşen neti banka ekstresiyle çözer", () => {
  const row = transaction({
    amount: 3_000,
    paymentMethod: "card",
    posRate: 0.02,
    posStatus: "pending",
  });
  assert.equal(expectedPosNet(row), 2_940);
  assert.equal(
    resolvedPosNet({
      ...row,
      posStatus: "settled",
      settledAmount: 2_935.5,
    }),
    2_935.5,
  );
});

test("geçersiz POS oranı reddedilir", () => {
  assert.throws(
    () => expectedPosNet(transaction({ posRate: 1 })),
    /POS oranı/,
  );
});

test("cari ödeme yöntemleri kontrollü kanallara çevrilir", () => {
  assert.equal(normalizeLedgerPaymentMethod("Nakit", "receivable"), "cash");
  assert.equal(normalizeLedgerPaymentMethod("Havale", "payable"), "transfer");
  assert.equal(normalizeLedgerPaymentMethod("Kart / POS", "receivable"), "card");
});

test("kartla borç ödeme kart hesabı olmadan borç kapatmaz", () => {
  assert.throws(
    () => normalizeLedgerPaymentMethod("Kredi kartı", "payable"),
    /yeni bir kart borcu/,
  );
});

test("beklenen POS tarihi ay ve yıl sınırını doğru aşar", () => {
  assert.equal(datePlusDays("2026-12-31", 2), "2027-01-02");
});

test("POS beklenen yatışı hafta sonunu banka günü saymaz", () => {
  assert.equal(datePlusBusinessDays("2026-07-24", 2), "2026-07-28");
});
