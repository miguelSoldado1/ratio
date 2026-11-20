import { useUploadFile } from "@better-upload/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/image-upload-field";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth/auth-client";
import { imageUploadHint } from "@/lib/image-upload";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { removeMyAvatar, setMyAvatar } from "@/server/functions/avatar-functions";
import { tryCatch } from "@/try-catch";
import type { UserProfile } from "@/server/services/review-service";

interface ProfilePhotoEditorProps {
  avatarObjectKey?: string;
  avatarUrl?: string;
  disabled?: boolean;
  displayName: string;
  onBusyChange?: (busy: boolean) => void;
  username: string;
}

interface ProfilePhotoState {
  avatarObjectKey: string | undefined;
  avatarUrl: string | undefined;
}

export function ProfilePhotoEditor({
  avatarObjectKey,
  avatarUrl,
  disabled = false,
  displayName,
  onBusyChange,
  username,
}: ProfilePhotoEditorProps) {
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const photoRef = useRef<ProfilePhotoState>({ avatarObjectKey, avatarUrl });
  const [photo, setPhoto] = useState<ProfilePhotoState>({ avatarObjectKey, avatarUrl });

  const setPhotoState = useCallback((nextPhoto: ProfilePhotoState) => {
    photoRef.current = nextPhoto;
    setPhoto(nextPhoto);
  }, []);

  const avatarUpload = useUploadFile({
    route: "avatar",
    onError: (error) => {
      toast.error("Couldn't upload photo", { description: error.message });
    },
  });

  const setMyAvatarFn = useServerFn(setMyAvatar);
  const setAvatarMutation = useMutation({
    mutationFn: (data: { objectKey: string }) => setMyAvatarFn({ data }),
  });

  const removeMyAvatarFn = useServerFn(removeMyAvatar);
  const removeAvatarMutation = useMutation({
    mutationFn: () => removeMyAvatarFn(),
  });

  const isRemovingPhoto = removeAvatarMutation.isPending;
  const isSavingPhoto = setAvatarMutation.isPending;
  const isPhotoBusy = avatarUpload.isPending || isSavingPhoto || isRemovingPhoto;
  const isDisabled = disabled || isPhotoBusy;
  const photoStatusLabel = getPhotoStatusLabel({
    isRemovingPhoto,
    isSavingPhoto,
    progress: avatarUpload.progress,
    uploading: avatarUpload.isPending,
  });

  useEffect(() => {
    setPhotoState({ avatarObjectKey, avatarUrl });
  }, [avatarObjectKey, avatarUrl, setPhotoState]);

  useEffect(() => {
    onBusyChange?.(isPhotoBusy);
  }, [isPhotoBusy, onBusyChange]);

  async function handlePhotoSelect(file: File) {
    const { data: uploadResult, error: uploadError } = await tryCatch(avatarUpload.uploadAsync(file));
    if (uploadError || !uploadResult.file) return;

    const nextAvatarObjectKey = uploadResult.file.objectInfo.key;

    const { data: avatarResult, error } = await tryCatch(
      setAvatarMutation.mutateAsync({ objectKey: nextAvatarObjectKey })
    );

    if (error) {
      return toast.error("Couldn't upload photo", {
        description: getErrorMessage(error, "Could not update your profile photo."),
      });
    }

    setPhotoState({ avatarObjectKey: avatarResult.avatarObjectKey, avatarUrl: avatarResult.avatarUrl });
    updateProfileAvatarCache({
      avatarObjectKey: avatarResult.avatarObjectKey,
      avatarUrl: avatarResult.avatarUrl,
      queryClient,
      username,
    });

    await session.refetch().catch(() => undefined);

    if (avatarResult.cleanupFailed) {
      toast.error("Couldn't remove old photo", { description: "The previous profile photo couldn't be deleted." });
    }
  }

  async function handleRemovePhoto() {
    if (!(photoRef.current.avatarUrl || photoRef.current.avatarObjectKey)) return;

    const { data: avatarResult, error } = await tryCatch(removeAvatarMutation.mutateAsync());

    if (error) {
      return toast.error("Couldn't remove photo", {
        description: getErrorMessage(error, "Could not remove your profile photo."),
      });
    }

    setPhotoState({ avatarObjectKey: avatarResult.avatarObjectKey, avatarUrl: avatarResult.avatarUrl });
    updateProfileAvatarCache({
      avatarObjectKey: avatarResult.avatarObjectKey,
      avatarUrl: avatarResult.avatarUrl,
      queryClient,
      username,
    });

    await session.refetch().catch(() => undefined);

    if (avatarResult.cleanupFailed) {
      toast.error("Couldn't remove old photo", { description: "The previous profile photo couldn't be deleted." });
    }
  }

  return (
    <ImageUploadField
      disabled={isDisabled}
      hasImage={Boolean(photo.avatarUrl)}
      label="Profile photo"
      onFileSelect={handlePhotoSelect}
      onRemove={handleRemovePhoto}
      preview={<UserAvatar className="size-16 text-xl" name={displayName} src={photo.avatarUrl} />}
      removeLabel="Remove photo"
      statusLabel={photoStatusLabel}
      uploadIcon={<Camera />}
      uploadLabel="Change photo"
    />
  );
}

interface GetPhotoStatusLabelParams {
  isRemovingPhoto: boolean;
  isSavingPhoto: boolean;
  progress: number;
  uploading: boolean;
}

function getPhotoStatusLabel({ isRemovingPhoto, isSavingPhoto, progress, uploading }: GetPhotoStatusLabelParams) {
  if (uploading) return `Uploading ${Math.round(progress * 100)}%`;
  if (isRemovingPhoto) return "Removing photo...";
  if (isSavingPhoto) return "Saving photo...";

  return imageUploadHint;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

interface UpdateProfileAvatarCacheParams {
  avatarObjectKey?: string;
  avatarUrl?: string;
  queryClient: ReturnType<typeof useQueryClient>;
  username: string;
}

function updateProfileAvatarCache({
  avatarObjectKey,
  avatarUrl,
  queryClient,
  username,
}: UpdateProfileAvatarCacheParams) {
  queryClient.setQueriesData<UserProfile>({ queryKey: userQueryKeys.profile(username) }, (current) => {
    if (!current) return current;

    return {
      ...current,
      user: {
        ...current.user,
        avatarObjectKey,
        avatarUrl,
      },
    };
  });
}
