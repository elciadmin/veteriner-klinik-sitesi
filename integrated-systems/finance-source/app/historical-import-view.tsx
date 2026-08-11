"use client";

import { useMemo, useState } from "react";
import { postFinanceJson } from "./finance-request";

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
    record?: (Record<string, unknown> & { id: string }) | null;
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
  batches,
  canWrite,
  onRollback,
  transactions,
  recurringRules,
  records,
}: {
  batches: ImportBatch[];
  canWrite: boolean;
  onRollback: (batchId: string, reason: string) => Promise<boolean> | boolean;
  transactions: ClinicTransaction[];
  recurringRules: RecurringExpenseRule[];
  records: LedgerRecordRef[];
}) {
  const [data, setData] = useState<HistoricalPackage | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");

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
      debt: data.ledgerPackage.record
        ? records.some((row) => row.id === data.ledgerPackage.record?.id)
        : true,
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
      const response = await postFinanceJson("/api/clinic-data", {
        action: "importHistoricalData",
        package: data,
      }, `cmd-historical-import-${data.importId}-${Date.now()}`);
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

  async function rollbackBatch() {
    if (!rollbackTarget || rollbackReason.trim().length < 5 || saving) return;
    setSaving(true);
    setError("");
    const done = await onRollback(rollbackTarget, rollbackReason.trim());
    if (!done) setError("Aktarım geri alınamadı. Sonradan bağlanmış kayıtlar olabilir.");
    setSaving(false);
  }

  const batchHistory = batches.length ? (
    <section className="import-panel import-batch-history">
      <div className="panel-head compact"><div><span className="eyebrow">Aktarım denetimi</span><h3>Geçmiş veri paketleri</h3><p>Eksik geçmiş veri raporda görünür; kapsamı ve uyarıları her zaman korunur.</p></div></div>
      <div className="table-wrap"><table className="ledger-table"><thead><tr><th>Paket</th><th>Kapsam</th><th>Veri tamlığı</th><th>Durum</th><th /></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td><strong>{batch.sourceFileName}</strong><small className="document-ref">{batch.id}</small></td><td>{batch.coverageStartDate || "—"} → {batch.coverageEndDate || "—"}</td><td>{(batch.completenessBps / 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}%<small className="document-ref">{batch.warnings[0] || "Kapsam uyarısı yok"}</small></td><td><strong>{batch.status === "applied" ? "Aktif" : batch.status === "rolled_back" ? "Geri alındı" : batch.status}</strong></td><td>{batch.status === "applied" && canWrite ? <button className="text-button" onClick={() => { setRollbackTarget(batch.id); setRollbackReason(""); }} type="button">Geri al</button> : null}</td></tr>)}</tbody></table></div>
      {rollbackTarget ? <div className="import-rollback"><strong>Bu aktarım paketini geri al</strong><p>Yalnız sonradan bağımsız ödeme/işlem bağlanmamışsa geri alınır. Gerekçe denetim kaydına yazılır.</p><input autoFocus onChange={(event) => setRollbackReason(event.target.value)} placeholder="Geri alma gerekçesi" value={rollbackReason} /><div><button className="secondary-button" onClick={() => setRollbackTarget(null)} type="button">Vazgeç</button><button className="danger-button" disabled={saving || rollbackReason.trim().length < 5} onClick={() => void rollbackBatch()} type="button">Paketi geri al</button></div></div> : null}
    </section>
  ) : null;

  if (!data) {
    return (
      <div className="historical-import-stack">
        {batchHistory}
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
      </div>
    );
  }

  return (
    <div className="historical-import-stack">
      {batchHistory}
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
        {data.ledgerPackage.record ? (
          <article><small>Geçmiş borç bakiyesi</small><strong>{TRY.format(data.summary.debtRemaining)}</strong><span>{data.summary.debtPaymentCount} geçmiş ödeme işlendi</span></article>
        ) : (
          <article><small>Borç/alacak verisi</small><strong>Yok</strong><span>Bu paket yalnız gelir verisi içeriyor</span></article>
        )}
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
