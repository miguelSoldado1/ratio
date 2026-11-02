DELETE FROM "notification" n
WHERE n."type" = 'review_liked'
  AND NOT EXISTS (
    SELECT 1 FROM "review_like" l
    WHERE l."review_id" = n."review_id" AND l."user_id" = n."actor_user_id"
  );
--> statement-breakpoint
DELETE FROM "notification" n
WHERE n."type" = 'reply_liked'
  AND NOT EXISTS (
    SELECT 1 FROM "review_reply_like" l
    WHERE l."reply_id" = n."reply_id" AND l."user_id" = n."actor_user_id"
  );
--> statement-breakpoint
DELETE FROM "notification" n
WHERE n."type" = 'user_followed'
  AND NOT EXISTS (
    SELECT 1 FROM "user_follow" f
    WHERE f."follower_id" = n."actor_user_id" AND f."following_id" = n."recipient_user_id"
  );
