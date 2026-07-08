import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileBanUserDialog } from "@/components/profile/profile-ban-user-dialog";
import { Button } from "@/components/ui/button";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { useUserFollowToggle } from "@/hooks/use-user-follow-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { albumQueryKeys, feedQueryKeys, reviewQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import type { UserProfile } from "@/server/services/review-service";

type ProfileActionUser = UserProfile["user"];

export interface ProfileActionViewer {
  hasSession: boolean;
  userId?: string;
}

interface ProfileActionsProps {
  onAuthRequired: () => void;
  profile: ProfileActionUser;
  viewer: ProfileActionViewer;
}

export function ProfileActions({ onAuthRequired, profile, viewer }: ProfileActionsProps) {
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [isBanPending, setIsBanPending] = useState(false);
  const queryClient = useQueryClient();
  const { adminModeEnabled, isAdmin } = useAdminMode();
  const { isUserFollowPending, toggleUserFollow } = useUserFollowToggle({
    enabled: viewer.hasSession,
    queryKey: userQueryKeys.profile(profile.username, viewer.userId),
  });

  const showFollowAction = !profile.canEdit;
  const showAdminAction = isAdmin && adminModeEnabled && profile.id !== viewer.userId;

  if (!(showFollowAction || showAdminAction)) return null;

  async function handleFollowClick() {
    if (!viewer.hasSession) {
      return onAuthRequired();
    }

    await toggleUserFollow(profile.id, !profile.followedByViewer);
  }

  async function handleBanClick(banned: boolean) {
    setIsBanPending(true);

    if (banned) {
      const { error } = await authClient.admin.banUser({ userId: profile.id });
      if (error) {
        setIsBanPending(false);
        return toast.error("Ban failed", { description: error.message ?? "Could not update this user." });
      }
    } else {
      const { error } = await authClient.admin.unbanUser({ userId: profile.id });
      if (error) {
        setIsBanPending(false);
        return toast.error("Unban failed", { description: error.message ?? "Could not update this user." });
      }
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: albumQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: feedQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: userQueryKeys.all() }),
    ]);

    setIsBanPending(false);
    setBanDialogOpen(false);
  }

  return (
    <>
      <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
        {showFollowAction ? (
          <Button
            aria-pressed={profile.followedByViewer}
            className="h-9 w-full min-w-28 px-5 text-sm sm:w-auto md:h-10 md:min-w-32 md:px-6"
            disabled={isUserFollowPending}
            onClick={handleFollowClick}
            shape="pill"
            size="sm"
            type="button"
            variant={profile.followedByViewer ? "secondary" : "default"}
          >
            {profile.followedByViewer ? "Following" : "Follow"}
          </Button>
        ) : null}
        {showAdminAction ? (
          <Button
            aria-pressed={profile.banned}
            className="h-9 w-full min-w-28 px-5 text-sm sm:w-auto md:h-10 md:min-w-32 md:px-6"
            disabled={isBanPending}
            onClick={() => (profile.banned ? handleBanClick(false) : setBanDialogOpen(true))}
            shape="pill"
            size="sm"
            type="button"
            variant={profile.banned ? "outline" : "destructive"}
          >
            {profile.banned ? "Unban user" : "Ban user"}
          </Button>
        ) : null}
      </div>
      <ProfileBanUserDialog
        isPending={isBanPending}
        onBan={() => handleBanClick(true)}
        onOpenChange={setBanDialogOpen}
        open={banDialogOpen}
      />
    </>
  );
}
