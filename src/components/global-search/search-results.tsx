import { CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
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
              <AlbumResultItem album={album} key={album.id} onSelect={onSelect} />
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

function SearchResultSkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div aria-label="Loading search results" className="px-2 py-1" role="status">
      <span className="sr-only">Loading search results</span>
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <SearchResultSkeletonRow index={index} key={index} />
      ))}
    </div>
  );
}

function SearchResultSkeletonRow({ index }: { index: number }) {
  const titleWidth = index % 3 === 1 ? "w-56" : "w-44";
  const metaWidth = index % 2 === 0 ? "w-32" : "w-24";

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2.5">
      <Skeleton className="size-10 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <Skeleton className={cn("h-4 max-w-full rounded-sm", titleWidth)} />
        <Skeleton className={cn("mt-2 h-3 max-w-full rounded-sm", metaWidth)} />
      </div>
    </div>
  );
}

function getEmptySearchMessage(debouncedQuery: string, albumSearchError: Error | null) {
  if (albumSearchError) return albumSearchError.message || albumSearchFallbackErrorMessage;

  return `No results for "${debouncedQuery}"`;
}

interface UserResultItemProps {
  onSelect: (user: UserResult) => void;
  user: UserResult;
}

function UserResultItem({ user, onSelect }: UserResultItemProps) {
  const displayName = user.displayUsername ?? `@${user.username}`;

  return (
    <CommandItem className="items-center gap-3 py-2.5" onSelect={() => onSelect(user)} value={`user:${user.username}`}>
      <UserAvatar className="size-10 text-xs" name={displayName} src={user.avatarUrl} />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium text-foreground text-sm">{displayName}</p>
        {user.displayUsername ? <p className="truncate text-muted-foreground text-xs">@{user.username}</p> : null}
      </div>
    </CommandItem>
  );
}

interface AlbumResultItemProps {
  album: AlbumResult;
  onSelect: (album: AlbumResult) => void;
}

function AlbumResultItem({ album, onSelect }: AlbumResultItemProps) {
  const artists = album.artists.map((artist) => artist.name).join(", ");

  return (
    <CommandItem className="items-center gap-3 py-2.5" onSelect={() => onSelect(album)} value={`album:${album.id}`}>
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

function SearchSectionHeader({ className, label }: { className?: string; label: string }) {
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

function AlbumSearchSourceHeader({ className, query }: { className?: string; query: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-between px-4 pt-3 pb-1", className)}>
      <span className="font-medium text-2xs text-muted-foreground uppercase tracking-widest">Albums</span>
      <SpotifySearchSource className="-mr-2" href={getSpotifySearchUrl(query)} />
    </div>
  );
}

function getSpotifySearchUrl(query: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(query.trim())}/albums`;
}
