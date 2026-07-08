import { useUploadFile } from "@better-upload/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth/auth-client";
import { avatarAccept } from "@/lib/avatar";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { removeMyAvatar, setMyAvatar } from "@/server/functions/avatar-functions";
import { tryCatch } from "@/try-catch";
import type { ChangeEvent } from "react";
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
  const photoInputRef = useRef<HTMLInputElement>(null);
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

  async function handlePhotoInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    const { data: uploadResult, error: uploadError } = await tryCatch(avatarUpload.uploadAsync(file));
    if (uploadError) return;

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
    <div className="flex items-center justify-between gap-4 border-border/80 border-b pb-5">
      <div className="flex min-w-0 items-center gap-4">
        <UserAvatar className="size-16 text-xl" name={displayName} src={photo.avatarUrl} />
        <div className="min-w-0">
          <p className="font-medium text-sm">Profile photo</p>
          <p className="mt-1 text-muted-foreground text-sm">{photoStatusLabel}</p>
        </div>
      </div>
      <input
        accept={avatarAccept}
        aria-label="Profile photo"
        className="sr-only"
        disabled={isDisabled}
        onChange={handlePhotoInputChange}
        ref={photoInputRef}
        type="file"
      />
      <div className="flex shrink-0 items-center gap-2">
        {photo.avatarUrl ? (
          <Button
            aria-label="Remove photo"
            disabled={isDisabled}
            onClick={handleRemovePhoto}
            size="icon-sm"
            title="Remove photo"
            type="button"
            variant="outline"
          >
            <Trash2 />
          </Button>
        ) : null}
        <Button
          aria-label="Change photo"
          className="shrink-0"
          disabled={isDisabled}
          onClick={() => photoInputRef.current?.click()}
          size="icon-sm"
          title="Change photo"
          type="button"
          variant="outline"
        >
          <Camera />
        </Button>
      </div>
    </div>
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

  return "JPG, PNG, WebP, or AVIF up to 2 MB.";
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
