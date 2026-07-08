import { handleRequest, RejectUpload, type Router, route } from "@better-upload/server";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/env";
import { createAuth } from "@/lib/auth";
import { avatarFileTypes, avatarMaxFileSize } from "@/lib/avatar";
import { getDb } from "@/lib/db";
import { createAvatarObjectKey, createR2Client, getAvatarPublicUrl } from "@/server/avatar-storage";
import {
  createRateLimitResponse,
  enforceCloudflareRateLimitForRequest,
  enforceFixedWindowRateLimitForRequest,
  isRateLimitError,
  uploadSignHourlyRateLimit,
  uploadSignRateLimit,
} from "@/server/rate-limit";

const uploadRouter: Router = {
  bucketName: env.CLOUDFLARE_R2_BUCKET_NAME,
  client: createR2Client(),
  routes: {
    avatar: route({
      fileTypes: [...avatarFileTypes],
      maxFileSize: avatarMaxFileSize,
      onAfterSignedUrl: ({ file }) => ({
        metadata: {
          avatarObjectKey: file.objectInfo.key,
          avatarUrl: getAvatarPublicUrl(file.objectInfo.key),
        },
      }),
      onBeforeUpload: async ({ file, req }) => {
        const db = await getDb();
        const auth = createAuth(db);
        const session = await auth.api.getSession({ headers: req.headers });

        if (!session?.user) {
          throw new RejectUpload("Sign in to upload a profile photo.");
        }

        try {
          await enforceFixedWindowRateLimitForRequest(req, uploadSignHourlyRateLimit, session.user.id);
        } catch (error) {
          if (isRateLimitError(error)) {
            throw new RejectUpload("Too many upload attempts. Try again shortly.");
          }

          throw error;
        }

        const objectKey = createAvatarObjectKey({ fileType: file.type, userId: session.user.id });

        return {
          metadata: { userId: session.user.id },
          objectInfo: {
            cacheControl: "public, max-age=31536000, immutable",
            key: objectKey,
            metadata: { userId: session.user.id },
          },
        };
      },
    }),
  },
};

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
