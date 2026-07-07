ALTER TABLE "album" ADD COLUMN "release_date" date;--> statement-breakpoint
UPDATE "album" SET "release_date" = make_date("release_year", 1, 1);--> statement-breakpoint
ALTER TABLE "album" ALTER COLUMN "release_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "album" DROP COLUMN "release_year";