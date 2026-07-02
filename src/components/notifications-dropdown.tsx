import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { useRef, useState } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { notificationQueryKeys } from "@/lib/tanstack-query/query-keys";
import {
  getNotifications,
  getUnseenNotificationCount,
  markNotificationsSeen,
} from "@/server/functions/notification-functions";
import { tryCatch } from "@/try-catch";
import type { InfiniteData } from "@tanstack/react-query";
import type { NotificationItem, NotificationsPage } from "@/server/services/notification-service";

interface NotificationsDropdownProps {
  userId: string;
}

export function NotificationsDropdown({ userId }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const countQueryKey = notificationQueryKeys.unseenCount(userId);
  const listQueryKey = notificationQueryKeys.list(userId);

  const getUnseenNotificationCountFn = useServerFn(getUnseenNotificationCount);
  const unseenCountQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => getUnseenNotificationCountFn(),
    queryKey: countQueryKey,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnWindowFocus: "always",
  });

  const getNotificationsFn = useServerFn(getNotifications);
  const notificationsQuery = useInfiniteQuery({
    enabled: Boolean(userId) && open,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getNotificationsFn({ data: { cursor: pageParam ?? undefined } }),
    queryKey: listQueryKey,
  });

  const markNotificationsSeenFn = useServerFn(markNotificationsSeen);
  const markSeenMutation = useMutation({ mutationFn: () => markNotificationsSeenFn() });

  const items = notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const unseenCount = unseenCountQuery.data?.count ?? 0;
  const cappedCount = unseenCount > 9 ? "9+" : String(unseenCount);
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = notificationsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: open && hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
    rootRef: scrollContainerRef,
    rootMargin: "160px 0px",
  });

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    const hasUnseenItems = items.some((item) => !item.seen);
    if (nextOpen || !hasUnseenItems) return;

    const { error } = await tryCatch(markSeenMutation.mutateAsync());
    if (error) return;

    queryClient.setQueryData(countQueryKey, { count: 0 });
    queryClient.setQueryData<InfiniteData<NotificationsPage, string | null>>(listQueryKey, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.seen ? item : { ...item, seen: true })),
            })),
          }
        : data
    );
    await queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all(userId), refetchType: "inactive" });
  }

  function handleNotificationClick(item: NotificationItem) {
    if (item.type === "review_liked") {
      return navigate({
        params: { albumId: item.albumId, reviewId: item.reviewId },
        to: "/album/$albumId/review/$reviewId",
      });
    }

    return navigate({ params: { username: item.actor.username.toLowerCase() }, to: "/user/$username" });
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange} open={open}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={unseenCount > 0 ? `Open notifications, ${unseenCount} unseen` : "Open notifications"}
            className="relative size-8 rounded-full px-0 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97]"
            type="button"
            variant="ghost"
          />
        }
      >
        <Bell />
        {unseenCount > 0 ? (
          <Badge
            className="absolute -top-1 -right-1 h-4 min-w-4 border-background bg-popover px-1 text-[10px] text-foreground shadow-sm ring-1 ring-border/70"
            variant="outline"
          >
            {cappedCount}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-screen max-w-none overflow-hidden rounded-3xl p-0 sm:max-h-[min(760px,calc(100vh-6rem))] sm:w-[420px] sm:max-w-[420px]"
        sideOffset={8}
      >
        <DropdownMenuGroup className="flex max-h-[inherit] min-h-0 flex-col">
          <DropdownMenuLabel className="flex items-center justify-between border-border/60 border-b px-4 py-3">
            <span className="font-semibold text-foreground text-sm">Notifications</span>
            <span className="font-normal text-muted-foreground text-xs">
              {unseenCount > 0 ? `${cappedCount} new` : "Latest"}
            </span>
          </DropdownMenuLabel>
          <div
            className="max-h-[calc(100vh-5rem)] min-h-0 overflow-y-auto p-2 sm:max-h-[calc(min(760px,100vh-6rem)-3.25rem)]"
            ref={scrollContainerRef}
          >
            <NotificationList
              isError={notificationsQuery.isError}
              isLoading={notificationsQuery.isPending && open}
              items={items}
              onNotificationClick={handleNotificationClick}
            />
            <div className="flex h-8 items-center justify-center" ref={loadMoreRef}>
              {isFetchingNextPage ? <Spinner className="text-muted-foreground" /> : null}
            </div>
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
