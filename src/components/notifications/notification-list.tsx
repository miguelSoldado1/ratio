import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { NotificationVisual } from "./notification-visual";
import type { NotificationItem } from "@/server/services/notification-service";

interface NotificationListProps {
  isError: boolean;
  isLoading: boolean;
  items: NotificationItem[];
  onNotificationClick: (item: NotificationItem) => void;
}

export function NotificationList({ isError, isLoading, items, onNotificationClick }: NotificationListProps) {
  if (isLoading) {
    return <NotificationStateMessage label="Loading notifications..." />;
  }

  if (isError) {
    return <NotificationStateMessage label="Notifications unavailable" />;
  }

  if (items.length === 0) {
    return <NotificationStateMessage label="No activity yet" />;
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <DropdownMenuItem
          className={cn(
            "group/notification relative items-start gap-3 rounded-2xl px-3 py-3.5 transition-[background-color,transform] focus:bg-muted/70 active:scale-[0.99] sm:py-3",
            item.seen ? "text-muted-foreground" : "bg-muted/45 text-foreground shadow-sm ring-1 ring-border/40"
          )}
          key={item.key}
          onClick={() => onNotificationClick(item)}
        >
          {item.seen ? null : (
            <span className="absolute top-3.5 bottom-3.5 left-1 w-0.5 rounded-full bg-foreground/35" />
          )}
          <NotificationVisual item={item} />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="line-clamp-2 whitespace-normal font-medium text-foreground/90 text-sm leading-snug">
              <NotificationText item={item} />
            </p>
            <p className="mt-1 truncate text-muted-foreground text-xs">{formatNotificationMeta(item)}</p>
          </div>
        </DropdownMenuItem>
      ))}
    </div>
  );
}

interface NotificationStateMessageProps {
  label: string;
}

function NotificationStateMessage({ label }: NotificationStateMessageProps) {
  return <p className="px-3 py-8 text-center text-muted-foreground text-sm">{label}</p>;
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
