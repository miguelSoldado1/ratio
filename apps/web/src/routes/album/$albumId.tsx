import { createFileRoute } from "@tanstack/react-router";
import { AlbumPage } from "@/components/album-page/album-page";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";

export const Route = createFileRoute("/album/$albumId")({
  component: AlbumRoute,
  head: ({ params }) => {
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
});

function AlbumRoute() {
  const { albumId } = Route.useParams();

  return <AlbumPage albumId={albumId} />;
}
