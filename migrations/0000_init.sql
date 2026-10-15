CREATE TABLE `agent_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` text NOT NULL,
	`trigger` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`ok` integer NOT NULL,
	`error` text,
	`latency_ms` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`output_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_runs_lead_idx` ON `agent_runs` (`lead_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company` text NOT NULL,
	`phone` text NOT NULL,
	`source` text NOT NULL,
	`rep_id` text NOT NULL,
	`last_contact_at` text NOT NULL,
	`last_buyer_message_at` text,
	`created_at` text NOT NULL,
	`tag` text NOT NULL,
	`reason` text NOT NULL,
	`needs_reply` integer NOT NULL,
	`buyer_said_no` integer NOT NULL,
	`requested_date` text,
	`next_follow_up_date` text NOT NULL,
	`date_rule` text NOT NULL,
	`draft` text NOT NULL,
	`draft_status` text DEFAULT 'ai' NOT NULL,
	`agent_source` text NOT NULL,
	`agent_updated_at` text NOT NULL,
	`change_note` text,
	FOREIGN KEY (`rep_id`) REFERENCES `reps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_phone_unique` ON `leads` (`phone`);--> statement-breakpoint
CREATE INDEX `leads_rep_next_idx` ON `leads` (`rep_id`,`next_follow_up_date`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` text NOT NULL,
	`sender` text NOT NULL,
	`text` text NOT NULL,
	`sent_at` text NOT NULL,
	`origin` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_lead_sent_idx` ON `messages` (`lead_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
