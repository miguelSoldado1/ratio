import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// --- Types ---

export interface ReviewUser {
  avatarUrl?: string;
  name: string;
  username: string;
}

export interface ReviewAlbum {
  artist: string;
  coverUrl?: string;
  id: string;
  title: string;
  year: string;
}

export interface ReviewData {
  album: ReviewAlbum;
  createdAt: Date;
  id: string;
  rating: number; // 1–5 (half-star increments)
  review?: string;
  user: ReviewUser;
}

// --- Helpers ---

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const w = Math.floor(d / 7);
  const mo = Math.floor(d / 30);
  const yr = Math.floor(d / 365);

  if (yr > 0) return `${yr}yr`;
  if (mo > 0) return `${mo}mo`;
  if (w > 0) return `${w}w`;
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "just now";
}

// --- Sub-components ---

function Root({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("border-border border-b py-5 last:border-0", className)}>{children}</article>;
}

interface HeaderProps {
  className?: string;
  createdAt: Date;
  href?: string;
  user: ReviewUser;
}

function Header({ user, createdAt, href, className }: HeaderProps) {
  const avatarClass =
    "flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-[11px] text-muted-foreground uppercase";
  const usernameClass = "font-medium text-foreground text-sm";
  const avatarContent = user.avatarUrl ? (
    <img
      alt={user.name}
      className="size-full object-cover"
      height={24}
      referrerPolicy="no-referrer"
      src={user.avatarUrl}
      width={24}
    />
  ) : (
    <span>{user.name.charAt(0)}</span>
  );

  return (
    <div className={cn("mb-3 flex items-center gap-2.5", className)}>
      {href ? (
        <a className={cn(avatarClass, "transition-opacity hover:opacity-80")} href={href}>
          {avatarContent}
        </a>
      ) : (
        <div className={avatarClass}>{avatarContent}</div>
      )}
      {href ? (
        <a className={cn(usernameClass, "transition-colors hover:text-primary")} href={href}>
          {user.username}
        </a>
      ) : (
        <span className={usernameClass}>{user.username}</span>
      )}
      <span className="text-muted-foreground text-xs">{relativeTime(createdAt)}</span>
    </div>
  );
}

interface AlbumProps {
  album: ReviewAlbum;
  className?: string;
  href?: string;
}

function Album({ album, href, className }: AlbumProps) {
  const inner = (
    <>
      <div className="size-14 shrink-0 overflow-hidden bg-muted">
        {album.coverUrl ? (
          <img
            alt={`${album.title} by ${album.artist}`}
            className="size-full object-cover"
            height={56}
            referrerPolicy="no-referrer"
            src={album.coverUrl}
            width={56}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="truncate font-semibold text-foreground text-sm leading-snug">{album.title}</p>
        <p className="mt-0.5 truncate text-muted-foreground text-xs">
          {album.artist} · {album.year}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <a className={cn("flex min-w-0 items-start gap-3 transition-opacity hover:opacity-80", className)} href={href}>
        {inner}
      </a>
    );
  }

  return <div className={cn("flex min-w-0 items-start gap-3", className)}>{inner}</div>;
}

interface RatingProps {
  className?: string;
  value: number;
}

function Rating({ value, className }: RatingProps) {
  const uid = useId();
  const stars = Array.from({ length: 5 }, (_, i) => {
    const fill = Math.min(Math.max(value - i, 0), 1);
    if (fill >= 1) {
      return "full";
    }
    if (fill >= 0.5) {
      return "half";
    }
    return "empty";
  });

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {stars.map((type, i) => (
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          // biome-ignore lint/suspicious/noArrayIndexKey: static star list
          key={i}
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {type === "full" && (
            <polygon
              className="fill-primary stroke-primary"
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          )}
          {type === "half" && (
            <>
              <defs>
                <linearGradient id={`${uid}-half-${i}`}>
                  <stop className="text-primary" offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <polygon
                className="stroke-primary"
                fill={`url(#${uid}-half-${i})`}
                points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </>
          )}
          {type === "empty" && (
            <polygon
              className="stroke-primary"
              fill="none"
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          )}
        </svg>
      ))}
      <span className="ml-1 font-bold text-primary text-xs tabular-nums">
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    </div>
  );
}

interface ReviewProps {
  children: ReactNode;
  className?: string;
}

function Review({ children, className }: ReviewProps) {
  return <p className={cn("mt-3 text-muted-foreground text-sm leading-relaxed", className)}>{children}</p>;
}

// --- Default composed component ---

interface ReviewCardProps extends ReviewData {
  className?: string;
}

function ReviewCard({ user, album, rating, review, createdAt, className }: ReviewCardProps) {
  return (
    <Root className={className}>
      <Header createdAt={createdAt} href={`/user/${user.username}`} user={user} />
      <div className="flex items-start gap-3">
        <Album album={album} className="flex-1" href={`/album/${album.id}`} />
        <Rating value={rating} />
      </div>
      {review ? <Review>{review}</Review> : null}
    </Root>
  );
}

ReviewCard.Root = Root;
ReviewCard.Header = Header;
ReviewCard.Album = Album;
ReviewCard.Rating = Rating;
ReviewCard.Review = Review;

export { ReviewCard };
