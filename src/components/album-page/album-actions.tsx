import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAlbumArtistNames } from "./album-format.ts";
import { ReviewDrawer } from "./review-drawer";
import type { getAlbumDetails } from "@/server/functions/spotify-functions";

type SpotifyAlbumDetails = Awaited<ReturnType<typeof getAlbumDetails>>;
type SpotifyAlbum = SpotifyAlbumDetails["album"];

interface AlbumActionsProps {
  album: SpotifyAlbum;
  className?: string;
}

export function AlbumActions({ album, className }: AlbumActionsProps) {
  const albumArtist = getAlbumArtistNames(album);

  return (
    <div
      className={cn(
        "grid gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3",
        album.spotifyUrl ? "grid-cols-[1fr_auto]" : "grid-cols-1",
        className
      )}
    >
      <ReviewDrawer albumArtist={albumArtist} albumId={album.id} albumTitle={album.title} />
      {album.spotifyUrl ? (
        <a
          aria-label="Open album on Spotify"
          className={cn(
            buttonVariants({ size: "icon-lg", variant: "outline" }),
            "text-muted-foreground hover:border-primary/70 hover:bg-primary/10 hover:text-foreground"
          )}
          href={album.spotifyUrl}
          rel="noreferrer"
          target="_blank"
          title="Open in Spotify"
        >
          <img
            alt=""
            className="h-5.25 w-auto opacity-90"
            height={225}
            src="/spotify-logo-icon-white.svg"
            width={236}
          />
        </a>
      ) : null}
    </div>
  );
}
