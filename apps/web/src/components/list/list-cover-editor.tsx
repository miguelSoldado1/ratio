import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/image-upload-field";
import { useListCoverUpload } from "@/hooks/use-list-cover-upload";
import { imageUploadHint } from "@/lib/image-upload";
import { removeListCover } from "@/server/functions/list-functions";
import { tryCatch } from "@/try-catch";
import { ListCoverMosaic } from "./list-cover-mosaic";
import type { ListCoverMutationResult, ListDetails } from "@/server/services/list-service";

interface ListCoverEditorProps {
  disabled: boolean;
  list: Pick<ListDetails, "coverAlbums" | "coverUrl" | "id">;
  onBusyChange: (busy: boolean) => void;
  onCoverChange: (result: ListCoverMutationResult) => void;
}

export function ListCoverEditor({ disabled, list, onBusyChange, onCoverChange }: ListCoverEditorProps) {
  const coverUpload = useListCoverUpload();

  const removeListCoverFn = useServerFn(removeListCover);
  const removeCoverMutation = useMutation({ mutationFn: removeListCoverFn });

  const isRemovingCover = removeCoverMutation.isPending;
  const isCoverBusy = coverUpload.isPending || isRemovingCover;

  useEffect(() => {
    onBusyChange(isCoverBusy);
  }, [isCoverBusy, onBusyChange]);

  async function handleFileSelect(file: File) {
    const coverResult = await coverUpload.uploadCover(list.id, file);
    if (coverResult) onCoverChange(coverResult);
  }

  async function handleRemoveCover() {
    const { data: coverResult, error } = await tryCatch(removeCoverMutation.mutateAsync({ data: { listId: list.id } }));

    if (error) {
      return toast.error("Couldn't remove cover", { description: getErrorMessage(error) });
    }

    onCoverChange(coverResult);

    if (coverResult.cleanupFailed) {
      toast.error("Couldn't remove old cover", { description: "The previous cover image couldn't be deleted." });
    }
  }

  return (
    <ImageUploadField
      disabled={disabled || isCoverBusy}
      hasImage={Boolean(list.coverUrl)}
      label="Cover"
      onFileSelect={handleFileSelect}
      onRemove={handleRemoveCover}
      preview={<ListCoverMosaic albums={list.coverAlbums} className="size-16" coverUrl={list.coverUrl} size={128} />}
      removeLabel="Remove cover"
      statusLabel={getCoverStatusLabel({
        isRemovingCover,
        isSavingCover: coverUpload.isSaving,
        progress: coverUpload.progress,
        uploading: coverUpload.uploading,
      })}
      uploadIcon={<ImagePlus />}
      uploadLabel="Upload cover"
    />
  );
}

interface GetCoverStatusLabelParams {
  isRemovingCover: boolean;
  isSavingCover: boolean;
  progress: number;
  uploading: boolean;
}

function getCoverStatusLabel({ isRemovingCover, isSavingCover, progress, uploading }: GetCoverStatusLabelParams) {
  if (uploading) return `Uploading ${Math.round(progress * 100)}%`;
  if (isRemovingCover) return "Removing cover...";
  if (isSavingCover) return "Saving cover...";

  return imageUploadHint;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
