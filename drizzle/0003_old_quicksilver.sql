CREATE TABLE `signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`signalType` enum('job','news','funding','ownership','procurement','engagement') NOT NULL,
	`source` varchar(100) NOT NULL,
	`title` varchar(500),
	`url` varchar(1000),
	`payload` json,
	`pointsAwarded` int DEFAULT 0,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`decaysAt` timestamp,
	CONSTRAINT `signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `scoreTotal` int;--> statement-breakpoint
ALTER TABLE `companies` ADD `scoreBreakdown` json;--> statement-breakpoint
ALTER TABLE `companies` ADD `icpSegment` varchar(64);--> statement-breakpoint
ALTER TABLE `companies` ADD `scoredAt` timestamp;