CREATE TABLE `weekly_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignedToUserId` int NOT NULL,
	`assignedToName` varchar(255),
	`weekLabel` varchar(50) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weekly_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `assignedToUserId` int;--> statement-breakpoint
ALTER TABLE `companies` ADD `assignedToName` varchar(255);--> statement-breakpoint
ALTER TABLE `companies` ADD `weeklyListId` int;