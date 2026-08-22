import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { decorateDocumentResponse } from "@/server/document-head";
import { matchDocumentMetadataRoute, resolveDocumentMetadata } from "@/server/document-metadata";
import { isRateLimitError } from "@/server/rate-limit";
import type { DocumentMetadataRoute } from "@/server/document-metadata";

const startHandler = createStartHandler(defaultStreamHandler);

export default createServerEntry({
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
