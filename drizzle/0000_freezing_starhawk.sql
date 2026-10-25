CREATE TABLE `diaries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period` text NOT NULL,
	`from_day` text NOT NULL,
	`to_day` text NOT NULL,
	`body` text NOT NULL,
	`game_ids` text NOT NULL,
	`created_at` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `diaries_user_period` ON `diaries` (`user_id`,`period`,`from_day`);--> statement-breakpoint
CREATE TABLE `journal_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`frequency` text DEFAULT 'week' NOT NULL,
	`auto_enabled` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watched_games` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`date` text NOT NULL,
	`day` text NOT NULL,
	`away` text NOT NULL,
	`home` text NOT NULL,
	`away_score` integer,
	`home_score` integer,
	`mood` text,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `watched_user_day` ON `watched_games` (`user_id`,`day`);