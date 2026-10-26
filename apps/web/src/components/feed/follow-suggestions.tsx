import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useForYouFeedQuery } from "@/components/feed/for-you-feed-tab";
import { Button } from "@/components/ui/button";
import { UserList, UserListSkeleton } from "@/components/user-list";
import { useSetUserFollowMutation } from "@/hooks/use-user-follow-toggle";
import { trackSocialActionCompleted } from "@/lib/analytics/posthog";
import { tryCatch } from "@/try-catch";
import type { UserListUser } from "@/components/user-list";
import type { FeedPage } from "@/server/services/feed-service";

const maxSuggestions = 4;

interface FollowSuggestionsProps {
  viewerUserId: string;
}

export function FollowSuggestions({ viewerUserId }: FollowSuggestionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const feedQuery = useForYouFeedQuery(viewerUserId);
  const setUserFollowMutation = useSetUserFollowMutation();
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(() => new Set());
  const users = useMemo(
    () => getRecentReviewers(feedQuery.data?.pages ?? [], viewerUserId),
    [feedQuery.data, viewerUserId]
  );

  const panelToFocusOnUnmountRef = useRef<HTMLElement | null>(null);

  // A successful follow refills the Following feed and unmounts this list, dropping focus to <body>.
  useEffect(
    () =>
      function focusPanelOnUnmount() {
        const panel = panelToFocusOnUnmountRef.current;
        if (!panel) return;

        requestAnimationFrame(() => {
          if (document.activeElement === document.body) panel.focus({ preventScroll: true });
        });
      },
    []
  );

  if (feedQuery.isPending) {
    return (
      <div className="-mx-2">
        <UserListSkeleton />
      </div>
    );
  }
  if (users.length === 0) return null;

  async function handleFollow(userId: string) {
    const container = containerRef.current;
    panelToFocusOnUnmountRef.current = container?.contains(document.activeElement)
      ? container.closest<HTMLElement>('[role="tabpanel"]')
      : null;
    setFollowedUserIds((current) => new Set(current).add(userId));
    const { error } = await tryCatch(setUserFollowMutation.mutateAsync({ data: { following: true, userId } }));

    if (error) {
      panelToFocusOnUnmountRef.current = null;
      setFollowedUserIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      return toast.error("Couldn't follow", {
        description: error instanceof Error ? error.message : "Something went wrong. Try again.",
      });
    }

    trackSocialActionCompleted("follow");
  }

  return (
    <div className="-mx-2" ref={containerRef}>
      <UserList
        renderAction={(user) => {
          const isFollowed = followedUserIds.has(user.id);

          return (
            <Button
              aria-disabled={isFollowed}
              className="min-w-22"
              onClick={() => {
                if (!isFollowed) handleFollow(user.id);
              }}
              shape="pill"
              size="sm"
              type="button"
              variant={isFollowed ? "secondary" : "default"}
            >
              {isFollowed ? "Following" : "Follow"}
            </Button>
          );
        }}
        users={users}
      />
    </div>
  );
}

function getRecentReviewers(pages: FeedPage[], viewerUserId: string) {
  const reviewers = new Map<string, UserListUser>();

  const newestFirst = pages
    .flatMap((page) => page.reviews)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const review of newestFirst) {
    const { avatarUrl, displayUsername, id, username } = review.user;
    if (!username || id === viewerUserId || reviewers.has(id)) continue;

    reviewers.set(id, {
      avatarUrl,
      displayName: displayUsername,
      id,
      subtitle: `Reviewed ${review.album.title}`,
      username,
    });
    if (reviewers.size === maxSuggestions) break;
  }

  return [...reviewers.values()];
}
