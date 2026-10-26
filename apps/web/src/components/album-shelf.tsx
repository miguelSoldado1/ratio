import { Link } from "@tanstack/react-router";
import { AlbumArtwork } from "@/components/album-artwork";
import { SpotifyAttribution } from "@/components/spotify-attribution";
import type { ReactNode } from "react";

export interface AlbumShelfAlbum {
  artist: string;
  coverUrl?: string | null;
  id: string;
  spotifyUrl: string;
  title: string;
}

interface AlbumShelfProps {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}

export function AlbumShelf({ action, children, title }: AlbumShelfProps) {
  return (
    <section aria-label={title} className="recent-rotation-enter border-border border-b pt-5 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="heading-section">{title}</h2>
        {action}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none">
        {children}
      </ul>
    </section>
  );
}

interface AlbumShelfTileProps {
  album: AlbumShelfAlbum;
  hint?: string;
}

export function AlbumShelfTile({ album, hint }: AlbumShelfTileProps) {
  return (
    <li className="flex min-w-0 items-center overflow-hidden rounded-lg bg-muted/40 transition-colors hover:bg-muted/70">
      <Link
        className="focus-ring flex min-w-0 flex-1 items-center self-stretch rounded-lg"
        params={{ albumId: album.id }}
        title={hint}
        to="/album/$albumId"
      >
        <AlbumArtwork
          alt={album.artist ? `${album.title} by ${album.artist}` : album.title}
          className="size-14 shrink-0"
          decoding="async"
          height={56}
          loading="lazy"
          src={album.coverUrl}
          width={56}
        />
        <span className="min-w-0 flex-1 px-3">
          <span className="block truncate font-medium text-foreground text-sm leading-snug">{album.title}</span>
          {album.artist && <span className="mt-0.5 block truncate text-muted-foreground text-xs">{album.artist}</span>}
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
