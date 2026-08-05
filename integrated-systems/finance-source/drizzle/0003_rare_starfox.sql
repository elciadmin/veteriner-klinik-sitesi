CREATE TABLE `monthly_close_events` (
	`id` text PRIMARY KEY NOT NULL,
	`period_key` text NOT NULL,
	`action` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`period_key`) REFERENCES `monthly_closings`(`period_key`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `monthly_close_events_period_idx` ON `monthly_close_events` (`period_key`);--> statement-breakpoint
CREATE INDEX `monthly_close_events_created_idx` ON `monthly_close_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `monthly_closings` (
	`period_key` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opening_cash_cents` integer NOT NULL,
	`opening_bank_cents` integer NOT NULL,
	`expected_cash_cents` integer NOT NULL,
	`expected_bank_cents` integer NOT NULL,
	`expected_pos_pending_cents` integer NOT NULL,
	`actual_cash_cents` integer NOT NULL,
	`actual_bank_cents` integer NOT NULL,
	`actual_pos_pending_cents` integer NOT NULL,
	`cash_difference_cents` integer NOT NULL,
	`bank_difference_cents` integer NOT NULL,
	`pos_difference_cents` integer NOT NULL,
	`income_cents` integer DEFAULT 0 NOT NULL,
	`recognized_expense_cents` integer DEFAULT 0 NOT NULL,
	`undocumented_outflow_cents` integer DEFAULT 0 NOT NULL,
	`withdrawals_cents` integer DEFAULT 0 NOT NULL,
	`pos_settlements_cents` integer DEFAULT 0 NOT NULL,
	`data_quality_json` text DEFAULT '[]' NOT NULL,
	`variance_note` text DEFAULT '' NOT NULL,
	`closed_at` text,
	`reopened_at` text,
	`reopen_reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `monthly_closings_status_idx` ON `monthly_closings` (`status`);--> statement-breakpoint
CREATE INDEX `monthly_closings_closed_at_idx` ON `monthly_closings` (`closed_at`);