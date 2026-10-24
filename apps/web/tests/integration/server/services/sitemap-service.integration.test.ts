import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import { createTestAlbum, createTestList, createTestListItem, createTestReview, createTestUser } from "@test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSitemapXml } from "@/server/services/sitemap-service";

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => testDb),
}));

beforeAll(async () => {
  await migrateTestDatabase();
});

beforeEach(async () => {
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("sitemap", () => {
  it("keeps written reviews by users without usernames but excludes their profiles and lists", async () => {
    const author = await createTestUser(testDb, { username: null });
    const album = await createTestAlbum(testDb);
    const review = await createTestReview(testDb, { albumId: album.id, userId: author.id });
    const list = await createTestList(testDb, { userId: author.id });
    for (let index = 0; index < 3; index++) {
      await createTestListItem(testDb, { listId: list.id });
    }

    const xml = await createSitemapXml();

    expect(xml).toContain(`/album/${album.id}<`);
    expect(xml).toContain(`/review/${review.id}<`);
    expect(xml).not.toContain("https://ratiomusic.live/user/");
    expect(xml).not.toContain(`/list/${list.id}<`);
  });

  it("lists static pages and public pages backed by written reviews or lists with at least three albums", async () => {
    const author = await createTestUser(testDb, { username: "listener" });
    const ratingOnlyAuthor = await createTestUser(testDb, { username: "quiet" });
    const bannedAuthor = await createTestUser(testDb, { banned: true, username: "banned" });
    const reviewedAlbum = await createTestAlbum(testDb);
    const ratingOnlyAlbum = await createTestAlbum(testDb);
    const bannedAlbum = await createTestAlbum(testDb);
    const review = await createTestReview(testDb, {
      albumId: reviewedAlbum.id,
      updatedAt: new Date("2026-10-01T12:00:00Z"),
      userId: author.id,
    });
    const ratingOnlyReview = await createTestReview(testDb, {
      albumId: ratingOnlyAlbum.id,
      body: null,
      userId: ratingOnlyAuthor.id,
    });
    const bannedReview = await createTestReview(testDb, { albumId: bannedAlbum.id, userId: bannedAuthor.id });
    const list = await createTestList(testDb, { userId: author.id });
    const emptyList = await createTestList(testDb, { userId: author.id });
    const oneAlbumList = await createTestList(testDb, { userId: author.id });
    const twoAlbumList = await createTestList(testDb, { userId: author.id });
    const bannedList = await createTestList(testDb, { userId: bannedAuthor.id });
    for (const album of [reviewedAlbum, ratingOnlyAlbum, bannedAlbum]) {
      await createTestListItem(testDb, { albumId: album.id, listId: list.id });
      await createTestListItem(testDb, { albumId: album.id, listId: bannedList.id });
    }
    await createTestListItem(testDb, { albumId: reviewedAlbum.id, listId: oneAlbumList.id });
    await createTestListItem(testDb, { albumId: reviewedAlbum.id, listId: twoAlbumList.id });
    await createTestListItem(testDb, { albumId: ratingOnlyAlbum.id, listId: twoAlbumList.id });

    const xml = await createSitemapXml();

    expect(xml).toContain("<url><loc>https://ratiomusic.live/</loc></url>");
    expect(xml).toContain("<loc>https://ratiomusic.live/privacy</loc><lastmod>2026-07-28</lastmod>");
    expect(xml).toContain(`<loc>https://ratiomusic.live/album/${reviewedAlbum.id}</loc><lastmod>2026-10-01</lastmod>`);
    expect(xml).toContain(`<loc>https://ratiomusic.live/review/${review.id}</loc><lastmod>2026-10-01</lastmod>`);
    expect(xml).toContain("<loc>https://ratiomusic.live/user/listener</loc><lastmod>2026-10-01</lastmod>");
    expect(xml).toContain(`<loc>https://ratiomusic.live/list/${list.id}</loc>`);

    for (const excluded of [
      `/album/${ratingOnlyAlbum.id}<`,
      `/review/${ratingOnlyReview.id}<`,
      "/user/quiet<",
      `/album/${bannedAlbum.id}<`,
      `/review/${bannedReview.id}<`,
      "/user/banned<",
      `/list/${emptyList.id}<`,
      `/list/${oneAlbumList.id}<`,
      `/list/${twoAlbumList.id}<`,
      `/list/${bannedList.id}<`,
    ]) {
      expect(xml).not.toContain(excluded);
    }
  });
});
