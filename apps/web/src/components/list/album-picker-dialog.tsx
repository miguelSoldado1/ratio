import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AlbumResultItem } from "@/components/global-search/album-result-item";
import { SearchResultSkeletonRows } from "@/components/global-search/search-result-skeleton";
import { SpotifySourceAttribution } from "@/components/spotify-source-attribution";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandList } from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { searchAlbums } from "@/server/functions/spotify-functions";
import type { AlbumResult } from "@/components/global-search/types";

const minSearchQueryLength = 2;
const searchDebounceMs = 500;

interface AlbumPickerDialogProps {
  addedAlbumIds: Set<string>;
  failedAlbumIds?: Set<string>;
  onOpenChange: (open: boolean) => void;
  onSelect: (album: AlbumResult) => Promise<boolean>;
  open: boolean;
  pendingAlbumIds?: Set<string>;
  remainingSlots: number;
}

export function AlbumPickerDialog({
  addedAlbumIds,
  failedAlbumIds = new Set(),
  onOpenChange,
  onSelect,
  open,
  pendingAlbumIds = new Set(),
  remainingSlots,
}: AlbumPickerDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const [addedThisSession, setAddedThisSession] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedInput = inputValue.trim();
  const debouncedQuery = useDebounce(trimmedInput, searchDebounceMs);
  const searchEnabled = open && debouncedQuery.length >= minSearchQueryLength;

  const searchAlbumsFn = useServerFn(searchAlbums);
  const {
    data: albumResults = [],
    error: albumSearchError,
    isFetching,
  } = useQuery({
    enabled: searchEnabled,
    meta: { suppressErrorToast: true },
    placeholderData: (previousData) => previousData,
    queryFn: () => searchAlbumsFn({ data: { query: debouncedQuery } }),
    queryKey: albumQueryKeys.search(debouncedQuery),
  });

  useEffect(() => {
    if (!open) {
      setInputValue("");
      return setAddedThisSession(0);
    }

    inputRef.current?.focus();
  }, [open]);

  async function handleSelect(album: AlbumResult) {
    if (addedAlbumIds.has(album.id) || pendingAlbumIds.has(album.id) || remainingSlots <= 0) return;

    const added = await onSelect(album);
    if (added) setAddedThisSession((count) => count + 1);
    inputRef.current?.focus();
  }

  return (
    <CommandDialog
      className="top-0 left-0 h-svh max-h-svh max-w-none translate-x-0 rounded-none! sm:top-18 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-4.5rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-4xl!"
      description="Search Spotify for albums to add to this list."
      onOpenChange={onOpenChange}
      open={open}
      title="Add albums"
    >
      <Command className="relative h-full rounded-none sm:h-auto sm:rounded-4xl" shouldFilter={false}>
        <div className="flex shrink-0 items-center gap-2 border-border/70 border-b p-3 sm:block sm:border-b-0 sm:p-0">
          <Button
            aria-label="Close album picker"
            className="shrink-0 text-muted-foreground hover:text-foreground sm:hidden"
            onClick={() => onOpenChange(false)}
            shape="pill"
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
            autoFocus
            inputGroupClassName="h-10 sm:h-11"
            onClear={() => {
              setInputValue("");
              inputRef.current?.focus();
            }}
            onValueChange={setInputValue}
            placeholder="Search albums..."
            ref={inputRef}
            spellCheck={false}
            value={inputValue}
            wrapperClassName="min-w-0 flex-1 p-0 sm:p-2 sm:pb-1"
          />
        </div>
        <CommandList className="max-h-none min-h-0 flex-1 scroll-py-2 sm:max-h-[min(60svh,26rem)] sm:flex-none">
          <AlbumPickerResults
            addedAlbumIds={addedAlbumIds}
            albumResults={albumResults}
            albumSearchError={albumSearchError}
            debouncedQuery={debouncedQuery}
            failedAlbumIds={failedAlbumIds}
            isFetching={isFetching}
            onSelect={handleSelect}
            pendingAlbumIds={pendingAlbumIds}
            remainingSlots={remainingSlots}
            trimmedInput={trimmedInput}
          />
        </CommandList>
        <div className="flex shrink-0 items-center justify-between gap-3 border-border/70 border-t px-4 py-2.5">
          <p className="min-w-0 text-muted-foreground text-xs">
            {getPickerFooterMessage({ addedThisSession, remainingSlots })}
          </p>
          <Button
            className="-mr-2 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Done
          </Button>
        </div>
      </Command>
    </CommandDialog>
  );
}

interface GetPickerFooterMessageParams {
  addedThisSession: number;
  remainingSlots: number;
}

function getPickerFooterMessage({ addedThisSession, remainingSlots }: GetPickerFooterMessageParams) {
  if (remainingSlots <= 0) return "This list is full.";
  if (addedThisSession === 0) return "Keep picking — this stays open so you can add several.";

  const albumLabel = addedThisSession === 1 ? "album" : "albums";

  return `${addedThisSession} ${albumLabel} added · ${remainingSlots} slots left`;
}

interface AlbumPickerResultsProps {
  addedAlbumIds: Set<string>;
  albumResults: AlbumResult[];
  albumSearchError: Error | null;
  debouncedQuery: string;
  failedAlbumIds: Set<string>;
  isFetching: boolean;
  onSelect: (album: AlbumResult) => void;
  pendingAlbumIds: Set<string>;
  remainingSlots: number;
  trimmedInput: string;
}

function AlbumPickerResults({
  addedAlbumIds,
  albumResults,
  albumSearchError,
  debouncedQuery,
  failedAlbumIds,
  isFetching,
  onSelect,
  pendingAlbumIds,
  remainingSlots,
  trimmedInput,
}: AlbumPickerResultsProps) {
  const hasResults = albumResults.length > 0;

  if (!trimmedInput) {
    return <CommandEmpty className="py-12 text-muted-foreground">Search Spotify for an album</CommandEmpty>;
  }

  if (isFetching && !hasResults) {
    return <SearchResultSkeletonRows />;
  }

  if (!hasResults) {
    return (
      <CommandEmpty className="text-muted-foreground">
        {albumSearchError?.message || `No results for "${debouncedQuery}"`}
      </CommandEmpty>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
        <span className="font-medium text-2xs text-muted-foreground uppercase tracking-widest">Albums</span>
        <SpotifySourceAttribution
          ariaLabel="Open search results on Spotify"
          className="-mr-2"
          href={`https://open.spotify.com/search/${encodeURIComponent(debouncedQuery.trim())}/albums`}
          label="Results from"
        />
      </div>
      <CommandGroup className="pt-0">
        {albumResults.map((album) => (
          <AlbumResultItem
            added={addedAlbumIds.has(album.id)}
            album={album}
            dimmed={isFetching}
            disabled={remainingSlots <= 0}
            error={failedAlbumIds.has(album.id)}
            key={album.id}
            onSelect={onSelect}
            pending={pendingAlbumIds.has(album.id)}
          />
        ))}
      </CommandGroup>
    </>
  );
}
