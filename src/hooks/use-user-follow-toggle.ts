import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { toast } from "sonner";
import { setUserFollow } from "@/server/functions/follow-functions";
import { tryCatch } from "@/try-catch";
import type { QueryKey } from "@tanstack/react-query";
import type { UserProfile } from "@/server/services/review-service";

interface UseUserFollowToggleParams {
  enabled: boolean;
  queryKey: QueryKey;
}

export function useSetUserFollowMutation() {
  const setUserFollowFn = useServerFn(setUserFollow);

  return useMutation({ mutationFn: setUserFollowFn });
}

export function useUserFollowToggle({ enabled, queryKey }: UseUserFollowToggleParams) {
  const queryClient = useQueryClient();
  const setUserFollowMutation = useSetUserFollowMutation();

  const toggleUserFollow = useCallback(
    async (userId: string, following: boolean) => {
      if (!enabled) {
        return false;
      }

      const previousProfile = queryClient.getQueryData<UserProfile>(queryKey);

      queryClient.setQueryData<UserProfile>(queryKey, (profile) => {
        if (!(profile && profile.user.id === userId)) return profile;

        let followersDelta = 0;
        if (profile.user.followedByViewer !== following) {
          followersDelta = following ? 1 : -1;
        }

        return {
          ...profile,
          followersCount: Math.max(0, profile.followersCount + followersDelta),
          user: { ...profile.user, followedByViewer: following },
        };
      });

      const { data: updatedProfile, error } = await tryCatch(
        setUserFollowMutation.mutateAsync({ data: { following, userId } })
      );

      if (error) {
        queryClient.setQueryData(queryKey, previousProfile);
        toast.error("Error", {
          description: error instanceof Error ? error.message : "Could not update follow status",
        });
        return false;
      }

      queryClient.setQueryData<UserProfile>(queryKey, (profile) => {
        if (!(profile && profile.user.id === updatedProfile.userId)) return profile;

        return {
          ...profile,
          followersCount: updatedProfile.followersCount,
          followingCount: updatedProfile.followingCount,
          user: { ...profile.user, followedByViewer: updatedProfile.followedByViewer },
        };
      });

      await queryClient.invalidateQueries({ queryKey });

      return true;
    },
    [enabled, queryClient, queryKey, setUserFollowMutation]
  );

  return { isUserFollowPending: setUserFollowMutation.isPending, toggleUserFollow };
}
