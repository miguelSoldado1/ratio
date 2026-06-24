import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/auth-client";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import type { FormEvent } from "react";
import type { UserProfile } from "@/server/services/review-service";

const usernamePattern = /^[a-zA-Z0-9_.]{3,30}$/;
const fieldIds = {
  displayUsername: "profile-display-username",
  displayUsernameDescription: "profile-display-username-description",
  displayUsernameError: "profile-display-username-error",
  formError: "profile-form-error",
  username: "profile-username",
  usernameDescription: "profile-username-description",
  usernameError: "profile-username-error",
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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ displayUsername: displayName, username });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ProfileFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setForm({ displayUsername: displayName, username });
    setErrors({});
  }, [displayName, open, username]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextDisplayUsername = form.displayUsername.trim();
    const nextUsername = form.username.trim();

    const nextErrors: ProfileFormErrors = {};

    if (!usernamePattern.test(nextUsername)) {
      nextErrors.username = "Use 3-30 letters, numbers, underscores, or dots.";
    }

    if (!nextDisplayUsername) {
      nextErrors.displayUsername = "Display username is required.";
    }

    if (nextErrors.displayUsername || nextErrors.username) {
      return setErrors(nextErrors);
    }

    const hasChanges = nextDisplayUsername !== displayName || nextUsername !== username;
    if (!hasChanges) {
      return setOpen(false);
    }

    setIsSaving(true);
    const { error } = await authClient.updateUser({ displayUsername: nextDisplayUsername, username: nextUsername });
    setIsSaving(false);

    if (error) {
      return setErrors(getProfileUpdateErrors(error));
    }

    updateProfileCache({
      displayName: nextDisplayUsername,
      nextUsername: nextUsername.toLowerCase(),
      previousUsername: username,
      queryClient,
    });

    setOpen(false);
    toast.success("Success", { description: "Your profile has been updated." });

    if (nextUsername.toLowerCase() !== username) {
      navigate({ params: { username: nextUsername.toLowerCase() }, to: "/user/$username" });
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        aria-label="Edit profile"
        className={cn(
          "h-auto gap-1 px-0 font-normal text-muted-foreground [transition:color_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:bg-transparent hover:text-foreground active:translate-y-0 active:scale-[0.98] [&_svg:not([class*='size-'])]:size-3.5",
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
      <DialogContent className="sm:max-w-115">
        <DialogHeader className="gap-2 pr-7">
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update the identity people see on your reviews.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-4 border-border/80 border-b pb-5">
            <div className="flex min-w-0 items-center gap-4">
              <ProfileDialogAvatar avatarUrl={avatarUrl} name={displayName} />
              <div className="min-w-0">
                <p className="font-medium text-sm">Profile photo</p>
                <p className="mt-1 text-muted-foreground text-sm">Image uploads are coming later.</p>
              </div>
            </div>
            <Button
              aria-label="Change photo"
              className="shrink-0"
              disabled
              size="icon-sm"
              title="Change photo"
              type="button"
              variant="outline"
            >
              <Camera />
            </Button>
          </div>
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
                    ? `${fieldIds.usernameDescription} ${fieldIds.usernameError}`
                    : fieldIds.usernameDescription
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
              <FieldError id={fieldIds.usernameError}>{errors.username}</FieldError>
            </Field>
            <FieldError id={fieldIds.formError}>{errors.form}</FieldError>
          </FieldGroup>
          <DialogFooter className="pt-1">
            <Button disabled={isSaving} onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileDialogAvatar({ avatarUrl, name }: { avatarUrl?: string; name: string }) {
  const initial = name.trim().charAt(0) || "U";
  const className =
    "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-xl text-muted-foreground uppercase";

  if (avatarUrl) {
    return (
      <img
        alt={name}
        className={cn(className, "object-cover")}
        height={64}
        referrerPolicy="no-referrer"
        src={avatarUrl}
        width={64}
      />
    );
  }

  return <div className={className}>{initial}</div>;
}

function getProfileUpdateErrors(error: unknown): ProfileFormErrors {
  const message = getProfileUpdateErrorMessage(error);
  const code = getProfileUpdateErrorCode(error);

  if (code?.startsWith("USERNAME_") || message.toLowerCase().includes("username")) {
    return { username: message };
  }

  if (code === "INVALID_DISPLAY_USERNAME" || message.toLowerCase().includes("display username")) {
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
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Try a different username and save again.";
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
  const previousQueryKey = userQueryKeys.profile(previousUsername);
  const previousData = queryClient.getQueryData<UserProfile>(previousQueryKey);

  if (!previousData) return;

  const nextData = {
    ...previousData,
    user: {
      ...previousData.user,
      displayName,
      username: nextUsername,
    },
  };

  if (nextUsername !== previousUsername) {
    queryClient.setQueryData(userQueryKeys.profile(nextUsername), nextData);
    queryClient.removeQueries({ exact: true, queryKey: previousQueryKey });
    return;
  }

  queryClient.setQueryData(previousQueryKey, nextData);
}
