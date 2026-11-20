import { useUploadFile } from "@better-upload/client";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { removeMyAvatar, setMyAvatar } from "@/server/functions/avatar-functions";
import { tryCatch } from "@/try-catch";
import type { AvatarMutationResult } from "@/server/services/avatar-service";

export function useProfilePhoto() {
  const avatarUpload = useUploadFile({
    route: "avatar",
    onError: (error) => {
      toast.error("Couldn't upload photo", { description: error.message });
    },
  });

  const setMyAvatarFn = useServerFn(setMyAvatar);
  const setAvatarMutation = useMutation({ mutationFn: setMyAvatarFn });

  const removeMyAvatarFn = useServerFn(removeMyAvatar);
  const removeAvatarMutation = useMutation({ mutationFn: () => removeMyAvatarFn() });

  async function uploadPhoto(file: File) {
    const { data: uploadResult, error: uploadError } = await tryCatch(avatarUpload.uploadAsync(file));
    if (uploadError || !uploadResult.file) return null;

    const { data: avatarResult, error } = await tryCatch(
      setAvatarMutation.mutateAsync({ data: { objectKey: uploadResult.file.objectInfo.key } })
    );

    if (error) {
      toast.error("Couldn't upload photo", { description: getErrorMessage(error) });
      return null;
    }

    return warnOnCleanupFailure(avatarResult);
  }

  async function removePhoto() {
    const { data: avatarResult, error } = await tryCatch(removeAvatarMutation.mutateAsync());

    if (error) {
      toast.error("Couldn't remove photo", { description: getErrorMessage(error) });
      return null;
    }

    return warnOnCleanupFailure(avatarResult);
  }

  return {
    isPending: avatarUpload.isPending || setAvatarMutation.isPending || removeAvatarMutation.isPending,
    removePhoto,
    statusLabel: getPhotoStatusLabel({
      isRemoving: removeAvatarMutation.isPending,
      isSaving: setAvatarMutation.isPending,
      progress: avatarUpload.progress,
      uploading: avatarUpload.isPending,
    }),
    uploadPhoto,
  };
}

function warnOnCleanupFailure(avatarResult: AvatarMutationResult) {
  if (avatarResult.cleanupFailed) {
    toast.error("Couldn't remove old photo", { description: "The previous profile photo couldn't be deleted." });
  }

  return avatarResult;
}

interface GetPhotoStatusLabelParams {
  isRemoving: boolean;
  isSaving: boolean;
  progress: number;
  uploading: boolean;
}

function getPhotoStatusLabel({ isRemoving, isSaving, progress, uploading }: GetPhotoStatusLabelParams) {
  if (uploading) return `Uploading ${Math.round(progress * 100)}%`;
  if (isRemoving) return "Removing photo...";
  if (isSaving) return "Saving photo...";

  return;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
