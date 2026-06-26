DROP INDEX "user_follows_following_id_idx";--> statement-breakpoint
CREATE INDEX "user_follows_follower_created_following_idx" ON "user_follow" USING btree ("follower_id","created_at","following_id");--> statement-breakpoint
CREATE INDEX "user_follows_following_created_follower_idx" ON "user_follow" USING btree ("following_id","created_at","follower_id");