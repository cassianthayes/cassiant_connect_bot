CREATE TABLE `payments` (
	`charge_id` text PRIMARY KEY NOT NULL,
	`telegram_id` integer NOT NULL,
	`days` integer NOT NULL,
	`stars` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `promo_attempts` (
	`telegram_id` integer PRIMARY KEY NOT NULL,
	`fails` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `promocodes` (
	`code` text PRIMARY KEY NOT NULL,
	`days` integer NOT NULL,
	`used_by` integer,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
