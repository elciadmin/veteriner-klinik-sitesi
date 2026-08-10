import { suggestStandardization } from "./stock-units.mjs";

function foldTurkish(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export function normalizeProductAlias(value) {
  return foldTurkish(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:adet|paket|kutu|sise|şise)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(left, right) {
  const a = new Set(normalizeProductAlias(left).split(" ").filter(Boolean));
  const b = new Set(normalizeProductAlias(right).split(" ").filter(Boolean));
  const overlap = [...a].filter((token) => b.has(token)).length;
  return a.size + b.size === 0 ? 0 : overlap / new Set([...a, ...b]).size;
}

function allAliases(definition) {
  return [definition.canonicalName, ...(definition.aliases ?? [])]
    .map(normalizeProductAlias)
    .filter(Boolean);
}

/**
 * Exact aliases may be attached without confirmation. A merely similar label
 * remains a suggestion: quantity/unit changes must never silently merge stock.
 */
export function findProductSuggestion(rawName, definitions = []) {
  const standard = suggestStandardization(rawName);
  if (!standard.requiresConfirmation) {
    const known = definitions.find((definition) => (
      definition.productFamily === standard.productFamily
      && definition.baseUnit === standard.baseUnit
      && JSON.stringify(definition.attributes ?? {}) === JSON.stringify(standard.attributes ?? {})
    ));
    return {
      kind: known ? "exact" : "new_standard",
      confidence: 1,
      definition: known ?? null,
      standard,
    };
  }

  const normalized = normalizeProductAlias(rawName);
  let best = null;
  for (const definition of definitions) {
    for (const alias of allAliases(definition)) {
      const exactAlias = alias === normalized;
      const score = exactAlias ? 1 : tokenSimilarity(alias, normalized);
      if (!best || score > best.score) best = { definition, score, exactAlias };
    }
  }
  if (best?.exactAlias) return { kind: "exact", confidence: 1, definition: best.definition, standard: null };
  if (best && best.score >= 0.75) return { kind: "suggestion", confidence: best.score, definition: best.definition, standard: null };
  return { kind: "new_standard", confidence: 0, definition: null, standard: null };
}

export function addProductAlias(definition, rawAlias) {
  const normalized = normalizeProductAlias(rawAlias);
  if (!normalized) throw new Error("Alternatif ürün adı boş olamaz.");
  const aliases = Array.from(new Set([...(definition.aliases ?? []), rawAlias.trim()]))
    .filter((alias) => normalizeProductAlias(alias));
  return { ...definition, aliases };
}
