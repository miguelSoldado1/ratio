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
      <div className="grid w-full min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-5 md:grid-cols-[7rem_minmax(0,1fr)] lg:gap-6">
        <UserAvatar avatarUrl={avatarUrl} name={displayName} />
        <div className="min-w-0 overflow-hidden pt-1">
          <h1 className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-3xl leading-tight sm:text-4xl md:text-5xl">
            {displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm md:text-base">
            <span>@{username}</span>·<span>{reviewCountLabel}</span>
            {canEdit ? <EditProfileDialog avatarUrl={avatarUrl} displayName={displayName} username={username} /> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export function ProfileHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border-border/80 border-b pb-7 lg:pb-9", className)}>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-5 md:grid-cols-[7rem_minmax(0,1fr)] lg:gap-6">
        <div className="size-18 rounded-full bg-muted sm:size-22 md:size-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-9 w-48 rounded-sm bg-muted sm:h-10 sm:w-56 md:h-13 md:w-80" />
          <div className="h-4 w-40 rounded-sm bg-muted" />
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ avatarUrl, name }: { avatarUrl?: string; name: string }) {
  const initial = name.trim().charAt(0) || "U";
  const className =
    "flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-xl text-muted-foreground uppercase sm:size-22 sm:text-2xl md:size-28 md:text-4xl";

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
