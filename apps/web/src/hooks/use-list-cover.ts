import { useUploadFile } from "@better-upload/client";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { removeListCover, setListCover } from "@/server/functions/list-functions";
import { tryCatch } from "@/try-catch";
import type { ListCoverMutationResult } from "@/server/services/list-service";

export function useListCover() {
  const coverUpload = useUploadFile({
    route: "listCover",
    onError: (error) => {
      toast.error("Couldn't upload cover", { description: error.message });
    },
  });

  const setListCoverFn = useServerFn(setListCover);
  const setCoverMutation = useMutation({ mutationFn: setListCoverFn });

  const removeListCoverFn = useServerFn(removeListCover);
  const removeCoverMutation = useMutation({ mutationFn: removeListCoverFn });

  async function uploadCover(listId: string, file: File) {
    const { data: uploadResult, error: uploadError } = await tryCatch(
      coverUpload.uploadAsync(file, { metadata: { listId } })
    );
    if (uploadError || !uploadResult.file) return null;

    const { data: coverResult, error } = await tryCatch(
      setCoverMutation.mutateAsync({ data: { listId, objectKey: uploadResult.file.objectInfo.key } })
    );

    if (error) {
      toast.error("Couldn't upload cover", { description: getErrorMessage(error) });
      return null;
    }

    return warnOnCleanupFailure(coverResult);
  }

  async function removeCover(listId: string) {
    const { data: coverResult, error } = await tryCatch(removeCoverMutation.mutateAsync({ data: { listId } }));

    if (error) {
      toast.error("Couldn't remove cover", { description: getErrorMessage(error) });
      return null;
    }

    return warnOnCleanupFailure(coverResult);
  }

  return {
    isPending: coverUpload.isPending || setCoverMutation.isPending || removeCoverMutation.isPending,
    removeCover,
    statusLabel: getCoverStatusLabel({
      isRemoving: removeCoverMutation.isPending,
      isSaving: setCoverMutation.isPending,
      progress: coverUpload.progress,
      uploading: coverUpload.isPending,
    }),
    uploadCover,
  };
}

function warnOnCleanupFailure(coverResult: ListCoverMutationResult) {
  if (coverResult.cleanupFailed) {
    toast.error("Couldn't remove old cover", { description: "The previous cover image couldn't be deleted." });
  }

  return coverResult;
}

interface GetCoverStatusLabelParams {
  isRemoving: boolean;
  isSaving: boolean;
  progress: number;
  uploading: boolean;
}

function getCoverStatusLabel({ isRemoving, isSaving, progress, uploading }: GetCoverStatusLabelParams) {
  if (uploading) return `Uploading ${Math.round(progress * 100)}%`;
  if (isRemoving) return "Removing cover...";
  if (isSaving) return "Saving cover...";

  return;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
