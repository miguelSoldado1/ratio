import { useEffect, useRef, useState } from "react";
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
import type { ListDetailsInput } from "@/server/services/list-service";

const listTitleMaxLength = 100;
const listDescriptionMaxLength = 200;

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
    description: "Only the title and subtitle change here.",
    submitLabel: "Save changes",
    title: "Edit list",
  },
} as const;

interface ListDetailsInitialValues {
  description: string;
  title: string;
}

interface ListDetailsDialogProps {
  initialValues?: ListDetailsInitialValues;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ListDetailsInput) => void;
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
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      return setTitleError("Give the list a title.");
    }

    if (trimmedDescription.length > listDescriptionMaxLength) {
      return shakeDescription();
    }

    setTitleError(undefined);
    onSubmit({
      description: trimmedDescription || null,
      title: trimmedTitle,
    });
  }

  function shakeDescription() {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    textarea.classList.remove("animate-input-shake");
    window.requestAnimationFrame(() => textarea.classList.add("animate-input-shake"));
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
                aria-describedby={titleError ? fieldIds.titleError : undefined}
                aria-invalid={Boolean(titleError)}
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
              <FieldLabel htmlFor={fieldIds.description}>Subtitle</FieldLabel>
              <Textarea
                aria-describedby={fieldIds.descriptionHint}
                id={fieldIds.description}
                onAnimationEnd={(event) => event.currentTarget.classList.remove("animate-input-shake")}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What ties these together?"
                ref={descriptionRef}
                rows={2}
                value={description}
              />
              <FieldDescription
                className={
                  description.length > listDescriptionMaxLength
                    ? "text-destructive text-xs tabular-nums"
                    : "text-muted-foreground-subtle text-xs tabular-nums"
                }
                id={fieldIds.descriptionHint}
              >
                {description.length}/{listDescriptionMaxLength} characters
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
