import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { albums } from "@/lib/db/schema";
import { getAlbumDetailsService, getAlbumPersistenceMetadata } from "./spotify-service";
import type { Db } from "@/lib/db";

// Types

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type AlbumWriteDb = Db | DbTransaction;
type AlbumWriteMetadata = Awaited<ReturnType<typeof getAlbumPersistenceMetadata>>;

interface AlbumHeadMetadata {
  artistNames: string[];
  coverUrl: string | null;
  title: string;
}

// Services

export async function getAlbumHeadMetadataService(albumId: string) {
  const localAlbum = await getLocalAlbumHeadMetadata(albumId);
  if (localAlbum) return localAlbum;

  // Spotify errors propagate: the caller must not treat an outage as a missing album.
  const { album } = await getAlbumDetailsService({ albumId });
  const metadata: AlbumHeadMetadata = {
    artistNames: album.artists.map((artist) => artist.name),
    coverUrl: album.coverUrl,
    title: album.title,
  };

  return metadata;
}

async function getLocalAlbumHeadMetadata(albumId: string) {
  try {
    const db = await getDb();
    const [album] = await db
      .select({
        artistNames: albums.artistNames,
        coverUrl: albums.coverUrl,
        title: albums.title,
      })
      .from(albums)
      .where(eq(albums.id, albumId))
      .limit(1);

    if (!album) return null;

    const metadata: AlbumHeadMetadata = {
      artistNames: album.artistNames,
      coverUrl: album.coverUrl,
      title: album.title,
    };

    return metadata;
  } catch (error) {
    console.error("album_head_metadata_local_lookup_error", { albumId, error });
    return null;
  }
}

export async function getMissingAlbumMetadataForWrite(albumId: string, db: Db): Promise<AlbumWriteMetadata | null> {
  const [existingAlbum] = await db.select({ id: albums.id }).from(albums).where(eq(albums.id, albumId)).limit(1);
  if (existingAlbum) return null;

  try {
    return await getAlbumPersistenceMetadata(albumId);
  } catch (error) {
    const [raceCreatedAlbum] = await db.select({ id: albums.id }).from(albums).where(eq(albums.id, albumId)).limit(1);

    if (raceCreatedAlbum) return null;

    throw error;
  }
}

export async function ensureAlbumExistsForWrite(albumMetadata: AlbumWriteMetadata | null, db: AlbumWriteDb) {
  if (!albumMetadata) return;

  const albumValues = { ...albumMetadata, updatedAt: new Date() };

  await db
    .insert(albums)
    .values(albumValues)
    .onConflictDoUpdate({
      target: albums.id,
      set: {
        artistNames: albumValues.artistNames,
        coverUrl: albumValues.coverUrl,
        releaseDate: albumValues.releaseDate,
        title: albumValues.title,
        totalTracks: albumValues.totalTracks,
        updatedAt: albumValues.updatedAt,
      },
    });
}
