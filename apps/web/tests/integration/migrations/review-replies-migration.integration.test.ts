import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { closeTestDatabase, testDb } from "@test/db";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

afterAll(async () => {
  await closeTestDatabase();
});

describe("review reply migration", () => {
  it("upgrades the pre-reply schema with existing notifications and accepts the new entities", async () => {
    const schemaName = `reply_migration_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const migrations = await Promise.all([
      readMigration("0000_careful_eternity.sql", schemaName),
      readMigration("0001_tiresome_omega_flight.sql", schemaName),
      readMigration("0002_exotic_red_hulk.sql", schemaName),
    ]);

    await testDb.transaction(async (tx) => {
      await tx.execute(sql.raw(`create schema "${schemaName}"`));

      try {
        await tx.execute(sql.raw(`set local search_path to "${schemaName}"`));
        await executeMigration(tx, migrations[0]);
        await executeMigration(tx, migrations[1]);
        await seedPreReplyData(tx);
        await executeMigration(tx, migrations[2]);

        const existingNotifications = await tx.execute<{ replyId: string | null; type: string }>(sql`
          select reply_id as "replyId", type::text
          from notification
          order by type::text
        `);

        expect(existingNotifications).toEqual([
          { replyId: null, type: "review_liked" },
          { replyId: null, type: "user_followed" },
        ]);

        await tx.execute(sql`
          insert into review_reply (id, review_id, user_id, body)
          values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'actor', 'New reply')
        `);
        await tx.execute(sql`
          insert into notification (recipient_user_id, actor_user_id, type, review_id, reply_id)
          values (
            'recipient',
            'actor',
            'review_replied',
            '20000000-0000-4000-8000-000000000001',
            '30000000-0000-4000-8000-000000000001'
          )
        `);

        const notificationTypes = await tx.execute<{ type: string }>(sql`
          select type::text
          from notification
          order by type::text
        `);

        expect(notificationTypes.map((row) => row.type)).toEqual(["review_liked", "review_replied", "user_followed"]);
      } finally {
        await tx.execute(sql.raw("set local search_path to public"));
        await tx.execute(sql.raw(`drop schema if exists "${schemaName}" cascade`));
      }
    });
  });
});

type MigrationTransaction = Parameters<Parameters<typeof testDb.transaction>[0]>[0];

/** Reads one generated migration and redirects its explicit public-schema
 * references into the isolated upgrade-test schema. */
async function readMigration(filename: string, schemaName: string) {
  const migrationPath = resolve(process.cwd(), "../../drizzle", filename);
  const migration = await readFile(migrationPath, "utf8");

  return migration.replaceAll('"public"', `"${schemaName}"`);
}

/** Executes the same statement boundaries used by Drizzle's generated
 * migration files without touching the shared public test schema. */
async function executeMigration(tx: MigrationTransaction, migration: string) {
  const statements = migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await tx.execute(sql.raw(statement));
  }
}

/** Seeds both legacy notification shapes before the enum-replacement upgrade. */
async function seedPreReplyData(tx: MigrationTransaction) {
  await tx.execute(sql`
    insert into "user" (id, name, email, email_verified, username)
    values
      ('recipient', 'Recipient', 'recipient@example.com', true, 'recipient'),
      ('actor', 'Actor', 'actor@example.com', true, 'actor')
  `);
  await tx.execute(sql`
    insert into album (id, title, artist_names, release_date, total_tracks)
    values ('album', 'Album', array['Artist'], '2026-01-01', 10)
  `);
  await tx.execute(sql`
    insert into review (id, user_id, album_id, share_code, rating)
    values ('20000000-0000-4000-8000-000000000001', 'recipient', 'album', 'Code123', 8)
  `);
  await tx.execute(sql`
    insert into notification (recipient_user_id, actor_user_id, type, review_id)
    values ('recipient', 'actor', 'review_liked', '20000000-0000-4000-8000-000000000001')
  `);
  await tx.execute(sql`
    insert into notification (recipient_user_id, actor_user_id, type)
    values ('actor', 'recipient', 'user_followed')
  `);
}
