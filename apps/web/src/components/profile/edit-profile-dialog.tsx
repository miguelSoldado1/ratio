import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfilePhotoPicker } from "@/components/profile/profile-photo-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useProfilePhoto } from "@/hooks/use-profile-photo";
import { authClient } from "@/lib/auth/auth-client";
import {
  displayUsernameMaxLength,
  displayUsernameUnavailableMessage,
  getDisplayUsernameLength,
} from "@/lib/auth/profile-identity";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import {
  isUsernameFormatValid,
  normalizeUsername,
  usernameUnavailableMessage,
} from "@/lib/users/username-policy.shared";
import { cn } from "@/lib/utils";
import type { FormEvent } from "react";
import type { UserProfile } from "@/server/services/review-service";

const fieldIds = {
  displayUsername: "profile-display-username",
  displayUsernameDescription: "profile-display-username-description",
  displayUsernameError: "profile-display-username-error",
  formError: "profile-form-error",
  username: "profile-username",
  usernameDescription: "profile-username-description",
  usernameError: "profile-username-error",
  usernameWarning: "profile-username-warning",
} as const;

interface ProfileFormErrors {
  displayUsername?: string;
  form?: string;
  username?: string;
}

interface EditProfileDialogProps {
  avatarUrl?: string;
  className?: string;
  displayName: string;
  username: string;
}

export function EditProfileDialog({ avatarUrl, className, displayName, username }: EditProfileDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const profilePhoto = useProfilePhoto();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ displayUsername: displayName, username });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [photoFile, setPhotoFile] = useState<File | undefined>(undefined);
  const [removePhoto, setRemovePhoto] = useState(false);

  const isUsernameChanged = form.username.trim().toLowerCase() !== username.toLowerCase();

  useEffect(() => {
    if (!open) return;
    setForm({ displayUsername: displayName, username });
    setErrors({});
  }, [displayName, open, username]);

  useEffect(() => {
    if (!open) return;
    setPhotoFile(undefined);
    setRemovePhoto(false);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextDisplayUsername = form.displayUsername.trim();
    const nextUsername = normalizeUsername(form.username);

    const nextErrors = getProfileFormErrors({ displayUsername: nextDisplayUsername, username: nextUsername });
    if (nextErrors) {
      return setErrors(nextErrors);
    }

    const currentUsername = username.toLowerCase();
    const hasDetailsChanges = nextDisplayUsername !== displayName || nextUsername !== currentUsername;
    const hasPhotoChange = Boolean(photoFile) || (removePhoto && Boolean(avatarUrl));
    if (!(hasDetailsChanges || hasPhotoChange)) {
      return setOpen(false);
    }

    const hasUsernameChange = nextUsername !== currentUsername;

    setIsSaving(true);
    const isDetailsSaved =
      !hasDetailsChanges || (await saveDetails({ displayUsername: nextDisplayUsername, username: nextUsername }));

    if (isDetailsSaved && hasUsernameChange) {
      await navigate({ params: { username: nextUsername }, to: "/user/$username" });
    }

    const isSaved =
      isDetailsSaved && (!hasPhotoChange || (await savePhotoChange(hasUsernameChange ? nextUsername : username)));
    setIsSaving(false);

    if (isSaved) setOpen(false);
  }

  async function savePhotoChange(profileUsername: string) {
    const avatarResult = photoFile ? await profilePhoto.uploadPhoto(photoFile) : await profilePhoto.removePhoto();
    if (!avatarResult) return false;

    setPhotoFile(undefined);
    setRemovePhoto(false);
    updateProfileAvatarCache({
      avatarObjectKey: avatarResult.avatarObjectKey,
      avatarUrl: avatarResult.avatarUrl,
      queryClient,
      username: profileUsername,
    });
    await session.refetch().catch(() => undefined);

    return true;
  }

  async function saveDetails(details: { displayUsername: string; username: string }) {
    const { error } = await authClient.updateUser(details);

    if (error) {
      setErrors(getProfileUpdateErrors(error));
      return false;
    }

    updateProfileCache({
      displayName: details.displayUsername,
      nextUsername: details.username,
      previousUsername: username,
      queryClient,
    });

    return true;
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        aria-label="Edit profile"
        className={cn(
          "h-auto gap-1 px-0 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground [&_svg:not([class*='size-'])]:size-3.5",
          className
        )}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Pencil data-icon="inline-start" />
        Edit
      </Button>
      <DialogContent size="md">
        <DialogHeader className="gap-2">
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update the identity people see on your reviews.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <ProfilePhotoPicker
            avatarUrl={removePhoto ? undefined : avatarUrl}
            disabled={isSaving}
            displayName={displayName}
            file={photoFile}
            onFileSelect={(file) => {
              setPhotoFile(file);
              setRemovePhoto(false);
            }}
            onRemove={() => {
              setPhotoFile(undefined);
              setRemovePhoto(true);
            }}
            statusLabel={profilePhoto.statusLabel}
          />
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(errors.displayUsername)}>
              <FieldLabel htmlFor={fieldIds.displayUsername}>Display username</FieldLabel>
              <Input
                aria-describedby={
                  errors.displayUsername
                    ? `${fieldIds.displayUsernameDescription} ${fieldIds.displayUsernameError}`
                    : fieldIds.displayUsernameDescription
                }
                aria-invalid={Boolean(errors.displayUsername)}
                autoComplete="name"
                disabled={isSaving}
                id={fieldIds.displayUsername}
                maxLength={displayUsernameMaxLength}
                onChange={(event) => {
                  setForm((current) => ({ ...current, displayUsername: event.target.value }));
                  setErrors((current) => ({ ...current, displayUsername: undefined, form: undefined }));
                }}
                value={form.displayUsername}
              />
              <FieldError id={fieldIds.displayUsernameError}>{errors.displayUsername}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.username)}>
              <FieldLabel htmlFor={fieldIds.username}>Username</FieldLabel>
              <Input
                aria-describedby={
                  errors.username
                    ? `${fieldIds.usernameDescription} ${fieldIds.usernameError}${
                        isUsernameChanged ? ` ${fieldIds.usernameWarning}` : ""
                      }`
                    : `${fieldIds.usernameDescription}${isUsernameChanged ? ` ${fieldIds.usernameWarning}` : ""}`
                }
                aria-invalid={Boolean(errors.username)}
                autoComplete="username"
                disabled={isSaving}
                id={fieldIds.username}
                onChange={(event) => {
                  setForm((current) => ({ ...current, username: event.target.value }));
                  setErrors((current) => ({ ...current, form: undefined, username: undefined }));
                }}
                value={form.username}
              />
              {isUsernameChanged ? (
                <FieldDescription id={fieldIds.usernameWarning}>
                  Heads up: old profile links will break.
                </FieldDescription>
              ) : null}
              <FieldError id={fieldIds.usernameError}>{errors.username}</FieldError>
            </Field>
            <FieldError id={fieldIds.formError}>{errors.form}</FieldError>
          </FieldGroup>
          <DialogFooter className="pt-1">
            <Button disabled={isSaving} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button aria-busy={isSaving || undefined} disabled={isSaving} type="submit">
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getProfileFormErrors({ displayUsername, username }: { displayUsername: string; username: string }) {
  const errors: ProfileFormErrors = {};

  if (!isUsernameFormatValid(username)) {
    errors.username = usernameUnavailableMessage;
  }

  if (!displayUsername) {
    errors.displayUsername = "Display username is required.";
  } else if (getDisplayUsernameLength(displayUsername) > displayUsernameMaxLength) {
    errors.displayUsername = `Use ${displayUsernameMaxLength} characters or fewer.`;
  }

  return errors.displayUsername || errors.username ? errors : null;
}

function getProfileUpdateErrors(error: unknown): ProfileFormErrors {
  const message = getProfileUpdateErrorMessage(error);
  const code = getProfileUpdateErrorCode(error);

  if (code === "INVALID_DISPLAY_USERNAME") {
    return { displayUsername: displayUsernameUnavailableMessage };
  }

  if (code?.startsWith("USERNAME_") || message.toLowerCase().includes("username")) {
    return { username: usernameUnavailableMessage };
  }

  if (message.toLowerCase().includes("display username")) {
    return { displayUsername: message };
  }

  return { form: message };
}

function getProfileUpdateErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  return;
}

function getProfileUpdateErrorMessage(error: unknown) {
  return getErrorMessage(error, "Try a different username and save again.");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

function updateProfileCache({
  displayName,
  nextUsername,
  previousUsername,
  queryClient,
}: {
  displayName: string;
  nextUsername: string;
  previousUsername: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const matchingProfiles = queryClient.getQueriesData<UserProfile>({
    queryKey: userQueryKeys.profile(previousUsername),
  });
  const previousData = matchingProfiles[0]?.[1];

  if (!previousData) return;

  const nextData = {
    ...previousData,
    user: {
      ...previousData.user,
      displayName,
      displayUsername: displayName,
      username: nextUsername,
    },
  };

  if (nextUsername !== previousUsername) {
    for (const [queryKey] of matchingProfiles) {
      const viewerUserId = queryKey[3];

      queryClient.setQueryData(
        typeof viewerUserId === "string"
          ? userQueryKeys.profile(nextUsername, viewerUserId)
          : userQueryKeys.profile(nextUsername),
        nextData
      );
    }

    queryClient.removeQueries({ queryKey: userQueryKeys.profile(previousUsername) });
    return;
  }

  queryClient.setQueriesData<UserProfile>({ queryKey: userQueryKeys.profile(previousUsername) }, nextData);
}

interface UpdateProfileAvatarCacheParams {
  avatarObjectKey: string | undefined;
  avatarUrl: string | undefined;
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

    return { ...current, user: { ...current.user, avatarObjectKey, avatarUrl } };
  });
}
