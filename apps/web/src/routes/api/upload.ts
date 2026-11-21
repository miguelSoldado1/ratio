import { handleRequest, RejectUpload, route } from "@better-upload/server";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { env } from "@/env";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lists } from "@/lib/db/schema";
import { imageUploadFileTypes, imageUploadMaxFileSize } from "@/lib/image-upload";
import { createAvatarObjectKey, createListCoverObjectKey, createR2Client } from "@/server/image-storage";
import {
  createRateLimitResponse,
  enforceCloudflareRateLimitForRequest,
  enforceFixedWindowRateLimitForRequest,
  isRateLimitError,
  uploadSignHourlyRateLimit,
  uploadSignRateLimit,
} from "@/server/rate-limit";
import type { Router } from "@better-upload/server";

const immutableCacheControl = "public, max-age=31536000, immutable";

const uploadRouter: Router = {
  bucketName: env.CLOUDFLARE_R2_BUCKET_NAME,
  client: createR2Client(),
  routes: {
    avatar: route({
      fileTypes: [...imageUploadFileTypes],
      maxFileSize: imageUploadMaxFileSize,
      onBeforeUpload: async ({ file, req }) => {
        const { userId } = await authorizeUpload(req, "Sign in to upload a profile photo.");

        return {
          metadata: { userId },
          objectInfo: {
            cacheControl: immutableCacheControl,
            key: createAvatarObjectKey({ fileType: file.type, userId }),
            metadata: { userId },
          },
        };
      },
    }),
    listCover: route({
      clientMetadataSchema: z.object({ listId: z.uuid() }),
      fileTypes: [...imageUploadFileTypes],
      maxFileSize: imageUploadMaxFileSize,
      onBeforeUpload: async ({ clientMetadata, file, req }) => {
        const { db, userId } = await authorizeUpload(req, "Sign in to upload a list cover.");

        const [ownedList] = await db
          .select({ id: lists.id })
          .from(lists)
          .where(and(eq(lists.id, clientMetadata.listId), eq(lists.userId, userId)))
          .limit(1);

        if (!ownedList) {
          throw new RejectUpload("List not found.");
        }

        return {
          metadata: { listId: ownedList.id, userId },
          objectInfo: {
            cacheControl: immutableCacheControl,
            key: createListCoverObjectKey({ fileType: file.type, listId: ownedList.id }),
            metadata: { listId: ownedList.id, userId },
          },
        };
      },
    }),
  },
};

async function authorizeUpload(req: Request, signedOutMessage: string) {
  const db = await getDb();
  const auth = createAuth(db);
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    throw new RejectUpload(signedOutMessage);
  }

  try {
    await enforceFixedWindowRateLimitForRequest(req, uploadSignHourlyRateLimit, session.user.id);
  } catch (error) {
    if (isRateLimitError(error)) {
      throw new RejectUpload("Too many upload attempts. Try again shortly.");
    }

    throw error;
  }

  return { db, userId: session.user.id };
}

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await enforceCloudflareRateLimitForRequest(request, uploadSignRateLimit);
        } catch (error) {
          if (isRateLimitError(error)) return createRateLimitResponse(error);
          throw error;
        }

        return handleRequest(request, uploadRouter);
      },
    },
  },
});
