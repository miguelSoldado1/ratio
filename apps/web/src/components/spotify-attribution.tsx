import { cn } from "@/lib/utils";

interface SpotifyAttributionProps {
  ariaLabel?: string;
  className?: string;
  href?: string;
  variant?: "full" | "icon";
}

const SPOTIFY_URL = "https://open.spotify.com";

export function SpotifyAttribution({
  ariaLabel = "Spotify",
  className,
  href = SPOTIFY_URL,
  variant = "full",
}: SpotifyAttributionProps) {
  return (
    <a
      aria-label={ariaLabel}
      className={cn(
        "focus-ring inline-flex shrink-0 items-center rounded-sm opacity-55 transition-opacity hover:opacity-100",
        className
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {variant === "full" ? (
        <img alt="" className="h-5 w-auto" height={225} src="/brand/spotify-full-logo-white.svg" width={823} />
      ) : (
        <img alt="" className="size-5" height={225} src="/brand/spotify-logo-icon-white.svg" width={236} />
      )}
    </a>
  );
}
