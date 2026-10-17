CREATE TABLE `coop_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host_name` text NOT NULL,
	`host_token` text NOT NULL,
	`host_seen` integer NOT NULL,
	`host_json` text DEFAULT '{}' NOT NULL,
	`guest_name` text DEFAULT '' NOT NULL,
	`guest_token` text,
	`guest_seen` integer DEFAULT 0 NOT NULL,
	`guest_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL
);
