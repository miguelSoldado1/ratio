import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlbumShelf, AlbumShelfTile } from "@/components/album-shelf";
import { Button } from "@/components/ui/button";
import { useSpotifyRecentListeningReconnect } from "@/hooks/use-spotify-recent-listening-reconnect";
import { formatRelativeTime } from "@/lib/date-format";
import { spotifyQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getMyRecentRotation } from "@/server/functions/spotify-recent-rotation-functions";

const RECENT_ROTATION_STALE_TIME_MS = 30 * 60 * 1000; // matches the server-side KV TTL
const className = "border-border border-b pt-5 pb-6";

interface RecentRotationProps {
  viewerUserId?: string;
}

export function RecentRotation({ viewerUserId }: RecentRotationProps) {
  const getMyRecentRotationFn = useServerFn(getMyRecentRotation);
  const rotationQuery = useQuery({
    enabled: Boolean(viewerUserId),
    meta: { suppressErrorToast: true },
    queryFn: () => getMyRecentRotationFn(),
    queryKey: spotifyQueryKeys.recentRotation(viewerUserId ?? ""),
    refetchOnWindowFocus: false,
    staleTime: RECENT_ROTATION_STALE_TIME_MS,
  });

  if (!viewerUserId || rotationQuery.isPending || rotationQuery.isError) {
    return null;
  }

  if (rotationQuery.data.status === "reconnect-required") {
    return <RecentRotationReconnectCard className={className} viewerUserId={viewerUserId} />;
  }

  if (rotationQuery.data.status !== "ready") return null;

  const albums = rotationQuery.data.albums;

  if (albums.length === 0) {
    return null;
  }

  return (
    <AlbumShelf title="Albums from your recent listening">
      {albums.map((album) => (
        <AlbumShelfTile
          album={{ ...album, artist: album.artistNames.join(", ") }}
          hint={`Played ${formatRelativeTime(new Date(album.lastPlayedAt))}`}
          key={album.id}
        />
      ))}
    </AlbumShelf>
  );
}

interface RecentRotationReconnectCardProps {
  className?: string;
  viewerUserId: string;
}

function RecentRotationReconnectCard({ className, viewerUserId }: RecentRotationReconnectCardProps) {
  const { isPending: isReconnecting, requestReconnect: handleReconnect } =
    useSpotifyRecentListeningReconnect(viewerUserId);

  return (
    <section aria-label="Reconnect Spotify" className={className}>
      <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border border-border/55 bg-muted/25 px-4 py-3">
        <p className="min-w-0 text-muted-foreground text-sm">Reconnect Spotify to show your recent listening.</p>
        <Button disabled={isReconnecting} onClick={handleReconnect} size="sm" type="button" variant="outline">
          <img
            alt=""
            aria-hidden="true"
            className="size-4"
            data-icon="inline-start"
            height="18"
            src="/brand/spotify-logo-icon-white.svg"
            width="18"
          />
          Reconnect Spotify
        </Button>
      </div>
    </section>
  );
}
