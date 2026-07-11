import { useServerFn } from "@tanstack/react-start";
import { FollowableUserListDialog } from "@/components/followable-user-list-dialog";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserFollowers, getUserFollowing } from "@/server/functions/follow-functions";
import type { QueryKey } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { UserFollowsPage } from "@/server/services/follow-service";

interface ProfileFollowListDialogProps {
  hasSession: boolean;
  profileDisplayName: string;
  profileUserId: string;
  profileUsername: string;
  trigger: ReactElement;
  viewerUserId?: string;
}

interface SharedProfileFollowListDialogProps extends ProfileFollowListDialogProps {
  description: string;
  getPage: (cursor: string | null) => Promise<UserFollowsPage>;
  queryKey: QueryKey;
  title: string;
}

export function ProfileFollowersDialog(props: ProfileFollowListDialogProps) {
  const getUserFollowersFn = useServerFn(getUserFollowers);

  return (
    <ProfileFollowListDialog
      {...props}
      description={`People following ${props.profileDisplayName}.`}
      getPage={(cursor) => getUserFollowersFn({ data: { cursor: cursor ?? undefined, userId: props.profileUserId } })}
      queryKey={userQueryKeys.followers(props.profileUserId, props.viewerUserId)}
      title="Followers"
    />
  );
}

export function ProfileFollowingDialog(props: ProfileFollowListDialogProps) {
  const getUserFollowingFn = useServerFn(getUserFollowing);

  return (
    <ProfileFollowListDialog
      {...props}
      description={`People ${props.profileDisplayName} follows.`}
      getPage={(cursor) => getUserFollowingFn({ data: { cursor: cursor ?? undefined, userId: props.profileUserId } })}
      queryKey={userQueryKeys.following(props.profileUserId, props.viewerUserId)}
      title="Following"
    />
  );
}

function ProfileFollowListDialog({
  description,
  getPage,
  hasSession,
  profileUsername,
  queryKey,
  title,
  trigger,
  viewerUserId,
}: SharedProfileFollowListDialogProps) {
  return (
    <FollowableUserListDialog
      description={description}
      getInvalidationKeys={(user) => [
        userQueryKeys.profile(profileUsername, viewerUserId),
        userQueryKeys.profile(user.username, viewerUserId),
      ]}
      getPage={getPage}
      queryKey={queryKey}
      title={title}
      trigger={trigger}
      viewer={{ hasSession, userId: viewerUserId }}
    />
  );
}
