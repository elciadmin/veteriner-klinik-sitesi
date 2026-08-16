"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

import {
  applyStockMovement,
  dailyOperationsSummary,
  isDocumentedOutflow,
} from "@/lib/operations.mjs";
import { datePlusBusinessDays } from "@/lib/financial-core.mjs";
import { activeReceiptLines, quickReceiptTotal, receiptTotalsMatch } from "@/lib/quick-receipt.mjs";
import type {
  ClinicTransaction,
  DocumentType,
  InventoryItem,
  PaymentChannel,
  StockMovement,
} from "./operational-modules";

export type QuickPurchasePayload = {
  item: InventoryItem;
  movement: StockMovement;
  transaction: ClinicTransaction;
};

export type QuickReceiptLinePayload = {
  transaction: ClinicTransaction;
  item?: InventoryItem;
  movement?: StockMovement;
  productDefinition?: {
    id: string;
    canonicalName: string;
    productFamily: string;
    baseUnit: string;
    attributes?: Record<string, unknown>;
    aliases?: string[];
  };
};

export type QuickReceiptPayload = {
  receiptId: string;
  lines: QuickReceiptLinePayload[];
};

type SaveResult = boolean | Promise<boolean>;

type CatalogEntry = {
  key: string;
  name: string;
  category: string;
  unit: string;
  purchaseUnit: string;
  unitsPerPackage: number;
  stockTracked: boolean;
  item?: InventoryItem;
};

type IncomeDraft = {
  counterparty: string;
  category: string;
  amount: string;
  paymentMethod: PaymentChannel;
  documentRef: string;
  note: string;
  vatRate: string;
};

type ExpenseDraft = {
  catalogKey: string;
  counterparty: string;
  packageCount: string;
  amount: string;
  paymentMethod: PaymentChannel;
  documentType: DocumentType;
  documentRef: string;
  note: string;
  vatRate: string;
};

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const incomeCategories = [
  "Muayene",
  "Aşı ve parazit",
  "Laboratuvar",
  "Tedavi",
  "Cerrahi",
  "Pet otel / kuaför",
  "Mama / ürün satışı",
  "Diğer gelir",
];

const generalExpenseCatalog: CatalogEntry[] = [
  {
    key: "general-rent",
    name: "Kira",
    category: "Kira",
    unit: "ay",
    purchaseUnit: "ödeme",
    unitsPerPackage: 1,
    stockTracked: false,
  },
  {
    key: "general-electricity",
    name: "Elektrik faturası",
    category: "Elektrik / su / doğalgaz",
    unit: "fatura",
    purchaseUnit: "fatura",
    unitsPerPackage: 1,
    stockTracked: false,
  },
  {
    key: "general-water",
    name: "Su faturası",
    category: "Elektrik / su / doğalgaz",
    unit: "fatura",
    purchaseUnit: "fatura",
    unitsPerPackage: 1,
    stockTracked: false,
  },
  {
    key: "general-gas",
    name: "Doğalgaz faturası",
    category: "Elektrik / su / doğalgaz",
    unit: "fatura",
    purchaseUnit: "fatura",
    unitsPerPackage: 1,
    stockTracked: false,
  },
  {
    key: "general-accounting",
    name: "Muhasebe hizmeti",
    category: "Muhasebe",
    unit: "ay",
    purchaseUnit: "ödeme",
    unitsPerPackage: 1,
    stockTracked: false,
  },
  {
    key: "general-bank",
    name: "Banka / POS gideri",
    category: "POS / banka",
    unit: "işlem",
    purchaseUnit: "işlem",
    unitsPerPackage: 1,
    stockTracked: false,
  },
  {
    key: "general-cleaning",
    name: "Diğer temizlik gideri",
    category: "Temizlik",
    unit: "adet",
    purchaseUnit: "alış",
    unitsPerPackage: 1,
    stockTracked: false,
  },
  {
    key: "general-stationery",
    name: "Poşet / kırtasiye",
    category: "Poşet / kırtasiye",
    unit: "adet",
    purchaseUnit: "alış",
    unitsPerPackage: 1,
    stockTracked: false,
  },
];

const toiletPaperSizes = [4, 8, 12, 16, 24, 32, 40];

const commonStockCatalog: CatalogEntry[] = toiletPaperSizes.map((size) => ({
  key: `common-toilet-paper-${size}`,
  name: `Tuvalet kâğıdı ${size}'lı`,
  category: "Temizlik",
  unit: "rulo",
  purchaseUnit: "paket",
  unitsPerPackage: size,
  stockTracked: true,
}));

const initialIncome: IncomeDraft = {
  counterparty: "",
  category: "Muayene",
  amount: "",
  paymentMethod: "cash",
  documentRef: "",
  note: "",
  vatRate: "0.2",
};

const initialExpense: ExpenseDraft = {
  catalogKey: "common-toilet-paper-16",
  counterparty: "",
  packageCount: "1",
  amount: "",
  paymentMethod: "cash",
  documentType: "none",
  documentRef: "",
  note: "",
  vatRate: "0.2",
};

function money(value: number) {
  return TRY.format(value);
}

function dateLabel(value: string) {
  return DATE.format(new Date(`${value}T00:00:00Z`));
}

function timeInIstanbul() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function normalized(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("â", "a")
    .replaceAll("ı", "i")
    .replaceAll("'", "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableCatalogId(name: string) {
  const slug = normalized(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `catalog-${slug}`;
}

function paymentLabel(value: PaymentChannel) {
  if (value === "card") return "Kart";
  if (value === "transfer") return "Havale";
  if (value === "accrual") return "Stok maliyeti";
  return "Nakit";
}

function documentLabel(transaction: ClinicTransaction) {
  if (transaction.operationType === "pos_commission") return "POS otomatik";
  if (
    transaction.kind === "expense" &&
    !isDocumentedOutflow(transaction)
  ) {
    return transaction.documentType === "none"
      ? "Belge bekliyor"
      : "Belge no eksik";
  }
  return transaction.documentRef || "Kaydedildi";
}

function PaymentButtons({
  value,
  onChange,
  includeCard = true,
}: {
  value: PaymentChannel;
  onChange: (value: PaymentChannel) => void;
  includeCard?: boolean;
}) {
  const channels: PaymentChannel[] = includeCard
    ? ["cash", "card", "transfer"]
    : ["cash", "transfer"];
  return (
    <div className="quick-payment" role="group" aria-label="Ödeme biçimi">
      {channels.map((channel) => (
        <button
          className={value === channel ? "active" : ""}
          key={channel}
          onClick={() => onChange(channel)}
          type="button"
        >
          {paymentLabel(channel)}
        </button>
      ))}
    </div>
  );
}


type ReceiptLineDraft = {
  id: string;
  itemName: string;
  category: string;
  quantity: string;
  amount: string;
  vatRate: string;
  stockTracked: boolean;
};

function newReceiptLine(index = 0): ReceiptLineDraft {
  return {
    id: `receipt-line-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    itemName: "",
    category: "Market / genel gider",
    quantity: "1",
    amount: "",
    vatRate: "0.2",
    stockTracked: false,
  };
}

const receiptCategories = [
  "Market / genel gider",
  "Temizlik",
  "Sarf",
  "Kırtasiye",
  "İlaç",
  "Mama",
  "İkram",
  "Diğer gider",
];

function QuickReceiptForm({
  selectedDate,
  catalog,
  inventory,
  counterparties,
  onSave,
  onClose,
}: {
  selectedDate: string;
  catalog: CatalogEntry[];
  inventory: InventoryItem[];
  counterparties: string[];
  onSave: (payload: QuickReceiptPayload) => SaveResult;
  onClose: () => void;
}) {
  const [header, setHeader] = useState({
    counterparty: "",
    paymentMethod: "cash" as PaymentChannel,
    documentType: "receipt" as DocumentType,
    documentRef: "",
    declaredTotal: "",
    note: "",
  });
  const [lines, setLines] = useState<ReceiptLineDraft[]>(() =>
    Array.from({ length: 5 }, (_, index) => newReceiptLine(index)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const availableCategories = Array.from(
    new Set([...receiptCategories, ...catalog.map((entry) => entry.category)]),
  );
  const activeLines = activeReceiptLines(lines);
  const calculatedTotal = quickReceiptTotal(activeLines);
  const totalMatches = receiptTotalsMatch(activeLines, header.declaredTotal);

  function updateLine(id: string, patch: Partial<ReceiptLineDraft>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function updateName(id: string, itemName: string) {
    const match = catalog.find(
      (entry) => normalized(entry.name) === normalized(itemName),
    );
    updateLine(id, {
      itemName,
      ...(match
        ? {
            category: match.category,
            stockTracked: match.stockTracked,
          }
        : {}),
    });
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved("");
    const rows = activeReceiptLines(lines);
    if (!header.counterparty.trim()) {
      setError("Market / tedarikçi adını yazın.");
      return;
    }
    if (header.documentType !== "none" && !header.documentRef.trim()) {
      setError("Fiş veya fatura numarasını yazın.");
      return;
    }
    if (!rows.length || rows.length > 50) {
      setError("En az 1, en fazla 50 dolu satır kaydedilebilir.");
      return;
    }
    for (const row of rows) {
      const amount = Number(row.amount);
      const quantity = Number(row.quantity || 1);
      if (
        !row.itemName.trim() ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        setError("Her satırda kalem adı, miktar ve sıfırdan büyük tutar olmalı.");
        return;
      }
    }
    if (!totalMatches) {
      setError(
        `Satır toplamı ${money(calculatedTotal)}; yazılan fiş toplamıyla uyuşmuyor.`,
      );
      return;
    }

    setSaving(true);
    const timestamp = Date.now();
    const receiptId = `quick-receipt-${timestamp}`;
    const runningInventory = new Map(
      inventory.map((item) => [item.id, { ...item }] as const),
    );
    const payloadLines: QuickReceiptLinePayload[] = rows.map((row, index) => {
      const amount = Number(row.amount);
      const quantityInput = Number(row.quantity || 1);
      const match = catalog.find(
        (entry) => normalized(entry.name) === normalized(row.itemName),
      );
      const stockTracked = row.stockTracked || Boolean(match?.stockTracked);
      const transactionId = `tx-receipt-${timestamp}-${index + 1}`;
      const movementId = `sm-receipt-${timestamp}-${index + 1}`;
      const category = match?.category || row.category || "Diğer gider";
      const transaction: ClinicTransaction = {
        id: transactionId,
        date: selectedDate,
        time: timeInIstanbul(),
        kind: "expense",
        category,
        description: row.itemName.trim(),
        counterparty: header.counterparty.trim(),
        operationType: stockTracked ? "inventory_purchase" : "overhead",
        costBehavior: stockTracked ? "mixed" : "variable",
        amount,
        paymentMethod: header.paymentMethod,
        documentType: header.documentType,
        documentRef: header.documentRef.trim(),
        vatRate: header.documentType === "none" ? 0 : Number(row.vatRate),
        postingMode: stockTracked ? "cash_only" : "economic_and_cash",
        sourceModule: "quick_receipt",
        sourceRecordId: receiptId,
      };
      if (!stockTracked) return { transaction };

      const unitsPerPackage = match?.unitsPerPackage || 1;
      const movementQuantity = quantityInput * unitsPerPackage;
      const baseId = match?.item?.id || stableCatalogId(row.itemName);
      const baseItem = runningInventory.get(baseId) ??
        match?.item ?? {
          id: baseId,
          name: row.itemName.trim(),
          category,
          unit: match?.unit || "adet",
          purchaseUnit: match?.purchaseUnit || "adet",
          unitsPerPackage,
          quantity: 0,
          minimumQuantity: unitsPerPackage,
          unitCost: 0,
          supplier: header.counterparty.trim(),
          lot: "",
          expiryDate: "",
        };
      const movement: StockMovement = {
        id: movementId,
        itemId: baseItem.id,
        itemName: baseItem.name,
        date: selectedDate,
        type: "purchase",
        quantity: movementQuantity,
        packageCount: quantityInput,
        unitsPerPackage,
        totalCost: amount,
        unitCost: amount / movementQuantity,
        documentType: header.documentType,
        documentRef: header.documentRef.trim(),
        transactionId,
        note: header.note.trim() || `${quantityInput} ${baseItem.purchaseUnit || baseItem.unit}`,
      };
      const item = {
        ...applyStockMovement(baseItem, movement),
        supplier: header.counterparty.trim(),
      } as InventoryItem;
      runningInventory.set(item.id, item);
      return { transaction, item, movement };
    });

    const result = await onSave({ receiptId, lines: payloadLines });
    setSaving(false);
    if (result === false) {
      setError("Fiş kaydedilemedi; hiçbir satır silinmedi.");
      return;
    }
    setSaved(`${rows.length} kalem, toplam ${money(calculatedTotal)} tek fişte kaydedildi.`);
    setHeader((current) => ({
      ...current,
      documentRef: "",
      declaredTotal: "",
      note: "",
    }));
    setLines(Array.from({ length: 5 }, (_, index) => newReceiptLine(index)));
  }

  return (
    <form className="quick-receipt-form" onSubmit={submitReceipt}>
      <div className="quick-receipt-title">
        <div>
          <span>Hızlı giriş</span>
          <h3>Tek fiş · çok kalem</h3>
          <p>Ortak fiş bilgilerini bir kez yazın; satırları peş peşe girin.</p>
        </div>
        <button aria-label="Çok kalemli fişi kapat" onClick={onClose} type="button">×</button>
      </div>

      <div className="quick-receipt-header-grid">
        <label>
          <span>Market / tedarikçi</span>
          <input
            autoFocus
            list="receipt-counterparties"
            onChange={(event) => setHeader({ ...header, counterparty: event.target.value })}
            placeholder="Örn. BİM"
            value={header.counterparty}
          />
          <datalist id="receipt-counterparties">
            {counterparties.map((value) => <option key={value} value={value} />)}
          </datalist>
        </label>
        <label>
          <span>Belge</span>
          <select
            onChange={(event) => setHeader({ ...header, documentType: event.target.value as DocumentType })}
            value={header.documentType}
          >
            <option value="receipt">Fiş</option>
            <option value="invoice">Fatura</option>
            <option value="e_archive">e-Fatura / e-Arşiv</option>
            <option value="bank_statement">Banka dekontu</option>
            <option value="none">Belge bekliyor</option>
          </select>
        </label>
        <label>
          <span>Fiş / fatura no</span>
          <input
            disabled={header.documentType === "none"}
            onChange={(event) => setHeader({ ...header, documentRef: event.target.value })}
            placeholder="Belge numarası"
            value={header.documentRef}
          />
        </label>
        <label>
          <span>Fiş toplamı (kontrol)</span>
          <input
            inputMode="decimal"
            min="0.01"
            onChange={(event) => setHeader({ ...header, declaredTotal: event.target.value })}
            placeholder="İsteğe bağlı"
            step="0.01"
            type="number"
            value={header.declaredTotal}
          />
        </label>
      </div>

      <PaymentButtons
        onChange={(paymentMethod) => setHeader({ ...header, paymentMethod })}
        value={header.paymentMethod}
      />

      <datalist id="quick-receipt-catalog-options">
        {catalog.map((entry) => <option key={entry.key} value={entry.name} />)}
      </datalist>

      <div className="quick-receipt-lines">
        <div className="quick-receipt-line quick-receipt-line-head" aria-hidden="true">
          <span>Kalem</span><span>Kategori</span><span>Miktar</span><span>Tutar</span><span>KDV</span><span>Stok</span><span />
        </div>
        {lines.map((line, index) => (
          <div className="quick-receipt-line" key={line.id}>
            <label>
              <span className="sr-only">{index + 1}. kalem</span>
              <input
                list="quick-receipt-catalog-options"
                onChange={(event) => updateName(line.id, event.target.value)}
                placeholder={`${index + 1}. kalem`}
                value={line.itemName}
              />
            </label>
            <select
              aria-label={`${index + 1}. satır kategorisi`}
              onChange={(event) => updateLine(line.id, { category: event.target.value })}
              value={line.category}
            >
              {availableCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
            <input
              aria-label={`${index + 1}. satır miktarı`}
              min="0.01"
              onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
              step="0.01"
              type="number"
              value={line.quantity}
            />
            <input
              aria-label={`${index + 1}. satır toplam tutarı`}
              inputMode="decimal"
              min="0.01"
              onChange={(event) => updateLine(line.id, { amount: event.target.value })}
              placeholder="0,00"
              step="0.01"
              type="number"
              value={line.amount}
            />
            <select
              aria-label={`${index + 1}. satır KDV oranı`}
              disabled={header.documentType === "none"}
              onChange={(event) => updateLine(line.id, { vatRate: event.target.value })}
              value={line.vatRate}
            >
              <option value="0">%0</option>
              <option value="0.01">%1</option>
              <option value="0.1">%10</option>
              <option value="0.2">%20</option>
            </select>
            <label className="quick-receipt-stock">
              <input
                checked={line.stockTracked}
                onChange={(event) => updateLine(line.id, { stockTracked: event.target.checked })}
                type="checkbox"
              />
              <span className="sr-only">Stokta takip et</span>
            </label>
            <button
              aria-label={`${index + 1}. satırı sil`}
              disabled={lines.length <= 1}
              onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
              type="button"
            >×</button>
          </div>
        ))}
      </div>

      <div className="quick-receipt-actions">
        <button onClick={() => setLines((current) => [...current, newReceiptLine(current.length)])} type="button">+ 1 satır</button>
        <button onClick={() => setLines((current) => [...current, ...Array.from({ length: 5 }, (_, index) => newReceiptLine(current.length + index))])} type="button">+ 5 satır</button>
        <label>
          <span>Not</span>
          <input onChange={(event) => setHeader({ ...header, note: event.target.value })} placeholder="İsteğe bağlı" value={header.note} />
        </label>
        <div className={`quick-receipt-total ${totalMatches ? "" : "mismatch"}`}>
          <small>{activeLines.length} dolu satır</small>
          <strong>{money(calculatedTotal)}</strong>
        </div>
        <button className="quick-save quick-save-expense" disabled={saving} type="submit">
          {saving ? "Fiş kaydediliyor…" : "Tüm fişi kaydet"}
        </button>
      </div>
      {error ? <p className="quick-error">{error}</p> : null}
      {saved ? <p className="quick-success" role="status">✓ {saved}</p> : null}
    </form>
  );
}

function SavedRows({
  kind,
  rows,
  onAttachDocument,
  onReverse,
}: {
  kind: "income" | "expense";
  rows: ClinicTransaction[];
  onAttachDocument?: (transaction: ClinicTransaction) => void;
  onReverse?: (transaction: ClinicTransaction) => void;
}) {
  if (!rows.length) {
    return (
      <div className="quick-empty">
        Henüz kayıt yok. İlk satırı yukarıdan girebilirsiniz.
      </div>
    );
  }

  return (
    <div className="quick-saved-list" aria-label={`${kind} kayıtları`}>
      {rows.map((row) => (
        <div className={`quick-saved-row quick-saved-${kind}`} key={row.id}>
          <span className="quick-row-lock" title="Kayıt sabitlendi">
            ✓
          </span>
          <div className="quick-row-main">
            <strong>{row.counterparty || "Karşı taraf belirtilmedi"}</strong>
            <small>
              {row.time} · {row.category}
              {row.description && row.description !== row.category
                ? ` · ${row.description}`
                : ""}
            </small>
          </div>
          <span className="quick-row-channel">
            {paymentLabel(row.paymentMethod)}
          </span>
          {kind === "expense" &&
          row.operationType !== "pos_commission" &&
          !isDocumentedOutflow(row) &&
          onAttachDocument ? (
            <button
              className="quick-row-document waiting"
              onClick={() => onAttachDocument(row)}
              type="button"
            >
              + Belge ekle
            </button>
          ) : (
            <span className="quick-row-document">{documentLabel(row)}</span>
          )}
          <strong className="quick-row-amount">
            {kind === "income" ? "+" : "−"}
            {money(row.amount)}
          </strong>
          {!row.isAutomatic &&
          (!row.sourceModule || row.sourceModule === "manual") &&
          onReverse ? (
            <button
              className="quick-row-reverse"
              onClick={() => onReverse(row)}
              type="button"
            >
              Düzelt / iptal
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function QuickDailyView({
  today,
  transactions,
  inventory,
  posCommissionRate,
  onPosCommissionRateChange,
  onSaveTransaction,
  onUpdateTransaction,
  onReverseTransaction,
  onSaveQuickPurchase,
  onSaveQuickReceipt,
  onSaveCatalogItem,
  onOpenDetailedEntry,
}: {
  today: string;
  transactions: ClinicTransaction[];
  inventory: InventoryItem[];
  posCommissionRate: number;
  onPosCommissionRateChange: (value: number) => void;
  onSaveTransaction: (transaction: ClinicTransaction) => SaveResult;
  onUpdateTransaction: (transaction: ClinicTransaction) => SaveResult;
  onReverseTransaction: (
    transaction: ClinicTransaction,
    reason: string,
  ) => SaveResult;
  onSaveQuickPurchase: (payload: QuickPurchasePayload) => SaveResult;
  onSaveQuickReceipt: (payload: QuickReceiptPayload) => SaveResult;
  onSaveCatalogItem: (item: InventoryItem) => SaveResult;
  onOpenDetailedEntry: (date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [income, setIncome] = useState<IncomeDraft>(initialIncome);
  const [expense, setExpense] = useState<ExpenseDraft>(initialExpense);
  const [incomeError, setIncomeError] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [incomeSaved, setIncomeSaved] = useState("");
  const [expenseSaved, setExpenseSaved] = useState("");
  const [savingIncome, setSavingIncome] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [showNewCatalog, setShowNewCatalog] = useState(false);
  const [showQuickReceipt, setShowQuickReceipt] = useState(false);
  const [documentTarget, setDocumentTarget] =
    useState<ClinicTransaction | null>(null);
  const [documentDraft, setDocumentDraft] = useState({
    documentType: "receipt" as DocumentType,
    documentRef: "",
    vatRate: "0.2",
  });
  const [newCatalog, setNewCatalog] = useState({
    name: "",
    category: "Temizlik",
    unit: "adet",
    purchaseUnit: "paket",
    unitsPerPackage: "1",
  });
  const incomeNameRef = useRef<HTMLInputElement>(null);
  const expenseAmountRef = useRef<HTMLInputElement>(null);

  const catalog = useMemo(() => {
    const entries = [...generalExpenseCatalog];
    const inventoryNames = new Set(inventory.map((item) => normalized(item.name)));

    for (const common of commonStockCatalog) {
      const matchingItem = inventory.find(
        (item) => normalized(item.name) === normalized(common.name),
      );
      entries.push(
        matchingItem
          ? {
              ...common,
              key: common.key,
              item: matchingItem,
              unit: matchingItem.unit,
              purchaseUnit:
                matchingItem.purchaseUnit || common.purchaseUnit,
              unitsPerPackage:
                matchingItem.unitsPerPackage || common.unitsPerPackage,
            }
          : common,
      );
    }

    for (const item of inventory) {
      if (commonStockCatalog.some((entry) => normalized(entry.name) === normalized(item.name))) {
        continue;
      }
      if (!inventoryNames.has(normalized(item.name))) continue;
      entries.push({
        key: `inventory-${item.id}`,
        name: item.name,
        category: item.category,
        unit: item.unit,
        purchaseUnit: item.purchaseUnit || item.unit,
        unitsPerPackage: item.unitsPerPackage || 1,
        stockTracked: true,
        item,
      });
    }

    return entries;
  }, [inventory]);

  const selectedCatalog =
    catalog.find((entry) => entry.key === expense.catalogKey) ?? catalog[0];
  const incomeCounterparties = Array.from(
    new Set(
      transactions
        .filter((transaction) => transaction.kind === "income")
        .map((transaction) => transaction.counterparty?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "tr"));
  const expenseCounterparties = Array.from(
    new Set(
      transactions
        .filter((transaction) => transaction.kind === "expense")
        .map((transaction) => transaction.counterparty?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "tr"));
  const dayRows = transactions
    .filter(
      (transaction) =>
        transaction.date === selectedDate && transaction.status !== "cancelled",
    )
    .sort((a, b) => b.time.localeCompare(a.time));
  const incomeRows = dayRows.filter((row) => row.kind === "income");
  const expenseRows = dayRows.filter((row) => row.kind === "expense");
  const summary = dailyOperationsSummary({
    transactions,
    date: selectedDate,
    openingCash: 0,
  });

  async function submitIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIncomeError("");
    setIncomeSaved("");
    const amount = Number(income.amount);
    if (!income.counterparty.trim() || !Number.isFinite(amount) || amount <= 0) {
      setIncomeError("Kimden geldiğini ve sıfırdan büyük tutarı yazın.");
      return;
    }

    setSavingIncome(true);
    const timestamp = Date.now();
    const transaction: ClinicTransaction = {
      id: `tx-income-${timestamp}`,
      date: selectedDate,
      time: timeInIstanbul(),
      kind: "income",
      category: income.category,
      description: income.note.trim() || income.category,
      counterparty: income.counterparty.trim(),
      operationType:
        income.category === "Mama / ürün satışı" ? "product_sale" : "service",
      costBehavior: "non_expense",
      amount,
      paymentMethod: income.paymentMethod,
      documentType: "receipt",
      documentRef: income.documentRef.trim(),
      vatRate: Number(income.vatRate),
      posRate: income.paymentMethod === "card" ? posCommissionRate : 0,
      posStatus: income.paymentMethod === "card" ? "pending" : undefined,
      settlementDate:
        income.paymentMethod === "card"
          ? datePlusBusinessDays(selectedDate, 2)
          : undefined,
    };
    const saved = await onSaveTransaction(transaction);
    setSavingIncome(false);
    if (saved === false) {
      setIncomeError("Kayıt tamamlanamadı; satır silinmedi.");
      return;
    }

    setIncome((current) => ({
      ...initialIncome,
      category: current.category,
      paymentMethod: current.paymentMethod,
      vatRate: current.vatRate,
    }));
    setIncomeSaved(`${money(amount)} gelir sabitlendi. Yeni satır hazır.`);
    requestAnimationFrame(() => incomeNameRef.current?.focus());
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseError("");
    setExpenseSaved("");
    if (!selectedCatalog) {
      setExpenseError("Gider kalemi seçin.");
      return;
    }
    const amount = Number(expense.amount);
    const packageCount = Number(expense.packageCount || 1);
    if (
      !expense.counterparty.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(packageCount) ||
      packageCount <= 0
    ) {
      setExpenseError(
        "Kime ödendiğini, miktarı ve sıfırdan büyük fiyatı yazın.",
      );
      return;
    }
    if (expense.documentType !== "none" && !expense.documentRef.trim()) {
      setExpenseError(
        "Fiş/fatura seçildiğinde belge numarası gerekir. Belge sonra gelecekse “Belge bekliyor” seçin.",
      );
      return;
    }

    setSavingExpense(true);
    const timestamp = Date.now();
    const transaction: ClinicTransaction = {
      id: `tx-expense-${timestamp}`,
      date: selectedDate,
      time: timeInIstanbul(),
      kind: "expense",
      category: selectedCatalog.category,
      description:
        expense.note.trim() ||
        `${selectedCatalog.name}${
          selectedCatalog.stockTracked
            ? ` · ${packageCount} ${selectedCatalog.purchaseUnit}`
            : ""
        }`,
      counterparty: expense.counterparty.trim(),
      operationType: selectedCatalog.stockTracked
        ? "inventory_purchase"
        : "overhead",
      costBehavior:
        selectedCatalog.category === "Kira" ||
        selectedCatalog.category === "Muhasebe"
          ? "fixed"
          : "mixed",
      amount,
      paymentMethod: expense.paymentMethod,
      documentType: expense.documentType,
      documentRef: expense.documentRef.trim(),
      vatRate:
        expense.documentType === "none" ? 0 : Number(expense.vatRate),
      postingMode: selectedCatalog.stockTracked
        ? "cash_only"
        : "economic_and_cash",
      sourceModule: selectedCatalog.stockTracked ? "inventory" : "manual",
      sourceRecordId: selectedCatalog.stockTracked
        ? `sm-quick-${timestamp}`
        : undefined,
    };

    let saved: boolean;
    if (selectedCatalog.stockTracked) {
      const baseItem: InventoryItem =
        selectedCatalog.item ?? {
          id: stableCatalogId(selectedCatalog.name),
          name: selectedCatalog.name,
          category: selectedCatalog.category,
          unit: selectedCatalog.unit,
          purchaseUnit: selectedCatalog.purchaseUnit,
          unitsPerPackage: selectedCatalog.unitsPerPackage,
          quantity: 0,
          minimumQuantity: selectedCatalog.unitsPerPackage,
          unitCost: 0,
          supplier: expense.counterparty.trim(),
          lot: "",
          expiryDate: "",
        };
      const quantity = packageCount * selectedCatalog.unitsPerPackage;
      const movement: StockMovement = {
        id: `sm-quick-${timestamp}`,
        itemId: baseItem.id,
        itemName: baseItem.name,
        date: selectedDate,
        type: "purchase",
        quantity,
        packageCount,
        unitsPerPackage: selectedCatalog.unitsPerPackage,
        totalCost: amount,
        unitCost: amount / quantity,
        documentType: expense.documentType,
        documentRef: expense.documentRef.trim(),
        note:
          expense.note.trim() ||
          `${packageCount} ${selectedCatalog.purchaseUnit} × ${selectedCatalog.unitsPerPackage} ${selectedCatalog.unit}`,
      };
      const updatedItem = {
        ...applyStockMovement(baseItem, movement),
        supplier: expense.counterparty.trim(),
      } as InventoryItem;
      saved = await onSaveQuickPurchase({
        item: updatedItem,
        movement,
        transaction,
      });
    } else {
      saved = await onSaveTransaction(transaction);
    }
    setSavingExpense(false);

    if (saved === false) {
      setExpenseError("Kayıt tamamlanamadı; satır silinmedi.");
      return;
    }

    setExpense((current) => ({
      ...initialExpense,
      catalogKey: current.catalogKey,
      counterparty: current.counterparty,
      paymentMethod: current.paymentMethod,
      documentType: current.documentType,
      documentRef: current.documentRef,
      vatRate: current.vatRate,
    }));
    setExpenseSaved(`${money(amount)} gider sabitlendi. Yeni satır hazır.`);
    requestAnimationFrame(() => expenseAmountRef.current?.focus());
  }

  async function addCatalogItem() {
    setExpenseError("");
    const unitsPerPackage = Number(newCatalog.unitsPerPackage);
    if (
      !newCatalog.name.trim() ||
      !Number.isFinite(unitsPerPackage) ||
      unitsPerPackage <= 0
    ) {
      setExpenseError("Yeni kalemin adını ve paket içi miktarını yazın.");
      return;
    }
    const item: InventoryItem = {
      id: `${stableCatalogId(newCatalog.name)}-${Date.now()}`,
      name: newCatalog.name.trim(),
      category: newCatalog.category,
      unit: newCatalog.unit.trim() || "adet",
      purchaseUnit: newCatalog.purchaseUnit.trim() || "paket",
      unitsPerPackage,
      quantity: 0,
      minimumQuantity: unitsPerPackage,
      unitCost: 0,
      supplier: "",
      lot: "",
      expiryDate: "",
    };
    const saved = await onSaveCatalogItem(item);
    if (saved === false) {
      setExpenseError("Yeni kalem listeye eklenemedi.");
      return;
    }
    setExpense((current) => ({
      ...current,
      catalogKey: `inventory-${item.id}`,
    }));
    setNewCatalog({
      name: "",
      category: "Temizlik",
      unit: "adet",
      purchaseUnit: "paket",
      unitsPerPackage: "1",
    });
    setShowNewCatalog(false);
  }

  async function attachExpenseDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documentTarget || !documentDraft.documentRef.trim()) {
      setExpenseError("Belge numarasını yazın.");
      return;
    }
    const saved = await onUpdateTransaction({
      ...documentTarget,
      documentType: documentDraft.documentType,
      documentRef: documentDraft.documentRef.trim(),
      vatRate: Number(documentDraft.vatRate),
    });
    if (saved === false) {
      setExpenseError("Belge kayda eklenemedi.");
      return;
    }
    setDocumentTarget(null);
    setDocumentDraft({
      documentType: "receipt",
      documentRef: "",
      vatRate: "0.2",
    });
    setExpenseSaved("Belge aynı gider kaydına eklendi; gider hesabına alındı.");
  }

  async function reverseTransaction(transaction: ClinicTransaction) {
    // Geri alma günlük kullanımda gerçek bir “tek tık” olmalı. Kullanıcıdan
    // ayrıca tarayıcı penceresinde metin istemek bazı cihazlarda işlemi
    // görünmez kılıyordu. Gerekçe otomatik denetim izine yazılır; kayıt
    // fiziksel olarak silinmez.
    const saved = await onReverseTransaction(
      transaction,
      "Kullanıcı günlük kaydı geri aldı",
    );
    if (saved === false) {
      const message = "Ters kayıt tamamlanamadı; satır değişmedi.";
      if (transaction.kind === "income") setIncomeError(message);
      else setExpenseError(message);
      return;
    }
    if (transaction.kind === "income") {
      setIncomeSaved("Kayıt gerekçeli olarak iptal edildi; denetim izi korundu.");
    } else {
      setExpenseSaved("Kayıt gerekçeli olarak iptal edildi; denetim izi korundu.");
    }
  }

  return (
    <div className="quick-day">
      <section className="quick-day-head">
        <div>
          <span className="quick-live-dot" />
          <strong>{dateLabel(selectedDate)} günü açık</strong>
          <small>Kaydettiğiniz satır sabitlenir; boş satır otomatik açılır.</small>
        </div>
        <label>
          Başka gün
          <input
            aria-label="Gün seç"
            onChange={(event) => setSelectedDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
        </label>
      </section>

      <section className="quick-day-totals" aria-label="Gün özeti">
        <div>
          <span>Gelir</span>
          <strong className="positive">{money(summary.income)}</strong>
        </div>
        <div>
          <span>Belgeli gider</span>
          <strong className="negative">{money(summary.expense)}</strong>
        </div>
        <div>
          <span>Belge bekleyen çıkış</span>
          <strong className={summary.undocumentedOutflow ? "warning" : ""}>
            {money(summary.undocumentedOutflow)}
          </strong>
        </div>
        <div>
          <span>Günlük fark</span>
          <strong>{money(summary.cashFlowBalance)}</strong>
        </div>
        {summary.collectionCash > 0 ? (
          <div>
            <span>Alacak tahsilatı</span>
            <strong className="positive">{money(summary.collectionCash)}</strong>
            <small>Satışa tekrar eklenmedi</small>
          </div>
        ) : null}
        {summary.liabilityPaymentCash > 0 ? (
          <div>
            <span>Borç ödemesi</span>
            <strong className="negative">
              {money(summary.liabilityPaymentCash)}
            </strong>
            <small>Gidere tekrar eklenmedi</small>
          </div>
        ) : null}
        {summary.assetPurchaseCash > 0 ? (
          <div>
            <span>Stok alımı</span>
            <strong className="negative">{money(summary.assetPurchaseCash)}</strong>
            <small>Varlık; maliyet kullanımda</small>
          </div>
        ) : null}
      </section>

      <section className="quick-ledgers">
        <article className="quick-ledger quick-income-ledger">
          <header>
            <div>
              <span className="quick-step">1</span>
              <div>
                <h2>Gelir listesi</h2>
                <p>Kimden geldi, ne için, ne kadar ve nasıl ödendi?</p>
              </div>
            </div>
            <b>{incomeRows.length} kayıt</b>
          </header>

          <form
            className="quick-entry-form"
            data-testid="quick-income-form"
            onSubmit={submitIncome}
          >
            <label className="quick-field-main">
              <span>Kimden geldi?</span>
              <input
                autoComplete="off"
                list="income-counterparties"
                onChange={(event) =>
                  setIncome({ ...income, counterparty: event.target.value })
                }
                placeholder="Örn. Ayşe Fattan"
                ref={incomeNameRef}
                value={income.counterparty}
              />
              <datalist id="income-counterparties">
                {incomeCounterparties.map((counterparty) => (
                  <option key={counterparty} value={counterparty} />
                ))}
              </datalist>
            </label>
            <label>
              <span>İşlem</span>
              <select
                data-testid="quick-income-category"
                onChange={(event) =>
                  setIncome({ ...income, category: event.target.value })
                }
                value={income.category}
              >
                {incomeCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="quick-money-field">
              <span>Tutar</span>
              <input
                data-testid="quick-expense-amount"
                inputMode="decimal"
                min="0.01"
                onChange={(event) =>
                  setIncome({ ...income, amount: event.target.value })
                }
                placeholder="0,00"
                step="0.01"
                type="number"
                value={income.amount}
              />
            </label>
            <PaymentButtons
              onChange={(paymentMethod) =>
                setIncome({ ...income, paymentMethod })
              }
              value={income.paymentMethod}
            />
            <button
              className="quick-save quick-save-income"
              disabled={savingIncome}
              type="submit"
            >
              {savingIncome ? "Kaydediliyor…" : "Geliri kaydet"}
            </button>

            <details className="quick-details">
              <summary>İsteğe bağlı not, fiş no ve KDV</summary>
              <div>
                <label>
                  <span>Not</span>
                  <input
                    onChange={(event) =>
                      setIncome({ ...income, note: event.target.value })
                    }
                    placeholder="İşlem açıklaması"
                    value={income.note}
                  />
                </label>
                <label>
                  <span>Fiş no</span>
                  <input
                    onChange={(event) =>
                      setIncome({
                        ...income,
                        documentRef: event.target.value,
                      })
                    }
                    placeholder="Varsa"
                    value={income.documentRef}
                  />
                </label>
                <label>
                  <span>KDV</span>
                  <select
                    onChange={(event) =>
                      setIncome({ ...income, vatRate: event.target.value })
                    }
                    value={income.vatRate}
                  >
                    <option value="0">%0</option>
                    <option value="0.01">%1</option>
                    <option value="0.1">%10</option>
                    <option value="0.2">%20</option>
                  </select>
                </label>
              </div>
            </details>
            {incomeError ? <p className="quick-error">{incomeError}</p> : null}
            {incomeSaved ? (
              <p className="quick-success" role="status">
                ✓ {incomeSaved}
              </p>
            ) : null}
          </form>
          <SavedRows
            kind="income"
            onReverse={(transaction) => void reverseTransaction(transaction)}
            rows={incomeRows}
          />
        </article>

        <article className="quick-ledger quick-expense-ledger">
          <header>
            <div>
              <span className="quick-step">2</span>
              <div>
                <h2>Gider listesi</h2>
                <p>Listeden seçin, fiyatı yazın ve sıradaki satıra geçin.</p>
              </div>
            </div>
            <div className="quick-header-actions">
              <b>{expenseRows.length} kayıt</b>
              <button
                className="secondary-button quick-receipt-toggle"
                onClick={() => setShowQuickReceipt((current) => !current)}
                type="button"
              >
                {showQuickReceipt ? "Çok kalemli fişi kapat" : "+ Tek fiş · çok kalem"}
              </button>
            </div>
          </header>

          {showQuickReceipt ? (
            <QuickReceiptForm
              catalog={catalog}
              counterparties={expenseCounterparties}
              inventory={inventory}
              onClose={() => setShowQuickReceipt(false)}
              onSave={onSaveQuickReceipt}
              selectedDate={selectedDate}
            />
          ) : null}

          <form
            className="quick-entry-form quick-expense-form"
            data-testid="quick-expense-form"
            onSubmit={submitExpense}
          >
            <label className="quick-field-main">
              <span>Gider / ürün</span>
              <select
                data-testid="quick-expense-catalog"
                onChange={(event) =>
                  setExpense({ ...expense, catalogKey: event.target.value })
                }
                value={expense.catalogKey}
              >
                <optgroup label="Sık giderler">
                  {catalog
                    .filter((entry) => !entry.stockTracked)
                    .map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Stok ve sarf kalemleri">
                  {catalog
                    .filter((entry) => entry.stockTracked)
                    .map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.name}
                      </option>
                    ))}
                </optgroup>
              </select>
              <button
                className="inline-add-button"
                onClick={() => setShowNewCatalog((current) => !current)}
                type="button"
              >
                {showNewCatalog ? "Yeni kalemi kapat" : "+ Listede yoksa ekle"}
              </button>
            </label>
            <label>
              <span>Kime ödendi?</span>
              <input
                list="expense-counterparties"
                onChange={(event) =>
                  setExpense({
                    ...expense,
                    counterparty: event.target.value,
                  })
                }
                placeholder="Market / tedarikçi"
                value={expense.counterparty}
              />
              <datalist id="expense-counterparties">
                {expenseCounterparties.map((counterparty) => (
                  <option key={counterparty} value={counterparty} />
                ))}
              </datalist>
            </label>
            {selectedCatalog?.stockTracked ? (
              <label className="quick-small-field">
                <span>Paket</span>
                <input
                  data-testid="quick-expense-packages"
                  min="0.01"
                  onChange={(event) =>
                    setExpense({
                      ...expense,
                      packageCount: event.target.value,
                    })
                  }
                  step="0.01"
                  type="number"
                  value={expense.packageCount}
                />
                <small>
                  × {selectedCatalog.unitsPerPackage} {selectedCatalog.unit}
                </small>
              </label>
            ) : null}
            <label className="quick-money-field">
              <span>Toplam fiyat</span>
              <input
                inputMode="decimal"
                min="0.01"
                onChange={(event) =>
                  setExpense({ ...expense, amount: event.target.value })
                }
                placeholder="0,00"
                ref={expenseAmountRef}
                step="0.01"
                type="number"
                value={expense.amount}
              />
            </label>
            <PaymentButtons
              includeCard={false}
              onChange={(paymentMethod) =>
                setExpense({ ...expense, paymentMethod })
              }
              value={expense.paymentMethod}
            />
            <button
              className="quick-save quick-save-expense"
              disabled={savingExpense}
              type="submit"
            >
              {savingExpense ? "Kaydediliyor…" : "Gideri kaydet"}
            </button>

            <details className="quick-details">
              <summary>Belge, not ve KDV</summary>
              <div>
                <label>
                  <span>Belge</span>
                  <select
                    onChange={(event) =>
                      setExpense({
                        ...expense,
                        documentType: event.target.value as DocumentType,
                      })
                    }
                    value={expense.documentType}
                  >
                    <option value="receipt">Fiş</option>
                    <option value="invoice">Fatura</option>
                    <option value="e_archive">e-Fatura / e-Arşiv</option>
                    <option value="bank_statement">Banka dekontu</option>
                    <option value="none">Belge bekliyor</option>
                  </select>
                </label>
                <label>
                  <span>Belge no</span>
                  <input
                    disabled={expense.documentType === "none"}
                    onChange={(event) =>
                      setExpense({
                        ...expense,
                        documentRef: event.target.value,
                      })
                    }
                    placeholder={
                      expense.documentType === "none"
                        ? "Sonra tamamlanacak"
                        : "Fiş / fatura numarası"
                    }
                    value={expense.documentRef}
                  />
                </label>
                <label>
                  <span>KDV</span>
                  <select
                    disabled={expense.documentType === "none"}
                    onChange={(event) =>
                      setExpense({ ...expense, vatRate: event.target.value })
                    }
                    value={expense.vatRate}
                  >
                    <option value="0">%0</option>
                    <option value="0.01">%1</option>
                    <option value="0.1">%10</option>
                    <option value="0.2">%20</option>
                  </select>
                </label>
                <label>
                  <span>Not</span>
                  <input
                    onChange={(event) =>
                      setExpense({ ...expense, note: event.target.value })
                    }
                    placeholder="İsteğe bağlı"
                    value={expense.note}
                  />
                </label>
              </div>
            </details>

            {showNewCatalog ? (
              <div className="quick-catalog-form">
                <strong>Yeni gider / stok kalemi</strong>
                <input
                  onChange={(event) =>
                    setNewCatalog({ ...newCatalog, name: event.target.value })
                  }
                  placeholder="Örn. Muayene masa örtüsü 100'lü"
                  value={newCatalog.name}
                />
                <select
                  onChange={(event) =>
                    setNewCatalog({
                      ...newCatalog,
                      category: event.target.value,
                    })
                  }
                  value={newCatalog.category}
                >
                  <option>Temizlik</option>
                  <option>Sarf</option>
                  <option>İlaç</option>
                  <option>Mama</option>
                  <option>Kırtasiye</option>
                  <option>Diğer stok</option>
                </select>
                <input
                  onChange={(event) =>
                    setNewCatalog({
                      ...newCatalog,
                      purchaseUnit: event.target.value,
                    })
                  }
                  placeholder="Alış birimi: paket"
                  value={newCatalog.purchaseUnit}
                />
                <input
                  min="0.01"
                  onChange={(event) =>
                    setNewCatalog({
                      ...newCatalog,
                      unitsPerPackage: event.target.value,
                    })
                  }
                  placeholder="Paket içi adet"
                  step="0.01"
                  type="number"
                  value={newCatalog.unitsPerPackage}
                />
                <input
                  onChange={(event) =>
                    setNewCatalog({ ...newCatalog, unit: event.target.value })
                  }
                  placeholder="Stok birimi: adet"
                  value={newCatalog.unit}
                />
                <button
                  className="secondary-button"
                  onClick={() => void addCatalogItem()}
                  type="button"
                >
                  Listeye ekle
                </button>
              </div>
            ) : null}
            {expenseError ? <p className="quick-error">{expenseError}</p> : null}
            {expenseSaved ? (
              <p className="quick-success" role="status">
                ✓ {expenseSaved}
              </p>
            ) : null}
          </form>
          {documentTarget ? (
            <form
              className="quick-document-form"
              data-testid="quick-document-form"
              onSubmit={attachExpenseDocument}
            >
              <div>
                <strong>{documentTarget.description}</strong>
                <small>
                  {money(documentTarget.amount)} · Bu satır güncellenir, yeni
                  gider oluşmaz.
                </small>
              </div>
              <select
                aria-label="Belge türü"
                onChange={(event) =>
                  setDocumentDraft({
                    ...documentDraft,
                    documentType: event.target.value as DocumentType,
                  })
                }
                value={documentDraft.documentType}
              >
                <option value="receipt">Fiş</option>
                <option value="invoice">Fatura</option>
                <option value="e_archive">e-Fatura / e-Arşiv</option>
                <option value="bank_statement">Banka dekontu</option>
              </select>
              <input
                aria-label="Belge numarası"
                onChange={(event) =>
                  setDocumentDraft({
                    ...documentDraft,
                    documentRef: event.target.value,
                  })
                }
                placeholder="Belge numarası"
                value={documentDraft.documentRef}
              />
              <select
                aria-label="Belge KDV oranı"
                onChange={(event) =>
                  setDocumentDraft({
                    ...documentDraft,
                    vatRate: event.target.value,
                  })
                }
                value={documentDraft.vatRate}
              >
                <option value="0">%0</option>
                <option value="0.01">%1</option>
                <option value="0.1">%10</option>
                <option value="0.2">%20</option>
              </select>
              <button className="secondary-button" type="submit">
                Belgeyi işle
              </button>
              <button
                aria-label="Belge girişini kapat"
                onClick={() => setDocumentTarget(null)}
                type="button"
              >
                ×
              </button>
            </form>
          ) : null}
          <SavedRows
            kind="expense"
            onAttachDocument={(transaction) => {
              setExpenseError("");
              setExpenseSaved("");
              setDocumentTarget(transaction);
            }}
            onReverse={(transaction) => void reverseTransaction(transaction)}
            rows={expenseRows}
          />
        </article>
      </section>

      <details className="quick-admin-details">
        <summary>Günlük ayarlar ve ayrıntılı kayıt</summary>
        <div>
          <label>
            Varsayılan POS komisyonu (%)
            <input
              max="99"
              min="0"
              onChange={(event) => {
                const percentage = Number(event.target.value);
                if (Number.isFinite(percentage) && percentage >= 0) {
                  onPosCommissionRateChange(percentage / 100);
                }
              }}
              step="0.01"
              type="number"
              value={(posCommissionRate * 100).toFixed(2)}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => onOpenDetailedEntry(selectedDate)}
            type="button"
          >
            Kasa çekimi / ayrıntılı hareket
          </button>
        </div>
      </details>
    </div>
  );
}
