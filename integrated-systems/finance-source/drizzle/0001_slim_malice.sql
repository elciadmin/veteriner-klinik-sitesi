CREATE TABLE `ledger_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`inventory_item_id` text,
	`item_name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`quantity` real NOT NULL,
	`unit` text DEFAULT 'adet' NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	`track_stock` integer DEFAULT true NOT NULL,
	`stock_movement_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `ledger_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ledger_line_items_record_idx` ON `ledger_line_items` (`record_id`);--> statement-breakpoint
CREATE INDEX `ledger_line_items_inventory_idx` ON `ledger_line_items` (`inventory_item_id`);--> statement-breakpoint
ALTER TABLE `ledger_records` ADD `document_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `ledger_records` ADD `stage` text DEFAULT 'note' NOT NULL;