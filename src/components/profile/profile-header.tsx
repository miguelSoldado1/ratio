import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { ProfileFollowersDialog, ProfileFollowingDialog } from "@/components/profile/profile-follow-list-dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { abbreviateCount, cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import type { UserProfile } from "@/server/services/review-service";

type ProfileHeaderUser = UserProfile["user"];

interface ProfileHeaderStats {
  followersCount: number;
  followingCount: number;
  reviewCount: number;
}

interface ProfileHeaderFollowAction {
  isPending: boolean;
  onToggle: (following: boolean) => Promise<boolean> | boolean;
}

interface ProfileHeaderFollowLists {
  hasSession: boolean;
  viewerUserId?: string;
}

interface ProfileHeaderProps {
  className?: string;
  followAction?: ProfileHeaderFollowAction;
  followLists?: ProfileHeaderFollowLists;
  profile: ProfileHeaderUser;
  stats: ProfileHeaderStats;
}

export function ProfileHeader({ className, followAction, followLists, profile, stats }: ProfileHeaderProps) {
  const statItemClassName =
    "min-w-0 flex-col items-center gap-0.5 text-center sm:flex-row sm:items-baseline sm:gap-1.5 sm:text-left";

  return (
    <header className={cn("border-border/80 border-b pb-6 sm:pb-7 lg:pb-9", className)}>
      <div className="flex w-full min-w-0 flex-col items-center text-center sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-5 sm:text-left md:grid-cols-[7rem_minmax(0,1fr)] lg:gap-x-6">
        <UserAvatar
          className="size-18 text-xl sm:size-22 sm:text-2xl md:size-28 md:text-4xl"
          height={96}
          name={profile.displayName}
          src={profile.avatarUrl}
        />
        <div className="mt-2 min-w-0 overflow-hidden sm:mt-0 sm:pt-1">
          <h1 className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-2xl leading-tight sm:text-4xl md:text-5xl">
            {profile.displayName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-muted-foreground text-sm sm:justify-start md:text-base">
            <span>@{profile.username}</span>
            {profile.canEdit ? (
              <EditProfileDialog
                avatarObjectKey={profile.avatarObjectKey}
                avatarUrl={profile.avatarUrl}
                displayName={profile.displayName}
                username={profile.username}
              />
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex w-full flex-col gap-2.5 sm:col-span-1 sm:col-start-2 sm:mt-4 sm:flex-row sm:items-center sm:gap-3">
          <div className="grid min-w-0 grid-cols-3 gap-4 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 sm:text-base">
            <ProfileStat
              className={statItemClassName}
              label={stats.reviewCount === 1 ? "review" : "reviews"}
              value={abbreviateCount(stats.reviewCount)}
            />
            {followLists ? (
              <ProfileFollowersDialog
                hasSession={followLists.hasSession}
                profileDisplayName={profile.displayName}
                profileUserId={profile.id}
                profileUsername={profile.username}
                trigger={
                  <ProfileStatButton
                    className={statItemClassName}
                    label={stats.followersCount === 1 ? "follower" : "followers"}
                    value={abbreviateCount(stats.followersCount)}
                  />
                }
                viewerUserId={followLists.viewerUserId}
              />
            ) : (
              <ProfileStat
                className={statItemClassName}
                label={stats.followersCount === 1 ? "follower" : "followers"}
                value={abbreviateCount(stats.followersCount)}
              />
            )}
            {followLists ? (
              <ProfileFollowingDialog
                hasSession={followLists.hasSession}
                profileDisplayName={profile.displayName}
                profileUserId={profile.id}
                profileUsername={profile.username}
                trigger={
                  <ProfileStatButton
                    className={statItemClassName}
                    label="following"
                    value={abbreviateCount(stats.followingCount)}
                  />
                }
                viewerUserId={followLists.viewerUserId}
              />
            ) : (
              <ProfileStat
                className={statItemClassName}
                label="following"
                value={abbreviateCount(stats.followingCount)}
              />
            )}
          </div>
          {followAction ? (
            <Button
              aria-pressed={profile.followedByViewer}
              className="h-9 w-full min-w-28 rounded-full px-5 text-sm [transition:background-color_150ms_ease,color_150ms_ease,border-color_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:ml-auto sm:w-auto md:h-10 md:min-w-32 md:px-6"
              disabled={followAction.isPending}
              onClick={() => followAction.onToggle(!profile.followedByViewer)}
              size="sm"
              type="button"
              variant={profile.followedByViewer ? "secondary" : "default"}
            >
              {profile.followedByViewer ? "Following" : "Follow"}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ProfileStat({ className, label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <ProfileStatContent label={label} value={value} />
    </div>
  );
}

function ProfileStatButton({
  className,
  label,
  type = "button",
  value,
  ...props
}: ComponentProps<"button"> & {
  label: string;
  value: string;
}) {
  return (
    <button
      className={cn(
        "flex items-baseline gap-1.5 rounded-md text-left transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.98]",
        className
      )}
      type={type}
      {...props}
    >
      <ProfileStatContent label={label} value={value} />
    </button>
  );
}

function ProfileStatContent({ label, value }: { label: string; value: string }) {
  const content = (
    <>
      <span className="font-medium text-muted-foreground text-sm sm:text-base">{label}</span>
      <span className="order-first font-semibold text-foreground tabular-nums">{value}</span>
    </>
  );

  return content;
}

export function ProfileHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border-border/80 border-b pb-6 sm:pb-7 lg:pb-9", className)}>
      <div className="flex flex-col items-center sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-5 md:grid-cols-[7rem_minmax(0,1fr)] lg:gap-x-6">
        <div className="size-18 rounded-full bg-muted sm:size-22 md:size-28" />
        <div className="mt-2 flex min-w-0 flex-1 flex-col items-center gap-2 sm:mt-0 sm:items-start">
          <div className="h-8 w-42 rounded-sm bg-muted sm:h-10 sm:w-56 md:h-13 md:w-80" />
          <div className="h-4 w-40 rounded-sm bg-muted" />
        </div>
        <div className="mt-4 grid w-full grid-cols-3 gap-4 sm:col-span-1 sm:col-start-2 sm:mt-4 sm:flex">
          <div className="h-9 rounded-sm bg-muted sm:h-5 sm:w-20" />
          <div className="h-9 rounded-sm bg-muted sm:h-5 sm:w-22" />
          <div className="h-9 rounded-sm bg-muted sm:h-5 sm:w-22" />
        </div>
      </div>
    </div>
  );
}
