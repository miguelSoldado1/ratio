import { ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import { imageUploadHint } from "@/lib/image-upload";
import { ListCoverMosaic } from "./list-cover-mosaic";

interface ListCoverPickerProps {
  disabled: boolean;
  file: File | undefined;
  onFileChange: (file: File | undefined) => void;
}

// The list doesn't exist yet, so the file waits here and uploads once the list is created.
export function ListCoverPicker({ disabled, file, onFileChange }: ListCoverPickerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) return setPreviewUrl(undefined);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <ImageUploadField
      disabled={disabled}
      hasImage={Boolean(file)}
      label="Cover"
      onFileSelect={onFileChange}
      onRemove={() => onFileChange(undefined)}
      preview={<ListCoverMosaic albums={[]} className="size-16" coverUrl={previewUrl} size={128} />}
      removeLabel="Remove cover"
      statusLabel={imageUploadHint}
      uploadIcon={<ImagePlus />}
      uploadLabel="Upload cover"
    />
  );
}
