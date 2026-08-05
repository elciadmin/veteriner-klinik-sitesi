CREATE TABLE `recurring_expense_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`due_date` text NOT NULL,
	`expected_amount_cents` integer NOT NULL,
	`actual_amount_cents` integer,
	`status` text DEFAULT 'paid' NOT NULL,
	`paid_date` text,
	`transaction_id` text,
	`payment_method` text,
	`document_type` text,
	`document_ref` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `recurring_expense_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recurring_expense_occurrences_rule_idx` ON `recurring_expense_occurrences` (`rule_id`);--> statement-breakpoint
CREATE INDEX `recurring_expense_occurrences_due_idx` ON `recurring_expense_occurrences` (`due_date`);--> statement-breakpoint
CREATE INDEX `recurring_expense_occurrences_transaction_idx` ON `recurring_expense_occurrences` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `recurring_expense_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`counterparty` text DEFAULT '' NOT NULL,
	`amount_cents` integer NOT NULL,
	`amount_mode` text DEFAULT 'fixed' NOT NULL,
	`frequency_months` integer DEFAULT 1 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`next_review_date` text,
	`payment_method` text DEFAULT 'transfer' NOT NULL,
	`document_type` text DEFAULT 'none' NOT NULL,
	`vat_rate_bps` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recurring_expense_rules_start_idx` ON `recurring_expense_rules` (`start_date`);--> statement-breakpoint
CREATE INDEX `recurring_expense_rules_active_idx` ON `recurring_expense_rules` (`active`);