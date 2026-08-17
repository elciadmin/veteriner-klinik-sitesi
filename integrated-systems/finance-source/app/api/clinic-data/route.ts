import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  financeAuditEvents,
  financialGoals,
  goalMilestones,
  financialEvents,
  financialJournalLines,
  idempotencyCommands,
  importBatchItems,
  importBatches,
  inventoryItems,
  ledgerLineItems,
  ledgerPayments,
  ledgerRecords,
  installmentSchedules,
  monthlyCloseEvents,
  monthlyClosings,
  productDefinitions,
  recurringExpenseOccurrences,
  recurringExpenseRules,
  settings,
  stockMovements,
  transactionAuditEvents,
  transactions,
  valuationRates,
} from "@/db/schema";
import {
  datePlusBusinessDays,
  expectedPosNet,
  normalizeLedgerPaymentMethod,
} from "@/lib/financial-core.mjs";
import {
  assessMonthlyClose,
  calculateMonthlyClose,
  isPeriodLocked,
  resolveOpeningBalances,
} from "@/lib/monthly-close.mjs";
import { FinanceAuthError, requireFinanceApiUser, type FinanceUser } from "@/lib/finance-auth";
import {
  historicalImportQuality,
  historicalImportSummary,
  validateHistoricalImportPackage,
} from "@/lib/historical-import.mjs";
import { indexedAmountValue, purityFactor } from "@/lib/indexed-ledger.mjs";
import {
  ACCOUNTS,
  assertBalanced,
  purchaseJournal,
  reversalJournal,
  saleJournal,
} from "@/lib/journal-core.mjs";

type TransactionInput = {
  id: string;
  date: string;
  time: string;
  kind: string;
  category: string;
  description: string;
  counterparty?: string;
  operationType?: string;
  costBehavior?: string;
  businessClass?: string;
  relatedIncomeId?: string;
  amount: number;
  paymentMethod: string;
  documentType: string;
  documentRef: string;
  vatRate: number;
  posRate?: number;
  posStatus?: string;
  settlementDate?: string;
  settledAmount?: number;
  settlementReference?: string;
  postingMode?: string;
  sourceModule?: string;
  sourceRecordId?: string;
  reversalOfId?: string;
  status?: string;
  isAutomatic?: boolean;
  sourceTransactionId?: string;
  importBatchId?: string;
};

type InventoryInput = {
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

type ProductDefinitionInput = {
  id: string;
  canonicalName: string;
  productFamily: string;
  baseUnit: string;
  attributes?: Record<string, unknown>;
  aliases?: string[];
};

type MovementInput = {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  type: string;
  quantity: number;
  unitCost?: number;
  packageCount?: number;
  unitsPerPackage?: number;
  totalCost?: number;
  lot?: string;
  expiryDate?: string;
  documentType?: string;
  documentRef?: string;
  transactionId?: string;
  importBatchId?: string;
  note: string;
};

type LedgerInput = {
  id: string;
  type: string;
  counterparty: string;
  contactName: string;
  phone: string;
  email: string;
  detail: string;
  documentRef: string;
  documentDate?: string;
  stage?: string;
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
  lineItems?: LedgerLineItemInput[];
};

type LedgerLineItemInput = {
  id: string;
  recordId: string;
  inventoryItemId?: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  trackStock?: boolean;
  stockMovementId?: string;
};

type PaymentInput = {
  id: string;
  recordId: string;
  amount: number;
  denominationCode?: string;
  denominationQuantity?: number;
  denominationUnitPrice?: number;
  date: string;
  method?: string;
  note?: string;
  status?: string;
  transactionId?: string;
  importBatchId?: string;
};

type RecurringRuleInput = {
  id: string;
  name: string;
  category: string;
  counterparty: string;
  amount: number;
  amountMode: string;
  frequencyMonths: number;
  recurrenceKind?: string;
  recurrenceInterval?: number;
  recurrenceDayOfWeek?: number;
  recurrenceDayOfMonth?: number;
  businessDayRule?: string;
  autoCreate?: boolean;
  startDate: string;
  endDate?: string;
  nextReviewDate?: string;
  paymentMethod: string;
  documentType: string;
  vatRate: number;
  active: boolean;
  note: string;
  importBatchId?: string;
};

type RecurringOccurrenceInput = {
  id: string;
  ruleId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  status: string;
  paidDate?: string;
  transactionId?: string;
  paymentMethod?: string;
  documentType?: string;
  documentRef?: string;
  note?: string;
};

type MonthlyCloseInput = {
  period: string;
  openingCash?: number;
  openingBank?: number;
  actualCash: number;
  actualBank: number;
  actualPosPending: number;
  varianceNote?: string;
};

type QuickReceiptLineInput = {
  transaction: TransactionInput;
  item?: InventoryInput;
  movement?: MovementInput;
  productDefinition?: ProductDefinitionInput;
};

type HistoricalImportInput = {
  schemaVersion: number;
  importId: string;
  source?: { fileName?: string; sha256?: string; generatedAt?: string };
  summary?: Record<string, number | string>;
  warnings?: string[];
  transactions: TransactionInput[];
  recurringRules: RecurringRuleInput[];
  ledgerPackage: {
    record?: LedgerInput | null;
    payments: PaymentInput[];
  };
};

type FinancialGoalInput = {
  id: string;
  name: string;
  metric: string;
  direction?: string;
  unit?: string;
  targetValue: number;
  baselineValue?: number;
  currentOverride?: number;
  startDate: string;
  endDate: string;
  scenarioMode?: string;
  active?: boolean;
  note?: string;
};

type GoalMilestoneInput = {
  id: string;
  goalId: string;
  label: string;
  targetValue: number;
  targetDate: string;
  completedAt?: string;
};

type ValuationRateInput = {
  id: string;
  assetCode: string;
  unitPrice: number;
  source?: string;
  effectiveAt: string;
};

type InstallmentScheduleInput = {
  id: string;
  ledgerRecordId: string;
  installmentNo: number;
  dueDate: string;
  amount: number;
  denominationQuantity?: number;
  status?: string;
  paymentId?: string;
};

type ClinicDataAction =
  | { action: "importHistoricalData"; package: HistoricalImportInput }
  | { action: "rollbackHistoricalImport"; batchId: string; reason: string }
  | { action: "saveTransactions"; records: TransactionInput[] }
  | { action: "saveInventoryItem"; item: InventoryInput }
  | {
      action: "saveQuickPurchase";
      transaction: TransactionInput;
      item: InventoryInput;
      movement: MovementInput;
    }
  | {
      action: "saveQuickReceipt";
      receiptId: string;
      lines: QuickReceiptLineInput[];
    }
  | {
      action: "saveStockMovement";
      item: InventoryInput;
      movement: MovementInput;
      transaction?: TransactionInput;
    }
  | {
      action: "saveLedgerRecord";
      record: LedgerInput;
      // Tedavi/hizmet gibi cari açılırken geliri doğuran kayıtlar için,
      // alacak ve tahakkuk geliri aynı D1 batch içinde oluşur.
      revenueTransaction?: TransactionInput;
    }
  | {
      action: "saveLedgerInvoice";
      record: LedgerInput;
      items: InventoryInput[];
      movements: MovementInput[];
    }
  | { action: "saveLedgerPayment"; payment: PaymentInput }
  | {
      action: "settlePosTransaction";
      transactionId: string;
      settlementDate: string;
      actualNetAmount: number;
      settlementReference: string;
    }
  | {
      action: "reverseTransaction";
      transactionId: string;
      reason: string;
      reversalDate: string;
    }
  | { action: "saveRecurringRule"; rule: RecurringRuleInput }
  | {
      action: "payRecurringOccurrence";
      occurrence: RecurringOccurrenceInput;
      transaction: TransactionInput;
    }
  | { action: "saveMonthlyClosing"; closing: MonthlyCloseInput }
  | { action: "reopenMonthlyClosing"; period: string; reason: string }
  | { action: "saveGoal"; goal: FinancialGoalInput }
  | { action: "saveGoalMilestone"; milestone: GoalMilestoneInput }
  | { action: "saveValuationRate"; rate: ValuationRateInput }
  | { action: "saveInstallmentPlan"; ledgerRecordId: string; schedules: InstallmentScheduleInput[] }
  | { action: "saveSetting"; key: string; value: string };

function cents(value: number | null | undefined) {
  return Math.round(Number(value ?? 0) * 100);
}

function basisPoints(value: number | undefined) {
  return Math.round(Number(value ?? 0) * 10_000);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The old daily screens still keep their operational transaction row.  From
 * V8 onward, every newly written daily row also creates an immutable balanced
 * journal event in the *same D1 batch*.  Existing pre-V8 rows stay readable;
 * they are not silently rewritten.
 */
function journalForLegacyTransaction(record: TransactionInput, trackedInInventory = false) {
  const grossCents = cents(record.amount);
  const rate = Number(record.vatRate ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new RouteInputError("KDV oranı %0 ile %100 arasında olmalıdır.");
  }
  const vatCents = rate > 0 ? Math.round(grossCents - grossCents / (1 + rate)) : 0;
  const netCents = grossCents - vatCents;
  if (record.kind === "income") {
    return saleJournal({
      netCents,
      outputVatCents: vatCents,
      paymentMethod: record.paymentMethod,
      counterparty: record.counterparty || "",
    });
  }
  if (record.kind === "expense") {
    return purchaseJournal({
      netCents,
      // Belgesiz bir satırda KDV indirimi üretmeyiz. Yönetim kaydı görünür
      // kalır, vergi ekranı ise onu indirilecek KDV saymaz.
      inputVatCents: record.documentType && record.documentType !== "none" ? vatCents : 0,
      paymentMethod: record.paymentMethod,
      trackedInInventory,
      counterparty: record.counterparty || "",
    });
  }
  if (record.kind === "withdrawal") {
    if (record.paymentMethod !== "cash" && record.paymentMethod !== "transfer") {
      throw new RouteInputError("İşletme sahibi çekimi yalnız kasa veya banka ile kaydedilebilir.");
    }
    const creditAccount = record.paymentMethod === "cash" ? ACCOUNTS.cash : ACCOUNTS.bank;
    const lines = [
      { accountCode: ACCOUNTS.ownerDraw, debitCents: grossCents, creditCents: 0 },
      { accountCode: creditAccount, debitCents: 0, creditCents: grossCents },
    ];
    assertBalanced(lines);
    return lines;
  }
  throw new RouteInputError("Jurnale aktarılamayan işlem türü.");
}

function legacyJournalEvent(
  record: TransactionInput,
  trackedInInventory = false,
) {
  const eventId = `evt-legacy-${record.id}`;
  const lines = journalForLegacyTransaction(record, trackedInInventory);
  return {
    eventId,
    event: {
      id: eventId,
      eventType: record.kind === "income" ? "sale" : record.kind === "expense" ? "purchase" : "owner_draw",
      effectiveDate: record.date,
      status: "posted",
      sourceModule: "legacy_transaction",
      sourceRecordId: record.id,
      counterparty: record.counterparty || "",
      description: record.description,
      documentId: record.documentRef || null,
      reversalOfId: null,
      payloadJson: JSON.stringify({ legacyTransactionId: record.id, paymentMethod: record.paymentMethod }),
    },
    lines,
  };
}

function transactionValues(record: TransactionInput) {
  return {
    id: record.id,
    date: record.date,
    time: record.time,
    kind: record.kind,
    category: record.category,
    description: record.description,
    counterparty: record.counterparty ?? "",
    operationType: record.operationType ?? "",
    costBehavior: record.costBehavior ?? "",
    relatedIncomeId: record.relatedIncomeId || null,
    amountCents: cents(record.amount),
    paymentMethod: record.paymentMethod,
    documentType: record.documentType || "none",
    documentRef: record.documentRef ?? "",
    vatRateBps: basisPoints(record.vatRate),
    posRateBps: basisPoints(record.posRate),
    posStatus: record.posStatus || null,
    settlementDate: record.settlementDate || null,
    settledAmountCents:
      record.settledAmount === undefined ? null : cents(record.settledAmount),
    settlementReference: record.settlementReference || "",
    postingMode: record.postingMode || "economic_and_cash",
    sourceModule: record.sourceModule || "manual",
    sourceRecordId: record.sourceRecordId || null,
    reversalOfId: record.reversalOfId || null,
    status: record.status || null,
    isAutomatic: Boolean(record.isAutomatic),
    sourceTransactionId: record.sourceTransactionId || null,
    importBatchId: record.importBatchId || null,
    updatedAt: new Date().toISOString(),
  };
}

function inventoryValues(item: InventoryInput) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    purchaseUnit: item.purchaseUnit || item.unit,
    unitsPerPackage: Number(item.unitsPerPackage || 1),
    quantity: Number(item.quantity),
    minimumQuantity: Number(item.minimumQuantity),
    unitCostCents: cents(item.unitCost),
    supplier: item.supplier || "",
    lot: item.lot || "",
    expiryDate: item.expiryDate || "",
    productDefinitionId: item.productDefinitionId || null,
    baseUnit: item.baseUnit || item.unit,
    baseUnitsPerPurchaseUnit: Number(item.baseUnitsPerPurchaseUnit || item.unitsPerPackage || 1),
    attributesJson: item.attributesJson || "{}",
    updatedAt: new Date().toISOString(),
  };
}

function productDefinitionValues(definition: ProductDefinitionInput) {
  const aliases = Array.from(
    new Set([
      definition.canonicalName.trim(),
      ...(definition.aliases ?? []).map((alias) => alias.trim()),
    ].filter(Boolean)),
  );
  if (!definition.id || !definition.canonicalName.trim() || !definition.productFamily.trim() || !definition.baseUnit.trim()) {
    throw new RouteInputError("Stok ürün kartında ad, aile ve temel birim zorunludur.");
  }
  return {
    id: definition.id,
    canonicalName: definition.canonicalName.trim(),
    productFamily: definition.productFamily.trim(),
    baseUnit: definition.baseUnit.trim(),
    attributesJson: stableJson(definition.attributes ?? {}),
    aliasesJson: stableJson(aliases),
    status: "active",
    updatedAt: new Date().toISOString(),
  };
}

function movementValues(movement: MovementInput) {
  return {
    id: movement.id,
    itemId: movement.itemId,
    itemName: movement.itemName,
    date: movement.date,
    type: movement.type,
    quantity: Number(movement.quantity),
    unitCostCents:
      movement.unitCost === undefined ? null : cents(movement.unitCost),
    packageCount: movement.packageCount ?? null,
    unitsPerPackage: movement.unitsPerPackage ?? null,
    totalCostCents:
      movement.totalCost === undefined ? null : cents(movement.totalCost),
    lot: movement.lot || null,
    expiryDate: movement.expiryDate || null,
    documentType: movement.documentType || null,
    documentRef: movement.documentRef || null,
    transactionId: movement.transactionId || null,
    note: movement.note || "",
  };
}

function ledgerValues(record: LedgerInput) {
  return {
    id: record.id,
    type: record.type,
    counterparty: record.counterparty,
    contactName: record.contactName || "",
    phone: record.phone || "",
    email: record.email || "",
    detail: record.detail,
    documentRef: record.documentRef || "",
    documentDate: record.documentDate || "",
    stage: record.stage || "note",
    createdDate: record.createdDate,
    dueDate: record.dueDate,
    originalAmountCents: cents(record.originalAmount),
    denominationCode: record.denominationCode || "TRY",
    denominationQuantity: Number(record.denominationQuantity ?? ((record.denominationCode || "TRY") === "TRY" ? record.originalAmount : 0)),
    denominationOpenUnitPriceCents: cents(record.denominationOpenUnitPrice ?? 1),
    denominationRateSource: record.denominationRateSource || "manual",
    denominationAssetClass: record.denominationAssetClass || ((record.denominationCode || "TRY").startsWith("X") ? "metal" : "currency"),
    denominationUnit: record.denominationUnit || ((record.denominationCode || "TRY").endsWith("_GRAM") ? "gram" : "unit"),
    denominationPurity: Number(record.denominationPurity ?? 1),
    denominationKarat: record.denominationKarat ?? null,
    denominationMillesimal: record.denominationMillesimal ?? null,
    denominationLabel: record.denominationLabel || "",
    reserveCents: cents(record.reserve),
    reminderDays: Number(record.reminderDays || 3),
    importBatchId: record.importBatchId || null,
  };
}

function lineItemValues(line: LedgerLineItemInput) {
  return {
    id: line.id,
    recordId: line.recordId,
    inventoryItemId: line.inventoryItemId || null,
    itemName: line.itemName,
    category: line.category || "",
    quantity: Number(line.quantity),
    unit: line.unit || "adet",
    unitPriceCents: cents(line.unitPrice),
    lineTotalCents: cents(line.lineTotal),
    trackStock: line.trackStock !== false,
    stockMovementId: line.stockMovementId || null,
  };
}

function recurringRuleValues(rule: RecurringRuleInput) {
  return {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    counterparty: rule.counterparty || "",
    amountCents: cents(rule.amount),
    amountMode: rule.amountMode || "fixed",
    frequencyMonths: Number(rule.frequencyMonths || 1),
    recurrenceKind: rule.recurrenceKind || "monthly",
    recurrenceInterval: Number(rule.recurrenceInterval || rule.frequencyMonths || 1),
    recurrenceDayOfWeek: rule.recurrenceDayOfWeek ?? null,
    recurrenceDayOfMonth: rule.recurrenceDayOfMonth ?? null,
    businessDayRule: rule.businessDayRule || "none",
    autoCreate: rule.autoCreate !== false,
    startDate: rule.startDate,
    endDate: rule.endDate || null,
    nextReviewDate: rule.nextReviewDate || null,
    paymentMethod: rule.paymentMethod || "transfer",
    documentType: rule.documentType || "none",
    vatRateBps: basisPoints(rule.vatRate),
    active: rule.active !== false,
    note: rule.note || "",
    importBatchId: rule.importBatchId || null,
    updatedAt: new Date().toISOString(),
  };
}

function recurringOccurrenceValues(
  occurrence: RecurringOccurrenceInput,
) {
  return {
    id: occurrence.id,
    ruleId: occurrence.ruleId,
    dueDate: occurrence.dueDate,
    expectedAmountCents: cents(occurrence.expectedAmount),
    actualAmountCents:
      occurrence.actualAmount === undefined
        ? null
        : cents(occurrence.actualAmount),
    status: occurrence.status || "paid",
    paidDate: occurrence.paidDate || null,
    transactionId: occurrence.transactionId || null,
    paymentMethod: occurrence.paymentMethod || null,
    documentType: occurrence.documentType || null,
    documentRef: occurrence.documentRef || "",
    note: occurrence.note || "",
    updatedAt: new Date().toISOString(),
  };
}

type TransactionRow = typeof transactions.$inferSelect;
type MonthlyClosingRow = typeof monthlyClosings.$inferSelect;

function transactionFromRow(row: TransactionRow) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    kind: row.kind,
    category: row.category,
    description: row.description,
    counterparty: row.counterparty,
    operationType: row.operationType,
    costBehavior: row.costBehavior,
    businessClass: row.businessClass,
    relatedIncomeId: row.relatedIncomeId ?? undefined,
    amount: row.amountCents / 100,
    paymentMethod: row.paymentMethod,
    documentType: row.documentType,
    documentRef: row.documentRef,
    vatRate: row.vatRateBps / 10_000,
    posRate: row.posRateBps / 10_000,
    posStatus: row.posStatus ?? undefined,
    settlementDate: row.settlementDate ?? undefined,
    settledAmount:
      row.settledAmountCents === null
        ? undefined
        : row.settledAmountCents / 100,
    settlementReference: row.settlementReference,
    postingMode: row.postingMode,
    sourceModule: row.sourceModule,
    sourceRecordId: row.sourceRecordId ?? undefined,
    reversalOfId: row.reversalOfId ?? undefined,
    status: row.status ?? undefined,
    isAutomatic: row.isAutomatic,
    sourceTransactionId: row.sourceTransactionId ?? undefined,
    importBatchId: row.importBatchId ?? undefined,
  };
}

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function monthlyClosingFromRow(row: MonthlyClosingRow) {
  return {
    period: row.periodKey,
    status: row.status,
    openingCash: row.openingCashCents / 100,
    openingBank: row.openingBankCents / 100,
    expectedCash: row.expectedCashCents / 100,
    expectedBank: row.expectedBankCents / 100,
    expectedPosPending: row.expectedPosPendingCents / 100,
    actualCash: row.actualCashCents / 100,
    actualBank: row.actualBankCents / 100,
    actualPosPending: row.actualPosPendingCents / 100,
    cashDifference: row.cashDifferenceCents / 100,
    bankDifference: row.bankDifferenceCents / 100,
    posDifference: row.posDifferenceCents / 100,
    income: row.incomeCents / 100,
    recognizedExpense: row.recognizedExpenseCents / 100,
    undocumentedOutflow: row.undocumentedOutflowCents / 100,
    withdrawals: row.withdrawalsCents / 100,
    posSettlements: row.posSettlementsCents / 100,
    dataQualityFlags: parseJsonArray(row.dataQualityJson),
    varianceNote: row.varianceNote,
    closedAt: row.closedAt ?? undefined,
    reopenedAt: row.reopenedAt ?? undefined,
    reopenReason: row.reopenReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function todayInIstanbul() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
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

function normalizedDocumentKey(
  counterparty: string | null | undefined,
  documentType: string | null | undefined,
  documentRef: string | null | undefined,
) {
  const ref = String(documentRef ?? "").trim().toLocaleUpperCase("tr-TR");
  if (!ref || documentType === "none") return "";
  return [
    String(counterparty ?? "").trim().toLocaleUpperCase("tr-TR"),
    String(documentType ?? "").trim().toLocaleLowerCase("tr-TR"),
    ref,
  ].join("::");
}

async function assertUniqueTransactionDocuments(
  db: Awaited<ReturnType<typeof getDb>>,
  records: TransactionInput[],
) {
  const candidates = records
    .map((record) => ({
      id: record.id,
      key: normalizedDocumentKey(
        record.counterparty,
        record.documentType,
        record.documentRef,
      ),
      label: record.documentRef,
      group:
        record.sourceModule === "quick_receipt"
          ? String(record.sourceRecordId || "")
          : "",
    }))
    .filter((record) => record.key);
  if (!candidates.length) return;

  const seen = new Map<string, { id: string; group: string }>();
  for (const candidate of candidates) {
    const prior = seen.get(candidate.key);
    const sameReceipt = Boolean(
      prior?.group && candidate.group && prior.group === candidate.group,
    );
    if (prior && prior.id !== candidate.id && !sameReceipt) {
      throw new RouteInputError(
        `${candidate.label} belge numarası aynı karşı taraf için bu kayıt paketinde iki kez kullanılmış.`,
        409,
      );
    }
    seen.set(candidate.key, { id: candidate.id, group: candidate.group });
  }

  const existing = await db
    .select({
      id: transactions.id,
      counterparty: transactions.counterparty,
      documentType: transactions.documentType,
      documentRef: transactions.documentRef,
      sourceModule: transactions.sourceModule,
      sourceRecordId: transactions.sourceRecordId,
      status: transactions.status,
    })
    .from(transactions);
  for (const candidate of candidates) {
    const duplicate = existing.find((row) => {
      const sameReceipt = Boolean(
        candidate.group &&
          row.sourceModule === "quick_receipt" &&
          row.sourceRecordId === candidate.group,
      );
      return (
        row.id !== candidate.id &&
        row.status !== "cancelled" &&
        !sameReceipt &&
        normalizedDocumentKey(
          row.counterparty,
          row.documentType,
          row.documentRef,
        ) === candidate.key
      );
    });
    if (duplicate) {
      throw new RouteInputError(
        `${candidate.label} belge numarası aynı karşı taraf için daha önce kaydedilmiş. Mükerrer kayıt engellendi.`,
        409,
      );
    }
  }
}

async function assertUniqueLedgerDocument(
  db: Awaited<ReturnType<typeof getDb>>,
  record: LedgerInput,
) {
  const key = normalizedDocumentKey(
    record.counterparty,
    record.stage === "invoiced" ? "invoice" : "ledger",
    record.documentRef,
  );
  if (!key) return;
  const existing = await db
    .select({
      id: ledgerRecords.id,
      counterparty: ledgerRecords.counterparty,
      documentRef: ledgerRecords.documentRef,
      stage: ledgerRecords.stage,
    })
    .from(ledgerRecords);
  const duplicate = existing.find(
    (row) =>
      row.id !== record.id &&
      normalizedDocumentKey(
        row.counterparty,
        row.stage === "invoiced" ? "invoice" : "ledger",
        row.documentRef,
      ) === key,
  );
  if (duplicate) {
    throw new RouteInputError(
      `${record.documentRef} belge numarası aynı karşı taraf için daha önce kaydedilmiş. Mükerrer borç/alacak engellendi.`,
      409,
    );
  }
}

function assertLedgerBasics(record: LedgerInput) {
  if (
    !["receivable", "payable"].includes(record.type) ||
    !record.counterparty?.trim() ||
    !record.detail?.trim() ||
    !record.createdDate ||
    !record.dueDate ||
    !Number.isFinite(Number(record.originalAmount)) ||
    Number(record.originalAmount) <= 0
  ) {
    throw new RouteInputError(
      "Borç/alacak türü, karşı taraf, açıklama, tarihler ve sıfırdan büyük tutar zorunludur.",
    );
  }
  if (record.dueDate < record.createdDate) {
    throw new RouteInputError("Vade tarihi kayıt tarihinden önce olamaz.");
  }
}

class RouteInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function closedPeriods(db: Awaited<ReturnType<typeof getDb>>) {
  const rows = await db
    .select({
      period: monthlyClosings.periodKey,
      status: monthlyClosings.status,
    })
    .from(monthlyClosings);
  return rows;
}

async function assertDatesUnlocked(
  db: Awaited<ReturnType<typeof getDb>>,
  dates: Array<string | null | undefined>,
) {
  const closings = await closedPeriods(db);
  const lockedDate = dates.find(
    (date) => date && isPeriodLocked(date, closings),
  );
  if (!lockedDate) return;
  throw new RouteInputError(
    `${lockedDate.slice(0, 7)} dönemi kapalı. Önce Kasa Kontrolü > Aylık Kapanış bölümünden gerekçeyle yeniden açın.`,
    409,
  );
}

async function assertTransactionWritesUnlocked(
  db: Awaited<ReturnType<typeof getDb>>,
  records: TransactionInput[],
) {
  const dates = records.map((record) => record.date);
  for (const record of records) {
    if (
      !record.date ||
      !record.time ||
      !["income", "expense", "withdrawal"].includes(record.kind) ||
      !["cash", "card", "transfer", "accrual"].includes(
        record.paymentMethod,
      ) ||
      !Number.isFinite(Number(record.amount)) ||
      Number(record.amount) <= 0
    ) {
      throw new RouteInputError(
        "İşlem tarihi, saati, türü, ödeme kanalı ve sıfırdan büyük tutarı zorunludur.",
      );
    }
    const postingMode = record.postingMode || "economic_and_cash";
    if (
      !["economic_and_cash", "cash_only", "economic_only"].includes(
        postingMode,
      )
    ) {
      throw new RouteInputError("Geçersiz muhasebe etkisi.");
    }
    if (
      record.kind === "income" &&
      record.paymentMethod === "card" &&
      record.settlementDate &&
      record.settlementDate < record.date
    ) {
      throw new RouteInputError(
        "POS yatış tarihi satış/tahsilat tarihinden önce olamaz.",
      );
    }
    const existing = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, record.id))
      .limit(1);
    if (existing[0]) {
      const current = existing[0];
      dates.push(current.date);
      if (
        current.sourceModule !== "manual" &&
        (record.date !== current.date ||
          record.kind !== current.kind ||
          cents(record.amount) !== current.amountCents ||
          record.paymentMethod !== current.paymentMethod ||
          (record.postingMode || "economic_and_cash") !==
            current.postingMode ||
          (record.sourceModule || "manual") !== current.sourceModule ||
          (record.sourceRecordId || null) !== current.sourceRecordId)
      ) {
        throw new RouteInputError(
          "Bağlı işlemin tutarı, tarihi veya muhasebe etkisi doğrudan değiştirilemez; kaynak modülden düzeltin.",
          409,
        );
      }
    }
  }
  await assertDatesUnlocked(db, dates);
  await assertUniqueTransactionDocuments(db, records);
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Beklenmeyen hata";
  if (message.includes("no such table")) {
    return "Veri tabloları henüz hazırlanmadı. Yeni site sürümünü yayımladıktan sonra tekrar deneyin.";
  }
  return message;
}

function routeStatus(error: unknown) {
  if (error instanceof FinanceAuthError) return error.status;
  return error instanceof RouteInputError ? error.status : 500;
}

function auditDescriptor(payload: ClinicDataAction) {
  if (payload.action === "importHistoricalData") return { entityType: "historical_import", entityId: payload.package.importId };
  if (payload.action === "saveTransactions") return { entityType: "transaction", entityId: payload.records.map((row) => row.id).join(",") };
  if (payload.action === "saveInventoryItem") return { entityType: "inventory", entityId: payload.item.id };
  if (payload.action === "saveQuickPurchase") return { entityType: "inventory", entityId: payload.item.id };
  if (payload.action === "saveQuickReceipt") return { entityType: "expense_receipt", entityId: payload.receiptId };
  if (payload.action === "saveStockMovement") return { entityType: "stock_movement", entityId: payload.movement.id };
  if (payload.action === "saveLedgerRecord" || payload.action === "saveLedgerInvoice") return { entityType: "ledger", entityId: payload.record.id };
  if (payload.action === "saveLedgerPayment") return { entityType: "ledger_payment", entityId: payload.payment.id };
  if (payload.action === "settlePosTransaction" || payload.action === "reverseTransaction") return { entityType: "transaction", entityId: payload.transactionId };
  if (payload.action === "saveRecurringRule") return { entityType: "recurring_rule", entityId: payload.rule.id };
  if (payload.action === "saveGoal") return { entityType: "financial_goal", entityId: payload.goal.id };
  if (payload.action === "saveGoalMilestone") return { entityType: "goal_milestone", entityId: payload.milestone.id };
  if (payload.action === "saveValuationRate") return { entityType: "valuation_rate", entityId: payload.rate.id };
  if (payload.action === "saveInstallmentPlan") return { entityType: "installment_plan", entityId: payload.ledgerRecordId };
  if (payload.action === "payRecurringOccurrence") return { entityType: "recurring_occurrence", entityId: payload.occurrence.id };
  if (payload.action === "saveMonthlyClosing") return { entityType: "monthly_closing", entityId: payload.closing.period };
  if (payload.action === "reopenMonthlyClosing") return { entityType: "monthly_closing", entityId: payload.period };
  if (payload.action === "saveSetting") return { entityType: "setting", entityId: payload.key };
  return { entityType: "system", entityId: "" };
}

function auditSnapshot(payload: ClinicDataAction) {
  const text = JSON.stringify(payload, (key, value) => {
    if (["phone", "email"].includes(key)) return value ? "[MASKELENDI]" : value;
    return value;
  });
  return text.length > 20_000 ? `${text.slice(0, 20_000)}…` : text;
}

async function appendFinanceAudit(
  db: Awaited<ReturnType<typeof getDb>>,
  user: FinanceUser,
  payload: ClinicDataAction,
  requestId: string,
  phase: "attempted" | "completed" = "completed",
) {
  const descriptor = auditDescriptor(payload);
  await db.insert(financeAuditEvents).values({
    id: crypto.randomUUID(),
    actorEmail: user.email,
    actorRole: user.role,
    action: `${payload.action}:${phase}`,
    entityType: descriptor.entityType,
    entityId: descriptor.entityId,
    requestId,
    payloadJson: auditSnapshot(payload),
    createdAt: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireFinanceApiUser(request, false);
    const db = await getDb();
    const [
      transactionRows,
      itemRows,
      productDefinitionRows,
      movementRows,
      recordRows,
      lineItemRows,
      paymentRows,
      recurringRuleRows,
      recurringOccurrenceRows,
      monthlyClosingRows,
      monthlyCloseEventRows,
      importBatchRows,
      goalRows,
      milestoneRows,
      valuationRateRows,
      installmentRows,
      settingRows,
      auditRows,
    ] = await Promise.all([
      db
        .select()
        .from(transactions)
        .orderBy(desc(transactions.date), desc(transactions.time)),
      db.select().from(inventoryItems).orderBy(asc(inventoryItems.name)),
      db.select().from(productDefinitions).orderBy(asc(productDefinitions.canonicalName)),
      db
        .select()
        .from(stockMovements)
        .orderBy(desc(stockMovements.date), desc(stockMovements.createdAt)),
      db
        .select()
        .from(ledgerRecords)
        .orderBy(asc(ledgerRecords.dueDate)),
      db
        .select()
        .from(ledgerLineItems)
        .orderBy(asc(ledgerLineItems.createdAt)),
      db
        .select()
        .from(ledgerPayments)
        .orderBy(asc(ledgerPayments.date), asc(ledgerPayments.createdAt)),
      db
        .select()
        .from(recurringExpenseRules)
        .orderBy(asc(recurringExpenseRules.name)),
      db
        .select()
        .from(recurringExpenseOccurrences)
        .orderBy(asc(recurringExpenseOccurrences.dueDate)),
      db
        .select()
        .from(monthlyClosings)
        .orderBy(desc(monthlyClosings.periodKey)),
      db
        .select()
        .from(monthlyCloseEvents)
        .orderBy(desc(monthlyCloseEvents.createdAt)),
      db
        .select()
        .from(importBatches)
        .orderBy(desc(importBatches.createdAt)),
      db.select().from(financialGoals).orderBy(asc(financialGoals.endDate)),
      db.select().from(goalMilestones).orderBy(asc(goalMilestones.targetDate)),
      db.select().from(valuationRates).orderBy(desc(valuationRates.effectiveAt)),
      db.select().from(installmentSchedules).orderBy(asc(installmentSchedules.dueDate)),
      db.select().from(settings),
      currentUser.role === "editor"
        ? db
            .select()
            .from(financeAuditEvents)
            .orderBy(desc(financeAuditEvents.createdAt))
            .limit(250)
        : Promise.resolve([]),
    ]);

    const paymentMap = new Map<
      string,
      Array<{
        id: string;
        amount: number;
        denominationCode?: string;
        denominationQuantity?: number;
        denominationUnitPrice?: number;
        date: string;
        method: string;
        note: string;
        status?: "cancelled";
        transactionId?: string;
        importBatchId?: string;
      }>
    >();
    const lineItemMap = new Map<
      string,
      Array<{
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
      }>
    >();
    for (const line of lineItemRows) {
      const rows = lineItemMap.get(line.recordId) ?? [];
      rows.push({
        id: line.id,
        recordId: line.recordId,
        inventoryItemId: line.inventoryItemId ?? undefined,
        itemName: line.itemName,
        category: line.category,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPriceCents / 100,
        lineTotal: line.lineTotalCents / 100,
        trackStock: line.trackStock,
        stockMovementId: line.stockMovementId ?? undefined,
      });
      lineItemMap.set(line.recordId, rows);
    }
    for (const payment of paymentRows) {
      const rows = paymentMap.get(payment.recordId) ?? [];
      rows.push({
        id: payment.id,
        amount: payment.amountCents / 100,
        denominationCode: payment.denominationCode ?? undefined,
        denominationQuantity: payment.denominationQuantity ?? undefined,
        denominationUnitPrice: payment.denominationUnitPriceCents === null ? undefined : payment.denominationUnitPriceCents / 100,
        date: payment.date,
        method: payment.method,
        note: payment.note,
        status:
          payment.status === "cancelled" ? "cancelled" : undefined,
        transactionId: payment.transactionId ?? undefined,
        importBatchId: payment.importBatchId ?? undefined,
      });
      paymentMap.set(payment.recordId, rows);
    }

    const visibleRecordRows = recordRows.filter((row) => row.stage !== "archived");
    const visibleRecordIds = new Set(visibleRecordRows.map((row) => row.id));
    const response = {
      hasData:
        transactionRows.length +
          itemRows.length +
          movementRows.length +
          visibleRecordRows.length +
          lineItemRows.length +
          recurringRuleRows.length +
          recurringOccurrenceRows.length +
          monthlyClosingRows.length +
          goalRows.length +
          milestoneRows.length +
          valuationRateRows.length +
          installmentRows.length >
        0,
      transactions: transactionRows.map(transactionFromRow),
      inventory: itemRows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        unit: row.unit,
        purchaseUnit: row.purchaseUnit ?? row.unit,
        unitsPerPackage: row.unitsPerPackage,
        quantity: row.quantity,
        minimumQuantity: row.minimumQuantity,
        unitCost: row.unitCostCents / 100,
        supplier: row.supplier,
        lot: row.lot,
        expiryDate: row.expiryDate,
        productDefinitionId: row.productDefinitionId ?? undefined,
        baseUnit: row.baseUnit ?? row.unit,
        baseUnitsPerPurchaseUnit: row.baseUnitsPerPurchaseUnit,
        attributesJson: row.attributesJson,
      })),
      productDefinitions: productDefinitionRows.map((row) => {
        let attributes: Record<string, unknown> = {};
        let aliases: string[] = [];
        try { attributes = JSON.parse(row.attributesJson) as Record<string, unknown>; } catch { attributes = {}; }
        try { aliases = JSON.parse(row.aliasesJson) as string[]; } catch { aliases = []; }
        return {
          id: row.id,
          canonicalName: row.canonicalName,
          productFamily: row.productFamily,
          baseUnit: row.baseUnit,
          attributes,
          aliases,
          status: row.status,
        };
      }),
      stockMovements: movementRows.map((row) => ({
        id: row.id,
        itemId: row.itemId,
        itemName: row.itemName,
        date: row.date,
        type: row.type,
        quantity: row.quantity,
        unitCost:
          row.unitCostCents === null ? undefined : row.unitCostCents / 100,
        packageCount: row.packageCount ?? undefined,
        unitsPerPackage: row.unitsPerPackage ?? undefined,
        totalCost:
          row.totalCostCents === null ? undefined : row.totalCostCents / 100,
        lot: row.lot ?? undefined,
        expiryDate: row.expiryDate ?? undefined,
        documentType: row.documentType ?? undefined,
        documentRef: row.documentRef ?? undefined,
        transactionId: row.transactionId ?? undefined,
        note: row.note,
      })),
      records: visibleRecordRows.map((row) => ({
        id: row.id,
        type: row.type,
        counterparty: row.counterparty,
        contactName: row.contactName,
        phone: row.phone,
        email: row.email,
        detail: row.detail,
        documentRef: row.documentRef,
        documentDate: row.documentDate,
        stage: row.stage,
        createdDate: row.createdDate,
        dueDate: row.dueDate,
        originalAmount: row.originalAmountCents / 100,
        denominationCode: row.denominationCode || "TRY",
        denominationQuantity: row.denominationQuantity || (row.denominationCode === "TRY" ? row.originalAmountCents / 100 : 0),
        denominationOpenUnitPrice: row.denominationOpenUnitPriceCents / 100,
        denominationRateSource: row.denominationRateSource || "manual",
        denominationAssetClass: row.denominationAssetClass || "currency",
        denominationUnit: row.denominationUnit || "unit",
        denominationPurity: row.denominationPurity || 1,
        denominationKarat: row.denominationKarat ?? undefined,
        denominationMillesimal: row.denominationMillesimal ?? undefined,
        denominationLabel: row.denominationLabel || "",
        reserve: row.reserveCents / 100,
        reminderDays: row.reminderDays,
        importBatchId: row.importBatchId ?? undefined,
        lineItems: lineItemMap.get(row.id) ?? [],
        payments: (paymentMap.get(row.id) ?? []).filter((payment) => visibleRecordIds.has(row.id)),
      })),
      recurringRules: recurringRuleRows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        counterparty: row.counterparty,
        amount: row.amountCents / 100,
        amountMode: row.amountMode,
        frequencyMonths: row.frequencyMonths,
        recurrenceKind: row.recurrenceKind || "monthly",
        recurrenceInterval: row.recurrenceInterval || row.frequencyMonths || 1,
        recurrenceDayOfWeek: row.recurrenceDayOfWeek ?? undefined,
        recurrenceDayOfMonth: row.recurrenceDayOfMonth ?? undefined,
        businessDayRule: row.businessDayRule || "none",
        autoCreate: row.autoCreate,
        startDate: row.startDate,
        endDate: row.endDate ?? undefined,
        nextReviewDate: row.nextReviewDate ?? undefined,
        paymentMethod: row.paymentMethod,
        documentType: row.documentType,
        vatRate: row.vatRateBps / 10_000,
        active: row.active,
        note: row.note,
      })),
      recurringOccurrences: recurringOccurrenceRows.map((row) => ({
        id: row.id,
        ruleId: row.ruleId,
        dueDate: row.dueDate,
        expectedAmount: row.expectedAmountCents / 100,
        actualAmount:
          row.actualAmountCents === null
            ? undefined
            : row.actualAmountCents / 100,
        status: row.status,
        paidDate: row.paidDate ?? undefined,
        transactionId: row.transactionId ?? undefined,
        paymentMethod: row.paymentMethod ?? undefined,
        documentType: row.documentType ?? undefined,
        documentRef: row.documentRef,
        note: row.note,
      })),
      monthlyClosings: monthlyClosingRows.map(monthlyClosingFromRow),
      monthlyCloseEvents: monthlyCloseEventRows.map((row) => {
        let snapshot: unknown = {};
        try {
          snapshot = JSON.parse(row.snapshotJson);
        } catch {
          snapshot = {};
        }
        return {
          id: row.id,
          period: row.periodKey,
          action: row.action,
          snapshot,
          reason: row.reason,
          createdAt: row.createdAt,
        };
      }),
      importBatches: importBatchRows.map((row) => {
        let warnings: string[] = [];
        try { warnings = JSON.parse(row.warningsJson) as string[]; } catch { warnings = []; }
        return {
          id: row.id,
          sourceFileName: row.sourceFileName,
          status: row.status,
          coverageStartDate: row.coverageStartDate,
          coverageEndDate: row.coverageEndDate,
          completenessBps: row.completenessBps,
          warnings,
          createdAt: row.createdAt,
          appliedAt: row.appliedAt ?? undefined,
          rolledBackAt: row.rolledBackAt ?? undefined,
          rollbackReason: row.rollbackReason,
        };
      }),
      goals: goalRows.map((row) => ({
        id: row.id, name: row.name, metric: row.metric, direction: row.direction, unit: row.unit,
        targetValue: row.targetValue, baselineValue: row.baselineValue, currentOverride: row.currentOverride ?? undefined,
        startDate: row.startDate, endDate: row.endDate, scenarioMode: row.scenarioMode, active: row.active, note: row.note,
      })),
      goalMilestones: milestoneRows.map((row) => ({
        id: row.id, goalId: row.goalId, label: row.label, targetValue: row.targetValue, targetDate: row.targetDate, completedAt: row.completedAt ?? undefined,
      })),
      valuationRates: valuationRateRows.map((row) => ({
        id: row.id, assetCode: row.assetCode, unitPrice: row.unitPriceCents / 100, source: row.source, effectiveAt: row.effectiveAt,
      })),
      installmentSchedules: installmentRows.map((row) => ({
        id: row.id, ledgerRecordId: row.ledgerRecordId, installmentNo: row.installmentNo, dueDate: row.dueDate, amount: row.amountCents / 100, denominationQuantity: row.denominationQuantity ?? undefined, status: row.status, paymentId: row.paymentId ?? undefined,
      })),
      settings: Object.fromEntries(
        settingRows.map((setting) => [setting.key, setting.value]),
      ),
      currentUser,
      auditEvents: auditRows.map((row) => ({
        id: row.id,
        actorEmail: row.actorEmail,
        actorRole: row.actorRole,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        requestId: row.requestId,
        createdAt: row.createdAt,
      })),
    };

    return Response.json(response, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return Response.json(
      { error: routeError(error), code: error instanceof FinanceAuthError ? error.code : undefined },
      { status: routeStatus(error), headers: { "cache-control": "no-store, private" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireFinanceApiUser(request, true);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
      throw new RouteInputError("İstek boyutu güvenli sınırı aşıyor.", 413);
    }
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
      throw new FinanceAuthError("Geçersiz istek kaynağı.", 403, "ORIGIN_REJECTED");
    }
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || !("action" in parsed)) {
      throw new RouteInputError("Geçersiz finans işlemi.");
    }
    const payload = parsed as ClinicDataAction;
    const db = await getDb();
    const suppliedIdempotencyKey = String(request.headers.get("idempotency-key") ?? "");
    if (!/^cmd-[A-Za-z0-9._-]{12,140}$/.test(suppliedIdempotencyKey)) {
      throw new RouteInputError("Bu finans kaydı için güvenli bir yeniden deneme anahtarı gerekli.", 400);
    }
    const commandAction = `legacy:${payload.action}`;
    const payloadSha256 = await sha256Hex(stableJson(payload));
    const knownCommand = (await db
      .select()
      .from(idempotencyCommands)
      .where(eq(idempotencyCommands.idempotencyKey, suppliedIdempotencyKey))
      .limit(1))[0];
    if (knownCommand) {
      if (
        knownCommand.action !== commandAction ||
        knownCommand.payloadSha256 !== payloadSha256
      ) {
        throw new RouteInputError(
          "Bu yeniden deneme anahtarı farklı bir kayıt için kullanılmış.",
          409,
        );
      }
      if (knownCommand.status === "completed") {
        return Response.json(JSON.parse(knownCommand.responseJson), {
          headers: { "cache-control": "no-store, private", "x-idempotent-replay": "true" },
        });
      }
      throw new RouteInputError(
        "Bu kayıt daha önce başlatılmış ancak yanıt tamamlanmamış. Aynı anahtarla tekrar göndermeyin; denetim kaydını kontrol edin.",
        409,
      );
    }
    await db.insert(idempotencyCommands).values({
      idempotencyKey: suppliedIdempotencyKey,
      action: commandAction,
      actorEmail: currentUser.email,
      payloadSha256,
      status: "processing",
      responseJson: "{}",
    });
    const suppliedRequestId = String(request.headers.get("x-request-id") ?? "");
    const requestId = /^[A-Za-z0-9._-]{8,100}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : crypto.randomUUID();
    // Audit existence is verified before any financial mutation. Missing audit
    // migration therefore blocks the write instead of silently changing data.
    await appendFinanceAudit(db, currentUser, payload, requestId, "attempted");
    const success = async (body: object = { ok: true }) => {
      await appendFinanceAudit(db, currentUser, payload, requestId, "completed");
      await db
        .update(idempotencyCommands)
        .set({
          status: "completed",
          responseJson: JSON.stringify(body),
          completedAt: new Date().toISOString(),
        })
        .where(eq(idempotencyCommands.idempotencyKey, suppliedIdempotencyKey));
      return Response.json(body, { headers: { "cache-control": "no-store, private", "x-request-id": requestId } });
    };

    if (payload.action === "importHistoricalData") {
      let importSummary;
      try {
        importSummary = validateHistoricalImportPackage(payload.package);
      } catch (validationError) {
        throw new RouteInputError(
          validationError instanceof Error
            ? validationError.message
            : "Geçmiş veri paketi doğrulanamadı.",
        );
      }

      const quality = historicalImportQuality(payload.package);
      const packageHash = await sha256Hex(stableJson({
        schemaVersion: payload.package.schemaVersion,
        importId: payload.package.importId,
        transactions: payload.package.transactions,
        recurringRules: payload.package.recurringRules,
        ledgerPackage: payload.package.ledgerPackage,
      }));
      const matchingBatch = await db
        .select()
        .from(importBatches)
        .where(eq(importBatches.sourceSha256, packageHash))
        .limit(1);
      const reapplyingRolledBackBatch = matchingBatch[0]?.status === "rolled_back";
      if (matchingBatch[0]) {
        if (matchingBatch[0].status === "applied") {
          return success({
            ok: true,
            alreadyApplied: true,
            batchId: matchingBatch[0].id,
            summary: JSON.parse(matchingBatch[0].summaryJson || "{}"),
          });
        }
        if (!reapplyingRolledBackBatch) {
          throw new RouteInputError("Bu geçmiş aktarım paketi daha önce başlatılmış; denetim ekranından durumunu inceleyin.", 409);
        }
      }

      const historicalTransactions = payload.package.transactions.map((row) => ({
        ...row,
        sourceModule: "historical_excel_import",
        postingMode: "economic_only",
        paymentMethod: "accrual",
      }));
      await assertDatesUnlocked(
        db,
        historicalTransactions.map((row) => row.date),
      );

      const existingTransactionRows = await db
        .select({ id: transactions.id, importBatchId: transactions.importBatchId })
        .from(transactions);
      const importedBatchId = matchingBatch[0]?.id || `import-${payload.package.importId}`;
      if (historicalTransactions.some((row) => {
        const existing = existingTransactionRows.find((item) => item.id === row.id);
        return existing && (!reapplyingRolledBackBatch || existing.importBatchId !== importedBatchId);
      })) {
        throw new RouteInputError("Aktarımdaki bir geçmiş hareket zaten var. Aynı paketi yeniden yüklemeyin; denetim ekranından paket durumuna bakın.", 409);
      }
      await assertUniqueTransactionDocuments(db, historicalTransactions);

      const existingRuleRows = await db
        .select({ id: recurringExpenseRules.id, importBatchId: recurringExpenseRules.importBatchId })
        .from(recurringExpenseRules);
      if (payload.package.recurringRules.some((rule) => {
        const existing = existingRuleRows.find((item) => item.id === rule.id);
        return existing && (!reapplyingRolledBackBatch || existing.importBatchId !== importedBatchId);
      })) {
        throw new RouteInputError("Aktarımdaki bir sabit gider taslağı zaten var; paket iki kez uygulanamaz.", 409);
      }

      const recordInput = payload.package.ledgerPackage.record ?? null;
      if (recordInput) {
        assertLedgerBasics(recordInput);
        const existingRecordRows = await db
          .select()
          .from(ledgerRecords)
          .where(eq(ledgerRecords.id, recordInput.id))
          .limit(1);
        if (existingRecordRows[0]) {
          if (!reapplyingRolledBackBatch || existingRecordRows[0].importBatchId !== importedBatchId) {
            throw new RouteInputError("Aktarımdaki geçmiş borç kaydı zaten var; paket iki kez uygulanamaz.", 409);
          }
        }
        await assertUniqueLedgerDocument(db, recordInput);
      } else if (payload.package.ledgerPackage.payments.length) {
        throw new RouteInputError("Borç kaydı olmadan geçmiş borç ödemesi aktarılamaz.");
      }

      const existingPaymentRows = await db
        .select({ id: ledgerPayments.id, importBatchId: ledgerPayments.importBatchId })
        .from(ledgerPayments);
      if (payload.package.ledgerPackage.payments.some((payment) => {
        const existing = existingPaymentRows.find((item) => item.id === String(payment.id || ""));
        return existing && (!reapplyingRolledBackBatch || existing.importBatchId !== importedBatchId);
      })) {
        throw new RouteInputError("Aktarımdaki bir geçmiş ödeme zaten var; paket iki kez uygulanamaz.", 409);
      }
      await assertDatesUnlocked(db, payload.package.ledgerPackage.payments.map((payment) => payment.date));

      const marker = {
        importId: payload.package.importId,
        source: payload.package.source ?? {},
        packageHash,
        summary: importSummary,
        quality,
        completedAt: new Date().toISOString(),
        actor: currentUser.email,
      };
      const markerValues = {
        key: `historicalImport:${payload.package.importId}`,
        value: JSON.stringify(marker),
        updatedAt: new Date().toISOString(),
      };
      const batchId = importedBatchId;
      const now = new Date().toISOString();
      const importWarnings = [...new Set([...(payload.package.warnings ?? []), ...quality.warnings])];
      const batchValues = {
          id: batchId,
          sourceFileName: payload.package.source?.fileName || "Geçmiş veri paketi",
          sourceSha256: packageHash,
          schemaVersion: payload.package.schemaVersion,
          status: "applied",
          coverageStartDate: quality.coverageStartDate,
          coverageEndDate: quality.coverageEndDate,
          completenessBps: quality.completenessBps,
          warningsJson: JSON.stringify(importWarnings),
          summaryJson: JSON.stringify({ ...importSummary, quality }),
          createdBy: currentUser.email,
          appliedAt: now,
      };
      const commands = [
        reapplyingRolledBackBatch
          ? db.update(importBatches).set({ ...batchValues, status: "applied", rolledBackAt: null, rollbackReason: "" }).where(eq(importBatches.id, batchId))
          : db.insert(importBatches).values(batchValues),
        ...historicalTransactions.map((row) => reapplyingRolledBackBatch
          ? db.update(transactions).set({ status: null, updatedAt: now }).where(eq(transactions.id, row.id))
          : db.insert(transactions).values(transactionValues({ ...row, importBatchId: batchId }))),
        ...payload.package.recurringRules.map((rule) => reapplyingRolledBackBatch
          ? db.update(recurringExpenseRules).set({ active: false, updatedAt: now }).where(eq(recurringExpenseRules.id, rule.id))
          : db.insert(recurringExpenseRules).values(recurringRuleValues({ ...rule, active: false, importBatchId: batchId }))),
        ...(recordInput ? [reapplyingRolledBackBatch
          ? db.update(ledgerRecords).set({ stage: String(recordInput.stage || "note") }).where(eq(ledgerRecords.id, recordInput.id))
          : db.insert(ledgerRecords).values(ledgerValues({ ...recordInput, importBatchId: batchId }))] : []),
        ...payload.package.ledgerPackage.payments.map((payment) => reapplyingRolledBackBatch
          ? db.update(ledgerPayments).set({ status: payment.status || null }).where(eq(ledgerPayments.id, String(payment.id)))
          : db.insert(ledgerPayments).values({
          id: String(payment.id),
          recordId: payment.recordId,
          amountCents: cents(payment.amount),
          denominationCode: payment.denominationCode || null,
          denominationQuantity: payment.denominationQuantity ?? null,
          denominationUnitPriceCents: payment.denominationUnitPrice === undefined ? null : cents(payment.denominationUnitPrice),
          date: payment.date,
          method: payment.method || "transfer",
          note: payment.note || "Excel geçmiş ödeme",
          status: payment.status || null,
          transactionId: null,
          importBatchId: batchId,
        })),
        ...(reapplyingRolledBackBatch ? [] : historicalTransactions.map((row, sourceRowNumber) => db.insert(importBatchItems).values({
          id: crypto.randomUUID(), batchId, entityType: "transaction", entityId: row.id, sourceRowNumber, rawJson: JSON.stringify(row),
        }))),
        ...(reapplyingRolledBackBatch ? [] : payload.package.recurringRules.map((rule, sourceRowNumber) => db.insert(importBatchItems).values({
          id: crypto.randomUUID(), batchId, entityType: "recurring_rule", entityId: rule.id, sourceRowNumber, rawJson: JSON.stringify(rule),
        }))),
        ...(recordInput && !reapplyingRolledBackBatch ? [db.insert(importBatchItems).values({
          id: crypto.randomUUID(), batchId, entityType: "ledger_record", entityId: recordInput.id, sourceRowNumber: null, rawJson: JSON.stringify(recordInput),
        })] : []),
        ...(reapplyingRolledBackBatch ? [] : payload.package.ledgerPackage.payments.map((payment, sourceRowNumber) => db.insert(importBatchItems).values({
          id: crypto.randomUUID(), batchId, entityType: "ledger_payment", entityId: String(payment.id), sourceRowNumber, rawJson: JSON.stringify(payment),
        }))),
        db.insert(settings).values(markerValues).onConflictDoUpdate({ target: settings.key, set: markerValues }),
      ];
      await db.batch(commands);

      return success({
        ok: true,
        batchId,
        summary: importSummary,
        quality: { ...quality, warnings: importWarnings },
        inserted: {
          transactions: historicalTransactions.length,
          recurringRules: payload.package.recurringRules.length,
          ledgerRecords: recordInput ? 1 : 0,
          ledgerPayments: payload.package.ledgerPackage.payments.length,
        },
      });
    } else if (payload.action === "rollbackHistoricalImport") {
      const batchId = String(payload.batchId || "");
      const reason = String(payload.reason || "").trim();
      if (!/^import-[A-Za-z0-9._-]{4,120}$/.test(batchId) || reason.length < 5) {
        throw new RouteInputError("Aktarım paketi ve en az 5 karakterlik geri alma gerekçesi zorunludur.");
      }
      const batch = await db.select().from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
      if (!batch[0] || batch[0].status !== "applied") {
        throw new RouteInputError("Yalnız uygulanmış geçmiş aktarım paketleri geri alınabilir.", 409);
      }
      const importedRecords = await db.select({ id: ledgerRecords.id }).from(ledgerRecords).where(eq(ledgerRecords.importBatchId, batchId));
      const importedRecordIds = new Set(importedRecords.map((row) => row.id));
      const allPayments = await db.select().from(ledgerPayments);
      const laterPayments = allPayments.filter((payment) => (
        importedRecordIds.has(payment.recordId) && payment.importBatchId !== batchId
      ));
      if (laterPayments.length) {
        throw new RouteInputError("Bu geçmiş cari kayda sonradan ödeme bağlanmış. Güvenli geri alma yerine cari düzeltme kaydı kullanın.", 409);
      }
      const now = new Date().toISOString();
      const importedTransactions = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.importBatchId, batchId));
      // Import rows stay in the audit trail.  They are made inactive instead
      // of being physically deleted, so an accountant can always see what was
      // imported and why it was later withdrawn.
      await db.batch([
        db.update(ledgerPayments).set({ status: "cancelled" }).where(eq(ledgerPayments.importBatchId, batchId)),
        db.update(ledgerRecords).set({ stage: "archived" }).where(eq(ledgerRecords.importBatchId, batchId)),
        db.update(recurringExpenseRules).set({ active: false, updatedAt: now }).where(eq(recurringExpenseRules.importBatchId, batchId)),
        db.update(transactions).set({ status: "cancelled", updatedAt: now }).where(eq(transactions.importBatchId, batchId)),
        ...importedTransactions.map((row) => db.insert(transactionAuditEvents).values({
          id: crypto.randomUUID(),
          transactionId: row.id,
          action: "import_rolled_back",
          reason,
          snapshotJson: JSON.stringify({ importBatchId: batchId, action: "archived_not_deleted" }),
          createdAt: now,
        })),
        db.update(importBatches).set({
          status: "rolled_back",
          rolledBackAt: now,
          rollbackReason: reason,
        }).where(eq(importBatches.id, batchId)),
      ] as any);
      return success({ ok: true, batchId, rolledBack: true });
    } else if (payload.action === "saveTransactions") {
      await assertTransactionWritesUnlocked(db, payload.records);
      const existingJournalRows = await db
        .select({ sourceRecordId: financialEvents.sourceRecordId })
        .from(financialEvents)
        .where(eq(financialEvents.sourceModule, "legacy_transaction"));
      const journalledIds = new Set(existingJournalRows.map((row) => row.sourceRecordId));
      if (payload.records.some((record) => journalledIds.has(record.id))) {
        throw new RouteInputError(
          "Muhasebe defterine işlenmiş bir kayıt doğrudan değiştirilemez. Düzeltme için ters kayıt oluşturun.",
          409,
        );
      }
      const commands = [];
      for (const record of payload.records) {
        const values = transactionValues(record);
        const journal = legacyJournalEvent(record);
        commands.push(
          db
          .insert(transactions)
          .values(values)
          .onConflictDoUpdate({ target: transactions.id, set: values }),
          db.insert(financialEvents).values({
            ...journal.event,
            createdBy: currentUser.email,
          }),
          ...journal.lines.map((line, index) => db.insert(financialJournalLines).values({
            id: `jln-${journal.eventId}-${index + 1}`,
            eventId: journal.eventId,
            accountCode: line.accountCode,
            debitCents: line.debitCents,
            creditCents: line.creditCents,
            inventoryItemId: "itemId" in line ? String(line.itemId || "") || null : null,
            memo: record.description,
          })),
        );
      }
      await db.batch(commands as never[]);
    } else if (payload.action === "saveQuickReceipt") {
      if (
        !/^quick-receipt-[A-Za-z0-9._-]{6,100}$/.test(payload.receiptId) ||
        !Array.isArray(payload.lines) ||
        payload.lines.length < 1 ||
        payload.lines.length > 50
      ) {
        throw new RouteInputError("Çok kalemli fiş 1–50 satır içermelidir.");
      }
      const receiptTransactions = payload.lines.map((line) => ({
        ...line.transaction,
        kind: "expense",
        sourceModule: "quick_receipt",
        sourceRecordId: payload.receiptId,
      }));
      const movementIds = payload.lines.map((line) => line.movement?.id).filter((id): id is string => Boolean(id));
      if (movementIds.length) {
        const known = await db.select({ id: stockMovements.id }).from(stockMovements);
        const found = movementIds.filter((id) => known.some((movement) => movement.id === id));
        if (found.length === movementIds.length) return success({ ok: true, receiptId: payload.receiptId, lineCount: payload.lines.length, alreadyApplied: true });
        if (found.length) throw new RouteInputError("Fişin bir bölümü daha önce işlenmiş. Stok tutarlılığı için yeniden göndermeyin; denetim kaydını kontrol edin.", 409);
      }
      const first = receiptTransactions[0];
      for (const transaction of receiptTransactions) {
        if (
          transaction.date !== first.date ||
          transaction.counterparty?.trim() !== first.counterparty?.trim() ||
          transaction.documentType !== first.documentType ||
          transaction.documentRef.trim() !== first.documentRef.trim() ||
          transaction.paymentMethod !== first.paymentMethod
        ) {
          throw new RouteInputError(
            "Tek fişte tarih, karşı taraf, belge ve ödeme biçimi bütün satırlarda aynı olmalıdır.",
          );
        }
      }
      await assertTransactionWritesUnlocked(db, receiptTransactions);

      const existingInventory = await db.select().from(inventoryItems);
      const existingProductDefinitions = await db.select().from(productDefinitions);
      const workingInventory = new Map(
        existingInventory.map((item) => [item.id, { ...item }] as const),
      );
      const finalInventory = new Map<string, ReturnType<typeof inventoryValues>>();
      const finalProductDefinitions = new Map<string, ReturnType<typeof productDefinitionValues>>();
      const queries = [];

      for (let index = 0; index < payload.lines.length; index += 1) {
        const line = payload.lines[index];
        const transactionInput = receiptTransactions[index];
        const transaction = transactionValues(transactionInput);
        queries.push(
          db
            .insert(transactions)
            .values(transaction)
          .onConflictDoUpdate({ target: transactions.id, set: transaction }),
        );
        const journal = legacyJournalEvent(transactionInput, Boolean(line.movement));
        queries.push(
          db.insert(financialEvents).values({ ...journal.event, createdBy: currentUser.email }),
          ...journal.lines.map((journalLine, journalIndex) => db.insert(financialJournalLines).values({
            id: `jln-${journal.eventId}-${journalIndex + 1}`,
            eventId: journal.eventId,
            accountCode: journalLine.accountCode,
            debitCents: journalLine.debitCents,
            creditCents: journalLine.creditCents,
            memo: transactionInput.description,
          })),
        );

        let resolvedProductDefinitionId: string | undefined;
        if (line.productDefinition) {
          const nextDefinition = productDefinitionValues(line.productDefinition);
          const matchingDefinition = existingProductDefinitions.find((definition) => (
            definition.productFamily === nextDefinition.productFamily
            && definition.baseUnit === nextDefinition.baseUnit
            && definition.attributesJson === nextDefinition.attributesJson
          ));
          const resolvedId = matchingDefinition?.id ?? nextDefinition.id;
          resolvedProductDefinitionId = resolvedId;
          const existingAliases = matchingDefinition
            ? (() => { try { return JSON.parse(matchingDefinition.aliasesJson) as string[]; } catch { return []; } })()
            : [];
          const mergedDefinition = {
            ...nextDefinition,
            id: resolvedId,
            aliasesJson: stableJson(Array.from(new Set([
              ...existingAliases,
              ...JSON.parse(nextDefinition.aliasesJson) as string[],
            ]))),
          };
          finalProductDefinitions.set(resolvedId, mergedDefinition);
        }

        const hasItem = Boolean(line.item);
        const hasMovement = Boolean(line.movement);
        if (hasItem !== hasMovement) {
          throw new RouteInputError(
            "Stok satırında stok kartı ve hareketi birlikte gönderilmelidir.",
          );
        }
        if (!line.item || !line.movement) continue;

        const movementQuantity = Number(line.movement.quantity);
        const purchaseAmount = Number(transactionInput.amount);
        if (
          line.movement.type !== "purchase" ||
          !Number.isFinite(movementQuantity) ||
          movementQuantity <= 0 ||
          !Number.isFinite(purchaseAmount) ||
          purchaseAmount <= 0
        ) {
          throw new RouteInputError(
            "Stok satırında sıfırdan büyük miktar ve tutar zorunludur.",
          );
        }
        const current = workingInventory.get(line.item.id);
        const currentQuantity = Number(current?.quantity ?? 0);
        const currentUnitCostCents = Number(current?.unitCostCents ?? 0);
        const nextQuantity = currentQuantity + movementQuantity;
        const nextUnitCost =
          nextQuantity > 0
            ? (currentQuantity * currentUnitCostCents + cents(purchaseAmount)) /
              nextQuantity /
              100
            : 0;
        const nextItem = inventoryValues({
          ...line.item,
          id: current?.id ?? line.item.id,
          name: current?.name ?? line.item.name,
          category: current?.category ?? line.item.category,
          unit: current?.unit ?? line.item.unit,
          purchaseUnit:
            current?.purchaseUnit ?? line.item.purchaseUnit ?? line.item.unit,
          unitsPerPackage:
            current?.unitsPerPackage ?? line.item.unitsPerPackage ?? 1,
          quantity: nextQuantity,
          minimumQuantity:
            current?.minimumQuantity ?? line.item.minimumQuantity ?? 0,
          unitCost: nextUnitCost,
          supplier: line.item.supplier || current?.supplier || "",
          lot: line.movement.lot || current?.lot || "",
          expiryDate: line.movement.expiryDate || current?.expiryDate || "",
          productDefinitionId:
            current?.productDefinitionId ?? resolvedProductDefinitionId ?? line.item.productDefinitionId,
          baseUnit: current?.baseUnit ?? line.item.baseUnit ?? line.item.unit,
          baseUnitsPerPurchaseUnit:
            current?.baseUnitsPerPurchaseUnit ?? line.item.baseUnitsPerPurchaseUnit ?? line.item.unitsPerPackage ?? 1,
          attributesJson: current?.attributesJson ?? line.item.attributesJson ?? "{}",
        });
        workingInventory.set(line.item.id, nextItem);
        finalInventory.set(line.item.id, nextItem);
        const movement = movementValues({
          ...line.movement,
          itemName: nextItem.name,
          unitCost: purchaseAmount / movementQuantity,
          totalCost: purchaseAmount,
          documentType: transactionInput.documentType,
          documentRef: transactionInput.documentRef,
          transactionId: transactionInput.id,
        });
        queries.push(
          db
            .insert(stockMovements)
            .values(movement)
            .onConflictDoUpdate({
              target: stockMovements.id,
              set: movement,
            }),
        );
      }
      for (const definition of finalProductDefinitions.values()) {
        queries.push(
          db
            .insert(productDefinitions)
            .values(definition)
            .onConflictDoUpdate({
              target: productDefinitions.id,
              set: definition,
            }),
        );
      }
      for (const item of finalInventory.values()) {
        queries.push(
          db
            .insert(inventoryItems)
            .values(item)
            .onConflictDoUpdate({ target: inventoryItems.id, set: item }),
        );
      }
      await db.batch(queries as any);
      return success({ ok: true, receiptId: payload.receiptId, lineCount: payload.lines.length });
    } else if (payload.action === "saveQuickPurchase") {
      const movementQuantity = Number(payload.movement.quantity);
      const purchaseAmount = Number(payload.transaction.amount);
      if (
        payload.movement.type !== "purchase" ||
        !Number.isFinite(movementQuantity) ||
        movementQuantity <= 0 ||
        !Number.isFinite(purchaseAmount) ||
        purchaseAmount <= 0
      ) {
        throw new RouteInputError(
          "Stok alımında sıfırdan büyük miktar ve toplam tutar zorunludur.",
        );
      }
      const transactionInput: TransactionInput = {
        ...payload.transaction,
        kind: "expense",
        operationType: "inventory_purchase",
        postingMode: "cash_only",
        sourceModule: "inventory",
        sourceRecordId: payload.movement.id,
      };
      const existingMovement = await db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.id, payload.movement.id)).limit(1);
      if (existingMovement[0]) return success({ ok: true, alreadyApplied: true, movementId: payload.movement.id });
      await assertTransactionWritesUnlocked(db, [transactionInput]);
      await assertDatesUnlocked(db, [payload.movement.date]);
      const existingRows = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, payload.item.id))
        .limit(1);
      const existingItem = existingRows[0];
      const nextQuantity =
        Number(existingItem?.quantity ?? 0) + movementQuantity;
      const priorValueCents =
        Number(existingItem?.quantity ?? 0) *
        Number(existingItem?.unitCostCents ?? 0);
      const purchaseAmountCents = cents(purchaseAmount);
      const nextUnitCost =
        nextQuantity > 0
          ? (priorValueCents + purchaseAmountCents) / nextQuantity / 100
          : 0;
      const item = inventoryValues({
        ...payload.item,
        id: existingItem?.id ?? payload.item.id,
        name: existingItem?.name ?? payload.item.name,
        category: existingItem?.category ?? payload.item.category,
        unit: existingItem?.unit ?? payload.item.unit,
        purchaseUnit:
          existingItem?.purchaseUnit ??
          payload.item.purchaseUnit ??
          payload.item.unit,
        unitsPerPackage:
          existingItem?.unitsPerPackage ?? payload.item.unitsPerPackage,
        quantity: nextQuantity,
        minimumQuantity:
          existingItem?.minimumQuantity ?? payload.item.minimumQuantity,
        unitCost: nextUnitCost,
        supplier: payload.item.supplier || existingItem?.supplier || "",
        lot: payload.movement.lot || existingItem?.lot || "",
        expiryDate:
          payload.movement.expiryDate || existingItem?.expiryDate || "",
      });
      const transaction = transactionValues(transactionInput);
      const movement = movementValues({
        ...payload.movement,
        itemName: existingItem?.name ?? payload.item.name,
        unitCost: purchaseAmount / movementQuantity,
        totalCost: purchaseAmount,
        documentType: payload.transaction.documentType,
        documentRef: payload.transaction.documentRef,
        transactionId: payload.transaction.id,
      });
      const journal = legacyJournalEvent(transactionInput, true);
      await db.batch([
        db
          .insert(transactions)
          .values(transaction)
          .onConflictDoUpdate({
            target: transactions.id,
            set: transaction,
          }),
        db.insert(financialEvents).values({ ...journal.event, createdBy: currentUser.email }),
        ...journal.lines.map((journalLine, journalIndex) => db.insert(financialJournalLines).values({
          id: `jln-${journal.eventId}-${journalIndex + 1}`,
          eventId: journal.eventId,
          accountCode: journalLine.accountCode,
          debitCents: journalLine.debitCents,
          creditCents: journalLine.creditCents,
          inventoryItemId: payload.item.id,
          memo: transactionInput.description,
        })),
        db
          .insert(inventoryItems)
          .values(item)
          .onConflictDoUpdate({ target: inventoryItems.id, set: item }),
        db
          .insert(stockMovements)
          .values(movement)
          .onConflictDoUpdate({
            target: stockMovements.id,
            set: movement,
          }),
      ]);
    } else if (payload.action === "saveInventoryItem") {
      if (
        !payload.item.name?.trim() ||
        !payload.item.unit?.trim() ||
        !Number.isFinite(Number(payload.item.unitsPerPackage)) ||
        Number(payload.item.unitsPerPackage) <= 0
      ) {
        throw new RouteInputError(
          "Stok adı, ana birim ve sıfırdan büyük paket içi miktar zorunludur.",
        );
      }
      const existingItems = await db.select().from(inventoryItems);
      if (existingItems.some((row) => row.id === payload.item.id)) {
        throw new RouteInputError(
          "Mevcut stok kartının miktarı doğrudan değiştirilemez; stok hareketi kullanın.",
          409,
        );
      }
      const normalizedName = payload.item.name
        .trim()
        .toLocaleLowerCase("tr-TR");
      if (
        existingItems.some(
          (row) =>
            row.name.trim().toLocaleLowerCase("tr-TR") === normalizedName,
        )
      ) {
        throw new RouteInputError(
          "Aynı isimde stok kartı zaten var; mükerrer kart açılmadı.",
          409,
        );
      }
      const values = inventoryValues(payload.item);
      await db.insert(inventoryItems).values(values);
    } else if (payload.action === "saveStockMovement") {
      if (
        payload.movement.type === "purchase" ||
        payload.movement.type === "return_in"
      ) {
        throw new RouteInputError(
          "Stok alışı para hareketinden kopuk kaydedilemez. Günlük Giriş > Gider listesinden veya mevcut borca fatura işleyerek girin.",
          409,
        );
      }
      if (!payload.transaction) {
        throw new RouteInputError(
          "Stok çıkışının maliyet kaydı eksik; hareket kaydedilmedi.",
        );
      }
      const existingMovement = await db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.id, payload.movement.id)).limit(1);
      if (existingMovement[0]) return success({ ok: true, alreadyApplied: true, movementId: payload.movement.id });
      const inventoryRows = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, payload.movement.itemId))
        .limit(1);
      const currentItem = inventoryRows[0];
      const movementQuantity = Number(payload.movement.quantity);
      if (
        !currentItem ||
        !Number.isFinite(movementQuantity) ||
        movementQuantity <= 0 ||
        movementQuantity > currentItem.quantity
      ) {
        throw new RouteInputError(
          "Stok çıkışı geçersiz veya mevcut miktarı aşıyor.",
          409,
        );
      }
      const expectedCost =
        Math.round(
          movementQuantity * currentItem.unitCostCents,
        ) / 100;
      if (expectedCost <= 0) {
        throw new RouteInputError(
          "Kayıtlı birim maliyet sıfır; maliyet doğrulanmadan stok çıkışı yapılamaz.",
          409,
        );
      }
      const transactionInput: TransactionInput = {
        ...payload.transaction,
        kind: "expense",
        amount: expectedCost,
        paymentMethod: "accrual",
        documentType: "stock_record",
        documentRef: payload.movement.id,
        vatRate: 0,
        postingMode: "economic_only",
        sourceModule: "inventory",
        sourceRecordId: payload.movement.id,
        isAutomatic: true,
      };
      await assertTransactionWritesUnlocked(db, [transactionInput]);
      await assertDatesUnlocked(db, [payload.movement.date]);
      const item = {
        id: currentItem.id,
        name: currentItem.name,
        category: currentItem.category,
        unit: currentItem.unit,
        purchaseUnit: currentItem.purchaseUnit,
        unitsPerPackage: currentItem.unitsPerPackage,
        quantity: Math.round(
          (currentItem.quantity - movementQuantity) * 100,
        ) / 100,
        minimumQuantity: currentItem.minimumQuantity,
        unitCostCents: currentItem.unitCostCents,
        supplier: currentItem.supplier,
        lot: currentItem.lot,
        expiryDate: currentItem.expiryDate,
        updatedAt: new Date().toISOString(),
      };
      const transaction = transactionValues(transactionInput);
      const movement = movementValues({
        ...payload.movement,
        itemName: currentItem.name,
        unitCost: currentItem.unitCostCents / 100,
        totalCost: expectedCost,
        transactionId: payload.transaction.id,
      });
      await db.batch([
        db
          .insert(inventoryItems)
          .values(item)
          .onConflictDoUpdate({ target: inventoryItems.id, set: item }),
        db
          .insert(stockMovements)
          .values(movement)
          .onConflictDoUpdate({
            target: stockMovements.id,
            set: movement,
          }),
        db
          .insert(transactions)
          .values(transaction)
          .onConflictDoUpdate({
            target: transactions.id,
            set: transaction,
          }),
      ]);
    } else if (payload.action === "saveLedgerRecord") {
      assertLedgerBasics(payload.record);
      await assertUniqueLedgerDocument(db, payload.record);
      const values = ledgerValues(payload.record);
      const writes: any[] = [
        db
          .insert(ledgerRecords)
          .values(values)
          .onConflictDoUpdate({ target: ledgerRecords.id, set: values }),
      ];
      if (payload.record.lineItems) {
        writes.push(
          db
          .delete(ledgerLineItems)
          .where(eq(ledgerLineItems.recordId, payload.record.id)),
        );
        for (const line of payload.record.lineItems) {
          writes.push(db.insert(ledgerLineItems).values(lineItemValues(line)));
        }
      }
      if (payload.revenueTransaction) {
        const transactionInput: TransactionInput = {
          ...payload.revenueTransaction,
          kind: "income",
          operationType: "service",
          paymentMethod: "accrual",
          postingMode: "economic_only",
          sourceModule: "ledger_service",
          sourceRecordId: payload.record.id,
          isAutomatic: true,
        };
        await assertTransactionWritesUnlocked(db, [transactionInput]);
        const transaction = transactionValues(transactionInput);
        const journal = legacyJournalEvent(transactionInput);
        writes.push(
          db
            .insert(transactions)
            .values(transaction)
            .onConflictDoUpdate({ target: transactions.id, set: transaction }),
          db.insert(financialEvents).values({ ...journal.event, createdBy: currentUser.email }),
          ...journal.lines.map((line, index) =>
            db.insert(financialJournalLines).values({
              id: `jln-${journal.eventId}-${index + 1}`,
              eventId: journal.eventId,
              accountCode: line.accountCode,
              debitCents: line.debitCents,
              creditCents: line.creditCents,
              ledgerRecordId: payload.record.id,
              memo: transactionInput.description,
            }),
          ),
        );
      }
      await db.batch(writes);
    } else if (payload.action === "saveLedgerInvoice") {
      assertLedgerBasics(payload.record);
      const lineTotal = (payload.record.lineItems ?? []).reduce(
        (sum, line) => sum + Number(line.lineTotal || 0),
        0,
      );
      if (
        !payload.record.lineItems?.length ||
        Math.abs(lineTotal - Number(payload.record.originalAmount)) > 0.02
      ) {
        throw new RouteInputError(
          "Fatura kalemleri toplamı ile borç toplamı eşleşmiyor.",
        );
      }
      await assertUniqueLedgerDocument(db, payload.record);
      await assertDatesUnlocked(db, [
        payload.record.documentDate,
        ...payload.movements.map((movement) => movement.date),
      ]);
      const record = ledgerValues(payload.record);
      await db
        .insert(ledgerRecords)
        .values(record)
        .onConflictDoUpdate({
          target: ledgerRecords.id,
          set: record,
        });
      await db
        .delete(ledgerLineItems)
        .where(eq(ledgerLineItems.recordId, payload.record.id));
      for (const line of payload.record.lineItems ?? []) {
        await db.insert(ledgerLineItems).values(lineItemValues(line));
      }
      for (const itemInput of payload.items) {
        const item = inventoryValues(itemInput);
        await db
          .insert(inventoryItems)
          .values(item)
          .onConflictDoUpdate({ target: inventoryItems.id, set: item });
      }
      for (const movementInput of payload.movements) {
        const movement = movementValues(movementInput);
        await db
          .insert(stockMovements)
          .values(movement)
          .onConflictDoUpdate({
            target: stockMovements.id,
            set: movement,
          });
      }
    } else if (payload.action === "saveLedgerPayment") {
      const payment = payload.payment;
      const existingPayment = await db
        .select()
        .from(ledgerPayments)
        .where(eq(ledgerPayments.id, payment.id))
        .limit(1);
      await assertDatesUnlocked(db, [
        payment.date,
        existingPayment[0]?.date,
      ]);
      const recordRows = await db
        .select()
        .from(ledgerRecords)
        .where(eq(ledgerRecords.id, payment.recordId))
        .limit(1);
      const record = recordRows[0];
      if (!record) {
        throw new RouteInputError("Borç/alacak kaydı bulunamadı.", 404);
      }
      const recordDenomination = String(record.denominationCode || "TRY").toUpperCase();
      const indexedRecord = recordDenomination !== "TRY";
      let amount = Number(payment.amount);
      const paymentDenomination = String(payment.denominationCode || recordDenomination).toUpperCase();
      const paymentQuantity = Number(payment.denominationQuantity ?? 0);
      const paymentUnitPrice = Number(payment.denominationUnitPrice ?? 0);
      if (indexedRecord) {
        if (paymentDenomination !== recordDenomination) {
          throw new RouteInputError(`Bu cari ${recordDenomination} üzerinden takip ediliyor; ödeme birimi değiştirilemez.`);
        }
        if (!Number.isFinite(paymentQuantity) || paymentQuantity <= 0 || !Number.isFinite(paymentUnitPrice) || paymentUnitPrice <= 0) {
          throw new RouteInputError("Endeksli cari için ödenen miktar ve güncel TL birim değeri zorunludur.");
        }
        amount = indexedAmountValue({
          denominationCode: record.denominationCode,
          denominationPurity: record.denominationPurity,
          denominationKarat: record.denominationKarat,
          denominationMillesimal: record.denominationMillesimal,
        }, paymentQuantity, paymentUnitPrice) ?? 0;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new RouteInputError("Tahsilat/ödeme tutarı sıfırdan büyük olmalıdır.");
      }
      const priorPayments = await db
        .select()
        .from(ledgerPayments)
        .where(eq(ledgerPayments.recordId, record.id));
      const activePriorPayments = priorPayments.filter(
        (row) => row.id !== payment.id && row.status !== "cancelled",
      );
      const paidCents = activePriorPayments.reduce((sum, row) => sum + row.amountCents, 0);
      const remainingCents = Math.max(0, record.originalAmountCents - paidCents);
      const amountCents = cents(amount);
      if (indexedRecord) {
        const openingRate = Math.max(0.000001, Number(record.denominationOpenUnitPriceCents || 0) / 100);
        const recordPurity = purityFactor({
          denominationCode: record.denominationCode,
          denominationPurity: record.denominationPurity,
          denominationKarat: record.denominationKarat,
          denominationMillesimal: record.denominationMillesimal,
        });
        const openingUnits = Number(record.denominationQuantity || 0) > 0
          ? Number(record.denominationQuantity)
          : record.originalAmountCents / 100 / openingRate / Math.max(recordPurity, 0.000001);
        const paidUnits = activePriorPayments.reduce((sum, row) => {
          if (Number(row.denominationQuantity || 0) > 0) return sum + Number(row.denominationQuantity);
          const unitRate = Number(row.denominationUnitPriceCents || 0) / 100 || openingRate;
          return sum + row.amountCents / 100 / unitRate / Math.max(recordPurity, 0.000001);
        }, 0);
        const remainingUnits = Math.max(0, openingUnits - paidUnits);
        if (paymentQuantity > remainingUnits + 1e-8) {
          throw new RouteInputError(
            `Miktar kalan ${remainingUnits.toLocaleString("tr-TR", { maximumFractionDigits: 8 })} ${recordDenomination} bakiyesini aşamaz.`,
            409,
          );
        }
      } else if (amountCents > remainingCents) {
        throw new RouteInputError(
          `Tutar kalan bakiyeyi aşamaz. Azami ${(remainingCents / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}.`,
          409,
        );
      }
      const channel = normalizeLedgerPaymentMethod(
        payment.method,
        record.type,
      );
      const settingRows = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "posCommissionRate"))
        .limit(1);
      const configuredPosRate = Number(settingRows[0]?.value ?? 0.0239);
      const posRate =
        Number.isFinite(configuredPosRate) &&
        configuredPosRate >= 0 &&
        configuredPosRate < 1
          ? configuredPosRate
          : 0.0239;
      const transactionId =
        existingPayment[0]?.transactionId || `tx-ledger-${payment.id}`;
      const isReceivable = record.type === "receivable";
      const transactionInput: TransactionInput = {
        id: transactionId,
        date: payment.date,
        time: timeInIstanbul(),
        kind: isReceivable ? "income" : "expense",
        category: isReceivable ? "Alacak tahsilatı" : "Borç ödemesi",
        description: `${record.counterparty} · ${record.detail}`,
        counterparty: record.counterparty,
        operationType: isReceivable
          ? "receivable_collection"
          : "payable_payment",
        costBehavior: "non_expense",
        amount,
        paymentMethod: channel,
        documentType:
          channel === "cash"
            ? "receipt"
            : channel === "card"
              ? "pos_statement"
              : "bank_statement",
        documentRef: `LDP-${payment.id}`,
        vatRate: 0,
        posRate: channel === "card" ? posRate : 0,
        posStatus: channel === "card" ? "pending" : undefined,
        settlementDate:
          channel === "card"
            ? datePlusBusinessDays(payment.date, 2)
            : undefined,
        postingMode: "cash_only",
        sourceModule: "ledger",
        sourceRecordId: record.id,
      };
      await assertTransactionWritesUnlocked(db, [transactionInput]);
      const values = {
        id: payment.id,
        recordId: payment.recordId,
        amountCents,
        denominationCode: indexedRecord ? recordDenomination : (payment.denominationCode || "TRY"),
        denominationQuantity: indexedRecord ? paymentQuantity : (payment.denominationQuantity ?? amount),
        denominationUnitPriceCents: indexedRecord ? cents(paymentUnitPrice) : cents(payment.denominationUnitPrice ?? 1),
        date: payment.date,
        method: payment.method || "",
        note: payment.note || "",
        status: payment.status || null,
        transactionId,
      };
      const transaction = transactionValues(transactionInput);
      if (channel === "card" && amount * posRate >= 0.005) {
        const feeInput: TransactionInput = {
          id: `${transactionId}-pos-fee`,
          date: payment.date,
          time: transactionInput.time,
          kind: "expense",
          category: "POS / banka komisyonu",
          description: `Otomatik POS komisyonu · ${record.counterparty}`,
          counterparty: "POS sağlayıcısı",
          operationType: "pos_commission",
          costBehavior: "variable",
          relatedIncomeId: transactionId,
          amount: Math.round(amount * posRate * 100) / 100,
          paymentMethod: "accrual",
          documentType: "pos_statement",
          documentRef: `POS-${payment.id}`,
          vatRate: 0,
          postingMode: "economic_only",
          sourceModule: "pos",
          sourceRecordId: transactionId,
          isAutomatic: true,
          sourceTransactionId: transactionId,
        };
        await assertTransactionWritesUnlocked(db, [feeInput]);
        const fee = transactionValues(feeInput);
        await db.batch([
          db
            .insert(ledgerPayments)
            .values(values)
            .onConflictDoUpdate({ target: ledgerPayments.id, set: values }),
          db
            .insert(transactions)
            .values(transaction)
            .onConflictDoUpdate({
              target: transactions.id,
              set: transaction,
            }),
          db
            .insert(transactions)
            .values(fee)
            .onConflictDoUpdate({ target: transactions.id, set: fee }),
        ]);
        return success({
          ok: true,
          payment: {
            id: values.id,
            amount,
            date: values.date,
            method: values.method,
            note: values.note,
            transactionId,
          },
          transactions: [
            transactionInput,
            feeInput,
          ],
        });
      }
      await db.batch([
        db
          .insert(ledgerPayments)
          .values(values)
          .onConflictDoUpdate({ target: ledgerPayments.id, set: values }),
        db
          .insert(transactions)
          .values(transaction)
          .onConflictDoUpdate({
            target: transactions.id,
            set: transaction,
          }),
      ]);
      return success({
        ok: true,
        payment: {
          id: values.id,
          amount,
          date: values.date,
          method: values.method,
          note: values.note,
          transactionId,
        },
        transactions: [transactionInput],
      });
    } else if (payload.action === "settlePosTransaction") {
      const rows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, payload.transactionId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new RouteInputError("POS işlemi bulunamadı.", 404);
      }
      if (
        row.status === "cancelled" ||
        row.kind !== "income" ||
        row.paymentMethod !== "card"
      ) {
        throw new RouteInputError("Bu kayıt POS yatışı olarak kapatılamaz.", 409);
      }
      if (row.posStatus === "settled") {
        throw new RouteInputError("Bu POS işlemi daha önce hesaba yatmış.", 409);
      }
      const actualNetAmount = Number(payload.actualNetAmount);
      if (
        !payload.settlementDate ||
        payload.settlementDate < row.date ||
        payload.settlementDate > todayInIstanbul() ||
        !Number.isFinite(actualNetAmount) ||
        actualNetAmount <= 0 ||
        cents(actualNetAmount) > row.amountCents
      ) {
        throw new RouteInputError(
          "Yatış tarihi işlemden önce veya bugünden sonra olamaz; gerçek net yatış sıfırdan büyük ve brüt tutardan fazla olamaz.",
        );
      }
      const reference = String(payload.settlementReference ?? "").trim();
      if (!reference) {
        throw new RouteInputError("Banka/POS referansı zorunludur.");
      }
      const settlementRows = await db
        .select({
          id: transactions.id,
          reference: transactions.settlementReference,
          status: transactions.status,
        })
        .from(transactions);
      if (
        settlementRows.some(
          (transaction) =>
            transaction.id !== row.id &&
            transaction.status !== "cancelled" &&
            transaction.reference
              .trim()
              .toLocaleUpperCase("tr-TR") ===
              reference.toLocaleUpperCase("tr-TR"),
        )
      ) {
        throw new RouteInputError(
          "Bu banka/POS referansı daha önce kullanılmış. Mükerrer yatış engellendi.",
          409,
        );
      }
      await assertDatesUnlocked(db, [
        row.date,
        row.settlementDate,
        payload.settlementDate,
      ]);
      const before = transactionFromRow(row);
      const now = new Date().toISOString();
      const settleUpdate = db
        .update(transactions)
        .set({
          posStatus: "settled",
          settlementDate: payload.settlementDate,
          settledAmountCents: cents(actualNetAmount),
          settlementReference: reference,
          updatedAt: now,
        })
        .where(eq(transactions.id, row.id));
      const audit = db.insert(transactionAuditEvents).values({
        id: crypto.randomUUID(),
        transactionId: row.id,
        action: "pos_settled",
        reason: reference,
        snapshotJson: JSON.stringify(before),
        createdAt: now,
      });
      const relatedRows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.sourceTransactionId, row.id));
      const existingFee = relatedRows.find(
        (transaction) => transaction.operationType === "pos_commission",
      );
      const actualFeeAmount =
        Math.round((row.amountCents - cents(actualNetAmount))) / 100;
      let feeResponse: TransactionInput | null = null;
      if (existingFee) {
        if (actualFeeAmount > 0) {
          await db.batch([
            settleUpdate,
            db
              .update(transactions)
              .set({
                amountCents: cents(actualFeeAmount),
                paymentMethod: "accrual",
                postingMode: "economic_only",
                documentRef: `POS-${reference}`,
                status: null,
                updatedAt: now,
              })
              .where(eq(transactions.id, existingFee.id)),
            audit,
          ]);
          feeResponse = {
            ...transactionFromRow(existingFee),
            amount: actualFeeAmount,
            paymentMethod: "accrual",
            postingMode: "economic_only",
            documentRef: `POS-${reference}`,
            status: undefined,
          };
        } else {
          await db.batch([
            settleUpdate,
            db
              .update(transactions)
              .set({ status: "cancelled", updatedAt: now })
              .where(eq(transactions.id, existingFee.id)),
            audit,
          ]);
          feeResponse = {
            ...transactionFromRow(existingFee),
            status: "cancelled",
          };
        }
      } else if (actualFeeAmount > 0) {
        const feeInput: TransactionInput = {
          id: `${row.id}-pos-fee`,
          date: row.date,
          time: row.time,
          kind: "expense",
          category: "POS / banka komisyonu",
          description: `Gerçekleşen POS kesintisi · ${row.description}`,
          counterparty: "POS sağlayıcısı",
          operationType: "pos_commission",
          costBehavior: "variable",
          relatedIncomeId: row.id,
          amount: actualFeeAmount,
          paymentMethod: "accrual",
          documentType: "pos_statement",
          documentRef: `POS-${reference}`,
          vatRate: 0,
          postingMode: "economic_only",
          sourceModule: "pos",
          sourceRecordId: row.id,
          isAutomatic: true,
          sourceTransactionId: row.id,
        };
        const fee = transactionValues(feeInput);
        await db.batch([
          settleUpdate,
          db.insert(transactions).values(fee),
          audit,
        ]);
        feeResponse = feeInput;
      } else {
        await db.batch([settleUpdate, audit]);
      }
      return success({
        ok: true,
        transaction: {
          ...before,
          posStatus: "settled",
          settlementDate: payload.settlementDate,
          settledAmount: actualNetAmount,
          settlementReference: reference,
        },
        expectedNet: expectedPosNet(before),
        variance:
          Math.round((actualNetAmount - expectedPosNet(before)) * 100) / 100,
        relatedTransactions: feeResponse ? [feeResponse] : [],
      });
    } else if (payload.action === "reverseTransaction") {
      const reason = String(payload.reason ?? "").trim();
      if (reason.length < 5) {
        throw new RouteInputError(
          "Ters kayıt için en az 5 karakterlik gerekçe yazın.",
        );
      }
      const rows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, payload.transactionId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new RouteInputError("İşlem bulunamadı.", 404);
      }
      if (row.status === "cancelled") {
        throw new RouteInputError("Bu işlem zaten iptal edilmiş.", 409);
      }
      // Komut çubuğu ve hızlı giriş ekranı kullanıcı tarafından oluşturulan
      // manuel kayıtlardır; ters kayıtla düzeltilebilmeleri gerekir. Stok alımı
      // ise hem finansı hem de stok adedini değiştirdiği için aşağıda iki tarafı
      // aynı anda geri alan özel bir yol kullanır.
      const reversibleManualSources = new Set([
        "manual",
        "finance_command_bar",
        "workspace_quick_entry",
      ]);
      // Stok alımı ister hızlı günlük girişten, ister fiş ekranından gelsin;
      // geri alma iki tarafı (kasa + stok) birlikte terslemelidir. Kaynağa
      // göre davranmak yerine bağlı stok hareketi üzerinden doğruluyoruz.
      const isReversibleStockPurchase =
        row.operationType === "inventory_purchase" &&
        Boolean(row.sourceRecordId);
      if (
        row.isAutomatic ||
        (!reversibleManualSources.has(row.sourceModule || "manual") &&
          !isReversibleStockPurchase)
      ) {
        throw new RouteInputError(
          "Bağlı işlem kendi kaynağından düzeltilmelidir; veri zinciri korunmak için doğrudan iptal edilmedi.",
          409,
        );
      }
      await assertDatesUnlocked(db, [
        row.date,
        payload.reversalDate,
        row.settlementDate,
      ]);
      const related = await db
        .select()
        .from(transactions)
        .where(eq(transactions.sourceTransactionId, row.id));
      const priorReversal = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.reversalOfId, row.id))
        .limit(1);
      if (priorReversal[0]) {
        throw new RouteInputError("Bu işlem için zaten bir ters kayıt oluşturulmuş.", 409);
      }
      const now = new Date().toISOString();
      let stockUndo: {
        itemId: string;
        quantity: number;
        unitCost: number;
        adjustmentMovement: MovementInput;
      } | null = null;
      const stockUndoWrites: any[] = [];
      if (isReversibleStockPurchase) {
        const movementRows = await db
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.id, row.sourceRecordId!))
          .limit(1);
        const linkedByTransaction = movementRows[0]
          ? []
          : await db
              .select()
              .from(stockMovements)
              .where(eq(stockMovements.transactionId, row.id))
              .limit(1);
        const movement = movementRows[0] ?? linkedByTransaction[0];
        if (!movement || movement.type !== "purchase") {
          throw new RouteInputError(
            "Bu stok alımının bağlı stok hareketi bulunamadı; stok kaydı değişmeden finans kaydı iptal edilmedi.",
            409,
          );
        }
        const itemRows = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, movement.itemId))
          .limit(1);
        const item = itemRows[0];
        if (!item) {
          throw new RouteInputError("Stok kartı bulunamadı; güvenli geri alma yapılamadı.", 409);
        }
        const purchaseQuantity = Number(movement.quantity);
        if (Number(item.quantity) + 0.000001 < purchaseQuantity) {
          throw new RouteInputError(
            "Stok miktarı bu alımı tamamen geri almaya yetmiyor. Kullanılan veya satılan miktar geri gelmeden finans ve stok birlikte geri alınamaz.",
            409,
          );
        }
        const purchaseCostCents =
          movement.totalCostCents ??
          Math.round(purchaseQuantity * Number(movement.unitCostCents ?? 0));
        const nextQuantity = Math.max(0, Number(item.quantity) - purchaseQuantity);
        const currentValueCents = Math.round(
          Number(item.quantity) * Number(item.unitCostCents ?? 0),
        );
        const nextValueCents = Math.max(0, currentValueCents - purchaseCostCents);
        const nextUnitCostCents =
          nextQuantity > 0 ? Math.round(nextValueCents / nextQuantity) : 0;
        // Orijinal hareketi silmek, sonradan yapılan stok hareketlerinin
        // zaman sırasını bozuyordu. Bunun yerine denetim izinde kalan negatif
        // “iade çıkışı” ekliyoruz. Böylece aynı satın alma tamamen geri
        // alınır, stok ve finans aynı anda sıfırlanır, sonraki hareketler de
        // okunabilir kalır.
        const adjustmentMovement: MovementInput = {
          id: `sm-reversal-${row.id}`,
          itemId: item.id,
          itemName: movement.itemName,
          date: payload.reversalDate,
          type: "return_out",
          quantity: purchaseQuantity,
          packageCount: movement.packageCount ?? undefined,
          unitsPerPackage: movement.unitsPerPackage ?? undefined,
          unitCost: Number(movement.unitCostCents ?? 0) / 100,
          totalCost: purchaseCostCents / 100,
          lot: movement.lot ?? undefined,
          expiryDate: movement.expiryDate ?? undefined,
          documentType: movement.documentType ?? undefined,
          documentRef: movement.documentRef ?? undefined,
          transactionId: `${row.id}-reversal-stock`,
          note: `Geri alma: ${reason}`,
        };
        stockUndoWrites.push(
          db
            .update(inventoryItems)
            .set({
              quantity: nextQuantity,
              unitCostCents: nextUnitCostCents,
              updatedAt: now,
            })
            .where(eq(inventoryItems.id, item.id)),
          db.insert(stockMovements).values(movementValues(adjustmentMovement)),
        );
        stockUndo = {
          itemId: item.id,
          quantity: nextQuantity,
          unitCost: nextUnitCostCents / 100,
          adjustmentMovement,
        };
      }
      const reversal: TransactionInput = {
        ...transactionFromRow(row),
        id: `${row.id}-reversal-${crypto.randomUUID()}`,
        date: payload.reversalDate,
        time: row.time,
        // A kasa çekimini ikinci bir çekimle değil, yalnız nakit etkili bir
        // karşı girişle tersleriz. Böylece kâr/zarar şişmez.
        kind: row.kind === "income" ? "expense" : "income",
        category: `Ters kayıt · ${row.category}`,
        description: `Ters kayıt: ${row.description} · ${reason}`,
        reversalOfId: row.id,
        sourceModule: "reversal",
        sourceRecordId: row.id,
        sourceTransactionId: row.id,
        postingMode: row.kind === "withdrawal" ? "cash_only" : row.postingMode,
        costBehavior: row.kind === "withdrawal" ? "non_expense" : row.costBehavior,
        // Ters kayıt muhasebe zincirinde kalır, fakat günlük ekranlara tekrar
        // gelir/gider olarak yansımaz. Ana satır da aşağıda iptal edilir.
        status: "cancelled",
        isAutomatic: true,
      };
      const audit = db.insert(transactionAuditEvents).values({
        id: crypto.randomUUID(),
        transactionId: row.id,
        action: "reversed",
        reason,
        snapshotJson: JSON.stringify(transactionFromRow(row)),
        createdAt: now,
      });
      const reversalWrite = db.insert(transactions).values(transactionValues(reversal));
      const cancelSource = db
        .update(transactions)
        .set({ status: "cancelled", updatedAt: now })
        .where(eq(transactions.id, row.id));
      const sourceEvent = (await db
        .select()
        .from(financialEvents)
        .where(eq(financialEvents.sourceRecordId, row.id))
        .limit(1))[0];
      const reversalJournalWrites = [];
      if (sourceEvent) {
        const sourceLines = await db
          .select()
          .from(financialJournalLines)
          .where(eq(financialJournalLines.eventId, sourceEvent.id));
        const reversedLines = reversalJournal(sourceLines);
        const reversalEventId = `evt-reversal-${reversal.id}`;
        reversalJournalWrites.push(
          db.insert(financialEvents).values({
            id: reversalEventId,
            eventType: "reversal",
            effectiveDate: reversal.date,
            status: "posted",
            sourceModule: "legacy_reversal",
            sourceRecordId: reversal.id,
            counterparty: reversal.counterparty || "",
            description: reversal.description,
            reversalOfId: sourceEvent.id,
            payloadJson: JSON.stringify({ reason, originalTransactionId: row.id }),
            createdBy: currentUser.email,
          }),
          ...reversedLines.map((line, index) => db.insert(financialJournalLines).values({
            id: `jln-${reversalEventId}-${index + 1}`,
            eventId: reversalEventId,
            accountCode: line.accountCode,
            debitCents: line.debitCents,
            creditCents: line.creditCents,
            memo: reversal.description,
          })),
        );
      }
      if (related.length) {
        const cancelRelated = db
          .update(transactions)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(transactions.sourceTransactionId, row.id));
        await db.batch([reversalWrite, cancelSource, cancelRelated, audit, ...stockUndoWrites, ...reversalJournalWrites]);
      } else {
        await db.batch([reversalWrite, cancelSource, audit, ...stockUndoWrites, ...reversalJournalWrites]);
      }
      return success({
        ok: true,
        reversal,
        cancelledIds: [row.id, reversal.id, ...related.map((item) => item.id)],
        stockUndo,
      });
    } else if (payload.action === "saveRecurringRule") {
      const values = recurringRuleValues(payload.rule);
      await db
        .insert(recurringExpenseRules)
        .values(values)
        .onConflictDoUpdate({
          target: recurringExpenseRules.id,
          set: values,
        });
    } else if (payload.action === "payRecurringOccurrence") {
      await assertTransactionWritesUnlocked(db, [payload.transaction]);
      await assertDatesUnlocked(db, [
        payload.occurrence.paidDate,
      ]);
      const occurrence = recurringOccurrenceValues(payload.occurrence);
      const transaction = transactionValues(payload.transaction);
      await db.batch([
        db
          .insert(recurringExpenseOccurrences)
          .values(occurrence)
          .onConflictDoUpdate({
            target: recurringExpenseOccurrences.id,
            set: occurrence,
          }),
        db
          .insert(transactions)
          .values(transaction)
          .onConflictDoUpdate({
            target: transactions.id,
            set: transaction,
          }),
      ]);
    } else if (payload.action === "saveMonthlyClosing") {
      const input = payload.closing;
      const existingRows = await db
        .select()
        .from(monthlyClosings)
        .orderBy(desc(monthlyClosings.periodKey));
      const existing = existingRows.find(
        (row) => row.periodKey === input.period,
      );
      if (
        existing &&
        (existing.status === "closed" ||
          existing.status === "closed_with_variance")
      ) {
        throw new RouteInputError(
          `${input.period} dönemi zaten kapalı. Değişiklik için önce gerekçeyle yeniden açın.`,
          409,
        );
      }

      const opening = resolveOpeningBalances({
        period: input.period,
        closings: existingRows.map(monthlyClosingFromRow),
        openingCash: input.openingCash,
        openingBank: input.openingBank,
      });
      const transactionRows = await db.select().from(transactions);
      const summary = calculateMonthlyClose({
        period: input.period,
        transactions: transactionRows.map(transactionFromRow),
        openingCash: opening.openingCash,
        openingBank: opening.openingBank,
      });
      const decision = assessMonthlyClose({
        summary,
        actualCash: input.actualCash,
        actualBank: input.actualBank,
        actualPosPending: input.actualPosPending,
        today: todayInIstanbul(),
        varianceNote: input.varianceNote,
      });

      if (!decision.canClose) {
        const blockerMessages: Record<string, string> = {
          period_not_finished: "Ay sona ermeden kapanış yapılamaz.",
          opening_cash_missing:
            "İlk kapanış için ay başı nakit kasasını girin.",
          opening_bank_missing:
            "İlk kapanış için ay başı banka bakiyesini girin.",
          actual_cash_missing: "Fiziksel kasa sayımını girin.",
          actual_bank_missing: "Fiili banka bakiyesini girin.",
          actual_posPending_missing: "Bekleyen POS fiili toplamını girin.",
          variance_note_required:
            "Fark veya veri uyarısı için en az 5 karakterlik açıklama girin.",
        };
        throw new RouteInputError(
          decision.blockers
            .map(
              (blocker: string) =>
                blockerMessages[blocker] || "Kapanış bilgileri eksik.",
            )
            .join(" "),
        );
      }

      const now = new Date().toISOString();
      const status = decision.status;
      const actualCash = Number(input.actualCash);
      const actualBank = Number(input.actualBank);
      const actualPosPending = Number(input.actualPosPending);
      const values = {
        periodKey: input.period,
        status,
        openingCashCents: cents(summary.openingCash),
        openingBankCents: cents(summary.openingBank),
        expectedCashCents: cents(summary.expectedCash),
        expectedBankCents: cents(summary.expectedBank),
        expectedPosPendingCents: cents(summary.expectedPosPending),
        actualCashCents: cents(actualCash),
        actualBankCents: cents(actualBank),
        actualPosPendingCents: cents(actualPosPending),
        cashDifferenceCents: cents(
          decision.channels.cash.difference,
        ),
        bankDifferenceCents: cents(
          decision.channels.bank.difference,
        ),
        posDifferenceCents: cents(
          decision.channels.posPending.difference,
        ),
        incomeCents: cents(summary.income),
        recognizedExpenseCents: cents(summary.recognizedExpense),
        undocumentedOutflowCents: cents(summary.undocumentedOutflow),
        withdrawalsCents: cents(summary.withdrawals),
        posSettlementsCents: cents(summary.posSettlements),
        dataQualityJson: JSON.stringify(summary.dataQualityFlags),
        varianceNote: String(input.varianceNote ?? "").trim(),
        closedAt: now,
        reopenedAt: null,
        reopenReason: "",
        updatedAt: now,
      };
      const snapshot = {
        period: input.period,
        status,
        openingCash: summary.openingCash,
        openingBank: summary.openingBank,
        expectedCash: summary.expectedCash,
        expectedBank: summary.expectedBank,
        expectedPosPending: summary.expectedPosPending,
        actualCash,
        actualBank,
        actualPosPending,
        cashDifference: decision.channels.cash.difference,
        bankDifference: decision.channels.bank.difference,
        posDifference: decision.channels.posPending.difference,
        income: summary.income,
        recognizedExpense: summary.recognizedExpense,
        undocumentedOutflow: summary.undocumentedOutflow,
        withdrawals: summary.withdrawals,
        posSettlements: summary.posSettlements,
        dataQualityFlags: summary.dataQualityFlags,
        varianceNote: values.varianceNote,
        closedAt: now,
        reopenedAt: undefined,
        reopenReason: "",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      await db.batch([
        db
          .insert(monthlyClosings)
          .values(values)
          .onConflictDoUpdate({
            target: monthlyClosings.periodKey,
            set: values,
          }),
        db.insert(monthlyCloseEvents).values({
          id: crypto.randomUUID(),
          periodKey: input.period,
          action: "closed",
          snapshotJson: JSON.stringify(snapshot),
          reason: values.varianceNote,
          createdAt: now,
        }),
      ]);
      return success({ ok: true, closing: snapshot });
    } else if (payload.action === "reopenMonthlyClosing") {
      const reason = String(payload.reason ?? "").trim();
      if (reason.length < 5) {
        throw new RouteInputError(
          "Dönemi yeniden açmak için en az 5 karakterlik gerekçe girin.",
        );
      }
      const rows = await db
        .select()
        .from(monthlyClosings)
        .where(eq(monthlyClosings.periodKey, payload.period))
        .limit(1);
      const existing = rows[0];
      if (!existing) {
        throw new RouteInputError("Kapanış kaydı bulunamadı.", 404);
      }
      if (existing.status === "open") {
        throw new RouteInputError("Bu dönem zaten açık.");
      }

      const now = new Date().toISOString();
      const previousSnapshot = monthlyClosingFromRow(existing);
      const reopened = {
        ...previousSnapshot,
        status: "open",
        reopenedAt: now,
        reopenReason: reason,
        updatedAt: now,
      };
      await db.batch([
        db
          .update(monthlyClosings)
          .set({
            status: "open",
            reopenedAt: now,
            reopenReason: reason,
            updatedAt: now,
          })
          .where(eq(monthlyClosings.periodKey, payload.period)),
        db.insert(monthlyCloseEvents).values({
          id: crypto.randomUUID(),
          periodKey: payload.period,
          action: "reopened",
          snapshotJson: JSON.stringify(previousSnapshot),
          reason,
          createdAt: now,
        }),
      ]);
      return success({ ok: true, closing: reopened });
    } else if (payload.action === "saveGoal") {
      const goal = payload.goal;
      if (!goal.name.trim() || !goal.metric.trim() || !goal.startDate || !goal.endDate) {
        throw new RouteInputError("Hedef adı, ölçütü ve tarih aralığı zorunludur.");
      }
      if (goal.startDate > goal.endDate) {
        throw new RouteInputError("Hedef başlangıcı bitiş tarihinden sonra olamaz.");
      }
      if (!Number.isFinite(Number(goal.targetValue)) || Number(goal.targetValue) < 0) {
        throw new RouteInputError("Hedef değeri geçersiz.");
      }
      const now = new Date().toISOString();
      const values = {
        id: goal.id,
        name: goal.name.trim(),
        metric: goal.metric.trim(),
        direction: goal.direction === "down" ? "down" : "up",
        unit: goal.unit || "TRY",
        targetValue: Number(goal.targetValue),
        baselineValue: Number(goal.baselineValue || 0),
        currentOverride: goal.currentOverride === undefined ? null : Number(goal.currentOverride),
        startDate: goal.startDate,
        endDate: goal.endDate,
        scenarioMode: ["base", "optimistic", "pessimistic"].includes(goal.scenarioMode || "") ? goal.scenarioMode! : "base",
        active: goal.active !== false,
        note: goal.note || "",
        updatedAt: now,
      };
      await db.insert(financialGoals).values(values).onConflictDoUpdate({ target: financialGoals.id, set: values });
    } else if (payload.action === "saveGoalMilestone") {
      const milestone = payload.milestone;
      if (!milestone.goalId || !milestone.label.trim() || !milestone.targetDate || !Number.isFinite(Number(milestone.targetValue))) {
        throw new RouteInputError("Kilometre taşı bilgileri eksik veya geçersiz.");
      }
      const values = {
        id: milestone.id, goalId: milestone.goalId, label: milestone.label.trim(), targetValue: Number(milestone.targetValue),
        targetDate: milestone.targetDate, completedAt: milestone.completedAt || null,
      };
      await db.insert(goalMilestones).values(values).onConflictDoUpdate({ target: goalMilestones.id, set: values });
    } else if (payload.action === "saveValuationRate") {
      const rate = payload.rate;
      if (!rate.assetCode.trim() || !Number.isFinite(Number(rate.unitPrice)) || Number(rate.unitPrice) <= 0 || !rate.effectiveAt) {
        throw new RouteInputError("Değerleme kuru/maden fiyatı geçersiz.");
      }
      const values = {
        id: rate.id, assetCode: rate.assetCode.trim().toUpperCase(), unitPriceCents: cents(rate.unitPrice),
        source: rate.source || "manual", effectiveAt: rate.effectiveAt, createdBy: currentUser.email,
      };
      await db.insert(valuationRates).values(values).onConflictDoUpdate({ target: valuationRates.id, set: values });
    } else if (payload.action === "saveInstallmentPlan") {
      const recordRows = await db.select().from(ledgerRecords).where(eq(ledgerRecords.id, payload.ledgerRecordId)).limit(1);
      if (!recordRows[0]) throw new RouteInputError("Taksit planının bağlı olduğu borç/alacak bulunamadı.", 404);
      const schedules = payload.schedules ?? [];
      if (!schedules.length || schedules.length > 120) throw new RouteInputError("Taksit planı 1 ile 120 dönem arasında olmalıdır.");
      const seen = new Set<number>();
      for (const schedule of schedules) {
        if (schedule.ledgerRecordId !== payload.ledgerRecordId || !schedule.dueDate || !Number.isInteger(Number(schedule.installmentNo)) || Number(schedule.installmentNo) < 1 || seen.has(Number(schedule.installmentNo))) {
          throw new RouteInputError("Taksit planında sıra veya tarih hatası var.");
        }
        if (!Number.isFinite(Number(schedule.amount)) || Number(schedule.amount) < 0) throw new RouteInputError("Taksit tutarı geçersiz.");
        seen.add(Number(schedule.installmentNo));
      }
      await db.delete(installmentSchedules).where(eq(installmentSchedules.ledgerRecordId, payload.ledgerRecordId));
      for (const schedule of schedules) {
        await db.insert(installmentSchedules).values({
          id: schedule.id, ledgerRecordId: schedule.ledgerRecordId, installmentNo: Number(schedule.installmentNo),
          dueDate: schedule.dueDate, amountCents: cents(schedule.amount), denominationQuantity: schedule.denominationQuantity ?? null,
          status: schedule.status || "planned", paymentId: schedule.paymentId || null, updatedAt: new Date().toISOString(),
        });
      }
    } else if (payload.action === "saveSetting") {
      const values = {
        key: payload.key,
        value: payload.value,
        updatedAt: new Date().toISOString(),
      };
      await db
        .insert(settings)
        .values(values)
        .onConflictDoUpdate({ target: settings.key, set: values });
    } else {
      return Response.json({ error: "Geçersiz kayıt işlemi." }, { status: 400 });
    }

    return success();
  } catch (error) {
    return Response.json(
      { error: routeError(error), code: error instanceof FinanceAuthError ? error.code : undefined },
      { status: routeStatus(error), headers: { "cache-control": "no-store, private" } },
    );
  }
}
