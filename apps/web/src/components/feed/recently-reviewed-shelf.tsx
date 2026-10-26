import { useMemo, useState } from "react";
import { AlbumShelf, AlbumShelfTile } from "@/components/album-shelf";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { useForYouFeedQuery } from "@/components/feed/for-you-feed-tab";
import type { AlbumShelfAlbum } from "@/components/album-shelf";
import type { FeedPage } from "@/server/services/feed-service";

const maxAlbums = 6;

export function RecentlyReviewedShelf() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const feedQuery = useForYouFeedQuery();

  const firstPage = feedQuery.data?.pages[0];
  const albums = useMemo(() => getRecentlyReviewedAlbums(firstPage?.reviews ?? []), [firstPage]);

  if (albums.length === 0) return null;

  return (
    <>
      <AlbumShelf
        action={
          <button
            className="focus-ring shrink-0 rounded-sm text-muted-foreground text-xs transition-colors hover:text-foreground"
            onClick={() => setAuthDialogOpen(true)}
            type="button"
          >
            Sign in to rate your own
          </button>
        }
        title="Recently reviewed"
      >
        {albums.map((album) => (
          <AlbumShelfTile album={album} key={album.id} />
        ))}
      </AlbumShelf>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} source="home_intro" />
    </>
  );
}

function getRecentlyReviewedAlbums(reviews: FeedPage["reviews"]) {
  const albums = new Map<string, AlbumShelfAlbum>();
  const newestFirst = [...reviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const { album } of newestFirst) {
    if (albums.has(album.id)) continue;

    albums.set(album.id, { ...album, spotifyUrl: `https://open.spotify.com/album/${album.id}` });
    if (albums.size === maxAlbums) break;
  }

  return [...albums.values()];
}
