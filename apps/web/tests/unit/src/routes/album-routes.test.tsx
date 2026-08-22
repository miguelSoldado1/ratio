import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as AlbumRoute } from "@/routes/album/$albumId";
import { Route as ReviewRoute } from "@/routes/review/$reviewId";

const mocks = vi.hoisted(() => ({
  albumPage: vi.fn(),
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

  it("renders a standalone review page without mounting AlbumPage", () => {
    const Review = ReviewRoute.options.component;
    if (!Review) throw new Error("Review route component is missing");

    render(<Review />);

    expect(ReviewRoute.options.notFoundComponent).toBeDefined();
    expect(ReviewRoute.options.loader).toBeUndefined();
    expect(screen.queryByText("Back to album")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.albumPage).not.toHaveBeenCalled();
    expect(mocks.reviewConversation).toHaveBeenCalledWith({ reviewId: "review-a" });
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
