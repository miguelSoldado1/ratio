import { cn } from "@/lib/utils";

const STAR_POLYGON_POINTS = "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";

interface RatingStarIconProps {
  className?: string;
  emptyClassName?: string;
  filledClassName?: string;
  fillPercentage: number;
}

export function RatingStarIcon({
  className,
  emptyClassName = "stroke-primary",
  fillPercentage,
  filledClassName = "fill-primary stroke-primary",
}: RatingStarIconProps) {
  return (
    <span className={cn("relative inline-block shrink-0 text-primary", className)} data-slot="rating-star-icon">
      <svg aria-hidden="true" className="size-full" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon
          className={emptyClassName}
          fill="none"
          points={STAR_POLYGON_POINTS}
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <span className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - fillPercentage}% 0 0)` }}>
        <svg
          aria-hidden="true"
          className="size-full"
          fill="none"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon className={filledClassName} points={STAR_POLYGON_POINTS} strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </span>
    </span>
  );
}
