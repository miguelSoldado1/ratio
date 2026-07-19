import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebouncedOptimisticLike } from "@/hooks/use-debounced-optimistic-like";
import { abbreviateCount, cn } from "@/lib/utils";
import type { OptimisticLikeToggleHandler } from "@/hooks/use-debounced-optimistic-like";

interface ReplyLikeButtonProps {
  authorName: string;
  disabled: boolean;
  liked: boolean;
  likes: number;
  onShowLikes?: () => void;
  onToggle: OptimisticLikeToggleHandler;
}

export function ReplyLikeButton({ authorName, disabled, liked, likes, onShowLikes, onToggle }: ReplyLikeButtonProps) {
  const like = useDebouncedOptimisticLike({ count: likes, liked, onToggle });

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
    <div className="-ml-2 flex h-8 items-center">
      <Button
        aria-label={`${like.liked ? "Unlike" : "Like"} reply by ${authorName}`}
        aria-pressed={like.liked}
        className="group press-feedback -mr-1 text-muted-foreground hover:bg-transparent hover:text-primary dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-3.5"
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
            like.liked && "fill-primary stroke-primary"
          )}
          onAnimationEnd={like.clearJustLiked}
        />
      </Button>
      {canShowLikes ? (
        <Button
          aria-label={`Show people who liked this reply by ${authorName}, ${like.count} ${likeLabel}`}
          className="h-8 pr-1 pl-0 text-muted-foreground text-xs tabular-nums hover:bg-transparent hover:text-primary dark:hover:bg-transparent"
          onClick={onShowLikes}
          size="sm"
          type="button"
          variant="ghost"
        >
          {likeCount}
        </Button>
      ) : (
        <span className="flex h-8 items-center px-1 text-muted-foreground text-xs tabular-nums">{likeCount}</span>
      )}
    </div>
  );
}
