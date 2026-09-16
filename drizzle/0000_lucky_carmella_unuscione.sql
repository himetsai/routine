CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`for_date` text NOT NULL,
	`kind` text NOT NULL,
	`logged_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_routine_date_idx` ON `events` (`routine_id`,`for_date`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`ip` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_start` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pauses` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`note` text,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`importance` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`created_on` text NOT NULL,
	`archived_on` text
);
--> statement-breakpoint
CREATE TABLE `routine_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`cadence` text NOT NULL,
	`times_per_week` integer,
	`effective_from` text NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `schedules_routine_idx` ON `routine_schedules` (`routine_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`day_cutoff_hour` integer DEFAULT 4 NOT NULL
);
