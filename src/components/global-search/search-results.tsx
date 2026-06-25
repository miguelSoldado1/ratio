import { CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { AlbumResult, UserResult } from "./types";

const albumResultsBeforeUsersLimit = 5;

interface SearchResultsProps {
  albumResults: AlbumResult[];
  debouncedQuery: string;
  isFetchingAlbums: boolean;
  isFetchingUsers: boolean;
  onSelect: (album: AlbumResult) => void;
  onUserSelect: (user: UserResult) => void;
  userResults: UserResult[];
}

export function SearchResults({
  albumResults,
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

  if (isFetching && !hasResults) {
    return <CommandEmpty className="text-muted-foreground">Searching...</CommandEmpty>;
  }

  if (!isFetching && debouncedQuery && !hasResults) {
    return <CommandEmpty className="text-muted-foreground">No results for "{debouncedQuery}"</CommandEmpty>;
  }

  if (!hasResults) {
    return <CommandEmpty className="text-muted-foreground">Search for albums or users</CommandEmpty>;
  }

  return (
    <>
      {hasAlbumResults || isFetchingAlbums ? (
        <>
          <AlbumSearchSourceHeader query={debouncedQuery} />
          <CommandGroup className="pt-0">
            {visibleAlbumResults.map((album) => (
              <AlbumResultItem album={album} key={album.id} onSelect={onSelect} />
            ))}
            {isFetchingAlbums ? (
              <p className="px-3 py-2 text-muted-foreground text-xs">
                {hasAlbumResults ? "Updating album results..." : "Searching albums..."}
              </p>
            ) : null}
          </CommandGroup>
        </>
      ) : null}
      {hasUserResults ? (
        <>
          <SearchSectionHeader
            className={hasAlbumResults || isFetchingAlbums ? "mt-1 border-border/50 border-t" : undefined}
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

interface UserResultItemProps {
  onSelect: (user: UserResult) => void;
  user: UserResult;
}

function UserResultItem({ user, onSelect }: UserResultItemProps) {
  const displayName = user.displayUsername ?? `@${user.username}`;

  return (
    <CommandItem className="items-center gap-3 py-2.5" onSelect={() => onSelect(user)} value={`user:${user.username}`}>
      <UserAvatar className="size-10 text-xs" height={40} name={displayName} src={user.avatarUrl} width={40} />
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
      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
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

function AlbumSearchSourceHeader({ className, query }: { className?: string; query: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-between px-4 pt-3 pb-1", className)}>
      <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-widest">Albums</span>
      <SpotifySearchSource className="-mr-2" href={getSpotifySearchUrl(query)} />
    </div>
  );
}

function getSpotifySearchUrl(query: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(query.trim())}/albums`;
}
