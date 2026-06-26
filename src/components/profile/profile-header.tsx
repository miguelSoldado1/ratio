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
  return (
    <header className={cn("border-border/80 border-b pb-7 lg:pb-9", className)}>
      <div className="grid w-full min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-5 md:grid-cols-[7rem_minmax(0,1fr)] lg:gap-6">
        <UserAvatar
          className="size-18 text-xl sm:size-22 sm:text-2xl md:size-28 md:text-4xl"
          height={96}
          name={profile.displayName}
          src={profile.avatarUrl}
        />
        <div className="min-w-0 overflow-hidden pt-1">
          <h1 className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-3xl leading-tight sm:text-4xl md:text-5xl">
            {profile.displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm md:text-base">
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
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 text-sm sm:text-base">
              <ProfileStat
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
                      label={stats.followersCount === 1 ? "follower" : "followers"}
                      value={abbreviateCount(stats.followersCount)}
                    />
                  }
                  viewerUserId={followLists.viewerUserId}
                />
              ) : (
                <ProfileStat
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
                  trigger={<ProfileStatButton label="following" value={abbreviateCount(stats.followingCount)} />}
                  viewerUserId={followLists.viewerUserId}
                />
              ) : (
                <ProfileStat label="following" value={abbreviateCount(stats.followingCount)} />
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
      </div>
    </header>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
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
