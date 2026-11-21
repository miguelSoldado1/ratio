import { createContext, useCallback, useContext, useState } from "react";
import { GlobalSearch } from "./global-search";
import type { ReactNode } from "react";

const OpenGlobalSearchContext = createContext<(() => void) | null>(null);

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);

  return (
    <OpenGlobalSearchContext value={openSearch}>
      <GlobalSearch onOpenChange={setOpen} open={open} />
      {children}
    </OpenGlobalSearchContext>
  );
}

export function useOpenGlobalSearch() {
  const openSearch = useContext(OpenGlobalSearchContext);
  if (!openSearch) throw new Error("useOpenGlobalSearch must be used within GlobalSearchProvider");

  return openSearch;
}
