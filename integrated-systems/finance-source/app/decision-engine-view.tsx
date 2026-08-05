"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  buildDecisionEngine,
  normalizeDecisionSettings,
} from "@/lib/decision-engine.mjs";
import type {
  ClinicTransaction,
  InventoryItem,
} from "./operational-modules";
import type {
  RecurringExpenseOccurrence,
  RecurringExpenseRule,
} from "./recurring-expenses-view";

export type DecisionSettings = {
  cashBalance: number | null;
  bankBalance: number | null;
  annualNetSalesTarget: number | null;
  priorVatCarryForward: number;
  corporateTaxRate: number;
  minimumCorporateTaxRate: number;
  minimumCorporateTaxApplies: boolean;
  rentWithholdingRate: number;
  rentContractBasis: "not_applicable" | "gross" | "net";
  rentLandlordType: "unknown" | "individual" | "company" | "exempt";
  taxRuleEffectiveDate: string;
  taxRuleSource: string;
  nonDeductibleExpenseAdjustment: number;
  lossCarryforward: number;
  approvedTaxDeductions: number;
  additionalTaxesPaid: number;
  otherTaxReserve: number;
  monthlyHomeNeed: number;
  ownerTransferType:
    | "none"
    | "salary"
    | "dividend"
    | "expense_reimbursement";
  approvedCapex: number;
  emergencyCapexReserve: number;
  stressRevenueDropRate: number;
  stressCostIncreaseRate: number;
  monthlyDebtServiceOverride: number | null;
  loanMonthlyRate: number | null;
  loanTermMonths: number;
  plannedPurchaseAmount: number;
  plannedPurchaseMonthlyContribution: number;
  maxPaybackMonths: number;
  inflationAssumption: number;
  realGrowthTarget: number;
  minimumBaseDscr: number;
  minimumStressDscr: number;
};

type LedgerRecord = {
  id: string;
  type: "receivable" | "payable";
  counterparty: string;
  detail: string;
  createdDate: string;
  dueDate: string;
  originalAmount: number;
  reserve: number;
  payments: Array<{
    amount: number;
    date: string;
    status?: "cancelled";
  }>;
};

type DecisionFocus = "all" | "goals" | "tax";

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const statusLabels = {
  green: "ONAYLANABİLİR",
  yellow: "ŞARTLI",
  red: "KAPALI",
  neutral: "BEKLİYOR",
};

const transferLabels: Record<
  DecisionSettings["ownerTransferType"],
  string
> = {
  none: "Seçilmedi",
  salary: "Ücret",
  dividend: "Kâr payı / temettü",
  expense_reimbursement: "Belgeli masraf iadesi",
};

function money(value: number | null | undefined) {
  return value === null || value === undefined
    ? "Hesaplanamaz"
    : TRY.format(value);
}

function percent(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("tr-TR", {
        style: "percent",
        maximumFractionDigits: digits,
      }).format(value);
}

function formatDate(value: string) {
  return DATE.format(new Date(`${value}T00:00:00Z`));
}

function fieldNumber(
  value: number | null,
  onChange: (value: number | null) => void,
  props: {
    max?: number;
    min?: number;
    step?: number;
    placeholder?: string;
  } = {},
) {
  return (
    <input
      min={props.min ?? 0}
      max={props.max}
      onChange={(event) =>
        onChange(
          event.target.value === "" ? null : Number(event.target.value),
        )
      }
      placeholder={props.placeholder}
      step={props.step ?? 0.01}
      type="number"
      value={value ?? ""}
    />
  );
}

function StatusDot({ status }: { status: string }) {
  return <i className={`engine-status-dot is-${status}`} aria-hidden="true" />;
}

function DecisionCards({
  cards,
}: {
  cards: Array<{
    id: string;
    status: string;
    title: string;
    value: string;
    why: string;
    action: string;
  }>;
}) {
  return (
    <section className="engine-card-grid" aria-label="Finansal kararlar">
      {cards.map((card) => (
        <article
          className={`panel engine-decision-card is-${card.status}`}
          data-testid={`decision-${card.id}`}
          key={card.id}
        >
          <div className="engine-card-head">
            <span>
              <StatusDot status={card.status} />
              {statusLabels[card.status as keyof typeof statusLabels] ??
                card.status}
            </span>
            <small>{card.title}</small>
          </div>
          <strong>{card.value}</strong>
          <p>{card.why}</p>
          <div>
            <b>Şimdi ne yap?</b>
            <span>{card.action}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function QualityPanel({
  quality,
}: {
  quality: ReturnType<typeof buildDecisionEngine>["quality"];
}) {
  const rows = [
    ["İşlem alanları", quality.components.transactionCompleteness],
    ["Gider belgeleri", quality.components.documentCoverage],
    ["POS / banka mutabakatı", quality.components.reconciliationCoverage],
    ["Gelire bağlı doğrudan maliyet", quality.components.directCostCoverage],
    ["Stok maliyet verisi", quality.components.inventoryCostCoverage],
    ["Borç planı", quality.components.debtCompleteness],
    ["Dönem yeterliliği", quality.components.periodSufficiency],
  ] as const;

  return (
    <article className="panel engine-quality">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Karar güven kapısı</span>
          <h2>Veri hangi noktada?</h2>
        </div>
        <strong className={`quality-score is-${quality.level}`}>
          {quality.score}/100
        </strong>
      </div>

      <div className="quality-bars">
        {rows.map(([label, value]) => (
          <div className="quality-row" key={label}>
            <span>{label}</span>
            <div>
              <i style={{ width: `${Math.round(value * 100)}%` }} />
            </div>
            <strong>{percent(value)}</strong>
          </div>
        ))}
      </div>

      <div className="quality-blockers">
        <b>Yeşil kararı engelleyen ilk eksikler</b>
        {quality.blockers.slice(0, 4).map((blocker: string) => (
          <span key={blocker}>
            <i />
            {blocker}
          </span>
        ))}
      </div>
    </article>
  );
}

function ReserveBridge({
  engine,
}: {
  engine: ReturnType<typeof buildDecisionEngine>;
}) {
  const rows = [
    ["Fiili kasa + banka", engine.forecast.liquidity, "plus"],
    ["Vergi rezervi", -engine.forecast.taxReserve, "minus"],
    [
      "13 haftalık işletme rezervi",
      -engine.forecast.operatingReserve13Weeks,
      "minus",
    ],
    ["13 haftada fonlanmamış borç", -engine.forecast.payable.unfunded, "minus"],
    ["Onaylı yatırım", -engine.forecast.approvedCapex, "minus"],
    ["Acil yatırım tamponu", -engine.forecast.emergencyCapexReserve, "minus"],
  ] as const;

  return (
    <article className="panel engine-reserve-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Sahte kârı engelleyen köprü</span>
          <h2>Paranın ne kadarı gerçekten serbest?</h2>
        </div>
      </div>
      <div className="engine-bridge-list">
        {rows.map(([label, amount, tone]) => (
          <div className={tone} key={label}>
            <span>{label}</span>
            <strong>
              {amount > 0 ? "+" : amount < 0 ? "−" : ""}
              {money(Math.abs(amount))}
            </strong>
          </div>
        ))}
        <div className="total">
          <span>Gerçekten dağıtılabilir nakit</span>
          <strong>{money(engine.forecast.distributableCash)}</strong>
        </div>
      </div>
      <p className="engine-fine-print">
        Bekleyen POS bu tutara eklenmedi. Vergi, borç, 13 hafta ve onaylı
        yatırım rezervi harcanabilir para değildir.
      </p>
    </article>
  );
}

function ForecastTable({
  engine,
}: {
  engine: ReturnType<typeof buildDecisionEngine>;
}) {
  return (
    <article className="panel engine-forecast">
      <div className="panel-head">
        <div>
          <span className="eyebrow">13 haftalık nakit</span>
          <h2>Baz ve stres senaryosu</h2>
        </div>
        <div className="forecast-legend">
          <span>
            <i className="base" /> Baz
          </span>
          <span>
            <i className="stress" /> Stres
          </span>
        </div>
      </div>
      <div className="engine-table-wrap">
        <table className="engine-table">
          <thead>
            <tr>
              <th>Hafta</th>
              <th>Beklenen giriş</th>
              <th>Beklenen çıkış</th>
              <th>Borç vadesi</th>
              <th>Baz kapanış</th>
              <th>Stres kapanış</th>
            </tr>
          </thead>
          <tbody>
            {engine.forecast.weeks.map(
              (week: {
                week: number;
                startDate: string;
                endDate: string;
                baseInflow: number;
                baseOutflow: number;
                debtDue: number;
                baseEnding: number;
                stressEnding: number;
              }) => (
                <tr key={week.week}>
                  <td>
                    <strong>{week.week}. hafta</strong>
                    <small>
                      {formatDate(week.startDate)}–{formatDate(week.endDate)}
                    </small>
                  </td>
                  <td>{money(week.baseInflow)}</td>
                  <td>{money(week.baseOutflow)}</td>
                  <td>{money(week.debtDue)}</td>
                  <td>{money(week.baseEnding)}</td>
                  <td className={week.stressEnding < 0 ? "negative" : ""}>
                    {money(week.stressEnding)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <div className="forecast-summary">
        <span>
          <small>13. hafta baz</small>
          <strong>{money(engine.forecast.baseEndingBalance)}</strong>
        </span>
        <span>
          <small>13. hafta stres</small>
          <strong>{money(engine.forecast.stressEndingBalance)}</strong>
        </span>
        <span>
          <small>En düşük stres bakiye</small>
          <strong>{money(engine.forecast.minimumStressBalance)}</strong>
        </span>
      </div>
    </article>
  );
}

function TargetPanel({
  engine,
}: {
  engine: ReturnType<typeof buildDecisionEngine>;
}) {
  const target = engine.target;
  const attainment =
    target.annualTarget && target.annualTarget > 0
      ? Math.min(1, target.ytdNetSales / target.annualTarget)
      : 0;

  return (
    <article className="panel engine-target" id="engine-target">
      <div className="panel-head">
        <div>
          <span className="eyebrow">{target.year} hedef kontrolü</span>
          <h2>{target.label}</h2>
        </div>
        <span className={`engine-chip is-${target.status}`}>
          {statusLabels[target.status as keyof typeof statusLabels]}
        </span>
      </div>

      <div className="target-meter">
        <div>
          <i style={{ width: `${attainment * 100}%` }} />
        </div>
        <span>
          <b>{money(target.ytdNetSales)}</b>
          <small>
            {target.annualTarget
              ? `${money(target.annualTarget)} hedef`
              : "Hedef girilmedi"}
          </small>
        </span>
      </div>

      <div className="engine-metric-grid">
        <div>
          <span>Bugüne göre sapma</span>
          <strong>{money(target.variance)}</strong>
        </div>
        <div>
          <span>Kalan hedef</span>
          <strong>{money(target.remainingTarget)}</strong>
        </div>
        <div>
          <span>Gerekli günlük net satış</span>
          <strong>{money(target.requiredDailyPace)}</strong>
        </div>
        <div>
          <span>Yıl sonu taslak tahmin</span>
          <strong>{money(target.annualForecast)}</strong>
        </div>
        <div>
          <span>{target.year + 1} rasyonel taslak</span>
          <strong>{money(target.suggestedNextYearTarget)}</strong>
        </div>
      </div>

      <p className="engine-callout">
        <b>Doğrusal tempo tahmini:</b> yıl sonu tahmini, bugüne kadarki net satış
        hızını yılın kalanına taşır; mevsimsellik, kampanya ve tatil etkilerini içermez.
      </p>
    </article>
  );
}

function TaxPanel({
  engine,
}: {
  engine: ReturnType<typeof buildDecisionEngine>;
}) {
  const tax = engine.tax;
  const rows = [
    ["Hesaplanan satış KDV'si", tax.vat.netPosition],
    ["Ödenecek KDV", tax.vat.payableVat],
    ["Kurumlar vergisi yönetim karşılığı", tax.corporateTaxReserve],
    ["Kira stopajı", tax.rentWithholding],
    ["Diğer vergi rezervi", tax.otherTaxReserve],
    ["Sistemde ödenmiş / ek mahsup", -tax.recordedAndAdditionalPaid],
  ] as const;

  return (
    <article className="panel engine-tax" id="engine-tax">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Vergi para duvarı</span>
          <h2>Harcanmaması gereken vergi karşılığı</h2>
        </div>
        <strong>{money(tax.remainingReserve)}</strong>
      </div>
      <div className="engine-tax-grid">
        {rows.map(([label, amount]) => (
          <div key={label}>
            <span>{label}</span>
            <strong className={amount < 0 ? "negative" : ""}>
              {amount < 0 ? "−" : ""}
              {money(Math.abs(amount))}
            </strong>
          </div>
        ))}
      </div>
      <div className="engine-warning">
        <b>Kesin beyanname değil</b>
        <p>{tax.warnings.join(" ")}</p>
        <small>
          Kural kaydı:{" "}
          {engine.settings.taxRuleEffectiveDate || "yürürlük tarihi yok"} ·{" "}
          {engine.settings.taxRuleSource || "kaynak/teyit notu yok"}
        </small>
      </div>
    </article>
  );
}

function SettingsForm({
  draft,
  setDraft,
  onSave,
  saving,
  saved,
  open,
}: {
  draft: DecisionSettings;
  setDraft: (settings: DecisionSettings) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  saved: string;
  open: boolean;
}) {
  const patch = <K extends keyof DecisionSettings>(
    key: K,
    value: DecisionSettings[K],
  ) => setDraft({ ...draft, [key]: value });

  return (
    <details className="panel engine-settings" open={open}>
      <summary>
        <span>
          <b>Karar motoru girdileri</b>
          <small>
            Bir kez doldurun; bütün kararlar aynı doğrulanmış girdileri kullansın.
          </small>
        </span>
        <i>+</i>
      </summary>
      <form onSubmit={onSave}>
        <section>
          <div className="engine-form-title">
            <span>1</span>
            <div>
              <b>Fiili para ve hedef</b>
              <small>Bekleyen POS bakiyeye eklenmez.</small>
            </div>
          </div>
          <div className="engine-form-grid">
            <label>
              Fiziksel kasa
              {fieldNumber(draft.cashBalance, (value) =>
                patch("cashBalance", value),
              )}
            </label>
            <label>
              Banka kullanılabilir bakiye
              {fieldNumber(draft.bankBalance, (value) =>
                patch("bankBalance", value),
              )}
            </label>
            <label>
              Yıllık KDV hariç satış hedefi
              {fieldNumber(draft.annualNetSalesTarget, (value) =>
                patch("annualNetSalesTarget", value),
              )}
            </label>
            <label>
              Onaylı yatırım / CAPEX
              {fieldNumber(draft.approvedCapex, (value) =>
                patch("approvedCapex", value ?? 0),
              )}
            </label>
            <label>
              Acil yatırım tamponu
              {fieldNumber(draft.emergencyCapexReserve, (value) =>
                patch("emergencyCapexReserve", value ?? 0),
              )}
            </label>
          </div>
        </section>

        <section>
          <div className="engine-form-title">
            <span>2</span>
            <div>
              <b>Vergi varsayımları</b>
              <small>
                Oranın yürürlük tarihini ve doğrulama kaynağını birlikte saklayın.
              </small>
            </div>
          </div>
          <div className="engine-form-grid">
            <label>
              Önceki devreden KDV
              {fieldNumber(draft.priorVatCarryForward, (value) =>
                patch("priorVatCarryForward", value ?? 0),
              )}
            </label>
            <label>
              KKEG düzeltmesi
              {fieldNumber(draft.nonDeductibleExpenseAdjustment, (value) =>
                patch("nonDeductibleExpenseAdjustment", value ?? 0),
              )}
            </label>
            <label>
              Mahsup edilebilir geçmiş zarar
              {fieldNumber(draft.lossCarryforward, (value) =>
                patch("lossCarryforward", value ?? 0),
              )}
            </label>
            <label>
              Onaylı istisna / indirim
              {fieldNumber(draft.approvedTaxDeductions, (value) =>
                patch("approvedTaxDeductions", value ?? 0),
              )}
            </label>
            <label>
              Sistem dışı ödenmiş vergi
              {fieldNumber(draft.additionalTaxesPaid, (value) =>
                patch("additionalTaxesPaid", value ?? 0),
              )}
            </label>
            <label>
              Diğer vergi / stopaj rezervi
              {fieldNumber(draft.otherTaxReserve, (value) =>
                patch("otherTaxReserve", value ?? 0),
              )}
            </label>
            <label>
              Kira sözleşme türü
              <select
                onChange={(event) =>
                  patch(
                    "rentContractBasis",
                    event.target.value as DecisionSettings["rentContractBasis"],
                  )
                }
                value={draft.rentContractBasis}
              >
                <option value="not_applicable">Stopaj kapsamı seçilmedi</option>
                <option value="net">Ev sahibine net kira</option>
                <option value="gross">Brüt kira</option>
              </select>
            </label>
            <label>
              Kiraya veren türü
              <select
                onChange={(event) =>
                  patch(
                    "rentLandlordType",
                    event.target.value as DecisionSettings["rentLandlordType"],
                  )
                }
                value={draft.rentLandlordType}
              >
                <option value="unknown">Doğrulanmadı</option>
                <option value="individual">Gerçek kişi</option>
                <option value="company">Şirket / kurum</option>
                <option value="exempt">Stopaj dışı / istisna</option>
              </select>
            </label>
            <label>
              Kurumlar vergisi (%)
              {fieldNumber(
                draft.corporateTaxRate * 100,
                (value) =>
                  patch("corporateTaxRate", (value ?? 0) / 100),
                { max: 99, step: 0.01 },
              )}
            </label>
            <label>
              Kira stopajı (%)
              {fieldNumber(
                draft.rentWithholdingRate * 100,
                (value) =>
                  patch("rentWithholdingRate", (value ?? 0) / 100),
                { step: 0.01 },
              )}
            </label>
            <label>
              Vergi kuralı yürürlük tarihi
              <input
                onChange={(event) =>
                  patch("taxRuleEffectiveDate", event.target.value)
                }
                type="date"
                value={draft.taxRuleEffectiveDate}
              />
            </label>
            <label className="span-2">
              Mali müşavir teyit notu / dayanak
              <input
                onChange={(event) =>
                  patch("taxRuleSource", event.target.value)
                }
                placeholder="Mali müşavir teyidi, sirküler tarihi veya iç kontrol notu"
                value={draft.taxRuleSource}
              />
            </label>
            <label className="engine-check-label">
              <input
                checked={draft.minimumCorporateTaxApplies}
                onChange={(event) =>
                  patch("minimumCorporateTaxApplies", event.target.checked)
                }
                type="checkbox"
              />
              <span>
                <b>Asgari kurumlar vergisi kontrolü uygulansın</b>
                <small>Kapsam ve istisna mali müşavirce doğrulanmalıdır.</small>
              </span>
            </label>
          </div>
        </section>

        <section>
          <div className="engine-form-title">
            <span>3</span>
            <div>
              <b>Borç, alım ve ev bütçesi</b>
              <small>Kararlar stres senaryosundan geçmeden yeşil olmaz.</small>
            </div>
          </div>
          <div className="engine-form-grid">
            <label>
              Doğrulanmış aylık kredi / leasing taksiti
              {fieldNumber(draft.monthlyDebtServiceOverride, (value) =>
                patch("monthlyDebtServiceOverride", value),
              )}
              <small>Tedarikçi borçlarını yazmayın; yalnız banka kredisi ve finansal kiralama taksitlerinin aylık toplamı.</small>
            </label>
            <label>
              Yeni kredinin aylık toplam maliyeti (%)
              {fieldNumber(
                draft.loanMonthlyRate === null
                  ? null
                  : draft.loanMonthlyRate * 100,
                (value) =>
                  patch(
                    "loanMonthlyRate",
                    value === null ? null : value / 100,
                  ),
                { step: 0.01 },
              )}
            </label>
            <label>
              Yeni kredi vadesi (ay)
              {fieldNumber(draft.loanTermMonths, (value) =>
                patch("loanTermMonths", Math.max(1, Math.round(value ?? 1))),
              )}
            </label>
            <label>
              Aylık ev ihtiyacı
              {fieldNumber(draft.monthlyHomeNeed, (value) =>
                patch("monthlyHomeNeed", value ?? 0),
              )}
            </label>
            <label>
              Yasal transfer türü
              <select
                onChange={(event) =>
                  patch(
                    "ownerTransferType",
                    event.target.value as DecisionSettings["ownerTransferType"],
                  )
                }
                value={draft.ownerTransferType}
              >
                {Object.entries(transferLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Değerlendirilecek alım tutarı
              {fieldNumber(draft.plannedPurchaseAmount, (value) =>
                patch("plannedPurchaseAmount", value ?? 0),
              )}
            </label>
            <label>
              Alımın aylık net nakit katkısı
              {fieldNumber(
                draft.plannedPurchaseMonthlyContribution,
                (value) =>
                  patch("plannedPurchaseMonthlyContribution", value ?? 0),
              )}
            </label>
            <label>
              Azami kabul edilen geri ödeme (ay)
              {fieldNumber(draft.maxPaybackMonths, (value) =>
                patch("maxPaybackMonths", Math.max(1, Math.round(value ?? 1))),
              )}
            </label>
          </div>
        </section>

        <details className="engine-advanced">
          <summary>Stres ve büyüme varsayımları</summary>
          <div className="engine-form-grid">
            <label>
              Stres gelir düşüşü (%)
              {fieldNumber(
                draft.stressRevenueDropRate * 100,
                (value) =>
                  patch("stressRevenueDropRate", (value ?? 0) / 100),
                { step: 0.1 },
              )}
            </label>
            <label>
              Stres maliyet artışı (%)
              {fieldNumber(
                draft.stressCostIncreaseRate * 100,
                (value) =>
                  patch("stressCostIncreaseRate", (value ?? 0) / 100),
                { step: 0.1 },
              )}
            </label>
            <label>
              12 ay enflasyon varsayımı (%)
              {fieldNumber(
                draft.inflationAssumption * 100,
                (value) =>
                  patch("inflationAssumption", (value ?? 0) / 100),
                { step: 0.01 },
              )}
            </label>
            <label>
              Reel büyüme hedefi (%)
              {fieldNumber(
                draft.realGrowthTarget * 100,
                (value) =>
                  patch("realGrowthTarget", (value ?? 0) / 100),
                { step: 0.1 },
              )}
            </label>
          </div>
          <p>
            Varsayılan stres: gelir −%20, maliyet +%15. Enflasyon girdisi
            TCMB Temmuz 2026 Piyasa Katılımcıları Anketi 12 ay beklentisi
            %23,95’tir; garanti değildir.
          </p>
        </details>

        <div className="engine-form-actions">
          <span>{saved}</span>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Kaydediliyor…" : "Girdileri kaydet ve yeniden hesapla"}
          </button>
        </div>
      </form>
    </details>
  );
}

export function DecisionEngineView({
  transactions,
  records,
  inventory,
  recurringRules,
  recurringOccurrences,
  settings,
  today,
  focus = "all",
  onSaveSettings,
}: {
  transactions: ClinicTransaction[];
  records: LedgerRecord[];
  inventory: InventoryItem[];
  recurringRules: RecurringExpenseRule[];
  recurringOccurrences: RecurringExpenseOccurrence[];
  settings: DecisionSettings;
  today: string;
  focus?: DecisionFocus;
  onSaveSettings: (settings: DecisionSettings) => Promise<boolean>;
}) {
  const normalized = useMemo(
    () => normalizeDecisionSettings(settings) as DecisionSettings,
    [settings],
  );
  const [draftOverride, setDraftOverride] =
    useState<DecisionSettings | null>(null);
  const draft = draftOverride ?? normalized;
  const setDraft = setDraftOverride;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  const engine = useMemo(
    () =>
      buildDecisionEngine({
        transactions,
        records,
        inventory,
        recurringRules,
        recurringOccurrences,
        settings: normalized,
        today,
      }),
    [
      transactions,
      records,
      inventory,
      recurringRules,
      recurringOccurrences,
      normalized,
      today,
    ],
  );

  const focusStatus =
    focus === "goals"
      ? engine.target.status
      : focus === "tax"
        ? engine.quality.taxReady
          ? "yellow"
          : "red"
        : engine.overallStatus;
  const focusCards =
    focus === "goals"
      ? engine.cards.filter((card: { id: string }) => card.id === "target")
      : focus === "tax"
        ? engine.cards.filter((card: { id: string }) => card.id === "tax")
        : engine.cards;

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved("");
    const next = normalizeDecisionSettings(draft) as DecisionSettings;
    const ok = await onSaveSettings(next);
    setSaving(false);
    if (ok) {
      setDraft(next);
      setSaved("Kaydedildi · bütün kararlar güncellendi.");
    } else {
      setSaved("Kaydedilemedi; bağlantıyı kontrol edin.");
    }
  }

  return (
    <div className="decision-engine-layout">
      <section className={`engine-hero is-${focusStatus}`}>
        <div>
          <span className="engine-hero-label">
            <StatusDot status={focusStatus} />
            {focus === "all"
              ? focusStatus === "green"
                ? "KARAR ÜRETMEYE HAZIR"
                : focusStatus === "yellow"
                  ? "YALNIZ ŞARTLI KARAR"
                  : "YEŞİL KARAR ÜRETİLMİYOR"
              : focus === "goals"
                ? "HEDEF MOTORU"
                : "VERGİ REZERV MOTORU"}
          </span>
          <h2>
            {focus === "all"
              ? engine.priority.title
              : focus === "goals"
                ? engine.target.label
                : `${money(engine.tax.remainingReserve)} rezerv görünümü`}
          </h2>
          <p>
            {focus === "all"
              ? engine.priority.why
              : focus === "goals"
                ? "Hedef, zaman ilerlemesi ve veri güveni birlikte okunuyor."
                : "Vergi parası kâr ve kullanılabilir nakitten ayrıldı."}
          </p>
        </div>
        <div className="engine-next-action">
          <span>TEK ÖNCELİK</span>
          <strong>
            {focus === "all"
              ? engine.priority.action
              : focus === "goals"
                ? focusCards[0]?.action
                : focusCards[0]?.action}
          </strong>
        </div>
        <div className="engine-confidence">
          <small>Veri karar güveni</small>
          <strong>{engine.quality.score}</strong>
          <span>/100</span>
        </div>
      </section>

      <DecisionCards cards={focusCards} />

      {focus === "all" ? (
        <>
          <section className="engine-two-column">
            <ReserveBridge engine={engine} />
            <QualityPanel quality={engine.quality} />
          </section>
          <ForecastTable engine={engine} />
          <section className="engine-two-column">
            <TargetPanel engine={engine} />
            <TaxPanel engine={engine} />
          </section>
        </>
      ) : null}

      {focus === "goals" ? <TargetPanel engine={engine} /> : null}
      {focus === "tax" ? <TaxPanel engine={engine} /> : null}

      <SettingsForm
        draft={draft}
        onSave={submitSettings}
        open={
          normalized.cashBalance === null ||
          normalized.bankBalance === null ||
          (focus === "goals" && normalized.annualNetSalesTarget === null)
        }
        saved={saved}
        saving={saving}
        setDraft={setDraft}
      />

      <footer className="engine-method-note">
        <b>Rasyonel sınır:</b> Sistem karar üretir, kayıtları kendiliğinden
        değiştirmez. Vergi tahmini mali müşavir beyanının; yatırım ve borç
        sinyali ise banka teklifinin yerine geçmez.
      </footer>
    </div>
  );
}
