import test from "node:test";
import assert from "node:assert/strict";

import { assessFinanceIntegrity } from "../lib/integrity.mjs";

test("sağlıklı veri için denetim bulgusu oluşmaz", () => {
  const result = assessFinanceIntegrity({
    transactions: [{ id: "t-1", amount: 100, description: "Muayene" }],
    inventory: [{ id: "i-1", name: "Sarf", quantity: 2 }],
    records: [{ id: "r-1", counterparty: "Tedarikçi", originalAmount: 200, payments: [{ amount: 100 }] }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.critical, 0);
});

test("denetim yinelenen işlem, negatif stok ve fazla ödemeyi bildirir", () => {
  const result = assessFinanceIntegrity({
    transactions: [{ id: "t-1", amount: 100 }, { id: "t-1", amount: 100 }],
    inventory: [{ id: "i-1", name: "İlaç", quantity: -1 }],
    records: [{ id: "r-1", counterparty: "Tedarikçi", originalAmount: 100, payments: [{ amount: 120 }] }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.critical, 3);
  assert.deepEqual(result.findings.map((item) => item.code).sort(), ["duplicate_transaction", "negative_stock", "overpaid_ledger"]);
});
