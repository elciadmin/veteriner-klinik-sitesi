CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`purchase_unit` text,
	`units_per_package` real DEFAULT 1 NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`minimum_quantity` real DEFAULT 0 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`supplier` text DEFAULT '' NOT NULL,
	`lot` text DEFAULT '' NOT NULL,
	`expiry_date` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`method` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `ledger_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_payments_record_idx` ON `ledger_payments` (`record_id`);--> statement-breakpoint
CREATE INDEX `ledger_payments_date_idx` ON `ledger_payments` (`date`);--> statement-breakpoint
CREATE TABLE `ledger_records` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`counterparty` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`detail` text NOT NULL,
	`document_ref` text DEFAULT '' NOT NULL,
	`created_date` text NOT NULL,
	`due_date` text NOT NULL,
	`original_amount_cents` integer NOT NULL,
	`reserve_cents` integer DEFAULT 0 NOT NULL,
	`reminder_days` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ledger_records_due_idx` ON `ledger_records` (`due_date`);--> statement-breakpoint
CREATE INDEX `ledger_records_type_idx` ON `ledger_records` (`type`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`item_name` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_cost_cents` integer,
	`package_count` real,
	`units_per_package` real,
	`total_cost_cents` integer,
	`lot` text,
	`expiry_date` text,
	`document_type` text,
	`document_ref` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_movements_item_idx` ON `stock_movements` (`item_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_date_idx` ON `stock_movements` (`date`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`counterparty` text DEFAULT '' NOT NULL,
	`operation_type` text DEFAULT '' NOT NULL,
	`cost_behavior` text DEFAULT '' NOT NULL,
	`related_income_id` text,
	`amount_cents` integer NOT NULL,
	`payment_method` text NOT NULL,
	`document_type` text DEFAULT 'none' NOT NULL,
	`document_ref` text DEFAULT '' NOT NULL,
	`vat_rate_bps` integer DEFAULT 0 NOT NULL,
	`pos_rate_bps` integer DEFAULT 0 NOT NULL,
	`pos_status` text,
	`settlement_date` text,
	`status` text,
	`is_automatic` integer DEFAULT false NOT NULL,
	`source_transaction_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_source_idx` ON `transactions` (`source_transaction_id`);