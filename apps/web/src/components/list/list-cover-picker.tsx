import { ImagePlus } from "lucide-react";
import { ImageUploadField } from "@/components/image-upload-field";
import { useObjectUrl } from "@/hooks/use-object-url";
import { imageUploadHint } from "@/lib/image-upload";
import { ListCoverMosaic } from "./list-cover-mosaic";
import type { ListCoverAlbum } from "@/server/services/list-service";

interface ListCoverPickerProps {
  albums: ListCoverAlbum[];
  coverUrl: string | undefined;
  disabled: boolean;
  file: File | undefined;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  statusLabel: string | undefined;
}

export function ListCoverPicker({
  albums,
  coverUrl,
  disabled,
  file,
  onFileSelect,
  onRemove,
  statusLabel,
}: ListCoverPickerProps) {
  const previewUrl = useObjectUrl(file);

  return (
    <ImageUploadField
      cropOutputSize={1024}
      cropShape="rect"
      disabled={disabled}
      hasImage={Boolean(file || coverUrl)}
      label="Cover"
      onFileSelect={onFileSelect}
      onRemove={onRemove}
      preview={<ListCoverMosaic albums={albums} className="size-16" coverUrl={previewUrl ?? coverUrl} size={128} />}
      removeLabel="Remove cover"
      statusLabel={statusLabel ?? imageUploadHint}
      uploadIcon={<ImagePlus />}
      uploadLabel="Upload cover"
    />
  );
}
