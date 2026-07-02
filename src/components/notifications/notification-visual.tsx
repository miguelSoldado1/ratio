import { Heart, UserPlus } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/server/services/notification-service";

interface NotificationVisualProps {
  item: NotificationItem;
}

export function NotificationVisual({ item }: NotificationVisualProps) {
  if (item.type === "review_liked" && item.actors.length > 1) {
    return <NotificationActorStack item={item} />;
  }

  const actor = item.type === "user_followed" ? item.actor : item.actors[0];
  const displayName = actor?.displayUsername ?? actor?.username ?? "User";

  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/60">
      <UserAvatar className="size-9 text-[11px]" height={36} name={displayName} src={actor?.avatarUrl ?? undefined} />
      <NotificationTypeBadge type={item.type} />
    </span>
  );
}

interface NotificationActorStackProps {
  item: Extract<NotificationItem, { type: "review_liked" }>;
}

function NotificationActorStack({ item }: NotificationActorStackProps) {
  const actors = item.actors.slice(0, 2);

  return (
    <span className="relative h-10 w-11 shrink-0">
      {actors.map((actor, index) => {
        const displayName = actor.displayUsername ?? actor.username;

        return (
          <UserAvatar
            className={cn(
              "absolute size-7 bg-muted text-[10px] ring-2 ring-popover",
              index === 0 ? "top-0 left-0" : "right-0 bottom-0"
            )}
            height={28}
            key={actor.id}
            name={displayName}
            src={actor.avatarUrl ?? undefined}
          />
        );
      })}
      <NotificationTypeBadge type="review_liked" />
    </span>
  );
}

interface NotificationTypeBadgeProps {
  type: NotificationItem["type"];
}

function NotificationTypeBadge({ type }: NotificationTypeBadgeProps) {
  const Icon = type === "review_liked" ? Heart : UserPlus;

  return (
    <span className="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm ring-2 ring-popover">
      <Icon className="size-3 stroke-[2.4]" />
    </span>
  );
}
