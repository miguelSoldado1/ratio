DROP INDEX "review_likes_user_id_idx";--> statement-breakpoint
CREATE INDEX "review_likes_user_created_review_idx" ON "review_like" USING btree ("user_id","created_at","review_id");