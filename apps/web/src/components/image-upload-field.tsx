import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageCropDialog, preloadImageCropper } from "@/components/image-crop-dialog";
import { Button } from "@/components/ui/button";
import { imageUploadAccept, imageUploadHint, isAcceptedImageSource } from "@/lib/image-upload";
import type { ChangeEvent, ReactNode } from "react";

interface ImageUploadFieldProps {
  cropOutputSize: number;
  cropShape: "rect" | "round";
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
  cropOutputSize,
  cropShape,
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
  const [sourceFile, setSourceFile] = useState<File>();
  const [isCropOpen, setIsCropOpen] = useState(false);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    if (!isAcceptedImageSource(file)) {
      return toast.error("Couldn't use that image", { description: imageUploadHint });
    }

    preloadImageCropper().catch(() => undefined);
    setSourceFile(file);
    setIsCropOpen(true);
  }

  function handleCropApply(file: File) {
    onFileSelect(file);
    setIsCropOpen(false);
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
      <ImageCropDialog
        cropShape={cropShape}
        file={sourceFile}
        onApply={handleCropApply}
        onClosed={() => setSourceFile(undefined)}
        onOpenChange={setIsCropOpen}
        open={isCropOpen}
        outputSize={cropOutputSize}
        title={`Adjust ${label.toLowerCase()}`}
      />
    </div>
  );
}
