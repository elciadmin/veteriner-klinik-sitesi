-- V7 finance core. Existing operational tables are retained for compatibility;
-- all new financial writes will be attributable to one immutable source event.

CREATE TABLE `product_definitions` (
  `id` text PRIMARY KEY NOT NULL,
  `canonical_name` text NOT NULL,
  `product_family` text NOT NULL,
  `base_unit` text NOT NULL,
  `attributes_json` text DEFAULT '{}' NOT NULL,
  `aliases_json` text DEFAULT '[]' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK (`base_unit` IN ('piece','roll','tablet','ml','gram','cm')),
  CHECK (`status` IN ('active','archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_definitions_identity_idx`
  ON `product_definitions` (`product_family`,`base_unit`,`attributes_json`);
--> statement-breakpoint

ALTER TABLE `inventory_items` ADD `product_definition_id` text REFERENCES `product_definitions`(`id`);
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `base_unit` text;
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `base_units_per_purchase_unit` real DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `attributes_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
CREATE INDEX `inventory_items_product_definition_idx` ON `inventory_items` (`product_definition_id`);
--> statement-breakpoint

CREATE TABLE `import_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `source_file_name` text DEFAULT '' NOT NULL,
  `source_sha256` text DEFAULT '' NOT NULL,
  `schema_version` integer NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `coverage_start_date` text DEFAULT '' NOT NULL,
  `coverage_end_date` text DEFAULT '' NOT NULL,
  `completeness_bps` integer DEFAULT 0 NOT NULL,
  `warnings_json` text DEFAULT '[]' NOT NULL,
  `summary_json` text DEFAULT '{}' NOT NULL,
  `created_by` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `applied_at` text,
  `rolled_back_at` text,
  `rollback_reason` text DEFAULT '' NOT NULL,
  CHECK (`status` IN ('draft','validated','applied','failed','rolled_back')),
  CHECK (`completeness_bps` >= 0 AND `completeness_bps` <= 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_batches_source_hash_idx` ON `import_batches` (`source_sha256`);
--> statement-breakpoint
CREATE TABLE `import_batch_items` (
  `id` text PRIMARY KEY NOT NULL,
  `batch_id` text NOT NULL REFERENCES `import_batches`(`id`),
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `source_row_number` integer,
  `raw_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_batch_items_entity_idx` ON `import_batch_items` (`batch_id`,`entity_type`,`entity_id`);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `import_batch_id` text REFERENCES `import_batches`(`id`);
--> statement-breakpoint
CREATE INDEX `transactions_import_batch_idx` ON `transactions` (`import_batch_id`);
--> statement-breakpoint
ALTER TABLE `ledger_records` ADD `import_batch_id` text REFERENCES `import_batches`(`id`);
--> statement-breakpoint
CREATE INDEX `ledger_records_import_batch_idx` ON `ledger_records` (`import_batch_id`);
--> statement-breakpoint
ALTER TABLE `recurring_expense_rules` ADD `import_batch_id` text REFERENCES `import_batches`(`id`);
--> statement-breakpoint
CREATE INDEX `recurring_expense_rules_import_batch_idx` ON `recurring_expense_rules` (`import_batch_id`);
--> statement-breakpoint
ALTER TABLE `ledger_payments` ADD `import_batch_id` text REFERENCES `import_batches`(`id`);
--> statement-breakpoint
CREATE INDEX `ledger_payments_import_batch_idx` ON `ledger_payments` (`import_batch_id`);
--> statement-breakpoint

CREATE TABLE `receipt_documents` (
  `id` text PRIMARY KEY NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `source_type` text DEFAULT 'manual' NOT NULL,
  `supplier_name` text DEFAULT '' NOT NULL,
  `document_date` text DEFAULT '' NOT NULL,
  `document_ref` text DEFAULT '' NOT NULL,
  `declared_total_cents` integer,
  `parsed_payload_json` text DEFAULT '{}' NOT NULL,
  `reviewed_payload_json` text DEFAULT '{}' NOT NULL,
  `confirmed_event_id` text,
  `created_by` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `reviewed_at` text,
  CHECK (`status` IN ('draft','uploaded','parsed','needs_review','confirmed','rejected')),
  CHECK (`source_type` IN ('manual','photo','pdf','import'))
);
--> statement-breakpoint
CREATE INDEX `receipt_documents_status_idx` ON `receipt_documents` (`status`,`created_at`);
--> statement-breakpoint

CREATE TABLE `financial_events` (
  `id` text PRIMARY KEY NOT NULL,
  `event_type` text NOT NULL,
  `effective_date` text NOT NULL,
  `status` text DEFAULT 'posted' NOT NULL,
  `source_module` text NOT NULL,
  `source_record_id` text NOT NULL,
  `counterparty` text DEFAULT '' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `document_id` text REFERENCES `receipt_documents`(`id`),
  `reversal_of_id` text REFERENCES `financial_events`(`id`),
  `import_batch_id` text REFERENCES `import_batches`(`id`),
  `payload_json` text DEFAULT '{}' NOT NULL,
  `created_by` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK (`status` IN ('draft','posted','reversed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_events_source_idx`
  ON `financial_events` (`source_module`,`source_record_id`);
--> statement-breakpoint
CREATE INDEX `financial_events_date_idx` ON `financial_events` (`effective_date`,`event_type`);
--> statement-breakpoint

CREATE TABLE `financial_journal_lines` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL REFERENCES `financial_events`(`id`),
  `account_code` text NOT NULL,
  `debit_cents` integer DEFAULT 0 NOT NULL,
  `credit_cents` integer DEFAULT 0 NOT NULL,
  `tax_code` text DEFAULT '' NOT NULL,
  `inventory_item_id` text REFERENCES `inventory_items`(`id`),
  `ledger_record_id` text REFERENCES `ledger_records`(`id`),
  `memo` text DEFAULT '' NOT NULL,
  CHECK (`debit_cents` >= 0),
  CHECK (`credit_cents` >= 0),
  CHECK ((`debit_cents` = 0) != (`credit_cents` = 0))
);
--> statement-breakpoint
CREATE INDEX `financial_journal_lines_event_idx` ON `financial_journal_lines` (`event_id`);
--> statement-breakpoint
CREATE INDEX `financial_journal_lines_account_idx` ON `financial_journal_lines` (`account_code`);
--> statement-breakpoint

CREATE TABLE `pos_settlement_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `bank_reference` text NOT NULL,
  `settlement_date` text NOT NULL,
  `gross_cents` integer NOT NULL,
  `commission_cents` integer DEFAULT 0 NOT NULL,
  `net_cents` integer NOT NULL,
  `bank_account` text DEFAULT 'bank' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK (`gross_cents` >= 0),
  CHECK (`commission_cents` >= 0),
  CHECK (`net_cents` >= 0),
  CHECK (`status` IN ('open','matched','reversed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pos_settlement_batches_bank_reference_idx`
  ON `pos_settlement_batches` (`bank_reference`);
--> statement-breakpoint
CREATE TABLE `pos_settlement_allocations` (
  `id` text PRIMARY KEY NOT NULL,
  `batch_id` text NOT NULL REFERENCES `pos_settlement_batches`(`id`),
  `transaction_id` text NOT NULL REFERENCES `transactions`(`id`),
  `gross_cents` integer NOT NULL,
  `commission_cents` integer DEFAULT 0 NOT NULL,
  `net_cents` integer NOT NULL,
  CHECK (`gross_cents` >= 0),
  CHECK (`commission_cents` >= 0),
  CHECK (`net_cents` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pos_settlement_allocations_transaction_idx`
  ON `pos_settlement_allocations` (`transaction_id`);
--> statement-breakpoint

CREATE TABLE `idempotency_commands` (
  `idempotency_key` text PRIMARY KEY NOT NULL,
  `action` text NOT NULL,
  `actor_email` text NOT NULL,
  `payload_sha256` text NOT NULL,
  `status` text NOT NULL,
  `response_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `completed_at` text,
  CHECK (`status` IN ('processing','completed','failed'))
);
--> statement-breakpoint

CREATE TABLE `day_closings` (
  `date` text PRIMARY KEY NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `opening_cash_cents` integer,
  `expected_cash_cents` integer NOT NULL,
  `physical_cash_cents` integer,
  `cash_difference_cents` integer,
  `pending_pos_count` integer DEFAULT 0 NOT NULL,
  `missing_document_count` integer DEFAULT 0 NOT NULL,
  `variance_reason` text DEFAULT '' NOT NULL,
  `closed_by` text DEFAULT '' NOT NULL,
  `closed_at` text,
  `reopened_by` text DEFAULT '' NOT NULL,
  `reopened_at` text,
  `reopen_reason` text DEFAULT '' NOT NULL,
  CHECK (`status` IN ('open','closed','reopened'))
);
--> statement-breakpoint
CREATE INDEX `day_closings_status_idx` ON `day_closings` (`status`,`date`);
