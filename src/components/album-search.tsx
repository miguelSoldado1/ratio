import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import { searchAlbums } from "@/server/functions/spotify-functions";

type AlbumResult = Awaited<ReturnType<typeof searchAlbums>>[number];

interface AlbumSearchCommandProps {
  onOpenChange: (open: boolean) => void;
  onSelect?: (album: AlbumResult) => void;
  open: boolean;
}

export function AlbumSearchCommand({ onOpenChange, onSelect, open }: AlbumSearchCommandProps) {
  const [inputValue, setInputValue] = useState("");
  const debouncedQuery = useDebounce(inputValue.trim(), 300);

  const searchAlbumsFn = useServerFn(searchAlbums);
  const { data: results = [], isFetching } = useQuery({
    queryFn: () => searchAlbumsFn({ data: { query: debouncedQuery } }),
    queryKey: albumQueryKeys.search(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
    placeholderData: (prev) => prev,
  });

  const trimmedInput = inputValue.trim();

  useEffect(() => {
    if (!open) {
      setInputValue("");
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTyping = target?.closest("input, textarea, select, [contenteditable='true']");

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        onOpenChange(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  function handleSelect(album: AlbumResult) {
    onSelect?.(album);
    onOpenChange(false);
  }

  return (
    <CommandDialog
      className="top-0 left-0 h-svh max-h-svh max-w-none translate-x-0 rounded-none! sm:top-18 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-4.5rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-4xl!"
      description="Search albums."
      onOpenChange={onOpenChange}
      open={open}
      title="Search albums"
    >
      <Command className="relative h-full rounded-none sm:h-auto sm:rounded-4xl" shouldFilter={false}>
        <div className="flex shrink-0 items-center gap-2 border-border/70 border-b p-3 sm:block sm:border-b-0 sm:p-0">
          <Button
            aria-label="Go back"
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground sm:hidden"
            onClick={() => onOpenChange(false)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeft />
          </Button>
          <CommandInput
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            inputGroupClassName="h-10 sm:h-11"
            onValueChange={setInputValue}
            placeholder="Search albums..."
            spellCheck={false}
            value={inputValue}
            wrapperClassName="min-w-0 flex-1 p-0 sm:p-2 sm:pb-1"
          />
        </div>
        {trimmedInput ? <SearchSourceHeader query={trimmedInput} /> : null}
        <CommandList className="max-h-none min-h-0 flex-1 scroll-py-2 sm:max-h-[min(68svh,32rem)] sm:flex-none">
          {trimmedInput ? (
            <SearchResults
              debouncedQuery={debouncedQuery}
              isFetching={isFetching}
              onSelect={handleSelect}
              results={results}
            />
          ) : (
            <CommandEmpty className="py-12 text-muted-foreground">Search for albums</CommandEmpty>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

interface AlbumSearchTriggerProps {
  className?: string;
  compact?: boolean;
  onOpen: () => void;
}

export function AlbumSearchTrigger({ className, compact = false, onOpen }: AlbumSearchTriggerProps) {
  if (compact) {
    return (
      <Button
        aria-keyshortcuts="/"
        aria-label="Search albums"
        className={cn("rounded-3xl text-muted-foreground hover:text-foreground active:scale-[0.97]", className)}
        onClick={onOpen}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Search />
      </Button>
    );
  }

  return (
    <Button
      aria-keyshortcuts="/"
      aria-label="Search albums"
      className={cn(
        "group h-10 w-full justify-start rounded-4xl border-border/70 bg-card/40 px-2.5 text-muted-foreground shadow-none transition-[background-color,border-color,transform] hover:border-border hover:bg-muted/60 hover:text-foreground active:scale-[0.99]",
        className
      )}
      onClick={onOpen}
      type="button"
      variant="outline"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Search data-icon="inline-start" />
        <span className="truncate text-sm">Search albums...</span>
      </span>
    </Button>
  );
}

interface SearchResultsProps {
  debouncedQuery: string;
  isFetching: boolean;
  onSelect: (album: AlbumResult) => void;
  results: AlbumResult[];
}

function SearchResults({ results, isFetching, debouncedQuery, onSelect }: SearchResultsProps) {
  if (isFetching && results.length === 0) {
    return <CommandEmpty className="text-muted-foreground">Searching...</CommandEmpty>;
  }

  if (!isFetching && debouncedQuery && results.length === 0) {
    return <CommandEmpty className="text-muted-foreground">No results for "{debouncedQuery}"</CommandEmpty>;
  }

  if (results.length === 0) {
    return <CommandEmpty className="text-muted-foreground">Search for albums</CommandEmpty>;
  }

  return (
    <CommandGroup className="pt-3">
      {results.map((album) => (
        <AlbumResultItem album={album} key={album.id} onSelect={onSelect} />
      ))}
      {isFetching ? <p className="px-3 py-2 text-muted-foreground text-xs">Updating results...</p> : null}
    </CommandGroup>
  );
}

interface AlbumResultItemProps {
  album: AlbumResult;
  onSelect: (album: AlbumResult) => void;
}

function AlbumResultItem({ album, onSelect }: AlbumResultItemProps) {
  const artists = album.artists.map((artist) => artist.name).join(", ");

  return (
    <CommandItem className="items-center gap-3 py-2.5" onSelect={() => onSelect(album)} value={album.id}>
      <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {album.image ? (
          <img
            alt={album.name}
            className="size-full object-cover"
            height={40}
            referrerPolicy="no-referrer"
            src={album.image}
            width={40}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium text-foreground text-sm">{album.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {artists}
          {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ""}
        </p>
      </div>
    </CommandItem>
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
    <div className={cn("flex shrink-0 items-center justify-between border-border/70 border-b px-4 py-2", className)}>
      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-widest">Albums</span>
      <SpotifySearchSource className="-mr-2" href={getSpotifySearchUrl(query)} />
    </div>
  );
}

function getSpotifySearchUrl(query: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(query.trim())}/albums`;
}
