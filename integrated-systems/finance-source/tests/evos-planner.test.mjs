import test from "node:test";
import assert from "node:assert/strict";
import { cashAndPurchasePlan, currentAccountStatement, parseEvosCsv, stockNeedBoard } from "../lib/evos-planner.mjs";

test("stok ihtiyacı gerçek kullanım, tedarik süresi ve büyüme ile öneri üretir", () => {
  const rows = stockNeedBoard({ today: "2026-08-13", historyDays: 90, leadDays: 5, safetyDays: 10,
    items: [{ id: "a", name: "Aşı", unit: "doz", quantity: 4, minimumQuantity: 5, unitCost: 120 }],
    movements: [{ itemId: "a", type: "use", quantity: 18, date: "2026-07-20" }],
    transactions: [{ kind: "income", amount: 120000, date: "2026-08-01" }, { kind: "income", amount: 100000, date: "2026-05-01" }] });
  assert.equal(rows[0].urgency, "critical");
  assert.ok(rows[0].recommendedQuantity > 0);
});

test("cari ekstre borç ve tarih-saatli tahsilatı tek bakiyede gösterir", () => {
  const result = currentAccountStatement({ owner: { name: "Damla Hanım" }, from: "2026-08-01", to: "2026-08-31", records: [{ id: "l1", counterparty: "Damla Hanım", detail: "Narin muayene", createdDate: "2026-08-02", originalAmount: 5000, payments: [{ id: "p1", date: "2026-08-13", createdAt: "2026-08-13T16:42:00+03:00", amount: 3000, method: "card" }] }] });
  assert.equal(result.movements.length, 2);
  assert.equal(result.totals.balance, 2000);
  assert.equal(result.title, "HASTA SAHİBİ CARİ HESAP EKSTRESİ");
});

test("geçmiş hasta CSV'si elle doldurulabilir satırlara ayrışır", () => {
  const rows = parseEvosCsv("sahip;telefon;hasta;tür\nDamla Hanım;555;Narin;Köpek\n");
  assert.equal(rows[0].sahip, "Damla Hanım");
  assert.equal(rows[0].hasta, "Narin");
});

test("nakit planı vadeli borç, alım ihtiyacı ve tahsilatı ayırır", () => {
  const plan = cashAndPurchasePlan({ today: "2026-08-13", daysAhead: 30,
    records: [{ type: "payable", dueDate: "2026-08-20", originalAmount: 10000, payments: [] }, { type: "receivable", dueDate: "2026-08-22", originalAmount: 4000, payments: [] }],
    recurring: [{ active: true, amount: 5000 }], needs: [{ urgency: "critical", estimatedBudget: 3000 }], transactions: [] });
  assert.equal(plan.committedOutflow, 18000);
  assert.equal(plan.expectedCollection, 4000);
});
