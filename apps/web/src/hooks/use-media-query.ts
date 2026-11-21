import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, defaultValue = false) {
  function subscribe(onChange: () => void) {
    const mediaQueryList = window.matchMedia(query);
    mediaQueryList.addEventListener("change", onChange);

    return () => mediaQueryList.removeEventListener("change", onChange);
  }

  function getSnapshot() {
    return window.matchMedia(query).matches;
  }

  function getServerSnapshot() {
    return defaultValue;
  }

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
