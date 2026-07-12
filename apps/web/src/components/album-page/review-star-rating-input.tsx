import { useEffect, useRef } from "react";
import { RatingStarIcon } from "@/components/rating-star-icon";
import { cn } from "@/lib/utils";
import type { KeyboardEvent, PointerEvent, Ref } from "react";

const MAX_RATING = 5;
const RATING_STEP = 0.5;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

interface ReviewStarRatingInputProps {
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
  className?: string;
  controlRef?: Ref<HTMLDivElement>;
  id?: string;
  onChange: (value: number) => void;
  value: number;
}

export function ReviewStarRatingInput({
  ariaDescribedBy,
  ariaLabelledBy,
  className,
  controlRef,
  id,
  onChange,
  value,
}: ReviewStarRatingInputProps) {
  const starTrackRef = useRef<HTMLSpanElement>(null);
  const isDraggingRef = useRef(false);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  const latestOnChangeRef = useRef(onChange);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestOnChangeRef.current = onChange;
    latestValueRef.current = value;
  }, [onChange, value]);

  useEffect(
    () => () => {
      const cleanup = cleanupDragRef.current;
      cleanupDragRef.current = null;
      cleanup?.();
    },
    []
  );

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    startWindowDragTracking();
    updateRatingFromPointer(event.clientX);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    updateRatingFromPointer(event.clientX);
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    isDraggingRef.current = false;
    cleanupDragListeners();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nextValue = getKeyboardRatingValue(event.key, value);

    if (nextValue === null) return;

    event.preventDefault();
    onChange(nextValue);
  }

  function updateRatingFromPointer(clientX: number) {
    const nextValue = getPointerRatingValue(clientX, starTrackRef.current);

    if (nextValue !== latestValueRef.current) {
      latestValueRef.current = nextValue;
      latestOnChangeRef.current(nextValue);
    }
  }

  function startWindowDragTracking() {
    cleanupDragListeners();

    function handleWindowPointerMove(event: globalThis.PointerEvent) {
      if (!isDraggingRef.current) return;
      updateRatingFromPointer(event.clientX);
    }

    function handleWindowPointerEnd() {
      isDraggingRef.current = false;
      cleanupDragListeners();
    }

    window.addEventListener("pointermove", handleWindowPointerMove, { capture: true });
    window.addEventListener("pointerup", handleWindowPointerEnd, { capture: true, once: true });
    window.addEventListener("pointercancel", handleWindowPointerEnd, { capture: true, once: true });

    cleanupDragRef.current = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove, { capture: true });
      window.removeEventListener("pointerup", handleWindowPointerEnd, { capture: true });
      window.removeEventListener("pointercancel", handleWindowPointerEnd, { capture: true });
    };
  }

  function cleanupDragListeners() {
    const cleanup = cleanupDragRef.current;
    cleanupDragRef.current = null;
    cleanup?.();
  }

  return (
    <div
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      aria-valuemax={MAX_RATING}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={getRatingLabel(value)}
      className={cn(
        "flex w-fit! cursor-pointer touch-none select-none items-center gap-3 rounded-2xl outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
      id={id}
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={controlRef}
      role="slider"
      tabIndex={0}
    >
      <span aria-hidden="true" className="flex items-center gap-1" data-slot="review-star-track" ref={starTrackRef}>
        {STAR_VALUES.map((starValue) => (
          <RatingStar fillPercentage={getStarFillPercentage(starValue, value)} key={starValue} />
        ))}
      </span>
      <span className="min-w-10 text-right font-medium text-primary text-sm tabular-nums">
        {value > 0 ? value.toFixed(1) : "--"}
      </span>
    </div>
  );
}

function RatingStar({ fillPercentage }: { fillPercentage: number }) {
  return (
    <RatingStarIcon
      className="size-9 transition-transform duration-150"
      emptyClassName="stroke-primary/50"
      fillPercentage={fillPercentage}
    />
  );
}

function getPointerRatingValue(clientX: number, element: HTMLSpanElement | null) {
  if (!element) return 0;

  const bounds = element.getBoundingClientRect();

  if (bounds.width === 0) return 0;

  const position = Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
  const rawRating = (position / bounds.width) * MAX_RATING;
  const steppedRating = Math.ceil(rawRating / RATING_STEP) * RATING_STEP;

  return clampRating(Math.max(RATING_STEP, steppedRating));
}

function getKeyboardRatingValue(key: string, value: number) {
  if (key === "ArrowRight" || key === "ArrowUp") return clampRating(value + RATING_STEP);
  if (key === "ArrowLeft" || key === "ArrowDown") return clampRating(value - RATING_STEP);
  if (key === "PageUp") return clampRating(value + 1);
  if (key === "PageDown") return clampRating(value - 1);
  if (key === "Home") return 0;
  if (key === "End") return MAX_RATING;
  if (key === "Backspace" || key === "Delete") return 0;

  return null;
}

function getStarFillPercentage(starValue: number, rating: number) {
  const fill = Math.min(Math.max(rating - (starValue - 1), 0), 1);
  return fill * 100;
}

function getRatingLabel(value: number) {
  if (value === 0) return "No rating";
  if (value === 1) return "1 star out of 5";
  return `${value.toFixed(1)} stars out of 5`;
}

function clampRating(value: number) {
  return Math.min(Math.max(Number(value.toFixed(1)), 0), MAX_RATING);
}
