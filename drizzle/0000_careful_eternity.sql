CREATE TYPE "public"."notification_type" AS ENUM('review_liked', 'user_followed');--> statement-breakpoint
CREATE TABLE "album" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist_names" text[] NOT NULL,
	"cover_url" text,
	"release_date" date NOT NULL,
	"total_tracks" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"review_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"seen_at" timestamp,
	CONSTRAINT "notifications_review_id_matches_type_check" CHECK (("notification"."type" = 'review_liked' and "notification"."review_id" is not null) or ("notification"."type" = 'user_followed' and "notification"."review_id" is null)),
	CONSTRAINT "notifications_no_self_notify_check" CHECK ("notification"."recipient_user_id" <> "notification"."actor_user_id")
);
--> statement-breakpoint
CREATE TABLE "profile_pinned_review" (
	"user_id" text NOT NULL,
	"review_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_pinned_review_user_review_pk" PRIMARY KEY("user_id","review_id")
);
--> statement-breakpoint
CREATE TABLE "review_like" (
	"review_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_likes_review_user_pk" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"album_id" text NOT NULL,
	"share_code" text NOT NULL,
	"rating" smallint NOT NULL,
	"body" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_ratings_range_check" CHECK ("review"."rating" >= 1 AND "review"."rating" <= 10)
);
--> statement-breakpoint
CREATE TABLE "user_follow" (
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_follows_follower_following_pk" PRIMARY KEY("follower_id","following_id"),
	CONSTRAINT "user_follows_no_self_follow_check" CHECK ("user_follow"."follower_id" <> "user_follow"."following_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"avatar_object_key" text,
	"username" text,
	"display_username" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_pinned_review" ADD CONSTRAINT "profile_pinned_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_pinned_review" ADD CONSTRAINT "profile_pinned_review_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_like" ADD CONSTRAINT "review_like_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_like" ADD CONSTRAINT "review_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_album_id_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."album"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_following_id_user_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_id_idx" ON "notification" USING btree ("recipient_user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "notifications_unseen_recipient_created_id_idx" ON "notification" USING btree ("recipient_user_id","created_at","id") WHERE "notification"."seen_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_review_liked_unique_idx" ON "notification" USING btree ("recipient_user_id","actor_user_id","type","review_id") WHERE "notification"."type" = 'review_liked';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_followed_unique_idx" ON "notification" USING btree ("recipient_user_id","actor_user_id","type") WHERE "notification"."type" = 'user_followed';--> statement-breakpoint
CREATE INDEX "review_likes_review_created_user_idx" ON "review_like" USING btree ("review_id","created_at","user_id");--> statement-breakpoint
CREATE INDEX "review_likes_review_id_idx" ON "review_like" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_likes_user_id_idx" ON "review_like" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_album_id_idx" ON "review" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "reviews_album_created_id_idx" ON "review" USING btree ("album_id","created_at","id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_idx" ON "review" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_album_unique_idx" ON "review" USING btree ("user_id","album_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_share_code_unique_idx" ON "review" USING btree ("share_code");--> statement-breakpoint
CREATE INDEX "user_follows_follower_created_following_idx" ON "user_follow" USING btree ("follower_id","created_at","following_id");--> statement-breakpoint
CREATE INDEX "user_follows_following_created_follower_idx" ON "user_follow" USING btree ("following_id","created_at","follower_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");