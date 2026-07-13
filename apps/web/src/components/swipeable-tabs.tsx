import { Children, createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ComponentProps, KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

const INSTANT_SCROLL_UNLOCK_MS = 50;
const PROGRAMMATIC_SCROLL_UNLOCK_MS = 500;
const SCROLL_SETTLE_FALLBACK_MS = 120;

interface SwipeableTabsContextValue {
  cancelProgrammaticScroll: () => void;
  count: number;
  idBase: string;
  indicatorRef: RefObject<HTMLSpanElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  setActiveFromScroll: (value: string) => void;
  setCount: (count: number) => void;
  value: string;
}

const SwipeableTabsContext = createContext<SwipeableTabsContextValue | null>(null);

type SwipeableTabsProps = Omit<
  ComponentProps<typeof Tabs>,
  "defaultValue" | "onKeyDownCapture" | "onValueChange" | "orientation" | "ref" | "value"
> & {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  value?: string;
};
type SwipeableTabsListProps = Omit<ComponentProps<typeof TabsList>, "variant">;
type SwipeableTabsTriggerProps = ComponentProps<typeof TabsTrigger>;
type SwipeableTabsContentProps = Omit<
  ComponentProps<"div">,
  "aria-hidden" | "data-value" | "id" | "inert" | "role" | "tabIndex"
> & {
  value: string;
};
type SwipeableTabsViewportProps = Omit<
  ComponentProps<"div">,
  "onPointerDown" | "onScroll" | "onScrollEnd" | "onWheel" | "ref"
>;

function useSwipeableTabs() {
  const context = useContext(SwipeableTabsContext);
  if (!context) throw new Error("SwipeableTabs components must be used within SwipeableTabs");
  return context;
}

function SwipeableTabs({
  children,
  className,
  defaultValue,
  onValueChange,
  value: controlledValue,
  ...props
}: SwipeableTabsProps) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolledValue;
  const [count, setCount] = useState(0);
  const idBase = useId();
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const keyboardNavigationRef = useRef(false);
  const programmaticTargetRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollActivationRef = useRef(false);
  const scrollDrivenValueRef = useRef<string | null>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelProgrammaticScroll = useCallback(() => {
    programmaticTargetRef.current = null;
    if (unlockTimerRef.current !== null) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }, []);

  const scrollToValue = useCallback(
    (nextValue: string, behavior: ScrollBehavior = "smooth") => {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const panels = Array.from(scroller.children) as HTMLElement[];
      const panelIndex = panels.findIndex((panel) => panel.dataset.value === nextValue);
      if (panelIndex === -1) return;

      const nextLeft = panelIndex * scroller.clientWidth;
      if (Math.abs(scroller.scrollLeft - nextLeft) < 1) return;

      programmaticTargetRef.current = nextValue;
      if (unlockTimerRef.current !== null) clearTimeout(unlockTimerRef.current);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const resolvedBehavior = reduceMotion ? "auto" : behavior;
      scroller.scrollTo({ behavior: resolvedBehavior, left: nextLeft });

      unlockTimerRef.current = setTimeout(
        cancelProgrammaticScroll,
        resolvedBehavior === "smooth" ? PROGRAMMATIC_SCROLL_UNLOCK_MS : INSTANT_SCROLL_UNLOCK_MS
      );
    },
    [cancelProgrammaticScroll]
  );

  const setActiveFromScroll = useCallback((nextValue: string) => {
    const root = rootRef.current;
    if (!root) return;

    const trigger = Array.from(root.querySelectorAll<HTMLElement>("[data-swipeable-tabs-trigger]")).find(
      (element) =>
        element.dataset.value === nextValue &&
        element.closest("[data-swipeable-tabs-root]") === root &&
        !(element.matches(":disabled") || element.getAttribute("aria-disabled") === "true")
    );
    if (!trigger) return;

    scrollDrivenValueRef.current = nextValue;
    scrollActivationRef.current = true;
    try {
      trigger.click();
    } finally {
      scrollActivationRef.current = false;
    }
  }, []);

  function handleValueChange(nextValue: string | number) {
    const next = String(nextValue);
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);

    if (!scrollActivationRef.current) {
      scrollDrivenValueRef.current = null;
      scrollToValue(next, keyboardNavigationRef.current ? "auto" : "smooth");
    }
  }

  function handleKeyDownCapture(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!(isTabsListTarget(event.target) && isTabNavigationKey(event.key))) return;

    keyboardNavigationRef.current = true;
    queueMicrotask(() => {
      keyboardNavigationRef.current = false;
    });
  }

  useEffect(() => {
    if (!value) return;

    if (scrollDrivenValueRef.current === value) {
      scrollDrivenValueRef.current = null;
      return;
    }
    if (programmaticTargetRef.current === value) return;

    scrollToValue(value);
  }, [scrollToValue, value]);

  useEffect(() => cancelProgrammaticScroll, [cancelProgrammaticScroll]);

  const context = useMemo<SwipeableTabsContextValue>(
    () => ({
      cancelProgrammaticScroll,
      count,
      idBase,
      indicatorRef,
      scrollerRef,
      setActiveFromScroll,
      setCount,
      value,
    }),
    [cancelProgrammaticScroll, count, idBase, setActiveFromScroll, value]
  );

  return (
    <SwipeableTabsContext.Provider value={context}>
      <Tabs
        className={cn("min-h-0 gap-0", className)}
        data-swipeable-tabs-root=""
        defaultValue={defaultValue}
        onKeyDownCapture={handleKeyDownCapture}
        onValueChange={handleValueChange}
        orientation="horizontal"
        ref={rootRef}
        value={controlledValue}
        {...props}
      >
        {children}
      </Tabs>
    </SwipeableTabsContext.Provider>
  );
}

function SwipeableTabsList({ children, className, ...props }: SwipeableTabsListProps) {
  const { count, indicatorRef } = useSwipeableTabs();

  return (
    <TabsList
      className={cn("relative w-full border-border/70 border-b", className)}
      data-swipeable-tabs-list=""
      variant="line"
      {...props}
    >
      {children}
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-foreground"
          ref={indicatorRef}
          style={{ width: `${100 / count}%` }}
        />
      ) : null}
    </TabsList>
  );
}

function SwipeableTabsTrigger({ className, value, ...props }: SwipeableTabsTriggerProps) {
  const { idBase } = useSwipeableTabs();
  const stringValue = String(value);

  return (
    <TabsTrigger
      aria-controls={`${idBase}-panel-${stringValue}`}
      className={cn("after:hidden", className)}
      data-swipeable-tabs-trigger=""
      data-value={stringValue}
      id={`${idBase}-tab-${stringValue}`}
      value={value}
      {...props}
    />
  );
}

function SwipeableTabsViewport({ children, className, ...props }: SwipeableTabsViewportProps) {
  const { cancelProgrammaticScroll, indicatorRef, scrollerRef, setActiveFromScroll, setCount, value } =
    useSwipeableTabs();
  const count = Children.count(children);
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const settleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scrollSettleTimerRef.current !== null) {
      clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = null;
    }
    if (!(scroller && count > 0 && scroller.clientWidth > 0)) return;

    const panelIndex = Math.round(scroller.scrollLeft / scroller.clientWidth);
    const nearestPanel = scroller.children[panelIndex] as HTMLElement | undefined;
    const nextValue = nearestPanel?.dataset.value;
    if (!nextValue) return;

    cancelProgrammaticScroll();
    if (nextValue !== valueRef.current) setActiveFromScroll(nextValue);
  }, [cancelProgrammaticScroll, count, scrollerRef, setActiveFromScroll]);

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!(scroller && count > 0)) return;

    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    const progress = maxScroll > 0 ? (scroller.scrollLeft / maxScroll) * (count - 1) : 0;
    if (indicatorRef.current) {
      indicatorRef.current.style.transform = `translate3d(${progress * 100}%, 0, 0)`;
    }

    if (scrollSettleTimerRef.current !== null) clearTimeout(scrollSettleTimerRef.current);
    scrollSettleTimerRef.current = setTimeout(settleScroll, SCROLL_SETTLE_FALLBACK_MS);
  }, [count, indicatorRef, scrollerRef, settleScroll]);

  const handleScrollRef = useRef(handleScroll);
  handleScrollRef.current = handleScroll;

  useEffect(() => {
    setCount(count);

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const panels = Array.from(scroller.children) as HTMLElement[];
    const activeIndex = panels.findIndex((panel) => panel.dataset.value === valueRef.current);
    if (activeIndex >= 0) scroller.scrollLeft = activeIndex * scroller.clientWidth;
    handleScrollRef.current();

    const resizeObserver = new ResizeObserver(() => handleScrollRef.current());
    resizeObserver.observe(scroller);

    return () => {
      resizeObserver.disconnect();
      if (scrollSettleTimerRef.current !== null) clearTimeout(scrollSettleTimerRef.current);
    };
  }, [count, scrollerRef, setCount]);

  return (
    <div
      className={cn(
        "scrollbar-none -mx-0.5 flex min-h-0 flex-1 snap-x snap-mandatory items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      data-swipeable-tabs-viewport=""
      onPointerDown={cancelProgrammaticScroll}
      onScroll={handleScroll}
      onScrollEnd={settleScroll}
      onWheel={cancelProgrammaticScroll}
      ref={scrollerRef}
      {...props}
    >
      {children}
    </div>
  );
}

function SwipeableTabsContent({ className, value, ...props }: SwipeableTabsContentProps) {
  const { idBase, value: activeValue } = useSwipeableTabs();
  const active = value === activeValue;

  return (
    <div
      aria-hidden={!active}
      aria-labelledby={`${idBase}-tab-${value}`}
      className={cn("h-full min-w-0 flex-[0_0_100%] snap-start overflow-y-auto overscroll-y-contain px-0.5", className)}
      data-swipeable-tabs-scroll-panel=""
      data-value={value}
      id={`${idBase}-panel-${value}`}
      inert={!active}
      role="tabpanel"
      tabIndex={active ? 0 : -1}
      {...props}
    />
  );
}

function isTabsListTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest("[data-swipeable-tabs-list]"));
}

function isTabNavigationKey(key: string) {
  return (
    key === "ArrowLeft" || key === "ArrowRight" || key === "End" || key === "Enter" || key === "Home" || key === " "
  );
}

export { SwipeableTabs, SwipeableTabsContent, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsViewport };
