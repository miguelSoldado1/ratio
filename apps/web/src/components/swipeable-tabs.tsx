import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  ComponentProps,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  UIEvent as ReactUIEvent,
  RefObject,
} from "react";

const INSTANT_SCROLL_UNLOCK_MS = 50;
const PROGRAMMATIC_SCROLL_UNLOCK_MS = 500;
const SCROLL_SETTLE_FALLBACK_MS = 120;
const SWIPE_DIRECTION_LOCK_PX = 8;
const SWIPE_DISTANCE_RATIO = 0.15;
const SWIPE_MAX_DISTANCE_PX = 64;
const SWIPE_VELOCITY_PX_PER_MS = 0.25;

interface SwipeGesture {
  axis: "horizontal" | "pending" | "vertical";
  pointerId: number;
  startLeft: number;
  startTime: number;
  startX: number;
  startY: number;
}

interface SwipeableTabsContextValue {
  cancelProgrammaticScroll: () => void;
  count: number;
  headerHeight: number;
  headerRef: RefObject<HTMLDivElement | null>;
  idBase: string;
  indicatorRef: RefObject<HTMLSpanElement | null>;
  listHeight: number;
  listRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  setActiveFromScroll: (value: string) => void;
  setCount: (count: number) => void;
  setHeaderHeight: (height: number) => void;
  setListHeight: (height: number) => void;
  syncActivePanelHeader: (panel: HTMLDivElement | null) => void;
  syncScrollHeader: (scrollTop: number) => void;
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
type SwipeableTabsHeaderProps = Omit<ComponentProps<"div">, "ref">;
type SwipeableTabsListProps = Omit<ComponentProps<typeof TabsList>, "ref" | "variant">;
type SwipeableTabsTriggerProps = ComponentProps<typeof TabsTrigger>;
type SwipeableTabsContentProps = Omit<
  ComponentProps<"div">,
  "aria-hidden" | "data-value" | "id" | "inert" | "ref" | "role" | "tabIndex"
> & {
  value: string;
};
type SwipeableTabsViewportProps = Omit<
  ComponentProps<"div">,
  | "onClickCapture"
  | "onPointerCancel"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onScroll"
  | "onScrollEnd"
  | "onWheel"
  | "ref"
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
  const [headerHeight, setHeaderHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const headerOffsetRef = useRef(0);
  const idBase = useId();
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const keyboardNavigationRef = useRef(false);
  const programmaticTargetRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

  const syncScrollHeader = useCallback(
    (scrollTop: number) => {
      const offset = Math.min(Math.max(scrollTop, 0), headerHeight);
      headerOffsetRef.current = offset;

      for (const panel of Array.from(scrollerRef.current?.children ?? []) as HTMLElement[]) {
        if (offset < headerHeight) {
          if (panel.scrollTop !== offset) panel.scrollTop = offset;
        } else if (panel.scrollTop < offset) {
          panel.scrollTop = offset;
        }
      }

      const transform = `translate3d(0, ${-offset}px, 0)`;
      if (headerRef.current) headerRef.current.style.transform = transform;
      if (listRef.current) listRef.current.style.transform = transform;
    },
    [headerHeight]
  );

  const syncActivePanelHeader = useCallback(
    (panel: HTMLDivElement | null) => {
      if (!panel) return;

      const headerOffset = headerOffsetRef.current;
      const headerVisible = headerOffset < headerHeight;
      if (headerVisible) {
        panel.scrollTop = headerOffset;
        syncScrollHeader(headerOffset);
        return;
      }

      if (panel.scrollTop < headerOffset) panel.scrollTop = headerOffset;
      syncScrollHeader(Math.max(panel.scrollTop, headerOffset));
    },
    [headerHeight, syncScrollHeader]
  );

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
      headerHeight,
      headerRef,
      idBase,
      indicatorRef,
      listHeight,
      listRef,
      scrollerRef,
      setActiveFromScroll,
      setCount,
      setHeaderHeight,
      setListHeight,
      syncActivePanelHeader,
      syncScrollHeader,
      value,
    }),
    [
      cancelProgrammaticScroll,
      count,
      headerHeight,
      idBase,
      listHeight,
      setActiveFromScroll,
      syncActivePanelHeader,
      syncScrollHeader,
      value,
    ]
  );

  return (
    <SwipeableTabsContext.Provider value={context}>
      <Tabs
        className={cn("relative min-h-0 gap-0", className)}
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

function SwipeableTabsHeader({ className, onFocusCapture, ...props }: SwipeableTabsHeaderProps) {
  const { headerRef, scrollerRef, setHeaderHeight } = useSwipeableTabs();

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const updateHeight = () => setHeaderHeight(header.offsetHeight);
    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(header);

    return () => {
      resizeObserver.disconnect();
      setHeaderHeight(0);
    };
  }, [headerRef, setHeaderHeight]);

  function handleFocusCapture(event: ReactFocusEvent<HTMLDivElement>) {
    const activePanel = Array.from(scrollerRef.current?.children ?? []).find(
      (panel) => !(panel as HTMLElement).inert
    ) as HTMLElement | undefined;
    if (activePanel?.scrollTop) activePanel.scrollTo({ behavior: "auto", top: 0 });
    onFocusCapture?.(event);
  }

  return (
    <div
      className={cn("absolute inset-x-0 top-0 z-20 bg-background will-change-transform", className)}
      data-swipeable-tabs-header=""
      onFocusCapture={handleFocusCapture}
      ref={headerRef}
      {...props}
    />
  );
}

function SwipeableTabsList({ children, className, style, ...props }: SwipeableTabsListProps) {
  const { count, headerHeight, indicatorRef, listRef, setListHeight } = useSwipeableTabs();

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const updateHeight = () => setListHeight(list.offsetHeight);
    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(list);

    return () => resizeObserver.disconnect();
  }, [listRef, setListHeight]);

  return (
    <div
      className="absolute left-[calc(50%-50vw)] z-50 w-screen border-border/70 border-b bg-background will-change-transform"
      data-swipeable-tabs-list=""
      ref={listRef}
      style={{ ...style, top: headerHeight - 1 }}
    >
      <TabsList
        className={cn("relative mx-auto flex w-full gap-0 lg:w-fit", className)}
        data-swipeable-tabs-controls=""
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
    </div>
  );
}

function SwipeableTabsTrigger({ className, value, ...props }: SwipeableTabsTriggerProps) {
  const { idBase } = useSwipeableTabs();
  const stringValue = String(value);

  return (
    <TabsTrigger
      aria-controls={`${idBase}-panel-${stringValue}`}
      className={cn("after:hidden lg:min-w-36 lg:flex-none", className)}
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
  const clickSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const swipeGestureRef = useRef<SwipeGesture | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const settleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scrollSettleTimerRef.current !== null) {
      clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = null;
    }
    if (swipeGestureRef.current?.axis === "horizontal") return;
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

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    cancelProgrammaticScroll();
    if (!(event.isPrimary && event.pointerType !== "mouse") || swipeGestureRef.current) return;

    swipeGestureRef.current = {
      axis: "pending",
      pointerId: event.pointerId,
      startLeft: event.currentTarget.scrollLeft,
      startTime: event.timeStamp,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = swipeGestureRef.current;
    if (!(gesture && gesture.pointerId === event.pointerId)) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (gesture.axis === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_DIRECTION_LOCK_PX) return;
      gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";

      if (gesture.axis === "horizontal") {
        event.currentTarget.style.scrollSnapType = "none";
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    if (gesture.axis !== "horizontal") return;

    event.preventDefault();
    const maxScrollLeft = event.currentTarget.scrollWidth - event.currentTarget.clientWidth;
    event.currentTarget.scrollLeft = Math.max(0, Math.min(gesture.startLeft - deltaX, maxScrollLeft));
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const gesture = swipeGestureRef.current;
    if (!(gesture && gesture.pointerId === event.pointerId)) return;
    swipeGestureRef.current = null;

    if (gesture.axis !== "horizontal") return;

    event.preventDefault();
    const scroller = event.currentTarget;
    scroller.style.scrollSnapType = "";
    if (scroller.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);

    const deltaX = event.clientX - gesture.startX;
    const elapsed = Math.max(event.timeStamp - gesture.startTime, 1);
    const velocity = Math.abs(deltaX) / elapsed;
    const distanceThreshold = Math.min(scroller.clientWidth * SWIPE_DISTANCE_RATIO, SWIPE_MAX_DISTANCE_PX);
    const startIndex = Math.round(gesture.startLeft / scroller.clientWidth);
    const shouldChangeTab =
      !cancelled && (Math.abs(deltaX) >= distanceThreshold || velocity >= SWIPE_VELOCITY_PX_PER_MS);
    const direction = deltaX < 0 ? 1 : -1;
    const targetIndex = shouldChangeTab ? Math.max(0, Math.min(startIndex + direction, count - 1)) : startIndex;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    suppressClickRef.current = true;
    if (clickSuppressTimerRef.current !== null) clearTimeout(clickSuppressTimerRef.current);
    clickSuppressTimerRef.current = setTimeout(() => {
      suppressClickRef.current = false;
      clickSuppressTimerRef.current = null;
    }, 0);

    scroller.scrollTo({ behavior: reduceMotion ? "auto" : "smooth", left: targetIndex * scroller.clientWidth });
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

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
      if (clickSuppressTimerRef.current !== null) clearTimeout(clickSuppressTimerRef.current);
      if (scrollSettleTimerRef.current !== null) clearTimeout(scrollSettleTimerRef.current);
    };
  }, [count, scrollerRef, setCount]);

  return (
    <div
      className={cn(
        "scrollbar-none relative left-[calc(50%-50vw)] flex min-h-0 w-screen flex-1 touch-pan-y snap-x snap-mandatory items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      data-swipeable-tabs-viewport=""
      onClickCapture={handleClickCapture}
      onPointerCancel={(event) => handlePointerEnd(event, true)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
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

function SwipeableTabsContent({ children, className, onScroll, style, value, ...props }: SwipeableTabsContentProps) {
  const {
    headerHeight,
    idBase,
    listHeight,
    syncActivePanelHeader,
    syncScrollHeader,
    value: activeValue,
  } = useSwipeableTabs();
  const active = value === activeValue;
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (active) syncActivePanelHeader(panelRef.current);
  }, [active, syncActivePanelHeader]);

  function handleScroll(event: ReactUIEvent<HTMLDivElement>) {
    if (active) syncScrollHeader(event.currentTarget.scrollTop);
    onScroll?.(event);
  }

  return (
    <div
      aria-hidden={!active}
      aria-labelledby={`${idBase}-tab-${value}`}
      className={cn(
        "h-full min-w-0 flex-[0_0_100%] snap-start overflow-y-auto overscroll-y-contain px-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      data-swipeable-tabs-scroll-panel=""
      data-value={value}
      id={`${idBase}-panel-${value}`}
      inert={!active}
      onScroll={handleScroll}
      ref={panelRef}
      role="tabpanel"
      style={{ ...style, paddingTop: Math.max(headerHeight + listHeight - 1, 0) }}
      tabIndex={active ? 0 : -1}
      {...props}
    >
      <div data-swipeable-tabs-content-inner="" style={{ minHeight: `calc(100% + ${headerHeight}px)` }}>
        {children}
      </div>
    </div>
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

export {
  SwipeableTabs,
  SwipeableTabsContent,
  SwipeableTabsHeader,
  SwipeableTabsList,
  SwipeableTabsTrigger,
  SwipeableTabsViewport,
};
