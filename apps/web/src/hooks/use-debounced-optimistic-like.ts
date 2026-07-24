import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

// Constants

const likePersistDebounceMs = 350;

// Types

export type OptimisticLikeToggleHandler = (liked: boolean) => boolean | Promise<boolean | undefined> | undefined;

interface OptimisticLikeState {
  count: number;
  liked: boolean;
}

interface UseDebouncedOptimisticLikeParams {
  count: number;
  liked: boolean;
  onToggle?: OptimisticLikeToggleHandler;
}

// Hook

export function useDebouncedOptimisticLike({ count, liked, onToggle }: UseDebouncedOptimisticLikeParams) {
  const [optimisticLiked, setOptimisticLiked] = useState(liked);
  const [optimisticCount, setOptimisticCount] = useState(count);
  const [justLiked, setJustLiked] = useState(false);
  const [countDir, setCountDir] = useState<"up" | "down" | null>(null);
  const debouncedLiked = useDebounce(optimisticLiked, likePersistDebounceMs);
  const latestLikedRef = useRef(liked);
  const persistedStateRef = useRef<OptimisticLikeState>({ count, liked });
  const inFlightLikedRef = useRef<boolean | null>(null);
  const queuedLikedRef = useRef<boolean | null>(null);
  const rollbackStateRef = useRef<OptimisticLikeState | null>(null);

  useEffect(() => {
    const authoritativeState = { count, liked };

    persistedStateRef.current = authoritativeState;

    if (rollbackStateRef.current) {
      rollbackStateRef.current = authoritativeState;
      return;
    }

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
    const previousState = rollbackStateRef.current ?? persistedStateRef.current;

    rollbackStateRef.current = null;
    queuedLikedRef.current = null;
    latestLikedRef.current = previousState.liked;
    restoreOptimisticLike(previousState);
  }, [restoreOptimisticLike]);

  const takeQueuedLikedToPersist = useCallback(() => {
    const queuedLiked = queuedLikedRef.current;

    queuedLikedRef.current = null;

    return queuedLiked === persistedStateRef.current.liked ? null : queuedLiked;
  }, []);

  const checkpointPersistedLike = useCallback(
    (persistedLiked: boolean) => {
      const previousPersistedState = persistedStateRef.current;
      if (previousPersistedState.liked !== persistedLiked) {
        persistedStateRef.current = {
          count: Math.max(0, previousPersistedState.count + (persistedLiked ? 1 : -1)),
          liked: persistedLiked,
        };
      }

      const nextLikedToPersist = takeQueuedLikedToPersist();
      if (nextLikedToPersist !== null) {
        rollbackStateRef.current = persistedStateRef.current;
        return nextLikedToPersist;
      }

      if (latestLikedRef.current === persistedLiked) {
        rollbackStateRef.current = null;
        restoreOptimisticLike(persistedStateRef.current);
      } else {
        rollbackStateRef.current = persistedStateRef.current;
      }

      return null;
    },
    [restoreOptimisticLike, takeQueuedLikedToPersist]
  );

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

        nextLikedToPersist = checkpointPersistedLike(currentLikedToPersist);
      }
    },
    [checkpointPersistedLike, onToggle, rollbackOptimisticLike]
  );

  useEffect(() => {
    if (!(onToggle && rollbackStateRef.current)) return;

    if (inFlightLikedRef.current !== null) {
      queuedLikedRef.current = debouncedLiked;
      return;
    }

    if (debouncedLiked === persistedStateRef.current.liked) {
      if (latestLikedRef.current === persistedStateRef.current.liked) {
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

    if (next === persistedStateRef.current.liked && inFlightLikedRef.current === null) {
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
