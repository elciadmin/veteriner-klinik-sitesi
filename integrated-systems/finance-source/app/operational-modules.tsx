"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  applyStockMovement,
  dailyOperationsSummary,
  inventoryItemPosition,
  inventorySummary,
  isRecognizedExpense,
} from "@/lib/operations.mjs";
import { datePlusBusinessDays } from "@/lib/financial-core.mjs";

export type TransactionKind = "income" | "expense" | "withdrawal";
export type PaymentChannel = "cash" | "card" | "transfer" | "accrual";
export type OperationType =
  | "service"
  | "product_sale"
  | "other_income"
  | "inventory_purchase"
  | "overhead"
  | "tax"
  | "pos_commission"
  | "receivable_collection"
  | "payable_payment"
  | "inventory_usage"
  | "inventory_sale_cost"
  | "inventory_waste"
  | "owner_withdrawal";
export type CostBehavior = "fixed" | "variable" | "mixed" | "non_expense";
export type DocumentType =
  | "receipt"
  | "invoice"
  | "e_archive"
  | "bank_statement"
  | "pos_statement"
  | "stock_record"
  | "none";

export type ClinicTransaction = {
  id: string;
  date: string;
  time: string;
  kind: TransactionKind;
  category: string;
  description: string;
  counterparty?: string;
  operationType?: OperationType;
  costBehavior?: CostBehavior;
  businessClass?: string;
  relatedIncomeId?: string;
  amount: number;
  paymentMethod: PaymentChannel;
  documentType: DocumentType;
  documentRef: string;
  vatRate: number;
  posRate?: number;
  posStatus?: "pending" | "settled";
  settlementDate?: string;
  settledAmount?: number;
  settlementReference?: string;
  postingMode?: "economic_and_cash" | "cash_only" | "economic_only";
  sourceModule?: string;
  sourceRecordId?: string;
  reversalOfId?: string;
  status?: "cancelled";
  isAutomatic?: boolean;
  sourceTransactionId?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  purchaseUnit?: string;
  unitsPerPackage?: number;
  quantity: number;
  minimumQuantity: number;
  unitCost: number;
  supplier: string;
  lot: string;
  expiryDate: string;
  productDefinitionId?: string;
  baseUnit?: string;
  baseUnitsPerPurchaseUnit?: number;
  attributesJson?: string;
};

export type StockMovementType =
  | "purchase"
  | "return_in"
  | "return_out"
  | "usage"
  | "sale"
  | "waste";

export type StockMovement = {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: number;
  packageCount?: number;
  unitsPerPackage?: number;
  totalCost?: number;
  lot?: string;
  expiryDate?: string;
  documentType?: DocumentType;
  documentRef?: string;
  transactionId?: string;
  note: string;
};

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function todayInIstanbul() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

const channelLabels: Record<PaymentChannel, string> = {
  cash: "Nakit",
  card: "Kart / POS",
  transfer: "Havale",
  accrual: "Tahakkuk / stok",
};

const kindLabels: Record<TransactionKind, string> = {
  income: "Gelir",
  expense: "Gider",
  withdrawal: "Kasa çekimi",
};

const documentLabels: Record<DocumentType, string> = {
  receipt: "Nakit fiş / yazar kasa",
  invoice: "Fatura",
  e_archive: "e-Arşiv / e-Fatura",
  bank_statement: "Banka ekstresi / dekont",
  pos_statement: "POS ekstresi",
  stock_record: "Stok maliyet fişi",
  none: "Belgesiz",
};

const operationTypeLabels: Record<OperationType, string> = {
  service: "Hizmet",
  product_sale: "Ürün / mama satışı",
  other_income: "Diğer gelir",
  inventory_purchase: "Stok / sarf alımı",
  overhead: "Genel işletme gideri",
  tax: "Vergi / harç",
  pos_commission: "POS komisyonu",
  receivable_collection: "Alacak tahsilatı",
  payable_payment: "Borç ödemesi",
  inventory_usage: "Stok kullanım maliyeti",
  inventory_sale_cost: "Satılan ürün maliyeti",
  inventory_waste: "Fire / zayi maliyeti",
  owner_withdrawal: "İşletme sahibi çekimi",
};

const movementLabels: Record<StockMovementType, string> = {
  purchase: "Satın alma girişi",
  return_in: "İade girişi",
  return_out: "Alım geri alma / iade çıkışı",
  usage: "Klinik kullanım",
  sale: "Satış stok çıkışı",
  waste: "Fire / zayi",
};

const stockStatusLabels: Record<string, string> = {
  healthy: "Normal",
  low: "Kritik stok",
  out: "Tükendi",
  expiring: "SKT yaklaşıyor",
  expired: "SKT geçti",
};

const incomeCategories = [
  "Muayene",
  "Aşı ve parazit",
  "Laboratuvar",
  "Cerrahi",
  "Tedavi",
  "Pet otel / kuaför",
  "Mama / ürün satışı",
  "Diğer gelir",
];

const expenseCategories = [
  "İlaç ve sarf alımı",
  "Mama / stok alımı",
  "Kira",
  "Personel",
  "Elektrik / su / doğalgaz",
  "Muhasebe",
  "POS / banka",
  "Temizlik",
  "Poşet / kırtasiye",
  "Vergi / harç",
  "Nakliye",
  "Diğer gider",
];

function formatMoney(value: number) {
  return TRY.format(value);
}

function formatDate(value: string) {
  return value ? DATE.format(new Date(`${value}T00:00:00Z`)) : "—";
}

function MiniKpi({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "income" | "expense" | "warning";
}) {
  return (
    <article className={`ops-kpi ops-kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function DailyOperationsView({
  transactions,
  posCommissionRate,
  setPosCommissionRate,
  onNewTransaction,
}: {
  transactions: ClinicTransaction[];
  posCommissionRate: number;
  setPosCommissionRate: (rate: number) => void;
  onNewTransaction: (date: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(todayInIstanbul());
  const [filter, setFilter] = useState<
    "all" | TransactionKind | "undocumented"
  >("all");
  const summary = useMemo(
    () =>
      dailyOperationsSummary({
        transactions,
        date: selectedDate,
        openingCash: 0,
      }),
    [transactions, selectedDate],
  );
  const rows = transactions
    .filter(
      (transaction) =>
        transaction.date === selectedDate &&
        transaction.status !== "cancelled" &&
        (filter === "all" ||
          transaction.kind === filter ||
          (filter === "undocumented" &&
            transaction.kind === "expense" &&
            !isRecognizedExpense(transaction))),
    )
    .sort((a, b) => b.time.localeCompare(a.time));

  return (
    <>
      <div className="module-toolbar">
        <label>
          Gün
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <label>
          Varsayılan POS komisyonu (%)
          <input
            max="99"
            min="0"
            onChange={(event) => {
              const percentage = Number(event.target.value);
              if (Number.isFinite(percentage) && percentage >= 0) {
                setPosCommissionRate(percentage / 100);
              }
            }}
            step="0.01"
            type="number"
            value={NUMBER.format(posCommissionRate * 100).replace(",", ".")}
          />
        </label>
        <button
          className="primary-button"
          onClick={() => onNewTransaction(selectedDate)}
          type="button"
        >
          <span>+</span> Günlük hareket ekle
        </button>
      </div>

      <section className="ops-kpi-grid">
        <MiniKpi
          label="Günlük brüt gelir"
          value={formatMoney(summary.income)}
          note={`${summary.transactionCount} geçerli hareket`}
          tone="income"
        />
        <MiniKpi
          label="İşletme gideri"
          value={formatMoney(summary.expense)}
          note="Yalnız belgeli + otomatik POS gideri"
          tone="expense"
        />
        <MiniKpi
          label="Operasyon farkı"
          value={formatMoney(summary.operatingBalance)}
          note="Kâr değildir; vergi, tahakkuk ve stok maliyeti hariç"
        />
        <MiniKpi
          label="Kasadan çekilen"
          value={formatMoney(summary.withdrawals)}
          note="Gider değildir; ayrı izlenir"
          tone="warning"
        />
      </section>

      {summary.undocumentedOutflow > 0 ? (
        <div className="undocumented-alert" role="status">
          <div>
            <strong>{formatMoney(summary.undocumentedOutflow)} belgesiz çıkış</strong>
            <span>
              Kasa hareketine dâhil edildi; gider, kâr ve vergi hesabına alınmadı.
            </span>
          </div>
          <button onClick={() => setFilter("undocumented")} type="button">
            Kayıtları göster
          </button>
        </div>
      ) : null}

      <section className="ops-layout">
        <article className="panel ops-table-panel">
          <div className="panel-head ops-panel-head">
            <div>
              <span className="eyebrow">Günlük defter</span>
              <h2>Gelir ve gider hareketleri</h2>
            </div>
            <div className="filter-row compact-filter">
              {[
                ["all", "Tümü"],
                ["income", "Gelir"],
                ["expense", "Gider"],
                ["undocumented", "Belgesiz çıkış"],
                ["withdrawal", "Kasa çekimi"],
              ].map(([value, label]) => (
                <button
                  className={filter === value ? "active" : ""}
                  key={value}
                  onClick={() => setFilter(value as typeof filter)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Saat / tür</th>
                  <th>Kimden / kime</th>
                  <th>Kalem</th>
                  <th>Açıklama</th>
                  <th>Ödeme</th>
                  <th>Belge</th>
                  <th className="numeric">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <strong>{transaction.time}</strong>
                      <span
                        className={`transaction-kind kind-${transaction.kind}`}
                      >
                        {transaction.isAutomatic
                          ? "Otomatik POS gideri"
                          : transaction.kind === "expense" &&
                              !isRecognizedExpense(transaction)
                            ? "Belgesiz çıkış"
                            : kindLabels[transaction.kind]}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {transaction.counterparty || "Belirtilmedi"}
                      </strong>
                      <small>
                        {transaction.operationType
                          ? operationTypeLabels[transaction.operationType]
                          : "İşlem türü belirtilmedi"}
                      </small>
                    </td>
                    <td>{transaction.category}</td>
                    <td className="description-cell">
                      {transaction.description}
                    </td>
                    <td>
                      {channelLabels[transaction.paymentMethod]}
                      {transaction.paymentMethod === "card" ? (
                        <small>
                          {transaction.posStatus === "settled"
                            ? "Hesaba yattı"
                            : "POS bekliyor"}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {transaction.documentRef || "Belgesiz"}
                      <small>
                        {documentLabels[transaction.documentType] ??
                          transaction.documentType}
                      </small>
                    </td>
                    <td
                      className={`numeric amount-${transaction.kind}`}
                    >
                      {transaction.kind === "income" ? "+" : "−"}
                      {formatMoney(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? (
            <div className="empty-state">Bu gün ve filtrede hareket yok.</div>
          ) : null}
        </article>

        <aside className="ops-side">
          <article className="panel channel-card">
            <span className="eyebrow">Gelir dağılımı</span>
            <h2>Ödeme kanalları</h2>
            <div className="channel-list">
              <div>
                <span>Nakit</span>
                <strong>{formatMoney(summary.incomeByChannel.cash)}</strong>
              </div>
              <div>
                <span>Kart / POS</span>
                <strong>{formatMoney(summary.incomeByChannel.card)}</strong>
              </div>
              <div>
                <span>Havale</span>
                <strong>{formatMoney(summary.incomeByChannel.transfer)}</strong>
              </div>
            </div>
          </article>

          <article className="panel pos-card">
            <span className="eyebrow">Görünmez gider</span>
            <h2>POS kontrolü</h2>
            <dl>
              <div>
                <dt>Brüt kart satışı</dt>
                <dd>{formatMoney(summary.posGross)}</dd>
              </div>
              <div>
                <dt>Komisyon</dt>
                <dd className="negative">{formatMoney(summary.posFees)}</dd>
              </div>
              <div>
                <dt>Tanımlı oran</dt>
                <dd>%{NUMBER.format(posCommissionRate * 100)}</dd>
              </div>
              <div>
                <dt>Beklenen net yatış</dt>
                <dd>{formatMoney(summary.posPending)}</dd>
              </div>
            </dl>
          </article>

          <article className="panel vat-hold-card">
            <span>Satış KDV’si · mahsup öncesi</span>
            <strong>{formatMoney(summary.outputVat)}</strong>
            <small>Harcanabilir para veya net kâr değildir.</small>
          </article>
        </aside>
      </section>
    </>
  );
}

export function CashControlView({
  transactions,
  today,
}: {
  transactions: ClinicTransaction[];
  today: string;
}) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [openingCash, setOpeningCash] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const opening = Number(openingCash || 0);
  const counted = countedCash === "" ? null : Number(countedCash);
  const summary = dailyOperationsSummary({
    transactions,
    date: selectedDate,
    openingCash: Number.isFinite(opening) && opening >= 0 ? opening : 0,
    countedCash:
      counted !== null && Number.isFinite(counted) && counted >= 0
        ? counted
        : null,
  });
  const difference = summary.cashDifference;
  const differenceTone =
    difference === null
      ? "unknown"
      : Math.abs(difference) < 0.005
        ? "balanced"
        : difference < 0
          ? "short"
          : "over";

  return (
    <>
      <div className="cash-input-bar panel">
        <label>
          Kontrol günü
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <label>
          Açılış nakit kasası
          <input
            min="0"
            step="0.01"
            type="number"
            value={openingCash}
            onChange={(event) => setOpeningCash(event.target.value)}
          />
        </label>
        <label>
          Fiziksel sayılan kasa
          <input
            min="0"
            step="0.01"
            type="number"
            value={countedCash}
            onChange={(event) => setCountedCash(event.target.value)}
            placeholder="Sayım girilmedi"
          />
        </label>
      </div>

      <section className="cash-reconcile-grid">
        <article className="panel cash-result">
          <span className="eyebrow">Gün sonu mutabakatı</span>
          <div className="cash-result-main">
            <div>
              <span>Olması gereken nakit</span>
              <strong>{formatMoney(summary.expectedCash)}</strong>
            </div>
            <div>
              <span>Fiziksel sayılan nakit</span>
              <strong>
                {summary.countedCash === null
                  ? "Sayılmadı"
                  : formatMoney(summary.countedCash)}
              </strong>
            </div>
          </div>
          <div className={`cash-difference difference-${differenceTone}`}>
            <span>Kasa farkı</span>
            <strong>
              {difference === null
                ? "Hesaplanamaz"
                : `${difference > 0 ? "+" : ""}${formatMoney(difference)}`}
            </strong>
            <small>
              {differenceTone === "balanced"
                ? "Kasa tam eşleşiyor."
                : differenceTone === "short"
                  ? "Eksik kasa: fiş, çekim ve para üstünü kontrol edin."
                  : differenceTone === "over"
                    ? "Fazla kasa: kaydedilmemiş geliri kontrol edin."
                    : "Fiziksel sayım girilmeden sonuç üretilmez."}
            </small>
          </div>
        </article>

        <article className="panel cash-bridge">
          <span className="eyebrow">Nakit köprüsü</span>
          <h2>Beklenen kasa nasıl oluştu?</h2>
          <div className="bridge-row">
            <span>Açılış kasası</span>
            <strong>{formatMoney(summary.openingCash)}</strong>
          </div>
          <div className="bridge-row plus">
            <span>+ Nakit gelir</span>
            <strong>{formatMoney(summary.incomeByChannel.cash)}</strong>
          </div>
          <div className="bridge-row minus">
            <span>− Nakit işletme gideri</span>
            <strong>{formatMoney(summary.expenseByChannel.cash)}</strong>
          </div>
          <div className="bridge-row minus undocumented">
            <span>− Belgesiz nakit çıkışı</span>
            <strong>{formatMoney(summary.undocumentedByChannel.cash)}</strong>
          </div>
          <div className="bridge-row minus">
            <span>− Kasadan çekim</span>
            <strong>{formatMoney(summary.withdrawals)}</strong>
          </div>
          <div className="bridge-row total">
            <span>= Olması gereken</span>
            <strong>{formatMoney(summary.expectedCash)}</strong>
          </div>
        </article>

        <article className="panel settlement-panel">
          <span className="eyebrow">Kasada olmayan para</span>
          <h2>POS ve banka ayrımı</h2>
          <div className="settlement-metric">
            <span>Brüt POS</span>
            <strong>{formatMoney(summary.posGross)}</strong>
          </div>
          <div className="settlement-metric">
            <span>POS komisyonu</span>
            <strong className="negative">{formatMoney(summary.posFees)}</strong>
          </div>
          <div className="settlement-metric highlighted">
            <span>Bekleyen net POS</span>
            <strong>{formatMoney(summary.posPending)}</strong>
          </div>
          <p>
            Hesaba yatmayan POS, fiziksel kasaya veya kullanılabilir banka
            bakiyesine eklenmez.
          </p>
        </article>
      </section>
    </>
  );
}

export function InventoryView({
  items,
  movements,
  onOpenMovement,
  onAddItem,
}: {
  items: InventoryItem[];
  movements: StockMovement[];
  onOpenMovement: (itemId?: string) => void;
  onAddItem: () => void;
}) {
  const [filter, setFilter] = useState<
    "all" | "low" | "expiring" | "out"
  >("all");
  const [query, setQuery] = useState("");
  const today = todayInIstanbul();
  const summary = inventorySummary(items, today);
  const rows = items.filter((item) => {
    const position = inventoryItemPosition(item, today);
    const matchesSearch = `${item.name} ${item.category} ${item.supplier}`
      .toLocaleLowerCase("tr-TR")
      .includes(query.toLocaleLowerCase("tr-TR"));
    if (!matchesSearch) return false;
    if (filter === "low") return position.isLow || position.isOut;
    if (filter === "expiring")
      return position.isExpiring || position.isExpired;
    if (filter === "out") return position.isOut;
    return true;
  });

  return (
    <>
      <section className="ops-kpi-grid stock-kpis">
        <MiniKpi
          label="Stok maliyet değeri"
          value={formatMoney(summary.stockValue)}
          note={`${summary.itemCount} ürün kartı`}
        />
        <MiniKpi
          label="Kritik stok"
          value={String(summary.lowCount)}
          note="Minimumda veya altında"
          tone="warning"
        />
        <MiniKpi
          label="Tükenen"
          value={String(summary.outCount)}
          note="Yeni çıkışa kapalı"
          tone="expense"
        />
        <MiniKpi
          label="SKT uyarısı"
          value={String(summary.expiringCount)}
          note="60 gün içinde veya geçmiş"
          tone="warning"
        />
      </section>

      <article className="panel inventory-panel">
        <div className="inventory-toolbar">
          <div className="filter-row compact-filter">
            {[
              ["all", "Tüm stok"],
              ["low", "Kritik"],
              ["expiring", "SKT yaklaşan"],
              ["out", "Tükenen"],
            ].map(([value, label]) => (
              <button
                className={filter === value ? "active" : ""}
                key={value}
                onClick={() => setFilter(value as typeof filter)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="inventory-actions">
            <input
              aria-label="Stok ara"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ürün veya tedarikçi ara"
              value={query}
            />
            <button
              className="secondary-button"
              onClick={onAddItem}
              type="button"
            >
              Yeni ürün kartı
            </button>
            <button
              className="primary-button"
              onClick={() => onOpenMovement()}
              type="button"
            >
              <span>+</span> Stok hareketi
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Durum</th>
                <th className="numeric">Mevcut</th>
                <th className="numeric">Minimum</th>
                <th className="numeric">Birim maliyet</th>
                <th className="numeric">Stok değeri</th>
                <th>Lot / SKT</th>
                <th>Tedarikçi</th>
                <th aria-label="İşlem" />
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const position = inventoryItemPosition(item, today);
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.category}</small>
                    </td>
                    <td>
                      <span className={`stock-status stock-${position.code}`}>
                        {stockStatusLabels[position.code]}
                      </span>
                      {position.reorderQuantity > 0 ? (
                        <small>
                          En az {NUMBER.format(position.reorderQuantity)}{" "}
                          {item.unit} gerekli
                        </small>
                      ) : null}
                    </td>
                    <td className="numeric stock-quantity">
                      {NUMBER.format(position.quantity)} {item.unit}
                      {item.unitsPerPackage && item.unitsPerPackage > 1 ? (
                        <small>
                          {NUMBER.format(
                            position.quantity / item.unitsPerPackage,
                          )}{" "}
                          {item.purchaseUnit || "paket"} eşdeğeri
                        </small>
                      ) : null}
                    </td>
                    <td className="numeric">
                      {NUMBER.format(position.minimumQuantity)} {item.unit}
                    </td>
                    <td className="numeric">
                      {formatMoney(position.unitCost)}
                    </td>
                    <td className="numeric value">
                      {formatMoney(position.stockValue)}
                    </td>
                    <td>
                      <strong>{item.lot || "Lot yok"}</strong>
                      <small>
                        {item.expiryDate
                          ? `SKT ${formatDate(item.expiryDate)}`
                          : "SKT girilmedi"}
                      </small>
                    </td>
                    <td>{item.supplier || "—"}</td>
                    <td>
                      <button
                        className="table-action"
                        onClick={() => onOpenMovement(item.id)}
                        type="button"
                      >
                        Hareket
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel movement-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">İzlenebilirlik</span>
            <h2>Son stok hareketleri</h2>
          </div>
        </div>
        <div className="movement-list">
          {movements.slice(0, 6).map((movement) => (
            <div className="movement-row" key={movement.id}>
              <span
                className={`movement-icon movement-${movement.type}`}
                aria-hidden="true"
              >
                {movement.type === "purchase" ||
                movement.type === "return_in"
                  ? "+"
                  : "−"}
              </span>
              <div>
                <strong>{movement.itemName}</strong>
                <small>
                  {movementLabels[movement.type]} · {formatDate(movement.date)}
                </small>
              </div>
              <b>
                {movement.packageCount
                  ? `${NUMBER.format(movement.packageCount)} paket · `
                  : ""}
                {NUMBER.format(movement.quantity)}{" "}
                {items.find((item) => item.id === movement.itemId)?.unit || ""}
              </b>
              <p>{movement.note || "Not yok"}</p>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}

export function TransactionDialog({
  defaultDate,
  defaultPosRate,
  transactions,
  onClose,
  onSave,
}: {
  defaultDate: string;
  defaultPosRate: number;
  transactions: ClinicTransaction[];
  onClose: () => void;
  onSave: (transaction: ClinicTransaction) => void;
}) {
  const [kind, setKind] = useState<TransactionKind>("income");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentChannel>("cash");
  const [documentType, setDocumentType] =
    useState<DocumentType>("receipt");
  const [operationType, setOperationType] =
    useState<OperationType>("service");
  const [costBehavior, setCostBehavior] =
    useState<CostBehavior>("variable");
  const [error, setError] = useState("");
  const categories =
    kind === "income"
      ? incomeCategories
      : kind === "expense"
        ? expenseCategories
        : ["İşletme sahibi çekimi", "Bankaya yatırma", "Diğer kasa çekimi"];

  function changeKind(nextKind: TransactionKind) {
    setKind(nextKind);
    if (nextKind === "withdrawal") {
      setPaymentMethod("cash");
      setDocumentType("none");
      setOperationType("owner_withdrawal");
      setCostBehavior("non_expense");
    } else if (nextKind === "income") {
      setOperationType("service");
      setCostBehavior("non_expense");
      if (documentType === "none") setDocumentType("receipt");
    } else {
      setOperationType("overhead");
      setCostBehavior("variable");
      if (documentType === "none") setDocumentType("invoice");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const date = String(form.get("date") || "");
    const time = String(form.get("time") || "");
    const description = String(form.get("description") || "").trim();
    const category = String(form.get("category") || "");
    const counterparty = String(form.get("counterparty") || "").trim();
    const relatedIncomeId = String(
      form.get("relatedIncomeId") || "",
    ).trim();
    const documentRef = String(form.get("documentRef") || "").trim();
    const vatRate = kind === "withdrawal" ? 0 : Number(form.get("vatRate"));
    const posRate =
      kind === "income" && paymentMethod === "card"
        ? Number(form.get("posRate")) / 100
        : 0;
    const settlementDate =
      kind === "income" && paymentMethod === "card"
        ? String(form.get("settlementDate") || "")
        : "";

    if (
      !date ||
      !time ||
      !description ||
      !category ||
      !counterparty ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Zorunlu alanları ve sıfırdan büyük tutarı kontrol edin.");
      return;
    }
    if (
      kind === "expense" &&
      documentType !== "none" &&
      !documentRef
    ) {
      setError(
        "Belgeli gider için fiş/fatura numarası zorunludur. Belge yoksa “Belgesiz” seçin.",
      );
      return;
    }
    if (
      paymentMethod === "card" &&
      kind === "income" &&
      (!Number.isFinite(posRate) || posRate < 0 || !settlementDate)
    ) {
      setError("Kart satışında POS oranı ve yatış tarihi zorunludur.");
      return;
    }

    onSave({
      id: `tx-${Date.now()}`,
      date,
      time,
      kind,
      category,
      description,
      counterparty,
      operationType,
      costBehavior:
        kind === "income" ? "non_expense" : costBehavior,
      relatedIncomeId:
        kind === "expense" && relatedIncomeId
          ? relatedIncomeId
          : undefined,
      amount,
      paymentMethod: kind === "withdrawal" ? "cash" : paymentMethod,
      documentType: kind === "withdrawal" ? "none" : documentType,
      documentRef,
      vatRate,
      posRate,
      posStatus:
        kind === "income" && paymentMethod === "card"
          ? "pending"
          : undefined,
      settlementDate: settlementDate || undefined,
    });
  }

  return (
    <div className="overlay modal-overlay" role="presentation" onMouseDown={onClose}>
      <form
        className="modal operation-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Günlük işletme defteri</span>
            <h2>Yeni hareket</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Kapat">
            ×
          </button>
        </div>

        <div className="segmented-control three-way">
          {(["income", "expense", "withdrawal"] as TransactionKind[]).map(
            (value) => (
              <button
                className={kind === value ? "active" : ""}
                key={value}
                onClick={() => changeKind(value)}
                type="button"
              >
                {kindLabels[value]}
              </button>
            ),
          )}
        </div>

        <div className="form-grid">
          <label>
            Tarih *
            <input name="date" type="date" defaultValue={defaultDate} required />
          </label>
          <label>
            Saat *
            <input name="time" type="time" defaultValue="12:00" required />
          </label>
          <label>
            Kalem *
            <select name="category" required>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            {kind === "income"
              ? "Kimden geldi / ödeyen *"
              : kind === "expense"
                ? "Kime ödendi / tedarikçi *"
                : "Çekimi alan *"}
            <input
              name="counterparty"
              placeholder={
                kind === "income"
                  ? "Müşteri / hasta sahibi veya kurum"
                  : kind === "expense"
                    ? "Tedarikçi / kurum / kişi"
                    : "İşletme sahibi"
              }
              required
            />
          </label>
          {kind !== "withdrawal" ? (
            <label>
              İşlem yapısı *
              <select
                onChange={(event) =>
                  setOperationType(event.target.value as OperationType)
                }
                value={operationType}
              >
                {(kind === "income"
                  ? (["service", "product_sale", "other_income"] as const)
                  : (["inventory_purchase", "overhead", "tax"] as const)
                ).map((value) => (
                  <option key={value} value={value}>
                    {operationTypeLabels[value]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Tutar (KDV dâhil) *
            <input
              min="0.01"
              name="amount"
              placeholder="0,00"
              step="0.01"
              type="number"
              required
            />
          </label>
          <label className="span-2">
            Açıklama *
            <textarea
              name="description"
              placeholder="Hizmet, ürün veya giderin açıklaması"
              required
            />
          </label>
          <label>
            Ödeme kanalı
            <select
              data-testid="payment-method"
              disabled={kind === "withdrawal"}
              name="paymentMethod"
              onChange={(event) =>
                setPaymentMethod(event.target.value as PaymentChannel)
              }
              value={kind === "withdrawal" ? "cash" : paymentMethod}
            >
              <option value="cash">Nakit</option>
              <option value="card">Kart / POS</option>
              <option value="transfer">Havale</option>
            </select>
          </label>
          <label>
            KDV oranı
            <select name="vatRate" disabled={kind === "withdrawal"} defaultValue="0.2">
              <option value="0">KDV yok / %0</option>
              <option value="0.01">%1</option>
              <option value="0.1">%10</option>
              <option value="0.2">%20</option>
            </select>
          </label>
          {kind === "income" && paymentMethod === "card" ? (
            <>
              <label>
                POS komisyonu (%) *
                <input
                  defaultValue={NUMBER.format(defaultPosRate * 100).replace(
                    ",",
                    ".",
                  )}
                  max="99"
                  min="0"
                  name="posRate"
                  step="0.01"
                  type="number"
                  required
                />
              </label>
              <label>
                Beklenen yatış *
                <input
                  defaultValue={datePlusBusinessDays(defaultDate, 2)}
                  name="settlementDate"
                  type="date"
                  required
                />
              </label>
            </>
          ) : null}
          {kind !== "withdrawal" ? (
            <label>
              Belge türü
              <select
                data-testid="document-type"
                onChange={(event) =>
                  setDocumentType(event.target.value as DocumentType)
                }
                value={documentType}
              >
                {Object.entries(documentLabels)
                  .filter(([value]) =>
                    kind === "expense"
                      ? value !== "pos_statement"
                      : value !== "bank_statement" &&
                        value !== "pos_statement" &&
                        value !== "none",
                  )
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {kind === "expense" ? (
            <>
              <label>
                Gider davranışı *
                <select
                  onChange={(event) =>
                    setCostBehavior(event.target.value as CostBehavior)
                  }
                  value={costBehavior}
                >
                  <option value="variable">Değişken · gelire bağlı</option>
                  <option value="fixed">Sabit · gelirden bağımsız</option>
                  <option value="mixed">Karma</option>
                </select>
              </label>
              <label className="span-2">
                İlişkili gelir işlemi
                <select name="relatedIncomeId" defaultValue="">
                  <option value="">
                    Tek bir gelire bağlanmadı / ortak gider
                  </option>
                  {transactions
                    .filter(
                      (transaction) =>
                        transaction.kind === "income" &&
                        transaction.status !== "cancelled",
                    )
                    .slice(0, 60)
                    .map((transaction) => (
                      <option key={transaction.id} value={transaction.id}>
                        {transaction.date} · {transaction.time} ·{" "}
                        {transaction.counterparty || "Ödeyen belirtilmedi"} ·{" "}
                        {transaction.category} · {formatMoney(transaction.amount)}
                      </option>
                    ))}
                </select>
                <small>
                  Seçilirse bu gider ilgili satış veya hizmetin katkı payından
                  otomatik düşülür.
                </small>
              </label>
            </>
          ) : null}
          <label className="span-2">
            Fiş / fatura / belge no
            <input
              name="documentRef"
              placeholder={
                documentType === "none"
                  ? "Belge yok; gider hesabına alınmayacak"
                  : "Belge numarasını girin"
              }
            />
          </label>
        </div>

        {kind === "withdrawal" ? (
          <div className="modal-note warning-note">
            Kasa çekimi işletme gideri veya kâr azaltıcı gider sayılmaz; nakit
            mutabakatında ayrı düşülür.
          </div>
        ) : null}
        {kind === "expense" && documentType === "none" ? (
          <div className="modal-note warning-note">
            Bu para çıkışı fiziksel kasayı azaltır; fakat belge tamamlanana kadar
            işletme gideri, KDV indirimi veya kâr hesabına alınmaz. Aksiyon
            merkezinde uyarı oluşturulur.
          </div>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className="primary-button" type="submit">
            Günlük deftere kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

export function StockMovementDialog({
  items,
  selectedItemId,
  defaultDate,
  onClose,
  onSave,
}: {
  items: InventoryItem[];
  selectedItemId?: string;
  defaultDate: string;
  onClose: () => void;
  onSave: (movement: StockMovement) => boolean | Promise<boolean>;
}) {
  const [itemId, setItemId] = useState(selectedItemId || items[0]?.id || "");
  const [type, setType] = useState<StockMovementType>("usage");
  const [documentType, setDocumentType] =
    useState<DocumentType>("invoice");
  const [error, setError] = useState("");
  const selected = items.find((item) => item.id === itemId);
  const isEntry = type === "purchase" || type === "return_in";
  const unitsPerPackage = Number(selected?.unitsPerPackage || 1);
  const isPackagePurchase =
    type === "purchase" && unitsPerPackage > 1;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const packageCount = isPackagePurchase
      ? Number(form.get("packageCount"))
      : undefined;
    const quantity = isPackagePurchase
      ? Number(packageCount) * unitsPerPackage
      : Number(form.get("quantity"));
    const totalCost = isEntry ? Number(form.get("totalCost")) : undefined;
    const unitCost =
      isEntry && Number.isFinite(totalCost) && Number(totalCost) > 0
        ? Number(totalCost) / quantity
        : isEntry
          ? Number(form.get("unitCost"))
          : selected.unitCost;
    const documentRef = String(form.get("documentRef") || "").trim();

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Stok hareket miktarı sıfırdan büyük olmalıdır.");
      return;
    }
    if (
      isEntry &&
      documentType !== "none" &&
      !documentRef
    ) {
      setError(
        "Belgeli satın alma için fiş/fatura numarası zorunludur. Belge yoksa “Belgesiz” seçin.",
      );
      return;
    }
    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      itemId: selected.id,
      itemName: selected.name,
      date: String(form.get("date") || ""),
      type,
      quantity,
      unitCost,
      packageCount,
      unitsPerPackage: isPackagePurchase ? unitsPerPackage : undefined,
      totalCost:
        isEntry && Number.isFinite(totalCost) && Number(totalCost) >= 0
          ? Number(totalCost)
          : undefined,
      lot: String(form.get("lot") || "").trim(),
      expiryDate: String(form.get("expiryDate") || ""),
      documentType: isEntry ? documentType : undefined,
      documentRef: isEntry ? documentRef : undefined,
      note: String(form.get("note") || "").trim(),
    };

    try {
      applyStockMovement(selected, movement);
      const saved = await onSave(movement);
      if (saved === false) {
        setError("Stok ve maliyet kaydı tamamlanamadı; miktar değiştirilmedi.");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Stok hareketi kaydedilemedi.",
      );
    }
  }

  return (
    <div className="overlay modal-overlay" role="presentation" onMouseDown={onClose}>
      <form
        className="modal stock-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Miktar ve maliyet kaydı</span>
            <h2>Yeni stok hareketi</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Kapat">
            ×
          </button>
        </div>

        <div className="form-grid">
          <label className="span-2">
            Ürün *
            <select
              onChange={(event) => setItemId(event.target.value)}
              value={itemId}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {NUMBER.format(item.quantity)} {item.unit}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hareket türü *
            <select
              onChange={(event) =>
                setType(event.target.value as StockMovementType)
              }
              value={type}
            >
              {Object.entries(movementLabels)
                .filter(([value]) =>
                  ["usage", "sale", "waste"].includes(value),
                )
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tarih *
            <input name="date" type="date" defaultValue={defaultDate} required />
          </label>
          {isPackagePurchase ? (
            <label>
              Paket sayısı *
              <input
                min="0.01"
                name="packageCount"
                step="0.01"
                type="number"
                required
              />
              <small>
                1 {selected?.purchaseUnit || "paket"} ={" "}
                {NUMBER.format(unitsPerPackage)} {selected?.unit}
              </small>
            </label>
          ) : (
            <label>
              Miktar ({selected?.unit}) *
              <input
                min="0.01"
                name="quantity"
                step="0.01"
                type="number"
                required
              />
            </label>
          )}
          {isEntry ? (
            <label>
              Toplam alım tutarı *
              <input
                min="0"
                name="totalCost"
                step="0.01"
                type="number"
                required
              />
            </label>
          ) : (
            <label>
              Kayıtlı birim maliyet
              <input
                defaultValue={selected?.unitCost ?? 0}
                disabled
                type="number"
              />
            </label>
          )}
          <input
            name="unitCost"
            type="hidden"
            value={selected?.unitCost ?? 0}
          />
          {isEntry ? (
            <>
              <label>
                Lot no
                <input name="lot" placeholder="Varsa lot numarası" />
              </label>
              <label>
                Son kullanma tarihi
                <input name="expiryDate" type="date" />
              </label>
              <label>
                Belge türü
                <select
                  onChange={(event) =>
                    setDocumentType(event.target.value as DocumentType)
                  }
                  value={documentType}
                >
                  {Object.entries(documentLabels)
                    .filter(([value]) => value !== "pos_statement")
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Belge no
                <input
                  name="documentRef"
                  placeholder={
                    documentType === "none"
                      ? "Belge yok"
                      : "Fiş / fatura numarası"
                  }
                />
              </label>
            </>
          ) : null}
          <label className="span-2">
            Açıklama / belge
            <textarea
              name="note"
              placeholder="Fatura no, kullanım nedeni veya fire açıklaması"
            />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-note">
          Bu ekran yalnız kullanım, satış ve fire çıkışı içindir; stok maliyeti
          aynı anda kâr/zarara otomatik yazılır. Satın almayı para hareketinden
          koparmamak için Günlük Giriş &gt; Gider listesini veya mevcut borca
          fatura işleme akışını kullanın. Mevcut stoktan fazla çıkışa izin
          verilmez.
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className="primary-button" type="submit">
            Stok hareketini kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

export function InventoryItemDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      id: `stock-${Date.now()}`,
      name: String(form.get("name") || "").trim(),
      category: String(form.get("category") || ""),
      unit: String(form.get("unit") || "").trim(),
      purchaseUnit:
        String(form.get("purchaseUnit") || "").trim() ||
        String(form.get("unit") || "").trim(),
      unitsPerPackage: Number(form.get("unitsPerPackage") || 1),
      quantity: Number(form.get("quantity")),
      minimumQuantity: Number(form.get("minimumQuantity")),
      unitCost: Number(form.get("unitCost")),
      supplier: String(form.get("supplier") || "").trim(),
      lot: String(form.get("lot") || "").trim(),
      expiryDate: String(form.get("expiryDate") || ""),
    });
  }

  return (
    <div className="overlay modal-overlay" role="presentation" onMouseDown={onClose}>
      <form
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Stok ana verisi</span>
            <h2>Yeni ürün kartı</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Kapat">
            ×
          </button>
        </div>
        <div className="form-grid">
          <label className="span-2">
            Ürün adı *
            <input name="name" required />
          </label>
          <label>
            Kategori *
            <select name="category" required>
              <option>Aşı</option>
              <option>İlaç</option>
              <option>Sarf</option>
              <option>Mama</option>
              <option>Temizlik</option>
              <option>Diğer</option>
            </select>
          </label>
          <label>
            Takip birimi *
            <input name="unit" placeholder="adet, doz, rulo, şişe" required />
          </label>
          <label>
            Alım birimi
            <input name="purchaseUnit" placeholder="paket, koli, kutu" />
          </label>
          <label>
            Alım birimindeki adet *
            <input
              defaultValue="1"
              min="0.01"
              name="unitsPerPackage"
              step="0.01"
              type="number"
              required
            />
          </label>
          <label>
            Açılış miktarı *
            <input min="0" name="quantity" step="0.01" type="number" required />
          </label>
          <label>
            Minimum stok *
            <input
              min="0"
              name="minimumQuantity"
              step="0.01"
              type="number"
              required
            />
          </label>
          <label>
            Birim maliyet *
            <input min="0" name="unitCost" step="0.01" type="number" required />
          </label>
          <label>
            Tedarikçi
            <input name="supplier" />
          </label>
          <label>
            Lot
            <input name="lot" />
          </label>
          <label>
            Son kullanma tarihi
            <input name="expiryDate" type="date" />
          </label>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className="primary-button" type="submit">
            Ürün kartını oluştur
          </button>
        </div>
      </form>
    </div>
  );
}
