import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { authClient } from "@/lib/auth/auth-client";
import { albumQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { searchUsers } from "@/server/functions/review-functions";
import { searchAlbums } from "@/server/functions/spotify-functions";
import { SearchResults } from "./search-results";
import type { AlbumResult, UserResult } from "./types";

interface GlobalSearchProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function GlobalSearch({ onOpenChange, open }: GlobalSearchProps) {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(inputValue.trim(), 500);

  const viewerUserId = session.data?.user.id;
  const searchEnabled = open && debouncedQuery.length >= 2;

  const searchAlbumsFn = useServerFn(searchAlbums);
  const {
    data: albumResults = [],
    error: albumSearchError,
    isFetching: isFetchingAlbums,
  } = useQuery({
    queryFn: () => searchAlbumsFn({ data: { query: debouncedQuery } }),
    queryKey: albumQueryKeys.search(debouncedQuery),
    enabled: searchEnabled,
    meta: { suppressErrorToast: true },
    placeholderData: (prev) => prev,
  });

  const searchUsersFn = useServerFn(searchUsers);
  const { data: userResults = [], isFetching: isFetchingUsers } = useQuery({
    queryFn: () => searchUsersFn({ data: { query: debouncedQuery } }),
    queryKey: userQueryKeys.search(debouncedQuery, viewerUserId),
    enabled: searchEnabled,
    placeholderData: (prev) => prev,
  });

  const trimmedInput = inputValue.trim();

  useEffect(() => {
    if (!open) {
      return setInputValue("");
    }

    inputRef.current?.focus();
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

  function handleAlbumSelect(album: AlbumResult) {
    navigate({ to: "/album/$albumId", params: { albumId: album.id } });
    onOpenChange(false);
  }

  function handleUserSelect(user: UserResult) {
    navigate({ to: "/user/$username", params: { username: user.username } });
    onOpenChange(false);
  }

  function handleClearSearch() {
    setInputValue("");
    inputRef.current?.focus();
  }

  return (
    <CommandDialog
      className="top-0 left-0 h-svh max-h-svh max-w-none translate-x-0 rounded-none! sm:top-18 sm:left-1/2 sm:h-auto sm:max-h-[calc(100svh-4.5rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-4xl!"
      description="Search albums and users."
      onOpenChange={onOpenChange}
      open={open}
      title="Search"
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
            autoFocus
            inputGroupClassName="h-10 sm:h-11"
            onClear={handleClearSearch}
            onValueChange={setInputValue}
            placeholder="Search..."
            ref={inputRef}
            spellCheck={false}
            value={inputValue}
            wrapperClassName="min-w-0 flex-1 p-0 sm:p-2 sm:pb-1"
          />
        </div>
        <CommandList className="max-h-none min-h-0 flex-1 scroll-py-2 sm:max-h-[min(68svh,32rem)] sm:flex-none">
          {trimmedInput ? (
            <SearchResults
              albumResults={albumResults}
              albumSearchError={albumSearchError}
              debouncedQuery={debouncedQuery}
              isFetchingAlbums={isFetchingAlbums}
              isFetchingUsers={isFetchingUsers}
              onSelect={handleAlbumSelect}
              onUserSelect={handleUserSelect}
              userResults={userResults}
            />
          ) : (
            <CommandEmpty className="py-12 text-muted-foreground">Search for albums or users</CommandEmpty>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
