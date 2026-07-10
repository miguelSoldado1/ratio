import { useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook. On the client the first render already reflects the
 * real match (no post-mount flash); during SSR/hydration it uses `defaultValue`,
 * so pass the value that matches the layout rendered on the server.
 */
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
