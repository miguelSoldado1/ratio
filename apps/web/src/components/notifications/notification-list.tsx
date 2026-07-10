import { EmptyState } from "@/components/empty-state";
import { InlineError } from "@/components/inline-error";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { NotificationVisual } from "./notification-visual";
import type { NotificationItem } from "@/server/services/notification-service";

interface NotificationListProps {
  isError: boolean;
  isLoading: boolean;
  items: NotificationItem[];
  onNotificationClick: (item: NotificationItem) => void;
  variant?: "menu" | "list";
}

interface NotificationGroup {
  items: NotificationItem[];
  label: "Last 30 days" | "Older";
}

const recentNotificationWindowMs = 30 * 24 * 60 * 60 * 1000;

export function NotificationList({
  isError,
  isLoading,
  items,
  onNotificationClick,
  variant = "menu",
}: NotificationListProps) {
  if (isLoading) {
    return <NotificationReviewSkeletons variant={variant} />;
  }

  if (isError) {
    return (
      <InlineError
        align="center"
        className="px-3 text-muted-foreground"
        description="Could not load notifications right now."
        title="Notifications unavailable"
      />
    );
  }

  if (items.length === 0) {
    return <EmptyState align="center" className="px-3 text-muted-foreground" title="No activity yet" />;
  }

  const groups = groupNotifications(items);
  const showGroupLabels = groups.length > 1;

  return (
    <div className="flex flex-col">
      {groups.map((group, index) => (
        <div className="flex flex-col" key={group.label}>
          {showGroupLabels ? (
            <p
              className={cn(
                "px-3 pb-1.5 font-semibold text-2xs text-foreground/75 uppercase tracking-[0.08em]",
                index === 0 ? "pt-2" : "pt-3"
              )}
            >
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => (
            <NotificationRow item={item} key={item.key} onClick={() => onNotificationClick(item)} variant={variant} />
          ))}
        </div>
      ))}
    </div>
  );
}

function NotificationReviewSkeletons({ variant }: { variant: "menu" | "list" }) {
  const count = variant === "list" ? 9 : 7;

  return (
    <div aria-busy="true" aria-label="Loading notifications" className="flex flex-col" role="status">
      <span className="sr-only">Loading notifications</span>
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <NotificationReviewSkeleton index={index} key={index} />
      ))}
    </div>
  );
}

function NotificationReviewSkeleton({ index }: { index: number }) {
  const primaryWidth = getNotificationSkeletonPrimaryWidth(index);
  const metaWidth = index % 3 === 0 ? "w-28" : "w-36";

  return (
    <article
      className={
        "relative flex w-full items-start gap-3 rounded-xl px-3 py-3.5 after:absolute after:right-3 after:bottom-0 after:left-16 after:h-px after:bg-border/55 last:after:hidden sm:py-3"
      }
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/50">
        <Skeleton className="size-9 rounded-full bg-muted/80" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <Skeleton className={cn("h-4.5 max-w-full bg-muted/85", primaryWidth)} />
        <div className="mt-2 flex items-center gap-1.5">
          <Skeleton className={cn("h-3.5 bg-muted/70", metaWidth)} />
          <Skeleton className="size-1 rounded-full bg-muted/70" />
          <Skeleton className="h-3.5 w-6 bg-muted/70" />
        </div>
      </div>
    </article>
  );
}

function getNotificationSkeletonPrimaryWidth(index: number) {
  if (index % 4 === 2) return "w-[92%]";
  if (index % 3 === 1) return "w-56";
  return "w-72";
}

interface NotificationRowProps {
  item: NotificationItem;
  onClick: () => void;
  variant: "menu" | "list";
}

function NotificationRow({ item, onClick, variant }: NotificationRowProps) {
  const content = <NotificationRowContent item={item} />;
  const className = cn(
    "group/notification relative flex w-full items-start gap-3 rounded-xl px-3 py-3.5 text-left transition-[background-color,transform] after:absolute after:right-3 after:bottom-0 after:left-16 after:h-px after:bg-border/55 last:after:hidden focus:bg-muted/70 focus:outline-none active:scale-[0.99] sm:py-3",
    item.seen ? "text-muted-foreground" : "bg-muted/45 text-foreground ring-1 ring-border/40 after:hidden"
  );

  if (variant === "list") {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return (
    <DropdownMenuItem className={className} onClick={onClick}>
      {content}
    </DropdownMenuItem>
  );
}

function NotificationRowContent({ item }: { item: NotificationItem }) {
  return (
    <>
      {item.seen ? null : <span className="absolute top-3.5 bottom-3.5 left-1 w-0.5 rounded-full bg-foreground/35" />}
      <NotificationVisual item={item} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="line-clamp-2 whitespace-normal font-medium text-foreground/90 text-sm leading-snug">
          <NotificationText item={item} />
        </p>
        <p className="mt-1 truncate text-muted-foreground text-xs">{formatNotificationMeta(item)}</p>
      </div>
    </>
  );
}

function NotificationText({ item }: { item: NotificationItem }) {
  if (item.type === "user_followed") {
    return (
      <>
        <NotificationActorName name={getActorDisplayName(item.actor)} /> followed you
      </>
    );
  }

  const actorNames = item.actors.map(getActorDisplayName);

  if (item.actorCount === 1) {
    return (
      <>
        <NotificationActorName name={actorNames[0]} /> liked your review
      </>
    );
  }

  if (item.actorCount === 2) {
    return (
      <>
        <NotificationActorName name={actorNames[0]} /> and <NotificationActorName name={actorNames[1]} /> liked your
        review
      </>
    );
  }

  if (item.actorCount === 3) {
    return (
      <>
        <NotificationActorName name={actorNames[0]} />, <NotificationActorName name={actorNames[1]} /> and{" "}
        <NotificationActorName name={actorNames[2]} /> liked your review
      </>
    );
  }

  return (
    <>
      <NotificationActorName name={actorNames[0]} />, <NotificationActorName name={actorNames[1]} /> and{" "}
      {item.actorCount - 2} others liked your review
    </>
  );
}

function NotificationActorName({ name }: { name: string }) {
  return <span className="font-semibold text-foreground">{name}</span>;
}

function getActorDisplayName(actor: { displayUsername: string | null; username: string }) {
  return actor.displayUsername ?? actor.username;
}

function formatNotificationMeta(item: NotificationItem) {
  const time = formatRelativeTime(item.latestCreatedAt);

  if (item.type === "review_liked") {
    return `${item.albumTitle} · ${time}`;
  }

  return `@${item.actor.username} · ${time}`;
}

function groupNotifications(items: NotificationItem[]): NotificationGroup[] {
  const now = Date.now();
  const recentItems: NotificationItem[] = [];
  const olderItems: NotificationItem[] = [];

  for (const item of items) {
    const createdAt = new Date(item.latestCreatedAt);
    const targetItems = now - createdAt.getTime() <= recentNotificationWindowMs ? recentItems : olderItems;
    targetItems.push(item);
  }

  return [
    { items: recentItems, label: "Last 30 days" as const },
    { items: olderItems, label: "Older" as const },
  ].filter((group): group is NotificationGroup => group.items.length > 0);
}
