import { cn } from "@/lib/utils";

interface SpotifySourceAttributionProps {
  ariaLabel: string;
  className?: string;
  href: string;
  label: string;
}

export function SpotifySourceAttribution({ ariaLabel, className, href, label }: SpotifySourceAttributionProps) {
  return (
    <a
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-2xs text-muted-foreground-subtle leading-none",
        "[transition:background-color_150ms_ease,color_150ms_ease,opacity_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:bg-muted/40 hover:text-muted-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.98]",
        className
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <span>{label}</span>
      <img
        alt=""
        className="block h-auto w-17.5 opacity-85"
        height={225}
        src="/brand/spotify-full-logo-white.svg"
        width={823}
      />
    </a>
  );
}
