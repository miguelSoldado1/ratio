import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth/auth-schema";

// biome-ignore lint/performance/noBarrelFile: Keep a single Drizzle schema entrypoint for config and adapters.
export * from "../auth/auth-schema";

export const albums = pgTable("album", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  artistNames: text("artist_names").array().notNull(),
  coverUrl: text("cover_url"),
  releaseDate: date("release_date").notNull(),
  totalTracks: integer("total_tracks").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const reviews = pgTable(
  "review",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id),
    shareCode: text("share_code").notNull(),
    rating: smallint("rating").notNull(),
    body: text("body"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("reviews_album_id_idx").on(table.albumId),
    index("reviews_album_created_id_idx").on(table.albumId, table.createdAt, table.id),
    index("reviews_user_id_idx").on(table.userId),
    uniqueIndex("reviews_user_album_unique_idx").on(table.userId, table.albumId),
    uniqueIndex("reviews_share_code_unique_idx").on(table.shareCode),
    check("reviews_ratings_range_check", sql`${table.rating} >= 1 AND ${table.rating} <= 10`),
  ]
);

export const reviewLikes = pgTable(
  "review_like",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reviewId, table.userId], name: "review_likes_review_user_pk" }),
    index("review_likes_review_created_user_idx").on(table.reviewId, table.createdAt, table.userId),
    index("review_likes_review_id_idx").on(table.reviewId),
    index("review_likes_user_id_idx").on(table.userId),
  ]
);

export const profilePinnedReviews = pgTable(
  "profile_pinned_review",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.reviewId], name: "profile_pinned_review_user_review_pk" })]
);

export const userFollows = pgTable(
  "user_follow",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId], name: "user_follows_follower_following_pk" }),
    index("user_follows_follower_created_following_idx").on(table.followerId, table.createdAt, table.followingId),
    index("user_follows_following_created_follower_idx").on(table.followingId, table.createdAt, table.followerId),
    check("user_follows_no_self_follow_check", sql`${table.followerId} <> ${table.followingId}`),
  ]
);

export const notificationType = pgEnum("notification_type", ["review_liked", "user_followed"]);

export const notifications = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    seenAt: timestamp("seen_at"),
  },
  (table) => [
    index("notifications_recipient_created_id_idx").on(table.recipientUserId, table.createdAt, table.id),
    index("notifications_unseen_recipient_created_id_idx")
      .on(table.recipientUserId, table.createdAt, table.id)
      .where(sql`${table.seenAt} is null`),
    uniqueIndex("notifications_review_liked_unique_idx")
      .on(table.recipientUserId, table.actorUserId, table.type, table.reviewId)
      .where(sql`${table.type} = 'review_liked'`),
    uniqueIndex("notifications_user_followed_unique_idx")
      .on(table.recipientUserId, table.actorUserId, table.type)
      .where(sql`${table.type} = 'user_followed'`),
    check(
      "notifications_review_id_matches_type_check",
      sql`(${table.type} = 'review_liked' and ${table.reviewId} is not null) or (${table.type} = 'user_followed' and ${table.reviewId} is null)`
    ),
    check("notifications_no_self_notify_check", sql`${table.recipientUserId} <> ${table.actorUserId}`),
  ]
);

export const albumRelations = relations(albums, ({ many }) => ({
  reviews: many(reviews),
}));

export const reviewRelations = relations(reviews, ({ many, one }) => ({
  album: one(albums, {
    fields: [reviews.albumId],
    references: [albums.id],
  }),
  likes: many(reviewLikes),
  profilePins: many(profilePinnedReviews),
  user: one(user, {
    fields: [reviews.userId],
    references: [user.id],
  }),
}));

export const reviewLikeRelations = relations(reviewLikes, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewLikes.reviewId],
    references: [reviews.id],
  }),
  user: one(user, {
    fields: [reviewLikes.userId],
    references: [user.id],
  }),
}));

export const profilePinnedReviewRelations = relations(profilePinnedReviews, ({ one }) => ({
  review: one(reviews, {
    fields: [profilePinnedReviews.reviewId],
    references: [reviews.id],
  }),
  user: one(user, {
    fields: [profilePinnedReviews.userId],
    references: [user.id],
  }),
}));

export const userFollowRelations = relations(userFollows, ({ one }) => ({
  follower: one(user, {
    fields: [userFollows.followerId],
    references: [user.id],
    relationName: "user_follow_follower",
  }),
  following: one(user, {
    fields: [userFollows.followingId],
    references: [user.id],
    relationName: "user_follow_following",
  }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  actor: one(user, {
    fields: [notifications.actorUserId],
    references: [user.id],
    relationName: "notification_actor",
  }),
  recipient: one(user, {
    fields: [notifications.recipientUserId],
    references: [user.id],
    relationName: "notification_recipient",
  }),
  review: one(reviews, {
    fields: [notifications.reviewId],
    references: [reviews.id],
  }),
}));
