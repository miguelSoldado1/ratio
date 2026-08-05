import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import {
  createAuthenticatedContext,
  createTestAlbum,
  createTestList,
  createTestListItem,
  createTestUser,
} from "@test/fixtures";
import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { albums, listItems, lists, user } from "@/lib/db/schema";
import {
  addListItemService,
  createListService,
  deleteListService,
  getListService,
  getMyListsForAlbumService,
  getUserListsService,
  removeListItemService,
  reorderListItemsService,
  updateListService,
} from "@/server/services/list-service";

const mockState = vi.hoisted(() => ({
  currentUser: undefined as { id: string; isAdmin: boolean } | undefined,
  db: undefined as unknown,
}));
const mockGetAlbumPersistenceMetadata = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => mockState.db),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  createAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn(async () =>
        mockState.currentUser
          ? {
              user: {
                id: mockState.currentUser.id,
                role: mockState.currentUser.isAdmin ? "admin" : null,
              },
            }
          : null
      ),
    },
  })),
}));

vi.mock("@/server/services/spotify-service", () => ({
  getAlbumPersistenceMetadata: mockGetAlbumPersistenceMetadata,
}));

beforeAll(async () => {
  mockState.db = testDb;
  await migrateTestDatabase();
});

beforeEach(async () => {
  mockState.currentUser = undefined;
  mockGetAlbumPersistenceMetadata.mockReset();
  mockGetAlbumPersistenceMetadata.mockImplementation(() => {
    throw new Error("Spotify should not be called for an existing test album");
  });
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("list schema", () => {
  it("enforces title and description content and length limits", async () => {
    const owner = await createTestUser(testDb);

    await expect(
      createTestList(testDb, {
        description: "d".repeat(200),
        title: "t".repeat(100),
        userId: owner.id,
      })
    ).resolves.toMatchObject({
      description: "d".repeat(200),
      title: "t".repeat(100),
    });
    await expect(createTestList(testDb, { title: " \n\t", userId: owner.id })).rejects.toThrow();
    await expect(createTestList(testDb, { title: "t".repeat(101), userId: owner.id })).rejects.toThrow();
    await expect(createTestList(testDb, { description: " \n\t", userId: owner.id })).rejects.toThrow();
    await expect(createTestList(testDb, { description: "d".repeat(201), userId: owner.id })).rejects.toThrow();
  });

  it("enforces nonnegative, unique positions and one copy of each album per list", async () => {
    const list = await createTestList(testDb);
    const firstAlbum = await createTestAlbum(testDb);
    const secondAlbum = await createTestAlbum(testDb);

    await expect(
      createTestListItem(testDb, { albumId: firstAlbum.id, listId: list.id, position: 0 })
    ).resolves.toMatchObject({ position: 0 });
    await expect(
      createTestListItem(testDb, { albumId: secondAlbum.id, listId: list.id, position: -1 })
    ).rejects.toThrow();
    await expect(
      createTestListItem(testDb, { albumId: secondAlbum.id, listId: list.id, position: 0 })
    ).rejects.toThrow();
    await expect(
      createTestListItem(testDb, { albumId: firstAlbum.id, listId: list.id, position: 1 })
    ).rejects.toThrow();
  });
});

describe("list details mutations", () => {
  it("creates and updates a list owned by the authenticated user", async () => {
    const owner = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, owner);

    const createdList = await createListService(
      { description: "Initial description", title: "Initial title" },
      context
    );
    const updatedList = await updateListService(
      {
        description: "Updated description",
        listId: createdList.id,
        title: "Updated title",
      },
      context
    );
    const [storedList] = await testDb.select().from(lists).where(eq(lists.id, createdList.id));

    expect(updatedList).toMatchObject({
      description: "Updated description",
      title: "Updated title",
    });
    expect(storedList).toMatchObject({ id: createdList.id, userId: owner.id });
  });

  it("rejects update and deletion by a non-owner", async () => {
    const owner = await createTestUser(testDb);
    const otherUser = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const otherContext = createAuthenticatedContext(testDb, otherUser);

    await expect(
      updateListService(
        {
          description: null,
          listId: list.id,
          title: "Unauthorized",
        },
        otherContext
      )
    ).rejects.toThrow("List not found");
    await expect(deleteListService({ listId: list.id }, otherContext)).rejects.toThrow("List not found");

    await expect(testDb.select().from(lists).where(eq(lists.id, list.id))).resolves.toHaveLength(1);
  });

  it("allows an admin to delete another user's list and cascades its items", async () => {
    const owner = await createTestUser(testDb);
    const admin = await createTestUser(testDb, { role: "admin" });
    const list = await createTestList(testDb, { userId: owner.id });
    await createTestListItem(testDb, { listId: list.id, position: 0 });

    await expect(
      deleteListService({ listId: list.id }, createAuthenticatedContext(testDb, admin, { isAdmin: true }))
    ).resolves.toEqual({ id: list.id });

    await expect(testDb.select().from(lists).where(eq(lists.id, list.id))).resolves.toEqual([]);
    await expect(testDb.select().from(listItems).where(eq(listItems.listId, list.id))).resolves.toEqual([]);
  });

  it("deleting a user cascades their lists and list items", async () => {
    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    await createTestListItem(testDb, { listId: list.id, position: 0 });

    await testDb.delete(user).where(eq(user.id, owner.id));

    await expect(testDb.select().from(lists).where(eq(lists.id, list.id))).resolves.toEqual([]);
    await expect(testDb.select().from(listItems).where(eq(listItems.listId, list.id))).resolves.toEqual([]);
  });
});

describe("getListService", () => {
  it("returns manual position order without exposing position as ranking", async () => {
    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const olderAlbum = await createTestAlbum(testDb, { id: "created_older", title: "Older" });
    const newerAlbum = await createTestAlbum(testDb, { id: "created_newer", title: "Newer" });
    const newerTieAlbum = await createTestAlbum(testDb, { id: "created_newer_tie", title: "Newer tie" });
    await createTestListItem(testDb, {
      albumId: newerAlbum.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      listId: list.id,
      position: 0,
    });
    await createTestListItem(testDb, {
      albumId: newerTieAlbum.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      listId: list.id,
      position: 1,
    });
    await createTestListItem(testDb, {
      albumId: olderAlbum.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      listId: list.id,
      position: 2,
    });
    mockState.currentUser = { id: owner.id, isAdmin: false };

    const details = await getListService({ listId: list.id });

    expect(details).toMatchObject({
      author: { id: owner.id, username: owner.username },
      canEdit: true,
      id: list.id,
    });
    expect(details?.albums.map((album) => album.id)).toEqual([olderAlbum.id, newerTieAlbum.id, newerAlbum.id]);
    expect(details?.coverAlbums.map((album) => album.id)).toEqual([olderAlbum.id, newerTieAlbum.id, newerAlbum.id]);
    expect(details?.albums[0]?.spotifyUrl).toBe(`https://open.spotify.com/album/${olderAlbum.id}`);
    expect(details?.albums.map((album) => album.addedAt)).toEqual([
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-02T00:00:00.000Z"),
      new Date("2026-01-02T00:00:00.000Z"),
    ]);
    expect(details?.albums[0]).not.toHaveProperty("position");
  });

  it("hides lists by banned authors and authors without usernames", async () => {
    const bannedAuthor = await createTestUser(testDb, { banned: true });
    const usernameLessAuthor = await createTestUser(testDb, { username: null });
    const bannedList = await createTestList(testDb, { userId: bannedAuthor.id });
    const usernameLessList = await createTestList(testDb, { userId: usernameLessAuthor.id });

    await expect(getListService({ listId: bannedList.id })).resolves.toBeNull();
    await expect(getListService({ listId: usernameLessList.id })).resolves.toBeNull();
  });

  it("allows an admin to read a banned author's list", async () => {
    const admin = await createTestUser(testDb, { role: "admin" });
    const bannedAuthor = await createTestUser(testDb, { banned: true });
    const list = await createTestList(testDb, { userId: bannedAuthor.id });
    mockState.currentUser = { id: admin.id, isAdmin: true };

    await expect(getListService({ listId: list.id })).resolves.toMatchObject({
      author: { id: bannedAuthor.id },
      canEdit: false,
      id: list.id,
    });
  });
});

describe("getUserListsService", () => {
  it("returns total item counts and only the first four positioned cover albums", async () => {
    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const testAlbums = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createTestAlbum(testDb, {
          coverUrl: index === 2 ? null : `https://example.com/${index}.jpg`,
          id: `summary_album_${index}`,
        })
      )
    );

    for (const [position, album] of testAlbums.entries()) {
      await createTestListItem(testDb, {
        albumId: album.id,
        createdAt: new Date(`2026-01-0${position + 1}T00:00:00.000Z`),
        listId: list.id,
        position,
      });
    }

    const page = await getUserListsService({ userId: owner.id });

    expect(page.nextCursor).toBeNull();
    expect(page.lists).toHaveLength(1);
    expect(page.lists[0]).toMatchObject({
      author: { id: owner.id },
      coverAlbums: testAlbums
        .slice(1)
        .reverse()
        .map((album) => ({
          coverUrl: album.coverUrl,
          id: album.id,
        })),
      id: list.id,
      itemCount: 5,
    });
  });

  it("paginates lists by created time and id without repeating the boundary", async () => {
    const owner = await createTestUser(testDb);
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const listIds = Array.from(
      { length: 21 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    );

    await testDb.insert(lists).values(
      listIds.map((id) => ({
        createdAt,
        id,
        title: id,
        userId: owner.id,
      }))
    );

    const firstPage = await getUserListsService({ userId: owner.id });
    const secondPage = await getUserListsService({
      cursor: firstPage.nextCursor ?? undefined,
      userId: owner.id,
    });
    const returnedIds = [...firstPage.lists, ...secondPage.lists].map((list) => list.id);

    expect(firstPage.lists).toHaveLength(20);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(secondPage.lists).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(new Set(returnedIds).size).toBe(21);
    expect(returnedIds).toEqual([...listIds].reverse());
  });
});

describe("getMyListsForAlbumService", () => {
  it("returns only the authenticated user's lists with counts and album membership", async () => {
    const owner = await createTestUser(testDb);
    const otherUser = await createTestUser(testDb);
    const selectedAlbum = await createTestAlbum(testDb, { id: "picker_selected_album" });
    const otherAlbum = await createTestAlbum(testDb, { id: "picker_other_album" });
    const containingList = await createTestList(testDb, {
      title: "Contains the album",
      userId: owner.id,
    });
    const emptyList = await createTestList(testDb, {
      title: "Empty list",
      userId: owner.id,
    });
    await createTestList(testDb, {
      title: "Another user's list",
      userId: otherUser.id,
    });
    await createTestListItem(testDb, {
      albumId: selectedAlbum.id,
      listId: containingList.id,
      position: 0,
    });
    await createTestListItem(testDb, {
      albumId: otherAlbum.id,
      listId: containingList.id,
      position: 1,
    });

    const page = await getMyListsForAlbumService(
      { albumId: selectedAlbum.id },
      createAuthenticatedContext(testDb, owner)
    );

    expect(page.nextCursor).toBeNull();
    expect(page.lists).toHaveLength(2);
    expect(page.lists).toEqual(
      expect.arrayContaining([
        {
          containsAlbum: true,
          id: containingList.id,
          itemCount: 2,
          title: "Contains the album",
        },
        {
          containsAlbum: false,
          id: emptyList.id,
          itemCount: 0,
          title: "Empty list",
        },
      ])
    );
  });

  it("paginates owned lists without repeating the boundary", async () => {
    const owner = await createTestUser(testDb);
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const listIds = Array.from(
      { length: 21 },
      (_, index) => `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`
    );

    await testDb.insert(lists).values(
      listIds.map((id) => ({
        createdAt,
        id,
        title: id,
        userId: owner.id,
      }))
    );

    const context = createAuthenticatedContext(testDb, owner);
    const firstPage = await getMyListsForAlbumService({ albumId: "picker_album" }, context);
    const secondPage = await getMyListsForAlbumService(
      {
        albumId: "picker_album",
        cursor: firstPage.nextCursor ?? undefined,
      },
      context
    );
    const returnedIds = [...firstPage.lists, ...secondPage.lists].map((list) => list.id);

    expect(firstPage.lists).toHaveLength(20);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(secondPage.lists).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(returnedIds).toEqual([...listIds].reverse());
  });
});

describe("list item mutations", () => {
  it("fully reverses densely occupied positions without unique-index collisions", async () => {
    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const testAlbums = await Promise.all(
      Array.from({ length: 4 }, (_, index) => createTestAlbum(testDb, { id: `dense_album_${index}` }))
    );
    await testDb.insert(listItems).values(
      testAlbums.map((album, position) => ({
        albumId: album.id,
        listId: list.id,
        position,
      }))
    );
    const desiredOrder = testAlbums.map((album) => album.id);

    const result = await reorderListItemsService(
      { albumIds: desiredOrder, listId: list.id },
      createAuthenticatedContext(testDb, owner)
    );
    const storedItems = await testDb
      .select({ albumId: listItems.albumId, position: listItems.position })
      .from(listItems)
      .where(eq(listItems.listId, list.id))
      .orderBy(desc(listItems.position));

    expect(result).toMatchObject({
      albumIds: desiredOrder,
      reordered: true,
    });
    expect(storedItems).toEqual(
      desiredOrder.map((albumId, index) => ({
        albumId,
        position: desiredOrder.length - index - 1,
      }))
    );
  });

  it("reorders an owned list through collision-safe dense positions", async () => {
    const owner = await createTestUser(testDb);
    const initialUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
    const list = await createTestList(testDb, { updatedAt: initialUpdatedAt, userId: owner.id });
    const testAlbums = await Promise.all(
      Array.from({ length: 3 }, (_, index) => createTestAlbum(testDb, { id: `reordered_album_${index}` }))
    );
    await testDb.insert(listItems).values([
      { albumId: testAlbums[0]?.id ?? "", listId: list.id, position: 2 },
      { albumId: testAlbums[1]?.id ?? "", listId: list.id, position: 7 },
      { albumId: testAlbums[2]?.id ?? "", listId: list.id, position: 12 },
    ]);
    const desiredOrder = [testAlbums[1]?.id ?? "", testAlbums[0]?.id ?? "", testAlbums[2]?.id ?? ""];

    const result = await reorderListItemsService(
      { albumIds: desiredOrder, listId: list.id },
      createAuthenticatedContext(testDb, owner)
    );
    const storedItems = await testDb
      .select({ albumId: listItems.albumId, position: listItems.position })
      .from(listItems)
      .where(eq(listItems.listId, list.id))
      .orderBy(desc(listItems.position));

    expect(result).toMatchObject({
      albumIds: desiredOrder,
      reordered: true,
    });
    expect(result.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    expect(storedItems).toEqual([
      { albumId: desiredOrder[0], position: 2 },
      { albumId: desiredOrder[1], position: 1 },
      { albumId: desiredOrder[2], position: 0 },
    ]);
  });

  it("does not rewrite or touch a list when its order is unchanged", async () => {
    const owner = await createTestUser(testDb);
    const initialUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
    const list = await createTestList(testDb, { updatedAt: initialUpdatedAt, userId: owner.id });
    const firstAlbum = await createTestAlbum(testDb);
    const secondAlbum = await createTestAlbum(testDb);
    await testDb.insert(listItems).values([
      { albumId: firstAlbum.id, listId: list.id, position: 0 },
      { albumId: secondAlbum.id, listId: list.id, position: 1 },
    ]);

    const result = await reorderListItemsService(
      { albumIds: [secondAlbum.id, firstAlbum.id], listId: list.id },
      createAuthenticatedContext(testDb, owner)
    );

    expect(result).toEqual({
      albumIds: [secondAlbum.id, firstAlbum.id],
      reordered: false,
      updatedAt: initialUpdatedAt,
    });
    await expect(
      testDb
        .select({ albumId: listItems.albumId, position: listItems.position })
        .from(listItems)
        .where(eq(listItems.listId, list.id))
        .orderBy(desc(listItems.position))
    ).resolves.toEqual([
      { albumId: secondAlbum.id, position: 1 },
      { albumId: firstAlbum.id, position: 0 },
    ]);
  });

  it("rejects stale or foreign reorder requests without changing positions", async () => {
    const owner = await createTestUser(testDb);
    const otherUser = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const firstAlbum = await createTestAlbum(testDb);
    const secondAlbum = await createTestAlbum(testDb);
    await testDb.insert(listItems).values([
      { albumId: firstAlbum.id, listId: list.id, position: 0 },
      { albumId: secondAlbum.id, listId: list.id, position: 1 },
    ]);

    await expect(
      reorderListItemsService({ albumIds: [firstAlbum.id], listId: list.id }, createAuthenticatedContext(testDb, owner))
    ).rejects.toThrow("The list changed while you were reordering it");
    await expect(
      reorderListItemsService(
        { albumIds: [firstAlbum.id, secondAlbum.id], listId: list.id },
        createAuthenticatedContext(testDb, otherUser)
      )
    ).rejects.toThrow("List not found");

    await expect(
      testDb
        .select({ albumId: listItems.albumId, position: listItems.position })
        .from(listItems)
        .where(eq(listItems.listId, list.id))
        .orderBy(asc(listItems.position))
    ).resolves.toEqual([
      { albumId: firstAlbum.id, position: 0 },
      { albumId: secondAlbum.id, position: 1 },
    ]);
  });

  it("assigns sequential positions and leaves a gap after removal", async () => {
    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const testAlbums = await Promise.all(
      Array.from({ length: 3 }, (_, index) => createTestAlbum(testDb, { id: `ordered_album_${index}` }))
    );
    const context = createAuthenticatedContext(testDb, owner);

    for (const album of testAlbums) {
      await addListItemService({ albumId: album.id, listId: list.id }, context);
    }
    await removeListItemService({ albumId: testAlbums[1]?.id ?? "", listId: list.id }, context);

    const storedItems = await testDb
      .select({ albumId: listItems.albumId, position: listItems.position })
      .from(listItems)
      .where(eq(listItems.listId, list.id))
      .orderBy(asc(listItems.position));

    expect(storedItems).toEqual([
      { albumId: testAlbums[0]?.id, position: 0 },
      { albumId: testAlbums[2]?.id, position: 2 },
    ]);
  });

  it("materializes a missing album from Spotify metadata before adding it", async () => {
    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const albumId = "spotify_materialized_album";
    mockGetAlbumPersistenceMetadata.mockResolvedValue({
      artistNames: ["Materialized Artist"],
      coverUrl: "https://example.com/materialized.jpg",
      id: albumId,
      releaseDate: "2026-03-01",
      title: "Materialized Album",
      totalTracks: 9,
    });

    const result = await addListItemService({ albumId, listId: list.id }, createAuthenticatedContext(testDb, owner));
    const [storedAlbum] = await testDb.select().from(albums).where(eq(albums.id, albumId));

    expect(mockGetAlbumPersistenceMetadata).toHaveBeenCalledWith(albumId);
    expect(result).toMatchObject({
      added: true,
      album: {
        artist: "Materialized Artist",
        id: albumId,
        title: "Materialized Album",
        year: "2026",
      },
      position: 0,
    });
    expect(storedAlbum).toMatchObject({
      artistNames: ["Materialized Artist"],
      id: albumId,
      title: "Materialized Album",
    });
  });

  it("rejects another user's add before requesting Spotify metadata", async () => {
    const owner = await createTestUser(testDb);
    const otherUser = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });

    await expect(
      addListItemService({ albumId: "missing_album", listId: list.id }, createAuthenticatedContext(testDb, otherUser))
    ).rejects.toThrow("List not found");
    expect(mockGetAlbumPersistenceMetadata).not.toHaveBeenCalled();
  });

  it("rejects an add to a full list before requesting Spotify metadata", async () => {
    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const fullListAlbums = Array.from({ length: 100 }, (_, index) => ({
      artistNames: [`Full List Artist ${index}`],
      id: `full_list_album_${index}`,
      releaseDate: "2026-01-01",
      title: `Full List Album ${index}`,
      totalTracks: 10,
    }));
    await testDb.insert(albums).values(fullListAlbums);
    await testDb.insert(listItems).values(
      fullListAlbums.map((album, position) => ({
        albumId: album.id,
        listId: list.id,
        position,
      }))
    );

    await expect(
      addListItemService(
        { albumId: "missing_album_for_full_list", listId: list.id },
        createAuthenticatedContext(testDb, owner)
      )
    ).rejects.toThrow("A list can contain up to 100 albums");
    expect(mockGetAlbumPersistenceMetadata).not.toHaveBeenCalled();
  });

  it("treats duplicate adds and missing removes as no-ops without touching the list", async () => {
    const owner = await createTestUser(testDb);
    const initialUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
    const list = await createTestList(testDb, { updatedAt: initialUpdatedAt, userId: owner.id });
    const album = await createTestAlbum(testDb);
    const context = createAuthenticatedContext(testDb, owner);

    const added = await addListItemService({ albumId: album.id, listId: list.id }, context);
    const duplicate = await addListItemService({ albumId: album.id, listId: list.id }, context);
    const missingRemove = await removeListItemService({ albumId: "album_not_in_list", listId: list.id }, context);

    expect(added.added).toBe(true);
    expect(added.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    expect(duplicate).toMatchObject({
      added: false,
      position: added.position,
      updatedAt: added.updatedAt,
    });
    expect(missingRemove).toMatchObject({
      removed: false,
      updatedAt: added.updatedAt,
    });
    await expect(testDb.select().from(listItems).where(eq(listItems.listId, list.id))).resolves.toHaveLength(1);
  });

  it("touches the parent only when an album is actually removed", async () => {
    const owner = await createTestUser(testDb);
    const initialUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
    const list = await createTestList(testDb, { updatedAt: initialUpdatedAt, userId: owner.id });
    const album = await createTestAlbum(testDb);
    await createTestListItem(testDb, { albumId: album.id, listId: list.id, position: 4 });

    const result = await removeListItemService(
      { albumId: album.id, listId: list.id },
      createAuthenticatedContext(testDb, owner)
    );

    expect(result.removed).toBe(true);
    expect(result.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    await expect(
      testDb
        .select()
        .from(listItems)
        .where(and(eq(listItems.listId, list.id), eq(listItems.albumId, album.id)))
    ).resolves.toEqual([]);
  });

  it("serializes concurrent additions so positions stay unique", async () => {
    const databaseUrl = process.env.DATABASE_TEST_URL;
    if (!databaseUrl) throw new Error("DATABASE_TEST_URL is required");

    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const firstAlbum = await createTestAlbum(testDb);
    const secondAlbum = await createTestAlbum(testDb);
    const concurrentClient = postgres(databaseUrl, { max: 2, prepare: false });
    const concurrentDb = drizzle({ client: concurrentClient, schema });
    const context = createAuthenticatedContext(concurrentDb, owner);

    try {
      await Promise.all([
        addListItemService({ albumId: firstAlbum.id, listId: list.id }, context),
        addListItemService({ albumId: secondAlbum.id, listId: list.id }, context),
      ]);
    } finally {
      await concurrentClient.end();
    }

    const storedItems = await testDb
      .select({ position: listItems.position })
      .from(listItems)
      .where(eq(listItems.listId, list.id))
      .orderBy(asc(listItems.position));

    expect(storedItems).toEqual([{ position: 0 }, { position: 1 }]);
  });

  it("does not let concurrent additions exceed the 100-item cap", async () => {
    const databaseUrl = process.env.DATABASE_TEST_URL;
    if (!databaseUrl) throw new Error("DATABASE_TEST_URL is required");

    const owner = await createTestUser(testDb);
    const list = await createTestList(testDb, { userId: owner.id });
    const seededAlbums = Array.from({ length: 101 }, (_, index) => ({
      artistNames: [`Cap Artist ${index}`],
      id: `cap_album_${index}`,
      releaseDate: "2026-01-01",
      title: `Cap Album ${index}`,
      totalTracks: 10,
    }));
    await testDb.insert(albums).values(seededAlbums);
    await testDb.insert(listItems).values(
      seededAlbums.slice(0, 99).map((album, position) => ({
        albumId: album.id,
        listId: list.id,
        position,
      }))
    );

    const concurrentClient = postgres(databaseUrl, { max: 2, prepare: false });
    const concurrentDb = drizzle({ client: concurrentClient, schema });
    const context = createAuthenticatedContext(concurrentDb, owner);

    try {
      const results = await Promise.allSettled([
        addListItemService({ albumId: seededAlbums[99]?.id ?? "", listId: list.id }, context),
        addListItemService({ albumId: seededAlbums[100]?.id ?? "", listId: list.id }, context),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        reason: expect.objectContaining({
          message: "A list can contain up to 100 albums",
        }),
      });
    } finally {
      await concurrentClient.end();
    }

    const storedItems = await testDb
      .select({ position: listItems.position })
      .from(listItems)
      .where(eq(listItems.listId, list.id));

    expect(storedItems).toHaveLength(100);
    expect(new Set(storedItems.map((item) => item.position)).size).toBe(100);
  });
});
