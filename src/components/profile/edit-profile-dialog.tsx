import { Camera, Pencil } from "lucide-react";
import { useState } from "react";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FormEvent } from "react";

interface EditProfileDialogProps {
  avatarUrl?: string;
  className?: string;
  displayName: string;
  iconOnly?: boolean;
  username: string;
}

export function EditProfileDialog({
  avatarUrl,
  className,
  displayName,
  iconOnly = false,
  username,
}: EditProfileDialogProps) {
  const [open, setOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast.info("Profile editing is not connected yet.");
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        aria-label={iconOnly ? "Edit profile" : undefined}
        className={cn(
          "text-muted-foreground [transition:color_150ms_ease,background-color_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:text-foreground active:scale-[0.97]",
          iconOnly ? "size-8 px-0" : "-ml-1 h-7 px-2",
          className
        )}
        onClick={() => setOpen(true)}
        size={iconOnly ? "icon-sm" : "sm"}
        title={iconOnly ? "Edit profile" : undefined}
        type="button"
        variant="ghost"
      >
        <Pencil data-icon={iconOnly ? undefined : "inline-start"} />
        {iconOnly ? <span className="sr-only">Edit profile</span> : "Edit profile"}
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
            <Field>
              <FieldLabel htmlFor="profile-display-name">Display name</FieldLabel>
              <Input autoComplete="name" defaultValue={displayName} id="profile-display-name" />
              <FieldDescription>This is the name shown on your profile and reviews.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-username">Username</FieldLabel>
              <Input autoComplete="username" defaultValue={username} id="profile-username" />
              <FieldDescription>Used in your profile link and review headers.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="pt-1">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
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
