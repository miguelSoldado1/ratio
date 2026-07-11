import type { searchUsers } from "@/server/functions/review-functions";
import type { searchAlbums } from "@/server/functions/spotify-functions";

export type AlbumResult = Awaited<ReturnType<typeof searchAlbums>>[number];
export type UserResult = Awaited<ReturnType<typeof searchUsers>>[number];
