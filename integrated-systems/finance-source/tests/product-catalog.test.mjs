import test from "node:test";
import assert from "node:assert/strict";

import { addProductAlias, findProductSuggestion, normalizeProductAlias } from "../lib/product-catalog.mjs";

test("alternatif yazımlar normalleşir ve aynı ürün kartını kesin önerir", () => {
  const definition = {
    id: "paper",
    canonicalName: "Tuvalet kâğıdı",
    productFamily: "toilet-paper",
    baseUnit: "roll",
    attributes: {},
    aliases: ["T. kağıdı"],
  };
  assert.equal(normalizeProductAlias("T. Kağıdı"), "t kagidi");
  const result = findProductSuggestion("Tuvalet kağıdı 32li", [definition]);
  assert.equal(result.kind, "exact");
  assert.equal(result.definition?.id, "paper");
});

test("benzer serbest yazım otomatik birleştirilmez; kullanıcıya önerilir", () => {
  const result = findProductSuggestion("mavi cerrahi eldiven", [{
    id: "glove",
    canonicalName: "Cerrahi eldiven mavi",
    productFamily: "glove",
    baseUnit: "piece",
    aliases: [],
  }]);
  assert.equal(result.kind, "suggestion");
  assert.equal(result.definition?.id, "glove");
});

test("yeni fiş adı ürün kartına alternatif ad olarak eklenir", () => {
  const next = addProductAlias({ canonicalName: "Alkol / dezenfektan", aliases: ["%70 alkol"] }, "Dezenfektan alkol");
  assert.deepEqual(next.aliases, ["%70 alkol", "Dezenfektan alkol"]);
});
