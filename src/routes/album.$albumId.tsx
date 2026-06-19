import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlbumLookupLoading } from "@/components/album-page/album-lookup-loading";
import { AlbumPageView } from "@/components/album-page/album-page-view";
import { albumPageData } from "@/lib/album-page-mock";
import { getAlbumDetails } from "@/server/functions/spotify-functions";

export const Route = createFileRoute("/album/$albumId")({
  component: AlbumPage,
});

function AlbumPage() {
  const { albumId } = Route.useParams();
  const navigate = useNavigate();
  const albumDetailsQuery = useQuery({
    queryFn: () => getAlbumDetails({ data: { albumId } }),
    queryKey: ["album-details", albumId],
  });

  useEffect(() => {
    if (albumDetailsQuery.isError) {
      navigate({ to: "/" });
    }
  }, [albumDetailsQuery.isError, navigate]);

  if (albumDetailsQuery.isPending) return <AlbumLookupLoading albumId={albumId} />;
  if (albumDetailsQuery.isError) return null;

  return <AlbumPageView albumDetails={albumDetailsQuery.data} albumId={albumId} communityData={albumPageData} />;
}
