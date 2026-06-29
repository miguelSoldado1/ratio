import { cn } from "@/lib/utils";
import type { getAlbumDetails } from "@/server/functions/spotify-functions";

type SpotifyAlbumDetails = Awaited<ReturnType<typeof getAlbumDetails>>;
type SpotifyAlbumTrack = SpotifyAlbumDetails["tracks"][number];

export function TrackList({ className, tracks }: { className?: string; tracks: SpotifyAlbumTrack[] }) {
  const trackGroups = getTrackGroups(tracks);
  const hasMultipleDiscs = trackGroups.length > 1;

  return (
    <section className={cn("pt-5", className)}>
      <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-[0.24em]">Tracks</h2>
      <div className="mt-3">
        {trackGroups.map((group, groupIndex) => (
          <div className={cn(groupIndex > 0 && "mt-5")} key={group.discNumber}>
            {hasMultipleDiscs ? (
              <div className="flex items-center gap-2 pb-1.5">
                <span className="font-medium text-[0.6875rem] text-muted-foreground/90 tabular-nums">
                  Disc {group.discNumber}
                </span>
                <span className="h-px flex-1 bg-border/60" />
                <span className="text-[0.625rem] text-muted-foreground/60 tabular-nums">
                  {getTrackCountLabel(group.tracks.length)}
                </span>
              </div>
            ) : null}
            <div className="divide-y divide-border/70">
              {group.tracks.map((track, trackIndex) => (
                <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3" key={track.id}>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {hasMultipleDiscs ? track.trackNumber : trackIndex + 1}
                  </span>
                  <span className="min-w-0 truncate font-medium text-sm">{track.title}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">{getTrackDuration(track)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getTrackGroups(tracks: SpotifyAlbumTrack[]) {
  const tracksByDisc = new Map<number, SpotifyAlbumTrack[]>();

  for (const track of tracks) {
    const discTracks = tracksByDisc.get(track.discNumber) ?? [];
    discTracks.push(track);
    tracksByDisc.set(track.discNumber, discTracks);
  }

  return Array.from(tracksByDisc, ([discNumber, discTracks]) => ({
    discNumber,
    tracks: discTracks,
  }));
}

function getTrackDuration(track: SpotifyAlbumTrack) {
  const totalSeconds = Math.floor(track.durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getTrackCountLabel(trackCount: number) {
  return `${trackCount} ${trackCount === 1 ? "track" : "tracks"}`;
}
