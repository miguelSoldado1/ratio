import { Heart, PencilLine, Plus } from "lucide-react";
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
      <Button className="bg-[#1DB954] px-5 text-[#06150b] hover:bg-[#41d873]" size="lg" type="button">
        <PencilLine className="size-4" />
        Add a review
      </Button>
      {spotifyUrl ? (
        <a
          aria-label="Open album on Spotify"
          className={cn(
            buttonVariants({ size: "icon-lg", variant: "outline" }),
            "text-muted-foreground hover:border-[#1DB954]/70 hover:bg-[#1DB954]/10 hover:text-foreground"
          )}
          href={spotifyUrl}
          rel="noreferrer"
          target="_blank"
          title="Open in Spotify"
        >
          <img alt="" className="size-[21px] opacity-90" height={225} src="/spotify-logo-icon-white.svg" width={236} />
        </a>
      ) : null}
      <Button
        aria-label="Save album"
        className="text-muted-foreground hover:border-[#B7B2A8]/60 hover:text-foreground"
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Plus className="size-5" />
      </Button>
      <Button
        aria-label="Like album"
        className="text-muted-foreground hover:border-[#FF6B4A]/70 hover:text-[#FF6B4A]"
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Heart className="size-5" />
      </Button>
    </div>
  );
}
