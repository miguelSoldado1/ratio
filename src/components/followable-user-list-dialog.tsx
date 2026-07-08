import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { InlineError } from "@/components/inline-error";
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
import { tryCatch } from "@/try-catch";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { UserListUser } from "@/components/user-list";

interface FollowableUser extends UserListUser {
  followedByViewer: boolean;
}

interface FollowableUserPage<TUser extends FollowableUser> {
  nextCursor: string | null;
  users: TUser[];
}

interface ViewerState {
  hasSession: boolean;
  userId?: string;
}

interface FollowableUserListDialogProps<TUser extends FollowableUser> {
  description: string;
  getInvalidationKeys?: (user: TUser) => QueryKey[];
  getPage: (cursor: string | null) => Promise<FollowableUserPage<TUser>>;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  queryKey: QueryKey;
  title: string;
  trigger?: ReactElement;
  viewer: ViewerState;
}

const userListSkeletonRows = ["one", "two", "three", "four"] as const;

export function FollowableUserListDialog<TUser extends FollowableUser>({
  description,
  getInvalidationKeys,
  getPage,
  onOpenChange,
  open,
  queryKey,
  title,
  trigger,
  viewer,
}: FollowableUserListDialogProps<TUser>) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string>();
  const openRef = useRef(false);
  const shouldInvalidateListOnCloseRef = useRef(false);
  const queryClient = useQueryClient();
  const setUserFollowMutation = useSetUserFollowMutation();

  const currentOpen = open ?? internalOpen;

  useEffect(() => {
    openRef.current = currentOpen;
  }, [currentOpen]);

  const userListQuery = useInfiniteQuery({
    enabled: currentOpen,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) => getPage(pageParam),
    queryKey,
  });

  const users = userListQuery.data?.pages.flatMap((page) => page.users) ?? [];
  const isEmpty = users.length === 0;
  const isInitialListError = userListQuery.isError && isEmpty;
  const canShowListContent = !(userListQuery.isPending || isInitialListError);
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = userListQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: currentOpen && hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
    rootMargin: "160px 0px",
  });

  function handleOpenChange(nextOpen: boolean) {
    openRef.current = nextOpen;
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);

    if (nextOpen || !shouldInvalidateListOnCloseRef.current) return;

    shouldInvalidateListOnCloseRef.current = false;
    queryClient.invalidateQueries({ queryKey });
  }

  async function handleFollowToggle(user: TUser, following: boolean) {
    if (!viewer.hasSession) return;

    setPendingUserId(user.id);
    const previousList = queryClient.getQueryData<InfiniteData<FollowableUserPage<TUser>, string | null>>(queryKey);

    queryClient.setQueryData<InfiniteData<FollowableUserPage<TUser>, string | null>>(queryKey, (list) =>
      updateFollowableUser(list, user.id, following)
    );

    const { data: updatedFollow, error } = await tryCatch(
      setUserFollowMutation.mutateAsync({ data: { following, userId: user.id } })
    );

    if (error) {
      queryClient.setQueryData(queryKey, previousList);
      setPendingUserId(undefined);

      const errorMessage = error instanceof Error ? error.message : "Could not update follow status";
      return toast.error("Error", { description: errorMessage });
    }

    queryClient.setQueryData<InfiniteData<FollowableUserPage<TUser>, string | null>>(queryKey, (list) =>
      updateFollowableUser(list, updatedFollow.userId, updatedFollow.followedByViewer)
    );
    setPendingUserId(undefined);

    if (openRef.current) {
      shouldInvalidateListOnCloseRef.current = true;
    } else {
      queryClient.invalidateQueries({ queryKey });
    }

    const invalidationKeys = getInvalidationKeys?.(user) ?? [];
    await Promise.all(
      invalidationKeys.map((staleQueryKey) => queryClient.invalidateQueries({ queryKey: staleQueryKey }))
    );
  }

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <Dialog onOpenChange={handleOpenChange} open={currentOpen}>
        {trigger ? <DialogTrigger render={trigger} /> : null}
        <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0" size="md">
          <DialogHeader className="shrink-0 gap-1 border-border/70 border-b py-4 pl-5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(64svh,28rem)] overflow-y-auto px-3 py-3">
            {userListQuery.isPending ? <UserListSkeleton /> : null}
            {isInitialListError ? (
              <InlineError
                align="center"
                className="px-2 py-10"
                description={`Could not load ${title.toLowerCase()}.`}
                title="Users unavailable"
              />
            ) : null}
            {canShowListContent ? (
              <UserList
                onUserSelect={() => handleOpenChange(false)}
                renderAction={(user) =>
                  user.id === viewer.userId ? null : (
                    <Button
                      className="min-w-22"
                      disabled={pendingUserId === user.id}
                      onClick={() => {
                        if (!viewer.hasSession) {
                          handleOpenChange(false);
                          setAuthDialogOpen(true);
                          return;
                        }

                        handleFollowToggle(user, !user.followedByViewer);
                      }}
                      shape="pill"
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
              <InlineError
                align="center"
                className="px-2 py-3 [&_p:first-child]:text-xs [&_p:last-child]:text-xs"
                title="Could not load more users."
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function updateFollowableUser<TUser extends FollowableUser>(
  list: InfiniteData<FollowableUserPage<TUser>, string | null> | undefined,
  userId: string,
  followedByViewer: boolean
) {
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
