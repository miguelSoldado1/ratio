import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/use-debounce";
import { cn } from "@/lib/utils";
import { searchAlbums } from "@/server/functions/spotify-functions";

// --- Types ---

type AlbumResult = Awaited<ReturnType<typeof searchAlbums>>[number];

// --- Hooks ---

function useAlbumSearch(inputValue: string) {
  const debouncedQuery = useDebounce(inputValue.trim(), 300);
  const result = useQuery({
    queryKey: ["album-search", debouncedQuery],
    queryFn: () => searchAlbums({ data: { query: debouncedQuery } }),
    enabled: debouncedQuery.length >= 1,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: false,
  });

  return { ...result, debouncedQuery };
}

// --- Shared result list ---

interface SearchResultsProps {
  debouncedQuery: string;
  emptyMessage: string;
  isFetching: boolean;
  onSelect: (album: AlbumResult) => void;
  results: AlbumResult[];
}

function SearchResults({ results, isFetching, debouncedQuery, emptyMessage, onSelect }: SearchResultsProps) {
  if (isFetching && results.length === 0) {
    return <p className="px-4 py-3 text-muted-foreground text-sm">Searching…</p>;
  }

  if (!isFetching && debouncedQuery && results.length === 0) {
    return <p className="px-4 py-3 text-muted-foreground text-sm">No results for "{debouncedQuery}"</p>;
  }

  if (results.length === 0) {
    return <p className="px-4 py-3 text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <>
      {results.map((album) => (
        <AlbumResultItem album={album} key={album.id} onSelect={onSelect} />
      ))}
    </>
  );
}

// --- Shared result item ---

interface AlbumResultItemProps {
  album: AlbumResult;
  onSelect: (album: AlbumResult) => void;
}

function AlbumResultItem({ album, onSelect }: AlbumResultItemProps) {
  return (
    <div className="px-1 py-1 transition-colors hover:bg-accent">
      <button
        className="flex w-full min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-left"
        onClick={() => onSelect(album)}
        type="button"
      >
        <div className="size-9 shrink-0 overflow-hidden rounded bg-muted">
          {album.image && (
            <img
              alt={album.name}
              className="size-full object-cover"
              height={36}
              referrerPolicy="no-referrer"
              src={album.image}
              width={36}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground text-sm">{album.name}</p>
          <p className="truncate text-muted-foreground text-xs">
            {album.artists.map((a) => a.name).join(", ")}
            {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ""}
          </p>
        </div>
      </button>
    </div>
  );
}

function SpotifySearchSource({ className, href }: { className?: string; href: string }) {
  return (
    <a
      aria-label="Open search results on Spotify"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground/80 leading-none",
        "[transition:background-color_150ms_ease,color_150ms_ease,opacity_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:bg-muted/40 hover:text-muted-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.98]",
        className
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <span>Results from</span>
      <img
        alt=""
        className="block h-auto w-17.5 opacity-85"
        height={225}
        src="/spotify-full-logo-white.svg"
        width={823}
      />
    </a>
  );
}

function SearchSourceHeader({ className, query }: { className?: string; query: string }) {
  return (
    <div className={cn("flex items-center justify-between border-border/70 border-b px-4 py-2", className)}>
      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-widest">Albums</span>
      <SpotifySearchSource className="-mr-2" href={getSpotifySearchUrl(query)} />
    </div>
  );
}

// --- Desktop input with dropdown ---

interface AlbumSearchInputProps {
  className?: string;
  onSelect?: (album: AlbumResult) => void;
}

export function AlbumSearchInput({ className, onSelect }: AlbumSearchInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: results = [], isFetching, debouncedQuery } = useAlbumSearch(inputValue);

  const showDropdown = isOpen && inputValue.trim().length >= 1;

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search albums, artists…"
          spellCheck={false}
          type="search"
          value={inputValue}
        />
        {inputValue && (
          <button
            aria-label="Clear search"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-primary transition-opacity hover:opacity-70"
            onClick={() => {
              setInputValue("");
              setIsOpen(false);
            }}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="fade-in-0 slide-in-from-top-1 absolute top-full left-0 z-50 mt-1.5 flex max-h-[min(70vh,560px)] w-full animate-in flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg duration-150">
          <SearchSourceHeader query={inputValue} />
          <div className="scrollbar-thin overflow-y-auto [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
            <SearchResults
              debouncedQuery={debouncedQuery}
              emptyMessage=""
              isFetching={isFetching}
              onSelect={(a) => {
                onSelect?.(a);
                setIsOpen(false);
                setInputValue("");
              }}
              results={results}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Mobile full-screen overlay ---

interface AlbumSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (album: AlbumResult) => void;
}

export function AlbumSearchOverlay({ isOpen, onClose, onSelect }: AlbumSearchOverlayProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const { data: results = [], isFetching, debouncedQuery } = useAlbumSearch(inputValue);

  // Keep ref current without adding onClose to effect deps
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus input when overlay opens
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Escape key to close — stable dep array, no listener churn
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Clear input and close — used by all close code paths
  const handleClose = useCallback(() => {
    setInputValue("");
    onCloseRef.current();
  }, []);

  const handleResultSelect = useCallback(
    (a: AlbumResult) => {
      onSelect?.(a);
      handleClose();
    },
    [onSelect, handleClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fade-in-0 fixed inset-0 z-50 flex animate-in flex-col bg-background duration-150 lg:hidden">
      {/* Search bar */}
      <div className="flex items-center gap-3 border-border border-b px-4 py-3">
        <button
          aria-label="Back"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          onClick={handleClose}
          type="button"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search albums, artists…"
            ref={inputRef}
            spellCheck={false}
            type="search"
            value={inputValue}
          />
          {inputValue && (
            <button
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-primary transition-opacity hover:opacity-70"
              onClick={() => {
                setInputValue("");
                inputRef.current?.focus();
              }}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* Results */}
      {inputValue.trim() && <SearchSourceHeader query={inputValue} />}
      <div className="flex-1 overflow-y-auto">
        {inputValue.trim() ? (
          <SearchResults
            debouncedQuery={debouncedQuery}
            emptyMessage="Search for albums or artists"
            isFetching={isFetching}
            onSelect={handleResultSelect}
            results={results}
          />
        ) : (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">Search for albums or artists</p>
        )}
      </div>
    </div>
  );
}

function getSpotifySearchUrl(query: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(query.trim())}/albums`;
}
