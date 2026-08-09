import { createFileRoute } from "@tanstack/react-router";
import { AlbumPage } from "@/components/album-page/album-page";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";
import { getAlbumHeadMetadata } from "@/server/functions/spotify-functions";
import { tryCatch } from "@/try-catch";

export const Route = createFileRoute("/album/$albumId")({
  component: AlbumRoute,
  loader: async ({ params }) => {
    const result = await tryCatch(getAlbumHeadMetadata({ data: { albumId: params.albumId } }));
    return result.data;
  },
  preload: false,
  ssr: "data-only",
  head: ({ loaderData, params }) => {
    const path = `/album/${params.albumId}`;

    if (!loaderData) {
      return {
        links: [createCanonicalLink(path)],
        meta: createSeoMeta({
          description: "Read community reviews for this album on Ratio.",
          path,
          robots: null,
          title: `Album Reviews | ${siteName}`,
          twitterCard: "summary",
        }),
      };
    }

    const primaryArtist = loaderData.artistNames[0] ?? "Unknown Artist";
    const artistNames = loaderData.artistNames.length > 0 ? loaderData.artistNames : [primaryArtist];
    const title = `${loaderData.title} by ${primaryArtist} — Reviews | ${siteName}`;
    const description = `Read reviews and ratings for ${loaderData.title} by ${artistNames.join(", ")} on ${siteName}.`;

    return {
      links: [createCanonicalLink(path)],
      meta: createSeoMeta({
        description,
        image: loaderData.coverUrl,
        imageAlt: loaderData.coverUrl ? `${loaderData.title} album cover` : `${siteName} album reviews`,
        path,
        title,
        twitterCard: "summary",
        type: "music.album",
      }),
    };
  },
});

function AlbumRoute() {
  const { albumId } = Route.useParams();

  return <AlbumPage albumId={albumId} />;
}
