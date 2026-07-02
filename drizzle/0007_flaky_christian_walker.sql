CREATE TYPE "public"."notification_type" AS ENUM('review_liked', 'user_followed');--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"type" "public"."notification_type" NOT NULL,
	"review_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"seen_at" timestamp,
	CONSTRAINT "notifications_review_id_matches_type_check" CHECK (("notification"."type" = 'review_liked' and "notification"."review_id" is not null) or ("notification"."type" = 'user_followed' and "notification"."review_id" is null)),
	CONSTRAINT "notifications_no_self_notify_check" CHECK ("notification"."recipient_user_id" <> "notification"."actor_user_id")
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_id_idx" ON "notification" USING btree ("recipient_user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "notifications_unseen_recipient_idx" ON "notification" USING btree ("recipient_user_id") WHERE "notification"."seen_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_review_liked_unique_idx" ON "notification" USING btree ("recipient_user_id","actor_user_id","type","review_id") WHERE "notification"."type" = 'review_liked';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_followed_unique_idx" ON "notification" USING btree ("recipient_user_id","actor_user_id","type") WHERE "notification"."type" = 'user_followed';
