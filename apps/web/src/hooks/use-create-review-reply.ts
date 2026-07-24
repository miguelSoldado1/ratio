import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { albumQueryKeys, feedQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { isReviewReplyCountData, updateReviewReplyCountInPages } from "@/lib/tanstack-query/review-reply-cache";
import { createReviewReply } from "@/server/functions/review-reply-functions";
import { tryCatch } from "@/try-catch";

type CreatedReviewReply = NonNullable<Awaited<ReturnType<typeof createReviewReply>>>;

export type CreateReviewReplyResult = { error: null; reply: CreatedReviewReply } | { error: string; reply: null };

/** Creates a reply and patches every loaded review-list count that already
 * knows about its review. The full conversation can layer its thread-cache
 * work on top without duplicating the shared mutation or card updates. */
export function useCreateReviewReply() {
  const queryClient = useQueryClient();
  const createReviewReplyFn = useServerFn(createReviewReply);
  const mutation = useMutation({ mutationFn: createReviewReplyFn });

  const createReply = useCallback(
    async (reviewId: string, body: string): Promise<CreateReviewReplyResult> => {
      const { data: reply, error } = await tryCatch(mutation.mutateAsync({ data: { body, reviewId } }));
      if (error || !reply) {
        return {
          error: error instanceof Error ? error.message : "Something went wrong while posting your reply.",
          reply: null,
        };
      }

      for (const queryKey of [albumQueryKeys.all(), feedQueryKeys.all(), userQueryKeys.all()]) {
        queryClient.setQueriesData({ queryKey }, (data: unknown) =>
          isReviewReplyCountData(data)
            ? updateReviewReplyCountInPages(data, reply.reviewId, (replyCount) => replyCount + 1)
            : data
        );
      }

      return { error: null, reply };
    },
    [mutation, queryClient]
  );

  return { createReply, isCreatingReply: mutation.isPending };
}
