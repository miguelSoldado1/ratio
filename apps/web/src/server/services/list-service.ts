import { and, count, desc, eq, isNotNull, max, sql } from "drizzle-orm";
import z from "zod";
import { getDb } from "@/lib/db";
import { albums, listItems, lists, user } from "@/lib/db/schema";
import { decodeCursor, encodeCursor, getCreatedAtIdCursorFilter, getOptionalCurrentUser } from "../server-utils";
import { ensureAlbumExistsForWrite, getMissingAlbumMetadataForWrite } from "./album-service";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "../auth-middleware";

// Constants

const listCoverAlbumLimit = 4;
const listsPageSize = 20;
const maxListItems = 100;

// Schemas

const userListsCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

// Types

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type ListMutationDb = Db | DbTransaction;

export interface ListCoverAlbum {
  coverUrl?: null | string;
  id: string;
}

export interface ListAlbum extends ListCoverAlbum {
  addedAt: Date;
  artist: string;
  spotifyUrl: string;
  title: string;
  year: string;
}

export interface ListAuthor {
  avatarUrl?: string;
  displayName: string;
  id: string;
  username: string;
}

export interface ListDetails {
  albums: ListAlbum[];
  author: ListAuthor;
  canEdit: boolean;
  coverAlbums: ListCoverAlbum[];
  description?: string;
  id: string;
  title: string;
  updatedAt: Date;
}

export interface ListSummary {
  author: ListAuthor;
  coverAlbums: ListCoverAlbum[];
  description?: string;
  id: string;
  itemCount: number;
  title: string;
  updatedAt: Date;
}

export interface ListIdInput {
  listId: string;
}

export interface UserListsInput {
  cursor?: string;
  userId: string;
}

export interface MyListForAlbum {
  containsAlbum: boolean;
  id: string;
  itemCount: number;
  title: string;
}

export interface MyListsForAlbumInput {
  albumId: string;
  cursor?: string;
}

export interface MyListsForAlbumPage {
  lists: MyListForAlbum[];
  nextCursor: null | string;
}

export interface ListDetailsInput {
  description: null | string;
  title: string;
}

export type CreateListInput = ListDetailsInput;
export type UpdateListInput = ListDetailsInput & ListIdInput;

export interface ListItemInput extends ListIdInput {
  albumId: string;
}

export interface ReorderListItemsInput extends ListIdInput {
  albumIds: string[];
}

// Services

export async function getListService(data: ListIdInput) {
  const db = await getDb();
  const currentUser = await getOptionalCurrentUser(db);
  const authorVisibilityFilter = getListAuthorVisibilityFilter(currentUser?.isAdmin ?? false);

  const [listRow] = await db
    .select({
      author: {
        avatarUrl: user.image,
        displayUsername: user.displayUsername,
        id: user.id,
        name: user.name,
        username: user.username,
      },
      list: {
        description: lists.description,
        id: lists.id,
        title: lists.title,
        updatedAt: lists.updatedAt,
        userId: lists.userId,
      },
    })
    .from(lists)
    .innerJoin(user, eq(lists.userId, user.id))
    .where(and(eq(lists.id, data.listId), authorVisibilityFilter))
    .limit(1);

  if (!listRow) return null;

  const itemRows = await db
    .select({
      addedAt: listItems.createdAt,
      artistNames: albums.artistNames,
      coverUrl: albums.coverUrl,
      id: albums.id,
      releaseDate: albums.releaseDate,
      title: albums.title,
    })
    .from(listItems)
    .innerJoin(albums, eq(listItems.albumId, albums.id))
    .where(eq(listItems.listId, data.listId))
    .orderBy(desc(listItems.position));

  const listAlbums = itemRows.map((item) => mapListAlbum(item, item.addedAt));

  return {
    albums: listAlbums,
    author: mapListAuthor(listRow.author),
    canEdit: currentUser?.id === listRow.list.userId,
    coverAlbums: itemRows
      .slice(0, listCoverAlbumLimit)
      .map(({ coverUrl, id }) => ({ coverUrl: coverUrl ?? undefined, id })),
    description: listRow.list.description ?? undefined,
    id: listRow.list.id,
    title: listRow.list.title,
    updatedAt: listRow.list.updatedAt,
  };
}

export async function getUserListsService(data: UserListsInput) {
  const db = await getDb();
  const currentUser = await getOptionalCurrentUser(db);
  const authorVisibilityFilter = getListAuthorVisibilityFilter(currentUser?.isAdmin ?? false);

  const cursor = data.cursor
    ? decodeCursor(data.cursor, userListsCursorPayloadSchema, "Invalid user lists cursor")
    : undefined;
  const cursorFilter = cursor ? getCreatedAtIdCursorFilter(cursor, lists) : undefined;

  const firstItems = db
    .select({
      albumId: listItems.albumId,
      itemCount: sql<number>`count(*) over()`.as("item_count"),
      position: listItems.position,
    })
    .from(listItems)
    .where(eq(listItems.listId, lists.id))
    .orderBy(desc(listItems.position))
    .limit(listCoverAlbumLimit)
    .as("first_items");

  const itemSummary = db
    .select({
      coverAlbums: sql<
        ListCoverAlbum[]
      >`coalesce(json_agg(json_build_object('id', ${firstItems.albumId}, 'coverUrl', ${albums.coverUrl}) order by ${firstItems.position} desc), '[]'::json)`.as(
        "cover_albums"
      ),
      itemCount: sql<number>`coalesce(max(${firstItems.itemCount}), 0)::int`.as("item_count"),
    })
    .from(firstItems)
    .leftJoin(albums, eq(albums.id, firstItems.albumId))
    .as("item_summary");

  const listRows = await db
    .select({
      author: {
        avatarUrl: user.image,
        displayUsername: user.displayUsername,
        id: user.id,
        name: user.name,
        username: user.username,
      },
      coverAlbums: itemSummary.coverAlbums,
      list: {
        createdAt: lists.createdAt,
        description: lists.description,
        id: lists.id,
        title: lists.title,
        updatedAt: lists.updatedAt,
      },
      itemCount: itemSummary.itemCount,
    })
    .from(lists)
    .innerJoin(user, eq(lists.userId, user.id))
    .innerJoinLateral(itemSummary, sql`true`)
    .where(and(eq(lists.userId, data.userId), authorVisibilityFilter, cursorFilter))
    .orderBy(desc(lists.createdAt), desc(lists.id))
    .limit(listsPageSize + 1);

  const hasNextPage = listRows.length > listsPageSize;
  const pageRows = hasNextPage ? listRows.slice(0, listsPageSize) : listRows;
  const lastList = pageRows.at(-1)?.list;

  return {
    lists: pageRows.map((row) => ({
      author: mapListAuthor(row.author),
      coverAlbums: row.coverAlbums,
      description: row.list.description ?? undefined,
      id: row.list.id,
      itemCount: row.itemCount,
      title: row.list.title,
      updatedAt: row.list.updatedAt,
    })),
    nextCursor:
      hasNextPage && lastList
        ? encodeCursor({
            createdAt: lastList.createdAt.toISOString(),
            id: lastList.id,
          })
        : null,
  };
}

export async function getMyListsForAlbumService(data: MyListsForAlbumInput, context: AuthenticatedContext) {
  const cursor = data.cursor
    ? decodeCursor(data.cursor, userListsCursorPayloadSchema, "Invalid album list cursor")
    : undefined;
  const cursorFilter = cursor ? getCreatedAtIdCursorFilter(cursor, lists) : undefined;

  const itemSummary = context.db
    .select({
      containsAlbum: sql<boolean>`coalesce(bool_or(${listItems.albumId} = ${data.albumId}), false)`.as(
        "contains_album"
      ),
      itemCount: sql<number>`count(*)::int`.as("item_count"),
    })
    .from(listItems)
    .where(eq(listItems.listId, lists.id))
    .as("item_summary");

  const listRows = await context.db
    .select({
      containsAlbum: itemSummary.containsAlbum,
      itemCount: itemSummary.itemCount,
      list: {
        createdAt: lists.createdAt,
        id: lists.id,
        title: lists.title,
      },
    })
    .from(lists)
    .innerJoinLateral(itemSummary, sql`true`)
    .where(and(eq(lists.userId, context.user.id), cursorFilter))
    .orderBy(desc(lists.createdAt), desc(lists.id))
    .limit(listsPageSize + 1);

  const hasNextPage = listRows.length > listsPageSize;
  const pageRows = hasNextPage ? listRows.slice(0, listsPageSize) : listRows;
  const lastList = pageRows.at(-1)?.list;

  return {
    lists: pageRows.map((row) => ({
      containsAlbum: row.containsAlbum,
      id: row.list.id,
      itemCount: row.itemCount,
      title: row.list.title,
    })),
    nextCursor:
      hasNextPage && lastList
        ? encodeCursor({
            createdAt: lastList.createdAt.toISOString(),
            id: lastList.id,
          })
        : null,
  };
}

export async function createListService(data: CreateListInput, context: AuthenticatedContext) {
  const [createdList] = await context.db
    .insert(lists)
    .values({ description: data.description, title: data.title, userId: context.user.id })
    .returning({ id: lists.id, updatedAt: lists.updatedAt });

  if (!createdList) {
    throw new Error("Could not create list");
  }

  return createdList;
}

export async function updateListService(data: UpdateListInput, context: AuthenticatedContext) {
  const updatedAt = new Date();

  const [updatedList] = await context.db
    .update(lists)
    .set({
      description: data.description,
      title: data.title,
      updatedAt,
    })
    .where(and(eq(lists.id, data.listId), eq(lists.userId, context.user.id)))
    .returning({
      description: lists.description,
      title: lists.title,
      updatedAt: lists.updatedAt,
    });

  if (!updatedList) {
    throw new Error("List not found");
  }

  return updatedList;
}

export async function deleteListService(data: ListIdInput, context: AuthenticatedContext) {
  const ownershipFilter = context.user.isAdmin ? undefined : eq(lists.userId, context.user.id);

  const [deletedList] = await context.db
    .delete(lists)
    .where(and(eq(lists.id, data.listId), ownershipFilter))
    .returning({ id: lists.id });

  if (!deletedList) {
    throw new Error("List not found");
  }

  return deletedList;
}

export async function addListItemService(data: ListItemInput, context: AuthenticatedContext) {
  await assertListCanAcceptAlbum(data, context.user.id, context.db);
  const albumMetadata = await getMissingAlbumMetadataForWrite(data.albumId, context.db);

  return await context.db.transaction(async (transaction) => {
    const lockedList = await lockOwnedList(data.listId, context.user.id, transaction);
    const existingItem = await getListItem(data, transaction);

    if (existingItem) {
      return {
        added: false,
        album: mapListAlbum(existingItem.album, existingItem.createdAt),
        position: existingItem.position,
        updatedAt: lockedList.updatedAt,
      };
    }

    const [itemStats] = await transaction
      .select({
        count: count(listItems.albumId),
        maxPosition: max(listItems.position),
      })
      .from(listItems)
      .where(eq(listItems.listId, data.listId));

    if ((itemStats?.count ?? 0) >= maxListItems) {
      throw new Error(`A list can contain up to ${maxListItems} albums`);
    }

    const position = (itemStats?.maxPosition ?? -1) + 1;
    await ensureAlbumExistsForWrite(albumMetadata, transaction);

    const [insertedItem] = await transaction
      .insert(listItems)
      .values({
        albumId: data.albumId,
        listId: data.listId,
        position,
      })
      .returning({
        createdAt: listItems.createdAt,
        position: listItems.position,
      });

    if (!insertedItem) {
      throw new Error("Could not add album to list");
    }

    const album = await getAlbumForList(data.albumId, transaction);
    const updatedAt = await touchList(data.listId, transaction);

    return {
      added: true,
      album: mapListAlbum(album, insertedItem.createdAt),
      position: insertedItem.position,
      updatedAt,
    };
  });
}

export async function removeListItemService(data: ListItemInput, context: AuthenticatedContext) {
  return await context.db.transaction(async (transaction) => {
    const lockedList = await lockOwnedList(data.listId, context.user.id, transaction);
    const [removedItem] = await transaction
      .delete(listItems)
      .where(and(eq(listItems.listId, data.listId), eq(listItems.albumId, data.albumId)))
      .returning({ albumId: listItems.albumId });

    if (!removedItem) {
      return {
        albumId: data.albumId,
        removed: false,
        updatedAt: lockedList.updatedAt,
      };
    }

    return {
      albumId: removedItem.albumId,
      removed: true,
      updatedAt: await touchList(data.listId, transaction),
    };
  });
}

export async function reorderListItemsService(data: ReorderListItemsInput, context: AuthenticatedContext) {
  return await context.db.transaction(async (transaction) => {
    const lockedList = await lockOwnedList(data.listId, context.user.id, transaction);
    const storedItems = await transaction
      .select({
        albumId: listItems.albumId,
        position: listItems.position,
      })
      .from(listItems)
      .where(eq(listItems.listId, data.listId))
      .orderBy(desc(listItems.position));

    const storedAlbumIds = storedItems.map((item) => item.albumId);

    if (!haveSameValues(storedAlbumIds, data.albumIds)) {
      throw new Error("The list changed while you were reordering it. Refresh and try again.");
    }

    if (storedAlbumIds.every((albumId, index) => albumId === data.albumIds[index])) {
      return {
        albumIds: storedAlbumIds,
        reordered: false,
        updatedAt: lockedList.updatedAt,
      };
    }

    const maxPosition = Math.max(...storedItems.map((item) => item.position));
    const temporaryOffset = maxPosition + 1;

    // The position index is unique per list and is not deferrable. Move every row outside the
    // current range first so assigning the final dense positions cannot collide mid-update.
    await transaction
      .update(listItems)
      .set({ position: sql`${listItems.position} + ${temporaryOffset}` })
      .where(eq(listItems.listId, data.listId));

    const positionCases = data.albumIds.map(
      (albumId, index) => sql`when ${listItems.albumId} = ${albumId} then ${data.albumIds.length - index - 1}`
    );

    await transaction
      .update(listItems)
      .set({
        position: sql`case ${sql.join(positionCases, sql.raw(" "))} else null::integer end`,
      })
      .where(eq(listItems.listId, data.listId));

    return {
      albumIds: data.albumIds,
      reordered: true,
      updatedAt: await touchList(data.listId, transaction),
    };
  });
}

// Helpers

async function assertListCanAcceptAlbum(data: ListItemInput, userId: string, db: ListMutationDb) {
  const [listState] = await db
    .select({
      containsAlbum: sql<boolean>`coalesce(bool_or(${listItems.albumId} = ${data.albumId}), false)`.as(
        "contains_album"
      ),
      itemCount: sql<number>`count(${listItems.albumId})::int`.as("item_count"),
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .where(and(eq(lists.id, data.listId), eq(lists.userId, userId)))
    .groupBy(lists.id);

  if (!listState) {
    throw new Error("List not found");
  }

  if (!listState.containsAlbum && listState.itemCount >= maxListItems) {
    throw new Error(`A list can contain up to ${maxListItems} albums`);
  }
}

async function lockOwnedList(listId: string, userId: string, transaction: DbTransaction) {
  const [lockedList] = await transaction
    .select({
      id: lists.id,
      updatedAt: lists.updatedAt,
    })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
    .limit(1)
    .for("update");

  if (!lockedList) {
    throw new Error("List not found");
  }

  return lockedList;
}

async function getListItem(data: ListItemInput, db: ListMutationDb) {
  const [item] = await db
    .select({
      album: {
        artistNames: albums.artistNames,
        coverUrl: albums.coverUrl,
        id: albums.id,
        releaseDate: albums.releaseDate,
        title: albums.title,
      },
      createdAt: listItems.createdAt,
      position: listItems.position,
    })
    .from(listItems)
    .innerJoin(albums, eq(listItems.albumId, albums.id))
    .where(and(eq(listItems.listId, data.listId), eq(listItems.albumId, data.albumId)))
    .limit(1);

  return item;
}

async function getAlbumForList(albumId: string, db: ListMutationDb) {
  const [album] = await db
    .select({
      artistNames: albums.artistNames,
      coverUrl: albums.coverUrl,
      id: albums.id,
      releaseDate: albums.releaseDate,
      title: albums.title,
    })
    .from(albums)
    .where(eq(albums.id, albumId))
    .limit(1);

  if (!album) {
    throw new Error("Album not found");
  }

  return album;
}

async function touchList(listId: string, transaction: DbTransaction) {
  const updatedAt = new Date();
  const [updatedList] = await transaction
    .update(lists)
    .set({ updatedAt })
    .where(eq(lists.id, listId))
    .returning({ updatedAt: lists.updatedAt });

  if (!updatedList) {
    throw new Error("List not found");
  }

  return updatedList.updatedAt;
}

function getListAuthorVisibilityFilter(isAdmin: boolean) {
  return and(isNotNull(user.username), isAdmin ? undefined : sql`${user.banned} is not true`);
}

function haveSameValues(firstValues: string[], secondValues: string[]) {
  if (firstValues.length !== secondValues.length) return false;

  const secondValueSet = new Set(secondValues);
  return firstValues.every((value) => secondValueSet.has(value));
}

// Mappers

function mapListAuthor(author: {
  avatarUrl: null | string;
  displayUsername: null | string;
  id: string;
  name: string;
  username: null | string;
}): ListAuthor {
  return {
    avatarUrl: author.avatarUrl ?? undefined,
    displayName: author.displayUsername ?? author.name,
    id: author.id,
    username: author.username ?? author.id,
  };
}

function mapListAlbum(
  album: {
    artistNames: string[];
    coverUrl: null | string;
    id: string;
    releaseDate: string;
    title: string;
  },
  addedAt: Date
) {
  return {
    addedAt,
    artist: album.artistNames.join(", "),
    coverUrl: album.coverUrl ?? undefined,
    id: album.id,
    spotifyUrl: `https://open.spotify.com/album/${album.id}`,
    title: album.title,
    year: album.releaseDate.slice(0, 4),
  };
}
