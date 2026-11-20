import { Trash2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { imageUploadAccept, imageUploadHint, isAcceptedImageUpload } from "@/lib/image-upload";
import type { ChangeEvent, ReactNode } from "react";

interface ImageUploadFieldProps {
  disabled: boolean;
  hasImage: boolean;
  label: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  preview: ReactNode;
  removeLabel: string;
  statusLabel: string;
  uploadIcon: ReactNode;
  uploadLabel: string;
}

export function ImageUploadField({
  disabled,
  hasImage,
  label,
  onFileSelect,
  onRemove,
  preview,
  removeLabel,
  statusLabel,
  uploadIcon,
  uploadLabel,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    if (!isAcceptedImageUpload(file)) {
      return toast.error("Couldn't use that image", { description: imageUploadHint });
    }

    onFileSelect(file);
  }

  return (
    <div className="flex items-center justify-between gap-4 border-border/80 border-b pb-5">
      <div className="flex min-w-0 items-center gap-4">
        {preview}
        <div className="min-w-0">
          <p className="font-medium text-sm">{label}</p>
          <p className="mt-1 text-muted-foreground text-sm">{statusLabel}</p>
        </div>
      </div>
      <input
        accept={imageUploadAccept}
        aria-label={label}
        className="sr-only"
        disabled={disabled}
        onChange={handleInputChange}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      <div className="flex shrink-0 items-center gap-2">
        {hasImage ? (
          <Button
            aria-label={removeLabel}
            disabled={disabled}
            onClick={onRemove}
            size="icon-sm"
            title={removeLabel}
            type="button"
            variant="outline"
          >
            <Trash2 />
          </Button>
        ) : null}
        <Button
          aria-label={uploadLabel}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          size="icon-sm"
          title={uploadLabel}
          type="button"
          variant="outline"
        >
          {uploadIcon}
        </Button>
      </div>
    </div>
  );
}
