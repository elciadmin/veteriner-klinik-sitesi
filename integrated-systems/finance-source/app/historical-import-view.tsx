"use client";

import { useMemo, useState } from "react";

import {
  historicalImportSummary,
  validateHistoricalImportPackage,
} from "@/lib/historical-import.mjs";
import type { ClinicTransaction } from "./operational-modules";
import type { RecurringExpenseRule } from "./recurring-expenses-view";

type LedgerRecordRef = { id: string };

type HistoricalPackage = {
  schemaVersion: number;
  importId: string;
  source: { fileName: string; sha256: string; generatedAt: string };
  summary: {
    dailyRows: number;
    incomeTransactions: number;
    zeroIncomeDaysSkipped: number;
    incomeTotal: number;
    incomeDateFrom: string;
    incomeDateTo: string;
    recurringDrafts: number;
    debtOriginalAmount: number;
    debtPaymentsTotal: number;
    debtRemaining: number;
    debtPaymentCount: number;
  };
  warnings: string[];
  transactions: ClinicTransaction[];
  recurringRules: RecurringExpenseRule[];
  ledgerPackage: {
    record: Record<string, unknown> & { id: string };
    payments: Array<Record<string, unknown>>;
  };
};

type ImportResult = {
  ok?: boolean;
  error?: string;
  inserted?: {
    transactions: number;
    recurringRules: number;
    ledgerRecords: number;
    ledgerPayments: number;
  };
  skipped?: {
    transactions: number;
    recurringRules: number;
    ledgerRecords: number;
    ledgerPayments: number;
  };
};

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return DATE.format(new Date(`${value}T00:00:00Z`));
}

export function HistoricalImportView({
  canWrite,
  transactions,
  recurringRules,
  records,
}: {
  canWrite: boolean;
  transactions: ClinicTransaction[];
  recurringRules: RecurringExpenseRule[];
  records: LedgerRecordRef[];
}) {
  const [data, setData] = useState<HistoricalPackage | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function selectPackage(file: File | undefined) {
    setError("");
    setResult(null);
    setConfirmed(false);
    setData(null);
    if (!file) return;

    try {
      if (file.size > 12 * 1024 * 1024) {
        throw new Error("Aktarım dosyası 12 MB güvenlik sınırını aşıyor.");
      }
      if (!file.name.toLocaleLowerCase("tr-TR").endsWith(".json")) {
        throw new Error("Hazırlanmış aktarım dosyası JSON biçiminde olmalıdır.");
      }

      const payload = JSON.parse(await file.text()) as HistoricalPackage;
      validateHistoricalImportPackage(payload);
      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Aktarım paketi yüklenemedi.",
      );
    }
  }

  const imported = useMemo(() => {
    if (!data) return { transactions: 0, recurringRules: 0, debt: false };
    return {
      transactions: transactions.filter(
        (row) => row.sourceModule === "historical_excel_import",
      ).length,
      recurringRules: recurringRules.filter((row) =>
        row.id.startsWith("hist-elci-rule-"),
      ).length,
      debt: records.some((row) => row.id === data.ledgerPackage.record.id),
    };
  }, [data, records, recurringRules, transactions]);

  const complete = Boolean(
    data &&
      imported.transactions >= data.summary.incomeTransactions &&
      imported.recurringRules >= data.summary.recurringDrafts &&
      imported.debt,
  );

  async function startImport() {
    if (!data || !confirmed || !canWrite || saving) return;
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/clinic-data", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": `historical-import-${Date.now()}`,
        },
        body: JSON.stringify({
          action: "importHistoricalData",
          package: data,
        }),
      });
      const payload = (await response.json()) as ImportResult;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Geçmiş veri aktarımı tamamlanamadı.");
      }
      setResult(payload);
      window.setTimeout(() => window.location.reload(), 1800);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Geçmiş veri aktarımı tamamlanamadı.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <section className="import-panel import-upload-panel">
        <span className="eyebrow">Özel ve yerel aktarım</span>
        <h2>Hazırlanmış geçmiş veri dosyasını seç</h2>
        <p>
          Finans verileri güvenlik nedeniyle GitHub deposuna veya uygulama
          paketine eklenmez. Dosya yalnızca bu tarayıcıda okunur; aktarımı
          onaylayana kadar sunucuya gönderilmez.
        </p>
        <label className="import-file-picker">
          <strong>Özel aktarım JSON dosyası</strong>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void selectPackage(event.target.files?.[0])}
          />
          <small>Yalnızca V5.14 tarafından hazırlanmış doğrulanmış JSON paketini seç.</small>
        </label>
        {error ? <p className="import-message error">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="historical-import-stack">
      <section className="import-panel import-hero">
        <div>
          <span className="eyebrow">Hazırlanmış Excel geçişi</span>
          <h2>Geçmiş verileri tek işlemle aktar</h2>
          <p>
            {data.source.fileName} dosyası satır satır kontrol edilip güvenli
            aktarım paketine çevrildi. Aynı paket ikinci kez çalıştırılırsa
            mevcut kayıtlar çoğaltılmaz.
          </p>
        </div>
        <div className={`import-status ${complete ? "complete" : "ready"}`}>
          <strong>{complete ? "Aktarım tamamlandı" : "Aktarıma hazır"}</strong>
          <span>
            {imported.transactions}/{data.summary.incomeTransactions} gelir · {" "}
            {imported.recurringRules}/{data.summary.recurringDrafts} gider taslağı
          </span>
        </div>
      </section>

      <section className="import-kpi-grid">
        <article><small>Geçmiş günlük ciro</small><strong>{TRY.format(data.summary.incomeTotal)}</strong><span>{data.summary.incomeTransactions} pozitif gün</span></article>
        <article><small>Tarih aralığı</small><strong>{formatDate(data.summary.incomeDateFrom)}</strong><span>{formatDate(data.summary.incomeDateTo)} tarihine kadar</span></article>
        <article><small>Sabit gider taslağı</small><strong>{data.summary.recurringDrafts}</strong><span>Pasif gelir; kontrol edilmeden çalışmaz</span></article>
        <article><small>Yasin Abim kalan borç</small><strong>{TRY.format(data.summary.debtRemaining)}</strong><span>{data.summary.debtPaymentCount} geçmiş ödeme işlendi</span></article>
      </section>

      <section className="import-panel">
        <h3>Aktarım kuralları</h3>
        <ul className="import-warning-list">
          {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
        <div className="import-integrity">
          <span>Kaynak SHA-256</span>
          <code>{data.source.sha256}</code>
        </div>
      </section>

      <section className="import-panel import-action-panel">
        <label className="import-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={complete || !canWrite}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>
            Gelirlerin ödeme kanalı bilinmediği için kasa/POS/banka bakiyesine
            dokunmadan ekonomik geçmiş olarak kaydedileceğini onaylıyorum.
          </span>
        </label>
        {error ? <p className="import-message error">{error}</p> : null}
        {result?.ok ? (
          <p className="import-message success">
            Aktarım tamamlandı. {result.inserted?.transactions ?? 0} gelir,
            {" "}{result.inserted?.recurringRules ?? 0} gider taslağı ve borç
            geçmişi işlendi. Ekran yenileniyor…
          </p>
        ) : null}
        <button
          className="primary-button import-button"
          type="button"
          disabled={!confirmed || !canWrite || saving || complete}
          onClick={startImport}
        >
          {complete
            ? "Geçmiş veriler aktarılmış"
            : saving
              ? "Aktarım yapılıyor…"
              : "Güvenli aktarımı başlat"}
        </button>
        {!canWrite ? <small>Bu işlem yalnızca finans editörü tarafından yapılabilir.</small> : null}
      </section>
    </div>
  );
}
