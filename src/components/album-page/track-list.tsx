import { cn } from "@/lib/utils";
import type { getAlbumDetails } from "@/server/functions/spotify-functions";

type SpotifyAlbumDetails = Awaited<ReturnType<typeof getAlbumDetails>>;
type SpotifyAlbumTrack = SpotifyAlbumDetails["tracks"][number];

export function TrackList({ className, tracks }: { className?: string; tracks: SpotifyAlbumTrack[] }) {
  return (
    <section className={cn("pt-5", className)}>
      <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-[0.24em]">Tracks</h2>
      <div className="mt-3 divide-y divide-border/70">
        {tracks.map((track, trackIndex) => (
          <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3" key={track.id}>
            <span className="text-muted-foreground text-xs tabular-nums">{trackIndex + 1}</span>
            <span className="min-w-0 truncate font-medium text-sm">{track.title}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{getTrackDuration(track)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function getTrackDuration(track: SpotifyAlbumTrack) {
  const totalSeconds = Math.floor(track.durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
