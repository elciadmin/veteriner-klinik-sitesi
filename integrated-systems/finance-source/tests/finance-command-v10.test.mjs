import test from "node:test";
import assert from "node:assert/strict";
import { extractRecurrence, parseFinanceCommand } from "../lib/finance-command.mjs";

test("14 ayar altın alacağı miktar ve saflığıyla ayrıştırılır", () => {
  const parsed = parseFinanceCommand("10 gram 14 ayar altın Hasan Beyden alacağım var");
  assert.equal(parsed.intent, "new_receivable");
  assert.equal(parsed.denominationCode, "XAU_GRAM");
  assert.equal(parsed.denominationQuantity, 10);
  assert.equal(parsed.denominationKarat, 14);
  assert.equal(parsed.denominationPurity, 14 / 24);
  assert.ok(parsed.counterpartyQuery.includes("hasan bey"));
});

test("925 gümüş alacağı saflık ve gram bazında ayrıştırılır", () => {
  const parsed = parseFinanceCommand("250 gram 925 gümüş Ayşe Hanımdan alacağım var");
  assert.equal(parsed.denominationCode, "XAG_GRAM");
  assert.equal(parsed.denominationQuantity, 250);
  assert.equal(parsed.denominationMillesimal, 925);
  assert.equal(parsed.denominationPurity, 0.925);
});

test("döviz borcu kendi para biriminde miktar olarak tutulur", () => {
  const parsed = parseFinanceCommand("Hasvet 1000 USD borç yaz");
  assert.equal(parsed.intent, "new_payable");
  assert.equal(parsed.denominationCode, "USD");
  assert.equal(parsed.denominationQuantity, 1000);
});

test("aylık sabit gider doğal dilden tekrar kuralına dönüşür", () => {
  const parsed = parseFinanceCommand("Kira 25000 TL her ayın 1'i gider");
  assert.equal(parsed.intent, "recurring_expense");
  assert.equal(parsed.amount, 25000);
  assert.deepEqual(parsed.recurrence, { kind: "monthly", interval: 1, dayOfMonth: 1, businessDayRule: "none" });
});

test("haftanın günü ve son iş günü tekrarları anlaşılır", () => {
  assert.deepEqual(extractRecurrence("her pazartesi"), { kind: "weekly", interval: 1, dayOfWeek: 1, businessDayRule: "none" });
  assert.deepEqual(extractRecurrence("internet gideri her ay son iş günü"), { kind: "monthly", interval: 1, dayOfMonth: 31, businessDayRule: "last_business_day" });
});

test("yatırım borcu taksit sayısını ve sınıfını taşır", () => {
  const parsed = parseFinanceCommand("Ultrason cihazı 180000 TL borç yaz 6 taksit");
  assert.equal(parsed.intent, "installment_payable");
  assert.equal(parsed.installmentCount, 6);
  assert.equal(parsed.businessClass, "investment");
});
