"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  assessMonthlyClose,
  calculateMonthlyClose,
  channelReconciliation,
  resolveOpeningBalances,
} from "@/lib/monthly-close.mjs";
import type { ClinicTransaction } from "./operational-modules";

export type MonthlyClosingStatus =
  | "open"
  | "closed"
  | "closed_with_variance";

export type MonthlyClosing = {
  period: string;
  status: MonthlyClosingStatus;
  openingCash: number;
  openingBank: number;
  expectedCash: number;
  expectedBank: number;
  expectedPosPending: number;
  actualCash: number;
  actualBank: number;
  actualPosPending: number;
  cashDifference: number;
  bankDifference: number;
  posDifference: number;
  income: number;
  recognizedExpense: number;
  undocumentedOutflow: number;
  withdrawals: number;
  posSettlements: number;
  dataQualityFlags: string[];
  varianceNote: string;
  closedAt?: string;
  reopenedAt?: string;
  reopenReason: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyCloseEvent = {
  id: string;
  period: string;
  action: "closed" | "reopened";
  snapshot: Partial<MonthlyClosing>;
  reason: string;
  createdAt: string;
};

export type MonthlyCloseInput = {
  period: string;
  openingCash?: number;
  openingBank?: number;
  actualCash: number;
  actualBank: number;
  actualPosPending: number;
  varianceNote?: string;
};

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONTH = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const flagLabels: Record<string, string> = {
  settled_pos_missing_date:
    "Yattı işaretli bir POS kaydında yatış tarihi eksik.",
  card_expense_assumed_bank:
    "Kartla yapılan gider banka çıkışı kabul edildi; kredi kartıysa ayrıca kontrol edin.",
};

function formatMoney(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : TRY.format(value);
}

function monthLabel(period: string) {
  return MONTH.format(new Date(`${period}-01T00:00:00Z`));
}

function inputAmount(value: string) {
  if (value.trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(0, Math.ceil((end - start) / 86_400_000));
}

function differenceCopy(status: string, difference: number | null) {
  if (status === "missing") return "Fiili tutar bekleniyor";
  if (status === "balanced") return "Eşleşiyor";
  if (difference !== null && difference < 0) return "Eksik bakiye";
  return "Fazla bakiye";
}

function ReconciliationCard({
  title,
  expected,
  actual,
}: {
  title: string;
  expected: number | null;
  actual: number | null;
}) {
  const result = channelReconciliation(expected, actual);
  return (
    <article className={`month-close-channel is-${result.status}`}>
      <div className="month-close-channel-head">
        <span>{title}</span>
        <b>{differenceCopy(result.status, result.difference)}</b>
      </div>
      <dl>
        <div>
          <dt>Sisteme göre</dt>
          <dd>{formatMoney(result.expected)}</dd>
        </div>
        <div>
          <dt>Fiili</dt>
          <dd>{formatMoney(result.actual)}</dd>
        </div>
        <div className="month-close-difference">
          <dt>Fark</dt>
          <dd>
            {result.difference === null
              ? "—"
              : `${result.difference > 0 ? "+" : ""}${formatMoney(
                  result.difference,
                )}`}
          </dd>
        </div>
      </dl>
      <small>
        Kabul sınırı:{" "}
        {result.tolerance === null ? "hesaplanamadı" : formatMoney(result.tolerance)}
      </small>
    </article>
  );
}

export function MonthlyCloseView({
  transactions,
  closings,
  events,
  today,
  onClose,
  onReopen,
}: {
  transactions: ClinicTransaction[];
  closings: MonthlyClosing[];
  events: MonthlyCloseEvent[];
  today: string;
  onClose: (input: MonthlyCloseInput) => Promise<boolean>;
  onReopen: (period: string, reason: string) => Promise<boolean>;
}) {
  const periods = useMemo(() => {
    const values = new Set<string>([
      today.slice(0, 7),
      ...closings.map((closing) => closing.period),
      ...transactions
        .map((transaction) => transaction.date.slice(0, 7))
        .filter((period) => /^\d{4}-\d{2}$/.test(period)),
    ]);
    return [...values].sort().reverse();
  }, [closings, today, transactions]);
  const [period, setPeriod] = useState(today.slice(0, 7));
  const existing = closings.find((closing) => closing.period === period);
  const sourceKey = `${period}:${existing?.updatedAt ?? "new"}`;
  const [formSourceKey, setFormSourceKey] = useState(sourceKey);
  const [openingCash, setOpeningCash] = useState(
    existing ? String(existing.openingCash) : "",
  );
  const [openingBank, setOpeningBank] = useState(
    existing ? String(existing.openingBank) : "",
  );
  const [actualCash, setActualCash] = useState(
    existing ? String(existing.actualCash) : "",
  );
  const [actualBank, setActualBank] = useState(
    existing ? String(existing.actualBank) : "",
  );
  const [actualPos, setActualPos] = useState(
    existing ? String(existing.actualPosPending) : "",
  );
  const [varianceNote, setVarianceNote] = useState(
    existing?.varianceNote ?? "",
  );
  const [reopenReason, setReopenReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  if (formSourceKey !== sourceKey) {
    setFormSourceKey(sourceKey);
    setOpeningCash(existing ? String(existing.openingCash) : "");
    setOpeningBank(existing ? String(existing.openingBank) : "");
    setActualCash(existing ? String(existing.actualCash) : "");
    setActualBank(existing ? String(existing.actualBank) : "");
    setActualPos(existing ? String(existing.actualPosPending) : "");
    setVarianceNote(existing?.varianceNote ?? "");
    setReopenReason("");
    setFeedback("");
  }

  const isLocked =
    existing?.status === "closed" ||
    existing?.status === "closed_with_variance";

  const opening = resolveOpeningBalances({
    period,
    closings,
    openingCash: inputAmount(openingCash),
    openingBank: inputAmount(openingBank),
  });
  const liveSummary = calculateMonthlyClose({
    period,
    transactions,
    openingCash: opening.openingCash,
    openingBank: opening.openingBank,
  });
  const summary =
    isLocked && existing
      ? {
          ...liveSummary,
          openingCash: existing.openingCash,
          openingBank: existing.openingBank,
          expectedCash: existing.expectedCash,
          expectedBank: existing.expectedBank,
          expectedPosPending: existing.expectedPosPending,
          income: existing.income,
          recognizedExpense: existing.recognizedExpense,
          undocumentedOutflow: existing.undocumentedOutflow,
          withdrawals: existing.withdrawals,
          posSettlements: existing.posSettlements,
          dataQualityFlags: existing.dataQualityFlags,
        }
      : liveSummary;
  const actuals = {
    cash: isLocked && existing ? existing.actualCash : inputAmount(actualCash),
    bank: isLocked && existing ? existing.actualBank : inputAmount(actualBank),
    pos:
      isLocked && existing
        ? existing.actualPosPending
        : inputAmount(actualPos),
  };
  const decision = assessMonthlyClose({
    summary,
    actualCash: actuals.cash,
    actualBank: actuals.bank,
    actualPosPending: actuals.pos,
    today,
    varianceNote,
  });
  const periodFinished = summary.periodEnd <= today;
  const remainingDays = daysBetween(today, summary.periodEnd);
  const selectedEvents = events
    .filter((event) => event.period === period)
    .slice(0, 6);

  async function submitClose(event: FormEvent) {
    event.preventDefault();
    if (
      !decision.canClose ||
      actuals.cash === null ||
      actuals.bank === null ||
      actuals.pos === null
    ) {
      setFeedback("Eksik alanları ve kapanış uyarılarını tamamlayın.");
      return;
    }
    setSaving(true);
    setFeedback("");
    const saved = await onClose({
      period,
      openingCash: opening.openingCash ?? undefined,
      openingBank: opening.openingBank ?? undefined,
      actualCash: actuals.cash,
      actualBank: actuals.bank,
      actualPosPending: actuals.pos,
      varianceNote: varianceNote.trim(),
    });
    setSaving(false);
    setFeedback(
      saved
        ? "Ay kapatıldı; bu dönemin finansal kayıtları kilitlendi."
        : "Kapanış kaydedilemedi. Üstteki sistem uyarısını kontrol edin.",
    );
  }

  async function submitReopen(event: FormEvent) {
    event.preventDefault();
    if (reopenReason.trim().length < 5) {
      setFeedback("Yeniden açma gerekçesi en az 5 karakter olmalı.");
      return;
    }
    setSaving(true);
    setFeedback("");
    const reopened = await onReopen(period, reopenReason.trim());
    setSaving(false);
    setFeedback(
      reopened
        ? "Dönem yeniden açıldı. Düzeltmeden sonra tekrar kapatın."
        : "Dönem yeniden açılamadı. Üstteki sistem uyarısını kontrol edin.",
    );
  }

  return (
    <section className="month-close-shell panel">
      <div className="month-close-hero">
        <div>
          <span className="eyebrow">Otomatik ay sonu kapanışı</span>
          <h2>Hesabı sistem yapar; sen yalnız 3 fiili tutarı girersin.</h2>
          <p>
            Kasayı say, internet bankacılığındaki bakiyeyi ve POS ekranındaki
            bekleyen net tutarı yaz. Gelir, gider, belgesiz çıkış, çekim ve POS
            yatışlarını sistem kayıtlarından kendisi uzlaştırır.
          </p>
        </div>
        <label className="month-close-period">
          Kapanış ayı
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {periods.map((item) => (
              <option key={item} value={item}>
                {monthLabel(item)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className={`month-close-state ${
          isLocked
            ? existing?.status === "closed"
              ? "is-closed"
              : "is-warning"
            : periodFinished
              ? "is-ready"
              : "is-preparing"
        }`}
      >
        <strong>
          {isLocked
            ? existing?.status === "closed"
              ? "Dönem kapalı ve kilitli"
              : "Dönem fark açıklamasıyla kapalı"
            : periodFinished
              ? "Kapanışa hazır"
              : `Hazırlık dönemi · ${remainingDays} gün kaldı`}
        </strong>
        <span>
          {isLocked
            ? "Kaynak kayıtlar değiştirilirse önce gerekçeyle yeniden açılmalı."
            : periodFinished
              ? "Üç fiili bakiye tamamlanınca sonucu kilitleyebilirsiniz."
              : "Hesaplar güncel verilerle canlı değişir; ay sonundan önce kilitlenmez."}
        </span>
      </div>

      {!isLocked ? (
        <form onSubmit={submitClose}>
          {opening.source === "previous_close" ? (
            <div className="month-close-carry">
              <span>Otomatik devreden açılış</span>
              <strong>
                Kasa {formatMoney(opening.openingCash)} · Banka{" "}
                {formatMoney(opening.openingBank)}
              </strong>
              <small>{opening.sourcePeriod} kapanışındaki fiili bakiyeler</small>
            </div>
          ) : (
            <div className="month-close-opening">
              <div>
                <strong>Yalnızca ilk kapanışta</strong>
                <span>
                  Önceki ay sistemde olmadığı için ay başı bakiyelerini bir kez
                  girin. Sonraki aylarda otomatik devreder.
                </span>
              </div>
              <label>
                Ay başı nakit
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={openingCash}
                  onChange={(event) => setOpeningCash(event.target.value)}
                  placeholder="0,00"
                />
              </label>
              <label>
                Ay başı banka
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={openingBank}
                  onChange={(event) => setOpeningBank(event.target.value)}
                  placeholder="0,00"
                />
              </label>
            </div>
          )}

          <div className="month-close-actuals">
            <div>
              <span>1</span>
              <label>
                Saydığın nakit kasa
                <input
                  min="0"
                  required
                  step="0.01"
                  type="number"
                  value={actualCash}
                  onChange={(event) => setActualCash(event.target.value)}
                  placeholder="0,00"
                />
              </label>
            </div>
            <div>
              <span>2</span>
              <label>
                Bankadaki fiili bakiye
                <input
                  min="0"
                  required
                  step="0.01"
                  type="number"
                  value={actualBank}
                  onChange={(event) => setActualBank(event.target.value)}
                  placeholder="0,00"
                />
              </label>
            </div>
            <div>
              <span>3</span>
              <label>
                POS’ta bekleyen net
                <input
                  min="0"
                  required
                  step="0.01"
                  type="number"
                  value={actualPos}
                  onChange={(event) => setActualPos(event.target.value)}
                  placeholder="0,00"
                />
              </label>
            </div>
          </div>

          <div className="month-close-channels">
            <ReconciliationCard
              title="Nakit kasa"
              expected={summary.expectedCash}
              actual={actuals.cash}
            />
            <ReconciliationCard
              title="Banka"
              expected={summary.expectedBank}
              actual={actuals.bank}
            />
            <ReconciliationCard
              title="Bekleyen POS"
              expected={summary.expectedPosPending}
              actual={actuals.pos}
            />
          </div>

          <div className="month-close-bridge">
            <div>
              <span>Ay içi gelir</span>
              <strong>{formatMoney(summary.income)}</strong>
            </div>
            <div>
              <span>Belgeli gider</span>
              <strong>{formatMoney(summary.recognizedExpense)}</strong>
            </div>
            <div>
              <span>Belgesiz para çıkışı</span>
              <strong>{formatMoney(summary.undocumentedOutflow)}</strong>
            </div>
            <div>
              <span>İşletmeden çekim</span>
              <strong>{formatMoney(summary.withdrawals)}</strong>
            </div>
            <div>
              <span>Bankaya yatan net POS</span>
              <strong>{formatMoney(summary.posSettlements)}</strong>
            </div>
          </div>

          {summary.dataQualityFlags.length > 0 ? (
            <div className="month-close-warnings" role="alert">
              <strong>Veri kontrolü gerekiyor</strong>
              {summary.dataQualityFlags.map((flag: string) => (
                <span key={flag}>{flagLabels[flag] || flag}</span>
              ))}
            </div>
          ) : null}

          {decision.requiresVarianceNote ? (
            <label className="month-close-note">
              Fark / veri açıklaması *
              <textarea
                required
                value={varianceNote}
                onChange={(event) => setVarianceNote(event.target.value)}
                placeholder="Farkın nedenini veya kontrol edilecek kaydı yazın."
              />
            </label>
          ) : null}

          <div className="month-close-actions">
            <div>
              <strong>
                {decision.hasDifference
                  ? "Fark var: açıklamasız yeşil kapanış yapılmaz."
                  : "Sistem üç kanalı ayrı ayrı kontrol eder."}
              </strong>
              <span>
                Kapanıştan sonra bu aya yeni finansal kayıt girilemez.
              </span>
              {feedback ? <small>{feedback}</small> : null}
            </div>
            <button
              className="primary-button"
              disabled={!decision.canClose || saving}
              type="submit"
            >
              {saving ? "Kapatılıyor…" : `${monthLabel(period)} ayını kapat`}
            </button>
          </div>
        </form>
      ) : existing ? (
        <>
          <div className="month-close-channels">
            <ReconciliationCard
              title="Nakit kasa"
              expected={existing.expectedCash}
              actual={existing.actualCash}
            />
            <ReconciliationCard
              title="Banka"
              expected={existing.expectedBank}
              actual={existing.actualBank}
            />
            <ReconciliationCard
              title="Bekleyen POS"
              expected={existing.expectedPosPending}
              actual={existing.actualPosPending}
            />
          </div>
          <div className="month-close-locked-meta">
            <div>
              <span>Kapanış zamanı</span>
              <strong>
                {existing.closedAt
                  ? DATE_TIME.format(new Date(existing.closedAt))
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Kapanış açıklaması</span>
              <strong>{existing.varianceNote || "Farksız temiz kapanış"}</strong>
            </div>
          </div>
          <form className="month-close-reopen" onSubmit={submitReopen}>
            <label>
              Yeniden açma gerekçesi
              <input
                required
                value={reopenReason}
                onChange={(event) => setReopenReason(event.target.value)}
                placeholder="Örn. 31 Temmuz banka kaydı düzeltilecek"
              />
            </label>
            <button
              className="secondary-button"
              disabled={saving || reopenReason.trim().length < 5}
              type="submit"
            >
              {saving ? "Açılıyor…" : "Gerekçeyle yeniden aç"}
            </button>
            {feedback ? <small>{feedback}</small> : null}
          </form>
        </>
      ) : null}

      {selectedEvents.length > 0 ? (
        <div className="month-close-history">
          <strong>Dönem hareket geçmişi</strong>
          {selectedEvents.map((event) => (
            <div key={event.id}>
              <span>{event.action === "closed" ? "Kapatıldı" : "Yeniden açıldı"}</span>
              <b>{DATE_TIME.format(new Date(event.createdAt))}</b>
              <small>{event.reason || "Farksız kapanış"}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
