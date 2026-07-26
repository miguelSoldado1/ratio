import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { FormEvent } from "react";

export const listTitleMaxLength = 100;
export const listDescriptionMaxLength = 500;

const fieldIds = {
  description: "list-description",
  descriptionHint: "list-description-hint",
  title: "list-title",
  titleError: "list-title-error",
} as const;

const listDetailsCopy = {
  create: {
    description: "You can add albums once the list exists.",
    submitLabel: "Create list",
    title: "New list",
  },
  edit: {
    description: "Only the title and description change here.",
    submitLabel: "Save changes",
    title: "Edit list",
  },
} as const;

export interface ListDetailsValues {
  description: string;
  title: string;
}

interface ListDetailsDialogProps {
  initialValues?: ListDetailsValues;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ListDetailsValues) => void;
  open: boolean;
  variant: "create" | "edit";
}

export function ListDetailsDialog({
  initialValues,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
  open,
  variant,
}: ListDetailsDialogProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [titleError, setTitleError] = useState<string | undefined>(undefined);

  const copy = listDetailsCopy[variant];

  useEffect(() => {
    if (!open) return;

    setTitle(initialValues?.title ?? "");
    setDescription(initialValues?.description ?? "");
    setTitleError(undefined);
  }, [initialValues?.description, initialValues?.title, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return setTitleError("Give the list a title.");
    }

    setTitleError(undefined);
    onSubmit({ description: description.trim(), title: trimmedTitle });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit}>
          <FieldGroup className="gap-5">
            <Field data-invalid={Boolean(titleError)}>
              <FieldLabel htmlFor={fieldIds.title}>Title</FieldLabel>
              <Input
                autoComplete="off"
                id={fieldIds.title}
                maxLength={listTitleMaxLength}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="The 20 albums that made me"
                value={title}
              />
              <FieldError id={fieldIds.titleError}>{titleError}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor={fieldIds.description}>Description</FieldLabel>
              <Textarea
                aria-describedby={fieldIds.descriptionHint}
                id={fieldIds.description}
                maxLength={listDescriptionMaxLength}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What ties these together?"
                rows={3}
                value={description}
              />
              <FieldDescription id={fieldIds.descriptionHint}>
                Optional. {listDescriptionMaxLength - description.length} characters left.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button disabled={isSubmitting} onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {copy.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
