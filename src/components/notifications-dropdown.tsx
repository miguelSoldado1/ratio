import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import {
  getNotifications,
  getUnseenNotificationCount,
  markNotificationsSeen,
} from "@/server/functions/notification-functions";
import { tryCatch } from "@/try-catch";
import type { InfiniteData } from "@tanstack/react-query";
import type { RefObject } from "react";
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
  const isMobile = useMediaQuery("(max-width: 639px)");
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

  function handleMobileTriggerClick() {
    setOpen(true);
  }

  function handleCloseButtonClick() {
    handleOpenChange(false).catch(() => undefined);
  }

  async function handleNotificationClick(item: NotificationItem) {
    if (item.type === "review_liked") {
      await navigate({
        params: { albumId: item.albumId, reviewCode: item.reviewCode },
        to: "/album/$albumId/r/$reviewCode",
      });
      return;
    }

    await navigate({ params: { username: item.actor.username.toLowerCase() }, to: "/user/$username" });
  }

  async function handleMobileNotificationClick(item: NotificationItem) {
    await handleOpenChange(false);
    await handleNotificationClick(item);
  }

  if (isMobile) {
    return (
      <>
        <Button
          aria-label={unseenCount > 0 ? `Open notifications, ${unseenCount} unseen` : "Open notifications"}
          className="relative size-8 rounded-full px-0 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97]"
          onClick={handleMobileTriggerClick}
          type="button"
          variant="ghost"
        >
          <Bell />
          <NotificationCountBadge count={cappedCount} unseenCount={unseenCount} />
        </Button>
        <Dialog onOpenChange={handleOpenChange} open={open}>
          <DialogContent
            className="top-0 left-0 flex h-svh max-h-svh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none! p-0 sm:hidden"
            showCloseButton={false}
          >
            <DialogHeader className="flex-row items-center gap-3 border-border/70 border-b p-3 text-left">
              <Button
                aria-label="Close notifications"
                className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                onClick={handleCloseButtonClick}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ArrowLeft />
              </Button>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-sm">Notifications</DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">
                  {unseenCount > 0 ? `${cappedCount} new` : "Recent activity"}
                </DialogDescription>
              </div>
            </DialogHeader>
            <NotificationsPanel
              isError={notificationsQuery.isError}
              isFetchingNextPage={isFetchingNextPage}
              isLoading={notificationsQuery.isPending && open}
              items={items}
              loadMoreRef={loadMoreRef}
              mobile
              onNotificationClick={handleMobileNotificationClick}
              scrollContainerRef={scrollContainerRef}
              variant="list"
            />
          </DialogContent>
        </Dialog>
      </>
    );
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
        <NotificationCountBadge count={cappedCount} unseenCount={unseenCount} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-md max-w-md overflow-hidden rounded-3xl p-0 sm:max-h-[min(760px,calc(100vh-6rem))]"
        sideOffset={8}
      >
        <DropdownMenuGroup className="flex max-h-[inherit] min-h-0 flex-col">
          <DropdownMenuLabel className="flex items-center justify-between border-border/60 border-b px-4 py-3">
            <span className="font-semibold text-foreground text-sm">Notifications</span>
            <span className="font-normal text-muted-foreground text-xs">
              {unseenCount > 0 ? `${cappedCount} new` : "Recent"}
            </span>
          </DropdownMenuLabel>
          <NotificationsPanel
            isError={notificationsQuery.isError}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={notificationsQuery.isPending && open}
            items={items}
            loadMoreRef={loadMoreRef}
            onNotificationClick={handleNotificationClick}
            scrollContainerRef={scrollContainerRef}
            variant="menu"
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NotificationCountBadgeProps {
  count: string;
  unseenCount: number;
}

function NotificationCountBadge({ count, unseenCount }: NotificationCountBadgeProps) {
  if (unseenCount === 0) {
    return null;
  }

  return (
    <Badge
      className="absolute -top-1 -right-1 h-4 min-w-4 border-background bg-popover px-1 text-[10px] text-foreground shadow-sm ring-1 ring-border/70"
      variant="outline"
    >
      {count}
    </Badge>
  );
}

interface NotificationsPanelProps {
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  items: NotificationItem[];
  loadMoreRef: RefObject<HTMLDivElement | null>;
  mobile?: boolean;
  onNotificationClick: (item: NotificationItem) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  variant: "list" | "menu";
}

function NotificationsPanel({
  isError,
  isFetchingNextPage,
  isLoading,
  items,
  loadMoreRef,
  mobile = false,
  onNotificationClick,
  scrollContainerRef,
  variant,
}: NotificationsPanelProps) {
  return (
    <div
      className={cn(
        "min-h-0 overflow-y-auto p-2",
        mobile ? "max-h-none flex-1" : "max-h-[calc(min(760px,100vh-6rem)-3.25rem)]"
      )}
      ref={scrollContainerRef}
    >
      <NotificationList
        isError={isError}
        isLoading={isLoading}
        items={items}
        onNotificationClick={onNotificationClick}
        variant={variant}
      />
      <div className="flex h-8 items-center justify-center" ref={loadMoreRef}>
        {isFetchingNextPage ? <Spinner className="text-muted-foreground" /> : null}
      </div>
    </div>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQueryList.matches);

    handleChange();
    mediaQueryList.addEventListener("change", handleChange);

    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
