import { useUploadFile } from "@better-upload/client";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { setListCover } from "@/server/functions/list-functions";
import { tryCatch } from "@/try-catch";

export function useListCoverUpload() {
  const coverUpload = useUploadFile({
    route: "listCover",
    onError: (error) => {
      toast.error("Couldn't upload cover", { description: error.message });
    },
  });

  const setListCoverFn = useServerFn(setListCover);
  const setCoverMutation = useMutation({ mutationFn: setListCoverFn });

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

    if (coverResult.cleanupFailed) {
      toast.error("Couldn't remove old cover", { description: "The previous cover image couldn't be deleted." });
    }

    return coverResult;
  }

  return {
    isPending: coverUpload.isPending || setCoverMutation.isPending,
    isSaving: setCoverMutation.isPending,
    progress: coverUpload.progress,
    uploadCover,
    uploading: coverUpload.isPending,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
