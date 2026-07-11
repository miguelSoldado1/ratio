import { CommandEmpty, CommandGroup } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { AlbumResultItem } from "./album-result-item";
import { SearchResultSkeletonRows } from "./search-result-skeleton";
import { UserResultItem } from "./user-result-item";
import type { AlbumResult, UserResult } from "./types";

const albumResultsBeforeUsersLimit = 5;
const albumSearchFallbackErrorMessage = "Album search failed. Try again in a moment.";

interface SearchResultsProps {
  albumResults: AlbumResult[];
  albumSearchError: Error | null;
  debouncedQuery: string;
  isFetchingAlbums: boolean;
  isFetchingUsers: boolean;
  onSelect: (album: AlbumResult) => void;
  onUserSelect: (user: UserResult) => void;
  userResults: UserResult[];
}

export function SearchResults({
  albumResults,
  albumSearchError,
  isFetchingAlbums,
  isFetchingUsers,
  debouncedQuery,
  onSelect,
  onUserSelect,
  userResults,
}: SearchResultsProps) {
  const hasAlbumResults = albumResults.length > 0;
  const hasUserResults = userResults.length > 0;
  const hasResults = hasAlbumResults || hasUserResults;
  const isFetching = isFetchingAlbums || isFetchingUsers;
  const visibleAlbumResults = hasUserResults ? albumResults.slice(0, albumResultsBeforeUsersLimit) : albumResults;
  const shouldShowAlbumSection = hasAlbumResults || isFetchingAlbums;
  const hasSearchableQuery = debouncedQuery.length >= 2;
  const shouldDimAlbumResults = isFetchingAlbums && hasAlbumResults;

  if (isFetching && !hasResults) {
    return <SearchResultSkeletonRows />;
  }

  if (!isFetching && hasSearchableQuery && !hasResults) {
    return (
      <CommandEmpty className="text-muted-foreground">
        {getEmptySearchMessage(debouncedQuery, albumSearchError)}
      </CommandEmpty>
    );
  }

  if (!hasResults) {
    return <CommandEmpty className="text-muted-foreground">Search for albums or users</CommandEmpty>;
  }

  return (
    <>
      {shouldShowAlbumSection ? (
        <>
          <AlbumSearchSourceHeader query={debouncedQuery} />
          <CommandGroup className="pt-0">
            {visibleAlbumResults.map((album) => (
              <AlbumResultItem album={album} dimmed={shouldDimAlbumResults} key={album.id} onSelect={onSelect} />
            ))}
            {isFetchingAlbums ? <SearchResultSkeletonRows count={hasAlbumResults ? 2 : 4} /> : null}
          </CommandGroup>
        </>
      ) : null}
      {hasUserResults ? (
        <>
          <SearchSectionHeader
            className={shouldShowAlbumSection ? "mt-1 border-border/50 border-t" : undefined}
            label="Users"
          />
          <CommandGroup className="pt-0">
            {userResults.map((user) => (
              <UserResultItem key={user.username} onSelect={onUserSelect} user={user} />
            ))}
          </CommandGroup>
        </>
      ) : null}
    </>
  );
}

function getEmptySearchMessage(debouncedQuery: string, albumSearchError: Error | null) {
  if (albumSearchError) return albumSearchError.message || albumSearchFallbackErrorMessage;

  return `No results for "${debouncedQuery}"`;
}

interface SearchSectionHeaderProps {
  className?: string;
  label: string;
}

function SearchSectionHeader({ className, label }: SearchSectionHeaderProps) {
  return (
    <div className={cn("flex shrink-0 items-center justify-between px-4 pt-3 pb-1", className)}>
      <span className="font-medium text-2xs text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}

function SpotifySearchSource({ className, href }: { className?: string; href: string }) {
  return (
    <a
      aria-label="Open search results on Spotify"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-2xs text-muted-foreground-subtle leading-none",
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
        src="/brand/spotify-full-logo-white.svg"
        width={823}
      />
    </a>
  );
}

interface AlbumSearchSourceHeaderProps {
  className?: string;
  query: string;
}

function AlbumSearchSourceHeader({ className, query }: AlbumSearchSourceHeaderProps) {
  return (
    <div className={cn("flex shrink-0 items-center justify-between px-4 pt-3 pb-1", className)}>
      <span className="font-medium text-2xs text-muted-foreground uppercase tracking-widest">Albums</span>
      <SpotifySearchSource
        className="-mr-2"
        href={`https://open.spotify.com/search/${encodeURIComponent(query.trim())}/albums`}
      />
    </div>
  );
}
