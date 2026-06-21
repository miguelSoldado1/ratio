import { relations, sql } from "drizzle-orm";
import { check, index, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/auth-schema";

// biome-ignore lint/performance/noBarrelFile: Keep a single Drizzle schema entrypoint for config and adapters.
export * from "../auth/auth-schema";

export const reviews = pgTable(
  "review",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    albumId: text("album_id").notNull(),
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
    index("reviews_user_id_idx").on(table.userId),
    uniqueIndex("reviews_user_album_unique_idx").on(table.userId, table.albumId),
    check("reviews_ratings_range_check", sql`${table.rating} >= 1 AND ${table.rating} <= 10`),
  ]
);

export const reviewRelations = relations(reviews, ({ one }) => ({
  user: one(user, {
    fields: [reviews.userId],
    references: [user.id],
  }),
}));
