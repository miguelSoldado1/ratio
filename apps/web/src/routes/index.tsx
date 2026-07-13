import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FollowingFeedTab } from "@/components/feed/following-feed-tab";
import { ForYouFeedTab } from "@/components/feed/for-you-feed-tab";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import { RecentRotation } from "@/components/recent-rotation/recent-rotation";
import {
  SwipeableTabs,
  SwipeableTabsContent,
  SwipeableTabsHeader,
  SwipeableTabsList,
  SwipeableTabsTrigger,
  SwipeableTabsViewport,
} from "@/components/swipeable-tabs";
import { useReviewDelete } from "@/hooks/use-review-delete";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { createCanonicalLink, createJsonLdScript, createSeoMeta, getCanonicalUrl, siteName } from "@/lib/seo";
import { feedQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import type { FeedPage as FeedPageData } from "@/server/services/feed-service";

type HomeFeedTab = "following" | "for-you";

export const Route = createFileRoute("/")({
  component: FeedPage,
  head: () => ({
    links: [createCanonicalLink("/")],
    meta: createSeoMeta({ path: "/" }),
    scripts: [
      createJsonLdScript({
        "@context": "https://schema.org",
        "@type": "WebSite",
        description: "Discover, rate, and review albums with a social music community.",
        name: siteName,
        url: getCanonicalUrl("/"),
      }),
    ],
  }),
});

function FeedPage() {
  const session = authClient.useSession();
  const [activeTab, setActiveTab] = useState<HomeFeedTab>("for-you");
  const viewerUserId = session.data?.user.id;
  const hasSession = Boolean(viewerUserId);
  const viewer = useMemo(() => ({ hasSession, userId: viewerUserId }), [hasSession, viewerUserId]);
  const feedQueryKey = feedQueryKeys.root(viewerUserId);
  const followingFeedQueryKey = viewerUserId ? feedQueryKeys.following(viewerUserId) : feedQueryKeys.all();

  const handleReviewLikeToggle = useReviewLikeToggle<FeedPageData>({
    enabled: hasSession,
    queryKeys: hasSession ? [feedQueryKey, followingFeedQueryKey] : [feedQueryKey],
  });

  const { deleteReview: handleReviewDelete, deletingReviewId } = useReviewDelete();

  function handleTabChange(value: string) {
    if (value === "following" || value === "for-you") setActiveTab(value);
  }

  return (
    <main className={cn("bg-background text-foreground", hasSession ? "h-[calc(100dvh-4.0625rem)]" : "min-h-screen")}>
      <PageContainer className={cn(hasSession && "flex h-full min-h-0 flex-col")}>
        <h1 className="sr-only">Album reviews feed</h1>
        {hasSession ? (
          <SwipeableTabs className="min-h-0 flex-1" defaultValue="for-you" onValueChange={handleTabChange}>
            <SwipeableTabsHeader>
              <PageContainerContent className="py-0">
                <RecentRotation viewerUserId={viewerUserId} />
              </PageContainerContent>
            </SwipeableTabsHeader>
            <SwipeableTabsList
              aria-label="Home feed sections"
              className="bg-background p-0 group-data-horizontal/tabs:h-12"
            >
              <SwipeableTabsTrigger value="for-you">For You</SwipeableTabsTrigger>
              <SwipeableTabsTrigger value="following">Following</SwipeableTabsTrigger>
            </SwipeableTabsList>
            <SwipeableTabsViewport className="mx-0">
              <SwipeableTabsContent className="px-0 pb-8 lg:pb-12" value="for-you">
                <PageContainerContent className="py-0">
                  <ForYouFeedTab
                    active={activeTab === "for-you"}
                    deletingReviewId={deletingReviewId}
                    onReviewDelete={handleReviewDelete}
                    onReviewLikeToggle={handleReviewLikeToggle}
                    viewer={viewer}
                  />
                </PageContainerContent>
              </SwipeableTabsContent>
              <SwipeableTabsContent className="px-0 pb-8 lg:pb-12" value="following">
                <PageContainerContent className="py-0">
                  <FollowingFeedTab
                    active={activeTab === "following"}
                    deletingReviewId={deletingReviewId}
                    onReviewDelete={handleReviewDelete}
                    onReviewLikeToggle={handleReviewLikeToggle}
                    viewer={viewer}
                  />
                </PageContainerContent>
              </SwipeableTabsContent>
            </SwipeableTabsViewport>
          </SwipeableTabs>
        ) : (
          <PageContainerContent className="flex flex-col pt-0 pb-8 lg:pb-12">
            <RecentRotation viewerUserId={viewerUserId} />
            <ForYouFeedTab
              active
              deletingReviewId={deletingReviewId}
              onReviewDelete={handleReviewDelete}
              onReviewLikeToggle={handleReviewLikeToggle}
              viewer={viewer}
            />
          </PageContainerContent>
        )}
      </PageContainer>
    </main>
  );
}
