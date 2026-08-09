import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as AlbumRoute } from "@/routes/album/$albumId";
import { Route as ReviewRoute } from "@/routes/review/$reviewId";

const mocks = vi.hoisted(() => ({
  albumPage: vi.fn(),
  getAlbumHeadMetadata: vi.fn(),
  getReviewHeadMetadata: vi.fn(),
  reviewConversation: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ albumId: "album-a", reviewId: "review-a" }),
  }),
  Link: ({ children, params, to, ...props }: LinkProps) => (
    <a href={to.replace("$albumId", params.albumId)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/album-page/album-page", () => ({
  AlbumPage: ({ albumId }: { albumId: string }) => {
    mocks.albumPage({ albumId });
    return <div>Full album page</div>;
  },
}));

vi.mock("@/components/review-conversation/review-conversation", () => ({
  ReviewConversation: (props: ReviewConversationProps) => {
    mocks.reviewConversation(props);
    return <div>Review conversation</div>;
  },
}));

vi.mock("@/server/functions/spotify-functions", () => ({
  getAlbumHeadMetadata: mocks.getAlbumHeadMetadata,
}));

vi.mock("@/server/functions/review-functions", () => ({
  getReviewHeadMetadata: mocks.getReviewHeadMetadata,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("album and review routes", () => {
  it("renders the album page from the direct album route", () => {
    const Album = AlbumRoute.options.component;
    if (!Album) throw new Error("Album route component is missing");

    render(<Album />);

    expect(screen.getByText("Full album page")).toBeTruthy();
    expect(mocks.albumPage).toHaveBeenCalledWith({ albumId: "album-a" });
  });

  it("loads server metadata without server-rendering the album component", async () => {
    const metadata = {
      artistNames: ["Artist"],
      coverUrl: null,
      title: "Album",
    };
    mocks.getAlbumHeadMetadata.mockResolvedValue(metadata);
    const loader = AlbumRoute.options.loader as AlbumMetadataLoader | undefined;
    if (!loader) throw new Error("Album route loader is missing");

    await expect(loader({ params: { albumId: "album-a" } })).resolves.toEqual(metadata);
    expect(mocks.getAlbumHeadMetadata).toHaveBeenCalledWith({ data: { albumId: "album-a" } });
    expect(AlbumRoute.options.preload).toBe(false);
    expect(AlbumRoute.options.ssr).toBe("data-only");
  });

  it("falls back cleanly when album head metadata cannot be loaded", async () => {
    mocks.getAlbumHeadMetadata.mockRejectedValue(new Error("Metadata unavailable"));
    const loader = AlbumRoute.options.loader as AlbumMetadataLoader | undefined;
    if (!loader) throw new Error("Album route loader is missing");

    await expect(loader({ params: { albumId: "album-a" } })).resolves.toBeNull();
  });

  it("builds album-first head metadata beside the route", () => {
    const createHead = AlbumRoute.options.head as AlbumHead | undefined;
    if (!createHead) throw new Error("Album route head is missing");

    const head = createHead({
      loaderData: {
        artistNames: ["Primary Artist", "Featured Artist"],
        coverUrl: "https://image.example/album.jpg",
        title: "The Album",
      },
      params: { albumId: "album-a" },
    });

    expect(head.meta).toContainEqual({ title: "The Album by Primary Artist — Reviews | Ratio" });
    expect(head.meta).toContainEqual({ content: "summary", name: "twitter:card" });
    expect(head.links).toEqual([{ href: "https://ratiomusic.live/album/album-a", rel: "canonical" }]);
    expect(head.scripts).toBeUndefined();
  });

  it("omits robots rather than deindexing when the album lookup fails", () => {
    const createHead = AlbumRoute.options.head as AlbumHead | undefined;
    if (!createHead) throw new Error("Album route head is missing");

    const head = createHead({ loaderData: null, params: { albumId: "missing" } });

    expect(head.meta.some((tag) => tag.name === "robots")).toBe(false);
    expect(head.scripts).toBeUndefined();
  });

  it("renders a standalone review page without mounting AlbumPage", () => {
    const Review = ReviewRoute.options.component;
    if (!Review) throw new Error("Review route component is missing");

    render(<Review />);

    expect(ReviewRoute.options.notFoundComponent).toBeDefined();
    expect(ReviewRoute.options.preload).toBe(false);
    expect(ReviewRoute.options.ssr).toBe("data-only");
    expect(screen.queryByText("Back to album")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.albumPage).not.toHaveBeenCalled();
    expect(mocks.reviewConversation).toHaveBeenCalledWith({ reviewId: "review-a" });
  });

  it("loads narrow review metadata without server-rendering the conversation", async () => {
    const metadata = {
      artistNames: ["Primary Artist"],
      authorDisplayName: "Listener",
      coverUrl: "https://image.example/album.jpg",
      rating: 4.5,
      title: "The Album",
    };
    mocks.getReviewHeadMetadata.mockResolvedValue(metadata);
    const loader = ReviewRoute.options.loader as ReviewMetadataLoader | undefined;
    if (!loader) throw new Error("Review route loader is missing");

    await expect(loader({ params: { reviewId: "review-a" } })).resolves.toEqual(metadata);
    expect(mocks.getReviewHeadMetadata).toHaveBeenCalledWith({ data: { reviewId: "review-a" } });
  });

  it("falls back cleanly when review head metadata cannot be loaded", async () => {
    mocks.getReviewHeadMetadata.mockRejectedValue(new Error("Metadata unavailable"));
    const loader = ReviewRoute.options.loader as ReviewMetadataLoader | undefined;
    if (!loader) throw new Error("Review route loader is missing");

    await expect(loader({ params: { reviewId: "review-a" } })).resolves.toBeNull();
  });

  it("builds review-specific social metadata from the local review row", () => {
    const createHead = ReviewRoute.options.head as ReviewHead | undefined;
    if (!createHead) throw new Error("Review route head is missing");

    const head = createHead({
      loaderData: {
        artistNames: ["Primary Artist"],
        authorDisplayName: "Listener",
        coverUrl: "https://image.example/album.jpg",
        rating: 4.5,
        title: "The Album",
      },
      params: { reviewId: "review-a" },
    });

    expect(head.meta).toContainEqual({ title: "The Album review by Listener | Ratio" });
    expect(head.meta).toContainEqual({ content: "https://image.example/album.jpg", property: "og:image" });
    expect(head.meta).toContainEqual({ content: "summary", name: "twitter:card" });
    expect(head.links).toEqual([{ href: "https://ratiomusic.live/review/review-a", rel: "canonical" }]);
    expect(head.scripts).toBeUndefined();
  });

  it("omits robots rather than deindexing when the review lookup fails", () => {
    const createHead = ReviewRoute.options.head as ReviewHead | undefined;
    if (!createHead) throw new Error("Review route head is missing");

    const head = createHead({ loaderData: null, params: { reviewId: "missing" } });

    expect(head.meta.some((tag) => tag.name === "robots")).toBe(false);
    expect(head.scripts).toBeUndefined();
  });
});

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
  params: { albumId: string };
  to: string;
}

interface ReviewConversationProps {
  reviewId: string;
}

interface AlbumMetadata {
  artistNames: string[];
  coverUrl: string | null;
  title: string;
}

interface AlbumHeadContext {
  loaderData: AlbumMetadata | null;
  params: { albumId: string };
}

interface AlbumHeadResult {
  links: Array<{ href: string; rel: string }>;
  meta: Array<{ content?: string; name?: string; property?: string; title?: string }>;
  scripts?: Array<{ children: string }>;
}

interface ReviewMetadata {
  artistNames: string[];
  authorDisplayName: string;
  coverUrl: string | null;
  rating: number;
  title: string;
}

interface ReviewHeadContext {
  loaderData: ReviewMetadata | null;
  params: { reviewId: string };
}

type AlbumMetadataLoader = (context: { params: { albumId: string } }) => Promise<unknown>;
type AlbumHead = (context: AlbumHeadContext) => AlbumHeadResult;
type ReviewMetadataLoader = (context: { params: { reviewId: string } }) => Promise<unknown>;
type ReviewHead = (context: ReviewHeadContext) => AlbumHeadResult;
