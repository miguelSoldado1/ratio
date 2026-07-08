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
import { SettingsActionCard } from "./settings-action-card";

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
      <SettingsActionCard
        action={
          <Button onClick={() => setDialogOpen(true)} type="button" variant="destructive">
            Delete account
          </Button>
        }
        description="Deletes your profile, reviews, ratings, likes, follows, linked sign-in methods, and sessions."
        icon={<Trash2 />}
        title="Delete account"
        variant="destructive"
      />

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
