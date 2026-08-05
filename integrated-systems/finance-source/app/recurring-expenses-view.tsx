"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  addMonthsAnchored,
  projectRecurringExpenses,
  recurringExpenseSummary,
} from "@/lib/recurring.mjs";
import {
  ClinicTransaction,
  DocumentType,
  PaymentChannel,
} from "./operational-modules";

export type RecurringAmountMode = "fixed" | "estimated";

export type RecurringExpenseRule = {
  id: string;
  name: string;
  category: string;
  counterparty: string;
  amount: number;
  amountMode: RecurringAmountMode;
  frequencyMonths: number;
  startDate: string;
  endDate?: string;
  nextReviewDate?: string;
  paymentMethod: PaymentChannel;
  documentType: DocumentType;
  vatRate: number;
  active: boolean;
  note: string;
};

export type RecurringExpenseOccurrence = {
  id: string;
  ruleId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  status: "paid" | "skipped";
  paidDate?: string;
  transactionId?: string;
  paymentMethod?: PaymentChannel;
  documentType?: DocumentType;
  documentRef?: string;
  note?: string;
};

export type ProjectedRecurringOccurrence =
  Omit<RecurringExpenseOccurrence, "status"> & {
    status: "planned" | "paid" | "skipped";
    needsAmount: boolean;
    needsReview: boolean;
  };

export type RecurringPaymentPayload = {
  occurrence: RecurringExpenseOccurrence;
  transaction: ClinicTransaction;
};

type RuleForm = {
  template: string;
  name: string;
  category: string;
  counterparty: string;
  amount: string;
  amountMode: RecurringAmountMode;
  frequencyMonths: string;
  startDate: string;
  nextReviewDate: string;
  paymentMethod: PaymentChannel;
  documentType: DocumentType;
  vatRate: string;
  note: string;
};

type PaymentForm = {
  actualAmount: string;
  paidDate: string;
  paymentMethod: PaymentChannel;
  documentType: DocumentType;
  documentRef: string;
  vatRate: string;
  note: string;
};

const templates = [
  {
    id: "rent",
    name: "Kira",
    category: "Kira",
    counterparty: "Mülk sahibi",
    amountMode: "fixed" as const,
  },
  {
    id: "accounting",
    name: "Muhasebe hizmeti",
    category: "Muhasebe",
    counterparty: "Mali müşavir",
    amountMode: "fixed" as const,
  },
  {
    id: "internet",
    name: "İnternet faturası",
    category: "Haberleşme",
    counterparty: "İnternet sağlayıcısı",
    amountMode: "estimated" as const,
  },
  {
    id: "electricity",
    name: "Elektrik faturası",
    category: "Enerji",
    counterparty: "Elektrik dağıtım şirketi",
    amountMode: "estimated" as const,
  },
  {
    id: "water",
    name: "Su faturası",
    category: "Enerji",
    counterparty: "Su idaresi",
    amountMode: "estimated" as const,
  },
  {
    id: "gas",
    name: "Doğalgaz faturası",
    category: "Enerji",
    counterparty: "Doğalgaz dağıtım şirketi",
    amountMode: "estimated" as const,
  },
  {
    id: "software",
    name: "Yazılım / abonelik",
    category: "Yazılım ve abonelik",
    counterparty: "",
    amountMode: "fixed" as const,
  },
  {
    id: "other",
    name: "",
    category: "Diğer sabit gider",
    counterparty: "",
    amountMode: "fixed" as const,
  },
];

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const frequencyLabels: Record<number, string> = {
  1: "Her ay",
  3: "3 ayda bir",
  12: "Yılda bir",
};

const paymentLabels: Record<PaymentChannel, string> = {
  cash: "Nakit",
  card: "Kart",
  transfer: "Havale",
  accrual: "Tahakkuk / stok",
};

const documentLabels: Record<DocumentType, string> = {
  none: "Belge sonra",
  receipt: "Fiş",
  invoice: "Fatura",
  e_archive: "e-Fatura / e-Arşiv",
  bank_statement: "Banka dekontu",
  pos_statement: "POS ekstresi",
  stock_record: "Stok maliyet fişi",
};

function formatMoney(value: number) {
  return TRY.format(value);
}

function formatDate(value: string) {
  return DATE.format(new Date(`${value}T00:00:00Z`));
}

function currentTimeInIstanbul() {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date());
}

function emptyRuleForm(today: string): RuleForm {
  return {
    template: "rent",
    name: "Kira",
    category: "Kira",
    counterparty: "Mülk sahibi",
    amount: "",
    amountMode: "fixed",
    frequencyMonths: "1",
    startDate: today,
    nextReviewDate: addMonthsAnchored(today, 12),
    paymentMethod: "transfer",
    documentType: "none",
    vatRate: "0",
    note: "",
  };
}

function ruleToForm(rule: RecurringExpenseRule): RuleForm {
  return {
    template: "other",
    name: rule.name,
    category: rule.category,
    counterparty: rule.counterparty,
    amount: String(rule.amount),
    amountMode: rule.amountMode,
    frequencyMonths: String(rule.frequencyMonths),
    startDate: rule.startDate,
    nextReviewDate: rule.nextReviewDate ?? "",
    paymentMethod: rule.paymentMethod,
    documentType: rule.documentType,
    vatRate: String(rule.vatRate),
    note: rule.note,
  };
}

export function RecurringExpensesView({
  today,
  rules,
  occurrences,
  onSaveRule,
  onPay,
}: {
  today: string;
  rules: RecurringExpenseRule[];
  occurrences: RecurringExpenseOccurrence[];
  onSaveRule: (rule: RecurringExpenseRule) => Promise<boolean>;
  onPay: (payload: RecurringPaymentPayload) => Promise<boolean>;
}) {
  const [ruleForm, setRuleForm] = useState<RuleForm>(() =>
    emptyRuleForm(today),
  );
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [payingOccurrence, setPayingOccurrence] =
    useState<ProjectedRecurringOccurrence | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const schedule = useMemo(
    () =>
      projectRecurringExpenses(rules, occurrences, today, {
        monthsAhead: 18,
        monthsBack: 2,
      }) as ProjectedRecurringOccurrence[],
    [rules, occurrences, today],
  );
  const summary = useMemo(
    () => recurringExpenseSummary(rules, schedule, today),
    [rules, schedule, today],
  );
  const ruleMap = useMemo(
    () => new Map(rules.map((rule) => [rule.id, rule] as const)),
    [rules],
  );
  const visibleOccurrences = schedule
    .filter((occurrence) => occurrence.status !== "skipped")
    .slice(0, 8);

  function openNewRule() {
    setEditingRuleId(null);
    setRuleForm(emptyRuleForm(today));
    setError("");
    setRuleDialogOpen(true);
  }

  function openEditRule(rule: RecurringExpenseRule, advanceReview = false) {
    const next = ruleToForm(rule);
    if (advanceReview) {
      next.nextReviewDate = addMonthsAnchored(today, 12);
    }
    setEditingRuleId(rule.id);
    setRuleForm(next);
    setError("");
    setRuleDialogOpen(true);
  }

  function selectTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setRuleForm((current) => ({
      ...current,
      template: id,
      name: template.name,
      category: template.category,
      counterparty: template.counterparty,
      amountMode: template.amountMode,
    }));
  }

  async function submitRule(event: FormEvent) {
    event.preventDefault();
    const amount = Number(ruleForm.amount);
    const frequencyMonths = Number(ruleForm.frequencyMonths);
    const vatRate = Number(ruleForm.vatRate);
    if (
      !ruleForm.name.trim() ||
      !ruleForm.category.trim() ||
      !ruleForm.startDate ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Gider adı, ilk ödeme tarihi ve sıfırdan büyük tutar gereklidir.");
      return;
    }
    if (![1, 3, 12].includes(frequencyMonths)) {
      setError("Geçerli bir tekrar aralığı seçin.");
      return;
    }

    const existing = rules.find((rule) => rule.id === editingRuleId);
    const rule: RecurringExpenseRule = {
      id: existing?.id ?? `recurring-rule-${Date.now()}`,
      name: ruleForm.name.trim(),
      category: ruleForm.category.trim(),
      counterparty: ruleForm.counterparty.trim(),
      amount,
      amountMode: ruleForm.amountMode,
      frequencyMonths,
      startDate: ruleForm.startDate,
      endDate: existing?.endDate,
      nextReviewDate: ruleForm.nextReviewDate || undefined,
      paymentMethod: ruleForm.paymentMethod,
      documentType: ruleForm.documentType,
      vatRate,
      active: existing?.active ?? true,
      note: ruleForm.note.trim(),
    };
    setSaving(true);
    const saved = await onSaveRule(rule);
    setSaving(false);
    if (!saved) {
      setError("Sabit gider kaydedilemedi.");
      return;
    }
    setRuleDialogOpen(false);
  }

  async function toggleRule(rule: RecurringExpenseRule) {
    setSaving(true);
    await onSaveRule({ ...rule, active: !rule.active });
    setSaving(false);
  }

  function openPayment(occurrence: ProjectedRecurringOccurrence) {
    const rule = ruleMap.get(occurrence.ruleId);
    if (!rule) return;
    setPayingOccurrence(occurrence);
    setPaymentForm({
      actualAmount: String(occurrence.expectedAmount),
      paidDate: today,
      paymentMethod: rule.paymentMethod,
      documentType: rule.documentType,
      documentRef: "",
      vatRate: String(rule.vatRate),
      note: "",
    });
    setError("");
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!payingOccurrence || !paymentForm) return;
    const rule = ruleMap.get(payingOccurrence.ruleId);
    if (!rule) return;
    const actualAmount = Number(paymentForm.actualAmount);
    const vatRate = Number(paymentForm.vatRate);
    if (
      !paymentForm.paidDate ||
      !Number.isFinite(actualAmount) ||
      actualAmount <= 0
    ) {
      setError("Gerçek ödeme tutarı sıfırdan büyük olmalıdır.");
      return;
    }

    const transactionId = `tx-${payingOccurrence.id}`;
    const occurrence: RecurringExpenseOccurrence = {
      id: payingOccurrence.id,
      ruleId: rule.id,
      dueDate: payingOccurrence.dueDate,
      expectedAmount: payingOccurrence.expectedAmount,
      actualAmount,
      status: "paid",
      paidDate: paymentForm.paidDate,
      transactionId,
      paymentMethod: paymentForm.paymentMethod,
      documentType: paymentForm.documentType,
      documentRef: paymentForm.documentRef.trim(),
      note: paymentForm.note.trim(),
    };
    const transaction: ClinicTransaction = {
      id: transactionId,
      date: paymentForm.paidDate,
      time: currentTimeInIstanbul(),
      kind: "expense",
      category: rule.category,
      description: `${rule.name} · ${payingOccurrence.dueDate.slice(0, 7)} dönemi`,
      counterparty: rule.counterparty,
      operationType: "overhead",
      costBehavior: "fixed",
      amount: actualAmount,
      paymentMethod: paymentForm.paymentMethod,
      documentType: paymentForm.documentType,
      documentRef: paymentForm.documentRef.trim(),
      vatRate,
      sourceModule: "recurring",
      sourceRecordId: payingOccurrence.id,
      isAutomatic: true,
      sourceTransactionId: rule.id,
    };

    setSaving(true);
    const saved = await onPay({ occurrence, transaction });
    setSaving(false);
    if (!saved) {
      setError("Ödeme gider listesine aktarılamadı.");
      return;
    }
    setPayingOccurrence(null);
    setPaymentForm(null);
  }

  return (
    <>
      <section className="recurring-intro">
        <div>
          <span className="eyebrow">Bir kez tanımla · dönem boyunca kullan</span>
          <h2>Sabit giderleri tekrar yazma</h2>
          <p>
            Planlanan ödeme takvimde görünür; “ödendi” demeden gerçek gider ve
            kasa hareketi sayılmaz.
          </p>
        </div>
        <button className="primary-button" onClick={openNewRule} type="button">
          <span>+</span> Sabit gider ekle
        </button>
      </section>

      <section className="recurring-kpis">
        <article>
          <span>Aylık ortalama plan</span>
          <strong>{formatMoney(summary.monthlyPlan)}</strong>
          <small>{summary.activeRuleCount} aktif gider kuralı</small>
        </article>
        <article>
          <span>Bu ay planlanan</span>
          <strong>{formatMoney(summary.thisMonthExpected)}</strong>
          <small>Öngörü; ödeme değildir</small>
        </article>
        <article>
          <span>Bu ay ödenen</span>
          <strong>{formatMoney(summary.thisMonthPaid)}</strong>
          <small>Gerçek gider listesine aktarıldı</small>
        </article>
        <article>
          <span>Bekleyen işlem</span>
          <strong>{summary.pendingCount}</strong>
          <small>Ödendi / tutarı güncelle</small>
        </article>
      </section>

      {rules.length ? (
        <section className="recurring-rule-grid">
          {rules.map((rule) => {
            const nextOccurrence = schedule.find(
              (occurrence) =>
                occurrence.ruleId === rule.id &&
                occurrence.status === "planned" &&
                occurrence.dueDate >= today,
            );
            return (
              <article
                className={`recurring-rule-card ${rule.active ? "" : "is-paused"}`}
                key={rule.id}
              >
                <div className="recurring-rule-head">
                  <div>
                    <span>{rule.category}</span>
                    <h3>{rule.name}</h3>
                  </div>
                  <i>{rule.active ? "Aktif" : "Durduruldu"}</i>
                </div>
                <strong>{formatMoney(rule.amount)}</strong>
                <p>
                  {frequencyLabels[rule.frequencyMonths]} ·{" "}
                  {rule.amountMode === "fixed"
                    ? "Sabit tutar"
                    : "Tahmini tutar"}
                </p>
                <dl>
                  <div>
                    <dt>Sıradaki</dt>
                    <dd>
                      {nextOccurrence
                        ? formatDate(nextOccurrence.dueDate)
                        : "Plan yok"}
                    </dd>
                  </div>
                  <div>
                    <dt>Artış kontrolü</dt>
                    <dd>
                      {rule.nextReviewDate
                        ? formatDate(rule.nextReviewDate)
                        : "Tanımlanmadı"}
                    </dd>
                  </div>
                </dl>
                <div className="recurring-rule-actions">
                  <button onClick={() => openEditRule(rule)} type="button">
                    Düzenle
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => void toggleRule(rule)}
                    type="button"
                  >
                    {rule.active ? "Durdur" : "Devam ettir"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="recurring-empty">
          <strong>Henüz sabit gider tanımlanmadı</strong>
          <p>
            İlk olarak kira, muhasebe veya internet giderini ekleyin. Sonraki
            aylar kendiliğinden oluşsun.
          </p>
          <button onClick={openNewRule} type="button">
            İlk sabit gideri ekle
          </button>
        </section>
      )}

      {rules.length ? (
        <section className="panel recurring-schedule">
          <div className="recurring-schedule-head">
            <div>
              <span className="eyebrow">Yaklaşan ödeme listesi</span>
              <h2>Takvimden gelen giderler</h2>
            </div>
            <p>Plan → kontrol → gerçek gider</p>
          </div>
          <div className="recurring-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vade</th>
                  <th>Gider</th>
                  <th>Planlanan</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {visibleOccurrences.map((occurrence) => {
                  const rule = ruleMap.get(occurrence.ruleId);
                  const paid = occurrence.status === "paid";
                  return (
                    <tr key={occurrence.id}>
                      <td>{formatDate(occurrence.dueDate)}</td>
                      <td>
                        <strong>{rule?.name}</strong>
                        <span>{rule?.counterparty || "Karşı taraf yok"}</span>
                      </td>
                      <td>
                        {formatMoney(
                          paid
                            ? occurrence.actualAmount ??
                                occurrence.expectedAmount
                            : occurrence.expectedAmount,
                        )}
                      </td>
                      <td>
                        <span
                          className={`recurring-status ${
                            paid
                              ? "paid"
                              : occurrence.needsReview
                                ? "review"
                                : "planned"
                          }`}
                        >
                          {paid
                            ? "Ödendi"
                            : occurrence.needsReview
                              ? "Artış kontrolü"
                              : occurrence.needsAmount
                                ? "Gerçek tutar bekleniyor"
                                : "Planlandı"}
                        </span>
                      </td>
                      <td>
                        {paid ? (
                          <span className="recurring-done">✓ Gidere işlendi</span>
                        ) : occurrence.needsReview && rule ? (
                          <button
                            className="recurring-review-button"
                            onClick={() => openEditRule(rule, true)}
                            type="button"
                          >
                            Tutarı güncelle
                          </button>
                        ) : (
                          <button
                            className="recurring-pay-button"
                            onClick={() => openPayment(occurrence)}
                            type="button"
                          >
                            {occurrence.needsAmount
                              ? "Tutarı gir · ödendi"
                              : "Ödendi"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {ruleDialogOpen ? (
        <div
          className="modal-backdrop"
          onMouseDown={() => setRuleDialogOpen(false)}
          role="presentation"
        >
          <form
            className="modal-card recurring-rule-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submitRule}
          >
            <div className="drawer-head">
              <div>
                <span className="eyebrow">Bir kez tanımla</span>
                <h2>
                  {editingRuleId ? "Sabit gideri düzenle" : "Sabit gider ekle"}
                </h2>
              </div>
              <button
                aria-label="Kapat"
                onClick={() => setRuleDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="recurring-form-grid">
              <label>
                Hazır gider
                <select
                  data-testid="recurring-template"
                  onChange={(event) => selectTemplate(event.target.value)}
                  value={ruleForm.template}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name || "Diğer"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gider adı *
                <input
                  onChange={(event) =>
                    setRuleForm({ ...ruleForm, name: event.target.value })
                  }
                  placeholder="Örn. Klinik kirası"
                  value={ruleForm.name}
                />
              </label>
              <label>
                Kime ödenir?
                <input
                  onChange={(event) =>
                    setRuleForm({
                      ...ruleForm,
                      counterparty: event.target.value,
                    })
                  }
                  placeholder="Kişi veya firma"
                  value={ruleForm.counterparty}
                />
              </label>
              <label>
                Planlanan tutar *
                <input
                  min="0.01"
                  onChange={(event) =>
                    setRuleForm({ ...ruleForm, amount: event.target.value })
                  }
                  placeholder="0,00"
                  step="0.01"
                  type="number"
                  value={ruleForm.amount}
                />
              </label>
              <fieldset className="recurring-choice">
                <legend>Tutar biçimi</legend>
                <button
                  className={ruleForm.amountMode === "fixed" ? "active" : ""}
                  onClick={() =>
                    setRuleForm({ ...ruleForm, amountMode: "fixed" })
                  }
                  type="button"
                >
                  Sabit
                </button>
                <button
                  className={
                    ruleForm.amountMode === "estimated" ? "active" : ""
                  }
                  onClick={() =>
                    setRuleForm({ ...ruleForm, amountMode: "estimated" })
                  }
                  type="button"
                >
                  Tahmini
                </button>
              </fieldset>
              <label>
                İlk ödeme tarihi *
                <input
                  onChange={(event) =>
                    setRuleForm({
                      ...ruleForm,
                      startDate: event.target.value,
                    })
                  }
                  type="date"
                  value={ruleForm.startDate}
                />
              </label>
              <label>
                Tekrar
                <select
                  onChange={(event) =>
                    setRuleForm({
                      ...ruleForm,
                      frequencyMonths: event.target.value,
                    })
                  }
                  value={ruleForm.frequencyMonths}
                >
                  <option value="1">Her ay</option>
                  <option value="3">3 ayda bir</option>
                  <option value="12">Yılda bir</option>
                </select>
              </label>
              <label>
                Sonraki artış kontrolü
                <input
                  onChange={(event) =>
                    setRuleForm({
                      ...ruleForm,
                      nextReviewDate: event.target.value,
                    })
                  }
                  type="date"
                  value={ruleForm.nextReviewDate}
                />
              </label>
            </div>

            <p className="recurring-rational-note">
              Artış oranı otomatik tahmin edilmez. Bu tarihte sistem yeni tutarı
              sorar; böylece yanlış kira veya abonelik gideri oluşturmaz.
            </p>

            <details className="recurring-details">
              <summary>Belge, KDV ve ödeme ayarları</summary>
              <div className="recurring-form-grid compact">
                <label>
                  Kategori
                  <input
                    onChange={(event) =>
                      setRuleForm({
                        ...ruleForm,
                        category: event.target.value,
                      })
                    }
                    value={ruleForm.category}
                  />
                </label>
                <label>
                  Ödeme biçimi
                  <select
                    onChange={(event) =>
                      setRuleForm({
                        ...ruleForm,
                        paymentMethod: event.target.value as PaymentChannel,
                      })
                    }
                    value={ruleForm.paymentMethod}
                  >
                    <option value="transfer">Havale</option>
                    <option value="cash">Nakit</option>
                    <option value="card">Kart</option>
                  </select>
                </label>
                <label>
                  Varsayılan belge
                  <select
                    onChange={(event) =>
                      setRuleForm({
                        ...ruleForm,
                        documentType: event.target.value as DocumentType,
                      })
                    }
                    value={ruleForm.documentType}
                  >
                    {Object.entries(documentLabels)
                      .filter(([value]) => value !== "stock_record")
                      .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                      ))}
                  </select>
                </label>
                <label>
                  KDV
                  <select
                    onChange={(event) =>
                      setRuleForm({
                        ...ruleForm,
                        vatRate: event.target.value,
                      })
                    }
                    value={ruleForm.vatRate}
                  >
                    <option value="0">%0</option>
                    <option value="0.01">%1</option>
                    <option value="0.1">%10</option>
                    <option value="0.2">%20</option>
                  </select>
                </label>
                <label className="span-2">
                  Not
                  <input
                    onChange={(event) =>
                      setRuleForm({ ...ruleForm, note: event.target.value })
                    }
                    placeholder="Sözleşme, abonelik veya açıklama"
                    value={ruleForm.note}
                  />
                </label>
              </div>
            </details>

            {error ? <p className="form-error">{error}</p> : null}
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setRuleDialogOpen(false)}
                type="button"
              >
                Vazgeç
              </button>
              <button
                className="primary-button"
                disabled={saving}
                type="submit"
              >
                {saving ? "Kaydediliyor…" : "Dönemsel planı oluştur"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {payingOccurrence && paymentForm ? (
        <div
          className="modal-backdrop"
          onMouseDown={() => setPayingOccurrence(null)}
          role="presentation"
        >
          <form
            className="modal-card recurring-payment-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submitPayment}
          >
            <div className="drawer-head">
              <div>
                <span className="eyebrow">Planı gerçek gidere çevir</span>
                <h2>{ruleMap.get(payingOccurrence.ruleId)?.name}</h2>
              </div>
              <button
                aria-label="Kapat"
                onClick={() => setPayingOccurrence(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="recurring-payment-summary">
              <span>Planlanan vade</span>
              <strong>{formatDate(payingOccurrence.dueDate)}</strong>
              <span>Planlanan tutar</span>
              <strong>{formatMoney(payingOccurrence.expectedAmount)}</strong>
            </div>
            <div className="recurring-form-grid">
              <label>
                Gerçek ödeme tutarı *
                <input
                  min="0.01"
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      actualAmount: event.target.value,
                    })
                  }
                  step="0.01"
                  type="number"
                  value={paymentForm.actualAmount}
                />
              </label>
              <label>
                Ödeme günü *
                <input
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      paidDate: event.target.value,
                    })
                  }
                  type="date"
                  value={paymentForm.paidDate}
                />
              </label>
              <label>
                Ödeme biçimi
                <select
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentMethod: event.target.value as PaymentChannel,
                    })
                  }
                  value={paymentForm.paymentMethod}
                >
                  {Object.entries(paymentLabels)
                    .filter(([value]) => value !== "accrual")
                    .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                    ))}
                </select>
              </label>
              <label>
                Belge
                <select
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      documentType: event.target.value as DocumentType,
                    })
                  }
                  value={paymentForm.documentType}
                >
                  {Object.entries(documentLabels)
                    .filter(([value]) => value !== "stock_record")
                    .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                    ))}
                </select>
              </label>
              {paymentForm.documentType !== "none" ? (
                <label>
                  Belge / dekont no
                  <input
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        documentRef: event.target.value,
                      })
                    }
                    placeholder="Sonradan da eklenebilir"
                    value={paymentForm.documentRef}
                  />
                </label>
              ) : null}
              <label>
                KDV
                <select
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      vatRate: event.target.value,
                    })
                  }
                  value={paymentForm.vatRate}
                >
                  <option value="0">%0</option>
                  <option value="0.01">%1</option>
                  <option value="0.1">%10</option>
                  <option value="0.2">%20</option>
                </select>
              </label>
              <label className="span-2">
                Not
                <input
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      note: event.target.value,
                    })
                  }
                  placeholder="İsteğe bağlı"
                  value={paymentForm.note}
                />
              </label>
            </div>
            <p className="recurring-rational-note">
              Belgeyi sonra seçersen ödeme kasadan düşer; belge eklenene kadar
              muhasebe gideri olarak ayrıca işaretlenmez.
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setPayingOccurrence(null)}
                type="button"
              >
                Vazgeç
              </button>
              <button
                className="primary-button"
                disabled={saving}
                type="submit"
              >
                {saving ? "İşleniyor…" : "Ödendi olarak kaydet"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
