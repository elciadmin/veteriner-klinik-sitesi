"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { parseFinanceCommand, resolveFinanceCommand } from "@/lib/finance-command.mjs";
import { ledgerStatus } from "@/lib/finance.mjs";
import {
  denominationDescriptor,
  indexedAmountValue,
  indexedLedgerValue,
  indexedQuantityForAmount,
  remainingDenomination,
} from "@/lib/indexed-ledger.mjs";
import { evaluateGoal, goalActualValue } from "@/lib/growth-planner.mjs";
import { projectRecurringExpenses } from "@/lib/recurring.mjs";
import type { ClinicTransaction, PaymentChannel } from "./operational-modules";
import type { FinancialGoal } from "./goals-view";

type WorkspaceView =
  | "today" | "work" | "records" | "cash" | "reports" | "settings"
  | "daily" | "ledger" | "debts" | "recurring" | "inventory" | "calendar"
  | "decision" | "goals" | "import" | "checks";

type PaymentLike = {
  amount: number;
  denominationQuantity?: number;
  denominationUnitPrice?: number;
  status?: "cancelled";
};

export type CommandLedgerRecord = {
  id: string;
  type: "receivable" | "payable";
  counterparty: string;
  detail: string;
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
  payments: PaymentLike[];
};

type RecurringRuleLike = {
  id: string;
  name: string;
  category: string;
  counterparty: string;
  amount: number;
  amountMode: "fixed" | "estimated";
  frequencyMonths: number;
  recurrenceKind?: string;
  recurrenceInterval?: number;
  recurrenceDayOfWeek?: number;
  recurrenceDayOfMonth?: number;
  businessDayRule?: string;
  startDate: string;
  endDate?: string;
  nextReviewDate?: string;
  paymentMethod: PaymentChannel;
  documentType: string;
  vatRate: number;
  active: boolean;
  note: string;
};


type InstallmentScheduleLike = {
  id: string;
  ledgerRecordId: string;
  installmentNo: number;
  dueDate: string;
  amount: number;
  denominationQuantity?: number;
  status: string;
  paymentId?: string;
};

type RecurringOccurrenceLike = {
  id: string;
  ruleId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  status: "planned" | "paid" | "skipped";
  paidDate?: string;
  transactionId?: string;
  paymentMethod?: PaymentChannel;
  documentType?: string;
  documentRef?: string;
  note?: string;
};

export type NewLedgerRecordInput = {
  type: "receivable" | "payable";
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
};

export type DirectLedgerPaymentInput = {
  amount: number;
  method: PaymentChannel;
  note: string;
  denominationCode?: string;
  denominationQuantity?: number;
  denominationUnitPrice?: number;
};

export type NewRecurringRuleInput = {
  name: string;
  category: string;
  counterparty: string;
  amount: number;
  startDate: string;
  paymentMethod: PaymentChannel;
  recurrence: {
    kind: "weekly" | "monthly" | "yearly" | "once";
    interval: number;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    businessDayRule?: "none" | "last_business_day";
  };
};

type CommandSaveResult = { ok: boolean; error?: string };

const TRY = new Intl.NumberFormat("tr-TR", {
  style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function formatMoney(value: number) { return TRY.format(Number(value || 0)); }
function formatDate(value: string) { return value ? DATE.format(new Date(`${value}T00:00:00Z`)) : "—"; }
function currentTimeInIstanbul() {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", hour12: false, minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date());
}
function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}
function remaining(record: CommandLedgerRecord) {
  if (String(record.denominationCode || "TRY") !== "TRY") {
    const value = indexedLedgerValue(record, record.denominationOpenUnitPrice || 0).currentValue;
    return value ?? Math.max(0, Number(record.originalAmount || 0));
  }
  const paid = record.payments.filter((payment) => payment.status !== "cancelled").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return Math.max(0, Number(record.originalAmount || 0) - paid);
}
function paymentLabel(method: PaymentChannel) {
  if (method === "card") return "Kart / POS";
  if (method === "transfer") return "Havale / EFT";
  if (method === "accrual") return "Tahakkuk";
  return "Nakit";
}
function resolvedLabel(intent: string) {
  const labels: Record<string, string> = {
    receivable_payment: "Alacak tahsilatı", payable_payment: "Borç ödemesi",
    unmatched_receivable_payment: "Cari eşleştirme gerekli",
    unmatched_payable_payment: "Cari eşleştirme gerekli",
    new_receivable: "Yeni alacak", new_payable: "Yeni borç", installment_payable: "Taksitli borç",
    recurring_expense: "Sabit / tekrarlayan gider", expense: "Gider", income: "Gelir",
  };
  return labels[intent] || "İşlem";
}
function Kpi({ label, value, note, tone = "neutral" }: { label: string; value: string; note: string; tone?: string }) {
  return <article className={`command-kpi ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
function nativeValueLabel(parsed: ReturnType<typeof parseFinanceCommand>) {
  if (!parsed.isIndexed) return formatMoney(parsed.amount || 0);
  const descriptor = denominationDescriptor({
    denominationCode: parsed.denominationCode,
    denominationPurity: parsed.denominationPurity,
    denominationKarat: parsed.denominationKarat,
    denominationMillesimal: parsed.denominationMillesimal,
  });
  return `${Number(parsed.denominationQuantity || 0).toLocaleString("tr-TR", { maximumFractionDigits: 6 })} ${descriptor.display}`;
}

export function FinanceCommandCenter({
  today, transactions, records, recurringRules, recurringOccurrences, installmentSchedules, goals, cashReserveValue,
  onSaveTransaction, onUndoTransaction, onSaveLedgerPayment, onCreateLedgerRecord,
  onCreateRecurringRule, onNavigate, onOpenReceiptScanner,
}: {
  today: string;
  transactions: ClinicTransaction[];
  records: CommandLedgerRecord[];
  recurringRules: RecurringRuleLike[];
  recurringOccurrences: RecurringOccurrenceLike[];
  installmentSchedules: InstallmentScheduleLike[];
  goals: FinancialGoal[];
  cashReserveValue?: number | null;
  onSaveTransaction: (transaction: ClinicTransaction) => Promise<boolean> | boolean;
  onUndoTransaction: (transaction: ClinicTransaction) => Promise<boolean> | boolean;
  onSaveLedgerPayment: (recordId: string, input: DirectLedgerPaymentInput) => Promise<CommandSaveResult>;
  onCreateLedgerRecord: (input: NewLedgerRecordInput) => Promise<boolean>;
  onCreateRecurringRule: (input: NewRecurringRuleInput) => Promise<boolean>;
  onNavigate: (view: WorkspaceView) => void;
  onOpenReceiptScanner: () => void;
}) {
  const [command, setCommand] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>("cash");
  const [dueDate, setDueDate] = useState(addDays(today, 30));
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [marketRates, setMarketRates] = useState<Record<string, number | null>>({ TRY: 1 });
  const [rateAsOf, setRateAsOf] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadRates() {
      try {
        const response = await fetch("/api/market-rates", { cache: "no-store" });
        const payload = await response.json() as { ok?: boolean; rates?: Record<string, number | null>; asOf?: string };
        if (!cancelled && response.ok && payload.ok && payload.rates) {
          setMarketRates(payload.rates); setRateAsOf(payload.asOf || "");
        }
      } catch { /* kur servisi olmadan TRY çalışır */ }
    }
    loadRates();
    const timer = window.setInterval(loadRates, 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const parsed = useMemo(() => resolveFinanceCommand(parseFinanceCommand(command), records), [command, records]);
  const candidateRecords = parsed.matches.map((item: { record: CommandLedgerRecord }) => item.record);
  const selectedRecord = candidateRecords.find((record: CommandLedgerRecord) => record.id === selectedRecordId) ?? candidateRecords[0];

  function currentRecordValue(record: CommandLedgerRecord) {
    const code = String(record.denominationCode || "TRY");
    if (code === "TRY") return remaining(record);
    return indexedLedgerValue(record, marketRates[code] || record.denominationOpenUnitPrice || 0).currentValue ?? remaining(record);
  }

  const activeTransactions = transactions.filter((item) => item.status !== "cancelled");
  const todayRows = activeTransactions.filter((item) => item.date === today);
  const todayIncome = todayRows.filter((item) => item.kind === "income" && item.postingMode !== "cash_only").reduce((sum, item) => sum + item.amount, 0);
  const todayExpense = todayRows.filter((item) => item.kind === "expense" && item.postingMode !== "cash_only").reduce((sum, item) => sum + item.amount, 0);
  const todayCash = todayRows.filter((item) => item.paymentMethod === "cash").reduce((sum, item) => sum + (item.kind === "income" ? item.amount : -item.amount), 0);
  const pendingPos = activeTransactions.filter((item) => item.kind === "income" && item.paymentMethod === "card" && item.posStatus !== "settled").reduce((sum, item) => sum + item.amount, 0);
  const receivable = records.filter((record) => record.type === "receivable").reduce((sum, record) => sum + currentRecordValue(record), 0);
  const payable = records.filter((record) => record.type === "payable").reduce((sum, record) => sum + currentRecordValue(record), 0);

  const recurringSchedule = useMemo(() => {
    try { return projectRecurringExpenses(recurringRules, recurringOccurrences, today, { monthsAhead: 2, monthsBack: 2 }) as Array<{ id: string; ruleId: string; dueDate: string; expectedAmount: number; status: "planned" | "paid" | "skipped"; overdue?: boolean }>; }
    catch { return []; }
  }, [recurringRules, recurringOccurrences, today]);
  const ruleMap = useMemo(() => new Map(recurringRules.map((rule) => [rule.id, rule] as const)), [recurringRules]);
  const recordMap = useMemo(() => new Map(records.map((record) => [record.id, record] as const)), [records]);
  const upcomingRecurring = recurringSchedule.filter((item) => item.status === "planned").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const upcomingInstallments = installmentSchedules
    .filter((item) => item.status !== "paid" && item.status !== "cancelled" && item.dueDate <= addDays(today, 30))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  const urgentRecords = records.filter((record) => (String(record.denominationCode || "TRY") === "TRY" ? remaining(record) > 0 : remainingDenomination(record) > 0) && record.dueDate)
    .map((record) => ({ record, status: ledgerStatus({ ...record, today }) })).filter(({ status }) => status.daysToDue <= 7)
    .sort((a, b) => a.status.daysToDue - b.status.daysToDue).slice(0, 5);
  const recent = [...activeTransactions].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 7);

  const goalCards = goals.filter((goal) => goal.active).slice(0, 3).map((goal) => {
    const goalForActual = goal.metric === "cash_reserve" && cashReserveValue !== null && cashReserveValue !== undefined
      ? { ...goal, currentOverride: cashReserveValue }
      : goal;
    const actual = goalActualValue(goalForActual, activeTransactions, records as any, today, marketRates);
    return { goal, result: evaluateGoal(goal, actual, today) };
  });

  function prepare(event?: FormEvent) {
    event?.preventDefault(); setError(""); setMessage("");
    const hasValue = parsed.isIndexed ? Number(parsed.denominationQuantity || 0) > 0 : Number(parsed.amount || 0) > 0;
    if (!hasValue) {
      setError("Komutta tutar/miktarı anlayamadım. Örn: “1250 TL Elif Tuğba Bilimden nakit” veya “10 gram 14 ayar altın borç”.");
      setPreviewOpen(false); return;
    }
    setPaymentMethod(parsed.paymentMethod as PaymentChannel);
    if (candidateRecords.length) setSelectedRecordId(candidateRecords[0].id);
    const code = parsed.isIndexed ? parsed.denominationCode : selectedRecord?.denominationCode;
    const suggested = code ? marketRates[code] : null;
    setUnitPrice(suggested ? String(suggested) : "");
    setPreviewOpen(true);
  }

  async function confirm() {
    setSaving(true); setError(""); setMessage("");
    try {
      const method = paymentMethod;
      const indexedPrice = Number(unitPrice || 0);
      if (parsed.resolvedIntent === "unmatched_receivable_payment" || parsed.resolvedIntent === "unmatched_payable_payment") {
        throw new Error("Bu ödeme için açık cari bulunamadı. Önce Cari defterden hasta sahibi / tedarikçi borcunu açın; sonra aynı adı yazarak tahsilatı işleyin. Ödeme yanlışlıkla gelir veya gider yapılmadı.");
      } else if (parsed.resolvedIntent === "receivable_payment" || parsed.resolvedIntent === "payable_payment") {
        if (!selectedRecord) throw new Error("Eşleşen cari kayıt seçilmedi.");
        const code = String(selectedRecord.denominationCode || "TRY");
        if (code === "TRY") {
          if (!parsed.amount) throw new Error("TL tahsilat/ödeme tutarı bulunamadı.");
          const open = remaining(selectedRecord);
          if (parsed.amount > open + 0.0001) throw new Error(`Girilen tutar kalan bakiyeyi aşıyor. Kalan: ${formatMoney(open)}.`);
          const result = await onSaveLedgerPayment(selectedRecord.id, { amount: parsed.amount, method, note: `Hızlı komut: ${command.trim()}` });
          if (!result.ok) throw new Error(result.error || "Tahsilat/ödeme kaydedilemedi.");
          setMessage(`${selectedRecord.counterparty} hesabına ${formatMoney(parsed.amount)} işlendi.`);
        } else {
          if (!indexedPrice) throw new Error("İşlem günündeki TL birim değerini girin veya kayıtlı değeri kullanın.");
          const paymentQuantity = parsed.isIndexed
            ? (parsed.denominationCode === code ? parsed.denominationQuantity : null)
            : indexedQuantityForAmount(selectedRecord, parsed.amount, indexedPrice);
          if (!paymentQuantity) throw new Error(`Bu cari ${denominationDescriptor(selectedRecord).display} üzerinden tutuluyor. Gram/miktar veya TL ödeme tutarı bulunamadı.`);
          const remainQty = remainingDenomination(selectedRecord);
          if (paymentQuantity > remainQty + 1e-8) throw new Error(`Miktar kalan ${remainQty.toLocaleString("tr-TR")} bakiyeyi aşamaz.`);
          const amount = indexedAmountValue(selectedRecord, paymentQuantity, indexedPrice) ?? 0;
          const result = await onSaveLedgerPayment(selectedRecord.id, {
            amount, method, note: `Hızlı komut: ${command.trim()}`, denominationCode: code,
            denominationQuantity: paymentQuantity, denominationUnitPrice: indexedPrice,
          });
          if (!result.ok) throw new Error(result.error || "Endeksli ödeme kaydedilemedi.");
          setMessage(`${selectedRecord.counterparty}: ${paymentQuantity.toLocaleString("tr-TR", { maximumFractionDigits: 8 })} ${denominationDescriptor(selectedRecord).display} (${formatMoney(amount)}) ödeme işlendi.`);
        }
      } else if (["new_receivable", "new_payable", "installment_payable"].includes(parsed.resolvedIntent)) {
        const counterparty = parsed.counterpartyQuery.trim();
        if (!counterparty) throw new Error("Borç/alacak için kişi veya firma adını anlayamadım.");
        let amount = Number(parsed.amount || 0);
        if (parsed.isIndexed) {
          if (!indexedPrice) throw new Error("Kıymetli maden/döviz kaydı için bugünkü TL birim değerini girin.");
          amount = indexedAmountValue({
            denominationCode: parsed.denominationCode, denominationPurity: parsed.denominationPurity,
            denominationKarat: parsed.denominationKarat, denominationMillesimal: parsed.denominationMillesimal,
          }, parsed.denominationQuantity, indexedPrice) ?? 0;
        }
        if (!amount) throw new Error("Açılış TL değeri hesaplanamadı.");
        const descriptor = denominationDescriptor({
          denominationCode: parsed.denominationCode, denominationPurity: parsed.denominationPurity,
          denominationKarat: parsed.denominationKarat, denominationMillesimal: parsed.denominationMillesimal,
        });
        const ok = await onCreateLedgerRecord({
          type: parsed.resolvedIntent === "new_receivable" ? "receivable" : "payable",
          counterparty, detail: `Hızlı komut: ${command.trim()}`, createdDate: today, dueDate, amount, reminderDays: 3,
          denominationCode: parsed.denominationCode,
          denominationQuantity: parsed.isIndexed ? parsed.denominationQuantity || 0 : amount,
          denominationOpenUnitPrice: parsed.isIndexed ? indexedPrice : 1,
          denominationRateSource: parsed.isIndexed ? (marketRates[parsed.denominationCode] ? "market-rates" : "manual") : "TRY",
          denominationAssetClass: parsed.denominationAssetClass,
          denominationUnit: parsed.denominationUnit,
          denominationPurity: parsed.denominationPurity,
          denominationKarat: parsed.denominationKarat,
          denominationMillesimal: parsed.denominationMillesimal,
          denominationLabel: descriptor.display,
          installmentCount: parsed.installmentCount,
        });
        if (!ok) throw new Error("Cari kayıt oluşturulamadı.");
        setMessage(`${counterparty} için ${nativeValueLabel(parsed)} ${parsed.resolvedIntent === "new_receivable" ? "alacak" : "borç"} kaydedildi.`);
      } else if (parsed.resolvedIntent === "recurring_expense") {
        if (!parsed.amount || !parsed.recurrence) throw new Error("Tekrarlayan gider tutarı veya tekrar kuralı eksik.");
        const ok = await onCreateRecurringRule({
          name: parsed.counterpartyQuery.trim() || "Dönemsel gider", category: "Sabit / dönemsel gider",
          counterparty: parsed.counterpartyQuery.trim(), amount: parsed.amount, startDate: today,
          paymentMethod: method, recurrence: parsed.recurrence,
        });
        if (!ok) throw new Error("Sabit gider kuralı oluşturulamadı.");
        setMessage(`${formatMoney(parsed.amount)} dönemsel gider takvime eklendi; tarihleri sistem ilerletecek.`);
      } else {
        if (!parsed.amount) throw new Error("Gelir/gider tutarı bulunamadı.");
        const income = parsed.resolvedIntent === "income";
        const description = parsed.counterpartyQuery.trim() || (income ? "Hızlı gelir" : "Hızlı gider");
        const transaction: ClinicTransaction = {
          id: `command-${crypto.randomUUID()}`, date: today, time: currentTimeInIstanbul(), kind: income ? "income" : "expense",
          category: income ? (parsed.businessClass === "product" ? "Ürün geliri" : parsed.businessClass === "service" ? "Hizmet geliri" : "Ek gelir") : (parsed.businessClass === "investment" ? "Yatırım gideri" : parsed.businessClass === "fixed" ? "Sabit gider" : "Değişken gider"),
          description, counterparty: parsed.counterpartyQuery.trim() || (income ? "Genel klinik geliri" : "Karşı taraf belirtilmedi"),
          operationType: income ? (parsed.businessClass === "product" ? "product_sale" : "service") : "overhead",
          costBehavior: income ? "non_expense" : parsed.businessClass === "fixed" ? "fixed" : "variable",
          businessClass: parsed.businessClass, amount: parsed.amount, paymentMethod: method,
          documentType: income ? "receipt" : "none", documentRef: "", vatRate: 0, postingMode: "economic_and_cash",
          sourceModule: "finance_command_bar", sourceRecordId: `command-${Date.now()}`,
        };
        const ok = await onSaveTransaction(transaction); if (!ok) throw new Error("Hareket kaydedilemedi.");
        setMessage(`${formatMoney(parsed.amount)} ${income ? "gelir" : "gider"} ${paymentLabel(method)} olarak kaydedildi.`);
      }
      setCommand(""); setPreviewOpen(false); setSelectedRecordId(""); setUnitPrice("");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Komut uygulanamadı."); }
    finally { setSaving(false); }
  }

  const previewNeedsRate = parsed.isIndexed || Boolean(selectedRecord && String(selectedRecord.denominationCode || "TRY") !== "TRY");
  const previewValue = nativeValueLabel(parsed);
  const convertedPaymentQuantity = selectedRecord && String(selectedRecord.denominationCode || "TRY") !== "TRY" && !parsed.isIndexed && Number(parsed.amount || 0) > 0 && Number(unitPrice || 0) > 0
    ? indexedQuantityForAmount(selectedRecord, Number(parsed.amount), Number(unitPrice))
    : null;

  return (
    <section className="command-center-stack">
      <section className="command-hero panel">
        <div className="command-hero-copy">
          <span className="eyebrow">V10 · Finansal işletim sistemi</span>
          <h1>Olanı yaz; muhasebesini sistem yapsın.</h1>
          <p>Tarih bugüne gelir, cari eşleşir, vade/takvim ilerler, döviz ve kıymetli maden kendi biriminde korunur. Kaydetmeden önce ne anladığını gösterir.</p>
        </div>
        <form className="finance-command-form" onSubmit={prepare}>
          <div className="finance-command-input-wrap">
            <span className="finance-command-symbol">›</span>
            <input aria-label="Finans komutu" onChange={(event) => { setCommand(event.target.value); setPreviewOpen(false); setError(""); }} placeholder="Örn. 1250 TL Elif Tuğba Bilimden nakit" value={command} />
            <button disabled={!command.trim()} type="submit">Yorumla</button>
          </div>
          <div className="finance-command-examples">
            {["Ayşe Hanımdan 5000 TL nakit", "Hasvet'e 3000 TL havale ödedim", "10 gram 14 ayar altın Hasan Beyden alacağım var", "250 gram 925 gümüş alacak yaz", "Kira 25000 TL her ayın 1'i gider"].map((example) => (
              <button key={example} onClick={() => { setCommand(example); setPreviewOpen(false); }} type="button">{example}</button>
            ))}
          </div>
        </form>

        {previewOpen ? (
          <div className="finance-command-preview v10-command-preview">
            <div><span>Ben bunu şöyle anladım</span><strong>{resolvedLabel(parsed.resolvedIntent)} · {previewValue}</strong><small>{parsed.counterpartyQuery || "Karşı taraf belirtilmedi"}</small></div>
            {(parsed.resolvedIntent === "receivable_payment" || parsed.resolvedIntent === "payable_payment") ? (
              <label>Cari kayıt<select onChange={(event) => setSelectedRecordId(event.target.value)} value={selectedRecord?.id || ""}>{candidateRecords.length ? candidateRecords.map((record: CommandLedgerRecord) => <option key={record.id} value={record.id}>{record.counterparty} · {String(record.denominationCode || "TRY") === "TRY" ? formatMoney(remaining(record)) : `${remainingDenomination(record).toLocaleString("tr-TR", { maximumFractionDigits: 6 })} ${denominationDescriptor(record).display}`}</option>) : <option value="">Eşleşme bulunamadı</option>}</select></label>
            ) : null}
            {(parsed.resolvedIntent === "unmatched_receivable_payment" || parsed.resolvedIntent === "unmatched_payable_payment") ? (
              <p className="form-error command-error">Açık cari bulunamadı. Bu satır gelir/gider olarak kaydedilmeyecek; önce ilgili cari kaydı oluşturulmalı.</p>
            ) : null}
            {(["new_receivable", "new_payable", "installment_payable"].includes(parsed.resolvedIntent)) ? <label>Vade<input onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} /></label> : null}
            {previewNeedsRate ? <label>Güncel birim TL değeri<input min="0.000001" onChange={(event) => setUnitPrice(event.target.value)} placeholder="Birim fiyat" step="0.000001" type="number" value={unitPrice} /></label> : null}
            {convertedPaymentQuantity && selectedRecord ? <p className="command-conversion-note">{formatMoney(Number(parsed.amount))} ödeme, girilen fiyata göre <strong>{convertedPaymentQuantity.toLocaleString("tr-TR", { maximumFractionDigits: 8 })} {denominationDescriptor(selectedRecord).display}</strong> borç azaltır.</p> : null}
            {!(["new_receivable", "new_payable", "installment_payable"].includes(parsed.resolvedIntent)) ? <label>Ödeme kanalı<select onChange={(event) => setPaymentMethod(event.target.value as PaymentChannel)} value={paymentMethod}><option value="cash">Nakit</option><option value="card">Kart / POS</option><option value="transfer">Havale / EFT</option></select></label> : null}
            <button className="command-confirm" disabled={saving} onClick={confirm} type="button">{saving ? "Kaydediliyor…" : "Onayla ve kaydet"}</button>
          </div>
        ) : null}
        {message ? <p className="command-success">✓ {message}</p> : null}
        {error ? <p className="form-error command-error">{error}</p> : null}
      </section>

      <section className="command-kpi-grid">
        <Kpi label="Bugün gelir" value={formatMoney(todayIncome)} note={`${todayRows.filter((item) => item.kind === "income").length} hareket`} tone="income" />
        <Kpi label="Bugün gider" value={formatMoney(todayExpense)} note={`${todayRows.filter((item) => item.kind === "expense").length} hareket`} tone="expense" />
        <Kpi label="Bugün nakit farkı" value={formatMoney(todayCash)} note="Nakit giriş − çıkış" tone={todayCash < 0 ? "warning" : "neutral"} />
        <Kpi label="Bekleyen POS" value={formatMoney(pendingPos)} note="Bankaya yatışı beklenen brüt" tone={pendingPos ? "warning" : "neutral"} />
        <Kpi label="Açık alacak" value={formatMoney(receivable)} note={rateAsOf ? "TL + güncel/kayıtlı değer" : "TL / açılış değeri"} tone="income" />
        <Kpi label="Açık borç" value={formatMoney(payable)} note={rateAsOf ? "TL + güncel/kayıtlı değer" : "TL / açılış değeri"} tone="expense" />
      </section>

      {goalCards.length ? <section className="v10-command-goals panel"><div className="panel-head"><div><span className="eyebrow">Büyüme hedefleri</span><h2>Hedefin neresindeyiz?</h2></div><button className="text-button" onClick={() => onNavigate("goals")} type="button">Grafik ve tahmini aç</button></div><div className="v10-command-goal-grid">{goalCards.map(({ goal, result }) => <button key={goal.id} onClick={() => onNavigate("goals")} type="button"><span>{goal.name}</span><strong>%{result.progressPercent.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</strong><i><b style={{ width: `${Math.min(100, result.progressPercent)}%` }} /></i><small>{result.status === "behind" ? "Hedef temposunun gerisinde" : result.status === "ahead" ? "Hedefin önünde" : result.status === "achieved" ? "Tamamlandı" : "Hedef temposunda"}</small></button>)}</div></section> : null}

      <section className="command-shortcuts" aria-label="Hızlı erişim">
        <button onClick={() => onNavigate("daily")} type="button"><span>＋</span><strong>Hareket</strong><small>Gelir / gider</small></button>
        <button onClick={() => onNavigate("ledger")} type="button"><span>₺</span><strong>Cari defter</strong><small>Alacak / tahsilat</small></button>
        <button onClick={() => onNavigate("debts")} type="button"><span>↔</span><strong>Borçlar</strong><small>Vade / ödeme</small></button>
        <button onClick={() => onNavigate("recurring")} type="button"><span>□</span><strong>Sabit gider</strong><small>Takvim / uyarı</small></button>
        <button onClick={onOpenReceiptScanner} type="button"><span>▣</span><strong>Fiş fotoğrafı</strong><small>Oku / kontrol et</small></button>
        <button onClick={() => onNavigate("inventory")} type="button"><span>◇</span><strong>Stok</strong><small>Alış / kritik stok</small></button>
        <button onClick={() => onNavigate("cash")} type="button"><span>✓</span><strong>Kasa & POS</strong><small>Mutabakat</small></button>
        <button onClick={() => onNavigate("goals")} type="button"><span>↗</span><strong>Hedefler</strong><small>Grafik / gelecek</small></button>
      </section>

      <section className="command-two-column">
        <article className="panel command-attention"><div className="panel-head"><div><span className="eyebrow">Takvim & cari</span><h2>Yaklaşan / geciken işler</h2></div><button className="text-button" onClick={() => onNavigate("calendar")} type="button">Takvimi aç</button></div><div className="command-attention-list">
          {urgentRecords.map(({ record, status }) => <button key={record.id} onClick={() => onNavigate(record.type === "receivable" ? "ledger" : "debts")} type="button"><span className={status.daysToDue < 0 ? "danger" : "warning"}>{status.daysToDue < 0 ? "!" : "•"}</span><div><strong>{record.counterparty}</strong><small>{record.type === "receivable" ? "Tahsil edilecek" : "Ödenecek"} · {formatDate(record.dueDate)}{String(record.denominationCode || "TRY") !== "TRY" ? ` · ${remainingDenomination(record).toLocaleString("tr-TR", { maximumFractionDigits: 6 })} ${denominationDescriptor(record).display}` : ""}</small></div><b>{formatMoney(currentRecordValue(record))}</b></button>)}
          {upcomingInstallments.map((installment) => { const record = recordMap.get(installment.ledgerRecordId); const overdue = installment.dueDate < today; return <button key={installment.id} onClick={() => onNavigate(record?.type === "receivable" ? "ledger" : "debts")} type="button"><span className={overdue ? "danger" : "warning"}>{overdue ? "!" : installment.installmentNo}</span><div><strong>{record?.counterparty || "Taksitli cari"}</strong><small>{overdue ? "Gecikti · " : ""}{installment.installmentNo}. taksit · {formatDate(installment.dueDate)}{installment.denominationQuantity ? ` · ${installment.denominationQuantity.toLocaleString("tr-TR", { maximumFractionDigits: 6 })} ${denominationDescriptor(record || {}).display}` : ""}</small></div><b>{formatMoney(installment.amount)}</b></button>; })}
          {upcomingRecurring.map((occurrence) => { const rule = ruleMap.get(occurrence.ruleId); return <button key={occurrence.id} onClick={() => onNavigate("recurring")} type="button"><span className={occurrence.overdue ? "danger" : ""}>{occurrence.overdue ? "!" : "□"}</span><div><strong>{rule?.name || "Sabit gider"}</strong><small>{occurrence.overdue ? "Gecikti · " : ""}{formatDate(occurrence.dueDate)} · {rule?.counterparty || "Planlı ödeme"}</small></div><b>{formatMoney(occurrence.expectedAmount)}</b></button>; })}
          {!urgentRecords.length && !upcomingRecurring.length && !upcomingInstallments.length ? <div className="workspace-empty"><strong>Yaklaşan zorunlu ödeme veya tahsilat yok.</strong><span>Sabit gider, taksit ve vade kayıtları burada otomatik görünür.</span></div> : null}
        </div></article>

        <article className="panel command-recent"><div className="panel-head"><div><span className="eyebrow">Kasa defteri</span><h2>Son hareketler</h2></div><button className="text-button" onClick={() => onNavigate("daily")} type="button">Tümünü gör</button></div><div className="command-recent-list">
          {recent.map((item) => <div key={item.id}><span className={item.kind === "income" ? "income" : "expense"}>{item.kind === "income" ? "+" : "−"}</span><div><strong>{item.description}</strong><small>{item.counterparty || "—"} · {paymentLabel(item.paymentMethod)} · {formatDate(item.date)}</small></div><div className="command-recent-amount"><b>{formatMoney(item.amount)}</b><button onClick={async () => { setError(""); const ok = await onUndoTransaction(item); if (ok) setMessage(`${item.description} hareketi geri alındı.`); else setError("Geri alma uygulanamadı. Sayfanın üstündeki ayrıntıda nedenini görebilirsin."); }} type="button">Geri al</button></div></div>)}
          {!recent.length ? <div className="workspace-empty"><strong>Henüz hareket yok.</strong><span>Yukarıdaki komut kutusundan ilk kaydı girebilirsin.</span></div> : null}
        </div></article>
      </section>
    </section>
  );
}
