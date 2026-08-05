CREATE TABLE `transaction_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_audit_events_transaction_idx` ON `transaction_audit_events` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transaction_audit_events_created_idx` ON `transaction_audit_events` (`created_at`);--> statement-breakpoint
ALTER TABLE `ledger_payments` ADD `transaction_id` text;--> statement-breakpoint
CREATE INDEX `ledger_payments_transaction_idx` ON `ledger_payments` (`transaction_id`);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `transaction_id` text;--> statement-breakpoint
CREATE INDEX `stock_movements_transaction_idx` ON `stock_movements` (`transaction_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `settled_amount_cents` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `settlement_reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `posting_mode` text DEFAULT 'economic_and_cash' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `source_module` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `source_record_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `reversal_of_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `transactions_source_record_idx` ON `transactions` (`source_module`,`source_record_id`);--> statement-breakpoint
CREATE INDEX `transactions_pos_status_idx` ON `transactions` (`pos_status`,`settlement_date`);
