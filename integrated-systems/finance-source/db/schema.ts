import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    kind: text("kind").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    counterparty: text("counterparty").notNull().default(""),
    operationType: text("operation_type").notNull().default(""),
    costBehavior: text("cost_behavior").notNull().default(""),
    relatedIncomeId: text("related_income_id"),
    amountCents: integer("amount_cents").notNull(),
    paymentMethod: text("payment_method").notNull(),
    documentType: text("document_type").notNull().default("none"),
    documentRef: text("document_ref").notNull().default(""),
    vatRateBps: integer("vat_rate_bps").notNull().default(0),
    posRateBps: integer("pos_rate_bps").notNull().default(0),
    posStatus: text("pos_status"),
    settlementDate: text("settlement_date"),
    settledAmountCents: integer("settled_amount_cents"),
    settlementReference: text("settlement_reference").notNull().default(""),
    postingMode: text("posting_mode")
      .notNull()
      .default("economic_and_cash"),
    sourceModule: text("source_module").notNull().default("manual"),
    sourceRecordId: text("source_record_id"),
    reversalOfId: text("reversal_of_id"),
    status: text("status"),
    isAutomatic: integer("is_automatic", { mode: "boolean" })
      .notNull()
      .default(false),
    sourceTransactionId: text("source_transaction_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(""),
  },
  (table) => [
    index("transactions_date_idx").on(table.date),
    index("transactions_source_idx").on(table.sourceTransactionId),
    index("transactions_source_record_idx").on(
      table.sourceModule,
      table.sourceRecordId,
    ),
    index("transactions_pos_status_idx").on(
      table.posStatus,
      table.settlementDate,
    ),
  ],
);

export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  purchaseUnit: text("purchase_unit"),
  unitsPerPackage: real("units_per_package").notNull().default(1),
  quantity: real("quantity").notNull().default(0),
  minimumQuantity: real("minimum_quantity").notNull().default(0),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  supplier: text("supplier").notNull().default(""),
  lot: text("lot").notNull().default(""),
  expiryDate: text("expiry_date").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => inventoryItems.id),
    itemName: text("item_name").notNull(),
    date: text("date").notNull(),
    type: text("type").notNull(),
    quantity: real("quantity").notNull(),
    unitCostCents: integer("unit_cost_cents"),
    packageCount: real("package_count"),
    unitsPerPackage: real("units_per_package"),
    totalCostCents: integer("total_cost_cents"),
    lot: text("lot"),
    expiryDate: text("expiry_date"),
    documentType: text("document_type"),
    documentRef: text("document_ref"),
    transactionId: text("transaction_id"),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("stock_movements_item_idx").on(table.itemId),
    index("stock_movements_date_idx").on(table.date),
    index("stock_movements_transaction_idx").on(table.transactionId),
  ],
);

export const ledgerRecords = sqliteTable(
  "ledger_records",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    counterparty: text("counterparty").notNull(),
    contactName: text("contact_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    detail: text("detail").notNull(),
    documentRef: text("document_ref").notNull().default(""),
    documentDate: text("document_date").notNull().default(""),
    stage: text("stage").notNull().default("note"),
    createdDate: text("created_date").notNull(),
    dueDate: text("due_date").notNull(),
    originalAmountCents: integer("original_amount_cents").notNull(),
    reserveCents: integer("reserve_cents").notNull().default(0),
    reminderDays: integer("reminder_days").notNull().default(3),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("ledger_records_due_idx").on(table.dueDate),
    index("ledger_records_type_idx").on(table.type),
  ],
);

export const ledgerLineItems = sqliteTable(
  "ledger_line_items",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id")
      .notNull()
      .references(() => ledgerRecords.id),
    inventoryItemId: text("inventory_item_id"),
    itemName: text("item_name").notNull(),
    category: text("category").notNull().default(""),
    quantity: real("quantity").notNull(),
    unit: text("unit").notNull().default("adet"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    trackStock: integer("track_stock", { mode: "boolean" })
      .notNull()
      .default(true),
    stockMovementId: text("stock_movement_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("ledger_line_items_record_idx").on(table.recordId),
    index("ledger_line_items_inventory_idx").on(table.inventoryItemId),
  ],
);

export const ledgerPayments = sqliteTable(
  "ledger_payments",
  {
    id: text("id").primaryKey(),
    recordId: text("record_id")
      .notNull()
      .references(() => ledgerRecords.id),
    amountCents: integer("amount_cents").notNull(),
    date: text("date").notNull(),
    method: text("method").notNull().default(""),
    note: text("note").notNull().default(""),
    status: text("status"),
    transactionId: text("transaction_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("ledger_payments_record_idx").on(table.recordId),
    index("ledger_payments_date_idx").on(table.date),
    index("ledger_payments_transaction_idx").on(table.transactionId),
  ],
);

export const transactionAuditEvents = sqliteTable(
  "transaction_audit_events",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id),
    action: text("action").notNull(),
    reason: text("reason").notNull().default(""),
    snapshotJson: text("snapshot_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("transaction_audit_events_transaction_idx").on(
      table.transactionId,
    ),
    index("transaction_audit_events_created_idx").on(table.createdAt),
  ],
);

export const recurringExpenseRules = sqliteTable(
  "recurring_expense_rules",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    counterparty: text("counterparty").notNull().default(""),
    amountCents: integer("amount_cents").notNull(),
    amountMode: text("amount_mode").notNull().default("fixed"),
    frequencyMonths: integer("frequency_months").notNull().default(1),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    nextReviewDate: text("next_review_date"),
    paymentMethod: text("payment_method").notNull().default("transfer"),
    documentType: text("document_type").notNull().default("none"),
    vatRateBps: integer("vat_rate_bps").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("recurring_expense_rules_start_idx").on(table.startDate),
    index("recurring_expense_rules_active_idx").on(table.active),
  ],
);

export const recurringExpenseOccurrences = sqliteTable(
  "recurring_expense_occurrences",
  {
    id: text("id").primaryKey(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => recurringExpenseRules.id),
    dueDate: text("due_date").notNull(),
    expectedAmountCents: integer("expected_amount_cents").notNull(),
    actualAmountCents: integer("actual_amount_cents"),
    status: text("status").notNull().default("paid"),
    paidDate: text("paid_date"),
    transactionId: text("transaction_id"),
    paymentMethod: text("payment_method"),
    documentType: text("document_type"),
    documentRef: text("document_ref").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("recurring_expense_occurrences_rule_idx").on(table.ruleId),
    index("recurring_expense_occurrences_due_idx").on(table.dueDate),
    index("recurring_expense_occurrences_transaction_idx").on(
      table.transactionId,
    ),
  ],
);

export const monthlyClosings = sqliteTable(
  "monthly_closings",
  {
    periodKey: text("period_key").primaryKey(),
    status: text("status").notNull().default("open"),
    openingCashCents: integer("opening_cash_cents").notNull(),
    openingBankCents: integer("opening_bank_cents").notNull(),
    expectedCashCents: integer("expected_cash_cents").notNull(),
    expectedBankCents: integer("expected_bank_cents").notNull(),
    expectedPosPendingCents: integer("expected_pos_pending_cents").notNull(),
    actualCashCents: integer("actual_cash_cents").notNull(),
    actualBankCents: integer("actual_bank_cents").notNull(),
    actualPosPendingCents: integer("actual_pos_pending_cents").notNull(),
    cashDifferenceCents: integer("cash_difference_cents").notNull(),
    bankDifferenceCents: integer("bank_difference_cents").notNull(),
    posDifferenceCents: integer("pos_difference_cents").notNull(),
    incomeCents: integer("income_cents").notNull().default(0),
    recognizedExpenseCents: integer("recognized_expense_cents")
      .notNull()
      .default(0),
    undocumentedOutflowCents: integer("undocumented_outflow_cents")
      .notNull()
      .default(0),
    withdrawalsCents: integer("withdrawals_cents").notNull().default(0),
    posSettlementsCents: integer("pos_settlements_cents")
      .notNull()
      .default(0),
    dataQualityJson: text("data_quality_json").notNull().default("[]"),
    varianceNote: text("variance_note").notNull().default(""),
    closedAt: text("closed_at"),
    reopenedAt: text("reopened_at"),
    reopenReason: text("reopen_reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("monthly_closings_status_idx").on(table.status),
    index("monthly_closings_closed_at_idx").on(table.closedAt),
  ],
);

export const monthlyCloseEvents = sqliteTable(
  "monthly_close_events",
  {
    id: text("id").primaryKey(),
    periodKey: text("period_key")
      .notNull()
      .references(() => monthlyClosings.periodKey),
    action: text("action").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("monthly_close_events_period_idx").on(table.periodKey),
    index("monthly_close_events_created_idx").on(table.createdAt),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const financeAuditEvents = sqliteTable(
  "finance_audit_events",
  {
    id: text("id").primaryKey(),
    actorEmail: text("actor_email").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull().default("system"),
    entityId: text("entity_id").notNull().default(""),
    requestId: text("request_id").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("finance_audit_actor_idx").on(table.actorEmail),
    index("finance_audit_action_idx").on(table.action),
    index("finance_audit_entity_idx").on(table.entityType, table.entityId),
    index("finance_audit_created_idx").on(table.createdAt),
  ],
);
