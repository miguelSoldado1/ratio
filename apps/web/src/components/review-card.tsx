import { Link } from "@tanstack/react-router";
import { ChevronDown, Heart, MessageCircle } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { AlbumArtwork } from "@/components/album-artwork";
import { RatingStarIcon } from "@/components/rating-star-icon";
import { ReviewShareButton } from "@/components/review-share-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useDebouncedOptimisticLike } from "@/hooks/use-debounced-optimistic-like";
import { formatRelativeTime } from "@/lib/date-format";
import { abbreviateCount, cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import type { OptimisticLikeToggleHandler } from "@/hooks/use-debounced-optimistic-like";

// --- Types ---

export interface ReviewUser {
  avatarUrl?: string;
  displayUsername: string;
  username?: string;
}

export interface ReviewAlbum {
  artist: string;
  coverUrl?: string;
  id: string;
  title: string;
  year: string;
}

export interface ReviewPermalink {
  reviewAuthorName: string;
  reviewId: string;
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

// --- Sub-components ---

function Root({ children, className, ...props }: ComponentProps<"article">) {
  return (
    <article className={cn("border-border border-b py-4 last-of-type:border-0", className)} {...props}>
      {children}
    </article>
  );
}

interface HeaderProps {
  className?: string;
  createdAt: Date;
  meta?: ReactNode;
  permalink?: ReviewPermalink;
  user: ReviewUser;
}

function Header({ user, createdAt, className, meta, permalink }: HeaderProps) {
  const displayNameClass = "font-medium text-foreground/75 text-sm";
  const identityClass = "flex min-w-0 items-center gap-2";
  const identityLinkClass = "group -ml-1.5 h-8 rounded-full px-1.5 pr-2.5 press-feedback hover:bg-primary/10";
  const relativeTime = formatRelativeTime(createdAt);

  return (
    <div className={cn("mb-3 flex items-center gap-2", className)}>
      {user.username ? (
        <Link
          className={cn(identityClass, identityLinkClass)}
          params={{ username: user.username }}
          to="/user/$username"
        >
          <UserAvatar className="size-6 text-2xs" name={user.displayUsername} src={user.avatarUrl} />
          <span className={cn(displayNameClass, "truncate transition-colors group-hover:text-primary")}>
            {user.displayUsername}
          </span>
        </Link>
      ) : (
        <div className={identityClass}>
          <UserAvatar className="size-6 text-2xs" name={user.displayUsername} src={user.avatarUrl} />
          <span className={displayNameClass}>{user.displayUsername}</span>
        </div>
      )}
      {permalink ? (
        <Link
          aria-label={`Open ${permalink.reviewAuthorName}'s review from ${relativeTime}`}
          className="focus-ring rounded-sm text-muted-foreground text-xs outline-none transition-colors hover:text-primary"
          params={{ reviewId: permalink.reviewId }}
          to="/review/$reviewId"
        >
          <time dateTime={createdAt.toISOString()}>{relativeTime}</time>
        </Link>
      ) : (
        <time className="text-muted-foreground text-xs" dateTime={createdAt.toISOString()}>
          {relativeTime}
        </time>
      )}
      {meta}
    </div>
  );
}

interface AlbumProps {
  album: ReviewAlbum;
  className?: string;
  linked?: boolean;
}

function Album({ album, linked, className }: AlbumProps) {
  const inner = (
    <>
      <AlbumArtwork
        alt={`${album.title} by ${album.artist}`}
        className="size-14"
        decoding="async"
        height={56}
        loading="lazy"
        src={album.coverUrl}
        width={56}
      />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="truncate font-semibold text-foreground text-sm leading-snug">{album.title}</p>
        <p className="mt-0.5 truncate text-muted-foreground text-xs">
          {album.artist} · {album.year}
        </p>
      </div>
    </>
  );

  if (linked) {
    return (
      <Link
        className={cn("flex min-w-0 items-start gap-3 transition-opacity hover:opacity-80", className)}
        params={{ albumId: album.id }}
        to="/album/$albumId"
      >
        {inner}
      </Link>
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
  const displayValue = Number.isInteger(value) ? value.toString() : value.toFixed(1);

  return (
    <div
      aria-label={`${displayValue} out of 5 stars`}
      className={cn("flex shrink-0 items-center gap-0.5", className)}
      role="img"
    >
      {stars.map((fillPercentage, i) => (
        <RatingStarIcon
          className="size-3.5"
          fillPercentage={fillPercentage}
          // biome-ignore lint/suspicious/noArrayIndexKey: static star list
          key={i}
        />
      ))}
      <span
        aria-hidden="true"
        className="ml-1 font-bold text-primary text-xs tabular-nums"
        data-slot="rating-star-value"
      >
        {displayValue}
      </span>
    </div>
  );
}

interface ReviewProps {
  children: ReactNode;
  className?: string;
  collapsed?: boolean;
  permalink?: ReviewPermalink;
}

// ~8 lines at the review's line-height (15px × 1.45 ≈ 21.75px). Keep in sync
// with the `max-h-44` (176px) clamp applied below.
const collapsedReviewMaxHeightPx = 176;

function Review({ children, className, collapsed = true, permalink }: ReviewProps) {
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

      if (!(review && collapsed)) return;

      updateCanToggle(review);

      const resizeObserver = new ResizeObserver(() => {
        if (reviewRef.current === review) {
          updateCanToggle(review);
        }
      });

      resizeObserver.observe(review);
      resizeObserverRef.current = resizeObserver;
    },
    [collapsed, updateCanToggle]
  );

  const reviewText = (
    <p
      className={cn(
        "wrap-break-word whitespace-pre-wrap text-[15px] text-foreground/90 leading-[1.45]",
        collapsed && !expanded && "max-h-44 overflow-hidden",
        className
      )}
      id={reviewId}
      ref={collapsed ? setReviewElement : undefined}
    >
      {children}
    </p>
  );

  return (
    <div className="mt-3">
      <div className="relative">
        {permalink ? (
          <Link
            aria-label={`Open ${permalink.reviewAuthorName}'s review`}
            className="focus-ring block rounded-sm outline-none"
            params={{ reviewId: permalink.reviewId }}
            to="/review/$reviewId"
          >
            {reviewText}
          </Link>
        ) : (
          reviewText
        )}
        {collapsed && canToggle ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-b from-[var(--review-fade-color,var(--background))]/0 via-[var(--review-fade-color,var(--background))]/80 to-[var(--review-fade-color,var(--background))] opacity-0 [transition:opacity_160ms_cubic-bezier(0.23,1,0.32,1)]",
              !expanded && "opacity-100"
            )}
          />
        ) : null}
      </div>
      {collapsed && canToggle ? (
        <button
          aria-controls={reviewId}
          aria-expanded={expanded}
          className="group/review-toggle press-feedback focus-ring mt-2 -ml-2 inline-flex h-7 items-center gap-1 rounded-full px-2 font-semibold text-primary text-sm outline-none hover:bg-primary/10 hover:text-primary/90"
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
  onShowLikes?: () => void;
  onToggle?: OptimisticLikeToggleHandler;
}

function getLikeHeartClass({ disabled, liked }: { disabled: boolean; liked: boolean }) {
  if (liked) return "fill-primary stroke-primary";
  if (disabled) return "stroke-muted-foreground/70";

  return "stroke-muted-foreground group-hover:stroke-primary";
}

function getLikeCountClass({ disabled, liked }: { disabled: boolean; liked: boolean }) {
  if (liked) return "text-primary";
  if (disabled) return "text-muted-foreground-subtle";

  return "text-muted-foreground group-hover:text-primary";
}

function getLikeButtonClass({ disabled }: { disabled: boolean }) {
  if (disabled) return "cursor-default";

  return "cursor-pointer press-feedback";
}

function Likes({ count, disabled = false, liked = false, onShowLikes, onToggle, className }: LikesProps) {
  const like = useDebouncedOptimisticLike({ count, liked, onToggle });
  const likeLabel = like.count === 1 ? "like" : "likes";
  const canShowLikes = like.count > 0 && Boolean(onShowLikes);

  const likeCount = (
    <span
      className={cn(
        "inline-block [transition:color_150ms_ease]",
        like.countDir === "up" && "animate-count-up",
        like.countDir === "down" && "animate-count-down"
      )}
      key={like.count}
    >
      {abbreviateCount(like.count)}
    </span>
  );

  return (
    <div className={cn("-ml-2 flex h-8 items-center", className)}>
      <Button
        aria-label={like.liked ? "Unlike review" : "Like review"}
        aria-pressed={like.liked}
        className={cn(
          "group -mr-1 hover:bg-transparent dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-3.5",
          getLikeButtonClass({ disabled })
        )}
        disabled={disabled}
        onClick={like.toggle}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Heart
          className={cn(
            "[transition:color_150ms_ease,fill_150ms_ease,stroke_150ms_ease]",
            like.justLiked && "animate-heart-pop",
            getLikeHeartClass({ disabled, liked: like.liked })
          )}
          data-icon="inline-start"
          onAnimationEnd={like.clearJustLiked}
        />
      </Button>
      {canShowLikes ? (
        <Button
          aria-label={`Show people who liked this review, ${like.count} ${likeLabel}`}
          className={cn(
            "h-8 pr-1 pl-0 text-xs tabular-nums hover:bg-transparent hover:text-primary dark:hover:bg-transparent",
            getLikeCountClass({ disabled: false, liked: like.liked })
          )}
          onClick={onShowLikes}
          size="sm"
          type="button"
          variant="ghost"
        >
          {likeCount}
        </Button>
      ) : (
        <span
          className={cn(
            "flex h-8 items-center px-1 text-xs tabular-nums",
            getLikeCountClass({ disabled, liked: like.liked })
          )}
        >
          {likeCount}
        </span>
      )}
    </div>
  );
}

interface FooterProps {
  children: ReactNode;
  className?: string;
}

function Footer({ children, className }: FooterProps) {
  return <div className={cn("mt-3 flex items-center gap-3", className)}>{children}</div>;
}

interface RepliesProps {
  replyCount?: number;
  reviewAuthorName: string;
  reviewId: string;
}

function Replies({ replyCount, reviewAuthorName, reviewId }: RepliesProps) {
  if (replyCount === undefined) return null;

  const replyLabel = replyCount === 1 ? "reply" : "replies";

  return (
    <div className="-ml-2 flex h-8 items-center">
      <Link
        aria-label={`View discussion of ${reviewAuthorName}'s review`}
        className="group/replies focus-ring press-feedback flex size-8 items-center justify-center rounded-full outline-none hover:bg-transparent [&_svg]:size-3.5"
        params={{ reviewId }}
        to="/review/$reviewId"
      >
        <MessageCircle
          aria-hidden="true"
          className="stroke-muted-foreground transition-colors group-hover/replies:stroke-primary"
        />
      </Link>
      <Link
        aria-label={`View discussion of ${reviewAuthorName}'s review, ${replyCount} ${replyLabel}`}
        className="focus-ring flex h-8 min-w-6 items-center justify-start rounded-sm pr-1 pl-0 text-muted-foreground text-xs tabular-nums outline-none transition-colors hover:text-primary"
        params={{ reviewId }}
        to="/review/$reviewId"
      >
        {abbreviateCount(replyCount)}
      </Link>
    </div>
  );
}

// --- Default composed component ---

interface ReviewCardProps extends ReviewData {
  className?: string;
}

function ReviewCard({ user, album, rating, review, likes, liked, createdAt, className }: ReviewCardProps) {
  return (
    <Root className={className}>
      <Header createdAt={createdAt} user={user} />
      <div className="flex items-start gap-3">
        <Album album={album} className="flex-1" linked />
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
ReviewCard.Replies = Replies;
ReviewCard.Likes = Likes;
ReviewCard.Share = ReviewShareButton;

export { ReviewCard };
