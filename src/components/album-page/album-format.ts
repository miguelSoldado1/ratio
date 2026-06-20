import type { getAlbumDetails } from "@/server/functions/spotify-functions";

type SpotifyAlbumDetails = Awaited<ReturnType<typeof getAlbumDetails>>;
type SpotifyAlbum = SpotifyAlbumDetails["album"];

export function getAlbumArtistNames(album: SpotifyAlbum) {
  return album.artists.map((albumArtist) => albumArtist.name).join(", ");
}

export function getAlbumReleaseYear(album: SpotifyAlbum) {
  return album.releaseDate.slice(0, 4);
}

export function getAlbumRuntimeLabel(album: SpotifyAlbum) {
  return `${album.totalTracks} tracks · ${formatAlbumRuntime(album.durationMs)}`;
}

function formatAlbumRuntime(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes === 0) {
      return `${hours} hr`;
    }

    return `${hours} hr ${minutes} min`;
  }

  return `${minutes} min ${seconds} sec`;
}
