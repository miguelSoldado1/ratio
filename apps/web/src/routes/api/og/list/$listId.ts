import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { createListShareImageResponse } from "@/server/list-share-image";

const listIdSchema = z.uuid();

export const Route = createFileRoute("/api/og/list/$listId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!listIdSchema.safeParse(params.listId).success) return new Response("Not found", { status: 404 });
        return await createListShareImageResponse(request, params.listId);
      },
    },
  },
});
