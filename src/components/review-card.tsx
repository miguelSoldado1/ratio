import { ChevronDown, Heart } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RatingStarIcon } from "@/components/rating-star-icon";
import { UserAvatar } from "@/components/user-avatar";
import { useDebounce } from "@/hooks/use-debounce";
import { abbreviateCount, cn } from "@/lib/utils";
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
  liked?: boolean;
  likes?: number;
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
  const usernameClass = "font-medium text-foreground/75 text-sm";
  const identityClass = "flex min-w-0 items-center gap-2";
  const identityLinkClass =
    "group -ml-1.5 h-8 rounded-full px-1.5 pr-2.5 [transition:color_150ms_ease,background-color_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:bg-primary/10 active:scale-[0.98]";

  return (
    <div className={cn("mb-3 flex items-center gap-2", className)}>
      {href ? (
        <a className={cn(identityClass, identityLinkClass)} href={href}>
          <UserAvatar className="size-6 text-[11px]" height={24} name={user.name} src={user.avatarUrl} />
          <span className={cn(usernameClass, "truncate transition-colors group-hover:text-primary")}>
            {user.username}
          </span>
        </a>
      ) : (
        <div className={identityClass}>
          <UserAvatar className="size-6 text-[11px]" height={24} name={user.name} src={user.avatarUrl} />
          <span className={usernameClass}>{user.username}</span>
        </div>
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
  const stars = Array.from({ length: 5 }, (_, i) => Math.min(Math.max(value - i, 0), 1) * 100);

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      {stars.map((fillPercentage, i) => (
        <RatingStarIcon
          className="size-3.5"
          fillPercentage={fillPercentage}
          // biome-ignore lint/suspicious/noArrayIndexKey: static star list
          key={i}
        />
      ))}
      <span className="ml-1 font-bold text-primary text-xs tabular-nums" data-slot="rating-star-value">
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    </div>
  );
}

interface ReviewProps {
  children: ReactNode;
  className?: string;
}

const collapsedReviewMaxHeightPx = 160;

function Review({ children, className }: ReviewProps) {
  const reviewId = useId();
  const reviewRef = useRef<HTMLParagraphElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);

  const updateCanToggle = useCallback((review: HTMLParagraphElement) => {
    const nextCanToggle = review.scrollHeight > collapsedReviewMaxHeightPx + 1;

    setCanToggle((currentCanToggle) => (currentCanToggle === nextCanToggle ? currentCanToggle : nextCanToggle));
  }, []);

  const setReviewElement = useCallback(
    (review: HTMLParagraphElement | null) => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      reviewRef.current = review;

      if (!review) return;

      updateCanToggle(review);

      const resizeObserver = new ResizeObserver(() => {
        if (reviewRef.current === review) {
          updateCanToggle(review);
        }
      });

      resizeObserver.observe(review);
      resizeObserverRef.current = resizeObserver;
    },
    [updateCanToggle]
  );

  return (
    <div className="mt-3">
      <div className="relative">
        <p
          className={cn(
            "wrap-break-word whitespace-pre-wrap text-[15px] text-foreground/90 leading-[1.45]",
            !expanded && "max-h-40 overflow-hidden",
            className
          )}
          id={reviewId}
          ref={setReviewElement}
        >
          {children}
        </p>
        {canToggle ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-b from-background/0 via-background/80 to-background opacity-0 [transition:opacity_160ms_cubic-bezier(0.23,1,0.32,1)]",
              !expanded && "opacity-100"
            )}
          />
        ) : null}
      </div>
      {canToggle ? (
        <button
          aria-controls={reviewId}
          aria-expanded={expanded}
          className="group/review-toggle mt-2 -ml-2 inline-flex h-7 items-center gap-1 rounded-full px-2 font-semibold text-primary text-sm outline-none [transition:color_150ms_ease,background-color_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:bg-primary/10 hover:text-primary/90 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.97]"
          onClick={() => setExpanded((isExpanded) => !isExpanded)}
          type="button"
        >
          <span>{expanded ? "Show less" : "Show more"}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 [transition:transform_180ms_cubic-bezier(0.23,1,0.32,1)]",
              expanded && "rotate-180"
            )}
          />
        </button>
      ) : null}
    </div>
  );
}

interface LikesProps {
  className?: string;
  count: number;
  disabled?: boolean;
  liked?: boolean;
  onToggle?: (liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
}

interface OptimisticLikeState {
  count: number;
  liked: boolean;
}

interface UseDebouncedOptimisticLikeParams {
  count: number;
  liked: boolean;
  onToggle?: LikesProps["onToggle"];
}

const likePersistDebounceMs = 350;

function getLikeHeartClass({ disabled, liked }: { disabled: boolean; liked: boolean }) {
  if (liked) return "fill-primary stroke-primary";
  if (disabled) return "stroke-muted-foreground/70";

  return "stroke-muted-foreground group-hover:stroke-primary";
}

function getLikeCountClass({ disabled, liked }: { disabled: boolean; liked: boolean }) {
  if (liked) return "text-primary";
  if (disabled) return "text-muted-foreground/80";

  return "text-muted-foreground group-hover:text-primary";
}

function getLikeButtonClass({ disabled }: { disabled: boolean }) {
  if (disabled) return "cursor-default";

  return "cursor-pointer hover:bg-primary/10 active:scale-[0.97]";
}

function useDebouncedOptimisticLike({ count, liked, onToggle }: UseDebouncedOptimisticLikeParams) {
  const [optimisticLiked, setOptimisticLiked] = useState(liked);
  const [optimisticCount, setOptimisticCount] = useState(count);
  const [justLiked, setJustLiked] = useState(false);
  const [countDir, setCountDir] = useState<"up" | "down" | null>(null);
  const debouncedLiked = useDebounce(optimisticLiked, likePersistDebounceMs);
  const latestLikedRef = useRef(liked);
  const persistedLikedRef = useRef(liked);
  const inFlightLikedRef = useRef<boolean | null>(null);
  const queuedLikedRef = useRef<boolean | null>(null);
  const rollbackStateRef = useRef<OptimisticLikeState | null>(null);

  useEffect(() => {
    persistedLikedRef.current = liked;

    if (rollbackStateRef.current) return;

    setOptimisticLiked(liked);
    setOptimisticCount(count);
    latestLikedRef.current = liked;
  }, [count, liked]);

  const applyOptimisticLike = useCallback((nextLiked: boolean) => {
    setOptimisticLiked(nextLiked);
    setOptimisticCount((currentCount) => Math.max(0, currentCount + (nextLiked ? 1 : -1)));
    setCountDir(nextLiked ? "up" : "down");
    if (nextLiked) setJustLiked(true);
  }, []);

  const restoreOptimisticLike = useCallback((previousState: OptimisticLikeState) => {
    setOptimisticLiked(previousState.liked);
    setOptimisticCount(previousState.count);
    setCountDir(previousState.liked ? "up" : "down");
  }, []);

  const rollbackOptimisticLike = useCallback(() => {
    const previousState = rollbackStateRef.current;

    rollbackStateRef.current = null;
    queuedLikedRef.current = null;
    latestLikedRef.current = previousState?.liked ?? liked;

    if (previousState) {
      restoreOptimisticLike(previousState);
    }
  }, [liked, restoreOptimisticLike]);

  const takeQueuedLikedToPersist = useCallback(() => {
    const queuedLiked = queuedLikedRef.current;

    queuedLikedRef.current = null;

    return queuedLiked === persistedLikedRef.current ? null : queuedLiked;
  }, []);

  const persistLikeChange = useCallback(
    async (likedToPersist: boolean) => {
      if (!onToggle) return;

      if (inFlightLikedRef.current !== null) {
        queuedLikedRef.current = likedToPersist;
        return;
      }

      let nextLikedToPersist: boolean | null = likedToPersist;

      while (nextLikedToPersist !== null) {
        const currentLikedToPersist: boolean = nextLikedToPersist;

        nextLikedToPersist = null;
        inFlightLikedRef.current = currentLikedToPersist;

        const shouldKeepOptimisticState = await Promise.resolve()
          .then(() => onToggle(currentLikedToPersist))
          .catch(() => false);
        inFlightLikedRef.current = null;

        if (shouldKeepOptimisticState === false) {
          rollbackOptimisticLike();
          return;
        }

        persistedLikedRef.current = currentLikedToPersist;
        nextLikedToPersist = takeQueuedLikedToPersist();

        if (nextLikedToPersist !== null) {
          continue;
        }

        if (latestLikedRef.current === currentLikedToPersist) {
          rollbackStateRef.current = null;
        }
      }
    },
    [onToggle, rollbackOptimisticLike, takeQueuedLikedToPersist]
  );

  useEffect(() => {
    if (!(onToggle && rollbackStateRef.current)) return;

    if (inFlightLikedRef.current !== null) {
      queuedLikedRef.current = debouncedLiked;
      return;
    }

    if (debouncedLiked === persistedLikedRef.current) {
      if (latestLikedRef.current === persistedLikedRef.current) {
        rollbackStateRef.current = null;
        queuedLikedRef.current = null;
      }
      return;
    }

    persistLikeChange(debouncedLiked).catch(() => undefined);
  }, [debouncedLiked, onToggle, persistLikeChange]);

  const toggle = useCallback(() => {
    const previousState = { count: optimisticCount, liked: optimisticLiked };
    const next = !optimisticLiked;

    latestLikedRef.current = next;
    applyOptimisticLike(next);

    if (!onToggle) return;

    if (!rollbackStateRef.current) {
      rollbackStateRef.current = previousState;
    }

    if (next === persistedLikedRef.current && inFlightLikedRef.current === null) {
      rollbackStateRef.current = null;
      queuedLikedRef.current = null;
    }
  }, [applyOptimisticLike, optimisticCount, optimisticLiked, onToggle]);

  const clearJustLiked = useCallback(() => setJustLiked(false), []);

  return {
    clearJustLiked,
    count: optimisticCount,
    countDir,
    justLiked,
    liked: optimisticLiked,
    toggle,
  };
}

function Likes({ count, disabled = false, liked = false, onToggle, className }: LikesProps) {
  const like = useDebouncedOptimisticLike({ count, liked, onToggle });

  return (
    <button
      aria-label={like.liked ? "Unlike review" : "Like review"}
      aria-pressed={like.liked}
      className={cn(
        "group -ml-2 flex h-8 items-center gap-1.5 rounded-full px-2 [transition:color_150ms_ease,background-color_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)]",
        getLikeButtonClass({ disabled }),
        className
      )}
      disabled={disabled}
      onClick={like.toggle}
      type="button"
    >
      <Heart
        className={cn(
          "size-3.5 [transition:color_150ms_ease,fill_150ms_ease,stroke_150ms_ease]",
          like.justLiked && "animate-heart-pop",
          getLikeHeartClass({ disabled, liked: like.liked })
        )}
        onAnimationEnd={like.clearJustLiked}
      />
      <span
        className={cn(
          "text-[13px] tabular-nums [transition:color_150ms_ease]",
          like.countDir === "up" && "animate-count-up",
          like.countDir === "down" && "animate-count-down",
          getLikeCountClass({ disabled, liked: like.liked })
        )}
        key={like.count}
      >
        {abbreviateCount(like.count)}
      </span>
    </button>
  );
}

interface FooterProps {
  children: ReactNode;
  className?: string;
}

function Footer({ children, className }: FooterProps) {
  return <div className={cn("mt-3 flex items-center gap-3", className)}>{children}</div>;
}

// --- Default composed component ---

interface ReviewCardProps extends ReviewData {
  className?: string;
}

function ReviewCard({ user, album, rating, review, likes, liked, createdAt, className }: ReviewCardProps) {
  return (
    <Root className={className}>
      <Header createdAt={createdAt} href={`/user/${user.username}`} user={user} />
      <div className="flex items-start gap-3">
        <Album album={album} className="flex-1" href={`/album/${album.id}`} />
        <Rating value={rating} />
      </div>
      {review ? <Review>{review}</Review> : null}
      {likes === undefined ? null : (
        <Footer>
          <Likes count={likes} liked={liked} />
        </Footer>
      )}
    </Root>
  );
}

ReviewCard.Root = Root;
ReviewCard.Header = Header;
ReviewCard.Album = Album;
ReviewCard.Rating = Rating;
ReviewCard.Review = Review;
ReviewCard.Footer = Footer;
ReviewCard.Likes = Likes;

export { ReviewCard };
