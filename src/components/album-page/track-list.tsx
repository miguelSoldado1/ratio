import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { getAlbumDetails } from "@/server/functions/spotify-functions";

type SpotifyAlbumDetails = Awaited<ReturnType<typeof getAlbumDetails>>;
type SpotifyAlbumTrack = SpotifyAlbumDetails["tracks"][number];

/** Only collapse into a peek when the album has more tracks than this; shorter lists show in full. */
const PEEK_THRESHOLD = 3;

interface TrackListProps {
  className?: string;
  collapsible?: boolean;
  tracks: SpotifyAlbumTrack[];
}

export function TrackList({ className, collapsible = false, tracks }: TrackListProps) {
  if (collapsible) {
    return <CollapsibleTrackList className={className} tracks={tracks} />;
  }

  return (
    <section className={cn("pt-5", className)}>
      <h2 className="heading-section">Tracks</h2>
      <TrackGroups className="mt-3" tracks={tracks} />
    </section>
  );
}

function CollapsibleTrackList({ className, tracks }: { className?: string; tracks: SpotifyAlbumTrack[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMore = tracks.length > PEEK_THRESHOLD;

  return (
    <section className={cn("border-border/70 border-t pt-4", className)}>
      <h2 className="heading-section">Tracks</h2>
      {isExpanded || !hasMore ? (
        <TrackGroups className="mt-2" tracks={tracks} />
      ) : (
        <div className="mt-2 max-h-28 overflow-hidden [-webkit-mask-image:linear-gradient(to_bottom,#000_55%,transparent)] [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]">
          <TrackGroups tracks={tracks} />
        </div>
      )}
      {hasMore ? (
        <button
          aria-expanded={isExpanded}
          className="focus-ring press-feedback mt-1 flex w-full items-center justify-center gap-1 rounded-md py-2 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          type="button"
        >
          {isExpanded ? "Show less" : `Show all ${tracks.length} tracks`}
          <ChevronDown
            aria-hidden
            className={cn("size-4 transition-transform duration-200", isExpanded && "rotate-180")}
          />
        </button>
      ) : null}
    </section>
  );
}

function TrackGroups({ className, tracks }: { className?: string; tracks: SpotifyAlbumTrack[] }) {
  const trackGroups = getTrackGroups(tracks);
  const hasMultipleDiscs = trackGroups.length > 1;

  return (
    <div className={className}>
      {trackGroups.map((group, groupIndex) => (
        <div className={cn(groupIndex > 0 && "mt-5")} key={group.discNumber}>
          {hasMultipleDiscs ? (
            <div className="flex items-center gap-2 pb-1.5">
              <span className="font-medium text-2xs text-muted-foreground/90 tabular-nums">
                Disc {group.discNumber}
              </span>
              <span className="h-px flex-1 bg-border/60" />
              <span className="text-2xs text-muted-foreground-subtle tabular-nums">
                {getTrackCountLabel(group.tracks.length)}
              </span>
            </div>
          ) : null}
          <div className="divide-y divide-border/70">
            {group.tracks.map((track, trackIndex) => (
              <TrackRow key={track.id} label={hasMultipleDiscs ? track.trackNumber : trackIndex + 1} track={track} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrackRow({ label, track }: { label: number; track: SpotifyAlbumTrack }) {
  return (
    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3">
      <span className="text-muted-foreground text-xs tabular-nums">{label}</span>
      <span className="min-w-0 truncate font-medium text-sm">{track.title}</span>
      <span className="text-muted-foreground text-xs tabular-nums">{getTrackDuration(track)}</span>
    </div>
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
