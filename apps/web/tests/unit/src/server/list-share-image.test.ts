import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createListShareImageResponse,
  getListShareImagePath,
  getListShareMosaicCovers,
} from "@/server/list-share-image";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

const listId = "43e2f9c6-2355-4216-8f27-c607cb54d956";
const covers = ["https://i.scdn.co/a", "https://i.scdn.co/b", "https://i.scdn.co/c", "https://i.scdn.co/d"];

function mockCoverRows(coverUrls: (string | null)[]) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    limit: vi.fn().mockResolvedValue(coverUrls.map((coverUrl) => ({ coverUrl }))),
    orderBy: vi.fn(),
    where: vi.fn(),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.where.mockReturnValue(query);
  mocks.getDb.mockResolvedValue({ select: vi.fn().mockReturnValue(query) });
}

async function requestCurrentImage() {
  const path = await getListShareImagePath(listId, covers);
  return await createListShareImageResponse(new Request(`https://ratiomusic.live${path}`), listId);
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("list share mosaic covers", () => {
  it("needs four leading covers, like the in-app mosaic", () => {
    expect(getListShareMosaicCovers(covers.map((coverUrl) => ({ coverUrl })))).toEqual(covers);
    expect(getListShareMosaicCovers(covers.slice(0, 3).map((coverUrl) => ({ coverUrl })))).toBeNull();
    expect(getListShareMosaicCovers([...covers.slice(0, 3), null].map((coverUrl) => ({ coverUrl })))).toBeNull();
  });

  it("changes the image version when the covers change", async () => {
    const reordered = [covers[1], covers[0], covers[2], covers[3]];
    expect(await getListShareImagePath(listId, covers)).not.toBe(await getListShareImagePath(listId, reordered));
  });
});

describe("list share image response", () => {
  it("returns 404 when the list has no mosaic", async () => {
    mockCoverRows(covers.slice(0, 3));
    const response = await createListShareImageResponse(new Request("https://ratiomusic.live/api/og/list/x"), listId);
    expect(response.status).toBe(404);
  });

  it("composes the four covers into a padded 1200x630 canvas and caches it", async () => {
    mockCoverRows(covers);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("jpeg", { headers: { "cf-resized": "internal=ok", "content-type": "image/jpeg" } })
      );
    const edgeCache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("caches", { default: edgeCache });

    const response = await requestCurrentImage();

    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=604800");
    expect(edgeCache.put).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.cf.image).toMatchObject({ fit: "pad", height: 630, width: 1200 });
    expect(init.cf.image.draw).toEqual([
      { height: 315, left: 285, top: 0, url: covers[0], width: 315 },
      { height: 315, left: 600, top: 0, url: covers[1], width: 315 },
      { height: 315, left: 285, top: 315, url: covers[2], width: 315 },
      { height: 315, left: 600, top: 315, url: covers[3], width: 315 },
    ]);
  });

  it.each([
    ["the transformation errors", { "cf-resized": "err=9422", "content-type": "image/jpeg" }],
    ["transformations are off and the original cover comes back", { "content-type": "image/jpeg" }],
  ])("falls back to the first cover without caching when %s", async (_case, headers) => {
    mockCoverRows(covers);
    const edgeCache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("jpeg", { headers })));
    vi.stubGlobal("caches", { default: edgeCache });

    const response = await requestCurrentImage();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(covers[0]);
    expect(edgeCache.put).not.toHaveBeenCalled();
  });
});
