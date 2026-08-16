"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  calendarEventsFromLedger,
  ledgerStatus,
  ledgerSummary,
  monthlyReserveRequirement,
} from "@/lib/finance.mjs";
import {
  buildDecisionEngine,
  DEFAULT_DECISION_SETTINGS,
  normalizeDecisionSettings,
} from "@/lib/decision-engine.mjs";
import {
  createPosCommissionExpense,
  dailyOperationsSummary,
  inventorySummary,
  operationalCalendarEvents,
  applyStockMovement,
} from "@/lib/operations.mjs";
import { assessFinanceIntegrity } from "@/lib/integrity.mjs";
import { expectedPosNet } from "@/lib/financial-core.mjs";
import {
  buildCurrentAccountBook,
  currentAccountBookCsv,
} from "@/lib/current-account-book.mjs";
import { recurringCalendarEvents } from "@/lib/recurring.mjs";
import {
  DENOMINATION_LABELS,
  GOLD_KARATS,
  SILVER_FINENESS,
  denominationDescriptor,
  indexedAmountValue,
  indexedLedgerValue,
  openingQuantity,
  purityFactor,
  remainingDenomination,
} from "@/lib/indexed-ledger.mjs";
import {
  CashControlView,
  ClinicTransaction,
  InventoryItem,
  InventoryItemDialog,
  InventoryView,
  StockMovement,
  StockMovementDialog,
  TransactionDialog,
} from "./operational-modules";
import {
  QuickDailyView,
  QuickPurchasePayload,
  QuickReceiptPayload,
} from "./quick-daily-view";
import {
  RecurringExpenseOccurrence,
  RecurringExpenseRule,
  RecurringExpensesView,
  RecurringPaymentPayload,
} from "./recurring-expenses-view";
import {
  DecisionEngineView,
  type DecisionSettings,
} from "./decision-engine-view";
import { InsightsView, ReportsView } from "./reporting-modules";
import { HistoricalImportView } from "./historical-import-view";
import { GoalsView, type FinancialGoal, type GoalMilestone } from "./goals-view";
import {
  MonthlyCloseEvent,
  MonthlyCloseInput,
  MonthlyClosing,
  MonthlyCloseView,
} from "./monthly-close-view";
import {
  PlanningWorkspace,
  RecordsWorkspace,
  SettingsWorkspace,
  TodayWorkspace,
  WorkWorkspace,
} from "./clinic-workspace";
import { postFinanceJson } from "./finance-request";
import VERIFIED_TEST_REPORT from "./verified-test-report.json";

type Payment = {
  id?: string;
  amount: number;
  denominationCode?: string;
  denominationQuantity?: number;
  denominationUnitPrice?: number;
  date: string;
  method?: string;
  note?: string;
  status?: "cancelled";
  transactionId?: string;
  importBatchId?: string;
};

type LedgerType = "receivable" | "payable";

type LedgerLineItem = {
  id: string;
  recordId: string;
  inventoryItemId?: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  trackStock: boolean;
  stockMovementId?: string;
};

type LedgerRecord = {
  id: string;
  type: LedgerType;
  counterparty: string;
  contactName: string;
  phone: string;
  email: string;
  detail: string;
  documentRef: string;
  documentDate?: string;
  stage?: "note" | "invoiced";
  createdDate: string;
  dueDate: string;
  originalAmount: number;
  denominationCode?: string;
  denominationQuantity?: number;
  denominationOpenUnitPrice?: number;
  denominationRateSource?: string;
  denominationAssetClass?: string;
  denominationUnit?: string;
  denominationPurity?: number;
  denominationKarat?: number;
  denominationMillesimal?: number;
  denominationLabel?: string;
  reserve: number;
  reminderDays: number;
  importBatchId?: string;
  lineItems?: LedgerLineItem[];
  payments: Payment[];
};

type View =
  | "today"
  | "work"
  | "records"
  | "settings"
  | "overview"
  | "decision"
  | "daily"
  | "recurring"
  | "ledger"
  | "calendar"
  | "debts"
  | "cash"
  | "inventory"
  | "goals"
  | "tax"
  | "insights"
  | "reports"
  | "import"
  | "checks";

type RecordForm = {
  type: LedgerType;
  counterparty: string;
  contactName: string;
  phone: string;
  email: string;
  detail: string;
  documentRef: string;
  createdDate: string;
  dueDate: string;
  amount: string;
  denominationCode: string;
  denominationQuantity: string;
  denominationOpenUnitPrice: string;
  denominationRateSource: string;
  denominationPurity: string;
  denominationKarat: string;
  denominationMillesimal: string;
  installmentCount: string;
  reminderDays: string;
  initialPayment: string;
  initialPaymentMethod: "cash" | "card" | "transfer";
  recognizeRevenue: boolean;
};

type PaymentForm = {
  recordId: string;
  date: string;
  amount: string;
  denominationQuantity: string;
  denominationUnitPrice: string;
  method: string;
  note: string;
};

type DataMode = "checking" | "empty" | "persistent" | "offline";

type AuditEvent = {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  createdAt: string;
};

type ClinicDataResponse = {
  hasData: boolean;
  transactions: ClinicTransaction[];
  inventory: InventoryItem[];
  productDefinitions: ProductDefinition[];
  stockMovements: StockMovement[];
  records: LedgerRecord[];
  recurringRules: RecurringExpenseRule[];
  recurringOccurrences: RecurringExpenseOccurrence[];
  monthlyClosings: MonthlyClosing[];
  monthlyCloseEvents: MonthlyCloseEvent[];
  importBatches: ImportBatch[];
  goals: FinancialGoal[];
  goalMilestones: GoalMilestone[];
  valuationRates: Array<{ id: string; assetCode: string; unitPrice: number; source: string; effectiveAt: string }>;
  installmentSchedules: Array<{ id: string; ledgerRecordId: string; installmentNo: number; dueDate: string; amount: number; denominationQuantity?: number; status: string; paymentId?: string }>;
  settings: Record<string, string>;
  auditEvents: AuditEvent[];
};

type ImportBatch = {
  id: string;
  sourceFileName: string;
  status: string;
  coverageStartDate: string;
  coverageEndDate: string;
  completenessBps: number;
  warnings: string[];
  createdAt: string;
  appliedAt?: string;
  rolledBackAt?: string;
  rollbackReason: string;
};

type ProductDefinition = {
  id: string;
  canonicalName: string;
  productFamily: string;
  baseUnit: string;
  attributes: Record<string, unknown>;
  aliases: string[];
  status: string;
};

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

const TODAY = todayInIstanbul();

const navItems: Array<{ id: View; label: string; meta?: string }> = [
  { id: "today", label: "Finans Masası" },
  { id: "work", label: "Yapılacaklar" },
  { id: "records", label: "Defterler" },
  { id: "cash", label: "Kasa & POS" },
  { id: "goals", label: "Hedefler" },
  { id: "reports", label: "Raporlar" },
  { id: "settings", label: "Ayarlar & Denetim" },
];

const statusLabels: Record<string, string> = {
  open: "Açık",
  partial: "Kısmi",
  due_soon: "Vade yakın",
  due_soon_partial: "Vade yakın · Kısmi",
  due_today: "Bugün",
  due_today_partial: "Bugün · Kısmi",
  overdue: "Gecikmiş",
  overdue_partial: "Gecikmiş · Kısmi",
  paid: "Tamamlandı",
};

const viewTitles: Record<View, { title: string; subtitle: string }> = {
  today: {
    title: "Finans Masası",
    subtitle: "Yaz, kaydet, tahsil et, öde; önemli finans durumunu tek ekrandan yönet.",
  },
  work: {
    title: "İşler",
    subtitle: "Vade, belge, POS ve stok uyarılarını önceliğine göre tamamlayın.",
  },
  records: {
    title: "Kayıtlar",
    subtitle: "Hareket, borç-alacak, sabit gider ve stok kayıtlarını buradan yönetin.",
  },
  settings: {
    title: "Ayarlar ve denetim",
    subtitle: "Aktarım, denetim ve teknik finans ayarları günlük kullanımdan ayrıdır.",
  },
  overview: {
    title: "Finansal kontrol merkezi",
    subtitle:
      "Günlük hareket, kasa, alacak, borç, POS ve stok risklerinin tek görünümü.",
  },
  decision: {
    title: "Finansal karar merkezi",
    subtitle:
      "Vergi, 13 haftalık nakit, borç, alım, ev bütçesi ve hedef kapılarını tek sonuçta birleştirir.",
  },
  daily: {
    title: "Bugünün hızlı gelir-gider defteri",
    subtitle:
      "İki listeden kaydedin; tamamlanan satır sabitlensin, sıradaki boş satır kendiliğinden açılsın.",
  },
  recurring: {
    title: "Sabit ve dönemsel giderler",
    subtitle:
      "Kira, muhasebe, internet ve abonelikleri bir kez tanımlayın; ödeme planı kendiliğinden oluşsun.",
  },
  ledger: {
    title: "Alacak defteri",
    subtitle:
      "Listeye kayıt girin; kalan bakiye, durum ve takvim otomatik hesaplansın.",
  },
  calendar: {
    title: "Finans takvimi",
    subtitle:
      "Alacak, borç, tahsilat, ödeme, POS yatışı ve stok/SKT uyarıları otomatik yansır.",
  },
  debts: {
    title: "Borçlar ve ödeme rezervi",
    subtitle:
      "Her borcun kalanını, vadeye kadar ayrılması gereken aylık tutarı ve fonlanma durumunu izleyin.",
  },
  cash: {
    title: "Kasa ve ay sonu kontrolü",
    subtitle:
      "Nakit, banka ve POS’u mutabık kapatın. POS beklenen tarihleri hafta sonunu atlayan tahmindir; resmî tatilleri banka ekstresiyle doğrulayın.",
  },
  inventory: {
    title: "Temel stok yönetimi",
    subtitle:
      "Toplam stok, kritik seviye ve temel SKT takibi. Aynı ürünün çoklu lot/FEFO yönetimi bu sürümde resmî lot sistemi değildir.",
  },
  insights: {
    title: "İstatistik ve aksiyon merkezi",
    subtitle:
      "Gelir, belgeli gider, belgesiz çıkış, POS maliyeti ve sarf tüketiminden yönetim aksiyonu üretin.",
  },
  reports: {
    title: "Yönetim raporları",
    subtitle:
      "Tarih aralığını seçin; gelir ve giderleri Excel/CSV indirin veya tam raporu PDF alın.",
  },
  goals: {
    title: "Hedefler ve tahmin",
    subtitle:
      "Yıllık hedefi kilitleyin; gerçekleşme, mesafe ve gereken tempoyu ayrı görün.",
  },
  tax: {
    title: "Vergi ve POS",
    subtitle:
      "KDV, vergi rezervleri, stopaj ve POS kesintilerini dönem bazında kontrol edin.",
  },
  import: {
    title: "Geçmiş veri aktarımı",
    subtitle:
      "Hazırlanmış Excel geçmişini ön izleyin; gelir, gider taslağı ve borç geçmişini mükerrer oluşturmadan aktarın.",
  },
  checks: {
    title: "Formül denetimi",
    subtitle:
      "Sonuçların hangi kuralla üretildiğini ve test durumunu açıkça görün.",
  },
};

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatMoney(value: number) {
  return currency.format(value);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function addMonthsSafe(value: string, months: number) {
  const source = new Date(`${value}T00:00:00Z`);
  const day = source.getUTCDate();
  const first = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return first.toISOString().slice(0, 10);
}

function statusTone(code: string) {
  if (code === "paid") return "success";
  if (code.startsWith("overdue")) return "danger";
  if (code.startsWith("due_today")) return "danger";
  if (code.startsWith("due_soon")) return "warning";
  if (code === "partial") return "warning";
  return "info";
}

function StatusPill({ code }: { code: string }) {
  return (
    <span className={`status-pill status-${statusTone(code)}`}>
      <span className="status-dot" />
      {statusLabels[code] ?? code}
    </span>
  );
}

function KpiCard({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "blue" | "red" | "purple";
}) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function Sidebar({
  activeView,
  setActiveView,
}: {
  activeView: View;
  setActiveView: (view: View) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">E</div>
        <div>
          <strong>ELÇİ</strong>
          <span>Klinik Yönetim</span>
        </div>
      </div>

      <p className="nav-section">Yönetim</p>
      <nav className="side-nav" aria-label="Yönetim bölümleri">
        {navItems.map((item) => (
          <button
            className={activeView === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setActiveView(item.id)}
            type="button"
          >
            <span>{item.label}</span>
            {item.meta ? <small>{item.meta}</small> : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className="health-dot" />
        <div>
          <strong>Güvenli kayıt ilkesi</strong>
          <span>Düzeltme ve iptal denetim iziyle yapılır</span>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({
  activeView,
  setActiveView,
}: {
  activeView: View;
  setActiveView: (view: View) => void;
}) {
  return (
    <div className="mobile-nav" aria-label="Mobil yönetim bölümleri">
      {[
        { id: "today" as View, label: "Masa" },
        { id: "work" as View, label: "İşler" },
        { id: "daily" as View, label: "+ Kayıt" },
        { id: "records" as View, label: "Kayıtlar" },
        { id: "settings" as View, label: "Daha fazla" },
      ].map((item) => (
        <button
          className={activeView === item.id ? "active" : ""}
          key={item.id}
          onClick={() => setActiveView(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function DataNotice({
  mode,
  error,
}: {
  mode: DataMode;
  error: string;
}) {
  if (mode === "persistent") {
    return (
      <div className="demo-notice persistent-notice">
        <span>KALICI KAYIT</span>
        Site veritabanı aktif; bundan sonra oluşturulan kayıtlar ve dönemsel
        istatistikler korunur. Bu ekrandaki veriler gerçek veritabanından okunur.
        {error ? <strong className="finance-action-error">Son işlem uygulanamadı: {error}</strong> : null}
      </div>
    );
  }
  if (mode === "checking") {
    return (
      <div className="demo-notice">
        <span>KONTROL</span>
        Kalıcı kayıt alanı kontrol ediliyor.
      </div>
    );
  }
  if (mode === "empty") {
    return (
      <div className="demo-notice persistent-notice">
        <span>BOŞ SİSTEM</span>
        Henüz finans kaydı yok. İlk gerçek kaydınızı oluşturduğunuzda bu alan güncellenir.
      </div>
    );
  }
  return (
    <div className="demo-notice">
      <span>BAĞLANTI HATASI</span>
      Veritabanı doğrulanmadan örnek veya eski rakam gösterilmez.
      {error ? ` Ayrıntı: ${error}` : ""}
    </div>
  );
}

function OverviewView({
  summary,
  records,
  transactions,
  inventory,
  decision,
  onNavigate,
}: {
  summary: ReturnType<typeof ledgerSummary>;
  records: LedgerRecord[];
  transactions: ClinicTransaction[];
  inventory: InventoryItem[];
  decision: ReturnType<typeof buildDecisionEngine>;
  onNavigate: (view: View) => void;
}) {
  const overdueRecords = records
    .map((record) => ({
      record,
      status: ledgerStatus({ ...record, today: TODAY }),
    }))
    .filter(({ status }) => status.code.startsWith("overdue"));

  const upcoming = records
    .map((record) => ({
      record,
      status: ledgerStatus({ ...record, today: TODAY }),
    }))
    .filter(
      ({ status }) =>
        status.code.startsWith("due_soon") ||
        status.code.startsWith("due_today"),
    );
  const daily = dailyOperationsSummary({
    transactions,
    date: TODAY,
    openingCash: 0,
    countedCash: null,
  });
  const stock = inventorySummary(inventory, TODAY);
  const debtDecision = decision.cards.find((card) => card.id === "debt");
  const debtStatusLabel =
    decision.borrowing.status === "green"
      ? "SINIRLI ONAY"
      : decision.borrowing.status === "yellow"
        ? "VERİ BEKLİYOR"
        : "KAPALI";

  return (
    <>
      <section className="kpi-grid">
        <KpiCard
          label="Bugünkü brüt gelir"
          value={formatMoney(daily.income)}
          note={`${formatMoney(daily.incomeByChannel.card)} kart · ${formatMoney(daily.incomeByChannel.cash)} nakit`}
          tone="blue"
        />
        <KpiCard
          label="Bugünkü işletme gideri"
          value={formatMoney(daily.expense)}
          note={`${formatMoney(daily.withdrawals)} kasa çekimi ayrıca`}
          tone="red"
        />
        <KpiCard
          label="Operasyon farkı"
          value={formatMoney(daily.operatingBalance)}
          note="Kâr değil; vergi, tahakkuk ve stok maliyeti hariç"
          tone="purple"
        />
        <KpiCard
          label="Beklenen fiziksel kasa"
          value={formatMoney(daily.expectedCash)}
          note={`Sayım farkı ${formatMoney(daily.cashDifference ?? 0)}`}
        />
      </section>

      <section className="snapshot-strip" aria-label="Risk özeti">
        <button onClick={() => onNavigate("ledger")} type="button">
          <span>Açık alacak</span>
          <strong>{formatMoney(summary.receivable.remaining)}</strong>
          <small>
            {formatMoney(summary.receivable.overdue)} gecikmiş
          </small>
        </button>
        <button onClick={() => onNavigate("debts")} type="button">
          <span>Kalan borç</span>
          <strong>{formatMoney(summary.payable.remaining)}</strong>
          <small>Rezerv planına bağlı</small>
        </button>
        <button onClick={() => onNavigate("daily")} type="button">
          <span>Bekleyen net POS</span>
          <strong>{formatMoney(daily.posPending)}</strong>
          <small>{formatMoney(daily.posFees)} komisyon</small>
        </button>
        <button onClick={() => onNavigate("inventory")} type="button">
          <span>Stok uyarısı</span>
          <strong>{stock.alertCount}</strong>
          <small>
            {stock.lowCount} kritik · {stock.expiringCount} SKT
          </small>
        </button>
      </section>

      <section className="content-grid">
        <article className="panel panel-wide">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Bugünün kontrolü</span>
              <h2>Öncelikli finansal olaylar</h2>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("calendar")}
              type="button"
            >
              Takvimi aç
            </button>
          </div>

          <div className="alert-list">
            {overdueRecords.map(({ record, status }) => (
              <button
                className="alert-row"
                key={record.id}
                onClick={() => onNavigate("ledger")}
                type="button"
              >
                <span className="alert-icon alert-danger">!</span>
                <span>
                  <strong>{record.counterparty}</strong>
                  <small>
                    {Math.abs(status.daysToDue)} gün gecikmiş ·{" "}
                    {formatMoney(status.remaining)} bakiye
                  </small>
                </span>
                <StatusPill code={status.code} />
              </button>
            ))}
            {upcoming.map(({ record, status }) => (
              <button
                className="alert-row"
                key={record.id}
                onClick={() =>
                  onNavigate(record.type === "payable" ? "debts" : "ledger")
                }
                type="button"
              >
                <span className="alert-icon alert-warning">
                  {status.daysToDue}
                </span>
                <span>
                  <strong>{record.counterparty}</strong>
                  <small>
                    {formatDate(record.dueDate)} ·{" "}
                    {formatMoney(status.remaining)}
                  </small>
                </span>
                <StatusPill code={status.code} />
              </button>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head compact">
            <div>
              <span className="eyebrow">Rasyonel karar</span>
              <h2>Yeni borç sinyali</h2>
            </div>
          </div>
          <div className="decision-block">
            <span className="decision-badge">{debtStatusLabel}</span>
            <h3>{decision.borrowing.label}</h3>
            <p>{debtDecision?.why}</p>
            <ul>
              <li>{debtDecision?.action}</li>
              <li>
                Baz DSCR:{" "}
                {decision.borrowing.baseDscr === null
                  ? "hesaplanamaz"
                  : decision.borrowing.baseDscr.toFixed(2)}
              </li>
              <li>
                Stres DSCR:{" "}
                {decision.borrowing.stressDscr === null
                  ? "hesaplanamaz"
                  : decision.borrowing.stressDscr.toFixed(2)}
              </li>
            </ul>
            <button
              className="text-button"
              onClick={() => onNavigate("decision")}
              type="button"
            >
              Karar Merkezi’ni aç
            </button>
          </div>
        </article>
      </section>
    </>
  );
}

function LedgerView({
  records,
  filter,
  setFilter,
  onOpenDetail,
  onAddPayment,
}: {
  records: LedgerRecord[];
  filter: string;
  setFilter: (filter: string) => void;
  onOpenDetail: (id: string) => void;
  onAddPayment: (id: string) => void;
}) {
  const [display, setDisplay] = useState<"summary" | "book">("book");
  const [startDate, setStartDate] = useState(`${TODAY.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(TODAY);
  const [includeHistorical, setIncludeHistorical] = useState(true);
  const [counterparty, setCounterparty] = useState("");
  const rows = records
    .map((record) => ({
      record,
      status: ledgerStatus({ ...record, today: TODAY }),
    }))
    .filter(({ record, status }) => {
      if (filter === "receivable") return record.type === "receivable";
      if (filter === "payable") return record.type === "payable";
      if (filter === "overdue") return status.code.startsWith("overdue");
      if (filter === "paid") return status.code === "paid";
      return true;
    });
  const bookType = filter === "receivable" || filter === "payable" ? filter : "all";
  const book = useMemo(
    () => buildCurrentAccountBook({
      records,
      startDate,
      endDate,
      type: bookType,
      counterparty,
      includeHistorical,
    }),
    [records, startDate, endDate, bookType, counterparty, includeHistorical],
  );
  const counterparties = [...new Set(records.map((record) => record.counterparty).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "tr"));
  const exportBook = () => {
    const content = currentAccountBookCsv(book);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = (counterparty || "tum-cariler").replaceAll(/[^a-z0-9ğüşıöç]+/gi, "-");
    anchor.href = url;
    anchor.download = `cari-hesap-dokumu-${safeName}-${startDate || "tum-gecmis"}-${endDate || TODAY}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="panel ledger-panel">
      <div className="filter-row">
        {[
          ["all", "Tümü"],
          ["receivable", "Alacaklar"],
          ["payable", "Borçlar"],
          ["overdue", "Gecikmiş"],
          ["paid", "Tamamlanan"],
        ].map(([value, label]) => (
          <button
            className={filter === value ? "active" : ""}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
        <span className="filter-divider" aria-hidden="true" />
        <button
          className={display === "book" ? "active" : ""}
          onClick={() => setDisplay("book")}
          type="button"
        >
          Cari defter
        </button>
        <button
          className={display === "summary" ? "active" : ""}
          onClick={() => setDisplay("summary")}
          type="button"
        >
          Özet liste
        </button>
      </div>

      {display === "book" ? (
        <>
          <div className="ledger-period-controls">
            <label>
              Başlangıç
              <input
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </label>
            <label>
              Bitiş
              <input
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </label>
            <label>
              Cari kişi / firma
              <select onChange={(event) => setCounterparty(event.target.value)} value={counterparty}>
                <option value="">Tüm cariler</option>
                {counterparties.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="ledger-history-toggle">
              <input
                checked={includeHistorical}
                onChange={(event) => setIncludeHistorical(event.target.checked)}
                type="checkbox"
              />
              Geçmiş aktarımı dahil et
            </label>
            <button className="ledger-export" onClick={exportBook} type="button">Hesap dökümünü indir</button>
          </div>

          <div className="ledger-book-totals" aria-label="Seçili dönem cari defter özeti">
            <span><small>Dönem başı devir</small><strong>{formatMoney(book.openingBalance)}</strong></span>
            <span><small>Bu dönem borç / alacak</small><strong>{formatMoney(book.increaseTotal)}</strong></span>
            <span><small>Bu dönem tahsilat / ödeme</small><strong>{formatMoney(book.decreaseTotal)}</strong></span>
            <span><small>Dönem sonu bakiye</small><strong>{formatMoney(book.closingBalance)}</strong></span>
          </div>

          <div className="table-wrap">
            <table className="ledger-table current-account-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari / tür</th>
                  <th>İşlem</th>
                  <th>Belge / açıklama</th>
                  <th className="numeric">Borç / alacak</th>
                  <th className="numeric">Tahsilat / ödeme</th>
                  <th className="numeric">Kalan bakiye</th>
                  <th aria-label="İşlemler" />
                </tr>
              </thead>
              <tbody>
                {book.rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{formatDate(row.date)}</strong></td>
                    <td>
                      <strong>{row.counterparty}</strong>
                      <small className="document-ref">{row.type === "receivable" ? "Alacak" : "Borç"}{row.historical ? " · Geçmiş aktarım" : ""}</small>
                    </td>
                    <td>{row.entry}</td>
                    <td>
                      <span className="detail-cell">{row.detail}</span>
                      {row.documentRef ? <small className="document-ref">{row.documentRef}</small> : null}
                    </td>
                    <td className="numeric">{row.increase ? formatMoney(row.increase) : "—"}</td>
                    <td className="numeric">{row.decrease ? formatMoney(row.decrease) : "—"}</td>
                    <td className="numeric balance">{formatMoney(row.balance)}</td>
                    <td><button onClick={() => onOpenDetail(row.recordId)} type="button">Detay</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {book.rows.length === 0 ? (
            <div className="empty-state">Seçili dönemde cari defter satırı bulunmuyor.</div>
          ) : null}
        </>
      ) : (
      <>
        <div className="table-wrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Tür / karşı taraf</th>
              <th>Detay</th>
              <th>Vade</th>
              <th className="numeric">Ana tutar</th>
              <th className="numeric">Ödenen</th>
              <th className="numeric">Kalan</th>
              <th>Durum</th>
              <th aria-label="İşlemler" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ record, status }) => (
              <tr key={record.id}>
                <td>
                  <div className="counterparty">
                    <span
                      className={`type-mark type-${record.type}`}
                      aria-hidden="true"
                    >
                      {record.type === "receivable" ? "A" : "B"}
                    </span>
                    <span>
                      <strong>{record.counterparty}</strong>
                      <small>
                        {record.type === "receivable" ? "Alacak" : "Borç"} ·{" "}
                        {record.phone}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  <span className="detail-cell">{record.detail}</span>
                  <small className="document-ref">{record.documentRef}</small>
                </td>
                <td>
                  <strong>{formatDate(record.dueDate)}</strong>
                  <small className="due-note">
                    {status.daysToDue < 0
                      ? `${Math.abs(status.daysToDue)} gün geçti`
                      : status.daysToDue === 0
                        ? "Bugün"
                        : `${status.daysToDue} gün kaldı`}
                  </small>
                </td>
                <td className="numeric">{formatMoney(status.originalAmount)}</td>
                <td className="numeric">{formatMoney(status.appliedPaid)}</td>
                <td className="numeric balance">
                  {formatMoney(status.remaining)}
                </td>
                <td>
                  <StatusPill code={status.code} />
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      onClick={() => onAddPayment(record.id)}
                      title={
                        record.type === "receivable"
                          ? "Tahsilat ekle"
                          : "Ödeme ekle"
                      }
                      type="button"
                    >
                      +
                    </button>
                    <button
                      onClick={() => onOpenDetail(record.id)}
                      type="button"
                    >
                      Detay
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">Bu filtrede kayıt bulunmuyor.</div>
        ) : null}
      </>
      )}
    </article>
  );
}

function CalendarView({
  records,
  transactions,
  inventory,
  recurringRules,
  recurringOccurrences,
}: {
  records: LedgerRecord[];
  transactions: ClinicTransaction[];
  inventory: InventoryItem[];
  recurringRules: RecurringExpenseRule[];
  recurringOccurrences: RecurringExpenseOccurrence[];
}) {
  const [monthCursor, setMonthCursor] = useState(
    new Date(`${TODAY.slice(0, 7)}-01T00:00:00Z`),
  );
  const events = useMemo(() => {
    const ledgerEvents = calendarEventsFromLedger(records, TODAY);
    const operationEvents = operationalCalendarEvents(
      transactions,
      inventory,
      TODAY,
    );
    const recurringEvents = recurringCalendarEvents(
      recurringRules,
      recurringOccurrences,
      TODAY,
    );
    return [...ledgerEvents, ...operationEvents, ...recurringEvents];
  }, [
    records,
    transactions,
    inventory,
    recurringRules,
    recurringOccurrences,
  ]);
  const year = monthCursor.getUTCFullYear();
  const month = monthCursor.getUTCMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const firstDay = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Array.from({ length: firstDay + dayCount }, (_, index) =>
    index < firstDay ? null : index - firstDay + 1,
  );

  while (cells.length % 7 !== 0) cells.push(null);

  function moveMonth(offset: number) {
    setMonthCursor(new Date(Date.UTC(year, month + offset, 1)));
  }

  function eventClass(event: (typeof events)[number]) {
    if (event.type === "recurring_payment") return "event-recurring-paid";
    if (event.type === "recurring_expense") {
      return event.status === "review"
        ? "event-recurring-review"
        : "event-recurring";
    }
    if (event.type === "receivable_collection") return "event-collected";
    if (event.type === "payable_payment") return "event-paid";
    if (event.type === "pos_settlement") return "event-pos";
    if (event.type === "stock_alert") return "event-stock-alert";
    if (event.type === "stock_expiry") return "event-stock-expiry";
    if (event.status === "paid") return "event-complete";
    if (event.status.startsWith("overdue")) return "event-overdue";
    if (event.status.includes("partial")) return "event-partial";
    return event.type === "receivable_due"
      ? "event-receivable"
      : "event-payable";
  }

  return (
    <article className="panel calendar-panel">
      <div className="calendar-toolbar">
        <button onClick={() => moveMonth(-1)} type="button" aria-label="Önceki ay">
          ‹
        </button>
        <h2>{monthFormatter.format(monthCursor)}</h2>
        <button onClick={() => moveMonth(1)} type="button" aria-label="Sonraki ay">
          ›
        </button>
      </div>

      <div className="calendar-legend">
        <span><i className="legend-receivable" />Alacak vadesi</span>
        <span><i className="legend-payable" />Borç vadesi</span>
        <span><i className="legend-pos" />POS yatışı</span>
        <span><i className="legend-recurring" />Sabit gider</span>
        <span><i className="legend-stock" />Stok / SKT</span>
        <span><i className="legend-partial" />Kısmi</span>
        <span><i className="legend-overdue" />Gecikmiş</span>
        <span><i className="legend-complete" />Tahsilat / ödeme</span>
      </div>

      <div className="calendar-grid">
        {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => (
          <div className="weekday" key={day}>{day}</div>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            return <div className="calendar-day muted" key={`blank-${index}`} />;
          }
          const date = `${monthKey}-${String(day).padStart(2, "0")}`;
          const dayEvents = events.filter((event) => event.date === date);
          const isToday = date === TODAY;
          return (
            <div
              className={`calendar-day ${isToday ? "today" : ""}`}
              key={date}
            >
              <span className="day-number">{day}</span>
              <div className="day-events">
                {dayEvents.map((event) => (
                  <div className={`calendar-event ${eventClass(event)}`} key={event.id}>
                    <strong>{event.title}</strong>
                    <span>{formatMoney(event.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function DebtsView({
  records,
  onNewDebt,
  onInvoice,
  onAddPayment,
}: {
  records: LedgerRecord[];
  onNewDebt: () => void;
  onInvoice: (id: string) => void;
  onAddPayment: (id: string) => void;
}) {
  const debts = records
    .filter((record) => record.type === "payable")
    .map((record) => {
      const status = ledgerStatus({ ...record, today: TODAY });
      const reserve = monthlyReserveRequirement({
        remainingAmount: status.remaining,
        existingReserve: record.reserve,
        dueDate: record.dueDate,
        today: TODAY,
      });
      return { record, status, reserve };
    });
  const invoiceLines = debts.flatMap(({ record }) => record.lineItems ?? []);
  const invoiceTotal = invoiceLines.reduce(
    (total, line) => total + line.lineTotal,
    0,
  );

  return (
    <>
      <section className="debt-quick-toolbar">
        <div>
          <strong>Önce borç notunu girin</strong>
          <span>
            Vade anında takvime düşer. Fatura geldiğinde aynı kaydı açıp
            kalemlerini tamamlarsınız; ikinci bir borç oluşmaz.
          </span>
        </div>
        <button className="primary-button" onClick={onNewDebt} type="button">
          <span>+</span> Yeni borç notu
        </button>
      </section>

      {invoiceLines.length ? (
        <section className="debt-invoice-summary">
          <div>
            <span>Faturaya işlenen ürün kalemi</span>
            <strong>{invoiceLines.length}</strong>
          </div>
          <div>
            <span>Kalem toplamı</span>
            <strong>{formatMoney(invoiceTotal)}</strong>
          </div>
          <p>
            Bu kalemler borç kaydıyla birlikte istatistik ve stok geçmişine
            aktarılır.
          </p>
        </section>
      ) : null}

      <div className="debt-grid">
        {debts.map(({ record, status, reserve }) => {
          const fundingRate =
            status.remaining > 0
              ? Math.min(100, (record.reserve / status.remaining) * 100)
              : 100;
          const lineCount = record.lineItems?.length ?? 0;
          return (
            <article className="panel debt-card" key={record.id}>
              <div className="debt-head">
                <div>
                  <span className="eyebrow">
                    {record.stage === "invoiced"
                      ? `Fatura · ${record.documentRef}`
                      : `Ticari not · ${record.documentRef}`}
                  </span>
                  <h2>{record.counterparty}</h2>
                </div>
                <StatusPill code={status.code} />
              </div>
              <p>{record.detail}</p>
              <div className="debt-metrics">
                <div>
                  <span>Kalan borç</span>
                  <strong>{formatMoney(status.remaining)}</strong>
                </div>
                <div>
                  <span>Vade</span>
                  <strong>{formatDate(record.dueDate)}</strong>
                </div>
                <div>
                  <span>Aylık ayrılması gereken</span>
                  <strong>{formatMoney(reserve.monthlyReserve)}</strong>
                </div>
                <div>
                  <span>Mevcut rezerv</span>
                  <strong>{formatMoney(record.reserve)}</strong>
                </div>
              </div>
              <div className="funding-row">
                <span>Fonlanma oranı</span>
                <strong>%{Math.round(fundingRate)}</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${fundingRate}%` }} />
              </div>
              <div className="reserve-note">
                {reserve.urgency === "funded"
                  ? "Bu borcun kalan bakiyesi mevcut rezervle karşılanıyor."
                  : `${reserve.monthsAvailable} aylık eşit rezerv planı; finansman açığı ${formatMoney(reserve.fundingGap)}.`}
              </div>
              <div className="debt-card-actions">
                <button
                  className="secondary-button"
                  onClick={() => onInvoice(record.id)}
                  type="button"
                >
                  {record.stage === "invoiced"
                    ? `Faturayı aç · ${lineCount} kalem`
                    : "Fatura geldi · aynı kaydı tamamla"}
                </button>
                {status.code !== "paid" ? (
                  <button
                    className="secondary-button"
                    onClick={() => onAddPayment(record.id)}
                    type="button"
                  >
                    Ödeme ekle
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {debts.length === 0 ? (
        <div className="empty-state">
          Henüz borç notu yok. İlk kaydı yukarıdaki düğmeden ekleyin.
        </div>
      ) : null}
    </>
  );
}

function ChecksView({ auditEvents }: { auditEvents: AuditEvent[] }) {
  const checks = [
    { title: "Finans ve operasyon matematiği", detail: "Çekirdek hesap, sınır ve olumsuz senaryolar", count: `${VERIFIED_TEST_REPORT.passed}/${VERIFIED_TEST_REPORT.total}` },
    { title: "Üretim güvenliği", detail: "Bu tarih paket kaynaklarının test edildiği tarihtir; her gün otomatik test yapıldığı anlamına gelmez.", count: formatDate(VERIFIED_TEST_REPORT.date) },
  ];
  return (
    <section className="checks-layout">
      <article className="panel audit-hero">
        <div className="audit-ring"><strong>{VERIFIED_TEST_REPORT.passed}</strong><span>/ {VERIFIED_TEST_REPORT.total}</span></div>
        <div>
          <span className="eyebrow">Son doğrulanan paket · {formatDate(VERIFIED_TEST_REPORT.date)}</span>
          <h2>{VERIFIED_TEST_REPORT.failed === 0 ? "Çekirdek testler geçti" : "Test hatası bulundu"}</h2>
          <p>Bu sonuç yalnızca belirtilen paket sürümüne aittir. Yeni kod değişikliğinde testler yeniden çalıştırılmalıdır.</p>
        </div>
      </article>
      <article className="panel check-list-panel">
        {checks.map((check) => <div className="check-row" key={check.title}><span className="check-symbol">✓</span><div><strong>{check.title}</strong><small>{check.detail}</small></div><b>{check.count}</b></div>)}
      </article>
      <article className="panel check-list-panel">
        <div className="panel-head"><div><span className="eyebrow">Değişiklik denetimi</span><h2>Son finans işlemleri</h2></div></div>
        {auditEvents.length ? auditEvents.slice(0, 10).map((event) => (
          <div className="check-row" key={event.id}>
            <span className="check-symbol">•</span>
            <div><strong>{event.action.replace(":attempted", " · başlatıldı").replace(":completed", " · tamamlandı")}</strong><small>{event.actorEmail} · {event.entityType}{event.entityId ? ` · ${event.entityId}` : ""}</small></div>
            <b>{new Date(event.createdAt).toLocaleString("tr-TR")}</b>
          </div>
        )) : <div className="empty-state">Henüz denetim kaydı yok.</div>}
      </article>
      <article className="panel logic-rules">
        <span className="eyebrow">Kullanım sınırı</span>
        <h2>Yönetim desteği, resmî muhasebe değil</h2>
        <ul>
          <li>Vergi, kredi, hedef ve yatırım sonuçları tahmindir.</li>
          <li>Beyanname ve resmî defter için mali müşavir kayıtları esas alınır.</li>
          <li>Eksik veya eski veriyle yeşil karar üretilmez.</li>
          <li>POS bekleyen tutar bankaya yatmadan kullanılabilir nakit sayılmaz.</li>
        </ul>
      </article>
    </section>
  );
}

function DetailDrawer({
  record,
  onClose,
  onAddPayment,
}: {
  record: LedgerRecord;
  onClose: () => void;
  onAddPayment: () => void;
}) {
  const status = ledgerStatus({ ...record, today: TODAY });
  const denominationCode = String(record.denominationCode || "TRY");
  const isIndexed = denominationCode !== "TRY";
  const originalUnits = openingQuantity(record);
  const remainingUnits = remainingDenomination(record);
  const paidUnits = Math.max(0, originalUnits - remainingUnits);

  return (
    <div className="overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        aria-label="Kayıt detayı"
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">{record.documentRef}</span>
            <h2>{record.counterparty}</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Kapat">
            ×
          </button>
        </div>

        <StatusPill code={status.code} />
        <p className="drawer-detail">{record.detail}</p>

        <div className="drawer-summary">
          <div>
            <span>{isIndexed ? `Ana miktar (${denominationCode})` : "Ana tutar"}</span>
            <strong>{isIndexed ? originalUnits.toLocaleString("tr-TR", { maximumFractionDigits: 8 }) : formatMoney(status.originalAmount)}</strong>
          </div>
          <div>
            <span>{isIndexed ? `Ödenen (${denominationCode})` : "Ödenen"}</span>
            <strong>{isIndexed ? paidUnits.toLocaleString("tr-TR", { maximumFractionDigits: 8 }) : formatMoney(status.appliedPaid)}</strong>
          </div>
          <div>
            <span>{isIndexed ? `Kalan (${denominationCode})` : "Kalan bakiye"}</span>
            <strong>{isIndexed ? remainingUnits.toLocaleString("tr-TR", { maximumFractionDigits: 8 }) : formatMoney(status.remaining)}</strong>
            {isIndexed ? <small>Açılış kuru: {formatMoney(record.denominationOpenUnitPrice || 0)} / {denominationCode}</small> : null}
          </div>
          <div>
            <span>Vade</span>
            <strong>{formatDate(record.dueDate)}</strong>
          </div>
        </div>

        <section className="drawer-section">
          <h3>İletişim</h3>
          <dl>
            <div><dt>Yetkili</dt><dd>{record.contactName}</dd></div>
            <div><dt>Telefon</dt><dd>{record.phone || "—"}</dd></div>
            <div><dt>E-posta</dt><dd>{record.email || "—"}</dd></div>
          </dl>
        </section>

        <section className="drawer-section">
          <h3>Ödeme hareketleri</h3>
          <div className="timeline">
            {record.payments.length ? (
              record.payments.map((payment, index) => (
                <div className="timeline-item" key={`${payment.date}-${index}`}>
                  <span />
                  <div>
                    <strong>{payment.denominationQuantity && isIndexed ? `${Number(payment.denominationQuantity).toLocaleString("tr-TR", { maximumFractionDigits: 8 })} ${denominationCode} · ${formatMoney(payment.amount)}` : formatMoney(payment.amount)}</strong>
                    <small>
                      {formatDate(payment.date)} · {payment.method || "Belirsiz"}{payment.denominationUnitPrice && isIndexed ? ` · birim ${formatMoney(payment.denominationUnitPrice)}` : ""}
                    </small>
                    {payment.note ? <p>{payment.note}</p> : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="no-payment">Henüz ödeme hareketi yok.</p>
            )}
          </div>
        </section>

        {record.lineItems?.length ? (
          <section className="drawer-section">
            <h3>Fatura kalemleri</h3>
            <div className="drawer-line-items">
              {record.lineItems.map((line) => (
                <div key={line.id}>
                  <span>
                    <strong>{line.itemName}</strong>
                    <small>
                      {line.quantity} {line.unit} ×{" "}
                      {formatMoney(line.unitPrice)}
                    </small>
                  </span>
                  <b>{formatMoney(line.lineTotal)}</b>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {status.code !== "paid" ? (
          <button className="primary-button full" onClick={onAddPayment} type="button">
            {record.type === "receivable" ? "Tahsilat ekle" : "Ödeme ekle"}
          </button>
        ) : null}
      </aside>
    </div>
  );
}

function RecordDialog({
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  form: RecordForm;
  setForm: (form: RecordForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMessage, setRateMessage] = useState("");
  const isIndexed = form.denominationCode !== "TRY";
  const descriptor = denominationDescriptor({
    denominationCode: form.denominationCode,
    denominationPurity: Number(form.denominationPurity || 1),
    denominationKarat: Number(form.denominationKarat || 0) || undefined,
    denominationMillesimal: Number(form.denominationMillesimal || 0) || undefined,
  });
  const isGoldGram = form.denominationCode === "XAU_GRAM";
  const isSilverGram = form.denominationCode === "XAG_GRAM";
  const indexedOpeningValue = isIndexed
    ? indexedAmountValue(
        {
          denominationCode: form.denominationCode,
          denominationPurity: Number(form.denominationPurity || 1),
          denominationKarat: Number(form.denominationKarat || 0) || undefined,
          denominationMillesimal: Number(form.denominationMillesimal || 0) || undefined,
        },
        Number(form.denominationQuantity || 0),
        Number(form.denominationOpenUnitPrice || 0),
      ) ?? 0
    : Number(form.amount || 0);

  async function loadMarketRate() {
    if (form.denominationCode === "TRY") return;
    setRateLoading(true);
    setRateMessage("");
    try {
      const response = await fetch("/api/market-rates", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; rates?: Record<string, number | null>; source?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Kur alınamadı.");
      const rate = payload.rates?.[form.denominationCode];
      if (!rate) {
        setRateMessage(descriptor.assetClass === "metal" ? "Bu kıymetli maden için kayıtlı birim fiyat yok. Güncel fiyatı girip kaydedebilirsin." : "Bu para birimi için kur bulunamadı.");
        return;
      }
      setForm({ ...form, denominationOpenUnitPrice: String(rate), denominationRateSource: payload.source || "TCMB" });
      setRateMessage(`Kur alındı: ${Number(rate).toLocaleString("tr-TR", { maximumFractionDigits: 6 })} TL`);
    } catch (error) {
      setRateMessage(error instanceof Error ? error.message : "Kur alınamadı.");
    } finally {
      setRateLoading(false);
    }
  }

  async function saveManualRate() {
    const value = Number(form.denominationOpenUnitPrice || 0);
    if (!isIndexed || !Number.isFinite(value) || value <= 0) {
      setRateMessage("Kaydedilecek geçerli birim TL değeri girin.");
      return;
    }
    setRateLoading(true);
    try {
      const response = await postFinanceJson("/api/market-rates", {
        assetCode: form.denominationCode,
        unitPrice: value,
        source: "manual_verified",
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Birim fiyat kaydedilemedi.");
      setForm({ ...form, denominationRateSource: "manual_verified" });
      setRateMessage("Güncel birim değer kaydedildi; yeni kayıtlarda tekrar kullanılabilir.");
    } catch (error) {
      setRateMessage(error instanceof Error ? error.message : "Birim fiyat kaydedilemedi.");
    } finally {
      setRateLoading(false);
    }
  }

  return (
    <div className="overlay modal-overlay" role="presentation" onMouseDown={onClose}>
      <form
        className="modal compact-record-modal"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Hızlı kayıt · otomatik takvim</span>
            <h2>
              {form.type === "payable" ? "Yeni borç notu" : "Yeni alacak kaydı"}
            </h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Kapat">×</button>
        </div>

        <div className="segmented-control">
          <button
            className={form.type === "receivable" ? "active" : ""}
            onClick={() => setForm({ ...form, type: "receivable" })}
            type="button"
          >
            Alacak
          </button>
          <button
            className={form.type === "payable" ? "active" : ""}
            onClick={() => setForm({ ...form, type: "payable" })}
            type="button"
          >
            Borç
          </button>
        </div>

        <div className="form-grid">
          <label className="span-2">
            {form.type === "payable" ? "Borçlanılan firma / kişi *" : "Hasta sahibi / borçlu cari *"}
            <input
              name="counterparty"
              required
              value={form.counterparty}
              onChange={(event) =>
                setForm({ ...form, counterparty: event.target.value })
              }
              placeholder={form.type === "payable" ? "Örn. Hasvet" : "Örn. Damla Hanım"}
            />
          </label>
          <label className="span-2">
            {form.type === "receivable" ? "Tedavi / hizmet açıklaması *" : "Kısa not *"}
            <textarea
              name="detail"
              required
              value={form.detail}
              onChange={(event) =>
                setForm({ ...form, detail: event.target.value })
              }
              placeholder={
                form.type === "payable"
                  ? "Örn. Ürün alımı; fatura daha sonra gelecek"
                  : "Örn. Narin tedavi planı"
              }
            />
          </label>
          <label>
            Oluşma tarihi *
            <input
              name="createdDate"
              required
              type="date"
              value={form.createdDate}
              onChange={(event) =>
                setForm({ ...form, createdDate: event.target.value })
              }
            />
          </label>
          <label>
            Vade tarihi *
            <input
              name="dueDate"
              required
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                setForm({ ...form, dueDate: event.target.value })
              }
            />
          </label>
          <label>
            Borç / alacak birimi
            <select
              name="denominationCode"
              value={form.denominationCode}
              onChange={(event) => {
                const code = event.target.value;
                setRateMessage("");
                const gold = code === "XAU_GRAM";
                const silver = code === "XAG_GRAM";
                setForm({
                  ...form,
                  denominationCode: code,
                  denominationQuantity: code === "TRY" ? "" : form.denominationQuantity,
                  denominationOpenUnitPrice: code === "TRY" ? "1" : "",
                  denominationRateSource: code === "TRY" ? "TRY" : "manual",
                  denominationKarat: gold ? "24" : form.denominationKarat,
                  denominationMillesimal: silver ? "999" : form.denominationMillesimal,
                  denominationPurity: gold || silver ? "1" : "1",
                });
              }}
            >
              {Object.entries(DENOMINATION_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <label>
            Hatırlatma
            <select name="reminderDays" value={form.reminderDays} onChange={(event) => setForm({ ...form, reminderDays: event.target.value })}>
              <option value="1">1 gün önce</option>
              <option value="3">3 gün önce</option>
              <option value="5">5 gün önce</option>
              <option value="7">7 gün önce</option>
              <option value="15">15 gün önce</option>
            </select>
          </label>

          {isIndexed ? (
            <div className="indexed-ledger-fields span-2">
              <label>
                Miktar ({descriptor.unit}) *
                <input name="denominationQuantity" required min="0.000001" step="0.000001" type="number" value={form.denominationQuantity} onChange={(event) => setForm({ ...form, denominationQuantity: event.target.value })} placeholder="0" />
              </label>
              {isGoldGram ? (
                <label>
                  Altın ayarı
                  <select value={form.denominationKarat} onChange={(event) => { const karat = Number(event.target.value); setForm({ ...form, denominationKarat: String(karat), denominationPurity: String(karat / 24), denominationMillesimal: "" }); }}>
                    {GOLD_KARATS.map((karat) => <option key={karat} value={karat}>{karat} ayar</option>)}
                  </select>
                </label>
              ) : null}
              {isSilverGram ? (
                <label>
                  Gümüş saflığı
                  <select value={form.denominationMillesimal} onChange={(event) => { const value = Number(event.target.value); setForm({ ...form, denominationMillesimal: String(value), denominationPurity: String(value / 1000), denominationKarat: "" }); }}>
                    {SILVER_FINENESS.map((value) => <option key={value} value={value}>{value} saflık</option>)}
                  </select>
                </label>
              ) : null}
              <label>
                1 {descriptor.unit} güncel TL değeri *
                <input name="denominationOpenUnitPrice" required min="0.000001" step="0.000001" type="number" value={form.denominationOpenUnitPrice} onChange={(event) => setForm({ ...form, denominationOpenUnitPrice: event.target.value, denominationRateSource: "manual" })} placeholder="Güncel birim değer" />
              </label>
              <label>
                Taksit / ödeme planı
                <input min="1" max="120" step="1" type="number" value={form.installmentCount} onChange={(event) => setForm({ ...form, installmentCount: event.target.value })} />
              </label>
              <div className="indexed-rate-actions">
                <button className="secondary-button" disabled={rateLoading} onClick={loadMarketRate} type="button">{rateLoading ? "Değer alınıyor…" : "Kayıtlı / güncel değeri getir"}</button>
                {descriptor.assetClass === "metal" ? <button className="secondary-button" disabled={rateLoading} onClick={saveManualRate} type="button">Bu fiyatı kaydet</button> : null}
                <strong>İlk TL karşılığı: {formatMoney(indexedOpeningValue)}</strong>
                <small>{descriptor.display}{descriptor.assetClass === "metal" && descriptor.purity < 1 ? ` · saf eşdeğer ${(Number(form.denominationQuantity || 0) * descriptor.purity).toLocaleString("tr-TR", { maximumFractionDigits: 6 })} g` : ""}</small>
                {rateMessage ? <small>{rateMessage}</small> : null}
              </div>
            </div>
          ) : (
            <>
              <label>
                Tutar (TL) *
                <input name="amount" required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0,00" />
              </label>
              <label>
                Taksit / ödeme planı
                <input min="1" max="120" step="1" type="number" value={form.installmentCount} onChange={(event) => setForm({ ...form, installmentCount: event.target.value })} />
              </label>
              {form.type === "receivable" ? (
                <>
                  <label className="span-2 checkbox-label">
                    <input
                      checked={form.recognizeRevenue}
                      name="recognizeRevenue"
                      onChange={(event) =>
                        setForm({ ...form, recognizeRevenue: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <span>
                      Bu tedavi / hizmet bedelidir; toplam tutarı hizmet geliri olarak kaydet.
                      <small>Kapalıysa yalnız cari alacak takibi yapılır; avans, ödünç veya geçmiş bakiye için kullanın.</small>
                    </span>
                  </label>
                  <label>
                    Şimdi alınan ilk ödeme
                    <input
                      name="initialPayment"
                      min="0"
                      step="0.01"
                      type="number"
                      value={form.initialPayment}
                      onChange={(event) =>
                        setForm({ ...form, initialPayment: event.target.value })
                      }
                      placeholder="Örn. 4000"
                    />
                  </label>
                  <label>
                    İlk ödeme kanalı
                    <select
                      name="initialPaymentMethod"
                      value={form.initialPaymentMethod}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          initialPaymentMethod: event.target.value as
                            | "cash"
                            | "card"
                            | "transfer",
                        })
                      }
                    >
                      <option value="cash">Nakit</option>
                      <option value="card">Kart / POS</option>
                      <option value="transfer">Havale / EFT</option>
                    </select>
                  </label>
                </>
              ) : null}
            </>
          )}
          <input name="amount" type="hidden" value={isIndexed ? String(indexedOpeningValue || "") : form.amount} />
          <input name="denominationRateSource" type="hidden" value={form.denominationRateSource} />
          <input name="denominationPurity" type="hidden" value={form.denominationPurity} />
          <input name="denominationKarat" type="hidden" value={form.denominationKarat} />
          <input name="denominationMillesimal" type="hidden" value={form.denominationMillesimal} />
          <input name="installmentCount" type="hidden" value={form.installmentCount} />
          <div className="record-denomination-note span-2">
            {isIndexed ? `Bu kayıt ${form.denominationCode} miktarı üzerinden takip edilir. TL karşılığı kur değiştikçe yeniden hesaplanabilir.` : "TL kayıtlarında bakiye doğrudan Türk lirası üzerinden izlenir."}
          </div>

          <details className="optional-form-details span-2">
            <summary>İletişim ve varsa belge bilgisi ekle</summary>
            <div className="form-grid">
              <label>
                İletişim kişisi
                <input
                  name="contactName"
                  value={form.contactName}
                  onChange={(event) =>
                    setForm({ ...form, contactName: event.target.value })
                  }
                  placeholder="Ad soyad"
                />
              </label>
              <label>
                Telefon
                <input
                  name="phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="05xx xxx xx xx"
                />
              </label>
              <label>
                E-posta
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="ornek@firma.com"
                />
              </label>
              <label>
                Belge / fatura referansı
                <input
                  name="documentRef"
                  value={form.documentRef}
                  onChange={(event) =>
                    setForm({ ...form, documentRef: event.target.value })
                  }
                  placeholder="Varsa"
                />
              </label>
            </div>
          </details>
        </div>

        <div className="modal-note">
          Kaydettiğiniz anda vade takvimde ve borç/alacak listesinde görünür.
          Tedavi/hizmet seçiliyse toplam bedel gelire, şimdi alınan tutar kasaya/POS&apos;a; kalan ise hasta sahibi alacağına işlenir.
          Fatura sonradan gelirse bu kaydı güncellersiniz; yeni borç açılmaz.
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className="primary-button" type="submit">
            Kaydet ve takvime yerleştir
          </button>
        </div>
      </form>
    </div>
  );
}

type InvoiceLineDraft = {
  id: string;
  inventoryItemId?: string;
  itemName: string;
  category: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  trackStock: boolean;
  stockMovementId?: string;
};

function InvoiceDialog({
  record,
  inventory,
  onClose,
  onSave,
}: {
  record: LedgerRecord;
  inventory: InventoryItem[];
  onClose: () => void;
  onSave: (record: LedgerRecord) => Promise<boolean>;
}) {
  const [documentRef, setDocumentRef] = useState(
    record.stage === "invoiced" ? record.documentRef : "",
  );
  const [documentDate, setDocumentDate] = useState(
    record.documentDate || TODAY,
  );
  const [dueDate, setDueDate] = useState(record.dueDate);
  const [detail, setDetail] = useState(record.detail);
  const [lines, setLines] = useState<InvoiceLineDraft[]>(() =>
    record.lineItems?.length
      ? record.lineItems.map((line) => ({
          id: line.id,
          inventoryItemId: line.inventoryItemId,
          itemName: line.itemName,
          category: line.category,
          quantity: String(line.quantity),
          unit: line.unit,
          unitPrice: String(line.unitPrice),
          trackStock: line.trackStock,
          stockMovementId: line.stockMovementId,
        }))
      : [
          {
            id: `invoice-line-${Date.now()}`,
            itemName: "",
            category: "İlaç ve sarf",
            quantity: "1",
            unit: "adet",
            unitPrice: "",
            trackStock: true,
          },
        ],
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const lineTotal = lines.reduce((total, line) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    return total +
      (Number.isFinite(quantity) && Number.isFinite(unitPrice)
        ? quantity * unitPrice
        : 0);
  }, 0);

  function updateLine(id: string, patch: Partial<InvoiceLineDraft>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function updateItemName(id: string, itemName: string) {
    const matching = inventory.find(
      (item) =>
        item.name.trim().toLocaleLowerCase("tr-TR") ===
        itemName.trim().toLocaleLowerCase("tr-TR"),
    );
    updateLine(id, {
      itemName,
      inventoryItemId: matching?.id,
      category: matching?.category || "İlaç ve sarf",
      unit: matching?.unit || "adet",
      unitPrice:
        matching && matching.unitCost > 0 ? String(matching.unitCost) : "",
    });
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        id: `invoice-line-${Date.now()}-${current.length}`,
        itemName: "",
        category: "İlaç ve sarf",
        quantity: "1",
        unit: "adet",
        unitPrice: "",
        trackStock: true,
      },
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!documentRef.trim() || !documentDate || !dueDate) {
      setError("Fatura numarası, fatura tarihi ve vade zorunludur.");
      return;
    }

    const validLines: LedgerLineItem[] = [];
    for (const line of lines) {
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      if (
        !line.itemName.trim() ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        setError(
          "Her ürün satırında ürün adı, sıfırdan büyük miktar ve geçerli birim fiyat olmalıdır.",
        );
        return;
      }
      validLines.push({
        id: line.id,
        recordId: record.id,
        inventoryItemId: line.inventoryItemId,
        itemName: line.itemName.trim(),
        category: line.category,
        quantity,
        unit: line.unit,
        unitPrice,
        lineTotal: Math.round(quantity * unitPrice * 100) / 100,
        trackStock: line.trackStock,
        stockMovementId: line.stockMovementId,
      });
    }

    const total = validLines.reduce((sum, line) => sum + line.lineTotal, 0);
    if (total <= 0) {
      setError("Fatura kalemleri toplamı sıfırdan büyük olmalıdır.");
      return;
    }
    const alreadyPaid = record.payments
      .filter((payment) => payment.status !== "cancelled")
      .reduce((sum, payment) => sum + payment.amount, 0);
    if (total < alreadyPaid) {
      setError(
        `Fatura toplamı daha önce işlenen ${formatMoney(alreadyPaid)} ödemeden düşük olamaz.`,
      );
      return;
    }

    setSaving(true);
    const saved = await onSave({
      ...record,
      detail: detail.trim() || record.detail,
      documentRef: documentRef.trim(),
      documentDate,
      stage: "invoiced",
      dueDate,
      originalAmount: Math.round(total * 100) / 100,
      lineItems: validLines,
    });
    setSaving(false);
    if (!saved) {
      setError("Fatura kaydı tamamlanamadı. Mevcut borç değiştirilmedi.");
    }
  }

  return (
    <div className="overlay modal-overlay" role="presentation" onMouseDown={onClose}>
      <form
        className="modal invoice-modal"
        data-testid="invoice-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Aynı borç kaydı güncelleniyor</span>
            <h2>{record.counterparty} · Fatura işle</h2>
          </div>
          <button aria-label="Kapat" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="same-record-note">
          Bu işlem yeni borç oluşturmaz. Ticaret sırasında açtığınız kayda fatura
          bilgileri ve ürün satırları eklenir.
        </div>

        <div className="invoice-head-fields">
          <label>
            Fatura no *
            <input
              onChange={(event) => setDocumentRef(event.target.value)}
              placeholder="Örn. DRB-2026-118"
              value={documentRef}
            />
          </label>
          <label>
            Fatura tarihi *
            <input
              onChange={(event) => setDocumentDate(event.target.value)}
              type="date"
              value={documentDate}
            />
          </label>
          <label>
            Ödeme tarihi / vade *
            <input
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </label>
          <label className="invoice-detail-field">
            Kısa açıklama
            <input
              onChange={(event) => setDetail(event.target.value)}
              value={detail}
            />
          </label>
        </div>

        <datalist id="invoice-inventory-items">
          {inventory.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>

        <div className="invoice-lines">
          <div className="invoice-line-head">
            <span>Ürün / kalem</span>
            <span>Kategori</span>
            <span>Miktar</span>
            <span>Birim</span>
            <span>Birim fiyat</span>
            <span>Toplam</span>
            <span>Stok</span>
            <span />
          </div>
          {lines.map((line) => {
            const posted = Boolean(line.stockMovementId);
            const quantity = Number(line.quantity);
            const unitPrice = Number(line.unitPrice);
            const total =
              Number.isFinite(quantity) && Number.isFinite(unitPrice)
                ? quantity * unitPrice
                : 0;
            return (
              <div className="invoice-line" key={line.id}>
                <input
                  disabled={posted}
                  list="invoice-inventory-items"
                  onChange={(event) =>
                    updateItemName(line.id, event.target.value)
                  }
                  placeholder="Ürün adı"
                  value={line.itemName}
                />
                <select
                  disabled={posted}
                  onChange={(event) =>
                    updateLine(line.id, { category: event.target.value })
                  }
                  value={line.category}
                >
                  <option>İlaç ve sarf</option>
                  <option>Mama</option>
                  <option>Temizlik</option>
                  <option>Medikal malzeme</option>
                  <option>Kırtasiye</option>
                  <option>Hizmet</option>
                  <option>Diğer</option>
                </select>
                <input
                  disabled={posted}
                  min="0.01"
                  onChange={(event) =>
                    updateLine(line.id, { quantity: event.target.value })
                  }
                  step="0.01"
                  type="number"
                  value={line.quantity}
                />
                <select
                  disabled={posted}
                  onChange={(event) =>
                    updateLine(line.id, { unit: event.target.value })
                  }
                  value={line.unit}
                >
                  <option>adet</option>
                  <option>kutu</option>
                  <option>paket</option>
                  <option>şişe</option>
                  <option>doz</option>
                  <option>kg</option>
                  <option>litre</option>
                  <option>hizmet</option>
                </select>
                <input
                  disabled={posted}
                  min="0"
                  onChange={(event) =>
                    updateLine(line.id, { unitPrice: event.target.value })
                  }
                  placeholder="0,00"
                  step="0.01"
                  type="number"
                  value={line.unitPrice}
                />
                <strong>{formatMoney(total)}</strong>
                <label className="invoice-stock-check">
                  <input
                    checked={line.trackStock}
                    disabled={posted}
                    onChange={(event) =>
                      updateLine(line.id, {
                        trackStock: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  {posted ? "İşlendi" : "Ekle"}
                </label>
                {posted ? (
                  <span className="posted-line">✓</span>
                ) : (
                  <button
                    aria-label="Satırı kaldır"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((item) => item.id !== line.id),
                      )
                    }
                    type="button"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="invoice-total-row">
          <button className="secondary-button" onClick={addLine} type="button">
            + Ürün satırı ekle
          </button>
          <div>
            <span>Fatura toplamı</span>
            <strong>{formatMoney(lineTotal)}</strong>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Kaydediliyor…" : "Aynı borca faturayı işle"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PaymentDialog({
  form,
  record,
  setForm,
  onClose,
  onSubmit,
  error,
  saving,
}: {
  form: PaymentForm;
  record: LedgerRecord;
  setForm: (form: PaymentForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  error: string;
  saving: boolean;
}) {
  const status = ledgerStatus({ ...record, today: TODAY });
  const denominationCode = String(record.denominationCode || "TRY");
  const isIndexed = denominationCode !== "TRY";
  const remainingUnits = remainingDenomination(record);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMessage, setRateMessage] = useState("");
  const descriptor = denominationDescriptor(record);
  const paymentTlValue = isIndexed
    ? indexedAmountValue(record, Number(form.denominationQuantity || 0), Number(form.denominationUnitPrice || 0)) ?? 0
    : Number(form.amount || 0);
  const currentValuation = indexedLedgerValue(record, Number(form.denominationUnitPrice || record.denominationOpenUnitPrice || 0));

  async function loadPaymentRate() {
    if (!isIndexed) return;
    setRateLoading(true);
    setRateMessage("");
    try {
      const response = await fetch("/api/market-rates", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; rates?: Record<string, number | null>; source?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Kur alınamadı.");
      const rate = payload.rates?.[denominationCode];
      if (!rate) throw new Error("Kur bulunamadı.");
      setForm({ ...form, denominationUnitPrice: String(rate) });
      setRateMessage(`TCMB: ${Number(rate).toLocaleString("tr-TR", { maximumFractionDigits: 6 })} TL`);
    } catch (error) {
      setRateMessage(error instanceof Error ? error.message : "Kur alınamadı.");
    } finally {
      setRateLoading(false);
    }
  }

  return (
    <div className="overlay modal-overlay" role="presentation" onMouseDown={onClose}>
      <form
        className="modal payment-modal"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">
              {record.type === "receivable" ? "Tahsilat" : "Ödeme"} hareketi
            </span>
            <h2>{record.counterparty}</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Kapat">×</button>
        </div>

        <div className="payment-balance">
          <span>İşlem öncesi kalan bakiye</span>
          <strong>{isIndexed ? `${remainingUnits.toLocaleString("tr-TR", { maximumFractionDigits: 6 })} ${denominationCode}` : formatMoney(status.remaining)}</strong>
          {isIndexed ? <small>{currentValuation.currentValue !== null ? `Girilen güncel birim değerle yaklaşık ${formatMoney(currentValuation.currentValue)}` : `Açılış TL karşılığı ${formatMoney(record.originalAmount)}`}</small> : null}
        </div>

        <div className="form-grid">
          <label>
            İşlem tarihi *
            <input
              name="paymentDate"
              required
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </label>
          {isIndexed ? (
            <>
              <label>
                Ödenen miktar ({descriptor.display}) *
                <input name="paymentDenominationQuantity" required min="0.000001" max={remainingUnits} step="0.000001" type="number" value={form.denominationQuantity} onChange={(event) => setForm({ ...form, denominationQuantity: event.target.value })} placeholder="0" />
              </label>
              <label>
                1 {descriptor.unit} = kaç TL? *
                <input name="paymentDenominationUnitPrice" required min="0.000001" step="0.000001" type="number" value={form.denominationUnitPrice} onChange={(event) => setForm({ ...form, denominationUnitPrice: event.target.value })} placeholder="Güncel birim değer" />
              </label>
              <div className="indexed-payment-helper span-2">
                <button className="secondary-button" disabled={rateLoading} onClick={loadPaymentRate} type="button">{rateLoading ? "Değer alınıyor…" : "Kayıtlı / güncel değeri getir"}</button>
                {descriptor.assetClass === "metal" ? <span>{descriptor.purityLabel || "Saf"} · miktar kendi biriminde korunur.</span> : null}
                <strong>Bu ödeme: {formatMoney(paymentTlValue)}</strong>
                {rateMessage ? <small>{rateMessage}</small> : null}
              </div>
              <input name="paymentAmount" type="hidden" value={String(paymentTlValue || "")} />
            </>
          ) : (
            <label>
              Tutar (TL) *
              <input name="paymentAmount" required min="0.01" max={status.remaining} step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0,00" />
            </label>
          )}
          <label className="span-2">
            Yöntem
            <select
              name="paymentMethod"
              value={form.method}
              onChange={(event) =>
                setForm({ ...form, method: event.target.value })
              }
            >
              <option>Havale</option>
              <option>Nakit</option>
              {record.type === "receivable" ? (
                <option>Kart / POS</option>
              ) : null}
            </select>
          </label>
          <label className="span-2">
            Not
            <textarea
              name="paymentNote"
              value={form.note}
              onChange={(event) =>
                setForm({ ...form, note: event.target.value })
              }
              placeholder="Dekont, açıklama veya mutabakat notu"
            />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Vazgeç
          </button>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Kaydediliyor…" : "Hareketi kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PosSettlementCenter({
  transactions,
  today,
  onSettle,
}: {
  transactions: ClinicTransaction[];
  today: string;
  onSettle: (input: {
    transactionId: string;
    settlementDate: string;
    actualNetAmount: number;
    settlementReference: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const pending = transactions
    .filter(
      (transaction) =>
        transaction.status !== "cancelled" &&
        transaction.kind === "income" &&
        transaction.paymentMethod === "card" &&
        transaction.posStatus !== "settled",
    )
    .sort((a, b) =>
      String(a.settlementDate || a.date).localeCompare(
        String(b.settlementDate || b.date),
      ),
    );
  const [selectedId, setSelectedId] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = pending.find((item) => item.id === selectedId);
  const pendingNet = pending.reduce(
    (sum, transaction) => sum + expectedPosNet(transaction),
    0,
  );

  function open(transaction: ClinicTransaction) {
    setSelectedId(transaction.id);
    setDate(
      transaction.settlementDate && transaction.settlementDate <= today
        ? transaction.settlementDate
        : today,
    );
    setAmount(expectedPosNet(transaction).toFixed(2));
    setReference("");
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const actualNetAmount = Number(amount);
    if (
      !date ||
      !reference.trim() ||
      !Number.isFinite(actualNetAmount) ||
      actualNetAmount <= 0
    ) {
      setError("Gerçek yatış, tarih ve banka/POS referansı zorunludur.");
      return;
    }
    setSaving(true);
    const result = await onSettle({
      transactionId: selected.id,
      settlementDate: date,
      actualNetAmount,
      settlementReference: reference.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "POS yatışı kaydedilemedi.");
      return;
    }
    setSelectedId("");
    setError("");
  }

  return (
    <section className="panel pos-settlement-center">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Gerçek banka hareketi</span>
          <h2>POS mutabakat merkezi</h2>
          <p>
            Beklenen tarih tahmindir. Banka hesabına gerçekten yatınca net tutarı
            ve referansı girin; banka bakiyesi ancak o zaman artar.
          </p>
        </div>
        <div className="pos-settlement-total">
          <span>{pending.length} bekleyen</span>
          <strong>{formatMoney(pendingNet)}</strong>
        </div>
      </div>

      {pending.length ? (
        <div className="pos-settlement-list">
          {pending.map((transaction) => (
            <div
              className={
                transaction.settlementDate &&
                transaction.settlementDate < today
                  ? "pos-settlement-row overdue"
                  : "pos-settlement-row"
              }
              key={transaction.id}
            >
              <div>
                <strong>
                  {transaction.counterparty || transaction.description}
                </strong>
                <small>
                  {formatDate(transaction.date)} · beklenen{" "}
                  {transaction.settlementDate
                    ? formatDate(transaction.settlementDate)
                    : "tarih yok"}
                </small>
              </div>
              <div>
                <span>Brüt</span>
                <b>{formatMoney(transaction.amount)}</b>
              </div>
              <div>
                <span>Beklenen net</span>
                <b>{formatMoney(expectedPosNet(transaction))}</b>
              </div>
              <button
                className="primary-button"
                onClick={() => open(transaction)}
                type="button"
              >
                Hesaba yattı
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          Bekleyen POS yok; tüm kart hareketleri banka ile mutabık.
        </div>
      )}

      {selected ? (
        <form className="pos-settlement-form" onSubmit={submit}>
          <div>
            <strong>{selected.counterparty || selected.description}</strong>
            <small>
              Beklenen net {formatMoney(expectedPosNet(selected))}. Ekstredeki
              gerçek rakam farklıysa gerçek tutarı yazın; fark denetim kaydında
              korunur.
            </small>
          </div>
          <label>
            Gerçek yatış tarihi
            <input
              max={today}
              min={selected.date}
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
              required
            />
          </label>
          <label>
            Gerçek net yatış
            <input
              max={selected.amount}
              min="0.01"
              onChange={(event) => setAmount(event.target.value)}
              step="0.01"
              type="number"
              value={amount}
              required
            />
          </label>
          <label>
            Banka / POS referansı
            <input
              onChange={(event) => setReference(event.target.value)}
              placeholder="Ekstre işlem no"
              value={reference}
              required
            />
          </label>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => setSelectedId("")}
              type="button"
            >
              Vazgeç
            </button>
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? "Mutabakat yapılıyor…" : "Yatışı doğrula"}
            </button>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}

export default function DashboardClient({ currentUser }: { currentUser: { email: string; role: "editor" | "viewer" } }) {
  const [activeView, setActiveView] = useState<View>("today");
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [transactions, setTransactions] =
    useState<ClinicTransaction[]>([]);
  const [inventory, setInventory] =
    useState<InventoryItem[]>([]);
  const [productDefinitions, setProductDefinitions] = useState<ProductDefinition[]>([]);
  const [stockMovements, setStockMovements] =
    useState<StockMovement[]>([]);
  const [recurringRules, setRecurringRules] = useState<
    RecurringExpenseRule[]
  >([]);
  const [recurringOccurrences, setRecurringOccurrences] = useState<
    RecurringExpenseOccurrence[]
  >([]);
  const [monthlyClosings, setMonthlyClosings] = useState<MonthlyClosing[]>([]);
  const [monthlyCloseEvents, setMonthlyCloseEvents] = useState<
    MonthlyCloseEvent[]
  >([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [goalMilestones, setGoalMilestones] = useState<GoalMilestone[]>([]);
  const [valuationRates, setValuationRates] = useState<Array<{ id: string; assetCode: string; unitPrice: number; source: string; effectiveAt: string }>>([]);
  const [installmentSchedules, setInstallmentSchedules] = useState<Array<{ id: string; ledgerRecordId: string; installmentNo: number; dueDate: string; amount: number; denominationQuantity?: number; status: string; paymentId?: string }>>([]);
  const [marketRates, setMarketRates] = useState<Record<string, number | null>>({ TRY: 1 });
  const [posCommissionRate, setPosCommissionRate] = useState(0.0239);
  const [decisionSettings, setDecisionSettings] =
    useState<DecisionSettings>(
      normalizeDecisionSettings(
        DEFAULT_DECISION_SETTINGS,
      ) as DecisionSettings,
    );
  const [targetPosRate] = useState(0.02);
  const [dataMode, setDataMode] = useState<DataMode>("checking");
  const [storageError, setStorageError] = useState("");
  const [filter, setFilter] = useState("all");
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [transactionModalDate, setTransactionModalDate] = useState<
    string | null
  >(null);
  const [stockMovementItemId, setStockMovementItemId] = useState<
    string | null
  >(null);
  const [stockMovementModalOpen, setStockMovementModalOpen] = useState(false);
  const [inventoryItemModalOpen, setInventoryItemModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [paymentRecordId, setPaymentRecordId] = useState<string | null>(null);
  const [invoiceRecordId, setInvoiceRecordId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [recordForm, setRecordForm] = useState<RecordForm>({
    type: "receivable",
    counterparty: "",
    contactName: "",
    phone: "",
    email: "",
    detail: "",
    documentRef: "",
    createdDate: TODAY,
    dueDate: "",
    amount: "",
    denominationCode: "TRY",
    denominationQuantity: "",
    denominationOpenUnitPrice: "1",
    denominationRateSource: "manual",
    denominationPurity: "1",
    denominationKarat: "24",
    denominationMillesimal: "999",
    installmentCount: "1",
    reminderDays: "3",
    initialPayment: "",
    initialPaymentMethod: "cash",
    recognizeRevenue: true,
  });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    recordId: "",
    date: TODAY,
    amount: "",
    denominationQuantity: "",
    denominationUnitPrice: "",
    method: "Havale",
    note: "",
  });

  const summary = useMemo(() => ledgerSummary(records, TODAY), [records]);
  const integrity = useMemo(
    () => assessFinanceIntegrity({ transactions, inventory, records }),
    [transactions, inventory, records],
  );
  const selectedRecord = records.find(
    (record) => record.id === selectedRecordId,
  );
  const paymentRecord = records.find(
    (record) => record.id === paymentRecordId,
  );
  const invoiceRecord = records.find(
    (record) => record.id === invoiceRecordId,
  );
  const operationEvents = useMemo(
    () => operationalCalendarEvents(transactions, inventory, TODAY),
    [transactions, inventory],
  );
  const decisionEngine = useMemo(
    () =>
      buildDecisionEngine({
        transactions,
        records,
        inventory,
        recurringRules,
        recurringOccurrences,
        settings: decisionSettings,
        today: TODAY,
      }),
    [
      transactions,
      records,
      inventory,
      recurringRules,
      recurringOccurrences,
      decisionSettings,
    ],
  );
  const title = viewTitles[activeView];

  useEffect(() => {
    let cancelled = false;

    async function loadClinicData() {
      try {
        const response = await fetch("/api/clinic-data", {
          cache: "no-store",
        });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "Veri bağlantısı kurulamadı.");
        }
        const data = (await response.json()) as ClinicDataResponse;
        if (cancelled) return;
        setAuditEvents(data.auditEvents ?? []);

        if (data.hasData) {
          setTransactions(data.transactions);
          setInventory(data.inventory);
          setProductDefinitions(data.productDefinitions ?? []);
          setStockMovements(data.stockMovements);
          setRecords(data.records);
          setRecurringRules(data.recurringRules ?? []);
          setRecurringOccurrences(data.recurringOccurrences ?? []);
          setMonthlyClosings(data.monthlyClosings ?? []);
          setMonthlyCloseEvents(data.monthlyCloseEvents ?? []);
          setImportBatches(data.importBatches ?? []);
          setGoals(data.goals ?? []);
          setGoalMilestones(data.goalMilestones ?? []);
          setValuationRates(data.valuationRates ?? []);
          setInstallmentSchedules(data.installmentSchedules ?? []);
          const savedRate = Number(data.settings.posCommissionRate);
          if (Number.isFinite(savedRate) && savedRate >= 0 && savedRate < 1) {
            setPosCommissionRate(savedRate);
          }
          try {
            const savedDecisionConfig = JSON.parse(
              data.settings.decisionEngineConfig || "{}",
            ) as Partial<DecisionSettings>;
            setDecisionSettings(
              normalizeDecisionSettings(
                savedDecisionConfig,
              ) as DecisionSettings,
            );
          } catch {
            setDecisionSettings(
              normalizeDecisionSettings({}) as DecisionSettings,
            );
          }
          setDataMode("persistent");
        } else {
          setTransactions([]);
          setInventory([]);
          setProductDefinitions([]);
          setStockMovements([]);
          setRecords([]);
          setRecurringRules([]);
          setRecurringOccurrences([]);
          setMonthlyClosings([]);
          setMonthlyCloseEvents([]);
          setImportBatches([]);
          setGoals([]);
          setGoalMilestones([]);
          setValuationRates([]);
          setInstallmentSchedules([]);
          setDataMode("empty");
        }
      } catch (error) {
        if (cancelled) return;
        setStorageError(
          error instanceof Error ? error.message : "Veri bağlantısı kurulamadı.",
        );
        setDataMode("offline");
      }
    }

    void loadClinicData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMarketRates() {
      try {
        const response = await fetch("/api/market-rates", { cache: "no-store" });
        const payload = await response.json() as { ok?: boolean; rates?: Record<string, number | null> };
        if (!cancelled && response.ok && payload.ok && payload.rates) setMarketRates(payload.rates);
      } catch {
        // Finans masası kayıtlı/açılış değerleriyle çalışmaya devam eder.
      }
    }
    void loadMarketRates();
    const rateTimer = window.setInterval(loadMarketRates, 5 * 60 * 1000);
    const dayTimer = window.setInterval(() => {
      if (todayInIstanbul() !== TODAY) window.location.reload();
    }, 60 * 1000);
    return () => { cancelled = true; window.clearInterval(rateTimer); window.clearInterval(dayTimer); };
  }, []);

  const canWrite = currentUser.role === "editor";
  function writeDenied() {
    setStorageError("Bu hesap yalnızca görüntüleme yetkisine sahip.");
    return false;
  }

  async function persistData(payload: object) {
    if (!canWrite) return writeDenied();
    try {
      const response = await postFinanceJson("/api/clinic-data", payload);
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "Kayıt veritabanına yazılamadı.");
      }
      setStorageError("");
      setDataMode("persistent");
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Kayıt veritabanına yazılamadı.",
      );
      setDataMode("offline");
      return false;
    }
  }

  async function rollbackHistoricalImport(batchId: string, reason: string) {
    const saved = await persistData({ action: "rollbackHistoricalImport", batchId, reason });
    if (!saved) return false;
    setImportBatches((current) => current.map((batch) => (
      batch.id === batchId
        ? { ...batch, status: "rolled_back", rolledBackAt: new Date().toISOString(), rollbackReason: reason }
        : batch
    )));
    window.setTimeout(() => window.location.reload(), 450);
    return true;
  }

  async function saveMonthlyClosing(input: MonthlyCloseInput) {
    if (!canWrite) return writeDenied();
    try {
      const response = await postFinanceJson("/api/clinic-data", {
          action: "saveMonthlyClosing",
          closing: input,
      });
      const result = (await response.json()) as {
        closing?: MonthlyClosing;
        error?: string;
      };
      if (!response.ok || !result.closing) {
        throw new Error(result.error || "Ay sonu kapanışı kaydedilemedi.");
      }

      const closing = result.closing;
      setMonthlyClosings((current) => {
        const exists = current.some((item) => item.period === closing.period);
        return exists
          ? current.map((item) =>
              item.period === closing.period ? closing : item,
            )
          : [closing, ...current];
      });
      setMonthlyCloseEvents((current) => [
        {
          id: `local-close-${crypto.randomUUID()}`,
          period: closing.period,
          action: "closed",
          snapshot: closing,
          reason: closing.varianceNote,
          createdAt: closing.closedAt || new Date().toISOString(),
        },
        ...current,
      ]);
      setStorageError("");
      setDataMode("persistent");
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Ay sonu kapanışı kaydedilemedi.",
      );
      return false;
    }
  }

  async function reopenMonthlyClosing(period: string, reason: string) {
    if (!canWrite) return writeDenied();
    try {
      const response = await postFinanceJson("/api/clinic-data", {
          action: "reopenMonthlyClosing",
          period,
          reason,
      });
      const result = (await response.json()) as {
        closing?: MonthlyClosing;
        error?: string;
      };
      if (!response.ok || !result.closing) {
        throw new Error(result.error || "Dönem yeniden açılamadı.");
      }

      const closing = result.closing;
      setMonthlyClosings((current) =>
        current.map((item) =>
          item.period === closing.period ? closing : item,
        ),
      );
      setMonthlyCloseEvents((current) => [
        {
          id: `local-reopen-${crypto.randomUUID()}`,
          period,
          action: "reopened",
          snapshot: closing,
          reason,
          createdAt: closing.reopenedAt || new Date().toISOString(),
        },
        ...current,
      ]);
      setStorageError("");
      setDataMode("persistent");
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Dönem yeniden açılamadı.",
      );
      return false;
    }
  }

  function updatePosCommissionRate(rate: number) {
    setPosCommissionRate(rate);
    void persistData({
      action: "saveSetting",
      key: "posCommissionRate",
      value: String(rate),
    });
  }

  async function saveDecisionSettings(next: DecisionSettings) {
    const normalized = normalizeDecisionSettings(next) as DecisionSettings;
    const saved = await persistData({
      action: "saveSetting",
      key: "decisionEngineConfig",
      value: JSON.stringify(normalized),
    });
    if (!saved) return false;
    setDecisionSettings(normalized);
    return true;
  }

  function openTransaction(date = TODAY) {
    setTransactionModalDate(date);
  }

  async function saveTransaction(transaction: ClinicTransaction) {
    const posExpense = createPosCommissionExpense(
      transaction,
    ) as ClinicTransaction | null;
    const saved = await persistData({
      action: "saveTransactions",
      records: posExpense ? [transaction, posExpense] : [transaction],
    });
    if (!saved) return false;
    setTransactions((current) =>
      posExpense
        ? [transaction, posExpense, ...current]
        : [transaction, ...current],
    );
    setTransactionModalDate(null);
    setActiveView("today");
    return true;
  }

  async function updateTransaction(transaction: ClinicTransaction) {
    const saved = await persistData({
      action: "saveTransactions",
      records: [transaction],
    });
    if (!saved) return false;
    setTransactions((current) =>
      current.map((item) => (item.id === transaction.id ? transaction : item)),
    );
    return true;
  }

  async function settlePosTransaction(input: {
    transactionId: string;
    settlementDate: string;
    actualNetAmount: number;
    settlementReference: string;
  }) {
    if (!canWrite) return { ok: false, error: "Bu hesap yalnızca görüntüleme yetkisine sahip." };
    try {
      const response = await postFinanceJson("/api/clinic-data", {
          action: "settlePosTransaction",
          ...input,
      });
      const result = (await response.json()) as {
        error?: string;
        transaction?: ClinicTransaction;
        relatedTransactions?: ClinicTransaction[];
      };
      if (!response.ok || !result.transaction) {
        throw new Error(result.error || "POS yatışı doğrulanamadı.");
      }
      setTransactions((current) => {
        const next = new Map(current.map((item) => [item.id, item] as const));
        next.set(
          result.transaction?.id as string,
          result.transaction as ClinicTransaction,
        );
        for (const related of result.relatedTransactions ?? []) {
          next.set(related.id, related);
        }
        return Array.from(next.values());
      });
      setStorageError("");
      setDataMode("persistent");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "POS yatışı doğrulanamadı.",
      };
    }
  }

  async function reverseTransaction(
    transaction: ClinicTransaction,
    reason: string,
  ) {
    if (!canWrite) return writeDenied();
    try {
      const response = await postFinanceJson("/api/clinic-data", {
          action: "reverseTransaction",
          transactionId: transaction.id,
          reason,
          reversalDate: TODAY,
      });
      const result = (await response.json()) as {
        cancelledIds?: string[];
        reversal?: ClinicTransaction;
        stockUndo?: {
          itemId: string;
          quantity: number;
          unitCost: number;
          adjustmentMovement: StockMovement;
        } | null;
        error?: string;
      };
      if (!response.ok || !result.reversal) {
        throw new Error(result.error || "Ters kayıt tamamlanamadı.");
      }
      const cancelled = new Set(result.cancelledIds);
      setTransactions((current) =>
        [result.reversal!, ...current.map((item) =>
          cancelled.has(item.id) ? { ...item, status: "cancelled" } : item,
        )],
      );
      if (result.stockUndo) {
        setInventory((current) =>
          current.map((item) =>
            item.id === result.stockUndo!.itemId
              ? {
                  ...item,
                  quantity: result.stockUndo!.quantity,
                  unitCost: result.stockUndo!.unitCost,
                }
              : item,
          ),
        );
        setStockMovements((current) =>
          [result.stockUndo!.adjustmentMovement, ...current],
        );
      }
      setStorageError("");
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Ters kayıt tamamlanamadı.",
      );
      return false;
    }
  }

  async function saveQuickPurchase(payload: QuickPurchasePayload) {
    const saved = await persistData({
      action: "saveQuickPurchase",
      ...payload,
    });
    if (!saved) return false;

    setTransactions((current) => [payload.transaction, ...current]);
    setInventory((current) => {
      const exists = current.some((item) => item.id === payload.item.id);
      return exists
        ? current.map((item) =>
            item.id === payload.item.id ? payload.item : item,
          )
        : [...current, payload.item];
    });
    setStockMovements((current) => [payload.movement, ...current]);
    setActiveView("daily");
    return true;
  }


  async function saveQuickReceipt(payload: QuickReceiptPayload) {
    const saved = await persistData({
      action: "saveQuickReceipt",
      ...payload,
    });
    if (!saved) return false;

    const newTransactions = payload.lines.map((line) => line.transaction);
    const newMovements = payload.lines
      .map((line) => line.movement)
      .filter((movement): movement is StockMovement => Boolean(movement));
    const changedItems = new Map<string, InventoryItem>();
    for (const line of payload.lines) {
      if (line.item) changedItems.set(line.item.id, line.item);
    }

    setTransactions((current) => [...newTransactions, ...current]);
    setStockMovements((current) => [...newMovements, ...current]);
    setInventory((current) => {
      const next = new Map(current.map((item) => [item.id, item] as const));
      for (const [id, item] of changedItems) next.set(id, item);
      return Array.from(next.values());
    });
    setActiveView("daily");
    return true;
  }

  async function saveCatalogItem(item: InventoryItem) {
    const saved = await persistData({ action: "saveInventoryItem", item });
    if (!saved) return false;
    setInventory((current) => [...current, item]);
    return true;
  }

  async function saveRecurringRule(rule: RecurringExpenseRule) {
    const saved = await persistData({
      action: "saveRecurringRule",
      rule,
    });
    if (!saved) return false;
    setRecurringRules((current) => {
      const exists = current.some((item) => item.id === rule.id);
      return exists
        ? current.map((item) => (item.id === rule.id ? rule : item))
        : [...current, rule];
    });
    return true;
  }

  async function createRecurringRuleDirect(input: {
    name: string;
    category: string;
    counterparty: string;
    amount: number;
    startDate: string;
    paymentMethod: "cash" | "card" | "transfer" | "accrual";
    recurrence: {
      kind: "weekly" | "monthly" | "yearly" | "once";
      interval: number;
      dayOfWeek?: number | null;
      dayOfMonth?: number | null;
      businessDayRule?: "none" | "last_business_day";
    };
  }) {
    const rule: RecurringExpenseRule = {
      id: `recurring-command-${crypto.randomUUID()}`,
      name: input.name.trim() || "Dönemsel gider",
      category: input.category || "Sabit / dönemsel gider",
      counterparty: input.counterparty.trim(),
      amount: Number(input.amount),
      amountMode: "fixed",
      frequencyMonths: input.recurrence.kind === "monthly" ? Math.max(1, input.recurrence.interval) : 1,
      recurrenceKind: input.recurrence.kind,
      recurrenceInterval: Math.max(1, input.recurrence.interval || 1),
      recurrenceDayOfWeek: input.recurrence.dayOfWeek ?? undefined,
      recurrenceDayOfMonth: input.recurrence.dayOfMonth ?? undefined,
      businessDayRule: input.recurrence.businessDayRule || "none",
      autoCreate: true,
      startDate: input.startDate,
      paymentMethod: input.paymentMethod,
      documentType: "none",
      vatRate: 0,
      active: true,
      note: "Finans asistanından oluşturuldu; takvim otomatik ilerler.",
    };
    return saveRecurringRule(rule);
  }

  async function saveFinancialGoal(goal: FinancialGoal) {
    const saved = await persistData({ action: "saveGoal", goal });
    if (!saved) return false;
    setGoals((current) => {
      const exists = current.some((item) => item.id === goal.id);
      return exists ? current.map((item) => item.id === goal.id ? goal : item) : [...current, goal];
    });
    setDataMode("persistent");
    return true;
  }

  async function payRecurringOccurrence(payload: RecurringPaymentPayload) {
    const saved = await persistData({
      action: "payRecurringOccurrence",
      ...payload,
    });
    if (!saved) return false;
    setRecurringOccurrences((current) => {
      const exists = current.some(
        (item) => item.id === payload.occurrence.id,
      );
      return exists
        ? current.map((item) =>
            item.id === payload.occurrence.id ? payload.occurrence : item,
          )
        : [...current, payload.occurrence];
    });
    setTransactions((current) => {
      const exists = current.some(
        (item) => item.id === payload.transaction.id,
      );
      return exists
        ? current.map((item) =>
            item.id === payload.transaction.id ? payload.transaction : item,
          )
        : [payload.transaction, ...current];
    });
    return true;
  }

  function openNewDebt() {
    setRecordForm({
      type: "payable",
      counterparty: "",
      contactName: "",
      phone: "",
      email: "",
      detail: "",
      documentRef: "",
      createdDate: TODAY,
      dueDate: "",
      amount: "",
      denominationCode: "TRY",
      denominationQuantity: "",
      denominationOpenUnitPrice: "1",
      denominationRateSource: "manual",
      denominationPurity: "1",
      denominationKarat: "24",
      denominationMillesimal: "999",
      installmentCount: "1",
      reminderDays: "3",
      initialPayment: "",
      initialPaymentMethod: "cash",
      recognizeRevenue: false,
    });
    setRecordModalOpen(true);
  }

  async function saveLedgerInvoice(record: LedgerRecord) {
    const workingItems = new Map(
      inventory.map((item) => [item.id, item] as const),
    );
    const changedItems = new Map<string, InventoryItem>();
    const movements: StockMovement[] = [];
    const finalLines = (record.lineItems ?? []).map((line, index) => {
      if (!line.trackStock || line.stockMovementId) return line;

      const normalizedName = line.itemName
        .trim()
        .toLocaleLowerCase("tr-TR");
      let item =
        (line.inventoryItemId
          ? workingItems.get(line.inventoryItemId)
          : undefined) ??
        Array.from(workingItems.values()).find(
          (candidate) =>
            candidate.name.trim().toLocaleLowerCase("tr-TR") ===
            normalizedName,
        );

      if (!item) {
        item = {
          id: `stock-invoice-${Date.now()}-${index}`,
          name: line.itemName,
          category: line.category,
          unit: line.unit,
          purchaseUnit: line.unit,
          unitsPerPackage: 1,
          quantity: 0,
          minimumQuantity: 0,
          unitCost: 0,
          supplier: record.counterparty,
          lot: "",
          expiryDate: "",
        };
      }

      const movement: StockMovement = {
        id: `sm-invoice-${line.id}`,
        itemId: item.id,
        itemName: item.name,
        date: record.documentDate || record.createdDate,
        type: "purchase",
        quantity: line.quantity,
        unitCost: line.unitPrice,
        totalCost: line.lineTotal,
        unitsPerPackage: 1,
        documentType: "invoice",
        documentRef: record.documentRef,
        note: `${record.counterparty} fatura kalemi`,
      };
      const updatedItem = {
        ...applyStockMovement(item, movement),
        supplier: record.counterparty,
      } as InventoryItem;
      workingItems.set(updatedItem.id, updatedItem);
      changedItems.set(updatedItem.id, updatedItem);
      movements.push(movement);

      return {
        ...line,
        inventoryItemId: updatedItem.id,
        stockMovementId: movement.id,
      };
    });
    const finalRecord = { ...record, lineItems: finalLines };

    const saved = await persistData({
      action: "saveLedgerInvoice",
      record: finalRecord,
      items: Array.from(changedItems.values()),
      movements,
    });
    if (!saved) return false;

    setRecords((current) =>
      current.map((item) => (item.id === finalRecord.id ? finalRecord : item)),
    );
    if (changedItems.size) {
      setInventory((current) => {
        const next = new Map(current.map((item) => [item.id, item] as const));
        for (const item of changedItems.values()) next.set(item.id, item);
        return Array.from(next.values());
      });
    }
    if (movements.length) {
      setStockMovements((current) => [...movements, ...current]);
    }
    setInvoiceRecordId(null);
    setActiveView("debts");
    return true;
  }

  function openStockMovement(itemId?: string) {
    setStockMovementItemId(itemId || null);
    setStockMovementModalOpen(true);
  }

  async function saveStockMovement(movement: StockMovement) {
    const currentItem = inventory.find((item) => item.id === movement.itemId);
    const updatedItem = currentItem
      ? applyStockMovement(currentItem, movement)
      : null;
    if (!currentItem || !updatedItem) return false;
    const operationType =
      movement.type === "sale"
        ? "inventory_sale_cost"
        : movement.type === "waste"
          ? "inventory_waste"
          : "inventory_usage";
    const costTransaction: ClinicTransaction = {
      id: `tx-stock-${movement.id}`,
      date: movement.date,
      time: timeInIstanbul(),
      kind: "expense",
      category:
        movement.type === "waste"
          ? "Stok fire / zayi"
          : movement.type === "sale"
            ? "Satılan ürün maliyeti"
            : "Klinik sarf maliyeti",
      description: `${movement.itemName} · ${movement.quantity} ${currentItem.unit}`,
      counterparty: "Stok",
      operationType,
      costBehavior: "variable",
      amount:
        Math.round(movement.quantity * currentItem.unitCost * 100) / 100,
      paymentMethod: "accrual",
      documentType: "stock_record",
      documentRef: movement.id,
      vatRate: 0,
      postingMode: "economic_only",
      sourceModule: "inventory",
      sourceRecordId: movement.id,
      isAutomatic: true,
    };
    if (costTransaction.amount <= 0) {
      setStorageError(
        `${movement.itemName} için birim maliyet sıfır. Gerçek maliyet oluşmadan stok çıkışı kaydedilemez.`,
      );
      return false;
    }
    const linkedMovement = {
      ...movement,
      transactionId: costTransaction.id,
    };
    const saved = await persistData({
      action: "saveStockMovement",
      item: updatedItem,
      movement: linkedMovement,
      transaction: costTransaction,
    });
    if (!saved) return false;
    setInventory((current) =>
      current.map((item) =>
        item.id === movement.itemId ? updatedItem : item,
      ),
    );
    setStockMovements((current) => [linkedMovement, ...current]);
    setTransactions((current) => [costTransaction, ...current]);
    setStockMovementModalOpen(false);
    setStockMovementItemId(null);
    setActiveView("inventory");
    return true;
  }

  async function saveInventoryItem(item: InventoryItem) {
    const saved = await persistData({ action: "saveInventoryItem", item });
    if (!saved) return false;
    setInventory((current) => [...current, item]);
    setInventoryItemModalOpen(false);
    setActiveView("inventory");
    return true;
  }

  function openPayment(id: string) {
    setSelectedRecordId(null);
    setPaymentError("");
    setPaymentRecordId(id);
    setPaymentForm({
      recordId: id,
      date: TODAY,
      amount: "",
      denominationQuantity: "",
      denominationUnitPrice: "",
      method: "Havale",
      note: "",
    });
  }

  async function submitRecord(event: FormEvent) {
    event.preventDefault();
    const nativeForm = new FormData(event.currentTarget as HTMLFormElement);
    const counterparty = String(nativeForm.get("counterparty") ?? "").trim();
    const contactName = String(nativeForm.get("contactName") ?? "").trim();
    const phone = String(nativeForm.get("phone") ?? "").trim();
    const email = String(nativeForm.get("email") ?? "").trim();
    const detail = String(nativeForm.get("detail") ?? "").trim();
    const documentRef = String(nativeForm.get("documentRef") ?? "").trim();
    const createdDate = String(nativeForm.get("createdDate") ?? "");
    const dueDate = String(nativeForm.get("dueDate") ?? "");
    const denominationCode = String(nativeForm.get("denominationCode") ?? "TRY").toUpperCase();
    const denominationQuantity = Number(nativeForm.get("denominationQuantity"));
    const denominationOpenUnitPrice = Number(nativeForm.get("denominationOpenUnitPrice"));
    const denominationPurity = Number(nativeForm.get("denominationPurity") || 1);
    const denominationKarat = Number(nativeForm.get("denominationKarat") || 0) || undefined;
    const denominationMillesimal = Number(nativeForm.get("denominationMillesimal") || 0) || undefined;
    const installmentCount = Math.max(1, Math.min(120, Number(nativeForm.get("installmentCount") || 1)));
    const rawAmount = Number(nativeForm.get("amount"));
    const initialPayment = Number(nativeForm.get("initialPayment") || 0);
    const initialPaymentMethod = String(nativeForm.get("initialPaymentMethod") || "cash") as "cash" | "card" | "transfer";
    const isIndexed = denominationCode !== "TRY";
    const denominationInfo = denominationDescriptor({ denominationCode, denominationPurity, denominationKarat, denominationMillesimal });
    const amount = isIndexed
      ? indexedAmountValue({ denominationCode, denominationPurity, denominationKarat, denominationMillesimal }, denominationQuantity, denominationOpenUnitPrice) ?? 0
      : rawAmount;
    const reminderDays = Number(nativeForm.get("reminderDays"));
    if (
      !counterparty ||
      !detail ||
      !createdDate ||
      !dueDate ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      (isIndexed && (!Number.isFinite(denominationQuantity) || denominationQuantity <= 0 || !Number.isFinite(denominationOpenUnitPrice) || denominationOpenUnitPrice <= 0))
    ) {
      return;
    }
    if (
      !Number.isFinite(initialPayment) ||
      initialPayment < 0 ||
      initialPayment > amount + 0.0001
    ) {
      setStorageError("İlk ödeme sıfırdan küçük olamaz ve toplam alacağı aşamaz.");
      return;
    }

    const prefix = recordForm.type === "receivable" ? "ALC" : "BRC";
    const newRecord: LedgerRecord = {
      id: `${recordForm.type}-${Date.now()}`,
      type: recordForm.type,
      counterparty,
      contactName,
      phone,
      email,
      detail,
      documentRef:
        documentRef ||
        `${prefix}-${TODAY.slice(0, 4)}-${String(records.length + 1).padStart(3, "0")}`,
      documentDate: "",
      stage: "note",
      createdDate,
      dueDate,
      originalAmount: amount,
      denominationCode,
      denominationQuantity: isIndexed ? denominationQuantity : amount,
      denominationOpenUnitPrice: isIndexed ? denominationOpenUnitPrice : 1,
      denominationRateSource: isIndexed ? recordForm.denominationRateSource || "manual" : "TRY",
      denominationAssetClass: denominationInfo.assetClass,
      denominationUnit: denominationInfo.unit,
      denominationPurity: isIndexed ? denominationPurity : 1,
      denominationKarat: isIndexed ? denominationKarat : undefined,
      denominationMillesimal: isIndexed ? denominationMillesimal : undefined,
      denominationLabel: denominationInfo.display,
      reserve: 0,
      reminderDays,
      lineItems: [],
      payments: [],
    };
    const revenueTransaction: ClinicTransaction | undefined =
      recordForm.type === "receivable" && recordForm.recognizeRevenue
        ? {
            id: `tx-ledger-service-${newRecord.id}`,
            date: createdDate,
            time: currentTimeInIstanbul(),
            kind: "income",
            category: "Veteriner hizmet / tedavi",
            description: `${newRecord.detail} · ${newRecord.counterparty}`,
            counterparty: newRecord.counterparty,
            operationType: "service",
            costBehavior: "non_expense",
            businessClass: "service",
            amount,
            paymentMethod: "accrual",
            documentType: documentRef ? "invoice" : "none",
            documentRef: newRecord.documentRef,
            vatRate: 0,
            postingMode: "economic_only",
            sourceModule: "ledger_service",
            sourceRecordId: newRecord.id,
            isAutomatic: true,
          }
        : undefined;
    const saved = await persistData({
      action: "saveLedgerRecord",
      record: newRecord,
      revenueTransaction,
    });
    if (!saved) return;
    setRecords((current) => [...current, newRecord]);
    if (revenueTransaction) {
      setTransactions((current) => [revenueTransaction, ...current]);
    }
    if (recordForm.type === "receivable" && initialPayment > 0) {
      const paymentResult = await saveLedgerPaymentDirect(newRecord.id, {
        amount: initialPayment,
        method: initialPaymentMethod,
        note: `İlk tahsilat · ${newRecord.detail}`,
        date: createdDate,
        record: newRecord,
      });
      if (!paymentResult.ok) {
        setStorageError(
          `Alacak kaydedildi; ilk tahsilat işlenemedi: ${paymentResult.error || "Bilinmeyen hata"}`,
        );
      }
    }
    if (installmentCount > 1) {
      const unitTotal = isIndexed ? denominationQuantity : amount;
      const schedules = Array.from({ length: installmentCount }, (_, index) => {
        const share = index === installmentCount - 1
          ? unitTotal - (unitTotal / installmentCount) * (installmentCount - 1)
          : unitTotal / installmentCount;
        const tlShare = index === installmentCount - 1
          ? amount - Math.round((amount / installmentCount) * 100) / 100 * (installmentCount - 1)
          : Math.round((amount / installmentCount) * 100) / 100;
        return {
          id: `installment-${newRecord.id}-${index + 1}`,
          ledgerRecordId: newRecord.id,
          installmentNo: index + 1,
          dueDate: addMonthsSafe(dueDate, index),
          amount: Math.max(0, Math.round(tlShare * 100) / 100),
          denominationQuantity: isIndexed ? Math.max(0, Math.round(share * 1e8) / 1e8) : undefined,
          status: "planned",
        };
      });
      const planSaved = await persistData({ action: "saveInstallmentPlan", ledgerRecordId: newRecord.id, schedules });
      if (planSaved) setInstallmentSchedules((current) => [...current.filter((item) => item.ledgerRecordId !== newRecord.id), ...schedules]);
    }
    setRecordModalOpen(false);
    setActiveView(recordForm.type === "payable" ? "debts" : "ledger");
    setFilter("all");
    setRecordForm({
      type: "receivable",
      counterparty: "",
      contactName: "",
      phone: "",
      email: "",
      detail: "",
      documentRef: "",
      createdDate: TODAY,
      dueDate: "",
      amount: "",
      denominationCode: "TRY",
      denominationQuantity: "",
      denominationOpenUnitPrice: "1",
      denominationRateSource: "manual",
      reminderDays: "3",
      initialPayment: "",
      initialPaymentMethod: "cash",
      recognizeRevenue: true,
    });
  }

  async function createLedgerRecordDirect(input: {
    type: LedgerType;
    counterparty: string;
    detail: string;
    createdDate: string;
    dueDate: string;
    amount: number;
    reminderDays: number;
    denominationCode?: string;
    denominationQuantity?: number;
    denominationOpenUnitPrice?: number;
    denominationRateSource?: string;
    denominationAssetClass?: string;
    denominationUnit?: string;
    denominationPurity?: number;
    denominationKarat?: number | null;
    denominationMillesimal?: number | null;
    denominationLabel?: string;
    installmentCount?: number;
  }) {
    if (!canWrite) return false;
    const prefix = input.type === "receivable" ? "ALC" : "BRC";
    const code = String(input.denominationCode || "TRY").toUpperCase();
    const descriptor = denominationDescriptor({
      denominationCode: code,
      denominationPurity: input.denominationPurity ?? 1,
      denominationKarat: input.denominationKarat ?? undefined,
      denominationMillesimal: input.denominationMillesimal ?? undefined,
    });
    const isIndexed = code !== "TRY";
    const quantity = isIndexed ? Number(input.denominationQuantity || 0) : Number(input.amount);
    const unitPrice = isIndexed ? Number(input.denominationOpenUnitPrice || 0) : 1;
    const amount = isIndexed
      ? indexedAmountValue({ denominationCode: code, denominationPurity: descriptor.purity, denominationKarat: input.denominationKarat, denominationMillesimal: input.denominationMillesimal }, quantity, unitPrice) ?? 0
      : Number(input.amount);
    const newRecord: LedgerRecord = {
      id: `${input.type}-command-${crypto.randomUUID()}`,
      type: input.type,
      counterparty: input.counterparty.trim(),
      contactName: "", phone: "", email: "",
      detail: input.detail.trim() || "Hızlı komut kaydı",
      documentRef: `${prefix}-${TODAY.slice(0, 4)}-${String(records.length + 1).padStart(3, "0")}`,
      documentDate: "", stage: "note", createdDate: input.createdDate, dueDate: input.dueDate,
      originalAmount: amount, denominationCode: code, denominationQuantity: quantity,
      denominationOpenUnitPrice: unitPrice, denominationRateSource: isIndexed ? input.denominationRateSource || "manual" : "TRY",
      denominationAssetClass: input.denominationAssetClass || descriptor.assetClass,
      denominationUnit: input.denominationUnit || descriptor.unit,
      denominationPurity: isIndexed ? descriptor.purity : 1,
      denominationKarat: input.denominationKarat ?? undefined, denominationMillesimal: input.denominationMillesimal ?? undefined,
      denominationLabel: input.denominationLabel || descriptor.display, reserve: 0,
      reminderDays: Number(input.reminderDays || 3), lineItems: [], payments: [],
    };
    if (!newRecord.counterparty || !newRecord.dueDate || !Number.isFinite(newRecord.originalAmount) || newRecord.originalAmount <= 0 || (isIndexed && (!quantity || !unitPrice))) return false;
    const saved = await persistData({ action: "saveLedgerRecord", record: newRecord });
    if (!saved) return false;
    setRecords((current) => [...current, newRecord]);

    const installmentCount = Math.max(1, Math.min(120, Number(input.installmentCount || 1)));
    if (installmentCount > 1) {
      const schedules = Array.from({ length: installmentCount }, (_, index) => {
        const qtyShare = quantity / installmentCount;
        const tlShare = amount / installmentCount;
        return {
          id: `installment-${newRecord.id}-${index + 1}`, ledgerRecordId: newRecord.id, installmentNo: index + 1,
          dueDate: addMonthsSafe(input.dueDate, index),
          amount: index === installmentCount - 1 ? Math.round((amount - (Math.round(tlShare * 100) / 100) * (installmentCount - 1)) * 100) / 100 : Math.round(tlShare * 100) / 100,
          denominationQuantity: isIndexed ? (index === installmentCount - 1 ? Math.round((quantity - qtyShare * (installmentCount - 1)) * 1e8) / 1e8 : Math.round(qtyShare * 1e8) / 1e8) : undefined,
          status: "planned",
        };
      });
      const planSaved = await persistData({ action: "saveInstallmentPlan", ledgerRecordId: newRecord.id, schedules });
      if (planSaved) setInstallmentSchedules((current) => [...current.filter((item) => item.ledgerRecordId !== newRecord.id), ...schedules]);
    }
    setDataMode("persistent");
    return true;
  }

  async function saveLedgerPaymentDirect(
    recordId: string,
    input: {
      amount: number;
      method: "cash" | "card" | "transfer" | "accrual";
      note: string;
      denominationCode?: string;
      denominationQuantity?: number;
      denominationUnitPrice?: number;
      date?: string;
      record?: LedgerRecord;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!canWrite) return { ok: false, error: "Bu hesap yalnızca görüntüleme yetkisine sahip." };
    const record = records.find((item) => item.id === recordId) ?? input.record;
    if (!record) return { ok: false, error: "Cari kayıt bulunamadı." };
    const isIndexed = String(record.denominationCode || "TRY") !== "TRY";
    const status = ledgerStatus({ ...record, today: TODAY });
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Tutar sıfırdan büyük olmalıdır." };
    if (isIndexed) {
      const qty = Number(input.denominationQuantity || 0);
      const price = Number(input.denominationUnitPrice || 0);
      if (String(input.denominationCode || record.denominationCode) !== String(record.denominationCode) || qty <= 0 || price <= 0) return { ok: false, error: "Endeksli cari için kendi biriminde miktar ve güncel TL değeri zorunludur." };
      if (qty > remainingDenomination(record) + 1e-8) return { ok: false, error: "Ödeme miktarı kalan endeksli bakiyeyi aşamaz." };
    } else if (amount > status.remaining + 0.0001) {
      return { ok: false, error: `Tutar kalan bakiyeyi aşamaz. Azami ${formatMoney(status.remaining)}.` };
    }
    const paymentId = `payment-command-${crypto.randomUUID()}`;
    try {
      const response = await postFinanceJson("/api/clinic-data", {
        action: "saveLedgerPayment",
        payment: {
          id: paymentId, recordId, amount, denominationCode: isIndexed ? record.denominationCode : "TRY",
          denominationQuantity: isIndexed ? input.denominationQuantity : amount, denominationUnitPrice: isIndexed ? input.denominationUnitPrice : 1,
          date: input.date || TODAY, method: input.method, note: input.note,
        },
      });
      const result = (await response.json()) as { error?: string; payment?: Payment; transactions?: ClinicTransaction[] };
      if (!response.ok || !result.payment) throw new Error(result.error || "Tahsilat/ödeme kaydedilemedi.");
      setRecords((current) => current.map((item) => item.id === recordId ? { ...item, payments: [...item.payments, result.payment as Payment] } : item));
      if (result.transactions?.length) {
        setTransactions((current) => { const next = new Map(current.map((item) => [item.id, item] as const)); for (const transaction of result.transactions ?? []) next.set(transaction.id, transaction); return Array.from(next.values()); });
      }
      setStorageError(""); setDataMode("persistent"); return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Tahsilat/ödeme kaydedilemedi." };
    }
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) {
      setPaymentError("Bu hesap yalnızca görüntüleme yetkisine sahip.");
      return;
    }
    if (!paymentRecord) return;
    const nativeForm = new FormData(event.currentTarget as HTMLFormElement);
    const enteredAmount = Number(nativeForm.get("paymentAmount"));
    const denominationQuantity = Number(nativeForm.get("paymentDenominationQuantity"));
    const denominationUnitPrice = Number(nativeForm.get("paymentDenominationUnitPrice"));
    const date = String(nativeForm.get("paymentDate") ?? "");
    const method = String(nativeForm.get("paymentMethod") ?? "");
    const note = String(nativeForm.get("paymentNote") ?? "").trim();
    const status = ledgerStatus({ ...paymentRecord, today: TODAY });
    const denominationCode = String(paymentRecord.denominationCode || "TRY");
    const isIndexed = denominationCode !== "TRY";
    const remainingUnits = remainingDenomination(paymentRecord);
    const amount = isIndexed ? indexedAmountValue(paymentRecord, denominationQuantity, denominationUnitPrice) ?? 0 : enteredAmount;

    if (!date || !Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Tutar sıfırdan büyük olmalıdır.");
      return;
    }
    if (isIndexed) {
      if (!Number.isFinite(denominationQuantity) || denominationQuantity <= 0 || !Number.isFinite(denominationUnitPrice) || denominationUnitPrice <= 0) {
        setPaymentError("Endeksli borç için ödenen miktar ve güncel birim TL değeri zorunludur.");
        return;
      }
      if (denominationQuantity > remainingUnits + 0.00000001) {
        setPaymentError(`Miktar kalan ${remainingUnits.toLocaleString("tr-TR")} ${denominationCode} bakiyesini aşamaz.`);
        return;
      }
    } else if (amount > status.remaining) {
      setPaymentError(
        `Tutar kalan bakiyeyi aşamaz. Azami ${formatMoney(status.remaining)}.`,
      );
      return;
    }

    setPaymentSaving(true);
    const paymentId = `payment-${Date.now()}`;
    try {
      const response = await postFinanceJson("/api/clinic-data", {
          action: "saveLedgerPayment",
          payment: {
            id: paymentId,
            recordId: paymentRecord.id,
            amount,
            denominationCode: isIndexed ? denominationCode : "TRY",
            denominationQuantity: isIndexed ? denominationQuantity : amount,
            denominationUnitPrice: isIndexed ? denominationUnitPrice : 1,
            date,
            method,
            note,
          },
      });
      const result = (await response.json()) as {
        error?: string;
        payment?: Payment;
        transactions?: ClinicTransaction[];
      };
      if (!response.ok || !result.payment) {
        throw new Error(result.error || "Tahsilat/ödeme kaydedilemedi.");
      }
      setRecords((current) =>
        current.map((record) =>
          record.id === paymentRecord.id
            ? {
                ...record,
                payments: [...record.payments, result.payment as Payment],
              }
            : record,
        ),
      );
      if (result.transactions?.length) {
        setTransactions((current) => {
          const next = new Map(current.map((item) => [item.id, item] as const));
          for (const transaction of result.transactions ?? []) {
            next.set(transaction.id, transaction);
          }
          return Array.from(next.values());
        });
      }
      setPaymentRecordId(null);
      setPaymentError("");
      setStorageError("");
      setDataMode("persistent");
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Tahsilat/ödeme kaydedilemedi.",
      );
    } finally {
      setPaymentSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span>E</span>
            <strong>ELÇİ YÖNETİM</strong>
          </div>
          <div className="topbar-right">
            <span className="as-of">{formatDate(TODAY)}</span>
            <span className={`data-health ${dataMode}`}>
              <i /> {dataMode === "empty" ? "Kurulum gerekli" : dataMode === "persistent" ? "Veri bağlı" : dataMode === "offline" ? "Bağlantı kontrolü" : "Kontrol ediliyor"}
            </span>
            <span className="finance-user-chip" title={currentUser.email}>{currentUser.role === "editor" ? "Düzenleyici" : "Salt okunur"}</span>
            <a className="finance-logout" href="/api/finance-logout">Çıkış</a>
          </div>
        </header>

        <MobileNav activeView={activeView} setActiveView={setActiveView} />

        <div className="page">
          <DataNotice mode={dataMode} error={storageError} />
          {currentUser.role === "viewer" ? <div className="read-only-notice">Salt okunur erişim: kayıt ekleme ve değiştirme işlemleri kapalıdır.</div> : null}
          <div className="page-head">
            <div>
              <span className="eyebrow">Elçi Klinik · İşletme yönetimi</span>
              <h1>{title.title}</h1>
              <p>{title.subtitle}</p>
            </div>
            {(activeView === "ledger" || activeView === "calendar") && (
              <button
                className="primary-button"
                onClick={() => setRecordModalOpen(true)}
                disabled={!canWrite}
                type="button"
              >
                <span>+</span> Yeni kayıt
              </button>
            )}
            {(activeView === "today" || activeView === "overview" || activeView === "cash") && (
              <button
                className="primary-button"
                onClick={() => openTransaction()}
                disabled={!canWrite}
                type="button"
              >
                <span>+</span> Günlük hareket
              </button>
            )}
          </div>

          {activeView === "today" ? (
            <TodayWorkspace
              dataMode={dataMode}
              goals={goals}
              cashReserveValue={decisionSettings.cashBalance !== null && decisionSettings.bankBalance !== null ? decisionSettings.cashBalance + decisionSettings.bankBalance : null}
              inventory={inventory}
              onCreateLedgerRecord={createLedgerRecordDirect}
              onCreateRecurringRule={createRecurringRuleDirect}
              onNavigate={setActiveView}
              onSave={saveTransaction}
              onSaveLedgerPayment={saveLedgerPaymentDirect}
              onSaveReceipt={saveQuickReceipt}
              onUndo={(transaction) => reverseTransaction(transaction, "10 saniyelik geri alma")}
              productDefinitions={productDefinitions}
              records={records}
              recurringOccurrences={recurringOccurrences}
              recurringRules={recurringRules}
              installmentSchedules={installmentSchedules}
              today={TODAY}
              transactions={transactions}
            />
          ) : null}

          {activeView === "work" ? (
            <WorkWorkspace
              inventory={inventory}
              onNavigate={setActiveView}
              records={records}
              today={TODAY}
              transactions={transactions}
            />
          ) : null}

          {activeView === "records" ? (
            <RecordsWorkspace
              inventoryCount={inventory.length}
              onNavigate={setActiveView}
              payableCount={records.filter((record) => record.type === "payable").length}
              receivableCount={records.filter((record) => record.type === "receivable").length}
              recurringCount={recurringRules.length}
              transactionCount={transactions.filter((item) => item.status !== "cancelled").length}
            />
          ) : null}

          {activeView === "overview" ? (
            <OverviewView
              summary={summary}
              records={records}
              transactions={transactions}
              inventory={inventory}
              decision={decisionEngine}
              onNavigate={setActiveView}
            />
          ) : null}

          {activeView === "decision" ? (
            <DecisionEngineView
              focus="all"
              inventory={inventory}
              onSaveSettings={saveDecisionSettings}
              records={records}
              recurringOccurrences={recurringOccurrences}
              recurringRules={recurringRules}
              settings={decisionSettings}
              today={TODAY}
              transactions={transactions}
            />
          ) : null}

          {activeView === "daily" ? (
            <QuickDailyView
              today={TODAY}
              transactions={transactions}
              inventory={inventory}
              posCommissionRate={posCommissionRate}
              onPosCommissionRateChange={updatePosCommissionRate}
              onSaveTransaction={saveTransaction}
              onUpdateTransaction={updateTransaction}
              onReverseTransaction={reverseTransaction}
              onSaveQuickPurchase={saveQuickPurchase}
              onSaveQuickReceipt={saveQuickReceipt}
              onSaveCatalogItem={saveCatalogItem}
              onOpenDetailedEntry={openTransaction}
            />
          ) : null}

          {activeView === "recurring" ? (
            <RecurringExpensesView
              today={TODAY}
              rules={recurringRules}
              occurrences={recurringOccurrences}
              onSaveRule={saveRecurringRule}
              onPay={payRecurringOccurrence}
            />
          ) : null}

          {activeView === "ledger" ? (
            <>
              <section className="kpi-grid ledger-kpis">
                <KpiCard
                  label="Kalan alacak"
                  value={formatMoney(summary.receivable.remaining)}
                  note={`${formatMoney(summary.receivable.paid)} tahsil edildi`}
                  tone="blue"
                />
                <KpiCard
                  label="Gecikmiş alacak"
                  value={formatMoney(summary.receivable.overdue)}
                  note="Kısmi ödeme gecikmeyi kapatmaz"
                  tone="red"
                />
                <KpiCard
                  label="Kalan borç"
                  value={formatMoney(summary.payable.remaining)}
                  note={`${formatMoney(summary.payable.paid)} ödendi`}
                  tone="purple"
                />
                <KpiCard
                  label="Takvim olayı"
                  value={String(
                    calendarEventsFromLedger(records, TODAY).length +
                      operationEvents.length,
                  )}
                  note="Listeden otomatik üretildi"
                />
              </section>
              <LedgerView
                records={records}
                filter={filter}
                setFilter={setFilter}
                onOpenDetail={setSelectedRecordId}
                onAddPayment={openPayment}
              />
            </>
          ) : null}

          {activeView === "calendar" ? (
            <CalendarView
              records={records}
              transactions={transactions}
              inventory={inventory}
              recurringRules={recurringRules}
              recurringOccurrences={recurringOccurrences}
            />
          ) : null}

          {activeView === "debts" ? (
            <DebtsView
              records={records}
              onNewDebt={openNewDebt}
              onInvoice={setInvoiceRecordId}
              onAddPayment={openPayment}
            />
          ) : null}
          {activeView === "cash" ? (
            <>
              <MonthlyCloseView
                transactions={transactions}
                closings={monthlyClosings}
                events={monthlyCloseEvents}
                today={TODAY}
                onClose={saveMonthlyClosing}
                onReopen={reopenMonthlyClosing}
              />
              <CashControlView transactions={transactions} today={TODAY} />
            </>
          ) : null}
          {activeView === "inventory" ? (
            <InventoryView
              items={inventory}
              movements={stockMovements}
              onOpenMovement={openStockMovement}
              onAddItem={() => setInventoryItemModalOpen(true)}
            />
          ) : null}
          {activeView === "insights" ? (
            <InsightsView
              transactions={transactions}
              items={inventory}
              movements={stockMovements}
              records={records}
              today={TODAY}
              targetPosRate={targetPosRate}
            />
          ) : null}
          {activeView === "reports" ? (
            <>
              <PlanningWorkspace onNavigate={setActiveView} />
              <ReportsView
                transactions={transactions}
                items={inventory}
                movements={stockMovements}
                records={records}
                today={TODAY}
                targetPosRate={targetPosRate}
              />
            </>
          ) : null}
          {activeView === "settings" ? <SettingsWorkspace integrity={integrity} onNavigate={setActiveView} /> : null}
          {activeView === "import" ? (
            <HistoricalImportView
              batches={importBatches}
              canWrite={canWrite}
              onRollback={rollbackHistoricalImport}
              transactions={transactions}
              recurringRules={recurringRules}
              records={records}
            />
          ) : null}
          {activeView === "checks" ? <ChecksView auditEvents={auditEvents} /> : null}
          {activeView === "goals" ? (
            <GoalsView
              goals={goals}
              marketRates={marketRates}
              cashReserveValue={decisionSettings.cashBalance !== null && decisionSettings.bankBalance !== null ? decisionSettings.cashBalance + decisionSettings.bankBalance : null}
              milestones={goalMilestones}
              onSaveGoal={saveFinancialGoal}
              records={records}
              today={TODAY}
              transactions={transactions}
            />
          ) : null}
          {activeView === "tax" ? (
            <>
              <PosSettlementCenter
                onSettle={settlePosTransaction}
                today={TODAY}
                transactions={transactions}
              />
              <DecisionEngineView
                focus="tax"
                inventory={inventory}
                onSaveSettings={saveDecisionSettings}
                records={records}
                recurringOccurrences={recurringOccurrences}
                recurringRules={recurringRules}
                settings={decisionSettings}
                today={TODAY}
                transactions={transactions}
              />
            </>
          ) : null}
        </div>
      </main>

      {selectedRecord ? (
        <DetailDrawer
          record={selectedRecord}
          onClose={() => setSelectedRecordId(null)}
          onAddPayment={() => openPayment(selectedRecord.id)}
        />
      ) : null}

      {recordModalOpen ? (
        <RecordDialog
          form={recordForm}
          setForm={setRecordForm}
          onClose={() => setRecordModalOpen(false)}
          onSubmit={submitRecord}
        />
      ) : null}

      {paymentRecord ? (
        <PaymentDialog
          form={paymentForm}
          record={paymentRecord}
          setForm={setPaymentForm}
          onClose={() => setPaymentRecordId(null)}
          onSubmit={submitPayment}
          error={paymentError}
          saving={paymentSaving}
        />
      ) : null}

      {invoiceRecord ? (
        <InvoiceDialog
          inventory={inventory}
          onClose={() => setInvoiceRecordId(null)}
          onSave={saveLedgerInvoice}
          record={invoiceRecord}
        />
      ) : null}

      {transactionModalDate ? (
        <TransactionDialog
          defaultDate={transactionModalDate}
          defaultPosRate={posCommissionRate}
          transactions={transactions}
          onClose={() => setTransactionModalDate(null)}
          onSave={saveTransaction}
        />
      ) : null}

      {stockMovementModalOpen ? (
        <StockMovementDialog
          items={inventory}
          selectedItemId={stockMovementItemId || undefined}
          defaultDate={TODAY}
          onClose={() => {
            setStockMovementModalOpen(false);
            setStockMovementItemId(null);
          }}
          onSave={saveStockMovement}
        />
      ) : null}

      {inventoryItemModalOpen ? (
        <InventoryItemDialog
          onClose={() => setInventoryItemModalOpen(false)}
          onSave={saveInventoryItem}
        />
      ) : null}
    </div>
  );
}
