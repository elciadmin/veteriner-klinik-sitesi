"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { receiptQuantityToBase, suggestStandardization, weightedAverageCost } from "@/lib/stock-units.mjs";
import { findProductSuggestion, normalizeProductAlias } from "@/lib/product-catalog.mjs";

import type {
  ClinicTransaction,
  InventoryItem,
  PaymentChannel,
  StockMovement,
} from "./operational-modules";
import type { QuickReceiptPayload } from "./quick-daily-view";

type WorkspaceView =
  | "today"
  | "work"
  | "records"
  | "cash"
  | "reports"
  | "settings"
  | "daily"
  | "ledger"
  | "debts"
  | "recurring"
  | "inventory"
  | "calendar"
  | "decision"
  | "import"
  | "checks";

type RecordLike = {
  id: string;
  type: "receivable" | "payable";
  counterparty: string;
  dueDate: string;
  originalAmount: number;
  payments: Array<{ amount: number; status?: "cancelled" }>;
};

type Task = {
  id: string;
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  action: string;
  view: WorkspaceView;
};

type ReceiptCandidate = {
  id: string;
  name: string;
  purchaseQuantity: number;
  total: number;
  stockTracked: boolean;
  baseUnit: "piece" | "roll" | "tablet" | "ml" | "gram" | "cm";
  purchaseUnit: string;
  unitsPerPackage: number;
};

type ProductDefinition = {
  id: string;
  canonicalName: string;
  productFamily: string;
  baseUnit: string;
  attributes: Record<string, unknown>;
  aliases: string[];
  status?: string;
};

const BASE_UNIT_LABELS: Record<ReceiptCandidate["baseUnit"], string> = {
  piece: "adet",
  roll: "rulo",
  tablet: "tablet",
  ml: "ml",
  gram: "gram",
  cm: "cm",
};

function customProductId(name: string) {
  const slug = normalizeProductAlias(name).replaceAll(" ", "-").slice(0, 60) || "urun";
  return `product-custom-${slug}`;
}

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function timeInIstanbul() {
  const pieces = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).formatToParts(new Date());
  const hour = pieces.find((piece) => piece.type === "hour")?.value ?? "00";
  const minute = pieces.find((piece) => piece.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function dayDifference(today: string, target: string) {
  const start = new Date(`${today}T00:00:00Z`).getTime();
  const end = new Date(`${target}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function remaining(record: RecordLike) {
  const paid = record.payments
    .filter((payment) => payment.status !== "cancelled")
    .reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max(0, record.originalAmount - paid);
}

function createTasks({
  today,
  transactions,
  inventory,
  records,
}: {
  today: string;
  transactions: ClinicTransaction[];
  inventory: InventoryItem[];
  records: RecordLike[];
}) {
  const tasks: Task[] = [];

  for (const record of records) {
    const balance = remaining(record);
    if (balance <= 0 || !record.dueDate) continue;
    const days = dayDifference(today, record.dueDate);
    if (days < 0) {
      tasks.push({
        id: `overdue-${record.id}`,
        tone: "danger",
        title: `${record.counterparty} · ${record.type === "payable" ? "borç" : "alacak"} gecikti`,
        detail: `${Math.abs(days)} gün gecikmiş · ${money.format(balance)} kalan`,
        action: record.type === "payable" ? "Ödemeyi aç" : "Tahsilatı aç",
        view: record.type === "payable" ? "debts" : "ledger",
      });
    } else if (days <= 7) {
      tasks.push({
        id: `due-${record.id}`,
        tone: "warning",
        title: `${record.counterparty} · vade ${days === 0 ? "bugün" : `${days} gün sonra`}`,
        detail: `${record.type === "payable" ? "Ödenecek" : "Tahsil edilecek"} ${money.format(balance)}`,
        action: "Kaydı aç",
        view: record.type === "payable" ? "debts" : "ledger",
      });
    }
  }

  for (const transaction of transactions) {
    if (
      transaction.kind === "expense" &&
      transaction.operationType !== "pos_commission" &&
      !transaction.status &&
      (transaction.documentType === "none" || !transaction.documentRef)
    ) {
      tasks.push({
        id: `document-${transaction.id}`,
        tone: "warning",
        title: "Belge tamamlanmayı bekliyor",
        detail: `${transaction.description} · ${money.format(transaction.amount)}`,
        action: "Gider kaydını aç",
        view: "daily",
      });
    }
    if (
      transaction.kind === "income" &&
      transaction.paymentMethod === "card" &&
      transaction.posStatus !== "settled" &&
      !transaction.status
    ) {
      tasks.push({
        id: `pos-${transaction.id}`,
        tone: "info",
        title: "POS yatışı bekleniyor",
        detail: `${transaction.description} · ${money.format(transaction.amount)}`,
        action: "POS'u kontrol et",
        view: "cash",
      });
    }
  }

  for (const item of inventory) {
    if (item.quantity <= item.minimumQuantity) {
      tasks.push({
        id: `stock-${item.id}`,
        tone: "danger",
        title: `Kritik stok · ${item.name}`,
        detail: `${item.quantity} ${item.unit} kaldı · alt sınır ${item.minimumQuantity}`,
        action: "Stoku aç",
        view: "inventory",
      });
    }
  }

  const rank = { danger: 0, warning: 1, info: 2 };
  return tasks.sort((left, right) => rank[left.tone] - rank[right.tone]);
}

function PaymentChoice({
  value,
  onChange,
}: {
  value: PaymentChannel;
  onChange: (value: PaymentChannel) => void;
}) {
  const choices: Array<[PaymentChannel, string]> = [
    ["cash", "Nakit"],
    ["card", "Kart / POS"],
    ["transfer", "Havale"],
  ];
  return (
    <div className="workspace-choice" aria-label="Ödeme biçimi">
      {choices.map(([id, label]) => (
        <button
          className={value === id ? "active" : ""}
          key={id}
          onClick={() => onChange(id)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ReceiptScanner({
  today,
  inventory,
  productDefinitions,
  onSave,
  onClose,
}: {
  today: string;
  inventory: InventoryItem[];
  productDefinitions: ProductDefinition[];
  onSave: (payload: QuickReceiptPayload) => Promise<boolean> | boolean;
  onClose: () => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>("cash");
  const [lines, setLines] = useState<ReceiptCandidate[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateLine(id: string, update: Partial<ReceiptCandidate>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...update } : line));
  }

  async function scan(file: File | null) {
    if (!file) return;
    setStatus("Fiş okunuyor… Görsel saklanmayacak.");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/receipt-document", { method: "POST", body: form });
      const result = await response.json() as { ok?: boolean; candidates?: Array<{ name: string; purchaseQuantity: number; total: number }>; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Fiş okunamadı.");
      const candidates = result.candidates ?? [];
      setLines(candidates.map((line) => {
        const suggestion = suggestStandardization(line.name);
        return {
          id: crypto.randomUUID(),
          name: line.name,
          purchaseQuantity: line.purchaseQuantity || 1,
          total: line.total,
          stockTracked: !suggestion.requiresConfirmation,
          baseUnit: suggestion.requiresConfirmation ? "piece" : suggestion.baseUnit,
          purchaseUnit: suggestion.requiresConfirmation ? "adet" : suggestion.purchaseUnit,
          unitsPerPackage: suggestion.requiresConfirmation ? 1 : suggestion.baseUnitsPerPurchaseUnit,
        };
      }));
      setStatus(candidates.length ? `${candidates.length} kalem bulundu. Tutar ve stok seçimini kontrol et.` : "Kalemler okunamadı; aşağıya ekleyebilirsin.");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Fiş okunamadı.");
      setStatus("");
    }
  }

  function addLine() {
    setLines((current) => [...current, { id: crypto.randomUUID(), name: "", purchaseQuantity: 1, total: 0, stockTracked: false, baseUnit: "piece", purchaseUnit: "adet", unitsPerPackage: 1 }]);
  }

  async function confirm() {
    const validLines = lines.filter((line) => line.name.trim() && Number(line.total) > 0 && Number(line.purchaseQuantity) > 0);
    if (!validLines.length) {
      setError("Onaylanacak en az bir kalem gerekir.");
      return;
    }
    const receiptId = `quick-receipt-${crypto.randomUUID()}`;
    try {
      const payloadLines = validLines.map((line, index) => {
        const productMatch = findProductSuggestion(line.name, productDefinitions);
        const suggestion = productMatch.standard ?? suggestStandardization(line.name);
        const stockTracked = line.stockTracked;
        const definition = stockTracked
          ? productMatch.definition
            ? {
                id: productMatch.definition.id,
                canonicalName: productMatch.definition.canonicalName,
                productFamily: productMatch.definition.productFamily,
                baseUnit: productMatch.definition.baseUnit,
                attributes: productMatch.definition.attributes,
                aliases: Array.from(new Set([...productMatch.definition.aliases, line.name.trim()])),
              }
            : suggestion.requiresConfirmation
              ? {
                  id: customProductId(line.name),
                  canonicalName: line.name.trim(),
                  productFamily: `custom-${normalizeProductAlias(line.name).replaceAll(" ", "-") || "urun"}`,
                  baseUnit: line.baseUnit,
                  attributes: {},
                  aliases: [line.name.trim()],
                }
              : {
                  id: `product-${suggestion.productFamily}-${suggestion.baseUnit}-${JSON.stringify(suggestion.attributes).replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "") || "standard"}`,
                  canonicalName: suggestion.suggestedName,
                  productFamily: suggestion.productFamily,
                  baseUnit: suggestion.baseUnit,
                  attributes: suggestion.attributes,
                  aliases: [line.name.trim(), suggestion.suggestedName],
                }
          : undefined;
        const unitDefinition = stockTracked
          ? suggestion.requiresConfirmation || productMatch.definition
            ? {
                baseUnit: definition!.baseUnit,
                purchaseUnit: line.purchaseUnit.trim() || "adet",
                baseUnitsPerPurchaseUnit: Number(line.unitsPerPackage),
                attributes: definition!.attributes,
                aliases: definition!.aliases,
              }
            : suggestion
          : undefined;
        if (stockTracked && (!unitDefinition || !Number.isFinite(unitDefinition.baseUnitsPerPurchaseUnit) || unitDefinition.baseUnitsPerPurchaseUnit <= 0)) {
          throw new Error(`“${line.name}” için satın alma biriminin temel stok karşılığını gir.`);
        }
        const baseQuantity = stockTracked
          ? receiptQuantityToBase({ purchaseQuantity: line.purchaseQuantity, definition: unitDefinition! })
          : 0;
        const itemName = stockTracked ? definition!.canonicalName : line.name.trim();
        const existing = stockTracked
          ? inventory.find((item) => item.productDefinitionId === definition!.id)
            ?? inventory.find((item) => item.name.toLocaleLowerCase("tr-TR") === itemName.toLocaleLowerCase("tr-TR") && item.unit === definition!.baseUnit)
          : undefined;
        const incomingUnitCost = stockTracked ? Number(line.total) / baseQuantity : 0;
        const item: InventoryItem | undefined = stockTracked ? {
          id: existing?.id || `stock-${crypto.randomUUID()}`,
          name: itemName,
          category: "Sarf / market",
          unit: definition!.baseUnit,
          purchaseUnit: unitDefinition!.purchaseUnit,
          unitsPerPackage: unitDefinition!.baseUnitsPerPurchaseUnit,
          quantity: Number(existing?.quantity || 0) + baseQuantity,
          minimumQuantity: Number(existing?.minimumQuantity || 0),
          unitCost: weightedAverageCost({
            currentQuantity: Number(existing?.quantity || 0),
            currentUnitCost: Number(existing?.unitCost || 0),
            incomingQuantity: baseQuantity,
            incomingUnitCost,
          }),
          supplier: supplier.trim() || existing?.supplier || "Market",
          lot: existing?.lot || "",
          expiryDate: existing?.expiryDate || "",
          productDefinitionId: definition!.id,
          baseUnit: definition!.baseUnit,
          baseUnitsPerPurchaseUnit: unitDefinition!.baseUnitsPerPurchaseUnit,
          attributesJson: JSON.stringify(definition!.attributes),
        } : undefined;
        const transactionId = `receipt-line-${receiptId}-${index + 1}`;
        const transaction: ClinicTransaction = {
          id: transactionId,
          date: today,
          time: timeInIstanbul(),
          kind: "expense",
          category: stockTracked ? "İlaç / sarf" : "Market / genel gider",
          description: line.name.trim(),
          counterparty: supplier.trim() || "Market",
          operationType: stockTracked ? "inventory_purchase" : "overhead",
          costBehavior: "variable",
          amount: Number(line.total),
          paymentMethod,
          documentType: "receipt",
          documentRef: receiptId,
          vatRate: 0,
          postingMode: "economic_and_cash",
          sourceModule: "quick_receipt",
          sourceRecordId: receiptId,
        };
        const movement: StockMovement | undefined = item ? {
          id: `movement-${transactionId}`,
          itemId: item.id,
          itemName: item.name,
          date: today,
          type: "purchase",
          quantity: baseQuantity,
          unitCost: incomingUnitCost,
          packageCount: line.purchaseQuantity,
          unitsPerPackage: unitDefinition!.baseUnitsPerPurchaseUnit,
          totalCost: Number(line.total),
          documentType: "receipt",
          documentRef: receiptId,
          transactionId,
          note: "Fiş tarama sonrası kullanıcı onayı",
        } : undefined;
        return { transaction, item, movement, productDefinition: definition };
      });
      setSaving(true);
      const saved = await onSave({ receiptId, lines: payloadLines });
      setSaving(false);
      if (!saved) throw new Error("Fiş kaydedilemedi; hiçbir satır yazılmadı.");
      onClose();
    } catch (confirmError) {
      setSaving(false);
      setError(confirmError instanceof Error ? confirmError.message : "Fiş kaydedilemedi.");
    }
  }

  const total = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
  return (
    <section className="workspace-receipt panel">
      <div className="panel-head"><div><span className="eyebrow">Fiş tarama · görsel saklanmaz</span><h2>Market fişini kalemlere dönüştür</h2><p>Fotoğraf yalnız okunur; onaydan sonra yalnız düzenlenmiş kalem verileri kaydedilir.</p></div><button className="text-button" onClick={onClose} type="button">Kapat</button></div>
      <div className="workspace-receipt-controls">
        <label className="workspace-file-button"><span>Fiş fotoğrafı / PDF seç</span><input accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(event) => scan(event.target.files?.[0] ?? null)} type="file" /></label>
        <label><span>Tedarikçi <em>isteğe bağlı</em></span><input onChange={(event) => setSupplier(event.target.value)} placeholder="Market adı" value={supplier} /></label>
        <div><span>Ödeme</span><PaymentChoice onChange={setPaymentMethod} value={paymentMethod} /></div>
      </div>
      {status ? <p className="workspace-receipt-status">{status}</p> : null}
      <div className="workspace-receipt-lines">
        {lines.map((line) => {
          const productMatch = findProductSuggestion(line.name, productDefinitions);
          const suggestion = productMatch.standard ?? suggestStandardization(line.name);
          return <div className="workspace-receipt-line" key={line.id}>
            <input aria-label="Kalem adı" onChange={(event) => updateLine(line.id, { name: event.target.value })} placeholder="Kalem adı" value={line.name} />
            <input aria-label="Fişteki miktar" inputMode="decimal" min="0.01" onChange={(event) => updateLine(line.id, { purchaseQuantity: Number(event.target.value) })} step="0.01" type="number" value={line.purchaseQuantity} />
            <input aria-label="Kalem tutarı" inputMode="decimal" min="0.01" onChange={(event) => updateLine(line.id, { total: Number(event.target.value) })} step="0.01" type="number" value={line.total} />
            <label className="workspace-stock-toggle"><input checked={line.stockTracked} onChange={(event) => updateLine(line.id, { stockTracked: event.target.checked })} type="checkbox" />Stok</label>
            {line.stockTracked && suggestion.requiresConfirmation ? <><select aria-label="Temel stok birimi" onChange={(event) => updateLine(line.id, { baseUnit: event.target.value as ReceiptCandidate["baseUnit"] })} value={line.baseUnit}>{Object.entries(BASE_UNIT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="Bir paketteki temel birim" inputMode="decimal" min="0.01" onChange={(event) => updateLine(line.id, { unitsPerPackage: Number(event.target.value) })} step="0.01" title="Örn. 8'li paket için 8" type="number" value={line.unitsPerPackage} /><input aria-label="Satın alma birimi" onChange={(event) => updateLine(line.id, { purchaseUnit: event.target.value })} placeholder="paket" value={line.purchaseUnit} /></> : null}
            <small>{line.stockTracked ? (productMatch.kind === "suggestion" ? `Öneri: ${productMatch.definition?.canonicalName} · onayla` : suggestion.requiresConfirmation ? `Yeni ürün kartı → ${BASE_UNIT_LABELS[line.baseUnit]}` : `→ ${suggestion.suggestedName} · ${suggestion.baseUnit}`) : "Gider"}</small>
            <button aria-label="Kalemi kaldır" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} type="button">×</button>
          </div>;
        })}
      </div>
      <div className="workspace-receipt-foot"><button className="workspace-secondary" onClick={addLine} type="button">+ Kalem ekle</button><strong>Fiş toplamı: {money.format(total)}</strong><button className="workspace-save expense" disabled={saving} onClick={confirm} type="button">{saving ? "Kaydediliyor…" : "Kalemleri onayla ve kaydet"}</button></div>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}

function QuickEntry({
  today,
  inventory,
  productDefinitions,
  onSave,
  onUndo,
  onSaveReceipt,
  onMore,
}: {
  today: string;
  inventory: InventoryItem[];
  productDefinitions: ProductDefinition[];
  onSave: (transaction: ClinicTransaction) => Promise<boolean> | boolean;
  onUndo: (transaction: ClinicTransaction) => Promise<boolean> | boolean;
  onSaveReceipt: (payload: QuickReceiptPayload) => Promise<boolean> | boolean;
  onMore: () => void;
}) {
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [label, setLabel] = useState("Muayene");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>("cash");
  const [counterparty, setCounterparty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<ClinicTransaction | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const categories = kind === "income"
    ? ["Muayene", "Tedavi", "Aşı ve parazit", "Laboratuvar", "Cerrahi", "Ürün satışı", "Diğer gelir"]
    : ["İlaç / sarf", "Kira", "Personel", "Fatura", "Muhasebe", "Temizlik", "Diğer gider"];

  useEffect(() => {
    setLabel(kind === "income" ? "Muayene" : "Diğer gider");
    setError("");
  }, [kind]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount.replace(",", "."));
    if (!label.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Açıklama ve sıfırdan büyük tutar girin.");
      return;
    }
    setSaving(true);
    setError("");
    const transaction: ClinicTransaction = {
      id: `quick-workspace-${crypto.randomUUID()}`,
      date: today,
      time: timeInIstanbul(),
      kind,
      category: label.trim(),
      description: label.trim(),
      counterparty: counterparty.trim() || (kind === "income" ? "Genel klinik geliri" : "Karşı taraf belirtilmedi"),
      operationType: kind === "income" ? "service" : "overhead",
      costBehavior: kind === "income" ? "non_expense" : "variable",
      amount: numericAmount,
      paymentMethod,
      documentType: kind === "expense" ? "none" : "receipt",
      documentRef: "",
      vatRate: 0,
      postingMode: "economic_and_cash",
      sourceModule: "workspace_quick_entry",
    };
    const result = await onSave(transaction);
    setSaving(false);
    if (!result) {
      setError("Kayıt kaydedilemedi; hiçbir veri değişmedi.");
      return;
    }
    setAmount("");
    setCounterparty("");
    setUndo(transaction);
  }

  async function undoLast() {
    if (!undo) return;
    const result = await onUndo(undo);
    if (result) setUndo(null);
    else setError("Geri alma tamamlanamadı. Kayıtlar ekranından düzeltme yapın.");
  }

  return (
    <section className="workspace-entry panel">
      <div className="workspace-entry-head">
        <div>
          <span className="eyebrow">Hızlı kayıt · 30 saniye</span>
          <h2>Şimdi ne kaydediyorsun?</h2>
        </div>
        <div className="workspace-entry-actions">
          {kind === "expense" ? <button className="text-button" onClick={() => setScannerOpen(true)} type="button">Fişi tara</button> : null}
          <button className="text-button" onClick={onMore} type="button">Ayrıntılı kayıt</button>
        </div>
      </div>
      <div className="workspace-kind-tabs" role="tablist">
        <button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")} type="button">+ Gelir</button>
        <button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")} type="button">− Gider</button>
      </div>
      <form className="workspace-entry-form" onSubmit={submit}>
        <label>
          <span>{kind === "income" ? "İşlem" : "Gider açıklaması"}</span>
          <input list="workspace-categories" onChange={(event) => setLabel(event.target.value)} value={label} />
          <datalist id="workspace-categories">
            {categories.map((category) => <option key={category} value={category} />)}
          </datalist>
        </label>
        <label>
          <span>Tutar</span>
          <input autoFocus inputMode="decimal" min="0.01" onChange={(event) => setAmount(event.target.value)} placeholder="0,00" step="0.01" type="number" value={amount} />
        </label>
        <div className="workspace-entry-payment">
          <span>Ödeme</span>
          <PaymentChoice onChange={setPaymentMethod} value={paymentMethod} />
        </div>
        <label className="workspace-optional">
          <span>Kimden / kime <em>isteğe bağlı</em></span>
          <input onChange={(event) => setCounterparty(event.target.value)} placeholder={kind === "income" ? "Genel klinik geliri" : "Tedarikçi"} value={counterparty} />
        </label>
        <button className={`workspace-save ${kind}`} disabled={saving} type="submit">
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
      {undo ? <div className="workspace-undo" role="status"><span>Kaydedildi. 10 saniye içinde geri alabilirsin.</span><button onClick={undoLast} type="button">Geri al</button></div> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {scannerOpen ? <ReceiptScanner inventory={inventory} productDefinitions={productDefinitions} onClose={() => setScannerOpen(false)} onSave={onSaveReceipt} today={today} /> : null}
    </section>
  );
}

function TaskList({
  tasks,
  onNavigate,
  limit,
}: {
  tasks: Task[];
  onNavigate: (view: WorkspaceView) => void;
  limit?: number;
}) {
  const shown = typeof limit === "number" ? tasks.slice(0, limit) : tasks;
  if (!shown.length) {
    return <div className="workspace-empty"><strong>Bugün için acil finans işi yok.</strong><span>İlk kayıt veya planlı vade geldiğinde işler burada toplanır.</span></div>;
  }
  return (
    <div className="workspace-task-list">
      {shown.map((task) => (
        <button className={`workspace-task ${task.tone}`} key={task.id} onClick={() => onNavigate(task.view)} type="button">
          <span className="workspace-task-mark">{task.tone === "danger" ? "!" : task.tone === "warning" ? "•" : "→"}</span>
          <span><strong>{task.title}</strong><small>{task.detail}</small></span>
          <span className="workspace-task-action">{task.action}</span>
        </button>
      ))}
    </div>
  );
}

export function TodayWorkspace({
  today,
  transactions,
  inventory,
  productDefinitions,
  records,
  onNavigate,
  onSave,
  onUndo,
  onSaveReceipt,
  dataMode,
}: {
  today: string;
  transactions: ClinicTransaction[];
  inventory: InventoryItem[];
  productDefinitions: ProductDefinition[];
  records: RecordLike[];
  onNavigate: (view: WorkspaceView) => void;
  onSave: (transaction: ClinicTransaction) => Promise<boolean> | boolean;
  onUndo: (transaction: ClinicTransaction) => Promise<boolean> | boolean;
  onSaveReceipt: (payload: QuickReceiptPayload) => Promise<boolean> | boolean;
  dataMode: "checking" | "empty" | "persistent" | "offline";
}) {
  const tasks = useMemo(() => createTasks({ today, transactions, inventory, records }), [today, transactions, inventory, records]);
  const documentedExpenses = transactions.filter((item) => item.kind === "expense" && item.documentType !== "none" && item.documentRef).length;
  const missingDocuments = transactions.filter((item) => item.kind === "expense" && (item.documentType === "none" || !item.documentRef)).length;
  const posPending = transactions.filter((item) => item.kind === "income" && item.paymentMethod === "card" && item.posStatus !== "settled").length;
  const stockAlerts = inventory.filter((item) => item.quantity <= item.minimumQuantity).length;
  const readiness = dataMode === "empty" ? "Kurulum bekliyor" : dataMode === "offline" ? "Bağlantı kontrolü" : tasks.length ? "Kontrol gerekli" : "Güncel";

  return (
    <>
      <section className="workspace-hero">
        <div>
          <span className="eyebrow">Bugün · klinik finans masası</span>
          <h1>Önce kaydet, sonra sistem sana ne yapacağını söylesin.</h1>
          <p>Gerçek kayıt yoksa tahmin üretmeyiz. Kasa, POS, belge ve vade işleri tek sırada görünür.</p>
        </div>
        <div className={`workspace-readiness ${dataMode}`}><span>Veri durumu</span><strong>{readiness}</strong><small>{dataMode === "empty" ? "İlk gerçek hareketi kaydet" : `${tasks.length} öncelikli iş`}</small></div>
      </section>
      <QuickEntry inventory={inventory} productDefinitions={productDefinitions} onMore={() => onNavigate("daily")} onSave={onSave} onSaveReceipt={onSaveReceipt} onUndo={onUndo} today={today} />
      <section className="workspace-grid">
        <article className="panel workspace-priorities">
          <div className="panel-head"><div><span className="eyebrow">İş merkezi</span><h2>Bugün önceliğin ne?</h2></div><button className="text-button" onClick={() => onNavigate("work")} type="button">Tüm işleri aç</button></div>
          <TaskList limit={5} onNavigate={onNavigate} tasks={tasks} />
        </article>
        <article className="panel workspace-quality">
          <div className="panel-head compact"><div><span className="eyebrow">Kayıt kalitesi</span><h2>Kontrol özeti</h2></div></div>
          <div className="workspace-quality-list">
            <span><i className={missingDocuments ? "warning" : "ok"} />Belge <strong>{missingDocuments ? `${missingDocuments} tamamlanacak` : "Eksik yok"}</strong></span>
            <span><i className={posPending ? "warning" : "ok"} />POS <strong>{posPending ? `${posPending} yatış bekliyor` : "Bekleyen yok"}</strong></span>
            <span><i className={stockAlerts ? "warning" : "ok"} />Stok <strong>{stockAlerts ? `${stockAlerts} uyarı` : "Kritik yok"}</strong></span>
            <span><i className={documentedExpenses || !transactions.length ? "ok" : "warning"} />Belgeliler <strong>{documentedExpenses} kayıt</strong></span>
          </div>
          <button className="workspace-secondary" onClick={() => onNavigate("records")} type="button">Kayıtlara git</button>
        </article>
      </section>
    </>
  );
}

export function WorkWorkspace({
  today,
  transactions,
  inventory,
  records,
  onNavigate,
}: {
  today: string;
  transactions: ClinicTransaction[];
  inventory: InventoryItem[];
  records: RecordLike[];
  onNavigate: (view: WorkspaceView) => void;
}) {
  const tasks = useMemo(() => createTasks({ today, transactions, inventory, records }), [today, transactions, inventory, records]);
  return <article className="panel workspace-all-tasks"><div className="panel-head"><div><span className="eyebrow">İş merkezi</span><h2>Vadesi, belgesi veya mutabakatı olan işler</h2><p>Öncelik: gecikmiş → bugün → bu hafta → kontrol bekleyenler.</p></div></div><TaskList onNavigate={onNavigate} tasks={tasks} /></article>;
}

export function RecordsWorkspace({
  transactionCount,
  receivableCount,
  payableCount,
  recurringCount,
  inventoryCount,
  onNavigate,
}: {
  transactionCount: number;
  receivableCount: number;
  payableCount: number;
  recurringCount: number;
  inventoryCount: number;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const rows: Array<{ view: WorkspaceView; title: string; detail: string; count: number }> = [
    { view: "daily", title: "Hareketler", detail: "Gelir, gider, belge ve düzeltmeler", count: transactionCount },
    { view: "ledger", title: "Alacak & borç", detail: "Vade, kısmi tahsilat ve ödemeler", count: receivableCount + payableCount },
    { view: "recurring", title: "Sabit giderler", detail: "Aktif, durdurulmuş ve dönemsel planlar", count: recurringCount },
    { view: "inventory", title: "Stok", detail: "Alış, kullanım, fire ve kritik seviye", count: inventoryCount },
  ];
  return <section className="workspace-records"><div className="workspace-records-intro"><span className="eyebrow">Kayıtlar</span><h2>Tüm işlemler bir yerde; neyi düzeltmek istiyorsan oradan aç.</h2><p>Finansal etki taşıyan kayıt silinmez; düzeltme veya gerekçeli iptal ile iz bırakır.</p></div><div className="workspace-record-cards">{rows.map((row) => <button key={row.title} onClick={() => onNavigate(row.view)} type="button"><span>{row.count}</span><strong>{row.title}</strong><small>{row.detail}</small><b>Görüntüle →</b></button>)}</div></section>;
}

export function PlanningWorkspace({ onNavigate }: { onNavigate: (view: WorkspaceView) => void }) {
  return <section className="workspace-records"><div className="workspace-records-intro"><span className="eyebrow">Raporlar ve plan</span><h2>Önce gerçekleşen kayıtlar, sonra tahmin.</h2><p>Vergi, hedef ve borçlanma panelleri yönetim tahminidir; mali müşavir onayı olmadan resmî sonuç değildir.</p></div><div className="workspace-record-cards"><button onClick={() => onNavigate("reports")} type="button"><span>↗</span><strong>Raporlar</strong><small>Gelir-gider, dışa aktarım ve yönetim özeti</small><b>Raporları aç →</b></button><button onClick={() => onNavigate("decision")} type="button"><span>≈</span><strong>Planlama</strong><small>Hedef, nakit ve senaryo varsayımları</small><b>Planlamayı aç →</b></button><button onClick={() => onNavigate("cash")} type="button"><span>✓</span><strong>Kapanış</strong><small>Kasa, POS ve ay sonu mutabakatı</small><b>Kapanışı aç →</b></button></div></section>;
}

export function SettingsWorkspace({
  onNavigate,
  integrity,
}: {
  onNavigate: (view: WorkspaceView) => void;
  integrity: { ok: boolean; critical: number; warning: number; findings: Array<{ message: string }> };
}) {
  return <section className="workspace-records"><div className="workspace-records-intro"><span className="eyebrow">Ayarlar ve denetim</span><h2>Teknik araçlar günlük işin dışında kalır.</h2><p>Geçmiş aktarım, sistem kontrolleri ve ileri ayarlar yalnızca yetkili kullanıcılar içindir.</p></div><article className={`workspace-integrity ${integrity.ok ? "ok" : "attention"}`}><div><span className="eyebrow">Otomatik bütünlük kontrolü</span><strong>{integrity.ok ? "Finansal kayıtlar arasında görünür tutarsızlık yok" : `${integrity.critical} kritik · ${integrity.warning} uyarı`}</strong><small>Bu kontrol veri silmez veya kendiliğinden düzeltmez; sorunları görünür tutar.</small></div>{integrity.findings.length ? <ul>{integrity.findings.slice(0, 3).map((item) => <li key={item.message}>{item.message}</li>)}</ul> : <span className="workspace-integrity-mark">✓</span>}</article><div className="workspace-record-cards"><button onClick={() => onNavigate("import")} type="button"><span>↓</span><strong>Geçmiş aktarım</strong><small>Önizleme ve kontrollü veri paketi</small><b>Aktarımı aç →</b></button><button onClick={() => onNavigate("checks")} type="button"><span>⌁</span><strong>Denetim</strong><small>İşlem olayları ve sistem kontrolleri</small><b>Denetimi aç →</b></button><button onClick={() => onNavigate("calendar")} type="button"><span>□</span><strong>Takvim</strong><small>Tüm tarihli finans olayları</small><b>Takvimi aç →</b></button></div></section>;
}
