import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { cn } from "@/lib/utils";

interface ProfileHeaderProps {
  avatarUrl?: string;
  canEdit: boolean;
  className?: string;
  displayName: string;
  reviewCount: number;
  username: string;
}

export function ProfileHeader({
  avatarUrl,
  canEdit,
  className,
  displayName,
  reviewCount,
  username,
}: ProfileHeaderProps) {
  const reviewCountLabel = reviewCount === 1 ? "1 review" : `${reviewCount} reviews`;

  return (
    <header className={cn("border-border/80 border-b pb-7 lg:pb-9", className)}>
      <div className="flex min-w-0 items-center gap-5 lg:gap-6">
        <UserAvatar avatarUrl={avatarUrl} name={displayName} />
        <div className="min-w-0 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-semibold text-4xl leading-tight md:text-5xl">{displayName}</h1>
            {canEdit ? (
              <EditProfileDialog
                avatarUrl={avatarUrl}
                className="md:hidden"
                displayName={displayName}
                iconOnly
                username={username}
              />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm md:text-base">
            <span>@{username}</span>
            <span aria-hidden="true" className="text-muted-foreground/50">
              ·
            </span>
            <span>{reviewCountLabel}</span>
            {canEdit ? (
              <>
                <span aria-hidden="true" className="hidden text-muted-foreground/50 md:inline">
                  ·
                </span>
                <EditProfileDialog
                  avatarUrl={avatarUrl}
                  className="hidden md:inline-flex"
                  displayName={displayName}
                  username={username}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export function ProfileHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border-border/80 border-b pb-7 lg:pb-9", className)}>
      <div className="flex items-center gap-5 lg:gap-6">
        <div className="size-22 rounded-full bg-muted md:size-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-10 w-56 rounded-sm bg-muted md:h-13 md:w-80" />
          <div className="h-4 w-40 rounded-sm bg-muted" />
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ avatarUrl, name }: { avatarUrl?: string; name: string }) {
  const initial = name.trim().charAt(0) || "U";
  const className =
    "flex size-22 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-2xl text-muted-foreground uppercase md:size-28 md:text-4xl";

  if (avatarUrl) {
    return (
      <img
        alt={name}
        className={cn(className, "object-cover")}
        height={96}
        referrerPolicy="no-referrer"
        src={avatarUrl}
        width={96}
      />
    );
  }

  return <div className={className}>{initial}</div>;
}
