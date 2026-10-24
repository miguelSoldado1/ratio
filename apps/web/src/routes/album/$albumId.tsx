import { createFileRoute } from "@tanstack/react-router";
import { AlbumLookupLoading } from "@/components/album-page/album-lookup-loading";
import { AlbumPage } from "@/components/album-page/album-page";
import {
  createDocumentRouteHead,
  DOCUMENT_JSON_LD_SCRIPT_ID,
  getInitialDocumentMetadata,
} from "@/lib/document-metadata";
import { createCanonicalLink, createJsonLdScript, createSeoMeta, siteName } from "@/lib/seo";

export const Route = createFileRoute("/album/$albumId")({
  component: AlbumRoute,
  head: ({ params }) => {
    const path = `/album/${encodeURIComponent(params.albumId)}`;
    const initialMetadata = getInitialDocumentMetadata(path);
    if (initialMetadata) return createDocumentRouteHead(initialMetadata);

    return {
      links: [createCanonicalLink(path)],
      meta: createSeoMeta({
        description: "Read community reviews for this album on Ratio.",
        path,
        title: `Album Reviews | ${siteName}`,
      }),
      scripts: [{ ...createJsonLdScript([]), id: DOCUMENT_JSON_LD_SCRIPT_ID }],
    };
  },
  pendingComponent: AlbumLookupLoading,
  pendingMinMs: 0,
  pendingMs: 0,
  ssr: false,
});

function AlbumRoute() {
  const { albumId } = Route.useParams();

  return <AlbumPage albumId={albumId} />;
}
