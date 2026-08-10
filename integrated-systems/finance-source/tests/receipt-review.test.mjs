import test from "node:test";
import assert from "node:assert/strict";

import { assertReceiptReadyToPost, extractReceiptCandidates, prepareReceiptReview } from "../lib/receipt-review.mjs";

test("fiş inceleme taslağı paket miktarını stok temel birimine çevirir ama kayıt oluşturmaz", () => {
  const review = prepareReceiptReview({
    supplier: "Örnek Market",
    documentDate: "2026-08-09",
    declaredTotal: 180,
    lines: [
      { name: "Tuvalet kağıdı 16'lı", purchaseQuantity: 2, total: 120 },
      { name: "Etil alkol %70 1 litre", purchaseQuantity: 1, total: 60 },
    ],
  });
  assert.equal(review.status, "ready_for_confirmation");
  assert.equal(review.lines[0].baseQuantity, 32);
  assert.equal(review.lines[1].baseQuantity, 1000);
  assert.equal(assertReceiptReadyToPost(review), true);
});

test("belirsiz ölçülü stok kalemi insan onayı olmadan post edilmez", () => {
  const review = prepareReceiptReview({
    declaredTotal: 90,
    lines: [{ name: "Sargı bezi 5 cm x 100", purchaseQuantity: 1, total: 90 }],
  });
  assert.equal(review.status, "needs_review");
  assert.throws(() => assertReceiptReadyToPost(review), /birim standardı onayı/);
});

test("OCR metninden yalnız olası kalemleri önerir; toplam satırını kalem yapmaz", () => {
  const rows = extractReceiptCandidates("Tuvalet kağıdı 16'lı 2 120,00 TL\nEtil alkol %70 1 litre 60,00 TL\nGENEL TOPLAM 180,00 TL");
  assert.deepEqual(rows, [
    { name: "Tuvalet kağıdı 16'lı", purchaseQuantity: 2, total: 120 },
    { name: "Etil alkol %70 1 litre", purchaseQuantity: 1, total: 60 },
  ]);
});
