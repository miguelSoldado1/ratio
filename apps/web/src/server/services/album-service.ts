import { eq } from "drizzle-orm";
import { albums } from "@/lib/db/schema";
import { getAlbumPersistenceMetadata } from "./spotify-service";
import type { Db } from "@/lib/db";

// Types

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type AlbumWriteDb = Db | DbTransaction;
type AlbumWriteMetadata = Awaited<ReturnType<typeof getAlbumPersistenceMetadata>>;

// Services

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
