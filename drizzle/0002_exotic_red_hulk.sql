ALTER TABLE "notification" DROP CONSTRAINT "notifications_review_id_matches_type_check";--> statement-breakpoint
DROP INDEX "notifications_review_liked_unique_idx";--> statement-breakpoint
DROP INDEX "notifications_user_followed_unique_idx";--> statement-breakpoint
ALTER TYPE "public"."notification_type" RENAME TO "notification_type_old";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('review_liked', 'review_replied', 'reply_liked', 'user_followed');--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type" USING "type"::text::"public"."notification_type";--> statement-breakpoint
DROP TYPE "public"."notification_type_old";--> statement-breakpoint
CREATE TABLE "review_reply" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_replies_body_length_check" CHECK (char_length("review_reply"."body") between 1 and 500 and "review_reply"."body" ~ '[^[:space:]]')
);
--> statement-breakpoint
CREATE TABLE "review_reply_like" (
	"reply_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_reply_likes_reply_user_pk" PRIMARY KEY("reply_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "reply_id" uuid;--> statement-breakpoint
ALTER TABLE "review_reply" ADD CONSTRAINT "review_reply_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reply" ADD CONSTRAINT "review_reply_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reply_like" ADD CONSTRAINT "review_reply_like_reply_id_review_reply_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."review_reply"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reply_like" ADD CONSTRAINT "review_reply_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_replies_review_created_id_idx" ON "review_reply" USING btree ("review_id","created_at","id");--> statement-breakpoint
CREATE INDEX "review_replies_user_created_id_idx" ON "review_reply" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "review_reply_likes_user_created_reply_idx" ON "review_reply_like" USING btree ("user_id","created_at","reply_id");--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_reply_id_review_reply_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."review_reply"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_review_liked_unique_idx" ON "notification" USING btree ("recipient_user_id","actor_user_id","type","review_id") WHERE "notification"."type" = 'review_liked';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_review_replied_unique_idx" ON "notification" USING btree ("recipient_user_id","type","review_id") WHERE "notification"."type" = 'review_replied';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_reply_liked_unique_idx" ON "notification" USING btree ("recipient_user_id","actor_user_id","type","reply_id") WHERE "notification"."type" = 'reply_liked';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_followed_unique_idx" ON "notification" USING btree ("recipient_user_id","actor_user_id","type") WHERE "notification"."type" = 'user_followed';--> statement-breakpoint
CREATE INDEX "notifications_review_id_idx" ON "notification" USING btree ("review_id") WHERE "notification"."review_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_reply_id_idx" ON "notification" USING btree ("reply_id") WHERE "notification"."reply_id" is not null;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notifications_target_matches_type_check" CHECK (("notification"."type" = 'review_liked' and "notification"."review_id" is not null and "notification"."reply_id" is null)
        or ("notification"."type" = 'review_replied' and "notification"."review_id" is not null and "notification"."reply_id" is not null)
        or ("notification"."type" = 'reply_liked' and "notification"."review_id" is null and "notification"."reply_id" is not null)
        or ("notification"."type" = 'user_followed' and "notification"."review_id" is null and "notification"."reply_id" is null));
