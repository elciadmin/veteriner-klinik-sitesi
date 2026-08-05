import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  financeAuditEvents,
  inventoryItems,
  ledgerLineItems,
  ledgerPayments,
  ledgerRecords,
  monthlyCloseEvents,
  monthlyClosings,
  recurringExpenseOccurrences,
  recurringExpenseRules,
  settings,
  stockMovements,
  transactionAuditEvents,
  transactions,
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
  reserve: number;
  reminderDays: number;
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
  date: string;
  method?: string;
  note?: string;
  status?: string;
  transactionId?: string;
};

type RecurringRuleInput = {
  id: string;
  name: string;
  category: string;
  counterparty: string;
  amount: number;
  amountMode: string;
  frequencyMonths: number;
  startDate: string;
  endDate?: string;
  nextReviewDate?: string;
  paymentMethod: string;
  documentType: string;
  vatRate: number;
  active: boolean;
  note: string;
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
};

type ClinicDataAction =
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
  | { action: "saveLedgerRecord"; record: LedgerInput }
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
  | { action: "saveSetting"; key: string; value: string };

function cents(value: number | null | undefined) {
  return Math.round(Number(value ?? 0) * 100);
}

function basisPoints(value: number | undefined) {
  return Math.round(Number(value ?? 0) * 10_000);
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
    reserveCents: cents(record.reserve),
    reminderDays: Number(record.reminderDays || 3),
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
    startDate: rule.startDate,
    endDate: rule.endDate || null,
    nextReviewDate: rule.nextReviewDate || null,
    paymentMethod: rule.paymentMethod || "transfer",
    documentType: rule.documentType || "none",
    vatRateBps: basisPoints(rule.vatRate),
    active: rule.active !== false,
    note: rule.note || "",
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
  if (payload.action === "saveTransactions") return { entityType: "transaction", entityId: payload.records.map((row) => row.id).join(",") };
  if (payload.action === "saveInventoryItem") return { entityType: "inventory", entityId: payload.item.id };
  if (payload.action === "saveQuickPurchase") return { entityType: "inventory", entityId: payload.item.id };
  if (payload.action === "saveQuickReceipt") return { entityType: "expense_receipt", entityId: payload.receiptId };
  if (payload.action === "saveStockMovement") return { entityType: "stock_movement", entityId: payload.movement.id };
  if (payload.action === "saveLedgerRecord" || payload.action === "saveLedgerInvoice") return { entityType: "ledger", entityId: payload.record.id };
  if (payload.action === "saveLedgerPayment") return { entityType: "ledger_payment", entityId: payload.payment.id };
  if (payload.action === "settlePosTransaction" || payload.action === "reverseTransaction") return { entityType: "transaction", entityId: payload.transactionId };
  if (payload.action === "saveRecurringRule") return { entityType: "recurring_rule", entityId: payload.rule.id };
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
      movementRows,
      recordRows,
      lineItemRows,
      paymentRows,
      recurringRuleRows,
      recurringOccurrenceRows,
      monthlyClosingRows,
      monthlyCloseEventRows,
      settingRows,
      auditRows,
    ] = await Promise.all([
      db
        .select()
        .from(transactions)
        .orderBy(desc(transactions.date), desc(transactions.time)),
      db.select().from(inventoryItems).orderBy(asc(inventoryItems.name)),
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
        date: string;
        method: string;
        note: string;
        status?: "cancelled";
        transactionId?: string;
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
        date: payment.date,
        method: payment.method,
        note: payment.note,
        status:
          payment.status === "cancelled" ? "cancelled" : undefined,
        transactionId: payment.transactionId ?? undefined,
      });
      paymentMap.set(payment.recordId, rows);
    }

    const response = {
      hasData:
        transactionRows.length +
          itemRows.length +
          movementRows.length +
          recordRows.length +
          lineItemRows.length +
          recurringRuleRows.length +
          recurringOccurrenceRows.length +
          monthlyClosingRows.length >
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
      })),
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
      records: recordRows.map((row) => ({
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
        reserve: row.reserveCents / 100,
        reminderDays: row.reminderDays,
        lineItems: lineItemMap.get(row.id) ?? [],
        payments: paymentMap.get(row.id) ?? [],
      })),
      recurringRules: recurringRuleRows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        counterparty: row.counterparty,
        amount: row.amountCents / 100,
        amountMode: row.amountMode,
        frequencyMonths: row.frequencyMonths,
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
    const suppliedRequestId = String(request.headers.get("x-request-id") ?? "");
    const requestId = /^[A-Za-z0-9._-]{8,100}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : crypto.randomUUID();
    // Audit existence is verified before any financial mutation. Missing audit
    // migration therefore blocks the write instead of silently changing data.
    await appendFinanceAudit(db, currentUser, payload, requestId, "attempted");
    const success = async (body: object = { ok: true }) => {
      await appendFinanceAudit(db, currentUser, payload, requestId, "completed");
      return Response.json(body, { headers: { "cache-control": "no-store, private", "x-request-id": requestId } });
    };

    if (payload.action === "saveTransactions") {
      await assertTransactionWritesUnlocked(db, payload.records);
      for (const record of payload.records) {
        const values = transactionValues(record);
        await db
          .insert(transactions)
          .values(values)
          .onConflictDoUpdate({ target: transactions.id, set: values });
      }
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
      const workingInventory = new Map(
        existingInventory.map((item) => [item.id, { ...item }] as const),
      );
      const finalInventory = new Map<string, ReturnType<typeof inventoryValues>>();
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
      await db.batch([
        db
          .insert(transactions)
          .values(transaction)
          .onConflictDoUpdate({
            target: transactions.id,
            set: transaction,
          }),
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
      await db
        .insert(ledgerRecords)
        .values(values)
        .onConflictDoUpdate({ target: ledgerRecords.id, set: values });
      if (payload.record.lineItems) {
        await db
          .delete(ledgerLineItems)
          .where(eq(ledgerLineItems.recordId, payload.record.id));
        for (const line of payload.record.lineItems) {
          await db.insert(ledgerLineItems).values(lineItemValues(line));
        }
      }
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
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new RouteInputError("Tahsilat/ödeme tutarı sıfırdan büyük olmalıdır.");
      }
      const priorPayments = await db
        .select()
        .from(ledgerPayments)
        .where(eq(ledgerPayments.recordId, record.id));
      const paidCents = priorPayments
        .filter(
          (row) => row.id !== payment.id && row.status !== "cancelled",
        )
        .reduce((sum, row) => sum + row.amountCents, 0);
      const remainingCents = Math.max(
        0,
        record.originalAmountCents - paidCents,
      );
      const amountCents = cents(amount);
      if (amountCents > remainingCents) {
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
      if (
        row.isAutomatic ||
        (row.sourceModule && row.sourceModule !== "manual")
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
      const now = new Date().toISOString();
      const audit = db.insert(transactionAuditEvents).values({
        id: crypto.randomUUID(),
        transactionId: row.id,
        action: "reversed",
        reason,
        snapshotJson: JSON.stringify(transactionFromRow(row)),
        createdAt: now,
      });
      const cancelOriginal = db
        .update(transactions)
        .set({ status: "cancelled", updatedAt: now })
        .where(eq(transactions.id, row.id));
      if (related.length) {
        const cancelRelated = db
          .update(transactions)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(transactions.sourceTransactionId, row.id));
        await db.batch([cancelOriginal, cancelRelated, audit]);
      } else {
        await db.batch([cancelOriginal, audit]);
      }
      return success({
        ok: true,
        cancelledIds: [row.id, ...related.map((item) => item.id)],
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
