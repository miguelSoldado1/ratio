import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { UserList } from "@/components/user-list";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { useSetUserFollowMutation } from "@/hooks/use-user-follow-toggle";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserFollowers, getUserFollowing } from "@/server/functions/follow-functions";
import { tryCatch } from "@/try-catch";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { UserFollowsPage } from "@/server/services/follow-service";

type FollowListUser = UserFollowsPage["users"][number];
type FollowListQueryData = InfiniteData<UserFollowsPage, string | null>;

const userListSkeletonRows = ["one", "two", "three", "four"] as const;

interface ProfileFollowListDialogProps {
  hasSession: boolean;
  profileDisplayName: string;
  profileUserId: string;
  profileUsername: string;
  trigger: ReactElement;
  viewerUserId?: string;
}

interface SharedProfileFollowListDialogProps extends ProfileFollowListDialogProps {
  description: string;
  getPage: (cursor: string | null) => Promise<UserFollowsPage>;
  queryKey: QueryKey;
  title: string;
}

export function ProfileFollowersDialog(props: ProfileFollowListDialogProps) {
  const getUserFollowersFn = useServerFn(getUserFollowers);

  return (
    <ProfileFollowListDialog
      {...props}
      description={`People following ${props.profileDisplayName}.`}
      getPage={(cursor) => getUserFollowersFn({ data: { cursor: cursor ?? undefined, userId: props.profileUserId } })}
      queryKey={userQueryKeys.followers(props.profileUserId, props.viewerUserId)}
      title="Followers"
    />
  );
}

export function ProfileFollowingDialog(props: ProfileFollowListDialogProps) {
  const getUserFollowingFn = useServerFn(getUserFollowing);

  return (
    <ProfileFollowListDialog
      {...props}
      description={`People ${props.profileDisplayName} follows.`}
      getPage={(cursor) => getUserFollowingFn({ data: { cursor: cursor ?? undefined, userId: props.profileUserId } })}
      queryKey={userQueryKeys.following(props.profileUserId, props.viewerUserId)}
      title="Following"
    />
  );
}

function ProfileFollowListDialog({
  description,
  getPage,
  hasSession,
  profileUsername,
  queryKey,
  title,
  trigger,
  viewerUserId,
}: SharedProfileFollowListDialogProps) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string>();
  const queryClient = useQueryClient();

  const setUserFollowMutation = useSetUserFollowMutation();

  const followListQuery = useInfiniteQuery({
    enabled: open,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) => getPage(pageParam),
    queryKey,
  });

  const users = followListQuery.data?.pages.flatMap((page) => page.users) ?? [];
  const isEmpty = users.length === 0;
  const isInitialListError = followListQuery.isError && isEmpty;
  const canShowListContent = !(followListQuery.isPending || isInitialListError);
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = followListQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: open && hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
    rootMargin: "160px 0px",
  });

  async function handleFollowToggle(user: FollowListUser, following: boolean) {
    if (!hasSession) return;

    setPendingUserId(user.id);
    const previousList = queryClient.getQueryData<FollowListQueryData>(queryKey);

    queryClient.setQueryData<FollowListQueryData>(queryKey, (list) => updateFollowListUser(list, user.id, following));

    const { data: updatedFollow, error } = await tryCatch(
      setUserFollowMutation.mutateAsync({ data: { following, userId: user.id } })
    );

    if (error) {
      queryClient.setQueryData(queryKey, previousList);
      setPendingUserId(undefined);

      const errorMessage = error instanceof Error ? error.message : "Could not update follow status";
      return toast.error("Error", { description: errorMessage });
    }

    queryClient.setQueryData<FollowListQueryData>(queryKey, (list) =>
      updateFollowListUser(list, updatedFollow.userId, updatedFollow.followedByViewer)
    );
    setPendingUserId(undefined);

    const staleQueryKeys = [
      queryKey,
      userQueryKeys.profile(profileUsername, viewerUserId),
      userQueryKeys.profile(user.username, viewerUserId),
    ];

    await Promise.all(
      staleQueryKeys.map((staleQueryKey) => queryClient.invalidateQueries({ queryKey: staleQueryKey }))
    );
  }

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger render={trigger} />
        <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 gap-1 border-border/70 border-b px-5 py-4 pr-12">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(64svh,28rem)] overflow-y-auto px-3 py-3">
            {followListQuery.isPending ? <UserListSkeleton /> : null}
            {isInitialListError ? (
              <p className="px-2 py-10 text-center text-muted-foreground text-sm">
                Could not load {title.toLowerCase()}.
              </p>
            ) : null}
            {canShowListContent ? (
              <UserList
                onUserSelect={() => setOpen(false)}
                renderAction={(user) =>
                  user.id === viewerUserId ? null : (
                    <Button
                      className="min-w-22 rounded-full active:scale-[0.97]"
                      disabled={pendingUserId === user.id}
                      onClick={() => {
                        if (!hasSession) {
                          setOpen(false);
                          setAuthDialogOpen(true);
                          return;
                        }

                        handleFollowToggle(user, !user.followedByViewer);
                      }}
                      size="sm"
                      type="button"
                      variant={user.followedByViewer ? "secondary" : "default"}
                    >
                      {user.followedByViewer ? "Following" : "Follow"}
                    </Button>
                  )
                }
                users={users}
              />
            ) : null}
            {hasNextPage || isFetchingNextPage ? (
              <div className="flex h-12 items-center justify-center" ref={loadMoreRef}>
                {isFetchingNextPage ? <Spinner className="text-muted-foreground" /> : null}
              </div>
            ) : null}
            {isFetchNextPageError ? (
              <p className="px-2 py-3 text-center text-muted-foreground text-xs">Could not load more users.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function updateFollowListUser(list: FollowListQueryData | undefined, userId: string, followedByViewer: boolean) {
  if (!list) return list;

  return {
    ...list,
    pages: list.pages.map((page) => ({
      ...page,
      users: page.users.map((user) => (user.id === userId ? { ...user, followedByViewer } : user)),
    })),
  };
}

function UserListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2 py-1">
      {userListSkeletonRows.map((row) => (
        <div className="flex items-center gap-3" key={row}>
          <Skeleton className="size-11 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32 rounded-sm" />
            <Skeleton className="h-3 w-24 rounded-sm" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
