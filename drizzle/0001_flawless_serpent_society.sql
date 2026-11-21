CREATE TABLE `monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`geometry` text NOT NULL,
	`area_km2` real NOT NULL,
	`parameters` text NOT NULL,
	`result` text,
	`updated_at` text,
	`last_error` text,
	`enabled` real DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
