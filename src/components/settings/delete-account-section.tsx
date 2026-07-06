import { Trash2 } from "lucide-react";
import { useState } from "react";
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
import { SectionIntro } from "./section-intro";

interface DeleteAccountSectionProps {
  confirmationHandle?: string;
  isPending: boolean;
  onDeleteAccount: (confirmation: string) => void;
}

export function DeleteAccountSection({ confirmationHandle, isPending, onDeleteAccount }: DeleteAccountSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const canDelete = Boolean(confirmationHandle) && confirmation === confirmationHandle && !isPending;

  function setOpen(open: boolean) {
    setDialogOpen(open);
    if (!open) setConfirmation("");
  }

  return (
    <section className="flex flex-col gap-4 border-border border-t pt-6">
      <SectionIntro description="Permanently remove your account and Ratio activity." title="Danger zone" />
      <div className="flex flex-col gap-4 rounded-3xl bg-destructive/5 p-4 ring-1 ring-destructive/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-sm">Delete account</p>
            <p className="text-muted-foreground text-sm">
              Deletes your profile, reviews, ratings, likes, follows, linked sign-in methods, and sessions.
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} type="button" variant="destructive">
          Delete account
        </Button>
      </div>

      <Dialog onOpenChange={setOpen} open={dialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This permanently deletes your Ratio account and all user-owned activity. Shared album metadata stays on
              Ratio.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="delete-confirmation">Type {confirmationHandle} to confirm</FieldLabel>
              <Input
                autoComplete="off"
                id="delete-confirmation"
                onChange={(event) => setConfirmation(event.target.value)}
                value={confirmation}
              />
              <FieldDescription>
                Reviews, ratings, likes, follows, sessions, and sign-in methods are removed.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!canDelete}
              onClick={() => {
                onDeleteAccount(confirmation);
              }}
              type="button"
              variant="destructive"
            >
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
