export function quickReceiptTotal(lines) {
  if (!Array.isArray(lines)) return 0;
  return Math.round(
    lines.reduce((sum, line) => {
      const amount = Number(line?.amount ?? 0);
      return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
    }, 0) * 100,
  ) / 100;
}

export function receiptTotalsMatch(lines, declaredTotal, tolerance = 0.01) {
  const declared = Number(declaredTotal);
  if (!Number.isFinite(declared) || declared <= 0) return true;
  return Math.abs(quickReceiptTotal(lines) - declared) <= tolerance;
}

export function activeReceiptLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.filter((line) => {
    const name = String(line?.itemName ?? '').trim();
    const amount = Number(line?.amount ?? 0);
    return Boolean(name) || (Number.isFinite(amount) && amount > 0);
  });
}

export function validReceiptLineCount(lines, maxLines = 50) {
  const active = activeReceiptLines(lines);
  return active.length >= 1 && active.length <= maxLines;
}
