import { Bookmark } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReviewDrawer } from "./review-drawer";

interface AlbumActionsProps {
  albumArtist?: string;
  albumTitle?: string;
  className?: string;
  spotifyUrl?: string;
}

export function AlbumActions({ albumArtist, albumTitle, className, spotifyUrl }: AlbumActionsProps) {
  return (
    <div
      className={cn("grid grid-cols-[1fr_auto_auto] gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3", className)}
    >
      <ReviewDrawer albumArtist={albumArtist} albumTitle={albumTitle} />
      {spotifyUrl ? (
        <a
          aria-label="Open album on Spotify"
          className={cn(
            buttonVariants({ size: "icon-lg", variant: "outline" }),
            "text-muted-foreground hover:border-primary/70 hover:bg-primary/10 hover:text-foreground"
          )}
          href={spotifyUrl}
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
      <Button
        aria-label="Bookmark album"
        className="text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground"
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Bookmark />
      </Button>
    </div>
  );
}
