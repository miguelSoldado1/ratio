import { Bookmark, PencilLine } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AlbumActionsProps {
  className?: string;
  compact?: boolean;
  spotifyUrl?: string;
}

export function AlbumActions({ className, compact = false, spotifyUrl }: AlbumActionsProps) {
  return (
    <div
      className={cn(
        compact ? "grid grid-cols-[1fr_auto_auto_auto] gap-2" : "flex flex-wrap items-center gap-3",
        className
      )}
    >
      <Button className="px-5" size="lg" type="button">
        <PencilLine className="size-4" />
        Add a review
      </Button>
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
        <Bookmark className="size-5" />
      </Button>
    </div>
  );
}
