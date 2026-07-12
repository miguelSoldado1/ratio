import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState } from "react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { InlineError } from "@/components/inline-error";
import { PageContainer } from "@/components/page-container";
import { ProfileHeader, ProfileHeaderSkeleton } from "@/components/profile/profile-header";
import { ProfileLikedReviewsTab } from "@/components/profile/profile-liked-reviews-tab";
import { ProfileReviewsSectionSkeleton } from "@/components/profile/profile-reviews-section";
import { ProfileReviewsTab } from "@/components/profile/profile-reviews-tab";
import {
  SwipeableTabs,
  SwipeableTabsContent,
  SwipeableTabsList,
  SwipeableTabsTrigger,
  SwipeableTabsViewport,
} from "@/components/swipeable-tabs";
import { useReviewDelete } from "@/hooks/use-review-delete";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";
import { albumQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserProfile } from "@/server/functions/review-functions";
import type { UserReviewsPage } from "@/server/services/review-service";

type ProfileTab = "likes" | "reviews";

export const Route = createFileRoute("/user/$username")({
  component: UserPage,
  head: ({ params }) => {
    const path = `/user/${params.username}`;

    return {
      links: [createCanonicalLink(path)],
      meta: createSeoMeta({
        description: `Read @${params.username}'s album reviews on Ratio.`,
        path,
        title: `@${params.username} - Album Reviews | ${siteName}`,
        type: "profile",
      }),
    };
  },
});

function UserPage() {
  const { username } = Route.useParams();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const [activeTab, setActiveTab] = useState<ProfileTab>("reviews");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const viewerUserId = session.data?.user.id;
  const hasSession = Boolean(viewerUserId);
  const profileQueryKey = userQueryKeys.profile(username, viewerUserId);

  const viewer = useMemo(() => ({ hasSession, userId: viewerUserId }), [hasSession, viewerUserId]);

  const getUserProfileFn = useServerFn(getUserProfile);
  const userProfileQuery = useQuery({
    queryFn: () => getUserProfileFn({ data: { username } }),
    queryKey: profileQueryKey,
  });

  const profile = userProfileQuery.data?.user;
  const reviewsQueryKey = profile
    ? userQueryKeys.reviews(profile.id, viewerUserId)
    : userQueryKeys.reviews("", viewerUserId);

  const likedReviewsQueryKey = profile
    ? userQueryKeys.likedReviews(profile.id, viewerUserId)
    : userQueryKeys.likedReviews("", viewerUserId);

  const toggleReviewLike = useReviewLikeToggle<UserReviewsPage>({
    enabled: hasSession,
    queryKeys: [reviewsQueryKey, likedReviewsQueryKey],
  });

  const handleReviewLikeToggle = useCallback(
    async (reviewId: string, liked: boolean) => {
      const result = await toggleReviewLike(reviewId, liked);
      if (result === false) return false;

      if (profile?.id === viewerUserId) {
        await queryClient.invalidateQueries({ queryKey: likedReviewsQueryKey });
      }

      return result;
    },
    [likedReviewsQueryKey, profile?.id, queryClient, toggleReviewLike, viewerUserId]
  );

  async function handleReviewDeleted(deletedReview: { albumId: string }) {
    const staleQueryKeys = [
      userQueryKeys.profile(username),
      userQueryKeys.reviews(profile?.id ?? ""),
      likedReviewsQueryKey,
      albumQueryKeys.review(deletedReview.albumId),
    ];

    await Promise.all(
      staleQueryKeys.map((staleQueryKey) => queryClient.invalidateQueries({ queryKey: staleQueryKey }))
    );
  }

  const { deleteReview: handleReviewDelete, deletingReviewId } = useReviewDelete({
    onDeleted: handleReviewDeleted,
  });

  function handleTabChange(value: string) {
    if (value === "likes" || value === "reviews") setActiveTab(value);
  }

  if (userProfileQuery.isPending) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer className="flex flex-col gap-8 lg:py-12">
          <ProfileHeaderSkeleton />
          <ProfileReviewsSectionSkeleton className="mt-0" />
        </PageContainer>
      </main>
    );
  }

  if (userProfileQuery.isError || !profile) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer className="py-12">
          <InlineError description="Could not load this profile." title="User unavailable" />
        </PageContainer>
      </main>
    );
  }

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer className="flex flex-col lg:py-12">
          <ProfileHeader
            onAuthRequired={() => setAuthDialogOpen(true)}
            profile={profile}
            stats={{
              followersCount: userProfileQuery.data.followersCount,
              followingCount: userProfileQuery.data.followingCount,
              reviewCount: userProfileQuery.data.reviewCount,
            }}
            viewer={viewer}
          />
          <SwipeableTabs className="mt-7" defaultValue="reviews" onValueChange={handleTabChange}>
            <SwipeableTabsList aria-label={`${profile.displayName}'s profile sections`}>
              <SwipeableTabsTrigger value="reviews">Reviews</SwipeableTabsTrigger>
              <SwipeableTabsTrigger value="likes">Likes</SwipeableTabsTrigger>
            </SwipeableTabsList>
            <SwipeableTabsViewport>
              <SwipeableTabsContent value="reviews">
                <ProfileReviewsTab
                  deletingReviewId={deletingReviewId}
                  onReviewDelete={handleReviewDelete}
                  onReviewLikeToggle={handleReviewLikeToggle}
                  profileUser={profile}
                  viewer={viewer}
                />
              </SwipeableTabsContent>
              <SwipeableTabsContent className="min-h-screen" value="likes">
                <ProfileLikedReviewsTab
                  active={activeTab === "likes"}
                  deletingReviewId={deletingReviewId}
                  onReviewDelete={handleReviewDelete}
                  onReviewLikeToggle={handleReviewLikeToggle}
                  profileUser={profile}
                  viewer={viewer}
                />
              </SwipeableTabsContent>
            </SwipeableTabsViewport>
          </SwipeableTabs>
        </PageContainer>
      </main>
    </>
  );
}
