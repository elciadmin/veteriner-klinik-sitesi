"use client";

import { useMemo, useState } from "react";

import { ledgerSummary } from "@/lib/finance.mjs";
import {
  buildActionItems,
  consumableUsageStatistics,
  dailyOperationsSummary,
  inventorySummary,
  isRecognizedExpense,
  operationsStatistics,
} from "@/lib/operations.mjs";
import {
  buildCsv,
  buildExportFilename,
  buildReportExport,
  buildXlsx,
} from "@/lib/report-export.mjs";
import type {
  ClinicTransaction,
  InventoryItem,
  StockMovement,
} from "./operational-modules";

type LedgerRecordLike = {
  id: string;
  type: "receivable" | "payable";
  counterparty: string;
  contactName: string;
  phone: string;
  email: string;
  detail: string;
  documentRef: string;
  createdDate: string;
  dueDate: string;
  originalAmount: number;
  reserve: number;
  reminderDays: number;
  payments: Array<{
    amount: number;
    date: string;
    method?: string;
    note?: string;
    status?: "cancelled";
  }>;
};

type ReportingProps = {
  transactions: ClinicTransaction[];
  items: InventoryItem[];
  movements: StockMovement[];
  records: LedgerRecordLike[];
  today: string;
  targetPosRate: number;
};

type ExportScope = "all" | "income" | "outflows";

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
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function money(value: number) {
  return TRY.format(value);
}

function percent(value: number | null) {
  return value === null ? "Hesaplanamaz" : `%${NUMBER.format(value * 100)}`;
}

function dateLabel(value: string) {
  return DATE.format(new Date(`${value}T00:00:00Z`));
}

function downloadBlob(
  content: string | Uint8Array,
  filename: string,
  contentType: string,
) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function printAfterRender() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => window.print());
  });
}

function periodForPreset(
  preset: "today" | "month" | "year",
  today: string,
) {
  const [year, month] = today.split("-");
  if (preset === "today") return { startDate: today, endDate: today };
  if (preset === "month") {
    const lastDay = new Date(
      Date.UTC(Number(year), Number(month), 0),
    ).getUTCDate();
    return {
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function PeriodControls({
  startDate,
  endDate,
  today,
  onChange,
}: {
  startDate: string;
  endDate: string;
  today: string;
  onChange: (period: { startDate: string; endDate: string }) => void;
}) {
  return (
    <div className="report-period-controls">
      <div className="filter-row compact-filter">
        {[
          ["today", "Bugün"],
          ["month", "Bu ay"],
          ["year", "Bu yıl"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() =>
              onChange(
                periodForPreset(
                  value as "today" | "month" | "year",
                  today,
                ),
              )
            }
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <label>
        Başlangıç
        <input
          max={endDate}
          onChange={(event) =>
            onChange({ startDate: event.target.value, endDate })
          }
          type="date"
          value={startDate}
        />
      </label>
      <label>
        Bitiş
        <input
          min={startDate}
          onChange={(event) =>
            onChange({ startDate, endDate: event.target.value })
          }
          type="date"
          value={endDate}
        />
      </label>
    </div>
  );
}

function SummaryCards({
  statistics,
}: {
  statistics: ReturnType<typeof operationsStatistics>;
}) {
  return (
    <section className="insight-kpi-grid">
      <article>
        <span>Brüt gelir</span>
        <strong>{money(statistics.income)}</strong>
        <small>{statistics.transactionCount} hareket incelendi</small>
      </article>
      <article>
        <span>Belgeli gider</span>
        <strong>{money(statistics.documentedExpense)}</strong>
        <small>POS komisyonu dâhil</small>
      </article>
      <article className="warning">
        <span>Belgesiz çıkış</span>
        <strong>{money(statistics.undocumentedOutflow)}</strong>
        <small>Kasayı azaltır; gider hesabına girmez</small>
      </article>
      <article>
        <span>Belge kapsama oranı</span>
        <strong>{percent(statistics.documentCoverage)}</strong>
        <small>
          {statistics.documentedExpenseCount}/{statistics.directExpenseCount}{" "}
          doğrudan gider belgeli
        </small>
      </article>
    </section>
  );
}

function ConsumablesTable({
  rows,
}: {
  rows: ReturnType<typeof consumableUsageStatistics>;
}) {
  return (
    <div className="table-wrap">
      <table className="report-table consumables-table">
        <thead>
          <tr>
            <th>Ürün</th>
            <th className="numeric">Alınan paket</th>
            <th className="numeric">Alınan birim</th>
            <th className="numeric">Kullanılan</th>
            <th className="numeric">Fire</th>
            <th className="numeric">Mevcut</th>
            <th className="numeric">Toplam harcama</th>
            <th className="numeric">Ort. birim maliyet</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId}>
              <td>
                <strong>{row.name}</strong>
                <small>
                  1 {row.purchaseUnit} = {NUMBER.format(row.unitsPerPackage)}{" "}
                  {row.unit}
                </small>
              </td>
              <td className="numeric">
                {NUMBER.format(row.purchasedPackages)} {row.purchaseUnit}
              </td>
              <td className="numeric">
                {NUMBER.format(row.purchasedUnits)} {row.unit}
              </td>
              <td className="numeric">
                {NUMBER.format(row.usedUnits)} {row.unit}
              </td>
              <td className="numeric">
                {NUMBER.format(row.wastedUnits)} {row.unit}
              </td>
              <td className="numeric">
                {NUMBER.format(row.remainingUnits)} {row.unit}
              </td>
              <td className="numeric">{money(row.spent)}</td>
              <td className="numeric">
                {row.averageUnitCost === null
                  ? "—"
                  : `${money(row.averageUnitCost)} / ${row.unit}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <div className="empty-state">Bu dönemde stok hareketi yok.</div>
      ) : null}
    </div>
  );
}

export function InsightsView({
  transactions,
  items,
  movements,
  today,
  targetPosRate,
}: ReportingProps) {
  const initial = periodForPreset("year", today);
  const [period, setPeriod] = useState(initial);
  const statistics = useMemo(
    () =>
      operationsStatistics({
        transactions,
        startDate: period.startDate,
        endDate: period.endDate,
      }),
    [transactions, period],
  );
  const consumables = useMemo(
    () =>
      consumableUsageStatistics({
        items,
        movements,
        startDate: period.startDate,
        endDate: period.endDate,
      }),
    [items, movements, period],
  );
  const stock = inventorySummary(items, today);
  const cash = dailyOperationsSummary({
    transactions,
    date: today,
    openingCash: 0,
    countedCash: null,
  });
  const actions = buildActionItems({
    statistics,
    inventory: stock,
    cashDifference: cash.cashDifference,
    targetPosRate,
  });
  const maxExpense = Math.max(
    1,
    ...statistics.expenseByCategory.map((row) => row.amount),
  );
  const maxDaily = Math.max(
    1,
    ...statistics.daily.flatMap((row) => [
      row.income,
      row.expense,
      row.undocumented,
    ]),
  );

  return (
    <div className="insights-view">
      <PeriodControls
        {...period}
        today={today}
        onChange={setPeriod}
      />
      <SummaryCards statistics={statistics} />

      <section className="insight-grid">
        <article className="panel pos-insight">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Görünmez maliyet</span>
              <h2>POS verimliliği</h2>
            </div>
          </div>
          <dl className="report-metrics">
            <div>
              <dt>Kart cirosu</dt>
              <dd>{money(statistics.cardIncome)}</dd>
            </div>
            <div>
              <dt>Otomatik komisyon gideri</dt>
              <dd>{money(statistics.posCommission)}</dd>
            </div>
            <div>
              <dt>Gerçekleşen efektif oran</dt>
              <dd>{percent(statistics.effectivePosRate)}</dd>
            </div>
            <div>
              <dt>Yönetim hedefi</dt>
              <dd>{percent(targetPosRate)}</dd>
            </div>
          </dl>
        </article>

        <article className="panel category-insight">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Pareto görünümü</span>
              <h2>Gider kalemleri</h2>
            </div>
          </div>
          <div className="metric-bars">
            {statistics.expenseByCategory.map((row) => (
              <div className="metric-bar-row" key={row.category}>
                <div>
                  <span>{row.category}</span>
                  <strong>{money(row.amount)}</strong>
                </div>
                <span className="metric-track">
                  <i style={{ width: `${(row.amount / maxExpense) * 100}%` }} />
                </span>
                <small>{percent(row.share)} pay</small>
              </div>
            ))}
            {statistics.expenseByCategory.length === 0 ? (
              <div className="empty-state">Belgeli gider bulunmuyor.</div>
            ) : null}
          </div>
        </article>
      </section>

      <article className="panel trend-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Zaman serisi</span>
            <h2>Günlük gelir, gider ve belgesiz çıkış</h2>
          </div>
        </div>
        <div className="daily-trend">
          {statistics.daily.map((row) => (
            <div className="daily-trend-row" key={row.date}>
              <time>{dateLabel(row.date)}</time>
              <div>
                <span className="trend-income">
                  <i style={{ width: `${(row.income / maxDaily) * 100}%` }} />
                  <b>Gelir {money(row.income)}</b>
                </span>
                <span className="trend-expense">
                  <i style={{ width: `${(row.expense / maxDaily) * 100}%` }} />
                  <b>Gider {money(row.expense)}</b>
                </span>
                {row.undocumented > 0 ? (
                  <span className="trend-undocumented">
                    <i
                      style={{
                        width: `${(row.undocumented / maxDaily) * 100}%`,
                      }}
                    />
                    <b>Belgesiz {money(row.undocumented)}</b>
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel consumables-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Para getiren işlem adımları</span>
            <h2>Gelir sürücüleri ve bağlı giderler</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>İşlem adımı</th>
                <th className="numeric">İşlem sayısı</th>
                <th className="numeric">Gelir</th>
                <th className="numeric">Bağlı doğrudan gider</th>
                <th className="numeric">Brüt katkı</th>
                <th className="numeric">Katkı oranı</th>
              </tr>
            </thead>
            <tbody>
              {statistics.revenueDrivers.map((driver) => (
                <tr key={`${driver.operationType}-${driver.category}`}>
                  <td>
                    <strong>{driver.category}</strong>
                    <small>
                      {driver.operationType === "product_sale"
                        ? "Ürün / mama satışı"
                        : driver.operationType === "service"
                          ? "Klinik hizmet"
                          : "Diğer gelir"}
                    </small>
                  </td>
                  <td className="numeric">{driver.transactionCount}</td>
                  <td className="numeric">{money(driver.revenue)}</td>
                  <td className="numeric">{money(driver.directCost)}</td>
                  <td className="numeric">{money(driver.contribution)}</td>
                  <td className="numeric">
                    {percent(driver.contributionRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel action-center">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Yönetim disiplini</span>
            <h2>İstatistikten üretilen aksiyonlar</h2>
          </div>
        </div>
        <div className="action-list">
          {actions.map((item, index) => (
            <article
              className={`action-item priority-${item.priority}`}
              key={`${item.title}-${index}`}
            >
              <span>{item.priority === "high" ? "YÜKSEK" : item.priority === "medium" ? "ORTA" : "DÜŞÜK"}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <strong>{item.action}</strong>
              </div>
            </article>
          ))}
        </div>
      </article>

      <article className="panel consumables-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Sarf zekâsı</span>
            <h2>Paket, adet, kullanım ve maliyet istatistiği</h2>
          </div>
        </div>
        <ConsumablesTable rows={consumables} />
      </article>
    </div>
  );
}

export function ReportsView({
  transactions,
  items,
  movements,
  records,
  today,
  targetPosRate,
}: ReportingProps) {
  const initial = periodForPreset("year", today);
  const [draft, setDraft] = useState(initial);
  const [period, setPeriod] = useState(initial);
  const [exportScope, setExportScope] = useState<ExportScope>("all");
  const [exportStatus, setExportStatus] = useState("");
  const exportSelection = useMemo(() => {
    try {
      return {
        data: buildReportExport({
          transactions,
          startDate: draft.startDate,
          endDate: draft.endDate,
          scope: exportScope,
        }),
        error: "",
      };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Dışa aktarım aralığı geçersiz.",
      };
    }
  }, [transactions, draft, exportScope]);
  const statistics = useMemo(
    () =>
      operationsStatistics({
        transactions,
        startDate: period.startDate,
        endDate: period.endDate,
      }),
    [transactions, period],
  );
  const consumables = useMemo(
    () =>
      consumableUsageStatistics({
        items,
        movements,
        startDate: period.startDate,
        endDate: period.endDate,
      }),
    [items, movements, period],
  );
  const ledger = ledgerSummary(records, today);
  const stock = inventorySummary(items, today);
  const dayCash = dailyOperationsSummary({
    transactions,
    date: today,
    openingCash: 0,
    countedCash: null,
  });
  const actions = buildActionItems({
    statistics,
    inventory: stock,
    cashDifference: dayCash.cashDifference,
    targetPosRate,
  });
  const detailedRows = transactions
    .filter(
      (transaction) =>
        transaction.status !== "cancelled" &&
        transaction.date >= period.startDate &&
        transaction.date <= period.endDate,
    )
    .sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
    );

  function applyReportPeriod() {
    setPeriod(draft);
    setExportStatus("");
  }

  function exportExcel() {
    if (!exportSelection.data || exportSelection.data.rows.length === 0) return;
    setPeriod(draft);
    downloadBlob(
      buildXlsx(exportSelection.data),
      buildExportFilename(exportSelection.data, "xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    setExportStatus(
      `${exportSelection.data.rows.length} kayıt Excel olarak indirildi.`,
    );
  }

  function exportCsv() {
    if (!exportSelection.data || exportSelection.data.rows.length === 0) return;
    setPeriod(draft);
    downloadBlob(
      buildCsv(exportSelection.data),
      buildExportFilename(exportSelection.data, "csv"),
      "text/csv;charset=utf-8",
    );
    setExportStatus(
      `${exportSelection.data.rows.length} kayıt CSV olarak indirildi.`,
    );
  }

  function printReport() {
    setPeriod(draft);
    setExportStatus("Tam yönetim raporu yazdırmaya hazırlandı.");
    printAfterRender();
  }

  const exportSummary = exportSelection.data?.summary;
  const exportDisabled =
    !exportSelection.data || exportSelection.data.rows.length === 0;

  return (
    <div className="reports-view">
      <section className="panel report-builder no-print">
        <div>
          <span className="eyebrow">Dönem seçimi</span>
          <h2>Yönetim raporu oluştur</h2>
          <p>
            Rapor, seçilen dönemin özetini ve denetlenebilir hareket dökümünü
            birlikte üretir.
          </p>
        </div>
        <PeriodControls
          {...draft}
          today={today}
          onChange={setDraft}
        />
        <div className="report-actions">
          <button
            className="primary-button"
            onClick={applyReportPeriod}
            type="button"
          >
            Raporla
          </button>
          <button
            className="secondary-button"
            onClick={printReport}
            type="button"
          >
            Yazdır / PDF
          </button>
        </div>
        <div className="report-export-strip">
          <div className="report-export-choice">
            <span className="eyebrow">İndirilecek kayıtlar</span>
            <label>
              Kapsam
              <select
                onChange={(event) => {
                  setExportScope(event.target.value as ExportScope);
                  setExportStatus("");
                }}
                value={exportScope}
              >
                <option value="all">Tüm gelir, gider ve kasa çıkışları</option>
                <option value="income">Yalnız gelirler</option>
                <option value="outflows">
                  Giderler, belgesiz çıkışlar ve kasa çekimleri
                </option>
              </select>
            </label>
          </div>
          <div className="report-export-summary" aria-live="polite">
            {exportSelection.error ? (
              <strong className="export-error">{exportSelection.error}</strong>
            ) : (
              <>
                <span>
                  <strong>{exportSummary?.rowCount ?? 0}</strong> kayıt
                </span>
                <span>
                  Gelir <strong>{money(exportSummary?.income ?? 0)}</strong>
                </span>
                <span>
                  Belgeli gider{" "}
                  <strong>
                    {money(exportSummary?.documentedExpense ?? 0)}
                  </strong>
                </span>
                <span>
                  Belgesiz çıkış{" "}
                  <strong>
                    {money(exportSummary?.undocumentedOutflow ?? 0)}
                  </strong>
                </span>
              </>
            )}
          </div>
          <div className="report-download-actions">
            <button
              className="primary-button"
              disabled={exportDisabled}
              onClick={exportExcel}
              type="button"
            >
              Excel indir
            </button>
            <button
              className="secondary-button"
              disabled={exportDisabled}
              onClick={exportCsv}
              type="button"
            >
              CSV indir
            </button>
          </div>
          <p className="report-export-note">
            Excel dosyasında özet, tüm hareketler, gelirler ve giderler ayrı
            sayfalarda açılır. Yazdır / PDF düğmesi tam yönetim raporunu
            hazırlar.
          </p>
          {exportStatus ? (
            <p className="report-export-status" role="status">
              {exportStatus}
            </p>
          ) : null}
        </div>
      </section>

      <article className="print-report" id="management-report">
        <header className="print-report-head">
          <div>
            <span>ELÇİ VETERİNER KLİNİĞİ</span>
            <h2>Finansal ve Operasyonel Yönetim Raporu</h2>
            <p>
              {dateLabel(period.startDate)} – {dateLabel(period.endDate)}
            </p>
          </div>
          <div className="report-stamp">
            <strong>YÖNETİM RAPORU</strong>
            <span>Kontrol tarihi: {dateLabel(today)}</span>
          </div>
        </header>

        <section className="report-section">
          <h3>1. Yönetici özeti</h3>
          <SummaryCards statistics={statistics} />
          <div className="executive-notes">
            <p>
              <strong>Operasyon farkı:</strong>{" "}
              {money(statistics.operatingBalance)}. Bu tutar vergi sonrası net
              kâr değildir; tahakkuklar, stok maliyeti, amortisman ve kurumlar
              vergisi kapanışı ayrıca değerlendirilmelidir.
            </p>
            <p>
              <strong>Nakit hareketi:</strong>{" "}
              {money(statistics.cashMovement)}. Kasadan çekimler ve belgesiz
              çıkışlar bu göstergede dâhildir.
            </p>
          </div>
        </section>

        <section className="report-section report-columns">
          <div>
            <h3>2. KDV kontrol görünümü</h3>
            <dl className="report-metrics">
              <div>
                <dt>Hesaplanan satış KDV’si</dt>
                <dd>{money(statistics.outputVat)}</dd>
              </div>
              <div>
                <dt>Belgeli indirilecek KDV</dt>
                <dd>{money(statistics.deductibleInputVat)}</dd>
              </div>
              <div>
                <dt>Ön pozisyon</dt>
                <dd>{money(statistics.preliminaryVatPosition)}</dd>
              </div>
            </dl>
            <p className="report-disclaimer">
              Devreden KDV, istisna, iade ve mali müşavir düzeltmeleri
              işlenmeden bu rakam beyan tutarı sayılmaz.
            </p>
          </div>
          <div>
            <h3>3. POS ve ödeme kanalları</h3>
            <dl className="report-metrics">
              <div>
                <dt>Kart cirosu</dt>
                <dd>{money(statistics.cardIncome)}</dd>
              </div>
              <div>
                <dt>POS komisyon gideri</dt>
                <dd>{money(statistics.posCommission)}</dd>
              </div>
              <div>
                <dt>Efektif oran / hedef</dt>
                <dd>
                  {percent(statistics.effectivePosRate)} /{" "}
                  {percent(targetPosRate)}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="report-section">
          <h3>4. Gelir sürücüleri ve bağlı gider katkısı</h3>
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Gelir üreten işlem</th>
                  <th className="numeric">İşlem</th>
                  <th className="numeric">Gelir</th>
                  <th className="numeric">Bağlı gider</th>
                  <th className="numeric">Katkı</th>
                  <th className="numeric">Katkı oranı</th>
                </tr>
              </thead>
              <tbody>
                {statistics.revenueDrivers.map((driver) => (
                  <tr key={`${driver.operationType}-${driver.category}`}>
                    <td>{driver.category}</td>
                    <td className="numeric">{driver.transactionCount}</td>
                    <td className="numeric">{money(driver.revenue)}</td>
                    <td className="numeric">{money(driver.directCost)}</td>
                    <td className="numeric">{money(driver.contribution)}</td>
                    <td className="numeric">
                      {percent(driver.contributionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="report-disclaimer">
            Bu katkı görünümü seçilen gelire bağlanan giderleri ve otomatik POS
            komisyonunu düşer. Ortak stok tüketimi ve sabit giderler işlem
            bazında dağıtılmadıkça katkıya dâhil edilmez.
          </p>
        </section>

        <section className="report-section report-columns">
          <div>
            <h3>5. Alacak görünümü</h3>
            <dl className="report-metrics">
              <div>
                <dt>Kalan alacak</dt>
                <dd>{money(ledger.receivable.remaining)}</dd>
              </div>
              <div>
                <dt>Gecikmiş alacak</dt>
                <dd>{money(ledger.receivable.overdue)}</dd>
              </div>
              <div>
                <dt>Tahsil edilen</dt>
                <dd>{money(ledger.receivable.paid)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3>6. Borç ve rezerv görünümü</h3>
            <dl className="report-metrics">
              <div>
                <dt>Kalan borç</dt>
                <dd>{money(ledger.payable.remaining)}</dd>
              </div>
              <div>
                <dt>Gecikmiş borç</dt>
                <dd>{money(ledger.payable.overdue)}</dd>
              </div>
              <div>
                <dt>Ödenen</dt>
                <dd>{money(ledger.payable.paid)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="report-section">
          <h3>7. Gider dağılımı</h3>
          <div className="table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Gider kalemi</th>
                  <th className="numeric">Tutar</th>
                  <th className="numeric">Belgeli gider içindeki payı</th>
                </tr>
              </thead>
              <tbody>
                {statistics.expenseByCategory.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td className="numeric">{money(row.amount)}</td>
                    <td className="numeric">{percent(row.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-section">
          <h3>8. Stok ve sarf tüketim raporu</h3>
          <ConsumablesTable rows={consumables} />
        </section>

        <section className="report-section">
          <h3>9. Gelir-gider hareket dökümü</h3>
          <div className="table-wrap">
            <table className="report-table transaction-report-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tür</th>
                  <th>Kimden / kime</th>
                  <th>Kalem / açıklama</th>
                  <th>Kanal</th>
                  <th>Belge</th>
                  <th className="numeric">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {detailedRows.map((transaction) => {
                  const undocumented =
                    transaction.kind === "expense" &&
                    !isRecognizedExpense(transaction);
                  return (
                    <tr
                      className={undocumented ? "undocumented-row" : ""}
                      key={transaction.id}
                    >
                      <td>
                        {transaction.date} · {transaction.time}
                      </td>
                      <td>
                        {transaction.isAutomatic
                          ? "Otomatik POS"
                          : undocumented
                            ? "Belgesiz çıkış"
                            : transaction.kind === "income"
                              ? "Gelir"
                              : transaction.kind === "expense"
                                ? "Gider"
                                : "Kasa çekimi"}
                      </td>
                      <td>{transaction.counterparty || "Belirtilmedi"}</td>
                      <td>
                        <strong>{transaction.category}</strong>
                        <small>{transaction.description}</small>
                      </td>
                      <td>
                        {transaction.paymentMethod === "cash"
                          ? "Nakit"
                          : transaction.paymentMethod === "card"
                            ? "Kart / POS"
                            : "Havale"}
                      </td>
                      <td>{transaction.documentRef || "Belgesiz"}</td>
                      <td className="numeric">{money(transaction.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-section">
          <h3>10. Yönetim aksiyonları</h3>
          <ol className="print-actions">
            {actions.map((item, index) => (
              <li key={`${item.title}-${index}`}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                <p>{item.action}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="print-report-foot">
          <span>
            Belgesiz çıkışlar gider ve indirilecek KDV hesabına alınmamıştır.
          </span>
          <span>Elçi Klinik Yönetim · Denetlenebilir ön rapor</span>
        </footer>
      </article>
    </div>
  );
}
