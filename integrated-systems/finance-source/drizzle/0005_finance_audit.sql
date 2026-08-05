CREATE TABLE `finance_audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_email` text NOT NULL,
  `actor_role` text NOT NULL,
  `action` text NOT NULL,
  `entity_type` text DEFAULT 'system' NOT NULL,
  `entity_id` text DEFAULT '' NOT NULL,
  `request_id` text NOT NULL,
  `payload_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `finance_audit_actor_idx` ON `finance_audit_events` (`actor_email`);
--> statement-breakpoint
CREATE INDEX `finance_audit_action_idx` ON `finance_audit_events` (`action`);
--> statement-breakpoint
CREATE INDEX `finance_audit_entity_idx` ON `finance_audit_events` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `finance_audit_created_idx` ON `finance_audit_events` (`created_at`);
