import { cn } from "@/lib/utils";

interface SpotifyAttributionProps {
  ariaLabel?: string;
  className?: string;
  href?: string;
  label?: string;
  size?: "default" | "compact";
}

const SPOTIFY_URL = "https://open.spotify.com";

export function SpotifyAttribution({
  ariaLabel,
  className,
  href = SPOTIFY_URL,
  label,
  size = "default",
}: SpotifyAttributionProps) {
  const iconClassName = cn("size-[21px] shrink-0 opacity-85", size === "default" && "size-6");

  return (
    <a
      aria-label={ariaLabel ?? (label ? `${label} Spotify` : "Spotify")}
      className={cn(
        "inline-flex h-6 items-center gap-2 rounded-full border border-border/55 bg-muted/25 px-2 text-muted-foreground/80 leading-none",
        "[transition:background-color_150ms_ease,border-color_150ms_ease,color_150ms_ease,opacity_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:border-border hover:bg-muted/40 hover:text-muted-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.98]",
        size === "compact" ? "text-[10px]" : "h-7 px-2.5 text-xs",
        className
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label && <span>{label}</span>}
      <img alt="" className={iconClassName} height={225} src="/spotify-logo-icon-white.svg" width={236} />
    </a>
  );
}
