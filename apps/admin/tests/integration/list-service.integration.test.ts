import { albums, listItems, lists, user } from "@ratio/database/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteListService, getListStatsService, getTableListsService } from "@/server/services/list-service";
import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "./setup/db";

beforeAll(async () => {
  await migrateTestDatabase();
});

beforeEach(async () => {
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("getTableListsService", () => {
  it("searches and sorts by the identity displayed in the table", async () => {
    const alphaUser = await createUser({
      displayUsername: "AlphaDisplay",
      id: "alpha_user",
      name: "Zulu Legal Name",
      username: "alpha_handle",
    });
    const zuluUser = await createUser({
      displayUsername: "ZuluDisplay",
      id: "zulu_user",
      name: "Alpha Legal Name",
      username: "zulu_handle",
    });
    const alphaList = await createList(alphaUser.id, { title: "Alpha list" });
    const zuluList = await createList(zuluUser.id, { title: "Zulu list" });

    const sortedPage = await getTableListsService(
      { filters: {}, limit: 10, page: 1, sorting: [{ desc: false, id: "user" }] },
      { db: testDb }
    );

    expect(sortedPage.data.map((list) => list.id)).toEqual([alphaList.id, zuluList.id]);

    const displayNamePage = await getTableListsService(
      { filters: { user: "AlphaDisplay" }, limit: 10, page: 1, sorting: [] },
      { db: testDb }
    );
    const usernamePage = await getTableListsService(
      { filters: { user: "zulu_handle" }, limit: 10, page: 1, sorting: [] },
      { db: testDb }
    );

    expect(displayNamePage.data.map((list) => list.id)).toEqual([alphaList.id]);
    expect(usernamePage.data.map((list) => list.id)).toEqual([zuluList.id]);
  });

  it("searches lists by title and description", async () => {
    const owner = await createUser({ id: "list_owner", name: "List Owner", username: "list_owner" });
    const list = await createList(owner.id, { description: "Late night drives", title: "Midnight Signals" });
    await createList(owner.id, { title: "Something else" });

    const titlePage = await getTableListsService(
      { filters: { title: "Midnight" }, limit: 10, page: 1, sorting: [] },
      { db: testDb }
    );
    const descriptionPage = await getTableListsService(
      { filters: { title: "drives" }, limit: 10, page: 1, sorting: [] },
      { db: testDb }
    );

    expect(titlePage.data.map((item) => item.id)).toEqual([list.id]);
    expect(descriptionPage.data.map((item) => item.id)).toEqual([list.id]);
  });

  it("returns the album count and the first album cover by position", async () => {
    const owner = await createUser({ id: "cover_owner", name: "Cover Owner", username: "cover_owner" });
    const list = await createList(owner.id, { title: "Covers" });
    await createAlbum("second_album", "https://example.com/second.jpg");
    await createAlbum("first_album", "https://example.com/first.jpg");
    await testDb.insert(listItems).values([
      { albumId: "second_album", listId: list.id, position: 1 },
      { albumId: "first_album", listId: list.id, position: 0 },
    ]);

    const page = await getTableListsService({ filters: {}, limit: 10, page: 1, sorting: [] }, { db: testDb });

    expect(page.data[0]).toMatchObject({ coverUrl: "https://example.com/first.jpg", itemCount: 2 });
  });
});

describe("getListStatsService", () => {
  it("counts lists and their album entries", async () => {
    const owner = await createUser({ id: "stats_owner", name: "Stats Owner", username: "stats_owner" });
    const list = await createList(owner.id, { title: "Stats" });
    await createList(owner.id, { title: "Empty" });
    await createAlbum("stats_album");
    await testDb.insert(listItems).values({ albumId: "stats_album", listId: list.id, position: 0 });

    await expect(getListStatsService({ db: testDb })).resolves.toMatchObject({
      newLast7Days: 2,
      totalListItems: 1,
      totalLists: 2,
    });
  });
});

describe("deleteListService", () => {
  it("deletes the list and cascades its items", async () => {
    const owner = await createUser({ id: "owner", name: "Owner", username: "owner" });
    const list = await createList(owner.id, { title: "Doomed" });
    await createAlbum("delete_album");
    await testDb.insert(listItems).values({ albumId: "delete_album", listId: list.id, position: 0 });

    await expect(deleteListService(list.id, { db: testDb })).resolves.toEqual({ id: list.id });

    await expect(testDb.select().from(lists).where(eq(lists.id, list.id))).resolves.toEqual([]);
    await expect(testDb.select().from(listItems).where(eq(listItems.listId, list.id))).resolves.toEqual([]);
    await expect(testDb.select().from(albums).where(eq(albums.id, "delete_album"))).resolves.toHaveLength(1);
  });
});

async function createUser(
  overrides: Pick<typeof user.$inferInsert, "id" | "name" | "username"> & Partial<typeof user.$inferInsert>
) {
  const [createdUser] = await testDb
    .insert(user)
    .values({
      displayUsername: overrides.name,
      email: `${overrides.id}@example.com`,
      emailVerified: true,
      ...overrides,
    })
    .returning();

  return createdUser;
}

async function createList(
  userId: string,
  overrides: Pick<typeof lists.$inferInsert, "title"> & Partial<typeof lists.$inferInsert>
) {
  const [list] = await testDb
    .insert(lists)
    .values({ userId, ...overrides })
    .returning();

  return list;
}

async function createAlbum(albumId: string, coverUrl: string | null = null) {
  await testDb.insert(albums).values({
    artistNames: ["Test Artist"],
    coverUrl,
    id: albumId,
    releaseDate: "2026-01-01",
    title: `Album ${albumId}`,
    totalTracks: 10,
  });
}
