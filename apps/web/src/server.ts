import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { getDb } from "@/lib/db";
import { decorateDocumentResponse } from "@/server/document-head";
import { matchDocumentMetadataRoute, resolveDocumentMetadata } from "@/server/document-metadata";
import { isRateLimitError } from "@/server/rate-limit";
import { deleteOrphanedImages, imageCleanupCron } from "@/server/services/image-cleanup-service";
import { pruneExpiredNotifications } from "@/server/services/notification-service";
import { refreshSitemapCache } from "@/server/services/sitemap-service";
import type { DocumentMetadataRoute } from "@/server/document-metadata";

const startHandler = createStartHandler(defaultStreamHandler);

const serverEntry = createServerEntry({
  async fetch(request, options) {
    if (request.method !== "GET") return await startHandler(request, options);

    const route = matchDocumentMetadataRoute(new URL(request.url).pathname);
    if (!route) return await startHandler(request, options);

    const [response, metadata] = await Promise.all([
      startHandler(request, options),
      resolveMetadataSafely(route, request),
    ]);

    return metadata ? decorateDocumentResponse(response, metadata) : response;
  },
});

export default {
  ...serverEntry,
  scheduled(controller: ScheduledController, env: Env, context: ExecutionContext) {
    if (controller.cron === imageCleanupCron) {
      return context.waitUntil(cleanUpOrphanedImages(env.IMAGES));
    }

    context.waitUntil(refreshSitemapCache(env.CACHE));
    context.waitUntil(getDb().then(pruneExpiredNotifications));
  },
};

async function cleanUpOrphanedImages(bucket: R2Bucket) {
  const { deletedCount } = await deleteOrphanedImages({ bucket, db: await getDb(), now: new Date() });
  console.info("orphaned_images_deleted", { deletedCount });
}

async function resolveMetadataSafely(route: DocumentMetadataRoute, request: Request) {
  try {
    return await resolveDocumentMetadata(route, request);
  } catch (error) {
    if (!isRateLimitError(error)) {
      console.error("document_metadata_resolution_error", { kind: route.kind, error });
    }

    return null;
  }
}
