import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlbumArtwork } from "@/components/album-artwork";
import { SpotifyAttribution } from "@/components/spotify-attribution";
import { Button } from "@/components/ui/button";
import { useSpotifyRecentListeningReconnect } from "@/hooks/use-spotify-recent-listening-reconnect";
import { formatRelativeTime } from "@/lib/date-format";
import { spotifyQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import { getMyRecentRotation } from "@/server/functions/spotify-recent-rotation-functions";
import type { RecentRotationAlbum } from "@/server/services/spotify-recent-rotation-service";

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
    <section aria-label="Albums from your recent listening" className={cn("recent-rotation-enter", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="heading-section">Albums from your recent listening</h2>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
        {albums.map((album) => (
          <RecentRotationTile album={album} key={album.id} />
        ))}
      </ul>
    </section>
  );
}

interface RecentRotationTileProps {
  album: RecentRotationAlbum;
}

function RecentRotationTile({ album }: RecentRotationTileProps) {
  const artistNames = album.artistNames.join(", ");
  const metadata = [artistNames, album.releaseYear].filter(Boolean).join(" · ");

  return (
    <li className="flex min-w-0 items-center overflow-hidden rounded-lg bg-muted/40 transition-colors hover:bg-muted/70">
      <Link
        className="focus-ring flex min-w-0 flex-1 items-center self-stretch rounded-lg"
        params={{ albumId: album.id }}
        title={`Played ${formatRelativeTime(new Date(album.lastPlayedAt))}`}
        to="/album/$albumId"
      >
        <AlbumArtwork
          alt={artistNames ? `${album.title} by ${artistNames}` : album.title}
          className="size-14 shrink-0"
          decoding="async"
          height={56}
          loading="lazy"
          src={album.coverUrl}
          width={56}
        />
        <span className="min-w-0 flex-1 px-3">
          <span className="block truncate font-medium text-foreground text-sm leading-snug">{album.title}</span>
          {metadata && <span className="mt-0.5 block truncate text-muted-foreground text-xs">{metadata}</span>}
        </span>
      </Link>
      <SpotifyAttribution
        ariaLabel={`Open ${album.title} on Spotify`}
        className="mr-2 ml-1"
        href={album.spotifyUrl}
        variant="icon"
      />
    </li>
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
