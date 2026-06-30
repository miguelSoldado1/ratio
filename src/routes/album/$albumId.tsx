import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlbumPage } from "@/components/album-page/album-page";

export const Route = createFileRoute("/album/$albumId")({
  component: AlbumRoute,
});

function AlbumRoute() {
  const { albumId } = Route.useParams();

  return (
    <>
      <AlbumPage albumId={albumId} />
      <Outlet />
    </>
  );
}
