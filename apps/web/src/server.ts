import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { decorateDocumentResponse } from "@/server/document-head";
import { matchDocumentMetadataRoute, resolveDocumentMetadata } from "@/server/document-metadata";
import { isRateLimitError } from "@/server/rate-limit";
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
  scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext) {
    context.waitUntil(refreshSitemapCache(env.CACHE));
  },
};

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
