import { createFileRoute } from "@tanstack/react-router";
import { AlbumLookupLoading } from "@/components/album-page/album-lookup-loading";
import { AlbumPage } from "@/components/album-page/album-page";
import { createDocumentRouteHead, getInitialDocumentMetadata } from "@/lib/document-metadata";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";

export const Route = createFileRoute("/album/$albumId")({
  component: AlbumRoute,
  head: ({ params }) => {
    const initialMetadata = getInitialDocumentMetadata();
    if (initialMetadata) return createDocumentRouteHead(initialMetadata);

    const path = `/album/${params.albumId}`;

    return {
      links: [createCanonicalLink(path)],
      meta: createSeoMeta({
        description: "Read community reviews for this album on Ratio.",
        path,
        title: `Album Reviews | ${siteName}`,
      }),
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
